/**
 * PreAssessmentPage — consent + briefing before assessment begins
 * Traceability: GAME-FR-001 (pre-assessment screen), CON-REG-001 (parental consent)
 *
 * SRS GAME-FR-001: "shows the child's name/age, language selection, estimated
 * duration (15-20 min), adult instructions, and (for parents) a privacy/consent confirmation"
 * CON-REG-001: "Explicit parental consent (multi-language form) before any assessment"
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { Language } from '@earlymind/shared-types';

interface ChildInfo {
    child_id: string;
    name: string;
    date_of_birth: string;
    language: Language;
}

function getAgeDisplay(dob: string): string {
    const birthDate = new Date(dob);
    const now = new Date();
    const years = now.getFullYear() - birthDate.getFullYear();
    const months = now.getMonth() - birthDate.getMonth();
    const totalMonths = years * 12 + months;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return m > 0 ? `${y}y ${m}m` : `${y}y`;
}

export default function PreAssessmentPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const childId = searchParams.get('childId') ?? '';

    const [child, setChild] = useState<ChildInfo | null>(null);
    const [language, setLanguage] = useState<Language>('am');
    const [consentGiven, setConsentGiven] = useState(false);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!childId) { navigate('/assessment'); return; }
        void (async () => {
            try {
                const res = await fetch(`/api/children/${childId}`, { credentials: 'include' });
                const json = (await res.json()) as { success: boolean; data: ChildInfo };
                setChild(json.data);
                setLanguage(json.data.language);
            } finally {
                setLoading(false);
            }
        })();
    }, [childId, navigate]);

    const handleBegin = async () => {
        if (!child || !consentGiven) return;
        setStarting(true);
        setError(null);

        try {
            // Record consent (CON-REG-001)
            await fetch('/api/consents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    child_id: child.child_id,
                    consent_type: 'assessment',
                    granted: true,
                    version: 'v1',
                }),
            });

            // Create session (GAME-FR-001)
            const res = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ child_id: child.child_id, language }),
            });
            const json = (await res.json()) as { success: boolean; data: { session_id: string }; error?: { message: string } };
            if (!res.ok) throw new Error(json.error?.message ?? t('common.error'));

            navigate(`/assessment/session/${json.data.session_id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'));
        } finally {
            setStarting(false);
        }
    };

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;
    if (!child) return null;

    return (
        <main className="pre-assessment" aria-labelledby="pre-title">
            {/* GAME-FR-001: child name/age */}
            <h1 id="pre-title">{t('preAssessment.title')}</h1>
            <p className="pre-assessment__child">
                {t('preAssessment.childName', { name: child.name })} · {getAgeDisplay(child.date_of_birth)}
            </p>

            {/* GAME-FR-001: estimated duration */}
            <p className="pre-assessment__duration">{t('preAssessment.estimatedTime')}</p>

            {/* GAME-FR-001: adult instructions */}
            <section className="pre-assessment__instructions" aria-labelledby="instructions-heading">
                <h2 id="instructions-heading">{t('childProfile.instructions', { defaultValue: 'Instructions' })}</h2>
                <p>{t('preAssessment.instructions')}</p>
            </section>

            {/* Language selection — GAME-FR-001 */}
            <div className="form-group">
                <label htmlFor="session-lang">{t('auth.languageLabel')}</label>
                <select
                    id="session-lang"
                    value={language}
                    onChange={(e) => { setLanguage(e.target.value as Language); void i18n.changeLanguage(e.target.value); }}
                >
                    <option value="am">አማርኛ</option>
                    <option value="om">Afaan Oromoo</option>
                    <option value="ti">ትግርኛ</option>
                </select>
            </div>

            {/* CON-REG-001: explicit parental consent */}
            <section className="pre-assessment__consent" aria-labelledby="consent-heading">
                <h2 id="consent-heading">{t('preAssessment.consentTitle')}</h2>
                <p>{t('preAssessment.consentText')}</p>
                {/* CON-REG-004: disclaimer always visible */}
                <p className="pre-assessment__disclaimer">{t('preAssessment.disclaimer')}</p>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={consentGiven}
                        onChange={(e) => setConsentGiven(e.target.checked)}
                        aria-required="true"
                    />
                    {t('preAssessment.consentConfirm')}
                </label>
            </section>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button
                className="btn btn--primary btn--full"
                onClick={() => void handleBegin()}
                disabled={!consentGiven || starting}
                aria-busy={starting}
                aria-disabled={!consentGiven}
            >
                {starting ? t('common.loading') : t('preAssessment.begin')}
            </button>
        </main>
    );
}
