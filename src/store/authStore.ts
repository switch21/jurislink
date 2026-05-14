import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  tenant_id: string;
  role: 'root_admin' | 'firm_admin' | 'lawyer' | 'secretary' | 'client';
  full_name: string;
  email: string;
  preferred_language: string;
}

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,

  initialize: async () => {
    const { user, isLoading } = useAuthStore.getState();
    if (user && !isLoading) return; // Already initialized with a user
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        set({ user: session.user, profile, isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
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
    await supabase.auth.signOut();
    set({ user: null, profile: null, isLoading: false });
  }
}));
