/**
 * Sessions Service — server-side session lifecycle logic
 * Traceability: GAME-FR-001, GAME-FR-003, GAME-FR-004, GAME-FR-010
 */

import { z } from 'zod';

import type {
    Language,
    SessionResponse,
    UploadFeatureVectorRequest,
    FeatureVectorResponse,
} from '@earlymind/shared-types';

import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';
import { mlServiceClient } from '../../integrations/mlServiceClient';

const PAUSED_SESSION_EXPIRY_DAYS = 7; // GAME-FR-003

// ─── Validation schemas ────────────────────────────────────────────────────────

export const startSessionSchema = z.object({
    child_id: z.string().uuid(),
    language: z.enum(['am', 'om', 'ti'] as const satisfies readonly Language[]),
    /** Client-generated UUID (mirrors LocalStorage state — GAME-FR-001) */
    session_id: z.string().uuid().optional(),
});

export const updateSessionSchema = z.object({
    action: z.enum(['pause', 'resume', 'complete', 'abandon']),
    total_duration_ms: z.number().int().positive().optional(),
    completion_rate: z.number().min(0).max(1).optional(),
});

export const featureVectorSchema = z.object({
    age_months: z.number().int().min(48).max(132), // 4-11 years (GAME-FR-011)
    features: z.record(z.string(), z.number()),
    normalized_features: z.record(z.string(), z.number().nullable()),
    extraction_timestamp: z.string().datetime(),
});

// ─── Service methods ───────────────────────────────────────────────────────────

/**
 * Start a new assessment session (GAME-FR-001).
 * Business rule: "a child may have only one active (incomplete) session at a time"
 */
export async function startSession(
    childId: string,
    language: Language,
    requestingUserId: string,
    clientSessionId?: string,
): Promise<SessionResponse> {
    // Verify child belongs to requesting user (parent or teacher)
    const { rows: childRows } = await db.query<{ child_id: string; parent_id: string; teacher_id: string | null }>(
        `SELECT child_id, parent_id, teacher_id FROM children WHERE child_id = $1`,
        [childId],
    );
    const child = childRows[0];
    if (!child) throw new AppError(404, 'CHILD_NOT_FOUND', 'Child profile not found.');

    const isOwner = child.parent_id === requestingUserId || child.teacher_id === requestingUserId;
    if (!isOwner) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this child profile.');

    // GAME-FR-001 business rule: one active session per child
    const { rows: activeRows } = await db.query<{ session_id: string }>(
        `SELECT session_id FROM sessions
     WHERE child_id = $1 AND status IN ('active', 'paused')`,
        [childId],
    );

    if (activeRows.length > 0 && activeRows[0]) {
        throw new AppError(409, 'SESSION_ALREADY_ACTIVE', 'Child already has an active session.', {
            existing_session_id: activeRows[0].session_id,
        });
    }

    // Create the session record
    const { rows } = await db.query<{
        session_id: string;
        child_id: string;
        language: string;
        status: string;
        current_game_index: number;
        start_time: Date;
    }>(
        `INSERT INTO sessions
       (session_id, child_id, language, status, current_game_index)
     VALUES
       (COALESCE($1, gen_random_uuid()), $2, $3, 'active', 0)
     RETURNING session_id, child_id, language, status, current_game_index, start_time`,
        [clientSessionId ?? null, childId, language],
    );

    const session = rows[0];
    if (!session) throw new AppError(500, 'SESSION_CREATE_FAILED', 'Failed to create session.');

    return {
        session_id: session.session_id,
        child_id: session.child_id,
        language: session.language as Language,
        status: session.status as SessionResponse['status'],
        current_game_index: session.current_game_index,
        start_time: session.start_time.toISOString(),
    };
}

/**
 * Pause session (GAME-FR-003).
 * Business rule: max 3 pauses; paused sessions expire after 7 days.
 */
export async function pauseSession(sessionId: string, requestingUserId: string): Promise<void> {
    const session = await getSessionWithOwnerCheck(sessionId, requestingUserId);

    if (session.status !== 'active') {
        throw new AppError(400, 'CANNOT_PAUSE', `Session is not active (status: ${session.status}).`);
    }
    if (session.pause_count >= 3) {
        throw new AppError(400, 'MAX_PAUSES_REACHED', 'Maximum 3 pauses per session reached (GAME-FR-003).');
    }

    await db.query(
        `UPDATE sessions
     SET status = 'paused',
         pause_count = pause_count + 1,
         paused_at = NOW()
     WHERE session_id = $1`,
        [sessionId],
    );
}

/**
 * Resume session (GAME-FR-003).
 */
export async function resumeSession(sessionId: string, requestingUserId: string): Promise<void> {
    const session = await getSessionWithOwnerCheck(sessionId, requestingUserId);

    if (session.status !== 'paused') {
        throw new AppError(400, 'NOT_PAUSED', `Session is not paused (status: ${session.status}).`);
    }

    // GAME-FR-003: 7-day expiry for paused sessions
    if (session.paused_at) {
        const elapsed = Date.now() - session.paused_at.getTime();
        if (elapsed > PAUSED_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
            await db.query(
                `UPDATE sessions SET status = 'incomplete' WHERE session_id = $1`,
                [sessionId],
            );
            throw new AppError(410, 'SESSION_EXPIRED', 'Paused session has expired (7-day limit).');
        }
    }

    await db.query(
        `UPDATE sessions
     SET status = 'active',
         resumed_at = NOW(),
         paused_at = NULL
     WHERE session_id = $1`,
        [sessionId],
    );
}

