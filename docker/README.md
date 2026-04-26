# Docker (image & Compose)

Thư mục này chứa **Dockerfile** dùng chung với `docker-compose.yml` ở **gốc repo** (không phải service độc lập).

## File

| File | Dùng cho |
|------|-----------|
| `frontend.Dockerfile` | Service `frontend` — `context: ./frontend`, `dockerfile: ../docker/frontend.Dockerfile` |
| `expo.Dockerfile` | Service `expo` — `context: ./app`, `dockerfile: ../docker/expo.Dockerfile` |
| `crawler.Dockerfile` | Service `crawler` (profile `crawler`) — `context: ./crawler`, image Playwright + Python |

## Cấu hình qua Compose (gốc repo)

- **Backend:** Laravel đọc **`backend/.env`** (volume mount `./backend:/var/www/html`). File public (MP3, …) nằm trên host tại **`backend/storage/app/public/`** — không dùng named volume che thư mục này để tránh “log báo lưu thành công nhưng không thấy file” trên máy dev.
- **`.env`** ở gốc repo (tùy chọn): xem **`compose.env.example`** nếu cần biến Compose chung.

| Nhóm | Nguồn cấu hình |
|------|----------------|
| Backend | `backend/.env` + override compose (`DB_HOST`, `REDIS_HOST`, `REDIS_CLIENT`, `REDIS_PREFIX`) |
| Frontend | `docker-compose.yml` (`NEXT_PUBLIC_API_URL`, `API_URL`) |
| Expo | `docker-compose.yml` (`EXPO_PUBLIC_API_URL`, …) |
| Crawler (profile **`crawler`**) | `crawler/.env` + override compose (`REDIS_HOST=redis`, `CRAWLER_API_BASE_URL=http://backend:8000`) |

### Crawler (Python / Playwright)

- **Phiên bản:** `crawler/requirements.txt` (`playwright==…`) và `docker/crawler.Dockerfile` (`FROM mcr.microsoft.com/playwright/python:v….-jammy`) phải **cùng bản** (khi nâng Playwright, đổi cả hai rồi `docker compose build crawler --no-cache`).
- **Bật:** `cp crawler/.env.example crawler/.env`, điền `CRAWLER_INTERNAL_TOKEN` trùng `backend/.env`, rồi:
  - `docker compose --profile crawler up -d --build`
- **Tắt (mặc định):** không truyền profile — stack không khởi động container crawler (không cần `crawler/.env`).
- Log: `docker compose logs -f crawler`

Sau khi **thêm/sửa biến backend trong compose hoặc `.env.example`**, cập nhật **`compose.env.example`** / **`backend/README.md`** / **`README.md` gốc** và **`AGENT.md`** tương ứng.

## Lệnh thường dùng

```bash
# từ gốc repo
docker compose build
docker compose up -d
docker compose logs -f backend
```

Lệnh **`docker compose exec`** theo từng app: mục **«Các lệnh chạy trong container»** trong `backend/README.md`, `frontend/README.md`, `app/README.md`.

Chi tiết stack: `../README.md`.

### 502 qua `story.test` (Nginx → Next / Laravel)

- Đảm bảo `/etc/hosts` có `127.0.0.1 story.test` (và `www.story.test` nếu dùng).
- `frontend/next.config.ts` có **`allowedDevOrigins`** gồm `story.test` (Next 15 chặn origin lạ ở chế độ dev).
- Sau khi sửa Nginx: `docker compose exec nginx nginx -s reload` (hoặc `docker compose up -d nginx`).
- Xem log: `docker compose logs -f frontend` và `docker compose logs -f nginx`.
