import { create } from 'zustand'

export interface UserInfo {
  id: string
  email: string
  name: string
  role: string
  tenantId: string | null
  phone?: string | null
  avatarUrl?: string | null
  preferredLanguage?: string
  isActive?: boolean
}

export type ViewName =
  | 'login'
  | 'dashboard'
  | 'clients'
  | 'cases'
  | 'documents'
  | 'calendar'
  | 'invoices'
  | 'messages'
  | 'tasks'
  | 'reports'
  | 'settings'
  | 'finances'
  | 'audit-logs'
  | 'archives'

interface AppState {
  user: UserInfo | null
  isAuthenticated: boolean
  currentView: ViewName
  sidebarOpen: boolean
  login: (user: UserInfo) => void
  logout: () => void
  setCurrentView: (view: ViewName) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

const loadUser = (): UserInfo | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('jurislink_user')
    if (stored) return JSON.parse(stored)
  } catch {
    // ignore
  }
  return null
}

export const useAppStore = create<AppState>((set) => ({
  user: loadUser(),
  isAuthenticated: !!loadUser(),
  currentView: loadUser() ? 'dashboard' : 'login',
  sidebarOpen: false,
  login: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jurislink_user', JSON.stringify(user))
    }
    set({ user, isAuthenticated: true, currentView: 'dashboard' })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jurislink_user')
    }
    set({ user: null, isAuthenticated: false, currentView: 'login' })
  },
  setCurrentView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
