import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { userId, tenantId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    let query = supabase.from('notifications').update({ "read": true }).eq('user_id', userId).eq('"read"', false)
    if (tenantId) query = query.eq('tenant_id', tenantId)
    const { error } = await query
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Mark all notifications as read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
