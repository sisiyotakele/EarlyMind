/**
 * Story Rhythm — feature extraction
 * Traceability: GAME-03, GAME-FR-010, SRS Appendix D
 *
 * Signals: beat sync error, temporal regularity (CV), on-beat rate
 */

import type { GameEvent } from '@earlymind/shared-types';

export interface StoryRhythmFeatures {
    story_rhythm_mean_sync_error_ms: number | null;
    story_rhythm_on_beat_rate: number | null;
    story_rhythm_temporal_regularity_cv: number | null;  // lower = more regular
    story_rhythm_total_taps: number | null;
    story_rhythm_iri_mean_ms: number | null;             // inter-response interval mean
    story_rhythm_iri_cv: number | null;                  // coefficient of variation
    story_rhythm_omission_rate: number | null;           // missed beats
}

export function extractStoryRhythmFeatures(events: GameEvent[]): StoryRhythmFeatures {
    const tapEvents = events.filter((e) => e.event_type === 'tap');
    const omissionEvents = events.filter((e) => e.event_type === 'omission');
    const totalBeats = tapEvents.length + omissionEvents.length;

    if (tapEvents.length === 0) return nullFeatures();

    // Sync errors
    const syncErrors = tapEvents
        .map((e) => (e.metadata as { sync_error_ms?: number })?.sync_error_ms)
        .filter((v): v is number => v !== null && v !== undefined);

    const meanSyncError = syncErrors.length > 0
        ? syncErrors.reduce((s, v) => s + v, 0) / syncErrors.length : null;

    const onBeatRate = syncErrors.length > 0
        ? syncErrors.filter((e) => e <= 300).length / syncErrors.length : null;

    // IRI computation (temporal regularity)
    const sorted = [...tapEvents].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i]!.timestamp_ms - sorted[i - 1]!.timestamp_ms);
    }
    const iriMean = intervals.length > 0
        ? intervals.reduce((s, v) => s + v, 0) / intervals.length : null;

    let iriCV: number | null = null;
    if (iriMean !== null && intervals.length > 1) {
        const std = Math.sqrt(intervals.map((v) => (v - iriMean) ** 2).reduce((s, v) => s + v, 0) / intervals.length);
        iriCV = iriMean > 0 ? std / iriMean : null;
    }

    const omissionRate = totalBeats > 0 ? omissionEvents.length / totalBeats : null;

    return {
        story_rhythm_mean_sync_error_ms: meanSyncError,
        story_rhythm_on_beat_rate: onBeatRate,
        story_rhythm_temporal_regularity_cv: iriCV,
        story_rhythm_total_taps: tapEvents.length,
        story_rhythm_iri_mean_ms: iriMean,
        story_rhythm_iri_cv: iriCV,
        story_rhythm_omission_rate: omissionRate,
    };
}

function nullFeatures(): StoryRhythmFeatures {
    return {
        story_rhythm_mean_sync_error_ms: null,
        story_rhythm_on_beat_rate: null,
        story_rhythm_temporal_regularity_cv: null,
        story_rhythm_total_taps: null,
        story_rhythm_iri_mean_ms: null,
        story_rhythm_iri_cv: null,
        story_rhythm_omission_rate: null,
    };
}
