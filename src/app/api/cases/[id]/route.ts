import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const caze = await db.case.findUnique({
      where: { id },
      include: {
        client: true,
        tenant: true,
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        notes: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        events: {
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { startTime: 'desc' },
        },
      },
    })

    if (!caze) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }
    return NextResponse.json(caze)
  } catch (error) {
    console.error('Get case error:', error)
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
    const caze = await db.case.update({
      where: { id },
      data: {
        reference: body.reference,
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        outcome: body.outcome,
        paymentStatus: body.paymentStatus,
        priority: body.priority,
        isSecret: body.isSecret,
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
        closingDate: body.closingDate ? new Date(body.closingDate) : null,
        archivableAfter: body.archivableAfter ? new Date(body.archivableAfter) : null,
        niu: body.niu,
        adversary: body.adversary,
        jurisdiction: body.jurisdiction,
        amountInDispute: body.amountInDispute,
        billingType: body.billingType,
      },
    })
    return NextResponse.json(caze)
  } catch (error) {
    console.error('Update case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.case.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
