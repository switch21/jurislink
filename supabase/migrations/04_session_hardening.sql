-- ============================================================================
-- JurisLink - Phase 5.7 - Migration SQL: session hardening (tracking)
-- ============================================================================
-- Emplacement: supabase/migrations/04_session_hardening.sql (nouveau fichier)
--
-- À exécuter via Supabase Dashboard → SQL Editor après le merge de la PR.
--
-- Objectif:
--   1. Ajouter colonnes de tracking de session sur la table users:
--      - last_login_at          (TIMESTAMPTZ) — dernière connexion réussie
--      - last_session_id        (TEXT)         — ID de session courant (corrélation audit_logs)
--      - session_count_today    (INTEGER)      — anti-session-sharing (compteur incrémenté à chaque login)
--   2. Créer une fonction SQL pour enregistrer une nouvelle session (appelée par
--      le trigger de login Supabase Auth — à configurer manuellement).
--   3. Créer un index sur last_login_at pour les dashboards de sécurité.
--
-- Notes:
--   - La durée max de session (8h) est vérifiée côté edge function via le
--     claim 'iat' du JWT (voir verify-session/index.patch.ts). Cette migration
--     ne stocke PAS le session_started_at car le JWT rotate toutes les ~1h
--     et le 'iat' serait rafraîchi — on suivrait pas la session réelle.
--   - Le compteur session_count_today est anti-énumération: si un compte
--     a 50+ sessions en 24h, c'est suspect (token refresh bombing ou
--     session sharing entre users).
--   - last_session_id est utile pour corréler les audit_logs: on peut
--     filtrer par session_id dans la metadata JSONB.
-- ============================================================================

-- 1. Ajout des colonnes de tracking session
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_session_id TEXT;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_count_today INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.last_login_at IS
  'Timestamp de la dernière connexion réussie (MFA validée). Mis à jour par register_successful_login().';
COMMENT ON COLUMN users.last_session_id IS
  'ID de session courant (UUID). Sert à corréler les audit_logs.metadata.session_id. Reset à chaque login.';
COMMENT ON COLUMN users.session_count_today IS
  'Nombre de logins réussis sur les dernières 24h. Anti-session-sharing. Si > 20, alerte sécurité.';

-- 2. Index pour dashboards de sécurité (top N logins récents par tenant)
CREATE INDEX IF NOT EXISTS idx_users_last_login_at
  ON users (last_login_at DESC);

-- ============================================================================
-- Function SQL: register_successful_login (UPDATED pour Phase 5)
-- ============================================================================
-- Étend la version Phase 4 (qui reset juste les compteurs d'échec) en:
--   - Mettant à jour last_login_at
--   - Incrémentant session_count_today (avec reset si dernière connexion > 24h)
--   - Stockant last_session_id (passé en paramètre)
-- ============================================================================

CREATE OR REPLACE FUNCTION register_successful_login(
  p_user_id UUID,
  p_session_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_login TIMESTAMPTZ;
BEGIN
  -- Récupère l'ancien last_login_at pour vérifier le reset du compteur
  SELECT last_login_at INTO v_last_login
  FROM users WHERE id = p_user_id;

  -- Si dernière connexion > 24h, reset session_count_today
  IF v_last_login IS NULL OR v_last_login < now() - INTERVAL '24 hours' THEN
    UPDATE users
    SET
      failed_login_attempts = 0,
      locked_until = NULL,
      last_login_at = now(),
      last_session_id = COALESCE(p_session_id, gen_random_uuid()::text),
      session_count_today = 1
    WHERE id = p_user_id;
  ELSE
    -- Sinon, incrémente le compteur (mais plafonne à 999 pour éviter
    -- les compteurs infinis si bug)
    UPDATE users
    SET
      failed_login_attempts = 0,
      locked_until = NULL,
      last_login_at = now(),
      last_session_id = COALESCE(p_session_id, gen_random_uuid()::text),
      session_count_today = LEAST(session_count_today + 1, 999)
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- ============================================================================
-- Function SQL: is_session_suspicious (helper pour alertes sécurité)
-- ============================================================================
-- Retourne true si l'utilisateur a un nombre anormal de sessions sur 24h
-- (seuil: 20 logins réussis en 24h — indique soit un bug client qui
-- spamme les logins, soit un session-sharing abusif).
-- ============================================================================

CREATE OR REPLACE FUNCTION is_session_suspicious(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND session_count_today > 20
  );
$$;

-- ============================================================================
-- Tests post-migration (à exécuter pour valider):
-- ============================================================================
--
-- Test 1: Vérifier que les colonnes existent
--   \d users
--   -- Attendu: last_login_at TIMESTAMPTZ (nullable)
--   --          last_session_id TEXT (nullable)
--   --          session_count_today INTEGER NOT NULL DEFAULT 0
--
-- Test 2: register_successful_login avec session_id
--   SELECT register_successful_login(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     'test-session-123'
--   );
--   -- Attendu: (vide — retourne VOID)
--
-- Test 3: is_session_suspicious
--   SELECT is_session_suspicious('00000000-0000-0000-0000-000000000000'::uuid);
--   -- Attendu: false (compte inexistant)
--
-- ============================================================================
-- Recommandations post-migration:
-- ============================================================================
-- 1. Configurer un cron quotidien pour détecter les sessions suspectes:
--    SELECT cron.schedule('alert-suspicious-sessions', '0 8 * * *',
--      $$ SELECT user_id, session_count_today, last_login_at
--         FROM users WHERE session_count_today > 20; $$);
--
-- 2. Pour rétroactivement remplir last_login_at avec les premières
--    audit_logs.action='LOGIN_SUCCESS_MFA' pour les users existants:
--    UPDATE users u
--    SET last_login_at = (
--      SELECT timestamp FROM audit_logs
--      WHERE user_id = u.id AND action = 'LOGIN_SUCCESS_MFA'
--      ORDER BY timestamp DESC LIMIT 1
--    )
--    WHERE last_login_at IS NULL;
--
-- 3. Le edge function verify-session (Phase 5) retourne maintenant
--    session_max_remaining_ms dans la réponse 200. Le client peut l'utiliser
--    pour afficher un warning "votre session expire dans X minutes" avant
--    le logout forcé.
-- ============================================================================
