#!/usr/bin/env bash
# Study Tracker local launcher: Go API on :8080 and Vite dev server on :5173.
# Requires a .env file (see .env.example) with DATABASE_URL and JWT_SECRET.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$HOME/.local/go/bin:$PATH"

# Load .env.local (written by `neon deploy`) first, then .env for overrides.
set -a
[ -f "$DIR/.env.local" ] && . "$DIR/.env.local"
[ -f "$DIR/.env" ] && . "$DIR/.env"
set +a
: "${DATABASE_URL:=${DATABASE_URL_UNPOOLED:-}}"
if [ -z "${DATABASE_URL:-}" ] || [ -z "${JWT_SECRET:-}" ]; then
  echo "Set DATABASE_URL (run 'neon deploy' or copy .env.example to .env) and JWT_SECRET." >&2
  exit 1
fi

cleanup() {
  echo; echo "Shutting down..."
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[1/2] API      → http://localhost:${PORT:-8080}/api/health"
(cd "$DIR/backend" && go run ./cmd/server) &
BACKEND_PID=$!

echo "[2/2] Frontend → http://localhost:5173"
(cd "$DIR/frontend" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

wait
