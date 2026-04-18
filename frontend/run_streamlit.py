from __future__ import annotations

import os
import subprocess
import sys


def main() -> None:
    port = os.getenv("PORT", "8501")
    command = [
        sys.executable,
        "-m",
        "streamlit",
        "run",
        "frontend/app.py",
        "--server.address=0.0.0.0",
        f"--server.port={port}",
    ]
    raise SystemExit(subprocess.call(command))


if __name__ == "__main__":
    main()
