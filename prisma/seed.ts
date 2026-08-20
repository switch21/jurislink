import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.task.deleteMany();
  await prisma.caseNote.deleteMany();
  await prisma.eventAssignment.deleteMany();
  await prisma.caseAssignment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.event.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.case.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.currency.deleteMany();

  // Currencies
  const xaf = await prisma.currency.create({ data: { code: 'XAF', name: 'Franc CFA (BEAC)', symbol: 'FCFA' } });
  const xof = await prisma.currency.create({ data: { code: 'XOF', name: 'Franc CFA (BCEAO)', symbol: 'FCFA' } });
  await prisma.currency.create({ data: { code: 'EUR', name: 'Euro', symbol: '€' } });
  await prisma.currency.create({ data: { code: 'USD', name: 'Dollar US', symbol: '$' } });

  // Tenants
  const tenant1 = await prisma.tenant.create({
    data: { name: 'Cabinet Mbeki & Associés', slug: 'mbeki-associes', plan: 'premium', maxUsers: 10, maxStorageGb: 20, address: 'Douala, Cameroun', phone: '+237 6 99 88 77 66', email: 'contact@mbeki-associes.com' }
  });
  const tenant2 = await prisma.tenant.create({
    data: { name: 'Etude Ndong Avocats', slug: 'ndong-avocats', plan: 'starter', maxUsers: 3, maxStorageGb: 5, address: 'Libreville, Gabon', phone: '+241 07 44 33 22' }
  });

  const hashPw = (pw: string) => hash(pw, 10);

  // Root admin
  const rootAdmin = await prisma.user.create({
    data: { email: 'admin@jurislink.com', name: 'Administrateur Système', role: 'root_admin', password: await hashPw('Admin@123'), isActive: true, preferredLanguage: 'fr' }
  });

  // Tenant 1 Users (7 roles)
  const firmAdmin1 = await prisma.user.create({
    data: { email: 'mbeki@jurislink.com', name: 'Maître Mbeki', role: 'associate', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 11 22 33', isActive: true }
  });
  const lawyer1 = await prisma.user.create({
    data: { email: 'ngassa@jurislink.com', name: 'Me Ngassa Paul', role: 'lawyer', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 55 44 33', isActive: true }
  });
  const lawyer2 = await prisma.user.create({
    data: { email: 'fotso@jurislink.com', name: 'Me Fotso Marie', role: 'lawyer', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 77 88 99', isActive: true }
  });
  const jurist1 = await prisma.user.create({
    data: { email: 'tchinda@jurislink.com', name: 'Tchinda Armand', role: 'jurist', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 33 22 11', isActive: true }
  });
  const assistant1 = await prisma.user.create({
    data: { email: 'ache@jurislink.com', name: 'Ache Clémentine', role: 'assistant', password: await hashPw('Admin@123'), tenantId: tenant1.id, isActive: true }
  });
  const accountant1 = await prisma.user.create({
    data: { email: 'kamga.cpt@jurislink.com', name: 'Kamga Comptable', role: 'accountant', password: await hashPw('Admin@123'), tenantId: tenant1.id, isActive: true }
  });

  // Tenant 2 Users
  const firmAdmin2 = await prisma.user.create({
    data: { email: 'ndong@jurislink.com', name: 'Me Ndong', role: 'associate', password: await hashPw('Admin@123'), tenantId: tenant2.id, isActive: true }
  });

  // Tenant 1 Clients (enhanced with CRM fields)
  const client1 = await prisma.client.create({
    data: { firstName: 'Jean', lastName: 'Kamga', email: 'j.kamga@email.com', phone: '+237 6 99 11 22', company: 'Kamga SARL', address: 'Rue Joss, Douala', city: 'Douala', country: 'Cameroun', clientType: 'entreprise', niu: '123456789A', riskLevel: 'moyen', source: 'recommandation', notes: 'Client fidèle depuis 2022', tenantId: tenant1.id }
  });
  const client2 = await prisma.client.create({
    data: { firstName: 'Fatou', lastName: 'Diallo', email: 'f.diallo@email.com', phone: '+237 6 88 22 11', company: 'Diallo & Fils', city: 'Douala', country: 'Cameroun', clientType: 'entreprise', riskLevel: 'faible', source: 'internet', tenantId: tenant1.id }
  });
  const client3 = await prisma.client.create({
    data: { firstName: 'Ibrahim', lastName: 'Hadj', email: 'i.hadj@email.com', phone: '+237 6 77 33 44', city: 'Yaoundé', country: 'Cameroun', clientType: 'particulier', riskLevel: 'eleve', source: 'bouche_a_oreille', notes: 'Difficultés de paiement antérieures', tenantId: tenant1.id }
  });
  const client4 = await prisma.client.create({
    data: { firstName: 'Aïcha', lastName: 'Bello', email: 'a.bello@email.com', phone: '+237 6 66 55 44', company: 'Bello Enterprises', city: 'Douala', country: 'Cameroun', clientType: 'entreprise', riskLevel: 'faible', tenantId: tenant1.id }
  });
  const client5 = await prisma.client.create({
    data: { firstName: 'Olivier', lastName: 'Dupont', email: 'o.dupont@email.com', phone: '+237 6 55 66 77', city: 'Douala', country: 'Cameroun', clientType: 'particulier', riskLevel: 'faible', source: 'internet', tenantId: tenant1.id }
  });
  const client6 = await prisma.client.create({
    data: { firstName: 'Pierre', lastName: 'Epee', email: 'p.epee@email.com', phone: '+237 6 44 33 22', company: 'Epee & Co', city: 'Douala', country: 'Cameroun', clientType: 'entreprise', niu: '987654321B', riskLevel: 'moyen', source: 'recommandation', notes: 'Ancien client du cabinet Ndong', tenantId: tenant1.id }
  });

  // Tenant 1 Cases (enhanced with adversary, jurisdiction, amountInDispute, billingType)
  const case1 = await prisma.case.create({
    data: { reference: 'DOU-2025-001', title: 'Litige foncier Kamga SARL', description: 'Contentieux portant sur un terrain de 2000m² à Douala Bonapriso', type: 'civil', status: 'en_cours', priority: 'haute', clientId: client1.id, tenantId: tenant1.id, nextDueDate: new Date(Date.now() + 2 * 86400000), adversary: 'Société ABC Immo', jurisdiction: 'Tribunal de Première Instance de Douala', amountInDispute: 25000000, billingType: 'forfait' }
  });
  const case2 = await prisma.case.create({
    data: { reference: 'DOU-2025-002', title: 'Licenciement abusif - Diallo', description: 'Contestation d\'un licenciement sans motif légitime', type: 'social', status: 'ouvert', priority: 'normal', clientId: client2.id, tenantId: tenant1.id, nextDueDate: new Date(Date.now() + 5 * 86400000), adversary: 'Société Diallo & Fils (employeur)', jurisdiction: 'Tribunal du Travail de Douala', amountInDispute: 8000000, billingType: 'horaire' }
  });
  const case3 = await prisma.case.create({
    data: { reference: 'DOU-2025-003', title: 'Recouvrement créances Hadj', description: 'Recouvrement de créances impayées d\'un montant de 15M FCFA', type: 'commercial', status: 'en_attente', priority: 'haute', clientId: client3.id, tenantId: tenant1.id, nextDueDate: new Date(Date.now() + 1 * 86400000), adversary: 'Société XYZ Trading', jurisdiction: 'Tribunal de Commerce de Douala', amountInDispute: 15000000, billingType: 'provision' }
  });
  const case4 = await prisma.case.create({
    data: { reference: 'DOU-2025-004', title: 'Divorce Bello', description: 'Procédure de divorce contentieux', type: 'civil', status: 'nouveau', priority: 'bas', isSecret: true, clientId: client4.id, tenantId: tenant1.id, jurisdiction: 'Tribunal de Première Instance de Douala' }
  });
  const case5 = await prisma.case.create({
    data: { reference: 'DOU-2024-010', title: 'Constitution société Dupont', description: 'Création de SARL et formalités associées', type: 'commercial', status: 'clos', outcome: 'favorable', clientId: client5.id, tenantId: tenant1.id, closingDate: new Date('2025-03-15'), billingType: 'forfait' }
  });
  const case6 = await prisma.case.create({
    data: { reference: 'DOU-2025-005', title: 'Litige commercial Epee c/ Société X', description: 'Litige portant sur la livraison de marchandises non conformes', type: 'commercial', status: 'en_cours', priority: 'urgente', clientId: client6.id, tenantId: tenant1.id, nextDueDate: new Date(Date.now() + 1 * 86400000), adversary: 'Société X Import-Export', jurisdiction: 'Tribunal de Commerce de Douala', amountInDispute: 35000000, billingType: 'success_fee' }
  });

  // Case Assignments
  await prisma.caseAssignment.createMany({ data: [
    { userId: lawyer1.id, caseId: case1.id },
    { userId: lawyer2.id, caseId: case1.id },
    { userId: jurist1.id, caseId: case1.id },
    { userId: lawyer1.id, caseId: case2.id },
    { userId: assistant1.id, caseId: case2.id },
    { userId: lawyer2.id, caseId: case3.id },
    { userId: jurist1.id, caseId: case3.id },
    { userId: lawyer1.id, caseId: case4.id },
    { userId: lawyer1.id, caseId: case5.id },
    { userId: lawyer1.id, caseId: case6.id },
    { userId: lawyer2.id, caseId: case6.id },
  ]});

  // Events (some very soon for urgency testing)
  const now = new Date();
  const ev1 = await prisma.event.create({ data: { title: 'Audience - TGI Douala', description: 'Audience principale dossier Kamga', startTime: new Date(now.getTime() + 2 * 86400000), eventType: 'audience', criticality: 'urgente', tenantId: tenant1.id, caseId: case1.id, location: 'TPI Douala, Salle A' } });;
  const ev2 = await prisma.event.create({ data: { title: 'Réunion client Diallo', description: 'Préparation du dossier', startTime: new Date(now.getTime() + 3 * 86400000), eventType: 'rdv', criticality: 'normal', tenantId: tenant1.id, caseId: case2.id } });
  const ev3 = await prisma.event.create({ data: { title: 'Échéance dépôt mémoire', description: 'Dépôt du mémoire en défense pour Hadj', startTime: new Date(now.getTime() + 1 * 86400000), eventType: 'echeance', criticality: 'urgente', tenantId: tenant1.id, caseId: case3.id } });
  const ev4 = await prisma.event.create({ data: { title: 'Consultation M. Dupont', description: 'Première consultation', startTime: new Date(now.getTime() + 5 * 86400000), eventType: 'rdv', criticality: 'bas', tenantId: tenant1.id, caseId: case5.id } });
  const ev5 = await prisma.event.create({ data: { title: 'Audience - Tribunal Commerce', description: 'Affaire recouvrement créances Hadj', startTime: new Date(now.getTime() + 6 * 86400000), eventType: 'audience', criticality: 'haute', tenantId: tenant1.id, caseId: case3.id, location: 'TC Douala' } });
  const ev6 = await prisma.event.create({ data: { title: 'Audience urgente Epee', description: 'Ordonnance de référé - dossier Epee c/ Société X', startTime: new Date(now.getTime() + 0.5 * 86400000), eventType: 'audience', criticality: 'urgente', tenantId: tenant1.id, caseId: case6.id, location: 'TC Douala, Urgences' } });
  const ev7 = await prisma.event.create({ data: { title: 'Dépôt conclusions Kamga', description: 'Dépôt des conclusions récapitulatives', startTime: new Date(now.getTime() + 4 * 86400000), eventType: 'depot', criticality: 'haute', tenantId: tenant1.id, caseId: case1.id } });

  // Event Assignments
  await prisma.eventAssignment.createMany({ data: [
    { userId: lawyer1.id, eventId: ev1.id }, { userId: lawyer2.id, eventId: ev1.id },
    { userId: lawyer1.id, eventId: ev2.id },
    { userId: lawyer2.id, eventId: ev3.id }, { userId: jurist1.id, eventId: ev3.id },
    { userId: lawyer1.id, eventId: ev4.id },
    { userId: lawyer1.id, eventId: ev5.id }, { userId: lawyer2.id, eventId: ev5.id },
    { userId: lawyer1.id, eventId: ev6.id }, { userId: lawyer2.id, eventId: ev6.id },
    { userId: lawyer1.id, eventId: ev7.id }, { userId: jurist1.id, eventId: ev7.id },
  ]});

  // Invoices (some overdue)
  await prisma.invoice.createMany({ data: [
    { reference: 'FAC-2025-001', amount: 500000, status: 'paye', paidAmount: 500000, paidDate: new Date('2025-02-15'), clientId: client1.id, tenantId: tenant1.id, caseId: case1.id, currencyCode: 'XAF', paymentMethod: 'virement' },
    { reference: 'FAC-2025-002', amount: 300000, status: 'partiel', paidAmount: 150000, clientId: client2.id, tenantId: tenant1.id, caseId: case2.id, currencyCode: 'XAF', dueDate: new Date('2025-06-01'), paymentMethod: 'virement' },
    { reference: 'FAC-2025-003', amount: 750000, status: 'non_paye', clientId: client3.id, tenantId: tenant1.id, caseId: case3.id, currencyCode: 'XAF', dueDate: new Date('2025-06-15') },
    { reference: 'FAC-2024-015', amount: 200000, status: 'paye', paidAmount: 200000, paidDate: new Date('2025-01-20'), clientId: client5.id, tenantId: tenant1.id, caseId: case5.id, currencyCode: 'XAF' },
    { reference: 'FAC-2025-004', amount: 150000, status: 'annule', clientId: client4.id, tenantId: tenant1.id, caseId: case4.id, currencyCode: 'XAF' },
    { reference: 'FAC-2025-005', amount: 1200000, status: 'non_paye', clientId: client6.id, tenantId: tenant1.id, caseId: case6.id, currencyCode: 'XAF', dueDate: new Date('2025-06-10') },
    { reference: 'FAC-2025-006', amount: 250000, status: 'paye', paidAmount: 250000, paidDate: new Date('2025-07-01'), clientId: client1.id, tenantId: tenant1.id, caseId: case1.id, currencyCode: 'XAF', paymentMethod: 'mobile_money' },
  ]});

  // Documents (with folders and tags)
  await prisma.document.createMany({ data: [
    { name: 'Assignation TGI', fileName: 'assignation_tgi_kamga.pdf', fileType: 'pdf', fileSize: 245760, filePath: '/uploads/assignation_tgi_kamga.pdf', version: 1, folder: 'Procédure', tags: 'assignation,tribunal,tgi', description: 'Assignation du TGI de Douala pour le litige foncier', tenantId: tenant1.id, caseId: case1.id, userId: lawyer1.id },
    { name: 'Titre foncier', fileName: 'titre_foncier_kamga.pdf', fileType: 'pdf', fileSize: 524288, filePath: '/uploads/titre_foncier_kamga.pdf', version: 1, folder: 'Pièces client', tags: 'foncier,titre,propriété', description: 'Copie du titre foncier contesté', tenantId: tenant1.id, caseId: case1.id, userId: lawyer2.id },
    { name: 'Contrat de travail', fileName: 'contrat_diallo.pdf', fileType: 'pdf', fileSize: 184320, filePath: '/uploads/contrat_diallo.pdf', version: 1, folder: 'Contrats', tags: 'travail,cdi', description: 'Contrat de travail de M. Diallo', tenantId: tenant1.id, caseId: case2.id, userId: lawyer1.id },
    { name: 'Fiches de paie', fileName: 'fiches_paie_diallo.pdf', fileType: 'pdf', fileSize: 327680, filePath: '/uploads/fiches_paie_diallo.pdf', version: 1, folder: 'Pièces client', tags: 'paie,salaire', description: 'Fiches de paie des 12 derniers mois', tenantId: tenant1.id, caseId: case2.id, userId: assistant1.id },
    { name: 'Facture impayée', fileName: 'facture_hadj.pdf', fileType: 'pdf', fileSize: 102400, filePath: '/uploads/facture_hadj.pdf', version: 1, folder: 'Factures', tags: 'facture,impayé', description: 'Facture impayée de 15M FCFA', tenantId: tenant1.id, caseId: case3.id, userId: lawyer2.id },
    { name: 'Mise en demeure', fileName: 'mise_en_demeure_hadj.pdf', fileType: 'pdf', fileSize: 81920, filePath: '/uploads/mise_en_demeure_hadj.pdf', version: 1, folder: 'Correspondances', tags: 'mise_en_demeure,relance', description: 'Lettre de mise en demeure envoyée', tenantId: tenant1.id, caseId: case3.id, userId: lawyer1.id },
    { name: 'Acte de mariage', fileName: 'acte_mariage_bello.pdf', fileType: 'pdf', fileSize: 204800, filePath: '/uploads/acte_mariage_bello.pdf', version: 1, folder: 'Pièces client', tags: 'mariage,etat_civil', description: 'Acte de mariage du couple Bello', tenantId: tenant1.id, caseId: case4.id, userId: lawyer1.id },
    { name: 'Statuts SARL', fileName: 'statuts_dupont_sarl.pdf', fileType: 'pdf', fileSize: 409600, filePath: '/uploads/statuts_dupont_sarl.pdf', version: 1, folder: 'Contrats', tags: 'statuts,sarl,constitution', description: 'Statuts de la SARL Dupont', tenantId: tenant1.id, caseId: case5.id, userId: lawyer1.id },
    { name: 'PV AG constitutive', fileName: 'pv_ag_dupont.pdf', fileType: 'pdf', fileSize: 153600, filePath: '/uploads/pv_ag_dupont.pdf', version: 1, folder: 'Procédure', tags: 'pv,ag,constitutive', isFinal: true, description: 'PV de l\'assemblée générale constitutive', tenantId: tenant1.id, caseId: case5.id, userId: assistant1.id },
    { name: 'Commande marchandises', fileName: 'commande_epee.pdf', fileType: 'pdf', fileSize: 125000, filePath: '/uploads/commande_epee.pdf', version: 1, folder: 'Pièces client', tags: 'commande,marchandises', description: 'Bon de commande initial', tenantId: tenant1.id, caseId: case6.id, userId: lawyer1.id },
    { name: 'Conclusions récapitulatives v2', fileName: 'conclusions_kamga_v2.pdf', fileType: 'pdf', fileSize: 310000, filePath: '/uploads/conclusions_kamga_v2.pdf', version: 2, folder: 'Procédure', tags: 'conclusions,récapitulatives', isFinal: true, description: 'Conclusions récapitulatives mises à jour', tenantId: tenant1.id, caseId: case1.id, userId: lawyer1.id },
  ]});

  // Case Notes
  await prisma.caseNote.createMany({ data: [
    { content: 'Première audience reportée. Le tribunal a demandé des pièces complémentaires.', caseId: case1.id, userId: lawyer1.id },
    { content: 'Documents complémentaires collectés auprès du client. Prêts pour le dépôt.', caseId: case1.id, userId: lawyer2.id },
    { content: 'Le client a fourni le contrat de travail et les fiches de paie.', caseId: case2.id, userId: lawyer1.id },
    { content: 'Dépôt de mémoire urgent. Client Hadj très préoccupé par les délais.', caseId: case3.id, userId: lawyer2.id },
    { content: 'Ordonnance de référé obtenue! Le juge a suspendu l\'exécution.', caseId: case6.id, userId: lawyer1.id },
  ]});

  // Tasks (manual and auto-generated)
  await prisma.task.createMany({ data: [
    { title: 'Vérifier dossier Kamga avant audience', description: 'Revoir toutes les pièces et préparer la trame argumentaire', status: 'en_cours', priority: 'urgente', dueDate: new Date(now.getTime() + 1 * 86400000), tenantId: tenant1.id, caseId: case1.id, userId: lawyer1.id, creatorId: lawyer1.id, eventId: ev1.id },
    { title: 'Préparer conclusions récapitulatives', description: 'Rédiger les conclusions pour le dossier Kamga', status: 'a_faire', priority: 'haute', dueDate: new Date(now.getTime() + 3 * 86400000), tenantId: tenant1.id, caseId: case1.id, userId: lawyer2.id, creatorId: lawyer1.id, eventId: ev7.id },
    { title: 'Dépôt mémoire défense Hadj', description: 'Finaliser et déposer le mémoire en défense', status: 'a_faire', priority: 'urgente', dueDate: new Date(now.getTime() + 1 * 86400000), tenantId: tenant1.id, caseId: case3.id, userId: lawyer2.id, creatorId: lawyer2.id, eventId: ev3.id },
    { title: 'Préparer pièces audience Epee', description: 'Rassembler tous les documents pour l\'ordonnance de référé', status: 'a_faire', priority: 'urgente', dueDate: new Date(now.getTime() + 0.25 * 86400000), tenantId: tenant1.id, caseId: case6.id, userId: lawyer1.id, creatorId: lawyer1.id, eventId: ev6.id },
    { title: 'Rédiger mise en demeure complémentaire', description: 'Suite au non-paiement de la FAC-2025-003', status: 'en_cours', priority: 'haute', dueDate: new Date(now.getTime() + 2 * 86400000), tenantId: tenant1.id, caseId: case3.id, userId: jurist1.id, creatorId: lawyer2.id },
    { title: 'Relancer client Diallo pour paiement', description: 'Second rappel pour solde restant FAC-2025-002', status: 'a_faire', priority: 'normale', dueDate: new Date(now.getTime() + 4 * 86400000), tenantId: tenant1.id, caseId: case2.id, userId: assistant1.id, creatorId: accountant1.id },
    { title: 'Préparer rendez-vous client Dupont', description: 'Vérifier les documents de constitution SARL', status: 'terminee', priority: 'basse', dueDate: new Date(now.getTime() + 4 * 86400000), completedAt: new Date(now.getTime() - 1 * 86400000), tenantId: tenant1.id, caseId: case5.id, userId: assistant1.id, creatorId: lawyer1.id, eventId: ev4.id },
    { title: 'Archiver dossier Dupont', description: 'Classement définitif du dossier de constitution', status: 'terminee', priority: 'normale', completedAt: new Date(now.getTime() - 5 * 86400000), tenantId: tenant1.id, caseId: case5.id, userId: assistant1.id, creatorId: lawyer1.id },
  ]});

  // Notifications (with priorities)
  await prisma.notification.createMany({ data: [
    { title: '🔴 Audience dans 2 jours', message: 'Dossier Kamga — Audience TGI Douala prévue dans 48h. Aucune note de préparation.', category: 'echeance', priority: 'critical', resourceType: 'event', resourceId: ev1.id, tenantId: tenant1.id, userId: lawyer1.id },
    { title: '🔴 Échéance dépôt mémoire demain', message: 'Le mémoire en défense du dossier Hadj doit être déposé demain.', category: 'echeance', priority: 'critical', resourceType: 'event', resourceId: ev3.id, tenantId: tenant1.id, userId: lawyer2.id },
    { title: '🔴 Référé Epee dans 12h', message: 'Ordonnance de référé pour le dossier Epee c/ Société X dans 12 heures.', category: 'echeance', priority: 'critical', resourceType: 'event', resourceId: ev6.id, tenantId: tenant1.id, userId: lawyer1.id },
    { title: '⚠️ Facture impayée depuis 30 jours', message: 'La facture FAC-2025-003 de 750 000 FCFA est impayée depuis 30 jours.', category: 'facture', priority: 'urgent', resourceType: 'invoice', resourceId: '3', tenantId: tenant1.id, userId: firmAdmin1.id },
    { title: '⚠️ Facture impayée depuis 45 jours', message: 'La facture FAC-2025-005 de 1 200 000 FCFA est impayée depuis 45 jours.', category: 'facture', priority: 'urgent', resourceType: 'invoice', resourceId: '6', tenantId: tenant1.id, userId: accountant1.id },
    { title: '📋 Nouvelle tâche assignée', message: 'Vérifier le dossier Kamga avant audience.', category: 'tache', priority: 'warning', resourceType: 'task', resourceId: '1', tenantId: tenant1.id, userId: lawyer1.id },
    { title: '📋 Tâche urgente', message: 'Préparer les pièces pour l\'audience Epee.', category: 'tache', priority: 'urgent', resourceType: 'task', resourceId: '4', tenantId: tenant1.id, userId: lawyer1.id },
    { title: '📝 Document demandé', message: 'Le client Kamga n\'a pas encore envoyé le plan parcellaire.', category: 'document', priority: 'warning', tenantId: tenant1.id, userId: lawyer1.id },
  ]});

  // Messages
  await prisma.message.createMany({ data: [
    { content: 'Bonjour, avez-vous les pièces pour l\'audience de demain ?', tenantId: tenant1.id, senderId: lawyer1.id, receiverId: lawyer2.id, isRead: true },
    { content: 'Oui, tout est prêt. Je vous les envoie par mail.', tenantId: tenant1.id, senderId: lawyer2.id, receiverId: lawyer1.id, isRead: true },
    { content: 'Merci ! On se retrouve au tribunal à 8h30.', tenantId: tenant1.id, senderId: lawyer1.id, receiverId: lawyer2.id, isRead: false },
    { content: 'Bien noté. À demain !', tenantId: tenant1.id, senderId: lawyer2.id, receiverId: lawyer1.id, isRead: false },
    { content: 'Le client Kamga souhaite fixer un rendez-vous cette semaine.', tenantId: tenant1.id, senderId: assistant1.id, receiverId: lawyer1.id, isRead: false },
    { content: 'Les conclusions pour Epee sont prêtes. Il faut les faire signer.', tenantId: tenant1.id, senderId: jurist1.id, receiverId: lawyer1.id, isRead: false },
    { content: 'J\'ai préparé la mise en demeure Hadj. Peux-tu relancer ?', tenantId: tenant1.id, senderId: jurist1.id, receiverId: lawyer2.id, isRead: false },
  ]});

  // Audit logs
  await prisma.auditLog.createMany({ data: [
    { action: 'LOGIN', userId: lawyer1.id, tenantId: tenant1.id, ipAddress: '192.168.1.10' },
    { action: 'CASE_CREATED', resourceType: 'case', resourceId: case6.id, userId: lawyer1.id, tenantId: tenant1.id },
    { action: 'INVOICE_CREATED', resourceType: 'invoice', userId: accountant1.id, tenantId: tenant1.id },
    { action: 'CLIENT_CREATED', resourceType: 'client', resourceId: client6.id, userId: assistant1.id, tenantId: tenant1.id },
    { action: 'DOCUMENT_UPLOADED', resourceType: 'document', userId: lawyer2.id, tenantId: tenant1.id },
    { action: 'TASK_CREATED', resourceType: 'task', userId: lawyer1.id, tenantId: tenant1.id },
    { action: 'CASE_VIEWED', resourceType: 'case', resourceId: case1.id, userId: lawyer1.id, tenantId: tenant1.id },
  ]});

  console.log('✅ Seed data created successfully');
  console.log(`  Root admin:   admin@jurislink.com / Admin@123`);
  console.log(`  Associé:      mbeki@jurislink.com / Admin@123`);
  console.log(`  Avocat:       ngassa@jurislink.com / Admin@123`);
  console.log(`  Avocat:       fotso@jurislink.com / Admin@123`);
  console.log(`  Juriste:      tchinda@jurislink.com / Admin@123`);
  console.log(`  Assistant:    ache@jurislink.com / Admin@123`);
  console.log(`  Comptable:    kamga.cpt@jurislink.com / Admin@123`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
