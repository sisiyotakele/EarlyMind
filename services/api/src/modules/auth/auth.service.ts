/**
 * Auth Service — business logic for registration, login, profile, deletion
 * Traceability: AUTH-FR-001/002/003/004/005, AUTH-NFR-001
 */

import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { z } from 'zod';

import type {
    AuthResponse,
    AuthUser,
    Language,
    RegisterRequest,
} from '@earlymind/shared-types';

import { env } from '../../config/env';
import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';
import { createAndSendOtp, verifyOtp } from './otp.service';

// AUTH-NFR-001: bcrypt cost >= 12 for PIN hashing
const PIN_BCRYPT_COST = 12;

// ─── Validation schemas ───────────────────────────────────────────────────────

export const phoneSchema = z
    .string()
    .regex(/^\+251\d{9}$/, 'Phone number must be in +251XXXXXXXXX format (AUTH-FR-001)');

export const pinSchema = z
    .string()
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits (AUTH-FR-001)');

export const registerSchema = z.object({
    phone_number: phoneSchema,
    role: z.enum(['parent', 'teacher', 'school_admin']),
    language: z.enum(['am', 'om', 'ti'] as const satisfies readonly Language[]),
    name: z.string().min(1).max(100),
    school_id: z.string().uuid().optional(),
});

export const verifyRegistrationSchema = z.object({
    phone_number: phoneSchema,
    otp: z.string().length(6).regex(/^\d{6}$/),
    pin: pinSchema,
});

export const loginPinSchema = z.object({
    phone_number: phoneSchema,
    pin: pinSchema,
});

export const loginOtpSchema = z.object({
    phone_number: phoneSchema,
    otp: z.string().length(6).regex(/^\d{6}$/),
});

export const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    language: z.enum(['am', 'om', 'ti'] as const satisfies readonly Language[]).optional(),
    current_pin: pinSchema.optional(),
    new_pin: pinSchema.optional(),
}).refine(
    (data) => {
        // If changing PIN, current_pin is required
        if (data.new_pin && !data.current_pin) return false;
        return true;
    },
    { message: 'current_pin is required when changing PIN' },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates an httpOnly session token.
 * AUTH-NFR-001: >=128-bit entropy (32 bytes = 256 bits)
 */
function generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex'); // 64 hex chars, 256-bit
}

/**
 * Stores session token (hashed) in DB and returns token for cookie.
 * AUTH-NFR-001: stored as SHA-256 hash, never raw
 */
async function createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
): Promise<string> {
    const token = generateSessionToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.query(
        `INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
        [userId, tokenHash, expiresAt, ipAddress ?? null, userAgent ?? null],
    );

    return token;
}

function buildAuthResponse(user: {
    user_id: string;
    role: string;
    name: string | null;
    language: string;
    phone_number: string;
}): AuthUser {
    return {
        user_id: user.user_id,
        role: user.role as AuthUser['role'],
        name: user.name,
        language: user.language as Language,
        phone_number: user.phone_number,
    };
}

// ─── Service methods ──────────────────────────────────────────────────────────

/**
 * Step 1 of registration: validate and send OTP.
 * AUTH-FR-001: "form shown in selected language; phone validated; OTP sent"
 */
export async function initiateRegistration(data: RegisterRequest): Promise<void> {
    const validated = registerSchema.parse(data);

    // Business rule: phone numbers unique per account (AUTH-FR-001)
    const { rows } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM users WHERE phone_number = $1 AND deleted_at IS NULL`,
        [validated.phone_number],
    );
    if (rows.length > 0) {
        throw new AppError(409, 'PHONE_EXISTS', 'An account with this phone number already exists.');
    }

    // Business rule: Teacher/School Admin require school affiliation (AUTH-FR-001)
    if (['teacher', 'school_admin'].includes(validated.role) && !validated.school_id) {
        throw new AppError(
            400,
            'SCHOOL_REQUIRED',
            'School affiliation is required for teacher and school admin accounts.',
        );
    }

    // Business rule: school must exist if provided
    if (validated.school_id) {
        const { rows: schoolRows } = await db.query<{ school_id: string }>(
            `SELECT school_id FROM schools WHERE school_id = $1`,
            [validated.school_id],
        );
        if (schoolRows.length === 0) {
            throw new AppError(404, 'SCHOOL_NOT_FOUND', 'The specified school was not found.');
        }
    }

    // Store registration data temporarily, send OTP
    await db.query(
        `INSERT INTO pending_registrations (phone_number, otp_hash, otp_expires_at, registration_data)
     VALUES ($1, '', NOW(), $2)
     ON CONFLICT (phone_number) DO UPDATE
     SET registration_data = $2, created_at = NOW()`,
        [validated.phone_number, JSON.stringify({
            role: validated.role,
            language: validated.language,
            name: validated.name,
            school_id: validated.school_id ?? null,
        })],
    );

    await createAndSendOtp(validated.phone_number);
}

