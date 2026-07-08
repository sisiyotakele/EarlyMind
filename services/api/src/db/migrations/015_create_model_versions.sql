-- Migration 015: Model versions table + app_settings
-- Traceability: DASH-EAII-002, SRS §8.3 (versioned model, traceable to reports)

CREATE TABLE model_versions (
    version         TEXT        PRIMARY KEY,
    s3_key          TEXT        NOT NULL,
    metrics         JSONB       NOT NULL DEFAULT '{}',
    is_active       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by      UUID        REFERENCES users(user_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE model_versions IS 'ML model versions — SRS §8.3 (versioned + traceable)';
COMMENT ON COLUMN model_versions.metrics IS 'Evaluation metrics per condition (sensitivity, specificity, AUC per SRS §8.4)';

-- Only one active model at a time
CREATE UNIQUE INDEX idx_model_versions_active ON model_versions (is_active) WHERE is_active = TRUE;

-- General application settings (e.g., active_model_version)
CREATE TABLE app_settings (
    settings_key    TEXT        PRIMARY KEY,
    settings_value  TEXT        NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (settings_key, settings_value) VALUES ('active_model_version', 'v0.1.0');

COMMENT ON TABLE app_settings IS 'Application-wide configuration settings';
