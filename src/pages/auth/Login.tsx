// ============================================================================
// JurisLink - Phase 5.12 - Patch Login.tsx (HIBP warning + session init)
// ============================================================================
// Remplace: src/pages/auth/Login.tsx (version Phase 4)
//
// Changements vs Phase 4:
//   1. Initialisation de session (initSession) après MFA réussi — pour suivre
//      la durée absolue de session côté client (complète le SessionTimeout).
//   2. Sur MFA setup (utilisateur sans facteur TOTP): check HIBP du password
//      actuel pour informer l'utilisateur s'il faut le changer.
//      Le check est NON BLOQUANT — affiche un warning discret si breach.
//   3. Audit log enrichit avec session_id (corrélation avec users.last_session_id).
//
// Notes:
//   - Le check HIBP en MFA setup est DIFFÉRENT du check HIBP en création de
//     compte (qui est BLOQUANT via edge function create-user). En MFA setup,
//     l'utilisateur existe déjà et a déjà un password — on ne peut pas le
//     forcer à changer sans dégrader l'expérience.
//   - Le session_id est aussi passé à register_successful_login pour
//     corrélation des audit_logs (Phase 5 migration 04_session_hardening.sql).
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, ShieldOff, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { MfaSetup } from '../../components/auth/MfaSetup';
import { MfaChallenge } from '../../components/auth/MfaChallenge';
import { rotateCsrfToken } from '../../lib/csrf';
import { initSession } from '../../lib/sessionManager';
import { checkPasswordBreachCached, type BreachCheckResult } from '../../lib/hibp';
import './Login.css';

interface LockoutInfo {
  locked: boolean;
  lockedUntil: string | null;
  remainingAttempts: number;
}

