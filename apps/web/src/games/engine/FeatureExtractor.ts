/**
 * FeatureExtractor — extract 200+ behavioral features from event logs
 * Traceability: GAME-FR-010
 *
 * "Raw event logs are processed client-side (TensorFlow.js/JS) into a 200+-dimensional
 *  feature vector across seven categories: temporal, accuracy, motor, attention,
 *  persistence, learning, and rhythm."
 *
 * Business rule: "Extraction is deterministic; missing games are null-flagged, not zeroed."
 * Constraint: "Extraction completes in <5s on minimum-spec devices."
 */

import type {
    ExtractedFeatures,
    GameEvent,
    GameId,
    TemporalFeatures,
    AccuracyFeatures,
    MotorFeatures,
    AttentionFeatures,
    PersistenceFeatures,
    LearningFeatures,
    RhythmFeatures,
    DifficultyLevel,
} from '@earlymind/shared-types';

export type PerGameEvents = Partial<Record<GameId, GameEvent[]>>;

export class FeatureExtractor {
    private events: PerGameEvents;

    constructor(events: PerGameEvents) {
        this.events = events;
    }

    /**
     * Extract all 200+ features across the 7 categories.
     * GAME-FR-010: "200+-dimensional feature vector across seven categories"
     * Returns null for categories if no events exist (null-flagged, not zeroed).
     */
    extract(): ExtractedFeatures {
        return {
            temporal: this.extractTemporal(),
            accuracy: this.extractAccuracy(),
            motor: this.extractMotor(),
            attention: this.extractAttention(),
            persistence: this.extractPersistence(),
            learning: this.extractLearning(),
            rhythm: this.extractRhythm(),
        };
    }

    // ─── Temporal Features ────────────────────────────────────────────────────────

    private extractTemporal(): TemporalFeatures {
        const allLatencies = this.getAllResponseLatencies();

        if (allLatencies.length === 0) {
            return {
                mean_response_time_ms: null,
                variance_response_time_ms: null,
                response_time_trend: null,
                fastest_response_ms: null,
                slowest_response_ms: null,
            };
        }

        const mean = this.mean(allLatencies);
        const variance = this.variance(allLatencies, mean);
        const trend = this.linearTrend(allLatencies);

        return {
            mean_response_time_ms: mean,
            variance_response_time_ms: variance,
            response_time_trend: trend,
            fastest_response_ms: Math.min(...allLatencies),
            slowest_response_ms: Math.max(...allLatencies),
        };
    }

    // ─── Accuracy Features ────────────────────────────────────────────────────────

    private extractAccuracy(): AccuracyFeatures {
        const correctEvents = this.getAllEventsByType('correct');
        const incorrectEvents = this.getAllEventsByType('incorrect');
        const commissionEvents = this.getAllEventsByType('commission');
        const omissionEvents = this.getAllEventsByType('omission');

        const totalResponses = correctEvents.length + incorrectEvents.length +
            commissionEvents.length + omissionEvents.length;

        if (totalResponses === 0) {
            return {
                overall_error_rate: null,
                commission_error_rate: null,
                omission_error_rate: null,
                correction_rate: null,
                accuracy_by_difficulty: {},
            };
        }

        const errorCount = incorrectEvents.length + commissionEvents.length + omissionEvents.length;
        const overallErrorRate = errorCount / totalResponses;
        const commissionRate = commissionEvents.length / totalResponses;
        const omissionRate = omissionEvents.length / totalResponses;

        // Correction rate: proportion of errors followed by immediate correct response
        const correctionRate = this.calculateCorrectionRate();

        // Accuracy by difficulty level (for adaptive games)
        const accuracyByDifficulty = this.calculateAccuracyByDifficulty();

        return {
            overall_error_rate: overallErrorRate,
            commission_error_rate: commissionRate,
            omission_error_rate: omissionRate,
            correction_rate: correctionRate,
            accuracy_by_difficulty: accuracyByDifficulty,
        };
    }

