/**
 * AuditLogPage — EAII admin immutable audit trail viewer
 * Traceability: DASH-EAII-004, SEC-NFR-006, CON-PRIV-005
 * Retention: 7 years (SRS §7.4)
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AuditEntry {
    log_id: string;
    actor_id: string;
    actor_role: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    ip_address: string | null;
    timestamp: string;
}

export default function AuditLogPage() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const loadPage = async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/audit-logs?page=${p}&limit=50`, { credentials: 'include' });
            const json = (await res.json()) as { success: boolean; data: { entries: AuditEntry[]; has_more: boolean } };
            if (p === 1) setLogs(json.data.entries);
            else setLogs((prev) => [...prev, ...json.data.entries]);
            setHasMore(json.data.has_more);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void loadPage(1); }, []);

    return (
        <main className="audit-log" aria-labelledby="audit-title">
            <h1 id="audit-title">{t('dashboard.eaii.auditLog', { defaultValue: 'Audit Log' })}</h1>
            <p className="audit-log__note">
                {t('dashboard.eaii.auditRetention', { defaultValue: 'Logs retained for 7 years. Immutable — no edits or deletions.' })}
            </p>

            <div className="audit-log__table-wrapper" role="region" aria-label="Audit entries">
                <table className="audit-log__table">
                    <thead>
                        <tr>
                            <th scope="col">Timestamp</th>
                            <th scope="col">Actor</th>
                            <th scope="col">Role</th>
                            <th scope="col">Action</th>
                            <th scope="col">Target</th>
                            <th scope="col">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((entry) => (
                            <tr key={entry.log_id}>
                                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                                <td className="audit-log__actor">{entry.actor_id.slice(0, 8)}…</td>
                                <td>{entry.actor_role}</td>
                                <td><code>{entry.action}</code></td>
                                <td>{entry.target_type ?? '—'} {entry.target_id ? entry.target_id.slice(0, 8) + '…' : ''}</td>
                                <td>{entry.ip_address ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {hasMore && (
                <button
                    className="btn btn--secondary"
                    onClick={() => { const next = page + 1; setPage(next); void loadPage(next); }}
                    disabled={loading}
                >
                    {loading ? t('common.loading') : t('dashboard.eaii.loadMore', { defaultValue: 'Load more' })}
                </button>
            )}
        </main>
    );
}
