/**
 * Target Chase — React game component
 * Traceability: GAME-06, SRS Section 4.6, GAME-FR-005/006/008/009/014
 *
 * Fixed difficulty — 70/30 go/no-go, exactly 60 trials (SRS AC).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import {
    TargetChaseLogic,
    TOTAL_TRIALS,
    RESPONSE_WINDOW_MS,
    type ChaseTrial,
    type TrialOutcome,
} from './targetChase.logic';
import { extractTargetChaseFeatures } from './targetChase.features';

export default function TargetChase({ logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const logicRef = useRef(new TargetChaseLogic());
    const startTimeRef = useRef(performance.now());
    const [currentTrial, setCurrentTrial] = useState<ChaseTrial | null>(null);
    const [showStimulus, setShowStimulus] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [trialCount, setTrialCount] = useState(0);
    const isiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const responseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tappedRef = useRef(false);

    const runNextTrial = useCallback(() => {
        const logic = logicRef.current;
        if (logic.isComplete) { void endGame(); return; }

        const trial = logic.nextTrial();
        if (!trial) { void endGame(); return; }
        setCurrentTrial(trial);
        setShowStimulus(false);
        tappedRef.current = false;

        // Wait ISI before showing stimulus
        isiTimerRef.current = setTimeout(() => {
            logic.setOnset(trial.trial_id);
            setShowStimulus(true);
            logger.log('stimulus_shown', {
                stimulus_id: trial.trial_id,
                metadata: { trial_type: trial.trial_type, trial_index: trial.trial_index, isi_ms: trial.isi_ms },
            });

            // Response window — expire after RESPONSE_WINDOW_MS
            responseTimerRef.current = setTimeout(() => {
                if (!tappedRef.current) {
                    const outcome = logic.expireTrial(trial.trial_id);
                    logTrialOutcome(trial.trial_id, trial.trial_type, outcome, null);
                    setShowStimulus(false);
                    setTrialCount(logic.completedCount);
                    setFeedback(outcome === 'correct-rejection' ? 'correct' : null);
                    setTimeout(() => { setFeedback(null); runNextTrial(); }, 300);
                }
            }, RESPONSE_WINDOW_MS);
        }, trial.isi_ms);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logger]);

    useEffect(() => {
        logger.log('game_start', { metadata: { game_id: 'target-chase' } });
        startTimeRef.current = performance.now();
        runNextTrial();
        return () => {
            isiTimerRef.current && clearTimeout(isiTimerRef.current);
            responseTimerRef.current && clearTimeout(responseTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTap = useCallback(() => {
        if (!showStimulus || !currentTrial || tappedRef.current) return;
        tappedRef.current = true;
        responseTimerRef.current && clearTimeout(responseTimerRef.current);

        const tapTime = performance.now();
        const outcome = logicRef.current.recordResponse(currentTrial.trial_id, tapTime);
        const rt = tapTime - currentTrial.stimulus_onset_ms;

        logTrialOutcome(currentTrial.trial_id, currentTrial.trial_type, outcome, rt);
        setShowStimulus(false);
        setTrialCount(logicRef.current.completedCount);

        const isCorrect = outcome === 'hit';
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setTimeout(() => { setFeedback(null); runNextTrial(); }, 400);
    }, [showStimulus, currentTrial, runNextTrial]);

    function logTrialOutcome(trialId: string, type: 'go' | 'no-go', outcome: TrialOutcome, rt: number | null) {
        const eventType = outcome === 'hit' ? 'correct'
            : outcome === 'false-alarm' ? 'commission'
                : outcome === 'miss' ? 'omission'
                    : 'correct'; // correct-rejection
        logger.log(eventType, {
            stimulus_id: trialId,
            response_latency_ms: rt,
            metadata: { trial_type: type, outcome },
        });
    }

    const endGame = useCallback(async () => {
        isiTimerRef.current && clearTimeout(isiTimerRef.current);
        responseTimerRef.current && clearTimeout(responseTimerRef.current);
        const stats = logicRef.current.getStats();
        const endTime = performance.now();
        const allEvents = await logger.getAllEvents();
        const features = extractTargetChaseFeatures(allEvents);

        const result: GameResult = {
            game_id: 'target-chase',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: 3, // fixed difficulty
            events_count: allEvents.length,
            summary: { ...flatStats(stats), ...flattenFeatures(features) },
        };
        logger.log('game_complete', { metadata: { game_id: 'target-chase', ...stats } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    return (
        <div
            className="game-target-chase"
            data-testid="target-chase"
            onClick={handleTap}
            onKeyDown={(e) => e.key === ' ' && handleTap()}
            // GAME-FR-006: entire screen is the tap target for this game
            style={{ cursor: 'pointer', width: '100%', height: '100%', minHeight: '400px' }}
            role="button"
            tabIndex={0}
            aria-label={t('games.target-chase.tapInstructions')}
        >
            <div role="status" aria-live="polite" className="sr-only">
                {showStimulus
                    ? currentTrial?.trial_type === 'go'
                        ? t('games.target-chase.goIcon')
                        : t('games.target-chase.noGoIcon')
                    : t('games.target-chase.waiting')}
            </div>

            {/* Trial counter */}
            <p className="target-chase__counter" aria-hidden="true">
                {trialCount} / {TOTAL_TRIALS}
            </p>

            {/* Stimulus — GAME-FR-014: icon uses shape + text, not color alone */}
            <div className={`target-chase__stimulus ${showStimulus ? 'target-chase__stimulus--visible' : 'target-chase__stimulus--hidden'}`}>
                {showStimulus && currentTrial && (
                    <div className={`target-chase__icon target-chase__icon--${currentTrial.trial_type}`}>
                        {currentTrial.trial_type === 'go' ? '🎯' : '✋'}
                    </div>
                )}
            </div>

            {feedback && <div className={`game-feedback game-feedback--${feedback}`} aria-hidden="true" />}
        </div>
    );
}

function flatStats(s: Record<string, unknown>): Record<string, number> {
    return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenFeatures(f: Record<string, any>): Record<string, number> {
    return Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
}
