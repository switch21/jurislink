import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, caseId } = body

    if (!tenantId || !caseId) {
      return NextResponse.json(
        { error: 'tenantId and caseId are required' },
        { status: 400 }
      )
    }

    // Fetch the case with all related data
    const caseData = await db.case.findUnique({
      where: { id: caseId, tenantId },
      include: {
        client: {
          select: {
            id: true, firstName: true, lastName: true, company: true,
            clientType: true, email: true, phone: true, address: true,
            city: true, country: true, niu: true, riskLevel: true, notes: true,
          },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        events: {
          orderBy: { startTime: 'asc' },
          include: {
            assignments: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true } },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
          include: {
            user: { select: { name: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, reference: true, amount: true, status: true,
            currencyCode: true, type: true, dueDate: true, paidAmount: true,
            notes: true, createdAt: true,
          },
        },
        tenant: {
          select: { name: true, address: true, phone: true, email: true },
        },
      },
    })

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Format for prompt
    const clientInfo = caseData.client
      ? `${caseData.client.firstName} ${caseData.client.lastName}${caseData.client.company ? ` (${caseData.client.company})` : ''} — ${caseData.client.clientType}, ${caseData.client.city || ''} ${caseData.client.country || ''}`
      : 'Non renseigné'

    const adversary = caseData.adversary || 'Non renseigné'
    const assignedLawyers = caseData.assignments
      .map((a) => a.user.name)
      .join(', ') || 'Non assigné'

    const chronologie = caseData.events
      .map((e) => {
        const dateStr = new Date(e.startTime).toLocaleDateString('fr-FR')
        const attendees = e.assignments.map((a) => a.user.name).join(', ')
        return `[${dateStr}] ${e.eventType.toUpperCase()}: ${e.title}${e.location ? ` — ${e.location}` : ''}${attendees ? ` (Participants: ${attendees})` : ''}`
      })
      .join('\n') || 'Aucun événement'

    const notesList = caseData.notes
      .map((n) => `[${new Date(n.createdAt).toLocaleDateString('fr-FR')}] ${n.user?.name || 'Système'}: ${n.content}`)
      .join('\n') || 'Aucune note'

    const documentsList = caseData.documents
      .map((d) => `- ${d.name} (${d.fileType}, ${d.folder || 'Pas de dossier'}, ${d.isFinal ? 'Version finale' : `v${d.version}`})`)
      .join('\n') || 'Aucun document'

    const tasksList = caseData.tasks
      .map((t) => `- [${t.status}] ${t.priority.toUpperCase()}: ${t.title}${t.dueDate ? ` (échéance: ${new Date(t.dueDate).toLocaleDateString('fr-FR')})` : ''}${t.user ? ` — ${t.user.name}` : ''}`)
      .join('\n') || 'Aucune tâche'

    const invoicesList = caseData.invoices
      .map((inv) => `- ${inv.type.toUpperCase()} ${inv.reference}: ${inv.amount.toLocaleString('fr-FR')} ${inv.currencyCode} [${inv.status}]${inv.notes ? ` — ${inv.notes}` : ''}`)
      .join('\n') || 'Aucune facture'

    const prompt = `Tu es un assistant juridique expert. Analyse le dossier suivant et fournis une analyse structurée.

## Dossier
- Référence: ${caseData.reference}
- Titre: ${caseData.title}
- Description: ${caseData.description || 'Non renseignée'}
- Type: ${caseData.type}
- Statut: ${caseData.status}
- Priorité: ${caseData.priority}
- Juridiction: ${caseData.jurisdiction || 'Non renseignée'}
- Montant en litige: ${caseData.amountInDispute ? caseData.amountInDispute.toLocaleString('fr-FR') + ' XAF' : 'Non renseigné'}
- Mode de facturation: ${caseData.billingType || 'Non renseigné'}

## Parties
- Client: ${clientInfo}
- Partie adverse: ${adversary}
- Avocats assignés: ${assignedLawyers}
- Cabinet: ${caseData.tenant.name}

## Chronologie des événements
${chronologie}

## Notes du dossier
${notesList}

## Documents
${documentsList}

## Tâches en cours
${tasksList}

## Facturation
${invoicesList}

---

Fournis ton analyse sous la forme suivante:
1. **Résumé** — Synthèse du dossier en 3-5 phrases
2. **Chronologie** — Frise chronologique des faits marquants
3. **Parties** — Analyse des parties et de leurs positions
4. **Questions juridiques** — Liste des questions juridiques soulevées
5. **Risques** — Identification des risques (juridiques, financiers, procéduraux)
6. **Pièces manquantes** — Liste des pièces probablement manquantes
7. **Échéances** — Prochaines échéances et délais à respecter
8. **Actions recommandées** — Liste priorisée d'actions à entreprendre`

    return NextResponse.json({
      success: true,
      caseData,
      prompt,
    })
  } catch (error) {
    console.error('Analyze case error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
