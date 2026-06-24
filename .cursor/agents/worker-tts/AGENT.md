---
name: worker-tts-python
scope: Python TTS — worker-tts/ (Revid TTS API), upload audio backend
---

# Sub-agent: Worker TTS (Python)

> Đồng bộ: `.cursor/agents/worker-tts-python.md` · `.claude/agents/worker-tts-python.md`

## Đồng bộ tài liệu

Sửa env/contract → **`worker-tts/README.md`**, **`worker-tts/GUIDE.md`**, **`backend/README.md`**, **`docker/README.md`**.

## Vai trò

- `worker-tts/`: `worker_redis.py` — consumer BLPOP, Revid TTS API, ffmpeg concat, upload

## Luồng

Backend RPUSH → BLPOP → chunking → Revid API (base64 MP3) → ffmpeg concat → upload với `X-Worker-Tts-Token` / `WORKER_TTS_INTERNAL_TOKEN`.

## Ranh giới

- **Không** sửa backend route — giao `backend-laravel`.
- ffmpeg bắt buộc cho chunked audio.

## Biến chính

`WORKER_TTS_INTERNAL_TOKEN`, `BACKEND_API_BASE_URL`, `WORKER_TTS_REDIS_QUEUE`, `REVID_API_KEY` (tuỳ chọn).

## Lệnh

```bash
sudo apt install ffmpeg
python worker_redis.py
docker compose --profile worker-tts up -d --build
```

## Ghi nhớ

- voice_id: số nguyên / `edge:<name>` / `capcut:<name>` — xem `voice_list.json`
- Không cần load model lớn — concurrency cao được trên VPS bình thường
