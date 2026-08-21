import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('task', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const task = await db.task.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
        event: { select: { id: true, title: true } },
      },
    })
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    return NextResponse.json(task)
  } catch (error) {
    console.error('Get task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('task', async (request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.userId !== undefined) updateData.userId = body.userId ?? null
    if (body.caseId !== undefined) updateData.caseId = body.caseId ?? null
    if (body.eventId !== undefined) updateData.eventId = body.eventId ?? null
    if (body.status !== undefined) {
      updateData.status = body.status
      updateData.completedAt = body.status === 'terminee' ? new Date() : null
    }

    const task = await db.task.update({
      where: { id }, data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
        event: { select: { id: true, title: true } },
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'TASK_UPDATED', resourceType: 'task', resourceId: id })
    }
    return NextResponse.json(task)
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('task', async (_request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    await db.task.delete({ where: { id } })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'TASK_DELETED', resourceType: 'task', resourceId: id })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
