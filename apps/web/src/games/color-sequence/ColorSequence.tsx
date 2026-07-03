/**
 * Color Sequence — React game component
 * Traceability: GAME-05, SRS Section 4.1, GAME-FR-005/006/007/008/009/014
 *
 * GAME-FR-014: Tiles use BOTH color AND shape — not color alone.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult, DifficultyLevel } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import {
    ColorSequenceLogic,
    FLASH_DURATION_MS,
    ISI_MS,
    type ColorTile,
} from './colorSequence.logic';
import { extractColorSequenceFeatures } from './colorSequence.features';

const GAME_DURATION_MS = 2.5 * 60 * 1000;

export default function ColorSequence({ logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const logicRef = useRef(new ColorSequenceLogic());
    const startTimeRef = useRef(performance.now());
    const [activeTile, setActiveTile] = useState<ColorTile | null>(null);
    const [difficulty, setDifficulty] = useState<DifficultyLevel>(1);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleNextFlash = useCallback(() => {
        const logic = logicRef.current;
        const level = logic.currentDifficulty;

        flashTimerRef.current = setTimeout(() => {
            const tile = logic.flashNextTile();
            setActiveTile(tile);
            setDifficulty(level);
            logger.log('stimulus_shown', {
                stimulus_id: tile.id,
                difficulty_level: level,
                metadata: { color: tile.color, shape: tile.shape, isTarget: tile.isTarget },
            });

            // Schedule tile expiry
            flashTimerRef.current = setTimeout(() => {
                const outcome = logic.expireTile(tile.id);
                if (outcome === 'omission') {
                    logger.log('omission', { stimulus_id: tile.id, difficulty_level: level });
                    setDifficulty(logic.currentDifficulty);
                }
                setActiveTile(null);
                scheduleNextFlash();
            }, FLASH_DURATION_MS[level]);
        }, ISI_MS[level]);
    }, [logger]);

    useEffect(() => {
        logger.log('game_start', { metadata: { game_id: 'color-sequence' } });
        startTimeRef.current = performance.now();
        scheduleNextFlash();
        gameTimerRef.current = setTimeout(() => { void endGame(); }, GAME_DURATION_MS);
        return () => {
            flashTimerRef.current && clearTimeout(flashTimerRef.current);
            gameTimerRef.current && clearTimeout(gameTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTileTap = useCallback((tileId: string) => {
        const logic = logicRef.current;
        const tile = logic.currentTiles.find((t) => t.id === tileId);
        if (!tile || !activeTile) return;

        const latency = performance.now() - tile.flashStart;
        const result = logic.handleTap(tileId);
        if (!result) return;

        logger.log(result === 'correct' ? 'correct' : 'commission', {
            stimulus_id: tileId,
            response_latency_ms: latency,
            difficulty_level: logic.currentDifficulty,
        });

        setFeedback(result === 'correct' ? 'correct' : 'incorrect');
        setDifficulty(logic.currentDifficulty);
        setTimeout(() => setFeedback(null), 500);
    }, [activeTile, logger]);

    const endGame = useCallback(async () => {
        flashTimerRef.current && clearTimeout(flashTimerRef.current);
        gameTimerRef.current && clearTimeout(gameTimerRef.current);
        const stats = logicRef.current.getStats();
        const endTime = performance.now();
        const allEvents = await logger.getAllEvents();
        const features = extractColorSequenceFeatures(allEvents);

        const result: GameResult = {
            game_id: 'color-sequence',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: stats.final_difficulty,
            events_count: allEvents.length,
            summary: { ...stats, ...flattenFeatures(features) },
        };
        logger.log('game_complete', { metadata: { game_id: 'color-sequence' } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    const logic = logicRef.current;

    return (
        <div className="game-color-sequence" data-testid="color-sequence">
            {/* Target indicator — GAME-FR-014: color + shape together */}
            <div className="color-sequence__target" role="status" aria-live="polite">
                <span>{t('games.color-sequence.tapTarget')}</span>
                <span
                    className={`color-sequence__target-shape color-sequence__target-shape--${logic.targetShapeValue} color-sequence__target-shape--color-${logic.targetColorValue}`}
                    aria-label={t('games.color-sequence.targetLabel', {
                        color: t(`games.color-sequence.colors.${logic.targetColorValue}`),
                        shape: t(`games.color-sequence.shapes.${logic.targetShapeValue}`),
                    })}
                />
            </div>

            {/* Difficulty pips */}
            <div className="color-sequence__difficulty" aria-hidden="true">
                {Array.from({ length: difficulty }, (_, i) => <span key={i} className="difficulty-dot" />)}
            </div>

            {/* Flash area — one tile at a time */}
            <div className="color-sequence__flash-area" aria-live="off" aria-atomic="true">
                {activeTile && (
                    <button
                        className={`color-sequence__tile color-sequence__tile--${activeTile.shape} color-sequence__tile--color-${activeTile.color}`}
                        onClick={() => handleTileTap(activeTile.id)}
                        aria-label={t('games.color-sequence.tileLabel', {
                            color: t(`games.color-sequence.colors.${activeTile.color}`),
                            shape: t(`games.color-sequence.shapes.${activeTile.shape}`),
                        })}
                        // GAME-FR-006: 44px min target enforced via CSS + style
                        style={{ minWidth: '80px', minHeight: '80px' }}
                    />
                )}
            </div>

            {feedback && <div className={`game-feedback game-feedback--${feedback}`} aria-hidden="true" />}
        </div>
    );
}

function flattenFeatures(f: Record<string, number | null>): Record<string, number> {
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null)) as Record<string, number>;
}
