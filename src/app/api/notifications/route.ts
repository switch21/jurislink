import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId
    if (userId) where.userId = userId

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(notifications)
  } catch (error) {
    console.error('List notifications error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const notification = await db.notification.create({
      data: {
        title: body.title,
        message: body.message,
        category: body.category,
        resourceType: body.resourceType,
        resourceId: body.resourceId,
        tenantId: body.tenantId,
        userId: body.userId,
        eventId: body.eventId,
      },
    })
    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error('Create notification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
