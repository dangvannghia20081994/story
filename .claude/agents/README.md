# Claude Code agents — project `story`

Project-local agents (chỉ load khi Claude Code chạy trong `/home/nghiadv/IdeaProjects/story`). Theo cấu trúc Lucy-style: 1 coordinator + 7 sub-agent theo layer.

> Đọc thêm: **`CLAUDE.md`** ở root repo — context tổng quan + routing nhanh cho assistant khi mở repo.

## Cấu trúc

```
story-master (opus, coordinator)
├── backend-laravel        — Laravel API + CMS Blade
├── frontend-next          — Next.js web
├── mobile-expo            — Expo (RN + web)
├── worker-crawler-python  — Playwright crawler worker
├── worker-tts-python      — Python TTS workers (worker-tts + worker-voice)
├── devops-docker          — Docker Compose + nginx
├── db-postgres            — Postgres query helper (read-only mặc định)
├── story-analyzer         — Phân tích truyện thủ công: NER nhân vật + gom thoại + insert characters/lexicons
└── audio-merger           — Ghép nhiều file MP3 thành 1 file MP3 bằng ffmpeg
```

## Khi nào dùng agent nào

| User intent / file đụng | Agent |
|---|---|
| Sửa route API, controller, migration, CMS Blade, model Laravel | `backend-laravel` |
| Sửa page Next.js, component web, audio player web, SSR fetch | `frontend-next` |
| Sửa screen Expo, RN, web Metro, EAS, `app.json` | `mobile-expo` |
| Sửa logic crawl Playwright, selector mục lục/chương, `worker.py` | `worker-crawler-python` |
| Sửa pipeline TTS, model selection, upload format mp3/m4a | `worker-tts-python` |
| Sửa `docker-compose.yml`, Dockerfile, nginx, port, profile | `devops-docker` |
| Query Postgres để debug data | `db-postgres` |
| Phân tích truyện thủ công (manual NER theo story_id, gom thoại, insert đợt lớn) | `story-analyzer` |
| Ghép/nối nhiều file MP3 thành 1, thêm khoảng lặng, normalize volume | `audio-merger` |
| Task chạm ≥2 layer / cần điều phối | `story-master` (coordinator) |

## Quan hệ với `.cursor/agents/`

Folder `.cursor/agents/` là sub-agent cho **Cursor IDE** — **đủ 9 agent** (1 coordinator + 8 specialist), đồng bộ với folder này:

- File phẳng `.cursor/agents/<name>.md` — Cursor Task tool / `/tên-agent`
- Thư mục `.cursor/agents/<layer>/AGENT.md` — @-mention thủ công trong chat

Khi sửa bất kỳ agent nào: sync **`.cursor/agents/<name>.md`**, **`.cursor/agents/<layer>/AGENT.md`** (nếu có), và **`.claude/agents/<name>.md`** + README folder code.

## Bổ sung mới

- Agent cho layer mới (vd `coqui/`) → tạo file mới trong folder này, update bảng routing ở trên + `story-master.md` mục "Cấu trúc team".
- Đổi tool / model của agent → sửa frontmatter `name:` / `model:` / `tools:` của file đó.

## Tham khảo

- Convention dev project: `README.md` gốc repo, `backend/README.md`, `frontend/README.md`, `app/README.md`, `worker-crawler/README.md`, `worker-tts/README.md`, `docker/README.md`.
- Cursor agents tương ứng: `.cursor/agents/README.md`.
