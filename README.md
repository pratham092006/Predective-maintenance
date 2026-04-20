# Predictive Maintenance

Modern predictive maintenance system with ML inference, FastAPI backend APIs, live simulator traffic, and an interactive JavaScript dashboard.

## What This Project Includes

- Machine-risk prediction model built with scikit-learn
- FastAPI backend with health, prediction, and history endpoints
- SQLite local persistence with optional PostgreSQL (Supabase/Railway)
- JavaScript dashboard served at /ui with four operational modes:
  - Live Monitoring
  - Manual Prediction
  - Upload Dataset (CSV batch scoring)
  - Machine Analytics
- Sensor simulator for continuous synthetic telemetry
- Docker Compose setup for backend plus Postgres
- Vercel deployment adapter for API plus static UI routing

## Architecture

Data flow:

1. Model is trained from synthetic data using ml/train_model.py
2. Backend loads model artifact at startup
3. Simulator or dashboard sends sensor readings to POST /predict
4. CSV datasets can be sent to POST /predict/batch for batch scoring
5. Backend stores prediction history in DB (single predictions, or batch if persist=true)
6. Dashboard fetches GET /history for live cards, analytics, and alerts

## Repository Structure

```text
.
├── api/                          # Vercel adapter entry
├── backend/                      # FastAPI app, DB layer, config
├── database/                     # Local sqlite file target
├── frontend-js/                  # Dashboard UI (HTML/CSS/JS)
├── ml/                           # Model training and utilities
├── scripts/                      # PowerShell helper scripts
├── simulator/                    # Live telemetry generator
├── tests/                        # API and ML tests
├── docker-compose.yml
├── requirements.txt
├── vercel.json
└── README.md
```

## Requirements

- Python 3.13+
- pip
- Optional: Docker Desktop (for containerized local stack)

## Quick Start (Local)

### 1) Create virtual environment

PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2) Install dependencies

```powershell
pip install -r requirements.txt
```

### 3) Train model

```powershell
python ml/train_model.py
```

### 4) Start backend

```powershell
python -m uvicorn backend.main:app --reload
```

- Health: http://127.0.0.1:8000/
- API docs: http://127.0.0.1:8000/docs
- Dashboard: http://127.0.0.1:8000/ui

### 5) (Optional) Start simulator traffic

```powershell
python simulator/simulate_sensor_stream.py
```

If API key auth is enabled:

```powershell
python simulator/simulate_sensor_stream.py --api-key <your-api-key>
```

## Environment Variables

Use example files:

- .env.example
- .env.railway.backend.example

Important variables:

- APP_ENV: development or production
- DATABASE_URL: PostgreSQL DSN for managed DB usage
- API_KEY: optional backend protection for /predict and /history
- CORS_ORIGINS: comma-separated allowed frontend origins
- MODEL_PATH: model artifact path (optional override)
- LOG_LEVEL: logging verbosity

If DATABASE_URL is not set, backend falls back to local SQLite path.

## API Endpoints

- GET /
  - Health and model load status
- GET /client-config
  - Returns auth_required for frontend runtime behavior
- POST /predict
  - Predicts risk and stores reading
- POST /predict/batch
  - Runs batch predictions from an array of sensor rows
  - Returns risk distribution plus per-row results
  - Supports optional persistence with persist=true
- GET /history?limit=25
  - Returns latest prediction records

Sample predict request body:

```json
{
  "machine_id": "M-001",
  "temperature": 78.2,
  "vibration": 2.4,
  "pressure": 31.5
}
```

Sample batch predict request body:

```json
{
  "persist": false,
  "rows": [
    {
      "machine_id": "M-201",
      "temperature": 81.4,
      "vibration": 3.1,
      "pressure": 34.6
    },
    {
      "temperature": 99.8,
      "vibration": 7.2,
      "pressure": 42.1
    }
  ]
}
```

## Run with Docker

Start backend plus Postgres:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-docker.ps1
```

Rebuild first:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-docker.ps1 -Rebuild
```

Stop stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-docker.ps1
```

## Testing and Validation

Run tests:

```powershell
pytest -q
```

Run one-command smoke check (local + production):

```powershell
python scripts/smoke_check.py
```

Common smoke-check options:

```powershell
# Production only
python scripts/smoke_check.py --skip-local

# Local only
python scripts/smoke_check.py --skip-production

# When API key auth is enabled
python scripts/smoke_check.py --api-key <your-api-key>
```

Quick syntax validation:

```powershell
python -m compileall backend ml simulator api tests
```

## Security and Secrets

- Do not commit real credentials in any file
- Keep runtime secrets in deployment platform environment variables
- This repo ignores:
  - .env and .env.* (except *.example templates)
  - common key and certificate file extensions
  - local caches and temporary artifacts

If a secret was ever committed:

1. Rotate the credential immediately
2. Replace with a placeholder
3. Rewrite history only when required by policy

## Deployment Guides

- DEPLOYMENT.md (source-of-truth)
- VERCEL_DEPLOYMENT.md (Vercel quick start)
- RAILWAY_VERCEL_SUPABASE_DEPLOYMENT.md (topology quick start)
- RAILWAY_VERCEL_SUPABASE_CHECKLIST.md (execution checklist)

Recommended production topology:

- Frontend: Vercel static hosting
- Backend: Railway container deployment
- Database: Supabase PostgreSQL

## Troubleshooting

- 401 Unauthorized
  - Set matching API key in frontend settings if backend API_KEY is enabled
- Empty dashboard history
  - Verify backend is reachable and simulator is running
- Model not loaded
  - Re-run python ml/train_model.py and restart backend
- CORS issues
  - Update CORS_ORIGINS to include exact frontend origin

## License

Internal project or private-use repository unless specified otherwise.
