# Railway + Supabase + Streamlit Deployment (Step by Step)

This guide deploys:

- FastAPI backend on Railway
- Streamlit frontend on Railway
- PostgreSQL on Supabase

Before starting with CLI automation:

- Install Railway CLI
- Run: railway login

## Step 1: Create Supabase Database

1. Go to Supabase and create a new project.
2. Open: Project Settings -> Database.
3. Copy the connection string in URI format.
4. Replace `[YOUR-PASSWORD]` with your actual database password.

Expected format:

`postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require`

Keep this value as `DATABASE_URL` for Railway.

## Step 2: Prepare Required Environment Variables

You need these values before deployment:

- `APP_ENV=production`
- `DATABASE_URL=<your supabase postgres uri>`
- `API_KEY=<strong-random-secret>`
- `CORS_ORIGINS=<frontend railway domain>`
- `MODEL_PATH=/app/ml/model.pkl`

Frontend needs:

- `API_BASE_URL=<backend railway domain>`
- `API_KEY=<same backend api key>`

Prebuilt templates in this repo:

- `.env.railway.backend.example`
- `.env.railway.frontend.example`

## Step 3: Deploy Backend Service on Railway

1. In Railway, create a New Project -> Deploy from GitHub Repo.
2. Create service name: `pm-backend`.
3. In service Variables, add backend variables from Step 2.
4. Set Start Command:

`python backend/run_backend.py`

5. Deploy.
6. Once deployed, copy the generated backend public URL.

Backend health check:

- Open `<backend-url>/`
- You should get a JSON health response.

## Step 4: Deploy Streamlit Service on Railway

1. In the same Railway project, create a second service from the same repo.
2. Service name: `pm-frontend`.
3. Set Variables:
   - `API_BASE_URL=<backend-url>`
   - `API_KEY=<same secret as backend>`
4. Set Start Command:

`python frontend/run_streamlit.py`

5. Deploy and open the frontend URL.

## Step 5: Wire CORS Correctly

After frontend URL exists, update backend variable:

- `CORS_ORIGINS=<frontend-url>`

Redeploy backend after changing this value.

If you use a custom domain, include that domain in `CORS_ORIGINS`.

## Step 6: Verify End to End

1. Frontend loads without crash.
2. In Streamlit sidebar, API base points to backend URL.
3. Manual prediction works.
4. History and analytics load.
5. Optional simulator test (local):

`c:/python313/python.exe simulator/simulate_sensor_stream.py --api <backend-url>/predict --api-key <api-key>`

## Step 7: Safe Operations Checklist

- Rotate `API_KEY` periodically.
- Keep Supabase password and Railway variables secret.
- Use Railway rollback if deployment breaks.
- Monitor backend logs after each deploy for at least 10 minutes.

## Quick Troubleshooting

- 401 Unauthorized: API keys differ between backend and frontend.
- CORS error: backend `CORS_ORIGINS` missing frontend URL.
- DB connection error: invalid `DATABASE_URL` or wrong password.
- Frontend cannot reach backend: incorrect `API_BASE_URL`.
