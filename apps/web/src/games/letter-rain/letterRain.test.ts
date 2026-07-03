/**
 * Letter Rain tests — acceptance criteria
 * Traceability: GAME-01, GAME-FR-007, GAME-FR-009, GAME-FR-014, SRS Appendix D
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { LetterRainLogic, DISTRACTOR_RATIO, FALL_SPEED_PX_S } from './letterRain.logic';
import { extractLetterRainFeatures } from './letterRain.features';
import type { GameEvent } from '@earlymind/shared-types';

// ─── Logic tests ──────────────────────────────────────────────────────────────

describe('LetterRainLogic', () => {
    let game: LetterRainLogic;

    beforeEach(() => {
        game = new LetterRainLogic('am', 1);
        game.setContainerSize(320, 568);
    });

    it('should produce ~2:1 distractor:target ratio over 12 spawns', () => {
        let targets = 0, distractors = 0;
        for (let i = 0; i < 12; i++) {
            const l = game.spawnLetter();
            if (l.isTarget) targets++;
            else distractors++;
        }
        // SRS: ~2:1 ratio; over 12 spawns expect 4 targets, 8 distractors
        expect(distractors / targets).toBeCloseTo(DISTRACTOR_RATIO, 0);
    });

    it('should increase difficulty after 3 consecutive correct answers (GAME-FR-007)', () => {
        const initial = game.currentDifficulty;
        // Simulate 3 correct taps
        for (let i = 0; i < 3; i++) {
            const letter = game.spawnLetter();
            // Force it to be a target to test correct tap
            if (!letter.isTarget) {
                // Skip distractors
                game.spawnLetter();
            }
        }
        // Find target letters and tap them
        let correctCount = 0;
        while (correctCount < 3) {
            const letter = game.spawnLetter();
            if (letter.isTarget) {
                const result = game.handleTap(letter.id);
                if (result === 'correct') correctCount++;
            }
        }
        expect(game.currentDifficulty).toBeGreaterThan(initial);
    });

    it('should decrease difficulty after 3 consecutive incorrect answers (GAME-FR-007)', () => {
        // Force to level 3 first
        const game3 = new LetterRainLogic('am', 3);
        game3.setContainerSize(320, 568);
        const initial = game3.currentDifficulty;

        let incorrectCount = 0;
        while (incorrectCount < 3) {
            const letter = game3.spawnLetter();
            if (!letter.isTarget) {
                // Tap a distractor = commission error = incorrect
                const result = game3.handleTap(letter.id);
                if (result === 'commission') incorrectCount++;
            }
        }
        expect(game3.currentDifficulty).toBeLessThan(initial);
    });

    it('should never drop below difficulty floor (GAME-FR-007)', () => {
        const gameFloor = new LetterRainLogic('am', 1);
        gameFloor.setContainerSize(320, 568);

        let incorrectCount = 0;
        while (incorrectCount < 9) {
            const letter = gameFloor.spawnLetter();
            if (!letter.isTarget) {
                const result = gameFloor.handleTap(letter.id);
                if (result === 'commission') incorrectCount++;
            }
        }
        expect(gameFloor.currentDifficulty).toBeGreaterThanOrEqual(1);
    });

    it('should log commission error when tapping a distractor', () => {
        let distractor = game.spawnLetter();
        while (distractor.isTarget) distractor = game.spawnLetter();
        const result = game.handleTap(distractor.id);
        expect(result).toBe('commission');
        expect(game.getStats().commissionErrors).toBe(1);
    });

    it('should log omission error when letter falls off screen', () => {
        const letter = game.spawnLetter();
        if (letter.isTarget) {
            // Simulate letter falling off screen by ticking a long time
            game.tick(10000); // 10 seconds
            expect(game.getStats().omissionErrors).toBeGreaterThan(0);
        }
    });

    it('should use correct fall speeds per difficulty (processing speed signal)', () => {
        expect(FALL_SPEED_PX_S[1]).toBeLessThan(FALL_SPEED_PX_S[5]);
        expect(FALL_SPEED_PX_S[3]).toBeLessThan(FALL_SPEED_PX_S[4]);
    });

    it('should not allow tapping an already-tapped letter', () => {
        const letter = game.spawnLetter();
        game.handleTap(letter.id);
        const result = game.handleTap(letter.id); // second tap
        expect(result).toBeNull();
    });

    it('should support all three languages', () => {
        const gameAm = new LetterRainLogic('am', 1);
        const gameOm = new LetterRainLogic('om', 1);
        const gameTi = new LetterRainLogic('ti', 1);
        expect(gameAm.currentTarget).toBeTruthy();
        expect(gameOm.currentTarget).toBeTruthy();
        expect(gameTi.currentTarget).toBeTruthy();
    });
});

// ─── Feature extraction tests ─────────────────────────────────────────────────

describe('extractLetterRainFeatures', () => {
    it('should return null features when no events (GAME-FR-010: null-flagged not zeroed)', () => {
        const features = extractLetterRainFeatures([]);
        expect(features.letter_rain_commission_rate).toBeNull();
        expect(features.letter_rain_omission_rate).toBeNull();
        expect(features.letter_rain_mean_rt_ms).toBeNull();
    });

    it('should calculate commission rate correctly (SRS Appendix D signal)', () => {
        const events: GameEvent[] = [
            makeEvent('correct', 1, 500),
            makeEvent('correct', 1, 480),
            makeEvent('commission', 1, 300),
            makeEvent('omission', 1, null),
        ];
        const features = extractLetterRainFeatures(events);
        // 1 commission out of 4 = 0.25
        expect(features.letter_rain_commission_rate).toBeCloseTo(0.25, 2);
        expect(features.letter_rain_omission_rate).toBeCloseTo(0.25, 2);
        expect(features.letter_rain_accuracy).toBeCloseTo(0.5, 2);
    });

    it('should calculate mean RT for correct hits only', () => {
        const events: GameEvent[] = [
            makeEvent('correct', 1, 600),
            makeEvent('correct', 1, 400),
            makeEvent('commission', 1, 200),
        ];
        const features = extractLetterRainFeatures(events);
        expect(features.letter_rain_mean_rt_ms).toBeCloseTo(500, 0); // (600+400)/2
    });

    it('should calculate RT variability (attention lapses signal)', () => {
        const events: GameEvent[] = [
            makeEvent('correct', 1, 400),
            makeEvent('correct', 1, 400),
            makeEvent('correct', 1, 1200), // attention lapse
        ];
        const features = extractLetterRainFeatures(events);
        expect(features.letter_rain_rt_variability).not.toBeNull();
        expect(features.letter_rain_rt_variability!).toBeGreaterThan(0);
    });

    it('should null-flag per-difficulty accuracy when no events at that level', () => {
        const events: GameEvent[] = [makeEvent('correct', 3, 500)];
        const features = extractLetterRainFeatures(events);
        expect(features.letter_rain_accuracy_d1).toBeNull();
        expect(features.letter_rain_accuracy_d3).toBeCloseTo(1.0, 2);
    });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(
    type: 'correct' | 'commission' | 'omission',
    difficulty: number,
    latency: number | null,
): GameEvent {
    return {
        event_id: crypto.randomUUID(),
        session_id: 'test-session',
        game_id: 'letter-rain',
        event_type: type,
        timestamp_ms: performance.now(),
        wall_clock_ms: Date.now(),
        difficulty_level: difficulty as 1 | 2 | 3 | 4 | 5,
        response_latency_ms: latency,
        position: null,
        stimulus_id: null,
        response_value: null,
        device_state: null,
        metadata: null,
    };
}
