// ============================================================================
// JurisLink - Phase 3.7 - Helper audit logging (logAudit)
// ============================================================================
// Emplacement: src/lib/audit.ts (nouveau fichier)
//
// Helper unique pour insérer un log structuré dans la table audit_logs.
// Récupère automatiquement user_id + tenant_id depuis useAuthStore,
// ajoute contexte standardisé dans la colonne metadata JSONB (Phase 3.6).
//
// Usage:
//   import { logAudit } from '../lib/audit';
//   await logAudit({
//     action: 'USER_CREATE',
//     entity: 'users',
//     entity_id: newUserId,
//     new_state: { id: newUserId, email, role },
//     metadata: { source: 'UI:UserModal', custom_field: 'xxx' },
//   });
//
// Convention metadata (ajouté automatiquement par le helper):
//   {
//     ip: null | string,         // IP client (null côté client, settée côté edge)
//     user_agent: string,        // navigator.userAgent
//     session_id: string,        // crypto.randomUUID() par session navigateur
//     request_id: string,       // crypto.randomUUID() par log (correlation)
//     source: string,           // ex: 'UI:UserModal', 'edge:create-user'
//     [custom fields]: any      // tout ce que l'appelant veut ajouter
//   }
//
// Note: Le helper est non-bloquant. Toute erreur d'insertion est loggée
// dans la console mais ne fait pas planter l'UI. C'est important car
// l'audit logging est une fonctionnalité de traçabilité, pas critique.
// ============================================================================

import { supabase } from './supabase';
import { useAuthStore } from '../store/authStore';

// Session ID: généré une fois par chargement de page, persisté en sessionStorage.
// Permet de corréler tous les logs d'une même session navigateur.
const SESSION_ID_KEY = 'jurislink.session.id';

function getSessionId(): string {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return crypto.randomUUID();
    }
    let sid = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_ID_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

function getUserAgent(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  return navigator.userAgent ?? 'unknown';
}

export interface LogAuditParams {
  /** Action courte en UPPER_SNAKE_CASE. Ex: USER_CREATE, LOGIN_SUCCESS, CASE_UPDATE. */
  action: string;
  /** Type d'entité modifiée. Ex: 'users', 'cases', 'invoices', 'auth'. */
  entity: string;
  /** UUID de l'entité. Pour les actions globales (LOGIN), utiliser l'user_id. */
  entity_id: string;
  /** État avant modification (optionnel). Sera sérialisé en JSONB. */
  previous_state?: Record<string, unknown> | null;
  /** État après modification (optionnel). */
  new_state?: Record<string, unknown> | null;
  /** Métadonnées custom à fusionner avec le contexte auto (optionnel). */
  metadata?: Record<string, unknown>;
}

/**
 * Insère un log d'audit structuré dans la table audit_logs.
 *
 * Caractéristiques:
 *   - Récupère user_id + tenant_id depuis useAuthStore automatiquement
 *   - Ajoute IP=null (côté client, on ne peut pas connaître l'IP publique
 *     sans appel API — la vraie IP est settée par les edge functions)
 *   - Ajoute user_agent = navigator.userAgent
 *   - Génère session_id (persistant par onglet via sessionStorage)
 *   - Génère request_id (unique par log, pour corrélation)
 *   - Non-bloquant: toute erreur est catchée et loggée en console
 *
 * @param params - Voir LogAuditParams
 * @returns Promise<void> (ne rejette jamais — toujours résolu)
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const { profile, user } = useAuthStore.getState();

    if (!user || !profile) {
      // Pas d'utilisateur authentifié — on ne peut pas logger dans audit_logs
      // (la colonne user_id est NOT NULL sauf si on souhaite contourner)
      console.warn('logAudit: no user/profile in store, skipping', params.action);
      return;
    }

    // Construction de metadata avec contexte standardisé + custom
    const metadata: Record<string, unknown> = {
      ip: null,  // Côté client on n'a pas l'IP publique. Côté edge, cf. create-user.
      user_agent: getUserAgent(),
      session_id: getSessionId(),
      request_id: crypto.randomUUID(),
      source: 'UI',  // Override recommandé dans metadata custom
      ...(params.metadata ?? {}),  // Custom peut écraser les valeurs par défaut
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        action: params.action,
        entity: params.entity,
        entity_id: params.entity_id,
        previous_state: params.previous_state ?? null,
        new_state: params.new_state ?? null,
        metadata,
      });

    if (error) {
      console.error('logAudit: insert failed', {
        action: params.action,
        entity: params.entity,
        error: error.message,
      });
    }
  } catch (err) {
    // Catch-all: l'audit logging ne doit JAMAIS planter l'UI
    console.error('logAudit: unexpected error', err);
  }
}

// Export pour les tests
export const __test__ = { getSessionId, getUserAgent };
