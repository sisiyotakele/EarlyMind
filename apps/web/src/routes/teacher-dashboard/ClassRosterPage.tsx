/**
 * ClassRosterPage — teacher view of all students
 * Traceability: DASH-TEACHER-001, CON-PRIV-004 (no raw behavioral data)
 * AUTH-FR-004: teacher role only
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ChildSummary {
    child_id: string;
    name: string;
    age_years: number;
    last_session_date: string | null;
    last_session_status: 'completed' | 'incomplete' | 'active' | null;
    /** CON-PRIV-004: summary only — no raw data exposed to teachers */
    screening_summary: 'not_screened' | 'screened_low' | 'screened_moderate' | 'screened_high' | null;
}

export default function ClassRosterPage() {
    const { t } = useTranslation();
    const [children, setChildren] = useState<ChildSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch('/api/children', { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: ChildSummary[] };
                setChildren(json.data);
            } catch {
                setError(t('common.error'));
            } finally {
                setLoading(false);
            }
        })();
    }, [t]);

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;
    if (error) return <div className="error" role="alert">{error}</div>;

    return (
        <main className="class-roster" aria-labelledby="roster-title">
            <div className="class-roster__header">
                <h1 id="roster-title">{t('dashboard.teacher.classRoster', { defaultValue: 'Class Roster' })}</h1>
                <Link to="/teacher/bulk-screening" className="btn btn--primary">
                    {t('dashboard.teacher.bulkScreening', { defaultValue: 'Start Bulk Screening' })}
                </Link>
            </div>

            {children.length === 0 ? (
                <p>{t('dashboard.teacher.noStudents', { defaultValue: 'No students found. Add students to begin screening.' })}</p>
            ) : (
                <div className="class-roster__table-wrapper" role="region" aria-label="Student list">
                    <table className="class-roster__table" aria-label={t('dashboard.teacher.classRoster')}>
                        <thead>
                            <tr>
                                <th scope="col">{t('dashboard.teacher.name', { defaultValue: 'Name' })}</th>
                                <th scope="col">{t('dashboard.teacher.age', { defaultValue: 'Age' })}</th>
                                <th scope="col">{t('dashboard.teacher.lastScreened', { defaultValue: 'Last Screened' })}</th>
                                {/* CON-PRIV-004: no raw data — summary level only */}
                                <th scope="col">{t('dashboard.teacher.status', { defaultValue: 'Status' })}</th>
                                <th scope="col">{t('dashboard.teacher.actions', { defaultValue: 'Actions' })}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {children.map((child) => (
                                <tr key={child.child_id}>
                                    <td>{child.name}</td>
                                    <td>{child.age_years}</td>
                                    <td>
                                        {child.last_session_date
                                            ? new Date(child.last_session_date).toLocaleDateString()
                                            : t('dashboard.teacher.neverScreened', { defaultValue: 'Not yet' })}
                                    </td>
                                    <td>
                                        <ScreeningSummaryBadge summary={child.screening_summary} />
                                    </td>
                                    <td>
                                        <Link
                                            to={`/assessment/session?childId=${child.child_id}`}
                                            className="btn btn--small"
                                        >
                                            {t('common.start')}
                                        </Link>
                                        {child.last_session_status === 'completed' && (
                                            <Link
                                                to={`/teacher/accommodation/${child.child_id}`}
                                                className="btn btn--small btn--secondary"
                                            >
                                                {t('dashboard.teacher.guide', { defaultValue: 'Guide' })}
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}

/** CON-PRIV-004: shows summary level only — no raw scores visible to teachers */
function ScreeningSummaryBadge({ summary }: { summary: ChildSummary['screening_summary'] }) {
    const { t } = useTranslation();
    if (!summary || summary === 'not_screened') {
        return <span className="badge badge--neutral">{t('dashboard.teacher.notScreened', { defaultValue: 'Not screened' })}</span>;
    }
    const map = {
        screened_low: { cls: 'badge--green', label: t('dashboard.teacher.lowRisk', { defaultValue: 'Low concern' }) },
        screened_moderate: { cls: 'badge--yellow', label: t('dashboard.teacher.modRisk', { defaultValue: 'Some areas to support' }) },
        screened_high: { cls: 'badge--orange', label: t('dashboard.teacher.highRisk', { defaultValue: 'Recommended follow-up' }) },
    } as const;
    const { cls, label } = map[summary as keyof typeof map];
    return <span className={`badge ${cls}`}>{label}</span>;
}
