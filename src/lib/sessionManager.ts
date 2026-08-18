// ============================================================================
// JurisLink - Phase 5.3 - Session Manager (max duration + heartbeat)
// ============================================================================
// Emplacement: src/lib/sessionManager.ts (nouveau fichier)
//
// Objectif:
//   Compléter le SessionTimeout (Phase 4 — idle timeout par inactivité) avec:
//     1. DURÉE MAXIMALE de session: 8h absolute cap. Au-delà, l'utilisateur
//        doit se reconnecter (rotation du refresh token trop ancien = risque
//        de session hijacking si le refresh token a été compromis).
//     2. HEARTBEAT: ping périodique (5min) vers l'edge function verify-session
//        pour confirmer que la session est toujours active côté serveur
//        (compte non désactivé, AAL2 toujours valide, etc.).
//     3. PERSISTENCE: la date de début de session est stockée dans localStorage
//        pour survivre aux refreshs de page et aux redémarrages de navigateur.
//
// Architecture:
//   - Pure fonctions (pas de singleton) — testables et composables.
//   - startHeartbeat() retourne un unsubscribe function (pattern standard React).
//   - Storage key: 'jurislink.session.start' (ms epoch) — ne contient PAS
//     de PII (personally identifiable information).
//
// Sécurité:
//   - Le timestamp est vérifié côté edge function via le claim 'iat' du JWT
//     (voir verify-session/index.patch.ts). Si le JWT est plus ancien que
//     MAX_DURATION_MS, l'edge function retourne 401 SESSION_MAX_DURATION_EXCEEDED.
//   - La vérification client est une optimisation UX (logout avant que le
//     prochain appel API échoue), pas une mesure de sécurité — le serveur
//     reste l'arbitre final.
// ============================================================================

// ─── Configuration ─────────────────────────────────────────────────────────

export interface SessionManagerConfig {
  /** Durée maximale d'une session en ms (default: 8h). */
  maxDurationMs: number;
  /** Intervalle du heartbeat en ms (default: 5min). */
  heartbeatIntervalMs: number;
  /** URL du edge function à pinger (default: 'verify-session'). */
  heartbeatEndpoint: string;
  /** Clé localStorage pour stocker le timestamp de début (default: 'jurislink.session.start'). */
  storageKey: string;
}

export const DEFAULT_CONFIG: SessionManagerConfig = {
  maxDurationMs: 8 * 60 * 60 * 1000, // 8h
  heartbeatIntervalMs: 5 * 60 * 1000, // 5min
  heartbeatEndpoint: 'verify-session',
  storageKey: 'jurislink.session.start',
};

// ─── Storage helpers ────────────────────────────────────────────────────────

function safeGetLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Initialise une nouvelle session: enregistre le timestamp actuel.
 * À appeler après login MFA réussi (cf. Login.tsx).
 *
 * @param config - Configuration (utilise DEFAULT_CONFIG par défaut)
 * @returns Date de début de session, ou null si storage indisponible
 */
export function initSession(config: SessionManagerConfig = DEFAULT_CONFIG): Date | null {
  const storage = safeGetLocalStorage();
  if (!storage) return null;
  const now = Date.now();
  try {
    storage.setItem(config.storageKey, String(now));
    return new Date(now);
  } catch {
    return null;
  }
}

/**
 * Récupère le timestamp de début de session (depuis localStorage).
 *
 * @param config - Configuration
 * @returns Date de début de session, ou null si pas de session active
 */
export function getSessionStart(config: SessionManagerConfig = DEFAULT_CONFIG): Date | null {
  const storage = safeGetLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(config.storageKey);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return null;
    return new Date(ts);
  } catch {
    return null;
  }
}

/**
 * Retourne le temps restant avant la durée maximale (en ms).
 * Négatif si déjà dépassé.
 *
 * @param config - Configuration
 * @returns ms restants (négatif si dépassé), ou 0 si pas de session active
 */
export function getMaxDurationRemaining(config: SessionManagerConfig = DEFAULT_CONFIG): number {
  const start = getSessionStart(config);
  if (!start) return 0;
  const elapsed = Date.now() - start.getTime();
  return config.maxDurationMs - elapsed;
}

