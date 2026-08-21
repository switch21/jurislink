import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenantId')
    const userId = searchParams.get('userId')
    const contactId = searchParams.get('contactId')

    const where: Record<string, unknown> = {}
    if (tenantId) where.tenantId = tenantId

    if (userId && contactId) {
      where.OR = [
        { senderId: userId, receiverId: contactId },
        { senderId: contactId, receiverId: userId },
      ]
    } else if (userId) {
      where.OR = [
        { senderId: userId },
        { receiverId: userId },
      ]
    }

    const messages = await db.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
    return NextResponse.json(messages)
  } catch (error) {
    console.error('List messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = await db.message.create({
      data: {
        content: body.content,
        tenantId: body.tenantId,
        senderId: body.senderId,
        receiverId: body.receiverId,
      },
    })
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
