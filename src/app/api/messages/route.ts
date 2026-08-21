import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth, enforceTenantIsolation } from '@/lib/rbac'

export const GET = withAuth(async (request, auth) => {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    const where: Record<string, unknown> = {}
    enforceTenantIsolation(auth, where)

    if (contactId) {
      where.OR = [
        { senderId: auth.userId, receiverId: contactId },
        { senderId: contactId, receiverId: auth.userId },
      ]
    } else {
      where.OR = [
        { senderId: auth.userId },
        { receiverId: auth.userId },
      ]
    }

    const messages = await db.message.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' }, take: 200,
    })
    return NextResponse.json(messages)
  } catch (error) {
    console.error('List messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withAuth(async (request, auth) => {
  try {
    const body = await request.json()
    const message = await db.message.create({
      data: {
        content: body.content,
        tenantId: auth.tenantId!,
        senderId: auth.userId,
        receiverId: body.receiverId,
      },
    })
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})