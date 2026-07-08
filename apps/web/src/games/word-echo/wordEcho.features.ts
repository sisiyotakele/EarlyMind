/**
 * Word Echo — feature extraction
 * Traceability: GAME-07, GAME-FR-010, SRS Section 4.7
 *
 * Signals per SRS Section 4.7:
 * - max word-list length (verbal span)
 * - order-error vs omission-error breakdown (logged separately per SRS AC)
 * - per-word selection latency
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface WordEchoFeatures {
    word_echo_max_span: number | null;           // primary verbal WM signal
    word_echo_accuracy: number | null;
    word_echo_order_error_rate: number | null;   // SRS AC: logged separately
    word_echo_omission_error_rate: number | null; // SRS AC: logged separately
    word_echo_mean_word_latency_ms: number | null;
    word_echo_latency_trend: number | null;
    word_echo_max_difficulty: number | null;
    word_echo_span_at_2: number | null;
    word_echo_span_at_3: number | null;
    word_echo_span_at_4: number | null;
    word_echo_span_at_5: number | null;
}

export function extractWordEchoFeatures(events: GameEvent[]): WordEchoFeatures {
    const correct = events.filter((e) => e.event_type === 'correct');
    const incorrect = events.filter((e) => e.event_type === 'incorrect');
    const total = correct.length + incorrect.length;

    if (total === 0) return nullFeatures();

    const accuracy = correct.length / total;

    const orderErrors = incorrect.filter((e) => (e.metadata as { error_type?: string })?.error_type === 'order');
    const omissionErrors = incorrect.filter((e) => (e.metadata as { error_type?: string })?.error_type === 'omission');
    const orderRate = total > 0 ? orderErrors.length / total : null;
    const omissionRate = total > 0 ? omissionErrors.length / total : null;

    const latencies = events.map((e) => e.response_latency_ms).filter((l): l is number => l !== null && l !== undefined && l > 0);
    const meanLatency = latencies.length > 0 ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null;
    const latencyTrend = latencies.length >= 3 ? linearSlope(latencies) : null;

    const maxSpan = correct.reduce((max, e) => {
        const len = (e.metadata as { list_length?: number })?.list_length ?? 0;
        return Math.max(max, len);
    }, 0) || null;

    const difficulties = events
        .map((e) => e.difficulty_level)
        .filter((d): d is 1 | 2 | 3 | 4 | 5 => d != null);
    const maxDiff = difficulties.length > 0 ? Math.max(...difficulties) : null;

    return {
        word_echo_max_span: maxSpan,
        word_echo_accuracy: accuracy,
        word_echo_order_error_rate: orderRate,
        word_echo_omission_error_rate: omissionRate,
        word_echo_mean_word_latency_ms: meanLatency,
        word_echo_latency_trend: latencyTrend,
        word_echo_max_difficulty: maxDiff,
        word_echo_span_at_2: spanAtLength(correct, 2),
        word_echo_span_at_3: spanAtLength(correct, 3),
        word_echo_span_at_4: spanAtLength(correct, 4),
        word_echo_span_at_5: spanAtLength(correct, 5),
    };
}

function spanAtLength(events: GameEvent[], len: number): number | null {
    const at = events.filter((e) => (e.metadata as { list_length?: number })?.list_length === len);
    return at.length > 0 ? at.length / at.length : null; // 1.0 if any correct at this span
}

function nullFeatures(): WordEchoFeatures {
    return { word_echo_max_span: null, word_echo_accuracy: null, word_echo_order_error_rate: null, word_echo_omission_error_rate: null, word_echo_mean_word_latency_ms: null, word_echo_latency_trend: null, word_echo_max_difficulty: null, word_echo_span_at_2: null, word_echo_span_at_3: null, word_echo_span_at_4: null, word_echo_span_at_5: null };
}

function linearSlope(v: number[]): number {
    const n = v.length, xm = (n - 1) / 2, ym = v.reduce((s, x) => s + x, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xm) * (v[i]! - ym); den += (i - xm) ** 2; }
    return den === 0 ? 0 : num / den;
}
