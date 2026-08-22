import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, toSnakeCase, mapCase, mapClient } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')

    let query = supabase.from('cases').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (status) query = query.eq('status', status)
    if (type) query = query.eq('case_type', type)
    if (priority) query = query.eq('priority', priority)
    if (search) {
      query = query.or(`title.ilike.%${search}%,reference.ilike.%${search}%,description.ilike.%${search}%`)
    }
    query = query.order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error

    // Build lawyer map for assignment mapping
    const lawyerIds = (data || []).map((c: any) => c.assigned_lawyer_id).filter(Boolean)
    let lawyerMap: Record<string, any> = {}
    if (lawyerIds.length > 0) {
      const { data: lawyers } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', lawyerIds)
      if (lawyers) {
        lawyerMap = Object.fromEntries(lawyers.map((l: any) => [l.id, l]))
      }
    }

    // Get client names for each case
    const clientIds = (data || []).map((c: any) => c.client_id).filter(Boolean)
    let clientMap: Record<string, any> = {}
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, full_name')
        .in('id', [...new Set(clientIds)])
      if (clients) {
        clientMap = Object.fromEntries(clients.map((c: any) => [c.id, c]))
      }
    }

    const cases = (data || []).map((row: any) => {
      const mapped = mapCase(row, lawyerMap)
      // Add client info
      if (row.client_id && clientMap[row.client_id]) {
        const clientNames = clientMap[row.client_id].full_name.split(' ')
        mapped.client = {
          id: row.client_id,
          firstName: clientNames[0] || '',
          lastName: clientNames.slice(1).join(' ') || '',
        }
      }
      return mapped
    })

    return NextResponse.json(cases)
  } catch (error) {
    console.error('List cases error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('cases')
      .insert({
        tenant_id: body.tenantId,
        client_id: body.clientId,
        reference: body.reference || null,
        title: body.title,
        description: body.description || null,
        case_type: body.type || null,
        status: body.status || 'new',
        priority: body.priority || null,
        is_secret: body.isSecret || false,
        next_deadline: body.nextDueDate || null,
        assigned_lawyer_id: body.assignedLawyerId || null,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(toCamelCase(data), { status: 201 })
  } catch (error) {
    console.error('Create case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
