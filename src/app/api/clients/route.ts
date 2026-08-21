import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('client', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)
    if (status === 'active') where.isActive = true
    if (status === 'inactive') where.isActive = false
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const [data, total] = await Promise.all([
      db.client.findMany({
        where,
        include: { _count: { select: { cases: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.client.count({ where }),
    ])
    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('List clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('client', async (request, auth) => {
  try {
    const body = await request.json()
    const client = await db.client.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        company: body.company,
        clientType: body.clientType,
        niu: body.niu,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        country: body.country,
        notes: body.notes,
        riskLevel: body.riskLevel,
        source: body.source,
        isActive: body.isActive ?? true,
        tenantId: auth.tenantId ?? body.tenantId,
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'CLIENT_CREATED', resourceType: 'client', resourceId: client.id, metadata: { name: `${client.firstName} ${client.lastName}`, company: client.company } })
    }
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
