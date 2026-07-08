/**
 * TeacherManagementPage — school admin manages teacher accounts
 * Traceability: DASH-SCHOOL-002, AUTH-FR-004 (school_admin only)
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Teacher {
    user_id: string;
    name: string | null;
    phone_number: string;
    screened_count: number;
    last_active: string | null;
}

export default function TeacherManagementPage() {
    const { t } = useTranslation();
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch('/api/admin/teachers', { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: Teacher[] };
                setTeachers(json.data);
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
        <main className="teacher-management" aria-labelledby="tm-title">
            <h1 id="tm-title">
                {t('dashboard.school.teacherManagement', { defaultValue: 'Teacher Management' })}
            </h1>

            {teachers.length === 0 ? (
                <p>{t('dashboard.school.noTeachers', { defaultValue: 'No teachers registered yet.' })}</p>
            ) : (
                <div className="teacher-management__table-wrapper" role="region" aria-label="Teachers">
                    <table className="teacher-management__table" aria-label="Teacher accounts">
                        <thead>
                            <tr>
                                <th scope="col">{t('auth.nameLabel')}</th>
                                <th scope="col">{t('auth.phoneLabel')}</th>
                                <th scope="col">{t('dashboard.school.screened', { defaultValue: 'Screened' })}</th>
                                <th scope="col">{t('dashboard.school.lastActive', { defaultValue: 'Last Active' })}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teachers.map((teacher) => (
                                <tr key={teacher.user_id}>
                                    <td>{teacher.name ?? '—'}</td>
                                    {/* Phone display-only, no raw data (AUTH-FR-003) */}
                                    <td>{teacher.phone_number}</td>
                                    <td>{teacher.screened_count}</td>
                                    <td>
                                        {teacher.last_active
                                            ? new Date(teacher.last_active).toLocaleDateString()
                                            : '—'}
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
