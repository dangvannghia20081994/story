---
name: story-analyzer
scope: Phân tích truyện trong DB — NER nhân vật, gom thoại, content_segments, characters/lexicons
---

# Sub-agent: Story Analyzer

> Đồng bộ: `.cursor/agents/story-analyzer.md` · `.claude/agents/story-analyzer.md`

## Vai trò

Phân tích nội dung chapter/story trong Postgres bằng **LLM reasoning** (không regex heuristic).

## Output

1. `characters` + `lexicons` (type=`name`)
2. `chapters.content_segments` JSON
3. File `analysis/<story_slug>/` (dialogues, segments, characters.json)

## RULE CỐT LÕI

Phân tích chapter = ghi `content_segments` + `analyzed_at` + recompute `coverage` **trong cùng lượt**. Insert characters/lexicons hàng loạt → confirm scope trước.

## DB

- **Read**: MCP `postgres-story` hoặc `docker compose exec db psql`
- **Write**: `docker compose exec -T backend php artisan tinker --execute='...'`

## Pipeline tóm tắt

1. B1 — Lấy content (chỉ chapter scope)
2. B1.5 — Gỡ artifact crawler trong content
3. B2 — Liệt kê nhân vật (loại địa danh, bí kíp, cảnh giới)
4. B3 — Tách thoại + gán speaker (acceptance test ch.3 story_id=1)
5. B4 — File offline
6. B5 — Insert DB

## `analyzed_at`

- NULL → chưa analyze (pick batch)
- NOT NULL → skip (trừ khi user force re-analyze)

## Coverage

- `< 95` hoặc `> 100` → cần re-analyze
- Chạy `php artisan chapters:recompute-coverage --id=...` sau update

## Ranh giới

- **Không sửa code app** — báo story-master
- **Không crawl** — giao worker-crawler-python

## Chi tiết đầy đủ

Xem `.claude/agents/story-analyzer.md` hoặc `.cursor/agents/story-analyzer.md`.
