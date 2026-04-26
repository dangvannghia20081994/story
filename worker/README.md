# Worker (Python / FastAPI)

Consumer Redis (`story:tts:queue`), TTS (**VieNeu** qua gói `vieneu`, hoặc **ffmpeg** im lặng cho dev). **Coqui** chạy sidecar Docker riêng (`coqui/`, HTTP `:5002`) — sau tích hợp vào worker qua URL. Sinh MP3 tạm rồi gửi Laravel `POST /api/internal/tts-complete` (**multipart**, field `audio`) để backend lưu `storage/app/public` qua `Storage::disk('public')`.

## Windows — chạy dev hàng ngày

1. **Redis** đang lắng nghe (ví dụ `redis://127.0.0.1:6379/0`) — Laragon, Docker, hoặc `redis/redis-server.exe` theo `run-dev.sh` ở root repo.
2. **Laravel** (`php artisan serve` …) với `BACKEND_URL` trong `worker/.env` trùng base URL (thường `http://127.0.0.1:8000`).
3. **`WORKER_TOKEN`** trong `worker/.env` = **`WORKER_INTERNAL_TOKEN`** trong `backend/.env`.
4. Trong thư mục **`worker`**, chạy **`run.ps1`** (PowerShell) hoặc **`run.bat`** (CMD). Cả hai đều gọi **`.venv\Scripts\uvicorn.exe`** — không dùng `python -m uvicorn` bằng Python toàn cục (Laragon), kẻo thiếu gói **`vieneu`** và lỗi import.

```powershell
cd worker
.\run.ps1
# Job VieNeu dài (nhiều chunk): tránh --reload để lưu file code không cắt ngang TTS
.\run.ps1 -NoReload
```

CMD: `run.bat` (có `--reload`) hoặc **`run.bat noreload`**.

- **`--reload` / WatchFiles:** mặc định mỗi lần **lưu file** dưới `worker/` (ví dụ `app\config.py`) Uvicorn **khởi động lại** → job đang infer (chunk 42/83, v.v.) **bị dừng**. Log `KeyboardInterrupt` / `asyncio.exceptions.CancelledError` trong lifespan lúc shutdown/reload là **hậu quả dừng process**, không phải lỗi logic TTS. Job dở thường cần **xử lý lại từ CMS/Laravel** (enqueue lại) nếu app không tự retry.
- **`run.ps1` / `run.bat`** và worker trong **`run-dev.sh --with-worker`** là cùng một vai trò: chỉ cần **một** trong các cách đó để chạy worker (tránh hai process cùng queue / cổng 8080).
- **FFmpeg:** pydub cần `ffmpeg` + `ffprobe`. Nếu không có trên `PATH`, đặt trong `worker/.env` ví dụ Laragon:

  `FFMPEG_PATH=D:\laragon\bin\ffmpeg\bin\ffmpeg.exe`

- **Log job Redis:** `app.consumer` — `Redis BRPOP: queue=… payload_bytes=…`. `app.pipeline` — `Redis job JSON: …` (story/chapter, độ dài `text` gốc, mảng `voice_segments` với `voice_id`, `text_chars`, `text_preview` ~160 ký tự, `extra_keys` nếu có field lạ), rồi `TTS job start (normalized): …`. JSON lỗi / UTF-8 lỗi có log kèm đoạn đầu payload.

## VieNeu (TTS)

- **VieNeu** là TTS on-device (tiếng Việt), gọi qua gói PyPI **`vieneu`**. Worker dùng preset có sẵn trong SDK (`get_preset_voice` / `list_preset_voices`).
- **Phụ thuộc:** `llama-cpp-python==0.3.16`. Trên Windows nên cài wheel CPU (tránh build MSVC):

  ```bash
  cd worker
  python -m venv .venv
  .\.venv\Scripts\activate
  python -m pip install -U pip wheel
  pip install -r requirements.txt --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
  ```

- **Giọng (`voice_id`):** CMS và queue dùng mã ngắn **`1`–`4`**. Worker map sang tên preset VieNeu (khớp `config/tts.php` của Laravel):

  | `voice_id` | Preset VieNeu (worker `vieneu_tts.py`) |
  |------------|------------------------------------------|
  | `1` | Bích Ngọc (Nữ - Miền Bắc) |
  | `2` | Phạm Tuyên (Nam - Miền Bắc) |
  | `3` | Thục Đoan (Nữ - Miền Nam) |
  | `4` | Xuân Vĩnh (Nam - Miền Nam) |

  Chuỗi preset đầy đủ từ SDK vẫn được chấp nhận nếu gửi thẳng trong job (tương thích).

- **`VIENEU_PRESET_VOICE_ID`** (tuỳ chọn trong `worker/.env`): nếu set (`1`–`4` hoặc tên preset đầy đủ), **ghi đè** giọng của **segment đầu** trong job; không set thì mỗi segment dùng `voice_id` do Laravel gửi (`voice_segments`).

- **Nhiều giọng / chương:** job có thể có **nhiều** `voice_segments` (backend tách theo đoạn + tiền tố tên nhân vật). Worker VieNeu infer **từng** segment rồi **nối** MP3 (khoảng lặng ~450 ms giữa các đoạn) bằng `app/audio_stitcher.py`.

