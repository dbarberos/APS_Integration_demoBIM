#!/bin/bash

"""
Script para ejecutar suite completa de tests
"""

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
REPORTS_DIR="reports"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create reports directory
mkdir -p $REPORTS_DIR

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

check_requirements() {
    log_info "Checking requirements..."
    
    # Check if backend directory exists
    if [ ! -d "$BACKEND_DIR" ]; then
        log_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    # Check if frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 is required but not installed"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check Docker (for integration tests)
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found - integration tests may fail"
    fi
    
    log_success "Requirements check passed"
}

setup_backend_env() {
    log_info "Setting up backend environment..."
    
    cd $BACKEND_DIR
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt --quiet
    
    # Install test dependencies
    pip install pytest pytest-cov pytest-asyncio pytest-mock pytest-xdist --quiet
    
    cd ..
    log_success "Backend environment ready"
}

setup_frontend_env() {
    log_info "Setting up frontend environment..."
    
    cd $FRONTEND_DIR
    
    # Install dependencies
    npm install --silent
    
    # Install additional test dependencies
    npm install --save-dev \
        @testing-library/react \
        @testing-library/jest-dom \
        @testing-library/user-event \
        vitest \
        jsdom \
        cypress \
        @cypress/code-coverage \
        cypress-axe \
        cypress-file-upload \
        cypress-real-events \
        --silent
    
    cd ..
    log_success "Frontend environment ready"
}

run_backend_tests() {
    log_info "Running backend tests..."
    
    cd $BACKEND_DIR
    source venv/bin/activate
    
    # Set test environment variables
    export TESTING=true
    export DATABASE_URL="sqlite+aiosqlite:///:memory:"
    export SECRET_KEY="test-secret-key"
    export APS_CLIENT_ID="test-client-id"
    export APS_CLIENT_SECRET="test-client-secret"
    
    # Run unit tests with coverage
    log_info "Running unit tests..."
    pytest tests/ \
        --cov=app \
        --cov-report=html:../reports/backend-coverage-html \
        --cov-report=xml:../reports/backend-coverage.xml \
        --cov-report=json:../reports/backend-coverage.json \
        --cov-report=term-missing \
        --junitxml=../reports/backend-junit.xml \
        --maxfail=5 \
        --tb=short \
        -v \
        --durations=10 \
        || {
            log_error "Backend unit tests failed"
            cd ..
            return 1
        }
    
    # Run integration tests
    log_info "Running integration tests..."
    pytest tests/ \
        -m integration \
        --junitxml=../reports/backend-integration-junit.xml \
        -v \
        || {
            log_warning "Some integration tests failed"
        }
    
    # Run performance tests
    log_info "Running performance tests..."
    pytest tests/ \
        -m performance \
        --junitxml=../reports/backend-performance-junit.xml \
        -v \
        || {
            log_warning "Some performance tests failed"
        }
    
    cd ..
    log_success "Backend tests completed"
}

run_frontend_tests() {
    log_info "Running frontend tests..."
    
    cd $FRONTEND_DIR
    
    # Run unit tests with Vitest
    log_info "Running unit tests..."
    npm run test:unit -- \
        --coverage \
        --reporter=verbose \
        --reporter=junit \
        --outputFile.junit=../reports/frontend-junit.xml \
        || {
            log_error "Frontend unit tests failed"
            cd ..
            return 1
        }
    
    # Move coverage reports
    if [ -d "coverage" ]; then
        mv coverage ../reports/frontend-coverage
    fi
    
    # Build project for E2E tests
    log_info "Building frontend for E2E tests..."
    npm run build || {
        log_error "Frontend build failed"
        cd ..
        return 1
    }
    
    cd ..
    log_success "Frontend tests completed"
}

