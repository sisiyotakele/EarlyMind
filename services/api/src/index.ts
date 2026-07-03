/**
 * API service entry point
 * Traceability: Phase 0 — server startup; AUTH-NFR-003 (availability)
 */

import { checkDbConnection } from './db/client';
import { env } from './config/env';
import { createApp } from './app';

async function main(): Promise<void> {
    // Verify DB connectivity before accepting traffic (AUTH-NFR-003: graceful startup)
    try {
        await checkDbConnection();
        console.log('✅ Database connection verified');
    } catch (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
    }

    const app = createApp();

    const server = app.listen(env.PORT, () => {
        console.log(`🚀 EarlyMind API running on port ${env.PORT} [${env.NODE_ENV}]`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
        console.log(`\n${signal} received — shutting down gracefully`);
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
