-- ==============================================================
-- JURISLINK V2 — ALIGNMENT MIGRATION + EKOKA SEED DATA
-- Run this in the Supabase Dashboard SQL Editor
-- ==============================================================

SET ROLE postgres;

-- ==============================================================
-- PART 1: Add missing columns (idempotent)
-- ==============================================================

-- tasks: add priority column
DO $$ BEGIN ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'; EXCEPTION WHEN others THEN NULL; END $$;

-- clients: add missing columns
DO $$ BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'faible'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source TEXT; EXCEPTION WHEN others THEN NULL; END $$;

-- cases: add missing columns
DO $$ BEGIN ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS adversary TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS jurisdiction TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS amount_in_dispute NUMERIC(15,2); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS billing_type TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS criticality TEXT DEFAULT 'normal'; EXCEPTION WHEN others THEN NULL; END $$;

-- documents: add missing columns
DO $$ BEGIN ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'autre'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder TEXT; EXCEPTION WHEN others THEN NULL; END $$;


-- ==============================================================
-- PART 2: Seed EKOKA tenant (disables triggers to avoid audit_log issue)
-- ==============================================================

-- Temporarily disable triggers to avoid audit_log tenant_id constraint
SET session_replication_role = 'replica';

-- EKOKA tenant ID
-- Users already exist: fd697428-0449-4c22-8079-3014cf7b6194 (EKOKA, firm_admin)
--                        d00a1f63-649f-4a99-88fd-aa959a9b4ca0 (JENGU LAM, lawyer)
--                        e23743cb-adc6-4087-a759-cb2d51a37823 (THE WARE HOUSE, secretary)

-- Check if EKOKA already has clients (idempotent)
DO $$
DECLARE
  client_count INT;
BEGIN
  SELECT COUNT(*) INTO client_count FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5';
  IF client_count > 1 THEN
    RAISE NOTICE 'EKOKA already has % clients, skipping seed', client_count;
    RETURN;
  END IF;

  -- ─── 1. Insert 5 clients ───
  INSERT INTO public.clients (tenant_id, full_name, company, phone, email, address, notes, status, is_active, niu, client_type, city, country, risk_level, source)
  VALUES
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Jean-Pierre Nkoulou', 'Nkoulou & Fils SARL', '+237 6 99 12 34 56', 'jp.nkoulou@yahoo.fr', '45 Rue Joss, Douala', 'Client fidèle depuis 2019', 'active', true, 'M200345678', 'entreprise', 'Douala', 'Cameroun', 'faible', 'referral'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Marie-Claire Biyong', NULL, '+237 6 77 23 45 67', 'mcbiyong@gmail.com', '12 Quartier Bastos, Yaoundé', 'Affaire de divorce', 'active', true, NULL, 'particulier', 'Yaoundé', 'Cameroun', 'moyen', 'internet'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Ibrahim Ahmadou', 'Ahmadou Trading Co.', '+237 6 55 98 76 54', 'iahmadou@ahmadou-trading.cm', '8 Boulevard de la Liberté, Douala', 'Litige commercial avec fournisseur', 'active', true, 'M198765432', 'entreprise', 'Douala', 'Cameroun', 'eleve', 'direct'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Chantal Ngassa', NULL, '+237 6 99 87 65 43', 'c.ngassa@outlook.com', '23 Rue Mendong, Yaoundé', 'Succession familiale', 'active', true, NULL, 'particulier', 'Yaoundé', 'Cameroun', 'faible', 'referral'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Paul Essomba', 'Essomba Immobilier SARL', '+237 6 33 45 67 89', 'p.essomba@essomba-immobilier.cm', '156 Avenue Kennedy, Douala', 'Problème de bail commercial', 'active', true, 'M201234567', 'entreprise', 'Douala', 'Cameroun', 'moyen', 'networking')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted 5 EKOKA clients';
END $$;

-- Get inserted client IDs and insert cases
DO $$
DECLARE
  v_lawyer UUID := 'fd697428-0449-4c22-8079-3014cf7b6194';
  v_lawyer2 UUID := 'd00a1f63-649f-4a99-88fd-aa959a9b4ca0';
  v_lawyer3 UUID := 'e23743cb-adc6-4087-a759-cb2d51a37823';
  v_c1 UUID; v_c2 UUID; v_c3 UUID; v_c4 UUID; v_c5 UUID;
  case_count INT;
