import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, clients: true, cases: true } },
      },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }
    return NextResponse.json(tenant)
  } catch (error) {
    console.error('Get tenant error:', error)
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
    const tenant = await db.tenant.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        logoUrl: body.logoUrl,
        address: body.address,
        phone: body.phone,
        email: body.email,
        plan: body.plan,
        maxUsers: body.maxUsers,
        maxStorageGb: body.maxStorageGb,
        isActive: body.isActive,
      },
    })
    return NextResponse.json(tenant)
  } catch (error) {
    console.error('Update tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.tenant.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete tenant error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
