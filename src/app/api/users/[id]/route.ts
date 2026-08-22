import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapUser } from '@/lib/transform'
import bcrypt from 'bcryptjs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = mapUser(data)
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    user.lastLoginAt = null
    user.mfaEnabled = false
    return NextResponse.json(user)
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, any> = {}
    if (body.email !== undefined) updateData.email = body.email
    if (body.name !== undefined) updateData.full_name = body.name
    if (body.role !== undefined) updateData.role = body.role
    if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.preferredLanguage !== undefined) updateData.preferred_language = body.preferredLanguage
    if (body.isActive !== undefined) updateData.is_active = body.isActive

    // Update password in auth.users if provided
    if (body.password) {
      const hashed = await bcrypt.hash(body.password, 10)
      await supabase
        .from('auth.users')
        .update({ encrypted_password: hashed })
        .eq('id', id)
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    const user = mapUser(data)
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    user.lastLoginAt = null
    user.mfaEnabled = false
    return NextResponse.json(user)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await supabase.from('users').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
