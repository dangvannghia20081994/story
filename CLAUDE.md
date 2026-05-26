# CLAUDE.md — project `story`

File này load tự động khi mở repo trong Claude Code CLI. Mục tiêu: cho assistant đủ context để route việc đúng layer, tránh đụng nhầm scope.

## Project là gì

Monorepo đọc truyện online. Người dùng đọc trên web/app, **giọng đọc tổng hợp ở client** (web: Web Speech API; mobile: `expo-speech`). Truyện được **crawl** bằng worker Playwright từ nguồn ngoài, lưu vào Postgres + Redis qua API Laravel nội bộ. Có thêm **TTS server-side** (`worker-tts/`, `worker-voice/`) cho pipeline tổng hợp audio chất lượng cao.

## Stack & layer

| Layer | Folder | Tech |
|---|---|---|
| Backend API + CMS | `backend/` | Laravel 12, PHP ≥ 8.4, Postgres 16, Redis 7, Scramble OpenAPI |
| Web | `frontend/` | Next.js 15 (App Router), Tailwind |
| Mobile + web Metro | `app/` | Expo Router, RN, `expo-speech`, `expo-av` |
| Crawler | `crawler/` | Python 3.10+, Playwright (Chromium), BLPOP Redis |
| TTS workers | `worker-tts/`, `worker-voice/` | Python — VieNeu-TTS / vi-xtts |
| Infra | `docker/`, `docker-compose.yml`, `compose.env.example` | Docker Compose, nginx |

## URL chuẩn dev

| Service | URL |
|---|---|
| API | http://localhost:8000 (docs `/docs/api`) |
| Next.js | http://localhost:3000 |
| Expo web | http://localhost:8090 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |
| Coqui TTS (tuỳ chọn) | http://localhost:5002 |

## Quy tắc routing cho assistant

**Đụng ≥2 layer hoặc cần điều phối** → dùng `story-master` (coordinator). Còn lại spawn đúng sub-agent layer:

| File / intent | Agent |
|---|---|
| `backend/**`, route API, controller, migration, CMS Blade `/admin`, lexicon | `backend-laravel` |
| `frontend/**`, page Next.js, RSC/client component, audio web | `frontend-next` |
| `app/**`, screen Expo, EAS build, `app.json` | `mobile-expo` |
| `crawler/**`, Playwright, `worker.py`, selector mục lục/chương | `crawler-python` |
| `worker-tts/**`, `worker-voice/**`, pipeline TTS, upload audio | `worker-tts-python` |
| `docker-compose.yml`, `docker/**`, nginx, port, profile, image | `devops-docker` |
| Query Postgres (debug data, schema, EXPLAIN) | `db-postgres` (read-only mặc định) |

Full chi tiết: `.claude/agents/README.md`, `.claude/agents/story-master.md`.

## Convention quan trọng

- **Main branch**: `develop`. **Không sửa code trên `develop` trực tiếp.**
- **Branch naming**: `fix/YYYY-MM-<desc>` | `feature/YYYY-MM-<desc>` | `hotfix/YYYY-MM-<desc>` (lấy `YYYY-MM` từ ngày hiện tại).
- **Commit message**: theo style hiện tại (`git log`) — tiếng Việt, ngắn, mô tả thay đổi. Vd `Update config build apk`, `Replace text Vietnamese`.
- **Genre chuẩn**: `tu-tien`, `huyen-huyen`, `kiem-hiep`, `do-thi`, `khac`.
- **Route key `{story}`**: số → `id`, ngược lại → `slug` (xem `AppServiceProvider`).
- **Storage audio**: `backend/storage/app/public/stories/{story_id}/chapters/{chapter_id}/audio.mp3` (cần `php artisan storage:link`).
- **Crawler ↔ backend**: crawler gọi API nội bộ `/api/internal/crawler/*` qua header `X-Crawler-Token`. TTS worker upload qua `WORKER_TTS_INTERNAL_TOKEN`.

## Khi sửa config / env (BẮT BUỘC đồng bộ)

Mỗi khi thêm/sửa **`.env*`, `config/*`, `app.json`, `next.config.ts`, `docker-compose.yml`, Dockerfile, `compose.env.example`**:

1. Update **README folder tương ứng** — bảng biến, ý nghĩa, ví dụ.
2. Update **`.cursor/agents/<layer>/AGENT.md`** (sync với agent Cursor).
3. Nếu là Compose chung / image trong `docker/`: update **`compose.env.example`**, **`docker/README.md`**, **`README.md` gốc** nếu đổi cổng/URL/luồng.
4. Sub-agent `.claude/agents/<name>.md` tự dặn agent làm bước này — nhưng coordinator phải review trước khi trả user.

## Quy tắc safety

- **Không tự refactor ngoài scope.** Phát hiện code xấu ngoài scope → gợi ý trong report, không tự sửa.
- **Hạn chế sửa component / lib shared.** Bug 1 page → sửa local. Buộc sửa shared → list caller, đánh giá risk, confirm user trước. HIGH risk → cấm, đề xuất hướng local.
- **Không destructive git** (`reset --hard`, `push --force`, `branch -D`) trừ khi user yêu cầu rõ. **Không `--no-verify`**, không amend commit đã push.
- **DB**: query SELECT/EXPLAIN read-only mặc định. DML/DDL phải confirm user.
- **Commit/push/PR** chỉ khi user yêu cầu rõ ràng.

## Chạy nhanh

```bash
# Full stack qua Docker
cp backend/.env.example backend/.env
docker compose up --build

# Crawler worker (tuỳ chọn)
docker compose --profile crawler up -d --build
```

Hướng dẫn chi tiết theo môi trường: `GUIDE_WINDOW.md`, `GUIDE_VPS_HAS_DOCKER.md`, `GUIDE_VPS_NO_DOCKER.md`. Script dev local: `run-dev.sh`.

## Phong cách giao tiếp (assistant ↔ user)

- **Tiếng Việt**, gọn, không màu mè.
- Xưng "em", gọi user là "sếp" / "anh". Mở đầu bằng "Dạ"/"Vâng" khi phù hợp, kết câu có "ạ". Không lạm dụng.
- 1 câu báo bước quan trọng, không narrate suy nghĩ.
- Reference code dạng `path/to/File.php:123` để click được.
- Không hứa hẹn timeline.
