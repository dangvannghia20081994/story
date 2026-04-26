# Chạy Story trên VPS không Docker

Cài từng thành phần trên **một máy Linux** (Ubuntu 22.04/24.04 LTS): PostgreSQL, Redis, PHP 8.4 + Composer, web server (Nginx khuyến nghị), Node.js 20+. Phù hợp khi không dùng Docker hoặc chỉ một phần stack chạy container.

Luồng dữ liệu: **Nginx** → PHP-FPM (Laravel) cổng socket; **Next.js** build tĩnh + `npm start` hoặc Node behind Nginx.

---

## 1. PostgreSQL và Redis

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib redis-server
sudo systemctl enable --now postgresql redis-server
```

Tạo user/DB (ví dụ khớp ý nghĩa với `backend/.env.example`):

```bash
sudo -u postgres psql -c "CREATE USER story WITH PASSWORD 'your-secure-password';"
sudo -u postgres psql -c "CREATE DATABASE story OWNER story;"
```

Trong `backend/.env`: `DB_CONNECTION=pgsql`, `DB_HOST=localhost`, `DB_DATABASE=story`, `DB_USERNAME=story`, `DB_PASSWORD=...`, `REDIS_HOST=localhost`, `REDIS_PREFIX=` (thường rỗng), `REDIS_CLIENT=predis` nếu không cài `phpredis`.

---

## 2. PHP 8.4, Composer, extension

Cài PHP và extension Laravel thường dùng (tên gói có thể khác theo bản Ubuntu — tham khảo [Laravel server requirements](https://laravel.com/docs/deployment)):

```bash
sudo apt install -y php8.4-fpm php8.4-cli php8.4-pgsql php8.4-xml php8.4-curl php8.4-mbstring php8.4-zip php8.4-bcmath
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

Triển khai code:

```bash
sudo mkdir -p /var/www && sudo chown "$USER:$USER" /var/www
cd /var/www
git clone <URL-repo> story && cd story/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

Chỉnh `.env`: `APP_URL`, `APP_ENV=production`, `APP_DEBUG=false`, DB, Redis, `CORS_ALLOWED_ORIGINS`.

```bash
php artisan migrate --force
php artisan db:seed   # hoặc bỏ seed trên production nếu không cần
php artisan storage:link --force --relative
php artisan config:cache
php artisan route:cache
```

**Upload MP3 lớn (nếu tự tải file audio):** tăng `upload_max_filesize` / `post_max_size` trong pool PHP-FPM nếu cần (xem `backend/README.md`).

---

## 3. Nginx + PHP-FPM (Laravel)

Ví dụ site API (rút gọn — điều chỉnh `server_name`, đường dẫn, socket PHP):

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

Bật site, reload Nginx, chứng chỉ TLS (Let’s Encrypt) qua `certbot`.

---

## 4. Next.js (frontend)

Trên cùng máy hoặc máy khác:

```bash
cd /var/www/story/frontend
npm ci
```

Tạo `.env.production` (hoặc export trước khi build):

```env
NEXT_PUBLIC_API_URL=https://api.example.com
```

```bash
npm run build
NODE_ENV=production npm run start -- -p 3000
```

Hoặc dùng **systemd** / **PM2** để giữ tiến trình. Nginx `proxy_pass` tới `http://localhost:3000` cho domain frontend.

---

## 5. Expo / mobile (`app/`)

Tùy chọn; development thường trên máy cục bộ. Production web có thể chỉ dùng Next.js — xem `app/README.md`.

---

## 6. Crawler (worker Python)

- **Backend:** trong `backend/.env` đặt **`CRAWLER_INTERNAL_TOKEN`**, **`CRAWLER_REDIS_QUEUE`** (mặc định `crawler:queue`), cùng **`REDIS_*`** trỏ Redis trên máy.
- **Worker:** Python 3.11+ khuyến nghị, thư mục `crawler/`: `pip install -r requirements.txt`, `playwright install chromium`, file **`crawler/.env`** (mẫu `crawler/.env.example`) với `REDIS_HOST=127.0.0.1`, `CRAWLER_API_BASE_URL` (URL API Laravel, ví dụ `https://api.example.com`), **`CRAWLER_INTERNAL_TOKEN`** trùng backend, `CRAWLER_REDIS_QUEUE` trùng backend.
- Chạy nền: **`python crawler/worker.py`** (hoặc **systemd** / **supervisor** một process `WorkingDirectory=/var/www/story/crawler`, `ExecStart=.../venv/bin/python worker.py`).
- **Bảo mật:** không public route `/api/internal/crawler/*`; chỉ worker có token. Tuân thủ robots/ToS site nguồn.

Chi tiết luồng: `backend/README.md` (mục Crawler), CMS `/admin/crawler-jobs`.

---

## 7. Kiểm tra

- API: `curl -sS -H "Accept: application/json" https://api.example.com/docs/api.json | head`
- File audio (nếu có): `backend/storage/app/public/...` — xem `backend/README.md`

Tài liệu tham chiếu: [README.md](README.md), [backend/README.md](backend/README.md).
