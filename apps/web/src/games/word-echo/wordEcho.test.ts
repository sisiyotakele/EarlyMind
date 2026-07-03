/**
 * Word Echo — acceptance criteria tests
 * Traceability: GAME-07, SRS Section 4.7
 *
 * SRS Acceptance Criteria:
 * 1. Word lists from vetted age-appropriate vocabulary bank per language
 * 2. List length adjusts per GAME-FR-007 (3/3 adaptive rule)
 * 3. Order-errors and omission-errors logged separately
 */

import { describe, it, expect } from 'vitest';
import { WordEchoLogic, WORD_LIST_LENGTH, WORD_BANKS } from './wordEcho.logic';

describe('WordEcho — SRS Section 4.7 Acceptance Criteria', () => {

    it('AC-1: word lists drawn from vetted vocabulary bank per language', () => {
        for (const lang of ['am', 'om', 'ti']) {
            const logic = new WordEchoLogic(lang, 1);
            const round = logic.startRound();
            const bank = WORD_BANKS[lang]!;
            // Every word in the round must be in the bank
            for (const word of round.target_list) {
                expect(bank).toContain(word);
            }
        }
    });

    it('AC-2: list length starts at 2 (difficulty 1) and grows with correct performance', () => {
        const logic = new WordEchoLogic('am', 1);
        // Initial difficulty = 1 → list length = 2
        const round1 = logic.startRound();
        expect(round1.target_list.length).toBe(WORD_LIST_LENGTH[1]); // 2

        // Simulate 3 correct rounds to trigger difficulty increase
        for (let i = 0; i < 3; i++) {
            const r = i === 0 ? round1 : logic.startRound();
            logic.beginRecall();
            // Select words in correct order
            for (const word of r.target_list) {
                logic.selectWord(word, performance.now());
            }
            logic.scoreRound();
        }

        // Difficulty should have increased → longer list
        const nextRound = logic.startRound();
        expect(nextRound.target_list.length).toBeGreaterThan(WORD_LIST_LENGTH[1]);
    });

    it('AC-2: list length decreases after 3 consecutive incorrect (GAME-FR-007)', () => {
        const logic = new WordEchoLogic('am', 3); // start at mid-difficulty
        const initialLength = WORD_LIST_LENGTH[3];

        for (let i = 0; i < 3; i++) {
            const r = logic.startRound();
            logic.beginRecall();
            // Select words in WRONG order (order error)
            const reversed = [...r.target_list].reverse();
            for (const word of reversed) logic.selectWord(word, performance.now());
            logic.scoreRound();
        }

        const nextRound = logic.startRound();
        expect(nextRound.target_list.length).toBeLessThan(initialLength);
    });

    it('AC-3: order-errors logged separately from omission-errors', () => {
        const logic = new WordEchoLogic('am', 3);

        // Simulate order error
        const r1 = logic.startRound();
        logic.beginRecall();
        const reversed = [...r1.target_list].reverse();
        for (const w of reversed) logic.selectWord(w, performance.now());
        const res1 = logic.scoreRound();
        expect(res1.correct).toBe(false);
        // Order error: all correct words but wrong order
        expect(res1.error_type).toBe('order');

        // Simulate omission error (fewer words selected)
        const r2 = logic.startRound();
        logic.beginRecall();
        // Select only first word (omission)
        logic.selectWord(r2.target_list[0]!, performance.now());
        // Force score with incomplete response by adding empty words
        for (let i = 1; i < r2.target_list.length; i++) {
            logic.selectWord('__empty__', performance.now()); // wrong word = omission
        }
        const res2 = logic.scoreRound();
        expect(res2.correct).toBe(false);
        // Not order error (wrong words), so intrusion or omission
        expect(['omission', 'intrusion']).toContain(res2.error_type);
    });

    it('round passes ONLY if all words in correct order (SRS Section 4.7)', () => {
        const logic = new WordEchoLogic('am', 1);
        const round = logic.startRound();
        logic.beginRecall();

        // Select all correct words but skip one in the middle
        for (const word of round.target_list) {
            logic.selectWord(word, performance.now());
        }
        const result = logic.scoreRound();
        expect(result.correct).toBe(true); // all in order = pass

        // Now try wrong order
        const round2 = logic.startRound();
        logic.beginRecall();
        const wrong = [...round2.target_list].reverse();
        for (const w of wrong) logic.selectWord(w, performance.now());
        const result2 = logic.scoreRound();
        if (round2.target_list.length > 1) {
            // Only fails if order matters (more than 1 word)
            expect(result2.correct).toBe(false);
        }
    });

    it('max span tracks highest correct list length', () => {
        const logic = new WordEchoLogic('am', 1);
        expect(logic.maxSpan).toBe(0);

        const r = logic.startRound();
        logic.beginRecall();
        for (const w of r.target_list) logic.selectWord(w, performance.now());
        logic.scoreRound();
        expect(logic.maxSpan).toBe(r.target_list.length);
    });

    it('difficulty never exceeds 5 (list never exceeds 5 words) — SRS Section 4.7', () => {
        const logic = new WordEchoLogic('am', 5);
        for (let i = 0; i < 10; i++) {
            const r = logic.startRound();
            logic.beginRecall();
            for (const w of r.target_list) logic.selectWord(w, performance.now());
            logic.scoreRound();
        }
        const lastRound = logic.startRound();
        expect(lastRound.target_list.length).toBeLessThanOrEqual(5);
    });
});
