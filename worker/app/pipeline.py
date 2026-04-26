import json
import logging
import subprocess
import tempfile
from pathlib import Path

import httpx

from app.config import settings
from app.fpt_tts import synthesize_to_file

logger = logging.getLogger(__name__)


def _fpt_voice_from_queue_payload(data: dict) -> str | None:
    """
    Laravel gửi voice_segments: segment đầu = giọng người kể (TTS_NARRATOR_CHARACTER_NAME).
    Mã vi-VN-* = Azure Speech (worker FPT không dùng) → bỏ qua, dùng FPT_TTS_VOICE.
    Tên FPT (banmai, lannhi, …) → dùng cho request FPT.
    """
    if not isinstance(data, dict):
        return None
    segs = data.get("voice_segments")
    if not isinstance(segs, list) or not segs:
        return None
    first = segs[0]
    if not isinstance(first, dict):
        return None
    vid = (first.get("voice_id") or "").strip()
    if not vid or vid.startswith("vi-VN-"):
        return None
    return vid


def render_audio_mp3_bytes(
    *,
    story_id: int,
    chapter_id: int,
    text: str,
    fpt_voice: str | None = None,
) -> tuple[bytes, int]:
    """
    Sinh MP3 theo TTS_PROVIDER vào file tạm; trả về (nội dung bytes, duration giây).
    """
    job_label = f"story_id={story_id} chapter_id={chapter_id}"
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        if settings.tts_provider == "fpt":
            duration = synthesize_to_file(
                text=text,
                out_path=tmp_path,
                job_label=job_label,
                fpt_voice=fpt_voice,
            )
        else:
            _ = text
            logger.info(
                "%s: TTS ffmpeg placeholder (ignoring text_chars=%d)",
                job_label,
                len(text or ""),
            )
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
                str(tmp_path),
            ]
            subprocess.run(cmd, check=True, capture_output=True)
            duration = 3

        return tmp_path.read_bytes(), duration
    finally:
        tmp_path.unlink(missing_ok=True)


def notify_backend_completed_upload(
    *,
    story_id: int,
    chapter_id: int,
    duration: int,
    audio_bytes: bytes,
) -> None:
    url = f"{settings.backend_url.rstrip('/')}/api/internal/tts-complete"
    headers = {
        "Authorization": f"Bearer {settings.worker_token}",
        "Accept": "application/json",
    }
    data = {
        "story_id": str(story_id),
        "chapter_id": str(chapter_id),
        "status": "completed",
        "duration": str(duration),
    }
    files = {"audio": ("audio.mp3", audio_bytes, "audio/mpeg")}
    timeout = httpx.Timeout(300.0, connect=30.0)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            r = client.post(url, data=data, files=files, headers=headers)
    except httpx.RequestError as exc:
        logger.warning(
            "Cannot reach backend to upload TTS (start Laravel: php artisan serve — BACKEND_URL=%s): %s",
            settings.backend_url,
            exc,
        )
        raise RuntimeError(
            f"TTS file ready but backend unreachable at {settings.backend_url!r}: {exc}"
        ) from exc
    logger.info(
        "Backend tts-complete (multipart): story_id=%s chapter_id=%s http=%s audio_bytes=%d",
        story_id,
        chapter_id,
        r.status_code,
        len(audio_bytes),
    )
    if r.status_code >= 400:
        logger.error(
            "Backend tts-complete error body: %s",
            (r.text or "")[:500],
        )
    r.raise_for_status()


def notify_backend(
    *,
    story_id: int,
    chapter_id: int | None,
    status: str,
    audio_path: str | None,
    error: str | None,
    duration: int | None = None,
) -> None:
    """JSON callback (failed hoặc tương thích cũ)."""
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
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.post(url, json=payload, headers=headers)
    except httpx.RequestError as exc:
        logger.warning(
            "Cannot report TTS result to backend (is Laravel running? BACKEND_URL=%s): %s",
            settings.backend_url,
            exc,
        )
        return
    logger.info(
        "Backend tts-complete (json): story_id=%s chapter_id=%s status=%s http=%s",
        story_id,
        chapter_id,
        status,
        r.status_code,
    )
    if r.status_code >= 400:
        logger.error(
            "Backend tts-complete (json) error body: %s",
            (r.text or "")[:500],
        )
        return


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
        notify_backend(
            story_id=story_id,
            chapter_id=cid,
            status="failed",
            audio_path=None,
            error="Worker misconfiguration: FPT_API_KEY missing",
        )
        return

    try:
        logger.info(
            "TTS job start: story_id=%s chapter_id=%s text_chars=%d provider=%s",
            story_id,
            cid,
            len(text),
            settings.tts_provider,
        )
        fpt_v = _fpt_voice_from_queue_payload(data) if settings.tts_provider == "fpt" else None
        if fpt_v:
            logger.info(
                "TTS FPT voice from queue (narrator segment): %s (override FPT_TTS_VOICE)",
                fpt_v,
            )
        audio_bytes, duration = render_audio_mp3_bytes(
            story_id=story_id,
            chapter_id=cid,
            text=text,
            fpt_voice=fpt_v,
        )
        logger.info(
            "TTS job render ok: story_id=%s chapter_id=%s duration_s=%s mp3_bytes=%d",
            story_id,
            cid,
            duration,
            len(audio_bytes),
        )
        notify_backend_completed_upload(
            story_id=story_id,
            chapter_id=cid,
            duration=duration,
            audio_bytes=audio_bytes,
        )
        logger.info(
            "TTS job finished: story_id=%s chapter_id=%s (callback sent)",
            story_id,
            cid,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception(
            "TTS job failed: story_id=%s chapter_id=%s provider=%s",
            story_id,
            cid,
            settings.tts_provider,
        )
        notify_backend(
            story_id=story_id,
            chapter_id=cid,
            status="failed",
            audio_path=None,
            error=str(exc),
        )
