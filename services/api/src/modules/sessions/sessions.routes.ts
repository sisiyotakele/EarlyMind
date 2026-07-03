/**
 * Session routes — Phase 2 implementation
 * Traceability: GAME-FR-001/003/004, SRS §9.1
 */

import { Router } from 'express';

export const sessionRoutes = Router();

// POST /api/sessions — GAME-FR-001
sessionRoutes.post('/', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } });
});

// PATCH /api/sessions/:id — GAME-FR-003/004
sessionRoutes.patch('/:id', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } });
});

// POST /api/sessions/:id/features — GAME-FR-010
sessionRoutes.post('/:id/features', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 2' } });
});

// GET /api/sessions/:id/report — REPORT-FR-001
sessionRoutes.get('/:id/report', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 5' } });
});
