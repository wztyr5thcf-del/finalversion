#!/bin/bash
# =============================================================================
# Auto-Deploy Script
# Called by the webhook server when a push event is received.
# Performs git pull and Docker Compose rebuild.
# =============================================================================
set -e

APP_DIR="/opt/creatools"
LOG_FILE="/var/log/webhook-deploy.log"

log() {
    echo "[$(date -Iseconds)] [DEPLOY] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date -Iseconds)] [ERROR] $1" | tee -a "$LOG_FILE"
}

log "========================================="
log "Starting auto-deploy..."
log "========================================="

# Navigate to project root
cd "$APP_DIR"

# Pull latest changes
log "Pulling latest changes from git..."
git pull origin main 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    error "git pull failed!"
    exit 1
fi

log "Git pull completed successfully"

# Rebuild and restart containers
log "Rebuilding and restarting Docker containers..."
cd "$APP_DIR/infra"
docker compose up -d --build 2>&1 | tee -a "$LOG_FILE"

if [ $? -ne 0 ]; then
    error "Docker compose rebuild failed!"
    exit 1
fi

log "Docker containers rebuilt and restarted successfully"

# Wait a moment and check health
log "Waiting for health check..."
sleep 10

if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    log "Health check passed - deploy successful!"
else
    log "Health check failed - containers may still be starting up"
fi

log "========================================="
log "Auto-deploy finished"
log "========================================="
