"""
Data loader for ML training pipeline.
Traceability: ML-TRAIN-001, SRS §8.3, CON-PRIV-001, CON-REG-003

"Training set: 150-300 labeled pilot sessions (CON-SCI-003);
 ground-truth from validated checklists with Cohen's Kappa >=0.75 (CON-SCI-004)"

CON-PRIV-001: Only feature vectors (not raw events) are loaded.
CON-REG-003: No under-18 data used for research without IRB approval —
             enforced by the research_consented flag on each session.
"""
import logging
import json
import numpy as np
from typing import Tuple, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

from ..app.features.schema import FEATURE_NAMES, FEATURE_DIM, vector_from_dict
from ..app.config import CONDITIONS

log = logging.getLogger(__name__)


def load_training_data(
    database_url: str,
    min_sessions: int = 50,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Load labeled feature vectors from the database for training.
    Traceability: ML-TRAIN-001, SRS §8.3

    Returns:
        features: (N, FEATURE_DIM) float32 — normalized feature vectors
        labels:   (N, 6)          float32 — multi-label ground-truth
        age_bands:(N,)             int     — age band index for stratification

    Business rules enforced:
    - CON-PRIV-001: only feature_vectors table is read (no raw events)
    - CON-REG-003: sessions must have research_consented=True
    - SRS §8.3: sessions must be 'completed' (all 7 games finished)
    """
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Join sessions → feature_vectors → predictions → consents
            # CON-REG-003: only sessions with explicit research consent
            cur.execute("""
                SELECT
                    fv.vector_id,
                    fv.features,
                    fv.normalized_features,
                    fv.age_months,
                    p.predictions AS ml_predictions,
                    gt.labels AS ground_truth_labels
                FROM feature_vectors fv
                JOIN sessions s ON s.session_id = fv.session_id
                JOIN children c ON c.child_id = s.child_id
                -- CON-REG-003: research consent required
                JOIN consents con ON con.child_id = c.child_id
                    AND con.consent_type = 'research_data'
                    AND con.granted = TRUE
                -- Ground truth labels (from clinical validation, stored separately)
                LEFT JOIN ground_truth_labels gt ON gt.session_id = fv.session_id
                -- Exclude sessions without ground truth
                WHERE gt.labels IS NOT NULL
                  AND s.status = 'completed'
                  AND fv.age_months BETWEEN 48 AND 132
                ORDER BY fv.created_at
            """)
            rows = cur.fetchall()

    finally:
        conn.close()

    if len(rows) < min_sessions:
        log.warning(
            f"Only {len(rows)} labeled sessions available "
            f"(minimum {min_sessions} recommended for training, SRS §8.3: 150-300)"
        )

    log.info(f"Loaded {len(rows)} labeled sessions for training")

    features_list = []
    labels_list = []
    age_bands_list = []

    for row in rows:
        # Build feature vector from normalized_features (GAME-FR-011)
        norm_features: dict = row["normalized_features"] or {}
        raw_features: dict = row["features"] or {}

        # Merge: prefer normalized, fall back to raw
        feature_dict = {**raw_features, **norm_features}
        feature_dict["age_months"] = float(row["age_months"])

        vec = vector_from_dict(feature_dict, fill_missing_with_nan=True)
        features_list.append(vec)

        # Ground truth labels — 6 conditions, binary
        gt = row["ground_truth_labels"]
        if isinstance(gt, str):
            gt = json.loads(gt)

        label_vec = np.zeros(len(CONDITIONS), dtype=np.float32)
        for i, cond in enumerate(CONDITIONS):
            label_vec[i] = float(gt.get(cond, 0))
        labels_list.append(label_vec)

        # Age band for stratification (SRS §8.3)
        age_months = int(row["age_months"])
        age_band = min((age_months - 48) // 12, 5)  # 0=4-5y, 1=5-6y, ..., 5=9-10y
        age_bands_list.append(age_band)

    features = np.array(features_list, dtype=np.float32)   # (N, FEATURE_DIM)
    labels = np.array(labels_list, dtype=np.float32)         # (N, 6)
    age_bands = np.array(age_bands_list, dtype=np.int32)     # (N,)

    # Log label distribution
    log.info("Label distribution:")
    for i, cond in enumerate(CONDITIONS):
        pos_count = int(labels[:, i].sum())
        log.info(f"  {cond}: {pos_count}/{len(labels)} positive ({pos_count/len(labels)*100:.1f}%)")

    return features, labels, age_bands


def load_ground_truth_from_csv(csv_path: str) -> dict:
    """
    Load ground-truth labels from a CSV file (research annotator output).
    Traceability: CON-SCI-004 (Cohen's Kappa >=0.75 between annotators)

    CSV format: session_id, dyslexia, dyscalculia, adhd_inattentive,
                adhd_hyperactive_impulsive, working_memory_deficit, processing_speed_deficit
    """
    import csv
    ground_truth = {}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            session_id = row["session_id"]
            labels = {}
            for cond in CONDITIONS:
                val = row.get(cond, "0").strip()
                labels[cond] = int(val) if val.isdigit() else 0
            ground_truth[session_id] = labels

    log.info(f"Loaded {len(ground_truth)} ground-truth labels from {csv_path}")
    return ground_truth


def compute_cohens_kappa(labels_rater1: np.ndarray, labels_rater2: np.ndarray) -> float:
    """
    Compute Cohen's Kappa for inter-rater reliability.
    Traceability: CON-SCI-004 (target ≥ 0.75), SRS §8.3

    Args:
        labels_rater1, labels_rater2: (N, 6) binary label arrays from two annotators
    Returns:
        Mean kappa across all 6 conditions
    """
    from sklearn.metrics import cohen_kappa_score

    kappas = []
    for i, cond in enumerate(CONDITIONS):
        y1 = labels_rater1[:, i].astype(int)
        y2 = labels_rater2[:, i].astype(int)
        if len(np.unique(y1)) < 2 or len(np.unique(y2)) < 2:
            log.warning(f"Only one class for {cond} — skipping kappa")
            continue
        kappa = cohen_kappa_score(y1, y2)
        kappas.append(kappa)
        log.info(f"  Cohen's Kappa for {cond}: {kappa:.3f} (target ≥ 0.75)")
        if kappa < 0.75:
            log.warning(f"  ⚠ Kappa {kappa:.3f} below SRS target 0.75 (CON-SCI-004)")

    mean_kappa = float(np.mean(kappas)) if kappas else 0.0
    log.info(f"Mean Cohen's Kappa: {mean_kappa:.3f}")
    return mean_kappa
