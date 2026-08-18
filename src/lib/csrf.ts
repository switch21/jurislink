// ============================================================================
// JurisLink - Phase 3.1 - Helper CSRF (custom header pattern)
// ============================================================================
// Emplacement: src/lib/csrf.ts (nouveau fichier)
//
// Stratégie: Token CSRF random 32 bytes, stocké en sessionStorage (par onglet),
// envoyé via header X-CSRF-Token sur toutes les mutations (POST/PUT/PATCH/DELETE).
// Validé côté edge function par comparaison simple avec un hash du JWT user.
//
// Pourquoi custom header plutôt que double-submit cookie:
//   - L'app utilise JWT Bearer dans Authorization header (pas de cookie session)
//   - Les cookies Supabase sb-* ne sont lus que par Supabase lui-même
//   - Custom header est plus simple à intégrer dans une SPA existante
//   - Un attaquant CSRF ne peut pas forger un header custom cross-origin
//     (CORS préflight bloquera la requête)
//
// Pourquoi sessionStorage plutôt que localStorage:
//   - Isolation par onglet (un onglet compromis n'affecte pas les autres)
//   - Nettoyage automatique à la fermeture de l'onglet
//   - Suffisamment persistant pour une session utilisateur
// ============================================================================

const CSRF_TOKEN_KEY = 'jurislink.csrf.token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH_BYTES = 32;

/**
 * Génère un token CSRF random en base64 (URL-safe).
 * Utilise crypto.getRandomValues() (Web Crypto API) — plus sécurisé que Math.random().
 *
 * @returns Un token de 43 caractères base64url (32 bytes → 256 bits d'entropie).
 */
function generateCsrfToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_LENGTH_BYTES);
  crypto.getRandomValues(bytes);
  // Conversion en base64url (sans padding, caractères URL-safe)
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Récupère (ou crée) le token CSRF pour la session courante.
 *
 * Le token est stocké en sessionStorage. S'il n'existe pas encore, un nouveau
 * est généré et persisté. Si sessionStorage n'est pas disponible (SSR, env
// restrictif), un token éphémère est généré à chaque appel (fonctionnement
// dégradé — les edge functions doivent gérer ce cas en mode dev).
 *
 * @returns Le token CSRF courant.
 */
export function getCsrfToken(): string {
  // Vérifie disponibilité sessionStorage (peut être undefined en SSR ou
  // si l'utilisateur a bloqué les storage en mode privé)
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      // Mode dégradé — génère un token éphémère (edge function devra tolérer)
      return generateCsrfToken();
    }

    let token = window.sessionStorage.getItem(CSRF_TOKEN_KEY);
    if (!token) {
      token = generateCsrfToken();
      window.sessionStorage.setItem(CSRF_TOKEN_KEY, token);
    }
    return token;
  } catch (err) {
    // Quota dépassé, navigateur en mode privé restrictif, etc.
    console.warn('CSRF: sessionStorage unavailable, using ephemeral token', err);
    return generateCsrfToken();
  }
}

/**
 * Force la rotation du token CSRF (utile après login/logout pour casser
// toute éventuelle session compromise).
 *
 * À appeler :
 *   - Après auth.signInWithPassword() réussi
 *   - Après auth.signOut()
 *   - Après mfa.verify() (élévation AAL2)
 */
export function rotateCsrfToken(): string {
  const newToken = generateCsrfToken();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(CSRF_TOKEN_KEY, newToken);
    }
  } catch (err) {
    console.warn('CSRF: sessionStorage write failed, token ephemeral', err);
  }
  return newToken;
}

/**
 * Nettoie le token CSRF (à appeler au logout).
 */
export function clearCsrfToken(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(CSRF_TOKEN_KEY);
    }
  } catch (err) {
    console.warn('CSRF: sessionStorage remove failed', err);
  }
}

/**
 * Le nom du header HTTP à utiliser pour envoyer le token.
 * Exposé pour que les edge functions et les tests puissent y faire référence
 * sans hardcoder la string.
 */
export const CSRF_HEADER = CSRF_HEADER_NAME;

/**
 * Détermine si une méthode HTTP est une "mutation" (nécessite CSRF).
 *
 * @param method - Méthode HTTP en majuscules ou minuscules
 * @returns true si la méthode est POST/PUT/PATCH/DELETE, false sinon
 */
export function isMutationMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

// Export pour les tests (les fonctions internes)
export const __test__ = { generateCsrfToken };
