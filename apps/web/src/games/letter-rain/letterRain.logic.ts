/**
 * Letter Rain — game logic
 * Traceability: GAME-01, SRS Appendix D
 *
 * Construct: Phonological awareness, letter-sound recognition
 * LD Target: Dyslexia, Processing Speed Deficit
 * Duration: ~2-3 min
 * Difficulty: Adaptive (GAME-FR-007: 3-correct → increase, 3-incorrect → decrease)
 *
 * Mechanic: Letters fall from the top of the screen at varying speeds.
 * A target letter (or letter-sound) is shown at the top.
 * Child taps falling letters that match the target; ignores distractors.
 * Flash/display duration varies by difficulty (400–800ms for distractors,
 * longer for falling letters since they move continuously).
 */

import type { DifficultyLevel } from '@earlymind/shared-types';
import { DIFFICULTY_MIN } from '@earlymind/shared-types';
import { AdaptiveDifficulty } from '../engine/AdaptiveDifficulty';

// ─── Difficulty config ────────────────────────────────────────────────────────

/** Fall speed in px/second per difficulty level */
export const FALL_SPEED_PX_S: Record<DifficultyLevel, number> = {
    1: 80,
    2: 110,
    3: 145,
    4: 185,
    5: 230,
};

/** Number of simultaneous letters on screen per difficulty */
export const LETTERS_ON_SCREEN: Record<DifficultyLevel, number> = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
};

/** Spawn interval (ms) between new letters per difficulty */
export const SPAWN_INTERVAL_MS: Record<DifficultyLevel, number> = {
    1: 2200,
    2: 1800,
    3: 1400,
    4: 1100,
    5: 850,
};

/** Distractor-to-target ratio: ~2:1 per SRS Appendix D */
export const DISTRACTOR_RATIO = 2; // 2 distractors per 1 target letter spawn

// ─── Letter pools by language ─────────────────────────────────────────────────

/**
 * Amharic (Fidel) basic syllabary — CON-TECH-004
 * Using the first-order (ä) syllables of common Ethiopic letters
 */
const AMHARIC_LETTERS = ['ሀ', 'ለ', 'ሐ', 'መ', 'ሠ', 'ረ', 'ሰ', 'ሸ', 'ቀ', 'በ', 'ቨ', 'ተ', 'ቸ', 'ነ', 'ኘ', 'አ', 'ከ', 'ኸ', 'ወ', 'ዐ', 'ዘ', 'ዠ', 'የ', 'ደ', 'ጀ', 'ገ', 'ጠ', 'ጨ', 'ጰ', 'ጸ', 'ፀ', 'ፈ', 'ፐ'];

/** Afaan Oromoo uses Latin script */
const OROMO_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

/** Tigrinya (Fidel) — same script as Amharic */
const TIGRINYA_LETTERS = ['ሀ', 'ለ', 'ሐ', 'መ', 'ረ', 'ሰ', 'ቀ', 'በ', 'ተ', 'ነ', 'አ', 'ከ', 'ወ', 'ዘ', 'የ', 'ደ', 'ጀ', 'ገ', 'ጠ', 'ፈ'];

export const LETTER_POOLS: Record<string, string[]> = {
    am: AMHARIC_LETTERS,
    om: OROMO_LETTERS,
    ti: TIGRINYA_LETTERS,
};

// ─── Game state types ─────────────────────────────────────────────────────────

export interface FallingLetter {
    id: string;
    letter: string;
    isTarget: boolean;
    x: number;          // px from left (0–100% of container width)
    y: number;          // px from top
    speed: number;      // px/s for this specific letter
    spawnTime: number;  // performance.now() at spawn
    tapped: boolean;
    missed: boolean;    // fell off bottom without tap
}

export interface LetterRainState {
    targetLetter: string;
    letters: FallingLetter[];
    score: number;
    commissionErrors: number;   // tapping a distractor
    omissionErrors: number;     // missing a target
    trialCount: number;
    startTime: number;
    adaptiveDifficulty: ReturnType<AdaptiveDifficulty['serialize']>;
}

// ─── Game logic class ─────────────────────────────────────────────────────────

