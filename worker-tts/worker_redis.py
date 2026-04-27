#!/usr/bin/env python3
"""
Lắng nghe Redis (BLPOP), tổng hợp giọng VieNeu từ file tham chiếu, gọi API Laravel lưu audio.

Payload JSON trên queue (RPUSH từ backend), ví dụ:
  {"chapter_id": 12, "text": "Nội dung chương dạng plain text..."}

Biến môi trường: xem worker-tts/.env.example
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import traceback
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def redis_client():
    import redis

    url = (os.environ.get("REDIS_URL") or "").strip()
    if url:
        return redis.from_url(url, decode_responses=True)
    host = os.environ.get("REDIS_HOST", "127.0.0.1")
    port = int(os.environ.get("REDIS_PORT", "6379"))
    db = int(os.environ.get("REDIS_DB", "0"))
    password = os.environ.get("REDIS_PASSWORD") or None
    return redis.Redis(host=host, port=port, db=db, password=password, decode_responses=True)


def queue_key() -> str:
    return os.environ.get("WORKER_TTS_REDIS_QUEUE", "story:tts:queue").strip()


def reference_audio_path() -> Path:
    return Path(os.environ.get("REFERENCE_AUDIO_PATH", str(SCRIPT_DIR / "input.mp3"))).expanduser().resolve()


def backend_base_url() -> str:
    base = (os.environ.get("BACKEND_API_BASE_URL") or "http://127.0.0.1:8000").strip().rstrip("/")
    return base


def internal_token() -> str:
    return (os.environ.get("WORKER_TTS_INTERNAL_TOKEN") or "").strip()


def upload_audio(chapter_id: int, wav_path: Path) -> None:
    import requests

    token = internal_token()
    if not token:
        raise RuntimeError("Thiếu WORKER_TTS_INTERNAL_TOKEN")

    url = f"{backend_base_url()}/api/internal/tts/chapters/{chapter_id}/audio"
    with wav_path.open("rb") as f:
        r = requests.post(
            url,
            headers={"X-Worker-Tts-Token": token},
            files={"audio": ("chapter.wav", f, "audio/wav")},
            data={"duration": "0"},
            timeout=600,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"API {r.status_code}: {r.text[:2000]}")


def process_message(tts, raw: str) -> None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[worker-tts] Bỏ qua JSON không hợp lệ: {e}", file=sys.stderr)
        return

    chapter_id = msg.get("chapter_id")
    text = msg.get("text")
    if chapter_id is None or text is None or str(text).strip() == "":
        print(f"[worker-tts] Thiếu chapter_id hoặc text: {msg!r}", file=sys.stderr)
        return
    try:
        chapter_id = int(chapter_id)
    except (TypeError, ValueError):
        print(f"[worker-tts] chapter_id không phải số: {msg!r}", file=sys.stderr)
        return

    ref = reference_audio_path()
    if not ref.is_file():
        print(f"[worker-tts] Không thấy file giọng mẫu: {ref}", file=sys.stderr)
        return

    text = str(text).strip()
    print(f"[worker-tts] Chapter {chapter_id}, độ dài text={len(text)} ký tự")

    voice = tts.encode_reference(str(ref))
    audio = tts.infer(text=text, voice=voice)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        tts.save(audio, str(tmp_path))
        upload_audio(chapter_id, tmp_path)
        print(f"[worker-tts] Đã upload audio chapter_id={chapter_id}")
    finally:
        tmp_path.unlink(missing_ok=True)


def main() -> int:
    try:
        from vieneu import Vieneu
    except ImportError as e:
        print(e, file=sys.stderr)
        return 1

    key = queue_key()
    print(f"[worker-tts] Khởi tạo VieNeu (có thể tải model lần đầu)...")
    tts = Vieneu()
    print(f"[worker-tts] Sẵn sàng. Queue={key!r} BLPOP, reference={reference_audio_path()}")

    r = redis_client()
    while True:
        item = r.blpop(key, timeout=0)
        if not item:
            continue
        _list_key, raw = item
        print(f"[worker-tts] Nhận job, raw_len={len(raw)}")
        try:
            process_message(tts, raw)
        except Exception as e:  # noqa: BLE001
            print(f"[worker-tts] Lỗi xử lý: {e}", file=sys.stderr)
            traceback.print_exc()


if __name__ == "__main__":
    raise SystemExit(main())
