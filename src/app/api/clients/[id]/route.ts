import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('client', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const client = await db.client.findUnique({
      where: { id },
      include: { _count: { select: { cases: true, invoices: true } }, tenant: true },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json(client)
  } catch (error) {
    console.error('Get client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('client', async (request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const client = await db.client.update({
      where: { id },
      data: {
        firstName: body.firstName, lastName: body.lastName, company: body.company,
        clientType: body.clientType, niu: body.niu, email: body.email, phone: body.phone,
        address: body.address, city: body.city, country: body.country, notes: body.notes,
        riskLevel: body.riskLevel, source: body.source, isActive: body.isActive,
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'CLIENT_UPDATED', resourceType: 'client', resourceId: id })
    }
    return NextResponse.json(client)
  } catch (error) {
    console.error('Update client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('client', async (_request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    await db.client.delete({ where: { id } })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'CLIENT_DELETED', resourceType: 'client', resourceId: id })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
