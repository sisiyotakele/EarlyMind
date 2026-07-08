/**
 * ChildProfilePage — view/create child profiles
 * Traceability: GAME-FR-001 (child must exist before session)
 * AUTH-FR-004: parent and teacher roles
 * CON-REG-001: consent captured before assessment begins
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { Language } from '@earlymind/shared-types';

interface ChildProfile {
    child_id: string;
    name: string;
    date_of_birth: string;
    language: Language;
    grade_level: string | null;
    last_session_status: string | null;
}

export default function ChildProfilePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ name: '', date_of_birth: '', language: 'am' as Language, grade_level: '' });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch('/api/children', { credentials: 'include' });
                const json = (await res.json()) as { success: boolean; data: ChildProfile[] };
                setChildren(json.data);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            const res = await fetch('/api/children', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(form),
            });
            const json = (await res.json()) as { success: boolean; data: ChildProfile; error?: { message: string } };
            if (!res.ok) throw new Error(json.error?.message ?? t('common.error'));
            setChildren((prev) => [...prev, json.data]);
            setShowCreate(false);
            setForm({ name: '', date_of_birth: '', language: 'am', grade_level: '' });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'));
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;

    return (
        <main className="child-profile-page" aria-labelledby="profile-title">
            <h1 id="profile-title">{t('preAssessment.title')}</h1>

            {children.length === 0 ? (
                <p>{t('childProfile.noChildren', { defaultValue: 'No child profiles yet. Add a child to begin.' })}</p>
            ) : (
                <ul className="child-list" aria-label={t('childProfile.list', { defaultValue: 'Children' })}>
                    {children.map((c) => (
                        <li key={c.child_id} className="child-list__item">
                            <div>
                                <strong>{c.name}</strong>
                                <span className="child-list__grade">{c.grade_level ?? ''}</span>
                            </div>
                            <button
                                className="btn btn--primary"
                                onClick={() => navigate(`/assessment/pre?childId=${c.child_id}`)}
                            >
                                {t('common.start')}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {!showCreate ? (
                <button className="btn btn--secondary" onClick={() => setShowCreate(true)}>
                    {t('childProfile.addChild', { defaultValue: '+ Add Child' })}
                </button>
            ) : (
                <form className="child-create-form" onSubmit={(e) => void handleCreate(e)} aria-label={t('childProfile.addChild')}>
                    <h2>{t('childProfile.addChild', { defaultValue: 'Add Child' })}</h2>
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <div className="form-group">
                        <label htmlFor="child-name">{t('auth.nameLabel')}</label>
                        <input id="child-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="child-dob">{t('childProfile.dateOfBirth', { defaultValue: 'Date of Birth' })}</label>
                        <input id="child-dob" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="child-lang">{t('auth.languageLabel')}</label>
                        <select id="child-lang" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as Language })}>
                            <option value="am">አማርኛ</option>
                            <option value="om">Afaan Oromoo</option>
                            <option value="ti">ትግርኛ</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="child-grade">{t('childProfile.grade', { defaultValue: 'Grade Level' })}</label>
                        <input id="child-grade" type="text" placeholder="KG, Grade 1, ..." value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} />
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn btn--primary" disabled={creating} aria-busy={creating}>
                            {creating ? t('common.loading') : t('common.save')}
                        </button>
                        <button type="button" className="btn btn--secondary" onClick={() => setShowCreate(false)}>
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            )}
        </main>
    );
}
