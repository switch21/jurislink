// ============================================================================
// JurisLink - Phase 5.13 - Patch SessionTimeout.tsx (max duration check)
// ============================================================================
// Remplace: src/components/common/SessionTimeout.tsx (version Phase 4)
//
// Changements vs Phase 4:
//   1. Check de la durée MAXIMALE de session (8h absolute cap) en PLUS du
//      timeout d'inactivité par rôle. Si max duration dépassée → logout
//      forcé avec reason='max_duration' (pas de warning, immédiat).
//   2. Le warning d'inactivité affiche aussi le temps restant avant la
//      durée max si elle approche (double info pour l'utilisateur).
//   3. Audit log enrichi avec reason 'inactivity' ou 'max_duration'.
//
// Notes:
//   - La durée max est lue depuis sessionManager.getMaxDurationRemaining()
//     qui lit le timestamp dans localStorage (cf. sessionManager.ts).
//   - Cette vérification est DOUBLÉE côté edge function (verify-session
//     retourne 401 SESSION_MAX_DURATION_EXCEEDED si le JWT 'iat' > 8h).
//     Le client est l'optimisation UX, le serveur reste l'arbitre final.
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, Hourglass } from 'lucide-react';
import { Portal } from './Portal';
import { clearCsrfToken } from '../../lib/csrf';
import { supabase } from '../../lib/supabase';
import {
  getMaxDurationRemaining,
  isMaxDurationExceeded,
  clearSession,
  DEFAULT_CONFIG,
} from '../../lib/sessionManager';

// ─── Configuration ─────────────────────────────────────────────────────────

interface TimeoutConfig {
  timeoutMs: number;
  warningBeforeMs: number;
}

const TIMEOUT_BY_ROLE: Record<string, TimeoutConfig> = {
  root_admin:    { timeoutMs: 15 * 60 * 1000, warningBeforeMs: 60_000 },
  firm_admin:    { timeoutMs: 30 * 60 * 1000, warningBeforeMs: 60_000 },
  lawyer:        { timeoutMs: 60 * 60 * 1000, warningBeforeMs: 60_000 },
  secretary:     { timeoutMs: 60 * 60 * 1000, warningBeforeMs: 60_000 },
  client:         { timeoutMs: 120 * 60 * 1000, warningBeforeMs: 60_000 },
};

const DEFAULT_TIMEOUT: TimeoutConfig = { timeoutMs: 30 * 60 * 1000, warningBeforeMs: 60_000 };

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'focus'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeoutForRole(role: string | undefined): TimeoutConfig {
  if (!role) return DEFAULT_TIMEOUT;
  return TIMEOUT_BY_ROLE[role] ?? DEFAULT_TIMEOUT;
}

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
  const [maxDurationLeftMs, setMaxDurationLeftMs] = useState<number | null>(null);
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

  // Reset le timer d'inactivité
  const resetTimers = useCallback(() => {
    if (showWarning) return;
    expiresAtRef.current = Date.now() + config.timeoutMs;
    lastActivityRef.current = Date.now();
  }, [showWarning, config.timeoutMs]);

  // Logout forcé — reason: 'inactivity' ou 'max_duration'
  const handleForceLogout = useCallback(async (reason: 'inactivity' | 'max_duration' = 'inactivity') => {
    setShowWarning(false);

    // Audit log
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
            reason,
            role: profile.role,
            timeout_ms: reason === 'inactivity' ? config.timeoutMs : DEFAULT_CONFIG.maxDurationMs,
            max_duration_remaining_ms: reason === 'max_duration' ? 0 : getMaxDurationRemaining(),
          },
        });
      }
    } catch (err) {
      console.error('SessionTimeout audit log failed:', err);
    }

    // Clear CSRF (rotation après prochain login)
    clearCsrfToken();
    clearSession(); // Phase 5: nettoie le storage session start

    // Logout Supabase
    if (onTimeout) {
      await onTimeout();
    } else {
      await signOut();
    }
  }, [showWarning, user, profile, config.timeoutMs, onTimeout, signOut]);

  // Tick: vérifie timeout + max duration toutes les secondes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // 1. Check durée max de session (Phase 5) — prioritaire
      if (isMaxDurationExceeded()) {
        clearInterval(interval);
        void handleForceLogout('max_duration');
        return;
      }
      // Met à jour l'affichage du temps restant max duration (info)
      const maxRemaining = getMaxDurationRemaining();
      setMaxDurationLeftMs(maxRemaining > 0 ? maxRemaining : null);

      // 2. Check timeout d'inactivité
      const left = expiresAtRef.current - now;

      if (left <= 0) {
        clearInterval(interval);
        void handleForceLogout('inactivity');
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
  useEffect(() => {
    let wasVisible = document.visibilityState === 'visible';

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      if (!wasVisible && isVisible) {
        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime >= config.timeoutMs - config.warningBeforeMs) {
          setShowWarning(true);
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

  // Helper: format max duration restante en heures+minutes
  const formatMaxDuration = (ms: number): string => {
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  };

  // UI de warning
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
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
              <Clock size={14} />
              <span>{Math.floor(config.timeoutMs / 60_000)} min idle</span>
            </div>
            {maxDurationLeftMs !== null && maxDurationLeftMs > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                <Hourglass size={14} />
                <span>{formatMaxDuration(maxDurationLeftMs)} max</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn" onClick={() => void handleForceLogout('inactivity')} style={{ flex: 1, background: 'hsla(var(--text-muted), 0.1)' }}>
              {t('session.logout_now', 'Se déconnecter')}
            </button>
            <button className="btn btn-primary" onClick={() => { setShowWarning(false); resetTimers(); }} style={{ flex: 1 }}>
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
