import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const role = searchParams.get('role')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (role) where.role = role

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        phone: true,
        preferredLanguage: true,
        isActive: true,
        lastLoginAt: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(users)
  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const hashedPassword = body.password
      ? await bcrypt.hash(body.password, 10)
      : null

    const user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        password: hashedPassword,
        role: body.role,
        avatarUrl: body.avatarUrl,
        phone: body.phone,
        preferredLanguage: body.preferredLanguage,
        isActive: body.isActive ?? true,
        tenantId: body.tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        phone: true,
        preferredLanguage: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      },
    })
    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
