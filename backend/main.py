from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.db import get_history, get_recent_machine_readings, init_db, insert_prediction
from backend.schemas import HealthResponse, HistoryItem, PredictionOutput, SensorInput

SAFE_THRESHOLD = 0.30
CRITICAL_THRESHOLD = 0.70
MODEL = None
SETTINGS = get_settings()
logger = logging.getLogger(__name__)


def _has_wildcard_origin(origins: list[str]) -> bool:
    return "*" in origins


def classify_risk(probability: float) -> str:
    if probability < SAFE_THRESHOLD:
        return "safe"
    if probability <= CRITICAL_THRESHOLD:
        return "warning"
    return "critical"


def build_advisory(machine_id: str, risk_level: str, probability: float) -> str:
    if risk_level == "critical":
        return (
            f"Machine {machine_id} likely to fail in next cycle. "
            f"Estimated risk: {probability:.1%}. Immediate inspection recommended."
        )
    if risk_level == "warning":
        return (
            f"Machine {machine_id} is in warning zone ({probability:.1%}). "
            "Schedule maintenance soon and monitor trend closely."
        )
    return f"Machine {machine_id} is operating in safe range ({probability:.1%})."


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Prepare database and model when API starts."""
    global MODEL
    init_db()
    try:
        from ml.model_utils import load_model

        MODEL = load_model(path=SETTINGS.model_path)
        logger.info("Model loaded successfully from %s", SETTINGS.model_path)
    except FileNotFoundError:
        logger.warning("Model file was not found at %s", SETTINGS.model_path)
        MODEL = None
    except Exception:
        # Keep API alive even if model dependencies/artifact are unavailable.
        logger.exception("Model load failed due to unexpected error")
        MODEL = None
    yield


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    expected = SETTINGS.api_key
    if not expected:
        return
    if x_api_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


app = FastAPI(
    title="Predictive Maintenance API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.cors_origins,
    allow_credentials=not _has_wildcard_origin(SETTINGS.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

WEB_UI_DIR = Path(__file__).resolve().parent.parent / "frontend-js"
if WEB_UI_DIR.exists():
    app.mount("/ui", StaticFiles(directory=WEB_UI_DIR, html=True), name="frontend-js")


@app.get("/", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", model_loaded=MODEL is not None)


@app.get("/client-config")
def client_config() -> dict[str, bool]:
    return {"auth_required": bool(SETTINGS.api_key)}


@app.post("/predict", response_model=PredictionOutput)
def predict(payload: SensorInput, _auth: None = Depends(require_api_key)) -> PredictionOutput:
    if MODEL is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not available in this environment.",
        )

    timestamp = payload.timestamp or datetime.now(timezone.utc)

    recent_rows = get_recent_machine_readings(machine_id=payload.machine_id, limit=5)
    recent_history: Any = None
    if recent_rows:
        try:
            import pandas as pd

            recent_history = pd.DataFrame(recent_rows)
        except Exception:
            logger.warning("Pandas is unavailable; realtime rolling features will run without history")
            recent_history = None

    try:
        from ml.model_utils import predict_sample

        prediction, probability = predict_sample(
            MODEL,
            temperature=payload.temperature,
            vibration=payload.vibration,
            pressure=payload.pressure,
            machine_id=payload.machine_id,
            timestamp=timestamp,
            recent_history=recent_history,
        )
    except Exception as exc:
        logger.exception("Prediction failed because runtime dependencies are unavailable")
        raise HTTPException(
            status_code=503,
            detail="Prediction dependencies unavailable in this environment.",
        ) from exc
    risk_level = classify_risk(probability)
    alert = risk_level == "critical"
    advisory = build_advisory(payload.machine_id, risk_level, probability)

    record = {
        "machine_id": payload.machine_id,
        "temperature": payload.temperature,
        "vibration": payload.vibration,
        "pressure": payload.pressure,
        "prediction": prediction,
        "probability": probability,
        "alert": alert,
        "risk_level": risk_level,
        "timestamp": timestamp.isoformat(),
    }
    insert_prediction(record)

    return PredictionOutput(
        machine_id=payload.machine_id,
        prediction=prediction,
        probability=probability,
        alert=alert,
        risk_level=risk_level,
        advisory=advisory,
        timestamp=timestamp,
    )


@app.get("/history", response_model=list[HistoryItem])
def history(
    limit: int = Query(default=100, ge=1, le=1000),
    _auth: None = Depends(require_api_key),
) -> list[HistoryItem]:
    rows = get_history(limit=limit)
    return [HistoryItem(**row) for row in rows]
