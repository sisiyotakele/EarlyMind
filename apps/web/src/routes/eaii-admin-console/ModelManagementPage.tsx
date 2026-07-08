/**
 * ModelManagementPage — EAII admin manages ML model versions
 * Traceability: DASH-EAII-002, SRS §8.3 (model versioned + traceable)
 * AUTH-FR-004: eaii_admin only
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ModelVersion {
    version: string;
    created_at: string;
    metrics: {
        sensitivity: Record<string, number>;
        specificity: Record<string, number>;
        auc_roc: Record<string, number>;
    };
    is_active: boolean;
    s3_key: string;
}

export default function ModelManagementPage() {
    const { t } = useTranslation();
    const [models, setModels] = useState<ModelVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [promoting, setPromoting] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            try {
                const res = await fetch('/api/admin/models', { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: ModelVersion[] };
                setModels(json.data);
            } catch {
                setError(t('common.error'));
            } finally {
                setLoading(false);
            }
        })();
    }, [t]);

    const promoteModel = async (version: string) => {
        setPromoting(version);
        setError(null);
        try {
            const res = await fetch(`/api/admin/models/${version}/promote`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setModels((prev) =>
                prev.map((m) => ({ ...m, is_active: m.version === version })),
            );
        } catch {
            setError(t('common.error'));
        } finally {
            setPromoting(null);
        }
    };

    if (loading) return <div className="loading" role="status">{t('common.loading')}</div>;

    return (
        <main className="model-management" aria-labelledby="mm-title">
            <h1 id="mm-title">
                {t('dashboard.eaii.modelManagement', { defaultValue: 'Model Management' })}
            </h1>

            {error && <p className="form-error" role="alert">{error}</p>}

            {models.length === 0 ? (
                <p>{t('dashboard.eaii.noModels', { defaultValue: 'No trained models available yet.' })}</p>
            ) : (
                <div className="model-management__list">
                    {models.map((m) => (
                        <div
                            key={m.version}
                            className={`model-card ${m.is_active ? 'model-card--active' : ''}`}
                            aria-label={`Model ${m.version}${m.is_active ? ' (active)' : ''}`}
                        >
                            <div className="model-card__header">
                                <h2 className="model-card__version">
                                    {m.version}
                                    {m.is_active && (
                                        <span className="badge badge--green" aria-label="Currently active">
                                            {t('dashboard.eaii.active', { defaultValue: 'Active' })}
                                        </span>
                                    )}
                                </h2>
                                <span className="model-card__date">
                                    {new Date(m.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            {/* SRS §8.4 targets display — sensitivity ≥80%, specificity ≥70%, AUC ≥0.80 */}
                            <div className="model-card__metrics">
                                <h3>{t('dashboard.eaii.metrics', { defaultValue: 'Evaluation Metrics' })}</h3>
                                <table className="metrics-table" aria-label={`Metrics for ${m.version}`}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Condition</th>
                                            <th scope="col">Sensitivity (≥80%)</th>
                                            <th scope="col">Specificity (≥70%)</th>
                                            <th scope="col">AUC (≥0.80)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(m.metrics.sensitivity).map((cond) => {
                                            const sens = m.metrics.sensitivity[cond] ?? 0;
                                            const spec = m.metrics.specificity[cond] ?? 0;
                                            const auc = m.metrics.auc_roc[cond] ?? 0;
                                            return (
                                                <tr key={cond}>
                                                    <td>{cond.replace(/_/g, ' ')}</td>
                                                    <MetricCell value={sens} threshold={0.8} />
                                                    <MetricCell value={spec} threshold={0.7} />
                                                    <MetricCell value={auc} threshold={0.8} />
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {!m.is_active && (
                                <button
                                    className="btn btn--primary"
                                    onClick={() => void promoteModel(m.version)}
                                    disabled={promoting === m.version}
                                    aria-busy={promoting === m.version}
                                >
                                    {promoting === m.version
                                        ? t('common.loading')
                                        : t('dashboard.eaii.promote', { defaultValue: 'Promote to Active' })}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}

function MetricCell({ value, threshold }: { value: number; threshold: number }) {
    const pct = (value * 100).toFixed(1);
    const passing = value >= threshold;
    return (
        <td
            className={`metric-cell metric-cell--${passing ? 'pass' : 'fail'}`}
            aria-label={`${pct}% — ${passing ? 'meets' : 'below'} target`}
        >
            {pct}%
        </td>
    );
}
