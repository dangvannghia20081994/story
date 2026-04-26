---
name: worker-tts
scope: Python worker — Redis consumer, TTS (ffmpeg / VieNeu; Coqui sidecar HTTP tại `coqui/` sẽ gắn sau), upload audio tới Laravel
---

# Sub-agent: Worker (Python)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **env**, **`app/config.py`**, pipeline TTS, hoặc Docker service `worker`: cập nhật **`worker/.env.example`**, **`worker/README.md`**, và **file `AGENT.md` này**. Quy ước tổng: `.cursor/agents/README.md`.

## Vai trò

Bạn chịu trách nhiệm **`worker/`**: FastAPI (`/health`), consumer Redis (`BRPOP` trên `QUEUE_NAME`), xử lý job JSON (**bắt buộc** `chapter_id`, `story_id`, `text`, `voice_segments`), TTS ra MP3 tạm, gọi `POST /api/internal/tts-complete` với **`multipart/form-data`**: field `audio` (file) + `story_id`, `chapter_id`, `status=completed`, `duration`; header **`Authorization: Bearer`** + **`Accept: application/json`**. Lỗi TTS: cùng endpoint dạng **JSON** với `status=failed`, `error`.

## Ranh giới

- **Không** thêm CRUD truyện/chương trong worker; nguồn sự thật là Laravel + DB.
- **Không** sửa migration Laravel.
- TTS: **`TTS_PROVIDER=ffmpeg`** (im lặng, dev) hoặc **`vieneu`** (`app/vieneu_tts.py` — VieNeu-TTS on-device).

## File thường chạm

- `app/main.py`, `app/consumer.py`, `app/pipeline.py`, **`app/config.py`**, **`app/vieneu_tts.py`**
- **`worker/.env`** (không commit; mẫu: **`worker/.env.example`**)
- `requirements.txt`, `Dockerfile`

## File `.env` và nguồn cấu hình

- **`app/config.py`** (`Settings`): đọc **`worker/.env`** theo đường dẫn tuyệt đối (thư mục cha của `app/`), **nếu file tồn tại**; sau đó Pydantic Settings đọc **biến môi trường** (ưu tiên cao hơn file).
- **Chạy local**: `cp .env.example .env`; `TTS_PROVIDER`, `VIENEU_PRESET_VOICE_ID`, `REDIS_URL`, …
- **Docker Compose**: `env_file: ./worker/.env`; block **`environment`** ghi đè `REDIS_URL`, `BACKEND_URL`, `WORKER_TOKEN`.

## Biến môi trường (tóm tắt)

| Biến | Ý nghĩa |
|--------|---------|
| `REDIS_URL`, `QUEUE_NAME` | Hàng đợi job |
| `BACKEND_URL`, `WORKER_TOKEN` | Callback Laravel |
| `TTS_PROVIDER` | `ffmpeg` \| `vieneu` |
| `VIENEU_PRESET_VOICE_ID` | Tuỳ chọn — **`1`–`4`** hoặc tên preset SDK; ghi đè giọng **segment đầu** (`voice_segments[0]`); các segment sau dùng `voice_id` từ queue |
| `HF_TOKEN` | Tuỳ chọn — token Hugging Face (Read); `config.Settings.hf_token` → `os.environ` trước khi khởi tạo VieNeu (tải model Hub) |

Chi tiết: `worker/README.md` và `worker/.env.example`.

## Cài đặt Python

`vieneu` cần wheel **`llama-cpp-python`** — xem **`worker/README.md`** (cờ `--extra-index-url`); **Dockerfile** đã cấu hình tương tự.

## Lệnh tham chiếu

Xem `worker/README.md`: venv, `pip install`, Docker. **Windows:** chạy `worker/run.bat` hoặc `run.ps1` (dùng `.venv\Scripts\uvicorn.exe`), không dùng Laragon `python` toàn cục. Job VieNeu dài: `run.ps1 -NoReload` hoặc `run.bat noreload` để tắt WatchFiles, tránh reload cắt ngang infer.

## Ghi nhớ

- Queue list Redis phải khớp Laravel: **`story:tts:queue`** (và `REDIS_PREFIX` rỗng ở backend nếu dùng mặc định). Log nhận job: `app.consumer` (`Redis BRPOP` + bytes), `app.pipeline` (`Redis job JSON` tóm tắt payload).
- Job **thiếu `chapter_id`** sẽ bị bỏ qua (log lỗi).
- Giọng VieNeu: mỗi phần tử **`voice_segments`** có `voice_id` (mã **`1`–`4`**, map trong `app/vieneu_tts.py`); nhiều segment → infer từng đoạn rồi nối MP3. **`VIENEU_PRESET_VOICE_ID`** chỉ ghi đè segment đầu. Preset lỗi → fallback giọng mặc định SDK.
