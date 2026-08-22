import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, toSnakeCase } from '@/lib/transform'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .order('code', { ascending: true })

    if (error) throw error
    return NextResponse.json((data || []).map(toCamelCase))
  } catch (error) {
    console.error('List currencies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('currencies')
      .insert(toSnakeCase({ code: body.code, name: body.name, symbol: body.symbol }))
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(toCamelCase(data), { status: 201 })
  } catch (error) {
    console.error('Create currency error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
