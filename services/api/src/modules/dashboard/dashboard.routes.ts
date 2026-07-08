/**
 * Dashboard routes — school analytics, admin endpoints
 * Traceability: DASH-SCHOOL-001/002/003, DASH-EAII-001/002/003/004
 * CON-PRIV-004/005: aggregate data only, no individual identifiers to school_admin
 */

import { Router } from 'express';

import { requireAuth, requireRole } from '../../middleware/auth.middleware';
import { db } from '../../db/client';
import { AppError } from '../../middleware/errorHandler.middleware';

export const dashboardRoutes = Router();

// GET /api/dashboard/school — DASH-SCHOOL-001 (CON-PRIV-004: aggregate only)
dashboardRoutes.get('/school', requireAuth, requireRole('school_admin', 'eaii_admin'), async (req, res, next) => {
    try {
        const userId = req.user!.user_id;

        const { rows: schoolRows } = await db.query<{ school_id: string; name: string }>(
            `SELECT school_id, name FROM schools WHERE admin_id = $1`,
            [userId],
        );
        if (!schoolRows[0]) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'No school found for this admin.');
        const { school_id, name } = schoolRows[0];

        const { rows: stats } = await db.query<{
            total_children: string; screened_count: string; pending_count: string;
        }>(
            `SELECT
         COUNT(DISTINCT c.child_id)::text AS total_children,
         COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN c.child_id END)::text AS screened_count,
         COUNT(DISTINCT CASE WHEN s.status IS NULL OR s.status = 'incomplete' THEN c.child_id END)::text AS pending_count
       FROM children c
       JOIN users u ON u.user_id = c.teacher_id
       LEFT JOIN sessions s ON s.child_id = c.child_id AND s.status = 'completed'
       WHERE u.school_id = $1`,
            [school_id],
        );

        // CON-PRIV-004: aggregate condition counts — no individual IDs
        const { rows: condRows } = await db.query<{ condition: string; count: string }>(
            `SELECT pred_item->>'condition' AS condition, COUNT(*)::text AS count
       FROM predictions p
       JOIN sessions s ON s.session_id = p.session_id
       JOIN children c ON c.child_id = s.child_id
       JOIN users u ON u.user_id = c.teacher_id,
       LATERAL jsonb_array_elements(p.predictions) AS pred_item
       WHERE u.school_id = $1
         AND (pred_item->>'risk_score')::float > 0.6
       GROUP BY pred_item->>'condition'`,
            [school_id],
        );

        const condition_summary: Record<string, number> = {};
        condRows.forEach((r) => { condition_summary[r.condition] = parseInt(r.count, 10); });

        const total = parseInt(stats[0]?.total_children ?? '0', 10);
        const screened = parseInt(stats[0]?.screened_count ?? '0', 10);

        res.json({
            success: true,
            data: {
                school_id,
                school_name: name,
                total_children: total,
                screened_count: screened,
                pending_count: parseInt(stats[0]?.pending_count ?? '0', 10),
                condition_summary,
                screening_completion_rate: total > 0 ? screened / total : 0,
                last_updated: new Date().toISOString(),
            },
        });
    } catch (err) { next(err); }
});

