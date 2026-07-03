/**
 * EventLogger — millisecond-precision event logging
 * Traceability: GAME-FR-009
 *
 * - Every interaction logged as GameEvent with performance.now() timestamp
 * - Events buffered in memory, persisted to IndexedDB every 10 seconds
 * - Raw events NEVER uploaded to server (CON-PRIV-001); only feature vectors are
 * - On session end: feature extraction runs, raw events discarded (or kept if research consent)
 */

import type { GameEvent, GameEventType, GameId } from '@earlymind/shared-types';
import { v4 as uuidv4 } from 'uuid';

import { saveEvents, loadEvents } from '../../offline/indexedDb';

/** GAME-FR-009: flush to IndexedDB every 10 seconds */
const FLUSH_INTERVAL_MS = 10_000;

export class EventLogger {
    private sessionId: string;
    private gameId: GameId;
    private buffer: GameEvent[] = [];
    private flushTimer: ReturnType<typeof setInterval> | null = null;
    private sessionStartMs: number;

    constructor(sessionId: string, gameId: GameId) {
        this.sessionId = sessionId;
        this.gameId = gameId;
        this.sessionStartMs = Date.now();
    }

    /**
     * Start periodic flushing to IndexedDB (GAME-FR-009: every 10 seconds for crash protection).
     */
    start(): void {
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, FLUSH_INTERVAL_MS);
    }

    /**
     * Stop the flush timer and do a final flush.
     */
    async stop(): Promise<void> {
        if (this.flushTimer !== null) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }

    /**
     * Log a single game event.
     * GAME-FR-009: timestamp_ms uses performance.now() (millisecond precision).
     */
    log(
        eventType: GameEventType,
        data: Partial<Omit<GameEvent, 'event_id' | 'session_id' | 'game_id' | 'event_type' | 'timestamp_ms' | 'wall_clock_ms'>>,
    ): GameEvent {
        const event: GameEvent = {
            event_id: uuidv4(),
            session_id: this.sessionId,
            game_id: this.gameId,
            event_type: eventType,
            timestamp_ms: performance.now(), // GAME-FR-009: millisecond precision
            wall_clock_ms: Date.now(),
            position: data.position ?? null,
            stimulus_id: data.stimulus_id ?? null,
            response_value: data.response_value ?? null,
            response_latency_ms: data.response_latency_ms ?? null,
            difficulty_level: data.difficulty_level ?? null,
            device_state: data.device_state ?? null,
            metadata: data.metadata ?? null,
        };

        this.buffer.push(event);
        return event;
    }

    /**
     * Get the current in-memory buffer (used by FeatureExtractor at session end).
     */
    getBuffer(): readonly GameEvent[] {
        return this.buffer;
    }

    /**
     * Returns all events: in-memory buffer + any previously persisted to IndexedDB.
     * Used for feature extraction after a crash-recovery scenario.
     */
    async getAllEvents(): Promise<GameEvent[]> {
        const persisted = await loadEvents(this.sessionId, this.gameId);
        // Deduplicate by event_id
        const seen = new Set(persisted.map((e) => e.event_id));
        const newEvents = this.buffer.filter((e) => !seen.has(e.event_id));
        return [...persisted, ...newEvents];
    }

    /**
     * Flush in-memory buffer to IndexedDB (crash protection).
     * GAME-FR-009: "persist to IndexedDB every 10 seconds"
     */
    private async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        try {
            await saveEvents(this.sessionId, this.gameId, this.buffer);
            // Clear buffer after successful persist
            this.buffer = [];
        } catch (err) {
            console.error('EventLogger: failed to flush to IndexedDB', err);
            // Keep buffer — will retry on next interval
        }
    }

    /**
     * Discard raw events after feature extraction (CON-PRIV-001).
     * Called when parent has NOT opted into research.
     */
    async discardRawEvents(): Promise<void> {
        this.buffer = [];
        await clearEvents(this.sessionId, this.gameId);
    }
}

// Re-export clearEvents for use above
async function clearEvents(sessionId: string, gameId: GameId): Promise<void> {
    const { clearEvents: dbClearEvents } = await import('../../offline/indexedDb');
    await dbClearEvents(sessionId, gameId);
}
