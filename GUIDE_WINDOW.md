# Chạy project Story trên Windows (không Docker)

Hướng dẫn cài **PostgreSQL**, **Redis**, **PHP ≥ 8.4**, **Composer**, **Node.js 20+** trên Windows, rồi chạy Laravel và Next.js thủ công. (Stack Docker xem [README.md](README.md) hoặc [GUIDE_VPS_HAS_DOCKER.md](GUIDE_VPS_HAS_DOCKER.md).)

Monorepo: `backend/` (Laravel), `frontend/` (Next.js), tùy chọn `app/` (Expo).

---

## 1. Cài phụ thuộc hệ thống

| Thành phần | Gợi ý trên Windows |
|-------------|---------------------|
| **PostgreSQL** | [Installer chính thức](https://www.postgresql.org/download/windows/) — nhớ cổng (mặc định 5432) và mật khẩu user `postgres` hoặc user riêng. |
| **Redis** | [Memurai](https://www.memurai.com/) (tương thích Redis), hoặc Redis qua **WSL2**, hoặc bản port Windows khác — Laravel dùng Redis tại `localhost:6379` (queue/cache nếu bật). |
| **PHP 8.4 + Composer** | [windows.php.net](https://windows.php.net/download/) (Thread Safe ZIP) + bật extension `pgsql`, `openssl`, `curl`, `mbstring`, `zip`, `bcmath` trong `php.ini`; [Composer](https://getcomposer.org/download/). Hoặc dùng **Laragon** / **XAMPP** nếu đủ PHP 8.4. |
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) LTS. |

---

## 2. Backend (Laravel)

PowerShell hoặc cmd, từ thư mục repo:

```bash
cd backend
copy .env.example .env
php artisan key:generate
```

Sửa `backend\.env`:

- `DB_*` trỏ tới PostgreSQL local.
- `REDIS_*` (`REDIS_HOST=localhost`, …). Nếu chưa cài extension **phpredis**, đặt `REDIS_CLIENT=predis` (mặc định trong `.env.example` của project).
- `APP_URL=http://localhost:8000` (hoặc URL bạn dùng).
- `CORS_ALLOWED_ORIGINS` — thêm `http://localhost:3000` (và cổng khác nếu Next chạy khác).

```bash
composer install
php artisan migrate
php artisan db:seed
php artisan storage:link --force
php artisan serve
```

Giữ terminal này mở. API: http://localhost:8000 — docs: http://localhost:8000/docs/api

**Symlink `public/storage`:** nếu `storage:link` lỗi, xem `backend/README.md` (bật **Developer Mode** hoặc chạy terminal **Run as administrator**).

---

## 3. Frontend (Next.js)

Terminal mới:

```bash
cd frontend
npm install
```

Tạo file `frontend\.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Mở http://localhost:3000

---

## 4. Expo (`app/`) — tùy chọn

Xem `app/README.md`.

---

## 5. Crawler (Python + Playwright)

CMS tạo job tại **`/admin/crawler-jobs`**: lưu bảng `crawler_jobs`, đẩy `{"crawler_job_id": …}` lên Redis (list mặc định `crawler:queue`). Worker **`crawler/worker.py`** lấy job, crawl bằng Playwright, gọi API nội bộ `GET/PATCH/POST /api/internal/crawler/...` (header **`X-Crawler-Token`**).

**Backend** (`backend/.env`): đặt **`CRAWLER_INTERNAL_TOKEN`** (chuỗi bí mật, trùng với worker) và tuỳ chọn **`CRAWLER_REDIS_QUEUE`**. **`QUEUE_CONNECTION=redis`** đã phù hợp để Laravel dùng Redis; worker chỉ cần cùng host/cổng Redis.

**Worker** (`crawler/`):

```bash
cd crawler
pip install -r requirements.txt
playwright install chromium
copy .env.example .env
# Sửa .env: REDIS_* , CRAWLER_API_BASE_URL=http://localhost:8000 , CRAWLER_INTERNAL_TOKEN=...
python worker.py
```

`worker.py` tự gọi **`load_dotenv(crawler/.env)`** — biến đọc từ file `.env` cạnh script (không cần export tay).

**Một lệnh dev (Git Bash):** từ gốc repo, [`run-dev.sh`](run-dev.sh) khởi Redis (nếu có `redis/redis-server.exe`), backend, frontend. **Crawler worker** chỉ chạy khi thêm **`./run-dev.sh --with-crawler`** và có **`crawler/.env`** + **`crawler/.venv`** (dùng `crawler/.venv/.../python` để tránh thiếu `playwright` trên Python global). `./run-dev.sh --help` xem gợi ý. Tắt worker dù có `--with-crawler`: `SKIP_CRAWLER_WORKER=1 ./run-dev.sh --with-crawler`.

---

## 6. Gợi ý thêm

- **WSL2 (Ubuntu):** Postgres/Redis + symlink đôi khi đơn giản hơn so với Windows thuần; có thể clone repo trong WSL và làm tương tự [GUIDE_VPS_NO_DOCKER.md](GUIDE_VPS_NO_DOCKER.md) (lệnh `bash`).
- **Firewall:** cho phép cổng khi Windows hỏi lần đầu chạy PHP/Node.

Chi tiết API và biến env: `backend/README.md`, [README.md](README.md).
