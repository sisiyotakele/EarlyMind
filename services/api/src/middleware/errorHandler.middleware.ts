/**
 * Global error handler middleware
 * Traceability: SEC-NFR-004 (never expose stack traces in production)
 */

import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(process.env['NODE_ENV'] !== 'production' && err.details
                    ? { details: err.details }
                    : {}),
            },
        });
        return;
    }

    // Unexpected error — log but don't expose internals
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
    });
}
