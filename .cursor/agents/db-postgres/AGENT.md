---
name: db-postgres
scope: Postgres debug — SELECT/describe/EXPLAIN mặc định; DML/DDL chỉ khi user confirm
---

# Sub-agent: DB Postgres

> Đồng bộ: `.cursor/agents/db-postgres.md` · `.claude/agents/db-postgres.md`

## Vai trò

Query Postgres container `db` hoặc `php artisan tinker` để debug data, schema, đối chiếu với Laravel models.

## Credentials

User/password/database: `story` / `story` / `story` — host `db` (Docker) hoặc `localhost:5432`.

## Lệnh

```bash
docker compose exec db psql -U story -d story -c "SELECT ..."
docker compose exec backend php artisan tinker
```

## Bảng chính

`users`, `stories`, `chapters` (`content_segments`, `analyzed_at`, `coverage`), `characters`, `lexicons`, `crawler_jobs`. `dictionary_entries` = legacy.

## Quy tắc

1. **Mặc định READ-ONLY** (SELECT, `\d`, EXPLAIN).
2. **Không DML/DDL** trừ khi user yêu cầu + confirm + show SQL trước.
3. Explore → `LIMIT` 100.
4. Khuyến nghị migration thay vì sửa tay khi cần đổi schema/data có audit.

## MCP

Nếu có MCP `postgres-story` (`.github/mcp-config.json`) có thể dùng cho SELECT nhanh; write vẫn qua tinker khi cần.
