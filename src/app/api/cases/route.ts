import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (status) where.status = status
    if (type) where.type = type
    if (priority) where.priority = priority
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { reference: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const cases = await db.case.findMany({
      where,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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
    const caze = await db.case.create({
      data: {
        reference: body.reference,
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        priority: body.priority,
        isSecret: body.isSecret,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
        tenantId: body.tenantId,
        clientId: body.clientId,
      },
    })
    return NextResponse.json(caze, { status: 201 })
  } catch (error) {
    console.error('Create case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
