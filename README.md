# Novel Crawler

Node.js CLI for downloading a public novel page for personal offline reading.

Use it only for content you have the right to access. Do not use it to bypass paywalls, logins, captcha, rate limits, or anti-crawl mechanisms.

## Install

```bash
npm install
```

## Crawl

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html"
```

Optional flags:

```bash
npm run crawl -- "<novel-url>" --config config/site.tvtruyen.json --force
npm run crawl -- "<novel-url>" --from-index 3 --to-index 50
npm run crawl -- "<novel-url>" --max-chapters 3
npm run crawl -- "<novel-url>" --concurrency 4 --delay-ms 400
npm run crawl -- "<novel-url>" --list-only
npm run crawl -- "<novel-url>" --refresh-catalog
```

- `--config`: site config JSON path.
- `--force`: re-download chapters even if cached chapter files exist.
- `--from-index`: first catalog index to download.
- `--to-index`: last catalog index to download.
- `--max-chapters`: download only the first N parsed chapters.
- `--concurrency`: number of chapters to download in parallel (default 4 from config). Keep it modest (3-5) to stay polite to the source site.
- `--delay-ms`: delay before each worker's fetch, in milliseconds (default 500 from config). The effective request rate is roughly `concurrency / delay`.
- `--list-only`: fetch and save the full chapter catalog without downloading chapter content.
- `--refresh-catalog`: re-fetch paginated chapter lists instead of using cached `data/<slug>/catalog.json`.
- `--no-refresh-catalog`: skip the automatic catalog refresh and trust the cached catalog (faster, but won't pick up newly published chapters).
- `--retry-rounds`: number of automatic retry rounds for chapters that fail in the main pass (default 2). Retries run at a gentler concurrency (≤5).
- `--no-retry`: disable the automatic retry of failed chapters.

A **full** re-crawl (no `--from-index`/`--to-index`/`--max-chapters`)
automatically re-fetches the chapter list so newly published chapters are
picked up; `data/<slug>/meta.json` then grows its `chapterCount` (it only ever
increases, never shrinks from a partial crawl). Pass `--no-refresh-catalog` to
trust the cached catalog and skip the extra requests.

Chapters that fail during the main download pass (e.g. a timeout under high
concurrency) are automatically retried at a lower concurrency before the run
finishes. Each round only retries what is still failing and stops once a round
recovers nothing. Anything still failing is written to `data/<slug>/failed.json`
and is picked up on the next run.

## Crawl a whole site (multiple stories)

Pass a listing/home page URL. The crawler extracts every story link on that page,
then crawls each story one at a time, downloading its chapters with the given
concurrency (default 40).

```bash
npm run crawl-site -- "https://www.tvtruyen.ink/"
npm run crawl-site -- "https://www.tvtruyen.ink/" --concurrency 40
npm run crawl-site -- "https://www.tvtruyen.ink/" --max-stories 5 --max-chapters 50
npm run crawl-site -- "https://www.tvtruyen.ink/" --list-only
```

- `--concurrency`: chapters downloaded in parallel per story (default 40).
- `--max-stories`: crawl only the first N stories found on the page.
- `--max-chapters`: download only the first N chapters of each story.
- `--delay-ms`: delay before each worker's fetch, in milliseconds.
- `--list-only`: print the discovered story list without downloading.
- `--force`: re-download chapters even if cached.

Each story is saved under `data/<slug>/` and `output/<slug>/`, same layout as a
single-novel crawl.

## UI

```bash
npm run ui
```

Open `http://127.0.0.1:3000`. The page has two panels:

- **Crawl cả site (nhiều truyện)**: dán link trang chủ/danh sách, bấm **Lấy
  danh sách truyện** để hiện checkbox tất cả truyện trên trang, chọn truyện rồi
  bấm **Crawl truyện đã chọn**. Các truyện chạy lần lượt, mỗi truyện tải chương
  song song theo số luồng (mặc định 40). Log và link tải hiện ở panel trạng thái.
- **Crawl 1 truyện**: dán đúng link một truyện như trước.

If port 3000 is busy:

```bash
PORT=3001 npm run ui
```

## Output

