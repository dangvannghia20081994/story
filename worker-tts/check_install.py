#!/usr/bin/env python3
"""Kiểm tra môi trường sau khi cài requirements.txt (worker-tts)."""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def _normalize_upload_format(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    for curly, asc in (("\u2018", "'"), ("\u2019", "'"), ("\u201c", '"'), ("\u201d", '"')):
        s = s.replace(curly, asc)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        s = s[1:-1].strip().lower()
    return s


def _resolve_reference_audio() -> Path:
    raw = (os.environ.get("REFERENCE_AUDIO_PATH") or "").strip()
    if raw:
        p = Path(raw).expanduser()
        if not p.is_absolute():
            p = SCRIPT_DIR / p
    else:
        p = SCRIPT_DIR / "input.wav"
    return p.resolve()


def main() -> int:
    try:
        from vieneu import Vieneu  # noqa: F401
    except ImportError as e:
        print("Lỗi import vieneu:", e, file=sys.stderr)
        print("Chạy: pip install -r requirements.txt", file=sys.stderr)
        return 1

    print("OK: import Vieneu")

    ref = _resolve_reference_audio()
    if not ref.is_file():
        print(
            f"Cảnh báo: không thấy file giọng mẫu REFERENCE_AUDIO_PATH → {ref}",
            file=sys.stderr,
        )
        print(
            "  Đặt file WAV/MP3 (3–10s) vào worker-tts/ và trong .env đặt REFERENCE_AUDIO_PATH=input.wav "
            "(hoặc đường dẫn tuyệt đối Windows). Không dùng /app/input.mp3 khi chạy ngoài Docker — "
            "trên Windows đường dẫn đó trỏ tới ổ đĩa (vd. C:\\app\\...) và không tồn tại.",
            file=sys.stderr,
        )
        return 0
    print(f"OK: file giọng mẫu tồn tại ({ref.name})")

    if not shutil.which("espeak-ng"):
        print(
            "Cảnh báo: không thấy lệnh `espeak-ng` trong PATH — VieNeu cần eSpeak NG để phát âm tiếng Việt.",
            file=sys.stderr,
        )
        print("  Ubuntu/Debian: sudo apt install espeak-ng", file=sys.stderr)
        print(
            "  Windows: MSI từ https://github.com/espeak-ng/espeak-ng/releases — tick thêm PATH, "
            "hoặc thêm thư mục cài (vd. C:\\Program Files\\eSpeak NG\\) vào biến PATH rồi mở lại terminal.",
            file=sys.stderr,
        )
        return 0

    print("OK: espeak-ng có trong PATH")

    fmt = _normalize_upload_format(os.environ.get("WORKER_TTS_UPLOAD_FORMAT") or "wav")
    if fmt == "aac":
        fmt = "m4a"
    if fmt not in ("wav", "mp3", "m4a"):
        fmt = "wav"
    if fmt in ("mp3", "m4a") and not shutil.which((os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"):
        print(
            "Cảnh báo: WORKER_TTS_UPLOAD_FORMAT=%s nhưng không thấy ffmpeg — cần cài ffmpeg để upload."
            % (fmt,),
            file=sys.stderr,
        )
        return 0

    if fmt in ("mp3", "m4a"):
        print("OK: ffmpeg có trong PATH (upload %s)" % fmt)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
