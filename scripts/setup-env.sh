#!/bin/bash

# Setup script for OMS environment files
# This script copies .env.example files to .env for local development

set -e

echo "🚀 Setting up OMS environment files..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to copy env file if it doesn't exist
setup_env() {
    local service=$1
    local env_example="services/$service/.env.example"
    local env_file="services/$service/.env"

    if [ -f "$env_file" ]; then
        echo -e "${YELLOW}⚠️  $env_file already exists, skipping...${NC}"
    else
        if [ -f "$env_example" ]; then
            cp "$env_example" "$env_file"
            echo -e "${GREEN}✅ Created $env_file${NC}"
        else
            echo -e "${YELLOW}⚠️  $env_example not found, skipping...${NC}"
        fi
    fi
}

# Setup environment files for each service
echo ""
echo "Setting up Products Service..."
setup_env "products-service"

echo ""
echo "Setting up Orders Service..."
setup_env "orders-service"

echo ""
echo "Setting up Users Service..."
setup_env "users-service"

echo ""
echo "Setting up Payments Service..."
setup_env "payments-service"

echo ""
echo "Setting up BFF-Web..."
setup_env "bff-web"

echo ""
echo "Setting up BFF-Mobile..."
setup_env "bff-mobile"

echo ""
echo -e "${GREEN}✅ Environment setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Review and customize the .env files if needed"
echo "  2. For Docker: Use service hostnames (postgres, rabbitmq, redis)"
echo "  3. For local dev: Use localhost for all services"
echo ""
echo "🐳 To start with Docker:"
echo "  docker-compose up -d"
echo ""
echo "💻 To run locally:"
echo "  # Start infrastructure (postgres, rabbitmq, redis)"
echo "  docker-compose up -d postgres rabbitmq redis"
echo "  # Then run each service with: npm run dev"
echo ""
echo "📖 For more information, see ENVIRONMENT.md"
