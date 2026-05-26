import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Lock, Mail, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import './Login.css';

export const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    } else if (data.session) {
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
      
      navigate('/dashboard');
    }
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
      </div>
    </div>
  );
};
