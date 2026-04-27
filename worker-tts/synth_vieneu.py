#!/usr/bin/env python3
"""
Tổng hợp giọng VieNeu-TTS (preset hoặc clone từ file mẫu).

  python synth_vieneu.py --text "Xin chào."
  python synth_vieneu.py --text "..." --reference voice.wav --out cloned.wav
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="VieNeu-TTS — preset hoặc voice cloning.")
    p.add_argument("--text", required=True, help="Văn bản cần đọc.")
    p.add_argument(
        "--out",
        type=Path,
        default=SCRIPT_DIR / "output.wav",
        help="File âm thanh ra (mặc định: worker-tts/output.wav).",
    )
    p.add_argument(
        "--reference",
        type=Path,
        default=None,
        help="File giọng mẫu WAV/MP3/FLAC (3–10s) để clone; bỏ qua = dùng giọng preset mặc định.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    out = args.out.expanduser().resolve()

    try:
        from vieneu import Vieneu
    except ImportError as e:
        print(e, file=sys.stderr)
        print("Chạy: pip install -r requirements.txt", file=sys.stderr)
        return 1

    ref = args.reference.expanduser().resolve() if args.reference else None
    if ref is not None and not ref.is_file():
        print(f"Không thấy file mẫu: {ref}", file=sys.stderr)
        return 1

    print("Đang tải / khởi tạo model (lần đầu có thể lâu)…")
    tts = Vieneu()

    if ref is not None:
        print(f"Clone từ: {ref}")
        voice = tts.encode_reference(str(ref))
        audio = tts.infer(text=args.text, voice=voice)
    else:
        print("Giọng: preset mặc định (Turbo)")
        audio = tts.infer(text=args.text)

    out.parent.mkdir(parents=True, exist_ok=True)
    tts.save(audio, str(out))
    print(f"Xong: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
