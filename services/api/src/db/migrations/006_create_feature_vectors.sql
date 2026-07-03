-- Migration 006: Create feature_vectors table
-- Traceability: DB-SCHEMA-005, GAME-FR-010/011, DR-005 (SRS Section 7.1)
-- CON-PRIV-001: only feature vectors stored server-side; raw events stay on device

CREATE TABLE feature_vectors (
    vector_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,

    -- GAME-FR-011: child's age in months at session time (for normalization traceability)
    age_months              SMALLINT    NOT NULL CHECK (age_months >= 48 AND age_months <= 132), -- 4-11 years

    -- GAME-FR-010: raw 200+ dimensional feature vector (JSONB for efficient querying)
    -- Keys match the ExtractedFeatures schema in packages/shared-types/src/game-types.ts
    features                JSONB       NOT NULL,

    -- GAME-FR-011: z-score normalized features; null values where norms unavailable
    normalized_features     JSONB       NOT NULL,

    -- Client-side extraction timestamp (performance.now()-relative, converted to epoch)
    extraction_timestamp    TIMESTAMPTZ NOT NULL,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIN index enables fast JSONB key-value queries (e.g., research export queries)
CREATE INDEX idx_feature_vectors_features ON feature_vectors USING gin(features);
CREATE INDEX idx_feature_vectors_session ON feature_vectors (session_id);

COMMENT ON TABLE feature_vectors IS 'Extracted behavioral features — DR-005 (SRS Section 7.1)';
COMMENT ON COLUMN feature_vectors.features IS '200+ dimensional feature vector per GAME-FR-010';
COMMENT ON COLUMN feature_vectors.normalized_features IS 'z-score normalized per GAME-FR-011; null = norms unavailable';
COMMENT ON COLUMN feature_vectors.age_months IS '4-11 years range (SRS 1.4.2); used for normalization validation';
