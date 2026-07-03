/**
 * Pattern Mirror — feature extraction
 * Traceability: GAME-02, GAME-FR-010, SRS Appendix D
 *
 * Signals: visual span (max correct sequence length), order-error rate,
 * cell selection latency, span progression, grid-size performance
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface PatternMirrorFeatures {
    pattern_mirror_max_span: number | null;
    pattern_mirror_accuracy: number | null;
    pattern_mirror_mean_cell_latency_ms: number | null;
    pattern_mirror_order_error_rate: number | null;   // wrong order but correct cells
    pattern_mirror_total_rounds: number | null;
    pattern_mirror_span_at_3x3: number | null;
    pattern_mirror_span_at_4x4: number | null;
    pattern_mirror_span_at_5x5: number | null;
    pattern_mirror_latency_trend: number | null;       // slope — working memory load
}

export function extractPatternMirrorFeatures(events: GameEvent[]): PatternMirrorFeatures {
    const correctEvents = events.filter((e) => e.event_type === 'correct');
    const incorrectEvents = events.filter((e) => e.event_type === 'incorrect');
    const totalRounds = correctEvents.length + incorrectEvents.length;

    if (totalRounds === 0) return nullFeatures();

    const accuracy = correctEvents.length / totalRounds;

    const latencies = events
        .map((e) => e.response_latency_ms)
        .filter((l): l is number => l !== null && l !== undefined && l > 0);

    const meanLatency = latencies.length > 0
        ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null;

    // Max span: largest sequence length in a correct round
    const maxSpan = correctEvents.reduce((max, e) => {
        const span = (e.metadata as { sequence_length?: number })?.sequence_length ?? 0;
        return Math.max(max, span);
    }, 0) || null;

    // Order-error rate: rounds where cells were correct but order was wrong
    const orderErrors = events.filter(
        (e) => e.event_type === 'incorrect' &&
            (e.metadata as { error_type?: string })?.error_type === 'order',
    ).length;
    const orderErrorRate = totalRounds > 0 ? orderErrors / totalRounds : null;

    // Per-grid-size span (breakdown by complexity)
    const spanAt3x3 = maxSpanAt(correctEvents, 3);
    const spanAt4x4 = maxSpanAt(correctEvents, 4);
    const spanAt5x5 = maxSpanAt(correctEvents, 5);

    const latencyTrend = latencies.length >= 3 ? linearSlope(latencies) : null;

    return {
        pattern_mirror_max_span: maxSpan,
        pattern_mirror_accuracy: accuracy,
        pattern_mirror_mean_cell_latency_ms: meanLatency,
        pattern_mirror_order_error_rate: orderErrorRate,
        pattern_mirror_total_rounds: totalRounds,
        pattern_mirror_span_at_3x3: spanAt3x3,
        pattern_mirror_span_at_4x4: spanAt4x4,
        pattern_mirror_span_at_5x5: spanAt5x5,
        pattern_mirror_latency_trend: latencyTrend,
    };
}

function nullFeatures(): PatternMirrorFeatures {
    return {
        pattern_mirror_max_span: null,
        pattern_mirror_accuracy: null,
        pattern_mirror_mean_cell_latency_ms: null,
        pattern_mirror_order_error_rate: null,
        pattern_mirror_total_rounds: null,
        pattern_mirror_span_at_3x3: null,
        pattern_mirror_span_at_4x4: null,
        pattern_mirror_span_at_5x5: null,
        pattern_mirror_latency_trend: null,
    };
}

function maxSpanAt(events: GameEvent[], gridSize: number): number | null {
    const relevant = events.filter(
        (e) => (e.metadata as { grid_size?: number })?.grid_size === gridSize,
    );
    if (relevant.length === 0) return null;
    return relevant.reduce((max, e) => {
        const span = (e.metadata as { sequence_length?: number })?.sequence_length ?? 0;
        return Math.max(max, span);
    }, 0);
}

function linearSlope(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (i - xMean) * (values[i]! - yMean);
        den += (i - xMean) ** 2;
    }
    return den === 0 ? 0 : num / den;
}
