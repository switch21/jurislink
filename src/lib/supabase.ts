// ============================================================================
// JurisLink - Phase 3.2 - Patch src/lib/supabase.ts (injection X-CSRF-Token)
// ============================================================================
// Remplace: src/lib/supabase.ts
//
// Changements vs version actuelle:
//   1. Fetch override : intercepte chaque requête sortante via supabase-js
//      global.fetch option, ajoute X-CSRF-Token header sur toutes les
//      mutations (POST/PUT/PATCH/DELETE).
//   2. Le token CSRF est récupéré dynamiquement via getCsrfToken() à chaque
//      requête (rotation possible à tout moment sans invalidation du client).
//   3. Si le token n'est pas encore en sessionStorage (première requête),
//      getCsrfToken() en génère un à la volée.
//
// Notes:
//   - Le header X-CSRF-Token est ajouté AVANT le Authorization: Bearer
//     pour permettre aux edge functions de le valider en premier (fail-fast).
//   - Les requêtes GET (lecture) ne reçoivent pas le header car elles sont
//     naturellement immunisées au CSRF (pas d'effet de bord).
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getCsrfToken, isMutationMethod, CSRF_HEADER } from './csrf';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Fetch override — ajoute le header CSRF sur les mutations
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();

      // Si pas une mutation, on passe sans modification
      if (!isMutationMethod(method)) {
        return fetch(input, init);
      }

      // Récupère les headers existants (Headers object ou plain object)
      const existingHeaders = new Headers(init?.headers ?? {});

      // Ajoute X-CSRF-Token si pas déjà présent (ne pas écraser un test
      // qui aurait explicitement mis un header)
      if (!existingHeaders.has(CSRF_HEADER)) {
        existingHeaders.set(CSRF_HEADER, getCsrfToken());
      }

      const newInit: RequestInit = {
        ...(init ?? {}),
        headers: existingHeaders,
      };

      return fetch(input, newInit);
    },
  },
});
