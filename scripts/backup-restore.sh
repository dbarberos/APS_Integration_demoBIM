#!/bin/bash

"""
Script de backup y disaster recovery para la aplicación APS
Maneja respaldos automáticos y procedimientos de recuperación
"""

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="/tmp/aps-backup-${TIMESTAMP}.log"

# Default values
ENVIRONMENT=""
REGION="us-west-2"
OPERATION=""
BACKUP_NAME=""
RESTORE_POINT=""
S3_BUCKET=""
RETENTION_DAYS=30
DRY_RUN=false
ENCRYPT=true

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Backup and disaster recovery script for APS application

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (dev|staging|production)
    -r, --region REGION             AWS region (default: us-west-2)
    -o, --operation OPERATION       Operation (backup|restore|list|cleanup)
    -n, --name BACKUP_NAME          Backup name (for restore operation)
    -p, --restore-point TIMESTAMP   Restore point timestamp (YYYYMMDD_HHMMSS)
    -b, --bucket S3_BUCKET          S3 bucket for file backups
    --retention-days DAYS           Backup retention period (default: 30)
    --no-encrypt                    Disable encryption for backups
    -d, --dry-run                   Show what would be done without executing
    -h, --help                      Show this help message

OPERATIONS:
    backup      Create full backup (database + files + configuration)
    restore     Restore from backup
    list        List available backups
    cleanup     Clean up old backups based on retention policy

EXAMPLES:
    $0 -e production -o backup              # Create production backup
    $0 -e staging -o restore -n backup-123  # Restore staging from specific backup
    $0 -e production -o list                # List production backups
    $0 -e staging -o cleanup                # Clean up old staging backups

EOF
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in aws pg_dump pg_restore s3cmd gpg; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

load_configuration() {
    log "Loading configuration for environment: $ENVIRONMENT"
    
    # Load environment-specific configuration
    local env_config="$PROJECT_ROOT/infra/config/$ENVIRONMENT.env"
    if [[ -f "$env_config" ]]; then
        source "$env_config"
    fi
    
    # Set defaults if not configured
    DATABASE_NAME=${DATABASE_NAME:-aps_${ENVIRONMENT}_db}
    DATABASE_USER=${DATABASE_USER:-aps_user}
    S3_BUCKET=${S3_BUCKET:-aps-${ENVIRONMENT}-backups}
    KMS_KEY_ID=${KMS_KEY_ID:-alias/aps-${ENVIRONMENT}-key}
    
    log_info "Configuration loaded:"
    log_info "  Database: $DATABASE_NAME"
    log_info "  S3 Bucket: $S3_BUCKET"
    log_info "  KMS Key: $KMS_KEY_ID"
    log_info "  Retention: $RETENTION_DAYS days"
}

get_database_endpoint() {
    log_info "Getting database endpoint..."
    
    local db_endpoint
    db_endpoint=$(aws rds describe-db-instances \
        --region "$REGION" \
        --query "DBInstances[?DBName=='$DATABASE_NAME'].Endpoint.Address" \
        --output text)
    
    if [[ -z "$db_endpoint" ]]; then
        log_error "Could not find database endpoint for $DATABASE_NAME"
        exit 1
    fi
    
    echo "$db_endpoint"
}

