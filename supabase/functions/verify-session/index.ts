// ============================================================================
// JurisLink - Phase 1.2 - Edge Function: verify-session
// ============================================================================
// Objectif: Vérification server-side du niveau AAL (Authenticator Assurance
// Level). Empêche le contournement client-side de la MFA identifié dans
// Login.tsx (ligne 68-79) où les non-admins sans facteur TOTP contournent
// la 2FA via handleMfaSuccess().
//
// Déploiement:
//   1. Copier ce fichier vers supabase/functions/verify-session/index.ts
//   2. Supabase Dashboard → Edge Functions → Deploy "verify-session"
//   3. Mettre à jour src/lib/supabase.ts pour appeler cette fonction
//
// Sécurité:
//   - CORS restreint à l'URL du frontend (variables d'env)
//   - Vérification AAL via JWT claim (auth.jwt()->>'aal')
//   - Profil renvoyé uniquement si AAL2 OU utilisateur non-admin sans MFA
//     (mais accès aux données sensibles reste bloqué par RLS RESTRICTIVE)
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS restreint (PLUS de '*' — fix vulnérabilité Phase 3 anticipée)
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')
  .map(s => s.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
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

    // Récupère le profil utilisateur (lecture via service role pour bypass RLS
    // car la fonction elle-même est autorisée)
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
    // (le client doit forcer l'enrôlement MFA puis recharger)
    if (isAdmin && !isAal2) {
      // Vérifie si l'admin a un facteur TOTP enrôlé
      const { data: factors } = await supabaseClient.auth.mfa.listFactors()
      const hasTotp = (factors?.totp ?? []).some(f => f.status === 'verified')

      return new Response(
        JSON.stringify({
          user: { id: user.id, email: user.email },
          profile: null, // Profil bloqué tant que AAL2 non atteint
          requiresMfa: true,
          mfaAction: hasTotp ? 'challenge' : 'setup',
          aal: aal,
        }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Non-admin SANS MFA: on renvoie le profil MAIS le RLS RESTRICTIVE bloquera
    // les tables sensibles. Le client doit proposer l'enrôlement MFA mais ne
    // peut pas forcer (UX, pas sécurité).
    if (!isAdmin && !isAal2) {
      const { data: factors } = await supabaseClient.auth.mfa.listFactors()
      const hasTotp = (factors?.totp ?? []).some(f => f.status === 'verified')

      return new Response(
        JSON.stringify({
          user: { id: user.id, email: user.email },
          profile: profile,
          requiresMfa: !hasTotp, // recommande l'enrôlement si pas de facteur
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
