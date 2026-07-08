/**
 * BulkScreeningPage — teacher initiates screening for multiple students
 * Traceability: DASH-TEACHER-002, AUTH-FR-004 (teacher role)
 * CON-PRIV-004: teachers cannot see raw behavioral data
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ChildEntry {
    child_id: string;
    name: string;
    last_session_status: string | null;
    selected: boolean;
}

export default function BulkScreeningPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [children, setChildren] = useState<ChildEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void (async () => {
            const res = await fetch('/api/children', { credentials: 'include' });
            const json = (await res.json()) as { success: boolean; data: Omit<ChildEntry, 'selected'>[] };
            setChildren(json.data.map((c) => ({ ...c, selected: false })));
            setLoading(false);
        })();
    }, []);

    const toggleAll = (checked: boolean) =>
        setChildren((prev) => prev.map((c) => ({ ...c, selected: checked })));

    const toggle = (id: string) =>
        setChildren((prev) => prev.map((c) => c.child_id === id ? { ...c, selected: !c.selected } : c));

    const startNext = () => {
        const first = children.find((c) => c.selected && c.last_session_status !== 'active');
        if (first) navigate(`/assessment/pre?childId=${first.child_id}`);
    };

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;

    const selectedCount = children.filter((c) => c.selected).length;

    return (
        <main className="bulk-screening" aria-labelledby="bulk-title">
            <h1 id="bulk-title">{t('dashboard.teacher.bulkScreening', { defaultValue: 'Bulk Screening' })}</h1>
            <p>{t('dashboard.teacher.bulkInstructions', { defaultValue: 'Select students to screen, then start one at a time.' })}</p>

            <div className="bulk-screening__controls">
                <label>
                    <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} />
                    {t('dashboard.teacher.selectAll', { defaultValue: 'Select All' })}
                </label>
                <button className="btn btn--primary" onClick={startNext} disabled={selectedCount === 0}>
                    {t('dashboard.teacher.startScreening', { defaultValue: `Start Next (${selectedCount} selected)` })}
                </button>
            </div>

            <ul className="bulk-screening__list" aria-label="Students to screen">
                {children.map((c) => (
                    <li key={c.child_id} className="bulk-screening__item">
                        <label className="bulk-screening__checkbox-label">
                            <input
                                type="checkbox"
                                checked={c.selected}
                                onChange={() => toggle(c.child_id)}
                                disabled={c.last_session_status === 'active'}
                            />
                            {c.name}
                            {c.last_session_status === 'active' && (
                                <span className="badge badge--yellow" aria-label="Session in progress">
                                    {t('dashboard.teacher.inProgress', { defaultValue: 'In progress' })}
                                </span>
                            )}
                        </label>
                    </li>
                ))}
            </ul>
        </main>
    );
}
