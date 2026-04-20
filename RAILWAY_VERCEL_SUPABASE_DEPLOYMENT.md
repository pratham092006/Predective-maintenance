# Railway + Vercel + Supabase Quick Start

This is a short topology guide.

For complete deployment policy and troubleshooting, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Topology

- Backend: Railway
- Frontend: Vercel (static frontend-js, or backend /ui)
- Database: Supabase PostgreSQL

## Railway Backend Variables

- APP_ENV=production
- DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require
- CORS_ORIGINS=https://<frontend-domain>,http://localhost:8000,http://127.0.0.1:8000
- MODEL_PATH=/app/ml/model.pkl
- LOG_LEVEL=INFO
- API_KEY=<strong-random-secret> (optional)

## Frontend Wiring

Set backend URL in dashboard settings, or share prewired link:

```text
https://<frontend-domain>/?apiBase=https://<railway-backend-domain>
```

If using the backend-hosted dashboard route (`/ui`) instead of a separate static frontend:

```text
https://<railway-backend-domain>/ui?apiBase=https://<railway-backend-domain>
```

## Quick Verification

```powershell
c:/python313/python.exe -c "import requests; b='https://<railway-backend-domain>'; print('health', requests.get(b+'/', timeout=20).status_code); print('config', requests.get(b+'/client-config', timeout=20).status_code)"
```