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
    """
    Đường dẫn file giọng mẫu. Biến môi trường REFERENCE_AUDIO_PATH:
    - Tuyệt đối (Docker: /app/input.wav) — dùng nguyên.
    - Tương đối (Windows/macOS host: input.wav) — resolve theo thư mục chứa worker_redis.py,
      không phụ thuộc cwd khi chạy `python worker_redis.py`.
    """
    raw = (os.environ.get("REFERENCE_AUDIO_PATH") or "").strip()
    if raw:
        p = Path(raw).expanduser()
        if not p.is_absolute():
            p = SCRIPT_DIR / p
    else:
        p = SCRIPT_DIR / "input.wav"
    return p.resolve()


def backend_base_url() -> str:
    base = (os.environ.get("BACKEND_API_BASE_URL") or "http://127.0.0.1:8000").strip().rstrip("/")
    return base


def internal_token() -> str:
    return (os.environ.get("WORKER_TTS_INTERNAL_TOKEN") or "").strip()


_ZW_RE = re.compile("[\u200b\u200c\u200d\ufeff]")


def normalize_upload_format_env_value(raw: str | None) -> str:
    """Chuẩn hoá WORKER_TTS_UPLOAD_FORMAT: khoảng trắng, zero-width, ngoặc 'mp3' / \"mp3\" / dấu ngoặc typographic."""
    s = _ZW_RE.sub("", (raw or "")).strip().lower()
    for curly, asc in (("\u2018", "'"), ("\u2019", "'"), ("\u201c", '"'), ("\u201d", '"')):
        s = s.replace(curly, asc)
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        s = s[1:-1].strip().lower()
    return s


def normalize_tts_text(text: str) -> str:
    """Bỏ dòng trống / dòng chỉ khoảng trắng, ký tự zero-width; gộp đoạn bằng một space (tránh khoảng lặng kỳ khi infer).
    Giảm các marker thường gây silence dài (chấm lửng, em-dash) về dấu phẩy."""
    text = _ZW_RE.sub("", text)
    # VieNeu hay sinh silence rất dài ở "..." / "…" / em-dash → ép về dấu phẩy.
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
    # Gộp dấu phẩy liên tiếp + khoảng trắng dư sau khi thay ellipsis / em-dash.
    out = re.sub(r"\s+,", ",", out)
    out = re.sub(r"(?:,\s*){2,}", ", ", out)
    return out.strip()


