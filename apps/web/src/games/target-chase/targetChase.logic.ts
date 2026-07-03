/**
 * Target Chase — game logic
 * Traceability: GAME-06, SRS Section 4.6
 *
 * Construct: Sustained visual attention, impulse control
 * LD Target: ADHD (Hyperactive/Impulsive)
 * Scientific Basis: Barkley (1997) continuous performance task model
 * Duration: ~3 min
 * Difficulty: FIXED — constant go/no-go ratio for comparability (SRS Section 4.6)
 *
 * Exact SRS specs (Section 4.6):
 * - ISI: 800–2000ms randomized
 * - "Go" icons: 70% of 60 trials
 * - "No-go" icons: 30% of 60 trials
 * - 60 trials total
 * - Commission errors (tapping no-go) = impulsivity signal
 * - Omission errors (missing go) = inattention signal
 *
 * Acceptance Criteria (SRS Section 4.6):
 * - go/no-go ratio fixed at 70/30 across ALL sessions
 * - 60 trials completed
 * - Every trial's stimulus type and outcome logged
 */

/** SRS Section 4.6 exact values — do not adjust */
export const TOTAL_TRIALS = 60;
export const GO_COUNT = 42;          // exactly 70% of 60
export const NO_GO_COUNT = 18;       // exactly 30% of 60
export const ISI_MIN_MS = 800;
export const ISI_MAX_MS = 2000;
export const RESPONSE_WINDOW_MS = 1000;

export type TrialType = 'go' | 'no-go';
export type TrialOutcome = 'hit' | 'miss' | 'false-alarm' | 'correct-rejection' | 'pending';

export interface ChaseTrial {
    trial_id: string;
    trial_index: number;
    trial_type: TrialType;
    isi_ms: number;
    stimulus_onset_ms: number;
    response_time_ms: number | null;
    outcome: TrialOutcome;
}

export class TargetChaseLogic {
    private trials: ChaseTrial[] = [];
    private trialIndex = 0;
    private trialOrder: TrialType[];

    constructor() {
        // Pre-generate exactly 42 go + 18 no-go, shuffled (SRS AC: 70/30 fixed)
        this.trialOrder = this.buildTrialOrder();
    }

    get isComplete(): boolean { return this.trialIndex >= TOTAL_TRIALS; }
    get completedCount(): number { return this.trials.filter((t) => t.outcome !== 'pending').length; }

    /** Create next trial with randomized ISI */
    nextTrial(): ChaseTrial | null {
        if (this.isComplete) return null;
        const trial: ChaseTrial = {
            trial_id: `trial-${this.trialIndex}`,
            trial_index: this.trialIndex,
            trial_type: this.trialOrder[this.trialIndex]!,
            isi_ms: Math.round(ISI_MIN_MS + Math.random() * (ISI_MAX_MS - ISI_MIN_MS)),
            stimulus_onset_ms: 0,
            response_time_ms: null,
            outcome: 'pending',
        };
        this.trials.push(trial);
        this.trialIndex++;
        return trial;
    }

    setOnset(trialId: string): void {
        const t = this.find(trialId);
        if (t) t.stimulus_onset_ms = performance.now();
    }

    recordResponse(trialId: string, tapTimeMs: number): TrialOutcome {
        const t = this.find(trialId);
        if (!t || t.outcome !== 'pending') return t?.outcome ?? 'pending';
        t.response_time_ms = tapTimeMs - t.stimulus_onset_ms;
        t.outcome = t.trial_type === 'go' ? 'hit' : 'false-alarm';
        return t.outcome;
    }

    expireTrial(trialId: string): TrialOutcome {
        const t = this.find(trialId);
        if (!t || t.outcome !== 'pending') return t?.outcome ?? 'pending';
        t.outcome = t.trial_type === 'go' ? 'miss' : 'correct-rejection';
        return t.outcome;
    }

    getStats() {
        const done = this.trials.filter((t) => t.outcome !== 'pending');
        const goTrials = done.filter((t) => t.trial_type === 'go');
        const noGoTrials = done.filter((t) => t.trial_type === 'no-go');
        const hits = done.filter((t) => t.outcome === 'hit');
        const misses = done.filter((t) => t.outcome === 'miss');
        const falseAlarms = done.filter((t) => t.outcome === 'false-alarm');
        const rts = hits.map((t) => t.response_time_ms).filter((r): r is number => r !== null);
        const meanRt = rts.length > 0 ? rts.reduce((s, v) => s + v, 0) / rts.length : null;
        const rtVariance = rts.length > 1 && meanRt !== null
            ? rts.map((v) => (v - meanRt) ** 2).reduce((s, v) => s + v, 0) / rts.length : null;
        return {
            total_trials: done.length,
            go_trials: goTrials.length,
            no_go_trials: noGoTrials.length,
            hits: hits.length,
            misses: misses.length,
            false_alarms: falseAlarms.length,
            commission_rate: noGoTrials.length > 0 ? falseAlarms.length / noGoTrials.length : null,
            omission_rate: goTrials.length > 0 ? misses.length / goTrials.length : null,
            mean_rt_ms: meanRt,
            rt_variance: rtVariance,
            actual_go_ratio: done.length > 0 ? goTrials.length / done.length : null,
        };
    }

    getTrials(): readonly ChaseTrial[] { return this.trials; }

    private find(id: string): ChaseTrial | undefined {
        return this.trials.find((t) => t.trial_id === id);
    }

    private buildTrialOrder(): TrialType[] {
        const order: TrialType[] = [
            ...Array<TrialType>(GO_COUNT).fill('go'),
            ...Array<TrialType>(NO_GO_COUNT).fill('no-go'),
        ];
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j]!, order[i]!];
        }
        return order;
    }
}
