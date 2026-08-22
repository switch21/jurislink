import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapTask } from '@/lib/transform'

const STATUS_TO_SUPA: Record<string, string> = { a_faire: 'todo', en_cours: 'in_progress', terminee: 'done', annulee: 'done' }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()
    if (error || !data) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    return NextResponse.json(mapTask(data))
  } catch (error) {
    console.error('Get task error:', error)
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
    if (body.dueDate !== undefined) updateData.due_date = body.dueDate
    if (body.userId !== undefined) updateData.assignee_id = body.userId
    if (body.caseId !== undefined) updateData.case_id = body.caseId

    if (body.status !== undefined) {
      updateData.status = STATUS_TO_SUPA[body.status] || body.status
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapTask(data))
  } catch (error) {
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
