# worker-tts

Worker lắng nghe Redis (BLPOP), gọi **Revid TTS API**, upload audio chương về backend.

---

## Payload Redis

Backend đẩy job bằng `RPUSH` vào list `WORKER_TTS_REDIS_QUEUE` (mặc định `story:tts:queue`):

```json
{"chapter_id": 12, "mode": "single", "text": "Plain text...", "voice_id": "capcut:BV074_streaming"}
```

Trong Laravel:
```php
WorkerTtsQueue::push($chapter, voiceId: 'capcut:BV074_streaming');
```

---

## Cài đặt

Yêu cầu: Python 3.10+, `ffmpeg` (ghép MP3 khi text > 9000 ký tự).

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

cd worker-tts
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

**Windows:** dùng `run_worker_redis.cmd`.

---

## Cấu hình `.env`

Copy từ `.env.example`:

```
WORKER_TTS_INTERNAL_TOKEN=   # khớp backend/.env
BACKEND_API_BASE_URL=http://127.0.0.1:8000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
WORKER_TTS_REDIS_QUEUE=story:tts:queue
# REVID_API_KEY=sk_...       # tuỳ chọn, override key mặc định
```

---

## Chạy

```bash
source .venv/bin/activate
python worker_redis.py
```

---

## Docker

```bash
docker compose --profile worker-tts up -d --build worker-tts
```

---

## Voice ID

| Định dạng | Ví dụ | Engine |
|---|---|---|
| Số nguyên | `8001`, `5003` | Revid native |
| `edge:<tên>` | `edge:vi-VN-HoaiMyNeural` | Microsoft Edge TTS |
| `capcut:<tên>` | `capcut:BV074_streaming` | CapCut TTS |

Danh sách đầy đủ: `voice_list.json` ở gốc repo.
