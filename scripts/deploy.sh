#!/bin/bash

"""
Script principal de deployment para la aplicación APS
Soporta deployment a múltiples entornos con validaciones de seguridad
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
LOG_FILE="/tmp/aps-deploy-${TIMESTAMP}.log"

# Default values
ENVIRONMENT=""
REGION="us-west-2"
FORCE_DEPLOY=false
SKIP_TESTS=false
SKIP_BACKUP=false
DRY_RUN=false
ROLLBACK=false
VERSION=""
CONFIG_FILE=""

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

Deployment script for APS application

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (dev|staging|production)
    -r, --region REGION             AWS region (default: us-west-2)
    -v, --version VERSION           Version/tag to deploy (default: latest)
    -c, --config CONFIG_FILE        Custom configuration file
    -f, --force                     Force deployment without confirmations
    -t, --skip-tests               Skip pre-deployment tests
    -b, --skip-backup              Skip database backup
    -d, --dry-run                  Show what would be done without executing
    --rollback                     Rollback to previous version
    -h, --help                     Show this help message

ENVIRONMENTS:
    dev         Development environment
    staging     Staging environment
    production  Production environment

EXAMPLES:
    $0 -e staging                   # Deploy to staging
    $0 -e production -v v1.2.3      # Deploy specific version to production
    $0 -e production --rollback     # Rollback production to previous version
    $0 -e staging --dry-run         # Show what would be deployed to staging

EOF
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    for tool in aws docker terraform kubectl helm jq; do
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
        log_info "Please run 'aws configure' or set AWS environment variables"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

validate_environment() {
    log "Validating environment: $ENVIRONMENT"
    
    case "$ENVIRONMENT" in
        dev|staging|production)
            log_success "Environment validation passed"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: dev, staging, production"
            exit 1
            ;;
    esac
    
    # Check if environment-specific configuration exists
    local env_config="$PROJECT_ROOT/infra/terraform/environments/$ENVIRONMENT"
    if [[ ! -d "$env_config" ]]; then
        log_error "Environment configuration not found: $env_config"
        exit 1
    fi
}

load_configuration() {
    log "Loading configuration for environment: $ENVIRONMENT"
    
    # Load default configuration
    local default_config="$PROJECT_ROOT/infra/config/default.env"
    if [[ -f "$default_config" ]]; then
        source "$default_config"
    fi
    
    # Load environment-specific configuration
    local env_config="$PROJECT_ROOT/infra/config/$ENVIRONMENT.env"
    if [[ -f "$env_config" ]]; then
        source "$env_config"
    fi
    
    # Load custom configuration if provided
    if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    fi
    
    # Set defaults if not configured
    VERSION=${VERSION:-latest}
    CLUSTER_NAME=${CLUSTER_NAME:-aps-$ENVIRONMENT-cluster}
    DATABASE_NAME=${DATABASE_NAME:-aps_${ENVIRONMENT}_db}
    
    log_info "Configuration loaded:"
    log_info "  Version: $VERSION"
    log_info "  Cluster: $CLUSTER_NAME"
    log_info "  Database: $DATABASE_NAME"
    log_info "  Region: $REGION"
}

confirm_deployment() {
    if [[ "$FORCE_DEPLOY" == "true" ]]; then
        return 0
    fi
    
    echo
    log_warning "About to deploy to $ENVIRONMENT environment"
    log_info "Version: $VERSION"
    log_info "Region: $REGION"
    log_info "Cluster: $CLUSTER_NAME"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_warning "🚨 This is a PRODUCTION deployment! 🚨"
    fi
    
    echo
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

run_pre_deployment_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping pre-deployment tests"
        return 0
    fi
    
    log "Running pre-deployment tests..."
    
    # Run unit tests
    log_info "Running unit tests..."
    cd "$PROJECT_ROOT"
    ./scripts/run-tests.sh backend || {
        log_error "Backend tests failed"
        return 1
    }
    
    ./scripts/run-tests.sh frontend || {
        log_error "Frontend tests failed"
        return 1
    }
    
    # Run integration tests
    log_info "Running integration tests..."
    ./scripts/run-tests.sh e2e || {
        log_error "E2E tests failed"
        return 1
    }
    
    log_success "Pre-deployment tests passed"
}

create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log_warning "Skipping database backup"
        return 0
    fi
    
    log "Creating database backup..."
    
    # Get database endpoint
    local db_endpoint
    db_endpoint=$(aws rds describe-db-instances \
        --region "$REGION" \
        --query "DBInstances[?DBName=='$DATABASE_NAME'].Endpoint.Address" \
        --output text)
    
    if [[ -z "$db_endpoint" ]]; then
        log_error "Could not find database endpoint"
        return 1
    fi
    
    # Create backup
    local backup_name="aps-${ENVIRONMENT}-backup-${TIMESTAMP}"
    aws rds create-db-snapshot \
        --region "$REGION" \
        --db-instance-identifier "aps-${ENVIRONMENT}-db" \
        --db-snapshot-identifier "$backup_name" > /dev/null
    
    log_info "Database backup created: $backup_name"
    
    # Wait for backup to complete
    log_info "Waiting for backup to complete..."
    aws rds wait db-snapshot-completed \
        --region "$REGION" \
        --db-snapshot-identifier "$backup_name"
    
    log_success "Database backup completed"
}

build_and_push_images() {
    log "Building and pushing Docker images..."
    
    local registry="ghcr.io"
    local repo_name=$(basename "$PROJECT_ROOT")
    
    # Login to registry
    echo "$GITHUB_TOKEN" | docker login "$registry" -u "$GITHUB_ACTOR" --password-stdin
    
    # Build backend image
    log_info "Building backend image..."
    cd "$PROJECT_ROOT/backend"
    docker build \
        --target production \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg BUILD_VERSION="$VERSION" \
        --build-arg BUILD_REVISION="$(git rev-parse HEAD)" \
        -t "$registry/$repo_name/backend:$VERSION" \
        -t "$registry/$repo_name/backend:latest" \
        .
    
    docker push "$registry/$repo_name/backend:$VERSION"
    docker push "$registry/$repo_name/backend:latest"
    
    # Build frontend image
    log_info "Building frontend image..."
    cd "$PROJECT_ROOT/frontend"
    docker build \
        --target production \
        --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        --build-arg BUILD_VERSION="$VERSION" \
        --build-arg BUILD_REVISION="$(git rev-parse HEAD)" \
        -t "$registry/$repo_name/frontend:$VERSION" \
        -t "$registry/$repo_name/frontend:latest" \
        .
    
    docker push "$registry/$repo_name/frontend:$VERSION"
    docker push "$registry/$repo_name/frontend:latest"
    
    log_success "Docker images built and pushed"
}

deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    
    cd "$PROJECT_ROOT/infra/terraform/environments/$ENVIRONMENT"
    
    # Initialize Terraform
    terraform init -upgrade
    
    # Validate configuration
    terraform validate
    
    # Plan deployment
    log_info "Creating Terraform plan..."
    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="region=$REGION" \
        -var="image_tag=$VERSION" \
        -out=tfplan
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - skipping Terraform apply"
        return 0
    fi
    
    # Apply changes
    log_info "Applying Terraform changes..."
    terraform apply tfplan
    
    log_success "Infrastructure deployment completed"
}

deploy_application() {
    log "Deploying application to ECS..."
    
    local cluster_name="aps-${ENVIRONMENT}-cluster"
    local registry="ghcr.io"
    local repo_name=$(basename "$PROJECT_ROOT")
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run - would deploy:"
        log_info "  Backend: $registry/$repo_name/backend:$VERSION"
        log_info "  Frontend: $registry/$repo_name/frontend:$VERSION"
        log_info "  Cluster: $cluster_name"
        return 0
    fi
    
    # Update backend service
    log_info "Updating backend service..."
    local backend_task_def=$(aws ecs describe-task-definition \
        --region "$REGION" \
        --task-definition "aps-${ENVIRONMENT}-backend" \
        --query 'taskDefinition' \
        --output json)
    
    local new_backend_task_def=$(echo "$backend_task_def" | jq \
        --arg image "$registry/$repo_name/backend:$VERSION" \
        '.containerDefinitions[0].image = $image |
         del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)')
    
    aws ecs register-task-definition \
        --region "$REGION" \
        --cli-input-json "$new_backend_task_def" > /dev/null
    
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --service "aps-${ENVIRONMENT}-backend" \
        --task-definition "aps-${ENVIRONMENT}-backend" > /dev/null
    
    # Update frontend service
    log_info "Updating frontend service..."
    local frontend_task_def=$(aws ecs describe-task-definition \
        --region "$REGION" \
        --task-definition "aps-${ENVIRONMENT}-frontend" \
        --query 'taskDefinition' \
        --output json)
    
    local new_frontend_task_def=$(echo "$frontend_task_def" | jq \
        --arg image "$registry/$repo_name/frontend:$VERSION" \
        '.containerDefinitions[0].image = $image |
         del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)')
    
    aws ecs register-task-definition \
        --region "$REGION" \
        --cli-input-json "$new_frontend_task_def" > /dev/null
    
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --service "aps-${ENVIRONMENT}-frontend" \
        --task-definition "aps-${ENVIRONMENT}-frontend" > /dev/null
    
    # Update celery worker service
    log_info "Updating celery worker service..."
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --service "aps-${ENVIRONMENT}-celery-worker" \
        --task-definition "aps-${ENVIRONMENT}-celery-worker" > /dev/null
    
    # Wait for deployments to complete
    log_info "Waiting for deployment to complete..."
    
    aws ecs wait services-stable \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --services "aps-${ENVIRONMENT}-backend" "aps-${ENVIRONMENT}-frontend" "aps-${ENVIRONMENT}-celery-worker"
    
    log_success "Application deployment completed"
}

run_post_deployment_tests() {
    log "Running post-deployment tests..."
    
    # Get ALB DNS name
    local alb_dns_name
    alb_dns_name=$(aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --names "aps-${ENVIRONMENT}-alb" \
        --query 'LoadBalancers[0].DNSName' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$alb_dns_name" ]]; then
        log_warning "Could not find ALB DNS name, skipping tests"
        return 0
    fi
    
    local endpoint="https://$alb_dns_name"
    
    # Wait for application to be ready
    log_info "Waiting for application to be ready..."
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        if curl -f "$endpoint/health" &> /dev/null; then
            log_success "Application is ready!"
            break
        fi
        log_info "Attempt $i/$max_attempts failed, waiting 10 seconds..."
        sleep 10
        
        if [[ $i -eq $max_attempts ]]; then
            log_error "Application failed to become ready"
            return 1
        fi
    done
    
    # Run smoke tests
    log_info "Running smoke tests..."
    
    # Test health endpoint
    if ! curl -f "$endpoint/health" &> /dev/null; then
        log_error "Health check failed"
        return 1
    fi
    
    # Test API documentation
    if ! curl -f "$endpoint/api/v1/docs" &> /dev/null; then
        log_error "API documentation not accessible"
        return 1
    fi
    
    # Test frontend
    if ! curl -f "$endpoint/" &> /dev/null; then
        log_error "Frontend not accessible"
        return 1
    fi
    
    log_success "Post-deployment tests passed"
}

rollback_deployment() {
    log "Rolling back deployment..."
    
    local cluster_name="aps-${ENVIRONMENT}-cluster"
    
    # Get previous task definition revisions
    local backend_prev
    backend_prev=$(aws ecs list-task-definitions \
        --region "$REGION" \
        --family-prefix "aps-${ENVIRONMENT}-backend" \
        --status ACTIVE \
        --sort DESC \
        --query 'taskDefinitionArns[1]' \
        --output text)
    
    local frontend_prev
    frontend_prev=$(aws ecs list-task-definitions \
        --region "$REGION" \
        --family-prefix "aps-${ENVIRONMENT}-frontend" \
        --status ACTIVE \
        --sort DESC \
        --query 'taskDefinitionArns[1]' \
        --output text)
    
    if [[ "$backend_prev" == "None" ]] || [[ "$frontend_prev" == "None" ]]; then
        log_error "No previous task definitions found for rollback"
        return 1
    fi
    
    # Rollback services
    log_info "Rolling back backend service..."
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --service "aps-${ENVIRONMENT}-backend" \
        --task-definition "$backend_prev" > /dev/null
    
    log_info "Rolling back frontend service..."
    aws ecs update-service \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --service "aps-${ENVIRONMENT}-frontend" \
        --task-definition "$frontend_prev" > /dev/null
    
    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    aws ecs wait services-stable \
        --region "$REGION" \
        --cluster "$cluster_name" \
        --services "aps-${ENVIRONMENT}-backend" "aps-${ENVIRONMENT}-frontend"
    
    log_success "Rollback completed"
}

cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove temporary files
    rm -f /tmp/aps-deploy-*.log
    
    # Clean up Docker images
    docker image prune -f &> /dev/null || true
    
    log_success "Cleanup completed"
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
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -c|--config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            -f|--force)
                FORCE_DEPLOY=true
                shift
                ;;
            -t|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -b|--skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
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
    
    # Set up error handling
    trap cleanup EXIT
    
    # Start deployment
    log "Starting APS deployment process"
    log_info "Environment: $ENVIRONMENT"
    log_info "Region: $REGION"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Log file: $LOG_FILE"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Execute deployment steps
    check_prerequisites
    validate_environment
    load_configuration
    
    if [[ "$ROLLBACK" == "true" ]]; then
        confirm_deployment
        rollback_deployment
    else
        confirm_deployment
        run_pre_deployment_tests
        create_backup
        build_and_push_images
        deploy_infrastructure
        deploy_application
        run_post_deployment_tests
    fi
    
    log_success "Deployment process completed successfully!"
    log_info "Log file saved: $LOG_FILE"
}

# Run main function with all arguments
main "$@"
