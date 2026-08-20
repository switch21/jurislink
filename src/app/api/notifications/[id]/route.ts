import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const notification = await db.notification.update({
      where: { id },
      data: { isRead: true },
    })
    return NextResponse.json(notification)
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
