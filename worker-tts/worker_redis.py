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
import re
import shutil
import subprocess
import sys
import tempfile
import traceback
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def load_local_env() -> None:
    """Khi chạy trực tiếp `python worker_redis.py`, nạp worker-tts/.env (Docker dùng env_file, không bắt buộc file trong image)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    path = SCRIPT_DIR / ".env"
    if path.is_file():
        load_dotenv(path, override=False)


def _stage(chapter_id: int, step: int, total: int, label: str) -> None:
    """In tiến độ theo giai đoạn (không phải % nội bộ model)."""
    print(f"[worker-tts] chapter={chapter_id}  [{step}/{total}] {label}", flush=True)


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


_ZW_RE = re.compile("[\u200b\u200c\u200d\ufeff]")


def normalize_tts_text(text: str) -> str:
    """Bỏ dòng trống / dòng chỉ khoảng trắng, ký tự zero-width; gộp đoạn bằng một space (tránh khoảng lặng kỳ khi infer)."""
    text = _ZW_RE.sub("", text)
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
    return out.strip()


def upload_audio_format() -> str:
    """Định dạng gửi API: wav | mp3 | m4a (WORKER_TTS_UPLOAD_FORMAT)."""
    raw = (os.environ.get("WORKER_TTS_UPLOAD_FORMAT") or "wav").strip().lower()
    if raw in ("mav", "aac"):  # typo / alias
        raw = "m4a"
    if raw not in ("wav", "mp3", "m4a"):
        return "wav"
    return raw


def ffmpeg_audio_bitrate() -> str:
    return (os.environ.get("WORKER_TTS_FFMPEG_AUDIO_BITRATE") or "192k").strip() or "192k"


def _ffmpeg_wav_to(src_wav: Path, dst: Path, fmt: str) -> None:
    ffmpeg = (os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"
    br = ffmpeg_audio_bitrate()
    if fmt == "mp3":
        cmd = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(src_wav),
            "-vn",
            "-c:a",
            "libmp3lame",
            "-b:a",
            br,
            str(dst),
        ]
    elif fmt == "m4a":
        cmd = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(src_wav),
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            br,
            str(dst),
        ]
    else:
        raise ValueError(fmt)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "").strip()
        raise RuntimeError(f"ffmpeg lỗi (exit {r.returncode}): {err[:2000]}")


def build_upload_payload(wav_path: Path, fmt: str) -> tuple[Path, str, str]:
    """
    Trả về (đường_dẫn_file_gửi, tên_multipart, content_type).
    Nếu fmt != wav, tạo file cạnh wav_path cùng basename — caller phải xóa khi khác wav_path.
    """
    if fmt == "wav":
        return wav_path, "chapter.wav", "audio/wav"
    if fmt == "mp3":
        out = wav_path.with_suffix(".mp3")
        _ffmpeg_wav_to(wav_path, out, "mp3")
        return out, "chapter.mp3", "audio/mpeg"
    if fmt == "m4a":
        out = wav_path.with_suffix(".m4a")
        _ffmpeg_wav_to(wav_path, out, "m4a")
        return out, "chapter.m4a", "audio/mp4"
    raise ValueError(fmt)


def upload_audio(chapter_id: int, file_path: Path, multipart_name: str, content_type: str) -> None:
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

    text = normalize_tts_text(str(text))
    if not text:
        print(f"[worker-tts] Text rỗng sau khi chuẩn hoá (bỏ dòng trống): chapter_id={chapter_id}", file=sys.stderr)
        return
    out_fmt = upload_audio_format()
    total = 6 if out_fmt != "wav" else 5
    _stage(chapter_id, 1, total, f"Chuẩn bị — độ dài text={len(text)} ký tự, upload_format={out_fmt!r}")

    _stage(chapter_id, 2, total, "Encode giọng tham chiếu (reference)")
    voice = tts.encode_reference(str(ref))

    _stage(chapter_id, 3, total, "Tổng hợp giọng (infer — có thể lâu)")
    audio = tts.infer(text=text, voice=voice)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_wav = Path(tmp.name)
    encoded_path: Path | None = None
    try:
        _stage(chapter_id, 4, total, "Ghi file WAV tạm")
        tts.save(audio, str(tmp_wav))
        if out_fmt != "wav":
            _stage(chapter_id, 5, total, f"ffmpeg: WAV → {out_fmt.upper()}")
            upload_path, multipart_name, mime = build_upload_payload(tmp_wav, out_fmt)
            if upload_path != tmp_wav:
                encoded_path = upload_path
            step_upload = 6
        else:
            upload_path, multipart_name, mime = build_upload_payload(tmp_wav, "wav")
            step_upload = 5
        _stage(chapter_id, step_upload, total, "Upload lên backend API")
        upload_audio(chapter_id, upload_path, multipart_name, mime)
        print(f"[worker-tts] chapter={chapter_id}  hoàn tất (upload OK)", flush=True)
    finally:
        tmp_wav.unlink(missing_ok=True)
        if encoded_path is not None:
            encoded_path.unlink(missing_ok=True)


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

    fmt = upload_audio_format()
    if fmt != "wav" and not shutil.which((os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"):
        print(
            "[worker-tts] WORKER_TTS_UPLOAD_FORMAT=%s nhưng không tìm thấy ffmpeg trong PATH.\n"
            "  Cài: Debian/Ubuntu `apt install ffmpeg`, hoặc đặt FFMPEG_PATH đến binary."
            % (fmt,),
            file=sys.stderr,
        )
        return 1

    try:
        from vieneu import Vieneu
    except ImportError as e:
        print(e, file=sys.stderr)
        return 1

    key = queue_key()
    print(f"[worker-tts] Khởi tạo VieNeu (có thể tải model lần đầu)...")
    tts = Vieneu()
    print(
        f"[worker-tts] Sẵn sàng. Queue={key!r} BLPOP, reference={reference_audio_path()}, "
        f"WORKER_TTS_UPLOAD_FORMAT={fmt!r}"
    )

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
