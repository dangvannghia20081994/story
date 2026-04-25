"""
FPT.AI Speech — Text to Speech v5.
Tài liệu: https://docs.fpt.ai/docs/en/speech/api/text-to-speech/
"""

from __future__ import annotations

import json
import logging
import time
from io import BytesIO
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import httpx
from pydub import AudioSegment

try:
    from pydub.exceptions import CouldntDecodeError
except ImportError:  # pragma: no cover — pydub cũ
    CouldntDecodeError = Exception  # type: ignore[misc,assignment]

from app.audio_stitcher import DEFAULT_CHANNELS, DEFAULT_SAMPLE_RATE
from app.config import settings

logger = logging.getLogger(__name__)

# Mỗi request body: 3–5000 ký tự (UTF-8) theo tài liệu FPT.
FPT_MAX_BODY_CHARS = 5000
MIN_FPT_CHARS = 3

_POLL_LOG_INTERVAL_SEC = 15.0

_FPT_ASYNC_POLL_HEADERS_BASE = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "audio/mpeg,audio/*,*/*;q=0.9",
    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
    "Referer": "https://api.fpt.ai/",
}


def _async_poll_headers() -> dict[str, str]:
    h = dict(_FPT_ASYNC_POLL_HEADERS_BASE)
    key = (settings.fpt_api_key or "").strip()
    if key:
        h["api_key"] = key
    return h


def _response_is_ready_mp3(resp: httpx.Response) -> bool:
    """True khi CDN đã trả nội dung giống file MP3 (tránh HTML/JSON placeholder)."""
    if resp.status_code != 200:
        return False
    body = resp.content or b""
    if len(body) < 24:
        return False
    ct = (resp.headers.get("content-type") or "").lower()
    looks_audio_ct = "mpeg" in ct or "audio" in ct or "octet-stream" in ct
    # ID3 tag hoặc frame sync MPEG-Audio layer 3 — bắt buộc có magic, không dùng heuristic chỉ theo size
    mp3_magic = body[:3] == b"ID3" or (body[0] == 0xFF and (body[1] & 0xE0) == 0xE0)
    if not mp3_magic:
        return False
    if looks_audio_ct:
        return True
    # Một số CDN trả octet-stream không chuẩn; vẫn cần magic + body đủ dài để không nhầm vài byte ngẫu nhiên
    return len(body) >= 128


def _normalize_segment_for_concat(seg: AudioSegment) -> AudioSegment:
    """
    FPT có thể trả mp3 khác sample rate / mono-stereo giữa các chunk.
    Toán tử + của pydub cần cùng frame_rate, channels, sample_width.
    """
    return (
        seg.set_frame_rate(DEFAULT_SAMPLE_RATE)
        .set_channels(DEFAULT_CHANNELS)
        .set_sample_width(2)
    )


def _shorten_for_log(s: str, max_len: int = 96) -> str:
    s = s.strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _fpt_post_json_for_log(data: dict) -> str:
    """JSON phản hồi POST TTS để log (rút gọn URL async)."""
    out: dict = {}
    for k, v in data.items():
        if k == "async" and isinstance(v, str):
            out[k] = _shorten_for_log(v, 160)
        else:
            out[k] = v
    try:
        return json.dumps(out, ensure_ascii=False)
    except (TypeError, ValueError):
        return repr(out)


