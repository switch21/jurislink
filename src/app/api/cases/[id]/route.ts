import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('case', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const caze = await db.case.findUnique({
      where: { id },
      include: {
        client: true,
        tenant: true,
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        notes: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        events: {
          include: { assignments: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { startTime: 'desc' },
        },
      },
    })
    if (!caze) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }
    return NextResponse.json(caze)
  } catch (error) {
    console.error('Get case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('case', async (request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const caze = await db.case.update({
      where: { id },
      data: {
        reference: body.reference,
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        outcome: body.outcome,
        paymentStatus: body.paymentStatus,
        priority: body.priority,
        isSecret: body.isSecret,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
        closingDate: body.closingDate ? new Date(body.closingDate) : null,
        archivableAfter: body.archivableAfter ? new Date(body.archivableAfter) : null,
        niu: body.niu,
        adversary: body.adversary,
        jurisdiction: body.jurisdiction,
        amountInDispute: body.amountInDispute,
        billingType: body.billingType,
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'CASE_UPDATED', resourceType: 'case', resourceId: id })
    }
    return NextResponse.json(caze)
  } catch (error) {
    console.error('Update case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('case', async (_request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    await db.case.delete({ where: { id } })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'CASE_DELETED', resourceType: 'case', resourceId: id })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
