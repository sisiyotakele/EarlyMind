-- Migration 009: Create consents table
-- Traceability: DB-SCHEMA-008, CON-REG-001, CON-PRIV-001/003/004, DR-008 (SRS Section 7.1)
-- PRIV-NFR-002: consent versioned and re-confirmable at any time

CREATE TYPE consent_type AS ENUM ('assessment', 'research_data', 'data_sharing');

CREATE TABLE consents (
    consent_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent who grants/revokes consent (AUTH-FR-005: cascades on account deletion)
    parent_id       UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- The specific child this consent covers
    child_id        UUID        NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,

    -- Type of consent being recorded
    consent_type    consent_type NOT NULL,

    -- Current state: TRUE = granted, FALSE = revoked
    granted         BOOLEAN     NOT NULL,

    -- CON-REG-001: consent form version (allows re-consent when form changes)
    version         TEXT        NOT NULL,

    granted_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One active consent record per parent/child/type combination
    CONSTRAINT uq_consent_parent_child_type UNIQUE (parent_id, child_id, consent_type)
);

-- Fast lookup: what has this parent consented to for all their children?
CREATE INDEX idx_consents_parent ON consents (parent_id);
CREATE INDEX idx_consents_child ON consents (child_id);

-- Fast lookup: has research data consent been granted? (CON-PRIV-001 check)
CREATE INDEX idx_consents_type_granted ON consents (consent_type, granted);

CREATE TRIGGER consents_updated_at
    BEFORE UPDATE ON consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE consents IS 'Consent records — DR-008 (SRS Section 7.1)';
COMMENT ON COLUMN consents.version IS 'Consent form version; triggers re-consent when updated (PRIV-NFR-002)';
