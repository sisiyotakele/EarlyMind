/**
 * Sessions Service — GAME-FR-001 through GAME-FR-004
 *
 * Business rules implemented:
 *   GAME-FR-001: session init — UUID, child_id, timestamp, language, device_info,
 *                mirrors state to LocalStorage (client-side); one active session
 *                per child at a time
 *   GAME-FR-002: game sequencing — fixed order, 7 games
 *   GAME-FR-003: pause/resume — pause excluded from duration; max 3 pauses;
 *                sessions expire after 7 days
 *   GAME-FR-004: session completion — all 7 games must finish; incomplete sessions
 *                excluded from inference
 *
 * Traceability: GAME-FR-001–004, SRS §7.1 (sessions table)
 */
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';
import { GAME_SEQUENCE } from '@earlymind/shared-types';
import type {
    CreateSessionRequest,
    SessionResponse,
    UpdateSessionRequest,
} from '@earlymind/shared-types';

// ─── GAME-FR-001: Session Initialization ─────────────────────────────────────

export async function createSession(
    administeredBy: string,
    req: CreateSessionRequest,
): Promise<SessionResponse> {
    // Verify child exists and the requesting user has access
    const child = await queryOne<{ child_id: string; parent_id: string | null; teacher_id: string | null }>(
        `SELECT child_id, parent_id, teacher_id FROM children WHERE child_id = $1`,
        [req.child_id],
    );

    if (!child) {
        throw new AppError(404, 'CHILD_NOT_FOUND', 'Child profile not found');
    }

    // Access control: only the child's parent or teacher can start a session
    if (child.parent_id !== administeredBy && child.teacher_id !== administeredBy) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this child profile');
    }

    // GAME-FR-001 Business Rule: a child may have only one active session at a time
    // The DB unique partial index (sessions_one_active_per_child) enforces this too;
    // this check gives a better error message.
    const existing = await queryOne<{ session_id: string; status: string }>(
        `SELECT session_id, status FROM sessions
     WHERE child_id = $1 AND status IN ('active', 'paused')`,
        [req.child_id],
    );

    if (existing) {
        throw new AppError(
            409,
            'SESSION_ALREADY_ACTIVE',
            `Child already has an ${existing.status} session (${existing.session_id}). Resume or restart it first.`,
        );
    }

    const sessionId = uuidv4();

    await query(
        `INSERT INTO sessions
       (session_id, child_id, administered_by, language, status,
        current_game_index, games_completed, device_info)
     VALUES ($1, $2, $3, $4, 'active', 0, '{}', $5)`,
        [sessionId, req.child_id, administeredBy, req.language, JSON.stringify(req.device_info)],
    );

    // Write audit log — SRS §6.2 SEC-NFR-006
    await query(
        `INSERT INTO audit_logs (log_id, actor_id, actor_role, action, target_type, target_id, metadata)
     VALUES ($1, $2, (SELECT role FROM users WHERE user_id = $2), 'session.start', 'session', $3, $4)`,
        [uuidv4(), administeredBy, sessionId, JSON.stringify({ child_id: req.child_id })],
    );

    return {
        session_id: sessionId,
        child_id: req.child_id,
        language: req.language,
        status: 'active',
        current_game_index: 0,
        games_completed: [],
        start_time: new Date().toISOString(),
        pause_count: 0,
    };
}

// ─── GAME-FR-003/004: Update session (pause/resume/complete/abandon) ──────────