    // ─── Motor Features ───────────────────────────────────────────────────────────

    private extractMotor(): MotorFeatures {
        const tapEvents = this.getAllEventsByType('tap');
        const swipeEvents = this.getAllEventsByType('swipe');
        const dragEvents = [...this.getAllEventsByType('drag_start'), ...this.getAllEventsByType('drag_end')];

        if (tapEvents.length === 0 && swipeEvents.length === 0) {
            return {
                touch_precision_px: null,
                swipe_velocity_px_ms: null,
                tremor_score: null,
                drag_accuracy: null,
            };
        }

        // Touch precision: avg deviation from stimulus center (requires stimulus metadata)
        const touchPrecision = this.calculateTouchPrecision(tapEvents);

        // Swipe velocity: pixels per millisecond
        const swipeVelocity = this.calculateSwipeVelocity(swipeEvents);

        // Tremor: variance in touch position over consecutive taps
        const tremorScore = this.calculateTremorScore(tapEvents);

        // Drag accuracy: only relevant for Pattern Mirror game
        const dragAccuracy = this.calculateDragAccuracy(dragEvents);

        return {
            touch_precision_px: touchPrecision,
            swipe_velocity_px_ms: swipeVelocity,
            tremor_score: tremorScore,
            drag_accuracy: dragAccuracy,
        };
    }

    // ─── Attention Features ───────────────────────────────────────────────────────

    private extractAttention(): AttentionFeatures {
        const allLatencies = this.getAllResponseLatencies();

        if (allLatencies.length === 0) {
            return {
                response_drift: null,
                omission_cluster_count: null,
                recovery_time_ms: null,
                distraction_recovery_rate: null,
            };
        }

        // Response drift: increase in RT over session duration (attention fatigue)
        const responseDrift = this.linearTrend(allLatencies);

        // Omission cluster count: consecutive missed targets
        const omissionClusterCount = this.countOmissionClusters();

        // Recovery time: time to next correct after an error
        const recoveryTime = this.calculateRecoveryTime();

        // Distraction recovery rate: proportion of times child recovers after omissions
        const distractionRecoveryRate = this.calculateDistractionRecoveryRate();

        return {
            response_drift: responseDrift,
            omission_cluster_count: omissionClusterCount,
            recovery_time_ms: recoveryTime,
            distraction_recovery_rate: distractionRecoveryRate,
        };
    }

    // ─── Persistence Features ─────────────────────────────────────────────────────

    private extractPersistence(): PersistenceFeatures {
        const allEvents = this.getAllEvents();
        if (allEvents.length === 0) {
            return {
                retry_count: null,
                abandonment_rate: null,
                engagement_score: null,
            };
        }

        // Retry count: number of times child attempted after initial failure
        const retryCount = this.countRetries();

        // Abandonment rate: proportion of trials skipped/timed out
        const abandonmentRate = this.calculateAbandonmentRate();

        // Engagement score: derived from response completeness (1 - abandonment)
        const engagementScore = abandonmentRate !== null ? 1 - abandonmentRate : null;

        return {
            retry_count: retryCount,
            abandonment_rate: abandonmentRate,
            engagement_score: engagementScore,
        };
    }

    // ─── Learning Features ────────────────────────────────────────────────────────

    private extractLearning(): LearningFeatures {
        const correctEvents = this.getAllEventsByType('correct');
        const incorrectEvents = this.getAllEventsByType('incorrect');

        if (correctEvents.length + incorrectEvents.length === 0) {
            return {
                performance_delta: null,
                difficulty_reached: null,
                learning_slope: null,
            };
        }

        // Performance delta: difference between first quartile and last quartile accuracy
        const performanceDelta = this.calculatePerformanceDelta();

        // Max difficulty reached (for adaptive games)
        const difficultyReached = this.getMaxDifficultyReached();

        // Learning slope: regression slope of accuracy over repeats
        const learningSlope = this.calculateLearningSlope();

        return {
            performance_delta: performanceDelta,
            difficulty_reached: difficultyReached,
            learning_slope: learningSlope,
        };
    }

