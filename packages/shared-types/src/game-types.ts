/**
 * Game-engine shared types
 * Traceability: GAME-FR-001 through GAME-FR-015, Section 4
 */

import type { Language } from './entities';

// ─── Game identifiers (GAME-FR-002: fixed order) ──────────────────────────────

export type GameId =
    | 'letter-rain'
    | 'pattern-mirror'
    | 'story-rhythm'
    | 'number-jumper'
    | 'color-sequence'
    | 'target-chase'
    | 'word-echo';

/** Fixed game sequence per GAME-FR-002 — DO NOT reorder */
export const GAME_SEQUENCE: GameId[] = [
    'letter-rain',
    'pattern-mirror',
    'story-rhythm',
    'number-jumper',
    'color-sequence',
    'target-chase',
    'word-echo',
];

export const TOTAL_GAMES = GAME_SEQUENCE.length; // 7

// ─── Difficulty (GAME-FR-007) ─────────────────────────────────────────────────

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;
export const DIFFICULTY_MIN: DifficultyLevel = 1;
export const DIFFICULTY_MAX: DifficultyLevel = 5;
/** Increase after N consecutive correct answers (GAME-FR-007: exactly 3) */
export const ADAPTIVE_CORRECT_THRESHOLD = 3;
/** Decrease after N consecutive incorrect answers (GAME-FR-007: exactly 3) */
export const ADAPTIVE_INCORRECT_THRESHOLD = 3;

// ─── Event logging (GAME-FR-009) ──────────────────────────────────────────────

export type GameEventType =
    | 'session_start'
    | 'session_pause'
    | 'session_resume'
    | 'session_complete'
    | 'game_start'
    | 'game_complete'
    | 'stimulus_shown'
    | 'tap'
    | 'swipe'
    | 'drag_start'
    | 'drag_end'
    | 'correct'
    | 'incorrect'
    | 'omission' // missed a target (GAME-FR-002 scoring)
    | 'commission' // selected a distractor
    | 'difficulty_change'
    | 'audio_played'
    | 'audio_failed';

export interface GameEvent {
    event_id: string; // UUID
    session_id: string;
    game_id: GameId;
    event_type: GameEventType;
    /** performance.now() timestamp in ms (GAME-FR-009: millisecond precision) */
    timestamp_ms: number;
    /** Epoch ms from Date.now() for absolute time correlation */
    wall_clock_ms: number;
    position?: { x: number; y: number } | null;
    stimulus_id?: string | null; // which stimulus was shown
    response_value?: unknown; // what the child responded
    response_latency_ms?: number | null; // time from stimulus → response
    difficulty_level?: DifficultyLevel | null;
    device_state?: DeviceState | null;
    metadata?: Record<string, unknown> | null;
}

export interface DeviceState {
    battery_level?: number | null; // 0-1
    network_type?: string | null; // 'wifi' | '4g' | '3g' | 'offline'
    memory_usage_mb?: number | null;
}

// ─── Session state (GAME-FR-001/003, for LocalStorage recovery) ───────────────

export interface LocalSessionState {
    session_id: string;
    child_id: string;
    language: Language;
    current_game_index: number; // 0-based
    pause_count: number; // GAME-FR-003: max 3
    start_time_ms: number;
    total_paused_ms: number; // GAME-FR-003: excluded from duration
    last_paused_at_ms?: number | null;
    events_buffer: GameEvent[]; // GAME-FR-009: in-memory buffer, flushed to IndexedDB every 10s
    game_results: Partial<Record<GameId, GameResult>>;
}

export interface GameResult {
    game_id: GameId;
    start_time_ms: number;
    end_time_ms: number;
    duration_ms: number;
    final_difficulty: DifficultyLevel;
    events_count: number;
    /** Game-specific summary for feature extraction */
    summary: Record<string, number>;
}

// ─── Feature extraction output (GAME-FR-010) ─────────────────────────────────

/** All 7 feature categories per GAME-FR-010 */
export interface ExtractedFeatures {
    // Temporal features
    temporal: TemporalFeatures;
    // Accuracy features
    accuracy: AccuracyFeatures;
    // Motor features
    motor: MotorFeatures;
    // Attention features
    attention: AttentionFeatures;
    // Persistence features
    persistence: PersistenceFeatures;
    // Learning features
    learning: LearningFeatures;
    // Rhythm features
    rhythm: RhythmFeatures;
}

export interface TemporalFeatures {
    mean_response_time_ms: number | null;
    variance_response_time_ms: number | null;
    response_time_trend: number | null; // slope of RT across trials
    fastest_response_ms: number | null;
    slowest_response_ms: number | null;
}

export interface AccuracyFeatures {
    overall_error_rate: number | null; // 0-1
    commission_error_rate: number | null; // selecting distractor
    omission_error_rate: number | null; // missing target
    correction_rate: number | null; // proportion of self-corrections
    accuracy_by_difficulty: Partial<Record<DifficultyLevel, number | null>>;
}

export interface MotorFeatures {
    touch_precision_px: number | null; // avg deviation from target center
    swipe_velocity_px_ms: number | null;
    tremor_score: number | null; // variance in touch position
    drag_accuracy: number | null; // pattern mirror
}

export interface AttentionFeatures {
    response_drift: number | null; // RT increase over session duration
    omission_cluster_count: number | null; // consecutive missed targets
    recovery_time_ms: number | null; // time to recover after error
    distraction_recovery_rate: number | null;
}

export interface PersistenceFeatures {
    retry_count: number | null;
    abandonment_rate: number | null;
    engagement_score: number | null; // derived from response completeness
}

export interface LearningFeatures {
    performance_delta: number | null; // difference between first and last quartile accuracy
    difficulty_reached: number | null; // max difficulty level achieved
    learning_slope: number | null; // regression slope of accuracy over repeats
}

export interface RhythmFeatures {
    beat_sync_error_ms: number | null; // story-rhythm game
    temporal_regularity: number | null; // coefficient of variation of RT
    inter_response_interval_mean_ms: number | null;
    inter_response_interval_cv: number | null; // coefficient of variation
}
