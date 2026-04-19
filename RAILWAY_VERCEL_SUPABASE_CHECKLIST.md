# Setup Checklist: Supabase + Railway + Vercel

Use this as a copy/paste runbook.

## 1) Fill These Values First

- `SUPABASE_DB_URL`: your Supabase Postgres connection string (with `sslmode=require`)
- `RAILWAY_BACKEND_URL`: your Railway backend URL (example: `https://my-api.up.railway.app`)

Prefilled values:

- `VERCEL_FRONTEND_URL=https://predictive-maintenance-api.vercel.app`
- `RAILWAY_FRONTEND_URL=https://pm-frontend-production-dfe6.up.railway.app`
- `RAILWAY_BACKEND_URL=https://your-backend.up.railway.app`

Only one value is still needed to run everything:

- `SUPABASE_DB_URL`

## 2) Railway Backend Environment Variables

Set these in Railway service variables:

```text
APP_ENV=production
DATABASE_URL=<SUPABASE_DB_URL>
CORS_ORIGINS=https://predictive-maintenance-api.vercel.app,https://pm-frontend-production-dfe6.up.railway.app,http://localhost:8000,http://127.0.0.1:8000
MODEL_PATH=/app/ml/model.pkl
LOG_LEVEL=INFO
```

Optional auth:

```text
API_KEY=<YOUR_SECRET_KEY>
```

Notes:

- Leave `API_KEY` unset for open/public mode.
- Set `API_KEY` only if you want protected `/predict` and `/history`.

## 3) Vercel Frontend Wiring

Use one of these methods:

1. Open UI and set `API Base URL` manually to `https://your-backend.up.railway.app`, then click `Save`.
2. Share pre-wired URL:

```text
https://your-frontend.vercel.app/?apiBase=https://your-backend.up.railway.app
```

Example:

```text
https://your-frontend.vercel.app/?apiBase=https://your-backend.up.railway.app
```

## 4) Smoke Tests

Backend health and auth mode:

```powershell
c:/python313/python.exe -c "import requests; b='https://your-backend.up.railway.app'; print('health', requests.get(b+'/', timeout=20).status_code); print('auth mode endpoint', requests.get(b+'/client-config', timeout=20).status_code)"
```

Open mode test (no API key):

```powershell
c:/python313/python.exe -c "import requests; b='https://your-backend.up.railway.app'; print('history', requests.get(b+'/history?limit=2', timeout=20).status_code); payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(b+'/predict', json=payload, timeout=20); print('predict', r.status_code)"
```

Protected mode test (with API key):

```powershell
c:/python313/python.exe -c "import requests; b='https://your-backend.up.railway.app'; h={'X-API-Key':'<YOUR_SECRET_KEY>'}; print('history', requests.get(b+'/history?limit=2', headers=h, timeout=20).status_code); payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(b+'/predict', json=payload, headers=h, timeout=20); print('predict', r.status_code)"
```

## 5) Final Share Link

Use this format to share a pre-wired frontend URL:

```text
https://your-frontend.vercel.app/?apiBase=https://your-backend.up.railway.app
```

## 6) Quick Troubleshooting

- `401 Unauthorized`: set correct `API_KEY` in UI if backend is protected.
- CORS error in browser: add exact Vercel domain to `CORS_ORIGINS` on Railway.
- `503 Model is not available`: verify model artifact exists in deployed backend image.