export class LetterRainLogic {
    private language: string;
    private difficulty: AdaptiveDifficulty;
    private letterPool: string[];
    private targetLetter: string;
    private letters: FallingLetter[] = [];
    private trialCount = 0;
    private commissionErrors = 0;
    private omissionErrors = 0;
    private score = 0;
    private startTime: number;
    private nextId = 0;
    private containerWidth = 320;
    private containerHeight = 568;

    constructor(language: string, initialDifficulty: DifficultyLevel = DIFFICULTY_MIN) {
        this.language = language;
        this.difficulty = new AdaptiveDifficulty(initialDifficulty);
        this.letterPool = LETTER_POOLS[language] ?? LETTER_POOLS['am']!;
        this.targetLetter = this.pickTarget();
        this.startTime = performance.now();
    }

    setContainerSize(width: number, height: number): void {
        this.containerWidth = width;
        this.containerHeight = height;
    }

    get currentTarget(): string { return this.targetLetter; }
    get currentDifficulty(): DifficultyLevel { return this.difficulty.currentLevel; }
    get currentLetters(): readonly FallingLetter[] { return this.letters; }

    /**
     * Spawn a new falling letter (target or distractor).
     * Ratio: ~2 distractors per 1 target (SRS Appendix D).
     */
    spawnLetter(): FallingLetter {
        const level = this.difficulty.currentLevel;
        const isTarget = this.trialCount % (DISTRACTOR_RATIO + 1) === 0;
        const letter = isTarget
            ? this.targetLetter
            : this.pickDistractor();

        const letter_obj: FallingLetter = {
            id: `letter-${this.nextId++}`,
            letter,
            isTarget,
            x: 10 + Math.random() * 80, // 10%–90% width, avoid edges
            y: -40,
            speed: FALL_SPEED_PX_S[level],
            spawnTime: performance.now(),
            tapped: false,
            missed: false,
        };

        this.letters.push(letter_obj);
        this.trialCount++;
        return letter_obj;
    }

    /**
     * Update letter positions based on elapsed time.
     * Returns letters that fell off the bottom (for omission tracking).
     */
    tick(deltaMs: number): FallingLetter[] {
        const missedLetters: FallingLetter[] = [];

        this.letters = this.letters.map((l) => {
            if (l.tapped || l.missed) return l;
            const newY = l.y + (l.speed * deltaMs) / 1000;
            if (newY > this.containerHeight + 40) {
                if (l.isTarget) {
                    // Omission error: target letter fell off screen
                    this.omissionErrors++;
                    const change = this.difficulty.recordIncorrect();
                    const missed = { ...l, missed: true, y: newY };
                    missedLetters.push({ ...missed, metadata: change } as FallingLetter);
                    return missed;
                }
                return { ...l, missed: true, y: newY };
            }
            return { ...l, y: newY };
        }).filter((l) => !l.missed || performance.now() - l.spawnTime < 500);

        return missedLetters;
    }

    /**
     * Handle a tap on a letter.
     * Returns: 'correct' | 'commission' | null (if letter already tapped)
     */
    handleTap(letterId: string): 'correct' | 'commission' | null {
        const idx = this.letters.findIndex((l) => l.id === letterId);
        if (idx === -1) return null;

        const letter = this.letters[idx]!;
        if (letter.tapped || letter.missed) return null;

        this.letters[idx] = { ...letter, tapped: true };

        if (letter.isTarget) {
            this.score++;
            this.difficulty.recordCorrect();
            return 'correct';
        } else {
            this.commissionErrors++;
            this.difficulty.recordIncorrect();
            return 'commission';
        }
    }

    /** Change target letter (called periodically to keep game fresh) */
    cycleTarget(): void {
        this.targetLetter = this.pickTarget();
    }

    getStats() {
        return {
            score: this.score,
            commissionErrors: this.commissionErrors,
            omissionErrors: this.omissionErrors,
            trialCount: this.trialCount,
            finalDifficulty: this.difficulty.currentLevel,
            difficultyHistory: this.difficulty.getChangeHistory(),
        };
    }

    private pickTarget(): string {
        const idx = Math.floor(Math.random() * this.letterPool.length);
        return this.letterPool[idx]!;
    }

    private pickDistractor(): string {
        let distractor: string;
        do {
            const idx = Math.floor(Math.random() * this.letterPool.length);
            distractor = this.letterPool[idx]!;
        } while (distractor === this.targetLetter);
        return distractor;
    }
}
