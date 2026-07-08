"""
Flower Federated Learning Client
Traceability: FED-FR-001, CON-PRIV-001, CON-PRIV-006, SRS §9.4

"A Flower client connects from opted-in devices/browsers to submit model
 weight updates only." (SRS §9.4)

CON-PRIV-001: Raw behavioral events NEVER leave the device.
CON-PRIV-006: Client-side DP (gradient clipping) before sending updates.

In EarlyMind, this client runs server-side (Node.js backend calls it)
on behalf of opted-in parent devices, since TensorFlow.js on-device
training sends weight deltas here — not raw data.
"""
import logging
import numpy as np
from typing import Dict, List, Tuple
import flwr as fl
from flwr.common import (
    NDArrays,
    FitIns,
    FitRes,
    EvaluateIns,
    EvaluateRes,
    Status,
    Code,
    ndarrays_to_parameters,
    parameters_to_ndarrays,
)

log = logging.getLogger(__name__)


class EarlyMindFlowerClient(fl.client.Client):
    """
    Flower client for EarlyMind federated learning.
    Traceability: FED-FR-001, CON-PRIV-001/006

    Receives the current global model weights, performs local training
    on the device's local feature vectors (with research consent), and
    returns ONLY the weight delta — no raw data.

    Note: Raw behavioral events are discarded after feature extraction
    per CON-PRIV-001. Only derived feature vectors are used for FL.
    """

    def __init__(
        self,
        client_id: str,
        local_features: np.ndarray,    # (N, feature_dim) — local session feature vectors
        local_labels: np.ndarray,      # (N, 6) — local annotations (if available)
        max_grad_norm: float = 1.0,    # client-side gradient clipping (CON-PRIV-006)
        local_epochs: int = 1,
    ):
        """
        CON-PRIV-001: local_features are derived feature vectors, never raw events.
        """
        self.client_id = client_id
        self.local_features = local_features
        self.local_labels = local_labels
        self.max_grad_norm = max_grad_norm
        self.local_epochs = local_epochs

    def fit(self, ins: FitIns) -> FitRes:
        """
        Receive global weights, train locally, return updated weights.
        SRS §9.4: Only weight updates transmitted — no data.
        """
        try:
            import torch
            import torch.nn as nn
            import sys, os
            # Import shared model architecture
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
            from ml_service.app.models.architecture import create_model

            # Load global weights
            global_weights = parameters_to_ndarrays(ins.parameters)
            model = create_model()
            _set_model_weights(model, global_weights)

            # Local training on this device's feature vectors
            model.train()
            optimizer = torch.optim.SGD(model.parameters(), lr=0.01)
            criterion = nn.BCEWithLogitsLoss()

            X = torch.tensor(self.local_features, dtype=torch.float32)
            y = torch.tensor(self.local_labels, dtype=torch.float32)

            for _ in range(self.local_epochs):
                optimizer.zero_grad()
                # Replace NaN with 0 for local training
                X_clean = torch.nan_to_num(X, nan=0.0)
                logits = model(X_clean)
                loss = criterion(logits, y)
                loss.backward()

                # CON-PRIV-006: client-side gradient clipping
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=self.max_grad_norm)
                optimizer.step()

            updated_weights = _get_model_weights(model)
            num_examples = len(self.local_features)

            log.info(f"[FL Client {self.client_id}] Local training done, {num_examples} examples")

            return FitRes(
                status=Status(code=Code.OK, message=""),
                parameters=ndarrays_to_parameters(updated_weights),
                num_examples=num_examples,
                metrics={"client_id": self.client_id},
            )

        except Exception as e:
            log.error(f"[FL Client {self.client_id}] Fit failed: {e}")
            return FitRes(
                status=Status(code=Code.FIT_NOT_IMPLEMENTED, message=str(e)),
                parameters=ins.parameters,
                num_examples=0,
                metrics={},
            )

    def evaluate(self, ins: EvaluateIns) -> EvaluateRes:
        """Evaluate global model on local data."""
        try:
            import torch
            import sys, os
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
            from ml_service.app.models.architecture import create_model

            global_weights = parameters_to_ndarrays(ins.parameters)
            model = create_model()
            _set_model_weights(model, global_weights)
            model.eval()

            X = torch.tensor(self.local_features, dtype=torch.float32)
            X_clean = torch.nan_to_num(X, nan=0.0)

            with torch.no_grad():
                logits = model(X_clean)
                probs = torch.sigmoid(logits).numpy()

            # Simple accuracy proxy
            if self.local_labels is not None and len(self.local_labels) > 0:
                preds = (probs >= 0.5).astype(float)
                accuracy = float((preds == self.local_labels).mean())
            else:
                accuracy = 0.0

            return EvaluateRes(
                status=Status(code=Code.OK, message=""),
                loss=1.0 - accuracy,
                num_examples=len(self.local_features),
                metrics={"accuracy": accuracy},
            )
        except Exception as e:
            return EvaluateRes(
                status=Status(code=Code.EVALUATE_NOT_IMPLEMENTED, message=str(e)),
                loss=0.0,
                num_examples=0,
                metrics={},
            )


def _set_model_weights(model: "torch.nn.Module", weights: NDArrays) -> None:
    params_dict = zip(model.state_dict().keys(), weights)
    state_dict = {k: __import__("torch").tensor(v) for k, v in params_dict}
    model.load_state_dict(state_dict, strict=True)


def _get_model_weights(model: "torch.nn.Module") -> NDArrays:
    return [val.cpu().numpy() for _, val in model.state_dict().items()]
