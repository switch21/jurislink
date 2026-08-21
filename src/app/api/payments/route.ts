import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const invoiceId = searchParams.get('invoiceId')
    const clientId = searchParams.get('clientId')
    const method = searchParams.get('method')
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (invoiceId) where.invoiceId = invoiceId
    if (clientId) where.clientId = clientId
    if (method) where.method = method
    if (status) where.status = status

    if (from || to) {
      const dateFilter: Record<string, unknown> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)
      where.receivedAt = dateFilter
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        invoice: {
          select: { id: true, reference: true, amount: true, status: true, currencyCode: true },
        },
        client: { select: { id: true, firstName: true, lastName: true, company: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { receivedAt: 'desc' },
      take: 200,
    })

    // If there are payments with validatedBy, fetch the validator users
    const validatorIds = payments
      .map((p) => p.validatedBy)
      .filter((id): id is string => id !== null)
    const validators =
      validatorIds.length > 0
        ? await db.user.findMany({
            where: { id: { in: validatorIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const validatorMap = new Map(validators.map((v) => [v.id, v]))

    const enriched = payments.map((p) => ({
      ...p,
      validatedByUser: p.validatedBy ? validatorMap.get(p.validatedBy) ?? null : null,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('List payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      tenantId,
      invoiceId,
      clientId,
      amount,
      method,
      status,
      reference,
      notes,
      receivedAt,
      userId,
      validatedBy,
    } = body

    if (!tenantId || !amount || !method) {
      return NextResponse.json(
        { error: 'tenantId, amount, and method are required' },
        { status: 400 }
      )
    }

    const payment = await db.payment.create({
      data: {
        tenantId,
        invoiceId: invoiceId ?? null,
        clientId: clientId ?? null,
        amount: parseFloat(amount),
        method,
        status: status ?? 'en_attente',
        reference: reference ?? null,
        notes: notes ?? null,
        receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
        userId: userId ?? null,
        validatedBy: validatedBy ?? null,
      },
    })

    // Auto-update invoice if linked and payment is validated
    if (invoiceId && (status === 'valide' || !status)) {
      const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
      if (invoice) {
        const currentPaid = invoice.paidAmount ?? 0
        const newPaid = currentPaid + parseFloat(amount)
        let newStatus = invoice.status

        if (newPaid >= invoice.amount) {
          newStatus = 'paye'
        } else if (newPaid > 0) {
          newStatus = 'partiel'
        }

        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaid,
            status: newStatus,
            paidDate: newStatus === 'paye' ? new Date() : invoice.paidDate,
          },
        })
      }
    }

    const created = await db.payment.findUnique({
      where: { id: payment.id },
      include: {
        invoice: {
          select: { id: true, reference: true, amount: true, status: true, currencyCode: true },
        },
        client: { select: { id: true, firstName: true, lastName: true, company: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
