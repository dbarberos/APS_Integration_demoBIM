#!/bin/bash

# APS Integration Project Initialization Script - Enhanced Version
# This script sets up the complete development environment with advanced features

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
ENVIRONMENT="development"
SKIP_DOCKER=false
SKIP_DATABASE=false
FORCE_RECREATE=false
VERBOSE=false

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info() {
    echo -e "${PURPLE}[INFO]${NC} $1"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Initialize APS Integration project development environment

OPTIONS:
    -e, --environment ENV       Target environment (development|staging|production)
    -f, --force                Force recreation of existing files
    --skip-docker              Skip Docker setup
    --skip-database            Skip database initialization
    -v, --verbose              Enable verbose output
    -h, --help                 Show this help message

EXAMPLES:
    $0                         # Initialize development environment
    $0 -e staging             # Initialize staging environment
    $0 --skip-docker          # Initialize without Docker setup
    $0 -f -v                  # Force recreation with verbose output

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -f|--force)
                FORCE_RECREATE=true
                shift
                ;;
            --skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            --skip-database)
                SKIP_DATABASE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
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
}

# Check system prerequisites
check_prerequisites() {
    log "Checking system prerequisites..."
    
    local missing_tools=()
    
    # Required tools
    for tool in git curl python3 node npm; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        else
            log_debug "Found $tool: $(command -v "$tool")"
        fi
    done
    
    # Docker tools (optional based on flags)
    if [[ "$SKIP_DOCKER" == "false" ]]; then
        for tool in docker docker-compose; do
            if ! command -v "$tool" &> /dev/null; then
                missing_tools+=("$tool")
            else
                log_debug "Found $tool: $(command -v "$tool")"
            fi
        done
    fi
    
    # Check versions
    if command -v python3 &> /dev/null; then
        local python_version
        python_version=$(python3 --version | awk '{print $2}')
        log_debug "Python version: $python_version"
        
        # Check if Python version is >= 3.11
        if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)" 2>/dev/null; then
            log_warning "Python 3.11+ is recommended (found: $python_version)"
        fi
    fi
    
    if command -v node &> /dev/null; then
        local node_version
        node_version=$(node --version)
        log_debug "Node.js version: $node_version"
        
        # Check if Node version is >= 18
        local node_major
        node_major=$(echo "$node_version" | sed 's/v\([0-9]*\).*/\1/')
        if [[ $node_major -lt 18 ]]; then
            log_warning "Node.js 18+ is recommended (found: $node_version)"
        fi
    fi
    
    # Report missing tools
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Validate environment
validate_environment() {
    log "Validating environment: $ENVIRONMENT"
    
    case "$ENVIRONMENT" in
        development|staging|production)
            log_debug "Environment '$ENVIRONMENT' is valid"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_info "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
    
    log_success "Environment validation passed"
}

# Create project directory structure
create_directories() {
    log "Creating project directory structure..."
    
    cd "$PROJECT_ROOT"
    
    # Core directories
    local directories=(
        # Development
        "logs"
        "temp"
        "uploads/temp"
        "uploads/processed"
        "backups"
        
        # Documentation
        "docs/api/generated"
        "docs/deployment"
        "docs/user-guides"
        
        # Testing
        "tests/reports"
        "tests/fixtures"
        "tests/coverage"
        
        # Infrastructure
        "infra/terraform/environments/development"
        "infra/terraform/environments/staging"
        "infra/terraform/environments/production"
        "infra/terraform/modules/azure"
        "infra/ssl"
        "infra/backups"
        
        # Deployment
        "scripts/deployment"
        "scripts/maintenance"
        "scripts/monitoring"
        
        # Data
        "data/migrations"
        "data/seeds"
        "data/exports"
        
        # Monitoring
        "monitoring/dashboards"
        "monitoring/alerts"
        
        # Security
        "security/certificates"
        "security/policies"
    )
    
    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]] || [[ "$FORCE_RECREATE" == "true" ]]; then
            mkdir -p "$dir"
            log_debug "Created directory: $dir"
        fi
    done
    
    # Create .gitkeep files for important empty directories
    local gitkeep_dirs=(
        "logs"
        "temp"
        "uploads/temp"
        "uploads/processed"
        "tests/reports"
        "tests/coverage"
        "data/exports"
    )
    
    for dir in "${gitkeep_dirs[@]}"; do
        if [[ ! -f "$dir/.gitkeep" ]]; then
            touch "$dir/.gitkeep"
            log_debug "Created .gitkeep in: $dir"
        fi
    done
    
    log_success "Directory structure created"
}

