# Claude Code agents — project `story`

Project-local agents (chỉ load khi Claude Code chạy trong `/home/nghiadv/IdeaProjects/story`). Theo cấu trúc Lucy-style: 1 coordinator + 7 sub-agent theo layer.

> Đọc thêm: **`CLAUDE.md`** ở root repo — context tổng quan + routing nhanh cho assistant khi mở repo.

## Cấu trúc

```
story-master (opus, coordinator)
├── backend-laravel        — Laravel API + CMS Blade
├── frontend-next          — Next.js web
├── mobile-expo            — Expo (RN + web)
├── crawler-python         — Playwright crawler worker
├── worker-tts-python      — Python TTS workers (worker-tts + worker-voice)
├── devops-docker          — Docker Compose + nginx
└── db-postgres            — Postgres query helper (read-only mặc định)
```

## Khi nào dùng agent nào

| User intent / file đụng | Agent |
|---|---|
| Sửa route API, controller, migration, CMS Blade, model Laravel | `backend-laravel` |
| Sửa page Next.js, component web, audio player web, SSR fetch | `frontend-next` |
| Sửa screen Expo, RN, web Metro, EAS, `app.json` | `mobile-expo` |
| Sửa logic crawl Playwright, selector mục lục/chương, `worker.py` | `crawler-python` |
| Sửa pipeline TTS, model selection, upload format mp3/m4a | `worker-tts-python` |
| Sửa `docker-compose.yml`, Dockerfile, nginx, port, profile | `devops-docker` |
| Query Postgres để debug data | `db-postgres` |
| Task chạm ≥2 layer / cần điều phối | `story-master` (coordinator) |

## Quan hệ với `.cursor/agents/`

Folder `.cursor/agents/` là agent cho **Cursor IDE** — **chỉ có 3 layer**: `backend/`, `frontend/`, `mobile/`. Folder `.claude/agents/` này là agent cho **Claude Code CLI** — đầy đủ 8 agent (1 coordinator + 7 sub-agent).

Khi sửa env/config layer **backend / frontend / mobile**: sync **cả 2 file** — `.cursor/agents/<layer>/AGENT.md` và `.claude/agents/<name>.md` để Cursor và Claude khớp nhau.

Khi sửa **crawler / worker-tts / devops / db**: chỉ cần update `.claude/agents/<name>.md` + README folder code (không có file Cursor tương ứng).

## Bổ sung mới

- Agent cho layer mới (vd `coqui/`) → tạo file mới trong folder này, update bảng routing ở trên + `story-master.md` mục "Cấu trúc team".
- Đổi tool / model của agent → sửa frontmatter `name:` / `model:` / `tools:` của file đó.

## Tham khảo

- Convention dev project: `README.md` gốc repo, `backend/README.md`, `frontend/README.md`, `app/README.md`, `crawler/README.md`, `worker-tts/README.md`, `docker/README.md`.
- Cursor agents tương ứng: `.cursor/agents/README.md`.
