from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "database" / "predictive_maintenance.db"


def _column_exists(connection: sqlite3.Connection, table: str, column: str) -> bool:
    columns = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(item[1] == column for item in columns)


def init_db() -> None:
    """Initialize SQLite database and predictions table."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                machine_id TEXT NOT NULL,
                temperature REAL NOT NULL,
                vibration REAL NOT NULL,
                pressure REAL NOT NULL,
                prediction INTEGER NOT NULL,
                probability REAL NOT NULL,
                alert INTEGER NOT NULL,
                risk_level TEXT NOT NULL DEFAULT 'safe',
                timestamp TEXT NOT NULL
            )
            """
        )

        if not _column_exists(connection, "predictions", "risk_level"):
            connection.execute(
                "ALTER TABLE predictions ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'safe'"
            )
        connection.commit()


def insert_prediction(record: dict) -> None:
    """Store one prediction record."""
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO predictions (
                machine_id, temperature, vibration, pressure,
                prediction, probability, alert, risk_level, timestamp
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["machine_id"],
                record["temperature"],
                record["vibration"],
                record["pressure"],
                record["prediction"],
                record["probability"],
                int(record["alert"]),
                record.get("risk_level", "safe"),
                record["timestamp"],
            ),
        )
        connection.commit()


def get_history(limit: int = 100) -> list[dict]:
    """Fetch prediction history ordered by most recent."""
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT machine_id, temperature, vibration, pressure,
                   prediction, probability, alert, risk_level, timestamp
            FROM predictions
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [dict(row) for row in rows]


def get_recent_machine_readings(machine_id: str, limit: int = 5) -> list[dict]:
    """Fetch recent readings for one machine ordered oldest to newest."""
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT machine_id, temperature, vibration, pressure, timestamp
            FROM predictions
            WHERE machine_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (machine_id, limit),
        ).fetchall()

    ordered = [dict(row) for row in rows]
    ordered.reverse()
    return ordered
