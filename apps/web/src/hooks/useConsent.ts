/**
 * useConsent — manage parental consent state
 * Traceability: CON-REG-001, PRIV-NFR-002 (consent versioned, re-confirmable)
 */

import { useCallback, useEffect, useState } from 'react';

interface ConsentStatus {
    assessment: boolean;
    research_data: boolean;
    data_sharing: boolean;
}

export function useConsent(childId: string | null) {
    const [consents, setConsents] = useState<ConsentStatus | null>(null);
    const [loading, setLoading] = useState(!!childId);

    useEffect(() => {
        if (!childId) return;
        void (async () => {
            try {
                const res = await fetch(`/api/consents?child_id=${childId}`, { credentials: 'include' });
                const json = (await res.json()) as {
                    success: boolean;
                    data: Array<{ consent_type: keyof ConsentStatus; granted: boolean }>;
                };
                const map: ConsentStatus = { assessment: false, research_data: false, data_sharing: false };
                json.data.forEach((c) => { map[c.consent_type] = c.granted; });
                setConsents(map);
            } finally {
                setLoading(false);
            }
        })();
    }, [childId]);

    const grantConsent = useCallback(async (
        type: keyof ConsentStatus,
        granted: boolean,
    ) => {
        if (!childId) return;
        await fetch('/api/consents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ child_id: childId, consent_type: type, granted, version: 'v1' }),
        });
        setConsents((prev) => prev ? { ...prev, [type]: granted } : prev);
    }, [childId]);

    return { consents, loading, grantConsent };
}
