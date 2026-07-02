#!/bin/bash
# =============================================================================
# Webhook Setup Script
# Installs and configures the GitHub webhook auto-deploy listener on EC2.
# Run this script once on the EC2 instance to set up the webhook service.
# =============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

APP_DIR="/opt/creatools"
WEBHOOK_DIR="$APP_DIR/infra/webhook"
ENV_FILE="$WEBHOOK_DIR/.env"

# =============================================================================
# Check prerequisites
# =============================================================================

log "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    log "Installing Node.js..."
    if [ -f /etc/system-release ] && grep -q "Amazon Linux" /etc/system-release; then
        dnf install -y nodejs
    elif command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y nodejs
    else
        error "Cannot install Node.js automatically. Please install Node.js 18+ manually."
        exit 1
    fi
fi

log "Node.js version: $(node --version)"

if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please run the main deploy.sh first."
    exit 1
fi

# =============================================================================
# Configure webhook secret
# =============================================================================

if [ ! -f "$ENV_FILE" ]; then
    log "Creating webhook environment file..."

    # Generate a random secret if not provided
    if [ -z "$WEBHOOK_SECRET" ]; then
        WEBHOOK_SECRET=$(openssl rand -hex 32)
        warn "Generated random WEBHOOK_SECRET. Save this value for GitHub webhook configuration:"
        echo ""
        echo -e "  ${YELLOW}$WEBHOOK_SECRET${NC}"
        echo ""
    fi

    cat > "$ENV_FILE" <<EOF
# GitHub Webhook Configuration
WEBHOOK_SECRET=$WEBHOOK_SECRET

# Port for the webhook listener (default: 9000)
WEBHOOK_PORT=9000

# Branch to deploy on push (default: main)
DEPLOY_BRANCH=main

# Log file location
WEBHOOK_LOG=/var/log/webhook-deploy.log
EOF

    chmod 600 "$ENV_FILE"
    log "Environment file created at $ENV_FILE"
else
    warn "Environment file already exists at $ENV_FILE"
    warn "To regenerate, delete it and run this script again."
fi

# =============================================================================
# Set up log file
# =============================================================================

log "Setting up log file..."
touch /var/log/webhook-deploy.log
chmod 644 /var/log/webhook-deploy.log

# =============================================================================
# Make deploy script executable
# =============================================================================

log "Setting permissions..."
chmod +x "$WEBHOOK_DIR/deploy.sh"
chmod +x "$WEBHOOK_DIR/webhook-server.js"

# =============================================================================
# Install systemd service
# =============================================================================

log "Installing systemd service..."

cp "$WEBHOOK_DIR/webhook.service" /etc/systemd/system/webhook-deploy.service
systemctl daemon-reload
systemctl enable webhook-deploy.service
systemctl start webhook-deploy.service

log "Webhook service installed and started"

# =============================================================================
# Verify service is running
# =============================================================================

sleep 2

if systemctl is-active --quiet webhook-deploy.service; then
    log "Webhook service is running!"
else
    error "Webhook service failed to start. Check logs with:"
    error "  journalctl -u webhook-deploy.service -f"
    exit 1
fi

# Check if port is listening
if command -v ss &> /dev/null; then
    if ss -tlnp | grep -q ":9000"; then
        log "Port 9000 is listening"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tlnp | grep -q ":9000"; then
        log "Port 9000 is listening"
    fi
fi

# =============================================================================
# Print summary
# =============================================================================

echo ""
log "========================================="
log "  Webhook Setup Complete!"
log "========================================="
echo ""
log "Service status: $(systemctl is-active webhook-deploy.service)"
log "Webhook URL: http://<EC2_PUBLIC_IP>:9000/webhook"
log "Health check: http://<EC2_PUBLIC_IP>:9000/health"
echo ""
log "Useful commands:"
log "  - View logs: journalctl -u webhook-deploy.service -f"
log "  - Restart: systemctl restart webhook-deploy.service"
log "  - Stop: systemctl stop webhook-deploy.service"
log "  - Status: systemctl status webhook-deploy.service"
echo ""
log "Next steps:"
log "  1. Open port 9000 in the EC2 security group"
log "  2. Configure the webhook in GitHub:"
log "     - URL: http://<EC2_PUBLIC_IP>:9000/webhook"
log "     - Content type: application/json"
log "     - Secret: (value from $ENV_FILE)"
log "     - Events: Just the push event"
echo ""
