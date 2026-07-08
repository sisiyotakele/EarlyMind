"""
Training pipeline
Traceability: ML-TRAIN-001, SRS §8.3

"Training set: 150-300 labeled pilot sessions (CON-SCI-003);
 ground-truth from validated checklists with Cohen's Kappa >=0.75 (CON-SCI-004);
 class imbalance addressed via weighted loss or SMOTE-style oversampling;
 70/15/15 train/validation/test split stratified by condition and age band;
 every trained model is versioned, stored in S3, and traceable to the reports it generated."
"""
import os
import json
import logging
import datetime
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import boto3

from ..app.models.architecture import EarlyMindModel, create_model
from ..app.features.schema import FEATURE_DIM, FEATURE_NAMES
from ..app.config import CONDITIONS, settings
from .evaluation import evaluate_model

log = logging.getLogger(__name__)

# ── Dataset ───────────────────────────────────────────────────────────────────

class SessionDataset(Dataset):
    """
    Dataset of session feature vectors and multi-label ground-truth.
    Traceability: ML-TRAIN-001, SRS §8.3
    """
    def __init__(self, features: np.ndarray, labels: np.ndarray):
        # features: (N, FEATURE_DIM), labels: (N, 6) float32
        assert features.shape[1] == FEATURE_DIM
        assert labels.shape[1] == len(CONDITIONS)
        self.features = torch.tensor(features, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.features)

    def __getitem__(self, idx: int):
        return self.features[idx], self.labels[idx]


# ── Main training function ────────────────────────────────────────────────────

