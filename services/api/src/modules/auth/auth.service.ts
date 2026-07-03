/**
 * Auth Service — implements AUTH-FR-001 through AUTH-FR-005.
 *
 * Business rules:
 *   AUTH-FR-001: phone registration, 4-digit PIN, role/language selection
 *   AUTH-FR-002: PIN login + OTP login, lockout after 3 fails for 15 min,
 *                session token in httpOnly cookie, 7-day expiry
 *   AUTH-FR-003: profile view/edit, language change, PIN change
 *   AUTH-FR-004: role fixed at registration (RBAC middleware enforces at API layer)
 *   AUTH-FR-005: GDPR right to erasure — delete user + all child data
 *
 * Traceability: AUTH-FR-001–005, AUTH-NFR-001, CON-PRIV-001/002
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, withTransaction } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler.middleware';
import { signSessionToken } from '../../middleware/auth.middleware';
import { verifyOtp } from './otp.service';
import type {
    RegisterRequest,
    LoginWithPinRequest,
    LoginWithOtpRequest,
    LoginResponse,
    RegisterResponse,
    GetProfileResponse,
    UpdateProfileRequest,
} from '@earlymind/shared-types';

// AUTH-NFR-001: bcrypt cost >= 12 for PINs
const PIN_BCRYPT_COST = 12;

// Phone number format: +251XXXXXXXXX (9 digits after +251)
const PHONE_REGEX = /^\+251[0-9]{9}$/;

// 4-digit PIN
const PIN_REGEX = /^\d{4}$/;

/** Validate phone number format. */
function assertValidPhone(phone: string): void {
    if (!PHONE_REGEX.test(phone)) {
        throw new AppError(422, 'INVALID_PHONE', 'Phone number must be in E.164 format: +251XXXXXXXXX');
    }
}

/** Validate 4-digit PIN. */
function assertValidPin(pin: string): void {
    if (!PIN_REGEX.test(pin)) {
        throw new AppError(422, 'INVALID_PIN', 'PIN must be exactly 4 digits');
    }
}

// ─── AUTH-FR-001: Registration ────────────────────────────────────────────────

