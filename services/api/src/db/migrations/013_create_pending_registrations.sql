-- Migration 013: Create pending_registrations table
-- Traceability: AUTH-FR-001 (phone+OTP registration flow)
-- Stores hashed OTP during the registration flow before the user record is fully created.
-- Cleaned up after OTP verified or expiry.

CREATE TABLE pending_registrations (
    phone_number    TEXT        PRIMARY KEY,
    otp_hash        TEXT        NOT NULL,   -- bcrypt hash of 6-digit OTP
    otp_expires_at  TIMESTAMPTZ NOT NULL,   -- AUTH-FR-001: 5-minute validity
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial data: role, language, name held until OTP is verified
-- Stored as JSONB to keep schema simple
ALTER TABLE pending_registrations
    ADD COLUMN registration_data JSONB;  -- {role, language, name, school_id?}

CREATE INDEX idx_pending_reg_expires ON pending_registrations (otp_expires_at);

COMMENT ON TABLE pending_registrations IS 'Pre-registration OTP store — AUTH-FR-001';
COMMENT ON COLUMN pending_registrations.otp_hash IS 'bcrypt hashed OTP; raw OTP never stored';
