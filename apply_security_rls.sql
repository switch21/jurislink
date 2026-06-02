-- 1. Restrict Audit Logs visibility to root_admin only, but allow users to insert their own logs
DROP POLICY IF EXISTS "Audit_Logs tenant isolation" ON audit_logs;

CREATE POLICY "Audit_Logs visibility" ON audit_logs
    FOR SELECT
    USING (public.get_user_role() = 'root_admin');

CREATE POLICY "Audit_Logs insert" ON audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 2. Enforce 2FA for Admins (AAL2 check)
-- This policy ensures that root_admins and firm_admins cannot read or write to sensitive tables unless their session level is aal2.
-- For simplicity, we apply it to 'users' and 'tenants' tables as an example, but it could be expanded.

DROP POLICY IF EXISTS "Enforce AAL2 for Admins on Users" ON users;
CREATE POLICY "Enforce AAL2 for Admins on Users" ON users
    AS RESTRICTIVE
    FOR ALL
    USING (
        (public.get_user_role() NOT IN ('root_admin', 'firm_admin')) 
        OR (auth.jwt()->>'aal' = 'aal2')
    );

DROP POLICY IF EXISTS "Enforce AAL2 for Admins on Tenants" ON tenants;
CREATE POLICY "Enforce AAL2 for Admins on Tenants" ON tenants
    AS RESTRICTIVE
    FOR ALL
    USING (
        (public.get_user_role() NOT IN ('root_admin', 'firm_admin')) 
        OR (auth.jwt()->>'aal' = 'aal2')
    );
