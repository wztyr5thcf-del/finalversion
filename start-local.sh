#!/bin/bash
# Local development startup script
# Starts PostgreSQL, API server, and frontend dev server
#
# Usage: bash start-local.sh
#
# IMPORTANT: In this sandbox, all services must run within the same shell
# session. Do not source this from a separate terminal - run it directly.
#
# Ports used:
#   PostgreSQL: 5432
#   API Server: 3000
#   Frontend:   5173

set -e

# Source nvm to get node/pnpm
source /root/.nvm/nvm.sh
nvm use 24
export PATH="$PATH"

# Fix /tmp permissions for PostgreSQL
chmod 1777 /tmp 2>/dev/null || true

# ─── Start PostgreSQL ────────────────────────────────────────────────
echo "=== Starting PostgreSQL ==="
rm -f /var/lib/pgsql/data/postmaster.pid /var/run/postgresql/.s.PGSQL.5432.lock /var/run/postgresql/.s.PGSQL.5432
runuser -u postgres -- postgres -D /var/lib/pgsql/data -h 127.0.0.1 -k /var/run/postgresql > /projects/sandbox/finalversion/pg.log 2>&1 &
PG_PID=$!
sleep 4

/usr/bin/pg_isready -h 127.0.0.1 || {
  echo "FAILED: PostgreSQL not running. Check pg.log"
  exit 1
}
echo "=== PostgreSQL running (PID: $PG_PID) ==="

# ─── Set variables ───────────────────────────────────────────────────
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/creatools_dev"
export API_PORT=3000
export FE_PORT=5173

cd /projects/sandbox/finalversion

# ─── Start API server ────────────────────────────────────────────────
echo "=== Starting API server on port $API_PORT ==="
PORT=$API_PORT DATABASE_URL="$DATABASE_URL" node --enable-source-maps artifacts/api-server/dist/index.mjs > /projects/sandbox/finalversion/api.log 2>&1 &
API_PID=$!
sleep 3

curl -s http://localhost:$API_PORT/api/healthz > /dev/null || {
  echo "WARNING: API server may not be ready yet. Check api.log"
}
echo "=== API server running (PID: $API_PID) ==="

# ─── Start frontend dev server ───────────────────────────────────────
echo "=== Starting frontend dev server on port $FE_PORT ==="
cd artifacts/creatools
PORT=$FE_PORT BASE_PATH=/ ./node_modules/.bin/vite > /projects/sandbox/finalversion/vite.log 2>&1 &
FE_PID=$!
sleep 8

curl -s -o /dev/null -w "" http://localhost:$FE_PORT/ || {
  echo "WARNING: Frontend may not be ready yet. Check vite.log"
}
echo "=== Frontend running (PID: $FE_PID) ==="

echo ""
echo "============================================"
echo "  All services started!"
echo "  PostgreSQL: localhost:5432 (PID: $PG_PID)"
echo "  API Server: http://localhost:$API_PORT (PID: $API_PID)"
echo "  Frontend:   http://localhost:$FE_PORT (PID: $FE_PID)"
echo "============================================"
echo ""
echo "  Logs:"
echo "    PostgreSQL: pg.log"
echo "    API Server: api.log"
echo "    Frontend:   vite.log"
echo ""
echo "  To stop all: kill $PG_PID $API_PID $FE_PID"
echo ""

# Wait for all background processes
wait
