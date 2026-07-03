/**
 * IndexedDB wrapper for offline data persistence
 * Traceability: GAME-FR-009 (event persistence), GAME-FR-012 (offline support)
 *
 * Stores:
 * - GameEvent[] per session/game (GAME-FR-009: flush every 10s)
 * - LocalSessionState for crash recovery (GAME-FR-001/003)
 * - Normative database cache (GAME-FR-011)
 */

import type { GameEvent, GameId, LocalSessionState } from '@earlymind/shared-types';
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'earlymind-offline';
const DB_VERSION = 1;

interface EarlyMindDB {
    events: {
        key: string; // `${session_id}:${game_id}`
        value: GameEvent[];
    };
    sessions: {
        key: string; // session_id
        value: LocalSessionState;
    };
    normative: {
        key: string; // 'normative_data'
        value: unknown[]; // NormativeDatabase
    };
}

let dbPromise: Promise<IDBPDatabase<EarlyMindDB>> | null = null;

function getDb(): Promise<IDBPDatabase<EarlyMindDB>> {
    if (dbPromise) return dbPromise;

    dbPromise = openDB<EarlyMindDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Events store: one entry per session+game
            if (!db.objectStoreNames.contains('events')) {
                db.createObjectStore('events');
            }
            // Session state store
            if (!db.objectStoreNames.contains('sessions')) {
                db.createObjectStore('sessions');
            }
            // Normative data cache
            if (!db.objectStoreNames.contains('normative')) {
                db.createObjectStore('normative');
            }
        },
    });

    return dbPromise;
}

// ─── Events (GAME-FR-009) ─────────────────────────────────────────────────────

function eventKey(sessionId: string, gameId: GameId): string {
    return `${sessionId}:${gameId}`;
}

/**
 * Save events for a session+game (GAME-FR-009: flush every 10s).
 */
export async function saveEvents(
    sessionId: string,
    gameId: GameId,
    events: GameEvent[],
): Promise<void> {
    const db = await getDb();
    const key = eventKey(sessionId, gameId);
    const existing = (await db.get('events', key)) ?? [];
    const merged = [...existing, ...events];
    await db.put('events', merged, key);
}

/**
 * Load all events for a session+game (crash recovery).
 */
export async function loadEvents(sessionId: string, gameId: GameId): Promise<GameEvent[]> {
    const db = await getDb();
    const key = eventKey(sessionId, gameId);
    return (await db.get('events', key)) ?? [];
}

/**
 * Clear events after successful upload or when discarding raw data (CON-PRIV-001).
 */
export async function clearEvents(sessionId: string, gameId: GameId): Promise<void> {
    const db = await getDb();
    const key = eventKey(sessionId, gameId);
    await db.delete('events', key);
}

// ─── Session state (GAME-FR-001/003 crash recovery) ──────────────────────────

/**
 * Save session state (GAME-FR-001: mirror to LocalStorage — we use IndexedDB instead).
 */
export async function saveSessionState(state: LocalSessionState): Promise<void> {
    const db = await getDb();
    await db.put('sessions', state, state.session_id);
}

/**
 * Load session state for resume (GAME-FR-003).
 */
export async function loadSessionState(sessionId: string): Promise<LocalSessionState | null> {
    const db = await getDb();
    const state = await db.get('sessions', sessionId);
    return state ?? null;
}

/**
 * Clear session state after completion (GAME-FR-004).
 */
export async function clearSessionState(sessionId: string): Promise<void> {
    const db = await getDb();
    await db.delete('sessions', sessionId);
}

// ─── Normative data (GAME-FR-011 offline cache) ──────────────────────────────

/**
 * Cache normative database for offline use.
 */
export async function saveNormativeData(data: unknown[]): Promise<void> {
    const db = await getDb();
    await db.put('normative', data, 'normative_data');
}

/**
 * Load cached normative database.
 */
export async function loadNormativeData(): Promise<unknown[] | null> {
    const db = await getDb();
    const data = await db.get('normative', 'normative_data');
    return data ?? null;
}
