import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

export const GET = withPermission('document', async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)
    if (caseId) where.caseId = caseId

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const [data, total] = await Promise.all([
      db.document.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          case: { select: { id: true, reference: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.document.count({ where }),
    ])
    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('document', async (request, auth) => {
  try {
    const body = await request.json()
    const document = await db.document.create({
      data: {
        name: body.name, fileName: body.fileName, fileType: body.fileType,
        fileSize: body.fileSize, filePath: body.filePath, version: body.version,
        description: body.description, folder: body.folder, tags: body.tags,
        tenantId: auth.tenantId ?? body.tenantId, caseId: body.caseId, userId: auth.userId,
      },
    })
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'DOCUMENT_CREATED', resourceType: 'document', resourceId: document.id, metadata: { name: document.name } })
    }
    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
