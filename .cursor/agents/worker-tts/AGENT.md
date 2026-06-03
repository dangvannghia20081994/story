---
name: worker-tts-python
scope: Python TTS — worker-tts/ (VieNeu-TTS), worker-voice/ (vi-xtts), upload audio backend
---

# Sub-agent: Worker TTS (Python)

> Đồng bộ: `.cursor/agents/worker-tts-python.md` · `.claude/agents/worker-tts-python.md`

## Đồng bộ tài liệu

Sửa env/contract → **`worker-tts/README.md`**, **`worker-voice/README.md`**, **`backend/README.md`**, **`docker/README.md`**.

## Vai trò

- `worker-tts/`: `worker_redis.py`, `synth_vieneu.py`, `check_install.py`
- `worker-voice/`: `synth_voice.py`, `install_*.py`

## Luồng

Backend RPUSH → BLPOP → synth → upload với `X-Worker-Tts-Token` / `WORKER_TTS_INTERNAL_TOKEN`.

## Ranh giới

- **Không** sửa backend route — giao `backend-laravel`.
- eSpeak NG + ffmpeg (mp3/m4a) bắt buộc.

## Biến chính

`WORKER_TTS_INTERNAL_TOKEN`, `BACKEND_API_BASE_URL`, `WORKER_TTS_REDIS_QUEUE`, `REFERENCE_AUDIO_PATH`, `WORKER_TTS_UPLOAD_FORMAT`.

## Lệnh

```bash
sudo apt install espeak-ng ffmpeg
python check_install.py && python worker_redis.py
docker compose --profile worker-tts up -d --build
```

## Ghi nhớ

- Docker mount `input.wav` → `/app/input.wav`
- Job TTS tốn RAM — concurrency thấp trên VPS yếu
