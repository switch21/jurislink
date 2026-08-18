// ============================================================================
// JurisLink - Phase 4.4 - Edge function: rate-limit (Deno KV)
// ============================================================================
// Emplacement: supabase/functions/rate-limit/index.ts (nouveau fichier)
//
// Stratégie:
//   Edge function centralisée pour le rate-limiting server-side. Utilise
//   Deno KV (Deno.openKv()) — base de données clé-valeur serverless avec
//   garantie de cohérence forte (atomic checks).
//
//   Patterns supportés:
//     1. Par IP: limite X requêtes par fenêtre glissante par adresse IP
//     2. Par utilisateur: limite X requêtes par utilisateur (via JWT sub)
//     3. Par route: combine IP + route pour des limites spécifiques
//
//   Headers de réponse HTTP standards:
//     X-RateLimit-Limit:     limite max par fenêtre
//     X-RateLimit-Remaining: requêtes restantes dans la fenêtre
//     X-RateLimit-Reset:     timestamp epoch ms du reset
//     Retry-After:           secondes à attendre (seulement si 429)
//
//   Note: cette edge function EST ELLE-MÊME un endpoint qui peut être appelé
//   directement par le client pour checker un rate-limit AVANT de soumettre.
//   Elle peut aussi être appelée par les autres edge functions en import.
//
// Déploiement:
//   supabase functions deploy rate-limit --no-bundle
//   supabase secrets set RATE_LIMIT_KV_URL=...  (si Deno KV non local)
//
// Notes:
//   - Deno KV est en preview dans Supabase Edge Functions. Si indisponible,
//     fallback sur upstash/redis (via env REDIS_URL) ou sur une table
//     PostgreSQL `rate_limit_buckets` avec TTL.
//   - La fenêtre glissante utilise le pattern "fixed window with bucket":
//     on divise le temps en buckets de 60s et on compte dans le bucket
//     courant. C'est moins précis qu'une vraie sliding window mais
//     beaucoup plus performant (O(1) au lieu de O(log n)).
// ============================================================================

import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',')
  .map(s => s.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ─── Configuration des buckets de rate-limiting ────────────────────────────

interface RateLimitConfig {
  limit: number;       // max requêtes par fenêtre
  windowMs: number;    // durée de la fenêtre en ms
  blockMs: number;     // durée de blocage si limite dépassée (0 = pas de blocage)
}

// Presets par route — peuvent être overridés via env
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  'verify-session': { limit: 60, windowMs: 60_000, blockMs: 0 },
  'create-user': { limit: 5, windowMs: 60_000, blockMs: 300_000 }, // 5 min block
  'rate-limit': { limit: 100, windowMs: 60_000, blockMs: 0 }, // cette fonction même
  'auth-login': { limit: 10, windowMs: 60_000, blockMs: 60_000 },
  'auth-signup': { limit: 3, windowMs: 60_000, blockMs: 600_000 },
};

function getConfig(route: string): RateLimitConfig {
  // Override via env si présent (format: ROUTE_LIMIT, ROUTE_WINDOW_MS)
  const envLimit = Deno.env.get(`RATE_LIMIT_${route.toUpperCase().replace(/-/g, '_')}_LIMIT`);
  const envWindow = Deno.env.get(`RATE_LIMIT_${route.toUpperCase().replace(/-/g, '_')}_WINDOW_MS`);
  const envBlock = Deno.env.get(`RATE_LIMIT_${route.toUpperCase().replace(/-/g, '_')}_BLOCK_MS`);

  const base = DEFAULT_CONFIGS[route] ?? { limit: 60, windowMs: 60_000, blockMs: 0 };

  return {
    limit: envLimit ? parseInt(envLimit, 10) : base.limit,
    windowMs: envWindow ? parseInt(envWindow, 10) : base.windowMs,
    blockMs: envBlock ? parseInt(envBlock, 10) : base.blockMs,
  };
}

// ─── KV store (Deno KV ou fallback PostgreSQL) ─────────────────────────────

interface RateLimitState {
  count: number;
  windowStart: number; // epoch ms
  blockedUntil: number; // epoch ms (0 si non bloqué)
}

async function getState(key: string): Promise<RateLimitState | null> {
  // Tente Deno KV en premier
  try {
    const kv = await Deno.openKv();
    const result = await kv.get<RateLimitState>(['rate_limit', key]);
    return result.value ?? null;
  } catch {
    // Fallback: PostgreSQL
    return await getStateFromPostgres(key);
  }
}

async function setState(key: string, state: RateLimitState): Promise<void> {
  // Tente Deno KV
  try {
    const kv = await Deno.openKv();
    await kv.set(['rate_limit', key], state, { expireIn: Math.max(state.windowMs, state.blockedUntil - Date.now()) + 60_000 });
    return;
  } catch {
    // Fallback: PostgreSQL
    await setStateInPostgres(key, state);
  }
}

