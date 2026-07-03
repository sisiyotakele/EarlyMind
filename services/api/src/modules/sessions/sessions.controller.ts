/**
 * Sessions Controller — GAME-FR-001 through GAME-FR-004
 *
 * Traceability: SRS §9.1, GAME-FR-001–004
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as sessionsService from './sessions.service';

const createSessionSchema = z.object({
    child_id: z.string().uuid(),
    language: z.enum(['am', 'om', 'ti'] as const),
    device_info: z.object({
        user_agent: z.string(),
        screen_width: z.number().int().positive(),
        screen_height: z.number().int().positive(),
        touch_capable: z.boolean(),
    }),
});

const updateSessionSchema = z.object({
    action: z.enum(['pause', 'resume', 'complete', 'abandon']),
    current_game_index: z.number().int().min(0).max(6).optional(),
    games_completed: z.array(z.enum([
        'letter_rain', 'pattern_mirror', 'story_rhythm', 'number_jumper',
        'color_sequence', 'target_chase', 'word_echo',
    ])).optional(),
});

/** POST /api/sessions */
export async function createSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = createSessionSchema.parse(req.body);
        const result = await sessionsService.createSession(req.user!.user_id, {
            ...body,
            language: body.language,
        });
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** GET /api/sessions/:id */
export async function getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await sessionsService.getSession(req.params['id']!, req.user!.user_id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** PATCH /api/sessions/:id */
export async function updateSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = updateSessionSchema.parse(req.body);
        const result = await sessionsService.updateSession(req.params['id']!, req.user!.user_id, body);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}
