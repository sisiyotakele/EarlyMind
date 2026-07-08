"""
Age normalization for the ML service.
Traceability: ML-FE-002, GAME-FR-011, SRS §8.1

"All features normalized by age against the normative database (GAME-FR-011)"
"Missing-game features are null-flagged rather than zeroed, to avoid bias."

This mirrors the client-side AgeNormalizer.ts but runs server-side for
features that weren't normalized on the client (e.g., computed cross-game features).
"""
import numpy as np
from typing import Dict, Optional, List
import logging

log = logging.getLogger(__name__)

# Normative data structure: {feature_name: {age_band_min: (mean, std)}}
NormativeDB = Dict[str, Dict[float, tuple]]  # age_band_min → (mean, std_dev)


class AgeNormalizer:
    """
    Server-side z-score normalization.
    Traceability: GAME-FR-011, SRS §8.1
    """

    def __init__(self, normative_db: NormativeDB):
        self.db = normative_db

    def normalize(
        self,
        feature_name: str,
        raw_value: float,
        age_months: float,
    ) -> Optional[float]:
        """
        z-score normalize a single feature value.
        Returns None if norms unavailable (GAME-FR-011: null-flag, not zero).
        """
        if np.isnan(raw_value):
            return None

        params = self._lookup(feature_name, age_months)
        if params is None:
            return None  # Null-flagged per GAME-FR-011

        mean, std = params
        if std <= 0:
            return None

        return (raw_value - mean) / std

    def normalize_vector(
        self,
        features: Dict[str, Optional[float]],
        age_months: float,
    ) -> Dict[str, Optional[float]]:
        """
        Normalize all features in a dict.
        Returns None values for features with unavailable norms.
        """
        result = {}
        for name, value in features.items():
            if value is None or (isinstance(value, float) and np.isnan(value)):
                result[name] = None
                continue
            result[name] = self.normalize(name, float(value), age_months)
        return result

    def _lookup(
        self,
        feature_name: str,
        age_months: float,
    ) -> Optional[tuple]:
        """
        Look up normative params with linear interpolation between 0.5-year bands.
        Traceability: GAME-FR-011: "interpolating between points"
        """
        if feature_name not in self.db:
            return None

        bands = self.db[feature_name]
        band_keys = sorted(bands.keys())

        if not band_keys:
            return None

        # Exact match
        for k in band_keys:
            if k <= age_months < k + 6:  # 0.5-year = 6 months
                return bands[k]

        # Below range — use lowest
        if age_months < band_keys[0]:
            return bands[band_keys[0]]

        # Above range — use highest
        if age_months >= band_keys[-1] + 6:
            return bands[band_keys[-1]]

        # Interpolate between adjacent bands
        lower_k = max(k for k in band_keys if k <= age_months)
        upper_k = min(k for k in band_keys if k > age_months)

        lower = bands[lower_k]
        upper = bands[upper_k]

        t = (age_months - lower_k) / (upper_k - lower_k)
        mean = lower[0] + t * (upper[0] - lower[0])
        std = lower[1] + t * (upper[1] - lower[1])

        return (mean, max(std, 1e-6))


def load_normative_db_from_rows(rows: List[dict]) -> NormativeDB:
    """
    Build normative DB from DB query rows.
    Row format: {feature_name, age_months_min, mean, std_dev, is_available}
    """
    db: NormativeDB = {}
    for row in rows:
        if not row.get("is_available", True):
            continue
        fname = row["feature_name"]
        age_min = float(row["age_months_min"])
        if fname not in db:
            db[fname] = {}
        db[fname][age_min] = (float(row["mean"]), float(row["std_dev"]))
    return db
