import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
    }

    const where = { tenantId }

    const [totalCases, activeCases, totalClients, unpaidInvoices, paidInvoices] =
      await Promise.all([
        db.case.count({ where }),
        db.case.count({
          where: {
            ...where,
            status: { in: ['nouveau', 'ouvert', 'en_cours', 'en_attente'] },
          },
        }),
        db.client.count({ where }),
        db.invoice.count({ where: { ...where, status: 'non_paye' } }),
        db.invoice.count({ where: { ...where, status: 'paye' } }),
      ])

    const revenueResult = await db.invoice.aggregate({
      where: { ...where, status: 'paye' },
      _sum: { amount: true },
    })
    const totalRevenue = revenueResult._sum.amount ?? 0

    const upcomingEvents = await db.event.findMany({
      where: {
        ...where,
        startTime: { gte: new Date() },
      },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        case: { select: { id: true, reference: true, title: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    })

    const casesByStatusRaw = await db.case.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    })
    const casesByStatus: Record<string, number> = {}
    for (const item of casesByStatusRaw) {
      casesByStatus[item.status] = item._count.status
    }

    const casesByTypeRaw = await db.case.groupBy({
      by: ['type'],
      where,
      _count: { type: true },
    })
    const casesByType: Record<string, number> = {}
    for (const item of casesByTypeRaw) {
      casesByType[item.type] = item._count.type
    }

    const recentActivity = await db.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      totalCases,
      activeCases,
      totalClients,
      upcomingEvents: upcomingEvents.length,
      unpaidInvoices,
      totalRevenue,
      paidInvoices,
      casesByStatus,
      casesByType,
      recentActivity,
      upcomingEventsList: upcomingEvents,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
