-- ============================================================================
-- JurisLink - Phase 3.6 - Migration SQL: audit_logs metadata JSONB
-- ============================================================================
-- Emplacement: supabase/migrations/02_audit_logs_metadata.sql (nouveau fichier)
--
-- À exécuter via Supabase Dashboard → SQL Editor après le merge de la PR.
--
-- Objectif:
--   Ajouter une colonne `metadata` JSONB à la table audit_logs pour stocker
--   du contexte structuré (IP, user_agent, session_id, request_id, source).
--   Permet des requêtes comme:
--     SELECT * FROM audit_logs WHERE metadata->>'ip' = '1.2.3.4';
--     SELECT * FROM audit_logs WHERE metadata @> '{"source": "edge_function"}';
--
-- Avantages vs colonnes plates (ip TEXT, user_agent TEXT, ...):
--   1. Extensibilité: on peut ajouter de nouvelles clés sans ALTER TABLE
--   2. Performance: index GIN permet recherche sur n'importe quelle clé
--   3. Document JSON: on peut logger des objets arbitraires (tailles de
--      payload, durées, états précédents, etc.)
--   4. Cohérence: tous les logs ont la même structure JSON
-- ============================================================================

-- 1. Ajout de la colonne metadata JSONB
-- Valeur par défaut '{}' pour ne pas casser les INSERT existants qui ne
-- fournissent pas metadata (rétro-compatible avec le code Phase 1/2).
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Index GIN sur metadata pour recherche rapide sur les clés JSON
-- GIN (Generalized Inverted Index) est l'index standard pour JSONB.
DROP INDEX IF EXISTS idx_audit_logs_metadata;
CREATE INDEX idx_audit_logs_metadata
  ON audit_logs USING GIN (metadata);

-- 3. Index composite action + timestamp DESC pour requêtes fréquentes:
--    "tous les USER_CREATE des 7 derniers jours" → tri optimal
DROP INDEX IF EXISTS idx_audit_logs_action_timestamp;
CREATE INDEX idx_audit_logs_action_timestamp
  ON audit_logs (action, timestamp DESC);

-- 4. Index sur user_id + timestamp pour historique par utilisateur
DROP INDEX IF EXISTS idx_audit_logs_user_timestamp;
CREATE INDEX idx_audit_logs_user_timestamp
  ON audit_logs (user_id, timestamp DESC);

-- 5. Index sur tenant_id + timestamp pour filtrer par cabinet
DROP INDEX IF EXISTS idx_audit_logs_tenant_timestamp;
CREATE INDEX idx_audit_logs_tenant_timestamp
  ON audit_logs (tenant_id, timestamp DESC);

-- 6. Documentation de la colonne (visible dans psql \d+ audit_logs)
COMMENT ON COLUMN audit_logs.metadata IS
  'Structured context JSONB. Convention: {ip TEXT, user_agent TEXT, session_id TEXT, request_id TEXT, source TEXT, [custom fields]}';

-- 7. Mise à jour de la politique RLS existante pour autoriser INSERT
--    avec metadata (politique existante Phase 1 inchangée car FOR ALL).
--    Pas de modification RLS nécessaire — la politique "Audit_Logs visibility"
--    de apply_security_rls.sql est toujours valide.

-- ============================================================================
-- Tests post-migration (à exécuter pour valider):
-- ============================================================================
--
-- Test 1: Vérifier que la colonne existe
--   \d audit_logs
--   -- Attendu: column metadata JSONB, default '{}'::jsonb, nullable
--
-- Test 2: Insert avec metadata
--   INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, metadata)
--   VALUES ('<tenant-uuid>', '<user-uuid>', 'TEST_INSERT', 'test', '<entity-uuid>',
--           '{"ip":"127.0.0.1","source":"migration_test"}');
--   -- Attendu: 1 row inserted
--
-- Test 3: Requête via opérateur JSONB
--   SELECT action, metadata->>'ip' AS ip
--   FROM audit_logs
--   WHERE metadata @> '{"source":"migration_test"}';
--   -- Attendu: returns the row inserted above
--
-- Test 4: Index GIN utilisé
--   EXPLAIN SELECT * FROM audit_logs
--   WHERE metadata @> '{"source":"migration_test"}';
--   -- Attendu: "Bitmap Heap Scan" + "Bitmap Index Scan using idx_audit_logs_metadata"
--
-- Test 5: Rétro-compatibilité (INSERT sans metadata)
--   INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id)
--   VALUES ('<tenant-uuid>', '<user-uuid>', 'LEGACY', 'test', '<entity-uuid>');
--   -- Attendu: 1 row inserted, metadata='{}'::jsonb automatiquement
-- ============================================================================
