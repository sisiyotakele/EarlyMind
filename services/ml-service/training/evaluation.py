"""
Model evaluation harness
Traceability: ML-TRAIN-002, SRS §8.4

Metrics:
- Sensitivity (recall) per condition ≥ 80% (SRS §8.4, success criterion §1.4.4)
- Specificity per condition ≥ 70% (SRS §8.4, CON-ETH-003)
- AUC-ROC ≥ 0.80 (SRS §8.4)
- Calibration error minimized (SRS §8.4)
"""
import numpy as np
import torch
from torch.utils.data import DataLoader
from sklearn.metrics import (
    roc_auc_score,
    confusion_matrix,
    brier_score_loss,
    average_precision_score,
)
from typing import Dict
import logging

from ..app.models.architecture import EarlyMindModel
from ..app.config import CONDITIONS

log = logging.getLogger(__name__)

# Decision threshold for binary classification
THRESHOLD = 0.5


def evaluate_model(
    model: EarlyMindModel,
    loader: DataLoader,
    device: torch.device,
) -> Dict[str, Dict[str, float]]:
    """
    Evaluate model on a DataLoader.
    Returns per-condition metrics matching SRS §8.4 targets.
    """
    model.eval()
    all_probs = []
    all_labels = []

    with torch.no_grad():
        for X_batch, y_batch in loader:
            X_batch = X_batch.to(device)
            logits = model.forward(X_batch)
            probs = torch.sigmoid(logits).cpu().numpy()
            all_probs.append(probs)
            all_labels.append(y_batch.numpy())

    all_probs = np.concatenate(all_probs, axis=0)   # (N, 6)
    all_labels = np.concatenate(all_labels, axis=0)  # (N, 6)

    metrics = {}
    for i, condition in enumerate(CONDITIONS):
        y_true = all_labels[:, i]
        y_prob = all_probs[:, i]
        y_pred = (y_prob >= THRESHOLD).astype(int)

        # Handle edge case: only one class present
        if len(np.unique(y_true)) < 2:
            log.warning(f"Only one class present for {condition} — skipping metrics")
            metrics[condition] = {
                "sensitivity": float("nan"),
                "specificity": float("nan"),
                "auc_roc": float("nan"),
                "calibration_error": float("nan"),
                "average_precision": float("nan"),
            }
            continue

        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

        # SRS §8.4: sensitivity ≥ 80%
        sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0

        # SRS §8.4: specificity ≥ 70%
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0

        # SRS §8.4: AUC-ROC ≥ 0.80
        auc_roc = float(roc_auc_score(y_true, y_prob))

        # SRS §8.4: calibration error minimized (Brier score as proxy)
        calibration_error = float(brier_score_loss(y_true, y_prob))

        # Average precision (area under precision-recall curve)
        avg_precision = float(average_precision_score(y_true, y_prob))

        metrics[condition] = {
            "sensitivity": float(sensitivity),       # target ≥ 0.80
            "specificity": float(specificity),       # target ≥ 0.70
            "auc_roc": auc_roc,                      # target ≥ 0.80
            "calibration_error": calibration_error,  # minimize
            "average_precision": avg_precision,
            "tp": int(tp), "tn": int(tn),
            "fp": int(fp), "fn": int(fn),
        }

    return metrics


def check_metrics_against_srs_targets(metrics: Dict[str, Dict[str, float]]) -> bool:
    """
    Returns True only if ALL conditions meet SRS §8.4 targets.
    Used as the gate for model deployment.
    """
    all_pass = True
    for condition in CONDITIONS:
        m = metrics.get(condition, {})
        sens = m.get("sensitivity", 0)
        spec = m.get("specificity", 0)
        auc = m.get("auc_roc", 0)

        if sens < 0.80:
            log.error(f"FAIL: {condition} sensitivity={sens:.3f} < 0.80 (SRS §8.4)")
            all_pass = False
        if spec < 0.70:
            log.error(f"FAIL: {condition} specificity={spec:.3f} < 0.70 (SRS §8.4)")
            all_pass = False
        if auc < 0.80:
            log.error(f"FAIL: {condition} AUC-ROC={auc:.3f} < 0.80 (SRS §8.4)")
            all_pass = False

    return all_pass
