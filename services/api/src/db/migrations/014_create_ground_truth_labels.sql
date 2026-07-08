-- Migration 014: Create ground_truth_labels table
-- Traceability: ML-TRAIN-001, CON-SCI-003/004, SRS §8.3
-- Stores clinical/annotator ground-truth labels for the pilot dataset.
-- CON-REG-003: Only populated for sessions with research consent.
-- CON-SCI-004: Labels require inter-annotator Cohen's Kappa >= 0.75.

CREATE TABLE ground_truth_labels (
    label_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL UNIQUE REFERENCES sessions(session_id) ON DELETE CASCADE,

    -- Multi-label binary ground truth (6 conditions, SRS §8.2/8.3)
    -- JSONB: {condition_name: 0|1, ...}
    labels          JSONB       NOT NULL,

    -- Source and inter-rater reliability tracking
    annotator_1_id  UUID,                   -- FK to users (EAII admin role)
    annotator_2_id  UUID,
    kappa_score     NUMERIC(4,3),           -- Cohen's Kappa (target >=0.75, CON-SCI-004)

    -- Clinical validation source (e.g., checklist name, psychologist ID)
    validation_source TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gtl_session ON ground_truth_labels (session_id);

CREATE TRIGGER ground_truth_labels_updated_at
    BEFORE UPDATE ON ground_truth_labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE ground_truth_labels IS 'Clinical ground-truth for ML training — SRS §8.3, CON-SCI-003/004';
COMMENT ON COLUMN ground_truth_labels.kappa_score IS 'Inter-rater Cohen Kappa; must be >=0.75 to use for training (CON-SCI-004)';
