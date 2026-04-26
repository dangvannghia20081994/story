#!/usr/bin/env python3
"""
Worker: BLPOP Redis list (mặc định crawler:queue), nhận crawler_job_id,
đọc cấu hình từ API Laravel, Playwright crawl, POST từng chương qua API nội bộ.

Biến môi trường (export hoặc file `crawler/.env` — tự nạp khi chạy worker):
  REDIS_HOST, REDIS_PORT (mặc định 6379)
  CRAWLER_REDIS_QUEUE — trùng với backend CRAWLER_REDIS_QUEUE
  CRAWLER_API_BASE_URL — vd: http://localhost:8000
  CRAWLER_INTERNAL_TOKEN — trùng CRAWLER_INTERNAL_TOKEN (header X-Crawler-Token)
  CRAWLER_HEADLESS — 1/true để headless (mặc định true)
  CRAWLER_WORKER_CONCURRENCY — số process consumer song song (mặc định 1). Mỗi process BLPOP riêng → nhiều job chạy đồng thời (mỗi job một Chromium riêng).
  CRAWLER_CHAPTER_CONCURRENCY — khi job không ghi chapter_fetch_concurrency: số trang chương tải song song (mặc định 1). API job có field chapter_fetch_concurrency thì ưu tiên.

Luồng mỗi chương: quét HTML → POST /api/internal/crawler/jobs/{id}/chapters theo đúng thứ tự mục lục (fetch có thể song song khi concurrency > 1).
"""

from __future__ import annotations

import asyncio
import json
import multiprocessing
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright

from crawl_lib import DEFAULT_UA, crawl_chapter, resolve_chapter_urls

_ENV_FILE = Path(__file__).resolve().parent / ".env"


