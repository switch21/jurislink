import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('user', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)
    if (role) where.role = role

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const [data, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, role: true, avatarUrl: true, phone: true,
          preferredLanguage: true, isActive: true, lastLoginAt: true, mfaEnabled: true,
          createdAt: true, updatedAt: true, tenantId: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ])
    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('user', async (request, auth) => {
  try {
    const body = await request.json()
    const hashedPassword = body.password ? await bcrypt.hash(body.password, 10) : null

    const user = await db.user.create({
      data: {
        email: body.email, name: body.name, password: hashedPassword, role: body.role,
        avatarUrl: body.avatarUrl, phone: body.phone, preferredLanguage: body.preferredLanguage,
        isActive: body.isActive ?? true, tenantId: auth.tenantId ?? body.tenantId,
      },
      select: {
        id: true, email: true, name: true, role: true, avatarUrl: true, phone: true,
        preferredLanguage: true, isActive: true, createdAt: true, updatedAt: true, tenantId: true,
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'USER_CREATED', resourceType: 'user', resourceId: user.id, metadata: { name: user.name, email: user.email } })
    }
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
