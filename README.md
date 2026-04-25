# Story — monorepo

Hệ gồm **Laravel API** (`backend/`), **Next.js web** (`frontend/`), **Expo (RN + web)** (`app/`), **Python worker TTS** (`worker/`), orchestration **Docker Compose** ở gốc repo.

## Chạy toàn stack (Docker)

```bash
cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
# APP_KEY: `cd backend && php artisan key:generate` hoặc chỉ Docker:
# docker compose run --rm backend php artisan key:generate
cp compose.env.example .env   # tùy chọn: WORKER_INTERNAL_TOKEN (khớp WORKER_TOKEN của worker)
docker compose up --build
```

`docker-compose.yml` ghi đè **`DB_HOST` / `REDIS_HOST`** (+ token) cho backend; worker đọc **`worker/.env`** qua `env_file` và vài biến mạng nội bộ trong compose. Chi tiết: `worker/README.md`.

| Dịch vụ   | URL / cổng |
|-----------|------------|
| API       | http://localhost:8000 |
| API Docs  | http://localhost:8000/docs/api |
| Next.js   | http://localhost:3000 |
| Expo web  | http://localhost:8090 |
| Worker    | http://localhost:8080/health |
| Postgres  | localhost:5432 |
| Redis     | localhost:6379 |

Chi tiết từng phần: xem `README.md` trong `backend/`, `frontend/`, `worker/`, `app/`, và **`docker/README.md`** cho image Docker / biến Compose.

## Quy ước: thêm cấu hình hoặc config

Mỗi khi thêm/sửa **config, biến môi trường, Docker, hoặc file cấu hình** gắn với một vùng repo:

1. **`README.md` trong folder tương ứng** — bổ sung bảng/mục hướng dẫn: tên biến, ý nghĩa, ví dụ giá trị, chỗ đọc trong code (file `config/*`, `.env.example`, v.v.).
2. **`AGENT.md` của sub-agent tương ứng** trong `.cursor/agents/<backend|frontend|worker|mobile>/` — cập nhật cùng nội dung (env, ranh giới, file config) để agent AI và người đọc không lệch nhau.
3. Nếu thay đổi **Docker Compose** hoặc env chung: cập nhật **`compose.env.example`**, **`docker/README.md`** (nếu đụng image/compose), và **README gốc** nếu đổi URL/cổng hoặc luồng chạy.

## Sub-agent (vai trò AI theo vùng code)

Trong `.cursor/agents/` có **4 thư mục**, mỗi nơi một file `AGENT.md` mô tả vai trò khi làm việc trong codebase tương ứng:

| Thư mục | Vai trò |
|---------|---------|
| `.cursor/agents/backend/` | API Laravel, DB, Storage, queue Redis, CORS |
| `.cursor/agents/frontend/` | Next.js, SSR fetch, UI web |
| `.cursor/agents/worker/` | Python, Redis consumer, ffmpeg/TTS pipeline |
| `.cursor/agents/mobile/` | Expo / React Native + web Metro |

Mở hoặc `@` đúng `AGENT.md` khi giao việc theo từng phần để agent bám đúng ranh giới trách nhiệm. Khi đổi config, luôn **đồng bộ README folder + `AGENT.md`** (xem mục quy ước phía trên).
