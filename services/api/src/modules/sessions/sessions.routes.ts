/**
 * Session routes — Phase 2 implementation
 * Traceability: GAME-FR-001/003/004, SRS §9.1
 */

import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.middleware';
import {
    handleStartSession,
    handleUpdateSession,
    handleSubmitFeatures,
} from './sessions.controller';

export const sessionRoutes = Router();

// POST /api/sessions — GAME-FR-001
sessionRoutes.post('/', requireAuth, handleStartSession);

// PATCH /api/sessions/:id — GAME-FR-003/004 (pause, resume, complete, abandon)
sessionRoutes.patch('/:id', requireAuth, handleUpdateSession);

// POST /api/sessions/:id/features — GAME-FR-010 (CON-PRIV-001: vectors only, no raw events)
sessionRoutes.post('/:id/features', requireAuth, handleSubmitFeatures);

// GET /api/sessions/:id/report — REPORT-FR-001 (Phase 5)
sessionRoutes.get('/:id/report', requireAuth, (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 5' } });
});
