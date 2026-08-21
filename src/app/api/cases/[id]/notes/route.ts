import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withPermission } from '@/lib/rbac'

export const GET = withPermission('case', async (_request, _auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const notes = await db.caseNote.findMany({
      where: { caseId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json(notes)
  } catch (error) {
    console.error('List case notes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withPermission('case', async (request, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const body = await request.json()
    const note = await db.caseNote.create({
      data: { content: body.content, caseId: id, userId: auth.userId },
    })
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Create case note error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}, 'edit')
