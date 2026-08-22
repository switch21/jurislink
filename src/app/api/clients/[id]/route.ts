import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapClient } from '@/lib/transform'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const client = mapClient(data)
    return NextResponse.json(client)
  } catch (error) {
    console.error('Get client error:', error)
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
    if (body.firstName !== undefined || body.lastName !== undefined) {
      const first = body.firstName || ''
      const last = body.lastName || ''
      updateData.full_name = `${first} ${last}`.trim()
    }
    if (body.company !== undefined) updateData.company = body.company
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.address !== undefined) updateData.address = body.address
    if (body.niu !== undefined) updateData.niu = body.niu
    if (body.isActive !== undefined) updateData.is_active = body.isActive

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapClient(data))
  } catch (error) {
    console.error('Update client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
