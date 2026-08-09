# Sub-agent theo vùng codebase — Cursor

Project `story` có **9 sub-agent** (1 coordinator + 8 specialist), đồng bộ với `.claude/agents/`.

Cursor tự discover sub-agent từ **file `.md` phẳng** trong folder này. Gọi bằng `/tên-agent` hoặc nhắc Agent delegate (Task tool).

> **Văn phong response (bắt buộc)** — mục `## Từ ngữ trong response` đã có ở cuối cả 18 file agent (9 file phẳng + 9 `<layer>/AGENT.md`): cấm ẩn dụ/giật gân, ghép từ sượng, phóng đại, filler AI, văn nói/teencode; kèm bảng thay thế 14 cặp. Bản gốc để copy khi thêm agent mới: `.claude/agents/README.md` §"Quy ước chung — văn phong response".

## Cấu trúc

```
story-master (coordinator)
├── backend-laravel        — Laravel API + CMS Blade
├── frontend-next          — Next.js web
├── mobile-expo            — Expo (RN + web)
├── worker-crawler-python  — Playwright crawler worker
├── worker-tts-python      — Python TTS workers
├── devops-docker          — Docker Compose + nginx
├── db-postgres            — Postgres query (read-only mặc định)
└── story-analyzer         — Phân tích truyện: NER + gom thoại
```

## File sub-agent (Cursor Task tool)

| File | Vai trò |
|------|---------|
| [story-master.md](./story-master.md) | Coordinator — task ≥2 layer |
| [backend-laravel.md](./backend-laravel.md) | API Laravel, DB, CMS, Storage |
| [frontend-next.md](./frontend-next.md) | Next.js web, audio client |
| [mobile-expo.md](./mobile-expo.md) | Expo / React Native + web |
| [worker-crawler-python.md](./worker-crawler-python.md) | Crawler Playwright + Redis |
| [worker-tts-python.md](./worker-tts-python.md) | Revid TTS API (Redis BLPOP) |
| [devops-docker.md](./devops-docker.md) | Docker, nginx, compose |
| [db-postgres.md](./db-postgres.md) | Query Postgres debug |
| [story-analyzer.md](./story-analyzer.md) | Phân tích nội dung truyện |

## Thư mục AGENT.md (@-mention thủ công)

Mỗi thư mục con có `AGENT.md` — dùng khi **@** trong chat (ví dụ `@.cursor/agents/backend/AGENT.md`):

| Thư mục | Agent |
|---------|--------|
| [story-master](./story-master/AGENT.md) | Coordinator |
| [backend](./backend/AGENT.md) | backend-laravel |
| [frontend](./frontend/AGENT.md) | frontend-next |
| [mobile](./mobile/AGENT.md) | mobile-expo |
| [worker-crawler](./worker-crawler/AGENT.md) | worker-crawler-python |
| [worker-tts](./worker-tts/AGENT.md) | worker-tts-python |
| [devops-docker](./devops-docker/AGENT.md) | devops-docker |
| [db-postgres](./db-postgres/AGENT.md) | db-postgres |
| [story-analyzer](./story-analyzer/AGENT.md) | story-analyzer |

## Khi nào dùng agent nào

| User intent / file đụng | Agent |
|---|---|
| Sửa route API, controller, migration, CMS Blade | `backend-laravel` |
| Sửa page Next.js, component web, audio web | `frontend-next` |
| Sửa screen Expo, RN, EAS, `app.json` | `mobile-expo` |
| Sửa logic crawl Playwright, selector, `worker.py` | `worker-crawler-python` |
| Sửa pipeline TTS, upload mp3/m4a | `worker-tts-python` |
| Sửa `docker-compose.yml`, Dockerfile, nginx | `devops-docker` |
| Query Postgres debug data | `db-postgres` |
| Phân tích truyện, NER, gom thoại | `story-analyzer` |
| Task chạm ≥2 layer / điều phối | `story-master` |

## Quy ước bắt buộc: config ↔ README ↔ AGENT.md

Khi **thêm/sửa cấu hình** (env, `config/*`, Docker, `app.json`, `next.config`, …):

| Bước | Việc cần làm |
|------|----------------|
| 1 | Cập nhật **`README.md` trong folder code`** |
| 2 | Cập nhật **`AGENT.md` tương ứng** + **file `.md` phẳng** cùng tên agent |
| 3 | Compose chung: **`compose.env.example`**, **`docker/README.md`**, **`README.md` gốc** |

Đồng bộ song song với **`.claude/agents/<name>.md`** để Cursor và Claude Code khớp nhau.

Hướng dẫn chạy: `README.md` từng app và `docker/README.md`.
