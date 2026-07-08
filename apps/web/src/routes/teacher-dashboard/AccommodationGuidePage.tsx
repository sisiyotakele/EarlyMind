/**
 * AccommodationGuidePage — classroom support guide for a specific student
 * Traceability: DASH-TEACHER-003, CON-PRIV-004, CON-ETH-001, CON-CULT-005
 *
 * CON-PRIV-004: teachers see accommodation guide — NO raw scores or behavioral data
 * CON-ETH-001: no diagnostic language
 * CON-CULT-005: no stigmatizing language
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface AccommodationGuide {
    child_name: string;
    recommendations: string[];
    referral_suggested: boolean;
    /** CON-REG-004: always present */
    disclaimer: string;
    generated_at: string | null;
}

export default function AccommodationGuidePage() {
    const { childId } = useParams<{ childId: string }>();
    const { t } = useTranslation();
    const [guide, setGuide] = useState<AccommodationGuide | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!childId) return;
        void (async () => {
            try {
                const res = await fetch(`/api/children/${childId}/accommodation-guide`, {
                    credentials: 'include',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: AccommodationGuide };
                setGuide(json.data);
            } catch {
                setError(t('common.error'));
            } finally {
                setLoading(false);
            }
        })();
    }, [childId, t]);

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;
    if (error) return <div className="error" role="alert">{error}</div>;
    if (!guide) return null;

    return (
        <main className="accommodation-guide" aria-labelledby="guide-title">
            <h1 id="guide-title">
                {t('dashboard.teacher.accommodationGuide', { defaultValue: 'Classroom Support Guide' })} — {guide.child_name}
            </h1>

            {/* CON-REG-004: disclaimer */}
            <div className="accommodation-guide__disclaimer" role="note">
                {guide.disclaimer}
            </div>

            {/* Recommendations — classroom-level, non-clinical (CON-PRIV-004) */}
            {guide.recommendations.length > 0 ? (
                <section aria-labelledby="recs-title">
                    <h2 id="recs-title">
                        {t('dashboard.teacher.supportStrategies', { defaultValue: 'Suggested Support Strategies' })}
                    </h2>
                    <ol className="accommodation-guide__recs">
                        {guide.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                        ))}
                    </ol>
                </section>
            ) : (
                <p>{t('dashboard.teacher.noRecommendations', { defaultValue: 'Continue with regular classroom support.' })}</p>
            )}

            {/* Referral note — only if indicated, no booking link (SRS §1.4.2) */}
            {guide.referral_suggested && (
                <section className="accommodation-guide__referral" role="note" aria-labelledby="referral-title">
                    <h2 id="referral-title">{t('report.referral')}</h2>
                    <p>{t('report.ierc_contact', { defaultValue: 'Consider referring to a learning support specialist via IERC.' })}</p>
                </section>
            )}

            {guide.generated_at && (
                <footer className="accommodation-guide__footer">
                    <small>
                        {t('dashboard.teacher.generatedAt', { defaultValue: 'Generated' })}: {new Date(guide.generated_at).toLocaleDateString()}
                    </small>
                </footer>
            )}
        </main>
    );
}
