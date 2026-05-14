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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="login-container">
      <div className="login-background"></div>
      
      <div className="login-wrapper animate-fade-in glass-card">
        <div className="login-header">
          <div className="logo-container" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src="/logo.png" alt="JurisLink Logo" style={{ height: '100px', objectFit: 'contain' }} />
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
