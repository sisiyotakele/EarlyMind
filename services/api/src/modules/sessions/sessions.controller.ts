/**
 * Session Controller — HTTP handlers for session endpoints
 * Traceability: GAME-FR-001/003/004, GAME-FR-010
 */

import type { NextFunction, Request, Response } from 'express';

import {
    abandonSession,
    completeSession,
    pauseSession,
    resumeSession,
    startSession,
    submitFeatureVector,
} from './sessions.service';

// POST /api/sessions — GAME-FR-001
export async function handleStartSession(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const body = req.body as { child_id?: string; language?: string; session_id?: string };
        const session = await startSession(
            body.child_id ?? '',
            (body.language ?? 'am') as 'am' | 'om' | 'ti',
            req.user?.user_id ?? '',
            body.session_id,
        );
        res.status(201).json({ success: true, data: session });
    } catch (err) {
        next(err);
    }
}

// PATCH /api/sessions/:id — GAME-FR-003/004
export async function handleUpdateSession(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { id } = req.params;
        const body = req.body as {
            action?: string;
            total_duration_ms?: number;
            completion_rate?: number;
        };

        switch (body.action) {
            case 'pause':
                await pauseSession(id, req.user?.user_id ?? '');
                break;
            case 'resume':
                await resumeSession(id, req.user?.user_id ?? '');
                break;
            case 'complete':
                await completeSession(
                    id,
                    req.user?.user_id ?? '',
                    body.total_duration_ms ?? 0,
                    body.completion_rate ?? 0,
                );
                break;
            case 'abandon':
                await abandonSession(id, req.user?.user_id ?? '');
                break;
            default:
                res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ACTION', message: 'Invalid action. Must be pause, resume, complete, or abandon.' },
                });
                return;
        }

        res.status(200).json({ success: true, data: { message: `Session ${body.action}d successfully.` } });
    } catch (err) {
        next(err);
    }
}

// POST /api/sessions/:id/features — GAME-FR-010
export async function handleSubmitFeatures(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { id } = req.params;
        const result = await submitFeatureVector(id, req.user?.user_id ?? '', req.body as Record<string, unknown>);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}