- **Backend:** `TTS_SERVICE=vieneu` trong `.env` Laravel và mục `voices.vieneu` trong `config/tts.php` phải cùng bộ mã `1`–`4` với worker.

- **Tải model (Hugging Face):** lần đầu chạy job, SDK kéo **GGUF** (`VieNeu-TTS-v2-Turbo-GGUF`) và **ONNX codec** từ Hub — bình thường; file được cache (thường dưới `%USERPROFILE%\.cache\huggingface` trên Windows). Log `You are sending unauthenticated requests` / `HF_TOKEN` đến từ **`huggingface_hub`**: có thể đặt token đọc (Read) trong **`worker/.env`** — `HF_TOKEN=...` ([tạo token](https://huggingface.co/settings/tokens)) để giới hạn tốc độ cao hơn và tải ổn định hơn; không bắt buộc nếu tải vẫn thành công.

- **Kiểm tra:** `GET http://127.0.0.1:8080/health` — xem `python` (đúng `worker\.venv\Scripts\python.exe`), `vieneu_import_ok`, `tts_provider`.

## Yêu cầu

- Python **3.10+** (Dockerfile dùng 3.12).
- `ffmpeg` và `ffprobe` (nhánh **vieneu** dùng **pydub** để xuất MP3). Trên **Windows** có thể đặt `FFMPEG_PATH` trỏ tới `ffmpeg.exe` (xem `app/pydub_ffmpeg.py`).

## Cài gói Python (VieNeu + llama-cpp)

Gói `vieneu` phụ thuộc **`llama-cpp-python==0.3.16`**. Trên **Windows** nên cài kèm index wheel CPU của tác giả (tránh build từ source — cần MSVC):

```bash
cd worker
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -U pip wheel
pip install -r requirements.txt --extra-index-url https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/
```

**Docker:** `worker/Dockerfile` đã thêm `--extra-index-url` tương tự khi `pip install`.

## Nguồn cấu hình (`.env`)

1. **`worker/.env`** — `cp .env.example .env`.
2. **`app/config.py`** — đọc `worker/.env` nếu có; biến môi trường OS ghi đè.
3. **Docker** — `env_file: ./worker/.env` + override mạng trong `docker-compose.yml`.

## Biến môi trường

| Biến | Mô tả |
|-------|--------|
| `REDIS_URL` | Redis, ví dụ `redis://localhost:6379/0` |
| `QUEUE_NAME` | Mặc định `story:tts:queue` |
| `BACKEND_URL` | Base URL Laravel |
| `WORKER_TOKEN` | Trùng `WORKER_INTERNAL_TOKEN` của Laravel |
| **`TTS_PROVIDER`** | **`vieneu`** (mặc định) hoặc **`ffmpeg`** (file im 3s, dev) |
| **`FFMPEG_PATH`** | Đường dẫn tới `ffmpeg` (Windows / pydub). |
| **`VIENEU_PRESET_VOICE_ID`** | Tuỳ chọn — **`1`–`4`** (khớp `config/tts.php` backend) hoặc tên preset đầy đủ SDK; **ghi đè** `voice_id` segment đầu trong queue. |
| **`HF_TOKEN`** | Tuỳ chọn — token Hugging Face (Read); SDK VieNeu dùng khi tải model; giảm cảnh báo / rate limit khi chưa đăng nhập. |

## Chạy local (thủ công)

**Bắt buộc** dùng Python trong **`worker/.venv`**. Nếu chạy bằng `python` toàn cục / Laragon → lỗi **`No module named 'vieneu'`**.

```bash
cd worker
# Windows: ưu tiên run.ps1 / run.bat (xem mục Windows ở trên).
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8080
# Job TTS dài, không muốn reload khi sửa file: bỏ --reload
.\.venv\Scripts\uvicorn.exe app.main:app --port 8080
```

`GET /health` trả thêm `python` (đường dẫn interpreter) và `vieneu_import_ok` — kiểm tra nhanh có đúng venv không.

## Docker

Tạo **`worker/.env`** (có thể chỉ `TTS_PROVIDER=vieneu` và token). Compose ghi đè `REDIS_URL`, `BACKEND_URL`, `WORKER_TOKEN`.

```bash
docker compose build worker
docker compose up worker
```

Health: `GET http://localhost:8080/health`

## Coqui (sidecar — chưa nối worker)

HTTP server Coqui (idiap, CPU) chạy riêng trong **`coqui/`** (Docker, mặc định **:5002**). Hướng dẫn chạy và API: **`coqui/README.md`**. Worker hiện **chưa** gọi Coqui; bước sau: thêm provider `coqui` + `httpx` tới `COQUI_TTS_URL`, đồng bộ `config/tts.php` → `voices.coqui`.

## Cấu hình trong code

| File | Mô tả |
|------|--------|
| `app/config.py` | `Settings` |
| `app/vieneu_tts.py` | TTS khi `TTS_PROVIDER=vieneu`, map `1`–`4` → preset |
| `app/pipeline.py` | Job → render MP3 → callback Laravel |

**Quy ước:** đổi env hoặc TTS → cập nhật **`worker/.env.example`**, **`worker/README.md`**, **`.cursor/agents/worker/AGENT.md`**.
