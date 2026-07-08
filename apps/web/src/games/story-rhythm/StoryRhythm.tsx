/**
 * Story Rhythm — React game component
 * Traceability: GAME-03, GAME-FR-005/006/008/009/015
 *
 * GAME-FR-015: Story Rhythm adds a vibration fallback on mobile.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import { StoryRhythmLogic, TOTAL_PHRASES, MAX_SYNC_ERROR_MS } from './storyRhythm.logic';
import { extractStoryRhythmFeatures } from './storyRhythm.features';

const PHRASE_GAP_MS = 1500;

export default function StoryRhythm({ language, logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const logicRef = useRef(new StoryRhythmLogic());
    const startTimeRef = useRef(performance.now());
    const [phraseIdx, setPhraseIdx] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [beatPulse, setBeatPulse] = useState(false);
    const [lastTapResult, setLastTapResult] = useState<'on-beat' | 'off-beat' | null>(null);
    const phraseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const beatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startPhrase = useCallback(() => {
        const logic = logicRef.current;
        if (logic.isComplete) { void endGame(); return; }

        const phrase = logic.startPhrase();
        setIsRecording(true);
        logger.log('stimulus_shown', { metadata: { phrase_index: phrase.phrase_index, bpm: phrase.config.bpm } });

        let beatIdx = 0;
        beatTimerRef.current = setInterval(() => {
            setBeatPulse(true);
            logger.log('stimulus_shown', { stimulus_id: `beat-${beatIdx}`, metadata: { expected_ms: phrase.beat_times[beatIdx] } });
            setTimeout(() => setBeatPulse(false), 120);
            beatIdx++;
            if (beatIdx >= phrase.config.syllable_count) {
                clearInterval(beatTimerRef.current!);
                setIsRecording(false);
                logic.endPhrase();
                setPhraseIdx((p) => p + 1);
                if (logic.isComplete) { void endGame(); return; }
                phraseTimerRef.current = setTimeout(startPhrase, PHRASE_GAP_MS);
            }
        }, phrase.config.inter_beat_ms);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logger]);

    useEffect(() => {
        logger.log('game_start', { metadata: { game_id: 'story-rhythm' } });
        startTimeRef.current = performance.now();
        phraseTimerRef.current = setTimeout(startPhrase, 1000);
        return () => {
            phraseTimerRef.current && clearTimeout(phraseTimerRef.current);
            beatTimerRef.current && clearInterval(beatTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTap = useCallback(() => {
        if (!isRecording) return;
        const tapTime = performance.now();
        const tap = logicRef.current.recordTap(tapTime);
        if (!tap) return;

        // GAME-FR-015: vibration fallback for audio
        if ('vibrate' in navigator) navigator.vibrate(tap.on_beat ? 80 : 30);

        logger.log('tap', {
            response_latency_ms: tap.sync_error_ms,
            metadata: { sync_error_ms: tap.sync_error_ms, on_beat: tap.on_beat, expected_beat_ms: tap.expected_beat_ms },
        });

        setLastTapResult(tap.on_beat ? 'on-beat' : 'off-beat');
        setTimeout(() => setLastTapResult(null), 400);
    }, [isRecording, logger]);

    const endGame = useCallback(async () => {
        beatTimerRef.current && clearInterval(beatTimerRef.current);
        phraseTimerRef.current && clearTimeout(phraseTimerRef.current);
        const logic = logicRef.current;
        const stats = logic.getStats();
        const endTime = performance.now();
        const allEvents = await logger.getAllEvents();
        const features = extractStoryRhythmFeatures(allEvents);

        const result: GameResult = {
            game_id: 'story-rhythm',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: 3,
            events_count: allEvents.length,
            summary: { ...flatStats(stats), ...flattenFeatures(features) },
        };
        logger.log('game_complete', { metadata: { game_id: 'story-rhythm' } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    return (
        <div className="game-story-rhythm" data-testid="story-rhythm">
            <div role="status" aria-live="polite" className="sr-only">
                {isRecording ? t('games.story-rhythm.tapNow') : t('games.story-rhythm.listen')}
            </div>

            {/* Beat pulse indicator — visual cue (GAME-FR-015: replaces audio feedback when muted) */}
            <div
                className={`story-rhythm__beat ${beatPulse ? 'story-rhythm__beat--pulse' : ''}`}
                aria-hidden="true"
            />

            <p className="story-rhythm__phrase-counter">
                {t('games.story-rhythm.phrase', { current: phraseIdx + 1, total: TOTAL_PHRASES })}
            </p>

            {/* Large tap target (GAME-FR-006: 44px min — this is much larger) */}
            <button
                className={[
                    'story-rhythm__tap-btn',
                    lastTapResult === 'on-beat' ? 'story-rhythm__tap-btn--on-beat' : '',
                    lastTapResult === 'off-beat' ? 'story-rhythm__tap-btn--off-beat' : '',
                ].join(' ')}
                onClick={handleTap}
                disabled={!isRecording}
                aria-label={t('games.story-rhythm.tapButton')}
                // GAME-FR-006: touch target well above 44px
                style={{ minWidth: '120px', minHeight: '120px' }}
            >
                {t('games.story-rhythm.tap')}
            </button>

            {/* GAME-FR-008: visual feedback (green border flash = on-beat) */}
            {lastTapResult && (
                <div className={`game-feedback game-feedback--${lastTapResult === 'on-beat' ? 'correct' : 'incorrect'}`} aria-hidden="true" />
            )}
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
