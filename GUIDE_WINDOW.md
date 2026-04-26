# Chạy project Story trên Windows (không Docker)

Hướng dẫn cài **PostgreSQL**, **Redis**, **PHP ≥ 8.4**, **Composer**, **Node.js 20+**, **Python 3.12+** và **ffmpeg** trên Windows, rồi chạy Laravel, Next.js và worker Python thủ công. (Stack Docker xem [README.md](README.md) hoặc [GUIDE_VPS_HAS_DOCKER.md](GUIDE_VPS_HAS_DOCKER.md).)

Monorepo: `backend/` (Laravel), `frontend/` (Next.js), `worker/` (TTS), tùy chọn `app/` (Expo).

---

## 1. Cài phụ thuộc hệ thống

| Thành phần | Gợi ý trên Windows |
|-------------|---------------------|
| **PostgreSQL** | [Installer chính thức](https://www.postgresql.org/download/windows/) — nhớ cổng (mặc định 5432) và mật khẩu user `postgres` hoặc user riêng. |
| **Redis** | [Memurai](https://www.memurai.com/) (tương thích Redis), hoặc Redis qua **WSL2**, hoặc bản port Windows khác — worker + Laravel cần Redis chạy tại `127.0.0.1:6379`. |
| **PHP 8.4 + Composer** | [windows.php.net](https://windows.php.net/download/) (Thread Safe ZIP) + bật extension `pgsql`, `openssl`, `curl`, `mbstring`, `zip`, `bcmath` trong `php.ini`; [Composer](https://getcomposer.org/download/). Hoặc dùng **Laragon** / **XAMPP** nếu đủ PHP 8.4. |
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) LTS. |
| **Python 3.12+** | [python.org](https://www.python.org/downloads/windows/) — khi cài, chọn **Add python.exe to PATH**. |
| **ffmpeg** | [ffmpeg.org](https://ffmpeg.org/download.html) (build Windows) — thêm thư mục chứa `ffmpeg.exe` vào **PATH** (worker cần cho TTS). |

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
- `REDIS_*` (`REDIS_HOST=127.0.0.1`, …). Nếu chưa cài extension **phpredis**, đặt `REDIS_CLIENT=predis` (mặc định trong `.env.example` của project).
- `WORKER_INTERNAL_TOKEN` — chuỗi bí mật; ghi lại để dùng cho worker.
- `APP_URL=http://127.0.0.1:8000` (hoặc URL bạn dùng).
- `CORS_ALLOWED_ORIGINS` — thêm `http://localhost:3000` (và cổng khác nếu Next chạy khác).

```bash
composer install
php artisan migrate
php artisan db:seed
php artisan storage:link --force --relative
php artisan serve
```

Giữ terminal này mở. API: http://127.0.0.1:8000 — docs: http://127.0.0.1:8000/docs/api

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
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

```bash
npm run dev
```

Mở http://localhost:3000

---

## 4. Worker (Python / TTS)

Terminal mới:

```bash
cd worker
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Sửa `worker\.env`:

- `REDIS_URL=redis://127.0.0.1:6379/0`
- `QUEUE_NAME=story:tts:queue`
- `BACKEND_URL=http://127.0.0.1:8000` (trùng host/port với `php artisan serve`)
- `WORKER_TOKEN` — **cùng giá trị** với `WORKER_INTERNAL_TOKEN` trong `backend\.env`
- `TTS_PROVIDER=ffmpeg` hoặc `fpt` + `FPT_API_KEY` nếu dùng FPT

```bash
uvicorn app.main:app --reload --port 8080
```

Kiểm tra: http://127.0.0.1:8080/health

---

## 5. Expo (`app/`) — tùy chọn

Xem `app/README.md`.

---

## 6. Gợi ý thêm

- **WSL2 (Ubuntu):** Postgres/Redis + symlink đôi khi đơn giản hơn so với Windows thuần; có thể clone repo trong WSL và làm tương tự [GUIDE_VPS_NO_DOCKER.md](GUIDE_VPS_NO_DOCKER.md) (lệnh `bash`).
- **Firewall:** cho phép cổng khi Windows hỏi lần đầu chạy PHP/Node/Python.

Chi tiết API, queue TTS, biến env: `backend/README.md`, `worker/README.md`, [README.md](README.md).
