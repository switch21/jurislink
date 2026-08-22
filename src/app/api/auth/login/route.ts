import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapUser, mapTenant } from '@/lib/transform'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find user in auth.users
    const { data: authUser, error: authErr } = await supabase
      .from('auth.users')
      .select('id, email, encrypted_password, raw_user_meta_data')
      .eq('email', email)
      .single()

    // Fallback: try public.users if auth.users fails (RLS)
    let userId = authUser?.id
    let hashedPw = authUser?.encrypted_password

    if (authErr || !authUser) {
      const { data: pubUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .single()
      if (!pubUser) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      userId = pubUser.id
      // Get password from auth.users by ID
      const { data: authById } = await supabase
        .from('auth.users')
        .select('encrypted_password')
        .eq('id', pubUser.id)
        .single()
      hashedPw = authById?.encrypted_password
    }

    if (!hashedPw) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, hashedPw)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Get full profile from public.users with tenant
    const { data: profile, error: profErr } = await supabase
      .from('users')
      .select('*, tenant:tenants(*)')
      .eq('id', userId)
      .single()

    if (profErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 401 })
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 401 })
    }

    const tenant = profile.tenant
    if (tenant && !tenant.is_active) {
      return NextResponse.json({ error: 'Tenant is deactivated' }, { status: 401 })
    }

    const user = mapUser(profile)
    user.tenant = tenant ? mapTenant(tenant) : null

    return NextResponse.json(user)
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
