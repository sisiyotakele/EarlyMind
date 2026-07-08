/**
 * Number Jumper — feature extraction
 * Traceability: GAME-04, GAME-FR-010, SRS Appendix D (Dyscalculia signals)
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface NumberJumperFeatures {
    number_jumper_accuracy: number | null;
    number_jumper_mean_rt_ms: number | null;
    number_jumper_count_match_accuracy: number | null;
    number_jumper_magnitude_compare_accuracy: number | null;
    number_jumper_number_word_accuracy: number | null;
    number_jumper_max_difficulty: number | null;
    number_jumper_rt_trend: number | null;
    number_jumper_error_rate: number | null;
}

export function extractNumberJumperFeatures(events: GameEvent[]): NumberJumperFeatures {
    const correct = events.filter((e) => e.event_type === 'correct');
    const incorrect = events.filter((e) => e.event_type === 'incorrect');
    const total = correct.length + incorrect.length;

    if (total === 0) return nullFeatures();

    const accuracy = correct.length / total;
    const errorRate = incorrect.length / total;

    const latencies = correct
        .map((e) => e.response_latency_ms)
        .filter((l): l is number => l !== null && l !== undefined && l > 0);
    const meanRt = latencies.length > 0 ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null;

    // Per task type
    const countMatch = accuracyForTask(events, 'count-match');
    const magCompare = accuracyForTask(events, 'magnitude-compare');
    const numWord = accuracyForTask(events, 'number-word');

    const difficulties = events
        .map((e) => e.difficulty_level)
        .filter((d): d is 1 | 2 | 3 | 4 | 5 => d != null);
    const maxDiff = difficulties.length > 0 ? Math.max(...difficulties) : null;

    const rtTrend = latencies.length >= 3 ? linearSlope(latencies) : null;

    return {
        number_jumper_accuracy: accuracy,
        number_jumper_mean_rt_ms: meanRt,
        number_jumper_count_match_accuracy: countMatch,
        number_jumper_magnitude_compare_accuracy: magCompare,
        number_jumper_number_word_accuracy: numWord,
        number_jumper_max_difficulty: maxDiff,
        number_jumper_rt_trend: rtTrend,
        number_jumper_error_rate: errorRate,
    };
}

function accuracyForTask(events: GameEvent[], task: string): number | null {
    const relevant = events.filter((e) => (e.metadata as { task_type?: string })?.task_type === task);
    if (relevant.length === 0) return null;
    return relevant.filter((e) => e.event_type === 'correct').length / relevant.length;
}

function nullFeatures(): NumberJumperFeatures {
    return { number_jumper_accuracy: null, number_jumper_mean_rt_ms: null, number_jumper_count_match_accuracy: null, number_jumper_magnitude_compare_accuracy: null, number_jumper_number_word_accuracy: null, number_jumper_max_difficulty: null, number_jumper_rt_trend: null, number_jumper_error_rate: null };
}

function linearSlope(v: number[]): number {
    const n = v.length, xm = (n - 1) / 2, ym = v.reduce((s, x) => s + x, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xm) * (v[i]! - ym); den += (i - xm) ** 2; }
    return den === 0 ? 0 : num / den;
}
