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
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

const updateAppLanguage = (lang: string) => {
  const cleanLang = lang.split('-')[0].toLowerCase();
  i18n.changeLanguage(cleanLang);
  document.documentElement.dir = cleanLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = cleanLang;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,

  initialize: async () => {
    const { user, isLoading } = useAuthStore.getState();
    if (user && !isLoading) return; 
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*, tenant:tenants(*)')
          .eq('id', session.user.id)
          .single();
          
        if (profile) {
          if (profile.is_active === false || (profile.tenant && profile.tenant.is_active === false)) {
            await supabase.auth.signOut();
            set({ user: null, profile: null, isLoading: false });
            return;
          }
          updateAppLanguage(profile.preferred_language || profile.tenant?.language || 'fr');
        }

        set({ user: session.user, profile, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*, tenant:tenants(*)')
            .eq('id', session.user.id)
            .single();
          
          if (profile) {
            if (profile.is_active === false || (profile.tenant && profile.tenant.is_active === false)) {
              await supabase.auth.signOut();
              set({ user: null, profile: null, isLoading: false });
              return;
            }
            updateAppLanguage(profile.preferred_language || profile.tenant?.language || 'fr');
          }

          set({ user: session.user, profile, isLoading: false });
        } else {
          set({ user: null, profile: null, isLoading: false });
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('Supabase signout error, forcing local clear:', e);
    } finally {
      localStorage.removeItem('supabase.auth.token');
      set({ user: null, profile: null, isLoading: false });
    }
  }
}));
