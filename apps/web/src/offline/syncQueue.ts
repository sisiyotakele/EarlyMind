/**
 * Sync queue for offline feature vector upload
 * Traceability: GAME-FR-004, GAME-FR-012
 *
 * "If the network is unavailable, data queues for upload when connectivity returns"
 * "background sync with retry/exponential backoff" (SRS §2.4.2)
 */

import type { UploadFeatureVectorRequest } from '@earlymind/shared-types';
import { openDB } from 'idb';

const SYNC_DB_NAME = 'earlymind-sync';
const SYNC_DB_VERSION = 1;
const MAX_RETRIES = 5;

interface SyncQueueItem {
    id: string;
    session_id: string;
    payload: UploadFeatureVectorRequest;
    queued_at: number;
    retry_count: number;
    next_retry_at: number;
}

async function getSyncDb() {
    return openDB(SYNC_DB_NAME, SYNC_DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('queue')) {
                db.createObjectStore('queue', { keyPath: 'id' });
            }
        },
    });
}

/**
 * Enqueue a feature vector for upload (GAME-FR-004, GAME-FR-012).
 */
export async function enqueueFeatureUpload(
    sessionId: string,
    payload: UploadFeatureVectorRequest,
): Promise<void> {
    const db = await getSyncDb();
    const item: SyncQueueItem = {
        id: `fv-${sessionId}`,
        session_id: sessionId,
        payload,
        queued_at: Date.now(),
        retry_count: 0,
        next_retry_at: Date.now(),
    };
    await db.put('queue', item);
}

/**
 * Process the sync queue — called when connectivity is detected.
 * Uses exponential backoff for retries (SRS §2.4.2).
 */
export async function processSyncQueue(): Promise<void> {
    const db = await getSyncDb();
    const all: SyncQueueItem[] = await db.getAll('queue');
    const now = Date.now();

    for (const item of all) {
        if (item.next_retry_at > now) continue;
        if (item.retry_count >= MAX_RETRIES) {
            await db.delete('queue', item.id);
            continue;
        }

        try {
            const res = await fetch(`/api/sessions/${item.session_id}/features`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload),
            });

            if (res.ok) {
                await db.delete('queue', item.id);
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch {
            // Exponential backoff: 1m, 2m, 4m, 8m, 16m
            const backoffMs = Math.pow(2, item.retry_count) * 60_000;
            const updated: SyncQueueItem = {
                ...item,
                retry_count: item.retry_count + 1,
                next_retry_at: Date.now() + backoffMs,
            };
            await db.put('queue', updated);
        }
    }
}

/**
 * Register online listener to process queue on reconnect (GAME-FR-012).
 */
export function registerOnlineSync(): void {
    window.addEventListener('online', () => {
        void processSyncQueue();
    });

    // Also try immediately on registration
    if (navigator.onLine) {
        void processSyncQueue();
    }
}
