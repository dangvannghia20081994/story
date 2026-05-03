#!/usr/bin/env bash
# Chạy trên Windows (Git Bash) hoặc tương tự. Redis: redis/redis-server.exe + redis.windows.conf
#
# Tuỳ chọn:
#   --with-crawler  Python crawler (cần crawler/.env + crawler/.venv)
#   --with-worker   worker-tts Python (worker_redis.py — BLPOP Redis; luồng CMS «enqueue TTS»)
#   --with-app      Expo (React Native + web) trong app/ — npm run start (Metro; web thường :8090 nếu đã cấu hình)
# Chuẩn bị crawler: crawler/README.md
# Tắt crawler: SKIP_CRAWLER_WORKER=1 ./run-dev.sh --with-crawler
# Tắt worker:  SKIP_WORKER=1 ./run-dev.sh --with-worker  (alias: SKIP_WORKER_TTS / SKIP_QUEUE_WORKER)
# Tắt Expo:    SKIP_APP=1 ./run-dev.sh --with-app
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REDIS_DIR="$ROOT_DIR/redis"
REDIS_SERVER="$REDIS_DIR/redis-server.exe"

WITH_CRAWLER=0
WITH_WORKER=0
WITH_APP=0
for arg in "$@"; do
  if [[ "$arg" == "--with-crawler" ]]; then
    WITH_CRAWLER=1
  elif [[ "$arg" == "--with-worker" || "$arg" == "--with-worker-tts" ]]; then
    WITH_WORKER=1
  elif [[ "$arg" == "--with-app" ]]; then
    WITH_APP=1
  elif [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    echo "Usage: $0 [--with-crawler] [--with-worker] [--with-app]"
    echo "  Mặc định: Redis (nếu có), backend (php artisan serve), frontend (npm run dev)."
    echo "  --with-crawler   Crawler Python worker.py (cần crawler/.env + crawler/.venv)."
    echo "  --with-worker    worker-tts/worker_redis.py (VieNeu; cùng Redis list với nút enqueue TTS CMS)."
    echo "  (--with-worker-tts được coi như --with-worker, tương thích cũ.)"
    echo "  --with-app       Expo app/ (npm run start — Metro; xem app/README.md)."
    echo "  SKIP_CRAWLER_WORKER=1  bỏ qua crawler dù có --with-crawler."
    echo "  SKIP_WORKER=1          bỏ qua worker-tts dù có --with-worker (alias: SKIP_WORKER_TTS, SKIP_QUEUE_WORKER)."
    echo "  SKIP_APP=1             bỏ qua Expo dù có --with-app."
    exit 0
  fi
done

PIDS=()

start_service() {
  local name="$1"
  local dir="$2"
  local cmd="$3"

  (
    cd "$dir" || {
      echo "[$name] Lỗi: không cd được $dir" >&2
      exit 1
    }
    echo "[$name] Starting: $cmd"
    # bash -c (không -l): giữ PATH từ Git Bash/Windows — bash -lc thường làm mất binary trong PATH.
    exec bash -c "$cmd"
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

if [[ "$WITH_APP" == "1" && "${SKIP_APP:-}" != "1" ]]; then
  if [[ -f "$ROOT_DIR/app/package.json" ]]; then
    start_service "app" "$ROOT_DIR/app" "npm run start"
  else
    echo "Warning: --with-app nhưng không thấy app/package.json — bỏ qua."
  fi
fi

skip_worker=0
if [[ "${SKIP_WORKER:-}" == "1" || "${SKIP_WORKER_TTS:-}" == "1" || "${SKIP_QUEUE_WORKER:-}" == "1" ]]; then
  skip_worker=1
fi

if [[ "$WITH_WORKER" == "1" && "$skip_worker" != "1" ]]; then
  TTS_PY=""
  if [[ -f "$ROOT_DIR/worker-tts/.venv/Scripts/python.exe" ]]; then
    TTS_PY="$ROOT_DIR/worker-tts/.venv/Scripts/python.exe"
  elif [[ -f "$ROOT_DIR/worker-tts/.venv/bin/python" ]]; then
    TTS_PY="$ROOT_DIR/worker-tts/.venv/bin/python"
  fi
  if [[ -n "$TTS_PY" ]]; then
    start_service "worker-tts" "$ROOT_DIR/worker-tts" "$TTS_PY worker_redis.py"
  else
    echo "Warning: --with-worker nhưng không thấy worker-tts/.venv — bỏ qua. cd worker-tts && python -m venv .venv && pip install -r requirements.txt"
  fi
fi

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
