---
name: worker-tts
scope: Python worker — Redis consumer, TTS (ffmpeg / FPT), ghi file storage, callback Laravel
---

# Sub-agent: Worker (Python)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **env**, **`app/config.py`**, pipeline TTS, hoặc Docker service `worker`: cập nhật **`worker/.env.example`**, **`worker/README.md`**, và **file `AGENT.md` này**. Quy ước tổng: `.cursor/agents/README.md`.

## Vai trò

Bạn chịu trách nhiệm **`worker/`**: FastAPI (`/health`), consumer Redis (`BRPOP` trên `QUEUE_NAME`), xử lý job JSON (**bắt buộc** `chapter_id`, `story_id`, `text`, `voice_segments`), ghi MP3 dưới `STORAGE_PUBLIC_ROOT` theo layout Laravel (`stories/{story_id}/chapters/{chapter_id}/audio.mp3`), gọi `POST /api/internal/tts-complete` với `Authorization: Bearer` + `Accept: application/json`.

## Ranh giới

- **Không** thêm CRUD truyện/chương trong worker; nguồn sự thật là Laravel + DB.
- **Không** sửa migration Laravel; chỉ đọc/ghi file trong storage đã mount.
- TTS: **`TTS_PROVIDER=ffmpeg`** (placeholder) hoặc **`fpt`** + **`FPT_API_KEY`** (FPT.AI v5 — xem `app/fpt_tts.py`).

## File thường chạm

- `app/main.py`, `app/consumer.py`, `app/pipeline.py`, **`app/config.py`**, **`app/fpt_tts.py`**
- **`worker/.env`** (không commit; mẫu: **`worker/.env.example`**)
- `requirements.txt`, `Dockerfile`

## File `.env` và nguồn cấu hình

- **`app/config.py`** (`Settings`): đọc **`worker/.env`** theo đường dẫn tuyệt đối (thư mục cha của `app/`), **nếu file tồn tại**; sau đó Pydantic Settings đọc **biến môi trường** (ưu tiên cao hơn file — chuẩn dotenv).
- **Chạy local** (`cd worker && uvicorn …`): tạo `cp .env.example .env`, chỉnh giá trị; `TTS_PROVIDER`, `FPT_*`, `REDIS_URL`, … đều lấy từ đó (và có thể override bằng export).
- **Docker Compose**: service `worker` dùng **`env_file: ./worker/.env`** (`required: false`); block **`environment`** trong compose chỉ ghi đè URL/host **nội bộ Docker** (`REDIS_URL`, `BACKEND_URL`, `STORAGE_PUBLIC_ROOT`, `WORKER_TOKEN` khớp Laravel). `TTS_PROVIDER`, `FPT_API_KEY`, poll, voice, … đặt trong **`worker/.env`**, không cần nhân đôi trong `docker-compose.yml`.

## Biến môi trường (tóm tắt)

| Biến | Ý nghĩa |
|--------|---------|
| `REDIS_URL`, `QUEUE_NAME` | Hàng đợi job |
| `BACKEND_URL`, `WORKER_TOKEN` | Callback Laravel |
| `STORAGE_PUBLIC_ROOT` | Đồng bộ với `storage/app/public` của backend |
| `TTS_PROVIDER` | `ffmpeg` \| `fpt` |
| `FPT_API_KEY`, `FPT_TTS_URL`, `FPT_TTS_VOICE`, `FPT_TTS_SPEED`, `FPT_TTS_FORMAT`, `FPT_POLL_*` | Khi `TTS_PROVIDER=fpt` (tên biến trong `.env` khớp `worker/.env.example`) |

Chi tiết: `worker/README.md` và `worker/.env.example`.

## Lệnh tham chiếu

Xem `worker/README.md`: venv, `pip install`, `uvicorn`, Docker; mục **«Các lệnh chạy trong container»** — image worker **không** mount source `worker/` mặc định, đổi code cần **build lại** hoặc bổ sung volume.

## Ghi nhớ

- Queue list Redis phải khớp Laravel: **`story:tts:queue`** (và `REDIS_PREFIX` rỗng ở backend nếu dùng mặc định).
- Job **thiếu `chapter_id`** sẽ bị bỏ qua (log lỗi).
- `TTS_PROVIDER=fpt` mà không có `FPT_API_KEY` → báo failed + log cấu hình.
