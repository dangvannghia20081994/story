# Backend (Laravel 12)

API quản lý **truyện (danh mục)**, **chương** (nội dung + trạng thái audio), **nhân vật / giọng**, **lexicon Tu Tiên** (tiền xử lý văn bản), queue Redis cho worker TTS, callback nội bộ. File MP3 lưu qua **Storage** disk `public`.

## Yêu cầu

- PHP **≥ 8.4**
- Composer
- PostgreSQL (mặc định Docker) hoặc chỉnh `.env`
- Redis

## Cài đặt local

```bash
cd backend
cp .env.example .env
php artisan key:generate
composer install
php artisan migrate
php artisan storage:link
php artisan serve
```

Biến quan trọng trong **`.env` / `.env.example`**: `DB_*`, `REDIS_*`, `REDIS_PREFIX` (đồng bộ với worker, thường rỗng), `WORKER_INTERNAL_TOKEN`, `CORS_ALLOWED_ORIGINS`, `TTS_DEFAULT_VOICE_ID`, `TTS_NARRATOR_CHARACTER_NAME`, `API_VERSION`, `APP_URL`, `FRONTEND_URL`.

## Cấu hình trong code (`config/`)

| File | Nội dung |
|------|-----------|
| `config/database.php` | Kết nối DB |
| `config/queue.php` / Redis | Queue (Redis) |
| `config/filesystems.php` | Disk `public` / Storage |
| `config/cors.php` | `CORS_ALLOWED_ORIGINS`, đường `api/*` |
| `config/services.php` | `worker.internal_token` |
| `config/tts.php` | `TTS_DEFAULT_VOICE_ID`, `TTS_NARRATOR_CHARACTER_NAME` (segment mặc định gửi worker) |
| `config/scramble.php` | OpenAPI docs UI (`/docs/api`) và JSON spec (`/docs/api.json`) |

**Quy ước:** mỗi lần thêm/sửa config hoặc biến env liên quan backend → cập nhật **`backend/README.md`** và **`.cursor/agents/backend/AGENT.md`**.

## API Docs (OpenAPI / Swagger-like)

Sau khi chạy backend, mở:

- UI docs: `http://localhost:8000/docs/api`
- OpenAPI JSON: `http://localhost:8000/docs/api.json`

UI hỗ trợ **Try it** để test request trực tiếp. Dữ liệu docs được sinh tự động từ routes + request validation.

## API (REST, JSON)

Gửi header `Accept: application/json` khi gọi từ curl.

| Phương thức | Đường dẫn | Mô tả |
|-------------|-----------|--------|
| POST | `/api/preprocess-preview` | Body `{ "text": "..." }` — xem văn bản sau áp dụng lexicon |
| GET/POST/PATCH/DELETE | `/api/stories` … | CRUD truyện; `POST/PATCH` hỗ trợ thêm `genre?` (`tu-tien` \| `huyen-huyen` \| `kiem-hiep` \| `do-thi` \| `khac`), cùng `title`, `slug?`, `description?`, `first_chapter?` `{ title, content }` |
| GET/POST/PATCH/DELETE | `/api/stories/{id}/chapters` … | CRUD chương |
| POST | `/api/stories/{id}/chapters/{id}/queue-tts` | Đẩy job Redis (text đã preprocess + `voice_segments`) |
| GET/POST/PATCH/DELETE | `/api/stories/{id}/characters` … | CRUD nhân vật / `voice_id` |
| GET/POST/PATCH/DELETE | `/api/lexicons` … | CRUD lexicon (`type`: `pronunciation` \| `name` \| `filter`, `priority`) |
| POST | `/api/internal/tts-complete` | Worker: Bearer `WORKER_INTERNAL_TOKEN` — body `chapter_id`, `story_id`, `status` (`completed`\|`failed`\|`ready`), `audio_path?`, `error?`, `duration?` |

**Hợp đồng queue Redis** (`story:tts:queue`): JSON gồm tối thiểu `chapter_id`, `story_id`, `text` (đã preprocess), `voice_segments` (mảng `{ voice_id, text, pitch, rate }`).

## Docker

Từ gốc repo: tạo **`backend/.env`** từ `.env.example`, chạy `php artisan key:generate` nếu chưa có `APP_KEY`, rồi `docker compose up` — xem `../README.md`.

Compose **không** nhân đôi toàn bộ biến Laravel: container đọc `backend/.env` trên volume; `docker-compose.yml` chỉ ghi đè **`DB_HOST=db`** và **`REDIS_HOST=redis`** (và `WORKER_INTERNAL_TOKEN` từ biến compose) để trỏ đúng service Docker.

`php artisan serve` trong image dùng `--no-reload` để env DB/Redis không bị strip.

## Các lệnh chạy trong container

Chạy từ **gốc repo** (cùng thư mục với `docker-compose.yml`). Cần service **`backend`** (và thường cả **`db`**, **`redis`**) đang chạy — ví dụ `docker compose up -d db redis backend`.

| Mục đích | Lệnh |
|----------|------|
| Artisan (migrate, route:list, …) | `docker compose exec backend php artisan migrate` |
| Tạo `APP_KEY` lần đầu | `docker compose exec backend php artisan key:generate` |
| Composer | `docker compose exec backend composer install` |
| Export OpenAPI file tĩnh | `docker compose exec backend php artisan scramble:export` |
| Shell trong container | `docker compose exec backend sh` |

Một lần chạy **container mới** (không cần service `backend` đang listen), vẫn kèm DB/Redis theo `depends_on`:

`docker compose run --rm backend php artisan key:generate`

## Ghi chú schema

- Bảng `dictionary_entries` (cũ) có thể còn trong DB nhưng **không còn route API**; dùng `lexicons` theo ROADMAP.
