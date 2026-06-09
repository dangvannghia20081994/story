# Novel Crawler Agent Plan

## Mục tiêu

Xây dựng một tool Node.js để nhập URL truyện, tải danh sách chương, lấy nội dung từng chương, làm sạch HTML và xuất ra file đọc offline.

Ví dụ URL:

```text
https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html
```

## Nguyên tắc sử dụng

Tool này chỉ nên dùng cho mục đích cá nhân/offline với nội dung bạn có quyền truy cập.

Không dùng để:
- Re-upload truyện lên website khác.
- Bán lại nội dung.
- Chia sẻ full bộ công khai.
- Bypass paywall, đăng nhập, captcha hoặc cơ chế chống crawl.
- Tấn công hoặc gây tải lớn lên website nguồn.

Crawler cần:
- Tôn trọng robots.txt nếu có.
- Giới hạn tốc độ request.
- Có delay giữa các chương.
- Cho phép resume nếu bị lỗi.
- Không crawl song song quá mạnh.

---

# Kiến trúc tổng thể

```text
Novel URL
   ↓
Fetch main page
   ↓
Parse metadata
   ↓
Parse chapter list
   ↓
Download chapters
   ↓
Clean HTML
   ↓
Save raw + cleaned data
   ↓
Export TXT / Markdown / EPUB
```

---

# Công nghệ đề xuất

## Runtime

- Node.js 24

## Libraries

```bash
npm install axios cheerio slugify dotenv
```

Tuỳ chọn xuất EPUB:

```bash
npm install jszip
```

Implementation hiện tại tự tạo EPUB bằng `jszip` thay vì `epub-gen`, vì `epub-gen` kéo theo dependency cũ và audit báo vulnerability nghiêm trọng.

Tuỳ chọn browser render cho site dùng JavaScript:

```bash
npm install playwright
```

MVP nên bắt đầu với:

```text
axios + cheerio
```

Chỉ dùng Playwright nếu website render nội dung bằng JavaScript.

Ghi chú implementation hiện tại:
- Dùng Node.js built-in `fs/promises`, chưa cần `fs-extra`.
- Crawl tuần tự có delay nên chưa cần `p-limit` cho MVP.

---

# Cấu trúc thư mục

```text
novel-crawler/
├── package.json
├── .env
├── README.md
├── config/
│   └── site.tvtruyen.json
├── src/
│   ├── index.js
│   ├── crawler.js
│   ├── parser.js
│   ├── cleaner.js
│   ├── exporter.js
│   ├── storage.js
│   └── utils.js
├── output/
│   └── .gitkeep
├── data/
│   └── .gitkeep
└── logs/
    └── .gitkeep
```

---

# File config mẫu

## config/site.tvtruyen.json

```json
{
  "name": "tvtruyen",
  "baseUrl": "https://www.tvtruyen.ink",
  "selectors": {
    "title": "#comic_name, h1, h3.title",
    "author": ".author .item-value, [itemprop='author']",
    "chapterList": "#list-chapter a[href], #mobile-list-chapter a.chapter-link[href]",
    "chapterTitle": "h1, h2",
    "chapterContent": ".chapter-content, .content, #chapter-content, .chapter-c"
  },
  "request": {
    "delayMs": 1200,
    "timeoutMs": 20000,
    "maxRetries": 3,
    "userAgent": "Mozilla/5.0 NovelCrawler/1.0"
  }
}
```

Selector đã được chỉnh theo HTML thật của `tvtruyen.ink`:
- `#comic_name` lấy tên truyện.
- `.author .item-value` lấy tên tác giả, tránh lẫn nhãn `Tác giả:`.
- `#list-chapter a[href]` lấy danh sách chương chính trên desktop.
- `#mobile-list-chapter a.chapter-link[href]` là fallback cho DOM mobile.

Không dùng selector quá rộng như `a[href]` hoặc `a[href*='.html']` vì sẽ lẫn menu/sidebar/chương mới nhất hoặc bỏ sót URL chương không có `.html`.

---

# Phase 1: MVP tải truyện thành Markdown

## Input

```bash
node src/index.js "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html"
```

Test giới hạn số chương:

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html" --max-chapters 3 --force
```

Tải theo range index trong catalog:

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html" --from-index 3 --to-index 50
```

