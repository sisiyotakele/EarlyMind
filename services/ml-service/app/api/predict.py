"""
ML Inference API — POST /internal/ml/predict
Traceability: ML-API-001, SRS §9.3

"Internal endpoint POST /internal/ml/predict accepts a feature vector
 and returns per-condition risk scores, confidence, and SHAP values.
 Target latency <5s (PERF-NFR-003).
 Not exposed publicly — accessible only from the backend within the VPC."
"""
import time
import logging
import numpy as np
import torch
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

from ..config import CONDITIONS, settings
from ..features.schema import vector_from_dict, FEATURE_DIM
from ..models.architecture import EarlyMindModel
from ..explainability.shap_explainer import get_shap_top_features_fast

log = logging.getLogger(__name__)
router = APIRouter()

# ── Request / Response schemas (Section 9.3) ─────────────────────────────────

class PredictRequest(BaseModel):
    session_id: str
    age_months: int = Field(..., ge=48, le=132, description="Child age in months (4-11 years)")
    # SRS §7.3: normalized features uploaded from client (GAME-FR-011)
    # null = norm unavailable for that feature/age (GAME-FR-011 business rule)
    normalized_features: Dict[str, Optional[float]]


class ConditionResult(BaseModel):
    condition: str
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Probability 0–1")
    confidence: float = Field(..., ge=0.0, le=1.0, description="1 - uncertainty (MC dropout std)")
    shap_top_features: List[str] = Field(..., description="Top 5 contributing features")


class PredictResponse(BaseModel):
    session_id: str
    model_version: str
    predictions: List[ConditionResult]
    inference_time_ms: float


# Module-level model singleton (loaded at startup)
_model: EarlyMindModel | None = None
_feature_medians: np.ndarray | None = None  # Per-feature training medians for NaN imputation


def set_model(model: EarlyMindModel, medians: np.ndarray) -> None:
    global _model, _feature_medians
    _model = model
    _feature_medians = medians


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/internal/ml/predict", response_model=PredictResponse)
async def predict(request: PredictRequest) -> PredictResponse:
    """
    Multi-label LD risk classification.
    Traceability: ML-API-001, SRS §9.3
    PERF-NFR-003: <5s inference time
    SRS §8.5: never outputs binary diagnosis — only calibrated risk scores
    """
    start_time = time.perf_counter()

    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # ── Build feature vector ─────────────────────────────────────────────────
    # Convert dict to numpy array; null → NaN (GAME-FR-011: null-flagged)
    feature_dict = {
        k: float(v) if v is not None else float("nan")
        for k, v in request.normalized_features.items()
    }
    # Add age-derived features
    feature_dict["age_months"] = float(request.age_months)
    feature_dict = _add_age_bands(feature_dict, request.age_months)

    vec = vector_from_dict(feature_dict, fill_missing_with_nan=True)

    # ── NaN imputation with training-set medians ──────────────────────────────
    # Per-feature median imputation (standard for tree/NN models)
    vec_imputed = _impute_nans(vec)

    # ── Model inference (MC dropout for uncertainty) ─────────────────────────
    tensor = torch.tensor(vec_imputed.reshape(1, -1), dtype=torch.float32)

    mean_probs, uncertainty = _model.predict_with_uncertainty(
        tensor,
        n_samples=settings.mc_dropout_samples,
    )

    mean_probs_np = mean_probs[0].numpy()       # (6,)
    uncertainty_np = uncertainty[0].numpy()     # (6,)

    # ── SHAP explainability ────────────────────────────────────────────────────
    # Use fast gradient-based approach to stay within <5s (PERF-NFR-003)
    shap_features = get_shap_top_features_fast(vec_imputed, _model)

    # ── Build response ────────────────────────────────────────────────────────
    predictions = []
    for i, condition in enumerate(CONDITIONS):
        risk_score = float(np.clip(mean_probs_np[i], 0.0, 1.0))
        # Confidence = 1 - normalized_uncertainty (std of MC samples)
        # Clip uncertainty std to [0, 0.5] range then invert
        raw_uncertainty = float(uncertainty_np[i])
        confidence = float(np.clip(1.0 - raw_uncertainty * 2, 0.0, 1.0))

        predictions.append(ConditionResult(
            condition=condition,
            risk_score=risk_score,
            confidence=confidence,
            shap_top_features=shap_features.get(condition, []),
        ))

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    # Log a warning if approaching <5s target
    if elapsed_ms > 4000:
        log.warning(
            f"Inference for session {request.session_id} took {elapsed_ms:.0f}ms "
            f"(PERF-NFR-003 target: <5000ms)"
        )

    return PredictResponse(
        session_id=request.session_id,
        model_version=settings.model_version,
        predictions=predictions,
        inference_time_ms=elapsed_ms,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _impute_nans(vec: np.ndarray) -> np.ndarray:
    """Replace NaN with training-set medians. Falls back to 0 if no medians loaded."""
    result = vec.copy()
    nan_mask = np.isnan(result)
    if not nan_mask.any():
        return result
    if _feature_medians is not None:
        result[nan_mask] = _feature_medians[nan_mask]
    else:
        result[nan_mask] = 0.0
    return result


def _add_age_bands(feature_dict: dict, age_months: int) -> dict:
    """Add one-hot age band features."""
    bands = {
        "age_band_4_5": (48, 60),
        "age_band_5_6": (60, 72),
        "age_band_6_7": (72, 84),
        "age_band_7_8": (84, 96),
        "age_band_8_9": (96, 108),
        "age_band_9_10": (108, 120),
    }
    for band_name, (lo, hi) in bands.items():
        feature_dict[band_name] = 1.0 if lo <= age_months < hi else 0.0
    return feature_dict
