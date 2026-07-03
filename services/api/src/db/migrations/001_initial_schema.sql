-- Migration: 001_initial_schema
-- EarlyMind initial database schema
--
-- Implements all tables from SRS §7.1 exactly.
-- Field names match the shared-types entities verbatim.
--
-- Traceability: SRS §7.1, DATA-DR-001
-- Encryption at rest enforced at the RDS/Aurora layer (CON-PRIV-002).
-- This migration runs inside the app DB; RDS SSE-AES-256 is infra-level.

-- ─── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";   -- for case-insensitive phone comparison

-- ─── Enumerations ──────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'parent',
  'teacher',
  'school_admin',
  'eaii_admin'
);

-- SRS §1.4.1, CON-TECH-004, LOC-NFR-001
CREATE TYPE language_code AS ENUM (
  'am',  -- Amharic
  'om',  -- Afaan Oromoo
  'ti'   -- Tigrinya
);

-- SRS §3.2 GAME-FR-001–004
CREATE TYPE session_status AS ENUM (
  'active',
  'paused',
  'completed',
  'incomplete',
  'expired'
);

-- SRS §2.5.1 CON-REG-001, §6.3 PRIV-NFR-002
CREATE TYPE consent_type AS ENUM (
  'assessment',
  'research_data_collection'
);

-- SRS §1.4.1, §8.2 — the 6 conditions the ML model classifies
CREATE TYPE ld_condition AS ENUM (
  'dyslexia',
  'dyscalculia',
  'adhd_inattentive',
  'adhd_hyperactive_impulsive',
  'working_memory_deficit',
  'processing_speed_deficit'
);

-- SRS §3.2 GAME-FR-002 — fixed 7-game sequence
CREATE TYPE game_id AS ENUM (
  'letter_rain',
  'pattern_mirror',
  'story_rhythm',
  'number_jumper',
  'color_sequence',
  'target_chase',
  'word_echo'
);

CREATE TYPE audit_action AS ENUM (
  'user.register',
  'user.login',
  'user.login_failed',
  'user.locked',
  'user.delete',
  'user.profile_update',
  'child.create',
  'child.update',
  'child.delete',
  'session.start',
  'session.pause',
  'session.resume',
  'session.complete',
  'session.abandon',
  'features.upload',
  'report.generate',
  'report.view',
  'consent.grant',
  'consent.revoke',
  'data.export',
  'model.deploy',
  'model.retrain'
);

-- ─── schools ───────────────────────────────────────────────────────────────────
-- Created before users because users.school_id references schools.

