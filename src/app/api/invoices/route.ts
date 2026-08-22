import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, mapInvoice } from '@/lib/transform'

const STATUS_TO_SUPA: Record<string, string> = {
  non_paye: 'draft', envoyee: 'sent', paye: 'paid', annule: 'cancelled', partiel: 'sent',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const status = searchParams.get('status')
    const clientId = searchParams.get('clientId')

    let query = supabase.from('invoices').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (status) {
      const supaStatus = STATUS_TO_SUPA[status] || status
      query = query.eq('status', supaStatus)
    }
    if (clientId) query = query.eq('client_id', clientId)
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error

    // Get currency codes
    const currencyIds = [...new Set((data || []).map((i: any) => i.currency_id).filter(Boolean))]
    let currencyMap: Record<string, string> = {}
    if (currencyIds.length > 0) {
      const { data: currencies } = await supabase.from('currencies').select('id, code').in('id', currencyIds)
      if (currencies) currencyMap = Object.fromEntries(currencies.map((c: any) => [c.id, c.code]))
    }

    // Get client info
    const clientIds = [...new Set((data || []).map((i: any) => i.client_id).filter(Boolean))]
    let clientMap: Record<string, any> = {}
    if (clientIds.length > 0) {
      const { data: clients } = await supabase.from('clients').select('id, full_name, company').in('id', clientIds)
      if (clients) clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c]))
    }

    const invoices = (data || []).map((row: any) => {
      const inv = mapInvoice(row, currencyMap[row.currency_id] || 'XAF')
      // Add client info
      if (clientMap[row.client_id]) {
        const names = (clientMap[row.client_id].full_name || '').split(' ')
        inv.client = {
          id: row.client_id,
          firstName: names[0] || '',
          lastName: names.slice(1).join(' ') || '',
          company: clientMap[row.client_id].company,
        }
      }
      return inv
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('List invoices error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    // Find currency by code (frontend sends currencyCode string)
    let currencyId = body.currencyId
    if (!currencyId && body.currencyCode) {
      const { data: cur } = await supabase.from('currencies').select('id').eq('code', body.currencyCode).single()
      currencyId = cur?.id
    }
    if (!currencyId) {
      const { data: defaultCur } = await supabase.from('currencies').select('id').eq('code', 'XAF').single()
      currencyId = defaultCur?.id
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        tenant_id: body.tenantId,
        case_id: body.caseId || null,
        client_id: body.clientId,
        amount: body.amount,
        currency_id: currencyId,
        status: STATUS_TO_SUPA[body.status] || body.status || 'draft',
        issue_date: body.issueDate || body.dueDate || null,
        due_date: body.dueDate || null,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(mapInvoice(data, body.currencyCode || 'XAF'), { status: 201 })
  } catch (error) {
    console.error('Create invoice error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
