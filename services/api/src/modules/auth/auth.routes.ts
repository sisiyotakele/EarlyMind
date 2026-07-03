/**
 * Auth routes — Phase 1 implementation
 * Traceability: AUTH-FR-001/002/003/004/005, SRS §9.1
 */

import { Router } from 'express';

import { authRateLimiter } from '../../middleware/rateLimiter.middleware';

// Phase 1 controllers will be imported here
// import { AuthController } from './auth.controller';

export const authRoutes = Router();

// POST /api/auth/register — AUTH-FR-001
authRoutes.post('/register', authRateLimiter, (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// POST /api/auth/register/verify — AUTH-FR-001
authRoutes.post('/register/verify', authRateLimiter, (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// POST /api/auth/login/pin — AUTH-FR-002
authRoutes.post('/login/pin', authRateLimiter, (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// POST /api/auth/login/otp/request — AUTH-FR-002
authRoutes.post('/login/otp/request', authRateLimiter, (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// POST /api/auth/login/otp/verify — AUTH-FR-002
authRoutes.post('/login/otp/verify', authRateLimiter, (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});

// POST /api/auth/logout
authRoutes.post('/logout', (_req, res) => {
    res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Phase 1' } });
});
