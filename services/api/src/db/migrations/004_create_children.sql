-- Migration 004: Create children table
-- Traceability: DB-SCHEMA-002, GAME-FR-001, DR-002 (SRS Section 7.1)

CREATE TABLE children (
    child_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner: parent who created the profile (AUTH-FR-005: deletion cascades from this user)
    parent_id   UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    -- Optional: teacher who screens this child
    teacher_id  UUID        REFERENCES users(user_id) ON DELETE SET NULL,

    name        TEXT        NOT NULL,

    -- date_of_birth used to compute age_months for GAME-FR-011 normalization
    date_of_birth DATE      NOT NULL,

    -- GAME-FR-001: language for child's sessions (can differ from parent's)
    language    app_language NOT NULL DEFAULT 'am',

    grade_level TEXT,       -- "KG", "Grade 1", ... "Grade 4" etc.
    notes       TEXT,       -- teacher/parent freetext notes

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ages outside 4-10 not supported (SRS Section 1.4.2)
    CONSTRAINT chk_children_age CHECK (
        -- DOB must produce age 4-10 at time of insert (approximate — enforced more precisely in app)
        date_of_birth >= (CURRENT_DATE - INTERVAL '10 years 6 months') AND
        date_of_birth <= (CURRENT_DATE - INTERVAL '3 years 6 months')
    )
);

-- Fast lookup of all children for a parent or teacher
CREATE INDEX idx_children_parent ON children (parent_id);
CREATE INDEX idx_children_teacher ON children (teacher_id) WHERE teacher_id IS NOT NULL;

CREATE TRIGGER children_updated_at
    BEFORE UPDATE ON children
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE children IS 'Child profiles — DR-002 (SRS Section 7.1)';
COMMENT ON COLUMN children.date_of_birth IS 'Used for age normalization in GAME-FR-011; ages 4-10 only (SRS 1.4.2)';
