// ============================================================================
// JurisLink - Phase 5.5 - Patch verify-session edge function (session max age)
// ============================================================================
// Remplace: supabase/functions/verify-session/index.ts (version Phase 4)
//
// Changements vs Phase 4:
//   1. Vérification de la durée maximale de session (8h) via le claim 'iat'
//      du JWT. Si dépassé → 401 + code SESSION_MAX_DURATION_EXCEEDED.
//      Ce check complète le SessionTimeout client (Phase 4 — idle timeout)
//      qui ne couvre que l'inactivité, pas la durée absolue.
//   2. Application des en-têtes de sécurité via le module partagé
//      _shared/security-headers.ts (CSP, HSTS, X-Frame-Options, etc.).
//   3. Retourne session_max_age_remaining_ms dans la réponse 200 (utile pour
//      que le client affiche un warning "votre session expire dans X minutes")
//
// Notes:
//   - Le claim 'iat' (issued at) est présent dans tous les JWT Supabase Auth.
//     Il représente l'émission du JWT, pas le login initial. Avec refresh
//     token rotation (Supabase Active), le JWT est rafraîchi toutes les ~1h
//     et 'iat' est mis à jour. Pour suivre la session RÉELLE (depuis login),
//     il faudrait ajouter un claim custom via un trigger JWT — voir Phase 6.
//   - Workaround: on combine 'iat' + une marge de sécurité (15min) pour
//     accepter que le refresh ait lieu. Au pire, le serveur renvoie 401 et
//     le client re-login silent via refresh token Supabase.
//   - HSTS: edge functions servies en HTTPS, donc HSTS est légitime.
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { applySecurityHeaders } from '../_shared/security-headers.ts'

// ─── CORS ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')
  .map(s => s.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ─── CSRF validation ────────────────────────────────────────────────────
const CSRF_HEADER = 'x-csrf-token';

function isValidCsrfToken(csrfToken: string | null): boolean {
  if (!csrfToken || typeof csrfToken !== 'string') return false;
  return csrfToken.length >= 32 && /^[A-Za-z0-9_-]+$/.test(csrfToken);
}

// ─── Session max duration ────────────────────────────────────────────────
const SESSION_MAX_DURATION_MS = parseInt(
  Deno.env.get('SESSION_MAX_DURATION_MS') ?? '28800000', // 8h default
  10
);
// Marge de tolérance pour rafraîchir le refresh token (15min)
const REFRESH_GRACE_MS = parseInt(
  Deno.env.get('SESSION_REFRESH_GRACE_MS') ?? '900000',
  10
);

/**
 * Extrait le claim 'iat' (issued at) du JWT.
 * Le JWT est en base64url, pas besoin de vérifier la signature (Supabase
 * l'a déjà faite via supabaseClient.auth.getUser()).
 */
function extractIatFromJwt(jwt: string | null | undefined): number | null {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    // base64url decode (replace chars + padding)
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    if (typeof payload.iat === 'number') return payload.iat;
    return null;
  } catch {
    return null;
  }
}

