import json
import logging
import subprocess
import tempfile
from pathlib import Path

import httpx

from pydub import AudioSegment

from app.audio_stitcher import stitcher
from app.config import settings
from app.vieneu_tts import synthesize_vieneu_to_file

logger = logging.getLogger(__name__)

# Log preview từng segment (tránh log cả chương).
_JOB_TEXT_PREVIEW_CHARS = 160


def _log_redis_job_summary(data: dict, *, payload_bytes: int) -> None:
    """Ghi log nội dung job sau khi decode JSON (tóm tắt, không dump full text)."""
    top = str(data.get("text") or "")
    raw_segs = data.get("voice_segments")
    seg_rows: list[dict] = []
    if isinstance(raw_segs, list):
        for i, item in enumerate(raw_segs):
            if not isinstance(item, dict):
                seg_rows.append({"i": i, "error": "not_a_dict"})
                continue
            t = str(item.get("text") or "")
            prev = t[:_JOB_TEXT_PREVIEW_CHARS] + ("…" if len(t) > _JOB_TEXT_PREVIEW_CHARS else "")
            seg_rows.append(
                {
                    "i": i,
                    "voice_id": item.get("voice_id"),
                    "pitch": item.get("pitch"),
                    "rate": item.get("rate"),
                    "text_chars": len(t),
                    "text_preview": prev,
                }
            )
    extra_keys = [k for k in sorted(data.keys()) if k not in ("story_id", "chapter_id", "text", "voice_segments")]
    try:
        seg_json = json.dumps(seg_rows, ensure_ascii=False)
    except (TypeError, ValueError):
        seg_json = str(seg_rows)
    logger.info(
        "Redis job JSON: bytes=%d story_id=%s chapter_id=%s top_level_text_chars=%d "
        "voice_segments_count=%d segments=%s extra_keys=%s",
        payload_bytes,
        data.get("story_id"),
        data.get("chapter_id"),
        len(top),
        len(seg_rows),
        seg_json,
        extra_keys,
    )


def _voice_segments_list(data: dict) -> list[dict]:
    """Chuẩn hoá voice_segments từ job; luôn trả list không rỗng (fallback text toàn chương)."""
    fallback = str(data.get("text") or "").strip()
    raw = data.get("voice_segments")
    if not isinstance(raw, list) or not raw:
        return [{"voice_id": None, "text": fallback, "pitch": 1.0, "rate": 1.0}]
    out: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        t = str(item.get("text") or "").strip()
        if not t:
            continue
        vid = (item.get("voice_id") or "").strip() or None
        try:
            pitch = float(item.get("pitch", 1.0))
        except (TypeError, ValueError):
            pitch = 1.0
        try:
            rate = float(item.get("rate", 1.0))
        except (TypeError, ValueError):
            rate = 1.0
        out.append({"voice_id": vid, "text": t, "pitch": pitch, "rate": rate})
    if not out:
        return [{"voice_id": None, "text": fallback, "pitch": 1.0, "rate": 1.0}]
    return out


def _vieneu_preset_for_segment(seg_index: int, seg_voice_id: str | None) -> str | None:
    """VIENEU_PRESET_VOICE_ID chỉ ghi đè segment đầu (giữ hành vi cũ)."""
    if seg_index == 0:
        env = (settings.vieneu_preset_voice_id or "").strip() or None
        if env:
            return env
    return seg_voice_id


