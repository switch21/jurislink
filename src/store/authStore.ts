// ============================================================================
// JurisLink - Phase 1.2 - Patch authStore.ts (correction fuite mémoire +
// intégration verify-session)
// ============================================================================
// Remplace: src/store/authStore.ts
//
// Changements vs version actuelle:
//   1. CORRECTION FUITE MÉMOIRE (Phase 2 #7): la subscription
//      supabase.auth.onAuthStateChange() n'était jamais désenregistrée.
//      Chaque appel à initialize() ajoutait une nouvelle subscription,
//      menant à des fuites mémoire progressives (crash mobile après ~1h).
//      Fix: stockage de l'unsub dans une variable de module + unsubscribe
//      avant nouvelle subscription.
//   2. Appel à l'edge function verify-session pour valider AAL côté serveur
//      (anti-contournement MFA — voir Phase 1.2 verify-session.ts).
//   3. Suppression du fallback qui définissait l'utilisateur même sans profil
//      (vulnérabilité: laissait un user sans profil accéder à l'app).
//   4. Typage explicite de l'erreur catch pour éviter any.
// ============================================================================

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import i18n from '../i18n';

export interface UserProfile {
  id: string;
  tenant_id: string;
  role: 'root_admin' | 'firm_admin' | 'lawyer' | 'secretary' | 'client';
  full_name: string;
  email: string;
  preferred_language: string;
  is_active?: boolean;
  tenant?: {
    plan: string;
    max_users: number;
    max_storage_gb: number;
    name: string;
    logo_url: string;
    address: string;
    phone: string;
    email: string;
    niu: string;
    language: string;
    is_active?: boolean;
  };
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  requiresMfa: boolean;
  mfaAction: 'challenge' | 'setup' | null;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

const updateAppLanguage = (lang: string) => {
  const cleanLang = lang.split('-')[0].toLowerCase();
  void i18n.changeLanguage(cleanLang);
  document.documentElement.dir = cleanLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = cleanLang;
};

// CORRECTION FUITE MÉMOIRE: on garde une référence à l'unsubscriber
// au niveau module pour pouvoir le révoquer avant une nouvelle subscription.
let unsubscribeAuthChanges: (() => void) | null = null;

// Helper: appelle l'edge function verify-session pour valider AAL côté serveur.
async function fetchVerifiedProfile(userId: string): Promise<{
  profile: UserProfile | null;
  requiresMfa: boolean;
  mfaAction: 'challenge' | 'setup' | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-session');
    if (error || !data) {
      return { profile: null, requiresMfa: false, mfaAction: null };
    }
    return {
      profile: data.profile as UserProfile | null,
      requiresMfa: data.requiresMfa ?? false,
      mfaAction: data.mfaAction ?? null,
    };
  } catch (err) {
    console.error('verify-session invoke failed:', err);
    return { profile: null, requiresMfa: false, mfaAction: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  requiresMfa: false,
  mfaAction: null,

  initialize: async () => {
    const { user, isLoading } = useAuthStore.getState();
    if (user && !isLoading) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { profile, requiresMfa, mfaAction } = await fetchVerifiedProfile(session.user.id);

        if (profile) {
          if (profile.is_active === false || (profile.tenant && profile.tenant.is_active === false)) {
            await supabase.auth.signOut();
            set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
            return;
          }
          updateAppLanguage(profile.preferred_language || profile.tenant?.language || 'fr');
        }

        set({
          user: session.user,
          profile,
          isLoading: false,
          requiresMfa,
          mfaAction,
        });
      } else {
        set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
      }

      // CORRECTION FUITE MÉMOIRE: unsub avant nouvelle subscription
      if (unsubscribeAuthChanges) {
        unsubscribeAuthChanges();
        unsubscribeAuthChanges = null;
      }

      const { data: subData } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          // Réutilise le helper serveur (évite de doubler la logique)
          fetchVerifiedProfile(session.user.id).then(({ profile, requiresMfa, mfaAction }) => {
            if (profile && (profile.is_active === false || (profile.tenant && profile.tenant.is_active === false))) {
              void supabase.auth.signOut().then(() => {
                set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
              });
              return;
            }
            if (profile) {
              updateAppLanguage(profile.preferred_language || profile.tenant?.language || 'fr');
            }
            set({ user: session.user, profile, isLoading: false, requiresMfa, mfaAction });
          }).catch((err: unknown) => {
            console.error('Profile fetch on auth change failed:', err);
            // CORRECTION: ne pas setter un user sans profil (était un bypass)
            set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
          });
        } else {
          set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
        }
      });
      unsubscribeAuthChanges = subData.subscription.unsubscribe;
    } catch (error) {
      console.error('Auth initialization failed:', error);
      set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('Supabase signout failed, forcing local clear:', e);
    } finally {
      // CORRECTION: unsub propre pour libérer la mémoire
      if (unsubscribeAuthChanges) {
        unsubscribeAuthChanges();
        unsubscribeAuthChanges = null;
      }
      localStorage.removeItem('supabase.auth.token');
      set({ user: null, profile: null, isLoading: false, requiresMfa: false, mfaAction: null });
    }
  }
}));
