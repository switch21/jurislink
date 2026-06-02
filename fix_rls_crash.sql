-- 1. Supprimer les politiques restrictives qui causent la boucle infinie sur la table users et tenants
DROP POLICY IF EXISTS "Enforce AAL2 for Admins on Users" ON users;
DROP POLICY IF EXISTS "Enforce AAL2 for Admins on Tenants" ON tenants;

-- 2. Corriger la fonction get_user_role pour éviter la boucle infinie (SECURITY DEFINER permet de contourner le RLS de la table users lors de la lecture du rôle)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 3. (Optionnel) Si vous souhaitez toujours forcer AAL2 pour les admins, faites-le UNIQUEMENT sur les tables sensibles (factures, dossiers, etc.) mais JAMAIS sur "users" ou "tenants", car l'application a besoin de lire ces tables pour vérifier le statut MFA !
