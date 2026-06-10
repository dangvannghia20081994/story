#!/usr/bin/env python3
"""
Import dữ liệu từ data/<story-slug>/ vào Postgres story.
Chạy: uv run --with psycopg2-binary --with python-slugify import_data.py [--story <slug>]
"""

import json
import os
import re
import sys
import time
import argparse
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

DB_DSN = os.environ.get(
    "DB_DSN", "host=localhost port=5432 dbname=story user=story password=story"
)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


# ── Sanitize content (mirror Story.php) ─────────────────────────────────────

def strip_exclusive_publishing_notice(text: str) -> str:
    prefix = "Truyện được đăng tải duy nhất"
    lines = re.split(r"\r\n|\r|\n", text)
    out = []
    for line in lines:
        stripped = re.sub(r"^[﻿​-‍ \s]+", "", line)
        if stripped.startswith(prefix):
            continue
        out.append(line)
    return "\n".join(out)


def strip_known_source_domains(text: str) -> str:
    needles = [
        "https://www.tvtruyen.co.uk",
        "http://www.tvtruyen.co.uk",
        "https://tvtruyen.co.uk",
        "http://tvtruyen.co.uk",
        "//www.tvtruyen.co.uk",
        "//tvtruyen.co.uk",
        "www.tvtruyen.co.uk",
        "tvtruyen.co.uk",
    ]
    for n in needles:
        text = text.replace(n, "")
    return text


def strip_known_source_labels(text: str) -> str:
    for label in ["TruyenTV", "© Website", "truyện chữ", "Truyện chữ", "TRUYỆN CHỮ"]:
        text = text.replace(label, "")
    return text


def strip_follow_along_notice(text: str) -> str:
    marker = "Bạn đã theo dõi đến"
    pos = text.find(marker)
    if pos == -1:
        return text
    return text[:pos].rstrip()


# Dòng credit nhóm dịch — có thể ở đầu (header) hoặc cuối (footer) chương.
# Bắt cả biến thể "Người dịch", "Biên" và dấu cách tùy ý trước dấu ":".
_CREDIT_RE = re.compile(
    r"^[\s]*(Dịch giả|Người dịch|Biên tập|Biên|Nhóm dịch|Nguồn truyện|Nguồn)\s*:",
    re.UNICODE,
)
_DASH_RE = re.compile(r"^[\s]*-{3,}[\s]*$", re.UNICODE)


def strip_translator_credit_footer(text: str) -> str:
    """Xóa các DÒNG credit nhóm dịch (Dịch giả/Người dịch/Biên/Biên tập/Nhóm dịch/Nguồn:…)
    dù ở đầu hay cuối chương. Chỉ bỏ đúng dòng credit + dòng phân cách '-----' liền kề,
    KHÔNG cắt phần nội dung truyện xung quanh."""
    if not text:
        return text
    lines = re.split(r"\r\n|\r|\n", text)
    keep = [not _CREDIT_RE.match(ln) for ln in lines]
    # Bỏ luôn dòng gạch ngang nếu nó chỉ kề sát (trên/dưới) một dòng credit đã bỏ.
    for i, ln in enumerate(lines):
        if keep[i] and _DASH_RE.match(ln):
            prev_removed = i > 0 and not keep[i - 1]
            next_removed = i + 1 < len(lines) and not keep[i + 1]
            if prev_removed or next_removed:
                keep[i] = False
    out = [ln for ln, k in zip(lines, keep) if k]
    return "\n".join(out).strip()


_PROMO_RE = re.compile(
    r"(Hãy tham gia Group|Hãy vào\s+.*để đọc truyện nhanh|cập nhật truyện nhanh nhất|vietwriter)",
    re.IGNORECASE | re.UNICODE,
)

# Ad inline trong ngoặc: "( đọc truyện tại truyenyy.Pro để ủng hộ dịch giả nhé ... )".
# Xóa cụm trong ngoặc bám theo "đọc truyện tại <site>" thay vì cắt cả chương.
_INLINE_AD_RE = re.compile(
    r"\(\s*đọc truyện tại[^)]*\)\s*", re.IGNORECASE | re.UNICODE
)


