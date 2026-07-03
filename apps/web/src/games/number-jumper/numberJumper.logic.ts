/**
 * Number Jumper — game logic
 * Traceability: GAME-04, SRS Appendix D, GAME-FR-007
 *
 * Construct: Numerical cognition, number sense
 * LD Target: Dyscalculia
 * Scientific Basis: Dehaene (1992) Triple Code Model
 * Duration: ~2-3 min
 * Difficulty: Adaptive (GAME-FR-007: 3/3 rule)
 *
 * Mechanic: A number or quantity (dots) is shown. Child selects
 * the matching number/quantity from 3 choices, or selects which
 * of two quantities is larger (magnitude comparison).
 * Task types rotate: count-match, magnitude-compare, number-word-match.
 */

import type { DifficultyLevel } from '@earlymind/shared-types';
import { DIFFICULTY_MIN } from '@earlymind/shared-types';
import { AdaptiveDifficulty } from '../engine/AdaptiveDifficulty';

export type TaskType = 'count-match' | 'magnitude-compare' | 'number-word';

export interface NumberTrial {
    id: string;
    task_type: TaskType;
    stimulus: number;           // the target number/quantity
    choices: number[];          // 3 options (includes stimulus)
    correct_index: number;      // which choice is correct
    difficulty: DifficultyLevel;
    shown_at_ms: number;
}

/** Number ranges per difficulty */
const NUMBER_RANGES: Record<DifficultyLevel, [number, number]> = {
    1: [1, 5],
    2: [1, 10],
    3: [1, 20],
    4: [1, 50],
    5: [1, 100],
};

/** Task types rotate to assess different aspects of numerical cognition */
const TASK_ROTATION: TaskType[] = [
    'count-match', 'magnitude-compare', 'count-match',
    'number-word', 'magnitude-compare', 'count-match',
];

export class NumberJumperLogic {
    private difficulty: AdaptiveDifficulty;
    private trials: NumberTrial[] = [];
    private trialIdx = 0;

    constructor(initialDifficulty: DifficultyLevel = DIFFICULTY_MIN) {
        this.difficulty = new AdaptiveDifficulty(initialDifficulty);
    }

    get currentDifficulty(): DifficultyLevel { return this.difficulty.currentLevel; }
    get trialCount(): number { return this.trials.length; }

    /** Generate next trial */
    nextTrial(): NumberTrial {
        const level = this.difficulty.currentLevel;
        const [min, max] = NUMBER_RANGES[level];
        const task_type = TASK_ROTATION[this.trialIdx % TASK_ROTATION.length]!;

        const stimulus = randInt(min, max);
        const choices = this.generateChoices(stimulus, min, max, task_type);
        const correct_index = choices.indexOf(stimulus);

        const trial: NumberTrial = {
            id: `trial-${this.trialIdx}`,
            task_type,
            stimulus,
            choices,
            correct_index,
            difficulty: level,
            shown_at_ms: performance.now(),
        };

        this.trials.push(trial);
        this.trialIdx++;
        return trial;
    }

    /** Record answer — returns whether correct */
    answer(trialId: string, selectedIndex: number): 'correct' | 'incorrect' {
        const trial = this.trials.find((t) => t.id === trialId);
        if (!trial) return 'incorrect';

        const isCorrect = selectedIndex === trial.correct_index;
        if (isCorrect) {
            this.difficulty.recordCorrect();
        } else {
            this.difficulty.recordIncorrect();
        }
        return isCorrect ? 'correct' : 'incorrect';
    }

    getStats() {
        return {
            trial_count: this.trials.length,
            final_difficulty: this.difficulty.currentLevel,
            difficulty_history: this.difficulty.getChangeHistory(),
        };
    }

    private generateChoices(target: number, min: number, max: number, task: TaskType): number[] {
        const choices = new Set<number>([target]);
        while (choices.size < 3) {
            let distractor = randInt(min, max);
            // For magnitude-compare: pick numbers close to target (harder discrimination)
            if (task === 'magnitude-compare') {
                const offset = randInt(1, Math.max(2, Math.floor((max - min) / 5)));
                distractor = Math.random() < 0.5
                    ? Math.max(min, target - offset)
                    : Math.min(max, target + offset);
            }
            if (distractor !== target) choices.add(distractor);
        }
        // Shuffle
        return shuffle([...choices]);
    }
}

function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
}
