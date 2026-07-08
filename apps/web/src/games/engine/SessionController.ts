/**
 * SessionController — session lifecycle management
 * Traceability: GAME-FR-001, GAME-FR-003, GAME-FR-004
 *
 * - Initialize session (GAME-FR-001)
 * - Pause/resume with max 3 pauses (GAME-FR-003)
 * - Complete session and trigger finalization pipeline (GAME-FR-004)
 * - Mirror state to LocalStorage for refresh recovery (GAME-FR-001/003)
 */

import type {
    LocalSessionState,
    GameId,
    GameResult,
    Language,
} from '@earlymind/shared-types';
import { GAME_SEQUENCE, TOTAL_GAMES } from '@earlymind/shared-types';
import { v4 as uuidv4 } from 'uuid';

import { loadSessionState, saveSessionState, clearSessionState } from '../../offline/indexedDb';

const MAX_PAUSES = 3; // GAME-FR-003: max 3 pauses per session
const PAUSED_SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // GAME-FR-003: 7 days

export type SessionStatus = 'active' | 'paused' | 'completed' | 'incomplete';

export interface SessionControllerConfig {
    childId: string;
    language: Language;
}

export class SessionController {
    private state: LocalSessionState;
    private status: SessionStatus;
    private pausedAtMs: number | null = null;

    private constructor(state: LocalSessionState, status: SessionStatus) {
        this.state = state;
        this.status = status;
    }

    /**
     * Initialize a new session (GAME-FR-001).
     * Business rule: "a child may have only one active (incomplete) session at a time"
     * Check via API before calling this.
     */
    static async createNew(config: SessionControllerConfig): Promise<SessionController> {
        const sessionId = uuidv4();
        const now = Date.now();

        const state: LocalSessionState = {
            session_id: sessionId,
            child_id: config.childId,
            language: config.language,
            current_game_index: 0,
            pause_count: 0,
            start_time_ms: now,
            total_paused_ms: 0,
            last_paused_at_ms: null,
            events_buffer: [],
            game_results: {},
        };

        await saveSessionState(state);

        // Also create session record in API
        await createSessionOnServer(config.childId, config.language, sessionId);

        return new SessionController(state, 'active');
    }

    /**
     * Resume an existing session from LocalStorage (GAME-FR-003).
     * Called after browser refresh or app reopen.
     */
    static async resume(sessionId: string): Promise<SessionController | null> {
        const state = await loadSessionState(sessionId);
        if (!state) return null;

        // GAME-FR-003: paused sessions expire after 7 days
        if (state.last_paused_at_ms != null) {
            const elapsed = Date.now() - state.last_paused_at_ms;
            if (elapsed > PAUSED_SESSION_EXPIRY_MS) {
                await clearSessionState(sessionId);
                return null;
            }
        }

        // If all 7 games completed, session is already done
        const status: SessionStatus = state.current_game_index >= TOTAL_GAMES ? 'completed' : 'paused';

        return new SessionController(state, status);
    }

    get sessionId(): string {
        return this.state.session_id;
    }

    get currentGameIndex(): number {
        return this.state.current_game_index;
    }

    get currentGameId(): GameId | null {
        if (this.state.current_game_index >= TOTAL_GAMES) return null;
        return GAME_SEQUENCE[this.state.current_game_index] ?? null;
    }

    get sessionStatus(): SessionStatus {
        return this.status;
    }

    get pauseCount(): number {
        return this.state.pause_count;
    }

    get canPause(): boolean {
        // GAME-FR-003: max 3 pauses
        return this.state.pause_count < MAX_PAUSES && this.status === 'active';
    }

    get progressPercent(): number {
        return (this.state.current_game_index / TOTAL_GAMES) * 100;
    }

    /**
     * Pause the session (GAME-FR-003).
     * Business rule: max 3 pauses; time spent paused is excluded from total duration.
     */
    pause(): void {
        if (!this.canPause) {
            throw new Error(`Cannot pause: already paused ${this.state.pause_count} times (max ${MAX_PAUSES})`);
        }

        this.status = 'paused';
        this.pausedAtMs = Date.now();
        this.state.pause_count++;
        this.state.last_paused_at_ms = this.pausedAtMs;

        void saveSessionState(this.state);
        void updateSessionOnServer(this.state.session_id, 'pause');
    }

    /**
     * Resume from pause (GAME-FR-003).
     * Paused time is excluded from total_paused_ms.
     */
    resume(): void {
        if (this.status !== 'paused') {
            throw new Error('Session is not paused');
        }

        if (this.pausedAtMs !== null) {
            const pausedDuration = Date.now() - this.pausedAtMs;
            this.state.total_paused_ms += pausedDuration;
            this.pausedAtMs = null;
            this.state.last_paused_at_ms = null;
        }

        this.status = 'active';

        void saveSessionState(this.state);
        void updateSessionOnServer(this.state.session_id, 'resume');
    }

    /**
     * Record game completion and advance to next game.
     * GAME-FR-002: fixed 7-game order; child cannot skip or go backward.
     */
    completeCurrentGame(result: GameResult): void {
        const gameId = this.currentGameId;
        if (!gameId) {
            throw new Error('No current game to complete');
        }

        this.state.game_results[gameId] = result;
        this.state.current_game_index++;

        void saveSessionState(this.state);

        // If all 7 games done, finalize
        if (this.state.current_game_index >= TOTAL_GAMES) {
            void this.finalize();
        }
    }

    /**
     * Finalization pipeline (GAME-FR-004).
     * "mark session complete, calculate session-level metrics, extract feature vectors,
     *  submit to ML inference API, trigger report generation"
     *
     * Business rule: "a session is marked complete only if all 7 games finished"
     */
    private async finalize(): Promise<void> {
        this.status = 'completed';

        const now = Date.now();
        const totalDurationMs = now - this.state.start_time_ms - this.state.total_paused_ms;

        // GAME-FR-004: calculate session-level metrics
        const completionRate = this.state.current_game_index / TOTAL_GAMES;

        // Mark session complete on server
        await updateSessionOnServer(this.state.session_id, 'complete', {
            total_duration_ms: totalDurationMs,
            completion_rate: completionRate,
        });

        // Extract features (GAME-FR-010) — will be done by FeatureExtractor in a separate step
        // Submit to ML API (GAME-FR-004) — done after feature extraction

        // Clean up LocalStorage
        await clearSessionState(this.state.session_id);
    }

    /**
     * Abandon session (incomplete).
     * Called when user explicitly exits or session expires.
     */
    async abandon(): Promise<void> {
        this.status = 'incomplete';
        await updateSessionOnServer(this.state.session_id, 'abandon');
        await clearSessionState(this.state.session_id);
    }

    /**
     * Get the full session state (for passing to FeatureExtractor, etc.).
     */
    getState(): Readonly<LocalSessionState> {
        return this.state;
    }
}

// ─── API integration helpers ──────────────────────────────────────────────────

async function createSessionOnServer(
    childId: string,
    language: Language,
    sessionId: string,
): Promise<void> {
    // POST /api/sessions — GAME-FR-001
    const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: sessionId,
            child_id: childId,
            language,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to create session on server');
    }
}

async function updateSessionOnServer(
    sessionId: string,
    action: 'pause' | 'resume' | 'complete' | 'abandon',
    metadata?: Record<string, unknown>,
): Promise<void> {
    // PATCH /api/sessions/:id — GAME-FR-003/004
    const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...metadata }),
    });

    if (!response.ok) {
        console.error(`Failed to update session ${sessionId} with action ${action}`);
        // Don't throw — allow offline operation to continue
    }
}
