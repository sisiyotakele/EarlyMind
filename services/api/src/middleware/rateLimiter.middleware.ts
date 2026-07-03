/**
 * Rate limiter middleware
 * Traceability: SRS §2.4.4 (WAF: 100 req/min/IP), AUTH-FR-001/002 (OTP rate limiting)
 * SEC-NFR-004 (OWASP A07 rate limiting)
 */

import rateLimit from 'express-rate-limit';

/** General API rate limit: 100 requests/minute per IP (SRS §2.4.4) */
export const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' },
    },
});

/** Auth rate limit: 10 requests/minute per IP (stricter for login/register) */
export const authRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    message: {
        success: false,
        error: { code: 'AUTH_RATE_LIMIT', message: 'Too many authentication attempts.' },
    },
});
