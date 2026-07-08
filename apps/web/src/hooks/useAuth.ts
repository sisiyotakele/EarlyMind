/**
 * useAuth — fetches authenticated user from session cookie
 * Traceability: AUTH-FR-002 (session validation), AUTH-FR-004 (role routing)
 * AUTH-NFR-001: session token in httpOnly cookie — JS cannot read it,
 *               but can call /api/users/me to verify auth state.
 */

import { useEffect, useState } from 'react';
import type { AuthUser } from '@earlymind/shared-types';

interface UseAuthReturn {
    user: AuthUser | null;
    loading: boolean;
    refetch: () => void;
}

let cachedUser: AuthUser | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache — avoid hammering /me on every render

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<AuthUser | null>(cachedUser);
    const [loading, setLoading] = useState(cachedUser === null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const now = Date.now();
        if (cachedUser && now - cacheTimestamp < CACHE_TTL_MS) {
            setUser(cachedUser);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        void (async () => {
            try {
                const res = await fetch('/api/users/me', { credentials: 'include' });
                if (!res.ok) {
                    cachedUser = null;
                    if (!cancelled) { setUser(null); setLoading(false); }
                    return;
                }
                const json = (await res.json()) as { success: boolean; data: { user: AuthUser } };
                cachedUser = json.data.user;
                cacheTimestamp = Date.now();
                if (!cancelled) { setUser(cachedUser); setLoading(false); }
            } catch {
                cachedUser = null;
                if (!cancelled) { setUser(null); setLoading(false); }
            }
        })();

        return () => { cancelled = true; };
    }, [tick]);

    return { user, loading, refetch: () => setTick((t) => t + 1) };
}
