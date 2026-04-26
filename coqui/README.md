# Coqui TTS (sidecar)

Chạy **HTTP server** Coqui (🐸 [idiap/coqui-ai-TTS](https://github.com/idiap/coqui-ai-TTS)) **tách khỏi** `worker/`. Mục đích: giữ service sẵn sàng (`GET /api/tts`, giao diện `/`) để sau chỉ cần thêm nhánh `TTS_PROVIDER=coqui` trong worker (gọi `COQUI_TTS_URL` + map `voice_id` → `speaker_id` / model).

## Hai cách chạy

| Cách | Khi nào dùng |
|------|----------------|
| **Docker** (`run.ps1` / `run.bat`) | Đã có Docker Desktop — không cần cài PyTorch/Coqui trên máy. |
| **Native** (`run-native.ps1` / `run-native.bat`) | **Không có Docker** — Python 3.10+ trên Windows, venv trong `coqui/.venv/`, cài `requirements.txt` (torch CPU + `coqui-tts[server]`). |

RAM đủ cho model (VITS LJSpeech nhẹ; **XTTS** / đa ngôn ngữ nặng hơn nhiều).

---

## A) Docker

```powershell
cd coqui
copy .env.example .env
.\run.ps1
```

Hoặc: `docker compose up` trong thư mục này.

- **Web UI:** http://localhost:5002/ (đổi `COQUI_PORT` trong `.env`).
- **API WAV:** `GET /api/tts?text=...` ([server](https://github.com/idiap/coqui-ai-TTS/blob/dev/TTS/server/server.py)).

```powershell
curl.exe "http://127.0.0.1:5002/api/tts?text=Hello%20from%20Coqui" -o sample.wav
```

Model trong volume Docker **`coqui_tts_models`** (`/root/.local/share/tts` trong container).

---

## B) Không Docker (Windows, Python native)

1. Cài [Python 3.10–3.12](https://www.python.org/downloads/) (tích “Add to PATH”).
2. Trong thư mục **`coqui/`**:

```powershell
cd coqui
copy .env.example .env
.\run-native.ps1
```

Lần đầu: tạo **`coqui/.venv`**, `pip install -r requirements.txt` (torch CPU + `coqui-tts[server]`) — có thể **vài phút** và vài GB tải về.

- Cùng API và cổng như Docker (`COQUI_PORT`, `COQUI_MODEL` trong `.env`).
- Cache model mặc định của 🐸TTS thường nằm dưới profile user (xem [docs](https://coqui-tts.readthedocs.io/en/latest/)); có thể set **`TTS_HOME`** trong `.env` rồi `run-native.ps1` cần export — hiện script chưa đọc `TTS_HOME`; mặc định dùng chuẩn thư viện.

Liệt kê model (native):

```powershell
.\.venv\Scripts\tts-server.exe --list_models
```

Nếu `tts-server` lỗi thiếu DLL / codec, xem log pip và [cài đặt Coqui](https://coqui-tts.readthedocs.io/en/latest/installation.html).

---

## Đổi model

1. **Docker:** `docker compose run --rm --entrypoint tts-server coqui-tts --list_models`
2. **Native:** `.\.venv\Scripts\tts-server.exe --list_models`
3. Sửa **`COQUI_MODEL`** trong `coqui/.env` (ví dụ đa speaker EN: `tts_models/en/vctk/vits` — cần `speaker_id` khi gọi API; multilingual: `tts_models/multilingual/multi-dataset/xtts_v2` — tải và RAM lớn).
4. Khởi động lại service (Docker compose hoặc `run-native.ps1`).

Tài liệu image Docker: [coqui-tts docker](https://coqui-tts.readthedocs.io/en/latest/docker_images.html).

---

## Tích hợp sau vào worker (gợi ý)

- Biến môi trường kiểu **`COQUI_TTS_URL=http://coqui-tts:5002`** (Compose cùng network) hoặc `http://127.0.0.1:5002` (dev local).
- Worker: `httpx.get/post` tới `/api/tts`, nhận WAV → pydub/ffmpeg chuyển MP3 như pipeline hiện tại.
- Khớp **`voice_id`** với `speaker_id` / `language_id` của model đang chạy (và `config/tts.php` → `voices.coqui` khi bật `TTS_SERVICE=coqui` ở Laravel).

## Không trùng cổng

- Worker VieNeu: **8080**. Coqui sidecar: **5002** (mặc định). Đổi `COQUI_PORT` trong `.env` nếu xung đột.
