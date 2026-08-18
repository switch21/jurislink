// ============================================================================
// JurisLink - Phase 4.6 - Component: SessionTimeout (inactivity auto-logout)
// ============================================================================
// Emplacement: src/components/common/SessionTimeout.tsx (nouveau fichier)
//
// Stratégie:
//   Auto-logout après période d'inactivité pour protéger les sessions
//   laissées ouvertes (poste de travail non verrouillé, onglet oublié).
//
//   Timeouts par rôle (configurables via props):
//     - root_admin:  15 min (données les plus sensibles)
//     - firm_admin:  30 min
//     - lawyer/secrétaire: 60 min (working sessions longues)
//     - client: 120 min (consultation, peu d'actions)
//
//   Warning avant timeout: 60s avant, l'utilisateur peut prolonger la session.
//
// Implémentation:
//   - Repose sur ActivityTracker existant (qui gérait déjà le timeout à 3min).
//   - Ce composant remplace ActivityTracker avec:
//     * timeouts par rôle
//     * ActivityTracker conserve son UI warning (réutilisé)
//     * Ajout: snap_to_warning_on_window_focus (si utilisateur revient après
//       longue absence, force le warning immédiatement)
//   - Les événements d'activité sont mousedown/move, keypress, scroll,
//     touchstart, focus, visibilitychange.
//
// Notes:
//   - Le logout force aussi clearCsrfToken() (rotation après login suivant).
//   - L'audit log "SESSION_TIMEOUT" est inséré (l'utilisateur n'a pas
//     volontairement fermé sa session — info utile pour le SOC).
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock } from 'lucide-react';
import { Portal } from './Portal';
import { clearCsrfToken } from '../../lib/csrf';
import { supabase } from '../../lib/supabase';

// ─── Configuration ─────────────────────────────────────────────────────────

interface TimeoutConfig {
  timeoutMs: number;
  warningBeforeMs: number; // afficher warning N ms avant timeout
}

const TIMEOUT_BY_ROLE: Record<string, TimeoutConfig> = {
  root_admin:    { timeoutMs: 15 * 60 * 1000, warningBeforeMs: 60_000 },
  firm_admin:    { timeoutMs: 30 * 60 * 1000, warningBeforeMs: 60_000 },
  lawyer:       { timeoutMs: 60 * 60 * 1000, warningBeforeMs: 60_000 },
  secretary:    { timeoutMs: 60 * 60 * 1000, warningBeforeMs: 60_000 },
  client:       { timeoutMs: 120 * 60 * 1000, warningBeforeMs: 60_000 },
};

const DEFAULT_TIMEOUT: TimeoutConfig = { timeoutMs: 30 * 60 * 1000, warningBeforeMs: 60_000 };

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'focus'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeoutForRole(role: string | undefined): TimeoutConfig {
  if (!role) return DEFAULT_TIMEOUT;
  return TIMEOUT_BY_ROLE[role] ?? DEFAULT_TIMEOUT;
}

/**
 * Hook: retourne true si l'onglet est visible (pas caché).
 * Utilisé pour ne pas déclencher le timeout quand l'utilisateur est juste
 * sur un autre onglet (mais on compte le temps passé hors onglet).
 */
// Hook conservé pour usage futur — actuellement inutilisé car le snap-to-warning
// est géré via l'effet visibilitychange direct.
// function useIsTabVisible(): boolean { ... }

// ─── Composant ──────────────────────────────────────────────────────────────

interface SessionTimeoutProps {
  /** Override du timeout (en ms). Si non fourni, utilise le default par rôle. */
  timeoutMs?: number;
  /** Override du warning (en ms avant timeout). */
  warningBeforeMs?: number;
  /** Override de la fonction de logout (default: useAuthStore.signOut). */
  onTimeout?: () => void | Promise<void>;
}

