# Sub-agent theo vùng codebase

Mỗi thư mục con đây mô tả **một vai trò** (sub-agent): phạm vi trách nhiệm, ranh giới không sửa, và lệnh chạy tham chiếu.

Khi giao việc trong Cursor, hãy **đính kèm hoặc @** file `AGENT.md` tương ứng (ví dụ `@.cursor/agents/backend/AGENT.md`) để agent ưu tiên đúng layer.

## Quy ước bắt buộc: config ↔ README ↔ AGENT.md

Khi **thêm hoặc sửa cấu hình** (env, `config/*`, Docker, `docker-compose.yml`, `app.json`, `next.config`, v.v.) cho một vùng code:

| Bước | Việc cần làm |
|------|----------------|
| 1 | Cập nhật **`README.md` trong folder đó** (bảng biến, ý nghĩa, ví dụ, link file config). |
| 2 | Cập nhật **`AGENT.md` tương ứng** trong bảng dưới — cùng nội dung hướng dẫn / env / file chạm để agent và tài liệu người đọc thống nhất. |
| 3 | Nếu là env **Compose chung** hoặc image trong `docker/`: cập nhật **`compose.env.example`**, **`docker/README.md`**, và **`README.md` gốc repo** khi đổi cổng/URL/luồng. |

Agent (hoặc người) chỉnh code **phải** làm đủ bước 1–2 trong cùng PR/commit liên quan.

| Thư mục | Vai trò |
|---------|---------|
| [backend](./backend/AGENT.md) | API Laravel, DB, Storage, CORS |
| [frontend](./frontend/AGENT.md) | Next.js web |
| [mobile](./mobile/AGENT.md) | Expo / React Native + web |

Hướng dẫn chạy chi tiết: `README.md` trong từng app (`backend/`, `frontend/`, `app/`) và `docker/README.md`.
