#!/usr/bin/env python3
"""
Crawler truyện (tvtruyen.co.uk / tương tự) bằng Playwright + làm sạch HTML bằng BeautifulSoup.

Chạy:
  pip install -r requirements.txt
  playwright install chromium
  python crawler.py --url "https://www.tvtruyen.co.uk/...html" --max 5

Selectors có thể đổi theo site — chỉnh dict SELECTORS bên dưới sau khi F12 trên trang thật.
"""

from __future__ import annotations

import argparse
import json
import sys
import time

from playwright.sync_api import sync_playwright

from crawl_lib import DEFAULT_UA, collect_chapter_urls, crawl_chapter

# --- Tuỳ chỉnh theo từng site (kiểm tra DevTools) ---
SELECTORS = {
    # Link từng chương trong mục lục (có thể thử: "ul.list-chapter a", ".list-chapter a")
    "chapter_links": "ul.list-chapter a",
    # Nội dung chương
    "chapter_body": "#chapter-c",
    # Tiêu đề chương
    "chapter_title": "h2.chapter-title",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Crawl truyện (Playwright) → JSON")
    parser.add_argument(
        "--url",
        default="https://www.tvtruyen.co.uk/do-thi-tu-tien-muoi-nam-xuong-nui-tuc-vo-dich.html",
        help="URL trang tổng truyện (mục lục)",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=5,
        help="Số chương tối đa (0 = tất cả)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.5,
        help="Giây nghỉ giữa các chương (tránh rate-limit)",
    )
    parser.add_argument(
        "--headless",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Chạy ẩn trình duyệt (mặc định: true). Dùng --no-headless khi debug.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="truyen_data.json",
        help="File JSON đầu ra",
    )
    parser.add_argument(
        "--next-page-selector",
        default="",
        help="CSS nút/link sang trang mục lục kế (vd: .custom-page-item.nav-next .custom-page-link). Để trống = chỉ một trang.",
    )
    args = parser.parse_args()

    story_url = args.url.strip()
    if not story_url.startswith("http"):
        print("URL phải bắt đầu bằng http(s)://", file=sys.stderr)
        return 1

    results: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless)
        try:
            context = browser.new_context(user_agent=DEFAULT_UA, locale="vi-VN")
            page = context.new_page()

            print(f"--- Trang truyện: {story_url} ---")
            next_sel = (args.next_page_selector or "").strip()
            if next_sel:
                print(f"--- Phân trang mục lục (next): {next_sel} ---")
            urls = collect_chapter_urls(
                page,
                story_url,
                SELECTORS["chapter_links"],
                next_sel or None,
            )
            print(f"Tìm thấy {len(urls)} link chương.")

            if args.max and args.max > 0:
                urls = urls[: args.max]

            for i, chapter_url in enumerate(urls):
                try:
                    print(f"[{i + 1}/{len(urls)}] {chapter_url}")
                    data = crawl_chapter(
                        page,
                        chapter_url,
                        SELECTORS["chapter_title"],
                        SELECTORS["chapter_body"],
                    )
                    results.append(
                        {
                            "chapter_index": i + 1,
                            "title": data["title"],
                            "content": data["content"],
                            "url": data["url"],
                        }
                    )
                except Exception as e:  # noqa: BLE001
                    print(f"Lỗi chương {i + 1}: {e}", file=sys.stderr)
                if args.delay > 0:
                    time.sleep(args.delay)

        finally:
            browser.close()

    out_path = args.output
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"--- Xong: {len(results)} chương → {out_path} ---")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
