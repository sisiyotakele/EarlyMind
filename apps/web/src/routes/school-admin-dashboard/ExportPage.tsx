/**
 * ExportPage — anonymized data export for school admins and EAII
 * Traceability: DASH-SCHOOL-003, DASH-EAII-003, CON-REG-003, CON-PRIV-005
 *
 * CON-REG-003: research export requires IRB approval flag
 * CON-PRIV-005: export requires consent + audit trail
 * SRS §1.4.3: CSV/Excel only (no API integration)
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ExportPage() {
    const { t } = useTranslation();
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportType, setExportType] = useState<'aggregate' | 'anonymized_research'>('aggregate');

    const handleExport = async () => {
        setExporting(true);
        setError(null);
        try {
            const res = await fetch(`/api/export?type=${exportType}`, {
                method: 'GET',
                credentials: 'include',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `earlymind_export_${exportType}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError(t('common.error'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <main className="export-page" aria-labelledby="export-title">
            <h1 id="export-title">{t('dashboard.school.export', { defaultValue: 'Export Data' })}</h1>

            {/* CON-PRIV-005: notice about consent and audit trail */}
            <div className="export-page__notice" role="note">
                <p>{t('dashboard.export.consentNotice', { defaultValue: 'Only anonymized data from sessions with research consent will be exported. This action is logged.' })}</p>
            </div>

            <div className="export-page__form">
                <fieldset>
                    <legend>{t('dashboard.export.selectType', { defaultValue: 'Export type' })}</legend>
                    <label>
                        <input
                            type="radio"
                            name="exportType"
                            value="aggregate"
                            checked={exportType === 'aggregate'}
                            onChange={() => setExportType('aggregate')}
                        />
                        {t('dashboard.export.aggregate', { defaultValue: 'Aggregate statistics (no individual identifiers)' })}
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="exportType"
                            value="anonymized_research"
                            checked={exportType === 'anonymized_research'}
                            onChange={() => setExportType('anonymized_research')}
                        />
                        {/* CON-REG-003: research export — clearly labelled */}
                        {t('dashboard.export.research', { defaultValue: 'Anonymized research dataset (IRB-approved sessions only)' })}
                    </label>
                </fieldset>

                {error && <p className="error" role="alert">{error}</p>}

                <button
                    className="btn btn--primary"
                    onClick={() => void handleExport()}
                    disabled={exporting}
                    aria-busy={exporting}
                >
                    {exporting
                        ? t('common.loading')
                        : t('dashboard.export.download', { defaultValue: 'Download CSV' })}
                </button>
            </div>
        </main>
    );
}
