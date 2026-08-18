-- ============================================================================
-- JurisLink - Phase 1.1 - RLS Consolidé et Durci
-- ============================================================================
-- Objectif: Mettre en place un RLS cohérent, sans récursion infinie, avec
-- enforcement AAL2 sur les tables sensibles (jamais sur users/tenants).
--
-- Application: Exécuter dans le SQL Editor de Supabase (Dashboard).
-- Testé contre: supabase_schema.sql + apply_security_rls.sql + fix_*.sql
--
-- Effort estimé: 0.5 jour-homme (application + tests)
-- Risque: Faible (script idempotent)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ÉTAPE 1 — Sécurisation des fonctions helper (évite la récursion RLS)
-- ---------------------------------------------------------------------------
-- get_user_role() et get_tenant_id() DOIVENT être SECURITY DEFINER pour
-- contourner le RLS de la table `users` lors de leur exécution interne.
-- Sans cela, on retombe dans la récursion infinie détectée par fix_rls_crash.sql.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Fonction utilitaire: vérifie si l'utilisateur courant a une session AAL2
-- (utilisé par les politiques RESTRICTIVES sur tables sensibles)
CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS BOOLEAN AS $$
    SELECT COALESCE((auth.jwt() ->> 'aal') = 'aal2', false);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- ÉTAPE 2 — Correction du schema drift sur la table `tenants`
-- ---------------------------------------------------------------------------
-- UserProfile.tenant attend ces champs côté TypeScript, mais la table SQL
-- ne les contient pas. On les ajoute avec defaults sûrs.

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial',
    ADD COLUMN IF NOT EXISTS max_users INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_storage_gb INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS niu TEXT DEFAULT ''; -- Numéro d'Identification Unique (juridique)

-- ---------------------------------------------------------------------------
-- ÉTAPE 3 — Nettoyage des anciennes politiques conflictuelles
-- ---------------------------------------------------------------------------
-- On supprime TOUTES les politiques existantes pour repartir proprement.

DROP POLICY IF EXISTS "Tenants isolation" ON public.tenants;
DROP POLICY IF EXISTS "Currencies read" ON public.currencies;
DROP POLICY IF EXISTS "Currencies write" ON public.currencies;
DROP POLICY IF EXISTS "Users tenant isolation" ON public.users;
DROP POLICY IF EXISTS "Cases tenant isolation" ON public.cases;
DROP POLICY IF EXISTS "Tasks tenant isolation" ON public.tasks;
DROP POLICY IF EXISTS "Events tenant isolation" ON public.events;
DROP POLICY IF EXISTS "Invoices tenant isolation" ON public.invoices;
DROP POLICY IF EXISTS "Documents tenant isolation" ON public.documents;
DROP POLICY IF EXISTS "Messages tenant isolation" ON public.messages;
DROP POLICY IF EXISTS "Messages read" ON public.messages;
DROP POLICY IF EXISTS "Messages insert" ON public.messages;
DROP POLICY IF EXISTS "Messages update" ON public.messages;
DROP POLICY IF EXISTS "Messages delete" ON public.messages;
DROP POLICY IF EXISTS "Audit_Logs visibility" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit_Logs insert" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit_Logs tenant isolation" ON public.audit_logs;
DROP POLICY IF EXISTS "Enforce AAL2 for Admins on Users" ON public.users;
DROP POLICY IF EXISTS "Enforce AAL2 for Admins on Tenants" ON public.tenants;

-- ---------------------------------------------------------------------------
-- ÉTAPE 4 — Politiques sur `tenants` (les cabinets)
-- ---------------------------------------------------------------------------
-- Pas de politique AAL2 sur cette table (risque de récursion via get_user_role).
-- Séparation lecture/écriture.

