#!/usr/bin/env python3
"""
Lắng nghe Redis (BLPOP), gọi Revid TTS API, upload audio lên backend.

Payload JSON trên queue (RPUSH từ backend):
  {"chapter_id": 12, "mode": "single", "text": "Plain text...", "voice_id": "capcut:BV074_streaming"}

Biến môi trường: xem worker-tts/.env.example
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def load_local_env() -> None:
    """Khi chạy trực tiếp `python worker_redis.py`, nạp worker-tts/.env (Docker dùng env_file)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    path = SCRIPT_DIR / ".env"
    if path.is_file():
        load_dotenv(path, override=False)


def _stage(chapter_id: int, step: int, total: int, label: str) -> None:
    print(f"[worker-tts] chapter={chapter_id}  [{step}/{total}] {label}", flush=True)


def redis_client():
    import redis

    # socket_timeout=None: BLPOP block được lâu không bị ngắt socket.
    # keepalive + health_check: giữ kết nối idle, tự phát hiện connection chết.
    common = dict(
        decode_responses=True,
        socket_timeout=None,
        socket_keepalive=True,
        health_check_interval=30,
    )
    url = (os.environ.get("REDIS_URL") or "").strip()
    if url:
        return redis.from_url(url, **common)
    host = os.environ.get("REDIS_HOST", "127.0.0.1")
    port = int(os.environ.get("REDIS_PORT", "6379"))
    db = int(os.environ.get("REDIS_DB", "0"))
    password = os.environ.get("REDIS_PASSWORD") or None
    return redis.Redis(host=host, port=port, db=db, password=password, **common)


def queue_key() -> str:
    return os.environ.get("WORKER_TTS_REDIS_QUEUE", "story:tts:queue").strip()


def backend_base_url() -> str:
    base = (os.environ.get("BACKEND_API_BASE_URL") or "http://127.0.0.1:8000").strip().rstrip("/")
    return base


def internal_token() -> str:
    return (os.environ.get("WORKER_TTS_INTERNAL_TOKEN") or "").strip()


_ZW_RE = re.compile("[​‌‍﻿]")


def normalize_tts_text(text: str) -> str:
    """Bỏ dòng trống, ký tự zero-width; gộp đoạn bằng một space.
    Giảm marker gây silence dài (chấm lửng, em-dash) về dấu phẩy."""
    text = _ZW_RE.sub("", text)
    text = text.replace("…", ", ")
    text = re.sub(r"\.{2,}", ", ", text)
    text = re.sub(r"[—–]+", ", ", text)
    text = text.strip()
    if not text:
        return ""
    parts: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if s:
            parts.append(s)
    out = " ".join(parts)
    out = re.sub(r"\s+", " ", out, flags=re.UNICODE)
    out = re.sub(r"\s+,", ",", out)
    out = re.sub(r"(?:,\s*){2,}", ", ", out)
    return out.strip()


def upload_audio(chapter_id: int, file_path: Path, multipart_name: str, content_type: str, audio_type: str = "multiple", duration: int = 0) -> None:
    import requests

    token = internal_token()
    if not token:
        raise RuntimeError(
            "Thiếu WORKER_TTS_INTERNAL_TOKEN (trùng giá trị trong backend/.env; "
            "chạy ngoài Docker: tạo worker-tts/.env từ .env.example; "
            "Docker: env_file worker-tts/.env trong docker-compose)."
        )

    url = f"{backend_base_url()}/api/internal/tts/chapters/{chapter_id}/audio"
    headers = {
        "X-Worker-Tts-Token": token,
        "Accept": "application/json",
    }
    with file_path.open("rb") as f:
        r = requests.post(
            url,
            headers=headers,
            files={"audio": (multipart_name, f, content_type)},
            data={"duration": str(int(duration)), "type": audio_type},
            timeout=600,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"API {r.status_code}: {r.text[:2000]}")


