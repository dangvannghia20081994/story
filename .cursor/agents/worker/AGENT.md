---
name: worker-tts
scope: Python worker — Redis consumer, TTS (ffmpeg / FPT), upload audio tới Laravel
---

# Sub-agent: Worker (Python)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **env**, **`app/config.py`**, pipeline TTS, hoặc Docker service `worker`: cập nhật **`worker/.env.example`**, **`worker/README.md`**, và **file `AGENT.md` này**. Quy ước tổng: `.cursor/agents/README.md`.

## Vai trò

Bạn chịu trách nhiệm **`worker/`**: FastAPI (`/health`), consumer Redis (`BRPOP` trên `QUEUE_NAME`), xử lý job JSON (**bắt buộc** `chapter_id`, `story_id`, `text`, `voice_segments`), TTS ra MP3 tạm, gọi `POST /api/internal/tts-complete` với **`multipart/form-data`**: field `audio` (file) + `story_id`, `chapter_id`, `status=completed`, `duration`; header **`Authorization: Bearer`** + **`Accept: application/json`**. Lỗi TTS: cùng endpoint dạng **JSON** với `status=failed`, `error`.

## Ranh giới

- **Không** thêm CRUD truyện/chương trong worker; nguồn sự thật là Laravel + DB.
- **Không** sửa migration Laravel.
- TTS: **`TTS_PROVIDER=ffmpeg`** (placeholder) hoặc **`fpt`** + **`FPT_API_KEY`** (FPT.AI v5 — xem `app/fpt_tts.py`).

## File thường chạm

- `app/main.py`, `app/consumer.py`, `app/pipeline.py`, **`app/config.py`**, **`app/fpt_tts.py`**
- **`worker/.env`** (không commit; mẫu: **`worker/.env.example`**)
- `requirements.txt`, `Dockerfile`

## File `.env` và nguồn cấu hình

- **`app/config.py`** (`Settings`): đọc **`worker/.env`** theo đường dẫn tuyệt đối (thư mục cha của `app/`), **nếu file tồn tại**; sau đó Pydantic Settings đọc **biến môi trường** (ưu tiên cao hơn file — chuẩn dotenv).
- **Chạy local** (`cd worker && uvicorn …`): tạo `cp .env.example .env`, chỉnh giá trị; `TTS_PROVIDER`, `FPT_*`, `REDIS_URL`, … đều lấy từ đó (và có thể override bằng export).
- **Docker Compose**: service `worker` dùng **`env_file: ./worker/.env`**; block **`environment`** trong compose chỉ ghi đè URL/host **nội bộ Docker** (`REDIS_URL`, `BACKEND_URL`, `WORKER_TOKEN` khớp Laravel). `TTS_PROVIDER`, `FPT_API_KEY`, poll, voice, … đặt trong **`worker/.env`**, không cần nhân đôi trong `docker-compose.yml`.

## Biến môi trường (tóm tắt)

| Biến | Ý nghĩa |
|--------|---------|
| `REDIS_URL`, `QUEUE_NAME` | Hàng đợi job |
| `BACKEND_URL`, `WORKER_TOKEN` | Callback Laravel |
| `TTS_PROVIDER` | `ffmpeg` \| `fpt` |
| `FPT_API_KEY`, `FPT_TTS_URL`, `FPT_TTS_VOICE`, `FPT_TTS_SPEED`, `FPT_TTS_FORMAT`, `FPT_POLL_*`, `FPT_ASYNC_FIRST_POLL_DELAY_SEC`, `FPT_ASYNC_FIRST_POLL_FLOOR_SEC`, `FPT_INTER_CHUNK_DELAY_SEC`, `FPT_CHUNK_MAX_CHARS` | Khi `TTS_PROVIDER=fpt` — sau POST trả JSON async, chờ `max(DELAY, FLOOR)` rồi mới GET MP3 (mặc định DELAY 10s, floor 2s); nghỉ ngắn giữa các chunk trước POST tiếp; **chunk văn** mặc định 5000 ký tự/request (FPT), có thể giảm (vd. 2000) — ghép MP3 pydub |

Chi tiết: `worker/README.md` và `worker/.env.example`.

## Lệnh tham chiếu

Xem `worker/README.md`: venv, `pip install`, `uvicorn`, Docker; mục **«Các lệnh chạy trong container»** — image worker **không** mount source `worker/` mặc định, đổi code cần **build lại** hoặc bổ sung volume.

## Ghi nhớ

- Queue list Redis phải khớp Laravel: **`story:tts:queue`** (và `REDIS_PREFIX` rỗng ở backend nếu dùng mặc định).
- Job **thiếu `chapter_id`** sẽ bị bỏ qua (log lỗi).
- `TTS_PROVIDER=fpt` mà không có `FPT_API_KEY` → báo failed + log cấu hình.
- FPT TTS giới hạn **5000 ký tự/request**: `app/fpt_tts.py` **tự chia** văn bản dài theo `FPT_CHUNK_MAX_CHARS` (mặc định 5000; có thể đặt 2000 để thử chunk nhỏ), ưu tiên ngắt đoạn/câu; **chừa đoạn cuối ≥3 ký tự** thay vì gộp đuôi ngắn vào chunk đã đủ — tránh lỗi API / thiếu MP3; gọi API từng đoạn rồi **ghép MP3** (pydub). Poll async URL chỉ coi là MP3 khi có **magic byte** (ID3/sync frame). Chương rất dài = nhiều request tuần tự; có thể cần tăng `FPT_POLL_TIMEOUT_SEC` nếu API chậm.
