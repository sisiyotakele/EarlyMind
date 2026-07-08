/**
 * useLanguage — manages language preference
 * Traceability: LOC-NFR-004 (language switchable without losing session progress)
 * AUTH-FR-003: language preference persisted to user profile
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { Language } from '@earlymind/shared-types';

export function useLanguage() {
    const { i18n } = useTranslation();
    const current = i18n.language as Language;

    const switchLanguage = useCallback(async (lang: Language) => {
        // LOC-NFR-004: switch without losing session progress (i18next handles in-place)
        await i18n.changeLanguage(lang);

        // Persist to user profile if authenticated (AUTH-FR-003)
        try {
            await fetch('/api/users/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ language: lang }),
            });
        } catch {
            // Non-critical: language preference not saved if offline
        }
    }, [i18n]);

    return { current, switchLanguage };
}
