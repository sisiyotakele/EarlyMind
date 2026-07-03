/**
 * PostgreSQL connection pool
 * Traceability: Phase 0 — DB client; CON-PRIV-002/003 (encrypted storage/transit)
 */

import { Pool } from 'pg';

import { env } from '../config/env';

const connectionString =
    env.NODE_ENV === 'test'
        ? (env.DATABASE_URL_TEST ?? env.DATABASE_URL)
        : env.DATABASE_URL;

if (!connectionString) {
    console.error('ERROR: No database connection string configured.');
    process.exit(1);
}

export const db = new Pool({
    connectionString,
    // Connection pool sizing (SRS §2.4.3: 2-4 web server instances, ~10 connections each)
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // ssl: in production this is enforced via RDS parameter group (CON-PRIV-003)
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

// Verify connectivity on startup
db.on('error', (err) => {
    console.error('Unexpected error on idle DB client', err);
});

export async function checkDbConnection(): Promise<void> {
    const client = await db.connect();
    client.release();
}
