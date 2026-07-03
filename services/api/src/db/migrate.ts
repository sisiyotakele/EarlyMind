/**
 * Database migration runner
 * Traceability: Phase 0 — DB-SCHEMA-001 through DB-SCHEMA-009
 *
 * Runs all SQL migration files in order (001_, 002_, ...).
 * Tracks applied migrations in a `schema_migrations` table to ensure idempotency.
 * Usage: npm run db:migrate
 */

import fs from 'fs';
import path from 'path';

import { Pool } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];

if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL or DATABASE_URL_TEST environment variable is required');
    process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate(): Promise<void> {
    const client = await pool.connect();
    try {
        // Create migrations tracking table if it doesn't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     TEXT        PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

        // Get already-applied migrations
        const { rows } = await client.query<{ version: string }>(
            'SELECT version FROM schema_migrations ORDER BY version ASC',
        );
        const applied = new Set(rows.map((r) => r.version));

        // Read migration files and sort them
        const migrationFiles = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort(); // lexicographic sort ensures 001, 002, ... order

        let newMigrations = 0;

        for (const file of migrationFiles) {
            if (applied.has(file)) {
                console.log(`  ✓ Already applied: ${file}`);
                continue;
            }

            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            console.log(`  → Applying: ${file}`);

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`  ✓ Applied: ${file}`);
                newMigrations++;
            } catch (err) {
                await client.query('ROLLBACK');
                throw new Error(`Migration failed for ${file}: ${String(err)}`);
            }
        }

        if (newMigrations === 0) {
            console.log('  Database is up to date.');
        } else {
            console.log(`\n  ✅ ${newMigrations} migration(s) applied successfully.`);
        }
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
});
