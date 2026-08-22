-- ==============================================================
-- JURISLINK V2 — SCHÉMA COMPLET SUPABASE (VERSION IDEMPOTENTE)
-- ==============================================================
-- Ce script est SAFE pour les tables existantes :
--   - CREATE TABLE IF NOT EXISTS pour les nouvelles tables
--   - ALTER TABLE ADD COLUMN IF NOT EXISTS pour les colonnes manquantes
--   - DROP/CREATE pour fonctions, triggers, index, vues
--
-- ⚠️ Exécuter dans l'éditeur SQL Supabase avec SET ROLE postgres;
-- ⚠️ Exécuter par PARTIE séparément si le script est trop long.
-- ==============================================================

SET ROLE postgres;


-- ==============================================================
-- PARTIE 1 — TYPES ENUM
-- ==============================================================

DO $$ BEGIN CREATE TYPE user_role AS ENUM (
  'root_admin', 'firm_admin', 'lawyer', 'secretary',
  'client', 'collaborator', 'accountant', 'trainee'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE case_status AS ENUM (
  'open', 'closed', 'pending', 'archived', 'new', 'in_progress'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE case_outcome AS ENUM (
  'ongoing', 'won', 'lost', 'settled', 'dismissed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE task_status AS ENUM (
  'todo', 'in_progress', 'done'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE invoice_status AS ENUM (
  'draft', 'sent', 'paid', 'overdue', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_status AS ENUM (
  'pending', 'partial', 'paid'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE criticality_level AS ENUM (
  'low', 'medium', 'high', 'urgent'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE plan_type AS ENUM (
  'starter', 'professional', 'enterprise'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ==============================================================
-- PARTIE 2 — FONCTIONS
-- ==============================================================

-- Fonction : auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction : slug à partir du nom
CREATE OR REPLACE FUNCTION public.generate_slug(p_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(COALESCE(p_name, ''), '[^a-z0-9]+', '-', 'gi'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction : auto-create public.user depuis auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'lawyer',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================
-- PARTIE 3 — TABLES EXISTANTES → ALTER pour ajouter colonnes
--             manquantes
-- ==============================================================

-- ---------------------------------------------------------------
-- 3.1  tenants
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonnes à ajouter si manquantes
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/Paris';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS city TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS country TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS niu TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan plan_type NOT NULL DEFAULT 'starter';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_users INT NOT NULL DEFAULT 10;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_storage_gb INT NOT NULL DEFAULT 20;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN others THEN NULL;
END $$;

-- slug : colonne générée (ne peut pas utiliser ADD COLUMN IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'slug'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN slug TEXT
      GENERATED ALWAYS AS (generate_slug(name)) STORED;
  END IF;
END $$;


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


-- ---------------------------------------------------------------
-- 3.3  users (public)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY,
  tenant_id      UUID,
  email          TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'lawyer',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'fr';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_session_id TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_count_today INT DEFAULT 0;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.4  clients
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  full_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS company TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS niu TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.5  cases
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  client_id      UUID,
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'new',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS reference TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS case_type TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS outcome TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS payment_status TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS priority TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS open_date TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS next_deadline TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS assigned_lawyer_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.6  tasks
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  case_id     UUID NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'todo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS event_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.7  documents
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  case_id         UUID,
  uploader_id     UUID NOT NULL,
  file_name       TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_path TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size INT NOT NULL DEFAULT 0;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'application/octet-stream';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS tags TEXT[];
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.8  invoices
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  case_id     UUID,
  client_id   UUID NOT NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_id UUID NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS issue_date TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.9  events
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  case_id       UUID,
  title         TEXT NOT NULL,
  start_time    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS description TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS criticality TEXT NOT NULL DEFAULT 'medium';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.10  event_assignments
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL,
  user_id     UUID NOT NULL,
  tenant_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS assigned_by UUID;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ---------------------------------------------------------------
-- 3.11  messages
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  sender_id   UUID,
  receiver_id UUID NOT NULL,
  case_id     UUID,
  content     TEXT NOT NULL,
  read_status BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------
-- 3.12  notifications
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  title         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resource_type TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resource_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS event_id UUID;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS "read" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ==============================================================
-- PARTIE 4 — NOUVELLES TABLES (n'existent pas encore)
-- ==============================================================

-- ---------------------------------------------------------------
-- 4.1  audit_logs  ❌ NOUVELLE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  user_id       UUID,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  metadata      JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------
-- 4.2  case_notes  ❌ NOUVELLE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  case_id     UUID NOT NULL,
  user_id     UUID NOT NULL,
  content     TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------
-- 4.3  payments  ❌ NOUVELLE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  invoice_id  UUID NOT NULL,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  method      TEXT,
  reference   TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------
-- 4.4  permissions  ❌ NOUVELLE
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  role        TEXT NOT NULL,
  resource    TEXT NOT NULL,
  action      TEXT NOT NULL,
  allowed     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, role, resource, action)
);


-- ==============================================================
-- PARTIE 5 — CLÉS ÉTRANGÈRES (ajoutées après CREATE TABLE)
-- ==============================================================

-- tenants FK (ne pas ajouter si déjà présent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_tenant_id_fkey' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'clients_tenant_id_fkey' AND table_name = 'clients'
  ) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cases_tenant_id_fkey' AND table_name = 'cases'
  ) THEN
    ALTER TABLE public.cases ADD CONSTRAINT cases_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cases_client_id_fkey' AND table_name = 'cases'
  ) THEN
    ALTER TABLE public.cases ADD CONSTRAINT cases_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cases_assigned_lawyer_id_fkey' AND table_name = 'cases'
  ) THEN
    ALTER TABLE public.cases ADD CONSTRAINT cases_assigned_lawyer_id_fkey
      FOREIGN KEY (assigned_lawyer_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_tenant_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_case_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_event_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_assignee_id_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_assignee_id_fkey
      FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'documents_tenant_id_fkey' AND table_name = 'documents'
  ) THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'documents_case_id_fkey' AND table_name = 'documents'
  ) THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'documents_uploader_id_fkey' AND table_name = 'documents'
  ) THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_uploader_id_fkey
      FOREIGN KEY (uploader_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_tenant_id_fkey' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_case_id_fkey' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_client_id_fkey' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_currency_id_fkey' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_currency_id_fkey
      FOREIGN KEY (currency_id) REFERENCES public.currencies(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_tenant_id_fkey' AND table_name = 'events'
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_case_id_fkey' AND table_name = 'events'
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'event_assignments_event_id_fkey' AND table_name = 'event_assignments'
  ) THEN
    ALTER TABLE public.event_assignments ADD CONSTRAINT event_assignments_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'event_assignments_user_id_fkey' AND table_name = 'event_assignments'
  ) THEN
    ALTER TABLE public.event_assignments ADD CONSTRAINT event_assignments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'event_assignments_assigned_by_fkey' AND table_name = 'event_assignments'
  ) THEN
    ALTER TABLE public.event_assignments ADD CONSTRAINT event_assignments_assigned_by_fkey
      FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'event_assignments_tenant_id_fkey' AND table_name = 'event_assignments'
  ) THEN
    ALTER TABLE public.event_assignments ADD CONSTRAINT event_assignments_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_tenant_id_fkey' AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_sender_id_fkey' AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_receiver_id_fkey' AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_case_id_fkey' AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_tenant_id_fkey' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_user_id_fkey' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_event_id_fkey' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_tenant_id_fkey' AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_user_id_fkey' AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'case_notes_tenant_id_fkey' AND table_name = 'case_notes'
  ) THEN
    ALTER TABLE public.case_notes ADD CONSTRAINT case_notes_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'case_notes_case_id_fkey' AND table_name = 'case_notes'
  ) THEN
    ALTER TABLE public.case_notes ADD CONSTRAINT case_notes_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'case_notes_user_id_fkey' AND table_name = 'case_notes'
  ) THEN
    ALTER TABLE public.case_notes ADD CONSTRAINT case_notes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_tenant_id_fkey' AND table_name = 'payments'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payments_invoice_id_fkey' AND table_name = 'payments'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'permissions_tenant_id_fkey' AND table_name = 'permissions'
  ) THEN
    ALTER TABLE public.permissions ADD CONSTRAINT permissions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;