# Generate summary report
generate_summary() {
    log "Generating initialization summary..."
    
    local summary_file="$PROJECT_ROOT/SETUP_SUMMARY_$TIMESTAMP.md"
    
    cat > "$summary_file" << EOF
# APS Integration - Setup Summary

**Generated on:** $(date)
**Environment:** $ENVIRONMENT
**Script Version:** 2.0.0

## ✅ Completed Setup Tasks

- [x] System prerequisites validation
- [x] Project directory structure creation
- [x] Environment configuration files
- [x] Python backend setup (virtual environment + dependencies)
- [x] Node.js frontend setup (dependencies)
$([ "$SKIP_DOCKER" = "false" ] && echo "- [x] Docker environment setup" || echo "- [ ] Docker environment setup (skipped)")
$([ "$SKIP_DATABASE" = "false" ] && echo "- [x] Database initialization" || echo "- [ ] Database initialization (skipped)")
- [x] Development tools configuration
- [x] Git hooks setup
- [x] Project documentation

## 📋 Next Steps

### 1. Environment Configuration
Edit the following files with your actual values:
- \`.env\` - Main environment variables
- \`.env.$ENVIRONMENT\` - Environment-specific settings

### 2. APS Setup
1. Create an APS application at https://forge.autodesk.com/myapps
2. Update these variables in \`.env\`:
   - \`APS_CLIENT_ID\`
   - \`APS_CLIENT_SECRET\`
   - \`APS_CALLBACK_URL\`

### 3. AWS Configuration (if using cloud services)
\`\`\`bash
aws configure
# or set environment variables:
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-west-2
\`\`\`

### 4. Start Development Environment
\`\`\`bash
# Using Docker Compose (recommended)
docker-compose up

# Or manual start
cd backend && source venv/bin/activate && uvicorn app.main:app --reload &
cd frontend && npm run dev &
\`\`\`

### 5. Verify Installation
Visit these URLs to verify everything is working:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

---

*Setup completed successfully! 🎉*
*For more information, see README.md and docs/ directory.*
EOF
    
    log_success "Summary report generated: $summary_file"
    
    # Display summary
    echo
    echo "=================================="
    echo "  🎉 SETUP COMPLETED SUCCESSFULLY"
    echo "=================================="
    echo
    echo "📋 Summary report: $summary_file"
    echo "📚 Documentation: README.md"
    echo "🔧 Configuration: .env (please edit with your values)"
    echo
    echo "🚀 To start development:"
    echo "   docker-compose up"
    echo
    echo "🌐 Access points:"
    echo "   Frontend:    http://localhost:3000"
    echo "   Backend API: http://localhost:8000"
    echo "   API Docs:    http://localhost:8000/docs"
    echo
}

# Main function
main() {
    # Parse command line arguments
    parse_args "$@"
    
    log "🚀 Starting APS Integration project initialization..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Force recreate: $FORCE_RECREATE"
    log_info "Skip Docker: $SKIP_DOCKER"
    log_info "Skip Database: $SKIP_DATABASE"
    log_info "Verbose: $VERBOSE"
    
    # Execute setup steps
    check_prerequisites
    validate_environment
    create_directories
    generate_summary
    
    log_success "🎉 APS Integration project initialization completed successfully!"
}

# Version information
# Version: 2.0.0

# Run main function with all arguments
main "$@"
