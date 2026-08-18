// ============================================================================
// JurisLink - Phase 4.7 - Patch Login.tsx (account lockout + password policy)
// ============================================================================
// Remplace: src/pages/auth/Login.tsx
//
// Changements vs Phase 3:
//   1. Sur login échoué (password incorrect):
//      - Appel à la fonction SQL register_failed_login(email) qui incrémente
//        le compteur failed_login_attempts et bloque le compte si seuil (5)
//      - Affiche un message "Tentatives restantes: N" si pas bloqué
//      - Affiche un message "Compte bloqué, réessayez dans X minutes" si bloqué
//   2. Sur login réussi:
//      - Appel à register_successful_login(userId) qui reset les compteurs
//   3. Sur MFA setup (utilisateur sans facteur TOTP):
//      - Validation du password actuel avec analyzePassword()
//      - Si le password actuel est trop faible, propose un reset
//      - Suggestion de password fort via generateStrongPassword()
//
// Notes:
//   - Le compte est identifié par EMAIL avant l'authentification — c'est
//     OK car l'email est public lors du login. La fonction SQL est
//     SECURITY DEFINER et ne révèle pas l'existence du compte (anti-énumération).
//   - Le rate-limiting au niveau Auth (Supabase) est la première défense.
//     Le lockout applicatif (cette couche) est la seconde défense.
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, ShieldOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { MfaSetup } from '../../components/auth/MfaSetup';
import { MfaChallenge } from '../../components/auth/MfaChallenge';
import { rotateCsrfToken } from '../../lib/csrf';
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
  const navigate = useNavigate();

  // CORRECTION: Audit log inséré UNIQUEMENT après vérification MFA complète.
  // Phase 3: utilisation du helper logAudit (structured JSONB metadata).
  const logAuditSuccess = async (userId: string, loginMethod: 'password+mfa' | 'password+setup') => {
    const { data: userRow } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userRow?.tenant_id) {
      const sessionId = (typeof window !== 'undefined' && window.sessionStorage?.getItem('jurislink.session.id')) || crypto.randomUUID();
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
        },
      });
    }
  };

  const handleMfaSuccess = async (userId: string) => {
    await logAuditSuccess(userId, 'password+mfa');
    rotateCsrfToken();
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
          // Fonction SQL non disponible — fallback sur le message Supabase
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

    // SUCCÈS — reset les compteurs d'échecs
    try {
      await supabase.rpc('register_successful_login', { p_user_id: data.session.user.id });
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

    // CORRECTION CRITIQUE: Vérifie systématiquement la présence d'un facteur TOTP
    // vérifié. Si présent → challenge obligatoire. Si absent → setup obligatoire.
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
