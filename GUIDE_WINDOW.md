# Chạy project Story trên Windows (không Docker)

Cài **PostgreSQL**, **Redis**, **PHP ≥ 8.4**, **Composer**, **Node.js 20+**, rồi chạy Laravel + Next.js thủ công. Stack Docker: [README.md](README.md) hoặc [GUIDE_VPS_HAS_DOCKER.md](GUIDE_VPS_HAS_DOCKER.md). VPS không Docker: [GUIDE_VPS_NO_DOCKER.md](GUIDE_VPS_NO_DOCKER.md).

Monorepo: **`backend/`** (Laravel API + CMS), **`frontend/`** (Next.js), tuỳ chọn **`app/`** (Expo), tuỳ chọn **`worker-crawler/`**, **`worker-tts/`**.

---

## Tổng quan module

| Module         | Thư mục           | Chạy trên Windows                                  |
|----------------|-------------------|----------------------------------------------------|
| **API + CMS**  | `backend/`        | `php artisan serve` hoặc IIS/Apache + PHP          |
| **Web**        | `frontend/`       | `npm run dev`                                      |
| **Expo**       | `app/`            | `npx expo` — xem `app/README.md`                   |
| **Crawler**    | `worker-crawler/` | `python worker.py` (Playwright + venv khuyến nghị) |
| **Worker TTS** | `worker-tts/`     | `python worker_redis.py` trong **venv**            |

---

## 1. Phụ thuộc hệ thống

| Thành phần             | Gợi ý                                                                                                                                                                                                               |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **PostgreSQL**         | [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) — cổng 5432, user/mật khẩu.                                                                                                         |
| **Redis**              | [Memurai](https://www.memurai.com/), hoặc Redis trên **WSL2**, hoặc port Windows — `localhost:6379`.                                                                                                                |
| **PHP 8.4 + Composer** | [windows.php.net](https://windows.php.net/download/) — bật `pgsql`, `openssl`, `curl`, `mbstring`, `zip`, `bcmath` trong `php.ini`; [Composer](https://getcomposer.org/download/). Hoặc **Laragon** nếu đủ PHP 8.4. |
| **Node.js 20+**        | [nodejs.org](https://nodejs.org/) LTS.                                                                                                                                                                              |

---

## 2. Backend (Laravel)

```bash
cd backend
copy .env.example .env
php artisan key:generate
```

`backend\.env`:

- `DB_*`, `REDIS_*` (`REDIS_HOST=127.0.0.1`), `REDIS_CLIENT=predis` nếu không có `phpredis`.
- `APP_URL=http://localhost:8000`
- `CORS_ALLOWED_ORIGINS` — gồm `http://localhost:3000`
- **`CRAWLER_INTERNAL_TOKEN`**, **`CRAWLER_REDIS_QUEUE`**
- **`WORKER_TTS_INTERNAL_TOKEN`**, **`WORKER_TTS_REDIS_QUEUE`**

Sinh token (PowerShell từ `backend/`):

```bash
php artisan crawler:internal-token
php artisan worker-tts:internal-token
```

```bash
composer install
php artisan migrate
php artisan db:seed
php artisan storage:link --force
php artisan serve
```

- API: http://localhost:8000  
- Scramble: http://localhost:8000/docs/api  
- CMS: http://localhost:8000/admin/login  

**Symlink `public/storage`:** lỗi thì xem `backend/README.md` (Developer Mode hoặc terminal **Run as administrator**).

---

## 3. Frontend (Next.js)

```bash
cd frontend
npm install
```

`frontend\.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

→ http://localhost:3000

---

## 4. Expo (`app/`)

Xem `app/README.md`.

---

## 5. Crawler (Python + Playwright)

CMS **`/admin/crawler-jobs`** → Redis `crawler:queue` → **`worker-crawler/worker.py`** → API `/api/internal/crawler/*` (header **`X-Crawler-Token`**).

**Backend:** `CRAWLER_INTERNAL_TOKEN`, `CRAWLER_REDIS_QUEUE`.

**Worker:**

```bash
cd worker-crawler
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
copy .env.example .env
REM Sửa .env: REDIS_*, CRAWLER_API_BASE_URL=http://127.0.0.1:8000 , CRAWLER_INTERNAL_TOKEN=...
python worker.py
```

`worker.py` nạp **`worker-crawler/.env`** qua dotenv.

**Git Bash — [`run-dev.sh`](run-dev.sh):** `./run-dev.sh` (Redis + backend + frontend). **`./run-dev.sh --with-crawler`** — crawler Python (cần `worker-crawler/.env` + `worker-crawler/.venv`). **`./run-dev.sh --with-worker`** — `worker-tts/worker_redis.py` (VieNeu, cùng Redis list với nút «enqueue TTS» CMS). Có thể gộp cờ. `./run-dev.sh --help`. Tắt crawler / worker TTS: `SKIP_CRAWLER_WORKER=1` / `SKIP_WORKER=1` (alias cũ: `SKIP_WORKER_TTS`, `SKIP_QUEUE_WORKER`).

---

## 6. Worker TTS (Python + VieNeu)

**Không** `pip install` vào Python hệ thống (PEP 668) — dùng **venv**:

```bash
cd worker-tts
python -m venv .venv
.venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
copy .env.example .env
REM WORKER_TTS_INTERNAL_TOKEN=... (trùng backend), BACKEND_API_BASE_URL=http://127.0.0.1:8000,
REM REDIS_HOST=127.0.0.1, REFERENCE_AUDIO_PATH=input.wav (file trong worker-tts; KHÔNG dùng /app/... khi chạy host Windows)
python worker_redis.py
```

**Lưu ý:** `python` phải là interpreter **trong `.venv`** (đã `pip install -r requirements.txt`). Nếu báo `No module named 'vieneu'`: dùng `.venv\Scripts\python worker_redis.py` hoặc double-click **`worker-tts/run_worker_redis.cmd`**.

- **eSpeak NG:** cần cho VieNeu — xem `worker-tts/README.md` (Windows: tải bản portable hoặc WSL).
- **Luồng:** Redis list `WORKER_TTS_REDIS_QUEUE` → tổng hợp giọng → POST `/api/internal/tts/chapters/{id}/audio` (**`X-Worker-Tts-Token`**, field file **`audio`**). CMS «enqueue TTS» chỉ `RPUSH` vào list này — cần `./run-dev.sh --with-worker` hoặc `run_worker_redis.cmd`.

---

## 7. Gợi ý thêm

- **WSL2:** Postgres/Redis + symlink đôi khi dễ hơn Windows thuần; có thể làm giống [GUIDE_VPS_NO_DOCKER.md](GUIDE_VPS_NO_DOCKER.md).
- **Firewall Windows:** cho phép cổng khi hỏi lần đầu.

Chi tiết: `backend/README.md`, [README.md](README.md).