def _probe_duration_seconds(path: Path) -> int:
    """Đo độ dài audio (giây, làm tròn) bằng ffprobe; trả 0 nếu lỗi."""
    ffprobe_bin = (os.environ.get("FFPROBE_PATH") or "ffprobe").strip() or "ffprobe"
    try:
        out = subprocess.run(
            [ffprobe_bin, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        return int(round(float(out)))
    except (subprocess.CalledProcessError, ValueError, OSError) as e:
        print(f"[worker-tts]   ffprobe duration lỗi: {e}", file=sys.stderr)
        return 0


def _call_revid_tts(text: str, voice_id: str, rate: str = "+0%") -> bytes:
    """Gọi Revid TTS API, trả bytes MP3."""
    import requests as req

    API_KEY = (os.environ.get("REVID_API_KEY") or "sk_JyvWEYr8akwJwrvhsKo2tN1wJcLPUZ7z").strip()
    headers = {
        "accept": "*/*",
        "content-type": "application/json",
        "origin": "https://revidapi.com",
        "referer": "https://revidapi.com/",
        "x-api-key": API_KEY,
        "x-revidapi-client": "tts-studio",
    }
    if re.match(r"^\d+$", voice_id):
        payload = {
            "text": text,
            "language": "vi-VN",
            "return_base64": True,
            "voice_id": int(voice_id),
            "rate": rate,
        }
    elif voice_id.startswith("edge:"):
        payload = {
            "text": text,
            "language": "vi-VN",
            "return_base64": True,
            "engine": "edge",
            "voice": voice_id[len("edge:"):],
            "rate": rate,
            "pitch": "+0Hz",
        }
    elif voice_id.startswith("capcut:"):
        payload = {
            "text": text,
            "language": "vi-VN",
            "return_base64": True,
            "engine": "capcut",
            "voice": voice_id[len("capcut:"):],
            "rate": rate,
            "pitch": "+0Hz",
        }
    else:
        raise ValueError(f"voice_id không hợp lệ: {voice_id!r}")

    # Revid sinh giọng có thể chậm (text dài / API tải cao) → read timeout rộng, configurable.
    try:
        read_timeout = float(os.environ.get("REVID_READ_TIMEOUT") or "300")
    except ValueError:
        read_timeout = 300.0
    r = req.post(
        "https://tts.revidapi.com/api/v1/tts",
        json=payload,
        headers=headers,
        timeout=(10, read_timeout),  # (connect, read)
    )
    r.raise_for_status()
    data = r.json()
    audio_b64 = data.get("audio") or data.get("audio_base64") or data.get("data")
    if not audio_b64:
        raise RuntimeError(f"Revid API không trả về audio: {str(data)[:500]}")
    return base64.b64decode(audio_b64)


def _concat_to_mp3(parts: list[Path], out_mp3: Path) -> None:
    list_file = out_mp3.parent / f"{out_mp3.stem}_concat.txt"
    list_file.write_text("\n".join(f"file '{p}'" for p in parts), encoding="utf-8")
    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg_bin = (os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"
    subprocess.run(
        [ffmpeg_bin, "-y", "-loglevel", "error",
         "-f", "concat", "-safe", "0", "-i", str(list_file),
         "-codec:a", "libmp3lame", "-b:a", "128k", str(out_mp3)],
        check=True,
    )
    list_file.unlink(missing_ok=True)


def _process_revid_single(msg: dict, chapter_id: int) -> None:
    """Single-voice pipeline dùng Revid API → upload với type=single."""
    import time

    voice_id = (msg.get("voice_id") or "capcut:BV074_streaming").strip()
    text = normalize_tts_text(str(msg.get("text") or ""))
    if not text:
        print(f"[worker-tts] revid: chapter_id={chapter_id} text rỗng", file=sys.stderr)
        return

    # Hạ WORKER_TTS_MAX_CHARS (vd 4000) nếu Revid hay timeout — text ngắn sinh nhanh hơn.
    try:
        MAX_CHARS = max(500, int(os.environ.get("WORKER_TTS_MAX_CHARS") or "9000"))
    except ValueError:
        MAX_CHARS = 9000
    chunks: list[str] = []
    if len(text) <= MAX_CHARS:
        chunks = [text]
    else:
        buf = ""
        for word in text.split():
            if buf and len(buf) + 1 + len(word) > MAX_CHARS:
                chunks.append(buf)
                buf = word
            else:
                buf = f"{buf} {word}" if buf else word
        if buf:
            chunks.append(buf)

    n = len(chunks)
    # 1 chunk: Revid + Upload (2 bước). Nhiều chunk: N Revid + Ghép + Upload.
    total = n + (2 if n > 1 else 1)
    print(f"[worker-tts] chapter={chapter_id}  revid single: {n} chunk(s), voice={voice_id}", flush=True)

    work_dir = Path(tempfile.mkdtemp(prefix="revid_tts_"))
    segment_files: list[Path] = []
    try:
        for i, chunk in enumerate(chunks):
            _stage(chapter_id, i + 1, total, f"Chunk {i + 1}/{n} Revid API ({len(chunk)} chars) voice={voice_id}")
            success = False
            for attempt in range(1, 4):
                try:
                    mp3_bytes = _call_revid_tts(chunk, voice_id)
                    seg_path = work_dir / f"segment_{i + 1:03d}.mp3"
                    seg_path.write_bytes(mp3_bytes)
                    if seg_path.stat().st_size > 1000:
                        segment_files.append(seg_path)
                        success = True
                        break
                except Exception as e:
                    print(f"[worker-tts]   attempt {attempt} chunk {i + 1} lỗi: {e}", file=sys.stderr)
                    if attempt < 3:
                        time.sleep(3)
            if not success:
                print(f"[worker-tts] WARN: chunk {i + 1} thất bại — bỏ qua chapter", file=sys.stderr)
                return

        if not segment_files:
            print(f"[worker-tts] revid: chapter={chapter_id} không có segment hợp lệ", file=sys.stderr)
            return

        out_mp3 = work_dir / f"chapter_{chapter_id}_single.mp3"
        if len(segment_files) == 1:
            shutil.copyfile(segment_files[0], out_mp3)
        else:
            _stage(chapter_id, n + 1, total, f"Ghép {len(segment_files)} segments → MP3")
            _concat_to_mp3(segment_files, out_mp3)

        duration = _probe_duration_seconds(out_mp3)
        _stage(chapter_id, total, total, f"Upload lên backend API (type=single, {duration}s)")
        upload_audio(chapter_id, out_mp3, "chapter_single.mp3", "audio/mpeg", audio_type="single", duration=duration)
        print(f"[worker-tts] chapter={chapter_id}  revid single hoàn tất (upload OK)", flush=True)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def process_message(raw: str) -> None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[worker-tts] Bỏ qua JSON không hợp lệ: {e}", file=sys.stderr)
        return

    chapter_id = msg.get("chapter_id")
    if chapter_id is None:
        print(f"[worker-tts] Thiếu chapter_id: {msg!r}", file=sys.stderr)
        return
    try:
        chapter_id = int(chapter_id)
    except (TypeError, ValueError):
        print(f"[worker-tts] chapter_id không phải số: {msg!r}", file=sys.stderr)
        return

    voice_id = (msg.get("voice_id") or "").strip()
    if not voice_id:
        print(f"[worker-tts] single mode thiếu voice_id: {msg!r}", file=sys.stderr)
        return
    _process_revid_single(msg, chapter_id)


def main() -> int:
    load_local_env()
    if not internal_token():
        print(
            "[worker-tts] Thiếu WORKER_TTS_INTERNAL_TOKEN.\n"
            "  • Backend + worker phải cùng một token (backend/.env và worker-tts/.env).\n"
            "  • Sinh token: trong thư mục backend chạy: php artisan worker-tts:internal-token\n"
            "    rồi copy dòng WORKER_TTS_INTERNAL_TOKEN=... vào cả hai file .env.\n"
            "  • Docker: docker compose --profile worker-tts up — cần file worker-tts/.env (xem env_file trong compose).",
            file=sys.stderr,
        )
        return 1

    import time

    import redis as _redis

    key = queue_key()
    print(f"[worker-tts] Sẵn sàng. Queue={key!r} BLPOP, backend={backend_base_url()!r}")

    r = redis_client()
    while True:
        try:
            # timeout hữu hạn: hết thời gian server trả None → loop lại, không giữ socket vô hạn.
            item = r.blpop(key, timeout=5)
        except _redis.exceptions.TimeoutError:
            continue  # không có job trong cửa sổ chờ — bình thường
        except _redis.exceptions.ConnectionError as e:
            print(f"[worker-tts] Redis mất kết nối, thử lại sau 2s: {e}", file=sys.stderr)
            time.sleep(2)
            r = redis_client()
            continue
        if not item:
            continue
        _list_key, raw = item
        print(f"[worker-tts] Nhận job, raw_len={len(raw)}")
        try:
            process_message(raw)
        except Exception as e:  # noqa: BLE001
            print(f"[worker-tts] Lỗi xử lý: {e}", file=sys.stderr)
            traceback.print_exc()


if __name__ == "__main__":
    raise SystemExit(main())
