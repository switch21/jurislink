import { NextResponse } from 'next/server'
import { supabase, supabaseAuth } from '@/lib/supabase'
import { mapUser, mapTenant } from '@/lib/transform'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Step 1: Authenticate via Supabase Auth
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 })
    }

    const authUserId = authData.user.id

    // Step 2: Get full profile from public.users with tenant
    const { data: profile, error: profErr } = await supabase
      .from('users')
      .select('*, tenant:tenants(*)')
      .eq('id', authUserId)
      .single()

    if (profErr || !profile) {
      return NextResponse.json({ error: 'Profil utilisateur non trouvé' }, { status: 401 })
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Compte désactivé' }, { status: 401 })
    }

    const tenant = profile.tenant
    if (tenant && !tenant.is_active) {
      return NextResponse.json({ error: 'Cabinet désactivé' }, { status: 401 })
    }

    // Step 3: Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', authUserId)

    const user = mapUser(profile)
    user.tenant = tenant ? mapTenant(tenant) : null

    // Include the session tokens for frontend use
    return NextResponse.json({
      ...user,
      accessToken: authData.session?.access_token,
      refreshToken: authData.session?.refresh_token,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
