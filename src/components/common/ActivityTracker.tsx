import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Portal } from './Portal';

const TIMEOUT_MS = 180000; // 3 minutes
const WARNING_BEFORE_MS = 30000; // 30 seconds before timeout

export const ActivityTracker = () => {
  const { signOut } = useAuthStore();
  const { t } = useTranslation();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(WARNING_BEFORE_MS / 1000);
  const [expiresAt, setExpiresAt] = useState(Date.now() + TIMEOUT_MS);
  
  const resetTimers = useCallback(() => {
    if (showWarning) return;
    setExpiresAt(Date.now() + TIMEOUT_MS);
  }, [showWarning]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const left = expiresAt - now;

      if (left <= 0) {
        clearInterval(interval);
        handleForceLogout();
      } else if (left <= WARNING_BEFORE_MS) {
        if (!showWarning) setShowWarning(true);
        setTimeLeft(Math.max(0, Math.ceil(left / 1000)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, showWarning]);

  const handleForceLogout = async () => {
    setShowWarning(false);
    await signOut();
  };

  const stayConnected = () => {
    setShowWarning(false);
    resetTimers(); // Force un reset complet
  };

  useEffect(() => {
    // Écoute des événements d'activité globale
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Fonction throttled pour ne pas surcharger le navigateur
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        resetTimers();
      }, 1000); // Check d'activité au max toutes les secondes
    };

    events.forEach(event => document.addEventListener(event, handleActivity, { passive: true }));
    resetTimers(); // Init

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [resetTimers]);

  if (!showWarning) return null;

  return (
    <Portal>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: '1rem'
      }}>
        <div className="glass-card animate-fade-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', textAlign: 'center', background: '#fff', border: '1px solid hsla(var(--danger), 0.3)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'hsla(var(--warning), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'hsl(var(--warning))' }}>
            <AlertTriangle size={32} />
          </div>
          <h2 style={{ marginBottom: '1rem', color: 'hsl(var(--text-main))', fontSize: '1.5rem' }}>
            Inactivité détectée
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', marginBottom: '2rem' }}>
            Pour votre sécurité, vous serez déconnecté automatiquement dans <strong style={{ color: 'hsl(var(--danger))', fontSize: '1.2rem' }}>{timeLeft} secondes</strong>.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn" onClick={handleForceLogout} style={{ flex: 1, background: 'hsla(var(--text-muted), 0.1)' }}>
              Se déconnecter
            </button>
            <button className="btn btn-primary" onClick={stayConnected} style={{ flex: 1 }}>
              Rester connecté
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