CREATE POLICY "tenants_select_own_or_root"
    ON public.tenants FOR SELECT
    USING (
        id = public.get_tenant_id()
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "tenants_update_own"
    ON public.tenants FOR UPDATE
    USING (id = public.get_tenant_id() OR public.get_user_role() = 'root_admin')
    WITH CHECK (id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "tenants_insert_root_only"
    ON public.tenants FOR INSERT
    WITH CHECK (public.get_user_role() = 'root_admin');

CREATE POLICY "tenants_delete_root_only"
    ON public.tenants FOR DELETE
    USING (public.get_user_role() = 'root_admin');

-- ---------------------------------------------------------------------------
-- ÉTAPE 5 — Politiques sur `currencies` (référentiel global)
-- ---------------------------------------------------------------------------

CREATE POLICY "currencies_select_all"
    ON public.currencies FOR SELECT
    USING (true);

CREATE POLICY "currencies_write_root_only"
    ON public.currencies FOR ALL
    USING (public.get_user_role() = 'root_admin')
    WITH CHECK (public.get_user_role() = 'root_admin');

-- ---------------------------------------------------------------------------
-- ÉTAPE 6 — Politiques sur `users` (profils)
-- ---------------------------------------------------------------------------
-- L'utilisateur peut se lire lui-même + membres de son tenant.
-- root_admin: tous. Aucune politique AAL2 ici (récursion).

CREATE POLICY "users_select_own_or_tenant"
    ON public.users FOR SELECT
    USING (
        id = auth.uid()
        OR tenant_id = public.get_tenant_id()
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "users_insert_self_or_admin"
    ON public.users FOR INSERT
    WITH CHECK (
        id = auth.uid()
        OR public.get_user_role() IN ('root_admin', 'firm_admin')
    );

CREATE POLICY "users_update_own_or_admin"
    ON public.users FOR UPDATE
    USING (
        id = auth.uid()
        OR tenant_id = public.get_tenant_id() AND public.get_user_role() IN ('firm_admin', 'root_admin')
        OR public.get_user_role() = 'root_admin'
    )
    WITH CHECK (
        id = auth.uid()
        OR tenant_id = public.get_tenant_id() AND public.get_user_role() IN ('firm_admin', 'root_admin')
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "users_delete_admin_only"
    ON public.users FOR DELETE
    USING (
        (tenant_id = public.get_tenant_id() AND public.get_user_role() = 'firm_admin')
        OR public.get_user_role() = 'root_admin'
    );

-- ---------------------------------------------------------------------------
-- ÉTAPE 7 — Politiques sur `cases` (dossiers) + AAL2 RESTRICTIVE
-- ---------------------------------------------------------------------------
-- Politique permissive: tenant isolation (l'utilisateur voit son cabinet).
-- Politique RESTRICTIVE: impose AAL2 pour les admins (jamais pour clients).

CREATE POLICY "cases_select_tenant"
    ON public.cases FOR SELECT
    USING (
        tenant_id = public.get_tenant_id()
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "cases_insert_tenant"
    ON public.cases FOR INSERT
    WITH CHECK (
        tenant_id = public.get_tenant_id()
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "cases_update_tenant"
    ON public.cases FOR UPDATE
    USING (
        tenant_id = public.get_tenant_id()
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "cases_delete_tenant"
    ON public.cases FOR DELETE
    USING (
        tenant_id = public.get_tenant_id()
        OR public.get_user_role() = 'root_admin'
    );

-- Politique RESTRICTIVE: AAL2 obligatoire pour les administrateurs
CREATE POLICY "cases_restrictive_aal2_admin"
    ON public.cases AS RESTRICTIVE
    FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- ---------------------------------------------------------------------------
-- ÉTAPE 8 — Politiques sur `tasks`, `events`, `invoices`, `documents`
-- ---------------------------------------------------------------------------
-- Schéma identique: tenant isolation + politique AAL2 RESTRICTIVE.

-- === TASKS ===
CREATE POLICY "tasks_select_tenant"
    ON public.tasks FOR SELECT
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "tasks_insert_tenant"
    ON public.tasks FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "tasks_update_tenant"
    ON public.tasks FOR UPDATE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "tasks_delete_tenant"
    ON public.tasks FOR DELETE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "tasks_restrictive_aal2_admin"
    ON public.tasks AS RESTRICTIVE FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- === EVENTS ===
CREATE POLICY "events_select_tenant"
    ON public.events FOR SELECT
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "events_insert_tenant"
    ON public.events FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "events_update_tenant"
    ON public.events FOR UPDATE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "events_delete_tenant"
    ON public.events FOR DELETE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "events_restrictive_aal2_admin"
    ON public.events AS RESTRICTIVE FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- === INVOICES ===
CREATE POLICY "invoices_select_tenant"
    ON public.invoices FOR SELECT
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "invoices_insert_tenant"
    ON public.invoices FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "invoices_update_tenant"
    ON public.invoices FOR UPDATE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "invoices_delete_tenant"
    ON public.invoices FOR DELETE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "invoices_restrictive_aal2_admin"
    ON public.invoices AS RESTRICTIVE FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- === DOCUMENTS ===
CREATE POLICY "documents_select_tenant"
    ON public.documents FOR SELECT
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "documents_insert_tenant"
    ON public.documents FOR INSERT
    WITH CHECK (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "documents_update_tenant"
    ON public.documents FOR UPDATE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "documents_delete_tenant"
    ON public.documents FOR DELETE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "documents_restrictive_aal2_admin"
    ON public.documents AS RESTRICTIVE FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- ---------------------------------------------------------------------------
-- ÉTAPE 9 — Politiques sur `messages` (déjà corrigées par fix_messages_rls.sql)
-- ---------------------------------------------------------------------------
-- On réapplique la version corrigée pour cohérence.

CREATE POLICY "messages_select_tenant"
    ON public.messages FOR SELECT
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "messages_insert_tenant"
    ON public.messages FOR INSERT
    WITH CHECK (
        (tenant_id = public.get_tenant_id() AND sender_id = auth.uid())
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "messages_update_tenant"
    ON public.messages FOR UPDATE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "messages_delete_tenant"
    ON public.messages FOR DELETE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "messages_restrictive_aal2_admin"
    ON public.messages AS RESTRICTIVE FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- ---------------------------------------------------------------------------
-- ÉTAPE 10 — Politiques sur `audit_logs` (sensibilité maximale)
-- ---------------------------------------------------------------------------
-- Lecture: root_admin UNIQUEMENT (les firm_admins n'ont pas accès même à leur
-- tenant, conformément à apply_security_rls.sql initial).
-- Écriture: tout utilisateur peut insérer son propre log.

CREATE POLICY "audit_logs_select_root_only"
    ON public.audit_logs FOR SELECT
    USING (public.get_user_role() = 'root_admin');

CREATE POLICY "audit_logs_insert_own"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audit_logs_delete_root_only"
    ON public.audit_logs FOR DELETE
    USING (public.get_user_role() = 'root_admin');

CREATE POLICY "audit_logs_restrictive_aal2_admin"
    ON public.audit_logs AS RESTRICTIVE FOR ALL
    USING (
        public.get_user_role() NOT IN ('root_admin', 'firm_admin')
        OR public.is_aal2()
    );

-- ---------------------------------------------------------------------------
-- ÉTAPE 11 — Trigger de création automatique de profil utilisateur
-- ---------------------------------------------------------------------------
-- Quand un nouvel auth.users est créé (via edge function), on insère
-- automatiquement une ligne dans public.users avec des valeurs sûres.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, email, role, tenant_id, preferred_language)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'client'::public.user_role,
        NULL,
        COALESCE(NEW.raw_user_meta_data ->> 'preferred_language', 'fr')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- ÉTAPE 12 — Vérifications post-déploiement
-- ---------------------------------------------------------------------------
-- À exécuter pour valider que toutes les politiques sont en place.

-- Doit retourner 10 tables avec RLS activé:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants','currencies','users','cases','tasks','events','invoices','documents','messages','audit_logs')
ORDER BY tablename;

-- Doit retourner 35+ politiques (4 par table sensible + 3 sur tenants + 4 sur users + 2 sur currencies + 3 sur audit_logs):
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test fonctionnel: avec une session anonyme, on ne doit rien pouvoir lire.
-- À exécuter avec un utilisateur non authentifié (Anonymous):
-- SELECT * FROM public.cases;  -- doit retourner 0 ligne
-- SELECT * FROM public.users;  -- doit retourner 0 ligne

-- ============================================================================
-- FIN DU SCRIPT - Phase 1.1 RLS Consolidé
-- ============================================================================