create_database_backup() {
    log "Creating database backup..."
    
    local db_endpoint
    db_endpoint=$(get_database_endpoint)
    
    local backup_file="db-backup-${ENVIRONMENT}-${TIMESTAMP}.sql"
    local backup_path="/tmp/$backup_file"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would create database backup: $backup_file"
        return 0
    fi
    
    # Get database password from AWS Secrets Manager
    local db_password
    db_password=$(aws secretsmanager get-secret-value \
        --region "$REGION" \
        --secret-id "aps-${ENVIRONMENT}/database/password" \
        --query 'SecretString' \
        --output text)
    
    # Create database dump
    log_info "Creating database dump..."
    PGPASSWORD="$db_password" pg_dump \
        -h "$db_endpoint" \
        -U "$DATABASE_USER" \
        -d "$DATABASE_NAME" \
        --verbose \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        -f "$backup_path"
    
    # Compress backup
    log_info "Compressing backup..."
    gzip "$backup_path"
    backup_path="${backup_path}.gz"
    
    # Encrypt backup if enabled
    if [[ "$ENCRYPT" == "true" ]]; then
        log_info "Encrypting backup..."
        aws kms encrypt \
            --region "$REGION" \
            --key-id "$KMS_KEY_ID" \
            --plaintext "fileb://$backup_path" \
            --output text \
            --query 'CiphertextBlob' | base64 -d > "${backup_path}.enc"
        
        rm "$backup_path"
        backup_path="${backup_path}.enc"
    fi
    
    # Upload to S3
    log_info "Uploading to S3..."
    aws s3 cp "$backup_path" "s3://$S3_BUCKET/database/$backup_file$([ "$ENCRYPT" == "true" ] && echo ".gz.enc" || echo ".gz")" \
        --region "$REGION" \
        --storage-class STANDARD_IA
    
    # Clean up local file
    rm "$backup_path"
    
    log_success "Database backup created: $backup_file"
    echo "$backup_file"
}

create_files_backup() {
    log "Creating files backup..."
    
    local files_backup="files-backup-${ENVIRONMENT}-${TIMESTAMP}.tar.gz"
    local backup_path="/tmp/$files_backup"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would create files backup: $files_backup"
        return 0
    fi
    
    # Get EFS mount points or S3 buckets used for file storage
    local file_storage_bucket
    file_storage_bucket=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, 'aps-${ENVIRONMENT}-files')].Name" \
        --output text)
    
    if [[ -n "$file_storage_bucket" ]]; then
        log_info "Backing up S3 file storage..."
        
        # Create temporary directory
        local temp_dir="/tmp/aps-files-${TIMESTAMP}"
        mkdir -p "$temp_dir"
        
        # Download files from S3
        aws s3 sync "s3://$file_storage_bucket" "$temp_dir" --region "$REGION"
        
        # Create archive
        tar -czf "$backup_path" -C "$(dirname "$temp_dir")" "$(basename "$temp_dir")"
        
        # Clean up temporary directory
        rm -rf "$temp_dir"
    else
        log_warning "No file storage found for backup"
        return 0
    fi
    
    # Encrypt if enabled
    if [[ "$ENCRYPT" == "true" ]]; then
        log_info "Encrypting files backup..."
        aws kms encrypt \
            --region "$REGION" \
            --key-id "$KMS_KEY_ID" \
            --plaintext "fileb://$backup_path" \
            --output text \
            --query 'CiphertextBlob' | base64 -d > "${backup_path}.enc"
        
        rm "$backup_path"
        backup_path="${backup_path}.enc"
    fi
    
    # Upload to S3
    log_info "Uploading files backup to S3..."
    aws s3 cp "$backup_path" "s3://$S3_BUCKET/files/$files_backup$([ "$ENCRYPT" == "true" ] && echo ".enc" || "")" \
        --region "$REGION" \
        --storage-class STANDARD_IA
    
    # Clean up local file
    rm "$backup_path"
    
    log_success "Files backup created: $files_backup"
    echo "$files_backup"
}