export const SessionTimeout: React.FC<SessionTimeoutProps> = ({
  timeoutMs,
  warningBeforeMs,
  onTimeout,
}) => {
  const { profile, user, signOut } = useAuthStore();
  const { t } = useTranslation();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const expiresAtRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());

  // Configuration selon le rôle
  const config = (() => {
    const roleConfig = getTimeoutForRole(profile?.role);
    return {
      timeoutMs: timeoutMs ?? roleConfig.timeoutMs,
      warningBeforeMs: warningBeforeMs ?? roleConfig.warningBeforeMs,
    };
  })();

  // Reset le timer
  const resetTimers = useCallback(() => {
    if (showWarning) return; // Si warning affiché, ne reset pas (utilisateur doit choisir)
    expiresAtRef.current = Date.now() + config.timeoutMs;
    lastActivityRef.current = Date.now();
  }, [showWarning, config.timeoutMs]);

  // Logout forcé
  const handleForceLogout = useCallback(async () => {
    setShowWarning(false);

    // Audit log: session expirée par inactivité
    try {
      if (user?.id && profile?.tenant_id) {
        await supabase.from('audit_logs').insert({
          tenant_id: profile.tenant_id,
          user_id: user.id,
          action: 'SESSION_TIMEOUT',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            ip: null,
            user_agent: navigator.userAgent,
            source: 'UI:SessionTimeout',
            reason: 'inactivity',
            role: profile.role,
            timeout_ms: config.timeoutMs,
          },
        });
      }
    } catch (err) {
      console.error('SessionTimeout audit log failed:', err);
    }

    // Clear CSRF (rotation après prochain login)
    clearCsrfToken();

    // Logout Supabase
    if (onTimeout) {
      await onTimeout();
    } else {
      await signOut();
    }
  }, [showWarning, user, profile, config.timeoutMs, onTimeout, signOut]);

  // Bouton "Rester connecté"
  const stayConnected = useCallback(() => {
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  // Tick: vérifie le timeout toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const left = expiresAtRef.current - now;

      if (left <= 0) {
        clearInterval(interval);
        void handleForceLogout();
      } else if (left <= config.warningBeforeMs) {
        if (!showWarning) setShowWarning(true);
        setTimeLeft(Math.max(0, Math.ceil(left / 1000)));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAtRef, showWarning, config.warningBeforeMs, handleForceLogout]);

  // Écoute activité utilisateur
  useEffect(() => {
    let throttleTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleActivity = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        resetTimers();
      }, 1000);
    };

    ACTIVITY_EVENTS.forEach(event =>
      document.addEventListener(event, handleActivity, { passive: true })
    );
    resetTimers();

    return () => {
      ACTIVITY_EVENTS.forEach(event =>
        document.removeEventListener(event, handleActivity)
      );
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [resetTimers]);

  // Snap-to-warning: si l'utilisateur revient après une longue absence
  // (visibilité reprend après > timeout), force le warning immédiatement
  useEffect(() => {
    let wasVisible = document.visibilityState === 'visible';

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      if (!wasVisible && isVisible) {
        // Revenu d'un onglet caché
        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime >= config.timeoutMs - config.warningBeforeMs) {
          // A été idle assez longtemps → force warning
          setShowWarning(true);
          // Calcul le timeLeft comme si on était au bord du timeout
          const fakeExpiresAt = lastActivityRef.current + config.timeoutMs;
          expiresAtRef.current = fakeExpiresAt;
          setTimeLeft(Math.max(0, Math.ceil((fakeExpiresAt - Date.now()) / 1000)));
        }
      }
      wasVisible = isVisible;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [config.timeoutMs, config.warningBeforeMs]);

  // Pas d'UI si pas de warning
  if (!showWarning) return null;

  // UI de warning (similaire à ActivityTracker)
  return (
    <Portal>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: '1rem'
      }}>
        <div className="glass-card animate-fade-in" style={{
          padding: '2.5rem', width: '100%', maxWidth: '400px', textAlign: 'center',
          background: '#fff', border: '1px solid hsla(var(--warning), 0.3)'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'hsla(var(--warning), 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem', color: 'hsl(var(--warning))'
          }}>
            <AlertTriangle size={32} />
          </div>
          <h2 style={{
            marginBottom: '1rem', color: 'hsl(var(--text-main))', fontSize: '1.5rem'
          }}>
            {t('session.timeout_title', 'Inactivité détectée')}
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))', marginBottom: '2rem' }}>
            {t('session.timeout_warning', 'Pour votre sécurité, vous serez déconnecté automatiquement dans')}{' '}
            <strong style={{ color: 'hsl(var(--danger))', fontSize: '1.2rem' }}>
              {timeLeft} {t('session.seconds', 'secondes')}
            </strong>
            .
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
              <Clock size={14} />
              <span>{Math.floor(config.timeoutMs / 60_000)} min</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn" onClick={handleForceLogout} style={{ flex: 1, background: 'hsla(var(--text-muted), 0.1)' }}>
              {t('session.logout_now', 'Se déconnecter')}
            </button>
            <button className="btn btn-primary" onClick={stayConnected} style={{ flex: 1 }}>
              {t('session.stay_connected', 'Rester connecté')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

// Export pour les tests
export const __test__ = {
  TIMEOUT_BY_ROLE,
  DEFAULT_TIMEOUT,
  getTimeoutForRole,
};
