-- Migration 012: Create user_sessions table
-- Traceability: AUTH-FR-002, AUTH-NFR-001
-- Sessions tracked in DB (not stateless JWT) to allow revocation on logout/deletion (AUTH-FR-005)

CREATE TABLE user_sessions (
    session_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- AUTH-NFR-001: >=128-bit entropy; stored as SHA-256 hash (never raw token)
    token_hash      TEXT        NOT NULL UNIQUE,

    -- AUTH-FR-002: expires after 7 days inactivity
    expires_at      TIMESTAMPTZ NOT NULL,

    -- Metadata for security auditing
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions (expires_at);

-- Periodic cleanup job: delete expired sessions (run nightly via cron/pg_cron)
COMMENT ON TABLE user_sessions IS 'Auth session tokens — AUTH-FR-002, AUTH-NFR-001';
COMMENT ON COLUMN user_sessions.token_hash IS 'SHA-256 of the raw session token (never store raw)';
