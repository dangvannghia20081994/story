"""Logic crawl dùng chung cho crawler.py CLI và worker.py (Redis)."""

from __future__ import annotations

import os
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.async_api import Page as AsyncPage
from playwright.sync_api import Page
from playwright.sync_api import TimeoutError as PlaywrightTimeout

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
)


def _env_int_ms(name: str, default: int) -> int:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return default
    try:
        v = int(raw)
    except ValueError:
        return default
    return max(1_000, min(v, 900_000))


def goto_timeout_ms() -> int:
    """Playwright page.goto — mặc định 120s (site chậm / CDN). Ghi đè: CRAWLER_GOTO_TIMEOUT_MS."""
    return _env_int_ms("CRAWLER_GOTO_TIMEOUT_MS", 120_000)


def selector_timeout_ms() -> int:
    """wait_for_selector sau goto — mặc định 60s. Ghi đè: CRAWLER_SELECTOR_TIMEOUT_MS."""
    return _env_int_ms("CRAWLER_SELECTOR_TIMEOUT_MS", 60_000)


# Lấy toàn bộ text tiêu đề: nếu selector trúng <a> hoặc span con, inner_text() chỉ còn "Chương 1"
# thay vì "Chương 1: Mười năm sau". Leo lên h1–h6 hoặc khối .chapter-title rồi innerText.
_TITLE_CONTAINER_JS = """(el) => {
    const head = el.closest("h1, h2, h3, h4, h5, h6");
    const box = head || el.closest('[class*="chapter-title"]') || el;
    return (box.innerText || "").replace(/\\s+/g, " ").trim();
}"""

# Khi selector tiêu đề job không khớp / trả rỗng: thử khối chương chính (tránh modal trùng class).
_FALLBACK_CHAPTER_TITLE_JS = """() => {
    function norm(s) {
        return (s || "").replace(/\\s+/g, " ").trim();
    }
    const root =
        document.querySelector("#chapter-big-container") ||
        document.querySelector(".container.chapter") ||
        document.body;
    const sels = [
        "h2",
        "a.chapter-title",
        "span.chapter-text-info",
        "div.comic-info-chapter-doc",
    ];
    for (const sel of sels) {
        const el = root.querySelector(sel);
        if (!el) continue;
        const t = norm(el.innerText);
        if (t.length >= 3) return t;
    }
    const h1 = root.querySelector("h1");
    if (!h1) return "";
    const t = norm(h1.innerText);
    const parts = t.split(/\\s*\\/\\s*/);
    for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i].trim();
        if (/Chương\\s*\\d+/i.test(p) || /#\\s*\\d+\\s*[\\.)]/i.test(p)) return p;
    }
    return t.length >= 3 ? t : "";
}"""


def _fallback_chapter_title_from_page(page: Page) -> str:
    try:
        raw = page.evaluate(_FALLBACK_CHAPTER_TITLE_JS)
    except Exception:  # noqa: BLE001
        return ""
    return normalize_crawler_chapter_title(str(raw or ""))


async def _fallback_chapter_title_from_page_async(page: AsyncPage) -> str:
    try:
        raw = await page.evaluate(_FALLBACK_CHAPTER_TITLE_JS)
    except Exception:  # noqa: BLE001
        return ""
    return normalize_crawler_chapter_title(str(raw or ""))


def _apply_title_fallback_if_empty(page: Page, title: str, title_sel: str) -> str:
    t = (title or "").strip()
    if t:
        return title
    fb = _fallback_chapter_title_from_page(page)
    if fb.strip():
        return fb
    return title


async def _apply_title_fallback_if_empty_async(page: AsyncPage, title: str, title_sel: str) -> str:
    t = (title or "").strip()
    if t:
        return title
    fb = await _fallback_chapter_title_from_page_async(page)
    if fb.strip():
        return fb
    return title


def normalize_crawler_chapter_title(raw: str) -> str:
    """Gộp khoảng trắng.

    - tvtruyen / nhiều site: «#1. Giới thiệu» trong DOM → chuẩn hóa thành «Chương 1: Giới thiệu».
    - «#50. Chương 50: Thu phục…» — phần sau dấu # đã có «Chương 50:» thì giữ nguyên, không nhân đôi tiền tố.
    - Các dạng «# 12) …» không khớp mẫu trên thì chỉ bỏ tiền tố số ở đầu.
    """
    t = re.sub(r"\s+", " ", (raw or "").strip())
    if not t:
        return ""
    m = re.match(r"^#\s*(\d+)\s*\.\s*(.+)$", t)
    if m:
        num_s, rest = m.group(1), m.group(2).strip()
        if re.match(r"^Chương\s*\d+", rest, re.IGNORECASE):
            return rest
        try:
            num = int(num_s)
        except ValueError:
            num = num_s
        return f"Chương {num}: {rest}".strip()
    t = re.sub(r"^#\s*\d+\s*[\.\):：]\s*", "", t)
    return t.strip()


def chapter_title_from_element(title_el) -> str:
    if title_el is None:
        return ""
    try:
        raw = title_el.evaluate(_TITLE_CONTAINER_JS)
    except Exception:  # noqa: BLE001
        try:
            raw = title_el.inner_text()
        except Exception:  # noqa: BLE001
            return ""
    return normalize_crawler_chapter_title(str(raw or ""))


async def chapter_title_from_element_async(title_el) -> str:
    if title_el is None:
        return ""
    try:
        raw = await title_el.evaluate(_TITLE_CONTAINER_JS)
    except Exception:  # noqa: BLE001
        try:
            raw = await title_el.inner_text()
        except Exception:  # noqa: BLE001
            return ""
    return normalize_crawler_chapter_title(str(raw or ""))


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
        page.goto(start_url, wait_until="domcontentloaded", timeout=goto_timeout_ms())
        try:
            page.wait_for_selector(links_selector, timeout=selector_timeout_ms())
        except PlaywrightTimeout:
            return []
        base = page.url or start_url
        return _extract_chapter_urls_from_open_page(page, base, links_selector)

    toc_pages_seen: set[str] = set()
    chapter_urls: list[str] = []
    chapter_seen: set[str] = set()
    current = start_url.strip()

    while current:
        if current in toc_pages_seen:
            break
        toc_pages_seen.add(current)

        page.goto(current, wait_until="domcontentloaded", timeout=goto_timeout_ms())
        try:
            page.wait_for_selector(links_selector, timeout=selector_timeout_ms())
        except PlaywrightTimeout:
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
    page.goto(url, wait_until="domcontentloaded", timeout=goto_timeout_ms())
    page.wait_for_selector(body_sel, timeout=selector_timeout_ms())
    title_el = page.query_selector(title_sel)
    title = chapter_title_from_element(title_el)
    title = _apply_title_fallback_if_empty(page, title, title_sel)
    raw_html = page.inner_html(body_sel)
    clean_text = clean_content(raw_html)
    return {"title": title, "content": clean_text, "url": url}


async def crawl_chapter_async(page: AsyncPage, url: str, title_sel: str, body_sel: str) -> dict:
    """Giống crawl_chapter nhưng async — dùng với page riêng trong context (song song nhiều chương)."""
    await page.goto(url, wait_until="domcontentloaded", timeout=goto_timeout_ms())
    await page.wait_for_selector(body_sel, timeout=selector_timeout_ms())
    title_el = await page.query_selector(title_sel)
    title = await chapter_title_from_element_async(title_el)
    title = await _apply_title_fallback_if_empty_async(page, title, title_sel)
    raw_html = await page.inner_html(body_sel)
    clean_text = clean_content(raw_html)
    return {"title": title, "content": clean_text, "url": url}
