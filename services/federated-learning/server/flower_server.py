"""
Flower Federated Learning Server
Traceability: FED-FR-002, FED-FR-003, CON-PRIV-006, SRS §9.4

"A Flower client connects from opted-in devices/browsers to submit model
 weight updates only; server-side aggregation applies differential privacy
 before merging into the global model (CON-PRIV-006).
 No raw data or feature vectors are transmitted through this channel."

Fallback: "Operate without FL temporarily" (SRS §2.4.5)
"""
import logging
import flwr as fl

from .aggregation import DPFedAvg
from .differential_privacy import DifferentialPrivacyMechanism

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


def start_fl_server(
    server_address: str = "0.0.0.0:8080",
    num_rounds: int = 10,
    min_clients: int = 2,
    noise_multiplier: float = 1.0,
    max_grad_norm: float = 1.0,
    delta: float = 1e-5,
) -> None:
    """
    Start the Flower federated learning coordination server.
    Traceability: FED-FR-002, FED-FR-003, CON-PRIV-006

    Args:
        server_address: gRPC bind address (SRS §5.3: gRPC bidirectional)
        num_rounds: FL rounds to run
        min_clients: minimum clients required per round
        noise_multiplier: DP Gaussian noise scale (CON-PRIV-006)
        max_grad_norm: gradient clipping bound
        delta: DP failure probability
    """
    dp = DifferentialPrivacyMechanism(
        noise_multiplier=noise_multiplier,
        max_grad_norm=max_grad_norm,
        delta=delta,
    )

    strategy = DPFedAvg(
        dp=dp,
        min_fit_clients=min_clients,
        min_available_clients=min_clients,
        min_evaluate_clients=min_clients,
        # Fraction of clients selected per round
        fraction_fit=1.0,
        fraction_evaluate=0.5,
    )

    log.info(
        f"Starting EarlyMind FL Server — "
        f"rounds={num_rounds}, min_clients={min_clients}, "
        f"noise_multiplier={noise_multiplier}, delta={delta}"
    )

    fl.server.start_server(
        server_address=server_address,
        config=fl.server.ServerConfig(num_rounds=num_rounds),
        strategy=strategy,
    )


if __name__ == "__main__":
    import os
    start_fl_server(
        server_address=os.getenv("FL_SERVER_ADDRESS", "0.0.0.0:8080"),
        num_rounds=int(os.getenv("FL_NUM_ROUNDS", "10")),
        min_clients=int(os.getenv("FL_MIN_CLIENTS", "2")),
        noise_multiplier=float(os.getenv("FL_NOISE_MULTIPLIER", "1.0")),
        max_grad_norm=float(os.getenv("FL_MAX_GRAD_NORM", "1.0")),
        delta=float(os.getenv("FL_DELTA", "1e-5")),
    )
