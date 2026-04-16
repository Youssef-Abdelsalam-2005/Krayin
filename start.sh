#!/bin/bash
set -e

cd /var/www/html

# Debug: show what DB env vars Railway actually injected
echo "=== Railway DB env vars ==="
echo "MYSQLHOST=${MYSQLHOST:-NOT SET}"
echo "MYSQLPORT=${MYSQLPORT:-NOT SET}"
echo "MYSQLDATABASE=${MYSQLDATABASE:-NOT SET}"
echo "MYSQLUSER=${MYSQLUSER:-NOT SET}"
echo "DB_HOST=${DB_HOST:-NOT SET}"
echo "DB_PORT=${DB_PORT:-NOT SET}"
echo "==========================="

# Resolve DB connection: prefer MYSQL* (Railway add-on), fall back to DB_*
RESOLVED_DB_HOST="${MYSQLHOST:-${DB_HOST:-}}"
RESOLVED_DB_PORT="${MYSQLPORT:-${DB_PORT:-3306}}"
RESOLVED_DB_NAME="${MYSQLDATABASE:-${DB_DATABASE:-}}"
RESOLVED_DB_USER="${MYSQLUSER:-${DB_USERNAME:-}}"
RESOLVED_DB_PASS="${MYSQLPASSWORD:-${DB_PASSWORD:-}}"

# Also try parsing DATABASE_URL if individual vars are missing (Railway sometimes only sets this)
if [ -z "$RESOLVED_DB_HOST" ] && [ -n "$DATABASE_URL" ]; then
    echo "Parsing DATABASE_URL..."
    RESOLVED_DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
    RESOLVED_DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    RESOLVED_DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    RESOLVED_DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    RESOLVED_DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
fi

if [ -z "$RESOLVED_DB_HOST" ]; then
    echo "ERROR: No database host found. Set MYSQLHOST, DB_HOST, or DATABASE_URL."
    echo "Available env vars:"
    env | grep -iE 'mysql|database|db_' || echo "(none found)"
    exit 1
fi

echo "=== Resolved DB: ${RESOLVED_DB_USER}@${RESOLVED_DB_HOST}:${RESOLVED_DB_PORT}/${RESOLVED_DB_NAME} ==="

# Railway injects env vars into the container, but Laravel reads .env file.
cat > .env <<EOF
APP_NAME="${APP_NAME:-Krayin CRM}"
APP_ENV=${APP_ENV:-production}
APP_DEBUG=${APP_DEBUG:-false}
APP_KEY=${APP_KEY:-}
APP_URL=${APP_URL:-http://localhost}
APP_TIMEZONE=${APP_TIMEZONE:-UTC}
APP_LOCALE=${APP_LOCALE:-en}

DB_CONNECTION=mysql
DB_HOST=${RESOLVED_DB_HOST}
DB_PORT=${RESOLVED_DB_PORT}
DB_DATABASE=${RESOLVED_DB_NAME}
DB_USERNAME=${RESOLVED_DB_USER}
DB_PASSWORD=${RESOLVED_DB_PASS}

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
