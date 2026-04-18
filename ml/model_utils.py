from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.ensemble import GradientBoostingClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, train_test_split

RAW_FEATURE_COLUMNS = ["temperature", "vibration", "pressure"]
FEATURE_COLUMNS = [
    "temperature",
    "vibration",
    "pressure",
    "temperature_roll5",
    "vibration_roll5",
    "pressure_roll5",
    "temperature_trend",
    "vibration_trend",
    "pressure_trend",
    "hour_sin",
    "hour_cos",
]
MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"


def _ensure_timestamp(series: pd.Series) -> pd.Series:
    parsed = pd.to_datetime(series, errors="coerce", utc=True)
    fallback = pd.Timestamp.now("UTC")
    return parsed.fillna(fallback)


def _prepare_grouped_frame(dataframe: pd.DataFrame) -> pd.DataFrame:
    frame = dataframe.copy()
    if "machine_id" not in frame.columns:
        frame["machine_id"] = "M-000"
    if "timestamp" not in frame.columns:
        frame["timestamp"] = pd.date_range(
            end=pd.Timestamp.now("UTC"),
            periods=len(frame),
            freq="min",
        )

    frame["timestamp"] = _ensure_timestamp(frame["timestamp"])
    frame = frame.sort_values(["machine_id", "timestamp"]).reset_index(drop=True)
    return frame


def build_features_frame(dataframe: pd.DataFrame, history_window: int = 5) -> pd.DataFrame:
    """Build engineered features used for training and inference."""
    required = set(RAW_FEATURE_COLUMNS)
    missing = required - set(dataframe.columns)
    if missing:
        raise ValueError(f"Missing required sensor columns: {sorted(missing)}")

    frame = _prepare_grouped_frame(dataframe)
    grouped = frame.groupby("machine_id", sort=False)

    for sensor in RAW_FEATURE_COLUMNS:
        frame[f"{sensor}_roll5"] = (
            grouped[sensor]
            .transform(lambda s: s.rolling(window=history_window, min_periods=1).mean())
            .astype(float)
        )
        frame[f"{sensor}_trend"] = grouped[sensor].transform(lambda s: s.diff().fillna(0.0)).astype(float)

    hour = frame["timestamp"].dt.hour.astype(float)
    radians = 2.0 * np.pi * hour / 24.0
    frame["hour_sin"] = np.sin(radians)
    frame["hour_cos"] = np.cos(radians)

    return frame


def _evaluate_model(model: BaseEstimator, X_test: pd.DataFrame, y_test: pd.Series) -> dict[str, float]:
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    return {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
    }


def train_best_model(
    dataframe: pd.DataFrame,
    random_state: int = 42,
) -> tuple[BaseEstimator, dict[str, float | str]]:
    """Train and tune multiple tabular models; return the best estimator and metrics."""
    required = set(RAW_FEATURE_COLUMNS + ["failure"])
    missing = required - set(dataframe.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    engineered = build_features_frame(dataframe)
    X = engineered[FEATURE_COLUMNS]
    y = engineered["failure"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=random_state,
        stratify=y,
    )

    candidates: dict[str, tuple[BaseEstimator, dict[str, list[Any]]]] = {
        "random_forest": (
            RandomForestClassifier(
                class_weight="balanced_subsample",
                n_jobs=-1,
                random_state=random_state,
            ),
            {
                "n_estimators": [220, 320],
                "max_depth": [10, 14],
                "min_samples_leaf": [1, 2],
            },
        ),
        "gradient_boosting": (
            GradientBoostingClassifier(random_state=random_state),
            {
                "n_estimators": [150, 250],
                "learning_rate": [0.05, 0.1],
                "max_depth": [2, 3],
            },
        ),
        "hist_gradient_boosting": (
            HistGradientBoostingClassifier(random_state=random_state),
            {
                "learning_rate": [0.05, 0.1],
                "max_depth": [6, 10],
                "max_iter": [180, 280],
            },
        ),
    }

    best_model: BaseEstimator | None = None
    best_name = ""
    best_score = -1.0
    best_cv = -1.0
    best_metrics: dict[str, float] = {}

    for model_name, (estimator, grid) in candidates.items():
        search = GridSearchCV(
            estimator=estimator,
            param_grid=grid,
            scoring="f1",
            cv=3,
            n_jobs=-1,
        )
        search.fit(X_train, y_train)
        metrics = _evaluate_model(search.best_estimator_, X_test, y_test)
        model_score = metrics["f1_score"]
        if model_score > best_score:
            best_score = model_score
            best_model = search.best_estimator_
            best_name = model_name
            best_cv = float(search.best_score_)
            best_metrics = metrics

    if best_model is None:
        raise RuntimeError("Model training failed to produce a valid estimator.")

    result_metrics: dict[str, float | str] = {
        **best_metrics,
        "model_name": best_name,
        "cv_best_f1": best_cv,
    }
    return best_model, result_metrics


def train_random_forest(
    dataframe: pd.DataFrame,
    random_state: int = 42,
)-> tuple[BaseEstimator, dict[str, float | str]]:
    """Compatibility wrapper that now returns the best tuned model."""
    return train_best_model(dataframe=dataframe, random_state=random_state)


def save_model(model: BaseEstimator, path: Path = MODEL_PATH) -> None:
    """Save trained model as model.pkl."""
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)


def load_model(path: Path = MODEL_PATH) -> BaseEstimator:
    """Load trained model from disk."""
    if not path.exists():
        raise FileNotFoundError(f"Model file not found at {path}")
    return joblib.load(path)


def build_realtime_feature_row(
    machine_id: str,
    temperature: float,
    vibration: float,
    pressure: float,
    timestamp: pd.Timestamp | None = None,
    recent_history: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Build one-row engineered feature frame for realtime prediction."""
    if timestamp is None:
        timestamp_value = pd.Timestamp.now("UTC")
    else:
        timestamp_value = pd.Timestamp(timestamp)

    current_row = {
        "machine_id": machine_id,
        "temperature": float(temperature),
        "vibration": float(vibration),
        "pressure": float(pressure),
        "timestamp": timestamp_value,
    }

    if recent_history is None or recent_history.empty:
        history_frame = pd.DataFrame([current_row])
    else:
        history_frame = recent_history.copy()
        if "machine_id" not in history_frame.columns:
            history_frame["machine_id"] = machine_id
        history_frame = pd.concat([history_frame, pd.DataFrame([current_row])], ignore_index=True)

    engineered = build_features_frame(history_frame)
    latest = engineered.iloc[[-1]].copy()
    return latest[FEATURE_COLUMNS]


def predict_sample(
    model: BaseEstimator,
    temperature: float,
    vibration: float,
    pressure: float,
    machine_id: str = "M-000",
    timestamp: pd.Timestamp | None = None,
    recent_history: pd.DataFrame | None = None,
) -> tuple[int, float]:
    """Predict failure class and probability for one sensor sample."""
    frame = build_realtime_feature_row(
        machine_id=machine_id,
        temperature=temperature,
        vibration=vibration,
        pressure=pressure,
        timestamp=timestamp,
        recent_history=recent_history,
    )
    prediction = int(model.predict(frame)[0])
    probability = float(model.predict_proba(frame)[0][1])
    return prediction, probability
