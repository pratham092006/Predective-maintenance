from __future__ import annotations

import argparse
import json
from pathlib import Path

from data_generator import create_training_dataset
from model_utils import save_model, train_best_model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train predictive maintenance model with feature engineering and tuning")
    parser.add_argument("--samples", type=int, default=6000, help="Number of synthetic training records")
    parser.add_argument("--machines", type=int, default=8, help="Number of machines to simulate")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent.parent
    dataset_path = project_root / "ml" / "training_data.csv"
    model_path = project_root / "ml" / "model.pkl"
    metrics_path = project_root / "ml" / "metrics.json"

    data = create_training_dataset(n_samples=args.samples, machine_count=args.machines)
    data.to_csv(dataset_path, index=False)

    model, metrics = train_best_model(data)
    save_model(model, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("Training complete")
    print(f"Dataset saved to: {dataset_path}")
    print(f"Model saved to: {model_path}")
    print(f"Metrics saved to: {metrics_path}")
    for name, value in metrics.items():
        if isinstance(value, (int, float)):
            print(f"{name}: {value:.4f}")
        else:
            print(f"{name}: {value}")


if __name__ == "__main__":
    main()
