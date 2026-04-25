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

php artisan storage:link --force 2>/dev/null || true

exec "$@"
