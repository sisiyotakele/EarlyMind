-- Migration 002: Create schools table
-- Traceability: DB-SCHEMA-003, SRS Section 7.1 (schools)

CREATE TABLE schools (
    school_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    region      TEXT        NOT NULL,       -- Ethiopian administrative region
    woreda      TEXT,                        -- sub-region
    -- admin_id added via FK after users table is created (migration 003)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schools_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE schools IS 'School records — DR-003 (SRS Section 7.1)';