-- ==============================================================
-- PARTIE 6 — INDEX
-- ==============================================================

-- tenants
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS tenants_is_active_idx ON public.tenants (is_active);

-- currencies
CREATE UNIQUE INDEX IF NOT EXISTS currencies_code_idx ON public.currencies (code);

-- users
CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
CREATE INDEX IF NOT EXISTS users_is_active_idx ON public.users (is_active);

-- clients
CREATE INDEX IF NOT EXISTS clients_tenant_id_idx ON public.clients (tenant_id);
CREATE INDEX IF NOT EXISTS clients_full_name_idx ON public.clients (full_name);
CREATE INDEX IF NOT EXISTS clients_email_idx ON public.clients (email);
CREATE INDEX IF NOT EXISTS clients_company_idx ON public.clients (company);
CREATE INDEX IF NOT EXISTS clients_is_active_idx ON public.clients (is_active);

-- cases
CREATE INDEX IF NOT EXISTS cases_client_id_idx ON public.cases (client_id);
CREATE INDEX IF NOT EXISTS cases_status_idx ON public.cases (status);
CREATE INDEX IF NOT EXISTS cases_case_type_idx ON public.cases (case_type);
CREATE INDEX IF NOT EXISTS cases_assigned_lawyer_id_idx ON public.cases (assigned_lawyer_id);
CREATE INDEX IF NOT EXISTS cases_next_deadline_idx ON public.cases (next_deadline);

