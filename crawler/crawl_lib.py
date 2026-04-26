"""Logic crawl dùng chung cho crawler.py CLI và worker.py (Redis)."""

from __future__ import annotations

import re
import sys
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.async_api import Page as AsyncPage
from playwright.async_api import TimeoutError as PlaywrightAsyncTimeout
from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeout

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
)


def clean_content(html_content: str) -> str:
    soup = BeautifulSoup(html_content, "html.parser")
    for tag in soup(["script", "style", "iframe", "noscript"]):
        tag.decompose()
    for tag in soup.select('[class*="ads"], [id*="ads"], .advertisement, .qc, .banner'):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_chapter_urls_from_open_page(page: Page, base_url: str, selector: str) -> list[str]:
    """Trang mục lục đã mở; lấy href các link chương (base_url để nối URL tương đối)."""
    links = page.query_selector_all(selector)
    urls: list[str] = []
    seen: set[str] = set()
    for link in links:
        href = link.get_attribute("href")
        if not href or href.startswith("#"):
            continue
        full = href if href.startswith("http") else urljoin(base_url, href)
        if full not in seen:
            seen.add(full)
            urls.append(full)
    return urls


def collect_chapter_urls(
    page: Page,
    start_url: str,
    links_selector: str,
    next_page_selector: str | None = None,
) -> list[str]:
    """
    Thu thập URL chương từ trang mục lục.
    Nếu next_page_selector có giá trị: sau mỗi trang lấy link trong
    `.custom-page-item.nav-next .custom-page-link` (hoặc selector bạn cấu hình),
    mở trang mục lục kế, lặp đến khi không còn nút next.
    """
    next_sel = (next_page_selector or "").strip()
    if not next_sel:
        page.goto(start_url, wait_until="domcontentloaded", timeout=60_000)
        try:
            page.wait_for_selector(links_selector, timeout=30_000)
        except PlaywrightTimeout:
            print(
                f"[warn] Không thấy selector danh sách chương: {links_selector!r}.",
                file=sys.stderr,
            )
            return []
        base = page.url or start_url
        return _extract_chapter_urls_from_open_page(page, base, links_selector)

    toc_pages_seen: set[str] = set()
    chapter_urls: list[str] = []
    chapter_seen: set[str] = set()
    current = start_url.strip()

    while current:
        if current in toc_pages_seen:
            print("[crawler] Phân trang mục lục: gặp lại URL trang đã mở — dừng.", file=sys.stderr)
            break
        toc_pages_seen.add(current)

        page.goto(current, wait_until="domcontentloaded", timeout=60_000)
        try:
            page.wait_for_selector(links_selector, timeout=30_000)
        except PlaywrightTimeout:
            print(
                f"[warn] Trang mục lục {current!r} không có selector {links_selector!r}.",
                file=sys.stderr,
            )
            break

        base = page.url or current
        for u in _extract_chapter_urls_from_open_page(page, base, links_selector):
            if u not in chapter_seen:
                chapter_seen.add(u)
                chapter_urls.append(u)

        next_el = page.query_selector(next_sel)
        if not next_el:
            break
        href = next_el.get_attribute("href")
        if href is None:
            break
        h = href.strip()
        if h in ("", "#", "javascript:void(0)", "javascript:;"):
            break
        next_url = h if h.startswith("http") else urljoin(base, h)
        if next_url == current:
            break
        current = next_url

    return chapter_urls


def resolve_chapter_urls(
    page: Page,
    story_url: str,
    links_selector: str | None,
    next_page_selector: str | None = None,
) -> list[str]:
    """Nếu không có selector link chương, chỉ crawl đúng một URL (source_url)."""
    sel = (links_selector or "").strip()
    if not sel:
        return [story_url.strip()]
    return collect_chapter_urls(page, story_url, sel, next_page_selector)


def crawl_chapter(page: Page, url: str, title_sel: str, body_sel: str) -> dict:
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    page.wait_for_selector(body_sel, timeout=30_000)
    title_el = page.query_selector(title_sel)
    title = title_el.inner_text().strip() if title_el else ""
    raw_html = page.inner_html(body_sel)
    clean_text = clean_content(raw_html)
    return {"title": title, "content": clean_text, "url": url}


async def crawl_chapter_async(page: AsyncPage, url: str, title_sel: str, body_sel: str) -> dict:
    """Giống crawl_chapter nhưng async — dùng với page riêng trong context (song song nhiều chương)."""
    await page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    try:
        await page.wait_for_selector(body_sel, timeout=30_000)
    except PlaywrightAsyncTimeout:
        print(
            f"[warn] Timeout chờ selector nội dung chương: {body_sel!r} — {url!r}.",
            file=sys.stderr,
        )
        raise
    title_el = await page.query_selector(title_sel)
    title = (await title_el.inner_text()).strip() if title_el is not None else ""
    raw_html = await page.inner_html(body_sel)
    clean_text = clean_content(raw_html)
    return {"title": title, "content": clean_text, "url": url}
