import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase, toSnakeCase } from '@/lib/transform'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const caseId = searchParams.get('caseId')

    let query = supabase.from('documents').select('*')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    if (caseId) query = query.eq('case_id', caseId)
    query = query.is('deleted_at', 'null').order('created_at', { ascending: false }).range(0, 99)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json((data || []).map(toCamelCase))
  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('documents')
      .insert({
        tenant_id: body.tenantId,
        case_id: body.caseId || null,
        uploader_id: body.userId,
        file_name: body.fileName || body.name || 'document',
        file_path: body.filePath || '',
        file_size: body.fileSize || 0,
        mime_type: body.fileType || body.mimeType || 'application/octet-stream',
        tags: body.tags || null,
        version: body.version || 1,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(toCamelCase(data), { status: 201 })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