export async function registerUser(req: RegisterRequest): Promise<RegisterResponse> {
    assertValidPhone(req.phone_number);
    assertValidPin(req.pin);

    // Teacher/School Admin require school affiliation (AUTH-FR-001 Business Rule)
    if ((req.role === 'teacher' || req.role === 'school_admin') && !req.school_id) {
        throw new AppError(422, 'SCHOOL_REQUIRED', 'School affiliation required for this role');
    }

    // Verify the OTP before creating the account
    await verifyOtp(req.phone_number, req.otp);

    // Check phone uniqueness (AUTH-FR-001 Business Rule)
    const existing = await queryOne<{ user_id: string }>(
        `SELECT user_id FROM users WHERE phone_number = $1`,
        [req.phone_number],
    );
    if (existing) {
        throw new AppError(409, 'PHONE_TAKEN', 'An account with this phone number already exists');
    }

    const pinHash = await bcrypt.hash(req.pin, PIN_BCRYPT_COST);
    const userId = uuidv4();

    await query(
        `INSERT INTO users (user_id, phone_number, role, language, pin_hash, name, school_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, req.phone_number, req.role, req.language, pinHash, req.name, req.school_id ?? null],
    );

    // Write audit log — AUTH-FR-004 audit trail
    await writeAuditLog(userId, req.role, 'user.register', 'user', userId, {});

    const sessionToken = signSessionToken({
        user_id: userId,
        role: req.role,
        phone_number: req.phone_number,
    });

    return { user_id: userId, role: req.role, language: req.language, session_token: sessionToken };
}

// ─── AUTH-FR-002: PIN Login ───────────────────────────────────────────────────

export async function loginWithPin(req: LoginWithPinRequest): Promise<LoginResponse> {
    assertValidPhone(req.phone_number);

    const user = await queryOne<{
        user_id: string;
        role: string;
        language: string;
        name: string;
        pin_hash: string;
        failed_pin_attempts: number;
        locked_until: Date | null;
        is_active: boolean;
    }>(
        `SELECT user_id, role, language, name, pin_hash, failed_pin_attempts,
            locked_until, is_active
     FROM users WHERE phone_number = $1`,
        [req.phone_number],
    );

    if (!user || !user.is_active) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or PIN');
    }

    // Check lockout — AUTH-FR-002: locked for 15 min after 3 failed attempts
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new AppError(
            429,
            'ACCOUNT_LOCKED',
            `Account locked due to too many failed attempts. Try again after ${user.locked_until.toISOString()}.`,
        );
    }

    const pinValid = await bcrypt.compare(req.pin, user.pin_hash);

    if (!pinValid) {
        const newFailCount = user.failed_pin_attempts + 1;
        const shouldLock = newFailCount >= env.PIN_MAX_ATTEMPTS;
        const lockedUntil = shouldLock
            ? new Date(Date.now() + env.PIN_LOCKOUT_MINUTES * 60 * 1000)
            : null;

        await query(
            `UPDATE users
       SET failed_pin_attempts = $1, locked_until = $2
       WHERE user_id = $3`,
            [newFailCount, lockedUntil, user.user_id],
        );

        await writeAuditLog(user.user_id, user.role as never, 'user.login_failed', 'user', user.user_id, {
            attempt: newFailCount,
        });

        if (shouldLock) {
            await writeAuditLog(user.user_id, user.role as never, 'user.locked', 'user', user.user_id, {});
        }

        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or PIN');
    }

    // Reset fail counter on success
    await query(
        `UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE user_id = $1`,
        [user.user_id],
    );

    await writeAuditLog(user.user_id, user.role as never, 'user.login', 'user', user.user_id, {
        method: 'pin',
    });

    const sessionToken = signSessionToken({
        user_id: user.user_id,
        role: user.role as never,
        phone_number: req.phone_number,
    });

    return {
        user_id: user.user_id,
        role: user.role as never,
        language: user.language as never,
        name: user.name,
        session_token: sessionToken,
    };
}

// ─── AUTH-FR-002: OTP Login ───────────────────────────────────────────────────

export async function loginWithOtp(req: LoginWithOtpRequest): Promise<LoginResponse> {
    assertValidPhone(req.phone_number);

    // Verify OTP first (throws on invalid/expired)
    await verifyOtp(req.phone_number, req.otp);

    const user = await queryOne<{
        user_id: string;
        role: string;
        language: string;
        name: string;
        is_active: boolean;
    }>(
        `SELECT user_id, role, language, name, is_active FROM users WHERE phone_number = $1`,
        [req.phone_number],
    );

    if (!user || !user.is_active) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'No account found for this phone number');
    }

    // Reset any PIN lockout on successful OTP login
    await query(
        `UPDATE users SET failed_pin_attempts = 0, locked_until = NULL WHERE user_id = $1`,
        [user.user_id],
    );

    await writeAuditLog(user.user_id, user.role as never, 'user.login', 'user', user.user_id, {
        method: 'otp',
    });

    const sessionToken = signSessionToken({
        user_id: user.user_id,
        role: user.role as never,
        phone_number: req.phone_number,
    });

    return {
        user_id: user.user_id,
        role: user.role as never,
        language: user.language as never,
        name: user.name,
        session_token: sessionToken,
    };
}

// ─── AUTH-FR-003: Profile management ─────────────────────────────────────────

export async function getProfile(userId: string): Promise<GetProfileResponse> {
    const user = await queryOne<{
        user_id: string;
        phone_number: string;
        role: string;
        language: string;
        name: string;
        school_id: string | null;
        created_at: Date;
    }>(
        `SELECT user_id, phone_number, role, language, name, school_id, created_at
     FROM users WHERE user_id = $1 AND is_active = TRUE`,
        [userId],
    );

    if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return {
        user_id: user.user_id,
        phone_number: user.phone_number,
        role: user.role as never,
        language: user.language as never,
        name: user.name,
        school_id: user.school_id,
        created_at: user.created_at.toISOString(),
    };
}

export async function updateProfile(
    userId: string,
    req: UpdateProfileRequest,
    currentRole: string,
): Promise<GetProfileResponse> {
    // If changing PIN, verify current PIN first
    if (req.new_pin) {
        assertValidPin(req.new_pin);
        if (!req.current_pin) {
            throw new AppError(422, 'CURRENT_PIN_REQUIRED', 'Current PIN required to set a new PIN');
        }

        const user = await queryOne<{ pin_hash: string }>(
            `SELECT pin_hash FROM users WHERE user_id = $1`,
            [userId],
        );
        if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

        const valid = await bcrypt.compare(req.current_pin, user.pin_hash);
        if (!valid) throw new AppError(401, 'INVALID_PIN', 'Current PIN is incorrect');

        const newHash = await bcrypt.hash(req.new_pin, PIN_BCRYPT_COST);
        await query(`UPDATE users SET pin_hash = $1 WHERE user_id = $2`, [newHash, userId]);
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (req.name) {
        updates.push(`name = $${idx++}`);
        values.push(req.name);
    }
    if (req.language) {
        updates.push(`language = $${idx++}`);
        values.push(req.language);
    }

    if (updates.length > 0) {
        values.push(userId);
        await query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx}`, values);
    }

    await writeAuditLog(userId, currentRole as never, 'user.profile_update', 'user', userId, {
        fields: Object.keys(req).filter((k) => k !== 'current_pin' && k !== 'new_pin'),
    });

    return getProfile(userId);
}

