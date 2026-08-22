import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapEvent } from '@/lib/transform'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('events')
      .select('*, assignments:event_assignments(*, user:users(id, full_name, email)), case:cases(id, reference, title)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const result = mapEvent(data)
    result.assignments = (data.assignments || []).map((a: any) => ({
      userId: a.user_id,
      user: a.user ? { id: a.user.id, name: a.user.full_name, email: a.user.email } : null,
    }))
    if (data.case) {
      result.case = { id: data.case.id, reference: data.case.reference, title: data.case.title }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get event error:', error)
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
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.startTime !== undefined) updateData.start_time = body.startTime
    if (body.endTime !== undefined) updateData.end_time = body.endTime
    if (body.eventType !== undefined) updateData.event_type = body.eventType
    if (body.criticality !== undefined) updateData.criticality = body.criticality

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapEvent(data))
  } catch (error) {
    console.error('Update event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Delete event_assignments first, then event
    await supabase.from('event_assignments').delete().eq('event_id', id)
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
