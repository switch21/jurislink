import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'

export const GET = withPermission('invoice', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)
    if (status) where.status = status
    if (clientId) where.clientId = clientId

    const invoices = await db.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, firstName: true, lastName: true, company: true } },
        case: { select: { id: true, reference: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(invoices)
  } catch (error) {
    console.error('List invoices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('invoice', async (request, auth) => {
  try {
    const body = await request.json()
    const invoice = await db.invoice.create({
      data: {
        reference: body.reference, amount: body.amount, status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        paidDate: body.paidDate ? new Date(body.paidDate) : null,
        paidAmount: body.paidAmount, notes: body.notes, paymentMethod: body.paymentMethod,
        tenantId: auth.tenantId ?? body.tenantId, clientId: body.clientId,
        caseId: body.caseId, currencyCode: body.currencyCode,
      },
    })
    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
