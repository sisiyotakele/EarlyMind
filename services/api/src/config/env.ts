/**
 * Environment configuration with Zod validation
 * Traceability: Phase 0 setup; AUTH-NFR-001 (session secret), CON-PRIV-003 (HTTPS)
 *
 * Fails fast at startup if required variables are missing — prevents silent misconfiguration.
 */

import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),

    // Database — DR-001 through DR-009
    DATABASE_URL: z.string().url().optional(),
    DATABASE_URL_TEST: z.string().url().optional(),

    // AUTH-NFR-001: session secret must have >= 128-bit entropy (32 hex chars = 128 bits)
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
    SESSION_EXPIRY_DAYS: z.coerce.number().int().min(1).max(30).default(7),

    // AUTH-FR-002: PIN lockout config
    PIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
    PIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),

    // AUTH-FR-001: OTP config
    OTP_EXPIRY_SECONDS: z.coerce.number().int().min(60).default(300), // 5 minutes
    OTP_MAX_RESENDS_PER_HOUR: z.coerce.number().int().min(1).default(3),

    // CON-TECH-003: SMS gateway
    SMS_GATEWAY_URL: z.string().url().optional(),
    SMS_GATEWAY_API_KEY: z.string().optional(),

    // REPORT-FR-001: Gemini API (fallback to templates if absent)
    GEMINI_API_KEY: z.string().optional(),

    // AWS — CON-PRIV-002: encrypted storage
    AWS_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_REPORTS: z.string().default('earlymind-reports'),
    S3_BUCKET_MODELS: z.string().default('earlymind-models'),

    // ML Service — SRS §9.3
    ML_SERVICE_URL: z.string().url().default('http://localhost:8000'),

    // CORS
    CORS_ALLOWED_ORIGINS: z
        .string()
        .default('http://localhost:5173')
        .transform((s) => s.split(',').map((o) => o.trim())),

    // Sentry (optional)
    SENTRY_DSN: z.string().optional(),
});

function loadEnv() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error('❌ Invalid environment configuration:');
        parsed.error.issues.forEach((issue) => {
            console.error(`  ${issue.path.join('.')}: ${issue.message}`);
        });
        process.exit(1);
    }
    return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
