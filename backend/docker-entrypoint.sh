#!/bin/sh
set -e
cd /var/www/html

if [ -f composer.json ] && [ ! -d vendor ]; then
  composer install --no-interaction --prefer-dist --optimize-autoloader
fi

until php artisan migrate --force 2>/dev/null; do
  echo "Waiting for database..."
  sleep 2
done

# Symlink public/storage -> storage/app/public (URL /storage/...). --relative để link tương đối,
# tránh đường dẫn tuyệt đối /var/www/html/... hỏng khi mở repo trên host (PHPStorm, php artisan ngoài Docker).
if ! php artisan storage:link --force --relative; then
  echo "[entrypoint] WARNING: php artisan storage:link failed (xóa public/storage nếu là thư mục thật rồi chạy lại; hoặc quyền ghi public/)."
fi

exec "$@"
