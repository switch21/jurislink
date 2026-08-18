// ============================================================================
// JurisLink - Phase 5.2 - HaveIBeenPwned k-anonymity password check
// ============================================================================
// Emplacement: src/lib/hibp.ts (nouveau fichier)
//
// Objectif:
//   Vérifier si un password a été exposé dans une breach de données connue
//   en utilisant l'API HaveIBeenPwned (HIBP) Passwords Range API.
//
//   STRATÉGIE K-ANONYMITY (cruciale pour la confidentialité):
//     1. Hash le password en SHA1 (uppercase hex)
//     2. Prends les 5 premiers caractères du hash → "prefix"
//     3. Fetch GET https://api.pwnedpasswords.com/range/{prefix}
//        → réponse: liste de "SUFFIX:COUNT" lines (les 35 derniers chars + nbre de breaches)
//     4. Compare les 35 derniers caractères du hash local avec chaque suffix
//        Si match → password a été exposé, on a le nombre de breaches
//
//   → Le password JAMAIS envoyé en clair à HIBP. Seuls 5 chars du hash partent,
//     ce qui correspond à ~16 millions de passwords potentiels (k=16M).
//     HIBP ne peut pas savoir quel password spécifique est vérifié.
//
// URLs:
//   - https://haveibeenpwned.com/API/v3#PwnedPasswords
//   - https://www.troyhunt.com/ive-just-launched-fastest-password-strength-checker-yet-with-k-anonymity/
//
// Notes:
//   - En cas d'erreur réseau (offline, HIBP down), on dégrade gracieusement:
//     on considère le password comme "non breach" MAIS on retourne un flag
//     "skipped" pour que l'UI puisse afficher un warning discret.
//   - L'API HIBP ne nécessite pas de clé pour l'endpoint range (gratuit).
//     En production à fort volume, ajouter l'en-tête 'hibp-api-key' si on
//     a un abonnement (sinon rate-limit à ~50 req/min par IP).
//   - Le hash SHA1 est calculé via Web Crypto API (crypto.subtle.digest).
//     Disponible dans tous les navigateurs modernes + browsers Deno.
// ============================================================================

export interface BreachCheckResult {
  /** True si le password a été exposé dans au moins une breach. */
  pwned: boolean;
  /** Nombre de breaches où ce password apparaît (0 si jamais exposé). */
  count: number;
  /** True si la vérification a été SKIPPÉE (offline, API down, etc.). */
  skipped: boolean;
  /** Message d'erreur si skipped (pour debug/logging). */
  error?: string;
}

const HIBP_RANGE_API = 'https://api.pwnedpasswords.com/range/';

/**
 * Calcule le hash SHA1 d'un password et retourne en uppercase hex (40 chars).
 * Utilise Web Crypto API (crypto.subtle.digest).
 *
 * @param password - Le password à hasher
 * @returns SHA1 hash en uppercase hex (ex: "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8")
 */
export async function sha1Hex(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  // Convertit ArrayBuffer → hex string
  const bytes = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
}

/**
 * Découpe un SHA1 hash en (prefix, suffix) pour k-anonymity.
 *
 * @param sha1Hash - SHA1 hash 40 chars uppercase hex
 * @returns Tuple [prefix (5 chars), suffix (35 chars)]
 */
export function splitHashForKAnonymity(sha1Hash: string): { prefix: string; suffix: string } {
  const cleanHash = sha1Hash.toUpperCase();
  if (cleanHash.length !== 40) {
    throw new Error(`Invalid SHA1 hash length: expected 40, got ${cleanHash.length}`);
  }
  return {
    prefix: cleanHash.substring(0, 5),
    suffix: cleanHash.substring(5),
  };
}

/**
 * Parse la réponse HIBP (format "SUFFIX:COUNT\nSUFFIX:COUNT\n...") et cherche
 * le suffix spécifié.
 *
 * @param responseBody - Corps de la réponse HIBP
 * @param suffix - Suffix (35 chars uppercase hex) à chercher
 * @returns Nombre de breaches (0 si non trouvé)
 */
export function parseHibpResponse(responseBody: string, suffix: string): number {
  const normalizedSuffix = suffix.toUpperCase();
  const lines = responseBody.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const lineSuffix = trimmed.substring(0, colonIndex).toUpperCase();
    const countStr = trimmed.substring(colonIndex + 1);
    if (lineSuffix === normalizedSuffix) {
      const count = parseInt(countStr, 10);
      return isNaN(count) ? 0 : count;
    }
  }
  return 0;
}

/**
 * Vérifie si un password a été exposé dans une breach connue (HaveIBeenPwned).
 *
 * Implémente k-anonymity: seul 5 chars du SHA1 hash sont envoyés à l'API.
 *
 * @param password - Password à vérifier (JAMAIS envoyé en clair)
 * @returns BreachCheckResult avec pwned + count + skipped flag
 */
export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  // Edge cases: password vide ou trop court — skip
  if (!password || password.length < 4) {
    return { pwned: false, count: 0, skipped: true, error: 'Password too short to check' };
  }

  try {
    const hash = await sha1Hex(password);
    const { prefix, suffix } = splitHashForKAnonymity(hash);

    const response = await fetch(`${HIBP_RANGE_API}${prefix}`, {
      method: 'GET',
      headers: {
        // HIBP demande un User-Agent pour les stats
        'User-Agent': 'JurisLink-Password-Check/1.0',
        // Indique à HIBP qu'on veut le format original (pas padded)
        'Add-Padding': '0',
      },
      // 5 secondes max — ne bloque pas l'UI trop longtemps
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // Rate limit (429) ou erreur serveur — skip gracieusement
      return {
        pwned: false,
        count: 0,
        skipped: true,
        error: `HIBP API returned ${response.status}`,
      };
    }

    const body = await response.text();
    const count = parseHibpResponse(body, suffix);

    return {
      pwned: count > 0,
      count,
      skipped: false,
    };
  } catch (err) {
    // Offline, DNS failure, timeout — skip gracieusement
    return {
      pwned: false,
      count: 0,
      skipped: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Version synchrone "best effort": retourne le résultat d'un check pré-exécuté
 * ou null si pas encore disponible. Utile pour les formulaires qui veulent
 * afficher un warning immédiat puis se rafraîchir quand le check async termine.
 */
export interface CachedBreachCheck {
  password: string;
  result: BreachCheckResult;
  timestamp: number;
}

const cache = new Map<string, CachedBreachCheck>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — le password est peut-être changé depuis

/**
 * Vérifie un password avec cache (mémoire, TTL 5 min).
 * Le cache n'utilise PAS le password en clair comme clé mais son SHA1 (k-anon).
 *
 * @param password - Password à vérifier
 * @returns BreachCheckResult (depuis cache ou fresh)
 */
export async function checkPasswordBreachCached(password: string): Promise<BreachCheckResult> {
  // Clé de cache: SHA1 du password (pas le password en clair)
  let cacheKey: string;
  try {
    cacheKey = await sha1Hex(password);
  } catch {
    cacheKey = 'fallback-' + password.length;
  }

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const result = await checkPasswordBreach(password);
  cache.set(cacheKey, { password: '', result, timestamp: Date.now() });
  return result;
}

/**
 * Vide le cache (utile pour tests ou logout).
 */
export function clearBreachCache(): void {
  cache.clear();
}

// Export pour les tests internes
export const __test__ = {
  sha1Hex,
  splitHashForKAnonymity,
  parseHibpResponse,
  HIBP_RANGE_API,
  CACHE_TTL_MS,
  _cache: cache,
};
