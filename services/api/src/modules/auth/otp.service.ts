/**
 * OTP Service
 * Traceability: AUTH-FR-001/002 (OTP generation, delivery, verification)
 * AUTH-NFR-001: OTPs stored as bcrypt hashes (not plaintext)
 * CON-TECH-003: SMS/in-app OTP only (no email)
 */

import crypto from 'crypto';

import bcrypt from 'bcrypt';

import { env } from '../../config/env';
import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';

const BCRYPT_COST = 10; // Lower than PIN (10) because OTPs expire in 5 min; pins persist

/**
 * Generate a cryptographically random 6-digit OTP string.
 * AUTH-FR-001: "system sends a 6-digit SMS OTP, valid 5 minutes"
 */
export function generateOtp(): string {
    // Generate 3 random bytes -> 0-16777215, modulo 1000000 -> 6 digits
    const bytes = crypto.randomBytes(3);
    const num = (bytes.readUIntBE(0, 3) % 1_000_000).toString().padStart(6, '0');
    return num;
}

/**
 * Checks if the user is within rate limit before requesting a new OTP.
 * AUTH-FR-001/002: max 3 resend requests/hour/phone
 */
export async function checkOtpRateLimit(phone_number: string): Promise<void> {
    const { rows } = await db.query<{
        otp_request_count: number;
        last_otp_window_start: Date | null;
    }>(
        `SELECT otp_request_count, last_otp_window_start
     FROM users
     WHERE phone_number = $1 AND deleted_at IS NULL`,
        [phone_number],
    );

    if (rows.length === 0) return; // New user, no rate limit yet

    const user = rows[0];
    if (!user) return;

    const now = new Date();
    const windowStart = user.last_otp_window_start;
    const windowExpiry = windowStart ? new Date(windowStart.getTime() + 60 * 60 * 1000) : null;

    // If we're still within the same hourly window, check count
    if (windowExpiry && now < windowExpiry) {
        if (user.otp_request_count >= env.OTP_MAX_RESENDS_PER_HOUR) {
            throw new AppError(
                429,
                'OTP_RATE_LIMIT',
                `Maximum ${env.OTP_MAX_RESENDS_PER_HOUR} OTP requests per hour exceeded. Try again later.`,
            );
        }
    }
}

/**
 * Stores hashed OTP in the users table and sends SMS.
 * Returns the plaintext OTP (for test environments only — not returned to callers in prod).
 */
export async function createAndSendOtp(
    phone_number: string,
    userId?: string,
): Promise<string> {
    await checkOtpRateLimit(phone_number);

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_COST);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000);
    const now = new Date();

    if (userId) {
        // Existing user: update their OTP fields and track rate limit
        await db.query(
            `UPDATE users
       SET otp_hash = $1,
           otp_expires_at = $2,
           otp_request_count = CASE
             WHEN last_otp_window_start IS NULL OR last_otp_window_start < NOW() - INTERVAL '1 hour'
             THEN 1
             ELSE otp_request_count + 1
           END,
           last_otp_window_start = CASE
             WHEN last_otp_window_start IS NULL OR last_otp_window_start < NOW() - INTERVAL '1 hour'
             THEN $3
             ELSE last_otp_window_start
           END
       WHERE user_id = $4`,
            [otpHash, expiresAt, now, userId],
        );
    } else {
        // Pending registration: store in a temporary table (or cache)
        // We use a separate pending_registrations table for pre-registration OTPs
        await db.query(
            `INSERT INTO pending_registrations (phone_number, otp_hash, otp_expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (phone_number) DO UPDATE
       SET otp_hash = $2, otp_expires_at = $3, created_at = NOW()`,
            [phone_number, otpHash, expiresAt],
        );
    }

    // Send SMS (CON-TECH-003: SMS gateway integration)
    await sendSms(phone_number, otp);

    return otp; // Only used in test environment
}

/**
 * Verifies a submitted OTP for a user or pending registration.
 * AUTH-FR-001/002: OTP valid 5 minutes
 */
export async function verifyOtp(
    phone_number: string,
    submittedOtp: string,
    userId?: string,
): Promise<void> {
    let otpHash: string | null = null;
    let otpExpiresAt: Date | null = null;

    if (userId) {
        const { rows } = await db.query<{ otp_hash: string | null; otp_expires_at: Date | null }>(
            `SELECT otp_hash, otp_expires_at FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
            [userId],
        );
        if (rows[0]) {
            otpHash = rows[0].otp_hash;
            otpExpiresAt = rows[0].otp_expires_at;
        }
    } else {
        const { rows } = await db.query<{ otp_hash: string; otp_expires_at: Date }>(
            `SELECT otp_hash, otp_expires_at FROM pending_registrations WHERE phone_number = $1`,
            [phone_number],
        );
        if (rows[0]) {
            otpHash = rows[0].otp_hash;
            otpExpiresAt = rows[0].otp_expires_at;
        }
    }

    if (!otpHash || !otpExpiresAt) {
        throw new AppError(400, 'INVALID_OTP', 'No pending OTP found. Please request a new one.');
    }

    if (new Date() > otpExpiresAt) {
        throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.');
    }

    const isValid = await bcrypt.compare(submittedOtp, otpHash);
    if (!isValid) {
        throw new AppError(400, 'INVALID_OTP', 'Invalid OTP. Please check and try again.');
    }

    // Clear OTP after successful verification
    if (userId) {
        await db.query(
            `UPDATE users SET otp_hash = NULL, otp_expires_at = NULL WHERE user_id = $1`,
            [userId],
        );
    } else {
        await db.query(`DELETE FROM pending_registrations WHERE phone_number = $1`, [phone_number]);
    }
}

/**
 * SMS gateway integration (CON-TECH-003)
 * Falls back to console logging in dev/test environments.
 */
async function sendSms(phone_number: string, otp: string): Promise<void> {
    if (env.NODE_ENV !== 'production') {
        // Dev/test: log OTP to console (never do this in production)
        console.warn(`[DEV-ONLY] OTP for ${phone_number}: ${otp}`);
        return;
    }

    if (!env.SMS_GATEWAY_URL || !env.SMS_GATEWAY_API_KEY) {
        throw new AppError(503, 'SMS_UNAVAILABLE', 'SMS service is not configured.');
    }

    const message = `Your EarlyMind verification code is: ${otp}. Valid for ${Math.floor(env.OTP_EXPIRY_SECONDS / 60)} minutes.`;

    const response = await fetch(env.SMS_GATEWAY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.SMS_GATEWAY_API_KEY}`,
        },
        body: JSON.stringify({ to: phone_number, message }),
    });

    if (!response.ok) {
        throw new AppError(503, 'SMS_DELIVERY_FAILED', 'Failed to send OTP via SMS. Please try again.');
    }
}
