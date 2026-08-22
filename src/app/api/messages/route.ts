import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapMessage, mapUser } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')
    const contactId = searchParams.get('contactId')

    let query = supabase.from('messages').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)

    if (userId && contactId) {
      query = query.or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
    } else if (userId) {
      query = query.or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    }
    query = query.order('created_at', { ascending: true }).range(0, 199)

    const { data, error } = await query
    if (error) throw error

    // Get sender/receiver user info
    const userIds = [...new Set((data || []).flatMap((m: any) => [m.sender_id, m.receiver_id]).filter(Boolean))]
    let userMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, full_name, avatar_url').in('id', userIds)
      if (users) userMap = Object.fromEntries(users.map((u: any) => [u.id, u]))
    }

    const messages = (data || []).map((row: any) => {
      const mapped = mapMessage(row)
      const sender = userMap[row.sender_id]
      const receiver = userMap[row.receiver_id]
      mapped.sender = sender ? { id: sender.id, name: sender.full_name, avatarUrl: sender.avatar_url } : null
      mapped.receiver = receiver ? { id: receiver.id, name: receiver.full_name, avatarUrl: receiver.avatar_url } : null
      return mapped
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('List messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('messages')
      .insert({
        tenant_id: body.tenantId,
        sender_id: body.senderId,
        receiver_id: body.receiverId,
        case_id: body.caseId || null,
        content: body.content,
        read_status: false,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapMessage(data), { status: 201 })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
