/**
 * SystemHealthPage — EAII admin system monitoring
 * Traceability: DASH-EAII-001, SRS §11.3
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HealthStatus {
    api: 'healthy' | 'degraded' | 'down';
    ml_service: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
    model_version: string;
    active_sessions: number;
    total_sessions_today: number;
    uptime_pct: number;
    last_checked: string;
}

export default function SystemHealthPage() {
    const { t } = useTranslation();
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch('/api/admin/system-health', { credentials: 'include' });
                const json = (await res.json()) as { success: boolean; data: HealthStatus };
                setHealth(json.data);
            } catch {
                // Show degraded state
            } finally {
                setLoading(false);
            }
        };

        void fetchHealth();
        const interval = setInterval(() => void fetchHealth(), 30_000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;

    return (
        <main className="system-health" aria-labelledby="health-title">
            <h1 id="health-title">{t('dashboard.eaii.systemHealth', { defaultValue: 'System Health' })}</h1>
            {health && (
                <>
                    <div className="system-health__cards" role="list">
                        <HealthCard label="API" status={health.api} />
                        <HealthCard label="ML Service" status={health.ml_service} />
                        <HealthCard label="Database" status={health.database} />
                    </div>
                    <dl className="system-health__stats">
                        <dt>Model Version</dt><dd>{health.model_version}</dd>
                        <dt>Active Sessions</dt><dd>{health.active_sessions}</dd>
                        <dt>Sessions Today</dt><dd>{health.total_sessions_today}</dd>
                        <dt>Uptime (30d)</dt><dd>{health.uptime_pct.toFixed(2)}%</dd>
                        <dt>Last Checked</dt><dd>{new Date(health.last_checked).toLocaleTimeString()}</dd>
                    </dl>
                </>
            )}
        </main>
    );
}

function HealthCard({ label, status }: { label: string; status: string }) {
    const color = { healthy: 'green', degraded: 'yellow', down: 'red' }[status] ?? 'gray';
    return (
        <div className={`health-card health-card--${color}`} role="listitem" aria-label={`${label}: ${status}`}>
            <span className="health-card__indicator" aria-hidden="true" />
            <span className="health-card__label">{label}</span>
            <span className="health-card__status">{status}</span>
        </div>
    );
}
