"""
FPT.AI Speech — Text to Speech v5.
Tài liệu: https://docs.fpt.ai/docs/en/speech/api/text-to-speech/
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def synthesize_to_file(*, text: str, out_path: Path) -> int:
    """
    Gọi FPT TTS, chờ file tại URL async, ghi ra out_path.
    Trả về độ dài giây (làm tròn), ước lượng qua pydub nếu có.
    """
    key = settings.fpt_api_key
    if not key:
        raise RuntimeError("FPT_API_KEY is not set (worker environment).")

    t = text.strip()
    if len(t) < 3:
        raise ValueError("FPT TTS requires at least 3 characters in the body.")
    if len(t) > 5000:
        raise ValueError("FPT TTS limit is 5000 characters per request.")

    headers = {
        "api_key": key,
        "voice": settings.fpt_voice,
        "speed": settings.fpt_speed,
        "format": settings.fpt_format,
        "Cache-Control": "no-cache",
    }

    with httpx.Client(timeout=60.0) as client:
        r = client.post(
            settings.fpt_tts_url,
            content=t.encode("utf-8"),
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()

    if int(data.get("error", -1)) != 0:
        raise RuntimeError(data.get("message") or f"FPT TTS error: {data!r}")

    async_url = data.get("async")
    if not async_url:
        raise RuntimeError(f"FPT response missing async URL: {data!r}")

    audio_bytes = _poll_async_mp3(async_url)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(audio_bytes)

    return _duration_seconds(out_path)


def _poll_async_mp3(url: str) -> bytes:
    deadline = time.monotonic() + settings.fpt_poll_timeout_sec
    last_status: int | None = None
    while time.monotonic() < deadline:
        try:
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                resp = client.get(url)
            last_status = resp.status_code
            if resp.status_code == 200 and len(resp.content) > 500:
                return resp.content
        except httpx.HTTPError as exc:
            logger.debug("Poll async URL: %s", exc)
        time.sleep(settings.fpt_poll_interval_sec)

    raise TimeoutError(
        f"FPT async audio not ready after {settings.fpt_poll_timeout_sec}s (last HTTP {last_status})"
    )


def _duration_seconds(path: Path) -> int:
    try:
        from pydub import AudioSegment

        return int(round(AudioSegment.from_file(str(path)).duration_seconds))
    except Exception:  # noqa: BLE001
        return 0
