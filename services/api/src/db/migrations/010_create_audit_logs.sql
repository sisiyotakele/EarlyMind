-- Migration 010: Create audit_logs table
-- Traceability: DB-SCHEMA-009, SEC-NFR-006, CON-PRIV-005, DR-009 (SRS Section 7.1)
-- Audit logs are immutable (no UPDATE/DELETE on this table — enforced by app logic)
-- Retention: 7 years (Section 7.4); actor_id anonymized on account deletion (AUTH-FR-005)

CREATE TABLE audit_logs (
    log_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who performed the action (anonymized to a placeholder UUID on account deletion)
    actor_id        UUID        NOT NULL,   -- NOT a FK: allows anonymized actor after deletion
    actor_role      user_role   NOT NULL,

    -- What action was performed
    action          TEXT        NOT NULL,   -- e.g., 'view_child_data', 'delete_account', 'export_data'

    -- What entity was affected
    target_type     TEXT,                   -- e.g., 'child', 'session', 'report', 'model'
    target_id       UUID,                   -- FK-like (not enforced as FK to allow deletion of targets)

    -- Additional context (IP, UA, request details)
    metadata        JSONB,
    ip_address      INET,
    user_agent      TEXT,

    -- Immutable timestamp
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent accidental row modification
    CONSTRAINT audit_logs_no_update CHECK (TRUE) -- enforced via permissions/trigger below
);

-- Create a rule that prevents UPDATE and DELETE on audit_logs (immutable log)
CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- Indexes for audit log queries (DASH-EAII-004: Audit Log Page)
CREATE INDEX idx_audit_logs_actor ON audit_logs (actor_id, timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, timestamp);
CREATE INDEX idx_audit_logs_target ON audit_logs (target_id, target_type) WHERE target_id IS NOT NULL;
CREATE INDEX idx_audit_logs_timestamp ON audit_logs (timestamp);

COMMENT ON TABLE audit_logs IS 'Administrative action trail — DR-009 (SRS Section 7.1)';
COMMENT ON COLUMN audit_logs.actor_id IS 'Anonymized UUID after account deletion (AUTH-FR-005)';
COMMENT ON COLUMN audit_logs.timestamp IS 'Immutable; no UPDATE/DELETE permitted (SEC-NFR-006)';
