/**
 * AggregateAnalyticsPage — school-wide screening analytics
 * Traceability: DASH-SCHOOL-001, CON-PRIV-004/005, AUTH-FR-004 (school_admin only)
 *
 * CON-PRIV-004: NO individually identifiable student data shown
 * CON-PRIV-005: Only aggregate statistics, no individual reports
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SchoolAnalytics {
    school_name: string;
    total_children: number;
    screened_count: number;
    pending_count: number;
    screening_completion_rate: number;
    /** Aggregate only — no individual identifiers (CON-PRIV-004) */
    condition_summary: Record<string, number>;
    last_updated: string;
}

export default function AggregateAnalyticsPage() {
    const { t } = useTranslation();
    const [data, setData] = useState<SchoolAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch('/api/dashboard/school', { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: SchoolAnalytics };
                setData(json.data);
            } catch {
                setError(t('common.error'));
            } finally {
                setLoading(false);
            }
        })();
    }, [t]);

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;
    if (error) return <div className="error" role="alert">{error}</div>;
    if (!data) return null;

    const completionPct = Math.round(data.screening_completion_rate * 100);

    return (
        <main className="analytics-page" aria-labelledby="analytics-title">
            <h1 id="analytics-title">{data.school_name} — {t('dashboard.school.analytics', { defaultValue: 'Screening Analytics' })}</h1>
            <p className="analytics-page__updated">
                {t('dashboard.school.lastUpdated', { defaultValue: 'Last updated' })}: {new Date(data.last_updated).toLocaleString()}
            </p>

            {/* Summary cards — aggregate only (CON-PRIV-004) */}
            <div className="analytics-page__cards" role="list">
                <StatCard
                    label={t('dashboard.school.totalStudents', { defaultValue: 'Total Students' })}
                    value={data.total_children}
                    role="listitem"
                />
                <StatCard
                    label={t('dashboard.school.screened', { defaultValue: 'Screened' })}
                    value={data.screened_count}
                    role="listitem"
                />
                <StatCard
                    label={t('dashboard.school.pending', { defaultValue: 'Pending' })}
                    value={data.pending_count}
                    role="listitem"
                />
                <StatCard
                    label={t('dashboard.school.completionRate', { defaultValue: 'Completion Rate' })}
                    value={`${completionPct}%`}
                    role="listitem"
                />
            </div>

            {/* Completion progress bar */}
            <section aria-labelledby="completion-heading">
                <h2 id="completion-heading">
                    {t('dashboard.school.screeningProgress', { defaultValue: 'Screening Progress' })}
                </h2>
                <div
                    role="progressbar"
                    aria-valuenow={completionPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${completionPct}% ${t('dashboard.school.complete', { defaultValue: 'complete' })}`}
                    className="progress-bar"
                >
                    <div className="progress-bar__fill" style={{ width: `${completionPct}%` }} />
                    <span className="progress-bar__label">{completionPct}%</span>
                </div>
            </section>

            {/* Condition distribution — aggregate counts only, no names/IDs */}
            {Object.keys(data.condition_summary).length > 0 && (
                <section aria-labelledby="conditions-heading">
                    <h2 id="conditions-heading">
                        {t('dashboard.school.conditionDistribution', { defaultValue: 'Areas of Concern (Aggregate)' })}
                    </h2>
                    <p className="analytics-page__privacy-note">
                        {t('dashboard.school.privacyNote', { defaultValue: 'Aggregate data only. Individual student results are not shown here.' })}
                    </p>
                    <ul className="analytics-page__conditions">
                        {Object.entries(data.condition_summary).map(([condition, count]) => (
                            <li key={condition} className="analytics-page__condition-item">
                                <span>{condition.replace(/_/g, ' ')}</span>
                                <span className="analytics-page__condition-count">{count}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );
}

function StatCard({ label, value, role }: { label: string; value: string | number; role?: string }) {
    return (
        <div className="stat-card" role={role as React.AriaRole}>
            <div className="stat-card__value" aria-label={`${label}: ${value}`}>{value}</div>
            <div className="stat-card__label">{label}</div>
        </div>
    );
}
