/**
 * Children routes — Phase 1 implementation
 * Traceability: SRS §9.1 (child profile management)
 */

import { Router } from 'express';

export const childrenRoutes = Router();

// POST /api/children
childrenRoutes.post('/', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// GET /api/children (list all for authenticated user)
childrenRoutes.get('/', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// GET /api/children/:id
childrenRoutes.get('/:id', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// PATCH /api/children/:id
childrenRoutes.patch('/:id', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// DELETE /api/children/:id
childrenRoutes.delete('/:id', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});
