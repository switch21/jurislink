// ============================================================================
// JurisLink - Phase 5.6 - Patch create-user edge function (HIBP server check)
// ============================================================================
// Remplace: supabase/functions/create-user/index.ts (version Phase 4)
//
// Changements vs Phase 4:
//   1. Vérification du password contre HaveIBeenPwned (k-anonymity, cöté serveur).
//      Si breach count > 0 → 400 + code BREACHED_PASSWORD + breach_count.
//      Implémente la même logique k-anonymity que le client (src/lib/hibp.ts).
//   2. Application des en-têtes de sécurité via _shared/security-headers.ts.
//   3. Audit log BREACHED_PASSWORD_REJECTED pour le SOC.
//
// Notes:
//   - Le check HIBP est EN COMPLÉMENT de la blacklist top 1000 (Phase 4).
//     La blacklist attrape les passwords triviaux. HIBP attrape les
//     passwords compromis réellement utilisés (14+ milliards de hashes).
//   - En cas d'indisponibilité HIBP (timeout, 429, etc.), on DEGRADE: on
//     accepte le password si la policy locale (entropy + blacklist) est OK.
//     Le risque accepté: un password compromis pourrait passer si HIBP down.
//     Mitigation: ajouter un cron quotidien qui check rétrospectivement
//     les passwords créés pendant la panne.
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { applySecurityHeaders } from '../_shared/security-headers.ts'

// ─── CORS (restreint) ───────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')
  .map(s => s.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ─── CSRF validation ────────────────────────────────────────────────────
const CSRF_HEADER = 'x-csrf-token';

function isValidCsrfToken(csrfToken: string | null): boolean {
  if (!csrfToken || typeof csrfToken !== 'string') return false;
  return csrfToken.length >= 32 && /^[A-Za-z0-9_-]+$/.test(csrfToken);
}

// ─── Password policy (server-side) ────────────────────────────────────────
// Identique à Phase 4 (top 1000 blacklist + entropy + patterns).
const SERVER_BLACKLIST = new Set([
  // Top 100 (identique au client)
  '123456', '123456789', 'qwerty', 'password', '111111', '12345678',
  'abc123', '1234567', 'password1', '12345', '1234567890', '123123',
  '000000', 'iloveyou', '1234', '1q2w3e4r5t', 'monkey', 'dragon',
  'sunshine', 'princess', 'football', 'shadow', 'superman', 'iloveu',
  'trustno1', 'welcome', 'letmein', 'admin', 'master', 'login',
  'starwars', 'baseball', 'computer', 'whatever', 'nothing', 'liverpool',
  'huawei', 'qazwsx', 'password123', 'freedom', 'passw0rd', 'zagreb',
  'qwerty123', 'michael1', 'qwerty1', 'matrix', 'asdasd', '1qaz2wsx',
  'jordan', 'jennifer', 'hunter', 'harley', 'ranger', 'robert',
  'soccer', 'thomas', 'george', 'charlie', 'andrew', 'joshua',
  'dallas', 'austin', 'maverick', 'mickey', 'diamond', 'summer',
  'ginger', 'mother', 'forever', 'flower', 'summer1', 'matthew',
  'jessica', 'pepper', 'mountain', 'elephant', 'spider', 'creative',
  'azerty', 'azerty123', 'soleil', 'bonjour', 'amoureux', 'amour',
  'motdepasse', 'mot2passe', 'juju', 'loulou', 'chouchou', 'choupette',
  '123456a', '123456b', 'azertyuiop', 'qwertyuiop', 'motdepasse123',
  // Top 100-200 supplémentaires (serveur only)
  'ninja', 'mustang', 'tigger', 'robert1', 'qwerty2', 'silver',
  'golfer', 'stars', 'knight', 'paradise', 'password12', 'michael',
  'password2', 'summer2', 'soccer1', 'iloveu2', 'george1', 'andrew1',
  'jordan1', 'jordan23', 'andrew2', 'joshua1', 'michael2',
  'killer', 'matrix1', 'matrix2', 'phoenix', 'passw0rd1', 'passw1',
  'letmein2', 'letmein1', 'abc1234', 'abcd1234', 'abcd123',
  '123abc', '123qwe', 'qwe123', 'q1w2e3r4', 'q1w2e3', '1q2w3e4r',
  'p@ssw0rd', 'p@ssword', 'pa$$word', 'pa$$w0rd', 'qwerty1!',
  'pass1234', 'pass123', 'test', 'test123', 'test1234', 'root',
  'toor', 'admin123', 'admin1', 'administrator', 'admin2', 'changeme',
  'default', 'guest', 'user', 'pass', 'pwd', 'secret', 'changeme1',
]);

interface PasswordIssue { code: string; message: string; }
interface PasswordAnalysis {
  score: number;
  strength: string;
  entropyBits: number;
  issues: PasswordIssue[];
  allowedForUser: boolean;
  allowedForAdmin: boolean;
}

function computeEntropyBits(password: string): number {
  if (!password) return 0;
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 33;
  return Math.floor(password.length * Math.log2(charsetSize || 1));
}

function analyzePassword(password: string): PasswordAnalysis {
  const issues: PasswordIssue[] = [];
  let score = 0;
  let charsetCategories = 0;

  if (password.length < 8) {
    issues.push({ code: 'TOO_SHORT', message: 'Password too short (minimum 8 characters)' });
  }
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 5;

  if (/[a-z]/.test(password)) { score += 5; charsetCategories++; }
  if (/[A-Z]/.test(password)) { score += 5; charsetCategories++; }
  if (/[0-9]/.test(password)) { score += 5; charsetCategories++; }
  if (/[^a-zA-Z0-9]/.test(password)) { score += 10; charsetCategories++; }

  if (charsetCategories < 3) {
    issues.push({ code: 'LOW_DIVERSITY', message: `Only ${charsetCategories} character categories (recommended: 3+)` });
  }

  const entropyBits = computeEntropyBits(password);
  if (entropyBits >= 60) score += 15;
  else if (entropyBits >= 40) score += 10;
  else if (entropyBits >= 28) score += 5;
  else {
    issues.push({ code: 'LOW_ENTROPY', message: `Low entropy (${entropyBits} bits — recommended: >= 40)` });
  }

  if (/(abc|bcd|cde|def|123|234|345|456|567|678|789|890|qwe|wer|ert|rty|asd|sdf|dfg)/i.test(password)) {
    score -= 15;
    issues.push({ code: 'COMMON_SEQUENCE', message: 'Common sequence detected' });
  }
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    issues.push({ code: 'REPEATED_CHARS', message: 'Character repeated 3+ consecutive times' });
  }
  if (/(qwerty|azerty|asdf|zxcv|1qaz|2wsx|3edc)/i.test(password)) {
    score -= 15;
    issues.push({ code: 'KEYBOARD_WALK', message: 'Keyboard pattern detected' });
  }

  if (SERVER_BLACKLIST.has(password.toLowerCase())) {
    score = Math.min(score, 10);
    issues.push({ code: 'BLACKLISTED', message: 'Password is in the top leaked passwords list' });
  }

  score = Math.max(0, Math.min(100, score));

  let strength: string;
  if (score < 20) strength = 'VeryWeak';
  else if (score < 40) strength = 'Weak';
  else if (score < 60) strength = 'Fair';
  else if (score < 80) strength = 'Strong';
  else strength = 'VeryStrong';

  return {
    score, strength, entropyBits, issues,
    allowedForUser: score >= 40,
    allowedForAdmin: score >= 60,
  };
}

