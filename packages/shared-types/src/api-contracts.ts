/**
 * API request/response contracts (SRS Section 9.1)
 * Shared between frontend and backend.
 * Traceability: AUTH-FR-001 through AUTH-FR-005, GAME-FR-001, GAME-FR-004, GAME-FR-009/010
 */

import type { Language, UserRole, ConsentType, LearningCondition } from './entities';

// ─── Generic wrapper ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
    success: boolean;
    data: T;
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

// ─── AUTH: POST /api/auth/register (AUTH-FR-001) ──────────────────────────────

export interface RegisterRequest {
    phone_number: string; // +251XXXXXXXXX
    role: 'parent' | 'teacher' | 'school_admin';
    language: Language;
    name: string;
    school_id?: string; // required for teacher / school_admin
}

export interface RegisterResponse {
    message: string; // "OTP sent to +251..."
    phone_number: string;
}

// ─── AUTH: POST /api/auth/register/verify ────────────────────────────────────

export interface VerifyRegistrationRequest {
    phone_number: string;
    otp: string; // 6-digit OTP (AUTH-FR-001)
    pin: string; // 4-digit PIN (AUTH-FR-001)
}

export interface AuthToken {
    session_token: string; // httpOnly cookie is set server-side; this carries it for non-browser clients
    expires_at: Date;
}

export interface AuthUser {
    user_id: string;
    role: UserRole;
    name?: string | null;
    language: Language;
    phone_number: string; // display-only (AUTH-FR-003)
}

export interface AuthResponse {
    user: AuthUser;
    token: AuthToken;
}

// ─── AUTH: POST /api/auth/login (AUTH-FR-002) ─────────────────────────────────

export interface LoginWithPinRequest {
    phone_number: string;
    pin: string; // 4-digit
}

export interface RequestOtpRequest {
    phone_number: string;
}

export interface LoginWithOtpRequest {
    phone_number: string;
    otp: string; // 6-digit
}

// ─── USERS: GET/PUT /api/users/me (AUTH-FR-003) ───────────────────────────────

export interface UpdateProfileRequest {
    name?: string;
    language?: Language;
    current_pin?: string; // required when changing PIN
    new_pin?: string;
}

// ─── USERS: DELETE /api/users/me (AUTH-FR-005) ───────────────────────────────

export interface DeleteAccountRequest {
    confirmation: 'I understand this is permanent'; // exact string required
    pin?: string; // one of pin or otp required for re-authentication
    otp?: string;
}

// ─── CHILDREN: POST /api/children ────────────────────────────────────────────

export interface CreateChildRequest {
    name: string;
    date_of_birth: string; // ISO 8601 date string
    language: Language;
    grade_level?: string;
}

export interface ChildResponse {
    child_id: string;
    name: string;
    date_of_birth: string;
    language: Language;
    grade_level?: string | null;
    created_at: string;
}

// ─── SESSIONS: POST /api/sessions (GAME-FR-001) ───────────────────────────────

export interface StartSessionRequest {
    child_id: string;
    language: Language; // GAME-FR-001: language for this session
}

export interface SessionResponse {
    session_id: string;
    child_id: string;
    language: Language;
    status: 'active' | 'paused' | 'completed' | 'incomplete';
    current_game_index: number;
    start_time: string;
}

// ─── SESSIONS: PATCH /api/sessions/:id (GAME-FR-003/004) ─────────────────────

export type SessionUpdateAction = 'pause' | 'resume' | 'complete' | 'abandon';

export interface UpdateSessionRequest {
    action: SessionUpdateAction;
}

// ─── FEATURES: POST /api/sessions/:id/features (GAME-FR-010) ─────────────────

export interface UploadFeatureVectorRequest {
    age_months: number;
    /** Raw 200+ features before normalization */
    features: Record<string, number>;
    /** Client-computed z-score normalized features; null = norm not available (GAME-FR-011) */
    normalized_features: Record<string, number | null>;
    extraction_timestamp: string; // ISO 8601
}

export interface FeatureVectorResponse {
    vector_id: string;
    session_id: string;
    created_at: string;
}

// ─── REPORTS: GET /api/sessions/:id/report ───────────────────────────────────

export interface ReportResponse {
    report_id: string;
    session_id: string;
    /** Pre-signed S3 URL valid 1 hour */
    pdf_url: string;
    report_text_amharic: string;
    recommendations: string[];
    referral_suggested: boolean;
    generated_at: string;
    /** SRS §10.1 mandated disclaimer (CON-REG-004) */
    disclaimer: 'ይህ ምርመራ ነው፣ ምርመራ ሳይሆን።'; // "This is a screening, not a diagnosis"
}

// ─── CONSENT: POST /api/consents (CON-REG-001) ───────────────────────────────

export interface UpdateConsentRequest {
    child_id: string;
    consent_type: ConsentType;
    granted: boolean;
    version: string;
}

// ─── DASHBOARD: GET /api/dashboard/school/:id ────────────────────────────────

export interface SchoolDashboardResponse {
    school_id: string;
    school_name: string;
    total_children: number;
    screened_count: number;
    pending_count: number;
    /** Aggregate risk distribution — NO individual identifiers (CON-PRIV-004) */
    condition_summary: Partial<Record<LearningCondition, number>>;
    screening_completion_rate: number; // 0-1
    last_updated: string;
}

// ─── ML INFERENCE (internal, SRS §9.3) ───────────────────────────────────────

export interface MlInferenceRequest {
    session_id: string;
    age_months: number;
    normalized_features: Record<string, number | null>;
}

export interface MlInferenceResponse {
    session_id: string;
    model_version: string;
    predictions: Array<{
        condition: LearningCondition;
        risk_score: number; // 0-1
        confidence: number; // 0-1
        shap_top_features: string[];
    }>;
}
