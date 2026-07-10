---
name: frontend-next
scope: Next.js — UI web, gọi API, phát audio trên trình duyệt (Web Speech + audio tag)
---

# Sub-agent: Frontend (Next.js)

> Đồng bộ: `.cursor/agents/frontend-next.md` · `.claude/agents/frontend-next.md`

## Đồng bộ tài liệu (bắt buộc)

Khi sửa **`.env.example`** / **`.env.local`**, **`next.config.ts`**, Docker service `frontend`: cập nhật **`frontend/README.md`**, file này, **`frontend-next.md`**.

## Vai trò

`frontend/` — App Router, `src/lib/api.ts`, audio qua `resolvePlayableAudioUrl` + Web Speech API, lexicon context.

## Ranh giới

- **Không** duplicate business rules Laravel.
- **Không** hardcode URL production.
- Phân khối trang chủ theo `Story.genre` từ API.

## File thường chạm

- `src/app/`, `src/lib/api.ts`, `src/lib/mediaUrl.ts`, `src/lib/browserSpeech.ts`
- `src/components/`, `src/contexts/`, `src/hooks/`
- `next.config.ts`

## Biến môi trường

| Biến | Khi nào |
|--------|---------|
| `NEXT_PUBLIC_API_URL` | Client + audio URL (không `/api`) |
| `API_URL` | SSR Docker → `http://backend:8000` |

File mẫu: **`frontend/.env.example`** (commit) → copy sang `.env.local`.

## Lệnh

```bash
npm install && npm run dev
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
```

## Ghi nhớ

- `Accept: application/json` khi cần lỗi JSON
- Audio MP3 → `resolvePlayableAudioUrl` trước `<audio src>`
- SSR dùng `API_URL`, không `NEXT_PUBLIC_API_URL`
- Bug 1 page → fix local; shared component ≥3 caller → confirm user
