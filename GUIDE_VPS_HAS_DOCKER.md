# Triển khai Story trên VPS có Docker

Hướng dẫn cho máy chủ Linux (Ubuntu/Debian) đã cài **Docker Engine** và **Compose V2** (`docker compose`). Stack mặc định: `docker-compose.yml` ở gốc repo.

---

## Tổng quan module (monorepo)

| Module            | Thư mục           | Trong Compose                            | Ghi chú ngắn                                                          |
|-------------------|-------------------|------------------------------------------|-----------------------------------------------------------------------|
| **API + CMS**     | `backend/`        | `backend`                                | Laravel 12: REST `/api/*`, Blade CMS `/admin/*`, Scramble `/docs/api` |
| **Web**           | `frontend/`       | `frontend`                               | Next.js, biến `NEXT_PUBLIC_API_URL` / `API_URL`                       |
| **Expo**          | `app/`            | `expo` (tuỳ chọn)                        | `EXPO_PUBLIC_API_URL`                                                 |
| **Reverse proxy** | `docker/nginx/`   | `nginx`                                  | Cổng **80** → frontend + API (xem `docker/nginx/`)                    |
| **DB**            | —                 | `db`                                     | PostgreSQL 16                                                         |
| **Redis**         | —                 | `redis`                                  | Queue crawler, queue TTS, cache Laravel                               |
| **Crawler**       | `worker-crawler/` | `worker-crawler` (**profile `crawler`**) | Playwright; `worker-crawler/.env` + token trùng backend               |
| **Worker TTS**    | `worker-tts/`     | `worker-tts` (**profile `worker-tts`**)  | Revid TTS API + Redis BLPOP + upload API nội bộ                       |

Chi tiết image: [docker/README.md](docker/README.md). Chi tiết API/CMS: [backend/README.md](backend/README.md).

---

## 1. Chuẩn bị server

```bash
sudo apt update && sudo apt install -y git
```

Cài Docker: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/). User deploy nên thuộc nhóm `docker` (hoặc `sudo docker compose …`).

---

## 2. Lấy code và môi trường

```bash
cd /opt   # hoặc thư mục bạn chọn
sudo git clone <URL-repo> story && sudo chown -R "$USER:$USER" story
cd story

cp backend/.env.example backend/.env
# Tuỳ chọn: cp compose.env.example .env
```

**`backend/.env` (tối thiểu production):**

- `APP_URL`, `APP_DEBUG=false`, `APP_KEY` (sinh bên dưới)
- `DB_*` — nếu đổi user/mật khẩu Postgres so với compose mặc định, sửa cho khớp `docker-compose.yml` service `db`
- `CORS_ALLOWED_ORIGINS` — URL frontend thật (ví dụ `https://story.example.com`)
- **Crawler:** `CRAWLER_INTERNAL_TOKEN`, `CRAWLER_REDIS_QUEUE` (mặc định `crawler:queue`) — sinh token: `docker compose exec backend php artisan crawler:internal-token`
- **Worker TTS:** `WORKER_TTS_INTERNAL_TOKEN`, `WORKER_TTS_REDIS_QUEUE` (mặc định `story:tts:queue`), tuỳ chọn `WORKER_TTS_MAX_AUDIO_UPLOAD_KB` — sinh token: `php artisan worker-tts:internal-token`

```bash
docker compose run --rm backend php artisan key:generate
```

---

## 3. Cổng, firewall, Nginx

Compose **publish** (mặc định):

| Cổng   | Dịch vụ                                                            |
|--------|--------------------------------------------------------------------|
| **80** | **nginx** → proxy tới Next + API (xem `docker/nginx/default.conf`) |
| 8000   | Laravel `artisan serve` (API trực tiếp, debug)                     |
| 3000   | Next.js                                                            |
| 8090   | Expo web (nếu bật service)                                         |
| 5432   | PostgreSQL                                                         |
| 6379   | Redis                                                              |

**Production:** không nên mở **5432** / **6379** ra internet; có thể bỏ `ports` của `db` / `redis` trong compose nếu chỉ container nội bộ cần. User chỉ vào **80/443** qua Nginx.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 4. Chạy stack lõi và migrate

```bash
docker compose up -d --build
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed
docker compose exec backend php artisan storage:link --force
```

OpenAPI tĩnh (tuỳ chọn): `docker compose exec backend php artisan scramble:export`

**Log API:** `docker compose logs -f backend` — log Laravel: `backend/storage/logs/laravel.log` (trong volume).

---

## 5. Domain, HTTPS, biến frontend

