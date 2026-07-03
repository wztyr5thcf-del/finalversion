#!/bin/bash
set -e

REPO_DIR="/opt/creatools"
FRONTEND_DIR="/var/www/creatools"
LOG_PREFIX="[DEPLOY]"

echo "$LOG_PREFIX ======================================="
echo "$LOG_PREFIX Smart deploy started (native mode)"
echo "$LOG_PREFIX ======================================="

cd "$REPO_DIR"

# Record current commit
BEFORE=$(git rev-parse HEAD)

# Pull latest
git fetch origin
git reset --hard origin/feat/aws-infra-deployment

AFTER=$(git rev-parse HEAD)

# Skip if no changes
if [ "$BEFORE" = "$AFTER" ]; then
  echo "$LOG_PREFIX No new commits. Skipping deploy."
  exit 0
fi

echo "$LOG_PREFIX New commits detected: $BEFORE -> $AFTER"

# Check if dependencies changed
DEPS_CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" | grep -E "pnpm-lock|package\.json|pnpm-workspace" || true)

if [ -n "$DEPS_CHANGED" ]; then
  echo "$LOG_PREFIX Dependencies changed. Running pnpm install..."
  pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false
fi

# Check what changed
BACKEND_CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" | grep -E "^artifacts/api-server/|^lib/" || true)
FRONTEND_CHANGED=$(git diff --name-only "$BEFORE" "$AFTER" | grep -E "^artifacts/creatools/" || true)

# Rebuild backend if changed
if [ -n "$BACKEND_CHANGED" ] || [ -n "$DEPS_CHANGED" ]; then
  echo "$LOG_PREFIX Rebuilding backend..."
  cd "$REPO_DIR/artifacts/api-server"
  node build.mjs
  cd "$REPO_DIR"

  # Load env and restart
  set -a
  source "$REPO_DIR/infra/.env"
  set +a
  export NODE_TLS_REJECT_UNAUTHORIZED=0

  pm2 restart creatools-api --update-env
  echo "$LOG_PREFIX Backend restarted."
fi

# Rebuild frontend if changed
if [ -n "$FRONTEND_CHANGED" ] || [ -n "$DEPS_CHANGED" ]; then
  echo "$LOG_PREFIX Rebuilding frontend..."
  cd "$REPO_DIR"
  PORT=5173 BASE_PATH=/ pnpm --filter @workspace/creatools run build
  sudo cp -r artifacts/creatools/dist/public/* "$FRONTEND_DIR/"
  echo "$LOG_PREFIX Frontend deployed."
fi

echo "$LOG_PREFIX ======================================="
echo "$LOG_PREFIX Deploy complete! $(date)"
echo "$LOG_PREFIX ======================================="
