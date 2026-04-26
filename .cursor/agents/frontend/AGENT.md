---
name: frontend-web
scope: Next.js — UI web, gọi API, phát audio trên trình duyệt
---

# Sub-agent: Frontend (Next.js)

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **`.env.local`**, **`next.config.ts`**, hoặc biến Docker cho service `frontend`: cập nhật **`frontend/README.md`** và **file `AGENT.md` này**. Quy ước tổng: `.cursor/agents/README.md`.

## Vai trò

Bạn chịu trách nhiệm **`frontend/`** (App Router, React Server Components nơi có, client components): trang danh sách truyện, form tạo truyện, chi tiết truyện, trang bảng xếp hạng, trang danh sách thành viên, trang thông tin thành viên, nút xếp hàng TTS, thẻ `<audio>`. Gọi API qua `src/lib/api.ts` với **`NEXT_PUBLIC_API_URL`** (trình duyệt) và **`API_URL`** (SSR trong Docker).

## Ranh giới

- **Không** thay đổi worker Python hay pipeline TTS.
- **Không** nhân đôi business rules đã có ở Laravel; ưu tiên gọi API.
- Tránh hardcode URL production; dùng env.

## File thường chạm

- `src/app/`, `src/lib/api.ts`
- `next.config.ts`, `package.json`
- (Mẫu env) người dùng tạo `.env.local` — không commit secret

## Biến môi trường

| Biến | Khi nào |
|--------|---------|
| `NEXT_PUBLIC_API_URL` | Client + `apiFetch`; URL file audio thường **chuẩn qua** `resolvePlayableAudioUrl` + rewrite `/storage` trong `next.config.ts` (tránh lỗi “no supported sources” khi API trả `/storage/...` hoặc `audio_path` tương đối) |
| `API_URL` | SSR trong container — trỏ `http://backend:8000` (Compose) |

## Lệnh tham chiếu

Xem `frontend/README.md`: `npm ci`, `npm run dev`, Docker; mục **«Các lệnh chạy trong container»** cho `docker compose exec frontend …`.

## Ghi nhớ

- Gửi `Accept: application/json` khi cần lỗi JSON từ Laravel.
- API backend dùng **chương** (`/api/stories/.../chapters/.../queue-tts`); khi đổi contract API phải cập nhật UI và README/AGENT.
- Trang chủ phân khối theo `Story.genre` từ backend (không suy luận từ title/description ở frontend).
