/**
 * Color Sequence — game logic
 * Traceability: GAME-05, SRS Section 4.1 body, SRS Appendix D, GAME-FR-007
 *
 * Construct: Sustained attention, short-term memory
 * LD Target: ADHD (Inattentive), Working Memory Deficit
 * Duration: ~2-3 min
 * Difficulty: Adaptive (GAME-FR-007: 3/3 rule)
 *
 * Mechanic (SRS Section 4.1 body): Colored tiles flash briefly in sequence;
 * child selects tiles matching a target color as they appear.
 * Distractor colors interspersed (~2:1 distractor:target).
 * Flash duration 400–800ms (decreases with difficulty).
 * Scoring: commission errors (selecting distractor), omission errors (missing target).
 */

import type { DifficultyLevel } from '@earlymind/shared-types';
import { DIFFICULTY_MIN } from '@earlymind/shared-types';
import { AdaptiveDifficulty } from '../engine/AdaptiveDifficulty';

/** Flash duration per difficulty (ms) — SRS: 400–800ms */
export const FLASH_DURATION_MS: Record<DifficultyLevel, number> = {
    1: 800,
    2: 700,
    3: 600,
    4: 500,
    5: 400,
};

/** Inter-stimulus interval (ms) between flashes */
export const ISI_MS: Record<DifficultyLevel, number> = {
    1: 1200,
    2: 1000,
    3: 850,
    4: 700,
    5: 600,
};

/** Number of tiles visible at once per difficulty */
export const TILES_COUNT: Record<DifficultyLevel, number> = {
    1: 4,
    2: 4,
    3: 6,
    4: 6,
    5: 9,
};

/** 2:1 distractor:target ratio (SRS Section 4.1) */
export const DISTRACTOR_RATIO = 2;

/** Available tile colors — shape also differs for GAME-FR-014 */
export type TileColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';
export type TileShape = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'hexagon';

export const TILE_COLORS: TileColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
export const TILE_SHAPES: TileShape[] = ['circle', 'square', 'triangle', 'star', 'diamond', 'hexagon'];

export interface ColorTile {
    id: string;
    color: TileColor;
    shape: TileShape;       // GAME-FR-014: not color alone
    isTarget: boolean;
    flashStart: number;     // performance.now()
    tapped: boolean;
    missed: boolean;
}

export class ColorSequenceLogic {
    private difficulty: AdaptiveDifficulty;
    private targetColor: TileColor;
    private targetShape: TileShape;
    private tiles: ColorTile[] = [];
    private trialCount = 0;
    private commissionErrors = 0;
    private omissionErrors = 0;
    private score = 0;
    private nextId = 0;

    constructor(initialDifficulty: DifficultyLevel = DIFFICULTY_MIN) {
        this.difficulty = new AdaptiveDifficulty(initialDifficulty);
        // Pick a consistent target color+shape pair
        const idx = Math.floor(Math.random() * TILE_COLORS.length);
        this.targetColor = TILE_COLORS[idx]!;
        this.targetShape = TILE_SHAPES[idx]!;
    }

    get currentDifficulty(): DifficultyLevel { return this.difficulty.currentLevel; }
    get targetColorValue(): TileColor { return this.targetColor; }
    get targetShapeValue(): TileShape { return this.targetShape; }
    get currentTiles(): readonly ColorTile[] { return this.tiles; }

    /** Flash the next tile (target or distractor) */
    flashNextTile(): ColorTile {
        const level = this.difficulty.currentLevel;
        const isTarget = this.trialCount % (DISTRACTOR_RATIO + 1) === 0;

        let color: TileColor;
        let shape: TileShape;
        if (isTarget) {
            color = this.targetColor;
            shape = this.targetShape;
        } else {
            // Pick a distractor that differs in BOTH color and shape (GAME-FR-014)
            const availColors = TILE_COLORS.filter((c) => c !== this.targetColor);
            const availShapes = TILE_SHAPES.filter((s) => s !== this.targetShape);
            color = availColors[Math.floor(Math.random() * availColors.length)]!;
            shape = availShapes[Math.floor(Math.random() * availShapes.length)]!;
        }

        const tile: ColorTile = {
            id: `tile-${this.nextId++}`,
            color,
            shape,
            isTarget,
            flashStart: performance.now(),
            tapped: false,
            missed: false,
        };

        this.tiles = [tile]; // Only one tile flashes at a time
        this.trialCount++;
        return tile;
    }

    /** Call when flash duration expires — marks target as missed if untapped */
    expireTile(tileId: string): 'omission' | 'none' {
        const idx = this.tiles.findIndex((t) => t.id === tileId);
        if (idx === -1) return 'none';
        const tile = this.tiles[idx]!;
        if (tile.tapped) return 'none';

        if (tile.isTarget) {
            this.omissionErrors++;
            this.difficulty.recordIncorrect();
            this.tiles[idx] = { ...tile, missed: true };
            return 'omission';
        }
        this.tiles[idx] = { ...tile, missed: true };
        return 'none';
    }

    handleTap(tileId: string): 'correct' | 'commission' | null {
        const idx = this.tiles.findIndex((t) => t.id === tileId);
        if (idx === -1) return null;
        const tile = this.tiles[idx]!;
        if (tile.tapped || tile.missed) return null;

        this.tiles[idx] = { ...tile, tapped: true };

        if (tile.isTarget) {
            this.score++;
            this.difficulty.recordCorrect();
            return 'correct';
        } else {
            this.commissionErrors++;
            this.difficulty.recordIncorrect();
            return 'commission';
        }
    }

    getStats() {
        return {
            score: this.score,
            commission_errors: this.commissionErrors,
            omission_errors: this.omissionErrors,
            trial_count: this.trialCount,
            final_difficulty: this.difficulty.currentLevel,
        };
    }
}
