import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Payment model removed (OOM constraint). Returns empty data.
// Payment info is tracked via Invoice.paidAmount field.

export async function GET() {
  try {
    return NextResponse.json({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 })
  } catch (error) {
    console.error('List payments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { invoiceId, amount } = body

    if (!invoiceId || !amount) {
      return NextResponse.json({ error: 'invoiceId and amount required' }, { status: 400 })
    }

    // Update invoice paid amount directly
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const newPaid = Math.min((invoice.paidAmount || 0) + Number(amount), invoice.amount)
    const newStatus = newPaid >= invoice.amount ? 'paye' : newPaid > 0 ? 'partiel' : 'non_paye'

    await db.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status: newStatus, paidDate: newStatus === 'paye' ? new Date() : invoice.paidDate },
    })

    return NextResponse.json({ ok: true, paidAmount: newPaid, status: newStatus }, { status: 201 })
  } catch (error) {
    console.error('Create payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