/**
 * Retourne true si la durée maximale de session est dépassée.
 *
 * Retourne false s'il n'y a pas de session active (pas de timestamp en storage)
 * — l'appelant ne doit pas déclencher un logout "max duration" si l'utilisateur
 * n'est jamais connecté.
 *
 * @param config - Configuration
 */
export function isMaxDurationExceeded(config: SessionManagerConfig = DEFAULT_CONFIG): boolean {
  const start = getSessionStart(config);
  if (!start) return false; // pas de session active — pas de dépassement
  const remaining = getMaxDurationRemaining(config);
  return remaining <= 0;
}

/**
 * Nettoie le storage de session. À appeler sur signOut().
 *
 * @param config - Configuration
 */
export function clearSession(config: SessionManagerConfig = DEFAULT_CONFIG): void {
  const storage = safeGetLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(config.storageKey);
  } catch {
    // ignore — storage indisponible ou en mode privé
  }
}

// ─── Heartbeat ──────────────────────────────────────────────────────────────

export interface HeartbeatResult {
  ok: boolean;
  error?: string;
  /** True si le serveur a signalé que la session max duration est dépassée. */
  maxDurationExceeded?: boolean;
  /** True si le serveur a signalé que le compte a été désactivé depuis le login. */
  accountDisabled?: boolean;
}

/**
 * Démarre un heartbeat périodique vers l'edge function verify-session.
 *
 * Le heartbeat a deux objectifs:
 *   1. Confirmer que la session est toujours valide côté serveur
 *   2. Détecter les désactivations de compte en temps réel (logout immédiat)
 *
 * @param onResult - Callback appelé à chaque heartbeat avec le résultat
 * @param onError - Callback appelé en cas de session max duration dépassée
 *                  ou de compte désactivé (logout immédiat)
 * @param config - Configuration (override du default)
 * @returns Unsubscribe function (à appeler sur logout/unmount)
 */
export function startHeartbeat(
  onResult?: (result: HeartbeatResult) => void,
  onError?: (result: HeartbeatResult) => void,
  config: SessionManagerConfig = DEFAULT_CONFIG,
): () => void {
  let stopped = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let initialTimeout: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    stopped = true;
    if (initialTimeout) {
      clearTimeout(initialTimeout);
      initialTimeout = null;
    }
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const doBeat = async () => {
    if (stopped) return;

    // Skip si la session max duration est déjà dépassée côté client
    if (isMaxDurationExceeded(config)) {
      const result: HeartbeatResult = {
        ok: false,
        maxDurationExceeded: true,
        error: 'Session max duration exceeded (client-side)',
      };
      // Stoppe le heartbeat — l'appelant est censé faire un signOut()
      // qui unsubscribe le heartbeat. On évite les loops inutiles.
      stop();
      onError?.(result);
      return;
    }

    try {
      // Dynamique import pour éviter la dépendance circulaire avec supabase.ts
      const { supabase } = await import('./supabase');
      const { error } = await supabase.functions.invoke(config.heartbeatEndpoint);

      if (stopped) return;

      if (error) {
        // Erreur invoke — probablement 401/403 du serveur (session invalidée)
        const msg = error.message || String(error);
        const result: HeartbeatResult = {
          ok: false,
          accountDisabled: /disabled|locked/i.test(msg),
          maxDurationExceeded: /max.duration/i.test(msg),
          error: msg,
        };
        if (result.accountDisabled || result.maxDurationExceeded) {
          // Stoppe le heartbeat — l'appelant est censé faire un signOut()
          stop();
          onError?.(result);
        } else {
          onResult?.(result);
        }
        return;
      }

      onResult?.({ ok: true });
    } catch (err) {
      if (stopped) return;
      onResult?.({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Premier heartbeat immédiat (délai 0), puis intervalles réguliers
  initialTimeout = setTimeout(() => { void doBeat(); }, 0);
  interval = setInterval(() => { void doBeat(); }, config.heartbeatIntervalMs);

  // Unsubscribe
  return stop;
}

// Export pour les tests internes
export const __test__ = {
  DEFAULT_CONFIG,
  initSession,
  getSessionStart,
  getMaxDurationRemaining,
  isMaxDurationExceeded,
  clearSession,
  safeGetLocalStorage,
};
