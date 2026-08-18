// ============================================================================
// JurisLink - Phase 1.4 - Tests smoke (authStore.ts — fuite mémoire)
// ============================================================================
// Emplacement: src/__tests__/authStore.spec.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted garantit que les variables sont disponibles dans les vi.mock
// hoistés en haut du fichier (sinon ReferenceError).
const { mockUnsubscribe, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockUnsubscribe: vi.fn(),
  mockOnAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  })),
}))

// Mock i18n AVANT l'import du store (sinon i18next s'initialise en jsdom)
vi.mock('../i18n', () => ({
  default: {
    changeLanguage: vi.fn(() => Promise.resolve()),
    language: 'fr',
  },
}))

// Mock supabase AVANT l'import du store
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: mockOnAuthStateChange,
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(),
    })),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}))

import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

describe('authStore — gestion mémoire des subscriptions', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: true,
      requiresMfa: false,
      mfaAction: null,
    })
    // Reset module-level unsubscribeAuthChanges via signOut (which clears it)
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any)
    await useAuthStore.getState().signOut()
    vi.clearAllMocks() // Clear the unsubscribe call triggered by signOut
  })

  it('initialise sans session active', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('ne crée qu\'une seule subscription onAuthStateChange active à la fois', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)

    await useAuthStore.getState().initialize()
    await useAuthStore.getState().initialize()
    await useAuthStore.getState().initialize()

    // CRITIQUE: sans le fix, on aurait eu 3 subscriptions distinctes,
    // chacune restant active → fuite mémoire progressive.
    // Avec le patch (unsubscribe avant nouvelle subscription), on garde
    // au maximum 1 subscription active à la fois.
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(3)
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
  })

  it('désinscrit proprement la subscription au signOut', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any)
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null } as any)

    await useAuthStore.getState().initialize()
    await useAuthStore.getState().signOut()

    expect(mockUnsubscribe).toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