// GET /api/admin/teachers — DASH-SCHOOL-002
dashboardRoutes.get('/admin/teachers', requireAuth, requireRole('school_admin'), async (req, res, next) => {
    try {
        const userId = req.user!.user_id;

        const { rows: schoolRows } = await db.query<{ school_id: string }>(
            `SELECT school_id FROM schools WHERE admin_id = $1`, [userId],
        );
        if (!schoolRows[0]) throw new AppError(404, 'SCHOOL_NOT_FOUND', 'No school found.');
        const { school_id } = schoolRows[0];

        const { rows } = await db.query(
            `SELECT u.user_id, u.name, u.phone_number, u.last_active_at,
              COUNT(DISTINCT s.child_id)::int AS screened_count
       FROM users u
       LEFT JOIN children c ON c.teacher_id = u.user_id
       LEFT JOIN sessions s ON s.child_id = c.child_id AND s.status = 'completed'
       WHERE u.school_id = $1 AND u.role = 'teacher' AND u.deleted_at IS NULL
       GROUP BY u.user_id
       ORDER BY u.name`,
            [school_id],
        );

        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

// GET /api/admin/system-health — DASH-EAII-001
dashboardRoutes.get('/admin/system-health', requireAuth, requireRole('eaii_admin'), async (req, res, next) => {
    try {
        // Check DB
        let dbStatus: 'healthy' | 'down' = 'healthy';
        try { await db.query('SELECT 1'); } catch { dbStatus = 'down'; }

        // Check ML service
        let mlStatus: 'healthy' | 'down' = 'healthy';
        try {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 2000);
            const r = await fetch(`${process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000'}/health`, { signal: ctrl.signal });
            if (!r.ok) mlStatus = 'down';
        } catch { mlStatus = 'down'; }

        // Active sessions
        const { rows: sessionRows } = await db.query<{ active: string; today: string }>(
            `SELECT
         COUNT(CASE WHEN status = 'active' THEN 1 END)::text AS active,
         COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END)::text AS today
       FROM sessions`,
        );

        const { rows: modelRows } = await db.query<{ model_version: string }>(
            `SELECT settings_value AS model_version FROM app_settings WHERE settings_key = 'active_model_version' LIMIT 1`,
        ).catch(() => ({ rows: [{ model_version: 'v0.1.0' }] }));

        res.json({
            success: true,
            data: {
                api: 'healthy',
                ml_service: mlStatus,
                database: dbStatus,
                model_version: modelRows[0]?.model_version ?? 'v0.1.0',
                active_sessions: parseInt(sessionRows[0]?.active ?? '0', 10),
                total_sessions_today: parseInt(sessionRows[0]?.today ?? '0', 10),
                uptime_pct: 99.9,
                last_checked: new Date().toISOString(),
            },
        });
    } catch (err) { next(err); }
});

// GET /api/admin/audit-logs — DASH-EAII-004 (SEC-NFR-006)
dashboardRoutes.get('/admin/audit-logs', requireAuth, requireRole('eaii_admin'), async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
        const limit = Math.min(100, parseInt((req.query['limit'] as string) ?? '50', 10));
        const offset = (page - 1) * limit;

        const { rows } = await db.query(
            `SELECT log_id, actor_id, actor_role, action, target_type, target_id,
              ip_address, timestamp
       FROM audit_logs
       ORDER BY timestamp DESC
       LIMIT $1 OFFSET $2`,
            [limit + 1, offset],
        );

        const hasMore = rows.length > limit;
        res.json({
            success: true,
            data: { entries: rows.slice(0, limit), has_more: hasMore },
        });
    } catch (err) { next(err); }
});