-- tasks
CREATE INDEX IF NOT EXISTS tasks_tenant_id_idx ON public.tasks (tenant_id);
CREATE INDEX IF NOT EXISTS tasks_case_id_idx ON public.tasks (case_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx ON public.tasks (assignee_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks (due_date);

-- documents
CREATE INDEX IF NOT EXISTS documents_tenant_id_idx ON public.documents (tenant_id);
CREATE INDEX IF NOT EXISTS documents_case_id_idx ON public.documents (case_id);
CREATE INDEX IF NOT EXISTS documents_uploader_id_idx ON public.documents (uploader_id);
CREATE INDEX IF NOT EXISTS documents_deleted_at_idx ON public.documents (deleted_at);

-- invoices
CREATE INDEX IF NOT EXISTS invoices_tenant_id_idx ON public.invoices (tenant_id);
CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON public.invoices (client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON public.invoices (due_date);

-- events
CREATE INDEX IF NOT EXISTS events_tenant_id_idx ON public.events (tenant_id);
CREATE INDEX IF NOT EXISTS events_case_id_idx ON public.events (case_id);
CREATE INDEX IF NOT EXISTS events_start_time_idx ON public.events (start_time);
CREATE INDEX IF NOT EXISTS events_event_type_idx ON public.events (event_type);

-- event_assignments
CREATE UNIQUE INDEX IF NOT EXISTS event_assignments_event_user_idx
  ON public.event_assignments (event_id, user_id);
CREATE INDEX IF NOT EXISTS event_assignments_user_id_idx
  ON public.event_assignments (user_id);
CREATE INDEX IF NOT EXISTS event_assignments_tenant_id_idx
  ON public.event_assignments (tenant_id);

-- messages
CREATE INDEX IF NOT EXISTS messages_tenant_id_idx ON public.messages (tenant_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_receiver_id_idx ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS messages_case_id_idx ON public.messages (case_id);

-- notifications
CREATE INDEX IF NOT EXISTS notifications_tenant_id_idx ON public.notifications (tenant_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications ("read");
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at);

-- audit_logs
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_type_idx ON public.audit_logs (resource_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at);

-- case_notes
CREATE INDEX IF NOT EXISTS case_notes_tenant_id_idx ON public.case_notes (tenant_id);
CREATE INDEX IF NOT EXISTS case_notes_case_id_idx ON public.case_notes (case_id);

-- payments
CREATE INDEX IF NOT EXISTS payments_tenant_id_idx ON public.payments (tenant_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

-- permissions
CREATE INDEX IF NOT EXISTS permissions_tenant_id_idx ON public.permissions (tenant_id);
CREATE INDEX IF NOT EXISTS permissions_role_idx ON public.permissions (role);


-- ==============================================================
-- PARTIE 7 — TRIGGERS updated_at
-- ==============================================================

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS currencies_updated_at ON public.currencies;
CREATE TRIGGER currencies_updated_at BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS cases_updated_at ON public.cases;
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS case_notes_updated_at ON public.case_notes;
CREATE TRIGGER case_notes_updated_at BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS permissions_updated_at ON public.permissions;
CREATE TRIGGER permissions_updated_at BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ==============================================================
-- PARTIE 8 — TRIGGER auth.users → public.users
-- ==============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================
-- PARTIE 9 — RLS (Row Level Security)
-- ==============================================================

-- Activer RLS
DO $$ BEGIN ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.events ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN others THEN NULL; END $$;

-- Service role a accès total (bypass RLS déjà actif par défaut,
-- mais on ajoute des policies explicites pour l'anon key futur)
CREATE POLICY "Service role full access" ON public.tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.currencies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.event_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.case_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.permissions FOR ALL USING (true) WITH CHECK (true);


-- ==============================================================
-- PARTIE 10 — DONNÉES DE RÉFÉRENCE
-- ==============================================================

INSERT INTO public.currencies (id, code, name, symbol, created_at, updated_at)
VALUES
  ('c2000000-0000-0000-0000-000000000001', 'XAF', 'Franc CFA (BEAC)', 'FCFA', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000002', 'EUR', 'Euro', 'E', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000003', 'GBP', 'Livre Sterling', '£', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000004', 'XOF', 'Franc CFA (BCEAO)', 'FCFA', NOW(), NOW()),
  ('c2000000-0000-0000-0000-000000000005', 'USD', 'Dollar US', '$', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;


-- ==============================================================
-- PARTIE 11 — VUES UTILITAIRES
-- ==============================================================

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
-- FIN — RÉSUMÉ
-- ==============================================================
--  8  types ENUM
-- 16  tables (12 existantes mises à jour + 4 nouvelles)
-- 4   vues utilitaires
--  3  fonctions
-- 11  triggers updated_at + 1 trigger auth.users
-- 40+ index
-- 16  politiques RLS
-- 5   devises par défaut
-- ==============================================================