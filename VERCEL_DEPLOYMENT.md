# Vercel Quick Start

This is a short Vercel-specific quick start.

For full details, environment policy, security, verification, and rollback, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Scope

- FastAPI API via Vercel entrypoint
- Dashboard served at /ui from frontend-js

## Required Files

- api/index.py
- vercel.json
- requirements.txt
- frontend-js/

## Deploy

```powershell
vercel
vercel --prod
```

## Required Environment Variables

- APP_ENV=production
- DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require
- CORS_ORIGINS=https://<vercel-domain>
- MODEL_PATH=ml/model.pkl
- LOG_LEVEL=INFO

Optional:

- API_KEY=<strong-random-secret>

## Quick Validation

```powershell
c:/python313/python.exe -c "import requests; u='https://<vercel-domain>'; print('health', requests.get(u+'/', timeout=20).status_code); print('ui', requests.get(u+'/ui', timeout=20).status_code)"
```

If API_KEY is enabled:

```powershell
c:/python313/python.exe -c "import requests; u='https://<vercel-domain>'; h={'X-API-Key':'<your-api-key>'}; payload={'machine_id':'M-001','temperature':72.0,'vibration':2.3,'pressure':31.0}; r=requests.post(u+'/predict', json=payload, headers=h, timeout=20); print(r.status_code)"
```