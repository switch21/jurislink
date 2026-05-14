import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    return new Response(JSON.stringify({ user: newAuthUser.user, message: 'User successfully created' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