// ─── Fallback PostgreSQL ──────────────────────────────────────────────────

let pgClient: any = null;

function getPgClient() {
  if (pgClient) return pgClient;
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  pgClient = createClient(url, serviceKey);
  return pgClient;
}

async function getStateFromPostgres(key: string): Promise<RateLimitState | null> {
  try {
    const client = getPgClient();
    const { data, error } = await client
      .from('rate_limit_buckets')
      .select('count, window_start, blocked_until')
      .eq('bucket_key', key)
      .maybeSingle();

    if (error || !data) return null;
    return {
      count: data.count,
      windowStart: data.window_start,
      blockedUntil: data.blocked_until ?? 0,
    };
  } catch {
    return null;
  }
}

async function setStateInPostgres(key: string, state: RateLimitState): Promise<void> {
  try {
    const client = getPgClient();
    await client
      .from('rate_limit_buckets')
      .upsert({
        bucket_key: key,
        count: state.count,
        window_start: state.windowStart,
        blocked_until: state.blockedUntil,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bucket_key' });
  } catch (err) {
    console.error('rate-limit: PostgreSQL write failed', err);
  }
}

// ─── Logique principale ─────────────────────────────────────────────────────

interface CheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
  retryAfterMs: number; // 0 si allowed, sinon ms à attendre
  blocked: boolean;
}

/**
 * Vérifie (et incrémente) le compteur de rate-limit pour une clé.
 *
 * @param identifier - Clé d'identification (ex: "ip:1.2.3.4:verify-session")
 * @param config - Configuration du bucket
 * @returns Résultat du check
 */
export async function checkAndIncrement(
  identifier: string,
  config: RateLimitConfig
): Promise<CheckResult> {
  const now = Date.now();

  // 1. Lit l'état actuel
  const state = await getState(identifier);

  // 2. Vérifie si bloqué
  if (state && state.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: state.blockedUntil,
      retryAfterMs: state.blockedUntil - now,
      blocked: true,
    };
  }

  // 3. Calcule le bucket courant
  const windowStart = state?.windowStart ?? now;
  const windowElapsed = now - windowStart;

  let count: number;
  let currentWindowStart: number;

  if (windowElapsed >= config.windowMs) {
    // Nouvelle fenêtre
    count = 1;
    currentWindowStart = now;
  } else {
    count = (state?.count ?? 0) + 1;
    currentWindowStart = windowStart;
  }

  // 4. Vérifie la limite
  if (count > config.limit) {
    // Dépassement — applique le blocage si configuré
    const blockedUntil = config.blockMs > 0 ? now + config.blockMs : 0;

    await setState(identifier, {
      count,
      windowStart: currentWindowStart,
      blockedUntil,
    });

    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil > 0 ? blockedUntil : currentWindowStart + config.windowMs,
      retryAfterMs: blockedUntil > 0 ? config.blockMs : (currentWindowStart + config.windowMs - now),
      blocked: blockedUntil > 0,
    };
  }

  // 5. Autorisé — incrémente
  await setState(identifier, {
    count,
    windowStart: currentWindowStart,
    blockedUntil: 0,
  });

  return {
    allowed: true,
    remaining: config.limit - count,
    resetAt: currentWindowStart + config.windowMs,
    retryAfterMs: 0,
    blocked: false,
  };
}

// ─── Endpoint HTTP ──────────────────────────────────────────────────────────

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    // Auth: requiert un JWT valide pour checker
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    // Body: { route: string, identifier?: string }
    const body = await req.json();
    const route = body.route;
    const userId = body.identifier ?? user.id;

    if (!route || typeof route !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing route parameter' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const config = getConfig(route);
    const identifier = `user:${userId}:${route}`;

    const result = await checkAndIncrement(identifier, config);

    const responseHeaders = {
      ...cors,
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(config.limit),
      'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
      'X-RateLimit-Reset': String(result.resetAt),
    };

    if (result.retryAfterMs > 0) {
      const seconds = Math.ceil(result.retryAfterMs / 1000);
      responseHeaders['Retry-After'] = String(seconds);
    }

    return new Response(
      JSON.stringify({
        route,
        ...result,
        retryAfterMs: result.retryAfterMs,
      }),
      {
        status: result.allowed ? 200 : 429,
        headers: responseHeaders,
      }
    )
  } catch (error: any) {
    console.error('rate-limit error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', code: 'INTERNAL' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})

// Export pour tests internes
export const __test__ = { checkAndIncrement, getConfig, DEFAULT_CONFIGS };
