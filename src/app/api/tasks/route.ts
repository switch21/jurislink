import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('task', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const userId = searchParams.get('userId')
    const caseId = searchParams.get('caseId')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)
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

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const countWhere: Record<string, unknown> = {}
    enforceTenantIsolation(auth, countWhere)
    const [data, total, completed] = await Promise.all([
      db.task.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true } },
          case: { select: { id: true, reference: true, title: true } },
          event: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.task.count({ where }),
      db.task.count({ where: { ...countWhere, status: 'terminee' } }),
    ])

    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit), _count: { completed } })
  } catch (error) {
    console.error('List tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('task', async (request, auth) => {
  try {
    const body = await request.json()
    const { title, description, priority, dueDate, userId, caseId, eventId } = body

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const task = await db.task.create({
      data: {
        title,
        tenantId: auth.tenantId!,
        description: description ?? null,
        priority: priority ?? 'normal',
        status: 'a_faire',
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: userId ?? null,
        caseId: caseId ?? null,
        eventId: eventId ?? null,
        creatorId: auth.userId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
        event: { select: { id: true, title: true } },
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'TASK_CREATED', resourceType: 'task', resourceId: task.id, metadata: { title: task.title } })
    }
    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
