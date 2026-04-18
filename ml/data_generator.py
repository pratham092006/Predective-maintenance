from __future__ import annotations

import numpy as np
import pandas as pd


def _failure_probability(temperature: np.ndarray, vibration: np.ndarray, pressure: np.ndarray) -> np.ndarray:
    """Compute failure probability from sensor readings."""
    temp_risk = np.maximum(0.0, (temperature - 79.0) / 18.0)
    vib_risk = np.maximum(0.0, (vibration - 3.4) / 2.2)
    pressure_risk = np.maximum(0.0, np.abs(pressure - 35.0) / 15.0)

    interaction = temp_risk * vib_risk
    score = 0.08 + 0.38 * temp_risk + 0.42 * vib_risk + 0.22 * pressure_risk + 0.45 * interaction
    return np.clip(score, 0.01, 0.98)


def create_training_dataset(
    n_samples: int = 6000,
    machine_count: int = 8,
    seed: int = 42,
) -> pd.DataFrame:
    """Create synthetic historical dataset for model training."""
    rng = np.random.default_rng(seed)

    machine_ids = np.array([f"M-{idx:03d}" for idx in range(1, machine_count + 1)])
    chosen_machines = rng.choice(machine_ids, size=n_samples, replace=True)

    temperature = rng.normal(loc=72.0, scale=7.2, size=n_samples)
    vibration = rng.normal(loc=3.0, scale=0.85, size=n_samples)
    pressure = rng.normal(loc=35.0, scale=4.2, size=n_samples)

    anomaly_mask = rng.random(n_samples) < 0.12
    temperature[anomaly_mask] += rng.normal(loc=13.0, scale=4.5, size=anomaly_mask.sum())
    vibration[anomaly_mask] += rng.normal(loc=1.4, scale=0.55, size=anomaly_mask.sum())
    pressure[anomaly_mask] += rng.normal(loc=6.0, scale=2.8, size=anomaly_mask.sum())

    failure_probability = _failure_probability(temperature, vibration, pressure)
    failure = rng.binomial(n=1, p=failure_probability).astype(int)

    timestamps = pd.date_range("2026-01-01", periods=n_samples, freq="h")

    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "machine_id": chosen_machines,
            "temperature": temperature.round(2),
            "vibration": vibration.round(3),
            "pressure": pressure.round(2),
            "failure": failure,
        }
    )


def generate_realtime_sample(machine_id: str, rng: np.random.Generator) -> dict[str, float | str]:
    """Generate one synthetic realtime sample for simulator or manual tests."""
    temperature = float(rng.normal(72.0, 5.5))
    vibration = float(rng.normal(3.0, 0.65))
    pressure = float(rng.normal(35.0, 3.3))

    if rng.random() < 0.15:
        temperature += float(rng.uniform(8.0, 20.0))
        vibration += float(rng.uniform(0.8, 2.2))
        pressure += float(rng.uniform(3.0, 10.0))

    return {
        "machine_id": machine_id,
        "temperature": round(temperature, 2),
        "vibration": round(vibration, 3),
        "pressure": round(pressure, 2),
    }
