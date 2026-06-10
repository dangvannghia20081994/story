#!/usr/bin/env python3
"""
Dọn lại nội dung các chương đã import bị dính footer/quảng bá nguồn repost
(TruyenYY credit, Vietwriter/Facebook promo). Dùng đúng pipeline sanitize_content
trong import_data.py. Chạy song song nhiều luồng.

Chạy:
  docker run --rm --network story_default \
    -e DB_DSN="host=db port=5432 dbname=story user=story password=story" \
    -v "$PWD":/app -w /app python:3.12-slim \
    sh -c "pip install -q psycopg2-binary python-slugify && python clean_chapters.py --workers 10"
"""

import argparse
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2

from import_data import sanitize_content, DB_DSN

# Chỉ nhắm các chương có dấu hiệu footer/quảng bá repost — không quét toàn bộ DB
# để tránh đụng vào chương đã sạch. Điều kiện bám đúng nhóm rác đã xác định.
SELECT_DIRTY = """
SELECT id, content
FROM chapters
WHERE content ~* 'Nhóm dịch:'
   OR content ~* 'Dịch giả:'
   OR content ~* '(Nguồn)\\s*:\\s*Truyen'
   OR content ILIKE '%truyenyy%'
   OR content ILIKE '%vietwriter%'
   OR content ILIKE '%Hãy tham gia Group%'
"""


def fetch_dirty_ids() -> list[int]:
    conn = psycopg2.connect(DB_DSN)
    try:
        with conn.cursor() as cur:
            cur.execute(SELECT_DIRTY)
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def clean_batch(chapter_ids: list[int]) -> dict:
    """Một worker: mở connection riêng, dọn từng chương trong danh sách id."""
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    changed = 0
    unchanged = 0
    emptied = 0
    try:
        with conn.cursor() as cur:
            for cid in chapter_ids:
                cur.execute("SELECT content FROM chapters WHERE id = %s", (cid,))
                row = cur.fetchone()
                if row is None:
                    continue
                original = row[0] or ""
                cleaned = sanitize_content(original)
                if cleaned == original:
                    unchanged += 1
                    continue
                cur.execute(
                    "UPDATE chapters SET content = %s, updated_at = NOW() WHERE id = %s",
                    (cleaned, cid),
                )
                changed += 1
                if cleaned.strip() == "":
                    emptied += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"changed": changed, "unchanged": unchanged, "emptied": emptied}


def chunk(lst: list, n: int) -> list[list]:
    """Chia lst thành n phần xấp xỉ đều."""
    if n <= 1:
        return [lst]
    size = (len(lst) + n - 1) // n
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def main():
    parser = argparse.ArgumentParser(description="Clean dirty chapter content in parallel")
    parser.add_argument("--workers", type=int, default=10, help="Số luồng song song")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ đếm, không ghi DB")
    args = parser.parse_args()

    start = time.time()
    ids = fetch_dirty_ids()
    print(f"Tìm thấy {len(ids)} chương nghi dính rác.")
    if not ids:
        print("Không có gì để dọn.")
        return

    if args.dry_run:
        # Đếm trên 1 luồng (đọc-only) số chương thực sự đổi sau sanitize.
        conn = psycopg2.connect(DB_DSN)
        changed = 0
        emptied = 0
        with conn.cursor() as cur:
            for cid in ids:
                cur.execute("SELECT content FROM chapters WHERE id = %s", (cid,))
                original = (cur.fetchone() or [""])[0] or ""
                cleaned = sanitize_content(original)
                if cleaned != original:
                    changed += 1
                    if cleaned.strip() == "":
                        emptied += 1
        conn.close()
        print(f"[DRY-RUN] Sẽ đổi {changed} chương (trong đó {emptied} chương rỗng sau khi dọn).")
        return

    batches = chunk(ids, args.workers)
    print(f"Chia {len(ids)} chương vào {len(batches)} luồng (~{len(batches[0])} chương/luồng).")

    total = {"changed": 0, "unchanged": 0, "emptied": 0}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(clean_batch, b): i for i, b in enumerate(batches)}
        for fut in as_completed(futures):
            wi = futures[fut]
            res = fut.result()
            for k in total:
                total[k] += res[k]
            print(
                f"  luồng {wi:2}: changed={res['changed']:4}  "
                f"unchanged={res['unchanged']:3}  emptied={res['emptied']}"
            )

    elapsed = time.time() - start
    print(
        f"\nXong trong {elapsed:.1f}s — {total['changed']} chương đã dọn, "
        f"{total['unchanged']} không đổi, {total['emptied']} rỗng sau khi dọn."
    )


if __name__ == "__main__":
    main()
