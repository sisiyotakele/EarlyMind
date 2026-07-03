/**
 * Word Echo — React game component
 * Traceability: GAME-07, SRS Section 4.7, GAME-FR-005/006/007/008/009/014
 *
 * "The child hears a short word list (2-5 words) and selects the matching
 *  picture/word cards in order; list length grows with correct performance."
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { GameResult, DifficultyLevel } from '@earlymind/shared-types';

import type { GameProps } from '../engine/GameOrchestrator';
import { WordEchoLogic, WORD_LIST_LENGTH, type WordRound } from './wordEcho.logic';
import { extractWordEchoFeatures } from './wordEcho.features';

const TOTAL_ROUNDS = 12;
const AUDIO_WORD_GAP_MS = 800;  // gap between words during playback

type Phase = 'listen' | 'recall' | 'feedback' | 'between';

export default function WordEcho({ language, logger, onComplete }: GameProps) {
    const { t } = useTranslation();
    const logicRef = useRef(new WordEchoLogic(language));
    const startTimeRef = useRef(performance.now());
    const [phase, setPhase] = useState<Phase>('between');
    const [round, setRound] = useState<WordRound | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1); // word being highlighted during listen
    const [selectedWords, setSelectedWords] = useState<string[]>([]);
    const [roundResult, setRoundResult] = useState<{ correct: boolean; error_type: string | null } | null>(null);
    const [difficulty, setDifficulty] = useState<DifficultyLevel>(1);
    const [roundCount, setRoundCount] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startRound = useCallback(() => {
        if (roundCount >= TOTAL_ROUNDS) { void endGame(); return; }
        const logic = logicRef.current;
        const r = logic.startRound();
        setRound(r);
        setSelectedWords([]);
        setRoundResult(null);
        setDifficulty(logic.currentDifficulty);
        setPhase('listen');

        logger.log('stimulus_shown', {
            metadata: {
                round_id: r.round_id,
                list_length: r.target_list.length,
                difficulty: logic.currentDifficulty,
                words: r.target_list,
            },
        });

        // Play words one by one (audio would fire here via AudioPlayer component)
        let idx = 0;
        function playNextWord() {
            setCurrentWordIndex(idx);
            // In production: AudioPlayer.play(r.target_list[idx], language)
            timerRef.current = setTimeout(() => {
                idx++;
                if (idx < r.target_list.length) {
                    playNextWord();
                } else {
                    setCurrentWordIndex(-1);
                    logic.beginRecall();
                    setPhase('recall');
                }
            }, AUDIO_WORD_GAP_MS);
        }
        timerRef.current = setTimeout(playNextWord, 500);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roundCount, language, logger]);

    useEffect(() => {
        logger.log('game_start', { metadata: { game_id: 'word-echo' } });
        startTimeRef.current = performance.now();
        timerRef.current = setTimeout(startRound, 600);
        return () => { timerRef.current && clearTimeout(timerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleWordSelect = useCallback((word: string) => {
        if (phase !== 'recall' || !round) return;
        const tapTime = performance.now();

        logicRef.current.selectWord(word, tapTime);
        const newSelected = [...selectedWords, word];
        setSelectedWords(newSelected);

        logger.log('tap', {
            response_latency_ms: tapTime,
            metadata: { word, position_in_response: newSelected.length - 1, list_length: round.target_list.length },
        });

        // Check if all words selected
        if (newSelected.length >= round.target_list.length) {
            const result = logicRef.current.scoreRound();
            setRoundResult(result);
            setPhase('feedback');

            // SRS Section 4.7 AC: log order-errors and omission-errors separately
            const eventType = result.correct ? 'correct' : 'incorrect';
            logger.log(eventType, {
                difficulty_level: logicRef.current.currentDifficulty,
                metadata: {
                    round_id: round.round_id,
                    list_length: round.target_list.length,
                    error_type: result.error_type,
                    target_list: round.target_list,
                    child_response: newSelected,
                },
            });

            setRoundCount((c) => c + 1);
            setDifficulty(logicRef.current.currentDifficulty);

            timerRef.current = setTimeout(() => {
                setPhase('between');
                timerRef.current = setTimeout(startRound, 500);
            }, 1200);
        }
    }, [phase, round, selectedWords, logger, startRound]);

    const endGame = useCallback(async () => {
        timerRef.current && clearTimeout(timerRef.current);
        const stats = logicRef.current.getStats();
        const endTime = performance.now();
        const allEvents = await logger.getAllEvents();
        const features = extractWordEchoFeatures(allEvents);

        const result: GameResult = {
            game_id: 'word-echo',
            start_time_ms: startTimeRef.current,
            end_time_ms: endTime,
            duration_ms: endTime - startTimeRef.current,
            final_difficulty: stats.final_difficulty,
            events_count: allEvents.length,
            summary: { ...flatStats(stats), ...flattenFeatures(features) },
        };
        logger.log('game_complete', { metadata: { game_id: 'word-echo', ...stats } });
        await logger.stop();
        onComplete(result);
    }, [logger, onComplete]);

    const wordBank = round?.target_list ?? [];
    // All unique words in the current round are the choices (SRS: picture/word cards)
    const choices = round?.target_list ? [...round.target_list].sort() : [];

    return (
        <div className="game-word-echo" data-testid="word-echo">
            <div role="status" aria-live="polite" className="sr-only">
                {phase === 'listen' && t('games.word-echo.listenPhase')}
                {phase === 'recall' && t('games.word-echo.recallPhase')}
                {phase === 'feedback' && (roundResult?.correct ? t('games.word-echo.correct') : t('games.word-echo.tryAgain'))}
            </div>

            {/* Round + span progress */}
            <p className="word-echo__progress">
                {t('games.word-echo.round', { current: roundCount + 1, total: TOTAL_ROUNDS })}
                {' · '}
                {t('games.word-echo.span', { span: WORD_LIST_LENGTH[difficulty] })}
            </p>

            {/* Listen phase: highlight words as they play */}
            {phase === 'listen' && round && (
                <div className="word-echo__word-list" aria-label={t('games.word-echo.listeningLabel')}>
                    {round.target_list.map((word, i) => (
                        <span
                            key={i}
                            className={`word-echo__word ${i === currentWordIndex ? 'word-echo__word--active' : ''}`}
                            aria-hidden="true"
                        >
                            {word}
                        </span>
                    ))}
                </div>
            )}

            {/* Recall phase: tap words in order */}
            {(phase === 'recall' || phase === 'feedback') && round && (
                <>
                    {/* Show selected order so far */}
                    <div className="word-echo__response" aria-live="polite">
                        {selectedWords.map((w, i) => (
                            <span key={i} className="word-echo__selected-word">{w}</span>
                        ))}
                        {Array.from({ length: Math.max(0, round.target_list.length - selectedWords.length) }, (_, i) => (
                            <span key={`blank-${i}`} className="word-echo__blank-slot" aria-label={t('games.word-echo.emptySlot')} />
                        ))}
                    </div>

                    {/* Word card choices — GAME-FR-006: min 44px touch target */}
                    <div className="word-echo__choices" role="group" aria-label={t('games.word-echo.choicesLabel')}>
                        {choices.map((word) => {
                            const alreadySelected = selectedWords.includes(word);
                            return (
                                <button
                                    key={word}
                                    className={`word-echo__card ${alreadySelected ? 'word-echo__card--used' : ''}`}
                                    onClick={() => !alreadySelected && handleWordSelect(word)}
                                    disabled={phase === 'feedback' || alreadySelected}
                                    aria-pressed={alreadySelected}
                                    aria-label={word}
                                    style={{ minWidth: '72px', minHeight: '64px' }}
                                >
                                    {word}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* GAME-FR-008: feedback */}
            {roundResult && phase === 'feedback' && (
                <div
                    className={`game-feedback game-feedback--${roundResult.correct ? 'correct' : 'incorrect'}`}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}

function flatStats(s: Record<string, unknown>): Record<string, number> {
    return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
}
function flattenFeatures(f: Record<string, number | null>): Record<string, number> {
    return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null)) as Record<string, number>;
}
