import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')

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

    // === Enhanced dashboard data ===

    // Urgencies: cases with nextDueDate within 2 days
    const now = new Date()
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    const urgencies = await db.case.findMany({
      where: {
        ...where,
        nextDueDate: {
          lte: twoDaysFromNow,
          gte: now,
        },
        status: { notIn: ['clos', 'archive'] },
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    })
    const urgenciesFormatted = urgencies.map((c) => {
      const daysRemaining = Math.ceil(
        (c.nextDueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        id: c.id,
        reference: c.reference,
        title: c.title,
        clientName: `${c.client.firstName} ${c.client.lastName}`,
        nextDueDate: c.nextDueDate,
        daysRemaining,
      }
    })

    // Overdue invoices: dueDate < now and status non_paye or partiel
    const overdueInvoices = await db.invoice.findMany({
      where: {
        ...where,
        dueDate: { lt: now },
        status: { in: ['non_paye', 'partiel'] },
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
    })
    const overdueInvoicesFormatted = overdueInvoices.map((inv) => {
      const daysOverdue = Math.ceil(
        (now.getTime() - inv.dueDate!.getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        id: inv.id,
        reference: inv.reference,
        clientName: `${inv.client.firstName} ${inv.client.lastName}`,
        amount: inv.amount,
        currencyCode: inv.currencyCode,
        dueDate: inv.dueDate,
        status: inv.status,
        daysOverdue,
      }
    })

    // Urgent tasks: priority urgente or haute, not terminee
    const urgentTasks = await db.task.findMany({
      where: {
        ...where,
        priority: { in: ['urgente', 'haute'] },
        status: { not: 'terminee' },
      },
      include: {
        case: { select: { reference: true } },
        user: { select: { name: true } },
      },
      orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
    })
    const urgentTasksFormatted = urgentTasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      caseReference: t.case?.reference ?? null,
      assigneeName: t.user?.name ?? null,
    }))

    // Upcoming events: next 7 days
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const upcomingEventsEnhanced = await db.event.findMany({
      where: {
        ...where,
        startTime: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        case: { select: { reference: true } },
        assignments: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })
    const upcomingEventsFormatted = upcomingEventsEnhanced.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      eventType: e.eventType,
      criticality: e.criticality,
      location: e.location,
      caseReference: e.case?.reference ?? null,
      assignments: e.assignments.map((a) => ({
        userId: a.userId,
        userName: a.user.name,
      })),
    }))

    // My tasks (if userId provided)
    let myTasks: Array<{
      id: string
      title: string
      priority: string
      status: string
      dueDate: Date | null
      caseReference: string | null
    }> = []
    if (userId) {
      const tasks = await db.task.findMany({
        where: {
          tenantId,
          userId,
          status: { not: 'terminee' },
        },
        include: {
          case: { select: { reference: true } },
        },
        orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
      })
      myTasks = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        caseReference: t.case?.reference ?? null,
      }))
    }

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
      // Enhanced fields
      urgencies: urgenciesFormatted,
      overdueInvoices: overdueInvoicesFormatted,
      urgentTasks: urgentTasksFormatted,
      upcomingEventsEnhanced: upcomingEventsFormatted,
      myTasks,
      financial: {
        revenueThisMonth: totalRevenue,
        revenueLastMonth: 0,
        collectedThisMonth: totalRevenue,
        collectedLastMonth: 0,
        toRecover: 0,
        overdueInvoicesCount: unpaidInvoices,
        topClients: [],
        monthlyRevenue: [],
        methodBreakdown: [],
      },
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
