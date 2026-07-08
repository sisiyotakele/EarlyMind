/**
 * GameSessionPage — wraps GameOrchestrator for a live assessment session
 * Traceability: GAME-FR-001/002/003/004, CON-PRIV-001 (feature extraction client-side)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { Language } from '@earlymind/shared-types';

import { GameOrchestrator } from '../../games/engine/GameOrchestrator';
import { AgeNormalizer } from '../../games/engine/AgeNormalizer';
import { FeatureExtractor } from '../../games/engine/FeatureExtractor';
import { enqueueFeatureUpload } from '../../offline/syncQueue';
import { loadNormativeData } from '../../offline/indexedDb';

interface SessionMeta {
    session_id: string;
    child_id: string;
    child_name: string;
    child_dob: string;
    language: Language;
    current_game_index: number;
}

function getAgeMonths(dob: string): number {
    const birth = new Date(dob);
    const now = new Date();
    return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

export default function GameSessionPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [meta, setMeta] = useState<SessionMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) { navigate('/assessment'); return; }
        void (async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}/meta`, { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { success: boolean; data: SessionMeta };
                setMeta(json.data);
            } catch {
                setError(t('common.error'));
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId, navigate, t]);

    const handleSessionComplete = async (completedSessionId: string) => {
        if (!meta) return;
        const ageMonths = getAgeMonths(meta.child_dob);

        try {
            // GAME-FR-010: extract features client-side (CON-PRIV-001: never upload raw events)
            const normDb = await loadNormativeData();
            const normalizer = new AgeNormalizer((normDb as Parameters<typeof AgeNormalizer>[0]) ?? []);

            // FeatureExtractor needs per-game events — loaded from IndexedDB
            const { loadEvents } = await import('../../offline/indexedDb');
            const { GAME_SEQUENCE } = await import('@earlymind/shared-types');

            const perGameEvents: Parameters<typeof FeatureExtractor>[0] = {};
            for (const gameId of GAME_SEQUENCE) {
                const events = await loadEvents(completedSessionId, gameId);
                if (events.length > 0) perGameEvents[gameId] = events;
            }

            const extractor = new FeatureExtractor(perGameEvents);
            const extracted = extractor.extract();

            // Flatten extracted feature tree into key→value dict
            const flatFeatures = flattenExtracted(extracted);

            // GAME-FR-011: z-score normalize
            const normalizedFeatures = normalizer.normalizeAll(flatFeatures, ageMonths);

            // Enqueue upload (handles offline — GAME-FR-012)
            await enqueueFeatureUpload(completedSessionId, {
                age_months: ageMonths,
                features: flatFeatures,
                normalized_features: normalizedFeatures,
                extraction_timestamp: new Date().toISOString(),
            });

            navigate(`/assessment/report/${completedSessionId}`);
        } catch (err) {
            console.error('Feature extraction/upload failed:', err);
            navigate(`/assessment/report/${completedSessionId}`);
        }
    };

    if (loading) return <div className="loading" role="status">{t('session.initializing')}</div>;
    if (error) return <div className="error" role="alert">{error}</div>;
    if (!meta) return null;

    return (
        <div className="game-session-page" style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
            <GameOrchestrator
                childId={meta.child_id}
                childName={meta.child_name}
                childAgeMonths={getAgeMonths(meta.child_dob)}
                language={meta.language}
                onSessionComplete={(id) => void handleSessionComplete(id)}
                onSessionAbandon={() => navigate('/assessment')}
            />
        </div>
    );
}

/** Flatten the nested ExtractedFeatures object into a flat key→value map */
function flattenExtracted(features: Record<string, unknown>, prefix = ''): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(features)) {
        const fullKey = prefix ? `${prefix}_${key}` : key;
        if (typeof value === 'number' && !Number.isNaN(value)) {
            result[fullKey] = value;
        } else if (value !== null && typeof value === 'object') {
            Object.assign(result, flattenExtracted(value as Record<string, unknown>, fullKey));
        }
    }
    return result;
}
