import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, clientId, adversary, caseId } = body as {
      tenantId: string
      clientId: string
      adversary?: string
      caseId?: string
    }

    if (!tenantId || !clientId) {
      return NextResponse.json({ error: 'tenantId and clientId are required' }, { status: 400 })
    }

    const conflicts: {
      type: 'client_as_adversary' | 'adversary_as_client'
      case: { id: string; reference: string; title: string; clientName: string }
      description: string
    }[] = []

    // Get the client being referenced
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const clientFullName = `${client.firstName} ${client.lastName}`.toLowerCase().trim()

    // If an adversary is provided, check:
    // 1. Adversary name appears as a client in the same tenant
    if (adversary && adversary.trim()) {
      const adversaryLower = adversary.toLowerCase().trim()

      // Find clients whose name partially matches the adversary (case-insensitive)
      const matchingClients = await db.client.findMany({
        where: {
          tenantId,
          id: { not: clientId }, // exclude the current client
        },
        select: { id: true, firstName: true, lastName: true, cases: {
          select: { id: true, reference: true, title: true },
          take: 5,
        }},
      })

      for (const c of matchingClients) {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase().trim()
        if (name.includes(adversaryLower) || adversaryLower.includes(name)) {
          for (const caze of c.cases) {
            conflicts.push({
              type: 'adversary_as_client',
              case: {
                id: caze.id,
                reference: caze.reference,
                title: caze.title,
                clientName: `${c.firstName} ${c.lastName}`,
              },
              description: `La partie adverse "${adversary}" correspond à un client existant (${c.firstName} ${c.lastName}) dans le dossier ${caze.reference}`,
            })
          }
        }
      }

      // 2. Adversary name appears in any case's adversary field within the same tenant
      const casesWithMatchingAdversary = await db.case.findMany({
        where: {
          tenantId,
          ...(caseId ? { id: { not: caseId } } : {}),
          adversary: { not: null },
        },
        include: {
          client: { select: { firstName: true, lastName: true } },
        },
      })

      for (const caze of casesWithMatchingAdversary) {
        if (caze.adversary) {
          const existingAdversary = caze.adversary.toLowerCase().trim()
          if (
            existingAdversary.includes(adversaryLower) ||
            adversaryLower.includes(existingAdversary)
          ) {
            conflicts.push({
              type: 'client_as_adversary',
              case: {
                id: caze.id,
                reference: caze.reference,
                title: caze.title,
                clientName: `${caze.client.firstName} ${caze.client.lastName}`,
              },
              description: `La partie adverse "${adversary}" apparaît déjà comme partie adverse dans le dossier ${caze.reference}`,
            })
          }
        }
      }
    }

    // 3. Check if the current client appears as an adversary in any other case
    const casesWhereClientIsAdversary = await db.case.findMany({
      where: {
        tenantId,
        ...(caseId ? { id: { not: caseId } } : {}),
        adversary: { not: null },
      },
      include: {
        client: { select: { firstName: true, lastName: true } },
      },
    })

    for (const caze of casesWhereClientIsAdversary) {
      if (caze.adversary) {
        const existingAdversary = caze.adversary.toLowerCase().trim()
        if (
          existingAdversary.includes(clientFullName) ||
          clientFullName.includes(existingAdversary)
        ) {
          // Avoid duplicate if already added above
          const alreadyAdded = conflicts.some(
            (c) => c.type === 'client_as_adversary' && c.case.id === caze.id
          )
          if (!alreadyAdded) {
            conflicts.push({
              type: 'client_as_adversary',
              case: {
                id: caze.id,
                reference: caze.reference,
                title: caze.title,
                clientName: `${caze.client.firstName} ${caze.client.lastName}`,
              },
              description: `Le client ${client.firstName} ${client.lastName} est listé comme partie adverse dans le dossier ${caze.reference}`,
            })
          }
        }
      }
    }

    return NextResponse.json({ conflicts })
  } catch (error) {
    console.error('Conflict detection error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
