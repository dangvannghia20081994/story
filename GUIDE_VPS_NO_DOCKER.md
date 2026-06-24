# Chạy Story trên VPS không Docker

Cài từng thành phần trên **một máy Linux** (Ubuntu 22.04/24.04 LTS): PostgreSQL, Redis, PHP 8.4 + Composer, Nginx (+ PHP-FPM), Node.js 20+. Phù hợp khi không dùng Docker hoặc chỉ một phần stack container.

Luồng gợi ý: **Nginx** → PHP-FPM (Laravel `public/`); **Next.js** `npm run start` hoặc PM2 sau `npm run build`, Nginx `proxy_pass`.

---

## Tổng quan module

| Module         | Thư mục           | Chạy như                                          |
|----------------|-------------------|---------------------------------------------------|
| **API + CMS**  | `backend/`        | PHP-FPM + Nginx `root` → `backend/public`         |
| **Web**        | `frontend/`       | Node (`npm run build` + `npm run start` hoặc PM2) |
| **Expo**       | `app/`            | Tuỳ chọn — xem `app/README.md`                    |
| **Crawler**    | `worker-crawler/` | Python + Playwright, process nền (systemd)        |
| **Worker TTS** | `worker-tts/`     | Python venv, `worker_redis.py`, process nền       |

Tài liệu chi tiết API/CMS: [backend/README.md](backend/README.md). Docker tương đương: [GUIDE_VPS_HAS_DOCKER.md](GUIDE_VPS_HAS_DOCKER.md).

---

## 1. PostgreSQL và Redis

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server
sudo systemctl enable --now postgresql redis-server
```

```bash
sudo -u postgres psql -c "CREATE USER story WITH PASSWORD 'your-secure-password';"
sudo -u postgres psql -c "CREATE DATABASE story OWNER story;"
```

`backend/.env`: `DB_CONNECTION=pgsql`, `DB_HOST=localhost`, `DB_DATABASE=story`, `DB_USERNAME=story`, `DB_PASSWORD=...`, `REDIS_HOST=localhost`, `REDIS_PREFIX=`, `REDIS_CLIENT=predis` nếu không dùng extension `phpredis`.

---

## 2. PHP 8.4, Composer, Laravel

```bash
sudo apt install -y php8.4-fpm php8.4-cli php8.4-pgsql php8.4-xml php8.4-curl php8.4-mbstring php8.4-zip php8.4-bcmath
# Composer: https://getcomposer.org/download/
```

```bash
sudo mkdir -p /var/www && sudo chown "$USER:$USER" /var/www
cd /var/www
git clone <URL-repo> story && cd story/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

`.env`: `APP_URL`, `APP_ENV=production`, `APP_DEBUG=false`, DB, Redis, `CORS_ALLOWED_ORIGINS`, **`CRAWLER_INTERNAL_TOKEN`**, **`CRAWLER_REDIS_QUEUE`**, **`WORKER_TTS_INTERNAL_TOKEN`**, **`WORKER_TTS_REDIS_QUEUE`**, tuỳ chọn **`WORKER_TTS_MAX_AUDIO_UPLOAD_KB`**.

Sinh token (trong `backend/`):

```bash
php artisan crawler:internal-token
php artisan worker-tts:internal-token
```

```bash
php artisan migrate --force
php artisan db:seed
php artisan storage:link --force --relative
php artisan config:cache
php artisan route:cache
```

**Upload file lớn (TTS WAV, upload audio):** tăng **`client_max_body_size`** (Nginx) và **`upload_max_filesize`** / **`post_max_size`** (pool PHP-FPM) — xem `backend/README.md`.

---

## 3. Nginx + PHP-FPM (Laravel)

Ví dụ (chỉnh `server_name`, `root`, socket PHP):

```nginx
server {
    listen 80;
    server_name api.example.com;
    root /var/www/story/backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

TLS: Let’s Encrypt (`certbot`).

---

## 4. Next.js (frontend)

```bash
cd /var/www/story/frontend
npm install
```

`.env.production`:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

```bash
npm run build
NODE_ENV=production npm run start -- -p 3000
```

Hoặc PM2 / systemd; Nginx `proxy_pass` tới `localhost:3000`.

---

## 5. Expo (`app/`)

Tuỳ chọn — xem `app/README.md`.

---

## 6. Crawler (Python + Playwright)

- **Backend:** `CRAWLER_INTERNAL_TOKEN`, `CRAWLER_REDIS_QUEUE`, `REDIS_*`.
- **Worker:** Python 3.11+; `cd worker-crawler && python3 -m venv .venv && source .venv/bin/activate`, `pip install -r requirements.txt`, `playwright install chromium`, **`worker-crawler/.env`** (`worker-crawler/.env.example`): `REDIS_HOST=127.0.0.1`, `CRAWLER_API_BASE_URL=https://api.example.com`, token trùng backend, queue trùng.
- Chạy: `python worker.py` (systemd: `WorkingDirectory=/var/www/story/worker-crawler`, `ExecStart=.../.venv/bin/python worker.py`).
- **Bảo mật:** route `/api/internal/crawler/*` chỉ cho worker có header **`X-Crawler-Token`**.

CMS: **`/admin/crawler-jobs`**. Chi tiết: `backend/README.md`.

---

## 7. Worker TTS (Python + Revid)

- **Backend:** `WORKER_TTS_INTERNAL_TOKEN`, `WORKER_TTS_REDIS_QUEUE`, cùng Redis với Laravel.
- **Worker:** Python 3.10+, yêu cầu `ffmpeg`; **venv** (tránh PEP 668):

```bash
sudo apt install ffmpeg
cd /var/www/story/worker-tts
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
cp .env.example .env
# WORKER_TTS_INTERNAL_TOKEN=... (trùng backend), BACKEND_API_BASE_URL=https://api.example.com,
# REDIS_HOST=127.0.0.1, WORKER_TTS_REDIS_QUEUE=story:tts:queue
# REVID_API_KEY=sk_... (tuỳ chọn, override key mặc định)
python worker_redis.py
```

- **Luồng:** Redis list (RPUSH từ CMS “đẩy hàng TTS”) → worker BLPOP → Revid TTS API → **POST** `/api/internal/tts/chapters/{id}/audio` (header **`X-Worker-Tts-Token`**, `type=single`).

---

## 8. Kiểm tra

```bash
curl -sS -H "Accept: application/json" https://api.example.com/docs/api.json | head
```

File public: `backend/storage/app/public/` sau `storage:link` → URL `/storage/...`.

Tham chiếu: [README.md](README.md), [backend/README.md](backend/README.md), [GUIDE_WINDOW.md](GUIDE_WINDOW.md).
