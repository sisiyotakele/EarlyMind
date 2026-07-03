-- Migration 011: Create normative_data table
-- Traceability: GAME-FR-011 (age-based normalization)
-- Stores mean and std_dev per feature per age band (0.5-year increments, 48-132 months)
-- Used client-side via /api/normative endpoint and ML service

CREATE TABLE normative_data (
    norm_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- GAME-FR-011: 0.5-year increments from 48 (4.0y) to 132 (11.0y) months
    age_months_min  SMALLINT    NOT NULL CHECK (age_months_min >= 48 AND age_months_min < 132),
    age_months_max  SMALLINT    NOT NULL CHECK (age_months_max > 48  AND age_months_max <= 132),

    -- Feature name (matches key in feature_vectors.features JSONB)
    feature_name    TEXT        NOT NULL,

    -- z-score parameters: z = (value - mean) / std_dev (GAME-FR-011)
    mean            NUMERIC(10,4) NOT NULL,
    std_dev         NUMERIC(10,4) NOT NULL CHECK (std_dev > 0),

    -- Sample size used to compute these norms
    sample_size     SMALLINT    NOT NULL DEFAULT 0,

    -- Flag: if FALSE, feature is left unnormalized with a flag (GAME-FR-011)
    is_available    BOOLEAN     NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_norm_age_feature UNIQUE (age_months_min, feature_name)
);

CREATE INDEX idx_normative_feature ON normative_data (feature_name, age_months_min, age_months_max);

CREATE TRIGGER normative_data_updated_at
    BEFORE UPDATE ON normative_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE normative_data IS 'Age-specific norms for z-score normalization (GAME-FR-011)';
COMMENT ON COLUMN normative_data.age_months_min IS '0.5-year increment lower bound';
COMMENT ON COLUMN normative_data.is_available IS 'FALSE = feature norms not yet available; flag without zeroing (GAME-FR-011)';
