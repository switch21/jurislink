import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { caseId } = body
    const { data, error } = await supabase.from('cases').select('*').eq('id', caseId).single()
    if (error || !data) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    return NextResponse.json({ success: true, caseData: data, prompt: 'AI analysis not yet connected to Supabase' })
  } catch (error) {
    console.error('Analyze case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
