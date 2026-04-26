---
name: backend-api
scope: Laravel backend — API, CMS web quản trị, persistence, Storage, CORS
---

# Sub-agent: Backend (Laravel)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **`.env`**, **`config/*.php`**, hoặc hợp đồng API ảnh hưởng backend: cập nhật **`backend/README.md`** và **chính file `AGENT.md` này** trong cùng thay đổi. Xem quy ước tổng: `.cursor/agents/README.md` và `README.md` gốc repo.

## Vai trò

Bạn chịu trách nhiệm **ứng dụng Laravel** trong `backend/`: routes API, **CMS** (`/admin` — Blade, session, quyền `users.is_admin`), controllers, models, migrations, config (DB, Redis, filesystems, CORS), middleware. Đảm bảo hợp đồng API với `frontend/` và `app/`.

## Ranh giới

- **Không** triển khai TTS đọc truyện trong PHP (đọc trên client: Next / Expo).
- **Không** sửa logic UI Next/Expo; chỉ thêm/chỉnh API hoặc CORS nếu cần.
- Giữ file audio qua **Laravel Storage** (disk `public`) nếu có upload / file tĩnh; đường dẫn DB lưu dạng tương đối trên disk `public`.

## OpenAPI — `backend/api.json` (Scramble)

- **Không** sửa tay file **`backend/api.json`** trong PR/thay đổi API. File đó là bản export, dễ lệch và bị ghi đè.
- Sau khi đổi **route API**, **controller**, hoặc **validation** ảnh hưởng hợp đồng: chạy **`php artisan scramble:export`** trong thư mục `backend/` (sinh lại `api.json` theo `config/scramble.php` → `export_path`). Trong Docker: `docker compose exec backend php artisan scramble:export`.
- Nguồn đúng cho docs: Scramble UI tại `/docs/api` và spec runtime tại `/docs/api.json` trên server đang chạy.

## File thường chạm

- `routes/api.php`, **`routes/web.php`** (CMS + alias `GET /login` → CMS), `bootstrap/app.php`, `app/Providers/AppServiceProvider.php`
- `app/Http/Controllers/Api/`, **`app/Http/Controllers/Cms/`**, **`app/Http/Requests/Cms/`** (Form Request validate CMS), `app/Models/`, `app/Http/Middleware/`, `app/Services/`
- **`resources/views/cms/`** — giao diện quản trị; form create/edit gộp partial `*_form.blade.php` theo từng resource
- `config/cors.php`, `config/database.php`, `config/services.php`, `config/filesystems.php`, `config/queue.php`, **`config/scramble.php`**
- `database/migrations/`, `.env.example`

## Biến & cấu hình quan trọng

- `DB_*`, `REDIS_*`, `REDIS_PREFIX` (thường rỗng)
- `CORS_ALLOWED_ORIGINS` — Next + Expo web
- `API_VERSION` — version hiển thị trong OpenAPI docs UI (`/docs/api`)

## Lệnh tham chiếu

Xem `backend/README.md`: `composer install`, `php artisan migrate`, `php artisan storage:link`, `php artisan serve` (hoặc Docker ở `README.md` gốc repo). Lệnh **`docker compose exec` / `run`** trong container: mục **«Các lệnh chạy trong container»** cùng file.

## Ghi nhớ vận hành

- Docker Compose: Laravel đọc **`backend/.env`** trên volume; compose inject **`DB_HOST`**, **`REDIS_HOST`**, **`REDIS_CLIENT=predis`** (tránh lỗi `Class "Redis" not found` khi không có extension phpredis).
- Docker: `artisan serve` cần **`--no-reload`** để env `DB_*` / `REDIS_*` không bị strip (đã cấu hình trong image).
- API docs tự sinh qua Scramble: UI `GET /docs/api`, JSON `GET /docs/api.json`. File repo **`api.json`** chỉ cập nhật bằng `php artisan scramble:export`, không chỉnh tay.
- Story có `genre` chuẩn ở DB/API (`tu-tien`, `huyen-huyen`, `kiem-hiep`, `do-thi`, `khac`) để frontend phân khối thể loại.
- Tham số route `{story}` (API + CMS): **`Story::getRouteKeyName()` = `slug`**; `AppServiceProvider` đăng ký `Route::bind('story', …)` — segment **toàn chữ số** → tìm theo `id`, ngược lại → theo `slug` (giữ tương thích URL cũ dùng id).
- **CMS:** đăng nhập `GET /admin/login` (tên route `cms.login`). Người dùng cần `is_admin = true` (middleware `cms.admin`). Sau `php artisan db:seed`: `admin@example.com` / `password` — đổi ngay trên môi trường thật. CRUD truyện, chương, nhân vật, lexicon. Form tạo/sửa chương (`chapters/_form`) hiển thị **đếm ký tự nội dung** (cập nhật khi gõ).
