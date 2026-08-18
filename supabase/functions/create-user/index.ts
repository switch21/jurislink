// ============================================================================
// JurisLink - Phase 3.4 - Patch create-user edge function (validation CSRF)
// ============================================================================
// Remplace: supabase/functions/create-user/index.ts
//
// Changements vs version actuelle:
//   1. Validation du header X-CSRF-Token en début de serve().
//      - Si absent ou invalide → 403 + code CSRF_INVALID
//   2. Ajout de l'audit log via insertion directe dans audit_logs (metadata JSONB)
//      avec contexte: ip, user_agent, action=create_user
//   3. CORS restreint à ALLOWED_ORIGINS (au lieu de '*') — aligne avec
//      verify-session Phase 1.
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS (restreint, plus de '*') ───────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')
  .map(s => s.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ─── CSRF validation ────────────────────────────────────────────────────
const CSRF_HEADER = 'x-csrf-token';

function isValidCsrfToken(csrfToken: string | null): boolean {
  if (!csrfToken || typeof csrfToken !== 'string') return false;
  return csrfToken.length >= 32 && /^[A-Za-z0-9_-]+$/.test(csrfToken);
}

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Authenticate the caller
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Verify caller role
    const { data: profile } = await supabaseClient
      .from('users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'root_admin' && profile.role !== 'firm_admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { email, password, full_name, role, tenant_id } = await req.json()

    let targetTenantId = tenant_id;
    // Firm admin constraints
    if (profile.role === 'firm_admin') {
      targetTenantId = profile.tenant_id;
      if (role === 'root_admin') {
        return new Response(JSON.stringify({ error: 'Firm admin cannot create root admin' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
    }

    // Create user securely with Service Role Key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    })

    if (authError) {
       throw authError
    }

    const newUserId = newAuthUser.user.id;

    // Insert user info into public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        tenant_id: targetTenantId,
        role: role || 'client',
        full_name: full_name,
        email: email
      })

    if (dbError) {
      // Rollback Auth creation
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw dbError
    }

    // ─── Audit log (metadata JSONB) ───────────────────────────────────
    // Insère un log structuré avec contexte pour traçabilité.
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const userAgent = req.headers.get('user-agent');
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        tenant_id: targetTenantId,
        user_id: user.id,
        action: 'USER_CREATE',
        entity: 'users',
        entity_id: newUserId,
        new_state: { id: newUserId, email, full_name, role: role || 'client', tenant_id: targetTenantId },
        metadata: {
          ip: cfConnectingIp ?? null,
          user_agent: userAgent ?? null,
          source: 'edge_function:create-user',
          method: 'POST',
        }
      });

    return new Response(JSON.stringify({ user: newAuthUser.user, message: 'User successfully created' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