def _load_env_file() -> None:
    """Nạp crawler/.env nếu có python-dotenv; không có thì chỉ dùng biến môi trường sẵn có."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        if _ENV_FILE.is_file():
            print(
                "[crawler] Có file .env nhưng chưa cài python-dotenv. Chạy: pip install -r requirements.txt",
                file=sys.stderr,
            )
        return
    load_dotenv(_ENV_FILE)


_load_env_file()


def crawler_log(message: str) -> None:
    """Log stdout có prefix, flush để xem real-time khi chạy worker."""
    print(f"[crawler] {message}", flush=True)


def env_bool(name: str, default: bool = True) -> bool:
    v = os.environ.get(name, "").strip().lower()
    if v in ("0", "false", "no", "off"):
        return False
    if v in ("1", "true", "yes", "on"):
        return True
    return default


def redis_queue_key() -> str:
    return os.environ.get("CRAWLER_REDIS_QUEUE", "crawler:queue")


def api_base() -> str:
    return os.environ.get("CRAWLER_API_BASE_URL", "http://localhost:8000").rstrip("/")


def internal_token() -> str:
    t = os.environ.get("CRAWLER_INTERNAL_TOKEN", "").strip()
    if not t:
        print(
            "[crawler] Thiếu CRAWLER_INTERNAL_TOKEN (crawler/.env hoặc biến môi trường).\n"
            "  Phải trùng giá trị CRAWLER_INTERNAL_TOKEN trong backend/.env.\n"
            "  Sinh token:  cd backend  &&  php artisan crawler:internal-token\n"
            "  Rồi copy dòng CRAWLER_INTERNAL_TOKEN=... vào cả backend/.env và crawler/.env.",
            file=sys.stderr,
        )
        sys.exit(1)
    return t


def http_json(method: str, path: str, body: dict | None = None, timeout: int = 120) -> dict[str, Any]:
    url = api_base() + "/api" + path
    headers = {
        "X-Crawler-Token": internal_token(),
        "Accept": "application/json",
        "User-Agent": "story-crawler-worker/1",
    }
    data_bytes = None
    if body is not None:
        data_bytes = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {err_body}") from e


def patch_status(job_id: int, status: str, message: str | None = None) -> None:
    body: dict[str, Any] = {"status": status}
    if message is not None:
        body["message"] = message
    http_json("PATCH", f"/internal/crawler/jobs/{job_id}/status", body)


def post_chapter(job_id: int, title: str, content: str) -> dict[str, Any]:
    """POST một chương lên backend ngay sau khi quét xong (trả body JSON để log)."""
    return http_json(
        "POST",
        f"/internal/crawler/jobs/{job_id}/chapters",
        {"title": title, "content": content},
        timeout=180,
    )


def fetch_job(job_id: int) -> dict[str, Any]:
    r = http_json("GET", f"/internal/crawler/jobs/{job_id}")
    return r.get("data") or {}


def _effective_chapter_fetch_concurrency(job: dict[str, Any]) -> int:
    """Ưu tiên chapter_fetch_concurrency từ API job; không có thì CRAWLER_CHAPTER_CONCURRENCY; tối đa 16."""
    v = job.get("chapter_fetch_concurrency")
    if v is not None and v != "":
        try:
            n = int(v)
            if n >= 1:
                return min(n, 16)
        except (TypeError, ValueError):
            pass
    try:
        n = int((os.environ.get("CRAWLER_CHAPTER_CONCURRENCY") or "1").strip() or "1")
    except ValueError:
        n = 1
    return max(1, min(n, 16))


def _log_post_chapter_response(job_id: int, idx: int, total: int, api_resp: dict[str, Any]) -> None:
    inner = api_resp.get("data") or {}
    imported = inner.get("chapters_imported")
    sid = inner.get("story_id")
    created = inner.get("chapter_created")
    cid = inner.get("chapter_id")
    action = "tạo mới" if created is True else ("cập nhật" if created is False else "?")
    crawler_log(
        f"Job #{job_id}: [{idx}/{total}] API — {action} chapter_id={cid!r} "
        f"chapters_imported={imported!r} story_id={sid!r}"
    )


async def _async_fetch_and_post_chapters_ordered(
    urls: list[str],
    title_sel: str,
    body_sel: str,
    headless: bool,
    concurrency: int,
    job_id: int,
    delay: float,
) -> None:
    """Fetch nhiềng chương song song; POST API ngay khi đủ dãy liên tiếp từ chương chưa gửi (không chờ hết cả job)."""
    from crawl_lib import crawl_chapter_async

    from playwright.async_api import async_playwright

    total = len(urls)
    lock = asyncio.Lock()
    pending: dict[int, dict[str, Any]] = {}
    next_post = 0

    async def flush_ready() -> None:
        nonlocal next_post
        while True:
            batch: list[tuple[int, dict[str, Any]]] = []
            async with lock:
                while next_post in pending:
                    batch.append((next_post, pending.pop(next_post)))
                    next_post += 1
            if not batch:
                return
            for orig_i, data in batch:
                idx = orig_i + 1
                title = (data.get("title") or "").strip() or f"Chương {idx}"
                content = data.get("content") or ""
                n_chars = len(content)
                preview = title[:80] + ("…" if len(title) > 80 else "")
                crawler_log(
                    f"Job #{job_id}: [{idx}/{total}] quét xong — tiêu đề: {preview!r} ({n_chars} ký tự nội dung)"
                )
                crawler_log(
                    f"Job #{job_id}: [{idx}/{total}] POST API lưu chương — "
                    f"POST /api/internal/crawler/jobs/{job_id}/chapters"
                )
                api_resp = await asyncio.to_thread(post_chapter, job_id, title, content)
                _log_post_chapter_response(job_id, idx, total, api_resp)
                if delay > 0:
                    await asyncio.sleep(delay)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        try:
            context = await browser.new_context(user_agent=DEFAULT_UA, locale="vi-VN")
            sem = asyncio.Semaphore(concurrency)

            async def fetch_one(i: int, chapter_url: str) -> None:
                async with sem:
                    page = await context.new_page()
                    try:
                        idx = i + 1
                        crawler_log(
                            f"Job #{job_id}: [{idx}/{total}] (song song, tối đa {concurrency}) đang quét — {chapter_url}"
                        )
                        data = await crawl_chapter_async(page, chapter_url, title_sel, body_sel)
                    finally:
                        await page.close()
                async with lock:
                    pending[i] = data
                await flush_ready()

            await asyncio.gather(*(fetch_one(i, urls[i]) for i in range(total)))
            await flush_ready()
            async with lock:
                if pending or next_post != total:
                    raise RuntimeError(
                        f"Job #{job_id}: lỗi trạng thái sau crawl song song "
                        f"(next_post={next_post}, total={total}, pending_keys={sorted(pending)!r})."
                    )
        finally:
            await browser.close()


def run_one_job(job_id: int) -> None:
    try:
        _run_one_job_impl(job_id)
    except Exception as e:  # noqa: BLE001
        try:
            patch_status(job_id, "failed", message=str(e)[:10_000])
        except Exception:
            pass
        raise


def _run_one_job_impl(job_id: int) -> None:
    crawler_log(f"Bắt đầu job_id={job_id} — GET cấu hình từ API …")
    job = fetch_job(job_id)
    if not job:
        raise RuntimeError(f"Job {job_id} không tồn tại hoặc API lỗi.")

    source_url = (job.get("source_url") or "").strip()
    links_sel = job.get("chapter_links_selector") or ""
    next_page_sel = (job.get("chapter_list_next_page_selector") or "").strip()
    title_sel = (job.get("chapter_title_selector") or "").strip()
    body_sel = (job.get("chapter_content_selector") or "").strip()
    max_chapters = job.get("max_chapters")
    delay = float(job.get("delay_seconds") or 1.5)

    if not source_url or not title_sel or not body_sel:
        raise RuntimeError("Thiếu source_url hoặc selector tiêu đề/nội dung.")

    ch_fetch = _effective_chapter_fetch_concurrency(job)
    crawler_log(
        f"Job #{job_id}: source_url={source_url!r} "
        f"links_sel={links_sel!r} next_page_sel={next_page_sel!r} "
        f"title_sel={title_sel!r} body_sel={body_sel!r} "
        f"max_chapters={max_chapters!r} delay={delay} chapter_fetch_concurrency={ch_fetch}"
    )

    patch_status(job_id, "processing")

    headless = env_bool("CRAWLER_HEADLESS", True)
    urls: list[str] = []
    total = 0

    with sync_playwright() as p:
        browser = None
        try:
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(user_agent=DEFAULT_UA, locale="vi-VN")
            page = context.new_page()

            urls = resolve_chapter_urls(page, source_url, links_sel, next_page_sel or None)
            if not urls:
                raise RuntimeError("Không có URL chương (kiểm tra chapter_links_selector).")

            if max_chapters is not None and int(max_chapters) > 0:
                urls = urls[: int(max_chapters)]

            total = len(urls)
            crawler_log(f"Job #{job_id}: đã thu thập {total} URL chương sẽ quét (theo thứ tự).")

            if ch_fetch <= 1:
                for i, chapter_url in enumerate(urls):
                    idx = i + 1
                    crawler_log(f"Job #{job_id}: [{idx}/{total}] đang quét — {chapter_url}")
                    data = crawl_chapter(page, chapter_url, title_sel, body_sel)
                    title = (data.get("title") or "").strip() or f"Chương {idx}"
                    content = data.get("content") or ""
                    n_chars = len(content)
                    preview = title[:80] + ("…" if len(title) > 80 else "")
                    crawler_log(
                        f"Job #{job_id}: [{idx}/{total}] quét xong — tiêu đề: {preview!r} ({n_chars} ký tự nội dung)"
                    )
                    crawler_log(
                        f"Job #{job_id}: [{idx}/{total}] POST API lưu chương ngay — "
                        f"POST /api/internal/crawler/jobs/{job_id}/chapters"
                    )
                    api_resp = post_chapter(job_id, title, content)
                    _log_post_chapter_response(job_id, idx, total, api_resp)
                    if delay > 0:
                        time.sleep(delay)

                crawler_log(f"Job #{job_id}: hoàn tất {total} chương — PATCH status=completed")
                patch_status(job_id, "completed")
        finally:
            if browser is not None:
                browser.close()

    if ch_fetch > 1:
        crawler_log(
            f"Job #{job_id}: quét chương song song (tối đa {ch_fetch} tab) — "
            f"POST API ngay khi đủ chương liên tiếp từ đầu (không chờ fetch hết cả truyện)."
        )
        asyncio.run(
            _async_fetch_and_post_chapters_ordered(
                urls, title_sel, body_sel, headless, ch_fetch, job_id, delay
            )
        )

        crawler_log(f"Job #{job_id}: hoàn tất {total} chương — PATCH status=completed")
        patch_status(job_id, "completed")


def _consumer_log_prefix(slot: int, total_slots: int) -> str:
    if total_slots <= 1:
        return ""
    return f"[{slot + 1}/{total_slots}] "


def redis_consumer_loop(slot: int, total_slots: int) -> None:
    """Một process: BLPOP hàng đợi, xử lý từng job tuần tự trong process này."""
    try:
        import redis  # type: ignore[import-untyped]
    except ImportError:
        print("Cài redis: pip install redis", file=sys.stderr)
        sys.exit(1)

    prefix = _consumer_log_prefix(slot, total_slots)
    r_host = os.environ.get("REDIS_HOST", "127.0.0.1")
    r_port = int(os.environ.get("REDIS_PORT", "6379"))
    r_db = int(os.environ.get("REDIS_DB", "0"))
    r_pw = os.environ.get("REDIS_PASSWORD") or None
    r = redis.Redis(host=r_host, port=r_port, db=r_db, password=r_pw, decode_responses=True)
    key = redis_queue_key()
    crawler_log(
        f"{prefix}Consumer PID={os.getpid()} lắng nghe Redis "
        f"host={r_host!r} port={r_port} db={r_db} list={key!r}"
    )

    while True:
        item = r.blpop(key, timeout=0)
        if not item:
            continue
        redis_key, raw = item
        crawler_log(f"{prefix}BLPOP nhận message — list_key={redis_key!r} body(raw)={raw!r}")
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError as e:
            print(f"[crawler] {prefix}Bỏ qua message không phải JSON: raw={raw!r} lỗi={e}", file=sys.stderr)
            continue
        crawler_log(f"{prefix}BLPOP parse JSON thành dict: {msg!r}")
        job_id = msg.get("crawler_job_id")
        if not isinstance(job_id, int):
            try:
                job_id = int(job_id)
            except (TypeError, ValueError):
                print(f"[crawler] {prefix}Thiếu crawler_job_id hợp lệ trong message: {msg!r}", file=sys.stderr)
                continue
        try:
            run_one_job(job_id)
            crawler_log(f"{prefix}--- Job #{job_id} xử lý xong ---")
        except Exception as e:  # noqa: BLE001
            print(f"[crawler] {prefix}Job #{job_id} lỗi: {e}", file=sys.stderr)


def _parse_concurrency() -> int:
    raw = os.environ.get("CRAWLER_WORKER_CONCURRENCY", "1").strip()
    try:
        n = int(raw)
    except ValueError:
        n = 1
    return max(1, min(n, 32))


def main() -> int:
    n = _parse_concurrency()
    if n == 1:
        redis_consumer_loop(0, 1)
        return 0

    crawler_log(
        f"Khởi động {n} consumer song song — mỗi process BLPOP độc lập, Redis gán job không trùng. "
        f"(Giảm CRAWLER_WORKER_CONCURRENCY hoặc chỉ chạy một lệnh worker nếu máy yếu.)"
    )
    procs: list[multiprocessing.Process] = []
    for i in range(n):
        p = multiprocessing.Process(
            target=redis_consumer_loop,
            args=(i, n),
            name=f"crawler-consumer-{i}",
        )
        p.start()
        procs.append(p)
    for p in procs:
        p.join()
    return 0


if __name__ == "__main__":
    multiprocessing.freeze_support()
    raise SystemExit(main())
