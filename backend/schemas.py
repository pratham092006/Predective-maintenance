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


class BatchSensorInput(BaseModel):
    machine_id: str | None = Field(default=None, description="Optional machine identifier")
    temperature: float = Field(..., ge=-50, le=200)
    vibration: float = Field(..., ge=0, le=50)
    pressure: float = Field(..., ge=0, le=300)
    timestamp: datetime | None = None


class BatchPredictionInput(BaseModel):
    rows: list[BatchSensorInput] = Field(..., min_length=1, max_length=5000)
    persist: bool = Field(default=False, description="Persist batch results to history storage")


class BatchPredictionResult(BaseModel):
    index: int
    machine_id: str
    temperature: float
    vibration: float
    pressure: float
    prediction: int
    probability: float
    alert: bool
    risk_level: str
    advisory: str = ""
    timestamp: datetime


class BatchPredictionOutput(BaseModel):
    total_records: int
    risk_distribution: dict[str, int]
    results: list[BatchPredictionResult]
