# Story — monorepo

Hệ gồm **Laravel API** (`backend/`), **Next.js web** (`frontend/`), **Expo (RN + web)** (`app/`), orchestration **Docker Compose** ở gốc repo. Đọc truyện bằng giọng đọc **trên client** (web: Web Speech API; app: `expo-speech`).

## Chạy toàn stack (Docker)

```bash
cp backend/.env.example backend/.env
# APP_KEY: `cd backend && php artisan key:generate` hoặc chỉ Docker:
# docker compose run --rm backend php artisan key:generate
# Tuỳ chọn: cp compose.env.example .env (biến Compose chung, xem compose.env.example)
docker compose up --build
```

`docker-compose.yml` ghi đè **`DB_HOST` / `REDIS_HOST`** cho backend. Chi tiết: `docker/README.md`, `backend/README.md`.

**Hướng dẫn theo môi trường:** [Windows — không Docker](GUIDE_WINDOW.md) · [VPS có Docker](GUIDE_VPS_HAS_DOCKER.md) · [VPS không Docker](GUIDE_VPS_NO_DOCKER.md)

| Dịch vụ   | URL / cổng |
|-----------|------------|
| API       | http://localhost:8000 |
| API Docs  | http://localhost:8000/docs/api |
| Next.js   | http://localhost:3000 |
| Expo web  | http://localhost:8090 |
| Coqui TTS (tuỳ chọn, `coqui/`) | http://localhost:5002 — Docker (`coqui/run.ps1`) hoặc **không Docker**: `coqui/run-native.ps1` |
| Postgres  | localhost:5432 |
| Redis     | localhost:6379 |
| Crawler worker (Python, tuỳ chọn) | `crawler/worker.py` + `crawler/.env` — Redis + token nội bộ; xem [GUIDE_WINDOW.md](GUIDE_WINDOW.md) mục Crawler, [run-dev.sh](run-dev.sh) |

Chi tiết từng phần: xem `README.md` trong `backend/`, `frontend/`, `app/`, **`crawler/README.md`**, và **`docker/README.md`** cho image Docker / biến Compose.

## Quy ước: thêm cấu hình hoặc config

Mỗi khi thêm/sửa **config, biến môi trường, Docker, hoặc file cấu hình** gắn với một vùng repo:

1. **`README.md` trong folder tương ứng** — bổ sung bảng/mục hướng dẫn: tên biến, ý nghĩa, ví dụ giá trị, chỗ đọc trong code (file `config/*`, `.env.example`, v.v.).
2. **`AGENT.md` của sub-agent tương ứng** trong `.cursor/agents/<backend|frontend|mobile>/` — cập nhật cùng nội dung (env, ranh giới, file config) để agent AI và người đọc không lệch nhau.
3. Nếu thay đổi **Docker Compose** hoặc env chung: cập nhật **`compose.env.example`**, **`docker/README.md`** (nếu đụng image/compose), và **README gốc** nếu đổi URL/cổng hoặc luồng chạy.

## Sub-agent (vai trò AI theo vùng code)

Trong `.cursor/agents/` có **3 thư mục**, mỗi nơi một file `AGENT.md` mô tả vai trò khi làm việc trong codebase tương ứng:

| Thư mục | Vai trò |
|---------|---------|
| `.cursor/agents/backend/` | API Laravel, DB, Storage, CORS |
| `.cursor/agents/frontend/` | Next.js, SSR fetch, UI web |
| `.cursor/agents/mobile/` | Expo / React Native + web Metro |

Mở hoặc `@` đúng `AGENT.md` khi giao việc theo từng phần để agent bám đúng ranh giới trách nhiệm. Khi đổi config, luôn **đồng bộ README folder + `AGENT.md`** (xem mục quy ước phía trên).