def train(
    features: np.ndarray,      # (N, FEATURE_DIM)
    labels: np.ndarray,        # (N, 6) multi-label binary
    age_bands: np.ndarray,     # (N,) for stratified split
    n_epochs: int = 100,
    batch_size: int = 32,
    learning_rate: float = 1e-3,
    model_version: str | None = None,
) -> EarlyMindModel:
    """
    Full training run per SRS §8.3.
    Returns trained model; saves to S3.
    """
    if model_version is None:
        model_version = f"v{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"

    log.info(f"Starting training run — version: {model_version}")
    log.info(f"Dataset: {len(features)} sessions, {FEATURE_DIM} features, {len(CONDITIONS)} conditions")

    # ── 70/15/15 stratified split by age band (SRS §8.3) ────────────────────
    # Stratify by age_band to ensure representation across ages 4-10
    X_trainval, X_test, y_trainval, y_test, ab_trainval, _ = train_test_split(
        features, labels, age_bands,
        test_size=0.15,
        random_state=42,
        stratify=age_bands,
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval,
        test_size=0.15 / 0.85,  # 15% of original = 15/85 of remaining
        random_state=42,
        stratify=ab_trainval,
    )
    log.info(f"Split: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")

    # ── NaN imputation — training medians ────────────────────────────────────
    medians = np.nanmedian(X_train, axis=0)
    for split in [X_train, X_val, X_test]:
        nan_mask = np.isnan(split)
        split[nan_mask] = np.take(medians, np.where(nan_mask)[1])

    # ── Datasets and loaders ─────────────────────────────────────────────────
    train_ds = SessionDataset(X_train, y_train)
    val_ds = SessionDataset(X_val, y_val)
    test_ds = SessionDataset(X_test, y_test)

    # Weighted sampler for class imbalance (SRS §8.3)
    sample_weights = _compute_sample_weights(y_train)
    sampler = WeightedRandomSampler(sample_weights, num_samples=len(train_ds), replacement=True)

    train_loader = DataLoader(train_ds, batch_size=batch_size, sampler=sampler)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    # ── Model, loss, optimizer ────────────────────────────────────────────────
    model = create_model()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    # BCEWithLogitsLoss with per-condition positive weights (class imbalance — SRS §8.3)
    pos_weights = _compute_pos_weights(y_train)
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(pos_weights, dtype=torch.float32).to(device))
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    # ── Training loop ─────────────────────────────────────────────────────────
    best_val_loss = float("inf")
    best_state = None

    for epoch in range(n_epochs):
        model.train()
        train_loss = 0.0

        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            logits = model(X_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item()

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(device), y_batch.to(device)
                logits = model(X_batch)
                val_loss += criterion(logits, y_batch).item()

        train_loss /= len(train_loader)
        val_loss /= len(val_loader)
        scheduler.step(val_loss)

        if (epoch + 1) % 10 == 0:
            log.info(f"Epoch {epoch+1}/{n_epochs} — train_loss={train_loss:.4f} val_loss={val_loss:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    # ── Load best weights and evaluate on test set ────────────────────────────
    if best_state:
        model.load_state_dict(best_state)

    log.info("Evaluating on test set...")
    metrics = evaluate_model(model, test_loader, device)
    _log_metrics(metrics)

    # ── Save model to S3 (SRS §8.3: versioned, traceable) ────────────────────
    _save_model(model, medians, model_version, metrics)

    return model


# ── Helpers ───────────────────────────────────────────────────────────────────

def _compute_pos_weights(labels: np.ndarray) -> np.ndarray:
    """Compute positive class weights for BCEWithLogitsLoss (class imbalance — SRS §8.3)."""
    pos_count = labels.sum(axis=0)
    neg_count = len(labels) - pos_count
    # Weight = neg_count / pos_count (clip to [0.1, 100])
    weights = np.where(pos_count > 0, neg_count / np.maximum(pos_count, 1), 1.0)
    return np.clip(weights, 0.1, 100.0)


def _compute_sample_weights(labels: np.ndarray) -> np.ndarray:
    """Per-sample weight based on rarest positive condition."""
    pos_weights = _compute_pos_weights(labels)
    # Each sample's weight = max of its positive condition weights
    weights = np.ones(len(labels))
    for i, row in enumerate(labels):
        pos_indices = np.where(row > 0.5)[0]
        if len(pos_indices) > 0:
            weights[i] = pos_weights[pos_indices].max()
    return weights


def _log_metrics(metrics: dict) -> None:
    log.info("=== Test Set Metrics ===")
    for condition in CONDITIONS:
        m = metrics.get(condition, {})
        sensitivity = m.get("sensitivity", 0)
        specificity = m.get("specificity", 0)
        auc = m.get("auc_roc", 0)
        log.info(
            f"  {condition}: sensitivity={sensitivity:.3f} "
            f"(target ≥0.80), specificity={specificity:.3f} "
            f"(target ≥0.70), AUC={auc:.3f} (target ≥0.80)"
        )
        # Flag any below-target metrics
        if sensitivity < 0.80:
            log.warning(f"  ⚠ {condition} sensitivity {sensitivity:.3f} < 0.80 (SRS §8.4)")
        if specificity < 0.70:
            log.warning(f"  ⚠ {condition} specificity {specificity:.3f} < 0.70 (SRS §8.4)")


def _save_model(
    model: EarlyMindModel,
    medians: np.ndarray,
    version: str,
    metrics: dict,
) -> None:
    """Save model weights + medians + metrics to S3 (SRS §8.3)."""
    os.makedirs(settings.model_cache_dir, exist_ok=True)

    weights_path = os.path.join(settings.model_cache_dir, f"model_{version}.pt")
    medians_path = os.path.join(settings.model_cache_dir, f"medians_{version}.npy")
    metrics_path = os.path.join(settings.model_cache_dir, f"metrics_{version}.json")

    torch.save(model.state_dict(), weights_path)
    np.save(medians_path, medians)
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    log.info(f"Model saved locally: {weights_path}")

    try:
        s3 = boto3.client("s3", region_name=settings.aws_region)
        prefix = f"{settings.model_s3_key_prefix}/{version}"

        for local_path, s3_name in [
            (weights_path, f"{prefix}/model.pt"),
            (medians_path, f"{prefix}/medians.npy"),
            (metrics_path, f"{prefix}/metrics.json"),
        ]:
            s3.upload_file(local_path, settings.s3_bucket_models, s3_name)
            log.info(f"Uploaded to s3://{settings.s3_bucket_models}/{s3_name}")

    except Exception as e:
        log.warning(f"S3 upload failed (model saved locally only): {e}")
