#!/usr/bin/env bash
# Chạy trên Windows (Git Bash) hoặc tương tự. Redis: redis/redis-server.exe + redis.windows.conf
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REDIS_DIR="$ROOT_DIR/redis"
REDIS_SERVER="$REDIS_DIR/redis-server.exe"

PIDS=()

start_service() {
  local name="$1"
  local dir="$2"
  local cmd="$3"

  (
    cd "$dir"
    echo "[$name] Starting: $cmd"
    exec bash -lc "$cmd"
  ) &

  local pid=$!
  PIDS+=("$pid")
  echo "[$name] PID: $pid"
}

cleanup() {
  echo
  echo "Stopping services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

if [[ -f "$REDIS_SERVER" ]]; then
  start_service "redis" "$REDIS_DIR" "./redis-server.exe ./redis.windows.conf"
else
  echo "Warning: $REDIS_SERVER not found; skip starting Redis. Install Redis in redis/ or start it manually (port 6379)."
fi

start_service "backend" "$ROOT_DIR/backend" "php artisan serve --host=localhost --port=8000"
start_service "frontend" "$ROOT_DIR/frontend" "npm run dev"

echo "All selected services started."
echo "Press Ctrl+C to stop."

wait
