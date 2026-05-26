# DAS Dashboard

Admin portal for the DOST Agent Store (DAS). Provides entity management, analytics, and search over a Vespa-backed index of people and businesses in the DOST ecosystem.

## Stack

- **Backend**: Python 3.11+, FastAPI, httpx, PyJWT, bcrypt
- **Frontend**: React 19, Vite 7, Lucide icons
- **Data**: Vespa (via upstream DAS API) or local JSON fallback

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # auth, entities, profile routes
│   │   ├── core/         # config, JWT/bcrypt security
│   │   └── services/     # analytics, entity store, vespa client
│   └── data/             # local JSON fallback (gitignored)
├── frontend/
│   ├── public/           # static assets
│   └── src/
│       ├── api/          # API client
│       └── styles/       # CSS
├── .env.example          # environment variable template
└── README.md
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm

## Local Development

### 1. Clone and configure

```bash
git clone https://github.com/HappiDost/das-dashboard.git
cd das-dashboard
cp .env.example .env
```

Edit `.env` as needed. The defaults work for local development.

### 2. Install Python dependencies

```bash
pip install fastapi uvicorn httpx pyjwt bcrypt python-dotenv
```

### 3. Start the backend

```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8121 --reload
```

The API is now running at `http://127.0.0.1:8121`. Health check: `GET /health`.

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

### 5. Start the frontend dev server

```bash
npm run dev
```

Open `http://localhost:5173`. Login with the credentials from `.env` (default: `admin` / `admin123`).

## Production Hosting

### Build the frontend

```bash
cd frontend
npm run build
```

This outputs static files to `frontend/dist/`. The FastAPI backend serves these automatically — no separate web server needed.

### Run in production

```bash
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8121
```

Or with Gunicorn (Linux):

```bash
pip install gunicorn
gunicorn app.main:app --chdir backend -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8121
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_USERNAME` | No | `admin` | Login username |
| `ADMIN_PASSWORD` | No | `admin123` | Login password |
| `JWT_SECRET_KEY` | **Yes** | `change-me-in-production` | Secret for signing JWT tokens. Use a long random string. |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `DAS_UPSTREAM_BASE_URL` | No | _(none)_ | Upstream DAS/Vespa API base URL (e.g. `http://65.1.11.185:8121/api/vespa/`) |
| `DAS_UPSTREAM_TOKEN` | No | _(none)_ | Bearer token for upstream API auth |

When `DAS_UPSTREAM_BASE_URL` is set, all entity and analytics queries proxy to the live Vespa-backed DAS API. When unset, a local JSON file store is used as fallback.

### Deploy with Docker (optional)

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn httpx pyjwt bcrypt python-dotenv
COPY backend/ backend/
COPY frontend/dist/ frontend/dist/
EXPOSE 8121
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8121"]
```

```bash
cd frontend && npm run build && cd ..
docker build -t das-dashboard .
docker run -p 8121:8121 --env-file .env das-dashboard
```

### Deploy on EC2

1. SSH into your instance
2. Clone the repo and install dependencies (Python 3.11+, Node.js 18+)
3. Build the frontend: `cd frontend && npm install && npm run build && cd ..`
4. Copy `.env.example` to `.env` and set production values (`JWT_SECRET_KEY`, `ADMIN_PASSWORD`, `DAS_UPSTREAM_BASE_URL`)
5. Run with Gunicorn or uvicorn behind a reverse proxy (nginx)
6. Set up a systemd service for auto-restart:

```ini
[Unit]
Description=DAS Dashboard
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/das-dashboard
EnvironmentFile=/home/ubuntu/das-dashboard/.env
ExecStart=/usr/local/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8121
Restart=always

[Install]
WantedBy=multi-user.target
```

7. Put nginx in front for SSL termination and serve on port 443.

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/login` | Authenticate and get JWT token |
| `GET` | `/api/profile` | Current user profile |
| `GET` | `/api/das/analytics` | Entity analytics and KPIs |
| `GET` | `/api/das/entities` | List all entities |
| `POST` | `/api/das/entities` | Create entity |
| `GET` | `/api/das/entities/{id}` | Get entity by ID |
| `PUT` | `/api/das/entities/{id}` | Update entity |
| `DELETE` | `/api/das/entities/{id}` | Delete entity |
| `GET` | `/health` | Health check |
