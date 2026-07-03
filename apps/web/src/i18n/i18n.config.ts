/**
 * i18n configuration
 * Traceability: LOC-NFR-001 (Amharic, Oromo, Tigrinya), LOC-NFR-002 (Ethiopic Unicode),
 *               LOC-NFR-004 (language switchable without losing session progress)
 * CON-TECH-004: Ethiopic script support via Unicode fonts
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import am from './am.json';
import om from './om.json';
import ti from './ti.json';

// LOC-NFR-001: Amharic ('am'), Afaan Oromoo ('om'), Tigrinya ('ti')
export const SUPPORTED_LANGUAGES = ['am', 'om', 'ti'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
    am: 'አማርኛ',   // Amharic — CON-TECH-004: Ethiopic script
    om: 'Afaan Oromoo',
    ti: 'ትግርኛ',  // Tigrinya — CON-TECH-004: Ethiopic script
};

void i18n.use(initReactI18next).init({
    resources: {
        am: { translation: am },
        om: { translation: om },
        ti: { translation: ti },
    },

    // Default language is Amharic
    lng: 'am',

    // LOC-NFR-004: language can be changed at any time without page reload
    // Done by calling i18n.changeLanguage(lang) — React re-renders automatically

    fallbackLng: 'am',
    interpolation: {
        // React already escapes XSS by default
        escapeValue: false,
    },
    // LOC-NFR-002: ensure unicode is preserved
    ns: ['translation'],
    defaultNS: 'translation',
});

export default i18n;
