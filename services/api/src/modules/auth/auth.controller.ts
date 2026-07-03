/**
 * Auth Controller — handles HTTP layer for auth endpoints.
 *
 * Delegates business logic to auth.service.ts.
 * Sets httpOnly session cookie per AUTH-FR-002 Business Rule.
 *
 * Traceability: AUTH-FR-001–005, SRS §9.1
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';
import * as otpService from './otp.service';
import { env } from '../../config/env';
import type { Language, UserRole } from '@earlymind/shared-types';

// ─── Zod validators ───────────────────────────────────────────────────────────

const registerSchema = z.object({
    phone_number: z.string().regex(/^\+251[0-9]{9}$/, 'Must be +251XXXXXXXXX'),
    role: z.enum(['parent', 'teacher', 'school_admin'] as const),
    language: z.enum(['am', 'om', 'ti'] as const),
    name: z.string().min(1).max(100),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
    school_id: z.string().uuid().optional(),
    otp: z.string().length(6),
});

const otpRequestSchema = z.object({
    phone_number: z.string().regex(/^\+251[0-9]{9}$/, 'Must be +251XXXXXXXXX'),
});

const loginPinSchema = z.object({
    phone_number: z.string().regex(/^\+251[0-9]{9}$/),
    pin: z.string().regex(/^\d{4}$/),
});

const loginOtpSchema = z.object({
    phone_number: z.string().regex(/^\+251[0-9]{9}$/),
    otp: z.string().length(6),
});

const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    language: z.enum(['am', 'om', 'ti'] as const).optional(),
    current_pin: z.string().regex(/^\d{4}$/).optional(),
    new_pin: z.string().regex(/^\d{4}$/).optional(),
});

const deleteAccountSchema = z.object({
    confirmation_pin: z.string().regex(/^\d{4}$/),
    acknowledge_permanent: z.literal(true),
});

// ─── Cookie helper ────────────────────────────────────────────────────────────

function setSessionCookie(res: Response, token: string): void {
    res.cookie('session_token', token, {
        httpOnly: true,             // AUTH-NFR-001: httpOnly
        secure: env.NODE_ENV === 'production', // AUTH-NFR-001: secure in prod
        sameSite: 'strict',         // AUTH-NFR-001: SameSite
        maxAge: env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** POST /api/auth/otp/request — AUTH-FR-001 */
export async function requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { phone_number } = otpRequestSchema.parse(req.body);
        const result = await otpService.requestOtp(phone_number);

        // In production, send via SMS gateway (wired in smsGateway.ts).
        // In development, log to console (never in production logs).
        if (env.NODE_ENV === 'development') {
            console.warn(`[DEV ONLY] OTP for ${phone_number}: ${result.code}`);
        } else {
            // TODO: wire SMS gateway integration
            // await smsGateway.send(phone_number, `Your EarlyMind code: ${result.code}`);
        }

        res.json({
            success: true,
            data: {
                expires_in_seconds: env.OTP_EXPIRY_SECONDS,
                resends_remaining: result.resendsRemaining,
            },
        });
    } catch (err) {
        next(err);
    }
}

/** POST /api/auth/register — AUTH-FR-001 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = registerSchema.parse(req.body);
        const result = await authService.registerUser({
            ...body,
            role: body.role as UserRole,
            language: body.language as Language,
        });
        setSessionCookie(res, result.session_token);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** POST /api/auth/login/pin — AUTH-FR-002 */
export async function loginPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = loginPinSchema.parse(req.body);
        const result = await authService.loginWithPin(body);
        setSessionCookie(res, result.session_token);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** POST /api/auth/login/otp — AUTH-FR-002 */
export async function loginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = loginOtpSchema.parse(req.body);
        const result = await authService.loginWithOtp(body);
        setSessionCookie(res, result.session_token);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** GET /api/users/me — AUTH-FR-003 */
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const result = await authService.getProfile(req.user!.user_id);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** PUT /api/users/me — AUTH-FR-003 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = updateProfileSchema.parse(req.body);
        const result = await authService.updateProfile(req.user!.user_id, body, req.user!.role);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
}

/** DELETE /api/users/me — AUTH-FR-005 (GDPR right to erasure) */
export async function deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { confirmation_pin, acknowledge_permanent } = deleteAccountSchema.parse(req.body);
        await authService.deleteAccount(req.user!.user_id, confirmation_pin, acknowledge_permanent);
        // Clear the session cookie
        res.clearCookie('session_token');
        res.json({ success: true, data: { message: 'Account and all associated data deleted' } });
    } catch (err) {
        next(err);
    }
}

/** POST /api/auth/logout */
export function logout(_req: Request, res: Response): void {
    res.clearCookie('session_token');
    res.json({ success: true, data: { message: 'Logged out' } });
}
