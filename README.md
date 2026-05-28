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

## Setup

```bash
git clone https://github.com/HappiDost/das-dashboard.git
cd das-dashboard/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

To build for production:

```bash
npm run build
```

Outputs static files to `frontend/dist/` — serve from anywhere.