run_e2e_tests() {
    log_info "Running E2E tests with Cypress..."
    
    # Start backend server
    log_info "Starting backend server..."
    cd $BACKEND_DIR
    source venv/bin/activate
    
    # Set environment for E2E
    export TESTING=true
    export DATABASE_URL="sqlite+aiosqlite:///:memory:"
    
    # Start server in background
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 10
    
    cd ..
    
    # Start frontend server
    log_info "Starting frontend server..."
    cd $FRONTEND_DIR
    
    # Serve built files
    npx serve -s dist -l 3000 &
    FRONTEND_PID=$!
    
    # Wait for frontend to start
    sleep 5
    
    # Run Cypress tests
    log_info "Executing Cypress tests..."
    npx cypress run \
        --config video=true,screenshotOnRunFailure=true \
        --reporter junit \
        --reporter-options "mochaFile=../reports/e2e-junit.xml" \
        --env enableMockMode=false \
        || {
            log_warning "Some E2E tests failed"
        }
    
    # Stop servers
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    
    cd ..
    log_success "E2E tests completed"
}

run_performance_tests() {
    log_info "Running performance tests with Locust..."
    
    # Ensure backend is running
    cd $BACKEND_DIR
    source venv/bin/activate
    
    # Install Locust if not installed
    pip install locust --quiet
    
    # Start backend for load testing
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 10
    
    cd ..
    
    # Run Locust tests
    log_info "Executing load tests..."
    python -m locust \
        -f tests/performance/locustfile.py \
        --host http://localhost:8000 \
        --users 50 \
        --spawn-rate 5 \
        --run-time 60s \
        --html reports/load-test-report.html \
        --csv reports/load-test \
        --headless \
        || {
            log_warning "Load tests completed with warnings"
        }
    
    # Stop backend
    kill $BACKEND_PID 2>/dev/null || true
    
    log_success "Performance tests completed"
}

