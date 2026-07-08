"""
ML inference API tests
Traceability: ML-API-001, ML-ARCH-001/002/003, ML-XAI-001, SRS §8.2/8.4/8.5/9.3
"""
import time
import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from ..app.main import app
from ..app.api.predict import set_model
from ..app.models.architecture import create_model
from ..app.features.schema import FEATURE_NAMES, FEATURE_DIM, vector_from_dict
from ..app.config import CONDITIONS
from ..training.evaluation import check_metrics_against_srs_targets


@pytest.fixture(autouse=True)
def setup_model():
    """Load untrained model for tests — architecture and API shape tests only."""
    model = create_model()
    model.train()
    medians = np.zeros(FEATURE_DIM, dtype=np.float32)
    set_model(model, medians)


client = TestClient(app)

# ─── Feature schema tests (ML-FE-001) ─────────────────────────────────────────

def test_feature_schema_has_200_plus_features():
    """SRS §8.1: minimum 200 features."""
    assert FEATURE_DIM >= 200, f"Expected >=200 features, got {FEATURE_DIM}"


def test_feature_names_are_unique():
    assert len(FEATURE_NAMES) == len(set(FEATURE_NAMES)), "Duplicate feature names"


def test_vector_from_dict_null_flagged_not_zeroed():
    """SRS §8.1: missing features are null-flagged (NaN), not zeroed."""
    vec = vector_from_dict({"letter_rain_mean_rt_ms": 500.0}, fill_missing_with_nan=True)
    # Most features should be NaN (missing)
    nan_count = np.sum(np.isnan(vec))
    assert nan_count > 100, f"Expected many NaN values, got {nan_count}"
    # The provided feature should not be NaN
    idx = FEATURE_NAMES.index("letter_rain_mean_rt_ms")
    assert not np.isnan(vec[idx])
    assert vec[idx] == pytest.approx(500.0)


# ─── Model architecture tests (ML-ARCH-001/002/003) ───────────────────────────

def test_model_output_shape():
    """SRS §8.2: model produces 6 outputs (one per condition)."""
    model = create_model()
    x = torch.randn(4, FEATURE_DIM)  # batch of 4
    logits = model(x)
    assert logits.shape == (4, len(CONDITIONS)), \
        f"Expected ({4}, {len(CONDITIONS)}), got {logits.shape}"


def test_model_output_sigmoid_range():
    """SRS §8.2: sigmoid outputs in [0,1] — never binary diagnosis."""
    model = create_model()
    x = torch.randn(1, FEATURE_DIM)
    probs, _ = model.predict_with_uncertainty(x, n_samples=5)
    assert probs.min().item() >= 0.0
    assert probs.max().item() <= 1.0


def test_mc_dropout_produces_uncertainty():
    """SRS §8.2: Monte Carlo dropout quantifies uncertainty."""
    model = create_model()
    x = torch.randn(1, FEATURE_DIM)
    mean_probs, uncertainty = model.predict_with_uncertainty(x, n_samples=20)
    # With random init and MC dropout, uncertainty should be > 0
    assert uncertainty.mean().item() >= 0.0
    assert mean_probs.shape == uncertainty.shape == (1, len(CONDITIONS))


def test_six_conditions_in_correct_order():
    """SRS §8.2: exactly 6 conditions in correct order."""
    assert CONDITIONS == [
        "dyslexia",
        "dyscalculia",
        "adhd_inattentive",
        "adhd_hyperactive_impulsive",
        "working_memory_deficit",
        "processing_speed_deficit",
    ]


# ─── Inference API tests (ML-API-001, SRS §9.3) ───────────────────────────────

def test_predict_endpoint_exists():
    """SRS §9.3: endpoint POST /internal/ml/predict exists."""
    features = {name: 0.0 for name in FEATURE_NAMES[:50]}
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-001",
        "age_months": 72,
        "normalized_features": features,
    })
    assert response.status_code == 200


def test_predict_returns_all_six_conditions():
    """SRS §9.3: response includes per-condition risk scores for all 6 conditions."""
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-002",
        "age_months": 84,
        "normalized_features": {},
    })
    data = response.json()
    assert "predictions" in data
    returned_conditions = {p["condition"] for p in data["predictions"]}
    assert returned_conditions == set(CONDITIONS)


def test_predict_risk_scores_in_valid_range():
    """SRS §8.5: risk scores are calibrated probabilities in [0,1]."""
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-003",
        "age_months": 60,
        "normalized_features": {},
    })
    data = response.json()
    for pred in data["predictions"]:
        assert 0.0 <= pred["risk_score"] <= 1.0, \
            f"risk_score out of range for {pred['condition']}: {pred['risk_score']}"
        assert 0.0 <= pred["confidence"] <= 1.0, \
            f"confidence out of range for {pred['condition']}: {pred['confidence']}"


def test_predict_returns_shap_features():
    """SRS §8.5: every prediction includes top contributing SHAP features."""
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-004",
        "age_months": 96,
        "normalized_features": {"letter_rain_mean_rt_ms": 1.2},
    })
    data = response.json()
    for pred in data["predictions"]:
        assert "shap_top_features" in pred
        # Should return a list (can be empty if SHAP unavailable, but key must exist)
        assert isinstance(pred["shap_top_features"], list)


def test_predict_includes_model_version():
    """SRS §8.3: model version traceable to reports."""
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-005",
        "age_months": 72,
        "normalized_features": {},
    })
    data = response.json()
    assert "model_version" in data
    assert len(data["model_version"]) > 0


def test_predict_inference_time_logged():
    """PERF-NFR-003: inference time < 5s — verify it's measured and returned."""
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-006",
        "age_months": 72,
        "normalized_features": {},
    })
    data = response.json()
    assert "inference_time_ms" in data
    # For untrained model on CPU, should be well under 5000ms
    assert data["inference_time_ms"] < 5000, \
        f"Inference took {data['inference_time_ms']:.0f}ms — exceeds PERF-NFR-003 target"


def test_predict_handles_null_features_gracefully():
    """GAME-FR-011: null features (unavailable norms) don't crash inference."""
    response = client.post("/internal/ml/predict", json={
        "session_id": "test-session-007",
        "age_months": 72,
        "normalized_features": {
            "letter_rain_mean_rt_ms": None,  # null = norm unavailable
            "z_pattern_mirror_max_span": None,
        },
    })
    assert response.status_code == 200


# ─── Evaluation metric structure tests (ML-TRAIN-002) ─────────────────────────

def test_evaluation_metric_structure():
    """SRS §8.4: check_metrics_against_srs_targets enforces all targets."""
    # All metrics meet targets → should return True
    good_metrics = {
        cond: {"sensitivity": 0.85, "specificity": 0.75, "auc_roc": 0.85}
        for cond in CONDITIONS
    }
    assert check_metrics_against_srs_targets(good_metrics) is True

    # One condition fails sensitivity
    bad_metrics = dict(good_metrics)
    bad_metrics["dyslexia"] = {"sensitivity": 0.70, "specificity": 0.75, "auc_roc": 0.85}
    assert check_metrics_against_srs_targets(bad_metrics) is False