export const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo | null>(null);
  const [mfaStep, setMfaStep] = useState<'login' | 'challenge' | 'setup'>('login');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [loggedUserId, setLoggedUserId] = useState<string | null>(null);
  const [breachWarning, setBreachWarning] = useState<BreachCheckResult | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const navigate = useNavigate();
  const hibpAbortRef = useRef<AbortController | null>(null);

  // Génère un session_id unique à chaque mount (durée de vie = session login)
  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  // Phase 5: check HIBP en arrière-plan pendant que l'utilisateur tape son password
  // (uniquement si le password fait 8+ chars — assez long pour ne pas spammer l'API)
  useEffect(() => {
    if (!password || password.length < 8) {
      setBreachWarning(null);
      return;
    }
    // Debounce 500ms après le dernier keystroke
    if (hibpAbortRef.current) {
      hibpAbortRef.current.abort();
    }
    const controller = new AbortController();
    hibpAbortRef.current = controller;
    const timeout = setTimeout(async () => {
      if (controller.signal.aborted) return;
      const result = await checkPasswordBreachCached(password);
      if (controller.signal.aborted) return;
      setBreachWarning(result);
    }, 500);
    return () => clearTimeout(timeout);
  }, [password]);

  // Audit log inséré après MFA réussi — utilise le session_id de ce mount
  const logAuditSuccess = async (userId: string, loginMethod: 'password+mfa' | 'password+setup') => {
    const { data: userRow } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userRow?.tenant_id) {
      await supabase.from('audit_logs').insert({
        tenant_id: userRow.tenant_id,
        user_id: userId,
        action: 'LOGIN_SUCCESS_MFA',
        entity: 'auth',
        entity_id: userId,
        metadata: {
          ip: null,
          user_agent: navigator.userAgent,
          session_id: sessionId,
          request_id: crypto.randomUUID(),
          source: 'UI:Login',
          login_method: loginMethod,
          aal: 'aal2',
          // Phase 5: info breach check du password (pour corrélation SOC)
          password_breach_check: breachWarning
            ? { pwned: breachWarning.pwned, count: breachWarning.count, skipped: breachWarning.skipped }
            : null,
        },
      });
    }
  };

  const handleMfaSuccess = async (userId: string) => {
    await logAuditSuccess(userId, 'password+mfa');
    rotateCsrfToken();
    initSession(); // Phase 5: enregistre le timestamp de début de session

    // Phase 5: enregistre le session_id côté serveur (register_successful_login)
    try {
      await supabase.rpc('register_successful_login', {
        p_user_id: userId,
        p_session_id: sessionId,
      });
    } catch (err) {
      console.warn('register_successful_login (with session_id) failed:', err);
    }

    navigate('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLockoutInfo(null);

    // 1. Tente l'authentification Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // ÉCHEC — enregistre la tentative échouée via la fonction SQL
      try {
        const { data: lockResult } = await supabase
          .rpc('register_failed_login', { p_email: email });

        if (lockResult?.[0]) {
          const info = lockResult[0] as LockoutInfo;
          setLockoutInfo(info);
          if (info.locked) {
            setError(t('login.account_locked_attempts',
              `Compte bloqué après ${5} tentatives échouées. Réessayez dans 15 minutes.`));
          } else {
            setError(t('login.invalid_credentials_remaining',
              `Identifiants invalides. Tentatives restantes: ${info.remainingAttempts}`));
          }
        } else {
          setError(error.message);
        }
      } catch (err) {
        console.warn('register_failed_login failed (function not deployed?):', err);
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError('Session invalide');
      setLoading(false);
      return;
    }

    // SUCCÈS — reset les compteurs d'échecs et enregistre le session_id
    try {
      await supabase.rpc('register_successful_login', {
        p_user_id: data.session.user.id,
        p_session_id: sessionId,
      });
    } catch (err) {
      console.warn('register_successful_login failed:', err);
    }

    // Vérifie profil + statut compte/tenant
    const { data: profile } = await supabase
      .from('users')
      .select('*, tenant:tenants(*)')
      .eq('id', data.session.user.id)
      .single();

    if (profile && (profile.is_active === false || (profile.tenant && profile.tenant.is_active === false))) {
      await supabase.auth.signOut();
      setError(t('login.account_disabled', "Votre compte ou votre cabinet a été désactivé. Veuillez vous rapprocher de l'administrateur."));
      setLoading(false);
      return;
    }

    // Vérifie systématiquement la présence d'un facteur TOTP vérifié
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');

    if (totpFactor) {
      setMfaFactorId(totpFactor.id);
      setLoggedUserId(data.session.user.id);
      setMfaStep('challenge');
    } else {
      setLoggedUserId(data.session.user.id);
      setMfaStep('setup');
    }

    setLoading(false);
  };

  const handleCancelMfa = async () => {
    await supabase.auth.signOut();
    setMfaStep('login');
    setMfaFactorId(null);
    setLoggedUserId(null);
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>

      <div className="login-wrapper animate-fade-in glass-card">
        <div className="login-header">
          <div className="logo-container" style={{ background: 'transparent', boxShadow: 'none', width: '100%', height: 'auto', margin: '0 auto 2rem auto' }}>
            <img src="/logo-full.png" alt="JurisLink Logo" style={{ height: '120px', width: 'auto', objectFit: 'contain', maxWidth: '100%' }} />
          </div>
          <p>{t('login.welcome')}</p>
        </div>

        {error && (
          <div className="error-alert" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            ...(lockoutInfo?.locked ? { background: 'hsla(var(--danger), 0.1)', borderColor: 'hsl(var(--danger))' } : {})
          }}>
            {lockoutInfo?.locked ? <ShieldOff size={18} /> : <AlertCircle size={18} />}
            {error}
          </div>
        )}

        {/* Phase 5: warning HIBP si password compromis (non bloquant) */}
        {breachWarning?.pwned && mfaStep === 'login' && (
          <div className="error-alert" style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'hsla(var(--warning), 0.1)',
            borderColor: 'hsl(var(--warning))',
            fontSize: '0.85rem'
          }}>
            <AlertTriangle size={18} />
            <span>
              {t('login.breach_warning',
                `Ce mot de passe a été exposé dans ${breachWarning.count} breach(es) connue(s). Pensez à le changer après connexion.`)}
            </span>
          </div>
        )}

        {mfaStep === 'login' && (
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label className="input-label" htmlFor="email">{t('login.email')}</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  className="input-field"
                  placeholder="avocat@cabinet.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={lockoutInfo?.locked === true}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="password">{t('login.password')}</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={lockoutInfo?.locked === true}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading || lockoutInfo?.locked === true}>
              {loading ? t('login.loading') : (
                <>
                  {t('login.signIn')} <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {mfaStep === 'setup' && loggedUserId && (
          <MfaSetup
            onSetupComplete={() => handleMfaSuccess(loggedUserId)}
          />
        )}

        {mfaStep === 'challenge' && mfaFactorId && loggedUserId && (
          <MfaChallenge
            factorId={mfaFactorId}
            onCancel={handleCancelMfa}
            onSuccess={() => handleMfaSuccess(loggedUserId)}
          />
        )}
      </div>
    </div>
  );
};