create_configuration_backup() {
    log "Creating configuration backup..."
    
    local config_backup="config-backup-${ENVIRONMENT}-${TIMESTAMP}.tar.gz"
    local backup_path="/tmp/$config_backup"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would create configuration backup: $config_backup"
        return 0
    fi
    
    # Create temporary directory
    local temp_dir="/tmp/aps-config-${TIMESTAMP}"
    mkdir -p "$temp_dir"
    
    # Export Terraform state
    log_info "Exporting Terraform state..."
    cd "$PROJECT_ROOT/infra/terraform/environments/$ENVIRONMENT"
    terraform state pull > "$temp_dir/terraform.tfstate"
    
    # Export ECS task definitions
    log_info "Exporting ECS task definitions..."
    local cluster_name="aps-${ENVIRONMENT}-cluster"
    
    for service in backend frontend celery-worker; do
        aws ecs describe-task-definition \
            --region "$REGION" \
            --task-definition "aps-${ENVIRONMENT}-${service}" \
            --output json > "$temp_dir/task-definition-${service}.json"
    done
    
    # Export secrets (metadata only, not values)
    log_info "Exporting secrets metadata..."
    aws secretsmanager list-secrets \
        --region "$REGION" \
        --query "SecretList[?contains(Name, 'aps-${ENVIRONMENT}')]" \
        --output json > "$temp_dir/secrets-metadata.json"
    
    # Export environment configuration
    cp "$PROJECT_ROOT/infra/config/$ENVIRONMENT.env" "$temp_dir/" 2>/dev/null || true
    
    # Create archive
    tar -czf "$backup_path" -C "$(dirname "$temp_dir")" "$(basename "$temp_dir")"
    
    # Clean up temporary directory
    rm -rf "$temp_dir"
    
    # Encrypt if enabled
    if [[ "$ENCRYPT" == "true" ]]; then
        log_info "Encrypting configuration backup..."
        aws kms encrypt \
            --region "$REGION" \
            --key-id "$KMS_KEY_ID" \
            --plaintext "fileb://$backup_path" \
            --output text \
            --query 'CiphertextBlob' | base64 -d > "${backup_path}.enc"
        
        rm "$backup_path"
        backup_path="${backup_path}.enc"
    fi
    
    # Upload to S3
    log_info "Uploading configuration backup to S3..."
    aws s3 cp "$backup_path" "s3://$S3_BUCKET/config/$config_backup$([ "$ENCRYPT" == "true" ] && echo ".enc" || "")" \
        --region "$REGION" \
        --storage-class STANDARD_IA
    
    # Clean up local file
    rm "$backup_path"
    
    log_success "Configuration backup created: $config_backup"
    echo "$config_backup"
}

create_full_backup() {
    log "Creating full backup for environment: $ENVIRONMENT"
    
    local backup_manifest="/tmp/backup-manifest-${ENVIRONMENT}-${TIMESTAMP}.json"
    
    # Create database backup
    local db_backup
    db_backup=$(create_database_backup)
    
    # Create files backup
    local files_backup
    files_backup=$(create_files_backup)
    
    # Create configuration backup
    local config_backup
    config_backup=$(create_configuration_backup)
    
    # Create RDS snapshot
    log "Creating RDS snapshot..."
    local rds_snapshot="aps-${ENVIRONMENT}-snapshot-${TIMESTAMP}"
    
    if [[ "$DRY_RUN" == "false" ]]; then
        aws rds create-db-snapshot \
            --region "$REGION" \
            --db-instance-identifier "aps-${ENVIRONMENT}-db" \
            --db-snapshot-identifier "$rds_snapshot" > /dev/null
        
        log_info "RDS snapshot created: $rds_snapshot"
    fi
    
    # Create backup manifest
    cat > "$backup_manifest" << EOF
{
    "timestamp": "$TIMESTAMP",
    "environment": "$ENVIRONMENT",
    "region": "$REGION",
    "database_backup": "$db_backup",
    "files_backup": "$files_backup",
    "config_backup": "$config_backup",
    "rds_snapshot": "$rds_snapshot",
    "encrypted": $ENCRYPT,
    "retention_days": $RETENTION_DAYS
}
EOF
    
    # Upload manifest
    if [[ "$DRY_RUN" == "false" ]]; then
        aws s3 cp "$backup_manifest" "s3://$S3_BUCKET/manifests/backup-${ENVIRONMENT}-${TIMESTAMP}.json" \
            --region "$REGION"
    fi
    
    # Clean up local manifest
    rm "$backup_manifest"
    
    log_success "Full backup completed for $ENVIRONMENT"
    log_info "Backup ID: backup-${ENVIRONMENT}-${TIMESTAMP}"
}

