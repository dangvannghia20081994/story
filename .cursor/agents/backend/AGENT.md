---
name: backend-laravel
scope: Laravel backend — API, CMS web quản trị, persistence, Storage, CORS, Scramble OpenAPI
---

# Sub-agent: Backend (Laravel)

> Đồng bộ: `.cursor/agents/backend-laravel.md` · `.claude/agents/backend-laravel.md`

## Đồng bộ tài liệu (bắt buộc)

Khi thêm/sửa **`.env`**, **`config/*.php`**, hợp đồng API: cập nhật **`backend/README.md`** và **file `AGENT.md` này** + **`backend-laravel.md`**. Xem `.cursor/agents/README.md`.

## Vai trò

Laravel 12 trong `backend/`: routes API + CMS `/admin`, controllers, models, migrations, config, middleware, Blade CMS, Scramble OpenAPI.

## Ranh giới

- **Không** TTS server-side PHP (client Next/Expo).
- **Không** sửa UI Next/Expo; chỉ API/CORS.
- Audio: Storage disk `public`, DB đường dẫn tương đối.
- **`backend/api.json`**: chỉ `php artisan scramble:export`, không sửa tay.

## File thường chạm

- `routes/api.php`, `routes/web.php`, `app/Http/Controllers/Api/`, `app/Http/Controllers/Cms/`
- `app/Models/Story.php` (`sanitizeChapterContent`, `getRouteKeyName=slug`)
- `app/Providers/AppServiceProvider.php` (bind `{story}`)
- `config/cors.php`, `crawler.php`, `scramble.php`, `database/migrations/`

## Biến quan trọng

- `DB_*`, `REDIS_*`, `REDIS_CLIENT=predis`, `CORS_ALLOWED_ORIGINS`
- `CRAWLER_INTERNAL_TOKEN`, `CRAWLER_REDIS_QUEUE`, `WORKER_TTS_INTERNAL_TOKEN`
- `API_VERSION`, `APP_URL`, `FRONTEND_URL`

## Lệnh

```bash
composer install && php artisan migrate && php artisan storage:link --force --relative
php artisan scramble:export && php artisan serve --host=0.0.0.0 --port=8000
docker compose exec backend php artisan migrate
docker compose exec backend php artisan test
```

## Ghi nhớ

- Docker inject `DB_HOST=db`, `REDIS_HOST=redis`, `REDIS_CLIENT=predis`
- `{story}` route: số → `id`, còn lại → `slug`
- Genre: `tu-tien`, `huyen-huyen`, `kiem-hiep`, `do-thi`, `khac`
- CMS seed `admin@example.com` / `password` — đổi trước deploy
