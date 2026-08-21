import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function recalcInvoiceStatus(invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  // Sum all validated payments for this invoice
  const paymentsAgg = await db.payment.aggregate({
    where: { invoiceId, status: 'valide' },
    _sum: { amount: true },
  })
  const totalPaid = paymentsAgg._sum.amount ?? 0

  let newStatus = invoice.status
  if (totalPaid >= invoice.amount) {
    newStatus = 'paye'
  } else if (totalPaid > 0) {
    newStatus = 'partiel'
  } else {
    newStatus = 'non_paye'
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: totalPaid,
      status: newStatus,
      paidDate: newStatus === 'paye' ? new Date() : null,
    },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          select: { id: true, reference: true, amount: true, status: true, currencyCode: true },
        },
        client: { select: { id: true, firstName: true, lastName: true, company: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    let validatedByUser = null
    if (payment.validatedBy) {
      const validator = await db.user.findUnique({
        where: { id: payment.validatedBy },
        select: { id: true, name: true, email: true },
      })
      validatedByUser = validator
    }

    return NextResponse.json({ ...payment, validatedByUser })
  } catch (error) {
    console.error('Get payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.payment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount)
    if (body.method !== undefined) updateData.method = body.method
    if (body.status !== undefined) updateData.status = body.status
    if (body.reference !== undefined) updateData.reference = body.reference ?? null
    if (body.notes !== undefined) updateData.notes = body.notes ?? null
    if (body.receivedAt !== undefined) {
      updateData.receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date()
    }
    if (body.clientId !== undefined) updateData.clientId = body.clientId ?? null
    if (body.userId !== undefined) updateData.userId = body.userId ?? null
    if (body.validatedBy !== undefined) {
      updateData.validatedBy = body.validatedBy ?? null
      if (body.validatedBy) {
        updateData.validatedAt = new Date()
      }
    }

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
      include: {
        invoice: {
          select: { id: true, reference: true, amount: true, status: true, currencyCode: true },
        },
        client: { select: { id: true, firstName: true, lastName: true, company: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    // Re-calculate invoice status if invoiceId changed or amount changed
    const needsRecalc =
      (body.invoiceId !== undefined && body.invoiceId !== existing.invoiceId) ||
      body.amount !== undefined ||
      body.status !== undefined

    if (needsRecalc) {
      // If invoiceId changed, recalc old and new invoice
      if (body.invoiceId !== undefined && body.invoiceId !== existing.invoiceId) {
        if (existing.invoiceId) {
          await recalcInvoiceStatus(existing.invoiceId)
        }
      }
      // Always recalc current invoice
      const currentInvoiceId = body.invoiceId !== undefined ? body.invoiceId : existing.invoiceId
      if (currentInvoiceId) {
        await recalcInvoiceStatus(currentInvoiceId)
      }
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Update payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({ where: { id } })
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const invoiceId = payment.invoiceId

    await db.payment.delete({ where: { id } })

    // Re-calculate invoice status after payment removal
    if (invoiceId) {
      await recalcInvoiceStatus(invoiceId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
