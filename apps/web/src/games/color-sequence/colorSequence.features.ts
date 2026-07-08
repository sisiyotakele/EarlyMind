/**
 * Color Sequence — feature extraction
 * Traceability: GAME-05, GAME-FR-010, SRS Section 4.1 / Appendix D
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface ColorSequenceFeatures {
    color_sequence_commission_rate: number | null;
    color_sequence_omission_rate: number | null;
    color_sequence_accuracy: number | null;
    color_sequence_mean_rt_ms: number | null;
    color_sequence_rt_variability: number | null;
    color_sequence_max_difficulty: number | null;
    color_sequence_omission_cluster_count: number | null;
    color_sequence_rt_trend: number | null;
}

export function extractColorSequenceFeatures(events: GameEvent[]): ColorSequenceFeatures {
    const correct = events.filter((e) => e.event_type === 'correct');
    const commission = events.filter((e) => e.event_type === 'commission');
    const omission = events.filter((e) => e.event_type === 'omission');
    const total = correct.length + commission.length + omission.length;

    if (total === 0) return nullFeatures();

    const latencies = correct.map((e) => e.response_latency_ms).filter((l): l is number => l !== null && l !== undefined && l > 0);
    const meanRt = latencies.length > 0 ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null;
    const mean = meanRt ?? 0;
    const rtVar = latencies.length > 1 ? Math.sqrt(latencies.map((v) => (v - mean) ** 2).reduce((s, v) => s + v, 0) / latencies.length) : null;
    const rtTrend = latencies.length >= 3 ? linearSlope(latencies) : null;

    const difficulties = events
        .map((e) => e.difficulty_level)
        .filter((d): d is 1 | 2 | 3 | 4 | 5 => d != null);
    const maxDiff = difficulties.length > 0 ? Math.max(...difficulties) : null;

    const clusterCount = countOmissionClusters(omission);

    return {
        color_sequence_commission_rate: commission.length / total,
        color_sequence_omission_rate: omission.length / total,
        color_sequence_accuracy: correct.length / total,
        color_sequence_mean_rt_ms: meanRt,
        color_sequence_rt_variability: rtVar,
        color_sequence_max_difficulty: maxDiff,
        color_sequence_omission_cluster_count: clusterCount,
        color_sequence_rt_trend: rtTrend,
    };
}

function nullFeatures(): ColorSequenceFeatures {
    return { color_sequence_commission_rate: null, color_sequence_omission_rate: null, color_sequence_accuracy: null, color_sequence_mean_rt_ms: null, color_sequence_rt_variability: null, color_sequence_max_difficulty: null, color_sequence_omission_cluster_count: null, color_sequence_rt_trend: null };
}

function countOmissionClusters(events: GameEvent[]): number {
    const sorted = [...events].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    let clusters = 0, inCluster = false;
    for (let i = 0; i < sorted.length; i++) {
        if (!inCluster) { clusters++; inCluster = true; }
        const next = sorted[i + 1];
        if (!next || next.timestamp_ms - sorted[i]!.timestamp_ms > 2000) inCluster = false;
    }
    return clusters;
}

function linearSlope(v: number[]): number {
    const n = v.length, xm = (n - 1) / 2, ym = v.reduce((s, x) => s + x, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xm) * (v[i]! - ym); den += (i - xm) ** 2; }
    return den === 0 ? 0 : num / den;
}
