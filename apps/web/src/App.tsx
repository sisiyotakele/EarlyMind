/**
 * App.tsx — root router with role-based route guards
 * Traceability: AUTH-FR-004 (RBAC enforced in UI too), CON-TECH-005 (PWA, browser-only)
 *
 * Role routing per SRS §5.1:
 *   Parent/Teacher → /assessment/*
 *   Teacher        → /teacher/*
 *   School Admin   → /school-admin/*
 *   EAII Admin     → /eaii-admin/*
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './hooks/useAuth';

// ── Assessment App (Parents & Teachers) ──────────────────────────────────────
const LoginPage = lazy(() => import('./routes/assessment/LoginPage'));
const ChildProfilePage = lazy(() => import('./routes/assessment/ChildProfilePage'));
const PreAssessmentPage = lazy(() => import('./routes/assessment/PreAssessmentPage'));
const GameSessionPage = lazy(() => import('./routes/assessment/GameSessionPage'));
const ReportViewPage = lazy(() => import('./routes/assessment/ReportViewPage'));

// ── Teacher Dashboard ─────────────────────────────────────────────────────────
const ClassRosterPage = lazy(() => import('./routes/teacher-dashboard/ClassRosterPage'));
const BulkScreeningPage = lazy(() => import('./routes/teacher-dashboard/BulkScreeningPage'));
const AccommodationGuidePage = lazy(() => import('./routes/teacher-dashboard/AccommodationGuidePage'));

// ── School Admin Dashboard ────────────────────────────────────────────────────
const AggregateAnalyticsPage = lazy(() => import('./routes/school-admin-dashboard/AggregateAnalyticsPage'));
const TeacherManagementPage = lazy(() => import('./routes/school-admin-dashboard/TeacherManagementPage'));
const ExportPage = lazy(() => import('./routes/school-admin-dashboard/ExportPage'));

// ── EAII Admin Console ────────────────────────────────────────────────────────
const SystemHealthPage = lazy(() => import('./routes/eaii-admin-console/SystemHealthPage'));
const ModelManagementPage = lazy(() => import('./routes/eaii-admin-console/ModelManagementPage'));
const ResearchExportPage = lazy(() => import('./routes/eaii-admin-console/ResearchExportPage'));
const AuditLogPage = lazy(() => import('./routes/eaii-admin-console/AuditLogPage'));

// ─── Route guard ──────────────────────────────────────────────────────────────

function RequireAuth({ children, allow }: { children: React.ReactNode; allow: string[] }) {
    const { user, loading } = useAuth();
    if (loading) return <LoadingFallback />;
    if (!user) return <Navigate to="/login" replace />;
    if (!allow.includes(user.role)) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

// ─── Loading fallback ─────────────────────────────────────────────────────────

function LoadingFallback() {
    return (
        <div
            className="app-loading"
            role="status"
            aria-label="Loading"
            aria-live="polite"
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
        >
            <span className="spinner" aria-hidden="true" />
        </div>
    );
}

// ─── Offline indicator (GAME-FR-012) ─────────────────────────────────────────

function OfflineIndicator() {
    const [offline, setOffline] = React.useState(!navigator.onLine);

    React.useEffect(() => {
        const on = () => setOffline(false);
        const off = () => setOffline(true);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    if (!offline) return null;
    return (
        <div
            className="offline-banner"
            role="status"
            aria-live="polite"
            aria-label="Offline mode active"
        >
            📶 Offline Mode
        </div>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
    return (
        <BrowserRouter>
            <OfflineIndicator />
            <Suspense fallback={<LoadingFallback />}>
                <Routes>
                    {/* ── Public ── */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    {/* ── Assessment App — Parent & Teacher (SRS §5.1) ── */}
                    <Route
                        path="/assessment"
                        element={
                            <RequireAuth allow={['parent', 'teacher']}>
                                <ChildProfilePage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/assessment/pre"
                        element={
                            <RequireAuth allow={['parent', 'teacher']}>
                                <PreAssessmentPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/assessment/session/:sessionId"
                        element={
                            <RequireAuth allow={['parent', 'teacher']}>
                                <GameSessionPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/assessment/report/:sessionId"
                        element={
                            <RequireAuth allow={['parent', 'teacher']}>
                                <ReportViewPage />
                            </RequireAuth>
                        }
                    />

                    {/* ── Teacher Dashboard (SRS §5.1) ── */}
                    <Route
                        path="/teacher"
                        element={
                            <RequireAuth allow={['teacher']}>
                                <ClassRosterPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/teacher/bulk-screening"
                        element={
                            <RequireAuth allow={['teacher']}>
                                <BulkScreeningPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/teacher/accommodation/:childId"
                        element={
                            <RequireAuth allow={['teacher']}>
                                <AccommodationGuidePage />
                            </RequireAuth>
                        }
                    />

                    {/* ── School Admin Dashboard (SRS §5.1) ── */}
                    <Route
                        path="/school-admin"
                        element={
                            <RequireAuth allow={['school_admin']}>
                                <AggregateAnalyticsPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/school-admin/teachers"
                        element={
                            <RequireAuth allow={['school_admin']}>
                                <TeacherManagementPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/school-admin/export"
                        element={
                            <RequireAuth allow={['school_admin']}>
                                <ExportPage />
                            </RequireAuth>
                        }
                    />

                    {/* ── EAII Admin Console (SRS §5.1) ── */}
                    <Route
                        path="/eaii-admin"
                        element={
                            <RequireAuth allow={['eaii_admin']}>
                                <SystemHealthPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/eaii-admin/models"
                        element={
                            <RequireAuth allow={['eaii_admin']}>
                                <ModelManagementPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/eaii-admin/research-export"
                        element={
                            <RequireAuth allow={['eaii_admin']}>
                                <ResearchExportPage />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/eaii-admin/audit"
                        element={
                            <RequireAuth allow={['eaii_admin']}>
                                <AuditLogPage />
                            </RequireAuth>
                        }
                    />

                    {/* ── Fallback ── */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
}
