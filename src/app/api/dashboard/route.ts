import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })

    const now = new Date().toISOString()

    // Parallel counts
    const [
      totalCasesRes, activeCasesRes, totalClientsRes,
      unpaidRes, paidRes, revenueRes,
    ] = await Promise.all([
      supabase.from('cases').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('cases').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['draft', 'overdue']),
      supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'paid'),
      supabase.from('invoices').select('amount').eq('tenant_id', tenantId).eq('status', 'paid'),
    ])

    const totalRevenue = (revenueRes.data || []).reduce((sum: number, i: any) => sum + Number(i.amount), 0)

    // Cases by status
    const { data: casesStatusData } = await supabase.from('cases').select('status').eq('tenant_id', tenantId)
    const casesByStatus: Record<string, number> = {}
    ;(casesStatusData || []).forEach((c: any) => { casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1 })

    // Cases by type
    const { data: casesTypeData } = await supabase.from('cases').select('case_type').eq('tenant_id', tenantId)
    const casesByType: Record<string, number> = {}
    ;(casesTypeData || []).forEach((c: any) => { if (c.case_type) casesByType[c.case_type] = (casesByType[c.case_type] || 0) + 1 })

    // Recent audit logs
    const { data: recentActivity } = await supabase
      .from('audit_logs').select('*, user:users(id, full_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(0, 9)

    // Upcoming events
    const { data: upcomingEventsList } = await supabase
      .from('events').select('*, assignments:event_assignments(*, user:users(id, full_name)), case:cases(id, reference, title)')
      .eq('tenant_id', tenantId)
      .gte('start_time', now)
      .order('start_time', { ascending: true })
      .range(0, 4)

    // My tasks
    let myTasks: any[] = []
    if (userId) {
      const { data: tasks } = await supabase
        .from('tasks').select('*, case:cases(id, reference, title), user:users(id, full_name)')
        .eq('tenant_id', tenantId)
        .eq('assignee_id', userId)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })
        .range(0, 19)
      myTasks = (tasks || []).map(toCamelCase)
    }

    // Urgent tasks
    const { data: urgentTasks } = await supabase
      .from('tasks').select('*, case:cases(id, reference), user:users(id, full_name)')
      .eq('tenant_id', tenantId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .range(0, 9)

    // Overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('invoices').select('*, client:clients(id, full_name)')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'overdue'])
      .lt('due_date', now)
      .order('due_date', { ascending: true })
      .range(0, 19)

    return NextResponse.json({
      totalCases: totalCasesRes.count || 0,
      activeCases: activeCasesRes.count || 0,
      totalClients: totalClientsRes.count || 0,
      upcomingEvents: upcomingEventsList?.length || 0,
      unpaidInvoices: unpaidRes.count || 0,
      totalRevenue,
      paidInvoices: paidRes.count || 0,
      casesByStatus,
      casesByType,
      recentActivity: (recentActivity || []).map(toCamelCase),
      upcomingEventsList: (upcomingEventsList || []).map(toCamelCase),
      urgencies: [],
      overdueInvoices: (overdueInvoices || []).map(toCamelCase),
      urgentTasks: (urgentTasks || []).map(toCamelCase),
      upcomingEventsEnhanced: (upcomingEventsList || []).map(toCamelCase),
      myTasks,
      financial: {
        revenueThisMonth: totalRevenue,
        revenueLastMonth: 0, collectedThisMonth: totalRevenue,
        collectedLastMonth: 0, toRecover: 0,
        overdueInvoicesCount: unpaidRes.count || 0,
        topClients: [], monthlyRevenue: [], methodBreakdown: [],
      },
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
