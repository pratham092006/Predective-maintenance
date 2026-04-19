# Vercel Deployment Procedure (Backend + JavaScript UI)

This project is deployed to Vercel as a FastAPI backend that also serves the JavaScript frontend at `/ui`.

## Architecture

- Vercel: FastAPI backend (`backend/main.py`) via `api/index.py`
- Vercel: JavaScript dashboard served by FastAPI at `/ui` from `frontend-js/`
- Managed Postgres: Supabase/Railway Postgres via `DATABASE_URL`

## Files Added for Vercel

- `api/index.py`: ASGI entrypoint that exposes `app`
- `vercel.json`: routes all incoming requests to the FastAPI app

Dependency layout used:

- `requirements.txt`: backend/serverless dependencies (Vercel uses this)
- `frontend-js/`: static JavaScript frontend files (served by backend)

## Prerequisites

1. Install Vercel CLI:

```powershell
npm i -g vercel
```

2. Login:

```powershell
vercel login
```

3. Ensure trained model artifact exists at `ml/model.pkl`.

Without this file, health still works but `/predict` returns `503`.

## Required Environment Variables (Vercel Project)

Set these in Vercel Project Settings -> Environment Variables:

- `APP_ENV=production`
- `DATABASE_URL=postgresql://...`
- `CORS_ORIGINS=https://<vercel-domain>`
- `MODEL_PATH=ml/model.pkl` (or custom path)

Optional:

- `API_KEY=<strong-random-secret>` (set only when protected endpoints are required)

Notes:

- Do not use `NEXT_PUBLIC_` prefixes; this is not a Next.js frontend deployment.
- Use separate preview and production databases when possible.

## Deploy Steps

From project root:

```powershell
vercel
```

Then production:

```powershell
vercel --prod
```

## Verify Deployment

Replace `<vercel-domain>` with your real domain.

```powershell
c:/python313/python.exe -c "import requests; u='https://<vercel-domain>'; print('health', requests.get(u+'/', timeout=20).status_code, requests.get(u+'/', timeout=20).text[:120])"
```

Verify frontend page route:

```powershell
c:/python313/python.exe -c "import requests; u='https://<vercel-domain>'; r=requests.get(u+'/ui', timeout=20); print('ui', r.status_code, r.text[:60])"
```

Verify history/predict in open mode (no API key):

```powershell
c:/python313/python.exe -c "import requests, json; u='https://<vercel-domain>'; print('history', requests.get(u+'/history?limit=2', timeout=20).status_code); payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(u+'/predict', json=payload, timeout=20); print('predict', r.status_code); print(r.text[:300])"
```

Check auth mode metadata:

```powershell
c:/python313/python.exe -c "import requests; u='https://<vercel-domain>'; r=requests.get(u+'/client-config', timeout=20); print(r.status_code, r.text)"
```

If `API_KEY` is enabled, verify protected endpoints with `X-API-Key`:

```powershell
c:/python313/python.exe -c "import requests, json; u='https://<vercel-domain>'; h={'X-API-Key':'<your-api-key>'}; payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(u+'/predict', json=payload, headers=h, timeout=20); print(r.status_code); print(r.text[:300])"
```

## Operational Notes

- Vercel serverless functions can cold-start.
- Keep dependencies minimal to reduce startup latency.
- Do not run simulator loops on Vercel; use a worker/local process instead.
