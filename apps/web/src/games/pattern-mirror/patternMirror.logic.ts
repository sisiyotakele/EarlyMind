/**
 * Pattern Mirror — game logic
 * Traceability: GAME-02, SRS Appendix D, GAME-FR-007
 *
 * Construct: Visual working memory, sequence recall
 * LD Target: Working Memory Deficit, Dyscalculia
 * Duration: ~2-3 min
 * Difficulty: Fixed curve (SRS GAME-FR-007: "Pattern Mirror uses a fixed
 *   difficulty curve instead" — NOT adaptive 3/3 rule)
 *
 * Mechanic: A grid of cells lights up in a sequence (pattern phase).
 * The grid is then blanked. Child must tap the cells in the same order (recall phase).
 * Sequence length grows according to the fixed difficulty curve.
 */

export type GridSize = 3 | 4 | 5; // 3x3, 4x4, 5x5

/** Fixed difficulty curve — sequence length per round (not adaptive) */
export const FIXED_DIFFICULTY_CURVE: number[] = [
    2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7,
];

/** Display time per cell in sequence (ms) — decreases with round */
export const DISPLAY_TIME_MS_PER_ROUND: number[] = [
    800, 800, 750, 700, 700, 650, 600, 600, 550, 500, 500, 450, 400, 400, 350,
];

/** Grid size per round */
export const GRID_SIZE_PER_ROUND: GridSize[] = [
    3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5,
];

export const TOTAL_ROUNDS = FIXED_DIFFICULTY_CURVE.length;

export interface PatternCell {
    id: string;   // `r${row}-c${col}`
    row: number;
    col: number;
}

export type RoundPhase = 'show' | 'recall' | 'feedback' | 'between';

export interface PatternMirrorRound {
    round: number;            // 0-indexed
    sequenceLength: number;
    gridSize: GridSize;
    targetSequence: PatternCell[];   // cells to show in order
    childResponse: PatternCell[];    // cells child tapped in order
    correct: boolean | null;         // null = in progress
    startTime: number;
    recallStartTime: number | null;
    cellLatencies: number[];         // ms per cell selection
}

export class PatternMirrorLogic {
    private currentRound = 0;
    private rounds: PatternMirrorRound[] = [];
    private phase: RoundPhase = 'show';
    private showIndex = 0;

    initRound(): PatternMirrorRound {
        const round = this.currentRound;
        const sequenceLength = FIXED_DIFFICULTY_CURVE[round] ?? 2;
        const gridSize = GRID_SIZE_PER_ROUND[round] ?? 3;
        const targetSequence = this.generateSequence(gridSize, sequenceLength);

        const r: PatternMirrorRound = {
            round,
            sequenceLength,
            gridSize,
            targetSequence,
            childResponse: [],
            correct: null,
            startTime: performance.now(),
            recallStartTime: null,
            cellLatencies: [],
        };
        this.rounds.push(r);
        this.phase = 'show';
        this.showIndex = 0;
        return r;
    }

    get currentPhase(): RoundPhase { return this.phase; }
    get currentRoundNum(): number { return this.currentRound; }
    get isComplete(): boolean { return this.currentRound >= TOTAL_ROUNDS; }
    get maxSpan(): number {
        const correct = this.rounds.filter((r) => r.correct === true);
        return correct.length > 0
            ? Math.max(...correct.map((r) => r.sequenceLength))
            : 0;
    }

    /** Advance the show phase: returns next cell to highlight, null when show phase ends */
    nextShowCell(): PatternCell | null {
        const round = this.currentRoundData();
        if (!round || this.phase !== 'show') return null;
        const cell = round.targetSequence[this.showIndex] ?? null;
        this.showIndex++;
        if (this.showIndex >= round.targetSequence.length) {
            this.phase = 'recall';
            round.recallStartTime = performance.now();
        }
        return cell;
    }

    /** Record a child tap in the recall phase. Returns round result if complete. */
    handleTap(cell: PatternCell): { complete: boolean; correct: boolean } | null {
        const round = this.currentRoundData();
        if (!round || this.phase !== 'recall') return null;

        const lastTap = round.recallStartTime ?? performance.now();
        const latency = performance.now() - lastTap;
        round.cellLatencies.push(latency);
        round.childResponse.push(cell);

        if (round.childResponse.length >= round.sequenceLength) {
            // Score: all cells must match in exact order
            const correct = this.scoreRound(round);
            round.correct = correct;
            this.phase = 'feedback';
            return { complete: true, correct };
        }
        return { complete: false, correct: false };
    }

    advanceRound(): void {
        this.currentRound++;
        this.phase = 'between';
    }

    getRounds(): readonly PatternMirrorRound[] { return this.rounds; }

    getStats() {
        const correct = this.rounds.filter((r) => r.correct === true).length;
        const total = this.rounds.length;
        const allLatencies = this.rounds.flatMap((r) => r.cellLatencies);
        const meanLatency = allLatencies.length > 0
            ? allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length : null;
        return {
            correct_rounds: correct,
            total_rounds: total,
            accuracy: total > 0 ? correct / total : null,
            max_span: this.maxSpan,
            mean_cell_latency_ms: meanLatency,
        };
    }

    private currentRoundData(): PatternMirrorRound | null {
        return this.rounds[this.currentRound] ?? null;
    }

    private generateSequence(gridSize: GridSize, length: number): PatternCell[] {
        const cells: PatternCell[] = [];
        const used = new Set<string>();

        while (cells.length < length) {
            const row = Math.floor(Math.random() * gridSize);
            const col = Math.floor(Math.random() * gridSize);
            const id = `r${row}-c${col}`;
            if (!used.has(id)) {
                used.add(id);
                cells.push({ id, row, col });
            }
        }
        return cells;
    }

    private scoreRound(round: PatternMirrorRound): boolean {
        if (round.childResponse.length !== round.targetSequence.length) return false;
        return round.targetSequence.every(
            (cell, i) => round.childResponse[i]?.id === cell.id,
        );
    }
}
