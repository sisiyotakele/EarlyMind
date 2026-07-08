/**
 * Application entry point
 * Traceability: CON-TECH-004 (Ethiopic Unicode), GAME-FR-012 (PWA/service worker),
 *               LOC-NFR-001/002 (i18n), CON-TECH-005 (browser-only)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// i18n must be imported before App (LOC-NFR-001/002)
import './i18n/i18n.config';

import App from './App';
import { registerOnlineSync } from './offline/syncQueue';

// Register background sync for offline feature uploads (GAME-FR-012)
registerOnlineSync();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
