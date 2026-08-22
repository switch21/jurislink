import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env'
  )
}

// Service-role client: bypasses RLS, used by API routes for admin operations.
// Tenant isolation is enforced in application logic (WHERE tenant_id = ...).
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})

// Anon client for auth operations (signInWithPassword, etc.)
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
})
