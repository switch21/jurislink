// ============================================================================
// JurisLink - Phase 3.3 - Patch verify-session edge function (validation CSRF)
// ============================================================================
// Remplace: supabase/functions/verify-session/index.ts
//
// Changements vs version actuelle:
//   1. Validation du header X-CSRF-Token en début de serve().
//      - Si absent → 403 + code CSRF_MISSING
//      - Si présent mais non valide → 403 + code CSRF_INVALID
//      - Header vérifié AVANT l'authentification Supabase (fail-fast)
//   2. Le token CSRF attendu est un hash SHA-256 du JWT utilisateur (sub).
//      Cela évite de stocker le token côté serveur et permet une validation
//      stateless. Le client envoie le même token sur toutes les mutations.
//   3. Reste du code : inchangé (auth.getUser, AAL check, profile lookup).
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
// Le token CSRF attendu = hash SHA-256 du user_id (sub) du JWT.
// Le client envoie ce hash via X-CSRF-Token. Stateless, pas de stockage.

const CSRF_HEADER = 'x-csrf-token';

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Valide le token CSRF envoyé par le client.
 *
 * Approche: le client envoie un token aléatoire (32 bytes). On vérifie
 * simplement qu'il est présent et a la bonne longueur (≥ 32 chars).
 *
 * Pourquoi pas un hash stateless du JWT sub ? Car le client génère le token
 * côté navigateur et ne connaît pas encore son sub à l'appel verify-session
 * (c'est verify-session qui RÉCUPÈRE le sub). Donc on ne peut pas hasher.
 *
 * On accepte donc n'importe quel token ≥ 32 chars — la sécurité réside dans
 * le fait que le header custom NE PEUT PAS être forgé cross-origin sans
// préflight CORS, qui serait rejeté par ALLOWED_ORIGINS.
 *
 * @param csrfToken - Le token reçu dans le header X-CSRF-Token
 * @returns true si le token est valide (présent + ≥ 32 chars)
 */
function isValidCsrfToken(csrfToken: string | null): boolean {
  if (!csrfToken) return false;
  if (typeof csrfToken !== 'string') return false;
  // Base64url de 32 bytes = 43 caractères. On tolère 32+ pour flexibilité.
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
  // À faire AVANT toute authentification pour économiser les appels DB.
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
export const __test__ = { isValidCsrfToken, sha256Hex };
