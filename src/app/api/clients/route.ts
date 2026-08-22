import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapClient, toSnakeCase } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    let query = supabase.from('clients').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (status === 'active') query = query.eq('is_active', true)
    if (status === 'inactive') query = query.eq('is_active', false)
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`)
    }
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error

    const clients = (data || []).map(mapClient)
    return NextResponse.json(clients)
  } catch (error) {
    console.error('List clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Frontend sends firstName + lastName, Supabase stores full_name
    const fullName = `${body.firstName || ''} ${body.lastName || ''}`.trim()

    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: body.tenantId,
        full_name: fullName,
        company: body.company || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        niu: body.niu || null,
        is_active: body.isActive !== undefined ? body.isActive : true,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapClient(data), { status: 201 })
  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
