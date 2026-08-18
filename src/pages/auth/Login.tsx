// ============================================================================
// JurisLink - Phase 1.2 - Patch Login.tsx (correction contournement MFA)
// ============================================================================
// Remplace: src/pages/auth/Login.tsx
//
// Changements vs version actuelle:
//   1. Tous les utilisateurs (admins ET non-admins) doivent compléter la MFA
//      si un facteur TOTP est enrôlé. Aucun bypass via handleMfaSuccess().
//   2. Tous les utilisateurs sans facteur TOTP sont redirigés vers l'enrôlement
//      MFA (auparavant seuls les admins — vulnérabilité critique).
//   3. handleMfaSuccess ne peut plus être appelé sans MFA complète (AAL2).
//   4. Suppression du type 'firm_admin_simple' (n'existe pas dans user_role
//      enum — bug silencieux).
//   5. Audit log: insert direct après MFA vérifiée (pas avant).
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Lock, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import { MfaSetup } from '../../components/auth/MfaSetup';
import { MfaChallenge } from '../../components/auth/MfaChallenge';
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

  // CORRECTION: Audit log inséré UNIQUEMENT après vérification MFA complète
  const logAuditSuccess = (userId: string) => {
    supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single()
      .then(({ data: userRow }) => {
        if (userRow?.tenant_id) {
          supabase.from('audit_logs').insert([{
            tenant_id: userRow.tenant_id,
            user_id: userId,
            action: 'LOGIN_SUCCESS_MFA',
            entity: 'auth',
            entity_id: userId
          }]).then(({ error }) => {
            if (error) console.error('Audit log insert failed:', error.message);
          });
        }
      })
      .catch((err) => console.error('Audit log lookup failed:', err));
  };

  const handleMfaSuccess = (userId: string) => {
    // À ce point, l'utilisateur a AAL2 garanti par supabase.auth.mfa.verify()
    logAuditSuccess(userId);
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
      // La politique RLS RESTRICTIVE bloquera toute donnée sensible tant
      // que AAL2 n'est pas atteint, donc il n'y a pas de risque à laisser
      // l'utilisateur dans cet état intermédiaire.
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