BEGIN
  SELECT COUNT(*) INTO case_count FROM public.cases WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5';
  IF case_count > 0 THEN
    RAISE NOTICE 'EKOKA already has % cases, skipping case seed', case_count;
    RETURN;
  END IF;

  -- Get client IDs
  SELECT id INTO v_c1 FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND full_name = 'Jean-Pierre Nkoulou' LIMIT 1;
  SELECT id INTO v_c2 FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND full_name = 'Marie-Claire Biyong' LIMIT 1;
  SELECT id INTO v_c3 FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND full_name = 'Ibrahim Ahmadou' LIMIT 1;
  SELECT id INTO v_c4 FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND full_name = 'Chantal Ngassa' LIMIT 1;
  SELECT id INTO v_c5 FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND full_name = 'Paul Essomba' LIMIT 1;

  -- ─── 2. Insert 5 cases ───
  INSERT INTO public.cases (tenant_id, client_id, reference, title, description, case_type, status, open_date, priority, is_secret, assigned_lawyer_id, next_deadline, outcome, payment_status, adversary, jurisdiction, amount_in_dispute, billing_type, criticality)
  VALUES
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_c1, 'EKOKA-2025-001', 'Litige contractuel Nkoulou & Fils', 'Non-respect des termes du contrat de fourniture avec Atlas Logistics SARL', 'commercial', 'open', '2025-01-15', 'haute', false, v_lawyer, '2025-02-28', 'ongoing', 'pending', 'Atlas Logistics SARL', 'TGI Douala', 15000000, 'forfait', 'haute'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_c2, 'EKOKA-2025-002', 'Divorce Biyong c. Biyong', 'Demande de divorce pour faute avec garde des enfants', 'familial', 'in_progress', '2024-11-20', 'normal', true, v_lawyer2, '2025-02-15', 'ongoing', 'partial', 'M. Biyong René', 'TGI Yaoundé', NULL, 'horaire', 'normal'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_c3, 'EKOKA-2025-003', 'Litige fournisseur Ahmadou Trading', 'Contestation de factures et livraison non conforme', 'commercial', 'in_progress', '2025-01-05', 'urgente', false, v_lawyer, '2025-02-10', 'ongoing', 'pending', 'Global Suppliers Ltd', 'Tribunal de Commerce Douala', 35000000, 'forfait', 'urgente'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_c4, 'EKOKA-2025-004', 'Succession Ngassa', 'Partage de succession suite au décès de M. Ngassa Samuel', 'civil', 'open', '2025-02-01', 'basse', false, v_lawyer3, '2025-04-30', 'ongoing', 'pending', NULL, 'TGI Yaoundé', NULL, 'forfait', 'normal'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_c5, 'EKOKA-2024-010', 'Bail commercial Essomba Immobilier', 'Résiliation de bail et recouvrement de loyers impayés', 'immobilier', 'closed', '2024-06-15', 'normal', false, v_lawyer, NULL, 'won', 'paid', 'SCI Bellevue', 'TGI Douala', 8000000, 'success_fee', 'normal')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted 5 EKOKA cases';
END $$;

-- Get case IDs and insert tasks
DO $$
DECLARE
  v_lawyer UUID := 'fd697428-0449-4c22-8079-3014cf7b6194';
  v_lawyer2 UUID := 'd00a1f63-649f-4a99-88fd-aa959a9b4ca0';
  v_lawyer3 UUID := 'e23743cb-adc6-4087-a759-cb2d51a37823';
  v_case1 UUID; v_case2 UUID; v_case3 UUID; v_case4 UUID; v_case5 UUID;
  task_count INT;
BEGIN
  SELECT COUNT(*) INTO task_count FROM public.tasks WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5';
  IF task_count > 0 THEN
    RAISE NOTICE 'EKOKA already has % tasks, skipping task seed', task_count;
    RETURN;
  END IF;

  -- Get case IDs
  SELECT id INTO v_case1 FROM public.cases WHERE reference = 'EKOKA-2025-001' LIMIT 1;
  SELECT id INTO v_case2 FROM public.cases WHERE reference = 'EKOKA-2025-002' LIMIT 1;
  SELECT id INTO v_case3 FROM public.cases WHERE reference = 'EKOKA-2025-003' LIMIT 1;
  SELECT id INTO v_case5 FROM public.cases WHERE reference = 'EKOKA-2024-010' LIMIT 1;

  -- ─── 3. Insert 8 tasks ───
  INSERT INTO public.tasks (tenant_id, case_id, assignee_id, title, description, due_date, status, priority)
  VALUES
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case1, v_lawyer, 'Rédiger la mise en demeure', 'Préparer et envoyer la mise en demeure à Atlas Logistics', '2025-02-10', 'done', 'normal'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case1, v_lawyer, 'Rassembler les preuves contractuelles', 'Compiler tous les documents du contrat et échanges', '2025-02-15', 'in_progress', 'haute'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case1, v_lawyer3, 'Rechercher la jurisprudence applicable', 'Trouver des décisions similaires du TGI Douala', '2025-02-20', 'todo', 'normal'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case2, v_lawyer2, 'Préparer les conclusions de divorce', 'Rédiger les conclusions pour l''audience du 15 février', '2025-02-12', 'in_progress', 'haute'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case2, v_lawyer2, 'Audition des témoins', 'Planifier les auditions des témoins de la cliente', '2025-02-25', 'todo', 'normal'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case3, v_lawyer, 'Expertise comptable des factures', 'Demander une expertise comptable des factures contestées', '2025-02-08', 'done', 'urgente'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case3, v_lawyer, 'Assignation en référé', 'Rédiger et déposer l''assignation en référé', '2025-02-05', 'in_progress', 'urgente'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case5, v_lawyer, 'Récupérer le jugement exécutoire', 'Obtenir copie certifiée du jugement pour exécution', '2025-01-30', 'done', 'normal')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted 8 EKOKA tasks';
END $$;