def render_audio_mp3_bytes(
    *,
    story_id: int,
    chapter_id: int,
    segments: list[dict],
) -> tuple[bytes, int]:
    """
    Sinh MP3 theo TTS_PROVIDER vào file tạm; trả về (nội dung bytes, duration giây).
    Mỗi phần tử segments: voice_id, text, pitch, rate (pitch/rate dành cho provider sau; VieNeu hiện chỉ dùng voice).
    """
    job_label = f"story_id={story_id} chapter_id={chapter_id}"
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        if settings.tts_provider == "vieneu":
            n = len(segments)
            if n == 1:
                seg = segments[0]
                preset = _vieneu_preset_for_segment(0, seg.get("voice_id"))
                duration = synthesize_vieneu_to_file(
                    text=str(seg.get("text") or ""),
                    out_path=tmp_path,
                    job_label=job_label,
                    preset_voice_id=preset,
                )
            else:
                logger.info("%s: VieNeu multi-segment n=%d", job_label, n)
                with tempfile.TemporaryDirectory() as tmpdir:
                    part_paths: list[Path] = []
                    for i, seg in enumerate(segments):
                        preset = _vieneu_preset_for_segment(i, seg.get("voice_id"))
                        part = Path(tmpdir) / f"seg_{i}.mp3"
                        synthesize_vieneu_to_file(
                            text=str(seg.get("text") or ""),
                            out_path=part,
                            job_label=f"{job_label} seg={i + 1}/{n}",
                            preset_voice_id=preset,
                        )
                        part_paths.append(part)
                    loaded = [AudioSegment.from_file(str(p), format="mp3") for p in part_paths]
                    combined = stitcher.concatenate_segments(loaded, silence_between_ms=450)
                    combined.export(str(tmp_path), format="mp3", bitrate="192k")
                    duration = max(1, int(round(len(combined) / 1000.0)))
        else:
            total_chars = sum(len(str(s.get("text") or "")) for s in segments)
            logger.info(
                "%s: TTS ffmpeg placeholder (segments=%d text_chars~=%d)",
                job_label,
                len(segments),
                total_chars,
            )
            per = max(1, min(4, 12 // max(len(segments), 1)))
            with tempfile.TemporaryDirectory() as tmpdir:
                loaded: list[AudioSegment] = []
                for i, _seg in enumerate(segments):
                    p = Path(tmpdir) / f"ff_{i}.mp3"
                    cmd = [
                        settings.ffmpeg_path,
                        "-y",
                        "-f",
                        "lavfi",
                        "-i",
                        "anullsrc=r=44100:cl=mono",
                        "-t",
                        str(per),
                        "-q:a",
                        "9",
                        "-acodec",
                        "libmp3lame",
                        str(p),
                    ]
                    subprocess.run(cmd, check=True, capture_output=True)
                    loaded.append(AudioSegment.from_file(str(p), format="mp3"))
                combined = stitcher.concatenate_segments(loaded, silence_between_ms=200)
                combined.export(str(tmp_path), format="mp3", bitrate="192k")
                duration = max(1, int(round(len(combined) / 1000.0)))

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
    payload_bytes = len(raw)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        logger.exception(
            "Redis job UTF-8 decode failed: bytes=%d head=%r",
            payload_bytes,
            raw[:120],
        )
        return
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.exception(
            "Redis job JSON parse failed: bytes=%d head=%s",
            payload_bytes,
            text[:400],
        )
        return
    if not isinstance(data, dict):
        logger.error("Redis job root JSON is not object: type=%s", type(data).__name__)
        return

    _log_redis_job_summary(data, payload_bytes=payload_bytes)

    story_id = int(data["story_id"])
    chapter_id = data.get("chapter_id")
    if chapter_id is None:
        logger.error("Job missing chapter_id; drop or upgrade producer (Laravel).")
        return
    cid = int(chapter_id)

    try:
        segments = _voice_segments_list(data)
        text_chars = sum(len(str(s.get("text") or "")) for s in segments)
        logger.info(
            "TTS job start (normalized): story_id=%s chapter_id=%s text_chars=%d voice_segments=%d provider=%s",
            story_id,
            cid,
            text_chars,
            len(segments),
            settings.tts_provider,
        )
        audio_bytes, duration = render_audio_mp3_bytes(
            story_id=story_id,
            chapter_id=cid,
            segments=segments,
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