def _ffmpeg_binary_available() -> bool:
    raw = (os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"
    p = Path(raw)
    if p.is_file():
        return True
    return shutil.which(raw) is not None


def upload_audio_format() -> str:
    """Định dạng gửi API: wav | mp3 | m4a (WORKER_TTS_UPLOAD_FORMAT)."""
    raw_in = os.environ.get("WORKER_TTS_UPLOAD_FORMAT")
    raw = normalize_upload_format_env_value(raw_in or "")
    if not raw:
        return "wav"
    if raw == "aac":
        raw = "m4a"
    if raw not in ("wav", "mp3", "m4a"):
        if (raw_in or "").strip():
            print(
                f"[worker-tts] Cảnh báo: WORKER_TTS_UPLOAD_FORMAT={raw_in!r} không phải wav|mp3|m4a — dùng wav.",
                flush=True,
            )
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


def _apply_pitch_tempo(in_wav: Path, out_wav: Path, pitch: int, tempo: float, sample_rate: int) -> None:
    """Pitch shift bằng asetrate + tempo bằng atempo (chuỗi atempo nếu cần ngoài [0.5, 2.0])."""
    if pitch == 0 and abs(tempo - 1.0) < 0.01:
        # No-op: chỉ copy
        shutil.copyfile(in_wav, out_wav)
        return
    factor = 2 ** (pitch / 12)
    new_rate = int(sample_rate * factor)
    final_tempo = (1 / factor) * tempo
    atempos: list[str] = []
    t = final_tempo
    while t < 0.5:
        atempos.append("atempo=0.5")
        t /= 0.5
    while t > 2.0:
        atempos.append("atempo=2.0")
        t /= 2.0
    atempos.append(f"atempo={t:.4f}")
    filt = f"asetrate={new_rate},aresample={sample_rate}," + ",".join(atempos)
    ffmpeg_bin = (os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"
    subprocess.run(
        [ffmpeg_bin, "-y", "-loglevel", "error", "-i", str(in_wav),
         "-af", filt, "-ar", str(sample_rate), str(out_wav)],
        check=True,
    )


def _gen_silence(out_wav: Path, ms: int, sample_rate: int) -> None:
    duration = ms / 1000.0
    ffmpeg_bin = (os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"
    subprocess.run(
        [ffmpeg_bin, "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", f"anullsrc=channel_layout=mono:sample_rate={sample_rate}",
         "-t", f"{duration:.3f}", str(out_wav)],
        check=True,
    )


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


def _process_multi_speaker(tts, msg: dict, chapter_id: int) -> None:
    """Multi-speaker pipeline: synth từng segment với preset voice (nếu set) hoặc reference voice clone (fallback). Ghép thành mp3, upload."""
    segments = msg.get("segments") or []
    if not isinstance(segments, list) or not segments:
        print(f"[worker-tts] multi: chapter_id={chapter_id} không có segments", file=sys.stderr)
        return

    silence_ms = int(msg.get("silence_ms", 250))
    sample_rate = int(getattr(tts, "sample_rate", 24000) or 24000)
    total = len(segments) + 3
    print(f"[worker-tts] chapter={chapter_id}  multi-speaker mode: {len(segments)} segments, sample_rate={sample_rate}", flush=True)

    # Preload preset voices (chỉ những key thực sự cần). Segment voice=null → dùng reference voice clone (load lazy).
    needed_voices = sorted({v for v in (seg.get("voice") for seg in segments) if v})
    voice_cache: dict[str, object] = {}
    _stage(chapter_id, 1, total, f"Load {len(needed_voices)} preset voices + reference voice: {needed_voices or '[none]'}")
    for vkey in needed_voices:
        try:
            voice_cache[vkey] = tts.get_preset_voice(vkey)
        except Exception as e:
            print(f"[worker-tts] preset {vkey} lỗi: {e}", file=sys.stderr)

    reference_voice: object | None = None
    ref_path = reference_audio_path()

    def get_voice_or_reference(vkey: str | None) -> object | None:
        """Trả preset voice nếu vkey có giá trị + load OK; ngược lại trả reference voice (cache lazy)."""
        nonlocal reference_voice
        if vkey and vkey in voice_cache:
            return voice_cache[vkey]
        if reference_voice is None:
            if not ref_path.is_file():
                print(f"[worker-tts] reference voice file không tồn tại: {ref_path}", file=sys.stderr)
                return None
            try:
                reference_voice = tts.encode_reference(str(ref_path))
            except Exception as e:
                print(f"[worker-tts] encode_reference lỗi: {e}", file=sys.stderr)
                return None
        return reference_voice

    work_dir = Path(tempfile.mkdtemp(prefix="multi_tts_"))
    parts: list[Path] = []
    silence_path = work_dir / "silence.wav"
    _gen_silence(silence_path, silence_ms, sample_rate)

    try:
        for idx, seg in enumerate(segments, 1):
            speaker = (seg.get("speaker") or "narration").strip()
            text = normalize_tts_text(str(seg.get("text") or ""))
            if not text:
                continue
            vkey = seg.get("voice")  # None → fallback reference voice clone
            pitch = int(seg.get("pitch", 0))
            tempo = float(seg.get("tempo", 1.0))
            voice = get_voice_or_reference(vkey)
            if voice is None:
                print(f"[worker-tts]   ⚠ seg #{idx} voice={vkey!r} không có voice + reference — skip", file=sys.stderr)
                continue

            voice_label = vkey if vkey else "ref"
            _stage(chapter_id, 2, total, f"Seg {idx}/{len(segments)} ({speaker} → {voice_label}, p={pitch}, t={tempo})")
            raw_wav = work_dir / f"seg_{idx:04d}_raw.wav"
            try:
                audio = tts.infer(text=text, voice=voice)
                tts.save(audio, str(raw_wav))
            except Exception as e:
                print(f"[worker-tts]   ⚠ infer lỗi seg #{idx}: {e}", file=sys.stderr)
                continue

            if pitch == 0 and abs(tempo - 1.0) < 0.01:
                final_wav = raw_wav
            else:
                final_wav = work_dir / f"seg_{idx:04d}_pp.wav"
                try:
                    _apply_pitch_tempo(raw_wav, final_wav, pitch, tempo, sample_rate)
                except subprocess.CalledProcessError as e:
                    print(f"[worker-tts]   ⚠ ffmpeg lỗi seg #{idx}: {e} — dùng raw", file=sys.stderr)
                    final_wav = raw_wav

            parts.append(final_wav)
            if idx < len(segments):
                parts.append(silence_path)

        if not parts:
            print(f"[worker-tts] chapter={chapter_id} không có segment hợp lệ", file=sys.stderr)
            return

        out_fmt = upload_audio_format()
        out_ext = "mp3" if out_fmt != "wav" else "wav"
        out_path = work_dir / f"chapter_{chapter_id}_multi.{out_ext}"
        _stage(chapter_id, total - 1, total, f"Ghép {len(parts)} parts → {out_ext.upper()}")
        if out_ext == "mp3":
            _concat_to_mp3(parts, out_path)
        else:
            # Concat wav giữ nguyên format
            list_file = work_dir / "concat.txt"
            list_file.write_text("\n".join(f"file '{p}'" for p in parts), encoding="utf-8")
            ffmpeg_bin = (os.environ.get("FFMPEG_PATH") or "ffmpeg").strip() or "ffmpeg"
            subprocess.run(
                [ffmpeg_bin, "-y", "-loglevel", "error",
                 "-f", "concat", "-safe", "0", "-i", str(list_file),
                 "-c", "copy", str(out_path)],
                check=True,
            )

        # out_path đã đúng format (wav hoặc mp3) sau bước concat — không qua build_upload_payload (vốn chỉ convert từ wav).
        mime_map = {"wav": "audio/wav", "mp3": "audio/mpeg", "m4a": "audio/mp4"}
        multipart_name = f"chapter.{out_ext}"
        mime = mime_map.get(out_ext, "application/octet-stream")
        _stage(chapter_id, total, total, "Upload lên backend API")
        upload_audio(chapter_id, out_path, multipart_name, mime)
        print(f"[worker-tts] chapter={chapter_id}  multi-speaker hoàn tất (upload OK)", flush=True)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def process_message(tts, raw: str) -> None:
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

    mode = (msg.get("mode") or "single").strip().lower()
    if mode == "multi-speaker":
        _process_multi_speaker(tts, msg, chapter_id)
        return

    # Single-voice (legacy) flow
    text = msg.get("text")
    if text is None or str(text).strip() == "":
        print(f"[worker-tts] Thiếu text cho single mode: {msg!r}", file=sys.stderr)
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
    if fmt != "wav" and not _ffmpeg_binary_available():
        print(
            "[worker-tts] WORKER_TTS_UPLOAD_FORMAT=%s nhưng không tìm thấy ffmpeg.\n"
            "  • Debian/Ubuntu: sudo apt install ffmpeg\n"
            "  • Windows: winget install ffmpeg (hoặc https://www.gyan.dev/ffmpeg/builds/ — thêm thư mục `bin` vào PATH),\n"
            "    hoặc trong worker-tts/.env đặt FFMPEG_PATH=C:\\\\đường\\\\dẫn\\\\ffmpeg.exe\n"
            "  • Hoặc đặt WORKER_TTS_UPLOAD_FORMAT=wav để gửi WAV thẳng (không cần ffmpeg)."
            % (fmt,),
            file=sys.stderr,
        )
        return 1

    try:
        from vieneu import Vieneu
    except ImportError as e:
        exe = Path(sys.executable).name
        venv_hint = ""
        vpy = SCRIPT_DIR / ".venv" / ("Scripts" if sys.platform == "win32" else "bin") / f"python{'.exe' if sys.platform == 'win32' else ''}"
        if vpy.is_file() and Path(sys.executable).resolve() != vpy.resolve():
            rel = vpy.relative_to(SCRIPT_DIR) if SCRIPT_DIR in vpy.parents else vpy
            venv_hint = (
                f"\n  Bạn đang dùng: {sys.executable}\n"
                f"  Chạy worker bằng venv: {rel} worker_redis.py\n"
                "  Hoặc: .venv\\Scripts\\activate rồi python worker_redis.py (Windows)\n"
                "  Nếu chưa có venv: python -m venv .venv && .venv\\Scripts\\pip install -r requirements.txt\n"
            )
        print(f"{e}{venv_hint}", file=sys.stderr)
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
