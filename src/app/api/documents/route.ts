import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const caseId = searchParams.get('caseId')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (caseId) where.caseId = caseId

    const documents = await db.document.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        case: { select: { id: true, reference: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(documents)
  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const document = await db.document.create({
      data: {
        name: body.name,
        fileName: body.fileName,
        fileType: body.fileType,
        fileSize: body.fileSize,
        filePath: body.filePath,
        version: body.version,
        description: body.description,
        tenantId: body.tenantId,
        caseId: body.caseId,
        userId: body.userId,
      },
    })
    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Create document error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
