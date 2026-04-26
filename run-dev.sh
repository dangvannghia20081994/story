#!/usr/bin/env bash
# Chạy trên Windows (Git Bash) hoặc tương tự. Redis: redis/redis-server.exe + redis.windows.conf
#
# Crawler (tuỳ chọn): truyền --with-crawler để chạy worker khi có crawler/.env VÀ crawler/.venv
# (Python trong .venv — tránh ModuleNotFoundError: playwright khi dùng python global).
# Chuẩn bị: xem crawler/README.md — venv + pip install -r requirements.txt + playwright install chromium
# Sao chép crawler/.env.example → crawler/.env và đặt CRAWLER_INTERNAL_TOKEN trùng backend/.env
# Tắt crawler dù có --with-crawler: SKIP_CRAWLER_WORKER=1 ./run-dev.sh --with-crawler
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REDIS_DIR="$ROOT_DIR/redis"
REDIS_SERVER="$REDIS_DIR/redis-server.exe"

WITH_CRAWLER=0
for arg in "$@"; do
  if [[ "$arg" == "--with-crawler" ]]; then
    WITH_CRAWLER=1
  elif [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    echo "Usage: $0 [--with-crawler]"
    echo "  --with-crawler  Khởi động crawler worker (cần crawler/.env + crawler/.venv)."
    echo "  Mặc định chỉ Redis (nếu có), backend, frontend."
    echo "  SKIP_CRAWLER_WORKER=1 vẫn bỏ qua worker kể cả khi có --with-crawler."
    exit 0
  fi
done

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

if [[ "$WITH_CRAWLER" == "1" && "${SKIP_CRAWLER_WORKER:-}" != "1" && -f "$ROOT_DIR/crawler/.env" ]]; then
  CRAWLER_PY=""
  if [[ -f "$ROOT_DIR/crawler/.venv/Scripts/python.exe" ]]; then
    CRAWLER_PY="$ROOT_DIR/crawler/.venv/Scripts/python.exe"
  elif [[ -f "$ROOT_DIR/crawler/.venv/bin/python" ]]; then
    CRAWLER_PY="$ROOT_DIR/crawler/.venv/bin/python"
  fi
  if [[ -n "$CRAWLER_PY" ]]; then
    start_service "crawler-worker" "$ROOT_DIR/crawler" "$CRAWLER_PY worker.py"
  else
    echo "Warning: --with-crawler nhưng không thấy crawler/.venv — bỏ qua crawler-worker. Tạo venv: cd crawler && python -m venv .venv && … xem crawler/README.md."
  fi
elif [[ "$WITH_CRAWLER" == "1" && "${SKIP_CRAWLER_WORKER:-}" != "1" ]]; then
  echo "Warning: --with-crawler nhưng thiếu crawler/.env — bỏ qua crawler-worker (sao chép crawler/.env.example → crawler/.env)."
fi

echo "All selected services started."
echo "Press Ctrl+C to stop."

wait
