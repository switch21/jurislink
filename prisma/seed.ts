import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
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
    data: { name: 'Cabinet Mbeki & Associés', slug: 'mbeki-associes', plan: 'premium', maxUsers: 10, maxStorageGb: 20, address: 'Douala, Cameroun', phone: '+237 6 99 88 77 66' }
  });
  const tenant2 = await prisma.tenant.create({
    data: { name: 'Etude Ndong Avocats', slug: 'ndong-avocats', plan: 'starter', maxUsers: 3, maxStorageGb: 5, address: 'Libreville, Gabon', phone: '+241 07 44 33 22' }
  });

  const hashPw = (pw: string) => hash(pw, 10);

  // Root admin
  const rootAdmin = await prisma.user.create({
    data: { email: 'admin@jurislink.com', name: 'Administrateur Système', role: 'root_admin', password: await hashPw('Admin@123'), isActive: true, preferredLanguage: 'fr' }
  });

  // Tenant 1 Users
  const firmAdmin1 = await prisma.user.create({
    data: { email: 'mbeki@jurislink.com', name: 'Maître Mbeki', role: 'firm_admin', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 11 22 33', isActive: true }
  });
  const lawyer1 = await prisma.user.create({
    data: { email: 'ngassa@jurislink.com', name: 'Me Ngassa Paul', role: 'lawyer', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 55 44 33', isActive: true }
  });
  const lawyer2 = await prisma.user.create({
    data: { email: 'fotso@jurislink.com', name: 'Me Fotso Marie', role: 'lawyer', password: await hashPw('Admin@123'), tenantId: tenant1.id, phone: '+237 6 77 88 99', isActive: true }
  });
  const secretary1 = await prisma.user.create({
    data: { email: 'ache@jurislink.com', name: 'Ache Clémentine', role: 'secretary', password: await hashPw('Admin@123'), tenantId: tenant1.id, isActive: true }
  });

  // Tenant 2 Users
  const firmAdmin2 = await prisma.user.create({
    data: { email: 'ndong@jurislink.com', name: 'Me Ndong', role: 'firm_admin', password: await hashPw('Admin@123'), tenantId: tenant2.id, isActive: true }
  });

  // Tenant 1 Clients
  const client1 = await prisma.client.create({
    data: { firstName: 'Jean', lastName: 'Kamga', email: 'j.kamga@email.com', phone: '+237 6 99 11 22', company: 'Kamga SARL', address: 'Yaoundé, Cameroun', tenantId: tenant1.id }
  });
  const client2 = await prisma.client.create({
    data: { firstName: 'Fatou', lastName: 'Diallo', email: 'f.diallo@email.com', phone: '+237 6 88 22 11', company: 'Diallo & Fils', tenantId: tenant1.id }
  });
  const client3 = await prisma.client.create({
    data: { firstName: 'Ibrahim', lastName: 'Hadj', email: 'i.hadj@email.com', phone: '+237 6 77 33 44', tenantId: tenant1.id }
  });
  const client4 = await prisma.client.create({
    data: { firstName: 'Aïcha', lastName: 'Bello', email: 'a.bello@email.com', phone: '+237 6 66 55 44', company: 'Bello Enterprises', tenantId: tenant1.id }
  });
  const client5 = await prisma.client.create({
    data: { firstName: 'Olivier', lastName: 'Dupont', email: 'o.dupont@email.com', phone: '+237 6 55 66 77', tenantId: tenant1.id }
  });

  // Tenant 1 Cases
  const case1 = await prisma.case.create({
    data: { reference: 'DOU-2025-001', title: 'Litige foncier Kamga SARL', description: 'Contentieux portant sur un terrain de 2000m² à Douala Bonapriso', type: 'civil', status: 'en_cours', priority: 'haute', clientId: client1.id, tenantId: tenant1.id, nextDueDate: new Date('2025-08-15') }
  });
  const case2 = await prisma.case.create({
    data: { reference: 'DOU-2025-002', title: 'Licenciement abusif - Diallo', description: 'Contestation d\'un licenciement sans motif légitime', type: 'social', status: 'ouvert', priority: 'normal', clientId: client2.id, tenantId: tenant1.id, nextDueDate: new Date('2025-07-20') }
  });
  const case3 = await prisma.case.create({
    data: { reference: 'DOU-2025-003', title: 'Recouvrement créances Hadj', description: 'Recouvrement de créances impayées d\'un montant de 15M FCFA', type: 'commercial', status: 'en_attente', priority: 'haute', clientId: client3.id, tenantId: tenant1.id, nextDueDate: new Date('2025-07-10') }
  });
  const case4 = await prisma.case.create({
    data: { reference: 'DOU-2025-004', title: 'Divorce Bello', description: 'Procédure de divorce contentieux', type: 'civil', status: 'nouveau', priority: 'bas', isSecret: true, clientId: client4.id, tenantId: tenant1.id }
  });
  const case5 = await prisma.case.create({
    data: { reference: 'DOU-2024-010', title: 'Constitution société Dupont', description: 'Création de SARL et formalités associées', type: 'commercial', status: 'clos', outcome: 'favorable', clientId: client5.id, tenantId: tenant1.id, closingDate: new Date('2025-03-15') }
  });

  // Case Assignments
  await prisma.caseAssignment.createMany({ data: [
    { userId: lawyer1.id, caseId: case1.id },
    { userId: lawyer2.id, caseId: case1.id },
    { userId: lawyer1.id, caseId: case2.id },
    { userId: lawyer2.id, caseId: case3.id },
    { userId: lawyer1.id, caseId: case4.id },
  ]});

  // Events
  const now = new Date();
  const events = [
    { title: 'Audience - TGI Douala', description: 'Audience principale dossier Kamga', startTime: new Date(now.getTime() + 86400000), eventType: 'audience', criticality: 'haute', tenantId: tenant1.id, caseId: case1.id },
    { title: 'Réunion client Diallo', description: 'Préparation du dossier', startTime: new Date(now.getTime() + 172800000), eventType: 'rdv', criticality: 'normal', tenantId: tenant1.id, caseId: case2.id },
    { title: 'Échéance dépôt mémoire', description: 'Dépôt du mémoire en défense', startTime: new Date(now.getTime() + 259200000), eventType: 'echeance', criticality: 'urgente', tenantId: tenant1.id, caseId: case3.id },
    { title: 'Consultation M. Dupont', description: 'Première consultation', startTime: new Date(now.getTime() + 345600000), eventType: 'rdv', criticality: 'bas', tenantId: tenant1.id, caseId: case5.id },
    { title: 'Audience - Tribunal Commerce', description: 'Affaire recouvrement', startTime: new Date(now.getTime() + 518400000), eventType: 'audience', criticality: 'haute', tenantId: tenant1.id, caseId: case3.id },
  ];

  for (const ev of events) {
    const created = await prisma.event.create({ data: ev });
    if (ev.caseId === case1.id) {
      await prisma.eventAssignment.create({ data: { userId: lawyer1.id, eventId: created.id } });
      await prisma.eventAssignment.create({ data: { userId: lawyer2.id, eventId: created.id } });
    } else if (ev.caseId === case2.id) {
      await prisma.eventAssignment.create({ data: { userId: lawyer1.id, eventId: created.id } });
    }
  }

  // Invoices
  await prisma.invoice.createMany({ data: [
    { reference: 'FAC-2025-001', amount: 500000, status: 'paye', paidAmount: 500000, paidDate: new Date('2025-02-15'), clientId: client1.id, tenantId: tenant1.id, caseId: case1.id, currencyCode: 'XAF' },
    { reference: 'FAC-2025-002', amount: 300000, status: 'partiel', paidAmount: 150000, clientId: client2.id, tenantId: tenant1.id, caseId: case2.id, currencyCode: 'XAF', dueDate: new Date('2025-07-30') },
    { reference: 'FAC-2025-003', amount: 750000, status: 'non_paye', clientId: client3.id, tenantId: tenant1.id, caseId: case3.id, currencyCode: 'XAF', dueDate: new Date('2025-07-15') },
    { reference: 'FAC-2024-015', amount: 200000, status: 'paye', paidAmount: 200000, paidDate: new Date('2025-01-20'), clientId: client5.id, tenantId: tenant1.id, caseId: case5.id, currencyCode: 'XAF' },
    { reference: 'FAC-2025-004', amount: 150000, status: 'annule', clientId: client4.id, tenantId: tenant1.id, caseId: case4.id, currencyCode: 'XAF' },
  ]});

  // Case Notes
  await prisma.caseNote.createMany({ data: [
    { content: 'Première audience reportée. Le tribunal a demandé des pièces complémentaires.', caseId: case1.id, userId: lawyer1.id },
    { content: 'Documents complémentaires collectés auprès du client. Prêts pour le dépôt.', caseId: case1.id, userId: lawyer2.id },
    { content: 'Le client a fourni le contrat de travail et les fiches de paie.', caseId: case2.id, userId: lawyer1.id },
  ]});

  // Notifications
  await prisma.notification.createMany({ data: [
    { title: 'Audience demain', message: 'Audience TGI Douala pour le dossier Kamga prévue demain à 9h.', category: 'dossier', resourceType: 'event', resourceId: '1', tenantId: tenant1.id, userId: lawyer1.id },
    { title: 'Facture impayée', message: 'La facture FAC-2025-003 de 750 000 FCFA est en retard.', category: 'facture', resourceType: 'invoice', resourceId: '3', tenantId: tenant1.id, userId: firmAdmin1.id },
    { title: 'Nouveau dossier', message: 'Un nouveau dossier a été créé : Constitution société Dupont.', category: 'dossier', resourceType: 'case', resourceId: '5', tenantId: tenant1.id, userId: secretary1.id },
    { title: 'Échéance proche', message: 'Le dépôt de mémoire pour le dossier Hadj est dans 3 jours.', category: 'echeance', resourceType: 'event', resourceId: '3', tenantId: tenant1.id, userId: lawyer2.id },
    { title: 'Document téléchargé', message: 'Le contrat de bail a été téléchargé par Me Ngassa.', category: 'document', resourceType: 'document', resourceId: '1', tenantId: tenant1.id, userId: firmAdmin1.id },
  ]});

  // Messages
  await prisma.message.createMany({ data: [
    { content: 'Bonjour, avez-vous les pièces pour l\'audience de demain ?', tenantId: tenant1.id, senderId: lawyer1.id, receiverId: lawyer2.id, isRead: true },
    { content: 'Oui, tout est prêt. Je vous les envoie par mail.', tenantId: tenant1.id, senderId: lawyer2.id, receiverId: lawyer1.id, isRead: true },
    { content: 'Merci ! On se retrouve au tribunal à 8h30.', tenantId: tenant1.id, senderId: lawyer1.id, receiverId: lawyer2.id, isRead: false },
    { content: 'Bien noté. À demain !', tenantId: tenant1.id, senderId: lawyer2.id, receiverId: lawyer1.id, isRead: false },
    { content: 'Le client Kamga souhaite fixer un rendez-vous cette semaine.', tenantId: tenant1.id, senderId: secretary1.id, receiverId: lawyer1.id, isRead: false },
  ]});

  // Audit logs
  await prisma.auditLog.createMany({ data: [
    { action: 'LOGIN', userId: lawyer1.id, tenantId: tenant1.id, ipAddress: '192.168.1.10' },
    { action: 'CASE_CREATED', resourceType: 'case', resourceId: case5.id, userId: lawyer1.id, tenantId: tenant1.id },
    { action: 'INVOICE_CREATED', resourceType: 'invoice', userId: firmAdmin1.id, tenantId: tenant1.id },
    { action: 'CLIENT_CREATED', resourceType: 'client', resourceId: client5.id, userId: secretary1.id, tenantId: tenant1.id },
    { action: 'DOCUMENT_UPLOADED', resourceType: 'document', userId: lawyer2.id, tenantId: tenant1.id },
  ]});

  console.log('✅ Seed data created successfully');
  console.log(`  Root admin: admin@jurislink.com / Admin@123`);
  console.log(`  Firm admin: mbeki@jurislink.com / Admin@123`);
  console.log(`  Lawyer:     ngassa@jurislink.com / Admin@123`);
  console.log(`  Lawyer:     fotso@jurislink.com / Admin@123`);
  console.log(`  Secretary:  ache@jurislink.com / Admin@123`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
