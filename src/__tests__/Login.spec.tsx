// ============================================================================
// JurisLink - Phase 1.4 - Tests smoke (Login.tsx — logique MFA)
// ============================================================================
// Emplacement: src/__tests__/Login.spec.tsx
// Objectif: Capturer la régression du contournement MFA côté client.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Login } from '../pages/auth/Login'

// Mock supabase — chaque test redéfinit les réponses
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      mfa: {
        listFactors: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        enroll: vi.fn(),
        unenroll: vi.fn(),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => ({ then: vi.fn(), catch: vi.fn() })),
    })),
    functions: { invoke: vi.fn() },
  },
}))

import { supabase } from '../lib/supabase'

const renderLogin = () => {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login — logique MFA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('affiche email et password par défaut', () => {
    renderLogin()
    expect(screen.getByPlaceholderText(/avocat@cabinet/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument()
  })

  it('redirige vers MFA challenge si facteur TOTP vérifié présent (admin)', async () => {
    const user = userEvent.setup()
    renderLogin()

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: { user: { id: 'user-1' } } } as any,
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'user-1', role: 'firm_admin', is_active: true, tenant: { is_active: true } },
            error: null,
          })),
        })),
      })),
      insert: vi.fn(),
    } as any)
    vi.mocked(supabase.auth.mfa.listFactors).mockResolvedValueOnce({
      data: { totp: [{ id: 'factor-1', status: 'verified' }] } as any,
      error: null,
    })

    await user.type(screen.getByPlaceholderText(/avocat@cabinet/i), 'test@cabinet.fr')
    await user.type(screen.getByPlaceholderText(/••••••••/), 'password123')
    await user.click(screen.getByRole('button', { name: /signIn/i }))

    await waitFor(() => {
      // MfaChallenge doit s'afficher (titre "Validation 2FA requise")
      expect(screen.getByText(/Validation 2FA requise/)).toBeInTheDocument()
    })
  })

  it('redirige vers MFA setup si AUCUN facteur TOTP vérifié (non-admin)', async () => {
    // CRITIQUE: ce test capture la vulnérabilité de contournement MFA.
    // Avant le patch, les non-admins sans facteur TOTP étaient connectés
    // directement (handleMfaSuccess appelé) sans 2FA.
    // Après le patch: ils doivent obligatoirement s'enrôler.

    const user = userEvent.setup()
    renderLogin()

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: { user: { id: 'user-2' } } } as any,
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'user-2', role: 'lawyer', is_active: true, tenant: { is_active: true } },
            error: null,
          })),
        })),
      })),
      insert: vi.fn(),
    } as any)
    vi.mocked(supabase.auth.mfa.listFactors).mockResolvedValueOnce({
      data: { totp: [] } as any, // ← Aucun facteur vérifié
      error: null,
    })

    await user.type(screen.getByPlaceholderText(/avocat@cabinet/i), 'avocat@cabinet.fr')
    await user.type(screen.getByPlaceholderText(/••••••••/), 'password123')
    await user.click(screen.getByRole('button', { name: /signIn/i }))

    await waitFor(() => {
      // MfaSetup doit s'afficher (titre "Authentification à double facteur obligatoire")
      expect(screen.getByText(/Authentification à double facteur obligatoire/)).toBeInTheDocument()
    })
  })

  it('affiche erreur si compte désactivé', async () => {
    const user = userEvent.setup()
    renderLogin()

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { session: { user: { id: 'user-3' } } } as any,
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'user-3', role: 'lawyer', is_active: false, tenant: { is_active: true } },
            error: null,
          })),
        })),
      })),
      insert: vi.fn(),
    } as any)

    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null } as any)

    await user.type(screen.getByPlaceholderText(/avocat@cabinet/i), 'disabled@cabinet.fr')
    await user.type(screen.getByPlaceholderText(/••••••••/), 'password123')
    await user.click(screen.getByRole('button', { name: /signIn/i }))

    await waitFor(() => {
      expect(screen.getByText(/compte ou votre cabinet a été désactivé/i)).toBeInTheDocument()
    })
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
