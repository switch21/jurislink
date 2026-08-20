import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { userId, tenantId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { userId, isRead: false }
    if (tenantId) where.tenantId = tenantId

    await db.notification.updateMany({
      where,
      data: { isRead: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Mark all notifications as read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
