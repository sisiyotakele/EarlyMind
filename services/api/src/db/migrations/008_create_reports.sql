-- Migration 008: Create reports table
-- Traceability: DB-SCHEMA-007, REPORT-FR-001, DR-007 (SRS Section 7.1)
-- CON-REG-004: disclaimer embedded in every report

CREATE TABLE reports (
    report_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,

    -- Private S3 URL (signed URL generated on request, not stored directly)
    pdf_s3_key              TEXT,       -- S3 object key (not the signed URL itself)

    -- Amharic plain-language report text (REPORT-FR-001: Gemini or template fallback)
    report_text_amharic     TEXT,

    -- Teacher accommodation recommendations as JSONB array of strings
    recommendations         JSONB,

    -- Whether IERC referral is indicated
    referral_suggested      BOOLEAN     NOT NULL DEFAULT FALSE,

    -- CON-REG-004: disclaimer must be present in every report
    -- Enforced at application layer; this column stores the version of disclaimer included
    disclaimer_version      TEXT        NOT NULL DEFAULT 'v1',

    -- Generation status for async report generation
    generation_status       TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    generation_error        TEXT,       -- error message if failed

    generated_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_session ON reports (session_id);
CREATE INDEX idx_reports_status ON reports (generation_status);

CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE reports IS 'Generated reports — DR-007 (SRS Section 7.1)';
COMMENT ON COLUMN reports.pdf_s3_key IS 'S3 object key; signed URL generated per-request (private bucket)';
COMMENT ON COLUMN reports.disclaimer_version IS 'CON-REG-004: every report states "screening not diagnosis"';