- **`docker-compose.yml`** service `frontend`: chỉnh **`NEXT_PUBLIC_API_URL`** (URL mà trình duyệt gọi API, thường qua Nginx `/api` hoặc subdomain API) và **`API_URL`** (SSR: URL nội bộ tới `http://backend:8000`), rồi `docker compose up -d --build frontend`.
- **`backend/.env`:** `CORS_ALLOWED_ORIGINS` chứa URL frontend.
- **`FRONTEND_URL`** / `APP_URL`: khớp domain public nếu dùng link tuyệt đối trong email/CMS.

---

## 6. Crawler (Python)

**Cách A — Docker (khuyến nghị trên VPS có đủ RAM cho Chromium):**

```bash
cp worker-crawler/.env.example worker-crawler/.env
# Điền CRAWLER_INTERNAL_TOKEN (trùng backend), REDIS_HOST=redis không cần nếu compose đã set, CRAWLER_API_BASE_URL=http://backend:8000
docker compose --profile crawler up -d --build
docker compose logs -f worker-crawler
```

**Cách B — Chạy worker trên host** (Redis publish 6379): cài Python + Playwright trên host, `worker-crawler/.env` với `REDIS_HOST=127.0.0.1`, `CRAWLER_API_BASE_URL` trỏ tới API (port 8000 hoặc qua Nginx).

CMS tạo job: **`/admin/crawler-jobs`**. Luồng: Redis list `CRAWLER_REDIS_QUEUE` → worker → `GET/PATCH/POST /api/internal/crawler/*` (header **`X-Crawler-Token`**).

---

## 7. Worker TTS (Revid + Redis)

**Bật service (profile):**

1. `cp worker-tts/.env.example worker-tts/.env` — **`WORKER_TTS_INTERNAL_TOKEN`** trùng **`backend/.env`**, `BACKEND_API_BASE_URL` (trong compose mặc định `http://backend:8000`), `REDIS_*`, `WORKER_TTS_REDIS_QUEUE` trùng backend.
2. *(Tuỳ chọn)* Thêm `REVID_API_KEY=sk_...` nếu muốn override key mặc định.
3. `docker compose --profile worker-tts up -d --build`
4. `docker compose logs -f worker-tts`

**Luồng:** CMS **RPUSH** JSON `{"chapter_id", "mode": "single", "text", "voice_id"}` lên list Redis → `worker-tts/worker_redis.py` **BLPOP** → chunking → Revid TTS API (base64 MP3) → ffmpeg concat → **POST** `/api/internal/tts/chapters/{id}/audio` (multipart field **`audio`**, header **`X-Worker-Tts-Token`**, `type=single`). Backend lưu `storage/app` và cập nhật `chapters.audio_single_path`.

**Gỡ lỗi upload:** xem log prefix `worker_tts.upload.*` trong `laravel.log`; PHP `upload_max_filesize` / `post_max_size` trong image (xem `backend/README.md` nếu chỉnh).

---

## 8. CMS và tài liệu API

| URL              | Mô tả                                                       |
|------------------|-------------------------------------------------------------|
| `/admin/login`   | Đăng nhập CMS (`admin@example.com` sau seed — đổi mật khẩu) |
| `/admin`         | Dashboard                                                   |
| `/docs/api`      | Scramble UI                                                 |
| `/docs/api.json` | OpenAPI JSON                                                |

User thường chỉ cần Nginx cổng 80/443; API có thể chỉ lộ qua `/api` trên cùng domain frontend.

---

## 9. Checklist production

- [ ] `APP_DEBUG=false`, `APP_KEY` đã có
- [ ] `CRAWLER_INTERNAL_TOKEN` + `WORKER_TTS_INTERNAL_TOKEN` đã đặt và trùng file `.env` worker tương ứng
- [ ] `CORS_ALLOWED_ORIGINS` + `NEXT_PUBLIC_API_URL` đúng domain
- [ ] `php artisan migrate --force`, `storage:link`, đổi mật khẩu seed (`backend/README.md`)
- [ ] Backup volume Postgres (`pgdata`) hoặc dump định kỳ
- [ ] Không expose DB/Redis; HTTPS (Nginx/Caddy) phía trước
- [ ] (Tuỳ chọn) Profile `crawler` (service `worker-crawler`) / `worker-tts` đã bật và log không lỗi

Tham chiếu: [README.md](README.md), [GUIDE_VPS_NO_DOCKER.md](GUIDE_VPS_NO_DOCKER.md), [GUIDE_WINDOW.md](GUIDE_WINDOW.md).
