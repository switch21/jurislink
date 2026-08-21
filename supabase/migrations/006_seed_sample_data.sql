-- ==============================================================
-- JURISLINK V2 — SEED DATA (7 cabinets, 26 users, 35 clients, etc.)
-- ==============================================================
-- IMPORTANT: Exécuter chaque bloc séparément dans l'éditeur SQL Supabase.
-- Les blocs DO (BLOC C) doivent être exécutés SEULS (pas de $$ multiples).
-- ==============================================================

-- ==============================================================
-- BLOC 0 — Diagnostic: vérifier les colonnes des tables à peupler
--           (exécuter UNE FOIS pour vérifier le schéma)
-- ==============================================================
/*
SET ROLE postgres;
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('clients','cases','tasks','documents','invoices','events','event_assignments','messages','notifications','currencies')
ORDER BY table_name, ordinal_position;
*/


-- ==============================================================
-- BLOC A — Tenants (7 cabinets) — DÉJÀ EXÉCUTÉ ✅
-- ==============================================================
/*
SET ROLE postgres;
INSERT INTO public.tenants (id, name, logo_url, language, timezone, created_at, updated_at, phone, email, address, niu, plan, max_users, max_storage_gb, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Dupont & Associés', NULL, 'fr', 'Europe/Paris', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z', '+33 1 42 68 53 00', 'contact@dupont-avocats.fr', '12 Rue de Rivoli, 75001 Paris', 'FR12345678901', 'enterprise', 50, 100, true),
  ('a1000000-0000-0000-0000-000000000002', 'Martin Juridique', NULL, 'fr', 'Europe/Paris', '2024-01-05T00:00:00Z', '2024-01-05T00:00:00Z', '+33 4 91 25 43 00', 'info@martin-juridique.fr', '25 Canebière, 13001 Marseille', 'FR23456789012', 'professional', 20, 50, true),
  ('a1000000-0000-0000-0000-000000000003', 'Leroy Avocats', NULL, 'fr', 'Europe/Brussels', '2024-01-10T00:00:00Z', '2024-01-10T00:00:00Z', '+32 2 345 67 89', 'bruxelles@leroy-avocats.be', '8 Avenue Louise, 1050 Bruxelles', 'BE0456789012', 'professional', 20, 50, true),
  ('a1000000-0000-0000-0000-000000000004', 'Bernard & Fils', NULL, 'fr', 'Europe/Paris', '2024-02-01T00:00:00Z', '2024-02-01T00:00:00Z', '+33 3 88 45 67 00', 'bernard@avocats-bernard.fr', '15 Place Kléber, 67000 Strasbourg', 'FR56789012345', 'starter', 10, 20, true),
  ('a1000000-0000-0000-0000-000000000005', 'Moreau Legal Group', NULL, 'en', 'Europe/London', '2024-02-15T00:00:00Z', '2024-02-15T00:00:00Z', '+44 20 7946 0958', 'london@moreau-legal.co.uk', '100 Fleet Street, EC4A 2AB London', 'UK987654321', 'enterprise', 50, 100, true),
  ('a1000000-0000-0000-0000-000000000006', 'Petit & Renaud', NULL, 'fr', 'Europe/Paris', '2024-03-01T00:00:00Z', '2024-03-01T00:00:00Z', '+33 5 56 44 32 10', 'bordeaux@petit-renaud.fr', '3 Allées de Tourny, 33000 Bordeaux', 'FR89012345678', 'starter', 10, 20, true),
  ('a1000000-0000-0000-0000-000000000007', 'Garcia Avocats', NULL, 'fr', 'Africa/Lagos', '2024-03-15T00:00:00Z', '2024-03-15T00:00:00Z', '+228 22 51 23 45', 'lome@garcia-avocats.tg', '45 Rue du Commerce, Lomé', 'TG0012345678', 'starter', 10, 20, true);
*/


-- ==============================================================
-- BLOC B — Currencies (si table vide)
-- ==============================================================
/*
SET ROLE postgres;
INSERT INTO public.currencies (id, code, name, symbol, created_at, updated_at) VALUES
  ('cur00001-0000-0000-0000-000000000001', 'EUR', 'Euro', '€', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
  ('cur00001-0000-0000-0000-000000000002', 'GBP', 'British Pound', '£', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
  ('cur00001-0000-0000-0000-000000000003', 'XOF', 'CFA Franc BCEAO', 'CFA', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
  ('cur00001-0000-0000-0000-000000000004', 'USD', 'US Dollar', '$', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
ON CONFLICT DO NOTHING;
*/


-- ==============================================================
-- BLOC C — Auth Users (26 utilisateurs)
-- CORRECTION: instance_id utilise COALESCE pour récupérer l'UUID
--   existant ou utiliser un UUID par défaut (pas le project ref!)
-- ⚠️ Exécuter CE BLOC SEUL (contient $$)
-- ==============================================================
SET ROLE postgres;
DO $$
DECLARE
  v_inst UUID := COALESCE(
    (SELECT instance_id FROM auth.users LIMIT 1),
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'::uuid
  );
