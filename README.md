# Compliance Management System (CMS)

A full-stack compliance management system for cooperatives.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started with Docker

To get the entire system up and running using Docker:

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd compliance
   ```

2. **Set up Environment Variables:**
   - Copy `backend/.env.example` to `backend/.env` and update the database settings to use the Docker service:
     ```env
     DB_CONNECTION=mysql
     DB_HOST=db
     DB_PORT=3306
     DB_DATABASE=cms_db
     DB_USERNAME=cms_user
     DB_PASSWORD=password
     ```
   - Configure SMTP in `backend/.env` so notification emails can be delivered:
     ```env
     MAIL_MAILER=smtp
     MAIL_SCHEME=null
     MAIL_HOST=smtp.gmail.com
     MAIL_PORT=587
     MAIL_USERNAME=your-email@gmail.com
     MAIL_PASSWORD=your-app-password
     MAIL_FROM_ADDRESS="your-email@gmail.com"
     MAIL_FROM_NAME="Compliance Management System"
     ```
   - Copy `frontend/.env.example` to `frontend/.env` (if it exists) and set the API URL:
     ```env
     VITE_API_URL=http://localhost:8001/api
     ```

3. **Build and Run the Containers:**
   ```bash
   docker compose up -d --build
   ```

4. **Install Backend Dependencies & Run Migrations:**
   ```bash
   docker compose exec backend composer install
   docker compose exec backend php artisan key:generate
   docker compose exec backend php artisan migrate --seed
   ```

5. **Access the Application:**
   - Frontend: [http://localhost](http://localhost)
   - Backend API: [http://localhost/api](http://localhost/api)

## Development

### Backend
- The backend is a Laravel application located in the `/backend` directory.
- To run commands inside the container: `docker compose exec backend <command>`

### Frontend
- The frontend is a React application located in the `/frontend` directory.
- It is served via Nginx in the Docker setup, but can be run locally using `npm run dev` in the `/frontend` folder.

## Email Notifications

- Immediate emails (submission pending review, approved, rejected, requirement assignment) are sent by API requests.
- Reminder emails (`D-30`, `D-14`, `D-7`, `D-1`) are sent by the Laravel scheduler. The `scheduler` service in `docker-compose.yml` now runs `php artisan schedule:work`.
- In production (Dokploy), the scheduler must be a **separate backend service** that runs `php artisan schedule:work` with the same environment variables as the API service.
- To verify SMTP config and send a test email:
  ```bash
  docker compose exec backend php artisan notifications:test-email your-email@example.com
  ```
- If reminders are not firing, check scheduler logs:
  ```bash
  docker compose logs scheduler --tail=100
  ```

## Google Drive Backups

The backend can create a daily backup at `00:00` into a local Google Drive Desktop sync folder. Set these values in `backend/.env`:

```env
GOOGLE_DRIVE_BACKUP_PATH="C:\Users\YourName\Google Drive\Compliance CMS Backups"
GOOGLE_DRIVE_BACKUP_FOLDER_URL="https://drive.google.com/drive/folders/17oh2FcERhh6D_9v_paBYFkhfyjeugYA4?usp=sharing"
GOOGLE_DRIVE_BACKUP_RETENTION_DAYS=30
GOOGLE_DRIVE_BACKUP_INCLUDE_DATABASE=false
GOOGLE_DRIVE_BACKUP_INCLUDE_FILES=true
GOOGLE_DRIVE_BACKUP_APPROVED_ONLY=true
```

The backup copies only approved upload files into `files/{requirement_req_id}/{pic_user_id}/{deadline}/`. Google Drive Desktop then syncs that backup folder to the cloud. Set `GOOGLE_DRIVE_BACKUP_INCLUDE_DATABASE=true` only if you also want a full database dump, including non-approved records.

Run a manual backup with:

```bash
cd backend
php artisan backup:google-drive
```

## Dokploy Deployment Notes

Set these values in Dokploy before building:

- Frontend build args (`/frontend`):
  - `VITE_API_URL=https://<your-api-domain>/api`

- Backend (`/backend`):
  - `APP_ENV=production`
  - `APP_DEBUG=false`
  - `APP_KEY=base64:...`
  - `APP_URL=https://<your-api-domain>`
  - `CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>`
  - `SANCTUM_STATEFUL_DOMAINS=<your-frontend-domain>`
  - `SESSION_DOMAIN=.your-domain.com`
  - `SESSION_SECURE_COOKIE=true`
  - `MAIL_MAILER=smtp`
  - `MAIL_SCHEME=tls`
  - `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`
  - `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`

In Dokploy, create a second backend service for the scheduler:

- Root dir: `/backend`
- Dockerfile: `Dockerfile`
- Command: `php artisan schedule:work`
- No public port required

If your frontend is `https://compliance.example.com` and backend is `https://api.example.com`, values should look like:

- Frontend build arg: `VITE_API_URL=https://api.example.com/api`
- `APP_URL=https://api.example.com`
- `CORS_ALLOWED_ORIGINS=https://compliance.example.com`
- `SANCTUM_STATEFUL_DOMAINS=compliance.example.com`
- `SESSION_DOMAIN=.example.com`
- `SESSION_SECURE_COOKIE=true`

Backend container now serves HTTP on port `8000` (`php artisan serve`). In Dokploy, ensure the backend service HTTP port is `8000`.

See [`DOKPLOY.md`](./DOKPLOY.md) for full setup and troubleshooting.

## License
MIT
