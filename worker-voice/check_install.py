#!/usr/bin/env python3
"""Kiểm tra import torch + TTS sau khi cài requirements.txt (không tải mô hình)."""

from __future__ import annotations

import sys


def main() -> int:
    try:
        import torch
        from TTS.api import TTS
    except ImportError as e:
        print("Lỗi import:", e, file=sys.stderr)
        print("Chạy: python -m venv .venv && .venv/bin/pip install -r requirements.txt", file=sys.stderr)
        return 1
    print("torch:", torch.__version__)
    print("CUDA khả dụng:", torch.cuda.is_available())
    print("TTS (Coqui) import OK.")
    _ = TTS  # noqa: F841
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
