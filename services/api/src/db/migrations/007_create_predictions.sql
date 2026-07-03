-- Migration 007: Create predictions table
-- Traceability: DB-SCHEMA-006, ML-FR-001, DR-006 (SRS Section 7.1)

CREATE TYPE learning_condition AS ENUM (
    'dyslexia',
    'dyscalculia',
    'adhd_inattentive',
    'adhd_hyperactive_impulsive',
    'working_memory_deficit',
    'processing_speed_deficit'
);

CREATE TABLE predictions (
    prediction_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,

    -- Model version for traceability (Section 8.3: "every trained model is versioned")
    model_version       TEXT        NOT NULL,

    -- Multi-label predictions (Section 8.2): one row per session, all 6 conditions as JSONB array
    -- Each element: { condition, risk_score, confidence, shap_top_features[] }
    predictions         JSONB       NOT NULL,

    inference_timestamp TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_predictions_session ON predictions (session_id);

-- Allow querying predictions by model version for research export (DASH-EAII-003)
CREATE INDEX idx_predictions_model_version ON predictions (model_version);

COMMENT ON TABLE predictions IS 'ML inference results — DR-006 (SRS Section 7.1)';
COMMENT ON COLUMN predictions.predictions IS 'JSON array of ConditionPrediction (6 conditions, Section 8.2)';
COMMENT ON COLUMN predictions.model_version IS 'Model version string for traceability to reports (Section 8.3)';
