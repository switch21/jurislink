// ============================================================================
// JurisLink - Phase 5.1 - CSP + HTTP Security Headers builder
// ============================================================================
// Emplacement: src/lib/securityHeaders.ts (nouveau fichier)
//
// Objectif:
//   Centralise la construction du Content-Security-Policy (CSP) et des autres
//   en-têtes HTTP de sécurité côté client. Utilisé par:
//     - index.html (via <meta http-equiv="Content-Security-Policy">)
//     - Vite dev/preview server (vite.config.ts → server.headers / preview.headers)
//     - Build statique (génère un header CSP à injecter en production via reverse proxy)
//
// Stratégie CSP:
//   - default-src 'self'           — tout vient du même origin par défaut
//   - script-src 'self'            — pas d'inline, pas d'eval (Vite bundles externes)
//   - style-src 'self' 'unsafe-inline' — React inline styles + CSS-in-JS
//   - img-src 'self' data: blob: https: — autorise data URLs (favicon SVG inline)
//                                       + blob: (preview de fichiers uploadés)
//                                       + https: (avatars Supabase storage)
//   - font-src 'self' data:        — fonts inline (Liberation/Inter)
//   - connect-src 'self' <supabase_url> https://api.pwnedpasswords.com
//                                  — autorise Supabase + HIBP API (k-anonymity)
//   - frame-ancestors 'none'      — anti-clickjacking (équivalent X-Frame-Options: DENY)
//   - form-action 'self'          — forms soumis uniquement vers nous
//   - base-uri 'self'             — pas de <base> injection
//   - object-src 'none'           — pas de Flash/Java/PDF embeds
//   - worker-src 'self' blob:     — Vite HMR workers + PWA service worker
//   - manifest-src 'self'         — PWA manifest.json
//   - upgrade-insecure-requests   — force HTTPS en production
//
// Notes:
//   - Le CSP est en mode "enforce" (pas report-only) — un bug X réellement
//     bloqué au lieu d'être juste loggué.
//   - Pas de nonce/hash pour les scripts inline car Vite n'en génère pas
//     (tous les scripts sont en fichiers externes). Si React DevTools doit
//     fonctionner en dev, le mode enforcement peut être désactivé via
//     VITE_DEV_CSP_DISABLED=true (pas de prod).
//   - L'URL Supabase est lue depuis import.meta.env.VITE_SUPABASE_URL.
//     En dev elle est typiquement https://localhost:54321 ou vide.
// ============================================================================

export interface CspOptions {
  /** URL Supabase (https://xxx.supabase.co). Ajoutée à connect-src. */
  supabaseUrl?: string;
  /** Mode développement: autorise ws://localhost:* pour HMR Vite. */
  devMode?: boolean;
  /** Mode CSP report-only (ne bloque pas, logge les violations). */
  reportOnly?: boolean;
  /** URL où envoyer les rapports CSP. */
  reportUri?: string;
}

/**
 * Construit la valeur du header Content-Security-Policy.
 *
 * @param opts - Options de configuration (Supabase URL, dev mode, etc.)
 * @returns La chaîne CSP complète (ex: "default-src 'self'; script-src 'self'; ...")
 */
export function buildCsp(opts: CspOptions = {}): string {
  const supabaseUrl = (opts.supabaseUrl ?? '').trim().replace(/\/$/, '');
  const devMode = opts.devMode ?? false;

  const directives: string[] = [];

  // default-src — fallback pour toutes les directives non spécifiées
  directives.push("default-src 'self'");

  // script-src — PAS d'unsafe-inline ni unsafe-eval
  // En dev, Vite HMR a besoin de 'self' + ws. Pas besoin d'eval.
  directives.push("script-src 'self'");

  // style-src — 'unsafe-inline' nécessaire car React inline styles
  directives.push("style-src 'self' 'unsafe-inline'");

  // img-src — data: pour SVG inline, blob: pour preview fichiers, https: pour storage
  directives.push("img-src 'self' data: blob: https:");

  // font-src
  directives.push("font-src 'self' data:");

  // connect-src — Supabase (REST + Realtime WebSocket) + HIBP API
  const connectSources = ["'self'"];
  if (supabaseUrl) {
    connectSources.push(supabaseUrl);
    // WebSocket Realtime: convertit https:// → wss://
    const wsUrl = supabaseUrl.replace(/^http/, 'ws');
    connectSources.push(wsUrl);
  }
  // HIBP API (k-anonymity password check)
  connectSources.push('https://api.pwnedpasswords.com');
  if (devMode) {
    // Vite HMR en dev
    connectSources.push('ws://localhost:*');
    connectSources.push('ws://127.0.0.1:*');
  }
  directives.push(`connect-src ${connectSources.join(' ')}`);

  // frame-ancestors — anti-clickjacking (DENY équivalent)
  directives.push("frame-ancestors 'none'");

  // form-action — forms soumis vers nous uniquement
  directives.push("form-action 'self'");

  // base-uri — empêche l'injection de <base>
  directives.push("base-uri 'self'");

  // object-src — pas de plugins (Flash/Java/PDF embeds)
  directives.push("object-src 'none'");

  // worker-src — Vite HMR workers + PWA service worker
  directives.push("worker-src 'self' blob:");

  // manifest-src — PWA manifest
  directives.push("manifest-src 'self'");

  // media-src — autorise uniquement les médias locaux (audio/video)
  directives.push("media-src 'self'");

  // upgrade-insecure-requests — force HTTPS en production
  if (!devMode) {
    directives.push('upgrade-insecure-requests');
  }

  // report-uri — destination des rapports CSP (optionnel)
  if (opts.reportUri) {
    directives.push(`report-uri ${opts.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Construit la <meta> HTML complète pour le CSP.
 *
 * @param opts - Options de configuration
 * @returns Le tag <meta> complet (ex: '<meta http-equiv="Content-Security-Policy" content="...">')
 */
export function buildCspMetaTag(opts: CspOptions = {}): string {
  const csp = buildCsp(opts);
  const httpEquiv = opts.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  return `<meta http-equiv="${httpEquiv}" content="${csp.replace(/"/g, '&quot;')}">`;
}

// ─── HTTP Security Headers (hors CSP) ─────────────────────────────────────

export interface SecurityHeaders {
  [key: string]: string;
}

/**
 * Retourne les en-têtes HTTP de sécurité standards (hors CSP) à appliquer
 * sur toutes les réponses HTTP (edge functions + reverse proxy + static hosting).
 *
 * Complète le CSP (qui est construit séparément car dépend de l'environnement).
 */
export function buildSecurityHeaders(opts: { hsts?: boolean } = {}): SecurityHeaders {
  const headers: SecurityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    'X-DNS-Prefetch-Control': 'off',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };

  // HSTS — uniquement en HTTPS production (dev est HTTP, HSTS serait ignoré)
  if (opts.hsts !== false) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  return headers;
}

/**
 * Retourne le set complet d'en-têtes pour le serveur de preview Vite
 * (mode HTTPS local ou déploiement statique via `vite preview`).
 */
export function buildServerHeaders(supabaseUrl?: string): SecurityHeaders {
  return {
    ...buildSecurityHeaders({ hsts: true }),
    'Content-Security-Policy': buildCsp({ supabaseUrl, devMode: false }),
  };
}

// Export pour les tests internes
export const __test__ = {
  buildCsp,
  buildCspMetaTag,
  buildSecurityHeaders,
};
