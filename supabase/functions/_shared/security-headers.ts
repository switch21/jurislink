// ============================================================================
// JurisLink - Phase 5.4 - Shared security headers module (edge functions)
// ============================================================================
// Emplacement: supabase/functions/_shared/security-headers.ts (nouveau fichier)
//
// Objectif:
//   Fournir un module Deno partagé par toutes les edge functions pour
//   appliquer les en-têtes HTTP de sécurité standards de manière cohérente.
//
// Usage:
//   import { applySecurityHeaders } from '../_shared/security-headers.ts'
//   return new Response(JSON.stringify(data), {
//     headers: applySecurityHeaders({ 'Content-Type': 'application/json' }),
//     status: 200,
//   })
//
// Notes:
//   - Edge functions Deno: l'import relative '../_shared/...' fonctionne
//     car Supabase bundle le dossier _shared avec chaque function au deploy.
//   - Le CSP est volontairement très restrictif ('none' partout) car les
//     réponses edge functions sont en JSON (pas de HTML/CSS/JS à charger).
//   - HSTS inclus — Supabase edge functions sont servies en HTTPS.
//   - CORS est GÉRÉ SÉPARÉMENT par chaque edge function (car dépend de
//     ALLOWED_ORIGINS). Ce module NE touche PAS aux en-têtes CORS.
// ============================================================================

export type Headers = Record<string, string>;

/**
 * En-têtes de sécurité standards à appliquer sur toutes les réponses.
 * Ces en-têtes complètent les CORS headers (gérés par chaque function).
 */
export const SECURITY_HEADERS: Headers = {
  // Anti-MIME-sniffing — le navigateur ne devine pas le type
  'X-Content-Type-Options': 'nosniff',

  // Anti-clickjacking — interdit le framing
  'X-Frame-Options': 'DENY',

  // Referrer: envoie uniquement l'origin sur cross-origin
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Désactive les APIs sensibles sur les edge functions (pas besoin de geo/cam)
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',

  // Désactive le prefetch DNS (évite la leak d'hostnames internes)
  'X-DNS-Prefetch-Control': 'off',

  // Isolation: empêche les fenêtres popup cross-origin d'accéder au context
  'Cross-Origin-Opener-Policy': 'same-origin',

  // Ressources: refus de chargement cross-origin (sauf CORS explicite)
  'Cross-Origin-Resource-Policy': 'same-origin',

  // HSTS — force HTTPS pour les 2 prochaines années, avec preload
  // (edge functions servies en HTTPS via Supabase)
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

  // CSP pour les réponses edge functions (JSON only — pas de scripts/styles)
  // 'none' partout = même les réponses JSON ne peuvent pas être utilisées
  // comme source dans un contexte HTML malveillant.
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

/**
 * Applique les en-têtes de sécurité à un set d'en-têtes existant.
 * Les en-têtes passés en paramètre ont PRIORITÉ sur les defaults de sécurité
 * (sauf pour X-Frame-Options et CSP qui sont non-overridable par design).
 *
 * @param extra - En-têtes additionnels (CORS, Content-Type, etc.)
 * @returns Headers mergés avec priorité aux en-têtes de sécurité
 */
export function applySecurityHeaders(extra: Headers = {}): Headers {
  const merged: Headers = { ...SECURITY_HEADERS, ...extra };

  // Force ces en-têtes — pas d'override possible (sécurité absolue)
  merged['X-Frame-Options'] = SECURITY_HEADERS['X-Frame-Options'];
  merged['Content-Security-Policy'] = SECURITY_HEADERS['Content-Security-Policy'];
  merged['X-Content-Type-Options'] = SECURITY_HEADERS['X-Content-Type-Options'];

  return merged;
}

/**
 * Combine CORS headers (calculés par la edge function) avec les en-têtes
 * de sécurité. Helper commodité pour éviter d'avoir à spread 2 fois.
 *
 * @param cors - CORS headers (déjà calculés en fonction de l'Origin)
 * @param extra - En-têtes additionnels (Content-Type, Retry-After, etc.)
 * @returns Headers finales: CORS + security + extra
 */
export function buildResponseHeaders(cors: Headers, extra: Headers = {}): Headers {
  return applySecurityHeaders({ ...cors, ...extra });
}

// Export pour les tests internes
export const __test__ = {
  SECURITY_HEADERS,
  applySecurityHeaders,
  buildResponseHeaders,
};
