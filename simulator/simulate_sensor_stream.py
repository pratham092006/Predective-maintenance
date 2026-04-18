from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import requests

# Support both "python simulator/..." and "python -m simulator..." execution modes.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.data_generator import generate_realtime_sample


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate IoT sensor stream and send to FastAPI backend")
    parser.add_argument("--api", default="http://127.0.0.1:8000/predict", help="Prediction API endpoint")
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between sensor events")
    parser.add_argument("--machines", type=int, default=5, help="Number of machines to simulate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--api-key",
        default=os.getenv("API_KEY", ""),
        help="Optional API key sent as X-API-Key header",
    )
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    machine_ids = [f"M-{index:03d}" for index in range(1, args.machines + 1)]

    print("Starting simulator. Press Ctrl+C to stop.")
    print(f"Target API: {args.api}")
    if args.api_key:
        print("Using API key authentication")

    try:
        while True:
            machine_id = machine_ids[int(rng.integers(0, len(machine_ids)))]
            payload = generate_realtime_sample(machine_id=machine_id, rng=rng)

            try:
                headers = {"X-API-Key": args.api_key} if args.api_key else {}
                response = requests.post(args.api, json=payload, headers=headers, timeout=8)
                response.raise_for_status()
                result = response.json()
                print(
                    f"[{result['timestamp']}] {result['machine_id']} -> "
                    f"pred={result['prediction']}, prob={result['probability']:.3f}, alert={result['alert']}"
                )
            except requests.RequestException as exc:
                print(f"Request failed: {exc}")

            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("Simulator stopped.")


if __name__ == "__main__":
    main()
