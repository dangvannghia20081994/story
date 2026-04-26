"""
pydub dùng ffmpeg (export) và ffprobe (mediainfo khi from_file/BytesIO).

Thêm thư mục chứa ffmpeg vào PATH — áp dụng mọi OS (Linux/Docker gồm). Windows
(Laragon, v.v.) hay gặp binary ngoài PATH nên cần FFMPEG_PATH; image Docker thường
đã có ffmpeg+ffprobe trong /usr/bin — không cần set thêm nếu `which` tìm được cả hai.
"""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

_configured: bool = False


def ensure_pydub_ffmpeg() -> None:
    """Gọi sớm khi khởi động worker (một lần)."""
    global _configured
    if _configured:
        return
    _configured = True

    from app.config import settings

    raw = (settings.ffmpeg_path or "ffmpeg").strip() or "ffmpeg"
    p: Path | None = None
    if Path(raw).is_file():
        p = Path(raw).resolve()
    else:
        w = shutil.which(raw)
        if w:
            p = Path(w).resolve()

    # AudioSegment sets converter via get_encoder_name() at import time (PATH only).
    if p is not None and p.is_file():
        bin_dir = str(p.parent)
        old = os.environ.get("PATH", "")
        parts = [x for x in old.split(os.pathsep) if x]
        if bin_dir and bin_dir not in parts:
            os.environ["PATH"] = bin_dir + os.pathsep + old

    from pydub import AudioSegment

    if p is not None and p.is_file():
        AudioSegment.converter = str(p)
        # ffprobe cùng thư mục — pydub gọi tên lệnh "ffprobe" sau khi PATH đã có bin_dir
        logger.info("pydub: ffmpeg=%s (PATH thêm thư mục chứa ffmpeg/ffprobe)", p)
        return

    w = shutil.which("ffmpeg")
    wq = shutil.which("ffprobe")
    if w and wq:
        AudioSegment.converter = w
        logger.info("pydub: dùng ffmpeg=%s ffprobe=%s từ PATH", w, wq)
        return

    logger.warning(
        "pydub: không tìm thấy ffmpeg+ffprobe (FFMPEG_PATH=%r). Cài FFmpeg, thêm "
        "thư mục bin vào PATH, hoặc FFMPEG_PATH=đường_dẫn_đầy_đủ_tới_ffmpeg (cùng "
        "thư mục với ffprobe).",
        settings.ffmpeg_path,
    )
