import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapNotification } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')

    let query = supabase.from('notifications').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (userId) query = query.eq('user_id', userId)
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data || []).map(mapNotification))
  } catch (error) {
    console.error('List notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        tenant_id: body.tenantId,
        user_id: body.userId || null,
        title: body.title,
        message: body.message,
        type: body.type || null,
        category: body.category || null,
        resource_type: body.resourceType || null,
        resource_id: body.resourceId || null,
        event_id: body.eventId || null,
        "read": false,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapNotification(data), { status: 201 })
  } catch (error) {
    console.error('Create notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