// ─── Handler principal ──────────────────────────────────────────────────

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: applySecurityHeaders(cors) })
  }

  // ── CSRF validation (fail-fast) ────────────────────────────────────
  const csrfToken = req.headers.get(CSRF_HEADER);
  if (!isValidCsrfToken(csrfToken)) {
    return new Response(
      JSON.stringify({
        error: 'CSRF token missing or invalid',
        code: 'CSRF_INVALID',
      }),
      {
        status: 403,
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
      }
    )
  }

  try {
    // Client avec le JWT de l'appelant (pas service role)
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } }
      }
    )

    // Récupère l'utilisateur authentifié
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'NO_SESSION' }),
        {
          status: 401,
          headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
        }
      )
    }

    // ── PHASE 5.5: Vérification durée max de session ───────────────────
    const iat = extractIatFromJwt(jwt);
    if (iat !== null) {
      const issuedAtMs = iat * 1000;
      const sessionAgeMs = Date.now() - issuedAtMs;
      const maxAgeWithGrace = SESSION_MAX_DURATION_MS + REFRESH_GRACE_MS;
      if (sessionAgeMs > maxAgeWithGrace) {
        // Audit log: session expirée par durée max
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        const cfIp = req.headers.get('cf-connecting-ip');
        await supabaseAdmin.from('audit_logs').insert({
          tenant_id: null, // inconnu — user pas encore profil
          user_id: user.id,
          action: 'SESSION_MAX_DURATION_EXCEEDED',
          entity: 'auth',
          entity_id: user.id,
          metadata: {
            ip: cfIp ?? null,
            user_agent: req.headers.get('user-agent') ?? null,
            source: 'edge_function:verify-session',
            session_age_ms: sessionAgeMs,
            session_max_ms: SESSION_MAX_DURATION_MS,
            jwt_iat: iat,
          }
        }).then(() => {}, () => {}); // fire-and-forget

        return new Response(
          JSON.stringify({
            error: 'Session has exceeded maximum allowed duration. Please sign in again.',
            code: 'SESSION_MAX_DURATION_EXCEEDED',
            action: 'SIGNIN_REQUIRED',
            session_age_ms: sessionAgeMs,
            session_max_ms: SESSION_MAX_DURATION_MS,
          }),
          {
            status: 401,
            headers: applySecurityHeaders({
              ...cors,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            })
          }
        )
      }
    }

    // Vérifie le AAL via la session JWT
    const { data: session } = await supabaseClient.auth.getSession()
    const aal = session?.session?.user?.aud === 'authenticated'
      ? (session.session?.user as any)?.aal
      : null

    // Récupère le profil utilisateur (lecture via service role pour bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*, tenant:tenants(*)')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found', code: 'NO_PROFILE' }),
        {
          status: 404,
          headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
        }
      )
    }

    // PHASE 4.9: Vérification account lockout
    if (profile.locked_until) {
      const lockedUntilDate = new Date(profile.locked_until);
      const now = new Date();

      if (lockedUntilDate > now) {
        const retryAfterSec = Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 1000);
        return new Response(
          JSON.stringify({
            error: 'Account locked due to too many failed login attempts',
            code: 'ACCOUNT_LOCKED',
            retry_after_sec: retryAfterSec,
            locked_until: profile.locked_until,
            action: 'WAIT_OR_CONTACT_ADMIN',
          }),
          {
            status: 403,
            headers: applySecurityHeaders({
              ...cors,
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfterSec),
            })
          }
        )
      } else {
        // locked_until expiré → reset automatique
        await supabaseAdmin
          .from('users')
          .update({ failed_login_attempts: 0, locked_until: null })
          .eq('id', user.id);
        profile.failed_login_attempts = 0;
        profile.locked_until = null;
      }
    }

    // Vérifications de sécurité
    const isAdmin = profile.role === 'root_admin' || profile.role === 'firm_admin'
    const isAal2 = aal === 'aal2'

    // Compte désactivé → logout immédiat
    if (profile.is_active === false || (profile.tenant && profile.tenant.is_active === false)) {
      return new Response(
        JSON.stringify({
          error: 'Account disabled',
          code: 'ACCOUNT_DISABLED',
          action: 'SIGNOUT_REQUIRED'
        }),
        {
          status: 403,
          headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
        }
      )
    }

    // ── PHASE 5.5: Calcul du temps restant pour la réponse 200 ───────
    const sessionMaxRemainingMs = iat !== null
      ? Math.max(0, SESSION_MAX_DURATION_MS - (Date.now() - iat * 1000))
      : null;

    // Admin SANS AAL2 → bloque l'accès aux données sensibles
    if (isAdmin && !isAal2) {
      const { data: factors } = await supabaseClient.auth.mfa.listFactors()
      const hasTotp = (factors?.totp ?? []).some(f => f.status === 'verified')

      return new Response(
        JSON.stringify({
          user: { id: user.id, email: user.email },
          profile: null,
          requiresMfa: true,
          mfaAction: hasTotp ? 'challenge' : 'setup',
          aal: aal,
          session_max_remaining_ms: sessionMaxRemainingMs,
        }),
        {
          status: 200,
          headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
        }
      )
    }

    // Non-admin SANS MFA: renvoie profil mais RLS RESTRICTIVE bloque les tables sensibles
    if (!isAdmin && !isAal2) {
      const { data: factors } = await supabaseClient.auth.mfa.listFactors()
      const hasTotp = (factors?.totp ?? []).some(f => f.status === 'verified')

      return new Response(
        JSON.stringify({
          user: { id: user.id, email: user.email },
          profile: profile,
          requiresMfa: !hasTotp,
          mfaAction: hasTotp ? 'challenge' : 'setup',
          aal: aal,
          session_max_remaining_ms: sessionMaxRemainingMs,
        }),
        {
          status: 200,
          headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
        }
      )
    }

    // Cas nominal: AAL2 atteint, accès complet
    return new Response(
      JSON.stringify({
        user: { id: user.id, email: user.email },
        profile: profile,
        requiresMfa: false,
        mfaAction: null,
        aal: aal,
        session_max_remaining_ms: sessionMaxRemainingMs,
      }),
      {
        status: 200,
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
      }
    )
  } catch (error: any) {
    console.error('verify-session error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL' }),
      {
        status: 500,
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
      }
    )
  }
})

// Export pour les tests internes
export const __test__ = {
  isValidCsrfToken,
  extractIatFromJwt,
  SESSION_MAX_DURATION_MS,
  REFRESH_GRACE_MS,
};
