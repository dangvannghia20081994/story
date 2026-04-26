"""
TTS qua VieNeu (gói PyPI `vieneu`) — on-device, tiếng Việt.
Cần cài worker với index wheel llama-cpp (xem worker/README.md và Dockerfile).
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading
from pathlib import Path

from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Trùng thứ tự preset VieNeu `list_preset_voices()` — key = voice_id từ CMS/queue (1–4).
VIENEU_PRESET_BY_SLOT: dict[str, str] = {
    "1": "Bích Ngọc (Nữ - Miền Bắc)",
    "2": "Phạm Tuyên (Nam - Miền Bắc)",
    "3": "Thục Đoan (Nữ - Miền Nam)",
    "4": "Xuân Vĩnh (Nam - Miền Nam)",
}

_tts_lock = threading.Lock()
_tts_instance = None


def resolve_vieneu_preset_key(raw: str | None) -> str | None:
    """Đổi voice_id ngắn (1–4) thành mã preset đầy đủ cho SDK; giữ nguyên nếu đã là tên preset."""
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None
    return VIENEU_PRESET_BY_SLOT.get(s, s)


def _get_vieneu():
    global _tts_instance
    with _tts_lock:
        if _tts_instance is None:
            from app.config import settings  # noqa: PLC0415

            tok = (settings.hf_token or "").strip()
            if tok:
                os.environ["HF_TOKEN"] = tok

            from vieneu import Vieneu  # noqa: PLC0415

            _tts_instance = Vieneu()
            logger.info("Vieneu TTS: model/SDK initialized")
        return _tts_instance


def synthesize_vieneu_to_file(
    *,
    text: str,
    out_path: Path,
    job_label: str = "",
    preset_voice_id: str | None = None,
) -> int:
    """
    Sinh MP3 bằng VieNeu; trả về độ dài giây (làm tròn).
    """
    prefix = f"{job_label}: " if job_label else ""
    t = (text or "").strip()
    if len(t) < 1:
        raise ValueError("Vieneu TTS: cần ít nhất một ký tự văn bản.")

    tts = _get_vieneu()
    voice = None
    pid = resolve_vieneu_preset_key(preset_voice_id)
    if pid:
        try:
            voice = tts.get_preset_voice(pid)
            logger.info("%sVieneu TTS: preset=%r", prefix, pid)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "%sVieneu TTS: không load được preset %r (%s) — dùng giọng mặc định",
                prefix,
                pid,
                exc,
            )

    if voice is not None:
        audio = tts.infer(text=t, voice=voice)
    else:
        audio = tts.infer(text=t)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
        wav_path = Path(tmp_wav.name)

    try:
        tts.save(audio, str(wav_path))
        seg = AudioSegment.from_wav(str(wav_path))
        seg.export(str(out_path), format="mp3", bitrate="192k")
        duration_s = max(1, int(round(len(seg) / 1000.0)))
        logger.info(
            "%sVieneu TTS done: duration_rounded_s=%d path=%s",
            prefix,
            duration_s,
            out_path,
        )
        return duration_s
    finally:
        wav_path.unlink(missing_ok=True)
