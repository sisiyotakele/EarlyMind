/**
 * AdaptiveDifficulty — exact 3-correct/3-incorrect rule per SRS
 * Traceability: GAME-FR-007
 *
 * "difficulty increases after 3 consecutive correct answers and
 *  decreases after 3 consecutive incorrect answers, with subtle steps
 *  and a difficulty floor so the child can always progress"
 *
 * Used by: Letter Rain (GAME-01), Number Jumper (GAME-04), Color Sequence (GAME-05), Word Echo (GAME-07)
 * NOT used by: Pattern Mirror (fixed difficulty curve), Target Chase (fixed for comparability)
 * Story Rhythm uses rhythm-based adaptive progression (separate from this engine).
 */

import type { DifficultyLevel } from '@earlymind/shared-types';
import {
    ADAPTIVE_CORRECT_THRESHOLD,
    ADAPTIVE_INCORRECT_THRESHOLD,
    DIFFICULTY_MAX,
    DIFFICULTY_MIN,
} from '@earlymind/shared-types';

export interface DifficultyState {
    current: DifficultyLevel;
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
    changeHistory: DifficultyChange[];
}

export interface DifficultyChange {
    fromLevel: DifficultyLevel;
    toLevel: DifficultyLevel;
    triggerType: 'correct' | 'incorrect';
    consecutiveCount: number;
    timestamp_ms: number;
}

export class AdaptiveDifficulty {
    private state: DifficultyState;

    constructor(initialLevel: DifficultyLevel = DIFFICULTY_MIN) {
        this.state = {
            current: initialLevel,
            consecutiveCorrect: 0,
            consecutiveIncorrect: 0,
            changeHistory: [],
        };
    }

    get currentLevel(): DifficultyLevel {
        return this.state.current;
    }

    get consecutiveCorrect(): number {
        return this.state.consecutiveCorrect;
    }

    get consecutiveIncorrect(): number {
        return this.state.consecutiveIncorrect;
    }

    /**
     * Record a correct answer and apply difficulty adjustment if threshold reached.
     * GAME-FR-007: "increases after 3 consecutive correct answers"
     * Returns the difficulty change if one occurred, otherwise null.
     */
    recordCorrect(): DifficultyChange | null {
        this.state.consecutiveCorrect++;
        this.state.consecutiveIncorrect = 0; // reset opposite streak

        if (this.state.consecutiveCorrect >= ADAPTIVE_CORRECT_THRESHOLD) {
            return this.applyChange('correct');
        }
        return null;
    }

    /**
     * Record an incorrect answer and apply difficulty adjustment if threshold reached.
     * GAME-FR-007: "decreases after 3 consecutive incorrect answers"
     * Returns the difficulty change if one occurred, otherwise null.
     */
    recordIncorrect(): DifficultyChange | null {
        this.state.consecutiveIncorrect++;
        this.state.consecutiveCorrect = 0; // reset opposite streak

        if (this.state.consecutiveIncorrect >= ADAPTIVE_INCORRECT_THRESHOLD) {
            return this.applyChange('incorrect');
        }
        return null;
    }

    /**
     * Apply a difficulty change and reset the streak counter.
     */
    private applyChange(triggerType: 'correct' | 'incorrect'): DifficultyChange | null {
        const from = this.state.current;
        let to: DifficultyLevel;

        if (triggerType === 'correct') {
            // GAME-FR-007: increase by 1 level
            to = Math.min(from + 1, DIFFICULTY_MAX) as DifficultyLevel;
            this.state.consecutiveCorrect = 0;
        } else {
            // GAME-FR-007: decrease by 1 level; floor so child can always progress
            to = Math.max(from - 1, DIFFICULTY_MIN) as DifficultyLevel;
            this.state.consecutiveIncorrect = 0;
        }

        const change: DifficultyChange = {
            fromLevel: from,
            toLevel: to,
            triggerType,
            consecutiveCount: triggerType === 'correct'
                ? ADAPTIVE_CORRECT_THRESHOLD
                : ADAPTIVE_INCORRECT_THRESHOLD,
            timestamp_ms: performance.now(),
        };

        this.state.current = to;
        this.state.changeHistory.push(change);

        return change;
    }

    /**
     * Get the full history of difficulty changes (for feature extraction — GAME-FR-007).
     */
    getChangeHistory(): readonly DifficultyChange[] {
        return this.state.changeHistory;
    }

    /**
     * Serialize state to JSON (for LocalStorage session recovery — GAME-FR-001/003).
     */
    serialize(): DifficultyState {
        return { ...this.state, changeHistory: [...this.state.changeHistory] };
    }

    /**
     * Restore state from serialized form (crash/pause recovery).
     */
    static deserialize(state: DifficultyState): AdaptiveDifficulty {
        const instance = new AdaptiveDifficulty(state.current);
        instance.state = state;
        return instance;
    }
}
