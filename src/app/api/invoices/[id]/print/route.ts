import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase } from '@/lib/transform'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (error || !data) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    const invoice = toCamelCase(data)
    return NextResponse.json({ invoice, lineItems: [], tax: { htTotal: 0, tvaAmount: 0, ttcTotal: invoice.amount, tvaRate: 0.1925 } })
  } catch (error) {
    console.error('Print invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
