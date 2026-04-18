from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _parse_origins(raw_origins: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["*"]


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str | None
    sqlite_path: Path
    model_path: Path
    cors_origins: list[str]
    api_key: str | None
    log_level: str

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parent.parent
    sqlite_default = project_root / "database" / "predictive_maintenance.db"
    model_default = project_root / "ml" / "model.pkl"

    raw_db_url = os.getenv("DATABASE_URL")
    database_url = raw_db_url.strip() if raw_db_url else None

    return Settings(
        app_env=os.getenv("APP_ENV", "development"),
        database_url=database_url,
        sqlite_path=Path(os.getenv("SQLITE_DB_PATH", str(sqlite_default))).resolve(),
        model_path=Path(os.getenv("MODEL_PATH", str(model_default))).resolve(),
        cors_origins=_parse_origins(os.getenv("CORS_ORIGINS", "*")),
        api_key=os.getenv("API_KEY"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )
