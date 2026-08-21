import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'

export const GET = withPermission('event', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)

    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const startDate = new Date(year, mon - 1, 1)
      const endDate = new Date(year, mon, 0, 23, 59, 59, 999)
      where.startTime = { gte: startDate, lte: endDate }
    }
    if (userId) {
      where.assignments = { some: { userId } }
    }

    const events = await db.event.findMany({
      where,
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        case: { select: { id: true, reference: true, title: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 200,
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error('List events error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('event', async (request, auth) => {
  try {
    const body = await request.json()
    const event = await db.event.create({
      data: {
        title: body.title, description: body.description,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : null,
        eventType: body.eventType, criticality: body.criticality, location: body.location,
        tenantId: auth.tenantId ?? body.tenantId, caseId: body.caseId,
      },
    })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