export async function updateSession(
    sessionId: string,
    userId: string,
    req: UpdateSessionRequest,
): Promise<SessionResponse> {
    const session = await queryOne<{
        session_id: string;
        child_id: string;
        administered_by: string;
        language: string;
        status: string;
        start_time: Date;
        pause_count: number;
        current_game_index: number;
        games_completed: string[];
    }>(
        `SELECT session_id, child_id, administered_by, language, status, start_time,
            pause_count, current_game_index, games_completed
     FROM sessions WHERE session_id = $1`,
        [sessionId],
    );

    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    if (session.administered_by !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'You did not start this session');
    }

    let newStatus = session.status;
    let newPauseCount = session.pause_count;
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    let auditAction = '';

    switch (req.action) {
        case 'pause':
            if (session.status !== 'active') {
                throw new AppError(409, 'INVALID_STATE', 'Session is not active');
            }
            // GAME-FR-003: max 3 pauses per session
            if (session.pause_count >= 3) {
                throw new AppError(422, 'MAX_PAUSES_REACHED', 'Maximum 3 pauses per session');
            }
            newStatus = 'paused';
            newPauseCount = session.pause_count + 1;
            updates.push(`status = $${idx++}`, `pause_count = $${idx++}`);
            values.push(newStatus, newPauseCount);
            auditAction = 'session.pause';
            break;

        case 'resume':
            if (session.status !== 'paused') {
                throw new AppError(409, 'INVALID_STATE', 'Session is not paused');
            }
            newStatus = 'active';
            updates.push(`status = $${idx++}`);
            values.push(newStatus);
            auditAction = 'session.resume';
            break;

        case 'complete':
            // GAME-FR-004: only complete if all 7 games finished
            if ((req.games_completed ?? session.games_completed).length < GAME_SEQUENCE.length) {
                throw new AppError(422, 'INCOMPLETE_GAMES', 'All 7 games must be completed');
            }
            newStatus = 'completed';
            updates.push(`status = $${idx++}`, `end_time = NOW()`,
                `games_completed = $${idx++}::game_id[]`);
            values.push(newStatus, req.games_completed ?? session.games_completed);
            auditAction = 'session.complete';
            break;

        case 'abandon':
            // GAME-FR-004: incomplete sessions excluded from inference
            newStatus = 'incomplete';
            updates.push(`status = $${idx++}`, `end_time = NOW()`);
            values.push(newStatus);
            auditAction = 'session.abandon';
            break;
    }

    // Update game progress if provided
    if (req.current_game_index !== undefined) {
        updates.push(`current_game_index = $${idx++}`);
        values.push(req.current_game_index);
    }

    values.push(sessionId);
    await query(
        `UPDATE sessions SET ${updates.join(', ')} WHERE session_id = $${idx}`,
        values,
    );

    await query(
        `INSERT INTO audit_logs (log_id, actor_id, actor_role, action, target_type, target_id, metadata)
     VALUES ($1, $2, (SELECT role FROM users WHERE user_id = $2), $3, 'session', $4, $5)`,
        [uuidv4(), userId, auditAction, sessionId, JSON.stringify({})],
    );

    return {
        session_id: sessionId,
        child_id: session.child_id,
        language: session.language as never,
        status: newStatus as never,
        current_game_index: req.current_game_index ?? session.current_game_index,
        games_completed: (req.games_completed ?? session.games_completed) as never[],
        start_time: session.start_time.toISOString(),
        pause_count: newPauseCount,
    };
}

/** Get session by ID (for client-side resume — GAME-FR-001/003) */
export async function getSession(
    sessionId: string,
    userId: string,
): Promise<SessionResponse> {
    const session = await queryOne<{
        session_id: string;
        child_id: string;
        administered_by: string;
        language: string;
        status: string;
        start_time: Date;
        pause_count: number;
        current_game_index: number;
        games_completed: string[];
    }>(
        `SELECT session_id, child_id, administered_by, language, status, start_time,
            pause_count, current_game_index, games_completed
     FROM sessions WHERE session_id = $1`,
        [sessionId],
    );

    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
    if (session.administered_by !== userId) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this session');
    }

    return {
        session_id: session.session_id,
        child_id: session.child_id,
        language: session.language as never,
        status: session.status as never,
        current_game_index: session.current_game_index,
        games_completed: session.games_completed as never[],
        start_time: session.start_time.toISOString(),
        pause_count: session.pause_count,
    };
}