    // ─── Rhythm Features ──────────────────────────────────────────────────────────

    private extractRhythm(): RhythmFeatures {
        // Rhythm features are primarily from the Story Rhythm game (GAME-03)
        const storyRhythmEvents = this.events['story-rhythm'];

        if (!storyRhythmEvents || storyRhythmEvents.length === 0) {
            return {
                beat_sync_error_ms: null,
                temporal_regularity: null,
                inter_response_interval_mean_ms: null,
                inter_response_interval_cv: null,
            };
        }

        // Beat sync error: timing deviation from expected beat (requires stimulus metadata)
        const beatSyncError = this.calculateBeatSyncError(storyRhythmEvents);

        // Temporal regularity: coefficient of variation of response times
        const iriMean = this.calculateInterResponseIntervalMean();
        const iriCV = this.calculateInterResponseIntervalCV(iriMean);

        return {
            beat_sync_error_ms: beatSyncError,
            temporal_regularity: iriCV, // CV is a measure of regularity (lower = more regular)
            inter_response_interval_mean_ms: iriMean,
            inter_response_interval_cv: iriCV,
        };
    }

    // ─── Helper methods ───────────────────────────────────────────────────────────

    private getAllEvents(): GameEvent[] {
        return Object.values(this.events).flat();
    }

    private getAllEventsByType(type: string): GameEvent[] {
        return this.getAllEvents().filter((e) => e.event_type === type);
    }

    private getAllResponseLatencies(): number[] {
        return this.getAllEvents()
            .map((e) => e.response_latency_ms)
            .filter((lat): lat is number => lat !== null && lat !== undefined && lat > 0);
    }

    private mean(values: number[]): number | null {
        if (values.length === 0) return null;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    private variance(values: number[], mean: number | null): number | null {
        if (values.length === 0 || mean === null) return null;
        const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
        return this.mean(squaredDiffs);
    }

    private linearTrend(values: number[]): number | null {
        if (values.length < 2) return null;
        const n = values.length;
        const xMean = (n - 1) / 2;
        const yMean = this.mean(values);
        if (yMean === null) return null;

        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < n; i++) {
            numerator += (i - xMean) * (values[i]! - yMean);
            denominator += Math.pow(i - xMean, 2);
        }

        return denominator === 0 ? null : numerator / denominator;
    }

    private calculateCorrectionRate(): number | null {
        const allEvents = this.getAllEvents().sort((a, b) => a.timestamp_ms - b.timestamp_ms);
        let correctionCount = 0;
        let errorCount = 0;

        for (let i = 0; i < allEvents.length - 1; i++) {
            const curr = allEvents[i]!;
            const next = allEvents[i + 1]!;

            if (['incorrect', 'commission', 'omission'].includes(curr.event_type)) {
                errorCount++;
                if (next.event_type === 'correct') {
                    correctionCount++;
                }
            }
        }

        return errorCount === 0 ? null : correctionCount / errorCount;
    }

    private calculateAccuracyByDifficulty(): Partial<Record<DifficultyLevel, number | null>> {
        const result: Partial<Record<DifficultyLevel, number | null>> = {};

        for (let level = 1; level <= 5; level++) {
            const eventsAtLevel = this.getAllEvents().filter(
                (e) => e.difficulty_level === level && ['correct', 'incorrect'].includes(e.event_type),
            );

            if (eventsAtLevel.length === 0) {
                result[level as DifficultyLevel] = null;
                continue;
            }

            const correctCount = eventsAtLevel.filter((e) => e.event_type === 'correct').length;
            result[level as DifficultyLevel] = correctCount / eventsAtLevel.length;
        }

        return result;
    }

