# Crawler (Python)

CLI crawl ra JSON (`crawler.py`) và **worker** (`worker.py`) lắng nghe Redis, gọi API Laravel nội bộ để ghi chương. Chi tiết luồng CMS + backend: `../backend/README.md` (mục Crawler), `../GUIDE_WINDOW.md`.

## Môi trường ảo (khuyến nghị)

Tách khỏi Python global (ví dụ Laragon) để tránh xung đột package:

**Windows (PowerShell), từ thư mục `crawler/`:**

```powershell
cd d:\PhpstormProjects\story\crawler
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

**Git Bash:**

```bash
cd d:/PhpstormProjects/story/crawler
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
playwright install chromium
```

Sau khi activate, mỗi lần làm việc: `.\.venv\Scripts\activate` (PowerShell) hoặc `source .venv/Scripts/activate` (Bash).

## Cấu hình

- Sao chép **`.env.example`** → **`.env`**, điền **`CRAWLER_INTERNAL_TOKEN`** (bắt buộc, **cùng giá trị** với `backend/.env`), `CRAWLER_API_BASE_URL`, `REDIS_*`, `CRAWLER_REDIS_QUEUE`.
- Sinh token một lần (từ thư mục `backend`): **`php artisan crawler:internal-token`** — copy dòng `CRAWLER_INTERNAL_TOKEN=...` vào cả `backend/.env` và `crawler/.env`, rồi `php artisan config:clear` và chạy lại worker.
- `worker.py` nạp `.env` tự động nếu đã cài `python-dotenv` (có trong `requirements.txt`).
- **`CRAWLER_WORKER_CONCURRENCY`** (mặc định `1`): một process chỉ xử lý **một job tại một thời điểm** (tuần tự các chương trong job). Đặt `3` (ví dụ) để fork **ba consumer** cùng `BLPOP` một list Redis — Redis gán mỗi message cho một consumer, nên **ba job khác nhau** có thể chạy song song (RAM/CPU cao hơn vì mỗi job mở Chromium riêng). Không nên đẩy hai worker cùng lúc lên **cùng một `crawler_job_id`** (trùng chương / race); hàng đợi bình thường mỗi message là một job id khác nhau thì ổn.
- **`CRAWLER_CHAPTER_CONCURRENCY`** (mặc định `1`) và/hoặc field **Số chương tải song song** khi tạo job CMS (`chapter_fetch_concurrency`): trong **một** job, worker có thể mở tối đa N tab chương **async** (Playwright) rồi **POST API vẫn theo thứ tự mục lục**. Giá trị trên job (nếu có) **ưu tiên** hơn biến môi trường. Giảm **`delay_seconds`** trên job (hoặc `0`) cũng rút ngắn thời gian nếu site cho phép.

## Chạy

Luôn dùng **Python trong `.venv`** (đã có `playwright`, `redis`, …):

**PowerShell (đường dẫn tuyệt đối, không cần `activate`):**

```powershell
d:\PhpstormProjects\story\crawler\.venv\Scripts\python.exe d:\PhpstormProjects\story\crawler\worker.py
```

**Sau khi `activate`:**

```bash
python worker.py
```

`run-dev.sh --with-crawler` khởi động worker khi có **`crawler/.env`** và **`crawler/.venv`**; không có cờ thì script chỉ chạy Redis/backend/frontend. Thiếu venv hoặc `.env` sẽ in cảnh báo và bỏ qua worker.

Log stdout có prefix **`[crawler]`**: body thô từ Redis sau `BLPOP`, số URL chương, từng bước quét + **POST API lưu ngay** sau mỗi chương (và `chapters_imported` / `story_id` từ response).

CLI ví dụ:

```bash
python crawler.py --url "https://..." --max 5
```

Nhiều trang mục lục (tvtruyen): thêm `--next-page-selector ".custom-page-item.nav-next .custom-page-link"` để worker lần lượt mở từng trang danh sách chương cho đến khi hết nút «next».

Thư mục **`.venv/`** đã liệt kê trong `.gitignore`.