list_backups() {
    log "Listing available backups for environment: $ENVIRONMENT"
    
    # List backup manifests
    local manifests
    manifests=$(aws s3 ls "s3://$S3_BUCKET/manifests/" --region "$REGION" | grep "backup-${ENVIRONMENT}" | awk '{print $4}')
    
    if [[ -z "$manifests" ]]; then
        log_warning "No backups found for environment: $ENVIRONMENT"
        return 0
    fi
    
    echo
    printf "%-30s %-15s %-20s %-10s\n" "Backup ID" "Environment" "Timestamp" "Encrypted"
    printf "%-30s %-15s %-20s %-10s\n" "----------" "-----------" "---------" "---------"
    
    for manifest in $manifests; do
        local backup_data
        backup_data=$(aws s3 cp "s3://$S3_BUCKET/manifests/$manifest" - --region "$REGION" 2>/dev/null)
        
        if [[ -n "$backup_data" ]]; then
            local backup_id
            backup_id=$(echo "$backup_data" | jq -r '.timestamp // "unknown"')
            local env
            env=$(echo "$backup_data" | jq -r '.environment // "unknown"')
            local timestamp
            timestamp=$(echo "$backup_data" | jq -r '.timestamp // "unknown"')
            local encrypted
            encrypted=$(echo "$backup_data" | jq -r '.encrypted // false')
            
            printf "%-30s %-15s %-20s %-10s\n" "backup-${env}-${backup_id}" "$env" "$timestamp" "$encrypted"
        fi
    done
    
    echo
}

restore_from_backup() {
    log "Restoring from backup: $BACKUP_NAME"
    
    if [[ -z "$BACKUP_NAME" ]]; then
        log_error "Backup name is required for restore operation"
        exit 1
    fi
    
    # Download and parse backup manifest
    local manifest_file="/tmp/restore-manifest-${TIMESTAMP}.json"
    aws s3 cp "s3://$S3_BUCKET/manifests/${BACKUP_NAME}.json" "$manifest_file" --region "$REGION"
    
    local backup_timestamp
    backup_timestamp=$(jq -r '.timestamp' "$manifest_file")
    local db_backup
    db_backup=$(jq -r '.database_backup' "$manifest_file")
    local files_backup
    files_backup=$(jq -r '.files_backup' "$manifest_file")
    local config_backup
    config_backup=$(jq -r '.config_backup' "$manifest_file")
    local rds_snapshot
    rds_snapshot=$(jq -r '.rds_snapshot' "$manifest_file")
    local encrypted
    encrypted=$(jq -r '.encrypted' "$manifest_file")
    
    log_info "Backup details:"
    log_info "  Timestamp: $backup_timestamp"
    log_info "  Database: $db_backup"
    log_info "  Files: $files_backup"
    log_info "  Config: $config_backup"
    log_info "  RDS Snapshot: $rds_snapshot"
    log_info "  Encrypted: $encrypted"
    
    # Confirm restore
    echo
    log_warning "⚠️  This will REPLACE the current $ENVIRONMENT environment with backup data!"
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would restore from backup: $BACKUP_NAME"
        return 0
    fi
    
    # Restore database
    restore_database "$db_backup" "$encrypted"
    
    # Restore files
    restore_files "$files_backup" "$encrypted"
    
    # Restore configuration
    restore_configuration "$config_backup" "$encrypted"
    
    # Clean up
    rm "$manifest_file"
    
    log_success "Restore completed from backup: $BACKUP_NAME"
}

