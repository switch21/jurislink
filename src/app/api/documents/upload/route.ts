import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission, enforceTenantIsolation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
]
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|txt|zip|rar)$/i

export const POST = withPermission('document', async (request, auth) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.test(file.name)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const tenantId = (formData.get('tenantId') as string) || auth.tenantId
    const caseId = formData.get('caseId') as string | null
    const folder = formData.get('folder') as string | null
    const description = formData.get('description') as string | null
    const tags = formData.get('tags') as string | null

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

    await mkdir(UPLOAD_DIR, { recursive: true })

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const fileName = `${tenantId}_${caseId || 'gen'}_${Date.now()}_${safeName}`
    const filePath = path.join(UPLOAD_DIR, fileName)
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    const doc = await db.document.create({
      data: {
        name: (formData.get('name') as string) || file.name,
        fileName,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        filePath: `/uploads/${fileName}`,
        folder,
        tags,
        description,
        tenantId,
        caseId: caseId || undefined,
        userId: auth.userId,
      },
    })

    if (auth.userId !== '__readonly__') {
      createAuditLog({
        tenantId,
        userId: auth.userId,
        action: 'DOCUMENT_UPLOADED',
        resourceType: 'document',
        resourceId: doc.id,
        metadata: { name: doc.name, fileName, fileSize: doc.fileSize },
      })
    }

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}, 'create')
