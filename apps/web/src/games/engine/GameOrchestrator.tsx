/**
 * GameOrchestrator — top-level React component managing the 7-game sequence
 * Traceability: GAME-FR-002, GAME-FR-003, GAME-FR-005, GAME-FR-008
 *
 * Responsibilities:
 * - Fixed 7-game sequence with 3-second transitions (GAME-FR-002)
 * - Progress bar "Game X of 7" always visible (GAME-FR-002)
 * - Pause/Resume overlay with max 3 pauses (GAME-FR-003)
 * - Correct/incorrect visual + audio feedback (GAME-FR-008)
 * - Trilingual audio instructions per game (GAME-FR-005)
 * - Session completion screen (GAME-FR-004)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameId, GameResult, Language, LocalSessionState } from '@earlymind/shared-types';
import { GAME_SEQUENCE, TOTAL_GAMES } from '@earlymind/shared-types';

import { SessionController } from './SessionController';
import { EventLogger } from './EventLogger';

// ─── Game component lazy imports (GAME-FR-012: code splitting ~700KB each) ───
import { lazy, Suspense } from 'react';

const GameComponents: Record<GameId, React.LazyExoticComponent<React.ComponentType<GameProps>>> = {
    'letter-rain': lazy(() => import('../letter-rain/LetterRain')),
    'pattern-mirror': lazy(() => import('../pattern-mirror/PatternMirror')),
    'story-rhythm': lazy(() => import('../story-rhythm/StoryRhythm')),
    'number-jumper': lazy(() => import('../number-jumper/NumberJumper')),
    'color-sequence': lazy(() => import('../color-sequence/ColorSequence')),
    'target-chase': lazy(() => import('../target-chase/TargetChase')),
    'word-echo': lazy(() => import('../word-echo/WordEcho')),
};

export interface GameProps {
    sessionId: string;
    language: Language;
    logger: EventLogger;
    onComplete: (result: GameResult) => void;
}

interface GameOrchestratorProps {
    childId: string;
    childName: string;
    childAgeMonths: number;
    language: Language;
    /** Existing session state (for resume — GAME-FR-003) */
    resumeState?: LocalSessionState;
    onSessionComplete: (sessionId: string) => void;
    onSessionAbandon: () => void;
}

type OrchestratorPhase =
    | 'initializing'
    | 'transition'  // 3-second transition between games (GAME-FR-002)
    | 'playing'
    | 'paused'
    | 'completed'
    | 'error';

/** GAME-FR-002: exactly 3 seconds between games */
const TRANSITION_DURATION_MS = 3000;
/** GAME-FR-008: feedback visible duration */
const FEEDBACK_DURATION_MS = 800;

