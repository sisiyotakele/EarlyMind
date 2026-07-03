/**
 * Auth routes
 * Traceability: AUTH-FR-001/002/003/004/005, SRS §9.1
 */

import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware';
import {
    handleDeleteAccount,
    handleGetProfile,
    handleLoginOtp,
    handleLoginPin,
    handleLogout,
    handleRegister,
    handleRequestLoginOtp,
    handleUpdateProfile,
    handleVerifyRegistration,
} from './auth.controller';

export const authRoutes = Router();

// ─── Registration (AUTH-FR-001) ───────────────────────────────────────────────
// POST /api/auth/register — Step 1: validate & send OTP
authRoutes.post('/register', authRateLimiter, handleRegister);

// POST /api/auth/register/verify — Step 2: verify OTP + set PIN → create account
authRoutes.post('/register/verify', authRateLimiter, handleVerifyRegistration);

// ─── Login (AUTH-FR-002) ──────────────────────────────────────────────────────
// POST /api/auth/login/pin
authRoutes.post('/login/pin', authRateLimiter, handleLoginPin);

// POST /api/auth/login/otp/request
authRoutes.post('/login/otp/request', authRateLimiter, handleRequestLoginOtp);

// POST /api/auth/login/otp/verify
authRoutes.post('/login/otp/verify', authRateLimiter, handleLoginOtp);

// ─── Logout ────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
authRoutes.post('/logout', requireAuth, handleLogout);

// ─── Profile (AUTH-FR-003) — mounted under /api/users ────────────────────────
// These are also exported for mounting at /api/users/me
export const userRoutes = Router();

// GET /api/users/me
userRoutes.get('/me', requireAuth, handleGetProfile);

// PUT /api/users/me
userRoutes.put('/me', requireAuth, handleUpdateProfile);

// DELETE /api/users/me — AUTH-FR-005 (GDPR right to erasure)
userRoutes.delete('/me', requireAuth, handleDeleteAccount);