Lấy riêng catalog chương, không tải nội dung chương:

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html" --list-only
```

## Output

```text
output/tu-hai-nhi-bat-dau-nhap-dao-dich/
├── metadata.json
├── chapters.json
├── full.md
└── full.txt
```

## Việc cần làm

1. Fetch trang truyện chính.
2. Parse tên truyện.
3. Parse danh sách chương.
4. Chuẩn hoá URL chương.
5. Tải từng chương.
6. Làm sạch nội dung.
7. Lưu từng chương.
8. Ghép thành `full.md`.
9. Ghép thành `full.txt`.

## Rule làm sạch nội dung đã implement

Tham khảo rule từ:

```text
/home/hello/IdeaProjects/story/worker-crawler/crawl_lib.py
```

Pipeline hiện tại trong `src/cleaner.js`:

1. Xoá HTML noise trước khi lấy text:
   - `script`, `style`, `noscript`, `iframe`
   - form/input/button/select/textarea
   - block quảng cáo theo `.ads`, `.advertisement`, `.google-auto-placed`, `[class*="ads"]`, `[id*="ads"]`
2. Chuyển `<br>` thành newline, thêm newline sau các block tag như `p`, `div`, `section`, `article`, `h1`, `h2`, `h3`.
3. Normalize whitespace cơ bản:
   - `\r\n` thành `\n`
   - `&nbsp;` thành space thường
   - bỏ indent đầu dòng
   - gom nhiều newline trước khi xử lý line-level
4. Strip markdown bold/italic:
   - `**Tên nhân vật**` thành `Tên nhân vật`
   - `*Nàng*` thành `Nàng`
5. Normalize smart/curly quotes về ASCII:
   - `“...”` thành `"..."`
   - `‘...’` thành `'...'`
   - Không đụng dấu thoại tiếng Việt như `–` hoặc `—`.
6. Bỏ dòng artifact biên tập AI ở đầu nội dung:
   - `Biên tập lại:`
   - `Văn bản đã biên tập:`
   - `Dưới đây là văn bản đã được biên tập lại:`
   - Nếu câu tương tự nằm trong nội dung thật phía sau thì giữ lại.
7. Gộp khoảng trắng trong từng dòng.
8. Bỏ mọi dòng trống.
9. Bỏ dòng chỉ gồm dấu lặp:
   - `...`
   - `……`
   - `???`
10. Chuẩn hoá title/heading chương:
    - `#1. Giới thiệu` thành `Chương 1: Giới thiệu`
    - `#50. Chương 50: Thu phục...` giữ `Chương 50: Thu phục...`, không nhân đôi tiền tố
    - `# 12) Tên chương` thành `Tên chương`

Rule chuẩn hoá title nằm trong `normalizeChapterTitle()` và được dùng cho cả:
- title chương trong `parseChapterPage()`
- các dòng title-like còn sót trong body content

## Kết quả crawl live hiện tại

Đã crawl thử live URL:

```text
https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html
```

Command:

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html" --max-chapters 3 --force
```

Kết quả:
- Fetch main page thành công.
- Parse metadata thành công:
  - Title: `Từ Hài Nhi Bắt Đầu Nhập Đạo (Dịch)`
  - Author: `Cổ Hi`
- Phát hiện 25 page danh sách chương từ pagination `?page=N`.
- Fetch tuần tự page 2 đến page 25.
- Parse và merge/dedupe được 1206 mục chương.
- Sort đúng theo số thứ tự `#` trên catalog.
- Normalize title catalog:
  - `#1. Giới thiệu` thành `Chương 1: Giới thiệu`
  - `#1206. Chương 1204: Đại chiến nổi lên, hắn tới rồi! (6)` thành `Chương 1204: Đại chiến nổi lên, hắn tới rồi! (6)`
- Tải thành công 3 chương đầu.
- Ghi output vào:
  - `data/tu-hai-nhi-bat-dau-nhap-dao-dich/chapters/0001.json`
  - `data/tu-hai-nhi-bat-dau-nhap-dao-dich/chapters/0002.json`
  - `data/tu-hai-nhi-bat-dau-nhap-dao-dich/chapters/0003.json`
  - `output/tu-hai-nhi-bat-dau-nhap-dao-dich/full.md`
  - `output/tu-hai-nhi-bat-dau-nhap-dao-dich/full.txt`

Giới hạn còn lại:
- Nội dung chương vẫn còn một số dòng watermark/footer từ site như `Truyện được đăng tải duy nhất...` và `Bạn vừa đọc xong...`; có thể thêm cleaner rule nếu muốn output đọc offline sạch hơn.

---

# Phase 2: Resume và chống lỗi

## Mục tiêu

