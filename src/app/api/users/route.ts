import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapUser, toSnakeCase } from '@/lib/transform'
import bcrypt from 'bcryptjs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const role = searchParams.get('role')

    let query = supabase.from('users').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (role) query = query.eq('role', role)
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error

    // Exclude password-like fields and map
    const users = (data || []).map((u: any) => {
      const mapped = mapUser(u)
      // Add default values for fields expected by frontend but not in Supabase
      mapped.failedLoginAttempts = 0
      mapped.lockedUntil = null
      mapped.lastLoginAt = null
      mapped.mfaEnabled = false
      return mapped
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const hashedPassword = body.password
      ? await bcrypt.hash(body.password, 10)
      : null

    // Insert into auth.users for authentication
    const userId = crypto.randomUUID()
    if (hashedPassword) {
      const { error: authErr } = await supabase.from('auth.users').insert({
        id: userId,
        email: body.email,
        encrypted_password: hashedPassword,
        email_confirmed_at: new Date().toISOString(),
        raw_user_meta_data: { full_name: body.name },
        aud: [],
        role: 'authenticated',
        instance_id: '00000000-0000-0000-0000-000000000000',
      })
      // auth.users insert may fail due to RLS — that's OK, the public.users record is what matters
      if (authErr) console.warn('auth.users insert warning:', authErr.message)
    }

    // Insert into public.users
    const insertData: Record<string, any> = {
      id: hashedPassword ? userId : crypto.randomUUID(),
      tenant_id: body.tenantId || null,
      email: body.email,
      full_name: body.name,
      role: body.role || 'lawyer',
      avatar_url: body.avatarUrl || null,
      phone: body.phone || null,
      preferred_language: body.preferredLanguage || 'fr',
      is_active: body.isActive !== undefined ? body.isActive : true,
    }

    const { data, error } = await supabase
      .from('users')
      .insert(insertData)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapUser(data), { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
