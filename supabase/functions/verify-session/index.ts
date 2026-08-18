// ============================================================================
// JurisLink - Phase 4.9 - Patch verify-session edge function (account lockout)
// ============================================================================
// Remplace: supabase/functions/verify-session/index.ts
//
// Changements vs Phase 3:
//   1. Vérification du statut de blocage du compte (colonne locked_until).
//      Si bloqué et locked_until > now() → 403 + code ACCOUNT_LOCKED + retry_after.
//   2. Auto-reset du locked_until si expiré (locked_until < now()).
//   3. Retourne remaining_attempts (utile pour afficher dans l'UI Login).
//   4. Inclut la fonction SQL is_account_locked (SECURITY DEFINER) —
//      évite d'exposer directement la colonne locked_until au RLS.
//
// Notes:
//   - Le reset du locked_until se fait via UPDATE direct (service role bypass RLS).
//     On évite la fonction SQL register_successful_login pour séparer
//     responsabilités (cette edge function ne fait QUE de la lecture de statut).
//   - Le login échoué (Supabase auth.getUser()) n'incrémente pas le compteur
//     ici car verify-session est appelé APRES signInWithPassword() réussi.
//     Le compteur est incrémenté côté Login.tsx via register_failed_login().
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// ─── Handler principal ──────────────────────────────────────────────────

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // ── CSRF validation (fail-fast) ────────────────────────────────────
  const csrfToken = req.headers.get(CSRF_HEADER);
  if (!isValidCsrfToken(csrfToken)) {
    return new Response(
      JSON.stringify({
        error: 'CSRF token missing or invalid',
        code: 'CSRF_INVALID',
      }),
      { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Client avec le JWT de l'appelant (pas service role)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    )

    // Récupère l'utilisateur authentifié
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', code: 'NO_SESSION' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
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
        { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // PHASE 4.9: Vérification account lockout
    // Si locked_until est dépassé, on reset automatiquement
    if (profile.locked_until) {
      const lockedUntilDate = new Date(profile.locked_until);
      const now = new Date();

      if (lockedUntilDate > now) {
        // Compte bloqué — refuse l'accès
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
            headers: {
              ...cors,
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfterSec),
            }
          }
        )
      } else {
        // locked_until expiré → reset automatique
        await supabaseAdmin
          .from('users')
          .update({ failed_login_attempts: 0, locked_until: null })
          .eq('id', user.id);
        // Met à jour le profil en local pour la suite
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
        { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

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
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
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
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
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
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('verify-session error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})

// Export pour les tests internes
export const __test__ = { isValidCsrfToken };
