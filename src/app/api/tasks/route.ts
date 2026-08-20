import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const userId = searchParams.get('userId')
    const caseId = searchParams.get('caseId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (status) where.status = status
    if (priority) where.priority = priority
    if (userId) where.userId = userId
    if (caseId) where.caseId = caseId
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const tasks = await db.task.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Completed vs total count for dashboard
    const countWhere: Record<string, unknown> = {}
    if (tenantId) countWhere.tenantId = tenantId

    const [total, completed] = await Promise.all([
      db.task.count({ where: countWhere }),
      db.task.count({ where: { ...countWhere, status: 'terminee' } }),
    ])

    return NextResponse.json({ tasks, _count: { total, completed } })
  } catch (error) {
    console.error('List tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, tenantId, description, priority, dueDate, userId, caseId, eventId, creatorId } = body

    if (!title || !tenantId) {
      return NextResponse.json({ error: 'title and tenantId are required' }, { status: 400 })
    }

    const task = await db.task.create({
      data: {
        title,
        tenantId,
        description: description ?? null,
        priority: priority ?? 'normal',
        status: 'a_faire',
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: userId ?? null,
        caseId: caseId ?? null,
        eventId: eventId ?? null,
        creatorId: creatorId ?? null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
        event: { select: { id: true, title: true } },
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
