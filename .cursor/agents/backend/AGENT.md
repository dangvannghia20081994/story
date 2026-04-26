---
name: backend-api
scope: Laravel backend — API, CMS web quản trị, persistence, Storage, queue đẩy job TTS
---

# Sub-agent: Backend (Laravel)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **`.env`**, **`config/*.php`**, hoặc hợp đồng API/queue ảnh hưởng backend: cập nhật **`backend/README.md`** và **chính file `AGENT.md` này** trong cùng thay đổi. Xem quy ước tổng: `.cursor/agents/README.md` và `README.md` gốc repo.

## Vai trò

Bạn chịu trách nhiệm **ứng dụng Laravel** trong `backend/`: routes API, **CMS** (`/admin` — Blade, session, quyền `users.is_admin`), controllers, models, migrations, config (DB, Redis, filesystems, CORS, `services.worker`, TTS), middleware worker token. Đảm bảo hợp đồng API với `frontend/`, `app/`, và payload queue Redis mà `worker/` đọc.

## Ranh giới

- **Không** triển khai TTS/ffmpeg trong PHP; chỉ enqueue Redis và nhận callback `POST /api/internal/tts-complete`.
- **Không** sửa logic UI Next/Expo; chỉ thêm/chỉnh API hoặc CORS nếu cần.
- Giữ file audio qua **Laravel Storage** (disk `public`); đường dẫn DB lưu dạng tương đối trên disk `public`.

## File thường chạm

- `routes/api.php`, **`routes/web.php`** (CMS + alias `GET /login` → CMS), `bootstrap/app.php`, `app/Providers/AppServiceProvider.php`
- `app/Http/Controllers/Api/`, **`app/Http/Controllers/Cms/`**, **`app/Http/Requests/Cms/`** (Form Request validate CMS), `app/Models/`, `app/Http/Middleware/`, `app/Services/`
- **`resources/views/cms/`** — giao diện quản trị; form create/edit gộp partial `*_form.blade.php` theo từng resource
- `config/cors.php`, `config/database.php`, `config/services.php`, `config/filesystems.php`, `config/queue.php`, **`config/tts.php`**, **`config/scramble.php`**
- `database/migrations/`, `.env.example`

## Biến & cấu hình quan trọng

- `DB_*`, `REDIS_*`, `REDIS_PREFIX` (queue key đồng bộ worker; thường rỗng)
- `WORKER_INTERNAL_TOKEN` — Bearer / `X-Worker-Token` cho `POST /api/internal/tts-complete`
- `CORS_ALLOWED_ORIGINS` — Next + Expo web
- `TTS_SERVICE` (azure\|fpt), `TTS_DEFAULT_VOICE_ID`, `TTS_NARRATOR_CHARACTER_NAME` — `config/tts.php` + `App\Support\TtsConfig` (danh sách voice CMS theo dịch vụ), segment trong payload queue
- `API_VERSION` — version hiển thị trong OpenAPI docs UI (`/docs/api`)

## Lệnh tham chiếu

Xem `backend/README.md`: `composer install`, `php artisan migrate`, `php artisan storage:link`, `php artisan serve` (hoặc Docker ở `README.md` gốc repo). Lệnh **`docker compose exec` / `run`** trong container: mục **«Các lệnh chạy trong container»** cùng file.

## Ghi nhớ vận hành

- Docker Compose: Laravel đọc **`backend/.env`** trên volume; compose inject **`DB_HOST`**, **`REDIS_HOST`**, **`REDIS_CLIENT=predis`** (tránh lỗi `Class "Redis" not found` khi không có extension phpredis), **`WORKER_INTERNAL_TOKEN`** — đừng nhân đôi cả khối biến trong `docker-compose.yml`.
- Docker: `artisan serve` cần **`--no-reload`** để env `DB_*` / `REDIS_*` không bị strip (đã cấu hình trong image).
- Queue Redis list **`story:tts:queue`** (tên key thô, **không** thêm `REDIS_PREFIX` trừ khi worker cũng dùng cùng prefix): payload gồm `chapter_id`, `story_id`, `text` (đã preprocess), `voice_segments`.
- Callback worker: `chapter_id` + `story_id`, `status` `completed` / `failed` (chấp nhận alias `ready` → completed); `audio_path` tương đối trên disk `public` (`Storage::disk('public')`), có chuẩn hóa prefix; `storage:link` chỉ phục vụ URL `/storage/...`.
- API docs tự sinh qua Scramble: UI `GET /docs/api`, JSON `GET /docs/api.json`.
- Story có `genre` chuẩn ở DB/API (`tu-tien`, `huyen-huyen`, `kiem-hiep`, `do-thi`, `khac`) để frontend phân khối thể loại.
- Tham số route `{story}` (API + CMS): **`Story::getRouteKeyName()` = `slug`**; `AppServiceProvider` đăng ký `Route::bind('story', …)` — segment **toàn chữ số** → tìm theo `id`, ngược lại → theo `slug` (giữ tương thích URL cũ dùng id).
- **CMS:** đăng nhập `GET /admin/login` (tên route `cms.login`). Người dùng cần `is_admin = true` (middleware `cms.admin`). Sau `php artisan db:seed`: `admin@example.com` / `password` — đổi ngay trên môi trường thật. CRUD truyện, chương (kèm nút xếp hàng TTS), nhân vật, lexicon. Form tạo/sửa chương (`chapters/_form`) hiển thị **đếm ký tự nội dung** (cập nhật khi gõ).