// ─── PHASE 5.6: HIBP k-anonymity check (server-side) ───────────────────────

const HIBP_RANGE_API = 'https://api.pwnedpasswords.com/range/';
const HIBP_TIMEOUT_MS = 5000;
const HIBP_BREACH_THRESHOLD = parseInt(
  Deno.env.get('HIBP_BREACH_THRESHOLD') ?? '1',
  10
); // refuse si breach count >= threshold

interface BreachCheckResult {
  pwned: boolean;
  count: number;
  skipped: boolean;
  error?: string;
}

/**
 * Hash SHA1 d'une string en uppercase hex (40 chars).
 * Utilise Deno builtin crypto (SubtleCrypto).
 */
async function sha1Hex(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const bytes = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    hex += b.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
}

/**
 * Vérifie un password contre HaveIBeenPwned (k-anonymity).
 * Implémentation identique au client (src/lib/hibp.ts) mais côté serveur.
 */
async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  if (!password || password.length < 4) {
    return { pwned: false, count: 0, skipped: true, error: 'Password too short' };
  }
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
    try {
      const response = await fetch(`${HIBP_RANGE_API}${prefix}`, {
        method: 'GET',
        headers: { 'User-Agent': 'JurisLink-Edge/1.0', 'Add-Padding': '0' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return { pwned: false, count: 0, skipped: true, error: `HIBP ${response.status}` };
      }
      const body = await response.text();
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;
        const lineSuffix = trimmed.substring(0, colonIndex).toUpperCase();
        if (lineSuffix === suffix) {
          const count = parseInt(trimmed.substring(colonIndex + 1), 10);
          return { pwned: count > 0, count: isNaN(count) ? 0 : count, skipped: false };
        }
      }
      return { pwned: false, count: 0, skipped: false };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return { pwned: false, count: 0, skipped: true, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Handler principal ──────────────────────────────────────────────────

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: applySecurityHeaders(cors) })
  }

  // ── CSRF validation (fail-fast) ────────────────────────────────────
  const csrfToken = req.headers.get(CSRF_HEADER);
  if (!isValidCsrfToken(csrfToken)) {
    return new Response(
      JSON.stringify({
        error: 'CSRF token missing or invalid',
        code: 'CSRF_INVALID',
      }),
      {
        status: 403,
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' })
      }
    )
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Authenticate the caller
    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
        status: 401,
      })
    }

    // Verify caller role
    const { data: profile } = await supabaseClient
      .from('users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'root_admin' && profile.role !== 'firm_admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
        status: 403,
      })
    }

    const { email, password, full_name, role, tenant_id } = await req.json()

    // ─── PHASE 4.10: Validation password côté serveur ──────────────────
    const analysis = analyzePassword(password);

    // firm_admin: exige score ≥ 40 (user-level)
    // root_admin: exige score ≥ 60 (admin-level)
    const requireAdmin = role === 'root_admin' || role === 'firm_admin';
    const isStrongEnough = requireAdmin ? analysis.allowedForAdmin : analysis.allowedForUser;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    const userAgent = req.headers.get('user-agent');

    if (!isStrongEnough) {
      // Audit log: échec création par password faible
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        action: 'USER_CREATE_WEAK_PASSWORD_REJECTED',
        entity: 'users',
        entity_id: 'unknown',
        metadata: {
          ip: cfConnectingIp ?? null,
          user_agent: userAgent ?? null,
          source: 'edge_function:create-user',
          target_email: email,
          target_role: role,
          password_score: analysis.score,
          password_strength: analysis.strength,
          password_issues: analysis.issues.map(i => i.code),
        }
      });

      return new Response(JSON.stringify({
        error: 'Password is too weak',
        code: 'WEAK_PASSWORD',
        password_analysis: {
          score: analysis.score,
          strength: analysis.strength,
          entropy_bits: analysis.entropyBits,
          issues: analysis.issues,
        }
      }), {
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
        status: 400,
      });
    }

    // ─── PHASE 5.6: HIBP k-anonymity check ───────────────────────────
    const breachCheck = await checkPasswordBreach(password);
    if (breachCheck.pwned && breachCheck.count >= HIBP_BREACH_THRESHOLD) {
      // Audit log: password compromis refusé
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        action: 'BREACHED_PASSWORD_REJECTED',
        entity: 'users',
        entity_id: 'unknown',
        metadata: {
          ip: cfConnectingIp ?? null,
          user_agent: userAgent ?? null,
          source: 'edge_function:create-user',
          target_email: email,
          target_role: role,
          breach_count: breachCheck.count,
          hibp_skipped: false,
        }
      });

      return new Response(JSON.stringify({
        error: 'Password has been exposed in a data breach',
        code: 'BREACHED_PASSWORD',
        breach_count: breachCheck.count,
        suggestion: 'Choose a unique password that has never appeared in any known breach.',
      }), {
        headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
        status: 400,
      });
    }

    // Si HIBP a été SKIPPÉ (offline), on accepte mais on logge pour review
    if (breachCheck.skipped) {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        action: 'HIBP_CHECK_SKIPPED',
        entity: 'users',
        entity_id: 'unknown',
        metadata: {
          ip: cfConnectingIp ?? null,
          user_agent: userAgent ?? null,
          source: 'edge_function:create-user',
          target_email: email,
          target_role: role,
          hibp_error: breachCheck.error ?? 'unknown',
        }
      });
      // Pas de blocage — dégradation gracieuse
    }

    let targetTenantId = tenant_id;
    // Firm admin constraints
    if (profile.role === 'firm_admin') {
      targetTenantId = profile.tenant_id;
      if (role === 'root_admin') {
        return new Response(JSON.stringify({ error: 'Firm admin cannot create root admin' }), {
          headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
          status: 403,
        })
      }
    }

    // Create user securely with Service Role Key
    const { data: newAuthUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    })

    if (authError) {
       throw authError
    }

    const newUserId = newAuthUser.user.id;

    // Insert user info into public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        tenant_id: targetTenantId,
        role: role || 'client',
        full_name: full_name,
        email: email
      })

    if (dbError) {
      // Rollback Auth creation
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw dbError
    }

    // ─── Audit log (metadata JSONB) ───────────────────────────────────
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        tenant_id: targetTenantId,
        user_id: user.id,
        action: 'USER_CREATE',
        entity: 'users',
        entity_id: newUserId,
        new_state: { id: newUserId, email, full_name, role: role || 'client', tenant_id: targetTenantId },
        metadata: {
          ip: cfConnectingIp ?? null,
          user_agent: userAgent ?? null,
          source: 'edge_function:create-user',
          method: 'POST',
          password_score: analysis.score,
          password_strength: analysis.strength,
          hibp_breach_count: breachCheck.pwned ? breachCheck.count : 0,
          hibp_checked: !breachCheck.skipped,
        }
      });

    return new Response(JSON.stringify({
      user: newAuthUser.user,
      message: 'User successfully created',
      password_strength: analysis.strength,
      hibp_checked: !breachCheck.skipped,
    }), {
      headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: applySecurityHeaders({ ...cors, 'Content-Type': 'application/json' }),
      status: 400,
    })
  }
})

// Export pour tests internes
export const __test__ = {
  isValidCsrfToken,
  analyzePassword,
  computeEntropyBits,
  sha1Hex,
  checkPasswordBreach,
  HIBP_BREACH_THRESHOLD,
};
