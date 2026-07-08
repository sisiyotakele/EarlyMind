/**
 * useOfflineSync — exposes sync queue state to UI
 * Traceability: GAME-FR-012 (offline mode indicator, upload when reconnected)
 */

import { useEffect, useState } from 'react';

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingUploads, setPendingUploads] = useState(0);

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    return { isOnline, pendingUploads };
}
