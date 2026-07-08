/**
 * ReportViewPage — parent/teacher view of assessment report
 * Traceability: REPORT-FR-001/002/003/004, CON-REG-004, CON-ETH-001, CON-CULT-005
 *
 * CON-REG-004: disclaimer "This is a screening, not a diagnosis" visible prominently
 * CON-ETH-001: no diagnostic claims — risk levels only
 * CON-CULT-005: no stigmatizing language
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ReportData {
    status: 'pending' | 'completed';
    report_id?: string;
    report_text_amharic?: string;
    recommendations?: string[];
    referral_suggested?: boolean;
    pdf_url?: string;
    generated_at?: string;
    disclaimer: string;
    message?: string;
}

export default function ReportViewPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const { t } = useTranslation();
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pollCount, setPollCount] = useState(0);

    useEffect(() => {
        if (!sessionId) return;

        const fetchReport = async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}/report`, {
                    credentials: 'include',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: ReportData };
                setReport(json.data);

                // Poll every 10s if still pending (GAME-FR-004: "1-2 minutes")
                if (json.data.status === 'pending' && pollCount < 18) {
                    setTimeout(() => setPollCount((c) => c + 1), 10_000);
                }
            } catch (err) {
                setError(t('common.error'));
            } finally {
                setLoading(false);
            }
        };

        void fetchReport();
    }, [sessionId, pollCount, t]);

    if (loading) {
        return (
            <div className="report-page report-page--loading" role="status" aria-live="polite">
                <div className="spinner" aria-hidden="true" />
                <p>{t('report.notAvailable')}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="report-page report-page--error" role="alert">
                <p>{error}</p>
                <button onClick={() => { setLoading(true); setPollCount((c) => c + 1); }}>
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    if (!report || report.status === 'pending') {
        return (
            <div className="report-page report-page--pending" role="status" aria-live="polite">
                <div className="spinner" aria-hidden="true" />
                <p>{t('report.notAvailable')}</p>
                {/* CON-REG-004: disclaimer even on pending screen */}
                {report?.disclaimer && (
                    <div className="report-page__disclaimer" role="note">
                        {report.disclaimer}
                    </div>
                )}
            </div>
        );
    }

    return (
        <main className="report-page" aria-labelledby="report-title">
            <h1 id="report-title">{t('appName')} — {t('preAssessment.title')}</h1>

            {/* CON-REG-004: MANDATORY disclaimer — visible, not buried */}
            <div
                className="report-page__disclaimer report-page__disclaimer--prominent"
                role="note"
                aria-label={t('report.disclaimer')}
            >
                ⚠️ {report.disclaimer}
            </div>

            {/* Report text */}
            {report.report_text_amharic && (
                <section className="report-page__summary" aria-labelledby="summary-heading">
                    <h2 id="summary-heading">{t('preAssessment.title')}</h2>
                    <div className="report-page__text">
                        {report.report_text_amharic.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                    </div>
                </section>
            )}

            {/* Classroom recommendations (DASH-TEACHER-003) */}
            {report.recommendations && report.recommendations.length > 0 && (
                <section className="report-page__recommendations" aria-labelledby="recs-heading">
                    <h2 id="recs-heading">{t('report.recommendations', { defaultValue: 'Recommendations' })}</h2>
                    <ul>
                        {report.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Referral recommendation — only if indicated */}
            {report.referral_suggested && (
                <section
                    className="report-page__referral"
                    aria-labelledby="referral-heading"
                    role="note"
                >
                    <h2 id="referral-heading">{t('report.referral')}</h2>
                    {/* Contact IERC — no booking link (SRS §1.4.2 out of scope) */}
                    <p>{t('report.ierc_contact', { defaultValue: 'Contact your nearest IERC center for specialist evaluation.' })}</p>
                </section>
            )}

            {/* PDF download — REPORT-FR-003 */}
            {report.pdf_url && (
                <div className="report-page__download">
                    <a
                        href={report.pdf_url}
                        download
                        className="btn btn--primary"
                        aria-label={t('report.downloadPdf', { defaultValue: 'Download PDF Report' })}
                    >
                        ⬇ {t('report.downloadPdf', { defaultValue: 'Download PDF' })}
                    </a>
                </div>
            )}
        </main>
    );
}