BEGIN
  -- Cabinet 1: Dupont & Associés (5 users)
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, invited_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin) VALUES
    ('b1000000-0000-0000-0000-000000000001', v_inst, 'admin.dupont@jurislink.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', '{"full_name":"Marie Dupont"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000002', v_inst, 'jl.martin@jurislink.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-16T10:00:00Z', '2024-01-16T10:00:00Z', '2024-01-16T10:00:00Z', '2024-01-16T10:00:00Z', '{"full_name":"Jean-Luc Martin"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000003', v_inst, 's.bernard@jurislink.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-17T08:30:00Z', '2024-01-17T08:30:00Z', '2024-01-17T08:30:00Z', '2024-01-17T08:30:00Z', '{"full_name":"Sophie Bernard"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000004', v_inst, 'p.moreau@jurislink.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z', '{"full_name":"Pierre Moreau"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000005', v_inst, 'a.assistant@jurislink.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-05T14:00:00Z', '2024-02-05T14:00:00Z', '2024-02-05T14:00:00Z', '2024-02-05T14:00:00Z', '{"full_name":"Alice Lemoine"}', '{"provider":"email"}', false),

  -- Cabinet 2: Martin Juridique (4 users)
    ('b1000000-0000-0000-0000-000000000006', v_inst, 'thomas.martin@martin-juridique.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-20T09:00:00Z', '2024-01-20T09:00:00Z', '2024-01-20T09:00:00Z', '2024-01-20T09:00:00Z', '{"full_name":"Thomas Martin"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000007', v_inst, 'claire.dufour@martin-juridique.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-22T10:30:00Z', '2024-01-22T10:30:00Z', '2024-01-22T10:30:00Z', '2024-01-22T10:30:00Z', '{"full_name":"Claire Dufour"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000008', v_inst, 'marc.petit@martin-juridique.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-25T08:00:00Z', '2024-01-25T08:00:00Z', '2024-01-25T08:00:00Z', '2024-01-25T08:00:00Z', '{"full_name":"Marc Petit"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000009', v_inst, 'nathalie.roy@martin-juridique.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-01T11:00:00Z', '2024-02-01T11:00:00Z', '2024-02-01T11:00:00Z', '2024-02-01T11:00:00Z', '{"full_name":"Nathalie Roy"}', '{"provider":"email"}', false),

  -- Cabinet 3: Leroy Avocats (4 users)
    ('b1000000-0000-0000-0000-000000000010', v_inst, 'philippe.leroy@leroy-avocats.be', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', '{"full_name":"Philippe Leroy"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000011', v_inst, 'isabelle.renaud@leroy-avocats.be', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-18T10:00:00Z', '2024-01-18T10:00:00Z', '2024-01-18T10:00:00Z', '2024-01-18T10:00:00Z', '{"full_name":"Isabelle Renaud"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000012', v_inst, 'david.mercier@leroy-avocats.be', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-01-20T08:45:00Z', '2024-01-20T08:45:00Z', '2024-01-20T08:45:00Z', '2024-01-20T08:45:00Z', '{"full_name":"David Mercier"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000013', v_inst, 'laura.blanc@leroy-avocats.be', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-01T09:30:00Z', '2024-02-01T09:30:00Z', '2024-02-01T09:30:00Z', '2024-02-01T09:30:00Z', '{"full_name":"Laura Blanc"}', '{"provider":"email"}', false),

  -- Cabinet 4: Bernard & Fils (4 users)
    ('b1000000-0000-0000-0000-000000000014', v_inst, 'emile.bernard@avocats-bernard.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-05T09:00:00Z', '2024-02-05T09:00:00Z', '2024-02-05T09:00:00Z', '2024-02-05T09:00:00Z', '{"full_name":"Émile Bernard"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000015', v_inst, 'julie.fils@avocats-bernard.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-06T10:00:00Z', '2024-02-06T10:00:00Z', '2024-02-06T10:00:00Z', '2024-02-06T10:00:00Z', '{"full_name":"Julie Bernard"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000016', v_inst, 'antoine.girard@avocats-bernard.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-10T08:00:00Z', '2024-02-10T08:00:00Z', '2024-02-10T08:00:00Z', '2024-02-10T08:00:00Z', '{"full_name":"Antoine Girard"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000017', v_inst, 'marie.roux@avocats-bernard.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-15T09:00:00Z', '2024-02-15T09:00:00Z', '2024-02-15T09:00:00Z', '2024-02-15T09:00:00Z', '{"full_name":"Marie Roux"}', '{"provider":"email"}', false),

  -- Cabinet 5: Moreau Legal Group (4 users)
    ('b1000000-0000-0000-0000-000000000018', v_inst, 'james.moreau@moreau-legal.co.uk', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-20T09:00:00Z', '2024-02-20T09:00:00Z', '2024-02-20T09:00:00Z', '2024-02-20T09:00:00Z', '{"full_name":"James Moreau"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000019', v_inst, 'sarah.chen@moreau-legal.co.uk', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-22T10:00:00Z', '2024-02-22T10:00:00Z', '2024-02-22T10:00:00Z', '2024-02-22T10:00:00Z', '{"full_name":"Sarah Chen"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000020', v_inst, 'oliver.smith@moreau-legal.co.uk', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-02-25T08:00:00Z', '2024-02-25T08:00:00Z', '2024-02-25T08:00:00Z', '2024-02-25T08:00:00Z', '{"full_name":"Oliver Smith"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000021', v_inst, 'emma.wilson@moreau-legal.co.uk', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-03-01T09:00:00Z', '2024-03-01T09:00:00Z', '2024-03-01T09:00:00Z', '2024-03-01T09:00:00Z', '{"full_name":"Emma Wilson"}', '{"provider":"email"}', false),

  -- Cabinet 6: Petit & Renaud (3 users)
    ('b1000000-0000-0000-0000-000000000022', v_inst, 'luc.petit@petit-renaud.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-03-05T09:00:00Z', '2024-03-05T09:00:00Z', '2024-03-05T09:00:00Z', '2024-03-05T09:00:00Z', '{"full_name":"Luc Petit"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000023', v_inst, 'camille.renaud@petit-renaud.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-03-06T10:00:00Z', '2024-03-06T10:00:00Z', '2024-03-06T10:00:00Z', '2024-03-06T10:00:00Z', '{"full_name":"Camille Renaud"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000024', v_inst, 'hugo.dubois@petit-renaud.fr', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-03-10T08:30:00Z', '2024-03-10T08:30:00Z', '2024-03-10T08:30:00Z', '2024-03-10T08:30:00Z', '{"full_name":"Hugo Dubois"}', '{"provider":"email"}', false),

  -- Cabinet 7: Garcia Avocats (2 users)
    ('b1000000-0000-0000-0000-000000000025', v_inst, 'pedro.garcia@garcia-avocats.tg', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-03-15T09:00:00Z', '2024-03-15T09:00:00Z', '2024-03-15T09:00:00Z', '2024-03-15T09:00:00Z', '{"full_name":"Pedro Garcia"}', '{"provider":"email"}', false),
    ('b1000000-0000-0000-0000-000000000026', v_inst, 'amina.kofi@garcia-avocats.tg', crypt('Jurislink2024!', gen_salt('bf')), 'authenticated', 'authenticated', '2024-03-16T10:00:00Z', '2024-03-16T10:00:00Z', '2024-03-16T10:00:00Z', '2024-03-16T10:00:00Z', '{"full_name":"Amina Kofi"}', '{"provider":"email"}', false);
END;
$$;


-- ==============================================================
-- BLOC D — Public Users (profils métier)
-- Dépend de: BLOC C (auth.users)
-- ==============================================================
SET ROLE postgres;
INSERT INTO public.users (id, tenant_id, role, full_name, email, preferred_language, created_at, updated_at, is_active, failed_login_attempts, locked_until, last_login_at, last_session_id, session_count_today) VALUES
  -- Cabinet 1: Dupont & Associés
    ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'admin', 'Marie Dupont', 'admin.dupont@jurislink.fr', 'fr', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', true, 0, NULL, '2024-06-15T08:30:00Z', 'sess-001', 3),
    ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'lawyer', 'Jean-Luc Martin', 'jl.martin@jurislink.fr', 'fr', '2024-01-16T10:00:00Z', '2024-01-16T10:00:00Z', true, 0, NULL, '2024-06-15T09:00:00Z', 'sess-002', 2),
    ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'lawyer', 'Sophie Bernard', 's.bernard@jurislink.fr', 'fr', '2024-01-17T08:30:00Z', '2024-01-17T08:30:00Z', true, 0, NULL, '2024-06-14T16:00:00Z', 'sess-003', 1),
    ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'lawyer', 'Pierre Moreau', 'p.moreau@jurislink.fr', 'fr', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z', true, 0, NULL, '2024-06-14T10:00:00Z', 'sess-004', 1),
    ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'assistant', 'Alice Lemoine', 'a.assistant@jurislink.fr', 'fr', '2024-02-05T14:00:00Z', '2024-02-05T14:00:00Z', true, 0, NULL, '2024-06-15T07:45:00Z', 'sess-005', 4),
  -- Cabinet 2: Martin Juridique
    ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'admin', 'Thomas Martin', 'thomas.martin@martin-juridique.fr', 'fr', '2024-01-20T09:00:00Z', '2024-01-20T09:00:00Z', true, 0, NULL, '2024-06-14T14:00:00Z', 'sess-006', 2),
    ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'lawyer', 'Claire Dufour', 'claire.dufour@martin-juridique.fr', 'fr', '2024-01-22T10:30:00Z', '2024-01-22T10:30:00Z', true, 0, NULL, '2024-06-13T11:00:00Z', 'sess-007', 1),
    ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'lawyer', 'Marc Petit', 'marc.petit@martin-juridique.fr', 'fr', '2024-01-25T08:00:00Z', '2024-01-25T08:00:00Z', true, 0, NULL, '2024-06-15T08:00:00Z', 'sess-008', 2),
    ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 'assistant', 'Nathalie Roy', 'nathalie.roy@martin-juridique.fr', 'fr', '2024-02-01T11:00:00Z', '2024-02-01T11:00:00Z', true, 0, NULL, '2024-06-14T09:30:00Z', 'sess-009', 1),
  -- Cabinet 3: Leroy Avocats
    ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000003', 'admin', 'Philippe Leroy', 'philippe.leroy@leroy-avocats.be', 'fr', '2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z', true, 0, NULL, '2024-06-15T10:00:00Z', 'sess-010', 2),
    ('b1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000003', 'lawyer', 'Isabelle Renaud', 'isabelle.renaud@leroy-avocats.be', 'fr', '2024-01-18T10:00:00Z', '2024-01-18T10:00:00Z', true, 0, NULL, '2024-06-14T15:30:00Z', 'sess-011', 1),
    ('b1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000003', 'lawyer', 'David Mercier', 'david.mercier@leroy-avocats.be', 'fr', '2024-01-20T08:45:00Z', '2024-01-20T08:45:00Z', true, 0, NULL, '2024-06-13T09:00:00Z', 'sess-012', 1),
    ('b1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003', 'assistant', 'Laura Blanc', 'laura.blanc@leroy-avocats.be', 'fr', '2024-02-01T09:30:00Z', '2024-02-01T09:30:00Z', true, 0, NULL, '2024-06-15T11:00:00Z', 'sess-013', 3),
  -- Cabinet 4: Bernard & Fils
    ('b1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000004', 'admin', 'Émile Bernard', 'emile.bernard@avocats-bernard.fr', 'fr', '2024-02-05T09:00:00Z', '2024-02-05T09:00:00Z', true, 0, NULL, '2024-06-14T08:00:00Z', 'sess-014', 1),
    ('b1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000004', 'lawyer', 'Julie Bernard', 'julie.fils@avocats-bernard.fr', 'fr', '2024-02-06T10:00:00Z', '2024-02-06T10:00:00Z', true, 0, NULL, '2024-06-15T07:00:00Z', 'sess-015', 2),
    ('b1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000004', 'lawyer', 'Antoine Girard', 'antoine.girard@avocats-bernard.fr', 'fr', '2024-02-10T08:00:00Z', '2024-02-10T08:00:00Z', true, 0, NULL, '2024-06-13T14:00:00Z', 'sess-016', 1),
    ('b1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000004', 'assistant', 'Marie Roux', 'marie.roux@avocats-bernard.fr', 'fr', '2024-02-15T09:00:00Z', '2024-02-15T09:00:00Z', true, 0, NULL, '2024-06-14T16:30:00Z', 'sess-017', 1),
  -- Cabinet 5: Moreau Legal Group
    ('b1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000005', 'admin', 'James Moreau', 'james.moreau@moreau-legal.co.uk', 'en', '2024-02-20T09:00:00Z', '2024-02-20T09:00:00Z', true, 0, NULL, '2024-06-15T09:00:00Z', 'sess-018', 2),
    ('b1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000005', 'lawyer', 'Sarah Chen', 'sarah.chen@moreau-legal.co.uk', 'en', '2024-02-22T10:00:00Z', '2024-02-22T10:00:00Z', true, 0, NULL, '2024-06-14T10:30:00Z', 'sess-019', 1),
    ('b1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000005', 'lawyer', 'Oliver Smith', 'oliver.smith@moreau-legal.co.uk', 'en', '2024-02-25T08:00:00Z', '2024-02-25T08:00:00Z', true, 0, NULL, '2024-06-13T11:30:00Z', 'sess-020', 1),
    ('b1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000005', 'assistant', 'Emma Wilson', 'emma.wilson@moreau-legal.co.uk', 'en', '2024-03-01T09:00:00Z', '2024-03-01T09:00:00Z', true, 0, NULL, '2024-06-15T08:00:00Z', 'sess-021', 3),
  -- Cabinet 6: Petit & Renaud
    ('b1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000006', 'admin', 'Luc Petit', 'luc.petit@petit-renaud.fr', 'fr', '2024-03-05T09:00:00Z', '2024-03-05T09:00:00Z', true, 0, NULL, '2024-06-15T10:30:00Z', 'sess-022', 2),
    ('b1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000006', 'lawyer', 'Camille Renaud', 'camille.renaud@petit-renaud.fr', 'fr', '2024-03-06T10:00:00Z', '2024-03-06T10:00:00Z', true, 0, NULL, '2024-06-14T09:00:00Z', 'sess-023', 1),
    ('b1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000006', 'assistant', 'Hugo Dubois', 'hugo.dubois@petit-renaud.fr', 'fr', '2024-03-10T08:30:00Z', '2024-03-10T08:30:00Z', true, 0, NULL, '2024-06-13T08:00:00Z', 'sess-024', 1),
  -- Cabinet 7: Garcia Avocats
    ('b1000000-0000-0000-0000-000000000025', 'a1000000-0000-0000-0000-000000000007', 'admin', 'Pedro Garcia', 'pedro.garcia@garcia-avocats.tg', 'fr', '2024-03-15T09:00:00Z', '2024-03-15T09:00:00Z', true, 0, NULL, '2024-06-15T07:00:00Z', 'sess-025', 1),
    ('b1000000-0000-0000-0000-000000000026', 'a1000000-0000-0000-0000-000000000007', 'lawyer', 'Amina Kofi', 'amina.kofi@garcia-avocats.tg', 'fr', '2024-03-16T10:00:00Z', '2024-03-16T10:00:00Z', true, 0, NULL, '2024-06-14T11:00:00Z', 'sess-026', 1);


