/**
 * Auth Controller — HTTP handlers for auth endpoints
 * Traceability: AUTH-FR-001/002/003/004/005
 */

import type { NextFunction, Request, Response } from 'express';

import { env } from '../../config/env';
import {
    completeRegistration,
    deleteAccount,
    getProfile,
    initiateRegistration,
    loginWithOtp,
    loginWithPin,
    logout,
    requestLoginOtp,
    updateProfile,
} from './auth.service';

/** Shared cookie options — AUTH-NFR-001: httpOnly, Secure, SameSite */
function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: env.NODE_ENV === 'production', // HTTPS only in prod (CON-PRIV-003)
        sameSite: 'strict' as const,
        maxAge: env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: '/',
    };
}

// POST /api/auth/register — AUTH-FR-001
export async function handleRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await initiateRegistration(req.body as Record<string, unknown>);
        res.status(200).json({
            success: true,
            data: {
                message: 'OTP sent to your phone number. Enter the code to complete registration.',
                phone_number: (req.body as Record<string, unknown>)['phone_number'],
            },
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/register/verify — AUTH-FR-001
export async function handleVerifyRegistration(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as { phone_number?: string; otp?: string; pin?: string };
        const authData = await completeRegistration(
            body.phone_number ?? '',
            body.otp ?? '',
            body.pin ?? '',
            req.ip,
            req.headers['user-agent'],
        );

        res.cookie('session_token', authData.token.session_token, sessionCookieOptions());
        res.status(201).json({ success: true, data: { user: authData.user } });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/login/pin — AUTH-FR-002
export async function handleLoginPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as { phone_number?: string; pin?: string };
        const authData = await loginWithPin(
            body.phone_number ?? '',
            body.pin ?? '',
            req.ip,
            req.headers['user-agent'],
        );

        res.cookie('session_token', authData.token.session_token, sessionCookieOptions());
        // AUTH-FR-002: "successful login redirects to the role-appropriate dashboard"
        res.status(200).json({ success: true, data: { user: authData.user } });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/login/otp/request — AUTH-FR-002
export async function handleRequestLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as { phone_number?: string };
        await requestLoginOtp(body.phone_number ?? '');
        // Generic response to prevent phone enumeration
        res.status(200).json({
            success: true,
            data: { message: 'If this phone number is registered, an OTP has been sent.' },
        });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/login/otp/verify — AUTH-FR-002
export async function handleLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as { phone_number?: string; otp?: string };
        const authData = await loginWithOtp(
            body.phone_number ?? '',
            body.otp ?? '',
            req.ip,
            req.headers['user-agent'],
        );

        res.cookie('session_token', authData.token.session_token, sessionCookieOptions());
        res.status(200).json({ success: true, data: { user: authData.user } });
    } catch (err) {
        next(err);
    }
}

// GET /api/users/me — AUTH-FR-003
export async function handleGetProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = await getProfile(req.user?.user_id ?? '');
        res.status(200).json({ success: true, data: { user } });
    } catch (err) {
        next(err);
    }
}

// PUT /api/users/me — AUTH-FR-003
export async function handleUpdateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const user = await updateProfile(req.user?.user_id ?? '', req.body as Record<string, string>);
        res.status(200).json({ success: true, data: { user } });
    } catch (err) {
        next(err);
    }
}

// POST /api/auth/logout
export async function handleLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const token = req.cookies?.['session_token'] as string | undefined;
        if (token) {
            await logout(token);
        }
        res.clearCookie('session_token', { path: '/' });
        res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
    } catch (err) {
        next(err);
    }
}

// DELETE /api/users/me — AUTH-FR-005
export async function handleDeleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const body = req.body as { confirmation?: string; pin?: string; otp?: string };
        await deleteAccount(
            req.user?.user_id ?? '',
            body.confirmation ?? '',
            body.pin,
            body.otp,
        );

        res.clearCookie('session_token', { path: '/' });
        res.status(200).json({ success: true, data: { message: 'Account and all associated data permanently deleted.' } });
    } catch (err) {
        next(err);
    }
}
