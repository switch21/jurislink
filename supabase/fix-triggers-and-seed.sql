-- ============================================
-- JURISLINK: Fix triggers + add columns + seed EKOKA
-- A exécuter dans le Supabase SQL Editor
-- ============================================

BEGIN;

-- 1. Make audit_logs.tenant_id nullable (temp fix for trigger issue)
ALTER TABLE audit_logs ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Add missing columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'faible';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS adversary TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS jurisdiction TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS amount_in_dispute NUMERIC(15,2);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS billing_type TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS criticality TEXT DEFAULT 'normal';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'autre';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder TEXT;

-- 3. Convert enum columns to TEXT (the original DB used custom enum types,
--    but the migration schema defines them all as TEXT)
--    We drop defaults first because they may reference the enum type.
DO $$ BEGIN
  ALTER TABLE cases ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE cases ALTER COLUMN status TYPE TEXT USING status::TEXT;
  ALTER TABLE cases ALTER COLUMN status SET DEFAULT 'new';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cases.status conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE cases ALTER COLUMN outcome DROP DEFAULT;
  ALTER TABLE cases ALTER COLUMN outcome TYPE TEXT USING outcome::TEXT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cases.outcome conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE cases ALTER COLUMN payment_status DROP DEFAULT;
  ALTER TABLE cases ALTER COLUMN payment_status TYPE TEXT USING payment_status::TEXT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'cases.payment_status conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE tasks ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE tasks ALTER COLUMN status TYPE TEXT USING status::TEXT;
  ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'todo';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'tasks.status conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE events ALTER COLUMN event_type DROP DEFAULT;
  ALTER TABLE events ALTER COLUMN event_type TYPE TEXT USING event_type::TEXT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'events.event_type conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE invoices ALTER COLUMN status DROP DEFAULT;
  ALTER TABLE invoices ALTER COLUMN status TYPE TEXT USING status::TEXT;
  ALTER TABLE invoices ALTER COLUMN status SET DEFAULT 'draft';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'invoices.status conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
  ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT;
  ALTER TABLE users ALTER COLUMN role SET DEFAULT 'lawyer';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'users.role conversion skipped: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE tenants ALTER COLUMN plan DROP DEFAULT;
  ALTER TABLE tenants ALTER COLUMN plan TYPE TEXT USING plan::TEXT;
  ALTER TABLE tenants ALTER COLUMN plan SET DEFAULT 'starter';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'tenants.plan conversion skipped: %', SQLERRM;
END $$;