restore_database() {
    local backup_file="$1"
    local is_encrypted="$2"
    
    log "Restoring database from: $backup_file"
    
    local db_endpoint
    db_endpoint=$(get_database_endpoint)
    
    # Download backup
    local backup_path="/tmp/$backup_file.gz"
    if [[ "$is_encrypted" == "true" ]]; then
        backup_path="${backup_path}.enc"
    fi
    
    aws s3 cp "s3://$S3_BUCKET/database/$backup_file$([ "$is_encrypted" == "true" ] && echo ".gz.enc" || echo ".gz")" "$backup_path" --region "$REGION"
    
    # Decrypt if needed
    if [[ "$is_encrypted" == "true" ]]; then
        log_info "Decrypting database backup..."
        aws kms decrypt \
            --region "$REGION" \
            --ciphertext-blob "fileb://$backup_path" \
            --output text \
            --query 'Plaintext' | base64 -d > "${backup_path%.enc}"
        
        rm "$backup_path"
        backup_path="${backup_path%.enc}"
    fi
    
    # Decompress
    log_info "Decompressing database backup..."
    gunzip "$backup_path"
    backup_path="${backup_path%.gz}"
    
    # Get database password
    local db_password
    db_password=$(aws secretsmanager get-secret-value \
        --region "$REGION" \
        --secret-id "aps-${ENVIRONMENT}/database/password" \
        --query 'SecretString' \
        --output text)
    
    # Restore database
    log_info "Restoring database..."
    PGPASSWORD="$db_password" psql \
        -h "$db_endpoint" \
        -U "$DATABASE_USER" \
        -d "$DATABASE_NAME" \
        -f "$backup_path"
    
    # Clean up
    rm "$backup_path"
    
    log_success "Database restored successfully"
}

