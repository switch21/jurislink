import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapEvent, toSnakeCase } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const month = searchParams.get('month')
    const userId = searchParams.get('userId')

    let query = supabase
      .from('events')
      .select('*, assignments:event_assignments(*, user:users(id, full_name)), case:cases(id, reference, title)')

    if (tenantId) query = query.eq('tenant_id', tenantId)

    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const startDate = new Date(year, mon - 1, 1).toISOString()
      const endDate = new Date(year, mon, 0, 23, 59, 59, 999).toISOString()
      query = query.gte('start_time', startDate).lt('start_time', endDate)
    }

    query = query.order('start_time', { ascending: true }).range(0, 199)

    const { data, error } = await query
    if (error) throw error

    // If userId filter, filter in JS (for event_assignments join)
    let events = data || []
    if (userId) {
      events = events.filter((e: any) =>
        e.assignments?.some((a: any) => a.user_id === userId)
      )
    }

    const result = events.map((e: any) => {
      const mapped = mapEvent(e)
      mapped.assignments = (e.assignments || []).map((a: any) => ({
        userId: a.user_id,
        user: a.user ? { id: a.user.id, name: a.user.full_name } : null,
      }))
      if (e.case) {
        mapped.case = { id: e.case.id, reference: e.case.reference, title: e.case.title }
      }
      return mapped
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('List events error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('events')
      .insert({
        tenant_id: body.tenantId,
        case_id: body.caseId || null,
        title: body.title,
        description: body.description || null,
        start_time: body.startTime,
        end_time: body.endTime,
        event_type: body.eventType || null,
        criticality: body.criticality || 'medium',
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapEvent(data), { status: 201 })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
