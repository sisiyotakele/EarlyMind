/**
 * LoginPage — phone + PIN / OTP login and registration
 * Traceability: AUTH-FR-001, AUTH-FR-002, CON-TECH-003 (no email), CON-TECH-004 (Ethiopic)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { Language } from '@earlymind/shared-types';

import { LANGUAGE_NAMES } from '../../i18n/i18n.config';

type AuthMode = 'register_start' | 'register_verify' | 'login_pin' | 'login_otp_request' | 'login_otp_verify';

export default function LoginPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const [mode, setMode] = useState<AuthMode>('login_pin');
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [otp, setOtp] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<'parent' | 'teacher' | 'school_admin'>('parent');
    const [language, setLanguage] = useState<Language>(i18n.language as Language || 'am');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    /** AUTH-FR-001: phone must be +251XXXXXXXXX format */
    const formatPhone = (raw: string) => {
        const digits = raw.replace(/\D/g, '');
        if (digits.startsWith('251')) return `+${digits}`;
        if (digits.startsWith('0')) return `+251${digits.slice(1)}`;
        return `+251${digits}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            let endpoint = '';
            let body: Record<string, unknown> = {};

            switch (mode) {
                case 'register_start':
                    endpoint = '/api/auth/register';
                    body = { phone_number: formatPhone(phone), role, language, name };
                    break;
                case 'register_verify':
                    endpoint = '/api/auth/register/verify';
                    body = { phone_number: formatPhone(phone), otp, pin };
                    break;
                case 'login_pin':
                    endpoint = '/api/auth/login/pin';
                    body = { phone_number: formatPhone(phone), pin };
                    break;
                case 'login_otp_request':
                    endpoint = '/api/auth/login/otp/request';
                    body = { phone_number: formatPhone(phone) };
                    break;
                case 'login_otp_verify':
                    endpoint = '/api/auth/login/otp/verify';
                    body = { phone_number: formatPhone(phone), otp };
                    break;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const data = (await res.json()) as { success: boolean; data?: { user?: { role: string } }; error?: { message: string } };

            if (!res.ok || !data.success) {
                throw new Error(data.error?.message ?? t('common.error'));
            }

            if (mode === 'register_start' || mode === 'login_otp_request') {
                // Advance to verification step
                setMode(mode === 'register_start' ? 'register_verify' : 'login_otp_verify');
            } else {
                // Logged in — redirect based on role
                const userRole = data.data?.user?.role;
                const redirect =
                    userRole === 'teacher' ? '/teacher' :
                        userRole === 'school_admin' ? '/school-admin' :
                            userRole === 'eaii_admin' ? '/eaii-admin' :
                                '/assessment';
                navigate(redirect, { replace: true });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="login-page" aria-labelledby="login-title">
            {/* Language selector — CON-TECH-004: Ethiopic script in label */}
            <div className="login-page__lang-select">
                {(Object.entries(LANGUAGE_NAMES) as [Language, string][]).map(([code, label]) => (
                    <button
                        key={code}
                        className={`lang-btn ${language === code ? 'lang-btn--active' : ''}`}
                        onClick={() => { setLanguage(code); void i18n.changeLanguage(code); }}
                        aria-pressed={language === code}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <h1 id="login-title">{t('auth.welcome')}</h1>

            {error && <p className="form-error" role="alert">{error}</p>}

            <form onSubmit={(e) => void handleSubmit(e)} noValidate>
                {/* Phone number — AUTH-FR-001: +251 format */}
                <div className="form-group">
                    <label htmlFor="phone">{t('auth.phoneLabel')}</label>
                    <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        placeholder={t('auth.phonePlaceholder')}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        autoComplete="tel"
                        aria-describedby="phone-hint"
                    />
                    <span id="phone-hint" className="form-hint">+251XXXXXXXXX</span>
                </div>

                {/* Registration-only fields */}
                {(mode === 'register_start') && (
                    <>
                        <div className="form-group">
                            <label htmlFor="name">{t('auth.nameLabel')}</label>
                            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="role">{t('auth.roleLabel')}</label>
                            <select id="role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                                {(['parent', 'teacher', 'school_admin'] as const).map((r) => (
                                    <option key={r} value={r}>{t(`auth.roles.${r}`)}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {/* PIN field — AUTH-FR-001/002 */}
                {(mode === 'login_pin' || mode === 'register_verify') && (
                    <div className="form-group">
                        <label htmlFor="pin">{t('auth.pinLabel')}</label>
                        <input
                            id="pin"
                            type="password"
                            inputMode="numeric"
                            pattern="\d{4}"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            required
                            autoComplete={mode === 'login_pin' ? 'current-password' : 'new-password'}
                        />
                    </div>
                )}

                {/* OTP field — AUTH-FR-001/002 */}
                {(mode === 'register_verify' || mode === 'login_otp_verify') && (
                    <div className="form-group">
                        <label htmlFor="otp">{t('auth.otpLabel')}</label>
                        <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                            autoComplete="one-time-code"
                        />
                        <span className="form-hint">{t('auth.otpExpiry')}</span>
                    </div>
                )}

                <button type="submit" className="btn btn--primary btn--full" disabled={submitting} aria-busy={submitting}>
                    {submitting ? t('common.loading') : (
                        mode === 'register_start' ? t('auth.register') :
                            mode === 'login_otp_request' ? t('auth.requestOtp') :
                                t('auth.loginWithPin')
                    )}
                </button>
            </form>

            {/* Toggle auth mode */}
            <div className="login-page__toggle">
                {mode === 'login_pin' && (
                    <>
                        <button className="link-btn" onClick={() => setMode('login_otp_request')}>{t('auth.requestOtp')}</button>
                        <button className="link-btn" onClick={() => setMode('register_start')}>{t('auth.register')}</button>
                    </>
                )}
                {(mode === 'register_start' || mode === 'register_verify' || mode === 'login_otp_request' || mode === 'login_otp_verify') && (
                    <button className="link-btn" onClick={() => setMode('login_pin')}>{t('auth.loginWithPin')}</button>
                )}
            </div>
        </main>
    );
}
