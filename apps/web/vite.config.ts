import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
    ],

    resolve: {
        alias: {
            '@earlymind/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        },
    },

    build: {
        target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
        rollupOptions: {
            output: {
                manualChunks: {
                    'game-letter-rain': ['./src/games/letter-rain/LetterRain'],
                    'game-pattern-mirror': ['./src/games/pattern-mirror/PatternMirror'],
                    'game-story-rhythm': ['./src/games/story-rhythm/StoryRhythm'],
                    'game-number-jumper': ['./src/games/number-jumper/NumberJumper'],
                    'game-color-sequence': ['./src/games/color-sequence/ColorSequence'],
                    'game-target-chase': ['./src/games/target-chase/TargetChase'],
                    'game-word-echo': ['./src/games/word-echo/WordEcho'],
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    i18n: ['i18next', 'react-i18next'],
                },
            },
        },
        chunkSizeWarningLimit: 800,
    },

    test: {
        environment: 'jsdom',
        globals: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.test.*', 'src/main.tsx'],
            thresholds: { lines: 70, functions: 70, branches: 70 },
        },
    },
});
