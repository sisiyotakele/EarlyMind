/**
 * Authentication middleware
 * Traceability: AUTH-FR-004 (RBAC enforced at API layer)
 * AUTH-NFR-001: session tokens in httpOnly/secure/SameSite cookies
 */

import crypto from 'crypto';

import type { NextFunction, Request, Response } from 'express';

import type { UserRole } from '@earlymind/shared-types';

import { db } from '../db/client';
import { AppError } from './errorHandler.middleware';

// Augment Express Request with authenticated user
declare global {
    namespace Express {
        interface Request {
            user?: {
                user_id: string;
                role: UserRole;
                phone_number: string;
            };
        }
    }
}

/**
 * Validates session token from httpOnly cookie.
 * Session tokens are stored in the `user_sessions` table (see migration 012).
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
        const token = req.cookies?.['session_token'] as string | undefined;

        if (!token) {
            throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
        }

        // Hash the token before DB lookup (never store raw tokens)
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const { rows } = await db.query<{
            user_id: string;
            role: UserRole;
            phone_number: string;
            expires_at: Date;
        }>(
            `SELECT u.user_id, u.role, u.phone_number, s.expires_at
       FROM user_sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL`,
            [tokenHash],
        );

        if (rows.length === 0) {
            throw new AppError(401, 'SESSION_EXPIRED', 'Session expired or invalid');
        }

        const session = rows[0];
        if (!session) {
            throw new AppError(401, 'SESSION_EXPIRED', 'Session expired or invalid');
        }

        req.user = {
            user_id: session.user_id,
            role: session.role,
            phone_number: session.phone_number,
        };

        // Update last_active_at for session expiry tracking (AUTH-FR-002: 7 days inactivity)
        await db.query('UPDATE users SET last_active_at = NOW() WHERE user_id = $1', [session.user_id]);

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * RBAC guard — restricts endpoint to specific roles.
 * AUTH-FR-004: unauthorized access returns HTTP 403.
 * Traceability: AUTH-FR-004
 */
export function requireRole(...allowedRoles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            next(
                new AppError(403, 'FORBIDDEN', `Access denied. Required role: ${allowedRoles.join(' or ')}`),
            );
            return;
        }
        next();
    };
}
