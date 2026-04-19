# Deployment Guide

This is the source-of-truth deployment document for this project.

If any quick-start guide conflicts with this file, follow this one.

## Supported Topologies

1. Single service (Vercel FastAPI + /ui static dashboard)
2. Split stack (Railway backend + Vercel frontend + Supabase Postgres)
3. Local production-like stack (Docker Compose backend + Postgres)

## Prerequisites

- Python 3.13+
- Docker Desktop (for containerized runs)
- Access to deployment platforms (Vercel, Railway, Supabase)
- Trained model artifact at ml/model.pkl

## Environment Variables

Common variables:

- APP_ENV=production
- DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require
- CORS_ORIGINS=https://<frontend-domain>,http://localhost:8000,http://127.0.0.1:8000
- MODEL_PATH=ml/model.pkl (or /app/ml/model.pkl in containers)
- LOG_LEVEL=INFO
- API_KEY=<strong-random-secret> (optional; enables protected mode)

Behavior notes:

- If API_KEY is unset: /predict and /history are open
- If API_KEY is set: /predict and /history require X-API-Key header
- If DATABASE_URL is unset: backend falls back to local SQLite

## Option A: Local Production-Like (Docker Compose)

Start:

```powershell
docker compose up --build
```

Or with helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-docker.ps1
```

Stop:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-docker.ps1
```

Reset DB volume:

```powershell
docker compose down -v
```

Endpoints:

- Backend health: http://localhost:8000/
- UI: http://localhost:8000/ui

## Option B: Vercel FastAPI + Built-In /ui

Used files:

- api/index.py
- vercel.json
- frontend-js/* (served from backend at /ui)

Deploy:

```powershell
vercel
vercel --prod
```

Set Vercel environment variables:

- APP_ENV=production
- DATABASE_URL=<managed-postgres-dsn> (recommended)
- CORS_ORIGINS=https://<vercel-domain>
- MODEL_PATH=ml/model.pkl
- LOG_LEVEL=INFO
- API_KEY=<secret> (optional)

Important:

- Without DATABASE_URL, Vercel uses ephemeral filesystem for SQLite-like fallback behavior and data is not durable
- For persistent history, use managed Postgres

## Option C: Railway Backend + Vercel Frontend + Supabase

Backend on Railway:

- Build from repository root using backend container setup
- Set env vars from the Environment Variables section above
- Use MODEL_PATH=/app/ml/model.pkl in containerized Railway runtime

Frontend on Vercel:

- Deploy frontend-js as static project, or keep /ui through backend if preferred
- Set API base in frontend settings or query parameter:

```text
https://<frontend-domain>/?apiBase=https://<railway-backend-domain>
```

Supabase:

- Use pooled or direct Postgres connection string with sslmode=require
- Rotate credentials if exposed

## Verification Checklist

Health check:

```powershell
c:/python313/python.exe -c "import requests; b='https://<backend-domain>'; r=requests.get(b+'/', timeout=20); print(r.status_code, r.text[:200])"
```

Auth mode metadata:

```powershell
c:/python313/python.exe -c "import requests; b='https://<backend-domain>'; r=requests.get(b+'/client-config', timeout=20); print(r.status_code, r.text)"
```

Predict in open mode:

```powershell
c:/python313/python.exe -c "import requests; b='https://<backend-domain>'; payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(b+'/predict', json=payload, timeout=20); print(r.status_code, r.text[:240])"
```

Predict in protected mode:

```powershell
c:/python313/python.exe -c "import requests; b='https://<backend-domain>'; h={'X-API-Key':'<your-api-key>'}; payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(b+'/predict', json=payload, headers=h, timeout=20); print(r.status_code, r.text[:240])"
```

UI smoke test:

- Open /ui (or frontend domain)
- Set API Base URL to backend domain
- Run Health check in UI
- Run one prediction and confirm history updates

## CI/CD Recommendation

Current CI should at least run:

- pytest -q
- python -m compileall backend ml simulator api tests

Recommended additions:

- Lint stage
- Container build stage
- Deployment stage with environment approvals

## Security Baseline

- Never commit .env with real values
- Keep only *.example templates in repo
- Restrict CORS_ORIGINS to exact frontend domains
- Rotate API_KEY and DB credentials periodically
- Use TLS endpoints for all production traffic

## Rollback

- Keep previous deploy artifact/image tag
- Roll back app first, then evaluate DB schema compatibility
- Restore DB from managed snapshot only if required
