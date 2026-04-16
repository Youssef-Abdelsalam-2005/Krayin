#!/bin/bash
set -e

cd /var/www/html

# Railway injects env vars into the container, but Laravel reads .env file.
# Build .env from environment variables if it doesn't exist or is the default.
cat > .env <<EOF
APP_NAME="${APP_NAME:-Krayin CRM}"
APP_ENV=${APP_ENV:-production}
APP_DEBUG=${APP_DEBUG:-false}
APP_KEY=${APP_KEY:-}
APP_URL=${APP_URL:-http://localhost}
APP_TIMEZONE=${APP_TIMEZONE:-UTC}
APP_LOCALE=${APP_LOCALE:-en}

DB_CONNECTION=${DB_CONNECTION:-mysql}
DB_HOST=${MYSQLHOST:-${DB_HOST:-127.0.0.1}}
DB_PORT=${MYSQLPORT:-${DB_PORT:-3306}}
DB_DATABASE=${MYSQLDATABASE:-${DB_DATABASE:-krayin}}
DB_USERNAME=${MYSQLUSER:-${DB_USERNAME:-root}}
DB_PASSWORD=${MYSQLPASSWORD:-${DB_PASSWORD:-}}

CACHE_DRIVER=${CACHE_DRIVER:-file}
SESSION_DRIVER=${SESSION_DRIVER:-file}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-sync}

MAIL_MAILER=${MAIL_MAILER:-smtp}
MAIL_HOST=${MAIL_HOST:-}
MAIL_PORT=${MAIL_PORT:-587}
MAIL_USERNAME=${MAIL_USERNAME:-}
MAIL_PASSWORD=${MAIL_PASSWORD:-}
MAIL_ENCRYPTION=${MAIL_ENCRYPTION:-tls}
MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-crm@example.com}
MAIL_FROM_NAME="${MAIL_FROM_NAME:-Krayin CRM}"
EOF

# Generate app key if not set
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "" ]; then
    php artisan key:generate --force
fi

# Run migrations
php artisan migrate --force

# Seed database on first run (creates admin user)
if [ ! -f /var/www/html/storage/.seeded ]; then
    php artisan db:seed --force
    touch /var/www/html/storage/.seeded
    echo "=== Krayin CRM seeded. Default login: admin@example.com / admin123 ==="
fi

# Clear and cache config for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Storage link
php artisan storage:link --force 2>/dev/null || true

echo "=== Krayin CRM starting on port ${PORT:-80} ==="

# Start Apache in foreground
apache2-foreground
