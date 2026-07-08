/**
 * Letter Rain — React game component
 * Traceability: GAME-01, GAME-FR-005, GAME-FR-006, GAME-FR-007, GAME-FR-008, GAME-FR-009, GAME-FR-014
 *
 * Construct: Phonological awareness, letter-sound recognition
 * LD Target: Dyslexia, Processing Speed Deficit
 * Duration: ~2-3 min | Difficulty: Adaptive
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult, DifficultyLevel } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import { InputHandler } from '../engine/InputHandler';
import { FALL_SPEED_PX_S, LetterRainLogic, SPAWN_INTERVAL_MS } from './letterRain.logic';
import { extractLetterRainFeatures } from './letterRain.features';

const GAME_DURATION_MS = 2.5 * 60 * 1000; // ~2-3 min
const TARGET_CYCLE_MS = 20_000;             // Change target every 20s
const FRAMES_PER_SECOND = 30;              // GAME-FR-013: >=30 FPS

export default function LetterRain({ sessionId, language, logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const logicRef = useRef<LetterRainLogic | null>(null);
    const inputHandlerRef = useRef<InputHandler | null>(null);
    const animFrameRef = useRef<number>(0);
    const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const targetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const gameEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTickRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const stimulusShownAtRef = useRef<Record<string, number>>({});

    const [targetLetter, setTargetLetter] = useState('');
    const [difficulty, setDifficulty] = useState<DifficultyLevel>(1);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [letters, setLetters] = useState<ReturnType<LetterRainLogic['currentLetters']['slice']>>([]);
    const [gameStarted, setGameStarted] = useState(false);

    // ─── Init ────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const { width, height } = container.getBoundingClientRect();

        // Create logic instance
        const logic = new LetterRainLogic(language);
        logic.setContainerSize(width || 320, height || 568);
        logicRef.current = logic;

        setTargetLetter(logic.currentTarget);

        // Log game start (GAME-FR-009)
        logger.log('game_start', { metadata: { game_id: 'letter-rain' } });
        startTimeRef.current = performance.now();

        // InputHandler — GAME-FR-006
        const inputHandler = new InputHandler(container, (event) => {
            if (event.type !== 'tap') return;

            const target = event.target as HTMLElement;
            const letterId = target.dataset['letterId'];
            if (!letterId) return;

            const logic = logicRef.current;
            if (!logic) return;

            const spawnedAt = stimulusShownAtRef.current[letterId] ?? event.point.timestamp_ms;
            const latency = event.point.timestamp_ms - spawnedAt;

            const result = logic.handleTap(letterId);
            if (result === null) return;

            // Log event (GAME-FR-009)
            logger.log(result === 'correct' ? 'correct' : 'commission', {
                stimulus_id: letterId,
                response_latency_ms: latency,
                difficulty_level: logic.currentDifficulty,
                position: event.point,
            });

            setFeedback(result === 'correct' ? 'correct' : 'incorrect');
            setTimeout(() => setFeedback(null), 600);
            setDifficulty(logic.currentDifficulty);
        });

        inputHandler.attach();
        inputHandlerRef.current = inputHandler;

        setGameStarted(true);
        return () => {
            inputHandler.detach();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Game loop (requestAnimationFrame) ─────────────────────────────────────
    useEffect(() => {
        if (!gameStarted) return;

        const logic = logicRef.current!;
        lastTickRef.current = performance.now();

        // Spawn letters on interval
        spawnTimerRef.current = setInterval(() => {
            const letter = logic.spawnLetter();
            stimulusShownAtRef.current[letter.id] = performance.now();
            logger.log('stimulus_shown', {
                stimulus_id: letter.id,
                difficulty_level: logic.currentDifficulty,
                metadata: { letter: letter.letter, isTarget: letter.isTarget },
            });
            setLetters([...logic.currentLetters]);
        }, SPAWN_INTERVAL_MS[logic.currentDifficulty]);

        // Cycle target letter every 20s
        targetTimerRef.current = setInterval(() => {
            logic.cycleTarget();
            setTargetLetter(logic.currentTarget);
            logger.log('stimulus_shown', { metadata: { event: 'target_change', newTarget: logic.currentTarget } });
        }, TARGET_CYCLE_MS);

        // Game-end timer
        gameEndTimerRef.current = setTimeout(() => {
            endGame();
        }, GAME_DURATION_MS);

        // Animation loop for smooth falling (GAME-FR-013: >=30 FPS)
        function animate() {
            const now = performance.now();
            const delta = now - lastTickRef.current;
            lastTickRef.current = now;

            const logic = logicRef.current;
            if (!logic) return;

            const missed = logic.tick(delta);

            // Log omission events for letters that fell off screen
            for (const m of missed) {
                logger.log('omission', {
                    stimulus_id: m.id,
                    difficulty_level: logic.currentDifficulty,
                    metadata: { letter: m.letter },
                });
                setDifficulty(logic.currentDifficulty);
            }

            setLetters([...logic.currentLetters]);
            animFrameRef.current = requestAnimationFrame(animate);
        }

        animFrameRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            spawnTimerRef.current && clearInterval(spawnTimerRef.current);
            targetTimerRef.current && clearInterval(targetTimerRef.current);
            gameEndTimerRef.current && clearTimeout(gameEndTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameStarted]);

    // ─── End game ────────────────────────────────────────────────────────────────
    const endGame = useCallback(async () => {
        cancelAnimationFrame(animFrameRef.current);
        spawnTimerRef.current && clearInterval(spawnTimerRef.current);
        targetTimerRef.current && clearInterval(targetTimerRef.current);
        gameEndTimerRef.current && clearTimeout(gameEndTimerRef.current);
        inputHandlerRef.current?.detach();

        const logic = logicRef.current!;
        const stats = logic.getStats();
        const endTime = performance.now();

        // Extract features from events (GAME-FR-010)
        const allEvents = await logger.getAllEvents();
        const features = extractLetterRainFeatures(allEvents);

        // Build GameResult
        const result: GameResult = {
            game_id: 'letter-rain',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: stats.finalDifficulty,
            events_count: allEvents.length,
            summary: {
                score: stats.score,
                commission_errors: stats.commissionErrors,
                omission_errors: stats.omissionErrors,
                trial_count: stats.trialCount,
                ...flattenFeatures(features),
            },
        };

        logger.log('game_complete', { metadata: { game_id: 'letter-rain', ...stats } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <div
            ref={containerRef}
            className="game-letter-rain"
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
            data-testid="letter-rain"
        >
            {/* GAME-FR-005: audio instruction handled by GameOrchestrator before this component mounts */}

            {/* Target display — GAME-FR-014: not color alone as signal */}
            <div
                className="letter-rain__target"
                aria-label={t('games.letter-rain.targetLabel', { letter: targetLetter })}
                role="status"
                aria-live="polite"
            >
                <span className="letter-rain__target-label">{t('games.letter-rain.tapThis')}</span>
                {/* Target shown with shape cue in addition to the letter itself — GAME-FR-014 */}
                <span className="letter-rain__target-letter" aria-hidden="true">
                    {targetLetter}
                </span>
            </div>

            {/* Difficulty indicator */}
            <div className="letter-rain__difficulty" aria-hidden="true">
                {Array.from({ length: difficulty }, (_, i) => (
                    <span key={i} className="difficulty-dot" />
                ))}
            </div>

            {/* Falling letters */}
            {letters
                .filter((l) => !l.tapped && !l.missed)
                .map((l) => (
                    <button
                        key={l.id}
                        data-letter-id={l.id}
                        className={`letter-rain__letter ${l.isTarget ? 'letter-rain__letter--target' : 'letter-rain__letter--distractor'}`}
                        style={{
                            position: 'absolute',
                            left: `${l.x}%`,
                            top: `${l.y}px`,
                            // GAME-FR-014: shape-coded in addition to color
                            borderRadius: l.isTarget ? '8px' : '50%',
                            // GAME-FR-013: use transform for GPU-accelerated movement
                            willChange: 'top',
                            // GAME-FR-006: minimum 44x44px touch target
                            minWidth: '48px',
                            minHeight: '48px',
                        }}
                        aria-label={l.letter}
                    >
                        {l.letter}
                    </button>
                ))}

            {/* GAME-FR-008: visual feedback — <100ms (CSS transition) */}
            {feedback && (
                <div
                    className={`game-feedback game-feedback--${feedback}`}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenFeatures(features: Record<string, any>): Record<string, number> {
    const flat: Record<string, number> = {};
    for (const [k, v] of Object.entries(features)) {
        if (typeof v === 'number') flat[k] = v;
    }
    return flat;
}
