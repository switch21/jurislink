import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { mapMessage } from '@/lib/transform'

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('messages')
      .update({ read_status: true })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(mapMessage(data))
  } catch (error) {
    console.error('Mark message as read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}