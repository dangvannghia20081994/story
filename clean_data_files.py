#!/usr/bin/env python3
"""
Dọn nội dung quảng bá/footer nguồn repost trong các file JSON gốc:
  data/<slug>/chapters/*.json  (key "content")
Áp đúng pipeline sanitize_content trong import_data.py, ghi đè in place.
Chạy song song nhiều luồng.

Chạy (không cần DB):
  python3 clean_data_files.py --workers 10
hoặc trong container python nếu host thiếu deps.
"""

import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from import_data import sanitize_content

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def list_chapter_files() -> list[str]:
    out = []
    for slug in os.listdir(DATA_DIR):
        ch_dir = os.path.join(DATA_DIR, slug, "chapters")
        if not os.path.isdir(ch_dir):
            continue
        for f in os.listdir(ch_dir):
            if f.endswith(".json"):
                out.append(os.path.join(ch_dir, f))
    return out


def clean_file(path: str) -> int:
    """Trả 1 nếu file bị sửa, 0 nếu không."""
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return 0
    content = data.get("content")
    if not isinstance(content, str) or content == "":
        return 0
    cleaned = sanitize_content(content)
    if cleaned == content:
        return 0
    data["content"] = cleaned
    # Giữ format giống file gốc (indent 2, không escape unicode).
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return 1


def clean_batch(paths: list[str]) -> int:
    return sum(clean_file(p) for p in paths)


def chunk(lst: list, n: int) -> list[list]:
    if n <= 1:
        return [lst]
    size = (len(lst) + n - 1) // n
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def main():
    parser = argparse.ArgumentParser(description="Clean ad/footer in data/ JSON files")
    parser.add_argument("--workers", type=int, default=10)
    args = parser.parse_args()

    start = time.time()
    files = list_chapter_files()
    print(f"Tìm thấy {len(files)} file chapter JSON trong {DATA_DIR}.")
    if not files:
        return

    batches = chunk(files, args.workers)
    print(f"Chia vào {len(batches)} luồng (~{len(batches[0])} file/luồng).")

    total = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(clean_batch, b): i for i, b in enumerate(batches)}
        for fut in as_completed(futures):
            wi = futures[fut]
            n = fut.result()
            total += n
            print(f"  luồng {wi:2}: {n:5} file sửa")

    elapsed = time.time() - start
    print(f"\nXong trong {elapsed:.1f}s — {total} file đã dọn / {len(files)} file.")


if __name__ == "__main__":
    main()
