import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'

export const GET = withPermission('setting', async () => {
  try {
    const tenants = await db.tenant.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tenants)
  } catch (error) {
    console.error('List tenants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('setting', async (request) => {
  try {
    const body = await request.json()
    const tenant = await db.tenant.create({
      data: {
        name: body.name, slug: body.slug, logoUrl: body.logoUrl, address: body.address,
        phone: body.phone, email: body.email, plan: body.plan,
        maxUsers: body.maxUsers, maxStorageGb: body.maxStorageGb,
      },
    })
    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    console.error('Create tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
