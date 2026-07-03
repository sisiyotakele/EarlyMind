/**
 * PWA cache manifest
 * Traceability: GAME-FR-012 (offline gameplay)
 *
 * "On first visit, a service worker caches all game bundles (~700KB x 7),
 *  images/sprites (~2MB), selected-language audio (~2MB), and the core app (~1.5MB)
 *  — total <=15MB compressed."
 *
 * Configured via vite-plugin-pwa in vite.config.ts (workbox options).
 * This file documents the expected cache structure for reference.
 */

export const CACHE_MANIFEST = {
    /**
     * Core app bundle: ~1.5MB uncompressed, ~500KB compressed
     * Cached on first load via service worker
     */
    CORE_APP: ['/', '/index.html', '/manifest.json'],

    /**
     * Game bundles: ~700KB each uncompressed, ~200KB compressed
     * Lazy-loaded per game via React.lazy (GAME-FR-002, GAME-FR-012)
     */
    GAMES: [
        '/assets/game-letter-rain-*.js',
        '/assets/game-pattern-mirror-*.js',
        '/assets/game-story-rhythm-*.js',
        '/assets/game-number-jumper-*.js',
        '/assets/game-color-sequence-*.js',
        '/assets/game-target-chase-*.js',
        '/assets/game-word-echo-*.js',
    ],

    /**
     * Audio assets per language: ~2MB per language (GAME-FR-005)
     * Only selected language is cached at session start
     */
    AUDIO: {
        am: ['/audio/am/*.mp3', '/audio/am/*.ogg'],
        om: ['/audio/om/*.mp3', '/audio/om/*.ogg'],
        ti: ['/audio/ti/*.mp3', '/audio/ti/*.ogg'],
    },

    /**
     * Images, sprites, icons: ~2MB total (CON-CULT-002: Ethiopian context)
     */
    IMAGES: ['/assets/*.png', '/assets/*.svg', '/assets/*.webp', '/icons/*.png'],

    /**
     * Fonts for Ethiopic script: CON-TECH-004 (Fidel rendering)
     */
    FONTS: ['/fonts/*.woff2'],

    /**
     * Total: ~5MB initial load (compressed), <=15MB uncompressed (CON-TECH-007)
     */
};

/**
 * Cache expiry times (vite.config.ts workbox runtimeCaching)
 * - Game bundles: 7 days (SRS §2.4.3: CloudFront CDN TTL)
 * - Audio: 30 days (GAME-FR-012)
 * - API responses: NetworkFirst with 10s timeout
 */
export const CACHE_EXPIRY_DAYS = {
    GAME_BUNDLES: 7,
    AUDIO: 30,
    IMAGES: 30,
};
