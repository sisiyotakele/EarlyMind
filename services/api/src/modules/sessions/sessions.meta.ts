/**
 * Session metadata endpoint — used by GameSessionPage to get child info
 * Traceability: GAME-FR-001
 */

import type { NextFunction, Request, Response } from 'express';

import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';

export async function handleGetSessionMeta(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    try {
        const { id } = req.params;
        const userId = req.user!.user_id;

        const { rows } = await db.query<{
            session_id: string;
            child_id: string;
            child_name: string;
            child_dob: Date;
            language: string;
            current_game_index: number;
        }>(
            `SELECT s.session_id, s.child_id, c.name AS child_name,
              c.date_of_birth AS child_dob, s.language, s.current_game_index
       FROM sessions s
       JOIN children c ON c.child_id = s.child_id
       WHERE s.session_id = $1
         AND (c.parent_id = $2 OR c.teacher_id = $2)`,
            [id, userId],
        );

        if (!rows[0]) throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found.');
        const row = rows[0];

        res.json({
            success: true,
            data: {
                ...row,
                child_dob: row.child_dob.toISOString().slice(0, 10),
            },
        });
    } catch (err) {
        next(err);
    }
}
