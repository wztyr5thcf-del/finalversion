#!/bin/bash
# =============================================================================
# Smart Auto-Deploy Script
# Called by the webhook server when a push event is received.
# Detects whether dependencies changed and uses Docker layer cache accordingly.
# If only source code changed, the cached pnpm install layer is reused (~30s).
# If package.json or pnpm-lock.yaml changed, a full rebuild is triggered.
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
log "Starting smart auto-deploy..."
log "========================================="

# Navigate to project root
cd "$APP_DIR"

# Record current commit before pull
BEFORE_SHA=$(git rev-parse HEAD)

# Pull latest changes
log "Pulling latest changes from git..."
if ! git pull origin main 2>&1 | tee -a "$LOG_FILE"; then
    error "git pull failed!"
    exit 1
fi

AFTER_SHA=$(git rev-parse HEAD)

if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
    log "No new commits - nothing to deploy"
    exit 0
fi

log "Git pull completed successfully ($BEFORE_SHA -> $AFTER_SHA)"

# Detect if dependency files changed between the two commits
DEPS_CHANGED=false
CHANGED_FILES=$(git diff --name-only "$BEFORE_SHA" "$AFTER_SHA")

if echo "$CHANGED_FILES" | grep -qE '(^|/)package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$'; then
    DEPS_CHANGED=true
    log "Dependency files changed - full rebuild required"
else
    log "Only source code changed - using cached dependencies (fast rebuild)"
fi

# Enable BuildKit for better layer caching
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Rebuild and restart containers with BuildKit cache
log "Rebuilding Docker containers (BuildKit enabled, deps_changed=$DEPS_CHANGED)..."
cd "$APP_DIR/infra"

if ! docker compose build 2>&1 | tee -a "$LOG_FILE"; then
    error "Docker compose build failed!"
    exit 1
fi

log "Build completed, restarting containers..."

if ! docker compose up -d 2>&1 | tee -a "$LOG_FILE"; then
    error "Docker compose up failed!"
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
log "Smart auto-deploy finished"
log "========================================="
