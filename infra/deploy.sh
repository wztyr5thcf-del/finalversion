#!/bin/bash
# =============================================================================
# Creatools Deploy Script
# This script is called by EC2 user-data to set up and deploy the application.
# Can also be used manually for redeployment.
# =============================================================================
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Install Docker and Docker Compose
# =============================================================================
install_docker() {
    log "Installing Docker..."

    if command -v docker &> /dev/null; then
        log "Docker already installed: $(docker --version)"
    else
        # Amazon Linux 2023
        if [ -f /etc/system-release ] && grep -q "Amazon Linux" /etc/system-release; then
            dnf update -y
            dnf install -y docker git
            systemctl start docker
            systemctl enable docker
            usermod -aG docker ec2-user
        # Ubuntu/Debian
        elif command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y ca-certificates curl gnupg
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        else
            error "Unsupported OS. Please install Docker manually."
            exit 1
        fi
    fi

    # Install Docker Compose plugin if not present
    if ! docker compose version &> /dev/null; then
        log "Installing Docker Compose plugin..."
        mkdir -p /usr/local/lib/docker/cli-plugins
        curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
            -o /usr/local/lib/docker/cli-plugins/docker-compose
        chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    fi

    log "Docker version: $(docker --version)"
    log "Docker Compose version: $(docker compose version)"
}

# =============================================================================
# Clone or update repository
# =============================================================================
setup_repo() {
    local repo_url="${GIT_REPO_URL:-https://github.com/your-org/creatools.git}"
    local app_dir="/opt/creatools"

    log "Setting up repository..."

    if [ -d "$app_dir/.git" ]; then
        log "Repository exists, pulling latest changes..."
        cd "$app_dir"
        git pull origin main
    else
        log "Cloning repository..."
        rm -rf "$app_dir"
        git clone "$repo_url" "$app_dir"
        cd "$app_dir"
    fi

    log "Repository ready at $app_dir"
}

# =============================================================================
# Create .env file
# =============================================================================
create_env() {
    local env_file="/opt/creatools/infra/.env"

    if [ -f "$env_file" ]; then
        warn ".env file already exists. Skipping creation."
        warn "To recreate, delete $env_file and run this script again."
        return
    fi

    log "Creating .env file..."

    # These variables should be set by the user-data script or manually
    cat > "$env_file" <<EOF
# Application
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=${DATABASE_URL:-postgresql://creatools:password@localhost:5432/creatools}

# Authentication
JWT_SECRET=${JWT_SECRET:-change-this-in-production}

# URLs
FRONTEND_URL=https://creatools.co
APP_URL=https://creatools.co

# Stripe (configure after deploy)
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY:-}
STRIPE_PRICE_ID_BASIC=${STRIPE_PRICE_ID_BASIC:-}
STRIPE_PRICE_ID_PRO=${STRIPE_PRICE_ID_PRO:-}

# TikTok Integration
TIKTOOLS_API_KEY=${TIKTOOLS_API_KEY:-}
TIKTOK_CLIENT_KEY=${TIKTOK_CLIENT_KEY:-}
TIKTOK_REDIRECT_URI=https://creatools.co/api/tiktok/callback
EOF

    log ".env file created at $env_file"
}

# =============================================================================
# Build and start application
# =============================================================================
start_app() {
    log "Building and starting application with Docker Compose..."

    cd /opt/creatools/infra

    # Build and start containers
    docker compose up -d --build

    log "Containers started successfully"
}

# =============================================================================
# Run database migrations
# =============================================================================
run_migrations() {
    log "Running database migrations with drizzle-kit push..."

    cd /opt/creatools

    # Run drizzle-kit push inside a temporary container with the full source
    # This uses the builder stage which has all dev dependencies and schema files
    docker compose -f infra/docker-compose.yml exec -T api sh -c "\
        cd /app && node -e \"
            const { drizzle } = require('drizzle-orm/node-postgres');
            const { migrate } = require('drizzle-orm/node-postgres/migrator');
        \" 2>/dev/null" || true

    # Use a one-off container from the builder stage to run drizzle-kit push
    docker run --rm \
        --network creatools_default \
        --env-file infra/.env \
        -v "$(pwd):/workspace" \
        -w /workspace \
        node:22-slim sh -c "\
            npm install -g pnpm@9 && \
            pnpm install --frozen-lockfile --config.confirmModulesPurge=false && \
            npx drizzle-kit push" \
        || warn "Migration via drizzle-kit push failed. You may need to run it manually."

    log "Database migration step completed"
}

# =============================================================================
# Health check
# =============================================================================
health_check() {
    log "Running health checks..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sf http://localhost/api/health > /dev/null 2>&1; then
            log "Application is healthy!"
            return 0
        fi

        warn "Health check attempt $attempt/$max_attempts failed. Retrying in 10s..."
        attempt=$((attempt + 1))
        sleep 10
    done

    error "Application did not become healthy within $(($max_attempts * 10)) seconds"
    error "Check logs with: docker compose -f /opt/creatools/infra/docker-compose.yml logs"
    return 1
}

# =============================================================================
# Main
# =============================================================================
main() {
    log "========================================="
    log "  Creatools Deployment Script"
    log "========================================="

    install_docker
    setup_repo
    create_env
    start_app
    run_migrations
    health_check

    log "========================================="
    log "  Deployment Complete!"
    log "========================================="
    log ""
    log "Application is running at:"
    log "  - https://creatools.co (main site)"
    log "  - https://creatools.stream (overlay links)"
    log "  - https://creatools.live (profile links)"
    log ""
    log "Useful commands:"
    log "  - View logs: docker compose -f /opt/creatools/infra/docker-compose.yml logs -f"
    log "  - Restart: docker compose -f /opt/creatools/infra/docker-compose.yml restart"
    log "  - Update: cd /opt/creatools && git pull && cd infra && docker compose up -d --build"
}

main "$@"
