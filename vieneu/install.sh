#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found" >&2
  exit 1
fi

echo ">>> Create venv: $(pwd)/.venv"
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate

echo ">>> pip install -r requirements.txt (extra-index for llama-cpp CPU wheels)"
python -m pip install -U pip wheel
pip install -r requirements.txt \
  --extra-index-url "https://pnnbao97.github.io/llama-cpp-python-v0.3.16/cpu/"

echo ">>> Check import"
python scripts/check_install.py

echo ""
echo "Done. Activate later: source .venv/bin/activate"
