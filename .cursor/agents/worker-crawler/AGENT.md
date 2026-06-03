---
name: worker-crawler-python
scope: Python crawler Playwright — worker-crawler/, Redis BLPOP, API nội bộ Laravel
---

# Sub-agent: Worker Crawler (Python)

> Đồng bộ: `.cursor/agents/worker-crawler-python.md` · `.claude/agents/worker-crawler-python.md`

## Đồng bộ tài liệu

Sửa `.env.example` hoặc Docker → **`worker-crawler/README.md`**, **`backend/README.md` (Crawler)**, **`docker/README.md`**.

## Vai trò

`worker-crawler/`: `worker.py` (Redis consumer), `crawler.py` (CLI test), `crawl_lib.py` (Playwright).

## Luồng

CMS → `crawler_jobs` + Redis → BLPOP → Chromium → POST `/api/internal/crawler/*` với `X-Crawler-Token`.

## Ranh giới

- **Không** sửa backend route — giao `backend-laravel`.
- Sanitize content: backend `Story::sanitizeChapterContent()`.

## Biến chính

`CRAWLER_INTERNAL_TOKEN`, `CRAWLER_API_BASE_URL`, `CRAWLER_REDIS_QUEUE`, `CRAWLER_WORKER_CONCURRENCY`, `CRAWLER_CHAPTER_CONCURRENCY`, timeout MS.

## Lệnh

```bash
pip install -r requirements.txt && playwright install chromium
python worker.py
docker compose --profile crawler up -d --build
php artisan crawler:internal-token   # trong backend/
```

## Ghi nhớ

- Không 2 worker cùng job_id
- Normalize title `#12. X` → `Chương 12: X`
- Log prefix `[crawler]`
