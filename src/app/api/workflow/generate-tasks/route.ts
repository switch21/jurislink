import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type TaskTemplate = {
  title: string
  daysOffset: number
  priority: string
}

const WORKFLOW_TEMPLATES: Record<string, TaskTemplate[]> = {
  audience: [
    { title: 'Vérifier dossier complet', daysOffset: -7, priority: 'normal' },
    { title: 'Préparer les pièces', daysOffset: -5, priority: 'normal' },
    { title: 'Préparer conclusions', daysOffset: -3, priority: 'normal' },
    { title: 'Rappel audience', daysOffset: -1, priority: 'haute' },
    { title: 'Compte rendu audience', daysOffset: 0, priority: 'haute' },
  ],
  echeance: [
    { title: 'Préparer dossier échéance', daysOffset: -3, priority: 'normal' },
    { title: 'Dernière vérification', daysOffset: -1, priority: 'haute' },
  ],
  depot: [
    { title: 'Rassembler documents', daysOffset: -2, priority: 'normal' },
    { title: 'Effectuer dépôt', daysOffset: 0, priority: 'haute' },
  ],
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, eventId, caseId, assigneeId } = body

    if (!tenantId || !eventId) {
      return NextResponse.json(
        { error: 'tenantId and eventId are required' },
        { status: 400 }
      )
    }

    // Fetch the event to get its type and date
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: { case: { select: { id: true, reference: true } } },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const template = WORKFLOW_TEMPLATES[event.eventType]
    if (!template) {
      return NextResponse.json(
        { error: `No workflow template for event type '${event.eventType}'` },
        { status: 400 }
      )
    }

    // Check if tasks were already generated for this event
    const existingCount = await db.task.count({
      where: { eventId, tenantId },
    })
    if (existingCount > 0) {
      return NextResponse.json(
        { error: 'Tasks already generated for this event' },
        { status: 409 }
      )
    }

    const eventDate = new Date(event.startTime)
    const linkedCaseId = caseId ?? event.caseId ?? null

    const tasksData = template.map((t) => {
      const dueDate = new Date(eventDate)
      dueDate.setDate(dueDate.getDate() + t.daysOffset)
      return {
        title: t.title,
        tenantId,
        caseId: linkedCaseId,
        eventId,
        userId: assigneeId ?? null,
        status: 'a_faire',
        priority: t.priority,
        dueDate,
      }
    })

    const createdTasks = await db.task.createMany({
      data: tasksData,
    })

    // Fetch created tasks with relations
    const tasks = await db.task.findMany({
      where: { eventId, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        case: { select: { id: true, reference: true, title: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json({
      count: createdTasks.count,
      tasks,
    }, { status: 201 })
  } catch (error) {
    console.error('Generate workflow tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