Nếu tải 1000 chương mà lỗi ở chương 300, chạy lại không tải lại từ đầu.

## Cách làm

Mỗi chương lưu riêng:

```text
data/tu-hai-nhi-bat-dau-nhap-dao-dich/chapters/
├── 0001.json
├── 0002.json
├── 0003.json
```

Mỗi file gồm:

```json
{
  "index": 1,
  "title": "Chương 1",
  "url": "...",
  "content": "...",
  "downloadedAt": "2026-06-09T00:00:00.000Z"
}
```

Khi chạy lại:
- Nếu chương đã tồn tại và content không rỗng thì bỏ qua.
- Nếu lỗi thì retry.
- Nếu vẫn lỗi thì ghi vào `failed.json`.

## Phase 2 đã hoàn chỉnh

Implementation hiện tại:
- Resume là mặc định.
- Chapter cache nằm ở `data/<slug>/chapters/0001.json`, `0002.json`, ...
- Chapter cache chỉ được dùng nếu `content` tồn tại và dài tối thiểu `request.minContentChars` hoặc mặc định 20 ký tự.
- Dùng `--force` để tải lại chapter đã cache.
- Catalog đầy đủ được cache riêng ở `data/<slug>/catalog.json`.
- `output/<slug>/chapters.json` là catalog đầy đủ.
- `output/<slug>/downloaded-chapters.json` là danh sách chương đã tải nội dung trong lần export hiện tại.
- Dùng `--refresh-catalog` để ép fetch lại toàn bộ pagination danh sách chương.
- `failed.json` merge theo URL, tăng `attempts`, giữ `firstFailedAt`, cập nhật lỗi mới nhất.
- Nếu chương từng fail sau đó tải thành công, URL đó được xoá khỏi `failed.json`.
- Có test tự động cho merge/xoá failed list.

---

# Phase 3: Xuất EPUB

## Output

```text
output/tu-hai-nhi-bat-dau-nhap-dao-dich/full.epub
```

## Library

```bash
npm install jszip
```

## Nội dung EPUB

- Title
- Author nếu parse được
- Chapter list
- Chapter content

## Phase 3 đã hoàn chỉnh

Implementation hiện tại:
- Tự build EPUB tối thiểu bằng `jszip`.
- Có `mimetype` không nén, `META-INF/container.xml`, `OEBPS/content.opf`, `OEBPS/nav.xhtml`, `OEBPS/styles.css`.
- Mỗi chương là một file XHTML riêng trong `OEBPS/chapters/`.
- Crawl/export bình thường sinh thêm `output/<slug>/full.epub`.
- Có test tự động kiểm tra archive EPUB chứa các file bắt buộc.

---

# Phase 4: UI đơn giản

## Mục tiêu

Tạo web UI local để nhập URL và bấm tải.

```text
Browser
   ↓
Node.js Express
   ↓
Crawler
   ↓
Output files
```

## UI tối thiểu

Form:

```text
Novel URL: [___________________]

Options:
[x] Export Markdown
[x] Export TXT
[ ] Export EPUB

[Start Crawl]
```

## Phase 4 đã hoàn chỉnh

Implementation hiện tại:
- Chạy UI local bằng:

```bash
npm run ui
```

- Nếu port 3000 bận:

```bash
PORT=3001 npm run ui
```

- UI phục vụ tại `http://127.0.0.1:<port>`.
- Form hỗ trợ:
  - Novel URL
  - Max chapters
  - Từ chương / Đến chương theo index trong catalog
  - Chỉ lấy catalog
  - Refresh catalog
  - Tải lại chapter
- Server dùng Node built-in `http`, không thêm Express.
- API start job chạy nền qua `child_process.spawn`.
- UI polling status/log mỗi giây.
- Khi job hoàn tất, UI hiển thị link output:
  - `metadata.json`
  - `chapters.json`
  - `downloaded-chapters.json`
  - `full.md`
  - `full.txt`
  - `full.epub`

Log realtime:

```text
[10:01] Fetching novel page...
[10:02] Found 1234 chapters.
[10:03] Downloading chapter 1/1234...
[10:04] Saved chapter 1.
```

## Thư mục thêm

```text
server/
├── server.js
└── public/
    ├── index.html
    └── app.js
```

---

# Phase 5: AI Reader Agent

Sau khi có nội dung truyện local, tích hợp với Claude/GPT để hỏi đáp.

## Ví dụ

