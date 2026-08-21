import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { withPermission } from '@/lib/rbac'

export const GET = withPermission('user', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true, avatarUrl: true, phone: true,
        preferredLanguage: true, isActive: true, failedLoginAttempts: true, lockedUntil: true,
        lastLoginAt: true, mfaEnabled: true, createdAt: true, updatedAt: true, tenantId: true,
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json(user)
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('user', async (request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {
      email: body.email, name: body.name, role: body.role, avatarUrl: body.avatarUrl,
      phone: body.phone, preferredLanguage: body.preferredLanguage, isActive: body.isActive, mfaEnabled: body.mfaEnabled,
    }
    if (body.password) data.password = await bcrypt.hash(body.password, 10)
    const user = await db.user.update({
      where: { id }, data,
      select: {
        id: true, email: true, name: true, role: true, avatarUrl: true, phone: true,
        preferredLanguage: true, isActive: true, failedLoginAttempts: true, lockedUntil: true,
        lastLoginAt: true, mfaEnabled: true, createdAt: true, updatedAt: true, tenantId: true,
      },
    })
    return NextResponse.json(user)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('user', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    await db.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