CREATE TABLE schools (
  school_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  region      TEXT        NOT NULL,
  -- admin_id forward-referenced; set after user creation
  admin_id    UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── users ─────────────────────────────────────────────────────────────────────
-- SRS §7.1: user_id, phone_number, role, language, pin_hash
-- AUTH-FR-001: phone numbers unique per account
-- AUTH-NFR-001: pin_hash stored with bcrypt cost>=12 (application-level)

CREATE TABLE users (
  user_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number        CITEXT      NOT NULL,      -- E.164 format: +251XXXXXXXXX
  role                user_role   NOT NULL,
  language            language_code NOT NULL,
  pin_hash            TEXT        NOT NULL,      -- bcrypt, cost>=12 (AUTH-NFR-001)
  name                TEXT        NOT NULL,
  school_id           UUID        REFERENCES schools(school_id) ON DELETE SET NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  -- PIN lockout — AUTH-FR-002: lock 15 min after 3 failed attempts
  failed_pin_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Phone must be globally unique
  CONSTRAINT users_phone_unique UNIQUE (phone_number),
  -- Enforce +251XXXXXXXXX format (9 digits after +251)
  CONSTRAINT users_phone_format CHECK (phone_number ~ '^\+251[0-9]{9}$')
);

-- Allow schools to reference their admin after user table exists
ALTER TABLE schools
  ADD CONSTRAINT schools_admin_fk
  FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE SET NULL;

-- ─── children ──────────────────────────────────────────────────────────────────
-- SRS §7.1: child_id, parent_id, name, date_of_birth, language
-- Ages 4-10 only (SRS §1.4.2)

CREATE TABLE children (
  child_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   UUID          REFERENCES users(user_id) ON DELETE CASCADE,
  teacher_id  UUID          REFERENCES users(user_id) ON DELETE SET NULL,
  school_id   UUID          REFERENCES schools(school_id) ON DELETE SET NULL,
  name        TEXT          NOT NULL,
  date_of_birth DATE        NOT NULL,
  language    language_code NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- At least one of parent_id or teacher_id must be set
  CONSTRAINT children_has_owner CHECK (parent_id IS NOT NULL OR teacher_id IS NOT NULL),
  -- Age 4-10 enforced at DB level (SRS §1.4.2 out-of-scope for other ages)
  CONSTRAINT children_age_range CHECK (
    date_of_birth >= CURRENT_DATE - INTERVAL '10 years' AND
    date_of_birth <= CURRENT_DATE - INTERVAL '4 years'
  )
);

-- ─── sessions ──────────────────────────────────────────────────────────────────
-- SRS §7.1: session_id, child_id, start_time, end_time, status
-- GAME-FR-001: UUID, child_id, start_time, language, device_info
-- GAME-FR-003: pause_count max 3

CREATE TABLE sessions (
  session_id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id                UUID          NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,
  administered_by         UUID          NOT NULL REFERENCES users(user_id),
  language                language_code NOT NULL,
  status                  session_status NOT NULL DEFAULT 'active',
  start_time              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  end_time                TIMESTAMPTZ,
  total_duration_seconds  INTEGER,                    -- pause time excluded (GAME-FR-003)
  pause_count             INTEGER       NOT NULL DEFAULT 0
                            CHECK (pause_count <= 3), -- GAME-FR-003 max 3 pauses
  current_game_index      INTEGER       NOT NULL DEFAULT 0
                            CHECK (current_game_index BETWEEN 0 AND 6),
  games_completed         game_id[]     NOT NULL DEFAULT '{}',
  device_info             JSONB         NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- A child may have only one active session at a time (GAME-FR-001 Business Rule)
CREATE UNIQUE INDEX sessions_one_active_per_child
  ON sessions (child_id)
  WHERE status IN ('active', 'paused');

-- ─── feature_vectors ───────────────────────────────────────────────────────────
-- SRS §7.1: vector_id, session_id, feature_json, normalized_json
-- CON-PRIV-001: raw events never stored; only the derived feature vector.
-- GAME-FR-010: 200+ dimensional; null-flagged for missing games (not zeroed).

CREATE TABLE feature_vectors (
  vector_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,
  age_months      INTEGER     NOT NULL CHECK (age_months BETWEEN 48 AND 120), -- 4-10 yrs
  feature_json    JSONB       NOT NULL,    -- raw extracted features (pre-normalization)
  normalized_json JSONB       NOT NULL,    -- z-score normalized (GAME-FR-011)
  missing_games   game_id[]   NOT NULL DEFAULT '{}', -- null-flagged games (GAME-FR-010)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── predictions ───────────────────────────────────────────────────────────────
-- SRS §7.1: prediction_id, session_id, condition, risk_score, confidence
-- SRS §8.2: one row per condition; sigmoid outputs; Monte Carlo dropout confidence
-- SRS §8.5: SHAP top features per prediction

CREATE TABLE predictions (
  prediction_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  model_version   TEXT        NOT NULL,  -- traceability (SRS §8.3: every model versioned)
  condition       ld_condition NOT NULL,
  risk_score      NUMERIC(5,4) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
  confidence      NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  -- SRS §8.5: SHAP top contributing features
  shap_top_features JSONB     NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One prediction row per condition per session
  CONSTRAINT predictions_unique_condition UNIQUE (session_id, condition)
);

-- ─── reports ───────────────────────────────────────────────────────────────────
-- SRS §7.1: report_id, session_id, pdf_url, generated_at
-- CON-REG-004: disclaimer_included must be TRUE for every report
-- SRS §7.4: retained until parent deletion or 3 years

CREATE TABLE reports (
  report_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,
  pdf_url             TEXT        NOT NULL, -- S3 key (signed URL generated on-demand)
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_method   TEXT        NOT NULL CHECK (generation_method IN ('gemini', 'template')),
  language            language_code NOT NULL,
  -- CON-REG-004: every report must include the screening disclaimer
  disclaimer_included BOOLEAN     NOT NULL DEFAULT TRUE
                        CHECK (disclaimer_included = TRUE)
);

-- ─── consents ──────────────────────────────────────────────────────────────────
-- SRS §7.1: consent_id, parent_id, child_id, consent_type, granted_at, version
-- PRIV-NFR-002: versioned, re-confirmable
-- CON-REG-001: multi-language consent form

CREATE TABLE consents (
  consent_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  child_id            UUID        NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,
  consent_type        consent_type NOT NULL,
  granted             BOOLEAN     NOT NULL,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version             TEXT        NOT NULL, -- e.g. '1.0'
  presented_language  language_code NOT NULL,
  irb_reference       TEXT,               -- required for research_data_collection (CON-REG-003)
  -- Only parents can grant consent (AUTH-FR-004)
  CONSTRAINT consents_parent_role CHECK (
    (SELECT role FROM users WHERE user_id = parent_id) = 'parent'
  ),
  -- IRB reference required for research consent (CON-REG-003)
  CONSTRAINT consents_research_needs_irb CHECK (
    consent_type != 'research_data_collection' OR irb_reference IS NOT NULL
  )
);

-- Latest consent per child per type (for efficient lookups)
CREATE INDEX consents_child_type_idx ON consents (child_id, consent_type, granted_at DESC);

-- ─── audit_logs ────────────────────────────────────────────────────────────────
-- SRS §7.1: log_id, actor_id, action, target_id, timestamp
-- SEC-NFR-006: immutable; CON-PRIV-005: admin access logged
-- SRS §7.4: retained 7 years; actor anonymized after account deletion

CREATE TABLE audit_logs (
  log_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'DELETED_USER' after account erasure (AUTH-FR-005)
  actor_id    TEXT        NOT NULL,
  actor_role  user_role   NOT NULL,
  action      audit_action NOT NULL,
  target_type TEXT        NOT NULL
                CHECK (target_type IN ('user','child','session','report','consent','model','export')),
  target_id   TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs are append-only; revoke UPDATE/DELETE from app user in production
-- (enforced via IAM/Postgres roles; documented in deployment guide)
CREATE INDEX audit_logs_actor_idx   ON audit_logs (actor_id);
CREATE INDEX audit_logs_target_idx  ON audit_logs (target_id);
CREATE INDEX audit_logs_timestamp_idx ON audit_logs (timestamp DESC);

-- ─── OTP tracking (not in SRS §7.1 schema table but required by AUTH-FR-001/002)
-- Transient table; rows expire after OTP_EXPIRY_SECONDS (300s)

CREATE TABLE otp_codes (
  otp_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  CITEXT      NOT NULL,
  code_hash     TEXT        NOT NULL,  -- bcrypt hash of the 6-digit code
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX otp_codes_phone_idx ON otp_codes (phone_number, expires_at DESC);

-- OTP resend rate-limit tracking
CREATE TABLE otp_resend_log (
  id            BIGSERIAL   PRIMARY KEY,
  phone_number  CITEXT      NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX otp_resend_log_phone_idx ON otp_resend_log (phone_number, sent_at DESC);

-- ─── Normative data (GAME-FR-011) ──────────────────────────────────────────────
-- Age-specific norms for z-score normalization.
-- Tabulated at 0.5-year increments (6-month bands) per SRS GAME-FR-011.

CREATE TABLE normative_data (
  norm_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name  TEXT        NOT NULL,
  -- Age band: age_months_min (inclusive) to age_months_max (exclusive)
  -- 0.5-year increments → 48-54, 54-60, 60-66, ..., 114-120
  age_months_min INTEGER     NOT NULL,
  age_months_max INTEGER     NOT NULL,
  mean          NUMERIC(10,4) NOT NULL,
  std_dev       NUMERIC(10,4) NOT NULL CHECK (std_dev > 0),
  sample_size   INTEGER       NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT normative_age_valid CHECK (age_months_min < age_months_max),
  CONSTRAINT normative_unique UNIQUE (feature_name, age_months_min, age_months_max)
);

-- ─── Indexes for common query patterns ─────────────────────────────────────────

CREATE INDEX sessions_child_id_idx    ON sessions (child_id);
CREATE INDEX sessions_status_idx      ON sessions (status);
CREATE INDEX predictions_session_idx  ON predictions (session_id);
CREATE INDEX children_parent_id_idx   ON children (parent_id);
CREATE INDEX children_teacher_id_idx  ON children (teacher_id);
CREATE INDEX children_school_id_idx   ON children (school_id);
