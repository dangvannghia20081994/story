#!/usr/bin/env python3
"""
Tải viXTTS (tiếng Việt) ``ntdgo/ttsvi`` từ Hugging Face vào worker-voice/models/ntdgo-ttsvi/
và (tùy chọn) xóa cache XTTS v2 gốc (~/.local/share/tts/.../xtts_v2).

Cần: pip install -r requirements.txt (đã có huggingface_hub qua transformers).

  python install_vi_model.py
  python install_vi_model.py --remove-stock-xtts
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


REPO_ID = "ntdgo/ttsvi"
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_LOCAL_DIR = SCRIPT_DIR / "models" / "ntdgo-ttsvi"
STOCK_XTTS_CACHE = Path.home() / ".local/share/tts/tts_models--multilingual--multi-dataset--xtts_v2"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Tải model viXTTS tiếng Việt (ntdgo/ttsvi).")
    p.add_argument(
        "--dir",
        type=Path,
        default=DEFAULT_LOCAL_DIR,
        help=f"Thư mục lưu weight (mặc định: {DEFAULT_LOCAL_DIR})",
    )
    p.add_argument(
        "--repo",
        default=REPO_ID,
        help=f"Hugging Face repo_id (mặc định: {REPO_ID})",
    )
    p.add_argument(
        "--remove-stock-xtts",
        action="store_true",
        help=f"Xóa cache XTTS v2 gốc nếu có: {STOCK_XTTS_CACHE}",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    dest = args.dir.expanduser().resolve()
    dest.mkdir(parents=True, exist_ok=True)

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("Thiếu huggingface_hub. Chạy: pip install huggingface_hub", file=sys.stderr)
        return 1

    print(f"Đang tải {args.repo!r} vào {dest} … (model.pth ~1.9GB, có thể lâu)")
    try:
        snapshot_download(
            repo_id=args.repo,
            local_dir=str(dest),
            local_dir_use_symlinks=False,
        )
    except Exception as e:
        print(f"Lỗi tải: {e}", file=sys.stderr)
        return 1

    need = ("config.json", "model.pth", "vocab.json")
    missing = [n for n in need if not (dest / n).is_file()]
    if missing:
        print(f"Thiếu file sau tải: {missing}", file=sys.stderr)
        return 1

    print("Tải xong. Chạy: python synth_voice.py --text \"Câu tiếng Việt\" --language vi")

    if args.remove_stock_xtts:
        if STOCK_XTTS_CACHE.exists():
            print(f"Đang xóa cache XTTS gốc: {STOCK_XTTS_CACHE}")
            shutil.rmtree(STOCK_XTTS_CACHE)
            print("Đã xóa.")
        else:
            print(f"Không có thư mục cache XTTS gốc: {STOCK_XTTS_CACHE} (bỏ qua).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
