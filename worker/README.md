# Worker (Python / FastAPI)

Consumer Redis (`story:tts:queue`), TTS (**ffmpeg** placeholder hoặc **FPT.AI**), ghi MP3 vào `storage/app/public`, callback Laravel `POST /api/internal/tts-complete`.

## Yêu cầu

- Python **3.12+**
- `ffmpeg` trên PATH (luôn cần cho nhánh `ffmpeg`; nhánh `fpt` dùng thêm **pydub** đo duration)

## Nguồn cấu hình (`.env`)

1. **`worker/.env`** — tạo bằng `cp .env.example .env` (không commit). Danh sách biến dưới đây là nội dung file đó.
2. **`app/config.py`** — Pydantic `Settings` đọc file **`worker/.env`** theo đường dẫn cố định (cạnh thư mục `app/`), **chỉ khi file tồn tại**; biến đã có trong **môi trường OS** (ví dụ Docker Compose inject) **ghi đè** giá trị trong file.
3. **Docker** — `docker-compose.yml` nạp thêm **`env_file: ./worker/.env`** (tùy chọn, không bắt buộc có file) và chỉ inject vài biến override mạng nội bộ — xem mục **Docker** phía dưới.

## Biến môi trường

| Biến | Mô tả |
|-------|--------|
| `REDIS_URL` | Redis, ví dụ `redis://127.0.0.1:6379/0` |
| `QUEUE_NAME` | Mặc định `story:tts:queue` |
| `BACKEND_URL` | Base URL Laravel |
| `WORKER_TOKEN` | Trùng `WORKER_INTERNAL_TOKEN` của Laravel |
| `STORAGE_PUBLIC_ROOT` | Đường tuyệt đối tới `storage/app/public` của backend |
| **`TTS_PROVIDER`** | `ffmpeg` (mặc định) hoặc **`fpt`** |
| **`FPT_API_KEY`** | Bắt buộc khi `TTS_PROVIDER=fpt` — lấy từ [console.fpt.ai](https://console.fpt.ai/) |
| `FPT_TTS_URL` | Mặc định `https://api.fpt.ai/hmi/tts/v5` |
| `FPT_TTS_VOICE` | `banmai`, `lannhi`, … (xem tài liệu FPT) |
| `FPT_TTS_SPEED` | `-3` … `+3` hoặc `0` |
| `FPT_TTS_FORMAT` | `mp3` hoặc `wav` |
| `FPT_POLL_TIMEOUT_SEC` | Chờ file async (giây) |
| `FPT_POLL_INTERVAL_SEC` | Khoảng cách giữa các lần poll |

Sao chép `cp .env.example .env` rồi điền giá trị.

## Chạy local

```bash
cd worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

## FPT.AI TTS

- API: POST `FPT_TTS_URL`, header **`api_key`**, body **raw UTF-8** (3–5000 ký tự).
- Phản hồi JSON: `error == 0` và trường **`async`** là URL MP3; file có thể chậm vài giây — worker **poll** URL cho tới `FPT_POLL_TIMEOUT_SEC`.

## Docker

Từ gốc repo: tạo **`worker/.env`** từ `.env.example`, đặt **`TTS_PROVIDER=fpt`**, **`FPT_API_KEY=...`** (và các biến khác nếu cần). Compose đọc file đó qua **`env_file`** và ghi đè thêm **`REDIS_URL`**, **`BACKEND_URL`**, **`STORAGE_PUBLIC_ROOT`**, **`WORKER_TOKEN`** (khớp `WORKER_INTERNAL_TOKEN` ở `backend/.env` / `.env` gốc repo).

```bash
docker compose up worker
```

Health: `GET http://localhost:8080/health`

## Các lệnh chạy trong container

Chạy từ **gốc repo**. Thư mục làm việc trong image: **`/app`** (code worker, không phải thư mục `worker/` trên host — volume chỉ mount storage chung với backend).

| Mục đích | Lệnh |
|----------|------|
| Shell / debug | `docker compose exec worker sh` |
| Kiểm tra biến đã nạp (Python) | `docker compose exec worker python -c "from app.config import settings; print(settings.redis_url)"` |

Cần service **`worker`** đang chạy. Sửa code Python trong repo: chỉnh file dưới `worker/app/` trên host rồi **build lại** image hoặc mount thêm source nếu bạn bổ sung volume (mặc định compose hiện tại **không** mount `./worker` vào `/app`).

## Cấu hình trong code

| Nguồn | Mô tả |
|--------|--------|
| `app/config.py` | `Settings`: đọc `worker/.env` (nếu có) + biến môi trường; alias `FPT_TTS_VOICE` / `FPT_TTS_SPEED` / `FPT_TTS_FORMAT` |
| `app/fpt_tts.py` | Luồng FPT khi `TTS_PROVIDER=fpt` |

**Quy ước:** mỗi lần thêm/sửa env hoặc provider TTS → cập nhật **`worker/.env.example`**, **`worker/README.md`**, và **`.cursor/agents/worker/AGENT.md`**.
