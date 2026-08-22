import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapCase, mapClient, mapEvent, mapUser, toSnakeCase } from '@/lib/transform'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data: caze, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !caze) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Fetch related data in parallel
    const [tenantRes, clientRes, lawyerRes, docRes, eventRes] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', caze.tenant_id).single(),
      supabase.from('clients').select('*').eq('id', caze.client_id).single(),
      caze.assigned_lawyer_id
        ? supabase.from('users').select('id, full_name, email').eq('id', caze.assigned_lawyer_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('documents').select('*').eq('case_id', id).order('created_at', { ascending: false }),
      supabase.from('events').select('*, assignments:event_assignments(*, user:users(id, full_name))').eq('case_id', id).order('start_time', { ascending: false }),
    ])

    const lawyerMap: Record<string, any> = {}
    if (lawyerRes.data) {
      lawyerMap[caze.assigned_lawyer_id!] = lawyerRes.data
    }

    const result = mapCase(caze, lawyerMap)
    result.tenant = tenantRes.data ? toCamelCase(tenantRes.data) : null
    result.client = clientRes.data ? mapClient(clientRes.data) : null
    result.notes = [] // case_notes table doesn't exist in Supabase
    result.documents = (docRes.data || []).map((d: any) => {
      const mapped = toCamelCase(d)
      // Map uploader
      return mapped
    })
    result.events = (eventRes.data || []).map((e: any) => {
      const mapped = mapEvent(e)
      if (e.assignments) {
        mapped.assignments = e.assignments.map((a: any) => ({
          userId: a.user_id,
          user: a.user ? { id: a.user.id, name: a.user.full_name } : null,
        }))
      }
      return mapped
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get case error:', error)
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

    const updateData: Record<string, any> = {}
    if (body.reference !== undefined) updateData.reference = body.reference
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.type !== undefined) updateData.case_type = body.type
    if (body.status !== undefined) updateData.status = body.status
    if (body.outcome !== undefined) updateData.outcome = body.outcome
    if (body.paymentStatus !== undefined) updateData.payment_status = body.paymentStatus
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.isSecret !== undefined) updateData.is_secret = body.isSecret
    if (body.nextDueDate !== undefined) updateData.next_deadline = body.nextDueDate
    if (body.assignedLawyerId !== undefined) updateData.assigned_lawyer_id = body.assignedLawyerId

    const { data, error } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(toCamelCase(data))
  } catch (error) {
    console.error('Update case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase.from('cases').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
