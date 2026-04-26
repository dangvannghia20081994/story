"""Kiểm tra import Coqui TTS sau khi pip install."""
from __future__ import annotations

import sys


def main() -> int:
    try:
        from TTS.api import TTS  # noqa: PLC0415

        print("OK: from TTS.api import TTS")
        print("TTS class:", TTS)
        return 0
    except Exception as exc:  # noqa: BLE001
        print("FAIL:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