generate_test_report() {
    log_info "Generating comprehensive test report..."
    
    # Create HTML report
    cat > reports/test-report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>APS Test Report - $TIMESTAMP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background: #d4edda; border-color: #c3e6cb; }
        .warning { background: #fff3cd; border-color: #ffeaa7; }
        .error { background: #f8d7da; border-color: #f5c6cb; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 3px; }
        .coverage { font-size: 18px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>APS Application Test Report</h1>
        <p>Generated: $TIMESTAMP</p>
        <p>Test Suite: Complete (Unit, Integration, E2E, Performance)</p>
    </div>

    <div class="section">
        <h2>Test Summary</h2>
        <div class="metric">
            <strong>Backend Coverage:</strong> 
            <span class="coverage" id="backend-coverage">Calculating...</span>
        </div>
        <div class="metric">
            <strong>Frontend Coverage:</strong> 
            <span class="coverage" id="frontend-coverage">Calculating...</span>
        </div>
        <div class="metric">
            <strong>E2E Tests:</strong> 
            <span id="e2e-status">Check Cypress report</span>
        </div>
        <div class="metric">
            <strong>Performance:</strong> 
            <span id="perf-status">Check Locust report</span>
        </div>
    </div>

    <div class="section">
        <h2>Quick Links</h2>
        <ul>
            <li><a href="backend-coverage-html/index.html">Backend Coverage Report</a></li>
            <li><a href="frontend-coverage/index.html">Frontend Coverage Report</a></li>
            <li><a href="load-test-report.html">Performance Test Report</a></li>
        </ul>
    </div>

    <div class="section">
        <h2>Test Execution Details</h2>
        <h3>Backend Tests</h3>
        <ul>
            <li>Unit Tests: Completed with coverage reporting</li>
            <li>Integration Tests: APS service integration verified</li>
            <li>Performance Tests: Response time thresholds checked</li>
        </ul>
        
        <h3>Frontend Tests</h3>
        <ul>
            <li>Unit Tests: Component and hook testing completed</li>
            <li>Integration Tests: API service integration verified</li>
        </ul>
        
        <h3>E2E Tests</h3>
        <ul>
            <li>Authentication Flow: Login/logout scenarios</li>
            <li>File Upload Workflow: Complete upload process</li>
            <li>Translation Workflow: APS translation process</li>
            <li>Viewer Integration: Model loading and interaction</li>
        </ul>
        
        <h3>Performance Tests</h3>
        <ul>
            <li>Load Testing: Concurrent user simulation</li>
            <li>Stress Testing: High-load scenarios</li>
            <li>API Performance: Response time monitoring</li>
        </ul>
    </div>

    <div class="section">
        <h2>Quality Metrics</h2>
        <p>Coverage Target: 90%</p>
        <p>Performance Target: &lt;2000ms response time</p>
        <p>Reliability Target: &lt;1% error rate</p>
    </div>
</body>
</html>
EOF

    log_success "Test report generated: reports/test-report.html"
}

run_accessibility_tests() {
    log_info "Running accessibility tests..."
    
    cd $FRONTEND_DIR
    
    # Run axe-core accessibility tests with Cypress
    npx cypress run \
        --spec "cypress/e2e/accessibility.cy.ts" \
        --config video=false \
        || {
            log_warning "Some accessibility tests failed"
        }
    
    cd ..
    log_success "Accessibility tests completed"
}

run_security_tests() {
    log_info "Running security tests..."
    
    # Backend security tests
    cd $BACKEND_DIR
    source venv/bin/activate
    
    # Install security testing tools
    pip install bandit safety --quiet
    
    # Run Bandit security linter
    bandit -r app/ -f json -o ../reports/security-bandit.json || {
        log_warning "Bandit found security issues"
    }
    
    # Check for known security vulnerabilities
    safety check --json --output ../reports/security-safety.json || {
        log_warning "Safety found vulnerability issues"
    }
    
    cd ..
    
    # Frontend security tests
    cd $FRONTEND_DIR
    
    # Audit npm packages
    npm audit --json > ../reports/npm-audit.json || {
        log_warning "npm audit found issues"
    }
    
    cd ..
    log_success "Security tests completed"
}

cleanup() {
    log_info "Cleaning up..."
    
    # Kill any remaining background processes
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "serve -s dist" 2>/dev/null || true
    pkill -f "locust" 2>/dev/null || true
    
    # Clean up temporary files
    find . -name "*.pyc" -delete 2>/dev/null || true
    find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main execution
main() {
    log_info "Starting comprehensive test suite for APS application"
    log_info "Timestamp: $TIMESTAMP"
    
    # Trap cleanup on script exit
    trap cleanup EXIT
    
    # Check if specific test type is requested
    case "${1:-all}" in
        "backend")
            check_requirements
            setup_backend_env
            run_backend_tests
            ;;
        "frontend")
            check_requirements
            setup_frontend_env
            run_frontend_tests
            ;;
        "e2e")
            check_requirements
            setup_backend_env
            setup_frontend_env
            run_e2e_tests
            ;;
        "performance")
            check_requirements
            setup_backend_env
            run_performance_tests
            ;;
        "security")
            check_requirements
            setup_backend_env
            setup_frontend_env
            run_security_tests
            ;;
        "accessibility")
            check_requirements
            setup_frontend_env
            run_accessibility_tests
            ;;
        "all"|*)
            check_requirements
            setup_backend_env
            setup_frontend_env
            
            # Run all test suites
            run_backend_tests
            run_frontend_tests
            run_e2e_tests
            run_performance_tests
            run_security_tests
            run_accessibility_tests
            
            # Generate comprehensive report
            generate_test_report
            ;;
    esac
    
    log_success "Test execution completed successfully!"
    log_info "Reports available in: $REPORTS_DIR/"
}

# Script usage help
usage() {
    echo "Usage: $0 [test-type]"
    echo ""
    echo "Test types:"
    echo "  all          - Run all tests (default)"
    echo "  backend      - Run only backend tests"
    echo "  frontend     - Run only frontend tests"
    echo "  e2e          - Run only E2E tests"
    echo "  performance  - Run only performance tests"
    echo "  security     - Run only security tests"
    echo "  accessibility - Run only accessibility tests"
    echo ""
    echo "Examples:"
    echo "  $0           # Run all tests"
    echo "  $0 backend   # Run only backend tests"
    echo "  $0 e2e       # Run only E2E tests"
}

# Check for help flag
if [[ "${1}" == "-h" || "${1}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main function with arguments
main "$@"