/**
 * Complete session (GAME-FR-004).
 * Business rule: "a session is marked complete only if all 7 games finished"
 */
export async function completeSession(
    sessionId: string,
    requestingUserId: string,
    totalDurationMs: number,
    completionRate: number,
): Promise<void> {
    const session = await getSessionWithOwnerCheck(sessionId, requestingUserId);

    if (session.status === 'completed') {
        return; // Idempotent — already completed
    }

    // GAME-FR-004: only complete if all 7 games finished
    if (completionRate < 1.0) {
        await db.query(
            `UPDATE sessions
       SET status = 'incomplete',
           end_time = NOW(),
           total_duration_ms = $1,
           completion_rate = $2
       WHERE session_id = $3`,
            [totalDurationMs, completionRate, sessionId],
        );
        return;
    }

    await db.query(
        `UPDATE sessions
     SET status = 'completed',
         end_time = NOW(),
         total_duration_ms = $1,
         completion_rate = $2
     WHERE session_id = $3`,
        [totalDurationMs, completionRate, sessionId],
    );
}

/**
 * Abandon session.
 */
export async function abandonSession(sessionId: string, requestingUserId: string): Promise<void> {
    await getSessionWithOwnerCheck(sessionId, requestingUserId);

    await db.query(
        `UPDATE sessions
     SET status = 'incomplete', end_time = NOW()
     WHERE session_id = $1 AND status IN ('active', 'paused')`,
        [sessionId],
    );
}

/**
 * Accept and store feature vectors, then trigger ML inference (GAME-FR-010/004).
 * CON-PRIV-001: only the feature vector (never raw events) is uploaded.
 */
export async function submitFeatureVector(
    sessionId: string,
    requestingUserId: string,
    data: UploadFeatureVectorRequest,
): Promise<FeatureVectorResponse> {
    // Verify session is completed before accepting features
    const session = await getSessionWithOwnerCheck(sessionId, requestingUserId);

    if (session.status !== 'completed') {
        throw new AppError(400, 'SESSION_NOT_COMPLETE', 'Features can only be submitted for completed sessions.');
    }

    // Check no duplicate submission
    const { rows: existingVec } = await db.query<{ vector_id: string }>(
        `SELECT vector_id FROM feature_vectors WHERE session_id = $1`,
        [sessionId],
    );
    if (existingVec.length > 0 && existingVec[0]) {
        return {
            vector_id: existingVec[0].vector_id,
            session_id: sessionId,
            created_at: new Date().toISOString(),
        };
    }

    // Store feature vector (CON-PRIV-001: raw events never stored server-side)
    const { rows } = await db.query<{ vector_id: string; created_at: Date }>(
        `INSERT INTO feature_vectors
       (session_id, age_months, features, normalized_features, extraction_timestamp)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING vector_id, created_at`,
        [
            sessionId,
            data.age_months,
            JSON.stringify(data.features),
            JSON.stringify(data.normalized_features),
            data.extraction_timestamp,
        ],
    );

    const vec = rows[0];
    if (!vec) throw new AppError(500, 'VECTOR_STORE_FAILED', 'Failed to store feature vector.');

    // Trigger async ML inference (GAME-FR-004)
    void triggerMlInference(sessionId, data.age_months, data.normalized_features);

    return {
        vector_id: vec.vector_id,
        session_id: sessionId,
        created_at: vec.created_at.toISOString(),
    };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getSessionWithOwnerCheck(sessionId: string, userId: string) {
    const { rows } = await db.query<{
        session_id: string;
        child_id: string;
        status: string;
        pause_count: number;
        paused_at: Date | null;
        parent_id: string;
        teacher_id: string | null;
    }>(
        `SELECT s.session_id, s.child_id, s.status, s.pause_count, s.paused_at,
            c.parent_id, c.teacher_id
     FROM sessions s
     JOIN children c ON c.child_id = s.child_id
     WHERE s.session_id = $1`,
        [sessionId],
    );

    const session = rows[0];
    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found.');

    const isOwner = session.parent_id === userId || session.teacher_id === userId;
    if (!isOwner) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this session.');

    return session;
}

/**
 * Trigger ML inference asynchronously after feature vector submission (GAME-FR-004).
 * Internal VPC endpoint — not exposed publicly (SRS §9.3).
 */
async function triggerMlInference(
    sessionId: string,
    ageMonths: number,
    normalizedFeatures: Record<string, number | null>,
): Promise<void> {
    try {
        const result = await mlServiceClient.predict({
            session_id: sessionId,
            age_months: ageMonths,
            normalized_features: normalizedFeatures,
        });

        // Store predictions
        await db.query(
            `INSERT INTO predictions (session_id, model_version, predictions, inference_timestamp)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id) DO NOTHING`,
            [sessionId, result.model_version, JSON.stringify(result.predictions)],
        );

        // Create a report record with pending status (REPORT-FR-001: Phase 5)
        await db.query(
            `INSERT INTO reports (session_id, generation_status, disclaimer_version)
       VALUES ($1, 'pending', 'v1')
       ON CONFLICT (session_id) DO NOTHING`,
            [sessionId],
        );

        // TODO Phase 5: trigger Gemini report generation
    } catch (err) {
        console.error(`ML inference failed for session ${sessionId}:`, err);
        // Don't throw — report will be retried or marked as failed
    }
}
