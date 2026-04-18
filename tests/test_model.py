from ml.data_generator import create_training_dataset
from ml.model_utils import FEATURE_COLUMNS, build_features_frame, predict_sample, train_random_forest


def test_training_returns_expected_outputs() -> None:
    data = create_training_dataset(n_samples=800, machine_count=4, seed=7)
    model, metrics = train_random_forest(data)

    assert model is not None
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert 0.0 <= metrics["precision"] <= 1.0
    assert 0.0 <= metrics["recall"] <= 1.0
    assert metrics["model_name"] in {"random_forest", "gradient_boosting", "hist_gradient_boosting"}


def test_predict_sample_returns_probability() -> None:
    data = create_training_dataset(n_samples=1000, machine_count=3, seed=11)
    model, _ = train_random_forest(data)
    prediction, probability = predict_sample(model, temperature=80.0, vibration=4.5, pressure=40.0)

    assert prediction in (0, 1)
    assert 0.0 <= probability <= 1.0


def test_feature_engineering_produces_expected_columns() -> None:
    data = create_training_dataset(n_samples=120, machine_count=3, seed=17)
    engineered = build_features_frame(data)
    for column in FEATURE_COLUMNS:
        assert column in engineered.columns
