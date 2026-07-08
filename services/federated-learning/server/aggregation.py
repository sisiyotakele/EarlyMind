"""
Federated Learning Aggregation Strategy
Traceability: FED-FR-002, CON-PRIV-006

Flower-based FedAvg with differential privacy.
"Server-side aggregation applies differential privacy before merging
 into the global model (CON-PRIV-006)."
"No raw data or feature vectors are transmitted through this channel." (SRS §9.4)
"""
import logging
from typing import List, Optional, Tuple, Dict, Any
import numpy as np
import flwr as fl
from flwr.server.strategy import FedAvg
from flwr.common import (
    FitRes,
    Parameters,
    Scalar,
    ndarrays_to_parameters,
    parameters_to_ndarrays,
    NDArrays,
)
from flwr.server.client_proxy import ClientProxy

from .differential_privacy import DifferentialPrivacyMechanism

log = logging.getLogger(__name__)


class DPFedAvg(FedAvg):
    """
    Federated Averaging with Differential Privacy.
    Traceability: FED-FR-002, FED-FR-003, CON-PRIV-006

    Overrides aggregate_fit to apply DP noise before updating the global model.
    No raw data or feature vectors cross the network (SRS §9.4).
    """

    def __init__(
        self,
        dp: DifferentialPrivacyMechanism,
        min_fit_clients: int = 2,
        min_available_clients: int = 2,
        **kwargs: Any,
    ):
        super().__init__(
            min_fit_clients=min_fit_clients,
            min_available_clients=min_available_clients,
            **kwargs,
        )
        self.dp = dp

    def aggregate_fit(
        self,
        server_round: int,
        results: List[Tuple[ClientProxy, FitRes]],
        failures: List[Tuple[ClientProxy, Exception] | BaseException],
    ) -> Tuple[Optional[Parameters], Dict[str, Scalar]]:
        """
        Aggregate client model updates with differential privacy.
        CON-PRIV-006: DP noise applied to aggregation, not to raw data.
        """
        if not results:
            return None, {}

        # Check privacy budget
        if self.dp.budget.budget_exhausted:
            log.warning(
                f"[DP] Privacy budget exhausted after {self.dp.budget.round_count} rounds "
                f"(epsilon={self.dp.budget.spent_epsilon:.2f}). Stopping aggregation."
            )
            return None, {"dp_budget_exhausted": True}

        # Extract weight updates from clients
        # SRS §9.4: only model weight updates, no raw data
        client_updates: List[NDArrays] = []
        total_examples = 0

        for _, fit_res in results:
            weights = parameters_to_ndarrays(fit_res.parameters)
            client_updates.append(weights)
            total_examples += fit_res.num_examples

        if not client_updates:
            return None, {}

        # Flatten each client's weights into a single vector for DP
        flat_updates = [_flatten_weights(w) for w in client_updates]

        # Apply DP: clip + average + noise (CON-PRIV-006)
        dp_aggregated_flat = self.dp.apply_dp_to_aggregation(flat_updates)

        # Reshape back to original weight structure
        reference_weights = client_updates[0]
        dp_weights = _unflatten_weights(dp_aggregated_flat, reference_weights)

        aggregated_params = ndarrays_to_parameters(dp_weights)

        metrics = {
            "dp_epsilon_spent": self.dp.budget.spent_epsilon,
            "dp_rounds": self.dp.budget.round_count,
            "num_clients": len(results),
            "total_examples": total_examples,
        }
        log.info(
            f"[FL Round {server_round}] Aggregated {len(results)} clients. "
            f"DP epsilon total: {self.dp.budget.spent_epsilon:.4f}"
        )
        return aggregated_params, metrics


def _flatten_weights(weights: NDArrays) -> np.ndarray:
    """Flatten list of weight arrays into a single 1D vector."""
    return np.concatenate([w.flatten() for w in weights])


def _unflatten_weights(flat: np.ndarray, reference: NDArrays) -> NDArrays:
    """Restore flat vector back to list of arrays matching reference shapes."""
    result = []
    offset = 0
    for ref in reference:
        size = ref.size
        result.append(flat[offset : offset + size].reshape(ref.shape))
        offset += size
    return result
