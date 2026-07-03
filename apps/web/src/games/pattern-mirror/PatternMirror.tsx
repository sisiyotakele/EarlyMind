/**
 * Pattern Mirror — React game component
 * Traceability: GAME-02, GAME-FR-005/006/008/009/014
 *
 * Construct: Visual working memory, sequence recall
 * LD Target: Working Memory Deficit, Dyscalculia
 * Duration: ~2-3 min | Difficulty: Fixed curve (GAME-FR-007 exception)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import {
    DISPLAY_TIME_MS_PER_ROUND,
    PatternMirrorLogic,
    TOTAL_ROUNDS,
    type PatternCell,
    type RoundPhase,
} from './patternMirror.logic';
import { extractPatternMirrorFeatures } from './patternMirror.features';

export default function PatternMirror({ language, logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const logicRef = useRef(new PatternMirrorLogic());
    const startTimeRef = useRef(performance.now());
    const [phase, setPhase] = useState<RoundPhase>('between');
    const [gridSize, setGridSize] = useState<3 | 4 | 5>(3);
    const [highlightedCell, setHighlightedCell] = useState<string | null>(null);
    const [selectedCells, setSelectedCells] = useState<string[]>([]);
    const [roundResult, setRoundResult] = useState<'correct' | 'incorrect' | null>(null);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startRound = useCallback(() => {
        const logic = logicRef.current;
        if (logic.isComplete) { void endGame(); return; }

        const round = logic.initRound();
        setGridSize(round.gridSize);
        setSelectedCells([]);
        setRoundResult(null);
        setPhase('show');

        const displayMs = DISPLAY_TIME_MS_PER_ROUND[round.round] ?? 600;
        let idx = 0;

        logger.log('game_start', { metadata: { round: round.round, sequence_length: round.sequenceLength, grid_size: round.gridSize } });

        function showNext() {
            const cell = logic.nextShowCell();
            if (cell) {
                setHighlightedCell(cell.id);
                logger.log('stimulus_shown', { stimulus_id: cell.id, metadata: { round: round.round, idx } });
                idx++;
                showTimerRef.current = setTimeout(() => {
                    setHighlightedCell(null);
                    showTimerRef.current = setTimeout(showNext, 200);
                }, displayMs);
            } else {
                setHighlightedCell(null);
                setPhase('recall');
            }
        }
        showTimerRef.current = setTimeout(showNext, 500);
    }, [logger]);

    useEffect(() => {
        logger.log('game_start', { metadata: { game_id: 'pattern-mirror' } });
        startTimeRef.current = performance.now();
        setTimeout(startRound, 800);
        return () => { showTimerRef.current && clearTimeout(showTimerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCellTap = useCallback((cell: PatternCell) => {
        const logic = logicRef.current;
        if (logic.currentPhase !== 'recall') return;

        const tapTime = performance.now();
        logger.log('tap', { stimulus_id: cell.id, response_latency_ms: tapTime });
        setSelectedCells((prev) => [...prev, cell.id]);

        const result = logic.handleTap(cell);
        if (result?.complete) {
            const eventType = result.correct ? 'correct' : 'incorrect';
            const round = logic.getRounds()[logic.currentRoundNum]!;
            logger.log(eventType, {
                metadata: {
                    round: round.round,
                    sequence_length: round.sequenceLength,
                    grid_size: round.gridSize,
                    error_type: result.correct ? null : 'order_or_cell',
                },
            });
            setRoundResult(result.correct ? 'correct' : 'incorrect');
            setPhase('feedback');

            setTimeout(() => {
                logic.advanceRound();
                if (logic.isComplete) { void endGame(); return; }
                setPhase('between');
                setTimeout(startRound, 600);
            }, 1000);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startRound, logger]);

    const endGame = useCallback(async () => {
        showTimerRef.current && clearTimeout(showTimerRef.current);
        const logic = logicRef.current;
        const stats = logic.getStats();
        const endTime = performance.now();
        const allEvents = await logger.getAllEvents();
        const features = extractPatternMirrorFeatures(allEvents);

        const result: GameResult = {
            game_id: 'pattern-mirror',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: 3,  // fixed curve, report mid-point
            events_count: allEvents.length,
            summary: { ...stats, ...flattenFeatures(features) },
        };
        logger.log('game_complete', { metadata: { game_id: 'pattern-mirror', ...stats } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    // Build grid cells
    const cells: PatternCell[] = [];
    for (let r = 0; r < gridSize; r++)
        for (let c = 0; c < gridSize; c++)
            cells.push({ id: `r${r}-c${c}`, row: r, col: c });

    return (
        <div className="game-pattern-mirror" data-testid="pattern-mirror">
            {/* Phase label — screen reader (GAME-FR-014) */}
            <div role="status" aria-live="polite" className="sr-only">
                {phase === 'show' && t('games.pattern-mirror.watchPhase')}
                {phase === 'recall' && t('games.pattern-mirror.recallPhase')}
            </div>

            {/* Round counter */}
            <p className="pattern-mirror__round" aria-hidden="true">
                {t('games.pattern-mirror.round', {
                    current: logicRef.current.currentRoundNum + 1,
                    total: TOTAL_ROUNDS,
                })}
            </p>

            {/* Grid — GAME-FR-014: cells distinguished by position, not only color */}
            <div
                className="pattern-mirror__grid"
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                role="grid"
                aria-label={t('games.pattern-mirror.gridLabel')}
            >
                {cells.map((cell) => {
                    const isHighlighted = highlightedCell === cell.id;
                    const isSelected = selectedCells.includes(cell.id);
                    return (
                        <button
                            key={cell.id}
                            className={[
                                'pattern-mirror__cell',
                                isHighlighted ? 'pattern-mirror__cell--highlight' : '',
                                isSelected ? 'pattern-mirror__cell--selected' : '',
                                phase !== 'recall' ? 'pattern-mirror__cell--disabled' : '',
                            ].join(' ')}
                            onClick={() => phase === 'recall' && handleCellTap(cell)}
                            disabled={phase !== 'recall'}
                            aria-pressed={isSelected}
                            aria-label={t('games.pattern-mirror.cell', { row: cell.row + 1, col: cell.col + 1 })}
                        // GAME-FR-006: minimum 44px touch target enforced via CSS
                        />
                    );
                })}
            </div>

            {/* GAME-FR-008: feedback */}
            {roundResult && (
                <div
                    className={`game-feedback game-feedback--${roundResult}`}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}

function flattenFeatures(f: Record<string, number | null>): Record<string, number> {
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null)) as Record<string, number>;
}
