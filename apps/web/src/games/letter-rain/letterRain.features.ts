/**
 * Letter Rain — feature signal extraction
 * Traceability: GAME-01, GAME-FR-010
 *
 * Signals per SRS Appendix D / Section 4:
 * - commission error rate (tapping distractors)
 * - omission error rate (missing targets)
 * - response-time variability (attention lapses)
 * - processing speed (mean response latency to target)
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface LetterRainFeatures {
    // Per SRS Appendix D / Section 4 signals
    letter_rain_commission_rate: number | null;
    letter_rain_omission_rate: number | null;
    letter_rain_rt_variability: number | null;       // StdDev of response times
    letter_rain_mean_rt_ms: number | null;           // Processing speed signal
    letter_rain_max_difficulty: number | null;
    letter_rain_accuracy: number | null;
    letter_rain_score: number | null;
    letter_rain_trial_count: number | null;
    // Per-difficulty accuracy (GAME-FR-007 tracking)
    letter_rain_accuracy_d1: number | null;
    letter_rain_accuracy_d2: number | null;
    letter_rain_accuracy_d3: number | null;
    letter_rain_accuracy_d4: number | null;
    letter_rain_accuracy_d5: number | null;
    // Temporal pattern — sustained attention
    letter_rain_rt_trend: number | null;             // Slope of RT over time (fatigue/drift)
    letter_rain_omission_cluster_count: number | null;
}

export function extractLetterRainFeatures(events: GameEvent[]): LetterRainFeatures {
    const correctEvents = events.filter((e) => e.event_type === 'correct');
    const commissionEvents = events.filter((e) => e.event_type === 'commission');
    const omissionEvents = events.filter((e) => e.event_type === 'omission');
    const totalTrials = correctEvents.length + commissionEvents.length + omissionEvents.length;

    if (totalTrials === 0) {
        return nullFeatures();
    }

    // Commission and omission rates
    const commissionRate = commissionEvents.length / totalTrials;
    const omissionRate = omissionEvents.length / totalTrials;
    const accuracy = correctEvents.length / totalTrials;

    // Response times for correct hits only (processing speed signal)
    const responseTimes = correctEvents
        .map((e) => e.response_latency_ms)
        .filter((rt): rt is number => rt !== null && rt !== undefined && rt > 0);

    const meanRt = responseTimes.length > 0
        ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
        : null;

    const rtVariability = meanRt !== null && responseTimes.length > 1
        ? Math.sqrt(
            responseTimes.map((v) => Math.pow(v - meanRt, 2)).reduce((s, v) => s + v, 0) /
            responseTimes.length,
        )
        : null;

    // RT trend (slope over time — fatigue / sustained attention)
    const rtTrend = responseTimes.length >= 2 ? linearSlope(responseTimes) : null;

    // Max difficulty reached
    const difficulties = events
        .map((e) => e.difficulty_level)
        .filter((d): d is 1 | 2 | 3 | 4 | 5 => d != null);
    const maxDifficulty = difficulties.length > 0 ? Math.max(...difficulties) : null;

    // Per-difficulty accuracy
    const perDiff = computePerDifficultyAccuracy(events);

    // Score (total correct hits)
    const score = correctEvents.length;

    // Omission cluster count (consecutive omissions)
    const omissionClusterCount = countOmissionClusters(omissionEvents);

    return {
        letter_rain_commission_rate: commissionRate,
        letter_rain_omission_rate: omissionRate,
        letter_rain_rt_variability: rtVariability,
        letter_rain_mean_rt_ms: meanRt,
        letter_rain_max_difficulty: maxDifficulty,
        letter_rain_accuracy: accuracy,
        letter_rain_score: score,
        letter_rain_trial_count: totalTrials,
        letter_rain_accuracy_d1: perDiff[1] ?? null,
        letter_rain_accuracy_d2: perDiff[2] ?? null,
        letter_rain_accuracy_d3: perDiff[3] ?? null,
        letter_rain_accuracy_d4: perDiff[4] ?? null,
        letter_rain_accuracy_d5: perDiff[5] ?? null,
        letter_rain_rt_trend: rtTrend,
        letter_rain_omission_cluster_count: omissionClusterCount,
    };
}

function nullFeatures(): LetterRainFeatures {
    return {
        letter_rain_commission_rate: null,
        letter_rain_omission_rate: null,
        letter_rain_rt_variability: null,
        letter_rain_mean_rt_ms: null,
        letter_rain_max_difficulty: null,
        letter_rain_accuracy: null,
        letter_rain_score: null,
        letter_rain_trial_count: null,
        letter_rain_accuracy_d1: null,
        letter_rain_accuracy_d2: null,
        letter_rain_accuracy_d3: null,
        letter_rain_accuracy_d4: null,
        letter_rain_accuracy_d5: null,
        letter_rain_rt_trend: null,
        letter_rain_omission_cluster_count: null,
    };
}

function linearSlope(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (i - xMean) * (values[i]! - yMean);
        den += Math.pow(i - xMean, 2);
    }
    return den === 0 ? 0 : num / den;
}

function computePerDifficultyAccuracy(
    events: GameEvent[],
): Partial<Record<number, number>> {
    const result: Partial<Record<number, number>> = {};
    for (let d = 1; d <= 5; d++) {
        const atLevel = events.filter(
            (e) => e.difficulty_level === d && ['correct', 'commission', 'omission'].includes(e.event_type),
        );
        if (atLevel.length === 0) continue;
        result[d] = atLevel.filter((e) => e.event_type === 'correct').length / atLevel.length;
    }
    return result;
}

function countOmissionClusters(omissions: GameEvent[]): number {
    const sorted = [...omissions].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    let clusters = 0;
    let inCluster = false;
    for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i]!;
        const next = sorted[i + 1];
        if (!inCluster) { clusters++; inCluster = true; }
        if (!next || next.timestamp_ms - curr.timestamp_ms > 2000) inCluster = false;
    }
    return clusters;
}
