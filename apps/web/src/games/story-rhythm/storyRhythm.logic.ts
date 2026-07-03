/**
 * Story Rhythm — game logic
 * Traceability: GAME-03, SRS Appendix D, GAME-FR-015
 *
 * Construct: Auditory processing, rhythmic synchronization
 * LD Target: Dyslexia, ADHD (Inattentive)
 * Scientific Basis: Tallal (2004) temporal auditory processing
 * Duration: ~2-3 min
 * Difficulty: Fixed BPM per level, adaptive complexity (syllable count)
 *
 * Mechanic: Audio plays a short phrase or syllable sequence with a clear rhythm.
 * A visual pulse (beat indicator) flashes in sync. Child taps in rhythm.
 * Signals: beat synchronization error (ms), temporal regularity (CV of tap intervals).
 * GAME-FR-015: vibration fallback on mobile when audio feedback is muted.
 */

export interface BeatConfig {
    bpm: number;
    syllable_count: number;   // number of beats per phrase
    inter_beat_ms: number;    // 60000 / bpm
}

/** Fixed difficulty levels (not adaptive 3/3 rule) */
export const RHYTHM_CONFIGS: BeatConfig[] = [
    { bpm: 60, syllable_count: 2, inter_beat_ms: 1000 },
    { bpm: 60, syllable_count: 3, inter_beat_ms: 1000 },
    { bpm: 72, syllable_count: 3, inter_beat_ms: 833 },
    { bpm: 72, syllable_count: 4, inter_beat_ms: 833 },
    { bpm: 84, syllable_count: 4, inter_beat_ms: 714 },
    { bpm: 84, syllable_count: 5, inter_beat_ms: 714 },
    { bpm: 96, syllable_count: 5, inter_beat_ms: 625 },
    { bpm: 96, syllable_count: 6, inter_beat_ms: 625 },
];

export const TOTAL_PHRASES = RHYTHM_CONFIGS.length;
export const MAX_SYNC_ERROR_MS = 300; // within 300ms = acceptable sync

export interface TapRecord {
    tap_time_ms: number;       // performance.now()
    expected_beat_ms: number;  // when the beat was expected
    sync_error_ms: number;     // |tap - expected|
    on_beat: boolean;          // within MAX_SYNC_ERROR_MS
}

export interface StoryRhythmPhrase {
    phrase_index: number;
    config: BeatConfig;
    beat_times: number[];      // expected beat timestamps (performance.now()-relative)
    taps: TapRecord[];
    phrase_start_ms: number;
}

export class StoryRhythmLogic {
    private phrases: StoryRhythmPhrase[] = [];
    private currentPhraseIdx = 0;
    private isRecording = false;

    get isComplete(): boolean { return this.currentPhraseIdx >= TOTAL_PHRASES; }
    get currentConfig(): BeatConfig | null { return RHYTHM_CONFIGS[this.currentPhraseIdx] ?? null; }
    get currentPhrase(): StoryRhythmPhrase | null { return this.phrases[this.currentPhraseIdx] ?? null; }

    /** Start a new phrase — call at phrase start */
    startPhrase(): StoryRhythmPhrase {
        const config = RHYTHM_CONFIGS[this.currentPhraseIdx]!;
        const start = performance.now();
        const beatTimes: number[] = [];
        for (let i = 0; i < config.syllable_count; i++) {
            beatTimes.push(start + (i + 1) * config.inter_beat_ms);
        }
        const phrase: StoryRhythmPhrase = {
            phrase_index: this.currentPhraseIdx,
            config,
            beat_times: beatTimes,
            taps: [],
            phrase_start_ms: start,
        };
        this.phrases.push(phrase);
        this.isRecording = true;
        return phrase;
    }

    /** Record a child tap */
    recordTap(tapTimeMs: number): TapRecord | null {
        const phrase = this.phrases[this.currentPhraseIdx];
        if (!phrase || !this.isRecording) return null;

        // Find nearest expected beat
        const nearest = phrase.beat_times.reduce((best, t) =>
            Math.abs(t - tapTimeMs) < Math.abs(best - tapTimeMs) ? t : best,
        );

        const syncError = Math.abs(tapTimeMs - nearest);
        const tap: TapRecord = {
            tap_time_ms: tapTimeMs,
            expected_beat_ms: nearest,
            sync_error_ms: syncError,
            on_beat: syncError <= MAX_SYNC_ERROR_MS,
        };
        phrase.taps.push(tap);
        return tap;
    }

    /** End current phrase and advance */
    endPhrase(): void {
        this.isRecording = false;
        this.currentPhraseIdx++;
    }

    getStats() {
        const allTaps = this.phrases.flatMap((p) => p.taps);
        if (allTaps.length === 0) return { mean_sync_error_ms: null, on_beat_rate: null, total_taps: 0, temporal_regularity_cv: null };

        const syncErrors = allTaps.map((t) => t.sync_error_ms);
        const meanSyncError = syncErrors.reduce((s, v) => s + v, 0) / syncErrors.length;
        const onBeatRate = allTaps.filter((t) => t.on_beat).length / allTaps.length;

        // Inter-tap intervals for CV (temporal regularity)
        const tapTimes = allTaps.map((t) => t.tap_time_ms).sort((a, b) => a - b);
        const intervals: number[] = [];
        for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i]! - tapTimes[i - 1]!);
        let cv: number | null = null;
        if (intervals.length > 1) {
            const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length;
            const std = Math.sqrt(intervals.map((v) => (v - mean) ** 2).reduce((s, v) => s + v, 0) / intervals.length);
            cv = mean > 0 ? std / mean : null;
        }

        return { mean_sync_error_ms: meanSyncError, on_beat_rate: onBeatRate, total_taps: allTaps.length, temporal_regularity_cv: cv };
    }

    getPhrases(): readonly StoryRhythmPhrase[] { return this.phrases; }
}