def _prefer_split_end(text: str, start: int, limit: int) -> int:
    """Exclusive end index for slice [start:end); prefer natural breaks, cap at limit."""
    lo = start + max(MIN_FPT_CHARS, (limit - start) // 4)
    window = text[start:limit]
    best: int | None = None
    for needle in ("\n\n", "\n", ".\n", ". ", "! ", "? ", ";\n", "; ", ", ", " "):
        idx = window.rfind(needle)
        if idx == -1:
            continue
        cand = start + idx + len(needle)
        if lo <= cand <= limit:
            if best is None or cand > best:
                best = cand
    return best if best is not None else limit


def _split_long_text_core(t: str, max_chars: int, min_chars: int) -> list[str]:
    """Chia t (đã strip, len(t) > max_chars) thành chunks; chưa hậu kiểm chunk cuối < min_chars."""
    chunks: list[str] = []
    i = 0
    n = len(t)
    while i < n:
        if n - i <= max_chars:
            tail = t[i:n]
            if len(tail) < min_chars and chunks:
                if len(chunks[-1]) + len(tail) <= max_chars:
                    chunks[-1] += tail
                else:
                    _fix_tail_merge_overflow(chunks, tail, max_chars=max_chars, min_chars=min_chars)
            else:
                chunks.append(tail)
            break
        remainder_if_full = n - (i + max_chars)
        if 0 < remainder_if_full < min_chars:
            limit = min(i + max_chars, n - min_chars)
        else:
            limit = i + max_chars
        end = _prefer_split_end(t, i, limit)
        if end <= i:
            end = min(i + max_chars, n)
        if end - i < min_chars:
            end = min(i + min_chars, n)
        chunks.append(t[i:end])
        i = end
    return chunks


def _fix_tail_merge_overflow(chunks: list[str], tail: str, *, max_chars: int, min_chars: int) -> None:
    """
    chunks[-1] + tail vượt max_chars; tail < min_chars.
    Rút phần cuối của chunk trước ghép với tail để hai đoạn đều hợp lệ FPT.
    """
    if not chunks:
        if len(tail) <= max_chars:
            chunks.append(tail)
            return
        sub = _split_long_text_core(tail, max_chars, min_chars)
        _fix_trailing_short_chunk_pair(sub, max_chars=max_chars, min_chars=min_chars)
        chunks.extend(sub)
        return
    prev = chunks[-1]
    pl, tl = len(prev), len(tail)
    move_low = max(min_chars - tl, pl - max_chars)
    move_high = min(pl - min_chars, max_chars - tl)
    if move_low <= move_high:
        move = move_low
        chunks[-1] = prev[:-move]
        chunks.append(prev[-move:] + tail)
        return
    combined = prev + tail
    chunks.pop()
    if len(combined) <= max_chars:
        chunks.append(combined)
        return
    sub = _split_long_text_core(combined, max_chars, min_chars)
    _fix_trailing_short_chunk_pair(sub, max_chars=max_chars, min_chars=min_chars)
    chunks.extend(sub)


def _fix_trailing_short_chunk_pair(chunks: list[str], *, max_chars: int, min_chars: int) -> None:
    """Hậu kiểm: chunk cuối < min_chars — gộp hoặc tách lại cho khớp giới hạn FPT."""
    if len(chunks) < 2 or len(chunks[-1]) >= min_chars:
        return
    a, b = chunks[-2], chunks[-1]
    if len(a) + len(b) <= max_chars:
        chunks[-2] = a + b
        chunks.pop()
        return
    move_low = max(min_chars - len(b), len(a) - max_chars)
    move_high = min(len(a) - min_chars, max_chars - len(b))
    if move_low <= move_high:
        m = move_low
        chunks[-2] = a[:-m]
        chunks[-1] = a[-m:] + b
        return
    chunks.pop()
    chunks.pop()
    chunks.extend(_split_text_into_chunks(a + b, max_chars))


def _split_text_into_chunks(text: str, max_chars: int = FPT_MAX_BODY_CHARS) -> list[str]:
    """Chia văn bản thành các đoạn mỗi đoạn <= max_chars, ưu tiên ngắt tại đoạn/câu."""
    t = text.strip()
    if not t:
        return []
    if len(t) <= max_chars:
        return [t]
    chunks = _split_long_text_core(t, max_chars, MIN_FPT_CHARS)
    _fix_trailing_short_chunk_pair(chunks, max_chars=max_chars, min_chars=MIN_FPT_CHARS)
    for ci, ch in enumerate(chunks):
        if len(ch) > max_chars:
            raise ValueError(f"Internal FPT chunk {ci} length {len(ch)} exceeds limit {max_chars}")
    return chunks


def synthesize_to_file(*, text: str, out_path: Path, job_label: str = "") -> int:
    """
    Gọi FPT TTS, chờ file tại URL async, ghi ra out_path.
    Trả về độ dài giây (làm tròn), ước lượng qua pydub nếu có.
    Văn bản dài hơn giới hạn một request được chia đoạn, gọi nhiều lần, ghép MP3.
    """
    prefix = f"{job_label} " if job_label else ""
    key = settings.fpt_api_key
    if not key:
        raise RuntimeError("FPT_API_KEY is not set (worker environment).")

    t = text.strip()
    if len(t) < MIN_FPT_CHARS:
        raise ValueError("FPT TTS requires at least 3 characters in the body.")

    chunks = _split_text_into_chunks(t, FPT_MAX_BODY_CHARS)
    logger.info(
        "%sFPT TTS start: total_chars=%d chunks=%d voice=%s url=%s",
        prefix,
        len(t),
        len(chunks),
        settings.fpt_voice,
        settings.fpt_tts_url,
    )
    if len(chunks) > 1:
        logger.info(
            "%sFPT TTS: text split into %d API requests (max %d chars per request)",
            prefix,
            len(chunks),
            FPT_MAX_BODY_CHARS,
        )

    headers = {
        "api_key": key,
        "voice": settings.fpt_voice,
        "speed": settings.fpt_speed,
        "format": settings.fpt_format,
        "Cache-Control": "no-cache",
    }

    combined: AudioSegment | None = None
    with httpx.Client(timeout=60.0) as client:
        for idx, chunk in enumerate(chunks):
            if len(chunk) > FPT_MAX_BODY_CHARS:
                raise ValueError(f"Internal chunk length {len(chunk)} exceeds FPT limit.")
            chunk_label = f"{prefix}chunk {idx + 1}/{len(chunks)}".strip()
            audio_bytes = _synthesize_chunk_bytes(
                client=client,
                headers=headers,
                text=chunk,
                chunk_label=chunk_label,
            )
            try:
                raw = AudioSegment.from_file(BytesIO(audio_bytes), format="mp3")
            except CouldntDecodeError as exc:
                logger.exception(
                    "%sFPT TTS chunk %d/%d: pydub cannot decode mp3 (%d bytes)",
                    prefix,
                    idx + 1,
                    len(chunks),
                    len(audio_bytes),
                )
                raise RuntimeError(f"{chunk_label}: invalid or corrupt MP3 from FPT") from exc
            except Exception as exc:
                logger.exception(
                    "%sFPT TTS chunk %d/%d: failed to load mp3 (%d bytes)",
                    prefix,
                    idx + 1,
                    len(chunks),
                    len(audio_bytes),
                )
                raise RuntimeError(f"{chunk_label}: cannot load MP3 from FPT ({exc})") from exc
            seg = _normalize_segment_for_concat(raw)
            if idx == 0:
                logger.debug(
                    "%sFPT chunk raw audio: sr=%s ch=%s sw=%s → normalized %dHz %dch",
                    prefix,
                    raw.frame_rate,
                    raw.channels,
                    raw.sample_width,
                    DEFAULT_SAMPLE_RATE,
                    DEFAULT_CHANNELS,
                )
            combined = seg if combined is None else combined + seg
            logger.info(
                "%sFPT TTS segment decoded: chunk=%d/%d chars=%d mp3_bytes=%d",
                prefix,
                idx + 1,
                len(chunks),
                len(chunk),
                len(audio_bytes),
            )
            if idx + 1 < len(chunks):
                gap = max(0.0, float(settings.fpt_inter_chunk_delay_sec))
                if gap > 0:
                    time.sleep(gap)

    assert combined is not None
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        combined.export(str(out_path), format="mp3", bitrate="128k")
    except Exception as exc:
        logger.exception("%sFPT TTS: export merged mp3 failed (chunks=%d)", prefix, len(chunks))
        raise RuntimeError(f"{prefix}FPT merge export failed: {exc}") from exc
    dur_from_segments = int(round(combined.duration_seconds))
    dur_from_file = _duration_seconds(out_path)
    duration = max(dur_from_segments, dur_from_file)
    if dur_from_segments > 0 and dur_from_file > 0 and abs(dur_from_segments - dur_from_file) > 5:
        logger.warning(
            "%sFPT TTS duration: segments=%ds file=%ds using=%ds",
            prefix,
            dur_from_segments,
            dur_from_file,
            duration,
        )
    try:
        out_size = out_path.stat().st_size
    except OSError:
        out_size = -1
    logger.info(
        "%sFPT TTS done: merged_mp3_bytes=%d duration_rounded_s=%d (segments=%d file=%d) path=%s",
        prefix,
        out_size,
        duration,
        dur_from_segments,
        dur_from_file,
        out_path,
    )

    return duration


def _synthesize_chunk_bytes(
    *,
    client: httpx.Client,
    headers: dict[str, str],
    text: str,
    chunk_label: str,
) -> bytes:
    n_chars = len(text)
    logger.info("%s: POST TTS body_chars=%d", chunk_label, n_chars)
    t0 = time.monotonic()
    r = client.post(
        settings.fpt_tts_url,
        content=text.encode("utf-8"),
        headers=headers,
    )
    elapsed = time.monotonic() - t0
    body_len = len(r.content) if r.content else 0
    ct = (r.headers.get("content-type") or "").strip()
    logger.info(
        "%s: FPT POST %s → http=%s elapsed=%.2fs content-type=%r body_len=%d",
        chunk_label,
        settings.fpt_tts_url,
        r.status_code,
        elapsed,
        ct,
        body_len,
    )
    logger.info(
        "%s: FPT POST response body (raw, truncated): %s",
        chunk_label,
        _shorten_for_log(r.text or "", 2000),
    )
    r.raise_for_status()
    try:
        data = r.json()
    except ValueError:
        logger.error("%s: POST response is not JSON: %s", chunk_label, _shorten_for_log(r.text, 200))
        raise

    if not isinstance(data, dict):
        logger.error("%s: FPT POST JSON is not an object: %s", chunk_label, _shorten_for_log(repr(data), 500))
        raise RuntimeError(f"FPT TTS unexpected JSON shape: {data!r}")

    logger.info(
        "%s: FPT POST response JSON: %s",
        chunk_label,
        _shorten_for_log(_fpt_post_json_for_log(data), 2000),
    )

    err = int(data.get("error", -1))
    if err != 0:
        logger.error("%s: FPT JSON error=%s message=%s", chunk_label, data.get("error"), data.get("message"))
        raise RuntimeError(data.get("message") or f"FPT TTS error: {data!r}")

    async_url = data.get("async")
    if not async_url:
        logger.error("%s: FPT JSON missing async URL: %s", chunk_label, _shorten_for_log(repr(data), 300))
        raise RuntimeError(f"FPT response missing async URL: {data!r}")

    logger.info("%s: async URL received (poll for MP3): %s", chunk_label, _shorten_for_log(str(async_url)))
    return _poll_async_mp3(str(async_url), chunk_label=chunk_label)


def _poll_async_mp3(url: str, *, chunk_label: str) -> bytes:
    configured = max(0.0, float(settings.fpt_async_first_poll_delay_sec))
    floor = max(0.0, float(settings.fpt_async_first_poll_floor_sec))
    delay = max(configured, floor) if floor > 0 else configured
    if floor > 0 and delay > configured:
        logger.info(
            "%s: chờ trước GET đầu tiên: cấu hình %.1fs → dùng %.1fs (sàn FPT_ASYNC_FIRST_POLL_FLOOR_SEC=%.1fs, tránh 404 CDN)",
            chunk_label,
            configured,
            delay,
            floor,
        )
    elif delay > 0:
        logger.info(
            "%s: sau phản hồi convert (JSON async), chờ %.1fs rồi mới GET URL file (tránh 404 lúc file chưa ghi xong)",
            chunk_label,
            delay,
        )
    else:
        logger.info("%s: FPT_ASYNC_FIRST_POLL_DELAY_SEC=0 và floor=0 — GET file async ngay", chunk_label)
    if delay > 0:
        time.sleep(delay)

    deadline = time.monotonic() + settings.fpt_poll_timeout_sec
    last_status: int | None = None
    last_len = 0
    polls = 0
    t0 = time.monotonic()
    last_info_log = t0
    logged_404_info = False
    poll_headers = _async_poll_headers()
    while time.monotonic() < deadline:
        polls += 1
        try:
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                resp = client.get(url, headers=poll_headers)
            last_status = resp.status_code
            last_len = len(resp.content) if resp.content else 0
            if resp.status_code == 404 and not logged_404_info:
                logger.info(
                    "%s: async URL returned 404 once (normal until file is ready on CDN); "
                    "retrying with browser-like headers + api_key until timeout=%.0fs",
                    chunk_label,
                    settings.fpt_poll_timeout_sec,
                )
                logged_404_info = True
            if _response_is_ready_mp3(resp):
                elapsed = time.monotonic() - t0
                logger.info(
                    "%s: async MP3 ready http=200 bytes=%d polls=%d elapsed=%.2fs",
                    chunk_label,
                    last_len,
                    polls,
                    elapsed,
                )
                return resp.content
            logger.debug(
                "%s: poll #%d http=%s bytes=%s (waiting for MP3)",
                chunk_label,
                polls,
                last_status,
                last_len,
            )
        except httpx.HTTPError as exc:
            logger.debug("%s: poll #%d HTTP error: %s", chunk_label, polls, exc)
        now = time.monotonic()
        if now - last_info_log >= _POLL_LOG_INTERVAL_SEC:
            logger.info(
                "%s: still polling async… polls=%d last_http=%s last_bytes=%d elapsed=%.0fs timeout=%.0fs",
                chunk_label,
                polls,
                last_status,
                last_len,
                now - t0,
                settings.fpt_poll_timeout_sec,
            )
            last_info_log = now
        sleep_sec = float(settings.fpt_poll_interval_sec)
        if last_status == 404:
            sleep_sec = max(sleep_sec, 3.0)
        time.sleep(sleep_sec)

    logger.error(
        "%s: async MP3 timeout after %.0fs (polls=%d last_http=%s last_bytes=%d)",
        chunk_label,
        settings.fpt_poll_timeout_sec,
        polls,
        last_status,
        last_len,
    )
    raise TimeoutError(
        f"FPT async audio not ready after {settings.fpt_poll_timeout_sec}s (last HTTP {last_status})"
    )


def _duration_seconds(path: Path) -> int:
    try:
        from pydub import AudioSegment

        return int(round(AudioSegment.from_file(str(path)).duration_seconds))
    except Exception:  # noqa: BLE001
        return 0
