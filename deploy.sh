#!/bin/bash

# Apulink Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="apulink"

echo "🚀 Starting Apulink deployment to $ENVIRONMENT..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi

    print_success "All requirements met"
}

# Build the application
build_application() {
    print_status "Building frontend application..."

    cd frontend
    npm ci
    npm run build
    cd ..

    print_success "Frontend build completed"

    print_status "Installing backend dependencies..."
    cd backend
    npm ci
    cd ..

    print_success "Backend dependencies installed"
}

# Deploy with Docker Compose
deploy_docker() {
    print_status "Deploying with Docker Compose..."

    # Pull latest images if they exist
    docker-compose pull || true

    # Build and start services
    docker-compose up -d --build

    print_success "Services deployed successfully"
}

# Health check
health_check() {
    print_status "Performing health checks..."

    # Wait for services to start
    sleep 10

    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        print_success "Frontend is healthy"
    else
        print_warning "Frontend health check failed"
    fi

    # Check backend
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Backend is healthy"
    else
        print_warning "Backend health check failed"
    fi
}

# Cleanup old containers and images
cleanup() {
    print_status "Cleaning up old containers and images..."

    docker system prune -f

    print_success "Cleanup completed"
}

# Main deployment flow
main() {
    print_status "🏗️  Apulink Deployment Started"
    print_status "Environment: $ENVIRONMENT"
    print_status "Timestamp: $(date)"

    check_requirements
    build_application
    deploy_docker
    health_check
    cleanup

    print_success "🎉 Deployment completed successfully!"
    print_status "Frontend: http://localhost:3000"
    print_status "Backend: http://localhost:3001"
    print_status "Backend Health: http://localhost:3001/health"
}

# Run main function
main "$@"