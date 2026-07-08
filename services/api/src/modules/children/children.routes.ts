/**
 * Children routes
 * Traceability: GAME-FR-001, AUTH-FR-004, CON-PRIV-001/004
 */

import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';

export const childrenRoutes = Router();

const createChildSchema = z.object({
    name: z.string().min(1).max(100),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    language: z.enum(['am', 'om', 'ti']),
    grade_level: z.string().max(20).optional(),
});

// POST /api/children — AUTH-FR-004: parent or teacher
childrenRoutes.post('/', requireAuth, requireRole('parent', 'teacher'), async (req, res, next) => {
    try {
        const data = createChildSchema.parse(req.body);
        const userId = req.user!.user_id;
        const role = req.user!.role;

        const { rows } = await db.query<{ child_id: string; name: string; date_of_birth: Date; language: string; grade_level: string | null }>(
            `INSERT INTO children (parent_id, teacher_id, name, date_of_birth, language, grade_level)
       VALUES (
         $1,
         $2,
         $3, $4, $5, $6
       )
       RETURNING child_id, name, date_of_birth, language, grade_level`,
            [
                role === 'parent' ? userId : null,
                role === 'teacher' ? userId : null,
                data.name,
                data.date_of_birth,
                data.language,
                data.grade_level ?? null,
            ],
        );

        const child = rows[0];
        if (!child) throw new AppError(500, 'CREATE_FAILED', 'Failed to create child profile.');

        res.status(201).json({ success: true, data: { ...child, date_of_birth: child.date_of_birth.toISOString().slice(0, 10) } });
    } catch (err) { next(err); }
});

// GET /api/children — list for authenticated user
childrenRoutes.get('/', requireAuth, requireRole('parent', 'teacher'), async (req, res, next) => {
    try {
        const userId = req.user!.user_id;
        const role = req.user!.role;

        const { rows } = await db.query(
            `SELECT c.child_id, c.name, c.date_of_birth, c.language, c.grade_level,
              s.status AS last_session_status, s.end_time AS last_session_date
       FROM children c
       LEFT JOIN LATERAL (
         SELECT status, end_time FROM sessions
         WHERE child_id = c.child_id
         ORDER BY created_at DESC LIMIT 1
       ) s ON TRUE
       WHERE ${role === 'parent' ? 'c.parent_id = $1' : 'c.teacher_id = $1'}
       ORDER BY c.name`,
            [userId],
        );

        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

// GET /api/children/:id
childrenRoutes.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user!.user_id;

        const { rows } = await db.query(
            `SELECT child_id, name, date_of_birth, language, grade_level
       FROM children
       WHERE child_id = $1
         AND (parent_id = $2 OR teacher_id = $2)`,
            [id, userId],
        );

        if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Child not found.');
        res.json({ success: true, data: rows[0] });
    } catch (err) { next(err); }
});

// GET /api/children/:id/accommodation-guide — DASH-TEACHER-003 (teacher only, no raw data)
childrenRoutes.get('/:id/accommodation-guide', requireAuth, requireRole('teacher', 'parent'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user!.user_id;

        // Verify access
        const { rows: childRows } = await db.query<{ name: string }>(
            `SELECT c.name FROM children c
       WHERE c.child_id = $1 AND (c.parent_id = $2 OR c.teacher_id = $2)`,
            [id, userId],
        );
        if (!childRows[0]) throw new AppError(404, 'NOT_FOUND', 'Child not found.');

        // Get latest completed report — CON-PRIV-004: teacher sees only recommendations, NOT raw scores
        const { rows: reportRows } = await db.query<{
            recommendations: string[];
            referral_suggested: boolean;
            generated_at: Date;
        }>(
            `SELECT r.recommendations, r.referral_suggested, r.generated_at
       FROM reports r
       JOIN sessions s ON s.session_id = r.session_id
       WHERE s.child_id = $1 AND r.generation_status = 'completed'
       ORDER BY r.generated_at DESC LIMIT 1`,
            [id],
        );

        const lang = req.user!.role === 'parent' ? 'am' : 'am'; // teacher sees Amharic by default
        const DISCLAIMER_AM = 'ይህ ምርመራ ነው፣ ሕክምናዊ ምርመራ አይደለም። ለዝርዝር ምርመራ ሙያዊ ባለሙያ ያማክሩ።';

        res.json({
            success: true,
            data: {
                child_name: childRows[0].name,
                recommendations: reportRows[0]?.recommendations ?? [],
                referral_suggested: reportRows[0]?.referral_suggested ?? false,
                disclaimer: DISCLAIMER_AM,
                generated_at: reportRows[0]?.generated_at?.toISOString() ?? null,
            },
        });
    } catch (err) { next(err); }
});

// Helper
async function auditLog(actorId: string, role: string, action: string, targetId: string) {
    await db.query(
        `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id)
     VALUES ($1, $2, $3, 'child', $4)`,
        [actorId, role, action, targetId],
    );
}
