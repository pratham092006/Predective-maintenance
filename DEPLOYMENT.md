# Deployment Guide (Backend + Frontend)

This guide takes the project from local development to production-style deployment with:

- FastAPI backend
- Streamlit frontend
- PostgreSQL database
- Optional API key protection
- CI checks in GitHub Actions

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
- `API_KEY=<strong-random-secret>`
- `DATABASE_URL=postgresql://...`
- `CORS_ORIGINS=<frontend-url>`
- `API_BASE_URL=<backend-url>` (used by frontend)

## 3) Local Production-Like Run (Docker Compose)

From project root:

```powershell
docker compose up --build
```

Services:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:8501`
- Postgres: `localhost:5432`

Stop:

```powershell
docker compose down
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

- Local: `http://localhost:8501`
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
- Frontend container: same provider as backend
- Database: managed PostgreSQL (Azure Database for PostgreSQL, RDS, Neon, Supabase)

Set environment variables in provider dashboard instead of `.env` file.

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
- `/predict` works with valid `X-API-Key`.
- `/history` returns records.
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