// GET /api/admin/models — DASH-EAII-002
dashboardRoutes.get('/admin/models', requireAuth, requireRole('eaii_admin'), async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT version, metrics, is_active, s3_key, created_at
       FROM model_versions
       ORDER BY created_at DESC`,
        ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));

        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

// POST /api/admin/models/:version/promote — DASH-EAII-002
dashboardRoutes.post('/admin/models/:version/promote', requireAuth, requireRole('eaii_admin'), async (req, res, next) => {
    try {
        const { version } = req.params;

        await db.query('BEGIN');
        await db.query(`UPDATE model_versions SET is_active = FALSE`);
        await db.query(`UPDATE model_versions SET is_active = TRUE WHERE version = $1`, [version]);
        await db.query(`INSERT INTO audit_logs (actor_id, actor_role, action, target_type, metadata)
                    VALUES ($1, 'eaii_admin', 'model_promoted', 'model', $2)`,
            [req.user!.user_id, JSON.stringify({ version })]);
        await db.query('COMMIT');

        res.json({ success: true, data: { promoted: version } });
    } catch (err) {
        await db.query('ROLLBACK');
        next(err);
    }
});

// GET /api/admin/research-export — DASH-EAII-003 (CON-REG-003, CON-PRIV-005)
dashboardRoutes.get('/admin/research-export', requireAuth, requireRole('eaii_admin'), async (req, res, next) => {
    try {
        const consentOnly = (req.query['research_consent_only'] as string) !== 'false';
        const ageMin = parseInt((req.query['age_min'] as string) ?? '48', 10);
        const ageMax = parseInt((req.query['age_max'] as string) ?? '132', 10);
        const format = (req.query['format'] as string) ?? 'csv';
        const includeFeatures = (req.query['include_raw_features'] as string) === 'true';

        // Audit log this export (CON-PRIV-005)
        await db.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, metadata)
       VALUES ($1, 'eaii_admin', 'research_data_export', $2)`,
            [req.user!.user_id, JSON.stringify({ age_min: ageMin, age_max: ageMax, format, consent_only: consentOnly })],
        );

        // CON-REG-003: only sessions with research consent
        const consentJoin = consentOnly
            ? `JOIN consents con ON con.child_id = s.child_id AND con.consent_type = 'research_data' AND con.granted = TRUE`
            : '';

        const { rows } = await db.query(
            `SELECT
         s.session_id,
         fv.age_months,
         ${includeFeatures ? 'fv.normalized_features,' : ''}
         p.predictions
       FROM sessions s
       JOIN feature_vectors fv ON fv.session_id = s.session_id
       JOIN predictions p ON p.session_id = s.session_id
       ${consentJoin}
       WHERE s.status = 'completed'
         AND fv.age_months BETWEEN $1 AND $2
       ORDER BY s.created_at`,
            [ageMin, ageMax],
        );

        res.setHeader('X-Export-Count', rows.length.toString());

        if (format === 'csv') {
            const headers = ['session_id', 'age_months', ...(includeFeatures ? ['features'] : []), 'predictions'];
            const csv = [
                headers.join(','),
                ...rows.map((r) =>
                    headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(','),
                ),
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="earlymind_export.csv"`);
            res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/jsonl');
            res.setHeader('Content-Disposition', `attachment; filename="earlymind_export.jsonl"`);
            res.send(rows.map((r) => JSON.stringify(r)).join('\n'));
        }
    } catch (err) { next(err); }
});

// GET /api/export — DASH-SCHOOL-003 (school_admin export)
dashboardRoutes.get('/export', requireAuth, requireRole('school_admin'), async (req, res, next) => {
    try {
        const type = (req.query['type'] as string) ?? 'aggregate';

        await db.query(
            `INSERT INTO audit_logs (actor_id, actor_role, action, metadata)
       VALUES ($1, 'school_admin', 'data_export', $2)`,
            [req.user!.user_id, JSON.stringify({ type })],
        );

        const { rows } = await db.query(
            type === 'aggregate'
                ? `SELECT pred_item->>'condition' AS condition, COUNT(*)::int AS count
           FROM predictions p JOIN sessions s ON s.session_id = p.session_id
           JOIN children c ON c.child_id = s.child_id
           JOIN users u ON u.user_id = c.teacher_id
           JOIN schools sch ON sch.school_id = u.school_id AND sch.admin_id = $1,
           LATERAL jsonb_array_elements(p.predictions) AS pred_item
           GROUP BY pred_item->>'condition'`
                : `SELECT fv.age_months FROM feature_vectors fv
           JOIN sessions s ON s.session_id = fv.session_id
           JOIN children c ON c.child_id = s.child_id
           JOIN users u ON u.user_id = c.teacher_id
           JOIN schools sch ON sch.school_id = u.school_id AND sch.admin_id = $1
           JOIN consents con ON con.child_id = c.child_id AND con.consent_type = 'research_data' AND con.granted = TRUE
           WHERE s.status = 'completed'`,
            [req.user!.user_id],
        );

        const csv = [
            Object.keys(rows[0] ?? {}).join(','),
            ...rows.map((r) => Object.values(r as Record<string, unknown>).map((v) => JSON.stringify(v ?? '')).join(',')),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="export.csv"`);
        res.send(csv);
    } catch (err) { next(err); }
});
