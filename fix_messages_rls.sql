-- 1. On s'assure que get_tenant_id peut lire la table users sans être bloqué par le RLS de users (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- 2. On supprime l'ancienne politique globale qui pose problème pour les INSERT
DROP POLICY IF EXISTS "Messages tenant isolation" ON messages;

-- 3. On crée des politiques explicites par action pour la table messages
CREATE POLICY "Messages read" ON messages
    FOR SELECT
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "Messages insert" ON messages
    FOR INSERT
    WITH CHECK (
        (tenant_id = public.get_tenant_id() AND sender_id = auth.uid()) 
        OR public.get_user_role() = 'root_admin'
    );

CREATE POLICY "Messages update" ON messages
    FOR UPDATE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');

CREATE POLICY "Messages delete" ON messages
    FOR DELETE
    USING (tenant_id = public.get_tenant_id() OR public.get_user_role() = 'root_admin');
