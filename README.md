# Story — monorepo

Hệ gồm **Laravel API** (`backend/`), **Next.js web** (`frontend/`), **Expo (RN + web)** (`app/`), orchestration **Docker Compose** ở gốc repo. Đọc truyện bằng giọng đọc **trên client** (web: Web Speech API; app: `expo-speech`).

## Chạy toàn stack (Docker)

```bash
cp backend/.env.example backend/.env
# APP_KEY: `cd backend && php artisan key:generate` hoặc chỉ Docker:
# docker compose run --rm backend php artisan key:generate
# Tuỳ chọn: cp compose.env.example .env (biến Compose chung, xem compose.env.example)
docker compose up --build
# Crawler worker (Playwright) — tuỳ chọn: cần worker-crawler/.env + token trùng backend, rồi:
# docker compose --profile crawler up -d --build
```

`docker-compose.yml` ghi đè **`DB_HOST` / `REDIS_HOST`** cho backend. Chi tiết: `docker/README.md`, `backend/README.md`.

**Hướng dẫn theo môi trường:** [Windows — không Docker](GUIDE_WINDOW.md) · [VPS có Docker](GUIDE_VPS_HAS_DOCKER.md) · [VPS không Docker](GUIDE_VPS_NO_DOCKER.md)

| Dịch vụ                                | URL / cổng                                                                                                                                                                                                                   |
|----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| API                                    | http://localhost:8000                                                                                                                                                                                                        |
| API Docs                               | http://localhost:8000/docs/api                                                                                                                                                                                               |
| Next.js                                | http://localhost:3000                                                                                                                                                                                                        |
| Expo web                               | http://localhost:8090                                                                                                                                                                                                        |
| Coqui TTS (tuỳ chọn, `coqui/`)         | http://localhost:5002 — Docker (`coqui/run.ps1`) hoặc **không Docker**: `coqui/run-native.ps1`                                                                                                                               |
| Postgres                               | localhost:5432                                                                                                                                                                                                               |
| Redis                                  | localhost:6379                                                                                                                                                                                                               |
| Crawler worker (Python, tuỳ chọn)      | **Docker:** `docker compose --profile crawler up -d` (xem [docker/README.md](docker/README.md)). **Host:** `worker-crawler/worker.py` + `worker-crawler/.env` — [GUIDE_WINDOW.md](GUIDE_WINDOW.md), [run-dev.sh](run-dev.sh) |
| Worker-TTS (Python, tuỳ chọn)          | `docker compose --profile worker-tts up -d --build` — tổng hợp giọng VieNeu-TTS theo job Redis (xem [worker-tts/README.md](worker-tts/README.md))                                                                            |
| Script TTS batch (shell)               | `scripts/story_tts.sh` — multi-voice per segment → `audio_multiple_path`; `scripts/story_single_tts.sh` — 1 voice cố định → `audio_single_path`                                                                              |

Chi tiết từng phần: xem `README.md` trong `backend/`, `frontend/`, `app/`, **`worker-crawler/README.md`**, và **`docker/README.md`** cho image Docker / biến Compose.

## Scripts TTS batch (shell)

| Script | Mô tả |
|--------|-------|
| `scripts/story_tts.sh <story_id> [limit] [ch_parallel] [tts_parallel]` | Multi-voice — lookup voice per speaker từ `voice_mappings`, ghép segment → `audio_multiple_path` |
| `scripts/story_single_tts.sh <story_id> <voice_id> [limit] [ch_parallel] [tts_parallel]` | Single-voice — 1 voice cố định cho toàn chapter → `audio_single_path` |
| `scripts/chapter_tts.sh <chapter_id> <story_id> <segments_file> [rate] [parallel]` | TTS 1 chapter từ file TSV segments |
| `scripts/tts_revid.sh "<text>" <voice_id> [rate] [output]` | TTS 1 đoạn text qua Revid API |

**Voice ID format:** `capcut:BV074_streaming` · `edge:vi-VN-HoaiMyNeural` · `8001`–`8004` (Revid integer)

**Audio storage:** `backend/storage/app/public/stories/{story_id}/chapters/{chapter_id}/`
- `audio.mp3` → `audio_multiple_path` (multi-voice)
- `audio_single.mp3` → `audio_single_path` (single-voice)

## Quy ước: thêm cấu hình hoặc config

Mỗi khi thêm/sửa **config, biến môi trường, Docker, hoặc file cấu hình** gắn với một vùng repo:

1. **`README.md` trong folder tương ứng** — bổ sung bảng/mục hướng dẫn: tên biến, ý nghĩa, ví dụ giá trị, chỗ đọc trong code (file `config/*`, `.env.example`, v.v.).
2. **`AGENT.md` / file `.md` sub-agent** trong `.cursor/agents/` (xem bảng dưới) — cập nhật cùng nội dung (env, ranh giới, file config) để agent AI và người đọc không lệch nhau.
3. Nếu thay đổi **Docker Compose** hoặc env chung: cập nhật **`compose.env.example`**, **`docker/README.md`** (nếu đụng image/compose), và **README gốc** nếu đổi URL/cổng hoặc luồng chạy.

## Sub-agent (vai trò AI theo vùng code)

Trong `.cursor/agents/` có **9 sub-agent** (đồng bộ `.claude/agents/`). Chi tiết: [`.cursor/agents/README.md`](.cursor/agents/README.md).

| Agent / thư mục   | Vai trò                       |
|-------------------|-------------------------------|
| `story-master`    | Coordinator — task ≥2 layer   |
| `backend/`        | API Laravel, CMS, DB, Storage |
| `frontend/`       | Next.js web, audio client     |
| `mobile/`         | Expo / RN + web Metro         |
| `worker-crawler/` | Crawler Playwright + Redis    |
| `worker-tts/`     | TTS VieNeu / vi-xtts          |
| `devops-docker/`  | Docker Compose, nginx         |
| `db-postgres/`    | Query Postgres debug          |
| `story-analyzer/` | Phân tích truyện, NER, thoại  |

Gọi sub-agent: **`/backend-laravel`** (file `.md` phẳng) hoặc **`@.cursor/agents/backend/AGENT.md`**. Khi đổi config, **đồng bộ README folder + agent docs**.
