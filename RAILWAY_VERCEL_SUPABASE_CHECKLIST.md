# Deployment Checklist (Railway + Vercel + Supabase)

Use this as execution checklist only.

Reference policy and full commands: [DEPLOYMENT.md](DEPLOYMENT.md)

## Fill Placeholders

- FRONTEND_URL=https://<frontend-domain>
- BACKEND_URL=https://<railway-backend-domain>
- SUPABASE_DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require

## Backend Variables (Railway)

- APP_ENV=production
- DATABASE_URL=<SUPABASE_DATABASE_URL>
- CORS_ORIGINS=<FRONTEND_URL>,http://localhost:8000,http://127.0.0.1:8000
- MODEL_PATH=/app/ml/model.pkl
- LOG_LEVEL=INFO
- API_KEY=<strong-random-secret> (optional)

## Frontend Wiring

- Set API Base URL to <BACKEND_URL> in UI and click Save
- Or use (static frontend deployment):

```text
<FRONTEND_URL>/?apiBase=<BACKEND_URL>
```

- Or use (backend-hosted dashboard):

```text
<BACKEND_URL>/ui?apiBase=<BACKEND_URL>
```

## Smoke Tests

```powershell
c:/python313/python.exe -c "import requests; b='<BACKEND_URL>'; print('health', requests.get(b+'/', timeout=20).status_code); print('history', requests.get(b+'/history?limit=2', timeout=20).status_code)"
```

If API_KEY is enabled:

```powershell
c:/python313/python.exe -c "import requests; b='<BACKEND_URL>'; h={'X-API-Key':'<your-api-key>'}; payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; print('predict', requests.post(b+'/predict', json=payload, headers=h, timeout=20).status_code)"
```
