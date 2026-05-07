# DAS Dashboard

Modular DAS admin portal scaffolded as a FastAPI backend plus React frontend.

## Structure

- `backend/` - FastAPI API for auth, analytics, profile, and DAS entity CRUD.
- `frontend/` - React/Vite admin UI with Analytics, Entities, Profile, and Settings pages.
- `dashboard.html` - legacy static prototype kept for reference.
- `demo-script.md` - demo talking points.

## Local Backend

```powershell
Copy-Item .env.example .env
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8121 --reload
```

Default local login is `admin` / `admin123`. Change these in `.env` before using outside local development.

When `DAS_UPSTREAM_BASE_URL` is set, the backend wraps the live DAS admin API:

```text
http://65.1.11.185:8121/api/vespa/
```

The live API documentation says those upstream routes do not use JWT/API-key auth, so this dashboard keeps a local login in front of them.

## Local Frontend

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/health` to FastAPI on port `8121`.

## API Surface

- `POST /api/auth/login`
- `GET /api/profile`
- `GET /api/das/analytics`
- `GET /api/das/entities`
- `POST /api/das/entities`
- `GET /api/das/entities/{id}`
- `PUT /api/das/entities/{id}`
- `DELETE /api/das/entities/{id}`

These dashboard routes map to the live DAS API as follows:

| Dashboard route | Live DAS route |
| --- | --- |
| `GET /api/das/analytics` | `GET /api/vespa/analytics` |
| `GET /api/das/entities` | `GET /api/vespa/documents?limit=400&offset=0` |
| `POST /api/das/entities` | `POST /api/vespa/documents` |
| `GET /api/das/entities/{id}` | `GET /api/vespa/documents/{id}` |
| `PUT /api/das/entities/{id}` | `PUT /api/vespa/documents/{id}` |
| `DELETE /api/das/entities/{id}` | `DELETE /api/vespa/documents/{id}` |

Legacy compatibility routes are also present:

- `GET /analytics/data`
- `POST /introduce`
