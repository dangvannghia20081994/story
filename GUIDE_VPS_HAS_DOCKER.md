# Triển khai Story trên VPS có Docker

Hướng dẫn cho máy chủ Linux (Ubuntu/Debian) đã cài **Docker Engine** và plugin **Compose V2** (`docker compose`). Toàn bộ stack chạy qua `docker-compose.yml` ở gốc repo.

---

## 1. Chuẩn bị server

```bash
sudo apt update && sudo apt install -y git
```

Cài Docker theo tài liệu chính thức: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Đảm bảo user deploy có quyền `docker` (nhóm `docker`) hoặc dùng `sudo docker compose …` khi cần.

---

## 2. Lấy code và file môi trường

```bash
cd /opt   # hoặc thư mục bạn chọn
sudo git clone <URL-repo> story && sudo chown -R "$USER:$USER" story
cd story

cp backend/.env.example backend/.env
cp worker/.env.example worker/.env
cp compose.env.example .env
```

- **`backend/.env`:** `APP_URL` (URL công khai của API, ví dụ `https://api.example.com`), `APP_DEBUG=false`, mật khẩu DB mạnh nếu đổi so với compose mặc định, `CORS_ALLOWED_ORIGINS` (domain frontend), `WORKER_INTERNAL_TOKEN` (chuỗi bí mật dài).
- **`.env` (cạnh `docker-compose.yml`):** `WORKER_INTERNAL_TOKEN` **cùng giá trị** với `WORKER_INTERNAL_TOKEN` trong `backend/.env` (Compose inject vào backend + worker).
- **`worker/.env`:** `TTS_PROVIDER`, `FPT_API_KEY` (nếu dùng FPT), v.v. — Compose vẫn ghi đè `REDIS_URL`, `BACKEND_URL`, `WORKER_TOKEN`; xem `worker/README.md`.

Sinh khóa ứng dụng Laravel (một lần):

```bash
docker compose run --rm backend php artisan key:generate
```

---

## 3. Mở cổng và firewall

Compose mặc định publish:

| Cổng | Dịch vụ |
|------|---------|
| 8000 | API |
| 3000 | Next.js |
| 8080 | Worker (FastAPI `/health`) |
| 8090 | Expo web (nếu chạy) |
| 5432 | PostgreSQL |
| 6379 | Redis |

**Bảo mật:** trên VPS production, **không nên** mở `5432` / `6379` ra internet trừ khi có lý do đặc biệt và ACL chặt. Có thể chỉnh `docker-compose.yml` bỏ `ports` của `db` / `redis`, chỉ để các service khác truy cập qua mạng nội bộ Docker; API/Next dùng Nginx reverse proxy vào `localhost:8000` / `localhost:3000` (bỏ publish trực tiếp nếu muốn).

Ví dụ `ufw` (chỉ minh họa):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

HTTPS thường do **Caddy** / **Nginx** / **Traefik** đứng trước, trỏ proxy vào container.

---

## 4. Chạy và migrate lần đầu

```bash
docker compose up -d --build
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed
```

Xem log:

```bash
docker compose logs -f backend
docker compose logs -f worker
```

---

## 5. Domain, HTTPS và biến frontend

- Trình duyệt user gọi API qua domain công khai → trong **`docker-compose.yml`** (service `frontend`) cần chỉnh **`NEXT_PUBLIC_API_URL`** (và nếu SSR dùng `API_URL` nội bộ giữa container) cho khớp URL API thật, rồi `docker compose up -d --build frontend`.
- **`CORS_ALLOWED_ORIGINS`** trong `backend/.env` phải chứa URL frontend (ví dụ `https://story.example.com`).

Chi tiết image và env: [docker/README.md](docker/README.md), [README.md](README.md).

---

## 6. Checklist production

- [ ] `APP_DEBUG=false`, `APP_KEY` đã có
- [ ] Đổi mật khẩu user seed (`admin@example.com`, …) — xem `backend/README.md`
- [ ] `WORKER_INTERNAL_TOKEN` / `WORKER_TOKEN` khớp; worker chạy và nhận queue Redis
- [ ] Backup volume Postgres (`pgdata` trong compose) hoặc dump định kỳ
- [ ] Giới hạn expose DB/Redis; HTTPS cho API và web
