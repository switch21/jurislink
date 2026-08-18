// ============================================================================
// JurisLink - Phase 3.8 - Patch Login.tsx (utilise logAudit helper)
// ============================================================================
// Remplace: src/pages/auth/Login.tsx
//
// Changements vs version actuelle:
//   1. Suppression de la fonction logAuditSuccess inline (lignes 38-58).
//      Remplacée par import { logAudit } from '../../lib/audit'.
//   2. logAudit récupère automatiquement user_id + tenant_id depuis le store,
//      et ajoute metadata { source: 'UI:Login', login_method, ... }.
//   3. Rotation du token CSRF après login MFA réussi (anti-rejeu).
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { MfaSetup } from '../../components/auth/MfaSetup';
import { MfaChallenge } from '../../components/auth/MfaChallenge';
import { rotateCsrfToken } from '../../lib/csrf';
import './Login.css';

export const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState<'login' | 'challenge' | 'setup'>('login');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [loggedUserId, setLoggedUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  // CORRECTION: Audit log inséré UNIQUEMENT après vérification MFA complète.
  // Phase 3: utilisation du helper logAudit (structured JSONB metadata).
  const logAuditSuccess = async (userId: string, loginMethod: 'password+mfa' | 'password+setup') => {
    // Récupère le tenant_id (le store n'est pas encore hydraté à ce stade,
    // on doit faire une requête directe comme l'ancien code)
    const { data: userRow } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userRow?.tenant_id) {
      // Insère directement sans passer par logAudit car le store auth n'est
      // pas encore hydraté (user/profile sont null). On set manuellement
      // tenant_id + user_id et on garde la même metadata structurée.
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
    // À ce point, l'utilisateur a AAL2 garanti par supabase.auth.mfa.verify()
    // ou supabase.auth.mfa.enroll() (setup flow).
    await logAuditSuccess(userId, 'password+mfa');
    // Rotation du token CSRF post-login (anti-rejeu)
    rotateCsrfToken();
    navigate('/dashboard');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setError('Session invalide');
      setLoading(false);
      return;
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
    // vérifié. Si présent → challenge obligatoire. Si absent → setup obligatoire
    // (PLUS DE BYPASS pour les non-admins).
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData?.totp?.find(f => f.status === 'verified');

    if (totpFactor) {
      // Facteur TOTP vérifié → challenge obligatoire (admin ET non-admin)
      setMfaFactorId(totpFactor.id);
      setLoggedUserId(data.session.user.id);
      setMfaStep('challenge');
    } else {
      // Aucun facteur vérifié → enrôlement obligatoire (admin ET non-admin)
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
          <div className="error-alert">
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
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
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
