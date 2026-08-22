import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapTask } from '@/lib/transform'

// Frontend status → Supabase status mapping
const STATUS_TO_SUPA: Record<string, string> = { a_faire: 'todo', en_cours: 'in_progress', terminee: 'done', annulee: 'done' }
const STATUS_FROM_SUPA: Record<string, string> = { todo: 'a_faire', in_progress: 'en_cours', done: 'terminee' }

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const caseId = searchParams.get('caseId')
    const search = searchParams.get('search')

    let query = supabase.from('tasks').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (userId) query = query.eq('assignee_id', userId)
    if (caseId) query = query.eq('case_id', caseId)
    if (status) {
      const supaStatus = STATUS_TO_SUPA[status] || status
      query = query.eq('status', supaStatus)
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error

    // Count total and completed for tenant
    const [totalRes, doneRes] = await Promise.all([
      tenantId
        ? supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
        : Promise.resolve({ count: 0 }),
      tenantId
        ? supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'done')
        : Promise.resolve({ count: 0 }),
    ])

    // Enrich tasks with user, case
    const tasks = (data || []).map((row: any) => {
      const mapped = mapTask(row)
      return mapped
    })

    return NextResponse.json({
      tasks,
      _count: { total: totalRes.count || 0, completed: doneRes.count || 0 },
    })
  } catch (error) {
    console.error('List tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.title || !body.tenantId) {
      return NextResponse.json({ error: 'title and tenantId are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        tenant_id: body.tenantId,
        case_id: body.caseId || null,
        assignee_id: body.userId || null,
        title: body.title,
        description: body.description || null,
        due_date: body.dueDate || null,
        status: 'todo',
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapTask(data), { status: 201 })
  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
