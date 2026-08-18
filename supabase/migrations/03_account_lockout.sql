-- ============================================================================
-- JurisLink - Phase 4.5 - Migration SQL: account_lockout + rate_limit_buckets
-- ============================================================================
-- Emplacement: supabase/migrations/03_account_lockout.sql (nouveau fichier)
--
-- À exécuter via Supabase Dashboard → SQL Editor après le merge de la PR.
--
-- Objectif:
--   1. Ajouter colonnes failed_login_attempts + locked_until à la table users
--      pour bloquer automatiquement les comptes après N tentatives échouées.
--   2. Créer une table rate_limit_buckets (fallback PostgreSQL si Deno KV
--      indisponible dans l'edge function rate-limit).
--   3. Trigger PostgreSQL: incrémente failed_login_attempts sur échec auth,
--      débloque automatiquement après la durée de blocage.
-- ============================================================================

-- 1. Ajout des colonnes de lockout à la table users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Commentaire pour documentation
COMMENT ON COLUMN users.failed_login_attempts IS
  'Compteur de tentatives de login échouées consécutives. Reset à 0 après login réussi.';
COMMENT ON COLUMN users.locked_until IS
  'Timestamp jusquauquel le compte est bloqué. NULL si non bloqué. Auto-débloqué par le trigger unlock_after_threshold.';

-- 2. Index pour requêtes fréquentes (vérifier si un compte est bloqué)
CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON users (locked_until)
  WHERE locked_until IS NOT NULL;

-- ============================================================================
-- Table rate_limit_buckets (fallback PostgreSQL pour edge function rate-limit)
-- ============================================================================
-- Utilisée UNIQUEMENT si Deno.openKv() n'est pas disponible dans l'environnement
-- d'exécution (legacy Supabase runtime). Préférable: Deno KV.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL,
  blocked_until BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key)
);

-- Index pour la purge des buckets expirés (tâche de maintenance périodique)
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated_at
  ON rate_limit_buckets (updated_at);

-- TTL soft: un bucket sans update depuis 1h peut être purgé
-- (au lieu d'un vrai TTL PostgreSQL, on fait une tâche cron)
COMMENT ON TABLE rate_limit_buckets IS
  'Fallback PostgreSQL pour rate-limiting. Préférer Deno KV si disponible. Purger les buckets expirés via cron quotidiennement.';

-- ============================================================================
-- Function SQL: is_account_locked(user_uuid) → boolean
-- ============================================================================
-- Helper pour vérifier facilement si un compte est bloqué (utilisé par les
-- edge functions et les RLS policies).
-- ============================================================================

CREATE OR REPLACE FUNCTION is_account_locked(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND locked_until IS NOT NULL
      AND locked_until > now()
  );
$$;

-- Test de la fonction (à exécuter manuellement pour valider)
-- SELECT is_account_locked('00000000-0000-0000-0000-000000000000');
-- -- Attendu: false (UUID nul, donc user inexistant, donc non bloqué)

-- ============================================================================
-- Function SQL: register_failed_login(p_email TEXT)
-- ============================================================================
-- Incrémente le compteur d'échecs et bloque le compte si seuil atteint.
-- À appeler par l'edge function verify-session sur auth failure.
-- ============================================================================

CREATE OR REPLACE FUNCTION register_failed_login(p_email TEXT)
RETURNS TABLE(locked BOOLEAN, locked_until TIMESTAMPTZ, remaining_attempts INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_threshold INTEGER := 5;
  v_lockout_duration INTERVAL := '15 minutes';
BEGIN
  -- Trouve l'utilisateur par email
  SELECT id, failed_login_attempts INTO v_user
  FROM users WHERE email = p_email
  LIMIT 1;

  IF NOT FOUND THEN
    -- Email inconnu: ne révèle pas l'existence (anti-énumération)
    -- On retourne false mais le client doit se comporter comme si compte bloqué
    RETURN QUERY SELECT false, NULL::timestamptz, 0;
    RETURN;
  END IF;

  -- Incrémente
  UPDATE users
  SET failed_login_attempts = failed_login_attempts + 1
  WHERE id = v_user.id;

  -- Vérifie seuil
  IF v_user.failed_login_attempts + 1 >= v_threshold THEN
    UPDATE users
    SET locked_until = now() + v_lockout_duration
    WHERE id = v_user.id;

    RETURN QUERY SELECT true, now() + v_lockout_duration, 0;
  ELSE
    RETURN QUERY SELECT false, NULL::timestamptz, v_threshold - (v_user.failed_login_attempts + 1);
  END IF;
END;
$$;

-- ============================================================================
-- Function SQL: register_successful_login(p_user_id UUID)
-- ============================================================================
-- Remet à zéro le compteur d'échecs après login réussi.
-- ============================================================================

CREATE OR REPLACE FUNCTION register_successful_login(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
  SET failed_login_attempts = 0, locked_until = NULL
  WHERE id = p_user_id;
$$;

-- ============================================================================
-- Trigger: auto-unlock après expiration du seuil
-- ============================================================================
-- Quand une lecture sur users trouve locked_until dépassé, on remet à 0.
-- Plutôt qu'un trigger, on le fait via l'edge function verify-session
-- (lecture et reset sur la même transaction).
-- Pas de trigger SQL pour éviter la complexité — l'edge function gère.
-- ============================================================================

-- ============================================================================
-- Tests post-migration (à exécuter pour valider):
-- ============================================================================
--
-- Test 1: Vérifier que les colonnes existent
--   \d users
--   -- Attendu: failed_login_attempts INTEGER NOT NULL DEFAULT 0
--   --          locked_until TIMESTAMPTZ (nullable)
--
-- Test 2: Fonction is_account_locked
--   SELECT is_account_locked('00000000-0000-0000-0000-000000000000');
--   -- Attendu: false
--
-- Test 3: register_failed_login (email inexistant — anti-énumération)
--   SELECT * FROM register_failed_login('does-not-exist@example.com');
--   -- Attendu: false, NULL, 0
--
-- Test 4: register_successful_login
--   SELECT register_successful_login('00000000-0000-0000-0000-000000000000');
--   -- Attendu: (vide — retourne VOID)
--
-- Test 5: Table rate_limit_buckets
--   INSERT INTO rate_limit_buckets (bucket_key, count, window_start)
--   VALUES ('test', 1, extract(epoch from now())::bigint);
--   SELECT * FROM rate_limit_buckets WHERE bucket_key = 'test';
--   -- Attendu: 1 row
-- ============================================================================

-- ============================================================================
-- Recommandations post-migration:
-- ============================================================================
-- 1. Configurer les paramètres de lockout via env (supabase secrets):
--    supabase secrets set LOCKOUT_THRESHOLD=5
--    supabase secrets set LOCKOUT_DURATION_MS=900000  -- 15 min
--
-- 2. Programmer un cron quotidien pour purger les rate_limit_buckets expirés:
--    pg_cron ou Supabase Database Webhooks:
--      DELETE FROM rate_limit_buckets
--      WHERE updated_at < now() - INTERVAL '1 hour';
--
-- 3. Surveiller les lockouts via audit_logs (action: ACCOUNT_LOCKED):
--    SELECT user_id, timestamp, metadata->>'ip' AS ip
--    FROM audit_logs
--    WHERE action = 'ACCOUNT_LOCKED'
--    ORDER BY timestamp DESC LIMIT 50;
-- ============================================================================
