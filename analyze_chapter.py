#!/usr/bin/env python3
"""
Gọi ollama story-analyzer để phân tích chapter, lưu kết quả ra {chapter_id}.json

Usage:
  python analyze_chapter.py --chapter-id 42
  python analyze_chapter.py --chapter-id 42 --out-dir ./analysis
  python analyze_chapter.py --story-id 1 --out-dir ./analysis   # toàn bộ story
  echo "<content>" | python analyze_chapter.py --chapter-id 42  # từ stdin
"""

import argparse
import json
import os
import re
import sys
import psycopg2
import requests

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "story-analyzer")
DB_DSN = os.getenv(
    "DATABASE_URL",
    "postgresql://story:story@localhost:5432/story",
)


def get_db():
    return psycopg2.connect(DB_DSN)


def fetch_chapters(chapter_id=None, story_id=None, force=False):
    conn = get_db()
    cur = conn.cursor()
    if chapter_id:
        cur.execute(
            "SELECT c.id, c.chapter_number, c.title, c.content, s.slug "
            "FROM chapters c JOIN stories s ON s.id = c.story_id "
            "WHERE c.id = %s",
            (chapter_id,),
        )
    elif story_id:
        if force:
            cur.execute(
                "SELECT c.id, c.chapter_number, c.title, c.content, s.slug "
                "FROM chapters c JOIN stories s ON s.id = c.story_id "
                "WHERE c.story_id = %s "
                "ORDER BY c.chapter_number",
                (story_id,),
            )
        else:
            cur.execute(
                "SELECT c.id, c.chapter_number, c.title, c.content, s.slug "
                "FROM chapters c JOIN stories s ON s.id = c.story_id "
                "WHERE c.story_id = %s AND c.analyzed_at IS NULL "
                "ORDER BY c.chapter_number",
                (story_id,),
            )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"id": r[0], "chapter_number": r[1], "title": r[2], "content": r[3], "slug": r[4]}
        for r in rows
    ]


MAX_CONTENT_CHARS = int(os.getenv("OLLAMA_MAX_CHARS", "3000"))
OLLAMA_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "900"))


def call_ollama(content: str, title: str = "") -> dict:
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS]
    prompt = f"Chapter: {title}\n\n{content}" if title else content
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
        stream=True,
        timeout=OLLAMA_TIMEOUT,
    )
    resp.raise_for_status()

    raw = ""
    for line in resp.iter_lines():
        if not line:
            continue
        chunk = json.loads(line)
        token = chunk.get("response", "")
        print(token, end="", flush=True)
        raw += token
        if chunk.get("done"):
            break
    print()  # newline sau khi stream xong

    # Tách JSON ra khỏi markdown code block nếu có
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    json_str = match.group(1) if match else raw.strip()

    # Fallback: tìm object JSON đầu tiên
    if not json_str.startswith("{"):
        m = re.search(r"\{.*\}", json_str, re.DOTALL)
        json_str = m.group(0) if m else json_str

    return json.loads(json_str)


def analyze_chapter(chapter: dict, out_dir: str):
    chapter_id = chapter["id"]
    print(f"  Analyzing chapter {chapter['chapter_number']} (id={chapter_id})...", end=" ", flush=True)

    content = chapter.get("content") or ""
    if not content.strip():
        print("SKIP (no content)")
        return

    result = call_ollama(content, chapter.get("title", ""))

    # Gắn metadata vào output
    result["chapter_id"] = chapter_id
    result["chapter_number"] = chapter["chapter_number"]
    result["title"] = chapter.get("title", "")

    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{chapter_id}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    seg_count = len(result.get("content_segments", []))
    char_count = len(result.get("characters", []))
    print(f"OK → {out_path} ({char_count} chars, {seg_count} segments)")


def main():
    parser = argparse.ArgumentParser(description="Phân tích chapter bằng ollama story-analyzer")
    parser.add_argument("--chapter-id", type=int, help="ID chapter cụ thể")
    parser.add_argument("--story-id", type=int, help="Phân tích toàn bộ story (chưa analyzed)")
    parser.add_argument("--out-dir", default="./analysis", help="Thư mục lưu file JSON (default: ./analysis)")
    parser.add_argument("--model", default=None, help="Override ollama model name")
    parser.add_argument("--force", action="store_true", help="Chạy lại cả chapter đã analyzed_at != NULL")
    args = parser.parse_args()

    if args.model:
        os.environ["OLLAMA_MODEL"] = args.model

    # Nhận content từ stdin nếu có (kết hợp với --chapter-id)
    if not sys.stdin.isatty() and args.chapter_id:
        content = sys.stdin.read()
        analyze_chapter(
            {"id": args.chapter_id, "chapter_number": 0, "title": "", "content": content},
            args.out_dir,
        )
        return

    if not args.chapter_id and not args.story_id:
        parser.error("Cần --chapter-id hoặc --story-id")

    chapters = fetch_chapters(chapter_id=args.chapter_id, story_id=args.story_id, force=args.force)
    if not chapters:
        msg = "Không tìm thấy chapter nào cần phân tích."
        if args.story_id and not args.force:
            msg += " (tất cả đã analyzed — thêm --force để chạy lại)"
        print(msg)
        return

    print(f"Phân tích {len(chapters)} chapter → {args.out_dir}/")
    for ch in chapters:
        analyze_chapter(ch, args.out_dir)

    print("Done.")


if __name__ == "__main__":
    main()
