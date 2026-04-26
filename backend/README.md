# Backend (Laravel 12)

API quản lý **truyện (danh mục)**, **chương** (nội dung + trạng thái audio), **nhân vật** (CMS — chỉ tên), **lexicon Tu Tiên** (tiền xử lý văn bản). File MP3 (nếu có) lưu qua **Storage** disk `public`; đọc trên web/app dùng **giọng đọc trên client** (Web Speech API / `expo-speech`).

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
php artisan db:seed
php artisan storage:link --force
php artisan scramble:export
php artisan serve
```

Biến quan trọng trong **`.env` / `.env.example`**: `DB_*`, `REDIS_*`, `REDIS_PREFIX` (thường rỗng), `CORS_ALLOWED_ORIGINS`, `API_VERSION`, `APP_URL`, `FRONTEND_URL`.

Migration **`2026_04_27_100000_drop_tts_related_columns`** (nếu chưa chạy): xoá cột `voice_id`, `pitch`, `rate` trên bảng `characters` và `status`, `error_message` trên `chapters` (DB cũ từ worker/TTS).

**`php artisan storage:link` lỗi hoặc symlink hỏng:** dùng **`--force --relative`** để tạo lại link tương đối (`public/storage` → `storage/app/public`), tránh link tuyệt đối kiểu `/var/www/html/...` sau khi chạy trong Docker (trên host symlink đó không tồn tại). Nếu báo *link already exists* mà `public/storage` là **thư mục** (không phải symlink), xóa thư mục đó rồi chạy lại lệnh (không commit `public/storage`). Trên Windows, symlink đôi khi cần quyền Administrator hoặc Developer Mode.

## CMS (quản trị dữ liệu)

Giao diện web trong Laravel (Blade + session), **không** dùng Filament. Quản lý truyện, chương, nhân vật, lexicon.

| URL | Mô tả |
|-----|--------|
| `http://localhost:8000/admin/login` | Đăng nhập CMS |
| `http://localhost:8000/admin` | Bảng điều khiển (sau khi đăng nhập) |
| `http://localhost:8000/login` | Chuyển hướng tới `/admin/login` (alias cho trang welcome) |

**Quyền:** cột `users.is_admin` (migration `2026_04_26_120000_add_is_admin_to_users_table`). Middleware `cms.admin` chặn user thường.

**Tài khoản dev sau seed:** `php artisan db:seed` tạo/cập nhật `admin@example.com` (mật khẩu `password`, `is_admin = true`) và `test@example.com` (cùng mật khẩu mặc định, không vào được CMS). **Đổi mật khẩu trước khi deploy.**

Docker: `docker compose exec backend php artisan migrate` rồi `docker compose exec backend php artisan db:seed` (lần đầu hoặc sau khi xóa volume DB).

Code: `app/Http/Controllers/Cms/`, `app/Http/Requests/Cms/` (validate form CMS), `resources/views/cms/` (mỗi resource: `create` / `edit` gọi chung partial `*_form.blade.php`), `routes/web.php`, `app/Http/Middleware/EnsureCmsAdmin.php`. Nhãn thể loại truyện: `Story::GENRE_LABELS` / `Story::genreLabel()` (slug DB giữ nguyên, UI hiển thị tiếng Việt).

## Cấu hình trong code (`config/`)

| File | Nội dung |
|------|-----------|
| `config/database.php` | Kết nối DB |
| `config/queue.php` / Redis | Queue (Redis) |
| `config/filesystems.php` | Disk `public` / Storage |
| `config/cors.php` | `CORS_ALLOWED_ORIGINS`, đường `api/*` |
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
| GET/POST/PATCH/DELETE | `/api/stories` … | CRUD truyện; `GET/PATCH/DELETE /api/stories/{story}` dùng **slug** (khuyến nghị) hoặc **id** số; `POST/PATCH` hỗ trợ thêm `genre?` (`tu-tien` \| `huyen-huyen` \| `kiem-hiep` \| `do-thi` \| `khac`), cùng `title`, `slug?`, `description?`, `first_chapter?` `{ title, content }` |
| GET/POST/PATCH/DELETE | `/api/stories/{story}/chapters` … | CRUD chương; `{story}` = **slug** truyện (URL thân thiện) hoặc **id** số (tương thích cũ) |
| GET/POST/PATCH/DELETE | `/api/stories/{story}/characters` … | CRUD nhân vật (body: `name`; API JSON không trả cột giọng legacy) |
| GET/POST/PATCH/DELETE | `/api/lexicons` … | CRUD lexicon (`type`: `pronunciation` \| `name` \| `filter`, `priority`) |

**Docker — file audio ở đâu:** với `docker-compose.yml` hiện tại, `./backend` được mount vào container nên MP3 (nếu bạn tự đặt qua Storage) nằm tại **`backend/storage/app/public/stories/{story_id}/chapters/{chapter_id}/audio.mp3`**. **`php artisan storage:link`**: cho URL `/storage/...`.

## Docker

Từ gốc repo: tạo **`backend/.env`** từ `.env.example`, chạy `php artisan key:generate` nếu chưa có `APP_KEY`, rồi `docker compose up` — xem `../README.md`.

Compose **không** nhân đôi toàn bộ biến Laravel: container đọc `backend/.env` trên volume; `docker-compose.yml` ghi đè **`DB_HOST=db`**, **`REDIS_HOST=redis`**, **`REDIS_CLIENT=predis`** (image PHP không cài extension `phpredis`; dùng package `predis/predis`).

Chạy **ngoài Docker** mà không cài extension Redis: trong `.env` đặt **`REDIS_CLIENT=predis`** (mặc định trong `config/database.php` và `.env.example`).

`php artisan serve` trong image dùng `--no-reload` để env DB/Redis không bị strip.

## Các lệnh chạy trong container

Chạy từ **gốc repo** (cùng thư mục với `docker-compose.yml`). Cần service **`backend`** (và thường cả **`db`**, **`redis`**) đang chạy — ví dụ `docker compose up -d db redis backend`.

| Mục đích | Lệnh |
|----------|------|
| Artisan (migrate, route:list, …) | `docker compose exec backend php artisan migrate` |
| Seed (admin CMS + user test) | `docker compose exec backend php artisan db:seed` |
| Tạo `APP_KEY` lần đầu | `docker compose exec backend php artisan key:generate` |
| Composer | `docker compose exec backend composer install` |
| Export OpenAPI file tĩnh | `docker compose exec backend php artisan scramble:export` |
| Shell trong container | `docker compose exec backend sh` |

Một lần chạy **container mới** (không cần service `backend` đang listen), vẫn kèm DB/Redis theo `depends_on`:

`docker compose run --rm backend php artisan key:generate`

## Ghi chú schema

- Bảng `dictionary_entries` (cũ) có thể còn trong DB nhưng **không còn route API**; dùng `lexicons` theo ROADMAP.
