# Dokploy Deployment Guide

This project needs two backend runtime services in production:

- `backend` for HTTP API
- `scheduler` for reminder emails (`D-30`, `D-14`, `D-7`, `D-1`)

## 1) Backend Service (API)

Set these Dokploy service values:

- Root Directory: `/backend`
- Dockerfile: `Dockerfile`
- HTTP Port: `8000`

### Required backend environment variables

```env
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:YOUR_GENERATED_APP_KEY
APP_URL=https://your-api-domain
APP_TIMEZONE=Asia/Manila

DB_CONNECTION=mysql
DB_HOST=your-db-host
DB_PORT=3306
DB_DATABASE=your-db-name
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password

QUEUE_CONNECTION=database

MAIL_MAILER=smtp
MAIL_SCHEME=tls
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-google-app-password
MAIL_FROM_ADDRESS=your-email@gmail.com
MAIL_FROM_NAME="Compliance Management System"

CORS_ALLOWED_ORIGINS=https://your-frontend-domain
SANCTUM_STATEFUL_DOMAINS=your-frontend-domain
SESSION_DOMAIN=.your-domain.com
SESSION_SECURE_COOKIE=true
```

Generate `APP_KEY` once and keep it stable:

```bash
php artisan key:generate --show
```

## 2) Scheduler Service (Required for reminders)

Create a second Dokploy service using the same source and env:

- Root Directory: `/backend`
- Dockerfile: `Dockerfile`
- Start Command: `php artisan schedule:work`
- No public HTTP port needed

If this service is missing, reminder emails will not run even when SMTP is correct.

## 3) Frontend Build Argument

Frontend service should set:

```env
VITE_API_URL=https://your-api-domain/api
```

## 4) Post-Deploy Verification

Run these in backend container:

```bash
php artisan config:clear
php artisan migrate --force
php artisan notifications:test-email your-email@example.com
php artisan schedule:list
```

Check logs if reminder jobs do not run:

```bash
tail -n 200 storage/logs/laravel.log
```

## 5) Common Build Failure: `composer install` exits with code 1

If logs mention missing `composer.json`, Dokploy backend Root Directory is wrong.

- Correct value: `/backend`
- The Dockerfile now has a fallback for repo-root context, but `/backend` remains the recommended setting.
