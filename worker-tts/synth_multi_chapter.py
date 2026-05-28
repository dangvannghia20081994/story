#!/usr/bin/env python3
"""
Multi-speaker TTS test cho 1 chapter.

Đọc file segments JSON, synthesize từng segment bằng VieNeu (preset voice theo speaker),
áp pitch shift / tempo bằng ffmpeg, concat thành 1 mp3. Có thể upload thẳng lên backend.

Args:
  --segments /path/to/segments.json   (mặc định: /app/output/chapter_1_segments.json)
  --reference /app/input.wav           (mặc định, chỉ dùng cho fallback voice nếu cần)
  --out /app/output/audio_multi.mp3    (mặc định)
  --upload                              (bật → POST file mp3 lên API backend)
  --chapter-id N                        (bắt buộc khi --upload, ID chapter để API gắn audio)

Speaker → pitch shift (semitones):
  narration       : 0  (gốc)
  Lâm Phong       : -1 (nam protagonist)
  Lão Giả         : -4 (lão già, sâu)
  Lâm Vân Dao     : +3 (nữ trẻ)
  _unknown        : 0
  default         : 0
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from worker_redis import _apply_pitch_tempo, _concat_to_mp3, _gen_silence

SCRIPT_DIR = Path(__file__).resolve().parent

# Speaker → preset voice + optional pitch/tempo polish.
# Preset voices (VieNeu): Binh / Tuyen / Vinh (nam Bắc/Nam), Doan / Ly / Ngoc (nữ), Sơn (nam Nam)
SPEAKER_EFFECTS = {
    "narration":   {"voice": "Tuyen", "pitch": 0,  "tempo": 1.0},
    "Lâm Phong":   {"voice": "Binh",  "pitch": 0,  "tempo": 1.0},
    "Lão Giả":     {"voice": "Sơn",   "pitch": -2, "tempo": 0.95},
    "Lâm Vân Dao": {"voice": "Ly",    "pitch": 0,  "tempo": 1.0},
    "_unknown":    {"voice": "Ngoc",  "pitch": 0,  "tempo": 1.0},
}
DEFAULT_EFFECT = {"voice": "Tuyen", "pitch": 0, "tempo": 1.0}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--segments", type=Path, default=Path("/app/output/chapter_1_segments.json"))
    p.add_argument("--reference", type=Path, default=Path("/app/input.wav"))
    p.add_argument("--out", type=Path, default=Path("/app/output/audio_multi.mp3"))
    p.add_argument("--silence-ms", type=int, default=300, help="Khoảng lặng giữa segments (ms)")
    p.add_argument("--upload", action="store_true", help="Upload mp3 lên backend qua API nội bộ sau khi concat xong.")
    p.add_argument("--chapter-id", type=int, default=None, help="ID chapter trên backend (bắt buộc khi --upload).")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    if args.upload and args.chapter_id is None:
        print("--upload yêu cầu --chapter-id <id>.", file=sys.stderr)
        return 1

    if not args.segments.is_file():
        print(f"Không thấy segments file: {args.segments}", file=sys.stderr)
        return 1

    segments = json.loads(args.segments.read_text(encoding="utf-8"))
    if not isinstance(segments, list) or not segments:
        print("Segments rỗng hoặc sai format", file=sys.stderr)
        return 1

    print(f"Loaded {len(segments)} segments. Init VieNeu (lần đầu sẽ chậm vì tải model)…", flush=True)
    try:
        from vieneu import Vieneu
    except ImportError as e:
        print(f"VieNeu import lỗi: {e}", file=sys.stderr)
        return 1

    tts = Vieneu()

    # Preload preset voices (no torch needed, dùng key có sẵn của VieNeu)
    voice_cache: dict[str, object] = {}
    needed_voices = {eff["voice"] for eff in SPEAKER_EFFECTS.values()} | {DEFAULT_EFFECT["voice"]}
    for vkey in needed_voices:
        try:
            voice_cache[vkey] = tts.get_preset_voice(vkey)
            print(f"  loaded preset voice: {vkey}", flush=True)
        except Exception as e:
            print(f"  ⚠ preset {vkey} lỗi: {e}", file=sys.stderr)

    # Sample rate VieNeu output (mặc định 24000 Hz)
    sample_rate = 24000

    work_dir = Path(tempfile.mkdtemp(prefix="multi_tts_"))
    print(f"Work dir: {work_dir}", flush=True)

    parts: list[Path] = []
    silence_path = work_dir / "silence.wav"
    _gen_silence(silence_path, args.silence_ms, sample_rate)

    for idx, seg in enumerate(segments, 1):
        speaker = (seg.get("speaker") or "narration").strip()
        text = (seg.get("text") or "").strip()
        if not text:
            continue

        eff = SPEAKER_EFFECTS.get(speaker, DEFAULT_EFFECT)
        voice_obj = voice_cache.get(eff["voice"])
        if voice_obj is None:
            print(f"  ⚠ voice {eff['voice']} chưa load — skip segment", file=sys.stderr)
            continue
        print(f"[{idx}/{len(segments)}] {speaker} (voice={eff['voice']}, pitch={eff['pitch']}, tempo={eff['tempo']}): {text[:60]}…", flush=True)

        raw_wav = work_dir / f"seg_{idx:03d}_raw.wav"
        try:
            audio = tts.infer(text=text, voice=voice_obj)
            tts.save(audio, str(raw_wav))
        except Exception as e:
            print(f"  ⚠ infer lỗi: {e} — skip segment", file=sys.stderr)
            continue

        # Apply pitch + tempo
        if eff["pitch"] == 0 and abs(eff["tempo"] - 1.0) < 0.01:
            final_wav = raw_wav
        else:
            final_wav = work_dir / f"seg_{idx:03d}_final.wav"
            try:
                _apply_pitch_tempo(raw_wav, final_wav, eff["pitch"], eff["tempo"], sample_rate)
            except subprocess.CalledProcessError as e:
                print(f"  ⚠ ffmpeg pitch lỗi: {e} — dùng raw", file=sys.stderr)
                final_wav = raw_wav

        parts.append(final_wav)
        if idx < len(segments):
            parts.append(silence_path)

    if not parts:
        print("Không có segment nào synthesize được", file=sys.stderr)
        return 1

    print(f"Concat {len(parts)} parts → {args.out}", flush=True)
    _concat_to_mp3(parts, args.out)

    shutil.rmtree(work_dir, ignore_errors=True)
    print(f"DONE: {args.out}", flush=True)

    if args.upload:
        try:
            from worker_redis import load_local_env, upload_audio
        except ImportError as e:
            print(f"Không import được worker_redis để upload: {e}", file=sys.stderr)
            return 2
        load_local_env()
        print(f"Uploading → backend (chapter_id={args.chapter_id})…", flush=True)
        try:
            upload_audio(args.chapter_id, args.out, "chapter.mp3", "audio/mpeg")
        except Exception as e:
            print(f"Upload lỗi: {e}", file=sys.stderr)
            return 3
        print(f"UPLOAD OK: chapter_id={args.chapter_id}", flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
