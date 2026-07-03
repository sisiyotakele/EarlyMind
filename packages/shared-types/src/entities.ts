/**
 * Entity types matching DB schema (SRS Section 7.1)
 * Traceability: DR-001 through DR-009
 */

export type UserRole = 'parent' | 'teacher' | 'school_admin' | 'eaii_admin';
export type Language = 'am' | 'om' | 'ti'; // Amharic, Oromo, Tigrinya (CON-TECH-004)
export type SessionStatus = 'active' | 'paused' | 'completed' | 'incomplete';
export type ConsentType = 'assessment' | 'research_data' | 'data_sharing';

/**
 * DR-001: Users table
 * AUTH-FR-001, AUTH-FR-002, AUTH-FR-003
 */
export interface User {
    user_id: string; // UUID
    phone_number: string; // +251-XXX-XXX-XXX (AUTH-FR-001)
    role: UserRole; // AUTH-FR-004
    language: Language; // AUTH-FR-003, CON-TECH-004
    pin_hash: string; // bcrypt hashed 4-digit PIN (AUTH-NFR-001)
    name?: string | null;
    school_id?: string | null; // FK to schools; required for teacher/school_admin
    failed_pin_attempts: number; // AUTH-FR-002: max 3
    lockout_until?: Date | null; // AUTH-FR-002: 15 min lockout
    last_otp_request?: Date | null; // AUTH-FR-002: max 3/hour
    otp_request_count: number; // resets hourly
    created_at: Date;
    updated_at: Date;
}

/**
 * DR-002: Children table
 * GAME-FR-001
 */
export interface Child {
    child_id: string; // UUID
    parent_id: string; // FK to users (parent role)
    teacher_id?: string | null; // FK to users (teacher role, if school-screened)
    name: string;
    date_of_birth: Date; // age calculation for GAME-FR-011
    language: Language; // GAME-FR-001: child's preferred language
    grade_level?: string | null; // e.g., "KG", "Grade 1", etc.
    notes?: string | null; // teacher/parent notes
    created_at: Date;
    updated_at: Date;
}

/**
 * DR-003: Schools table
 */
export interface School {
    school_id: string; // UUID
    name: string;
    region: string; // Ethiopian administrative region
    woreda?: string | null;
    admin_id: string; // FK to users (school_admin role)
    created_at: Date;
    updated_at: Date;
}

/**
 * DR-004: Sessions table
 * GAME-FR-001, GAME-FR-002, GAME-FR-003, GAME-FR-004
 */
export interface Session {
    session_id: string; // UUID
    child_id: string; // FK to children
    start_time: Date; // GAME-FR-001
    end_time?: Date | null; // GAME-FR-004
    status: SessionStatus; // GAME-FR-003: pause/resume
    language: Language; // GAME-FR-001: language selected at session start
    device_info?: string | null; // JSON string: browser, OS, screen size
    pause_count: number; // GAME-FR-003: max 3 pauses
    paused_at?: Date | null;
    resumed_at?: Date | null;
    current_game_index: number; // 0-6 for 7 games; GAME-FR-002
    total_duration_ms?: number | null; // excludes pause time
    completion_rate?: number | null; // 0-1, calculated at end
    created_at: Date;
    updated_at: Date;
}

/**
 * DR-005: Feature_vectors table
 * GAME-FR-010, GAME-FR-011
 */
export interface FeatureVector {
    vector_id: string; // UUID
    session_id: string; // FK to sessions
    age_months: number; // child's age at session time (GAME-FR-011)
    features: Record<string, number>; // JSON: 200+ features
    normalized_features: Record<string, number | null>; // z-score normalized (GAME-FR-011)
    extraction_timestamp: Date; // GAME-FR-010: client-side extraction time
    created_at: Date;
}

/**
 * DR-006: Predictions table
 * ML-FR-001 (inference results)
 */
export interface Prediction {
    prediction_id: string; // UUID
    session_id: string; // FK to sessions
    model_version: string; // e.g., "v1.2.3" for traceability
    predictions: ConditionPrediction[]; // multi-label (Section 8.2)
    inference_timestamp: Date;
    created_at: Date;
}

export interface ConditionPrediction {
    condition: LearningCondition;
    risk_score: number; // 0-1 probability
    confidence: number; // 0-1 uncertainty quantification (Monte Carlo dropout)
    shap_top_features: string[]; // top 5 contributing features (Section 8.5)
}

export type LearningCondition =
    | 'dyslexia'
    | 'dyscalculia'
    | 'adhd_inattentive'
    | 'adhd_hyperactive_impulsive'
    | 'working_memory_deficit'
    | 'processing_speed_deficit';

/**
 * DR-007: Reports table
 * REPORT-FR-001
 */
export interface Report {
    report_id: string; // UUID
    session_id: string; // FK to sessions
    pdf_url: string; // S3 signed URL (private bucket)
    report_text_amharic: string; // plain-language Amharic summary
    recommendations: string[]; // teacher accommodation suggestions
    referral_suggested: boolean; // whether IERC referral is indicated
    generated_at: Date;
    created_at: Date;
}

/**
 * DR-008: Consents table
 * CON-REG-001, CON-PRIV-001
 */
export interface Consent {
    consent_id: string; // UUID
    parent_id: string; // FK to users (parent role)
    child_id: string; // FK to children
    consent_type: ConsentType; // assessment, research_data, data_sharing
    granted: boolean;
    version: string; // consent form version (for re-consent tracking)
    granted_at?: Date | null;
    revoked_at?: Date | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * DR-009: Audit_logs table
 * SEC-NFR-006, CON-PRIV-005
 */
export interface AuditLog {
    log_id: string; // UUID
    actor_id: string; // FK to users (who performed the action)
    actor_role: UserRole;
    action: string; // e.g., "view_child_data", "delete_account", "export_data"
    target_type?: string | null; // e.g., "child", "session", "report"
    target_id?: string | null; // FK to the affected entity
    metadata?: Record<string, unknown> | null; // JSON: additional context
    ip_address?: string | null;
    user_agent?: string | null;
    timestamp: Date;
}