restore_files() {
    local backup_file="$1"
    local is_encrypted="$2"
    
    log "Restoring files from: $backup_file"
    
    # Download backup
    local backup_path="/tmp/$backup_file"
    if [[ "$is_encrypted" == "true" ]]; then
        backup_path="${backup_path}.enc"
    fi
    
    aws s3 cp "s3://$S3_BUCKET/files/$backup_file$([ "$is_encrypted" == "true" ] && echo ".enc" || "")" "$backup_path" --region "$REGION"
    
    # Decrypt if needed
    if [[ "$is_encrypted" == "true" ]]; then
        log_info "Decrypting files backup..."
        aws kms decrypt \
            --region "$REGION" \
            --ciphertext-blob "fileb://$backup_path" \
            --output text \
            --query 'Plaintext' | base64 -d > "${backup_path%.enc}"
        
        rm "$backup_path"
        backup_path="${backup_path%.enc}"
    fi
    
    # Extract and restore
    local temp_dir="/tmp/aps-files-restore-${TIMESTAMP}"
    mkdir -p "$temp_dir"
    tar -xzf "$backup_path" -C "$temp_dir"
    
    # Upload to S3 file storage
    local file_storage_bucket
    file_storage_bucket=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, 'aps-${ENVIRONMENT}-files')].Name" \
        --output text)
    
    if [[ -n "$file_storage_bucket" ]]; then
        log_info "Uploading files to S3 storage..."
        aws s3 sync "$temp_dir"/* "s3://$file_storage_bucket" --region "$REGION" --delete
    fi
    
    # Clean up
    rm -rf "$temp_dir" "$backup_path"
    
    log_success "Files restored successfully"
}

restore_configuration() {
    local backup_file="$1"
    local is_encrypted="$2"
    
    log "Restoring configuration from: $backup_file"
    
    # Download backup
    local backup_path="/tmp/$backup_file"
    if [[ "$is_encrypted" == "true" ]]; then
        backup_path="${backup_path}.enc"
    fi
    
    aws s3 cp "s3://$S3_BUCKET/config/$backup_file$([ "$is_encrypted" == "true" ] && echo ".enc" || "")" "$backup_path" --region "$REGION"
    
    # Decrypt if needed
    if [[ "$is_encrypted" == "true" ]]; then
        log_info "Decrypting configuration backup..."
        aws kms decrypt \
            --region "$REGION" \
            --ciphertext-blob "fileb://$backup_path" \
            --output text \
            --query 'Plaintext' | base64 -d > "${backup_path%.enc}"
        
        rm "$backup_path"
        backup_path="${backup_path%.enc}"
    fi
    
    # Extract configuration
    local temp_dir="/tmp/aps-config-restore-${TIMESTAMP}"
    mkdir -p "$temp_dir"
    tar -xzf "$backup_path" -C "$temp_dir"
    
    log_warning "Configuration extracted to: $temp_dir"
    log_warning "Please review and manually restore configuration as needed"
    log_warning "Terraform state: $temp_dir/terraform.tfstate"
    log_warning "Task definitions: $temp_dir/task-definition-*.json"
    
    # Clean up backup file (keep extracted files for manual review)
    rm "$backup_path"
    
    log_success "Configuration backup extracted for manual review"
}

cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days"
    
    local cutoff_date
    cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    
    # List all backup manifests
    local manifests
    manifests=$(aws s3 ls "s3://$S3_BUCKET/manifests/" --region "$REGION" | grep "backup-${ENVIRONMENT}" | awk '{print $4}')
    
    local deleted_count=0
    
    for manifest in $manifests; do
        # Extract timestamp from manifest name
        local backup_timestamp
        backup_timestamp=$(echo "$manifest" | sed -n 's/.*backup-.*-\([0-9]\{8\}_[0-9]\{6\}\)\.json/\1/p')
        
        if [[ -n "$backup_timestamp" ]]; then
            local backup_date
            backup_date=$(echo "$backup_timestamp" | cut -d'_' -f1)
            
            if [[ "$backup_date" < "$cutoff_date" ]]; then
                log_info "Deleting old backup: $manifest"
                
                if [[ "$DRY_RUN" == "false" ]]; then
                    # Download manifest to get backup file names
                    local backup_data
                    backup_data=$(aws s3 cp "s3://$S3_BUCKET/manifests/$manifest" - --region "$REGION" 2>/dev/null)
                    
                    if [[ -n "$backup_data" ]]; then
                        local db_backup
                        db_backup=$(echo "$backup_data" | jq -r '.database_backup')
                        local files_backup
                        files_backup=$(echo "$backup_data" | jq -r '.files_backup')
                        local config_backup
                        config_backup=$(echo "$backup_data" | jq -r '.config_backup')
                        local rds_snapshot
                        rds_snapshot=$(echo "$backup_data" | jq -r '.rds_snapshot')
                        
                        # Delete backup files
                        aws s3 rm "s3://$S3_BUCKET/database/${db_backup}.gz" --region "$REGION" 2>/dev/null || true
                        aws s3 rm "s3://$S3_BUCKET/files/$files_backup" --region "$REGION" 2>/dev/null || true
                        aws s3 rm "s3://$S3_BUCKET/config/$config_backup" --region "$REGION" 2>/dev/null || true
                        
                        # Delete RDS snapshot
                        aws rds delete-db-snapshot \
                            --region "$REGION" \
                            --db-snapshot-identifier "$rds_snapshot" 2>/dev/null || true
                        
                        # Delete manifest
                        aws s3 rm "s3://$S3_BUCKET/manifests/$manifest" --region "$REGION"
                        
                        ((deleted_count++))
                    fi
                fi
            fi
        fi
    done
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would delete $deleted_count old backups"
    else
        log_success "Cleaned up $deleted_count old backups"
    fi
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--region)
                REGION="$2"
                shift 2
                ;;
            -o|--operation)
                OPERATION="$2"
                shift 2
                ;;
            -n|--name)
                BACKUP_NAME="$2"
                shift 2
                ;;
            -p|--restore-point)
                RESTORE_POINT="$2"
                shift 2
                ;;
            -b|--bucket)
                S3_BUCKET="$2"
                shift 2
                ;;
            --retention-days)
                RETENTION_DAYS="$2"
                shift 2
                ;;
            --no-encrypt)
                ENCRYPT=false
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$ENVIRONMENT" ]]; then
        log_error "Environment is required"
        show_usage
        exit 1
    fi
    
    if [[ -z "$OPERATION" ]]; then
        log_error "Operation is required"
        show_usage
        exit 1
    fi
    
    # Start operation
    log "Starting backup/restore operation"
    log_info "Environment: $ENVIRONMENT"
    log_info "Operation: $OPERATION"
    log_info "Region: $REGION"
    log_info "Timestamp: $TIMESTAMP"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Execute operation
    check_prerequisites
    load_configuration
    
    case "$OPERATION" in
        backup)
            create_full_backup
            ;;
        restore)
            restore_from_backup
            ;;
        list)
            list_backups
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        *)
            log_error "Invalid operation: $OPERATION"
            show_usage
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully!"
    log_info "Log file: $LOG_FILE"
}

# Run main function with all arguments
main "$@"
