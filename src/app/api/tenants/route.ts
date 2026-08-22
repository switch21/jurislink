import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapTenant, toSnakeCase } from '@/lib/transform'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json((data || []).map(mapTenant))
  } catch (error) {
    console.error('List tenants error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('tenants')
      .insert(toSnakeCase({
        name: body.name,
        logoUrl: body.logoUrl,
        address: body.address,
        phone: body.phone,
        email: body.email,
        plan: body.plan,
        maxUsers: body.maxUsers,
        maxStorageGb: body.maxStorageGb,
      }))
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapTenant(data), { status: 201 })
  } catch (error) {
    console.error('Create tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
