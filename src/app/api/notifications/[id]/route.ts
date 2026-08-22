import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapNotification } from '@/lib/transform'

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('notifications')
      .update({ "read": true })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(mapNotification(data))
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}