// ─── AUTH-FR-005: GDPR right to erasure ──────────────────────────────────────

export async function deleteAccount(
    userId: string,
    confirmationPin: string,
    acknowledgePermanent: boolean,
): Promise<void> {
    if (!acknowledgePermanent) {
        throw new AppError(422, 'ACKNOWLEDGEMENT_REQUIRED', 'Must acknowledge deletion is permanent');
    }

    const user = await queryOne<{ pin_hash: string; role: string }>(
        `SELECT pin_hash, role FROM users WHERE user_id = $1 AND is_active = TRUE`,
        [userId],
    );

    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    // Re-authenticate via PIN (AUTH-FR-005: requires re-authentication)
    const valid = await bcrypt.compare(confirmationPin, user.pin_hash);
    if (!valid) throw new AppError(401, 'INVALID_PIN', 'PIN confirmation failed');

    await withTransaction(async (client) => {
        // Delete user account and all child data (CASCADE handles children, sessions, etc.)
        // AUTH-FR-005: "deletes user account, all child profiles, all session and report data"
        await client.query(`DELETE FROM users WHERE user_id = $1`, [userId]);

        // Anonymize audit log entries (AUTH-FR-005: "anonymizes audit-log identifiers")
        await client.query(
            `UPDATE audit_logs SET actor_id = 'DELETED_USER' WHERE actor_id = $1`,
            [userId],
        );

        // Write final deletion audit entry (anonymized actor)
        await client.query(
            `INSERT INTO audit_logs (log_id, actor_id, actor_role, action, target_type, target_id, metadata)
       VALUES ($1, 'DELETED_USER', $2, 'user.delete', 'user', $3, $4)`,
            [uuidv4(), user.role, userId, JSON.stringify({ reason: 'gdpr_erasure' })],
        );
    });
}

// ─── Internal: audit log helper ──────────────────────────────────────────────

async function writeAuditLog(
    actorId: string,
    actorRole: string,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
): Promise<void> {
    await query(
        `INSERT INTO audit_logs (log_id, actor_id, actor_role, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), actorId, actorRole, action, targetType, targetId, JSON.stringify(metadata)],
    );
}
