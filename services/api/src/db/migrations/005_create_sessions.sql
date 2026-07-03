-- Migration 005: Create sessions table
-- Traceability: DB-SCHEMA-004, GAME-FR-001/002/003/004, DR-004 (SRS Section 7.1)

CREATE TYPE session_status AS ENUM ('active', 'paused', 'completed', 'incomplete');

CREATE TABLE sessions (
    session_id      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id        UUID            NOT NULL REFERENCES children(child_id) ON DELETE CASCADE,

    -- GAME-FR-001: start_time when session begins
    start_time      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- GAME-FR-004: end_time when session completes or is abandoned
    end_time        TIMESTAMPTZ,

    -- GAME-FR-003: pause/resume tracking
    status          session_status  NOT NULL DEFAULT 'active',

    -- GAME-FR-001: language selected for this session (can differ from child's default)
    language        app_language    NOT NULL,

    -- GAME-FR-009: device info captured at session start (JSON string)
    device_info     TEXT,           -- {browser, os, screen_size, ...}

    -- GAME-FR-003: max 3 pauses per session
    pause_count     SMALLINT        NOT NULL DEFAULT 0 CHECK (pause_count <= 3),
    paused_at       TIMESTAMPTZ,
    resumed_at      TIMESTAMPTZ,

    -- GAME-FR-002: game sequencing — current position (0-6 for 7 games)
    current_game_index SMALLINT     NOT NULL DEFAULT 0 CHECK (current_game_index >= 0 AND current_game_index < 7),

    -- GAME-FR-003/004: total duration excludes pause time (calculated on complete)
    total_duration_ms BIGINT,       -- NULL until completed

    -- Completion rate: fraction of games completed (0-1)
    completion_rate NUMERIC(3,2),   -- NULL until end; e.g., 1.00 = all 7 games done

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Business rule: one active session per child at a time (GAME-FR-001)
    CONSTRAINT uq_child_active_session UNIQUE (child_id) WHERE (status IN ('active', 'paused'))
);

-- Lookup all sessions for a child
CREATE INDEX idx_sessions_child ON sessions (child_id);
-- Quick check for incomplete sessions
CREATE INDEX idx_sessions_status ON sessions (status, created_at);

CREATE TRIGGER sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE sessions IS 'Assessment sessions — DR-004 (SRS Section 7.1)';
COMMENT ON COLUMN sessions.total_duration_ms IS 'Excludes pause time per GAME-FR-003';
COMMENT ON CONSTRAINT uq_child_active_session ON sessions IS 'One active/paused session per child per GAME-FR-001';