```text
data/<novel-slug>/meta.json          # source-of-truth metadata (title, author, chapterCount, …)
data/<novel-slug>/catalog.json
data/<novel-slug>/chapters/0001.json
data/<novel-slug>/failed.json
output/<novel-slug>/metadata.json    # copy of data/<slug>/meta.json, regenerated on build
output/<novel-slug>/chapters.json
output/<novel-slug>/downloaded-chapters.json
output/<novel-slug>/chapters/0001.json
output/<novel-slug>/chapters/0001.md
output/<novel-slug>/chapters/0001.txt
output/<novel-slug>/full.md
output/<novel-slug>/full.txt
output/<novel-slug>/full.epub
```

Selectors in `config/site.tvtruyen.json` may need adjustment if the source site changes its HTML.

## Maintenance

Two scripts re-process already-downloaded content without re-fetching from the
source site.

### Re-clean cached chapters

`npm run reclean` strips injected ads (Shopee "open the app" prompts, site
watermarks/URLs, translator promo banners, SEO footers) from
`data/<slug>/chapters/*.json` and reflows old one-word-per-line chapters into
prose. It only rewrites files whose content actually changes, and is
idempotent (running it again on clean data changes nothing).

```bash
npm run reclean              # dry run — report what would change, write nothing
npm run reclean -- --write   # apply the changes in place
```

After re-cleaning, rebuild the exports so `output/` matches the cleaned data.

### Rebuild output from cached data

`npm run rebuild` regenerates everything under `output/<slug>/` (per-chapter
`json`/`md`/`txt`, `full.md`, `full.txt`, `full.epub`, `downloaded-chapters.json`,
`metadata.json`) from the cleaned `data/<slug>/chapters/*.json` — using the same
exporter the crawler uses, but without any network requests.

```bash
npm run rebuild                      # rebuild every novel
npm run rebuild -- a-linh vet-seo    # rebuild only the given slugs
```

> Note: with npm, flags and arguments must come after `--`
> (e.g. `npm run reclean -- --write`), otherwise npm swallows them.

## Backup to Google Drive

The machine has `rclone` configured with a `gdrive` remote. Use it to back up crawled
data to Google Drive under `gdrive:story/`.

```bash
# One-time: create the target folder on Drive
rclone mkdir gdrive:story/data

# Copy — uploads new/changed files, never deletes anything on Drive
rclone copy data gdrive:story/data -P

# Sync — makes Drive match the local folder (DELETES extra files on Drive)
rclone sync data gdrive:story/data -P
```

- `copy`: safe, additive. Re-running only uploads what changed; nothing is removed.
- `sync`: mirrors local → Drive, so files removed locally are also removed on Drive.
  Use it for an exact mirror, but double-check the source path first.
- `-P`: show live transfer progress.
- Add `--dry-run` to preview what would be transferred/deleted without changing anything.

Other folders can be backed up the same way, e.g. `rclone copy output gdrive:story/output -P`.

### Faster: compress before upload (recommended for many small files)

The crawler produces tens of thousands of tiny chapter JSON files. Google Drive
rate-limits *file creation* (not bandwidth), so uploading them one by one is very slow
(~2h for 50k files). Bumping `--transfers` barely helps — the limit is per-file API
quota.

Compressing into a single archive avoids the problem — the JSON text compresses well
and uploads as one stream in seconds. Use **zstd**: it compresses the data to ~15% of
its raw size (about half the size of gzip) and runs multi-threaded so it's fast.

```bash
# Create a zstd archive (-T0 = use all CPU cores), then upload the single file
tar cf - data | zstd -19 -T0 -o data.tar.zst
rclone copy data.tar.zst gdrive:story/ -P

# Restore later: download and extract
rclone copy gdrive:story/data.tar.zst . -P
tar -I zstd -xf data.tar.zst
```

Compression comparison on this dataset: gzip ≈ 28% of raw, zstd -19 / xz -9 ≈ 15%.
zstd is preferred over xz here because it is much faster at a near-identical ratio.

If `zstd` is not installed, fall back to gzip:

```bash
tar czf data.tar.gz data && rclone copy data.tar.gz gdrive:story/ -P   # restore: tar xzf data.tar.gz
```

Trade-off: on Drive it's a single archive, so to read individual chapters you must
download and extract it first. Good for backups, not for browsing files on Drive.
