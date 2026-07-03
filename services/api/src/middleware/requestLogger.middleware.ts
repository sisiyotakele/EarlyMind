/**
 * Request logger middleware
 * Traceability: Section 11.3 (monitoring and logging)
 * Never logs request bodies (may contain PINs/OTPs — CON-PRIV-002)
 */

import type { NextFunction, Request, Response } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, path: reqPath } = req;

    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        // Sanitize path to not log UUIDs verbatim (privacy)
        const sanitizedPath = reqPath.replace(
            /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
            ':id',
        );
        console.warn(`${method} ${sanitizedPath} ${status} ${duration}ms`);
    });

    next();
}
