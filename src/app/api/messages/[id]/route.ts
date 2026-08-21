import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const message = await db.message.update({
      where: { id },
      data: { isRead: true },
    })
    return NextResponse.json(message)
  } catch (error) {
    console.error('Mark message as read error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
