#!/usr/bin/env python3
"""Kiểm tra môi trường sau khi cài requirements.txt (worker-tts)."""

from __future__ import annotations

import shutil
import sys


def main() -> int:
    try:
        from vieneu import Vieneu  # noqa: F401
    except ImportError as e:
        print("Lỗi import vieneu:", e, file=sys.stderr)
        print("Chạy: pip install -r requirements.txt", file=sys.stderr)
        return 1

    print("OK: import Vieneu")

    if not shutil.which("espeak-ng"):
        print(
            "Cảnh báo: không thấy lệnh `espeak-ng` trong PATH — VieNeu cần eSpeak NG để phát âm tiếng Việt.",
            file=sys.stderr,
        )
        print("  Ubuntu/Debian: sudo apt install espeak-ng", file=sys.stderr)
        return 0

    print("OK: espeak-ng có trong PATH")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
