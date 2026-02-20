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
- To verify SMTP config and send a test email:
  ```bash
  docker compose exec backend php artisan notifications:test-email your-email@example.com
  ```
- If reminders are not firing, check scheduler logs:
  ```bash
  docker compose logs scheduler --tail=100
  ```

## Dokploy Deployment Notes

Set these values in Dokploy before building:

- Frontend build args (`/frontend`):
  - `VITE_API_URL=https://<your-api-domain>/api`

- Backend (`/backend`):
  - `APP_URL=https://<your-api-domain>`
  - `CORS_ALLOWED_ORIGINS=https://<your-frontend-domain>`
  - `SANCTUM_STATEFUL_DOMAINS=<your-frontend-domain>`
  - `SESSION_DOMAIN=.your-domain.com`
  - `SESSION_SECURE_COOKIE=true`

If your frontend is `https://compliance.example.com` and backend is `https://api.example.com`, values should look like:

- Frontend build arg: `VITE_API_URL=https://api.example.com/api`
- `APP_URL=https://api.example.com`
- `CORS_ALLOWED_ORIGINS=https://compliance.example.com`
- `SANCTUM_STATEFUL_DOMAINS=compliance.example.com`
- `SESSION_DOMAIN=.example.com`
- `SESSION_SECURE_COOKIE=true`

Backend container now serves HTTP on port `8000` (`php artisan serve`). In Dokploy, ensure the backend service HTTP port is `8000`.

## License
MIT
