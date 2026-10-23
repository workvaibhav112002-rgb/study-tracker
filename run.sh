#!/usr/bin/env bash

# Study Tracker & Pomodoro Launcher
# Starts Go Backend (port 8080) and React/Vite Frontend (port 5173)

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
export PATH="$HOME/.local/go/bin:$PATH"

echo "=================================================="
echo "    📚  Starting Study Tracker & Pomodoro  ⏱️     "
echo "=================================================="

# Function to kill child processes on exit
cleanup() {
    echo ""
    echo "Shutting down Study Tracker services..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup INT TERM

# 1. Start Go Backend
echo "[1/2] Starting Go SQLite Backend on http://localhost:8080..."
cd "$DIR/backend"
if [ -f "./study-tracker-server" ]; then
    ./study-tracker-server &
    BACKEND_PID=$!
else
    go run main.go &
    BACKEND_PID=$!
fi

# Wait for backend to be ready
sleep 1.5

# 2. Start Frontend
echo "[2/2] Starting React Vite Frontend on http://localhost:5173..."
cd "$DIR/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "  🚀 App running at: http://localhost:5173        "
echo "  📡 API & Health:   http://localhost:8080/api/health"
echo "  📁 Local Database: $DIR/study_tracker.db         "
echo "  (Press Ctrl+C to stop all services)            "
echo "=================================================="
echo ""

wait
