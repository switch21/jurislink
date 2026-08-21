import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth, enforceTenantIsolation } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

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

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const [data, total] = await Promise.all([
      db.message.findMany({
        where,
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
          receiver: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.message.count({ where }),
    ])
    return NextResponse.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) })
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
    if (auth.userId !== '__readonly__') {
      createAuditLog({ tenantId: auth.tenantId!, userId: auth.userId, action: 'MESSAGE_SENT', resourceType: 'message', resourceId: message.id, metadata: { receiverId: message.receiverId } })
    }
    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('Send message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})