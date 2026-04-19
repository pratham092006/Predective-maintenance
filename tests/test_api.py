from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

import backend.db as db
import backend.main as api_main
from ml.data_generator import create_training_dataset
from ml.model_utils import train_random_forest


def test_predict_and_history_roundtrip(tmp_path: Path) -> None:
    original_db_path = db.DB_PATH
    db.DB_PATH = tmp_path / "test_predictive_maintenance.db"

    training_data = create_training_dataset(n_samples=400, machine_count=3, seed=23)
    model, _ = train_random_forest(training_data)

    try:
        with TestClient(api_main.app) as client:
            api_main.MODEL = model
            payload = {
                "machine_id": "M-001",
                "temperature": 92.0,
                "vibration": 5.3,
                "pressure": 41.0,
            }

            predict_response = client.post("/predict", json=payload)
            assert predict_response.status_code == 200
            predict_data = predict_response.json()
            assert predict_data["risk_level"] in {"safe", "warning", "critical"}
            assert isinstance(predict_data["advisory"], str)
            assert 0.0 <= float(predict_data["probability"]) <= 1.0

            history_response = client.get("/history", params={"limit": 10})
            assert history_response.status_code == 200
            history_data = history_response.json()
            assert len(history_data) >= 1
            assert "risk_level" in history_data[0]
    finally:
        db.DB_PATH = original_db_path


def test_client_config_endpoint_contract() -> None:
    with TestClient(api_main.app) as client:
        response = client.get("/client-config")

    assert response.status_code == 200
    payload = response.json()
    assert "auth_required" in payload
    assert isinstance(payload["auth_required"], bool)
