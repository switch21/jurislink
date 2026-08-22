import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapInvoice } from '@/lib/transform'

const STATUS_TO_SUPA: Record<string, string> = { non_paye: 'draft', envoyee: 'sent', paye: 'paid', annule: 'cancelled', partiel: 'sent' }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (error || !data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    return NextResponse.json(mapInvoice(data))
  } catch (error) {
    console.error('Get invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, any> = {}
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.status !== undefined) updateData.status = STATUS_TO_SUPA[body.status] || body.status
    if (body.dueDate !== undefined) updateData.due_date = body.dueDate
    if (body.issueDate !== undefined) updateData.issue_date = body.issueDate
    if (body.clientId !== undefined) updateData.client_id = body.clientId
    if (body.caseId !== undefined) updateData.case_id = body.caseId

    const { data, error } = await supabase.from('invoices').update(updateData).eq('id', id).select('*').single()
    if (error) throw error
    return NextResponse.json(mapInvoice(data))
  } catch (error) {
    console.error('Update invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