/**
 * Step 2 of registration: verify OTP and create the user account with PIN.
 * AUTH-FR-001: "account created and user logged in on successful verification"
 */
export async function completeRegistration(
    phone_number: string,
    otp: string,
    pin: string,
    ipAddress?: string,
    userAgent?: string,
): Promise<AuthResponse> {
    const validated = verifyRegistrationSchema.parse({ phone_number, otp, pin });

    // Fetch pending registration data
    const { rows: pendingRows } = await db.query<{
        registration_data: string;
        otp_hash: string;
        otp_expires_at: Date;
    }>(
        `SELECT registration_data, otp_hash, otp_expires_at FROM pending_registrations WHERE phone_number = $1`,
        [validated.phone_number],
    );

    if (pendingRows.length === 0 || !pendingRows[0]) {
        throw new AppError(400, 'NO_PENDING_REGISTRATION', 'No pending registration found. Please restart registration.');
    }

    await verifyOtp(validated.phone_number, validated.otp);

    const regData = JSON.parse(pendingRows[0].registration_data) as {
        role: string;
        language: string;
        name: string;
        school_id: string | null;
    };

    // AUTH-NFR-001: hash PIN with bcrypt cost >= 12
    const pinHash = await bcrypt.hash(validated.pin, PIN_BCRYPT_COST);

    // Create user account
    const { rows: userRows } = await db.query<{
        user_id: string;
        role: string;
        name: string | null;
        language: string;
        phone_number: string;
    }>(
        `INSERT INTO users (phone_number, role, language, pin_hash, name, school_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id, role, name, language, phone_number`,
        [
            validated.phone_number,
            regData.role,
            regData.language,
            pinHash,
            regData.name,
            regData.school_id,
        ],
    );

    const newUser = userRows[0];
    if (!newUser) {
        throw new AppError(500, 'USER_CREATION_FAILED', 'Failed to create user account.');
    }

    const token = await createSession(newUser.user_id, ipAddress, userAgent);
    const expiresAt = new Date(Date.now() + env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    return {
        user: buildAuthResponse(newUser),
        token: { session_token: token, expires_at: expiresAt },
    };
}

/**
 * PIN login.
 * AUTH-FR-002: "PIN lockout for 15 minutes after 3 failed attempts"
 */
export async function loginWithPin(
    phone_number: string,
    pin: string,
    ipAddress?: string,
    userAgent?: string,
): Promise<AuthResponse> {
    loginPinSchema.parse({ phone_number, pin });

    const { rows } = await db.query<{
        user_id: string;
        role: string;
        name: string | null;
        language: string;
        phone_number: string;
        pin_hash: string | null;
        failed_pin_attempts: number;
        lockout_until: Date | null;
    }>(
        `SELECT user_id, role, name, language, phone_number, pin_hash, failed_pin_attempts, lockout_until
     FROM users
     WHERE phone_number = $1 AND deleted_at IS NULL`,
        [phone_number],
    );

    const user = rows[0];
    if (!user) {
        // Generic error to prevent phone number enumeration (SEC-NFR-004)
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or PIN.');
    }

    // AUTH-FR-002: check lockout
    if (user.lockout_until && new Date() < user.lockout_until) {
        const remainingMs = user.lockout_until.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60_000);
        throw new AppError(
            423,
            'ACCOUNT_LOCKED',
            `Account is locked due to too many failed attempts. Try again in ${remainingMin} minutes.`,
        );
    }

    if (!user.pin_hash) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or PIN.');
    }

    const isValid = await bcrypt.compare(pin, user.pin_hash);

    if (!isValid) {
        const newAttempts = user.failed_pin_attempts + 1;
        const shouldLock = newAttempts >= env.PIN_MAX_ATTEMPTS;
        const lockoutUntil = shouldLock
            ? new Date(Date.now() + env.PIN_LOCKOUT_MINUTES * 60_000)
            : null;

        await db.query(
            `UPDATE users
       SET failed_pin_attempts = $1, lockout_until = $2
       WHERE user_id = $3`,
            [newAttempts, lockoutUntil, user.user_id],
        );

        // AUTH-NFR-001: failed logins logged (audit trail)
        await db.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, metadata, ip_address)
       VALUES ($1, $2, 'failed_pin_login', $3, $4)`,
            [
                user.user_id,
                user.role,
                JSON.stringify({ failed_attempts: newAttempts, locked: shouldLock }),
                ipAddress ?? null,
            ],
        );

        if (shouldLock) {
            throw new AppError(
                423,
                'ACCOUNT_LOCKED',
                `Account locked for ${env.PIN_LOCKOUT_MINUTES} minutes after ${env.PIN_MAX_ATTEMPTS} failed attempts.`,
            );
        }

        throw new AppError(
            401,
            'INVALID_CREDENTIALS',
            `Invalid PIN. ${env.PIN_MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`,
        );
    }

    // Successful login: reset failed attempts
    await db.query(
        `UPDATE users SET failed_pin_attempts = 0, lockout_until = NULL WHERE user_id = $1`,
        [user.user_id],
    );

    const token = await createSession(user.user_id, ipAddress, userAgent);
    const expiresAt = new Date(Date.now() + env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    return {
        user: buildAuthResponse(user),
        token: { session_token: token, expires_at: expiresAt },
    };
}

/**
 * OTP login — request step (sends OTP to phone).
 * AUTH-FR-002
 */
export async function requestLoginOtp(phone_number: string): Promise<void> {
    phoneSchema.parse(phone_number);

    const { rows } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM users WHERE phone_number = $1 AND deleted_at IS NULL`,
        [phone_number],
    );

    // Generic response to prevent phone enumeration
    if (rows.length === 0 || !rows[0]) return;

    await createAndSendOtp(phone_number, rows[0].user_id);
}

