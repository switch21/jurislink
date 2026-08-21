import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
    }

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

    const where = { tenantId }

    // === CA (Chiffre d'Affaires) — sum of paid invoices ===
    const [caThisMonthRaw, caLastMonthRaw] = await Promise.all([
      db.invoice.aggregate({
        where: {
          ...where,
          status: 'paye',
          paidDate: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      }),
      db.invoice.aggregate({
        where: {
          ...where,
          status: 'paye',
          paidDate: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
    ])
    const caThisMonth = caThisMonthRaw._sum.amount ?? 0
    const caLastMonth = caLastMonthRaw._sum.amount ?? 0

    // === Encaissé — sum of validated payments ===
    const [encaisseThisMonthRaw, encaisseLastMonthRaw] = await Promise.all([
      db.payment.aggregate({
        where: {
          ...where,
          status: 'valide',
          receivedAt: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      }),
      db.payment.aggregate({
        where: {
          ...where,
          status: 'valide',
          receivedAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
    ])
    const encaisseThisMonth = encaisseThisMonthRaw._sum.amount ?? 0
    const encaisseLastMonth = encaisseLastMonthRaw._sum.amount ?? 0

    // === À recouvrer — unpaid + partial invoices minus their paid amounts ===
    const unpaidInvoices = await db.invoice.findMany({
      where: { ...where, status: { in: ['non_paye', 'partiel'] } },
      select: { amount: true, paidAmount: true, currencyCode: true },
    })
    let aRecouvrer = 0
    for (const inv of unpaidInvoices) {
      aRecouvrer += inv.amount - (inv.paidAmount ?? 0)
    }

    // === Top clients by payment volume ===
    const topClientsRaw = await db.payment.groupBy({
      by: ['clientId'],
      where: { ...where, status: 'valide', clientId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    })
    const clientIds = topClientsRaw.map((c) => c.clientId).filter(Boolean) as string[]
    const clients =
      clientIds.length > 0
        ? await db.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, firstName: true, lastName: true, company: true },
          })
        : []
    const clientMap = new Map(clients.map((c) => [c.id, c]))
    const topClients = topClientsRaw
      .map((c) => {
        const cl = clientMap.get(c.clientId!)
        if (!cl) return null
        return {
          clientId: cl.id,
          clientName: `${cl.firstName} ${cl.lastName}${cl.company ? ` (${cl.company})` : ''}`,
          totalPaid: c._sum.amount ?? 0,
        }
      })
      .filter(Boolean)

    // === Monthly revenue for last 6 months ===
    const monthlyRevenue: Array<{ month: string; amount: number }> = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
      const monthLabel = monthStart.toLocaleDateString('fr-FR', {
        month: 'short',
        year: '2-digit',
      })

      const result = await db.invoice.aggregate({
        where: {
          ...where,
          status: 'paye',
          paidDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      })
      monthlyRevenue.push({
        month: monthLabel,
        amount: result._sum.amount ?? 0,
      })
    }

    // === Payment method breakdown ===
    const methodBreakdownRaw = await db.payment.groupBy({
      by: ['method'],
      where: { ...where, status: 'valide' },
      _sum: { amount: true },
      _count: { id: true },
    })
    const methodLabels: Record<string, string> = {
      especes: 'Espèces',
      virement: 'Virement',
      mobile_money: 'Mobile Money',
      carte: 'Carte bancaire',
    }
    const methodBreakdown = methodBreakdownRaw.map((m) => ({
      method: m.method,
      label: methodLabels[m.method] || m.method,
      total: m._sum.amount ?? 0,
      count: m._count.id,
    }))

    return NextResponse.json({
      caThisMonth,
      caLastMonth,
      encaisseThisMonth,
      encaisseLastMonth,
      aRecouvrer,
      topClients,
      monthlyRevenue,
      methodBreakdown,
    })
  } catch (error) {
    console.error('Financial dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