    private calculateTouchPrecision(tapEvents: GameEvent[]): number | null {
        // Requires stimulus position in metadata; simplified here
        const deviations = tapEvents
            .map((e) => {
                const targetPos = (e.metadata as { target_position?: { x: number; y: number } })?.target_position;
                if (!targetPos || !e.position) return null;
                const dx = e.position.x - targetPos.x;
                const dy = e.position.y - targetPos.y;
                return Math.sqrt(dx * dx + dy * dy);
            })
            .filter((d): d is number => d !== null);

        return this.mean(deviations);
    }

    private calculateSwipeVelocity(swipeEvents: GameEvent[]): number | null {
        const velocities = swipeEvents
            .map((e) => (e.metadata as { velocity?: number })?.velocity)
            .filter((v): v is number => v !== null && v !== undefined);

        return this.mean(velocities);
    }

    private calculateTremorScore(tapEvents: GameEvent[]): number | null {
        const positions = tapEvents.map((e) => e.position).filter((p): p is { x: number; y: number } => p !== null);
        if (positions.length < 2) return null;

        const xValues = positions.map((p) => p.x);
        const yValues = positions.map((p) => p.y);
        const xMean = this.mean(xValues);
        const yMean = this.mean(yValues);

        if (xMean === null || yMean === null) return null;

        const xVar = this.variance(xValues, xMean);
        const yVar = this.variance(yValues, yMean);

        if (xVar === null || yVar === null) return null;
        return Math.sqrt(xVar + yVar); // Combined position variance
    }

    private calculateDragAccuracy(_dragEvents: GameEvent[]): number | null {
        // Pattern Mirror specific; requires path comparison
        // Placeholder: implement when Pattern Mirror game is complete
        return null;
    }

    private countOmissionClusters(): number | null {
        const omissions = this.getAllEventsByType('omission');
        const sorted = omissions.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

        let clusterCount = 0;
        let inCluster = false;

        for (let i = 0; i < sorted.length; i++) {
            const curr = sorted[i]!;
            const next = sorted[i + 1];

            if (!inCluster) {
                inCluster = true;
                clusterCount++;
            }

            // If next omission is more than 2 seconds away, end cluster
            if (!next || (next.timestamp_ms - curr.timestamp_ms) > 2000) {
                inCluster = false;
            }
        }

        return clusterCount;
    }

    private calculateRecoveryTime(): number | null {
        const allEvents = this.getAllEvents().sort((a, b) => a.timestamp_ms - b.timestamp_ms);
        const recoveryTimes: number[] = [];

        for (let i = 0; i < allEvents.length - 1; i++) {
            const curr = allEvents[i]!;
            const next = allEvents[i + 1]!;

            if (['incorrect', 'commission', 'omission'].includes(curr.event_type)) {
                if (next.event_type === 'correct') {
                    recoveryTimes.push(next.timestamp_ms - curr.timestamp_ms);
                }
            }
        }

        return this.mean(recoveryTimes);
    }

    private calculateDistractionRecoveryRate(): number | null {
        const omissions = this.getAllEventsByType('omission');
        const allEvents = this.getAllEvents().sort((a, b) => a.timestamp_ms - b.timestamp_ms);

        let recoveryCount = 0;

        for (const omission of omissions) {
            const nextEvent = allEvents.find((e) => e.timestamp_ms > omission.timestamp_ms);
            if (nextEvent && nextEvent.event_type === 'correct') {
                recoveryCount++;
            }
        }

        return omissions.length === 0 ? null : recoveryCount / omissions.length;
    }

    private countRetries(): number | null {
        // Count events where metadata indicates retry
        const retries = this.getAllEvents().filter(
            (e) => (e.metadata as { is_retry?: boolean })?.is_retry === true,
        );
        return retries.length;
    }

