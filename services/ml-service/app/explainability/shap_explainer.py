"""
SHAP explainability
Traceability: ML-XAI-001, SRS §8.5

"Every prediction includes SHAP values for top contributing features (CON-SCI-005),
 translated into plain-language Amharic for parent reports."
"The model never outputs a binary diagnosis — only calibrated risk scores
 with confidence intervals." (SRS §8.5)
"""
import numpy as np
import shap
import torch
import logging
from typing import List, Dict

from ..models.architecture import EarlyMindModel
from ..features.schema import FEATURE_NAMES
from ..config import CONDITIONS

log = logging.getLogger(__name__)

# Number of top SHAP features to return per condition (SRS §7.2 example shows top features)
TOP_K_FEATURES = 5


class SHAPExplainer:
    """
    SHAP-based explainability for the EarlyMind model.
    Traceability: ML-XAI-001, SRS §8.5
    """

    def __init__(self, model: EarlyMindModel, background_data: np.ndarray):
        """
        Args:
            model: trained EarlyMind model
            background_data: background dataset for SHAP (subset of training data)
                             shape: (n_background, feature_dim)
        """
        self.model = model
        self.background_data = background_data
        self._explainer: shap.Explainer | None = None
        self._build_explainer()

    def _build_explainer(self) -> None:
        """Build SHAP GradientExplainer for PyTorch model."""
        try:
            bg_tensor = torch.tensor(self.background_data, dtype=torch.float32)

            def model_fn(x: np.ndarray) -> np.ndarray:
                with torch.no_grad():
                    tensor = torch.tensor(x, dtype=torch.float32)
                    logits = self.model.forward(tensor)
                    return torch.sigmoid(logits).numpy()

            self._explainer = shap.Explainer(
                model_fn,
                masker=shap.maskers.Independent(self.background_data, max_samples=100),
            )
            log.info("SHAP explainer initialized")
        except Exception as e:
            log.error(f"Failed to initialize SHAP explainer: {e}")
            self._explainer = None

    def explain(
        self,
        feature_vector: np.ndarray,  # shape: (feature_dim,)
    ) -> Dict[str, List[str]]:
        """
        Compute SHAP values and return top-K contributing features per condition.
        Traceability: ML-XAI-001, SRS §8.5

        Returns:
            dict mapping condition_name → list of top-K feature names (sorted by |SHAP|)
        """
        if self._explainer is None:
            log.warning("SHAP explainer unavailable — returning empty explanations")
            return {cond: [] for cond in CONDITIONS}

        try:
            x = feature_vector.reshape(1, -1)
            shap_values = self._explainer(x)
            # shap_values.values shape: (1, feature_dim, num_conditions)
            values = shap_values.values[0]  # (feature_dim, num_conditions)

            result = {}
            for i, condition in enumerate(CONDITIONS):
                cond_shap = values[:, i]  # (feature_dim,)
                # Sort by absolute value, take top K
                top_indices = np.argsort(np.abs(cond_shap))[::-1][:TOP_K_FEATURES]
                top_features = [FEATURE_NAMES[idx] for idx in top_indices]
                result[condition] = top_features

            return result

        except Exception as e:
            log.error(f"SHAP explanation failed: {e}")
            return {cond: [] for cond in CONDITIONS}


def get_shap_top_features_fast(
    feature_vector: np.ndarray,
    model: EarlyMindModel,
    n_top: int = TOP_K_FEATURES,
) -> Dict[str, List[str]]:
    """
    Fast gradient-based feature importance as SHAP fallback.
    Uses input gradients when full SHAP is too slow (<5s constraint — PERF-NFR-003).
    """
    tensor = torch.tensor(feature_vector.reshape(1, -1), dtype=torch.float32, requires_grad=True)

    model.eval()
    logits = model.forward(tensor)
    probs = torch.sigmoid(logits)

    result = {}
    for i, condition in enumerate(CONDITIONS):
        # Gradient of condition probability w.r.t. inputs
        prob_i = probs[0, i]
        if tensor.grad is not None:
            tensor.grad.zero_()
        prob_i.backward(retain_graph=True)

        if tensor.grad is not None:
            grads = tensor.grad[0].abs().detach().numpy()
            top_indices = np.argsort(grads)[::-1][:n_top]
            result[condition] = [FEATURE_NAMES[idx] for idx in top_indices]
        else:
            result[condition] = []

    model.train()  # restore for MC dropout
    return result