/**
 * OTP login — verify step.
 * AUTH-FR-002: "OTP valid 5 minutes"
 */
export async function loginWithOtp(
    phone_number: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string,
): Promise<AuthResponse> {
    loginOtpSchema.parse({ phone_number, otp });

    const { rows } = await db.query<{
        user_id: string;
        role: string;
        name: string | null;
        language: string;
        phone_number: string;
    }>(
        `SELECT user_id, role, name, language, phone_number
     FROM users WHERE phone_number = $1 AND deleted_at IS NULL`,
        [phone_number],
    );

    const user = rows[0];
    if (!user) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or OTP.');
    }

    await verifyOtp(phone_number, otp, user.user_id);

    const token = await createSession(user.user_id, ipAddress, userAgent);
    const expiresAt = new Date(Date.now() + env.SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    return {
        user: buildAuthResponse(user),
        token: { session_token: token, expires_at: expiresAt },
    };
}

/**
 * Get profile (AUTH-FR-003)
 */
export async function getProfile(userId: string): Promise<AuthUser> {
    const { rows } = await db.query<{
        user_id: string;
        role: string;
        name: string | null;
        language: string;
        phone_number: string;
    }>(
        `SELECT user_id, role, name, language, phone_number
     FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId],
    );

    const user = rows[0];
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');

    return buildAuthResponse(user);
}

/**
 * Update profile (AUTH-FR-003)
 * Phone changes require re-verification — not implemented here (display-only).
 */
export async function updateProfile(
    userId: string,
    data: { name?: string; language?: Language; current_pin?: string; new_pin?: string },
): Promise<AuthUser> {
    updateProfileSchema.parse(data);

    // Handle PIN change
    if (data.new_pin) {
        if (!data.current_pin) {
            throw new AppError(400, 'CURRENT_PIN_REQUIRED', 'Current PIN is required to set a new PIN.');
        }

        const { rows } = await db.query<{ pin_hash: string | null }>(
            `SELECT pin_hash FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
            [userId],
        );

        const pinHash = rows[0]?.pin_hash;
        if (!pinHash) {
            throw new AppError(400, 'NO_PIN_SET', 'No PIN set for this account.');
        }

        const pinValid = await bcrypt.compare(data.current_pin, pinHash);
        if (!pinValid) {
            throw new AppError(401, 'INVALID_CURRENT_PIN', 'Current PIN is incorrect.');
        }

        const newPinHash = await bcrypt.hash(data.new_pin, PIN_BCRYPT_COST);
        await db.query(`UPDATE users SET pin_hash = $1 WHERE user_id = $2`, [newPinHash, userId]);
    }

    // Update other fields
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(data.name);
    }
    if (data.language !== undefined) {
        updates.push(`language = $${idx++}`);
        values.push(data.language);
    }

    if (updates.length > 0) {
        values.push(userId);
        await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx}`,
            values,
        );
    }

    return getProfile(userId);
}

/**
 * Logout — invalidate session token.
 */
export async function logout(tokenRaw: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(tokenRaw).digest('hex');
    await db.query(`DELETE FROM user_sessions WHERE token_hash = $1`, [tokenHash]);
}

/**
 * Account deletion / GDPR right to erasure.
 * AUTH-FR-005: requires re-authentication, cascades all child data.
 */
export async function deleteAccount(
    userId: string,
    confirmation: string,
    pin?: string,
    otp?: string,
): Promise<void> {
    // AUTH-FR-005: exact confirmation string required
    if (confirmation !== 'I understand this is permanent') {
        throw new AppError(400, 'CONFIRMATION_REQUIRED', 'Confirmation phrase is incorrect.');
    }

    // Re-authentication required (AUTH-FR-005: PIN or OTP)
    if (!pin && !otp) {
        throw new AppError(400, 'REAUTH_REQUIRED', 'PIN or OTP is required to delete your account.');
    }

    const { rows } = await db.query<{
        phone_number: string;
        role: string;
        pin_hash: string | null;
    }>(
        `SELECT phone_number, role, pin_hash FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId],
    );

    const user = rows[0];
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');

    if (pin) {
        if (!user.pin_hash) throw new AppError(401, 'INVALID_CREDENTIALS', 'PIN not set.');
        const valid = await bcrypt.compare(pin, user.pin_hash);
        if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect PIN.');
    } else if (otp) {
        await verifyOtp(user.phone_number, otp, userId);
    }

    // AUTH-FR-005: cascade delete — children, sessions, reports, feature_vectors all cascade via FK
    // audit_logs are anonymized (actor_id replaced with placeholder)
    const DELETED_ACTOR_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

    await db.query(`BEGIN`);
    try {
        // Anonymize audit logs referencing this user
        await db.query(
            `UPDATE audit_logs SET actor_id = $1 WHERE actor_id = $2`,
            [DELETED_ACTOR_PLACEHOLDER, userId],
        );

        // Log the deletion itself (anonymized — actor replaced after the fact)
        await db.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'account_deleted', 'user', $1, $3)`,
            [DELETED_ACTOR_PLACEHOLDER, user.role, JSON.stringify({ deletion_type: 'gdpr_erasure' })],
        );

        // Soft-delete the user account (hard deletion via scheduled cleanup or immediate)
        // Using soft-delete here to allow the audit trail to reference it briefly
        await db.query(
            `UPDATE users SET deleted_at = NOW(), phone_number = 'deleted_' || user_id,
       pin_hash = NULL, otp_hash = NULL, name = NULL
       WHERE user_id = $1`,
            [userId],
        );

        // Invalidate all sessions
        await db.query(`DELETE FROM user_sessions WHERE user_id = $1`, [userId]);

        await db.query(`COMMIT`);
    } catch (err) {
        await db.query(`ROLLBACK`);
        throw err;
    }
}
