#!/usr/bin/env bash
# ============================================================================
# Creatools Deployment Script
# Pulls latest code, builds API + Frontend, deploys, and restarts services
# Run as the ubuntu user on the EC2 instance
#
# Usage:
#   ./deploy.sh              # Deploy latest from main
#   ./deploy.sh v1.2.0       # Deploy a specific tag
#   ./deploy.sh abc123f      # Deploy a specific commit
#   ./deploy.sh origin/feat  # Deploy a specific remote branch
# ============================================================================
set -euo pipefail

APP_DIR="/opt/creatools/app"
FRONTEND_DIR="/opt/creatools/frontend"
DEPLOY_DIR="$APP_DIR/deploy"
DEPLOY_REF="${1:-}"  # Optional: git ref (tag, commit, branch) to deploy
HEALTH_CHECK_URL="http://localhost:8080/api/health"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_DELAY=3

echo "============================================"
echo "Deploying Creatools"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
if [ -n "$DEPLOY_REF" ]; then
    echo "Target ref: $DEPLOY_REF"
fi
echo "============================================"
echo ""

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo "ERROR: App directory not found at $APP_DIR"
    echo "Please clone the repository first:"
    echo "  git clone <repo-url> $APP_DIR"
    exit 1
fi

# Load environment variables
if [ -f "$DEPLOY_DIR/.env" ]; then
    echo "[1/8] Loading environment variables..."
    set -a
    source "$DEPLOY_DIR/.env"
    set +a
else
    echo "WARNING: No .env file found at $DEPLOY_DIR/.env"
    echo "Continuing with existing environment..."
fi

# Pull latest code or checkout specific ref
echo "[2/8] Fetching and checking out code..."
cd "$APP_DIR"
git fetch origin --tags

if [ -n "$DEPLOY_REF" ]; then
    echo "  Checking out ref: $DEPLOY_REF"
    git checkout "$DEPLOY_REF"
else
    echo "  Pulling latest from main..."
    git checkout main
    git pull origin main
fi

DEPLOYED_COMMIT=$(git rev-parse --short HEAD)
echo "  Deployed commit: $DEPLOYED_COMMIT"

# Install dependencies
echo "[3/8] Installing dependencies..."
pnpm install --frozen-lockfile

# Build API server
echo "[4/8] Building API server..."
cd "$APP_DIR/artifacts/api-server"
node ./build.mjs

# Build Frontend
echo "[5/8] Building frontend..."
cd "$APP_DIR"
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/creatools build

# Copy frontend to Nginx serve directory
echo "[6/8] Deploying frontend files..."
rm -rf "$FRONTEND_DIR"/*
cp -r "$APP_DIR/artifacts/creatools/dist/public/"* "$FRONTEND_DIR/"
echo "  Frontend deployed to $FRONTEND_DIR"

# Push database schema (if DATABASE_URL is available)
if [ -n "${DATABASE_URL:-}" ]; then
    echo "[7/8] Pushing database schema..."
    cd "$APP_DIR"
    pnpm --filter db push
else
    echo "[7/8] Skipping database schema push (DATABASE_URL not set)"
fi

# Restart PM2 processes
echo "[8/8] Restarting PM2 processes..."
cd "$DEPLOY_DIR"
if pm2 describe creatools-api > /dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi
pm2 save

# Health check
echo ""
echo "Running health check..."
HEALTHY=false
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        HEALTHY=true
        echo "  Health check passed on attempt $i"
        break
    fi
    echo "  Attempt $i/$HEALTH_CHECK_RETRIES - waiting ${HEALTH_CHECK_DELAY}s..."
    sleep "$HEALTH_CHECK_DELAY"
done

if [ "$HEALTHY" = false ]; then
    echo ""
    echo "WARNING: Health check failed after $HEALTH_CHECK_RETRIES attempts!"
    echo "The API may not be responding correctly."
    echo "Check logs with: pm2 logs creatools-api --lines 50"
    echo ""
    pm2 status
    exit 1
fi

echo ""
echo "============================================"
echo "Deployment Complete!"
echo "Commit: $DEPLOYED_COMMIT"
echo "============================================"
echo ""
echo "Status:"
pm2 status
echo ""
echo "Check logs:"
echo "  pm2 logs creatools-api"
