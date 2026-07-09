/**
 * Application entry point
 * Traceability: CON-TECH-004 (Ethiopic Unicode), GAME-FR-012 (PWA/service worker),
 *               LOC-NFR-001/002 (i18n), CON-TECH-005 (browser-only)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Styles (Tailwind + custom)
import './styles.css';

// i18n must be imported before App (LOC-NFR-001/002)
import './i18n/i18n.config';

import App from './App';
import { registerOnlineSync } from './offline/syncQueue';
import { enableMockApi } from './mockApi';

// Enable mock API for local development (when backend not available)
if (import.meta.env.DEV) {
    enableMockApi();
    console.log('🎭 Mock API enabled for development');
}

// Register background sync for offline feature uploads (GAME-FR-012)
registerOnlineSync();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
