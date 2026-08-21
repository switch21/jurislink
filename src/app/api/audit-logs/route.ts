import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'

export const GET = withPermission('audit', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resourceType')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)
    if (userId) where.userId = userId
    if (action) where.action = action
    if (resourceType) where.resourceType = resourceType

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ])
    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('List audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('audit', async (request, auth) => {
  try {
    const body = await request.json()
    const auditLog = await db.auditLog.create({
      data: {
        action: body.action, resourceType: body.resourceType, resourceId: body.resourceId,
        metadata: body.metadata, ipAddress: body.ipAddress, userAgent: body.userAgent,
        tenantId: auth.tenantId ?? body.tenantId, userId: auth.userId,
      },
    })
    return NextResponse.json(auditLog, { status: 201 })
  } catch (error) {
    console.error('Create audit log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}, 'view')
