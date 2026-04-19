from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SensorInput(BaseModel):
    machine_id: str = Field(..., description="Machine identifier, e.g. M-001")
    temperature: float = Field(..., ge=-50, le=200)
    vibration: float = Field(..., ge=0, le=50)
    pressure: float = Field(..., ge=0, le=300)
    timestamp: datetime | None = None


class PredictionOutput(BaseModel):
    machine_id: str
    prediction: int
    probability: float
    alert: bool
    risk_level: str
    advisory: str = ""
    timestamp: datetime


class HistoryItem(PredictionOutput):
    temperature: float
    vibration: float
    pressure: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_source: str
