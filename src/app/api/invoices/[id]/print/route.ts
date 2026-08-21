import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        case: { select: { id: true, reference: true, title: true } },
        tenant: true,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const TVA_RATE = 0.1925 // 19.25% TVA Cameroun

    // Parse notes as line items (format: "description | amount" per line)
    // If no pipe separator, treat the whole notes as a single line item
    const notesText = invoice.notes || ''
    let lineItems: Array<{ description: string; amount: number }> = []

    if (notesText.trim()) {
      const lines = notesText.split('\n').filter((l) => l.trim())
      for (const line of lines) {
        if (line.includes('|')) {
          const parts = line.split('|')
          const desc = (parts[0] || '').trim()
          const amount = parseFloat((parts[1] || '0').trim())
          if (desc && !isNaN(amount) && amount > 0) {
            lineItems.push({ description: desc, amount })
          }
        } else {
          lineItems.push({ description: line.trim(), amount: 0 })
        }
      }
    }

    // If no parseable line items, use invoice amount as single line
    if (lineItems.length === 0) {
      lineItems = [{ description: `Facture ${invoice.reference}`, amount: invoice.amount }]
    }

    // Determine the amounts
    const hasLineItemAmounts = lineItems.some((item) => item.amount > 0)
    let htTotal: number
    let tvaAmount: number
    let ttcTotal: number

    if (hasLineItemAmounts) {
      htTotal = lineItems.reduce((sum, item) => sum + (item.amount > 0 ? item.amount : 0), 0)
      tvaAmount = Math.round(htTotal * TVA_RATE * 100) / 100
      ttcTotal = Math.round((htTotal + tvaAmount) * 100) / 100
    } else {
      // Invoice amount is TTC, calculate HT and TVA
      ttcTotal = invoice.amount
      htTotal = Math.round((invoice.amount / (1 + TVA_RATE)) * 100) / 100
      tvaAmount = Math.round(ttcTotal - htTotal * 100) / 100
    }

    const clientFullName = `${invoice.client.firstName} ${invoice.client.lastName}`

    const printData = {
      // Tenant / Firm info
      firm: {
        name: invoice.tenant.name,
        address: invoice.tenant.address || '',
        phone: invoice.tenant.phone || '',
        email: invoice.tenant.email || '',
      },
      // Client info
      client: {
        name: clientFullName,
        company: invoice.client.company || null,
        address: invoice.client.address || '',
        city: invoice.client.city || '',
        country: invoice.client.country || '',
        niu: invoice.client.niu || null,
        email: invoice.client.email || '',
        phone: invoice.client.phone || '',
      },
      // Invoice details
      invoice: {
        id: invoice.id,
        reference: invoice.reference,
        type: invoice.type,
        status: invoice.status,
        currencyCode: invoice.currencyCode,
        createdAt: invoice.createdAt,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        caseReference: invoice.case?.reference || null,
        caseTitle: invoice.case?.title || null,
      },
      // Line items
      lineItems: lineItems.map((item, index) => ({
        index: index + 1,
        description: item.description,
        amount: hasLineItemAmounts ? item.amount : invoice.amount,
      })),
      // Tax calculations
      tax: {
        htTotal,
        tvaRate: TVA_RATE,
        tvaRatePercent: '19.25%',
        tvaAmount,
        ttcTotal,
      },
      // Payment info
      payment: {
        paidAmount: invoice.paidAmount ?? 0,
        remainingAmount: Math.max(0, invoice.amount - (invoice.paidAmount ?? 0)),
        status: invoice.status,
      },
    }

    return NextResponse.json(printData)
  } catch (error) {
    console.error('Print invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
