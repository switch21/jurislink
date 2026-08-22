import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toCamelCase } from '@/lib/transform'

const STATUS_TO_SUPA: Record<string, string> = { a_faire: 'todo', en_cours: 'in_progress', terminee: 'done' }

const WORKFLOW_TEMPLATES: Record<string, Array<{ title: string; daysOffset: number; priority: string }>> = {
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
    if (!tenantId || !eventId) return NextResponse.json({ error: 'tenantId and eventId are required' }, { status: 400 })

    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single()
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const template = WORKFLOW_TEMPLATES[event.event_type]
    if (!template) return NextResponse.json({ error: `No workflow for type '${event.event_type}'` }, { status: 400 })

    const eventDate = new Date(event.start_time)
    const linkedCaseId = caseId || event.case_id || null

    const tasksData = template.map((t) => {
      const dueDate = new Date(eventDate)
      dueDate.setDate(dueDate.getDate() + t.daysOffset)
      return {
        tenant_id: tenantId, case_id: linkedCaseId, event_id: eventId,
        assignee_id: assigneeId || null, title: t.title,
        description: null, due_date: dueDate.toISOString(), status: 'todo',
      }
    })

    const { data, error } = await supabase.from('tasks').insert(tasksData).select('*')
    if (error) throw error

    return NextResponse.json({ count: data?.length || 0, tasks: (data || []).map(toCamelCase) }, { status: 201 })
  } catch (error) {
    console.error('Generate workflow tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
