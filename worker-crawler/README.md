# Crawler (Python)

CLI crawl ra JSON (`crawler.py`) và **worker** (`worker.py`) lắng nghe Redis, gọi API Laravel nội bộ để ghi chương. Chi tiết luồng CMS + backend: `../backend/README.md` (mục Crawler), `../GUIDE_WINDOW.md`.

## Môi trường ảo (khuyến nghị)

Tách khỏi Python global (ví dụ Laragon) để tránh xung đột package:

**Windows (PowerShell), từ thư mục `worker-crawler/`:**

```powershell
cd d:\PhpstormProjects\story\worker-crawler
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

**Git Bash:**

```bash
cd d:/PhpstormProjects/story/worker-crawler
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
playwright install chromium
```

Sau khi activate, mỗi lần làm việc: `.\.venv\Scripts\activate` (PowerShell) hoặc `source .venv/Scripts/activate` (Bash).

## Cấu hình

- Sao chép **`.env.example`** → **`.env`**, điền **`CRAWLER_INTERNAL_TOKEN`** (bắt buộc, **cùng giá trị** với `backend/.env`), `CRAWLER_API_BASE_URL`, `REDIS_*`, `CRAWLER_REDIS_QUEUE`.
- Sinh token một lần (từ thư mục `backend`): **`php artisan crawler:internal-token`** — copy dòng `CRAWLER_INTERNAL_TOKEN=...` vào cả `backend/.env` và `worker-crawler/.env`, rồi `php artisan config:clear` và chạy lại worker.
- `worker.py` nạp `.env` tự động nếu đã cài `python-dotenv` (có trong `requirements.txt`).
- **`CRAWLER_WORKER_CONCURRENCY`** (mặc định `1`): một process chỉ xử lý **một job tại một thời điểm** (tuần tự các chương trong job). Đặt `3` (ví dụ) để fork **ba consumer** cùng `BLPOP` một list Redis — Redis gán mỗi message cho một consumer, nên **ba job khác nhau** có thể chạy song song (RAM/CPU cao hơn vì mỗi job mở Chromium riêng). Không nên đẩy hai worker cùng lúc lên **cùng một `crawler_job_id`** (trùng chương / race); hàng đợi bình thường mỗi message là một job id khác nhau thì ổn.
- **`CRAWLER_CHAPTER_CONCURRENCY`** (mặc định `1`) và/hoặc field **Số chương tải song song** khi tạo job CMS (`chapter_fetch_concurrency`): trong **một** job, worker có thể mở tối đa N tab chương **async** (Playwright) rồi **POST API vẫn theo thứ tự mục lục**. Giá trị trên job (nếu có) **ưu tiên** hơn biến môi trường. Giảm **`delay_seconds`** trên job (hoặc `0`) cũng rút ngắn thời gian nếu site cho phép.
- **`chapter_start`** (API nội bộ GET job, cột **`crawler_jobs.chapter_start`**, nhập khi **Tạo job Crawler**, mặc định `1`): số thứ tự chương **theo thứ tự URL mục lục nguồn** — worker bỏ qua mọi URL đứng trước, rồi mới áp **`max_chapters`**. Trường *Crawl từ chương* trên **Sửa truyện** (`stories.crawl_chapter_start`) chỉ là gợi ý khi chỉnh tay; có thể copy sang ô *Bắt đầu từ chương* khi tạo job.
- **`CRAWLER_GOTO_TIMEOUT_MS`** (mặc định `120000`) và **`CRAWLER_SELECTOR_TIMEOUT_MS`** (mặc định `60000`): thời gian chờ `page.goto` và `wait_for_selector` trong `crawl_lib.py`. Nếu log báo `Page.goto: Timeout … exceeded`, tăng dần (ví dụ `180000`) trong `worker-crawler/.env`; giới hạn 1s–15 phút.
- **Tiêu đề chương (`chapter_title_selector`)**: nếu selector trúng phần tử con (vd. `<a>` chỉ có «Chương 1»), worker leo lên `h1`–`h6` gần nhất hoặc khối có class chứa `chapter-title` rồi lấy **toàn bộ** `innerText`. Chuỗi dạng **`#12. Tên chương`** (như `span.chapter-text-all` trên tvtruyen) được chuẩn hóa thành **`Chương 12: Tên chương`**; các dạng `# 2) …` khác chỉ bỏ tiền tố số ở đầu.
- **Link mục lục (`chapter_links_selector`)**: với HTML kiểu `ul.list-chapter` / tvtruyen, dùng **`ul.list-chapter a`** (hoặc `.list-chapter li a`). Class `chapter-text-all` chỉ bọc text `#1. …` — không có sẵn chữ «Chương» trong DOM; phần đổi tên do `normalize_crawler_chapter_title` ở trên.

## Chạy bằng Docker (Compose)

Service **`worker-crawler`** dùng profile `crawler` (mặc định **không** chạy để tránh tốn RAM Chromium nếu không cần).

1. `cp .env.example .env` (trong thư mục `worker-crawler/`), điền **`CRAWLER_INTERNAL_TOKEN`** trùng `backend/.env`.
2. Từ **gốc repo**: `docker compose --profile crawler up -d --build`

Compose ghi đè **`REDIS_HOST=redis`** và **`CRAWLER_API_BASE_URL=http://backend:8000`** (gọi API trong mạng Docker; không dùng `story.test` trong container). Các biến khác (`CRAWLER_WORKER_CONCURRENCY`, …) lấy từ `worker-crawler/.env`.

Log: `docker compose logs -f worker-crawler`

## Chạy trên máy (venv)

Luôn dùng **Python trong `.venv`** (đã có `playwright`, `redis`, …):

**PowerShell (đường dẫn tuyệt đối, không cần `activate`):**

```powershell
d:\PhpstormProjects\story\worker-crawler\.venv\Scripts\python.exe d:\PhpstormProjects\story\worker-crawler\worker.py
```

**Sau khi `activate`:**

```bash
python worker.py
```

`run-dev.sh --with-crawler` khởi động worker khi có **`worker-crawler/.env`** và **`worker-crawler/.venv`**; không có cờ thì script chỉ chạy Redis/backend/frontend. Thiếu venv hoặc `.env` sẽ in cảnh báo và bỏ qua worker.

Log stdout có prefix **`[crawler]`**: body thô từ Redis sau `BLPOP`, số URL chương, từng bước quét + **POST API lưu ngay** sau mỗi chương (và `chapters_imported` / `story_id` từ response).

CLI ví dụ:

```bash
python crawler.py --url "https://..." --max 5
```

Nhiều trang mục lục (tvtruyen): thêm `--next-page-selector ".custom-page-item.nav-next .custom-page-link"` để worker lần lượt mở từng trang danh sách chương cho đến khi hết nút «next».

Thư mục **`.venv/`** đã liệt kê trong `.gitignore`.
