import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = await db.client.findUnique({
      where: { id },
      include: {
        _count: { select: { cases: true, invoices: true } },
        tenant: true,
      },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json(client)
  } catch (error) {
    console.error('Get client error:', error)
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
    const client = await db.client.update({
      where: { id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        company: body.company,
        email: body.email,
        phone: body.phone,
        address: body.address,
        notes: body.notes,
        isActive: body.isActive,
      },
    })
    return NextResponse.json(client)
  } catch (error) {
    console.error('Update client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.client.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete client error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
