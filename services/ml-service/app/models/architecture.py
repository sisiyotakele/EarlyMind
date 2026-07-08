"""
LSTM + Transformer hybrid model architecture
Traceability: ML-ARCH-001, ML-ARCH-002, ML-ARCH-003, SRS Section 8.2

"Hybrid LSTM + Transformer: a 200+-dimensional normalized feature vector feeds
 an LSTM encoder (sequential/temporal patterns within each game) and a
 Transformer encoder (cross-game attention), producing 6 sigmoid outputs for
 multi-label classification."

"Uncertainty is quantified via Monte Carlo dropout at inference." (SRS §8.2)
"""
import torch
import torch.nn as nn
from typing import Tuple

from ..config import settings, CONDITIONS


class EarlyMindModel(nn.Module):
    """
    Hybrid LSTM + Transformer for 6-condition multi-label LD screening.
    Traceability: ML-ARCH-001/002/003, SRS §8.2
    """

    def __init__(
        self,
        feature_dim: int = settings.feature_dim,
        lstm_hidden: int = settings.lstm_hidden_size,
        lstm_layers: int = settings.lstm_num_layers,
        transformer_d_model: int = settings.transformer_d_model,
        transformer_nhead: int = settings.transformer_nhead,
        transformer_layers: int = settings.transformer_num_layers,
        dropout: float = settings.dropout_rate,
        num_conditions: int = settings.num_conditions,
    ):
        super().__init__()

        # ── Input projection ─────────────────────────────────────────────────
        # Project raw feature vector to d_model for both encoders
        self.input_norm = nn.LayerNorm(feature_dim)
        self.input_proj = nn.Linear(feature_dim, transformer_d_model)

        # ── LSTM encoder: sequential/temporal patterns within each game ──────
        # SRS §8.2: "LSTM encoder (sequential/temporal patterns within each game)"
        # Reshapes the flat vector into per-game segments (7 games × ~28 features)
        self.lstm = nn.LSTM(
            input_size=transformer_d_model,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            dropout=dropout if lstm_layers > 1 else 0.0,
            bidirectional=True,
        )
        # Bidirectional: output dim = 2 * lstm_hidden
        self.lstm_proj = nn.Linear(2 * lstm_hidden, transformer_d_model)

        # ── Transformer encoder: cross-game attention ────────────────────────
        # SRS §8.2: "Transformer encoder (cross-game attention)"
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=transformer_d_model,
            nhead=transformer_nhead,
            dim_feedforward=transformer_d_model * 4,
            dropout=dropout,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer=encoder_layer,
            num_layers=transformer_layers,
        )

        # ── MC Dropout for uncertainty quantification ────────────────────────
        # SRS §8.2: "Uncertainty is quantified via Monte Carlo dropout at inference"
        # This dropout stays ACTIVE during inference (nn.Dropout, not eval mode)
        self.mc_dropout = nn.Dropout(p=dropout)

        # ── Fusion + classification head ──────────────────────────────────────
        fusion_dim = transformer_d_model * 2  # LSTM output + Transformer output
        self.fusion = nn.Sequential(
            nn.Linear(fusion_dim, 256),
            nn.ReLU(),
            nn.Dropout(p=dropout),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(p=dropout),
        )

        # SRS §8.2: "6 sigmoid outputs for multi-label classification"
        self.classifier = nn.Linear(128, num_conditions)
        # Note: no sigmoid here — applied at inference for BCEWithLogitsLoss training

    def forward(
        self,
        x: torch.Tensor,  # (batch, feature_dim)
        mask_nans: bool = True,
    ) -> torch.Tensor:
        """
        Forward pass.
        Returns logits (batch, num_conditions) — apply sigmoid for probabilities.
        """
        # Replace NaN with 0 for forward pass (NaN mask handled separately)
        if mask_nans:
            x = torch.nan_to_num(x, nan=0.0)

        # Input normalization and projection
        x = self.input_norm(x)
        x = self.input_proj(x)                          # (batch, d_model)

        # Reshape for sequence encoders: treat 7 games as 7 time steps
        # Each time step = d_model / 7 ≈ 18 features per game (approximate)
        # Pad to multiple of 7 if needed
        seq_len = 7
        batch = x.size(0)
        x_seq = x.unsqueeze(1).expand(-1, seq_len, -1)  # (batch, 7, d_model)

        # ── LSTM branch ───────────────────────────────────────────────────────
        lstm_out, _ = self.lstm(x_seq)                  # (batch, 7, 2*hidden)
        lstm_out = self.mc_dropout(lstm_out)
        lstm_pooled = lstm_out.mean(dim=1)               # (batch, 2*hidden)
        lstm_pooled = self.lstm_proj(lstm_pooled)        # (batch, d_model)

        # ── Transformer branch ────────────────────────────────────────────────
        trans_out = self.transformer(x_seq)              # (batch, 7, d_model)
        trans_out = self.mc_dropout(trans_out)
        trans_pooled = trans_out.mean(dim=1)             # (batch, d_model)

        # ── Fusion ────────────────────────────────────────────────────────────
        fused = torch.cat([lstm_pooled, trans_pooled], dim=-1)  # (batch, d_model*2)
        fused = self.fusion(fused)

        # ── Classification ────────────────────────────────────────────────────
        logits = self.classifier(fused)                  # (batch, 6)
        return logits

    def predict_with_uncertainty(
        self,
        x: torch.Tensor,
        n_samples: int = settings.mc_dropout_samples,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Monte Carlo dropout inference.
        SRS §8.2: "Uncertainty is quantified via Monte Carlo dropout at inference."

        Returns:
            mean_probs: (batch, 6) — mean probability across MC samples
            uncertainty: (batch, 6) — std dev across MC samples (confidence interval)
        """
        # Keep dropout active during inference (do NOT call .eval())
        self.train()  # activates dropout

        samples = []
        with torch.no_grad():
            for _ in range(n_samples):
                logits = self.forward(x)
                probs = torch.sigmoid(logits)
                samples.append(probs)

        samples_tensor = torch.stack(samples, dim=0)   # (n_samples, batch, 6)
        mean_probs = samples_tensor.mean(dim=0)         # (batch, 6)
        uncertainty = samples_tensor.std(dim=0)         # (batch, 6) — std = uncertainty

        return mean_probs, uncertainty


def create_model() -> EarlyMindModel:
    """Instantiate the model with SRS-specified architecture."""
    return EarlyMindModel()
