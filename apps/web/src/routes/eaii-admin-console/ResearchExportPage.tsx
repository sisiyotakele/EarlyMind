/**
 * ResearchExportPage — EAII researcher exports anonymized dataset
 * Traceability: DASH-EAII-003, CON-REG-003, CON-PRIV-005, SRS §1.4.1
 *
 * CON-REG-003: no under-18 data used for research without IRB approval
 * CON-PRIV-005: export requires consent + audit trail
 * SRS §1.4.1: CSV/Excel export only (no API integration)
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ExportFormat = 'csv' | 'jsonl';

interface ExportFilter {
    age_min: number;
    age_max: number;
    format: ExportFormat;
    include_raw_features: boolean;
    research_consent_only: boolean;
}

export default function ResearchExportPage() {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<ExportFilter>({
        age_min: 48,
        age_max: 132,
        format: 'csv',
        include_raw_features: false,
        research_consent_only: true, // CON-REG-003: default to consent-only
    });
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportedCount, setExportedCount] = useState<number | null>(null);

    const handleExport = async () => {
        setExporting(true);
        setError(null);
        setExportedCount(null);

        try {
            const params = new URLSearchParams({
                age_min: filter.age_min.toString(),
                age_max: filter.age_max.toString(),
                format: filter.format,
                include_raw_features: filter.include_raw_features.toString(),
                research_consent_only: filter.research_consent_only.toString(),
            });

            const res = await fetch(`/api/admin/research-export?${params.toString()}`, {
                credentials: 'include',
            });

            if (!res.ok) {
                const json = (await res.json()) as { error?: { message: string } };
                throw new Error(json.error?.message ?? t('common.error'));
            }

            // CON-PRIV-005: audit logged server-side on this request
            const count = parseInt(res.headers.get('X-Export-Count') ?? '0', 10);
            setExportedCount(count);

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `earlymind_research_export_${new Date().toISOString().slice(0, 10)}.${filter.format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <main className="research-export" aria-labelledby="re-title">
            <h1 id="re-title">
                {t('dashboard.eaii.researchExport', { defaultValue: 'Research Data Export' })}
            </h1>

            {/* CON-REG-003 notice */}
            <div className="research-export__notice" role="note">
                <strong>⚠ {t('dashboard.eaii.irbNotice', { defaultValue: 'IRB Notice' })}:</strong>{' '}
                {t('dashboard.eaii.irbDescription', {
                    defaultValue:
                        'Only sessions with explicit research consent and IRB approval are exportable. This action is logged in the audit trail (CON-PRIV-005).',
                })}
            </div>

            <form
                className="research-export__form"
                onSubmit={(e) => { e.preventDefault(); void handleExport(); }}
            >
                {/* Age range filter */}
                <fieldset>
                    <legend>
                        {t('dashboard.eaii.ageFilter', { defaultValue: 'Age Range (months)' })}
                    </legend>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="age-min">Min (months)</label>
                            <input
                                id="age-min"
                                type="number"
                                min={48}
                                max={132}
                                value={filter.age_min}
                                onChange={(e) => setFilter({ ...filter, age_min: +e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="age-max">Max (months)</label>
                            <input
                                id="age-max"
                                type="number"
                                min={48}
                                max={132}
                                value={filter.age_max}
                                onChange={(e) => setFilter({ ...filter, age_max: +e.target.value })}
                            />
                        </div>
                    </div>
                </fieldset>

                {/* Format */}
                <div className="form-group">
                    <label htmlFor="export-format">
                        {t('dashboard.eaii.exportFormat', { defaultValue: 'Export Format' })}
                    </label>
                    <select
                        id="export-format"
                        value={filter.format}
                        onChange={(e) => setFilter({ ...filter, format: e.target.value as ExportFormat })}
                    >
                        <option value="csv">CSV (Excel-compatible)</option>
                        <option value="jsonl">JSONL (ML training format)</option>
                    </select>
                </div>

                {/* Research consent only — CON-REG-003 */}
                <div className="form-group form-group--checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={filter.research_consent_only}
                            onChange={(e) => setFilter({ ...filter, research_consent_only: e.target.checked })}
                        />
                        {t('dashboard.eaii.consentOnly', {
                            defaultValue: 'Research-consented sessions only (CON-REG-003)',
                        })}
                    </label>
                </div>

                {/* Include raw features (for ML training) */}
                <div className="form-group form-group--checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={filter.include_raw_features}
                            onChange={(e) => setFilter({ ...filter, include_raw_features: e.target.checked })}
                        />
                        {t('dashboard.eaii.includeFeatures', {
                            defaultValue: 'Include feature vectors (for ML training)',
                        })}
                    </label>
                </div>

                {error && <p className="form-error" role="alert">{error}</p>}

                {exportedCount !== null && (
                    <p className="form-success" role="status">
                        {t('dashboard.eaii.exportSuccess', {
                            count: exportedCount,
                            defaultValue: `Exported ${exportedCount} anonymized sessions.`,
                        })}
                    </p>
                )}

                <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={exporting}
                    aria-busy={exporting}
                >
                    {exporting
                        ? t('common.loading')
                        : t('dashboard.eaii.downloadExport', { defaultValue: 'Download Export' })}
                </button>
            </form>
        </main>
    );
}
