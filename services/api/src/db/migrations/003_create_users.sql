-- Migration 003: Create users table
-- Traceability: DB-SCHEMA-001, AUTH-FR-001/002/003/004, AUTH-NFR-001
-- DR-001 (SRS Section 7.1)

CREATE TYPE user_role AS ENUM ('parent', 'teacher', 'school_admin', 'eaii_admin');
CREATE TYPE app_language AS ENUM ('am', 'om', 'ti');  -- Amharic, Oromo, Tigrinya (CON-TECH-004)

CREATE TABLE users (
    user_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- AUTH-FR-001: phone number is the unique login identifier (CON-TECH-003: no email)
    phone_number        TEXT        NOT NULL UNIQUE,

    -- AUTH-FR-004: role fixed at registration
    role                user_role   NOT NULL,

    -- AUTH-FR-003: language preference
    language            app_language NOT NULL DEFAULT 'am',

    -- AUTH-NFR-001: 4-digit PIN hashed with bcrypt cost>=12
    pin_hash            TEXT,         -- NULL until PIN is set during registration verify step

    name                TEXT,

    -- School affiliation (required for teacher/school_admin, NULL for parent/eaii_admin)
    school_id           UUID        REFERENCES schools(school_id) ON DELETE SET NULL,

    -- AUTH-FR-002: PIN lockout after 3 failed attempts
    failed_pin_attempts SMALLINT    NOT NULL DEFAULT 0 CHECK (failed_pin_attempts >= 0),
    lockout_until       TIMESTAMPTZ,                      -- NULL = not locked

    -- AUTH-FR-002: max 3 OTP requests/hour
    otp_request_count   SMALLINT    NOT NULL DEFAULT 0,
    last_otp_window_start TIMESTAMPTZ,                    -- when current hourly window started

    -- AUTH-FR-001: pending OTP during registration / login
    -- stored as bcrypt hash (not plaintext) — expires after 5 min
    otp_hash            TEXT,
    otp_expires_at      TIMESTAMPTZ,

    -- AUTH-FR-002: session expiry (7 days inactivity)
    last_active_at      TIMESTAMPTZ,

    -- Soft-delete: account deleted? (AUTH-FR-005 — cascades via application logic)
    deleted_at          TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookup patterns
CREATE INDEX idx_users_phone ON users (phone_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_school ON users (school_id) WHERE school_id IS NOT NULL;

-- Trigger: updated_at
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add admin_id FK back to schools now that users table exists
ALTER TABLE schools
    ADD COLUMN admin_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

COMMENT ON TABLE users IS 'Parent/Teacher/Admin accounts — DR-001 (SRS Section 7.1)';
COMMENT ON COLUMN users.pin_hash IS 'bcrypt(pin, cost=12) per AUTH-NFR-001';
COMMENT ON COLUMN users.phone_number IS '+251XXXXXXXXX format; unique per AUTH-FR-001';
