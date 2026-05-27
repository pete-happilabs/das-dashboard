# DAS Dashboard: Frontend-Only Conversion

## Summary

Remove the entire Python/FastAPI backend. The React frontend will call the upstream DAS API directly. No authentication. No local fallback.

## Current State

- Backend (FastAPI) acts as JWT auth + proxy to upstream Vespa API at `http://65.1.11.185:8121/api/vespa/`
- Frontend calls backend, which forwards to upstream
- Single hardcoded admin user with JWT auth
- Local JSON fallback when upstream is down

## Target State

- Frontend-only static app (React 19 + Vite 7)
- Calls upstream DAS API directly from browser
- No auth — loads straight into dashboard
- No fallback — error state if upstream unreachable
- Deployable as static files anywhere

## Changes

### Delete

- Entire `backend/` directory (app/, data/, all Python code)
- `.env.example` (no backend config needed)
- Any backend-related references in README

### Port to Frontend

**Document normalization** — move from `backend/app/services/vespa_client.py` `normalize_document()` into frontend API client. Maps upstream Vespa document fields to the UI's expected schema:
- `doc_id` / `id` → `id`
- `name` / `title` → `title`
- `bio` / `description` / `body` → `body`
- `entity_type` / type inference from ID prefix
- `tags`, `locations`, `reputation`, `owner`
- Media URL arrays (image, video, audio, document)

**Analytics computation** — move from `backend/app/services/analytics.py` `build_analytics()` into frontend. Computes from entity list:
- Count by type (person/business/other)
- Top tags (20 most common)
- Top locations (10 most common)
- Completeness metrics (% with tags, location, media, reputation)
- Media coverage counts
- Top owners/introducers
- Reputation distribution

### Modify Frontend

**`src/api/client.js`:**
- Remove all token/auth logic (getToken, setToken, clearToken, Bearer header, auth-expired event)
- Base URL from `import.meta.env.VITE_DAS_API_URL` (default: `http://65.1.11.185:8121/api/vespa/`)
- Add `normalizeDocument(doc)` function
- Add `buildAnalytics(entities)` function
- Update API paths: `/documents` instead of `/api/das/entities`, `/analytics` instead of `/api/das/analytics`

**`src/main.jsx`:**
- Remove Login component and login state
- Remove Profile view (was just showing hardcoded admin info)
- Remove auth-expired event listener
- App starts directly on Analytics or Entities view
- Remove Settings view (was just showing backend health check)
- Sidebar: keep Analytics + Entities only

### Configuration

Single env var via Vite:
- `VITE_DAS_API_URL` — upstream DAS API base URL (default: `http://65.1.11.185:8121/api/vespa/`)

### Deployment

- `npm run build` → `dist/` static files
- Serve from any static host (nginx, S3, Vite preview, etc.)
- No Python, no server runtime needed

## Upstream API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/documents` | List all entities |
| `POST` | `/documents` | Create entity |
| `GET` | `/documents/{id}` | Get entity by ID |
| `PUT` | `/documents/{id}` | Update entity |
| `DELETE` | `/documents/{id}` | Delete entity |
| `GET` | `/analytics` | Analytics (if upstream supports it, otherwise compute client-side) |
