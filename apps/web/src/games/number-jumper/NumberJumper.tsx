/**
 * Number Jumper — React game component
 * Traceability: GAME-04, GAME-FR-005/006/007/008/009/014
 *
 * Construct: Numerical cognition, number sense
 * LD Target: Dyscalculia
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import { NumberJumperLogic, type NumberTrial } from './numberJumper.logic';
import { extractNumberJumperFeatures } from './numberJumper.features';

const GAME_DURATION_MS = 2.5 * 60 * 1000;
const INTER_TRIAL_MS = 800;

export default function NumberJumper({ language, logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const logicRef = useRef(new NumberJumperLogic());
    const startTimeRef = useRef(performance.now());
    const [trial, setTrial] = useState<NumberTrial | null>(null);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const gameEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const nextTrial = useCallback(() => {
        const t = logicRef.current.nextTrial();
        setTrial(t);
        setFeedback(null);
        logger.log('stimulus_shown', {
            stimulus_id: t.id,
            difficulty_level: t.difficulty,
            metadata: { stimulus: t.stimulus, task_type: t.task_type, choices: t.choices },
        });
    }, [logger]);

    useEffect(() => {
        logger.log('game_start', { metadata: { game_id: 'number-jumper' } });
        startTimeRef.current = performance.now();
        nextTrial();
        gameEndTimerRef.current = setTimeout(() => { void endGame(); }, GAME_DURATION_MS);
        return () => {
            gameEndTimerRef.current && clearTimeout(gameEndTimerRef.current);
            trialTimerRef.current && clearTimeout(trialTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAnswer = useCallback((selectedIndex: number) => {
        if (!trial || feedback !== null) return;
        const latency = performance.now() - trial.shown_at_ms;
        const result = logicRef.current.answer(trial.id, selectedIndex);

        logger.log(result, {
            stimulus_id: trial.id,
            response_latency_ms: latency,
            difficulty_level: trial.difficulty,
            metadata: { selected: trial.choices[selectedIndex], correct: trial.choices[trial.correct_index], task_type: trial.task_type },
        });

        setFeedback(result);
        trialTimerRef.current = setTimeout(nextTrial, INTER_TRIAL_MS);
    }, [trial, feedback, logger, nextTrial]);

    const endGame = useCallback(async () => {
        gameEndTimerRef.current && clearTimeout(gameEndTimerRef.current);
        trialTimerRef.current && clearTimeout(trialTimerRef.current);
        const stats = logicRef.current.getStats();
        const endTime = performance.now();
        const allEvents = await logger.getAllEvents();
        const features = extractNumberJumperFeatures(allEvents);

        const result: GameResult = {
            game_id: 'number-jumper',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: stats.final_difficulty,
            events_count: allEvents.length,
            summary: { trial_count: stats.trial_count, ...flattenFeatures(features) },
        };
        logger.log('game_complete', { metadata: { game_id: 'number-jumper' } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    if (!trial) return <div role="status">{t('session.loadingGame')}</div>;

    return (
        <div className="game-number-jumper" data-testid="number-jumper">
            <div role="status" aria-live="polite" className="sr-only">
                {t(`games.number-jumper.task.${trial.task_type}`)}
            </div>

            {/* Stimulus — dots for count-match, digit for magnitude-compare / number-word */}
            <div className="number-jumper__stimulus" aria-label={t('games.number-jumper.stimulusLabel', { num: trial.stimulus })}>
                {trial.task_type === 'count-match'
                    ? <DotDisplay count={trial.stimulus} />
                    : <span className="number-jumper__digit">{trial.stimulus}</span>
                }
            </div>

            {/* Choices — GAME-FR-006: 44px min target; GAME-FR-014: number not color-only */}
            <div className="number-jumper__choices" role="group" aria-label={t('games.number-jumper.choicesLabel')}>
                {trial.choices.map((choice, idx) => (
                    <button
                        key={idx}
                        className={[
                            'number-jumper__choice',
                            feedback !== null && idx === trial.correct_index ? 'number-jumper__choice--correct' : '',
                        ].join(' ')}
                        onClick={() => handleAnswer(idx)}
                        disabled={feedback !== null}
                        aria-label={String(choice)}
                        style={{ minWidth: '72px', minHeight: '72px' }}
                    >
                        {choice}
                    </button>
                ))}
            </div>

            {/* GAME-FR-008: feedback */}
            {feedback && <div className={`game-feedback game-feedback--${feedback}`} aria-hidden="true" />}
        </div>
    );
}

/** Dot display for subitizing / counting tasks — GAME-FR-014: shape, not just number */
function DotDisplay({ count }: { count: number }) {
    return (
        <div className="number-jumper__dots" aria-hidden="true">
            {Array.from({ length: Math.min(count, 10) }, (_, i) => (
                <span key={i} className="number-jumper__dot" />
            ))}
            {count > 10 && <span className="number-jumper__digit">{count}</span>}
        </div>
    );
}

function flattenFeatures(f: Record<string, number | null>): Record<string, number> {
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null)) as Record<string, number>;
}
