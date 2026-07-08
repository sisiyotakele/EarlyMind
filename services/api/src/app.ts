/**
 * Express application setup
 * Traceability:
 *   SEC-NFR-001 — HTTPS-only, HSTS (enforced at ALB/CloudFront in prod; Content-Security-Policy via helmet)
 *   SEC-NFR-004 — OWASP Top 10 mitigations (helmet, rate limiting, CORS)
 *   AUTH-NFR-002 — rate limiting on auth endpoints
 *   CON-PRIV-003 — TLS enforced in prod via ALB; here we set security headers
 *   SRS §2.4.4 — WAF + headers
 */

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { requireAuth } from './middleware/auth.middleware';
import { authRoutes, userRoutes } from './modules/auth/auth.routes';
import { childrenRoutes } from './modules/children/children.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { sessionRoutes } from './modules/sessions/sessions.routes';
import { handleGetSessionMeta } from './modules/sessions/sessions.meta';

export function createApp(): express.Express {
    const app = express();

    // ─── Security headers (SEC-NFR-001/004, SRS §2.4.4) ─────────────────────
    app.use(
        helmet({
            // Content-Security-Policy
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"], // Needed for inline styles in PWA
                    imgSrc: ["'self'", 'data:', 'https:'],
                    fontSrc: ["'self'"],
                    connectSrc: ["'self'", env.ML_SERVICE_URL],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                },
            },
            // HSTS — max-age 1 year, include subdomains (SEC-NFR-001)
            hsts: {
                maxAge: 31_536_000,
                includeSubDomains: true,
                preload: true,
            },
            referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        }),
    );

    // ─── CORS (SRS §2.4.4: cross-origin only from allowed origins) ───────────
    app.use(
        cors({
            origin: env.CORS_ALLOWED_ORIGINS,
            credentials: true, // allow httpOnly cookies (AUTH-NFR-001)
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }),
    );

    // ─── Body parsing ─────────────────────────────────────────────────────────
    app.use(express.json({ limit: '1mb' })); // feature vectors are ~50KB (SRS §2.4.2)
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());

    // ─── Request logging ──────────────────────────────────────────────────────
    app.use(requestLogger);

    // ─── Health check (monitoring, Section 11.3) ─────────────────────────────
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // ─── API routes (SRS Section 9.1) ────────────────────────────────────────
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/children', childrenRoutes);
    app.use('/api/sessions', sessionRoutes);
    // Session meta (for GameSessionPage)
    app.get('/api/sessions/:id/meta', requireAuth, handleGetSessionMeta);
    // Dashboard + admin routes (DASH-SCHOOL, DASH-EAII, SRS §9.1)
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/admin', dashboardRoutes);
    app.use('/api/export', dashboardRoutes);

    // ─── 404 handler ─────────────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
    });

    // ─── Global error handler ─────────────────────────────────────────────────
    app.use(errorHandler);

    return app;
}
