/**
 * Target Chase — acceptance criteria tests
 * Traceability: GAME-06, SRS Section 4.6
 *
 * SRS Acceptance Criteria:
 * 1. go/no-go ratio fixed at 70/30 across ALL sessions
 * 2. 60 trials completed
 * 3. Every trial's stimulus type and outcome logged
 */

import { describe, it, expect } from 'vitest';
import { TargetChaseLogic, TOTAL_TRIALS, GO_COUNT, NO_GO_COUNT } from './targetChase.logic';

describe('TargetChase — SRS Section 4.6 Acceptance Criteria', () => {

    it('AC-1: go/no-go ratio is exactly 70/30 (42 go, 18 no-go) in every session', () => {
        // Run 5 sessions to verify ratio is always exactly 70/30
        for (let session = 0; session < 5; session++) {
            const logic = new TargetChaseLogic();
            const trials = [];
            while (!logic.isComplete) {
                const trial = logic.nextTrial();
                if (trial) trials.push(trial);
            }
            const goCount = trials.filter((t) => t.trial_type === 'go').length;
            const noGoCount = trials.filter((t) => t.trial_type === 'no-go').length;

            // Exact counts per SRS
            expect(goCount).toBe(GO_COUNT);   // exactly 42
            expect(noGoCount).toBe(NO_GO_COUNT); // exactly 18
            expect(goCount + noGoCount).toBe(TOTAL_TRIALS); // exactly 60
        }
    });

    it('AC-2: exactly 60 trials completed per session', () => {
        const logic = new TargetChaseLogic();
        let count = 0;
        while (!logic.isComplete) {
            logic.nextTrial();
            count++;
        }
        expect(count).toBe(60);
        expect(logic.isComplete).toBe(true);
        expect(logic.nextTrial()).toBeNull(); // no more trials
    });

    it('AC-3: commission error (false-alarm) recorded for tapping no-go', () => {
        const logic = new TargetChaseLogic();
        // Find a no-go trial
        let noGoTrial = null;
        while (!logic.isComplete && noGoTrial === null) {
            const trial = logic.nextTrial()!;
            if (trial.trial_type === 'no-go') { noGoTrial = trial; break; }
        }
        expect(noGoTrial).not.toBeNull();
        logic.setOnset(noGoTrial!.trial_id);
        const outcome = logic.recordResponse(noGoTrial!.trial_id, performance.now());
        expect(outcome).toBe('false-alarm');
    });

    it('AC-3: omission error (miss) recorded when go trial expires', () => {
        const logic = new TargetChaseLogic();
        let goTrial = null;
        while (!logic.isComplete && goTrial === null) {
            const trial = logic.nextTrial()!;
            if (trial.trial_type === 'go') { goTrial = trial; break; }
        }
        expect(goTrial).not.toBeNull();
        logic.setOnset(goTrial!.trial_id);
        const outcome = logic.expireTrial(goTrial!.trial_id);
        expect(outcome).toBe('miss');
    });

    it('AC-3: correct-rejection recorded when no-go trial expires untapped', () => {
        const logic = new TargetChaseLogic();
        let noGoTrial = null;
        while (!logic.isComplete && noGoTrial === null) {
            const trial = logic.nextTrial()!;
            if (trial.trial_type === 'no-go') { noGoTrial = trial; break; }
        }
        logic.setOnset(noGoTrial!.trial_id);
        const outcome = logic.expireTrial(noGoTrial!.trial_id);
        expect(outcome).toBe('correct-rejection');
    });

    it('ISI is randomized between 800–2000ms', () => {
        const logic = new TargetChaseLogic();
        const isis: number[] = [];
        while (!logic.isComplete) {
            const t = logic.nextTrial();
            if (t) isis.push(t.isi_ms);
        }
        expect(Math.min(...isis)).toBeGreaterThanOrEqual(800);
        expect(Math.max(...isis)).toBeLessThanOrEqual(2000);
        // Check randomness: not all identical
        const unique = new Set(isis);
        expect(unique.size).toBeGreaterThan(1);
    });

    it('stats report correct commission and omission rates', () => {
        const logic = new TargetChaseLogic();
        // Complete all 60 trials
        while (!logic.isComplete) {
            const trial = logic.nextTrial()!;
            logic.setOnset(trial.trial_id);
            // Tap everything (will cause false-alarms on no-go)
            logic.recordResponse(trial.trial_id, performance.now());
        }
        const stats = logic.getStats();
        expect(stats.total_trials).toBe(60);
        expect(stats.go_trials).toBe(42);
        expect(stats.no_go_trials).toBe(18);
        expect(stats.commission_rate).toBe(1.0); // tapped everything including no-go
        expect(stats.omission_rate).toBe(0);     // tapped all go trials
        expect(stats.actual_go_ratio).toBeCloseTo(0.7, 2);
    });
});