-- Get case IDs and insert documents
DO $$
DECLARE
  v_lawyer UUID := 'fd697428-0449-4c22-8079-3014cf7b6194';
  v_lawyer2 UUID := 'd00a1f63-649f-4a99-88fd-aa959a9b4ca0';
  v_case1 UUID; v_case2 UUID; v_case3 UUID; v_case5 UUID;
  doc_count INT;
BEGIN
  SELECT COUNT(*) INTO doc_count FROM public.documents WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5';
  IF doc_count > 0 THEN
    RAISE NOTICE 'EKOKA already has % documents, skipping doc seed', doc_count;
    RETURN;
  END IF;

  SELECT id INTO v_case1 FROM public.cases WHERE reference = 'EKOKA-2025-001' LIMIT 1;
  SELECT id INTO v_case2 FROM public.cases WHERE reference = 'EKOKA-2025-002' LIMIT 1;
  SELECT id INTO v_case3 FROM public.cases WHERE reference = 'EKOKA-2025-003' LIMIT 1;
  SELECT id INTO v_case5 FROM public.cases WHERE reference = 'EKOKA-2024-010' LIMIT 1;

  -- ─── 4. Insert 5 documents ───
  INSERT INTO public.documents (tenant_id, case_id, uploader_id, file_name, file_path, file_size, mime_type, tags, version, is_confidential, document_type, folder)
  VALUES
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case1, v_lawyer, 'Mise_en_demeure_Atlas.pdf', '/documents/EKOKA-2025-001/mise_en_demeure.pdf', 245000, 'application/pdf', 'mise_en_demeure,formalite', 1, true, 'mise_en_demeure', 'Correspondance'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case1, v_lawyer, 'Contrat_Fourniture_Nkoulou.pdf', '/documents/EKOKA-2025-001/contrat.pdf', 890000, 'application/pdf', 'contrat,preuve', 1, true, 'contrat', 'Pièces'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case2, v_lawyer2, 'Requete_Divorce_Biyong.pdf', '/documents/EKOKA-2025-002/requete.pdf', 560000, 'application/pdf', 'requete,divorce', 2, true, 'conclusion', 'Procédure'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case3, v_lawyer, 'Factures_Contestees_Ahmadou.pdf', '/documents/EKOKA-2025-003/factures.pdf', 1200000, 'application/pdf', 'facture,preuve', 1, false, 'facture', 'Pièces'),
    ('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', v_case5, v_lawyer, 'Jugement_Bail_Essomba.pdf', '/documents/EKOKA-2024-010/jugement.pdf', 780000, 'application/pdf', 'jugement,execution', 1, false, 'jugement', 'Décisions')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted 5 EKOKA documents';
END $$;

-- Re-enable triggers
SET session_replication_role = 'DEFAULT';


-- ==============================================================
-- PART 3: Verify
-- ==============================================================
SELECT 'clients' AS table_name, COUNT(*) AS row_count FROM public.clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5'
UNION ALL
SELECT 'cases', COUNT(*) FROM public.cases WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5'
UNION ALL
SELECT 'tasks', COUNT(*) FROM public.tasks WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5'
UNION ALL
SELECT 'documents', COUNT(*) FROM public.documents WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5';

-- Verify new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('tasks','clients','cases','documents')
  AND column_name IN ('priority','client_type','city','country','risk_level','source','adversary','jurisdiction','amount_in_dispute','billing_type','criticality','document_type','folder')
ORDER BY table_name, column_name;
