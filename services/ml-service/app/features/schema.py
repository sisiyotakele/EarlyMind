"""
Feature schema — maps frontend feature names to model input indices.
Traceability: ML-FE-001, GAME-FR-010 (200+ features, 7 categories)

"Minimum 200 features per completed session across temporal, accuracy,
 motor, attention, persistence, learning, and rhythm categories." (SRS §8.1)

"Missing-game features are null-flagged rather than zeroed, to avoid bias." (SRS §8.1)
"""
from typing import List, Optional
import numpy as np

# ── Feature index map ────────────────────────────────────────────────────────
# Ordered list of all feature names expected in the input vector.
# Position = index in the 200-dimensional array fed to the model.
# Null-handling: NaN substituted with per-feature training-set median at inference.

FEATURE_NAMES: List[str] = [
    # ── Letter Rain (GAME-01): 15 features ──────────────────────────────────
    "letter_rain_commission_rate",
    "letter_rain_omission_rate",
    "letter_rain_rt_variability",
    "letter_rain_mean_rt_ms",
    "letter_rain_max_difficulty",
    "letter_rain_accuracy",
    "letter_rain_score",
    "letter_rain_trial_count",
    "letter_rain_accuracy_d1",
    "letter_rain_accuracy_d2",
    "letter_rain_accuracy_d3",
    "letter_rain_accuracy_d4",
    "letter_rain_accuracy_d5",
    "letter_rain_rt_trend",
    "letter_rain_omission_cluster_count",
    # ── Pattern Mirror (GAME-02): 15 features ───────────────────────────────
    "pattern_mirror_accuracy",
    "pattern_mirror_mean_rt_ms",
    "pattern_mirror_rt_variability",
    "pattern_mirror_max_span",
    "pattern_mirror_error_rate",
    "pattern_mirror_sequence_length_reached",
    "pattern_mirror_drag_accuracy",
    "pattern_mirror_recall_latency_ms",
    "pattern_mirror_partial_recall_rate",
    "pattern_mirror_omission_rate",
    "pattern_mirror_rt_trend",
    "pattern_mirror_score",
    "pattern_mirror_trial_count",
    "pattern_mirror_span_d1",
    "pattern_mirror_span_d2",
    # ── Story Rhythm (GAME-03): 15 features ─────────────────────────────────
    "story_rhythm_beat_sync_error_ms",
    "story_rhythm_tap_accuracy",
    "story_rhythm_iri_mean_ms",
    "story_rhythm_iri_cv",
    "story_rhythm_temporal_regularity",
    "story_rhythm_mean_rt_ms",
    "story_rhythm_rt_variability",
    "story_rhythm_omission_rate",
    "story_rhythm_commission_rate",
    "story_rhythm_tap_count",
    "story_rhythm_correct_rate",
    "story_rhythm_rt_trend",
    "story_rhythm_max_difficulty",
    "story_rhythm_score",
    "story_rhythm_phrase_accuracy",
    # ── Number Jumper (GAME-04): 15 features ────────────────────────────────
    "number_jumper_accuracy",
    "number_jumper_mean_rt_ms",
    "number_jumper_rt_variability",
    "number_jumper_max_difficulty",
    "number_jumper_error_rate",
    "number_jumper_commission_rate",
    "number_jumper_omission_rate",
    "number_jumper_score",
    "number_jumper_trial_count",
    "number_jumper_accuracy_d1",
    "number_jumper_accuracy_d2",
    "number_jumper_accuracy_d3",
    "number_jumper_rt_trend",
    "number_jumper_counting_error_rate",
    "number_jumper_magnitude_error_rate",
    # ── Color Sequence (GAME-05): 15 features ───────────────────────────────
    "color_seq_commission_rate",
    "color_seq_omission_rate",
    "color_seq_rt_variability",
    "color_seq_mean_rt_ms",
    "color_seq_max_difficulty",
    "color_seq_accuracy",
    "color_seq_score",
    "color_seq_trial_count",
    "color_seq_accuracy_d1",
    "color_seq_accuracy_d2",
    "color_seq_accuracy_d3",
    "color_seq_accuracy_d4",
    "color_seq_accuracy_d5",
    "color_seq_rt_trend",
    "color_seq_omission_cluster_count",
    # ── Target Chase (GAME-06): 15 features ─────────────────────────────────
    "target_chase_commission_rate",
    "target_chase_omission_rate",
    "target_chase_mean_rt_ms",
    "target_chase_rt_variability",
    "target_chase_hits",
    "target_chase_misses",
    "target_chase_false_alarms",
    "target_chase_correct_rejections",
    "target_chase_d_prime",           # signal detection d'
    "target_chase_beta",              # response bias
    "target_chase_hit_rate",
    "target_chase_false_alarm_rate",
    "target_chase_rt_trend",
    "target_chase_isi_effect",        # RT variation with ISI length
    "target_chase_late_response_rate",
    # ── Word Echo (GAME-07): 15 features ────────────────────────────────────
    "word_echo_max_span",
    "word_echo_mean_span",
    "word_echo_accuracy",
    "word_echo_order_error_rate",
    "word_echo_omission_error_rate",
    "word_echo_mean_word_latency_ms",
    "word_echo_latency_variability",
    "word_echo_final_difficulty",
    "word_echo_score",
    "word_echo_round_count",
    "word_echo_intrusion_rate",
    "word_echo_first_word_latency_ms",
    "word_echo_last_word_latency_ms",
    "word_echo_span_d1",
    "word_echo_span_d5",
    # ── Cross-game temporal features: 30 features ───────────────────────────
    "overall_mean_rt_ms",
    "overall_rt_variability",
    "overall_rt_trend",
    "session_duration_ms",
    "pause_count",
    "total_pause_ms",
    "intertask_gap_ms",               # time between games
    "fatigue_slope",                  # RT increase over whole session
    "overall_commission_rate",
    "overall_omission_rate",
    "overall_accuracy",
    "peak_accuracy_game_index",
    "worst_accuracy_game_index",
    "accuracy_variance_across_games",
    "rt_variance_across_games",
    "difficulty_reached_mean",
    "difficulty_reached_variance",
    "engagement_score",
    "abandonment_rate",
    "recovery_rate_after_error",
    "correction_rate",
    "omission_cluster_count_total",
    "distraction_recovery_rate",
    "learning_slope_overall",
    "performance_delta_first_last",
    "touch_precision_mean_px",
    "swipe_velocity_mean",
    "tremor_score",
    "drag_accuracy",
    "retry_count",
    # ── Age-normalized z-score versions of key features: 50 features ────────
    # (z = (value - age_mean) / age_std per GAME-FR-011)
    "z_letter_rain_mean_rt_ms",
    "z_letter_rain_omission_rate",
    "z_letter_rain_commission_rate",
    "z_letter_rain_rt_variability",
    "z_pattern_mirror_max_span",
    "z_pattern_mirror_accuracy",
    "z_story_rhythm_beat_sync_error_ms",
    "z_story_rhythm_iri_cv",
    "z_number_jumper_accuracy",
    "z_number_jumper_mean_rt_ms",
    "z_color_seq_omission_rate",
    "z_color_seq_rt_variability",
    "z_target_chase_commission_rate",
    "z_target_chase_omission_rate",
    "z_target_chase_d_prime",
    "z_word_echo_max_span",
    "z_word_echo_order_error_rate",
    "z_word_echo_mean_word_latency_ms",
    "z_overall_mean_rt_ms",
    "z_overall_accuracy",
    "z_fatigue_slope",
    "z_engagement_score",
    "z_learning_slope_overall",
    "z_performance_delta_first_last",
    "z_omission_cluster_count_total",
    "z_touch_precision_mean_px",
    "z_tremor_score",
    "z_difficulty_reached_mean",
    "z_recovery_rate_after_error",
    "z_correction_rate",
    # Padding to reach 200 total — demographic/metadata
    "age_months",                     # used as conditioning variable
    "age_band_4_5",                   # one-hot age band
    "age_band_5_6",
    "age_band_6_7",
    "age_band_7_8",
    "age_band_8_9",
    "age_band_9_10",
    "is_amharic",                     # language one-hot
    "is_oromo",
    "is_tigrinya",
    "device_type_mobile",             # device one-hot
    "device_type_tablet",
    "device_type_desktop",
    "session_time_of_day_morning",
    "session_time_of_day_afternoon",
    "session_time_of_day_evening",
    "completion_rate",                # fraction of games completed
    "total_trials_completed",
    "screened_by_teacher",            # 0=parent, 1=teacher
    "retry_session",                  # 0=first, 1=re-screen
]

assert len(FEATURE_NAMES) >= 200, f"Must have >=200 features, got {len(FEATURE_NAMES)}"
FEATURE_DIM = len(FEATURE_NAMES)

# Build lookup: name → index
FEATURE_INDEX: dict = {name: i for i, name in enumerate(FEATURE_NAMES)}


def vector_from_dict(
    feature_dict: dict,
    fill_missing_with_nan: bool = True,
) -> np.ndarray:
    """
    Convert a feature dict to a fixed-length numpy vector.
    Traceability: ML-FE-001, GAME-FR-010/011

    "Missing-game features are null-flagged rather than zeroed" (SRS §8.1)
    Null values become NaN; inference replaces NaN with training-set medians.
    """
    vec = np.full(FEATURE_DIM, np.nan if fill_missing_with_nan else 0.0, dtype=np.float32)
    for name, idx in FEATURE_INDEX.items():
        val = feature_dict.get(name)
        if val is not None and not (isinstance(val, float) and np.isnan(val)):
            vec[idx] = float(val)
    return vec