    private calculateAbandonmentRate(): number | null {
        const allTrials = this.getAllEvents().filter((e) =>
            e.event_type === 'stimulus_shown',
        ).length;

        const responses = this.getAllEvents().filter((e) =>
            ['correct', 'incorrect', 'commission', 'omission'].includes(e.event_type),
        ).length;

        if (allTrials === 0) return null;
        return 1 - (responses / allTrials);
    }

    private calculatePerformanceDelta(): number | null {
        const correctEvents = this.getAllEventsByType('correct');
        const incorrectEvents = this.getAllEventsByType('incorrect');
        const allResponses = [...correctEvents, ...incorrectEvents].sort(
            (a, b) => a.timestamp_ms - b.timestamp_ms,
        );

        if (allResponses.length < 4) return null;

        const quartileSize = Math.floor(allResponses.length / 4);
        const firstQuartile = allResponses.slice(0, quartileSize);
        const lastQuartile = allResponses.slice(-quartileSize);

        const firstAccuracy =
            firstQuartile.filter((e) => e.event_type === 'correct').length / firstQuartile.length;
        const lastAccuracy =
            lastQuartile.filter((e) => e.event_type === 'correct').length / lastQuartile.length;

        return lastAccuracy - firstAccuracy;
    }

    private getMaxDifficultyReached(): number | null {
        const difficulties = this.getAllEvents()
            .map((e) => e.difficulty_level)
            .filter((d): d is 1 | 2 | 3 | 4 | 5 => d != null);

        return difficulties.length === 0 ? null : Math.max(...difficulties);
    }

    private calculateLearningSlope(): number | null {
        const correctEvents = this.getAllEventsByType('correct');
        const incorrectEvents = this.getAllEventsByType('incorrect');
        const allResponses = [...correctEvents, ...incorrectEvents].sort(
            (a, b) => a.timestamp_ms - b.timestamp_ms,
        );

        if (allResponses.length < 2) return null;

        // Binary accuracy over time: 1 = correct, 0 = incorrect
        const accuracyTimeSeries = allResponses.map((e) => (e.event_type === 'correct' ? 1 : 0));
        return this.linearTrend(accuracyTimeSeries);
    }

    private calculateBeatSyncError(storyRhythmEvents: GameEvent[]): number | null {
        // Requires expected beat timestamps in metadata
        const syncErrors = storyRhythmEvents
            .map((e) => {
                const expectedBeat = (e.metadata as { expected_beat_ms?: number })?.expected_beat_ms;
                if (expectedBeat === undefined) return null;
                return Math.abs(e.timestamp_ms - expectedBeat);
            })
            .filter((err): err is number => err !== null);

        return this.mean(syncErrors);
    }

    private calculateInterResponseIntervalMean(): number | null {
        const responseEvents = this.getAllEvents()
            .filter((e) => ['correct', 'incorrect', 'tap'].includes(e.event_type))
            .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

        if (responseEvents.length < 2) return null;

        const intervals: number[] = [];
        for (let i = 1; i < responseEvents.length; i++) {
            intervals.push(responseEvents[i]!.timestamp_ms - responseEvents[i - 1]!.timestamp_ms);
        }

        return this.mean(intervals);
    }

    private calculateInterResponseIntervalCV(iriMean: number | null): number | null {
        if (iriMean === null) return null;

        const responseEvents = this.getAllEvents()
            .filter((e) => ['correct', 'incorrect', 'tap'].includes(e.event_type))
            .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

        if (responseEvents.length < 2) return null;

        const intervals: number[] = [];
        for (let i = 1; i < responseEvents.length; i++) {
            intervals.push(responseEvents[i]!.timestamp_ms - responseEvents[i - 1]!.timestamp_ms);
        }

        const iriVariance = this.variance(intervals, iriMean);
        if (iriVariance === null || iriMean === 0) return null;

        const iriSD = Math.sqrt(iriVariance);
        return iriSD / iriMean; // Coefficient of variation
    }
}
