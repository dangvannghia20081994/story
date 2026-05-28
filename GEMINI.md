# GEMINI.md — project `story`

File này chứa các chỉ dẫn nền tảng cho Gemini CLI trong repo này. Tuân thủ tuyệt đối các quy tắc dưới đây để đảm bảo tính nhất quán và an toàn cho hệ thống.

## Tổng quan dự án

Hệ thống monorepo đọc truyện online. 
- **Client**: Web (Next.js) và Mobile (Expo).
- **TTS**: Giọng đọc tổng hợp tại client (Web Speech API / `expo-speech`) và pipeline audio chất lượng cao server-side (Python workers).
- **Backend**: Laravel API điều phối, lưu trữ Postgres + Redis.
- **Crawler**: Worker Playwright crawl truyện từ nguồn ngoài.

## Stack & Layer

| Layer              | Thư mục                                                | Công nghệ                                                     |
|--------------------|--------------------------------------------------------|---------------------------------------------------------------|
| Backend API + CMS  | `backend/`                                             | Laravel 12, PHP ≥ 8.4, Postgres 16, Redis 7, Scramble OpenAPI |
| Web                | `frontend/`                                            | Next.js 15 (App Router), Tailwind                             |
| Mobile + web Metro | `app/`                                                 | Expo Router, RN, `expo-speech`, `expo-av`                     |
| Crawler            | `worker-crawler/`                                      | Python 3.10+, Playwright (Chromium), BLPOP Redis              |
| TTS workers        | `worker-tts/`, `worker-voice/`                         | Python — VieNeu-TTS / vi-xtts                                 |
| Infra              | `docker/`, `docker-compose.yml`, `compose.env.example` | Docker Compose, nginx                                         |

## URL chuẩn dev

- **API**: http://localhost:8000 (docs: `/docs/api`)
- **Next.js**: http://localhost:3000
- **Expo web**: http://localhost:8090
- **Postgres**: localhost:5432
- **Redis**: localhost:6379

## Quy tắc Routing & Delegation

Khi xử lý các task phức tạp hoặc chuyên biệt, ưu tiên sử dụng `invoke_agent` với các sub-agent phù hợp:
- **Nhiệm vụ chung/Batch**: Sử dụng `generalist`.
- **Phân tích/Điều phối hệ thống**: Sử dụng `codebase_investigator` để hiểu kiến trúc hoặc tìm root cause.
- **Chuyên biệt theo Layer**: Tham khảo các file hướng dẫn trong `.claude/agents/` hoặc `.cursor/agents/` để nắm vững context của từng layer (Backend, Frontend, Mobile, Crawler, TTS).

## Convention quan trọng

- **Nhánh chính**: `develop`. **Tuyệt đối không sửa code trực tiếp trên `develop`.**
- **Đặt tên nhánh**: `fix/YYYY-MM-<mô-tả>` | `feature/YYYY-MM-<mô-tả>` | `hotfix/YYYY-MM-<mô-tả>`.
- **Commit message**: Tiếng Việt, ngắn gọn, mô tả đúng thay đổi (vd: `Cập nhật cấu hình build apk`).
- **Genre chuẩn**: `tu-tien`, `huyen-huyen`, `kiem-hiep`, `do-thi`, `khac`.
- **Route key `{story}`**: Số → `id`, chuỗi → `slug`.
- **Storage audio**: `backend/storage/app/public/stories/{story_id}/chapters/{chapter_id}/audio.mp3`.
- **Crawler ↔ backend**: Header `X-Crawler-Token` cho API `/api/internal/crawler/*`.

## Đồng bộ cấu hình & ENV

Khi thay đổi `.env*`, `config/*`, `app.json`, `next.config.ts`, `docker-compose.yml`, hoặc Dockerfile:
1. Cập nhật **README** của folder tương ứng.
2. Cập nhật các file chỉ dẫn agent liên quan (Cursor/Claude agents nếu cần).
3. Nếu thay đổi hạ tầng chung, cập nhật `compose.env.example` và README gốc.

## Quy tắc An toàn & Kỹ thuật

- **Phạm vi (Scope)**: Không tự ý refactor ngoài phạm vi yêu cầu. Nếu thấy code xấu, chỉ đề xuất trong báo cáo.
- **Shared Components**: Hạn chế sửa các thành phần dùng chung. Nếu bắt buộc, phải liệt kê danh sách các bên liên quan và xác nhận rủi ro với người dùng.
- **Git**: Không dùng các lệnh hủy diệt (`reset --hard`, `push --force`) trừ khi được yêu cầu rõ ràng. Không `--no-verify`.
- **Database**: Mặc định dùng SELECT/EXPLAIN để nghiên cứu. Các lệnh thay đổi dữ liệu (DML/DDL) có thể thực hiện trực tiếp qua MCP hoặc shell command sau khi được người dùng xác nhận rõ ràng. Ưu tiên MCP cho các thao tác dữ liệu thuần túy để đạt tốc độ cao nhất.
- **Thẩm định (Validation)**: Mọi thay đổi code phải đi kèm với việc chạy test hoặc kiểm tra thủ công kỹ lưỡng.

## Chạy nhanh (Quick Start)

```bash
# Khởi động Gemini với quyền tự động (Khuyên dùng)
gemini --yolo                 # Tự động chạy tất cả lệnh (không cần confirm)
# HOẶC
gemini --approval-mode auto_edit # Tự động sửa code, chỉ hỏi khi chạy lệnh shell

# Setup backend env & start full stack
cp backend/.env.example backend/.env
docker compose up --build
```
# Chạy crawler (optional)
docker compose --profile crawler up -d --build
```

Chi tiết xem tại: `GUIDE_WINDOW.md`, `GUIDE_VPS_HAS_DOCKER.md`, `run-dev.sh`.

## Phong cách giao tiếp

- Ngôn ngữ: **Tiếng Việt**.
- Thái độ: Chuyên nghiệp, trực diện, không rườm rà.
- Xưng hô: "Em" - "Sếp" hoặc "Em" - "Anh".
- Cấu trúc: Báo cáo bước quan trọng, không kể lể suy nghĩ trừ khi cần giải thích lý do kỹ thuật.
