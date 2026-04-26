"""Kiểm tra import VieNeu sau khi pip install."""
from __future__ import annotations

import sys


def main() -> int:
    try:
        from vieneu import Vieneu  # noqa: PLC0415

        print("OK: from vieneu import Vieneu")
        print("Vieneu:", Vieneu)
        return 0
    except Exception as exc:  # noqa: BLE001
        print("FAIL:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
