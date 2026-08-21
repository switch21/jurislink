import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('event', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const event = await db.event.findUnique({
      where: { id },
      include: {
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        case: { select: { id: true, reference: true, title: true } }, tenant: true,
      },
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('Get event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('event', async (request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const event = await db.event.update({
      where: { id },
      data: {
        title: body.title, description: body.description,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : null,
        eventType: body.eventType, criticality: body.criticality, location: body.location,
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'EVENT_UPDATED', resourceType: 'event', resourceId: id })
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('Update event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('event', async (_request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    await db.event.delete({ where: { id } })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'EVENT_DELETED', resourceType: 'event', resourceId: id })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