def strip_inline_repost_ads(text: str) -> str:
    """Xóa các cụm quảng bá inline "( đọc truyện tại … )" lẫn trong câu."""
    if not text:
        return text
    return _INLINE_AD_RE.sub("", text)


def strip_repost_site_promo_block(text: str) -> str:
    """Cắt khối quảng bá site repost (Vietwriter / mời theo Group Facebook) tới hết chương."""
    if not text:
        return text
    lines = re.split(r"\r\n|\r|\n", text)
    cut = None
    for i, line in enumerate(lines):
        if _PROMO_RE.search(line):
            cut = i
            break
    if cut is None:
        return text
    return "\n".join(lines[:cut]).rstrip()


def sanitize_content(text: str) -> str:
    text = strip_exclusive_publishing_notice(text)
    text = strip_known_source_domains(text)
    text = strip_known_source_labels(text)
    text = strip_translator_credit_footer(text)
    text = strip_inline_repost_ads(text)
    text = strip_repost_site_promo_block(text)
    text = strip_follow_along_notice(text)
    return text


# ── Slug / chapter number helpers ───────────────────────────────────────────

def make_slug(text: str) -> str:
    """Tương đương Str::slug() của Laravel (dùng python-slugify)."""
    try:
        from slugify import slugify
        return slugify(text, separator="-", lowercase=True) or "chuong"
    except ImportError:
        s = text.lower()
        s = re.sub(r"[^\w\s-]", "", s)
        s = re.sub(r"[\s_]+", "-", s).strip("-")
        return s or "chuong"


