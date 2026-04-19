# Deployment Guide (Backend + Frontend)

This guide takes the project from local development to production-style deployment with:

- FastAPI backend
- JavaScript frontend (served at `/ui`)
- PostgreSQL database
- Optional API key protection
- CI checks in GitHub Actions

## Current Live Setup (Recommended)

- Backend (Vercel): https://predictive-maintenance-api.vercel.app
- Frontend (served by backend): https://predictive-maintenance-api.vercel.app/ui

This setup serves the JavaScript UI directly from FastAPI at `/ui`.

## 1) Prerequisites

- Python 3.13 (for local runs)
- Docker Desktop (for container deployment)
- GitHub repository with Actions enabled

## 2) Production Configuration

Copy environment template and set secure values:

```powershell
copy .env.example .env
```

Minimum values to set in `.env`:

- `APP_ENV=production`
- `DATABASE_URL=postgresql://...`
- `CORS_ORIGINS=<frontend-url>`

Optional:

- `API_KEY=<strong-random-secret>` (set only when you want protected `/predict` and `/history`)

For local single-service usage (frontend served by backend at `/ui`), `CORS_ORIGINS` can remain default.

## 3) Local Production-Like Run (Docker Compose)

From project root:

```powershell
docker compose up --build
```

Or use the included Windows helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-docker.ps1
```

Services:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:8000/ui`
- Postgres: `localhost:5432`

Stop:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-docker.ps1
```

Reset database volume:

```powershell
docker compose down -v
```

## 4) API Key Behavior

- If `API_KEY` is empty: backend endpoints behave as open (no auth required)
- If `API_KEY` is set: `/predict` and `/history` require header:

```text
X-API-Key: <your-api-key>
```

Frontend and simulator already support this via environment variable or input.

## 5) CORS Setup

Set `CORS_ORIGINS` to a comma-separated list of trusted frontend origins.

Examples:

- Local: `http://localhost:8000`
- Multiple: `https://app.example.com,https://staging.example.com`

Do not use `*` in public production.

## 6) Cloud Deployment Options

### Option A: Single VM (simple)

1. Provision VM.
2. Install Docker.
3. Clone repo.
4. Create `.env` with production values.
5. Run `docker compose up -d --build`.
6. Put Nginx or Caddy in front for TLS.

### Option B: Managed services (recommended)

- Backend container: Azure Container Apps / AWS ECS / Render / Railway
- Frontend: static files served by backend at `/ui`
- Database: managed PostgreSQL (Azure Database for PostgreSQL, RDS, Neon, Supabase)

Set environment variables in provider dashboard instead of `.env` file.

For the exact Supabase + Railway + Vercel split deployment, follow:

- `RAILWAY_VERCEL_SUPABASE_DEPLOYMENT.md`

### Option C: Vercel FastAPI + built-in JavaScript UI (current preferred pattern)

1. Deploy backend to Vercel (root `requirements.txt` + `api/index.py` + `vercel.json`).
2. In Vercel project env vars, set at minimum:
	- `APP_ENV=production`
	- `CORS_ORIGINS=https://predictive-maintenance-api.vercel.app`

	Optional:
	- `API_KEY=<strong-random-secret>`
3. Redeploy Vercel after env changes.
4. Run smoke checks:

```powershell
# Frontend page
curl https://predictive-maintenance-api.vercel.app/ui

# Backend health
curl https://predictive-maintenance-api.vercel.app/

# Backend history
curl "https://predictive-maintenance-api.vercel.app/history?limit=2"

# Auth mode metadata
curl "https://predictive-maintenance-api.vercel.app/client-config"
```

If these pass, frontend and backend are wired correctly.

### Vercel SQLite Note

When `DATABASE_URL` is not set in Vercel, SQLite must write under `/tmp` (ephemeral storage).

- Good for demos/smoke tests.
- Not durable across cold starts or redeploys.
- For persistent production history, use managed Postgres and set `DATABASE_URL`.

## 7) CI Pipeline

Workflow file: `.github/workflows/ci.yml`

Current checks:

- Install dependencies
- Run `pytest -q`

Recommended next steps:

- Add lint stage
- Add container image build stage
- Add deployment job gated on main branch

## 8) Verification Checklist

- `GET /` returns healthy status.
- `/client-config` returns expected auth mode.
- `/predict` and `/history` return records in open mode.
- If `API_KEY` is set, `/predict` works with valid `X-API-Key`.
- Frontend can fetch health/history and submit predictions.
- CI passing on latest commit.

## 9) Rollback Strategy

- Keep last known good image tag.
- Roll back backend/frontend to previous tag.
- Database rollback: restore from managed backup snapshot.

## 10) Security Notes

- Never commit `.env`.
- Rotate API keys periodically.
- Restrict CORS to real frontend domains.
- Use managed PostgreSQL backups and TLS.
