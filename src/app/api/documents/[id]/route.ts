import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase } from '@/lib/transform'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single()
    if (error || !data) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    return NextResponse.json(toCamelCase(data))
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, any> = {}
    if (body.fileName !== undefined) updateData.file_name = body.fileName
    if (body.filePath !== undefined) updateData.file_path = body.filePath
    if (body.fileSize !== undefined) updateData.file_size = body.fileSize
    if (body.mimeType !== undefined) updateData.mime_type = body.mimeType
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.version !== undefined) updateData.version = body.version
    if (body.isConfidential !== undefined) updateData.is_confidential = body.isConfidential

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json(toCamelCase(data))
  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Soft delete
    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
