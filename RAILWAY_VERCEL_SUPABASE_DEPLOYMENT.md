# Railway Backend + Vercel Frontend + Supabase Database

This guide configures the stack exactly as requested:

- Supabase: PostgreSQL database
- Railway: FastAPI backend runtime
- Vercel: frontend hosting

## Target Architecture

- Frontend (Vercel static): serves `frontend-js` assets
- Backend (Railway): runs FastAPI app from this repository
- Database (Supabase): used via `DATABASE_URL`

## 1) Deploy Backend to Railway

Use Railway with this repository root and backend Dockerfile setup already included.

Required Railway environment variables:

- `APP_ENV=production`
- `DATABASE_URL=postgresql://...supabase...sslmode=require`
- `CORS_ORIGINS=https://<your-vercel-frontend-domain>,http://localhost:8000,http://127.0.0.1:8000`
- `MODEL_PATH=/app/ml/model.pkl`
- `LOG_LEVEL=INFO`

Optional:

- `API_KEY=<secret>` (only if you want protected endpoints)

Notes:

- Railway provides `PORT`; backend already reads it in `backend/run_backend.py`.
- The Docker build trains and packages `ml/model.pkl`.

## 2) Deploy Frontend to Vercel

Deploy only the `frontend-js` folder as a static project in Vercel.

Two ways to point frontend to Railway backend:

1. In UI: set `API Base URL` to Railway backend URL and click `Save`.
2. Preconfigure using URL parameter:

```text
https://<your-vercel-frontend-domain>/?apiBase=https://<your-railway-backend-domain>
```

The frontend now reads `apiBase` from query string and stores it in local config.

## 3) Verify End-to-End

Replace placeholders and run:

```powershell
c:/python313/python.exe -c "import requests; b='https://<railway-backend-domain>'; print('health', requests.get(b+'/', timeout=20).status_code); print('client-config', requests.get(b+'/client-config', timeout=20).text)"
```

Open frontend:

```text
https://<your-vercel-frontend-domain>/?apiBase=https://<railway-backend-domain>
```

Then verify in browser UI:

- Health shows `OK`
- History loads
- Prediction submit works

## 4) If CORS Errors Appear

Update Railway `CORS_ORIGINS` to include exact frontend origin(s):

- `https://<your-vercel-frontend-domain>`
- add preview domains if needed

Then redeploy Railway.

## 5) Auth Mode

- Open mode: leave `API_KEY` unset on Railway
- Protected mode: set `API_KEY` and provide same key in frontend API panel
