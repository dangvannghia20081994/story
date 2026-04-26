# Worker (Python / FastAPI)

Consumer Redis (`story:tts:queue`), TTS (**ffmpeg** placeholder hoặc **FPT.AI**), sinh MP3 tạm rồi gửi Laravel `POST /api/internal/tts-complete` (**multipart**, field `audio`) để backend lưu `storage/app/public` qua `Storage::disk('public')`.

## Yêu cầu

- Python **3.12+**
- `ffmpeg` và `ffprobe` (cùng bộ; nhánh `ffmpeg` cần `ffmpeg`; **fpt** dùng **pydub** → pydub gọi cả `ffprobe`). Trên **Windows** nếu chưa thêm `bin` vào PATH, đặt `FFMPEG_PATH` trỏ tới `ffmpeg.exe` (worker sẽ thêm thư mục đó vào `PATH` — xem `app/pydub_ffmpeg.py`).

## Nguồn cấu hình (`.env`)

1. **`worker/.env`** — tạo bằng `cp .env.example .env` (không commit). Danh sách biến dưới đây là nội dung file đó.
2. **`app/config.py`** — Pydantic `Settings` đọc file **`worker/.env`** theo đường dẫn cố định (cạnh thư mục `app/`), **chỉ khi file tồn tại**; biến đã có trong **môi trường OS** (ví dụ Docker Compose inject) **ghi đè** giá trị trong file.
3. **Docker** — `docker-compose.yml` nạp thêm **`env_file: ./worker/.env`** (tùy chọn, không bắt buộc có file) và chỉ inject vài biến override mạng nội bộ — xem mục **Docker** phía dưới.

## Biến môi trường

| Biến | Mô tả |
|-------|--------|
| `REDIS_URL` | Redis, ví dụ `redis://localhost:6379/0` |
| `QUEUE_NAME` | Mặc định `story:tts:queue` |
| `BACKEND_URL` | Base URL Laravel |
| `WORKER_TOKEN` | Trùng `WORKER_INTERNAL_TOKEN` của Laravel |
| **`TTS_PROVIDER`** | `ffmpeg` (mặc định) hoặc **`fpt`** |
| **`FFMPEG_PATH`** | Đường dẫn tới binary `ffmpeg` (mặc định: tìm theo tên trên `PATH`). **Tùy chọn trên Linux/Docker** nếu `ffmpeg`+`ffprobe` đã có trong `/usr/bin`. **Thường cần trên Windows** (Laragon: `…\bin\ffmpeg.exe`) để pydub gọi được `ffprobe` cùng thư mục. |
| **`FPT_API_KEY`** | Bắt buộc khi `TTS_PROVIDER=fpt` — lấy từ [console.fpt.ai](https://console.fpt.ai/) |
| `FPT_TTS_URL` | Mặc định `https://api.fpt.ai/hmi/tts/v5` |
| `FPT_TTS_VOICE` | `banmai`, `lannhi`, … (xem tài liệu FPT) |
| `FPT_TTS_SPEED` | `-3` … `+3` hoặc `0` |
| `FPT_TTS_FORMAT` | `mp3` hoặc `wav` |
| `FPT_POLL_TIMEOUT_SEC` | Chờ file async (giây) |
| `FPT_POLL_INTERVAL_SEC` | Khoảng cách giữa các lần poll (sau **404** tối thiểu 3s một lần) |
| `FPT_ASYNC_FIRST_POLL_DELAY_SEC` | Sau JSON async, chờ bấy nhiêu giây rồi mới GET file mp3 (mặc định `10`) |
| `FPT_ASYNC_FIRST_POLL_FLOOR_SEC` | Sàn: thực tế chờ trước GET đầu = `max(DELAY, FLOOR)` (mặc định `2`) — nếu `.env` đặt `DELAY=0`, vẫn chờ ít nhất 2s trừ khi `FLOOR=0` |
| `FPT_INTER_CHUNK_DELAY_SEC` | Nghỉ sau khi tải xong một chunk, trước POST chunk tiếp (mặc định `0.35`) |

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

- API: POST `FPT_TTS_URL`, header **`api_key`**, body **raw UTF-8** (3–5000 ký tự mỗi request).
- Nội dung chương **dài hơn 5000 ký tự**: worker **chia đoạn** (ưu tiên ngắt xuống dòng / câu; không tạo request body >5000 ký tự khi gộp đuôi chương), gọi FPT **nhiều lần**, ghép các MP3 bằng **pydub** thành một file (log: `FPT TTS: text split into N API requests`).
- Phản hồi JSON: `error == 0` và trường **`async`** là URL MP3; CDN thường trả **404** vài lần đầu cho tới khi file sẵn sàng — worker **chờ** `max(FPT_ASYNC_FIRST_POLL_DELAY_SEC, FPT_ASYNC_FIRST_POLL_FLOOR_SEC)` (mặc định 10s / 2s) rồi **poll** (sau 404 chờ ≥3s) tới `FPT_POLL_TIMEOUT_SEC`. Nếu `FPT_ASYNC_FIRST_POLL_DELAY_SEC=0`, mặc định vẫn áp **sàn** `FPT_ASYNC_FIRST_POLL_FLOOR_SEC` (2s) trước GET đầu để tránh 404 chunk 2+.

## Docker

Từ gốc repo: tạo **`worker/.env`** từ `.env.example`, đặt **`TTS_PROVIDER=fpt`**, **`FPT_API_KEY=...`** (và các biến khác nếu cần). Compose đọc file đó qua **`env_file`** và ghi đè thêm **`REDIS_URL`**, **`BACKEND_URL`**, **`WORKER_TOKEN`** (khớp `WORKER_INTERNAL_TOKEN` ở `backend/.env` / `.env` gốc repo). Service worker **không** cần volume chung với backend: file audio do Laravel ghi vào `backend/storage/app/public` trên host (bind mount `./backend` trong Docker Compose).

```bash
docker compose up worker
```

Health: `GET http://localhost:8080/health`

## Các lệnh chạy trong container

Chạy từ **gốc repo**. Thư mục làm việc trong image: **`/app`** (code worker đóng gói trong image; không mount `storage` của Laravel).

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
