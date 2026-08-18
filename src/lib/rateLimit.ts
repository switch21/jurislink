// ============================================================================
// JurisLink - Phase 4.1 - Helper rate-limiting client (throttle + backoff)
// ============================================================================
// Emplacement: src/lib/rateLimit.ts (nouveau fichier)
//
// Stratégie:
//   Le rate-limiting serveur (edge function Deno KV) est la source de vérité.
//   Ce helper client-side offre DEUX fonctionnalités complémentaires:
//
//   1. Throttle UI: empêche les double-clicks / soumissions multiples
//      (anti-rejeu de formulaires). Purement client, pas d'appel serveur.
//
//   2. Retry avec backoff exponentiel: quand une requête reçoit 429 Too Many
//      Requests, attend Retry-After (ou calcule un backoff exponentiel) puis
//      réessaie. Jusqu'à maxRetries (default: 3).
//
//   3. Circuit breaker: après N échecs consécutifs 429 sur la même route,
//      bloque les requêtes pendant un cooldown (default: 60s) pour éviter
//      de saturer le serveur. Affiche un banner UI (via onCircuitOpen).
//
// Notes:
//   - Aucune logique de "rate limit par IP" côté client — c'est le rôle du
//     serveur (on ne peut pas connaître l'IP publique côté client, et un
//     attaquant peut la falsifier via proxies).
//   - Le throttle UI est par-clé (ex: "submit:tenant-create") — évite les
//     collisions entre différents formulaires.
//   - Le circuit breaker est in-memory (par onglet). Persistant via
//     sessionStorage pour survivre aux recharges.
// ============================================================================

const CIRCUIT_BREAKER_KEY = 'jurislink.circuit';

// ─── 1. Throttle UI (anti double-submit) ───────────────────────────────────

interface ThrottleEntry {
  expiresAt: number;
}

const throttleMap = new Map<string, ThrottleEntry>();

/**
 * Vérifie si une action peut être exécutée (pas throtlée dans la fenêtre).
 * Si oui, enregistre le timestamp pour la durée du throttle.
 *
 * @param key - Clé unique pour l'action (ex: "submit:tenant-create")
 * @param throttleMs - Durée du throttle en ms (default: 1000)
 * @returns true si l'action peut procéder, false si throtlée
 */
export function tryAcquireThrottle(key: string, throttleMs: number = 1000): boolean {
  const now = Date.now();
  const entry = throttleMap.get(key);

  if (entry && entry.expiresAt > now) {
    return false; // Throtlé
  }

  throttleMap.set(key, { expiresAt: now + throttleMs });
  return true;
}

/**
 * Libère manuellement le throttle (utile en cas d'annulation utilisateur).
 */
export function releaseThrottle(key: string): void {
  throttleMap.delete(key);
}

// ─── 2. Circuit breaker (anti-saturation serveur) ─────────────────────────

interface CircuitState {
  failureCount: number;
  openUntil: number; // timestamp ms
}

function loadCircuit(key: string): CircuitState | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(`${CIRCUIT_BREAKER_KEY}.${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CircuitState;
    return parsed;
  } catch {
    return null;
  }
}

function saveCircuit(key: string, state: CircuitState): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(
      `${CIRCUIT_BREAKER_KEY}.${key}`,
      JSON.stringify(state)
    );
  } catch {
    // Quota dépassé — on continue sans persister
  }
}

export function isCircuitOpen(key: string): boolean {
  const state = loadCircuit(key);
  if (!state) return false;
  return state.openUntil > Date.now();
}

export function getCircuitResetTime(key: string): number {
  const state = loadCircuit(key);
  if (!state) return 0;
  return Math.max(0, state.openUntil - Date.now());
}

/**
 * Enregistre un échec 429 sur une route. Si le compteur dépasse le seuil,
 * ouvre le circuit (bloque les requêtes pendant `cooldownMs`).
 *
 * @param key - Clé de route (ex: "rate-limit:verify-session")
 * @param threshold - Nombre d'échecs avant ouverture (default: 5)
 * @param cooldownMs - Durée du blocage en ms (default: 60000 = 1 min)
 * @param onOpen - Callback appelé à l'ouverture du circuit
 * @returns true si le circuit vient d'être ouvert, false sinon
 */
export function recordFailure(
  key: string,
  threshold: number = 5,
  cooldownMs: number = 60000,
  onOpen?: (key: string, cooldownMs: number) => void
): boolean {
  const state = loadCircuit(key) ?? { failureCount: 0, openUntil: 0 };
  state.failureCount += 1;

  if (state.failureCount >= threshold) {
    state.openUntil = Date.now() + cooldownMs;
    saveCircuit(key, state);
    onOpen?.(key, cooldownMs);
    return true;
  }

  saveCircuit(key, state);
  return false;
}

/**
 * Réinitialise le circuit après un succès (ou un reset manuel).
 */
export function resetCircuit(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(`${CIRCUIT_BREAKER_KEY}.${key}`);
  } catch {
    // ignore
  }
}

// ─── 3. Retry avec backoff exponentiel ──────────────────────────────────────

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatus?: number[];
  respectRetryAfter?: boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30000,
  retryOnStatus: [429, 502, 503, 504],
  respectRetryAfter: true,
};

/**
 * Calcule le délai avant retry selon le schéma exponentiel + jitter:
 *   delay = min(maxDelay, base * 2^attempt) + random(0, base)
 *
 * @param attempt - Numéro du retry (0 = premier retry)
 * @param baseDelayMs - Délai de base
 * @param maxDelayMs - Délai max (plafond)
 */
export function computeBackoff(
  attempt: number,
  baseDelayMs: number = 500,
  maxDelayMs: number = 30000
): number {
  const exp = Math.pow(2, attempt);
  const raw = baseDelayMs * exp;
  const jitter = Math.random() * baseDelayMs;
  return Math.min(maxDelayMs, raw + jitter);
}

/**
 * Extrait la valeur Retry-After d'une réponse HTTP 429/503.
 *
 * @param response - La réponse fetch
 * @returns Délai en ms (0 si header absent ou invalide)
 */
export function extractRetryAfterMs(response: Response): number {
  if (!DEFAULT_RETRY_OPTIONS.respectRetryAfter) return 0;

  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) return 0;

  // Peut être soit un nombre de secondes, soit une date HTTP
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return 0;
}

/**
 * Wrapper de retry: exécute une fonction asynchrone, retry sur échec
 * (status 429/5xx ou erreur réseau), avec backoff exponentiel.
 *
 * @param fn - Fonction asynchrone à exécuter (doit retourner une Response ou throw)
 * @param options - Options de retry
 * @returns La réponse finale (peut être 429/5xx si tous les retries échouent)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();

      // Si c'est une Response, on peut inspecter le status
      if (result instanceof Response) {
        if (!opts.retryOnStatus.includes(result.status)) {
          return result; // Succès ou erreur non-retryable
        }

        if (attempt < opts.maxRetries) {
          const retryAfterMs = extractRetryAfterMs(result);
          const backoff = retryAfterMs > 0
            ? retryAfterMs
            : computeBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
          await sleep(backoff);
          continue;
        }
      }

      return result;
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxRetries) {
        const backoff = computeBackoff(attempt, opts.baseDelayMs, opts.maxDelayMs);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('retryWithBackoff: exhausted retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export pour les tests
export const __test__ = {
  computeBackoff,
  extractRetryAfterMs,
  loadCircuit,
  saveCircuit,
  throttleMap,
};
