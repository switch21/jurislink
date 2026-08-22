import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, toSnakeCase } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resourceType')

    let query = supabase.from('audit_logs').select('*, user:users(id, full_name, email)')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (userId) query = query.eq('user_id', userId)
    if (action) query = query.eq('action', action)
    if (resourceType) query = query.eq('resource_type', resourceType)
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error

    const logs = (data || []).map((row: any) => {
      const mapped = toCamelCase(row)
      if (mapped.user) {
        mapped.user = { id: mapped.user.id, name: mapped.user.fullName, email: mapped.user.email }
        delete mapped.user.fullName
      }
      return mapped
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('List audit logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('audit_logs')
      .insert(toSnakeCase({
        action: body.action,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        ipAddress: body.ipAddress,
        userAgent: body.userAgent,
        tenantId: body.tenantId,
        userId: body.userId,
      }))
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(toCamelCase(data), { status: 201 })
  } catch (error) {
    console.error('Create audit log error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
