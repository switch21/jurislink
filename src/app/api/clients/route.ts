import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (status === 'active') where.isActive = true
    if (status === 'inactive') where.isActive = false
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { company: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const clients = await db.client.findMany({
      where,
      include: {
        _count: { select: { cases: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(clients)
  } catch (error) {
    console.error('List clients error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const client = await db.client.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        company: body.company,
        clientType: body.clientType,
        niu: body.niu,
        email: body.email,
        phone: body.phone,
        address: body.address,
        city: body.city,
        country: body.country,
        notes: body.notes,
        riskLevel: body.riskLevel,
        source: body.source,
        isActive: body.isActive ?? true,
        tenantId: body.tenantId,
      },
    })
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
