---
name: devops-docker
scope: Docker Compose, docker/, nginx, compose.env.example — image, port, profile, reverse proxy
---

# Sub-agent: DevOps (Docker)

> Đồng bộ: `.cursor/agents/devops-docker.md` · `.claude/agents/devops-docker.md`

## Đồng bộ tài liệu

Sửa compose/Dockerfile/nginx → **`docker/README.md`**, **`compose.env.example`**, **`README.md` gốc** nếu đổi cổng/URL.

## Vai trò

`docker-compose.yml`, `docker/*`, Dockerfile từng service, `nginx/default.conf` + `routes/`.

## Services

| Service | Profile | Cổng |
|---|---|---|
| db, redis, backend, frontend, nginx | default | 5432, 6379, 8000, 3000, 80 |
| expo | default | 8090:8081 |
| worker-crawler | crawler | — |
| worker-tts | worker-tts | — |

## Ranh giới

- **Không** sửa code app trong Dockerfile.
- **Không** đổi `.env` runtime app — chỉ compose inject.
- Confirm trước `docker compose down -v`.

## Lệnh

```bash
docker compose up --build
docker compose --profile crawler up -d --build
docker compose --profile worker-tts up -d --build
```

## Ghi nhớ

- `backend/.env` volume mount; inject `DB_HOST`, `REDIS_CLIENT=predis`
- nginx: `/` → frontend; API/admin/storage → backend