-- ==============================================================
-- BLOC E — Clients (35 clients, ~5 par cabinet)
-- Dépend de: BLOC D (public.users pour responsible_lawyer_id FK)
-- ⚠️ COLONNES: Adapter si le schéma réel diffère.
--   Colonnes attendues: id, tenant_id, first_name, last_name, email,
--     phone, company_name, type, responsible_lawyer_id, created_at, updated_at
-- ==============================================================
SET ROLE postgres;
INSERT INTO public.clients (id, tenant_id, first_name, last_name, email, phone, company_name, type, responsible_lawyer_id, created_at, updated_at) VALUES
  -- Cabinet 1: Dupont & Associés (5 clients)
    ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Jean', 'Durand', 'j.durand@email.com', '+33 6 12 34 56 78', 'Durand SARL', 'company', 'b1000000-0000-0000-0000-000000000002', '2024-01-20T10:00:00Z', '2024-01-20T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Marie', 'Lambert', 'm.lambert@email.com', '+33 6 23 45 67 89', NULL, 'individual', 'b1000000-0000-0000-0000-000000000003', '2024-01-25T11:00:00Z', '2024-01-25T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Paul', 'Moreau', 'p.moreau@email.com', '+33 6 34 56 78 90', 'Moreau & Cie', 'company', 'b1000000-0000-0000-0000-000000000002', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Sophie', 'Girard', 's.girard@email.com', '+33 6 45 67 89 01', 'Girard Consulting', 'company', 'b1000000-0000-0000-0000-000000000004', '2024-02-10T14:00:00Z', '2024-02-10T14:00:00Z'),
    ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'Luc', 'Bonnet', 'l.bonnet@email.com', '+33 6 56 78 90 12', NULL, 'individual', 'b1000000-0000-0000-0000-000000000003', '2024-02-15T10:30:00Z', '2024-02-15T10:30:00Z'),
  -- Cabinet 2: Martin Juridique (5 clients)
    ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'Alain', 'Richard', 'a.richard@email.com', '+33 6 11 22 33 44', 'Richard Frères', 'company', 'b1000000-0000-0000-0000-000000000007', '2024-01-25T09:00:00Z', '2024-01-25T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'Isabelle', 'Robert', 'i.robert@email.com', '+33 6 22 33 44 55', NULL, 'individual', 'b1000000-0000-0000-0000-000000000008', '2024-02-01T10:00:00Z', '2024-02-01T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'François', 'Petit', 'f.petit@email.com', '+33 6 33 44 55 66', 'Petit Logistics', 'company', 'b1000000-0000-0000-0000-000000000007', '2024-02-05T11:00:00Z', '2024-02-05T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 'Nathalie', 'Simon', 'n.simon@email.com', '+33 6 44 55 66 77', NULL, 'individual', 'b1000000-0000-0000-0000-000000000008', '2024-02-10T09:30:00Z', '2024-02-10T09:30:00Z'),
    ('c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 'Marc', 'Laurent', 'm.laurent@email.com', '+33 6 55 66 77 88', 'Laurent Tech', 'company', 'b1000000-0000-0000-0000-000000000007', '2024-02-15T14:00:00Z', '2024-02-15T14:00:00Z'),
  -- Cabinet 3: Leroy Avocats (5 clients)
    ('c1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000003', 'Pierre', 'Leclerc', 'p.leclerc@email.com', '+32 471 12 34 56', 'Leclerc SA', 'company', 'b1000000-0000-0000-0000-000000000011', '2024-01-20T10:00:00Z', '2024-01-20T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000003', 'Anne', 'Lefevre', 'a.lefevre@email.com', '+32 472 23 45 67', NULL, 'individual', 'b1000000-0000-0000-0000-000000000012', '2024-01-25T11:00:00Z', '2024-01-25T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000003', 'Jacques', 'Dupuis', 'j.dupuis@email.com', '+32 473 34 56 78', 'Dupuis Imports', 'company', 'b1000000-0000-0000-0000-000000000011', '2024-02-01T09:00:00Z', '2024-02-01T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000003', 'Christine', 'Thomas', 'c.thomas@email.com', '+32 474 45 67 89', NULL, 'individual', 'b1000000-0000-0000-0000-000000000012', '2024-02-10T10:00:00Z', '2024-02-10T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 'Michel', 'Robert', 'm.robert2@email.com', '+32 475 56 78 90', 'Robert & Fils BE', 'company', 'b1000000-0000-0000-0000-000000000011', '2024-02-15T14:00:00Z', '2024-02-15T14:00:00Z'),
  -- Cabinet 4: Bernard & Fils (5 clients)
    ('c1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000004', 'Louis', 'Morel', 'l.morel@email.com', '+33 6 77 88 99 00', 'Morel Agro', 'company', 'b1000000-0000-0000-0000-000000000015', '2024-02-10T09:00:00Z', '2024-02-10T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000004', 'Catherine', 'Faure', 'c.faure@email.com', '+33 6 88 99 00 11', NULL, 'individual', 'b1000000-0000-0000-0000-000000000016', '2024-02-15T10:00:00Z', '2024-02-15T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000004', 'Denis', 'Blanchard', 'd.blanchard@email.com', '+33 6 99 00 11 22', 'Blanchard SA', 'company', 'b1000000-0000-0000-0000-000000000015', '2024-02-20T11:00:00Z', '2024-02-20T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000004', 'Anne', 'Chevalier', 'a.chevalier@email.com', '+33 7 00 11 22 33', NULL, 'individual', 'b1000000-0000-0000-0000-000000000016', '2024-02-25T09:30:00Z', '2024-02-25T09:30:00Z'),
    ('c1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000004', 'Patrick', 'Garnier', 'p.garnier@email.com', '+33 7 11 22 33 44', 'Garnier Industrie', 'company', 'b1000000-0000-0000-0000-000000000015', '2024-03-01T14:00:00Z', '2024-03-01T14:00:00Z'),
  -- Cabinet 5: Moreau Legal Group (5 clients)
    ('c1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000005', 'John', 'Taylor', 'j.taylor@email.com', '+44 7700 900 123', 'Taylor Ltd', 'company', 'b1000000-0000-0000-0000-000000000019', '2024-02-25T09:00:00Z', '2024-02-25T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000005', 'Emily', 'Brown', 'e.brown@email.com', '+44 7700 900 234', NULL, 'individual', 'b1000000-0000-0000-0000-000000000020', '2024-03-01T10:00:00Z', '2024-03-01T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000005', 'Michael', 'Davies', 'm.davies@email.com', '+44 7700 900 345', 'Davies Corp', 'company', 'b1000000-0000-0000-0000-000000000019', '2024-03-05T11:00:00Z', '2024-03-05T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000005', 'Sarah', 'Evans', 's.evans@email.com', '+44 7700 900 456', NULL, 'individual', 'b1000000-0000-0000-0000-000000000020', '2024-03-10T09:30:00Z', '2024-03-10T09:30:00Z'),
    ('c1000000-0000-0000-0000-000000000025', 'a1000000-0000-0000-0000-000000000005', 'Robert', 'Walker', 'r.walker@email.com', '+44 7700 900 567', 'Walker & Partners', 'company', 'b1000000-0000-0000-0000-000000000019', '2024-03-15T14:00:00Z', '2024-03-15T14:00:00Z'),
  -- Cabinet 6: Petit & Renaud (5 clients)
    ('c1000000-0000-0000-0000-000000000026', 'a1000000-0000-0000-0000-000000000006', 'Franck', 'Roux', 'f.roux@email.com', '+33 6 12 98 76 54', 'Roux Vignobles', 'company', 'b1000000-0000-0000-0000-000000000023', '2024-03-10T09:00:00Z', '2024-03-10T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000027', 'a1000000-0000-0000-0000-000000000006', 'Valérie', 'Guerin', 'v.guerin@email.com', '+33 6 23 87 65 43', NULL, 'individual', 'b1000000-0000-0000-0000-000000000023', '2024-03-15T10:00:00Z', '2024-03-15T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000028', 'a1000000-0000-0000-0000-000000000006', 'Thierry', 'Boyer', 't.boyer@email.com', '+33 6 34 76 54 32', 'Boyer Immobilier', 'company', 'b1000000-0000-0000-0000-000000000023', '2024-03-20T11:00:00Z', '2024-03-20T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000029', 'a1000000-0000-0000-0000-000000000006', 'Laurence', 'Barbier', 'l.barbier@email.com', '+33 6 45 65 43 21', NULL, 'individual', 'b1000000-0000-0000-0000-000000000023', '2024-03-25T09:30:00Z', '2024-03-25T09:30:00Z'),
    ('c1000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000006', 'Sylvain', 'Moulin', 's.moulin@email.com', '+33 6 56 54 32 10', 'Moulin Tech', 'company', 'b1000000-0000-0000-0000-000000000023', '2024-04-01T14:00:00Z', '2024-04-01T14:00:00Z'),
  -- Cabinet 7: Garcia Avocats (5 clients)
    ('c1000000-0000-0000-0000-000000000031', 'a1000000-0000-0000-0000-000000000007', 'Kofi', 'Mensah', 'k.mensah@email.com', '+228 90 12 34 56', 'Mensah Trading', 'company', 'b1000000-0000-0000-0000-000000000026', '2024-03-20T09:00:00Z', '2024-03-20T09:00:00Z'),
    ('c1000000-0000-0000-0000-000000000032', 'a1000000-0000-0000-0000-000000000007', 'Adjo', 'Amegah', 'a.amegah@email.com', '+228 91 23 45 67', NULL, 'individual', 'b1000000-0000-0000-0000-000000000026', '2024-03-25T10:00:00Z', '2024-03-25T10:00:00Z'),
    ('c1000000-0000-0000-0000-000000000033', 'a1000000-0000-0000-0000-000000000007', 'Yao', 'Agbo', 'y.agbo@email.com', '+228 92 34 56 78', 'Agbo Logistics', 'company', 'b1000000-0000-0000-0000-000000000026', '2024-04-01T11:00:00Z', '2024-04-01T11:00:00Z'),
    ('c1000000-0000-0000-0000-000000000034', 'a1000000-0000-0000-0000-000000000007', 'Afi', 'Kossi', 'a.kossi@email.com', '+228 93 45 67 89', NULL, 'individual', 'b1000000-0000-0000-0000-000000000026', '2024-04-05T09:30:00Z', '2024-04-05T09:30:00Z'),
    ('c1000000-0000-0000-0000-000000000035', 'a1000000-0000-0000-0000-000000000007', 'Komlan', 'Dodzi', 'k.dodzi@email.com', '+228 94 56 78 90', 'Dodzi Import', 'company', 'b1000000-0000-0000-0000-000000000026', '2024-04-10T14:00:00Z', '2024-04-10T14:00:00Z');


-- ==============================================================
-- BLOC F — Cases / Dossiers (40 dossiers)
-- Dépend de: BLOC D (users FK) + BLOC E (clients FK)
-- CORRECTION: Utilise des noms de colonnes explicites + lignes courtes
-- ⚠️ Si le nom de colonne diffère, l'erreur sera claire.
-- ==============================================================
SET ROLE postgres;
INSERT INTO public.cases (id, tenant_id, client_id, title, description, status, opened_date, case_type, priority, lawyer_id, created_at, updated_at) VALUES
  -- Cabinet 1: Dupont & Associés (7 dossiers)
    ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Litige commercial Durand SARL', 'Contentieux avec fournisseur pour livraison non conforme', 'open', '2024-02-01', 'commercial', 'high', 'b1000000-0000-0000-0000-000000000002', '2024-02-01T10:00:00Z', '2024-02-01T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'Divorce Lambert', 'Procédure de divorce par consentement mutuel', 'in_progress', '2024-02-10', 'family', 'normal', 'b1000000-0000-0000-0000-000000000003', '2024-02-10T11:00:00Z', '2024-02-10T11:00:00Z'),
    ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Fusion Moreau & Cie', 'Conseil juridique pour fusion-acquisition', 'open', '2024-03-01', 'corporate', 'high', 'b1000000-0000-0000-0000-000000000002', '2024-03-01T09:00:00Z', '2024-03-01T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004', 'Brevet Girard Consulting', 'Dépôt de brevet et propriété intellectuelle', 'in_progress', '2024-03-15', 'ip', 'normal', 'b1000000-0000-0000-0000-000000000004', '2024-03-15T14:00:00Z', '2024-03-15T14:00:00Z'),
    ('d1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005', 'Succession Bonnet', 'Règlement de succession complexe', 'open', '2024-04-01', 'estate', 'low', 'b1000000-0000-0000-0000-000000000003', '2024-04-01T10:30:00Z', '2024-04-01T10:30:00Z'),
    ('d1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Licenciement abusif Durand', 'Contentieux prud-homal pour licenciement sans cause réelle', 'in_progress', '2024-04-15', 'labor', 'high', 'b1000000-0000-0000-0000-000000000002', '2024-04-15T09:00:00Z', '2024-04-15T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'Contrat commercial Moreau', 'Rédaction et négociation de contrat de distribution', 'closed', '2024-01-20', 'commercial', 'normal', 'b1000000-0000-0000-0000-000000000004', '2024-01-20T10:00:00Z', '2024-05-01T10:00:00Z'),
  -- Cabinet 2: Martin Juridique (7 dossiers)
    ('d1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000006', 'Litige bail Richard Frères', 'Litige avec propriétaire pour défaut d''entretien', 'open', '2024-02-15', 'real_estate', 'high', 'b1000000-0000-0000-0000-000000000007', '2024-02-15T09:00:00Z', '2024-02-15T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000007', 'Accident de la route Robert', 'Indemnisation suite à accident de la circulation', 'in_progress', '2024-03-01', 'personal_injury', 'high', 'b1000000-0000-0000-0000-000000000008', '2024-03-01T10:00:00Z', '2024-03-01T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000008', 'Créance Petit Logistics', 'Recouvrement de créances impayées', 'open', '2024-03-10', 'debt_collection', 'normal', 'b1000000-0000-0000-0000-000000000007', '2024-03-10T11:00:00Z', '2024-03-10T11:00:00Z'),
    ('d1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000009', 'Harcèlement Simon', 'Procédure pour harcèlement moral au travail', 'in_progress', '2024-03-20', 'labor', 'high', 'b1000000-0000-0000-0000-000000000008', '2024-03-20T09:30:00Z', '2024-03-20T09:30:00Z'),
    ('d1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000010', 'Contrat IT Laurent Tech', 'Rédaction contrat de prestation informatique', 'closed', '2024-02-20', 'corporate', 'normal', 'b1000000-0000-0000-0000-000000000007', '2024-02-20T14:00:00Z', '2024-05-10T14:00:00Z'),
    ('d1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000006', 'Permis construire Richard', 'Obtention permis de construire batiment commercial', 'in_progress', '2024-04-01', 'real_estate', 'normal', 'b1000000-0000-0000-0000-000000000008', '2024-04-01T09:00:00Z', '2024-04-01T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000007', 'Assurance Robert', 'Litige avec compagnie d''assurance', 'open', '2024-04-10', 'insurance', 'normal', 'b1000000-0000-0000-0000-000000000007', '2024-04-10T10:00:00Z', '2024-04-10T10:00:00Z'),
  -- Cabinet 3: Leroy Avocats (6 dossiers)
    ('d1000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000011', 'Fusion Leclerc SA', 'Opération de fusion avec sous-traitant belge', 'open', '2024-02-05', 'corporate', 'high', 'b1000000-0000-0000-0000-000000000011', '2024-02-05T10:00:00Z', '2024-02-05T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000012', 'Succession Lefevre', 'Règlement de succession transfrontalière FR-BE', 'in_progress', '2024-02-15', 'estate', 'normal', 'b1000000-0000-0000-0000-000000000012', '2024-02-15T11:00:00Z', '2024-02-15T11:00:00Z'),
    ('d1000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000013', 'Douane Dupuis Imports', 'Contentieux douanier sur marchandises importées', 'open', '2024-03-05', 'customs', 'high', 'b1000000-0000-0000-0000-000000000011', '2024-03-05T09:00:00Z', '2024-03-05T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000014', 'Divorce Thomas', 'Procédure contentieuse avec garde des enfants', 'in_progress', '2024-03-15', 'family', 'high', 'b1000000-0000-0000-0000-000000000012', '2024-03-15T10:00:00Z', '2024-03-15T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000015', 'Marque Robert & Fils', 'Enregistrement et protection de marque', 'closed', '2024-01-25', 'ip', 'normal', 'b1000000-0000-0000-0000-000000000011', '2024-01-25T14:00:00Z', '2024-04-20T14:00:00Z'),
    ('d1000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000011', 'Conformité RGPD Leclerc', 'Audit et mise en conformité RGPD', 'in_progress', '2024-04-01', 'compliance', 'normal', 'b1000000-0000-0000-0000-000000000012', '2024-04-01T09:00:00Z', '2024-04-01T09:00:00Z'),
  -- Cabinet 4: Bernard & Fils (6 dossiers)
    ('d1000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000016', 'Expropriation Morel Agro', 'Contestation d''expropriation pour voie ferrée', 'open', '2024-02-20', 'real_estate', 'high', 'b1000000-0000-0000-0000-000000000015', '2024-02-20T09:00:00Z', '2024-02-20T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000017', 'Violence conjugale Faure', 'Procédure de protection et divorce', 'in_progress', '2024-03-01', 'family', 'high', 'b1000000-0000-0000-0000-000000000016', '2024-03-01T10:00:00Z', '2024-03-01T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000018', 'Faillite Blanchard SA', 'Procédure collective et redressement judiciaire', 'open', '2024-03-15', 'bankruptcy', 'high', 'b1000000-0000-0000-0000-000000000015', '2024-03-15T11:00:00Z', '2024-03-15T11:00:00Z'),
    ('d1000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000019', 'Licenciement Chevalier', 'Contentieux pour licenciement discriminatoire', 'in_progress', '2024-04-01', 'labor', 'high', 'b1000000-0000-0000-0000-000000000016', '2024-04-01T09:30:00Z', '2024-04-01T09:30:00Z'),
    ('d1000000-0000-0000-0000-000000000025', 'a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000020', 'Pollution Garnier Industrie', 'Droit de l''environnement et responsabilité civile', 'open', '2024-04-10', 'environmental', 'high', 'b1000000-0000-0000-0000-000000000015', '2024-04-10T14:00:00Z', '2024-04-10T14:00:00Z'),
    ('d1000000-0000-0000-0000-000000000026', 'a1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000016', 'Succession Faure', 'Partage successoral complexe', 'closed', '2024-02-25', 'estate', 'normal', 'b1000000-0000-0000-0000-000000000016', '2024-02-25T10:00:00Z', '2024-05-15T10:00:00Z'),
  -- Cabinet 5: Moreau Legal Group (7 dossiers)
    ('d1000000-0000-0000-0000-000000000027', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000021', 'M&A Taylor Ltd', 'Due diligence pour acquisition cible UK', 'open', '2024-03-01', 'corporate', 'high', 'b1000000-0000-0000-0000-000000000019', '2024-03-01T09:00:00Z', '2024-03-01T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000028', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000022', 'Divorce Brown', 'International divorce England-France jurisdiction', 'in_progress', '2024-03-10', 'family', 'high', 'b1000000-0000-0000-0000-000000000020', '2024-03-10T10:00:00Z', '2024-03-10T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000029', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000023', 'IP licensing Davies Corp', 'Licence de brevet et royalties internationales', 'open', '2024-03-20', 'ip', 'normal', 'b1000000-0000-0000-0000-000000000019', '2024-03-20T11:00:00Z', '2024-03-20T11:00:00Z'),
    ('d1000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000024', 'Employment tribunal Evans', 'Unfair dismissal claim at employment tribunal', 'in_progress', '2024-04-01', 'labor', 'high', 'b1000000-0000-0000-0000-000000000020', '2024-04-01T09:30:00Z', '2024-04-01T09:30:00Z'),
    ('d1000000-0000-0000-0000-000000000031', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000025', 'Commercial dispute Walker', 'Breach of commercial contract litigation', 'open', '2024-04-10', 'commercial', 'normal', 'b1000000-0000-0000-0000-000000000019', '2024-04-10T14:00:00Z', '2024-04-10T14:00:00Z'),
    ('d1000000-0000-0000-0000-000000000032', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000021', 'NDA Taylor Ltd', 'Non-disclosure agreement for joint venture', 'closed', '2024-02-25', 'corporate', 'low', 'b1000000-0000-0000-0000-000000000020', '2024-02-25T09:00:00Z', '2024-04-01T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000033', 'a1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000023', 'Data protection Davies', 'GDPR compliance audit and remediation', 'in_progress', '2024-04-15', 'compliance', 'normal', 'b1000000-0000-0000-0000-000000000019', '2024-04-15T09:00:00Z', '2024-04-15T09:00:00Z'),
  -- Cabinet 6: Petit & Renaud (4 dossiers)
    ('d1000000-0000-0000-0000-000000000034', 'a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000026', 'AOC Roux Vignobles', 'Protection appellation d''origine contrôlée', 'open', '2024-03-15', 'ip', 'high', 'b1000000-0000-0000-0000-000000000023', '2024-03-15T09:00:00Z', '2024-03-15T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000035', 'a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000027', 'Guerin vs Propriétaire', 'Rupture abusive de bail commercial', 'in_progress', '2024-03-25', 'real_estate', 'high', 'b1000000-0000-0000-0000-000000000023', '2024-03-25T10:00:00Z', '2024-03-25T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000036', 'a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000028', 'VEFA Boyer Immobilier', 'Vente en l''état futur d''achèvement litige', 'open', '2024-04-05', 'real_estate', 'normal', 'b1000000-0000-0000-0000-000000000023', '2024-04-05T11:00:00Z', '2024-04-05T11:00:00Z'),
    ('d1000000-0000-0000-0000-000000000037', 'a1000000-0000-0000-0000-000000000006', 'c1000000-0000-0000-0000-000000000029', 'Testament Barbier', 'Rédaction et enregistrement testament', 'closed', '2024-03-20', 'estate', 'low', 'b1000000-0000-0000-0000-000000000023', '2024-03-20T09:30:00Z', '2024-04-10T09:30:00Z'),
  -- Cabinet 7: Garcia Avocats (3 dossiers)
    ('d1000000-0000-0000-0000-000000000038', 'a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000031', 'Import Mensah Trading', 'Contentieux douanier import-export Togo', 'open', '2024-04-01', 'customs', 'high', 'b1000000-0000-0000-0000-000000000026', '2024-04-01T09:00:00Z', '2024-04-01T09:00:00Z'),
    ('d1000000-0000-0000-0000-000000000039', 'a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000032', 'Succession Amegah', 'Règlement de succession succession coutumière', 'in_progress', '2024-04-10', 'estate', 'normal', 'b1000000-0000-0000-0000-000000000026', '2024-04-10T10:00:00Z', '2024-04-10T10:00:00Z'),
    ('d1000000-0000-0000-0000-000000000040', 'a1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000033', 'Contrat Agbo Logistics', 'Rédaction contrat de transport international', 'open', '2024-04-15', 'commercial', 'normal', 'b1000000-0000-0000-0000-000000000026', '2024-04-15T11:00:00Z', '2024-04-15T11:00:00Z');
