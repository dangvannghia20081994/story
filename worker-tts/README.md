# worker-tts (VieNeu-TTS)

Tổng hợp giọng tiếng Việt bằng Python SDK **[vieneu](https://pypi.org/project/vieneu/)** (VieNeu-TTS). Hướng dẫn chi tiết, mẫu code và mẹo: [GUIDE.md](GUIDE.md).

---

## eSpeak NG — **bắt buộc** (cài trước `pip`)

VieNeu-TTS dùng **eSpeak NG** để xử lý / phát âm tiếng Việt. **Không cài bước này thì TTS thường không chạy đúng hoặc báo lỗi**, dù `pip install` đã thành công.

**Ubuntu / Debian và các bản dùng `apt`:**

```bash
sudo apt install espeak-ng
```

Kiểm tra:

```bash
which espeak-ng
espeak-ng --version
```

Sau đó mới tạo venv và cài `requirements.txt` (mục dưới). `python check_install.py` cũng nhắc nếu thiếu `espeak-ng` trong `PATH`.

---

## Yêu cầu khác

- Python 3.10 trở lên
- Mạng ổn định lần đầu chạy (model tải về máy, dung lượng lớn — xem [GUIDE.md](GUIDE.md))

### Hugging Face Hub (khuyến nghị)

VieNeu tải model qua **Hugging Face Hub**. Không có token vẫn chạy được nhưng sẽ có cảnh báo *unauthenticated* và **rate limit thấp hơn**.

1. Tạo token (Read): [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Đặt trong `worker-tts/.env` hoặc môi trường shell / Docker:

```bash
export HF_TOKEN=hf_your_token_here
```

Thư viện `huggingface_hub` cũng đọc **`HUGGINGFACE_HUB_TOKEN`** nếu bạn đã dùng tên đó ở nơi khác.

---

## Cài đặt Python (venv + pip)

```bash
cd worker-tts
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements.txt
python check_install.py
```

`requirements.txt` có dòng `--extra-index-url` để pip lấy **llama-cpp-python** bản CPU đã build (tránh phải compile). Nếu môi trường của bạn đã ổn, có thể thử chỉ `pip install vieneu`.

Nếu `python3 -m venv` báo thiếu `ensurepip`: cài gói venv cho đúng phiên bản Python, ví dụ `sudo apt install python3.12-venv` (đổi số cho khớp `python3 --version`).

---

## Chạy nhanh

```bash
source .venv/bin/activate
python synth_vieneu.py --text "Xin chào, đây là VieNeu."
python synth_vieneu.py --text "..." --reference ../worker-voice/voice.wav --out cloned.wav
```

---

## Docker (worker + Redis + API backend)

Image build từ `docker/worker-tts.Dockerfile` (eSpeak NG, **rustup stable + CMake** để compile `sea-g2p` / `llama-cpp-python` khi không có wheel khớp — Cargo từ apt Debian quá cũ, không đọc được `Cargo.lock` v4 của `sea-g2p`. Lần build **có thể 10–25 phút** tùy CPU).

1. **Backend:** trong `backend/.env` đặt `WORKER_TTS_INTERNAL_TOKEN` và `WORKER_TTS_REDIS_QUEUE` (mặc định `story:tts:queue`). Sinh token: `php artisan worker-tts:internal-token`.
2. **Worker:** copy `worker-tts/.env.example` → `worker-tts/.env`, điền cùng `WORKER_TTS_INTERNAL_TOKEN`, chỉnh `BACKEND_API_BASE_URL` nếu cần.
3. **Giọng mẫu:** đặt file `input.mp3` (hoặc WAV) và bật mount trong `docker-compose.yml` cho service `worker-tts`, ví dụ:

```yaml
worker-tts:
  volumes:
    - ./worker-tts/input.mp3:/app/input.mp3:ro
```

Chạy service (profile):

```bash
docker compose --profile worker-tts up -d --build worker-tts
```

---

## Luồng Redis → TTS → API

**Backend** đẩy job bằng `RPUSH` vào list Redis (cùng key với `WORKER_TTS_REDIS_QUEUE`). Mỗi phần tử là **một JSON** (UTF-8), ví dụ:

```json
{"chapter_id": 12, "text": "Plain text nội dung chương để đọc..."}
```

Trong Laravel có thể gọi:

```php
use App\Services\WorkerTtsQueue;

WorkerTtsQueue::push($chapter);
```

`WorkerTtsQueue::plainTextFromChapter()` sẽ chuyển HTML `content` sang plain text; hoặc truyền `WorkerTtsQueue::push($chapter, ['text' => '...'])` để ghi đè.

**Worker** (`worker_redis.py`) `BLPOP` hàng đợi, đọc `text`, clone giọng từ `REFERENCE_AUDIO_PATH` (mặc định `/app/input.mp3` trong container), gọi:

`POST {BACKEND_API_BASE_URL}/api/internal/tts/chapters/{chapter_id}/audio`

Header: `X-Worker-Tts-Token: <WORKER_TTS_INTERNAL_TOKEN>`  
Body: `multipart/form-data` với field file `audio` (`.wav` từ VieNeu) và tùy chọn `duration`.

Sau khi thành công, backend lưu file lên disk `public` và cập nhật `chapters.audio_path` / `duration`.