export function GameOrchestrator({
    childId,
    childName,
    childAgeMonths,
    language,
    resumeState,
    onSessionComplete,
    onSessionAbandon,
}: GameOrchestratorProps) {
    const { t } = useTranslation();

    const [phase, setPhase] = useState<OrchestratorPhase>('initializing');
    const [gameIndex, setGameIndex] = useState(resumeState?.current_game_index ?? 0);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [correctStreak, setCorrectStreak] = useState(0);

    const sessionCtrlRef = useRef<SessionController | null>(null);
    const loggerRef = useRef<EventLogger | null>(null);
    const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Initialization ─────────────────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            let ctrl: SessionController;

            if (resumeState) {
                // Resume existing session (GAME-FR-003)
                const existing = await SessionController.resume(resumeState.session_id);
                if (!existing || cancelled) return;
                ctrl = existing;
            } else {
                // New session (GAME-FR-001)
                ctrl = await SessionController.createNew({ childId, language });
            }

            if (cancelled) return;

            sessionCtrlRef.current = ctrl;

            const currentGameId = ctrl.currentGameId;
            if (!currentGameId) {
                setPhase('completed');
                return;
            }

            loggerRef.current = new EventLogger(ctrl.sessionId, currentGameId);
            loggerRef.current.start();
            loggerRef.current.log('session_start', {});

            // Start with a 3-second transition screen before first game (GAME-FR-002)
            startTransition();
        })();

        return () => {
            cancelled = true;
            transitionTimerRef.current && clearTimeout(transitionTimerRef.current);
            feedbackTimerRef.current && clearTimeout(feedbackTimerRef.current);
            void loggerRef.current?.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Transition between games (GAME-FR-002) ──────────────────────────────────

    function startTransition() {
        setPhase('transition');
        transitionTimerRef.current = setTimeout(() => {
            setPhase('playing');
        }, TRANSITION_DURATION_MS);
    }

    // ─── Game completion handler (GAME-FR-002/004) ────────────────────────────────

    const handleGameComplete = useCallback((result: GameResult) => {
        const ctrl = sessionCtrlRef.current;
        if (!ctrl) return;

        // Log game complete
        loggerRef.current?.log('game_complete', { metadata: result });
        void loggerRef.current?.stop();

        ctrl.completeCurrentGame(result);
        const nextIndex = ctrl.currentGameIndex;

        if (nextIndex >= TOTAL_GAMES) {
            // GAME-FR-004: all 7 games done
            setPhase('completed');
            onSessionComplete(ctrl.sessionId);
            return;
        }

        // Set up logger for next game
        const nextGameId = GAME_SEQUENCE[nextIndex]!;
        loggerRef.current = new EventLogger(ctrl.sessionId, nextGameId);
        loggerRef.current.start();
        loggerRef.current.log('game_start', {});

        setGameIndex(nextIndex);
        startTransition();
    }, [onSessionComplete]);

    // ─── Feedback system (GAME-FR-008) ───────────────────────────────────────────

    const showFeedback = useCallback((type: 'correct' | 'incorrect') => {
        setFeedback(type);
        feedbackTimerRef.current && clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);

        if (type === 'correct') {
            setCorrectStreak((prev) => prev + 1);
        } else {
            setCorrectStreak(0);
        }
    }, []);

    // ─── Pause/Resume (GAME-FR-003) ───────────────────────────────────────────────

    const handlePause = useCallback(() => {
        const ctrl = sessionCtrlRef.current;
        if (!ctrl || !ctrl.canPause) return;
        ctrl.pause();
        loggerRef.current?.log('session_pause', {});
        setPhase('paused');
    }, []);

    const handleResume = useCallback(() => {
        const ctrl = sessionCtrlRef.current;
        if (!ctrl || phase !== 'paused') return;
        ctrl.resume();
        loggerRef.current?.log('session_resume', {});
        setPhase('playing');
    }, [phase]);

    const handleExitSession = useCallback(() => {
        const ctrl = sessionCtrlRef.current;
        void ctrl?.abandon();
        void loggerRef.current?.stop();
        onSessionAbandon();
    }, [onSessionAbandon]);

    // ─── Render ───────────────────────────────────────────────────────────────────

    if (phase === 'initializing') {
        return (
            <div className="orchestrator-loading" role="status" aria-live="polite">
                <p>{t('session.initializing')}</p>
            </div>
        );
    }

    if (phase === 'completed') {
        return (
            <div className="session-complete" role="main" aria-live="assertive">
                {/* GAME-FR-004: "All done! Great work!" + encouraging message */}
                <h1 className="session-complete__title">{t('session.complete.title')}</h1>
                <p className="session-complete__subtitle">{t('session.complete.subtitle')}</p>
                <div className="session-complete__processing" aria-live="polite">
                    <span className="spinner" aria-hidden="true" />
                    <p>{t('session.complete.processing')}</p>
                </div>
            </div>
        );
    }

    const currentGameId = GAME_SEQUENCE[gameIndex];

    return (
        <div className="orchestrator" data-testid="game-orchestrator">

            {/* GAME-FR-002: "Game X of 7" progress bar always visible */}
            <GameProgressBar
                currentIndex={gameIndex}
                total={TOTAL_GAMES}
                t={t}
            />

            {/* GAME-FR-003: Pause button always visible */}
            {phase !== 'paused' && (
                <PauseButton
                    onClick={handlePause}
                    disabled={!sessionCtrlRef.current?.canPause}
                    t={t}
                />
            )}

            {/* GAME-FR-003: Pause overlay */}
            {phase === 'paused' && (
                <PauseOverlay
                    pauseCount={sessionCtrlRef.current?.pauseCount ?? 0}
                    onResume={handleResume}
                    onExit={handleExitSession}
                    t={t}
                />
            )}

            {/* GAME-FR-002: 3-second transition screen */}
            {phase === 'transition' && currentGameId && (
                <GameTransitionScreen gameId={currentGameId} gameIndex={gameIndex} t={t} />
            )}

            {/* Active game */}
            {phase === 'playing' && currentGameId && (
                <Suspense fallback={<GameLoadingSpinner t={t} />}>
                    {React.createElement(GameComponents[currentGameId]!, {
                        sessionId: sessionCtrlRef.current?.sessionId ?? '',
                        language,
                        logger: loggerRef.current!,
                        onComplete: handleGameComplete,
                    })}
                </Suspense>
            )}

            {/* GAME-FR-008: visual feedback overlay — <100ms (CSS animation) */}
            {feedback !== null && (
                <FeedbackOverlay type={feedback} />
            )}

            {/* GAME-FR-008: periodic encouragement every 5 correct (t count) */}
            {correctStreak > 0 && correctStreak % 5 === 0 && (
                <EncouragementBanner t={t} />
            )}
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TranslationFn {
    (key: string, opts?: Record<string, unknown>): string;
}

function GameProgressBar({
    currentIndex,
    total,
    t,
}: {
    currentIndex: number;
    total: number;
    t: TranslationFn;
}) {
    const displayNumber = currentIndex + 1;
    const pct = (currentIndex / total) * 100;

    return (
        /* GAME-FR-002: "Game X of 7 progress bar is always visible" */
        <div
            className="game-progress-bar"
            role="progressbar"
            aria-valuenow={currentIndex}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={t('session.progress.label', { current: displayNumber, total })}
        >
            <span className="game-progress-bar__text">
                {t('session.progress.label', { current: displayNumber, total })}
            </span>
            <div className="game-progress-bar__track" aria-hidden="true">
                <div
                    className="game-progress-bar__fill"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function PauseButton({
    onClick,
    disabled,
    t,
}: {
    onClick: () => void;
    disabled: boolean;
    t: TranslationFn;
}) {
    return (
        /* GAME-FR-003: "A 'Pause' button in the top-right corner" */
        <button
            className="pause-btn"
            onClick={onClick}
            disabled={disabled}
            aria-label={t('session.pause')}
            style={{ position: 'absolute', top: 12, right: 12 }}
        >
            ⏸
        </button>
    );
}

function PauseOverlay({
    pauseCount,
    onResume,
    onExit,
    t,
}: {
    pauseCount: number;
    onResume: () => void;
    onExit: () => void;
    t: TranslationFn;
}) {
    return (
        /* GAME-FR-003: "shows a 'Resume' / 'Exit Session' overlay" */
        <div
            className="pause-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
        >
            <h2 id="pause-title">{t('session.paused.title')}</h2>
            <p>{t('session.paused.pauseCount', { count: pauseCount, max: 3 })}</p>
            <button
                className="pause-overlay__resume-btn"
                onClick={onResume}
                autoFocus
            >
                {t('session.paused.resume')}
            </button>
            <button
                className="pause-overlay__exit-btn"
                onClick={onExit}
            >
                {t('session.paused.exit')}
            </button>
        </div>
    );
}

function GameTransitionScreen({
    gameId,
    gameIndex,
    t,
}: {
    gameId: GameId;
    gameIndex: number;
    t: TranslationFn;
}) {
    return (
        /* GAME-FR-002: "A 3-second encouraging transition screen appears between games" */
        <div
            className="game-transition"
            role="status"
            aria-live="polite"
        >
            <p className="game-transition__encouragement">{t('session.transition.encouragement')}</p>
            <p className="game-transition__next">
                {t('session.transition.nextGame', {
                    number: gameIndex + 1,
                    name: t(`games.${gameId}.name`),
                })}
            </p>
        </div>
    );
}

function FeedbackOverlay({ type }: { type: 'correct' | 'incorrect' }) {
    return (
        /* GAME-FR-008: visual feedback <100ms (CSS transition handles animation) */
        <div
            className={`feedback-overlay feedback-overlay--${type}`}
            aria-hidden="true"
            aria-live="off"
        >
            {type === 'correct' ? (
                /* GAME-FR-008: "green checkmark/sparkle" */
                <span className="feedback-overlay__icon feedback-overlay__icon--correct">✓</span>
            ) : (
                /* GAME-FR-008: "gentle red X" — NEVER "Wrong!" */
                <span className="feedback-overlay__icon feedback-overlay__icon--incorrect">✗</span>
            )}
        </div>
    );
}

function EncouragementBanner({ t }: { t: TranslationFn }) {
    return (
        /* GAME-FR-008: "periodic encouragement ('Nice work!') every 5 correct responses" */
        <div
            className="encouragement-banner"
            role="status"
            aria-live="polite"
        >
            {t('session.feedback.encouragement')}
        </div>
    );
}

function GameLoadingSpinner({ t }: { t: TranslationFn }) {
    return (
        <div className="game-loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>{t('session.loadingGame')}</p>
        </div>
    );
}

export type { GameOrchestratorProps };
