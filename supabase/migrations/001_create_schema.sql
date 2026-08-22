-- ==============================================================
-- JURISLINK V2 — SCHÉMA COMPLET SUPABASE
-- ==============================================================
-- Ce script crée TOUTES les tables, enums, fonctions, triggers,
-- index et politiques RLS nécessaires pour l'application.
--
-- ⚠️ À exécuter dans l'éditeur SQL Supabase avec SET ROLE postgres;
-- ==============================================================

SET ROLE postgres;

-- ==============================================================
-- PARTIE 1 — TYPES ENUM
-- ==============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'root_admin', 'firm_admin', 'lawyer', 'secretary',
    'client', 'collaborator', 'accountant', 'trainee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE case_status AS ENUM (
    'open', 'closed', 'pending', 'archived', 'new', 'in_progress'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE case_outcome AS ENUM (
    'ongoing', 'won', 'lost', 'settled', 'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM (
    'todo', 'in_progress', 'done'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft', 'sent', 'paid', 'overdue', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'partial', 'paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE criticality_level AS ENUM (
    'low', 'medium', 'high', 'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_type AS ENUM (
    'starter', 'professional', 'enterprise'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ==============================================================
-- PARTIE 2 — FONCTIONS UTILES
-- ==============================================================

-- Fonction : mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction : générer un slug à partir du nom
CREATE OR REPLACE FUNCTION public.generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(COALESCE(name, ''), '[^a-z0-9]+', '-', 'gi'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : trigger pour créer automatiquement un user public
--         quand un user est créé dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'lawyer',
    true,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction : trigger d'audit logging automatique
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_table TEXT;
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  v_table := TG_TABLE_NAME;
  v_action := LOWER(TG_OP);

  -- Déterminer le tenant_id
  IF v_table = 'tenants' THEN
    v_tenant_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_ARGV IS NOT NULL AND array_length(TG_ARGV, 1) > 0 THEN
    EXECUTE format('SELECT ($1).%I', TG_ARGV[1]) INTO v_tenant_id
      USING CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW ELSE OLD END;
  END IF;

  -- Déterminer le user_id (si la table a un user_id / created_by)
  BEGIN
    EXECUTE format('SELECT ($1).user_id', TG_ARGV[1]::text) INTO v_user_id
      USING CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW ELSE OLD END;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.audit_logs (tenant_id, user_id, action, resource_type, resource_id, metadata, ip_address)
  VALUES (
    v_tenant_id,
    v_user_id,
    v_action,
    v_table,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.id ELSE OLD.id END,
    json_build_object(
      'op', TG_OP,
      'old', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN TO_JSONB(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN TO_JSONB(NEW) ELSE NULL END
    ),
    inet_client_addr()::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================
-- PARTIE 3 — TABLES
-- ==============================================================

-- ---------------------------------------------------------------
-- 3.1  tenants
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT GENERATED ALWAYS AS (generate_slug(name)) STORED,
  logo_url      TEXT,
  language      TEXT NOT NULL DEFAULT 'fr',
  timezone      TEXT NOT NULL DEFAULT 'Europe/Paris',
  address       TEXT,
  city          TEXT,
  country       TEXT,
  phone         TEXT,
  email         TEXT,
  niu           TEXT,           -- Numéro d'Identification Unique
  plan          plan_type NOT NULL DEFAULT 'starter',
  max_users     INT NOT NULL DEFAULT 10,
  max_storage_gb INT NOT NULL DEFAULT 20,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS tenants_is_active_idx ON public.tenants (is_active);

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.2  currencies
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.currencies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  symbol      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS currencies_code_idx ON public.currencies (code);

DROP TRIGGER IF EXISTS currencies_updated_at ON public.currencies;
CREATE TRIGGER currencies_updated_at
  BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.3  users (public)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                UUID PRIMARY KEY,  -- = auth.users.id
  tenant_id         UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  email             TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  role              user_role NOT NULL DEFAULT 'lawyer',
  avatar_url        TEXT,
  phone             TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'fr',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  last_session_id   TEXT,
  session_count_today INT DEFAULT 0,
  failed_login_attempts INT DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
CREATE INDEX IF NOT EXISTS users_is_active_idx ON public.users (is_active);

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger : auto-create public.user from auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------
-- 3.4  clients
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  company     TEXT,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  niu         TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_tenant_id_idx ON public.clients (tenant_id);
CREATE INDEX IF NOT EXISTS clients_full_name_idx ON public.clients (full_name);
CREATE INDEX IF NOT EXISTS clients_email_idx ON public.clients (email);
CREATE INDEX IF NOT EXISTS clients_company_idx ON public.clients (company);
CREATE INDEX IF NOT EXISTS clients_is_active_idx ON public.clients (is_active);

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.5  cases
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id         UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  reference         TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  case_type         TEXT,          -- commercial, family, corporate, ip, estate, etc.
  status            case_status NOT NULL DEFAULT 'new',
  outcome           case_outcome,
  payment_status    payment_status,
  priority          TEXT,          -- low, normal, high, urgent
  is_secret         BOOLEAN NOT NULL DEFAULT false,
  open_date         TIMESTAMPTZ,  -- date d'ouverture du dossier
  next_deadline     TIMESTAMPTZ,
  assigned_lawyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cases_tenant_id_idx ON public.cases (tenant_id);
CREATE INDEX IF NOT EXISTS cases_client_id_idx ON public.cases (client_id);
CREATE INDEX IF NOT EXISTS cases_status_idx ON public.cases (status);
CREATE INDEX IF NOT EXISTS cases_case_type_idx ON public.cases (case_type);
CREATE INDEX IF NOT EXISTS cases_assigned_lawyer_id_idx ON public.cases (assigned_lawyer_id);
CREATE INDEX IF NOT EXISTS cases_next_deadline_idx ON public.cases (next_deadline);

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.6  tasks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ,
  status      task_status NOT NULL DEFAULT 'todo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tasks_tenant_id_idx ON public.tasks (tenant_id);
CREATE INDEX IF NOT EXISTS tasks_case_id_idx ON public.tasks (case_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks (due_date);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.7  documents
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  uploader_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL DEFAULT '',
  file_size       INT NOT NULL DEFAULT 0,
  mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
  tags            TEXT[],
  version         INT NOT NULL DEFAULT 1,
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  deleted_at      TIMESTAMPTZ,     -- soft delete
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_tenant_id_idx ON public.documents (tenant_id);
CREATE INDEX IF NOT EXISTS documents_case_id_idx ON public.documents (case_id);
CREATE INDEX IF NOT EXISTS documents_uploader_id_idx ON public.documents (uploader_id);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx ON public.documents (deleted_at);

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.8  invoices
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id     UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  status      invoice_status NOT NULL DEFAULT 'draft',
  issue_date  TIMESTAMPTZ,
  due_date    TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx ON public.invoices (tenant_id);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON public.invoices (due_date);

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.9  events
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id       UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ,
  event_type    TEXT,             -- audience, echeance, depot, meeting, expertise
  criticality   criticality_level NOT NULL DEFAULT 'medium',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_tenant_id_idx ON public.events (tenant_id);
CREATE INDEX IF NOT EXISTS events_case_id_idx ON public.events (case_id);
CREATE INDEX IF NOT EXISTS events_start_time_idx ON public.events (start_time);
CREATE INDEX IF NOT EXISTS events_event_type_idx ON public.events (event_type);

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 3.10  event_assignments
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_assignments_event_user_idx
  ON public.event_assignments (event_id, user_id);
CREATE INDEX IF NOT EXISTS event_assignments_user_id_idx
  ON public.event_assignments (user_id);
CREATE INDEX IF NOT EXISTS event_assignments_tenant_id_idx
  ON public.event_assignments (tenant_id);


-- ---------------------------------------------------------------
-- 3.11  messages
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  case_id     UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  read_status BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_tenant_id_idx ON public.messages (tenant_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS messages_case_id_idx ON public.messages (case_id);


-- ---------------------------------------------------------------
-- 3.12  notifications
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  message       TEXT,
  type          TEXT,             -- task_due, event_reminder, case_update, system
  category      TEXT,             -- alert, info, success, warning
  resource_type TEXT,
  resource_id   UUID,
  event_id      UUID REFERENCES public.events(id) ON DELETE SET NULL,
  "read"        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx ON public.notifications (tenant_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications ("read");
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at);


-- ==============================================================
-- PARTIE 4 — TABLES MANQUANTES (stubs dans l'API)
-- ==============================================================

-- ---------------------------------------------------------------
-- 4.1  audit_logs  ❌ MANQUANTE
-- ---------------------------------------------------------------
-- Utilisée par /api/audit-logs et /api/dashboard
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,          -- create, update, delete, login, logout
  resource_type TEXT,                   -- case, client, invoice, task, document, etc.
  resource_id   UUID,
  metadata      JSONB,                  -- détails de l'action
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_type_idx ON public.audit_logs (resource_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at);


-- ---------------------------------------------------------------
-- 4.2  case_notes  ❌ MANQUANTE
-- ---------------------------------------------------------------
-- Utilisée par /api/cases/[id]/notes (actuellement stub 501)
CREATE TABLE IF NOT EXISTS public.case_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id     UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  content     TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS case_notes_tenant_id_idx ON public.case_notes (tenant_id);
CREATE INDEX IF NOT EXISTS case_notes_case_id_idx ON public.case_notes (case_id);

DROP TRIGGER IF EXISTS case_notes_updated_at ON public.case_notes;
CREATE TRIGGER case_notes_updated_at
  BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 4.3  payments  ❌ MANQUANTE
-- ---------------------------------------------------------------
-- Utilisée par /api/payments (actuellement stub 501)
CREATE TABLE IF NOT EXISTS public.payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  method      TEXT,              -- cash, bank_transfer, mobile_money, card, cheque
  reference   TEXT,              -- référence du paiement / numéro de transaction
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_tenant_id_idx ON public.payments (tenant_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 4.4  permissions (table pour permissions custom par tenant)
-- ---------------------------------------------------------------
-- Actuellement géré en dur dans le code, mais cette table
-- permettra un paramétrage fin par tenant.
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role        user_role NOT NULL,
  resource    TEXT NOT NULL,          -- case, client, document, invoice, task, event, etc.
  action      TEXT NOT NULL,          -- view, create, edit, delete, export, manage_permissions
  allowed     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, role, resource, action)
);

CREATE INDEX IF NOT EXISTS permissions_tenant_id_idx ON public.permissions (tenant_id);
CREATE INDEX IF NOT EXISTS permissions_role_idx ON public.permissions (role);


-- ==============================================================
-- PARTIE 5 — POLITIQUES RLS (Row Level Security)
-- ==============================================================
-- Le service role key bypass RLS, donc ces politiques
-- s'appliquent surtout si on utilise le anon key à l'avenir.
-- Pour l'instant l'isolation tenant est gérée dans le code.
-- ==============================================================

-- Activer RLS sur toutes les tables métier
ALTER TABLE public.tenants          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;

-- Politique : service_role a accès à tout (déjà le cas par défaut, mais explicite)
CREATE POLICY "Service role full access" ON public.tenants
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.currencies
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.users
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.clients
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.cases
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.tasks
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.documents
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.invoices
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.events
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.event_assignments
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.messages
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.notifications
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.audit_logs
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.case_notes
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.payments
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.permissions
  FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================
-- PARTIE 6 — DONNÉES DE RÉFÉRENCE INITIALES
-- ==============================================================

-- Devises par défaut (ne pas insérer si déjà présentes)
INSERT INTO public.currencies (id, code, name, symbol, created_at, updated_at)
VALUES
  ('c2000000-0000-0000-0000-000000000001', 'XAF', 'Franc CFA (BEAC)', 'FCFA', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000002', 'EUR', 'Euro', '€', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000003', 'GBP', 'Livre Sterling', '£', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000004', 'XOF', 'Franc CFA (BCEAO)', 'FCFA', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000005', 'USD', 'Dollar US', '$', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;


-- ==============================================================
-- PARTIE 7 — VUES UTILITAIRES
-- ==============================================================

-- Vue : résumé des dossiers avec nom client et avocat assigné
CREATE OR REPLACE VIEW public.v_cases_summary AS
SELECT
  c.id, c.tenant_id, c.client_id, c.reference, c.title,
  c.case_type, c.status, c.outcome, c.payment_status, c.priority,
  c.is_secret, c.open_date, c.next_deadline, c.assigned_lawyer_id,
  c.created_at, c.updated_at,
  cl.full_name AS client_name,
  cl.company AS client_company,
  u.full_name AS lawyer_name,
  u.email AS lawyer_email
FROM public.cases c
LEFT JOIN public.clients cl ON cl.id = c.client_id
LEFT JOIN public.users u ON u.id = c.assigned_lawyer_id;

-- Vue : tâches avec info dossier et utilisateur
CREATE OR REPLACE VIEW public.v_tasks_detail AS
SELECT
  t.id, t.tenant_id, t.case_id, t.event_id, t.assignee_id,
  t.title, t.description, t.due_date, t.status,
  t.created_at, t.updated_at,
  cs.reference AS case_reference,
  cs.title AS case_title,
  u.full_name AS assignee_name
FROM public.tasks t
LEFT JOIN public.cases cs ON cs.id = t.case_id
LEFT JOIN public.users u ON u.id = t.assignee_id;

-- Vue : factures avec info client et devise
CREATE OR REPLACE VIEW public.v_invoices_detail AS
SELECT
  i.id, i.tenant_id, i.case_id, i.client_id, i.amount,
  i.currency_id, i.status, i.issue_date, i.due_date,
  i.created_at, i.updated_at,
  cl.full_name AS client_name,
  cl.company AS client_company,
  cu.code AS currency_code,
  cu.symbol AS currency_symbol
FROM public.invoices i
LEFT JOIN public.clients cl ON cl.id = i.client_id
LEFT JOIN public.currencies cu ON cu.id = i.currency_id;

-- Vue : événements avec assignés et dossier
CREATE OR REPLACE VIEW public.v_events_detail AS
SELECT
  e.id, e.tenant_id, e.case_id, e.title, e.description,
  e.start_time, e.end_time, e.event_type, e.criticality,
  e.reminder_sent, e.created_at, e.updated_at,
  cs.reference AS case_reference,
  cs.title AS case_title,
  COALESCE(
    json_agg(
      json_build_object(
        'user_id', ea.user_id,
        'user_name', u.full_name,
        'user_email', u.email
      )
      ORDER BY u.full_name
    ) FILTER (WHERE ea.id IS NOT NULL),
    '[]'::json
  ) AS assignments
FROM public.events e
LEFT JOIN public.cases cs ON cs.id = e.case_id
LEFT JOIN public.event_assignments ea ON ea.event_id = e.id
LEFT JOIN public.users u ON u.id = ea.user_id
GROUP BY e.id, cs.id, cs.reference, cs.title;


-- ==============================================================
-- FIN DU SCRIPT
-- ==============================================================
-- Résumé :
--   • 8 types ENUM (user_role, case_status, case_outcome, task_status,
--     invoice_status, payment_status, criticality_level, plan_type)
--   • 16 tables (tenants, currencies, users, clients, cases, tasks,
--     documents, invoices, events, event_assignments, messages,
--     notifications, audit_logs, case_notes, payments, permissions)
--   • 4 vues utilitaires (v_cases_summary, v_tasks_detail,
--     v_invoices_detail, v_events_detail)
--   • 3 fonctions (set_updated_at, generate_slug, handle_new_user,
--     audit_log_trigger)
--   • 14 triggers updated_at + 1 trigger auth.users
--   • 16+ index pour les performances
--   • 16 politiques RLS (service role full access)
--   • 5 devises par défaut (XAF, EUR, GBP, XOF, USD)
-- ==============================================================
