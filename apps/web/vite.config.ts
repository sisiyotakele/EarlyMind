/**
 * Vite config for @earlymind/web
 *
 * Key requirements implemented here:
 * - PWA service worker (GAME-FR-012, CON-TECH-002)
 * - Code splitting per game bundle (~700KB each, SRS §2.4.2)
 * - Max initial bundle: 5MB compressed / 15MB uncompressed (CON-TECH-007)
 * - Brotli/gzip compression handled by CloudFront CDN (SRS §2.4.3);
 *   Vite builds the uncompressed assets
 *
 * Traceability: GAME-FR-012, CON-TECH-001/002/007, SRS §2.4.2
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            // GAME-FR-012: service worker caches all game bundles
            registerType: 'prompt', // prompt user before updating cache
            workbox: {
                // Cache game bundles, images, audio (GAME-FR-012)
                globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,mp3,ogg}'],
                runtimeCaching: [
                    {
                        // Game assets — 7-day TTL per SRS §2.4.3
                        urlPattern: /\/games\/.+\.(js|css)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'game-bundles',
                            expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 days
                        },
                    },
                    {
                        // Audio assets — cached after first load (GAME-FR-005)
                        urlPattern: /\/audio\/.+\.(mp3|ogg|wav)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'audio-assets',
                            expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days (GAME-FR-012)
                        },
                    },
                    {
                        // API calls — network first with offline fallback
                        urlPattern: /\/api\//,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-responses',
                            networkTimeoutSeconds: 10,
                        },
                    },
                ],
            },
            manifest: {
                name: 'EarlyMind',
                short_name: 'EarlyMind',
                description: 'AI-powered learning disability screening for Ethiopian children',
                theme_color: '#1a73e8',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'any',
                start_url: '/',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                ],
            },
        }),
    ],

    resolve: {
        alias: {
            // Allow import from '@earlymind/shared-types' in dev (bypasses npm link)
            '@earlymind/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        },
    },

    build: {
        // Target minimum-spec browsers (SRS §2.4.1)
        target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
        rollupOptions: {
            output: {
                // Code splitting: one chunk per game (GAME-FR-012: ~700KB each)
                manualChunks: {
                    'game-letter-rain': ['./src/games/letter-rain/LetterRain'],
                    'game-pattern-mirror': ['./src/games/pattern-mirror/PatternMirror'],
                    'game-story-rhythm': ['./src/games/story-rhythm/StoryRhythm'],
                    'game-number-jumper': ['./src/games/number-jumper/NumberJumper'],
                    'game-color-sequence': ['./src/games/color-sequence/ColorSequence'],
                    'game-target-chase': ['./src/games/target-chase/TargetChase'],
                    'game-word-echo': ['./src/games/word-echo/WordEcho'],
                    // Vendor chunk — React + router
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    // i18n chunk
                    i18n: ['i18next', 'react-i18next'],
                },
            },
        },
        // Warn if any single chunk exceeds ~800KB (keep game bundles ~700KB, SRS §2.4.2)
        chunkSizeWarningLimit: 800,
    },

    test: {
        environment: 'jsdom',
        globals: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.test.*', 'src/main.tsx'],
            // SRS §10.1: >=70% coverage on core logic
            thresholds: { lines: 70, functions: 70, branches: 70 },
        },
    },
});