```text
Tóm tắt 100 chương đầu.
Liệt kê nhân vật chính.
Liệt kê cảnh giới tu luyện.
Tóm tắt chương 500 đến 700.
Tìm các tình tiết quan trọng liên quan nhân vật X.
```

## Kiến trúc

```text
Markdown chapters
   ↓
Chunking
   ↓
Vector DB optional
   ↓
Claude/GPT
   ↓
Q&A / Summary
```

MVP chưa cần Vector DB. Có thể đọc theo range chương trước.

---

# Prompt cho AI Reader

```text
You are a novel reading assistant.

Rules:
- Only answer based on provided chapters.
- If information is missing, say it is missing.
- Summarize clearly.
- Preserve names and important terms.
- Do not invent plot details.
```

---

# CLI Commands đề xuất

## Tải truyện

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html"
```

## Tải thử N chương

```bash
npm run crawl -- "URL" --max-chapters 3
```

## Chỉ lấy danh sách chương

```bash
npm run crawl -- "URL" --list-only
```

## Resume

```bash
npm run crawl -- "URL" --resume
```

## Xuất lại Markdown từ data đã tải

```bash
npm run export -- --format md
```

## Xuất EPUB

```bash
npm run export -- --format epub
```

## Tóm tắt

```bash
npm run summarize -- --from 1 --to 100
```

---

# Pseudo Code

## src/index.js

```js
import { crawlNovel } from './crawler.js';

const url = process.argv[2];

if (!url) {
  console.error('Usage: node src/index.js <novel-url>');
  process.exit(1);
}

await crawlNovel(url);
```

## src/crawler.js

```js
export async function crawlNovel(url) {
  const html = await fetchHtml(url);
  const metadata = parseMetadata(html, url);
  const chapters = parseChapterList(html, url);

  await saveMetadata(metadata);
  await saveChapterList(chapters);

  for (const chapter of chapters) {
    if (await chapterExists(chapter)) continue;

    try {
      const chapterHtml = await fetchHtml(chapter.url);
      const parsed = parseChapter(chapterHtml, chapter.url);
      const cleaned = cleanChapter(parsed);
      await saveChapter(cleaned);
      await delay(config.request.delayMs);
    } catch (error) {
      await saveFailedChapter(chapter, error);
    }
  }

  await exportMarkdown();
  await exportTxt();
}
```

---

# Checklist MVP

## Setup

- [x] Tạo project Node.js.
- [x] Cài dependencies.
- [x] Tạo cấu trúc thư mục.
- [x] Tạo config site.

## Crawler

- [x] Fetch trang chính.
- [x] Fetch pagination danh sách chương.
- [x] Parse title.
- [x] Parse danh sách chương.
- [x] Fetch từng chương.
- [x] Clean nội dung.
- [x] Save chapter JSON.
- [x] Retry khi lỗi.
- [x] Delay request.

## Export

- [x] Export Markdown.
- [x] Export TXT.
- [x] Export EPUB optional.

## Safety

- [x] Không bypass paywall/captcha/login.
- [x] Có delay.
- [x] Có resume.
- [x] Có giới hạn max chapters khi test.
- [x] Có log lỗi.

## UI

- [x] Form nhập URL.
- [x] Button Start.
- [x] Hiển thị logs.
- [x] Link download output.

---

# Roadmap

## Version 0.1

CLI tải truyện thành Markdown/TXT.

## Version 0.2

Resume + retry + failed list.

## Version 0.3

Export EPUB.

## Version 0.4

Web UI local.

## Version 0.5

AI summary theo range chương.

## Version 1.0

Novel Reader Agent hoàn chỉnh.

---

# Gợi ý thực hiện trước

Bắt đầu bằng CLI, chưa làm UI ngay.

Thứ tự:

1. Parse chapter list.
2. Tải thử 3 chương đầu.
3. Clean content.
4. Export Markdown.
5. Thêm resume.
6. Tải full bộ.
7. Thêm EPUB.
8. Thêm UI.
9. Thêm AI summary.

---

# Definition of Done cho MVP

MVP hoàn thành khi chạy được:

```bash
npm run crawl -- "https://www.tvtruyen.ink/tu-hai-nhi-bat-dau-nhap-dao-dich.html"
```

và tạo ra:

```text
output/<novel-slug>/full.md
output/<novel-slug>/full.txt
data/<novel-slug>/chapters/*.json
```

Trong đó:
- Nội dung các chương đọc được.
- Không có HTML/script/ads.
- Có thể chạy lại để resume.
- Có log chương lỗi nếu có.
