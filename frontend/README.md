# Frontend (Next.js)

Ứng web kết nối API Laravel: danh sách truyện, tạo truyện, chi tiết (phát audio nếu có / đọc chương bằng trình duyệt).

Trang chủ hiển thị truyện theo khối thể loại (mỗi thể loại tối đa 4 truyện), đọc trực tiếp từ trường `genre` do backend trả về.

## Yêu cầu

- Node.js **20+** (khuyến nghị 22)

## Chạy local

```bash
cd frontend
npm install
cp ../compose.env.example ../.env   # không bắt buộc
```

Tạo `.env.local` (hoặc export):

```bash
# Chỉ gốc origin (không thêm /api) — mã gọi API luôn dùng path kiểu /api/stories/...
NEXT_PUBLIC_API_URL=http://localhost:8000
# SSR trong Docker cần thêm API_URL=http://backend:8000 — xem docker-compose
```

```bash
npm run dev
```

Mở http://localhost:3000

## Cấu hình trong repo

| Nguồn | Mô tả |
|--------|--------|
| `.env.local` (không commit) | `NEXT_PUBLIC_API_URL`, tùy chọn biến khác cho Next |
| `next.config.ts` | Tùy chọn rewrite, domain ảnh, v.v. |
| `package.json` | Script `dev`, `build`, … |

**Docker:** biến do Compose inject — xem `docker-compose.yml` (service `frontend`): `NEXT_PUBLIC_API_URL=http://story.test` (không `/api`), `API_URL` (SSR gọi `http://backend:8000`).

**Quy ước:** mỗi lần thêm env hoặc chỉnh `next.config` / Docker liên quan frontend → cập nhật **`frontend/README.md`** và **`.cursor/agents/frontend/AGENT.md`**.

## Hợp đồng API dùng cho phân loại trang chủ

- `Story.genre` là nguồn sự thật cho UI thể loại.
- Giá trị đang dùng: `tu-tien`, `huyen-huyen`, `kiem-hiep`, `do-thi`, `khac`.

## Docker

Từ gốc repo: `docker compose up frontend`. Biến `API_URL` trỏ tới service `backend` cho Server Components; trình duyệt dùng `NEXT_PUBLIC_API_URL` tới `http://localhost:8000`.

## Các lệnh chạy trong container

Chạy từ **gốc repo**. Thư mục làm việc trong container: **`/app`** (trùng mount `./frontend`).

| Mục đích | Lệnh |
|----------|------|
| Build production | `docker compose exec frontend npm run build` |
| Lint | `docker compose exec frontend npm run lint` |
| Cài lại dependency sau khi đổi `package.json` | `docker compose exec frontend npm install` |
| Shell | `docker compose exec frontend sh` |

Cần service **`frontend`** đang chạy (`docker compose up -d frontend` hoặc full stack).
