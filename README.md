# DAS Dashboard

Admin portal for the DOST Agent Store (DAS). Provides entity management and analytics over a Vespa-backed index of people and businesses in the DOST ecosystem.

## Stack

- **Frontend**: React 19, Vite 7, Lucide icons
- **Data**: Vespa (upstream DAS API)

## Architecture

Frontend-only static app. Calls the upstream DAS API directly from the browser — no backend server needed.

```
Browser → React SPA → DAS API (Vespa)
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_DAS_API_URL` | Upstream DAS/Vespa API base URL (default: `http://65.1.11.185:8121/api/vespa`) |

## API Endpoints Used

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/documents` | List all entities |
| `POST` | `/documents` | Create entity |
| `GET` | `/documents/{id}` | Get entity by ID |
| `PUT` | `/documents/{id}` | Update entity |
| `DELETE` | `/documents/{id}` | Delete entity |
