import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('document', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const document = await db.document.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
        tenant: true,
      },
    })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    return NextResponse.json(document)
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const PUT = withPermission('document', async (request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const document = await db.document.update({
      where: { id },
      data: { name: body.name, description: body.description, version: body.version },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'DOCUMENT_UPDATED', resourceType: 'document', resourceId: id })
    }
    return NextResponse.json(document)
  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const DELETE = withPermission('document', async (_request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    await db.document.delete({ where: { id } })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'DOCUMENT_DELETED', resourceType: 'document', resourceId: id })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
