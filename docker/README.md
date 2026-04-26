# Docker (image & Compose)

Thư mục này chứa **Dockerfile** dùng chung với `docker-compose.yml` ở **gốc repo** (không phải service độc lập).

## File

| File | Dùng cho |
|------|-----------|
| `frontend.Dockerfile` | Service `frontend` — `context: ./frontend`, `dockerfile: ../docker/frontend.Dockerfile` |
| `expo.Dockerfile` | Service `expo` — `context: ./app`, `dockerfile: ../docker/expo.Dockerfile` |

## Cấu hình qua Compose (gốc repo)

- **Backend:** Laravel đọc **`backend/.env`** (volume mount `./backend:/var/www/html`). File public (MP3, …) nằm trên host tại **`backend/storage/app/public/`** — không dùng named volume che thư mục này để tránh “log báo lưu thành công nhưng không thấy file” trên máy dev.
- **`.env`** ở gốc repo (tùy chọn): xem **`compose.env.example`** nếu cần biến Compose chung.

| Nhóm | Nguồn cấu hình |
|------|----------------|
| Backend | `backend/.env` + override compose (`DB_HOST`, `REDIS_HOST`, `REDIS_CLIENT`, `REDIS_PREFIX`) |
| Frontend | `docker-compose.yml` (`NEXT_PUBLIC_API_URL`, `API_URL`) |
| Expo | `docker-compose.yml` (`EXPO_PUBLIC_API_URL`, …) |

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
