/**
 * Word Echo — game logic
 * Traceability: GAME-07, SRS Section 4.7
 *
 * Construct: Phonological loop, verbal working memory
 * LD Target: Dyslexia, Working Memory Deficit
 * Scientific Basis: Baddeley (2000) phonological loop
 * Duration: ~2-3 min
 * Difficulty: Adaptive (word-list length 2–5, GAME-FR-007 3/3 rule)
 *
 * SRS Section 4.7 exact specs:
 * - Child hears a short word list (2–5 words)
 * - Selects matching picture/word cards in order
 * - List length grows with correct performance (GAME-FR-007)
 * - A round passes ONLY if all words selected in correct order
 * - Partial recall (correct words, wrong order) recorded separately
 *
 * Acceptance Criteria (SRS Section 4.7):
 * - Word lists from vetted age-appropriate vocabulary bank per language
 * - List length adjusts per GAME-FR-007
 * - Order-errors and omission-errors logged separately
 */

import { AdaptiveDifficulty } from '../engine/AdaptiveDifficulty';
import type { DifficultyLevel } from '@earlymind/shared-types';
import { DIFFICULTY_MIN } from '@earlymind/shared-types';

/** Word-list length per difficulty (SRS: 2–5 words) */
export const WORD_LIST_LENGTH: Record<DifficultyLevel, number> = {
    1: 2,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
};

/** Vetted age-appropriate vocabulary by language (CON-CULT-001/002) */
export const WORD_BANKS: Record<string, string[]> = {
    am: ['ልጅ', 'ቤት', 'ውሃ', 'ዳቦ', 'ዛፍ', 'ወንበር', 'ሰዓት', 'ፀሃይ', 'ደብተር', 'ቦርሳ', 'ቁልፍ', 'አበባ', 'ዓሳ', 'ዶሮ', 'ላም'],
    om: ['mana', 'bishaan', 'loon', 'aduu', 'bineensa', 'muka', 'nama', 'nyaata', 'kitaaba', 'qalama', 'dirree', 'gabaa', 'hoolaa', 'gaala', 'bosonaa'],
    ti: ['ቤት', 'ማይ', 'ፀሓይ', 'ዕጻ', 'ሰብ', 'ድሌት', 'ናይ', 'ቆልዓ', 'ኣቦ', 'ኣደ', 'ጻዕዳ', 'ሰማይ', 'ምድሪ', 'ዓሳ', 'ኣጣል'],
};

export type ErrorType = 'order' | 'omission' | 'intrusion';

export interface WordRound {
    round_id: string;
    target_list: string[];          // words to remember (in order)
    child_response: string[];       // words selected (in order tapped)
    correct: boolean;               // all correct AND in exact order
    error_type: ErrorType | null;   // for incorrect rounds
    word_latencies: number[];       // ms per word selection
    round_start_ms: number;
    selection_start_ms: number | null;
}

export class WordEchoLogic {
    private language: string;
    private difficulty: AdaptiveDifficulty;
    private rounds: WordRound[] = [];
    private currentRound: WordRound | null = null;
    private roundIndex = 0;
    private wordBank: string[];

    constructor(language: string, initialDifficulty: DifficultyLevel = DIFFICULTY_MIN) {
        this.language = language;
        this.difficulty = new AdaptiveDifficulty(initialDifficulty);
        this.wordBank = WORD_BANKS[language] ?? WORD_BANKS['am']!;
    }

    get currentDifficulty(): DifficultyLevel { return this.difficulty.currentLevel; }
    get maxSpan(): number {
        return this.rounds.filter((r) => r.correct).reduce((max, r) => Math.max(max, r.target_list.length), 0);
    }

    /** Build a new round — call during audio playback phase */
    startRound(): WordRound {
        const listLength = WORD_LIST_LENGTH[this.difficulty.currentLevel];
        const targetList = this.sampleWords(listLength);

        const round: WordRound = {
            round_id: `round-${this.roundIndex++}`,
            target_list: targetList,
            child_response: [],
            correct: false,
            error_type: null,
            word_latencies: [],
            round_start_ms: performance.now(),
            selection_start_ms: null,
        };

        this.currentRound = round;
        this.rounds.push(round);
        return round;
    }

    /** Transition to recall phase */
    beginRecall(): void {
        if (this.currentRound) {
            this.currentRound.selection_start_ms = performance.now();
        }
    }

    /** Record a word selection tap */
    selectWord(word: string, tapTimeMs: number): void {
        const round = this.currentRound;
        if (!round) return;
        const lastTime = round.selection_start_ms ?? tapTimeMs;
        round.word_latencies.push(tapTimeMs - lastTime);
        round.child_response.push(word);
        round.selection_start_ms = tapTimeMs;
    }

    /** Score the round after all selections made. Returns outcome. */
    scoreRound(): { correct: boolean; error_type: ErrorType | null } {
        const round = this.currentRound;
        if (!round) return { correct: false, error_type: 'omission' };

        const target = round.target_list;
        const response = round.child_response;

        // SRS: "passes only if all words selected in correct order"
        const allInOrder = response.length === target.length &&
            target.every((w, i) => response[i] === w);

        if (allInOrder) {
            round.correct = true;
            round.error_type = null;
            this.difficulty.recordCorrect();
        } else {
            round.correct = false;

            // Classify error type for separate logging (SRS Section 4.7 AC)
            const targetSet = new Set(target);
            const responseSet = new Set(response);
            const correctWordsPresent = [...responseSet].every((w) => targetSet.has(w));

            if (correctWordsPresent && response.length === target.length) {
                round.error_type = 'order'; // correct words, wrong order
            } else if (response.length < target.length) {
                round.error_type = 'omission'; // fewer words selected
            } else {
                round.error_type = 'intrusion'; // wrong words selected
            }

            this.difficulty.recordIncorrect();
        }

        return { correct: round.correct, error_type: round.error_type };
    }

    getStats() {
        const correct = this.rounds.filter((r) => r.correct).length;
        const allLatencies = this.rounds.flatMap((r) => r.word_latencies);
        const meanLatency = allLatencies.length > 0
            ? allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length : null;
        const orderErrors = this.rounds.filter((r) => r.error_type === 'order').length;
        const omissionErrors = this.rounds.filter((r) => r.error_type === 'omission').length;

        return {
            total_rounds: this.rounds.length,
            correct_rounds: correct,
            accuracy: this.rounds.length > 0 ? correct / this.rounds.length : null,
            max_span: this.maxSpan,
            mean_word_latency_ms: meanLatency,
            order_errors: orderErrors,
            omission_errors: omissionErrors,
            final_difficulty: this.difficulty.currentLevel,
        };
    }

    getCurrentRound(): WordRound | null { return this.currentRound; }
    getRounds(): readonly WordRound[] { return this.rounds; }

    private sampleWords(count: number): string[] {
        const shuffled = [...this.wordBank].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }
}