def infer_chapter_number(title: str) -> int | None:
    if not title:
        return None
    t = title.strip()
    m = re.match(r"^#\s*(\d+)\s*[.):：]", t)
    if m:
        n = int(m.group(1))
        return n if 1 <= n < 1_000_000 else None
    m = re.search(r"Chương\s*(\d+)", t, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        return n if 1 <= n < 1_000_000 else None
    m = re.search(r"Chuong\s*(\d+)", t, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        return n if 1 <= n < 1_000_000 else None
    return None


def slug_from_folder(folder: str) -> str:
    """Chuyển folder name thành story slug (giữ nguyên)."""
    return folder


def title_from_folder(folder: str) -> str:
    """Best-effort title từ slug folder."""
    return folder.replace("-", " ").title()


def read_story_meta(story_dir: str, folder: str) -> dict:
    """Đọc meta.json của truyện. Title lấy từ meta; fallback về tên folder.

    Trả {title, description}. meta.json có dạng:
        {"title": "A LINH", "author": "Zhihu", "sourceUrl": "...", ...}
    """
    meta_path = os.path.join(story_dir, "meta.json")
    title = title_from_folder(folder)
    description = None
    try:
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
        t = (meta.get("title") or "").strip()
        if t:
            title = t
        author = (meta.get("author") or "").strip()
        if author:
            description = f"Tác giả: {author}"
    except FileNotFoundError:
        pass
    except Exception as e:  # meta lỗi không nên chặn import chương
        print(f"  WARN reading meta.json for {folder}: {e}")
    return {"title": title[:500], "description": description}


# ── DB helpers ───────────────────────────────────────────────────────────────

def get_or_create_story(cur, slug: str, title: str, description: str | None = None) -> int:
    cur.execute("SELECT id FROM stories WHERE slug = %s", (slug,))
    row = cur.fetchone()
    if row:
        # Đồng bộ lại title/description từ meta.json cho truyện đã tồn tại.
        cur.execute(
            "UPDATE stories SET title = %s, description = COALESCE(%s, description), updated_at = NOW() WHERE id = %s",
            (title, description, row[0]),
        )
        return row[0]
    cur.execute(
        "INSERT INTO stories (title, slug, description, genres, serial_status, created_at, updated_at) "
        "VALUES (%s, %s, %s, %s, 'ongoing', NOW(), NOW()) RETURNING id",
        (title, slug, description, json.dumps([])),
    )
    return cur.fetchone()[0]


def get_existing_chapter_slugs(cur, story_id: int) -> set[str]:
    cur.execute("SELECT slug FROM chapters WHERE story_id = %s", (story_id,))
    return {r[0] for r in cur.fetchall()}


def get_existing_chapter_titles(cur, story_id: int) -> dict[str, int]:
    """title -> chapter_id"""
    cur.execute("SELECT title, id FROM chapters WHERE story_id = %s", (story_id,))
    return {r[0]: r[1] for r in cur.fetchall()}


def unique_slug(base: str, existing: set[str]) -> str:
    slug = base or "chuong"
    if slug not in existing:
        return slug
    suffix = 2
    while f"{slug}-{suffix}" in existing:
        suffix += 1
    return f"{slug}-{suffix}"


def import_story(cur, story_slug: str) -> dict:
    story_dir = os.path.join(DATA_DIR, story_slug)
    chapters_dir = os.path.join(story_dir, "chapters")

    if not os.path.isdir(chapters_dir):
        return {"skipped": True, "reason": "no chapters dir"}

    chapter_files = sorted(
        [f for f in os.listdir(chapters_dir) if f.endswith(".json")]
    )
    if not chapter_files:
        return {"skipped": True, "reason": "no chapter files"}

    meta = read_story_meta(story_dir, story_slug)
    story_id = get_or_create_story(cur, story_slug, meta["title"], meta["description"])

    existing_titles = get_existing_chapter_titles(cur, story_id)
    existing_slugs = get_existing_chapter_slugs(cur, story_id)

    created = 0
    updated = 0
    errors = 0

    for fname in chapter_files:
        fpath = os.path.join(chapters_dir, fname)
        try:
            with open(fpath, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            errors += 1
            print(f"  ERROR reading {fname}: {e}")
            continue

        title = (data.get("title") or "").strip()
        content = sanitize_content(data.get("content") or "")
        chapter_number = infer_chapter_number(title)

        if not title:
            errors += 1
            continue

        # Truncate to DB column limits (chapters.title = varchar(255))
        title = title[:255]

        if title in existing_titles:
            # update content
            cur.execute(
                "UPDATE chapters SET content = %s, updated_at = NOW() WHERE id = %s",
                (content, existing_titles[title]),
            )
            updated += 1
        else:
            slug_base = make_slug(title)[:185]  # leave room for -N suffix
            chapter_slug = unique_slug(slug_base, existing_slugs)
            existing_slugs.add(chapter_slug)
            existing_titles[title] = -1  # placeholder

            cur.execute(
                "INSERT INTO chapters "
                "(story_id, title, slug, chapter_number, content, duration, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, 0, NOW(), NOW())",
                (story_id, title, chapter_slug, chapter_number, content),
            )
            created += 1

    return {"story_id": story_id, "created": created, "updated": updated, "errors": errors}


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import JSON story data to Postgres")
    parser.add_argument("--story", help="Import only this story slug", default=None)
    args = parser.parse_args()

    stories = sorted(os.listdir(DATA_DIR))
    if args.story:
        if args.story not in stories:
            print(f"Story '{args.story}' not found in {DATA_DIR}")
            sys.exit(1)
        stories = [args.story]

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False

    total_created = 0
    total_updated = 0
    total_errors = 0
    start = time.time()

    print(f"Importing {len(stories)} stories from {DATA_DIR} ...")

    for i, slug in enumerate(stories, 1):
        story_dir = os.path.join(DATA_DIR, slug)
        if not os.path.isdir(story_dir):
            continue

        try:
            with conn.cursor() as cur:
                result = import_story(cur, slug)
            conn.commit()

            if result.get("skipped"):
                print(f"[{i:3}/{len(stories)}] SKIP  {slug} — {result['reason']}")
                continue

            total_created += result["created"]
            total_updated += result["updated"]
            total_errors += result["errors"]
            elapsed = time.time() - start
            print(
                f"[{i:3}/{len(stories)}] OK    {slug}  "
                f"+{result['created']} new  ~{result['updated']} upd  "
                f"err={result['errors']}  ({elapsed:.1f}s)"
            )
        except Exception as e:
            conn.rollback()
            total_errors += 1
            print(f"[{i:3}/{len(stories)}] FAIL  {slug}: {e}")

    conn.close()
    elapsed = time.time() - start
    print(
        f"\nDone in {elapsed:.1f}s — "
        f"{total_created} chapters created, "
        f"{total_updated} updated, "
        f"{total_errors} errors."
    )


if __name__ == "__main__":
    main()