-- 4. Fix the audit trigger to include tenant_id from NEW record
CREATE OR REPLACE FUNCTION public.handle_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  BEGIN
    v_tenant_id := (NEW).tenant_id;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_id := NULL;
  END;
  
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, new_state, metadata)
  VALUES (
    v_tenant_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    (NEW).id,
    to_jsonb(NEW),
    jsonb_build_object('trigger', TG_NAME, 'schema', TG_TABLE_SCHEMA)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Drop old triggers and recreate with fixed function
DO $$ 
DECLARE
  tr RECORD;
BEGIN
  FOR tr IN SELECT trigger_name, event_object_table, event_manipulation 
             FROM information_schema.triggers 
             WHERE event_object_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', tr.trigger_name, tr.event_object_table);
  END LOOP;
END $$;

-- 6. Create proper audit triggers
CREATE TRIGGER audit_clients_trigger AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();
CREATE TRIGGER audit_cases_trigger AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();
CREATE TRIGGER audit_tasks_trigger AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();
CREATE TRIGGER audit_documents_trigger AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();
CREATE TRIGGER audit_events_trigger AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();
CREATE TRIGGER audit_invoices_trigger AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();
CREATE TRIGGER audit_users_trigger AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION public.handle_audit_trigger();

-- 7. Re-enable NOT NULL on tenant_id now that trigger is fixed
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================
-- 8. Seed EKOKA tenant data
-- ============================================

-- Insert clients
INSERT INTO clients (tenant_id, full_name, company, phone, email, address, notes, status, niu, is_active, client_type, city, country, risk_level, source) VALUES
('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Jean-Paul Nkoulou', 'Nkoulou SARL', '+237699123456', 'jp.nkoulou@email.com', 'Rue Joss, Bonapriso, Douala', 'Client fidèle depuis 2020', 'active', 'M1234567890A', true, 'entreprise', 'Douala', 'Cameroun', 'faible', 'bouche_a_oreille'),
('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Marie-Claire Biyong', '', '+237677987654', 'mc.biyong@email.com', 'Quartier Bastos, Yaoundé', 'Divorce en cours', 'active', 'M0987654321B', true, 'particulier', 'Yaoundé', 'Cameroun', 'moyen', 'site_web'),
('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'André-Michel Fotso', 'Fotso & Frères', '+237655555123', 'am.fotso@fotso.com', 'Avenue de la Liberté, Douala', 'Litige commercial important', 'active', 'M5678901234C', true, 'entreprise', 'Douala', 'Cameroun', 'eleve', 'partenaire'),
('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Chantal Mbarga', '', '+237699888777', 'c.mbarga@email.com', 'Briqueterie, Douala', 'Succession complexe', 'active', 'M3456789012D', true, 'particulier', 'Douala', 'Cameroun', 'moyen', 'referral'),
('02f9415d-4985-460c-8bb0-b9f28b1ed6d5', 'Camtel SA', 'Camtel SA', '+237233423111', 'juridique@camtel.cm', 'Boulevard de la Liberté, Yaoundé', 'Contrat de prestations', 'active', 'M7890123456E', true, 'entreprise', 'Yaoundé', 'Cameroun', 'faible', 'prospect')
ON CONFLICT DO NOTHING;

-- Insert cases (using CASE WHEN to resolve assigned_lawyer_id UUID from role text)
WITH ek_clients AS (
  SELECT id, full_name FROM clients 
  WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' 
  AND full_name IN ('Jean-Paul Nkoulou', 'Marie-Claire Biyong', 'André-Michel Fotso', 'Chantal Mbarga', 'Camtel SA')
  ORDER BY full_name
),
ek_lawyer AS (
  SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'lawyer' LIMIT 1
),
ek_admin AS (
  SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'firm_admin' LIMIT 1
)
INSERT INTO cases (tenant_id, client_id, title, description, status, open_date, outcome, payment_status, is_secret, reference, case_type, priority, assigned_lawyer_id, next_deadline, adversary, jurisdiction, amount_in_dispute, billing_type, criticality)
SELECT 
  '02f9415d-4985-460c-8bb0-b9f28b1ed6d5', c.id,
  d.title, d.description, d.status::case_status, d.open_date::date, d.outcome::case_outcome, d.payment_status::payment_status, d.is_secret, d.reference, d.case_type, d.priority,
  CASE d.assigned_role
    WHEN 'lawyer' THEN l.id
    WHEN 'admin' THEN a.id
    ELSE NULL
  END,
  d.next_deadline::date, d.adversary, d.jurisdiction, d.amount_in_dispute::numeric, d.billing_type, d.criticality
FROM (VALUES
  ('Jean-Paul Nkoulou', 'Litige commercial Nkoulou SARL', 'Livraison non conforme de marchandises', 'in_progress', '2024-03-15', 'ongoing', 'pending', false, 'AFF-2024-001', 'commercial', 'high', 'lawyer', '2025-01-15', 'Société Mega Import', 'TPI Douala', 15000000, 'forfait', 'haute'),
  ('Marie-Claire Biyong', 'Divorce Biyong', 'Divorce par consentement mutuel', 'open', '2024-06-01', 'ongoing', 'paid', true, 'AFF-2024-002', 'civil', 'normal', 'lawyer', '2025-02-01', 'M. Biyong René', 'TGI Yaoundé', NULL, 'honoraire', 'normal'),
  ('André-Michel Fotso', 'Recouvrement créances Fotso', 'Impayés de 25M XAF auprès de Bâtisseur SA', 'open', '2024-07-10', 'ongoing', 'pending', false, 'AFF-2024-003', 'commercial', 'high', 'lawyer', '2025-01-20', 'Bâtisseur SA', 'TPI Douala', 25000000, 'success_fee', 'urgente'),
  ('Chantal Mbarga', 'Succession Mbarga', 'Règlement succession complexe avec biens immobiliers', 'in_progress', '2024-04-20', 'ongoing', 'partial', false, 'AFF-2024-004', 'civil', 'normal', 'lawyer', '2025-03-01', NULL, 'TGI Douala', NULL, 'horaire', 'normal'),
  ('Camtel SA', 'Audit juridique Camtel', 'Audit du contrat de maintenance informatique', 'closed', '2024-01-05', 'won', 'paid', false, 'AFF-2024-005', 'administratif', 'low', 'admin', NULL, NULL, 'Conseil d''État', 5000000, 'abonnement', 'basse')
) AS d(full_name, title, description, status, open_date, outcome, payment_status, is_secret, reference, case_type, priority, assigned_role, next_deadline, adversary, jurisdiction, amount_in_dispute, billing_type, criticality)
JOIN ek_clients c ON c.full_name = d.full_name
CROSS JOIN ek_lawyer l
CROSS JOIN ek_admin a
ON CONFLICT DO NOTHING;

-- Insert tasks (using CASE WHEN to resolve assignee_id UUID from role text)
WITH ek_cases AS (
  SELECT id, reference FROM cases 
  WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' 
  ORDER BY reference
),
ek_lawyer AS (SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'lawyer' LIMIT 1),
ek_secretary AS (SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'secretary' LIMIT 1),
ek_admin AS (SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'firm_admin' LIMIT 1)
INSERT INTO tasks (tenant_id, case_id, assignee_id, title, description, due_date, status, priority)
SELECT 
  '02f9415d-4985-460c-8bb0-b9f28b1ed6d5', c.id,
  CASE d.assignee
    WHEN 'lawyer' THEN l.id
    WHEN 'secretary' THEN s.id
    WHEN 'admin' THEN a.id
  END,
  d.title, d.description, d.due_date::timestamptz, d.status::task_status, d.priority
FROM (VALUES
  ('AFF-2024-001', 'lawyer', 'Rédiger assignation', 'Assignation en référé livraison', '2025-01-15T10:00:00Z', 'in_progress', 'haute'),
  ('AFF-2024-001', 'secretary', 'Collecter preuves documentaires', 'Factures et bons de livraison', '2025-01-10T10:00:00Z', 'done', 'haute'),
  ('AFF-2024-002', 'lawyer', 'Préparer convention de divorce', 'Convention consentement mutuel', '2025-02-01T10:00:00Z', 'todo', 'normal'),
  ('AFF-2024-003', 'lawyer', 'Mise en demeure Bâtisseur SA', 'Courrier recommandé avec AR', '2025-01-20T10:00:00Z', 'todo', 'urgente'),
  ('AFF-2024-003', 'secretary', 'Rassembler les factures impayées', 'Relevés de compte et factures', '2025-01-12T10:00:00Z', 'in_progress', 'haute'),
  ('AFF-2024-004', 'lawyer', 'Publier appel successoral', 'Publication au Journal Officiel', '2025-03-01T10:00:00Z', 'todo', 'normal'),
  ('AFF-2024-001', 'admin', 'Revoir les conclusions', 'Vérification des pièces et arguments', '2025-01-18T10:00:00Z', 'todo', 'normal'),
  ('AFF-2024-005', 'admin', 'Archiver le dossier Camtel', 'Classement et archivage final', '2025-01-05T10:00:00Z', 'done', 'basse')
) AS d(case_ref, assignee, title, description, due_date, status, priority)
JOIN ek_cases c ON c.reference = d.case_ref
CROSS JOIN ek_lawyer l
CROSS JOIN ek_secretary s
CROSS JOIN ek_admin a
ON CONFLICT DO NOTHING;

-- Insert documents (using CASE WHEN to resolve uploader_id UUID from role text)
WITH ek_cases AS (
  SELECT id, reference FROM cases 
  WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' 
  ORDER BY reference
),
ek_lawyer AS (SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'lawyer' LIMIT 1),
ek_secretary AS (SELECT id FROM users WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5' AND role = 'secretary' LIMIT 1)
INSERT INTO documents (tenant_id, case_id, uploader_id, file_name, file_path, file_size, tags, mime_type, version, is_confidential, document_type, folder)
SELECT 
  '02f9415d-4985-460c-8bb0-b9f28b1ed6d5', c.id,
  CASE d.uploader
    WHEN 'lawyer' THEN l.id
    WHEN 'secretary' THEN s.id
  END,
  d.file_name, d.file_path, d.file_size, d.tags, d.mime_type, d.version, d.is_confidential, d.document_type, d.folder
FROM (VALUES
  ('AFF-2024-001', 'lawyer', 'Assignation_Nkoulou.pdf', '/cases/2024/assignation.pdf', 245000, ARRAY['assignation', 'référé'], 'application/pdf', 1, false, 'assignation', 'Assignations'),
  ('AFF-2024-001', 'secretary', 'Factures_Mega_Import.pdf', '/cases/2024/factures.pdf', 189000, ARRAY['facture', 'preuve'], 'application/pdf', 1, false, 'piece', 'Preuves'),
  ('AFF-2024-002', 'lawyer', 'Convention_Divorce.docx', '/cases/2024/convention.docx', 156000, ARRAY['convention', 'divorce'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1, true, 'convention', 'Conventions'),
  ('AFF-2024-003', 'lawyer', 'Mise_en_Demeure.pdf', '/cases/2024/mise_en_demeure.pdf', 98000, ARRAY['mise_en_demeure'], 'application/pdf', 1, false, 'correspondance', 'Correspondance'),
  ('AFF-2024-004', 'lawyer', 'Acte_de_Décès.pdf', '/cases/2024/act_deces.pdf', 125000, ARRAY['succession', 'acte'], 'application/pdf', 1, false, 'acte', 'Succession')
) AS d(case_ref, uploader, file_name, file_path, file_size, tags, mime_type, version, is_confidential, document_type, folder)
JOIN ek_cases c ON c.reference = d.case_ref
CROSS JOIN ek_lawyer l
CROSS JOIN ek_secretary s
ON CONFLICT DO NOTHING;

COMMIT;

-- Verify results
SELECT 'clients' as tbl, COUNT(*) FROM clients WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5'
UNION ALL
SELECT 'cases', COUNT(*) FROM cases WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5'
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5'
UNION ALL
SELECT 'documents', COUNT(*) FROM documents WHERE tenant_id = '02f9415d-4985-460c-8bb0-b9f28b1ed6d5';
