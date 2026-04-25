import json
import logging
import subprocess
from pathlib import Path

import httpx

from app.config import settings
from app.fpt_tts import synthesize_to_file

logger = logging.getLogger(__name__)


def _safe_id(value: int) -> str:
    return str(int(value))


def _output_relative_path(*, story_id: int, chapter_id: int | None) -> str:
    if chapter_id is not None:
        return f"stories/{_safe_id(story_id)}/chapters/{_safe_id(chapter_id)}/audio.mp3"
    return f"stories/{_safe_id(story_id)}/audio.mp3"


def render_audio_mp3(*, story_id: int, chapter_id: int | None, text: str) -> tuple[str, int]:
    """
    Sinh file MP3 theo TTS_PROVIDER.
    Trả về (đường dẫn tương đối trên disk public, duration giây).
    """
    rel = _output_relative_path(story_id=story_id, chapter_id=chapter_id)
    root = Path(settings.storage_public_root)
    out = root / rel

    if settings.tts_provider == "fpt":
        duration = synthesize_to_file(text=text, out_path=out)
        return rel, duration

    # ffmpeg — placeholder im (không dùng FPT)
    _ = text
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        settings.ffmpeg_path,
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=44100:cl=mono",
        "-t",
        "3",
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        str(out),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return rel, 3


def notify_backend(
    *,
    story_id: int,
    chapter_id: int | None,
    status: str,
    audio_path: str | None,
    error: str | None,
    duration: int | None = None,
) -> None:
    url = f"{settings.backend_url.rstrip('/')}/api/internal/tts-complete"
    payload: dict = {
        "story_id": story_id,
        "status": status,
        "audio_path": audio_path,
        "error": error,
    }
    if chapter_id is not None:
        payload["chapter_id"] = chapter_id
    if duration is not None:
        payload["duration"] = duration
    headers = {
        "Authorization": f"Bearer {settings.worker_token}",
        "Accept": "application/json",
    }
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        r = client.post(url, json=payload, headers=headers)
        r.raise_for_status()


def handle_job(raw: bytes) -> None:
    data = json.loads(raw.decode("utf-8"))
    story_id = int(data["story_id"])
    text = str(data.get("text") or "")
    chapter_id = data.get("chapter_id")
    if chapter_id is None:
        logger.error("Job missing chapter_id; drop or upgrade producer (Laravel).")
        return
    cid = int(chapter_id)

    if settings.tts_provider == "fpt" and not settings.fpt_api_key:
        logger.error("TTS_PROVIDER=fpt but FPT_API_KEY is empty — set env or use TTS_PROVIDER=ffmpeg.")
        try:
            notify_backend(
                story_id=story_id,
                chapter_id=cid,
                status="failed",
                audio_path=None,
                error="Worker misconfiguration: FPT_API_KEY missing",
            )
        except Exception:
            logger.exception("Failed to report misconfiguration to backend")
        return

    try:
        rel_path, duration = render_audio_mp3(story_id=story_id, chapter_id=cid, text=text)
        notify_backend(
            story_id=story_id,
            chapter_id=cid,
            status="completed",
            audio_path=rel_path,
            error=None,
            duration=duration,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("TTS job failed")
        try:
            notify_backend(
                story_id=story_id,
                chapter_id=cid,
                status="failed",
                audio_path=None,
                error=str(exc),
            )
        except Exception:
            logger.exception("Failed to report error to backend")
