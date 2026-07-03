/**
 * OTP Service
 *
 * Generates, stores, and verifies 6-digit SMS OTPs.
 *
 * Business rules from SRS AUTH-FR-001:
 *   - OTP valid 5 minutes (OTP_EXPIRY_SECONDS = 300)
 *   - Max 3 resend requests per hour per phone number
 *
 * Traceability: AUTH-FR-001, AUTH-FR-002, CON-TECH-003 (no email auth)
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../../db/client';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler.middleware';

// OTP is 6 digits per SRS AUTH-FR-001
const OTP_DIGITS = 6;
const BCRYPT_COST = 10; // OTP codes are short-lived; lower cost than PIN (AUTH-NFR-001)

/** Generate a cryptographically random 6-digit OTP string. */
function generateOtpCode(): string {
    // Use crypto.getRandomValues for uniform distribution (not Math.random)
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const code = (array[0]! % 1_000_000).toString().padStart(OTP_DIGITS, '0');
    return code;
}

/**
 * Request a new OTP for a phone number.
 * Enforces: max 3 resends per hour per phone (AUTH-FR-001).
 * Returns the plaintext code to be sent via SMS (never stored).
 */
export async function requestOtp(phoneNumber: string): Promise<{
    code: string;
    expiresAt: Date;
    resendsRemaining: number;
}> {
    // Check resend rate limit (AUTH-FR-001: max 3 resend requests/hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSends = await query<{ count: string }>(
        `SELECT COUNT(*) FROM otp_resend_log
     WHERE phone_number = $1 AND sent_at > $2`,
        [phoneNumber, oneHourAgo],
    );

    const sendCount = parseInt(recentSends[0]?.count ?? '0', 10);
    const maxResends = env.OTP_MAX_RESENDS_PER_HOUR;

    if (sendCount >= maxResends) {
        throw new AppError(
            429,
            'OTP_RATE_LIMITED',
            `Maximum ${maxResends} OTP requests per hour exceeded. Try again later.`,
        );
    }

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_COST);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000);

    // Invalidate any existing unused OTPs for this number
    await query(
        `UPDATE otp_codes SET used = TRUE
     WHERE phone_number = $1 AND used = FALSE AND expires_at > NOW()`,
        [phoneNumber],
    );

    // Store the new OTP hash
    await query(
        `INSERT INTO otp_codes (otp_id, phone_number, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
        [uuidv4(), phoneNumber, codeHash, expiresAt],
    );

    // Log the send for rate limiting
    await query(
        `INSERT INTO otp_resend_log (phone_number) VALUES ($1)`,
        [phoneNumber],
    );

    return {
        code, // caller sends this via SMS gateway
        expiresAt,
        resendsRemaining: maxResends - sendCount - 1,
    };
}

/**
 * Verify a submitted OTP.
 * Marks it used on success; throws AppError on invalid/expired/used.
 *
 * Traceability: AUTH-FR-001, AUTH-FR-002
 */
export async function verifyOtp(phoneNumber: string, submittedCode: string): Promise<void> {
    const otpRow = await queryOne<{ otp_id: string; code_hash: string; expires_at: Date; used: boolean }>(
        `SELECT otp_id, code_hash, expires_at, used
     FROM otp_codes
     WHERE phone_number = $1 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
        [phoneNumber],
    );

    if (!otpRow) {
        throw new AppError(401, 'OTP_INVALID', 'OTP is invalid or has expired');
    }

    const valid = await bcrypt.compare(submittedCode, otpRow.code_hash);

    if (!valid) {
        throw new AppError(401, 'OTP_INVALID', 'OTP is invalid or has expired');
    }

    // Mark used — one-time use
    await query(`UPDATE otp_codes SET used = TRUE WHERE otp_id = $1`, [otpRow.otp_id]);
}
