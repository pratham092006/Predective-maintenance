# Predictive Maintenance System

A full-stack Python project that predicts machine failure risk from sensor readings.

It includes:

- an ML training pipeline (`scikit-learn`)
- a FastAPI backend for inference and history
- a Streamlit dashboard for monitoring and analysis
- a sensor simulator for live test data

## Tech Stack

- Python 3.13
- pandas, numpy, scikit-learn
- FastAPI + Uvicorn
- Streamlit + Plotly
- SQLite

## Project Structure

```text
.
├── backend/
│   ├── db.py
│   ├── main.py
│   └── schemas.py
├── database/
├── frontend/
│   └── app.py
├── ml/
│   ├── data_generator.py
│   ├── model_utils.py
│   ├── train_model.py
│   ├── metrics.json            # generated
│   └── training_data.csv       # generated
├── simulator/
│   └── simulate_sensor_stream.py
├── tests/
│   ├── test_api.py
│   └── test_model.py
├── requirements.txt
└── README.md
```

## How It Works

1. Train a model from synthetic machine sensor data.
2. Load the model in FastAPI for real-time prediction.
3. Store prediction history in SQLite.
4. Visualize live/system behavior in Streamlit.
5. Optionally feed continuous sample data using the simulator.

## Quick Start

### 1) Create and activate virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2) Install dependencies

```powershell
pip install -r requirements.txt
```

### 3) Train the model

```powershell
python ml/train_model.py
```

### 4) Start backend

```powershell
uvicorn backend.main:app --reload
```

Backend URL:

- `http://127.0.0.1:8000`

### 5) Start simulator (optional, for live data)

```powershell
python simulator/simulate_sensor_stream.py
```

### 6) Start Streamlit dashboard

```powershell
streamlit run frontend/app.py
```

Dashboard URL:

- `http://localhost:8501`

## API Endpoints

- `GET /` : health check
- `POST /predict` : predict failure risk from sensor input
- `GET /history` : retrieve past predictions

### Example `/predict` request body

```json
{
	"temperature": 78.2,
	"vibration": 0.44,
	"pressure": 31.6,
	"machine_id": "M-01"
}
```

### Example response

```json
{
	"prediction": 0,
	"probability": 0.19,
	"risk_level": "safe",
	"advisory": "No immediate action required"
}
```

## Dashboard Features

- Live monitoring mode with trend charts
- Manual prediction mode
- CSV upload and batch scoring
- Machine analytics view
- History-backed KPI metrics

## Risk Levels

- `safe`: probability < 0.30
- `warning`: 0.30 to 0.70
- `critical`: probability > 0.70

## Running Tests

```powershell
pytest -q
```

## Notes

- The project currently uses SQLite (`database/predictive_maintenance.db`).
- Model artifact and generated training files are ignored in git.
- If you want production deployment, add auth, switch to a managed DB, and run backend/frontend as services.
