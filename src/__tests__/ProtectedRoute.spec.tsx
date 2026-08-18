// ============================================================================
// JurisLink - Phase 2.5 - Tests: ProtectedRoute (role guard)
// ============================================================================
// Emplacement: src/__tests__/ProtectedRoute.spec.tsx
// Objectif: Capturer la régression de la garde de rôle sur les routes
// React Router. Avant le patch, un user 'lawyer' pouvait accéder à
// /dashboard/audit-logs (réservé root_admin) par URL guessing.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, __test__ } from '../components/auth/ProtectedRoute';
import type { UserProfile } from '../store/authStore';

// --- Mock du store Zustand --------------------------------------------------
// On mock le hook useAuthStore pour contrôler le state dans chaque test.
type StoreState = {
  user: { id: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;
};

let mockStoreState: StoreState = {
  user: null,
  profile: null,
  isLoading: false,
};

vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockStoreState,
}));

// Composant de test simple qui affiche un texte si rendu
const SecretPage = () => <div>SECRET_ADMIN_CONTENT</div>;
const HomePage = () => <div>HOME_PAGE</div>;
const LoginPage = () => <div>LOGIN_PAGE</div>;

const renderAt = (path: string, requiredRole?: UserProfile['role'] | UserProfile['role'][]) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<HomePage />} />
        <Route
          path="/dashboard/secret"
          element={
            <ProtectedRoute requiredRole={requiredRole}>
              <SecretPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    user: null,
    profile: null,
    isLoading: false,
  };
});

describe('ProtectedRoute — isRoleAllowed (helper)', () => {
  it('autorise si requiredRole est undefined (tous authentifiés)', () => {
    const { isRoleAllowed } = __test__;
    expect(isRoleAllowed('lawyer', undefined)).toBe(true);
    expect(isRoleAllowed('root_admin', undefined)).toBe(true);
    expect(isRoleAllowed('client', undefined)).toBe(true);
  });

  it('autorise si userRole match requiredRole (single)', () => {
    const { isRoleAllowed } = __test__;
    expect(isRoleAllowed('root_admin', 'root_admin')).toBe(true);
    expect(isRoleAllowed('lawyer', 'lawyer')).toBe(true);
  });

  it('refuse si userRole ne match pas requiredRole (single)', () => {
    const { isRoleAllowed } = __test__;
    expect(isRoleAllowed('lawyer', 'root_admin')).toBe(false);
    expect(isRoleAllowed('client', 'firm_admin')).toBe(false);
  });

  it('autorise si userRole est dans le tableau requiredRole', () => {
    const { isRoleAllowed } = __test__;
    expect(isRoleAllowed('lawyer', ['firm_admin', 'lawyer', 'secretary'])).toBe(true);
    expect(isRoleAllowed('firm_admin', ['firm_admin', 'lawyer', 'secretary'])).toBe(true);
    expect(isRoleAllowed('secretary', ['firm_admin', 'lawyer', 'secretary'])).toBe(true);
  });

  it('refuse si userRole n\'est pas dans le tableau requiredRole', () => {
    const { isRoleAllowed } = __test__;
    expect(isRoleAllowed('client', ['firm_admin', 'lawyer', 'secretary'])).toBe(false);
    expect(isRoleAllowed('root_admin', ['firm_admin', 'lawyer', 'secretary'])).toBe(false);
  });

  it('refuse si userRole est undefined (pas de profil)', () => {
    const { isRoleAllowed } = __test__;
    expect(isRoleAllowed(undefined, 'root_admin')).toBe(false);
    expect(isRoleAllowed(undefined, ['firm_admin', 'lawyer'])).toBe(false);
  });
});

describe('ProtectedRoute — comportement routing', () => {
  it('affiche le loader pendant isLoading=true', () => {
    mockStoreState = {
      user: { id: 'u1' },
      profile: null,
      isLoading: true,
    };

    renderAt('/dashboard/secret', 'root_admin');

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByText('SECRET_ADMIN_CONTENT')).not.toBeInTheDocument();
  });

  it('redirige vers /login si pas de session utilisateur', () => {
    mockStoreState = {
      user: null,
      profile: null,
      isLoading: false,
    };

    renderAt('/dashboard/secret', 'root_admin');

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument();
    expect(screen.queryByText('SECRET_ADMIN_CONTENT')).not.toBeInTheDocument();
  });

  it('rend les children si user a le rôle requis', () => {
    mockStoreState = {
      user: { id: 'u1' },
      profile: {
        id: 'u1',
        tenant_id: 't1',
        role: 'root_admin',
        full_name: 'Admin',
        email: 'admin@x.fr',
        preferred_language: 'fr',
      },
      isLoading: false,
    };

    renderAt('/dashboard/secret', 'root_admin');

    expect(screen.getByText('SECRET_ADMIN_CONTENT')).toBeInTheDocument();
  });

  it('redirige vers /dashboard si user n\'a pas le rôle requis', () => {
    mockStoreState = {
      user: { id: 'u2' },
      profile: {
        id: 'u2',
        tenant_id: 't1',
        role: 'lawyer',
        full_name: 'Lawyer',
        email: 'lawyer@x.fr',
        preferred_language: 'fr',
      },
      isLoading: false,
    };

    renderAt('/dashboard/secret', 'root_admin');

    // La page admin ne doit PAS être rendue
    expect(screen.queryByText('SECRET_ADMIN_CONTENT')).not.toBeInTheDocument();
    // L'utilisateur doit être redirigé vers le dashboard
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('redirige vers /dashboard si user a un rôle dans la liste mais pas le bon', () => {
    mockStoreState = {
      user: { id: 'u3' },
      profile: {
        id: 'u3',
        tenant_id: 't1',
        role: 'client',
        full_name: 'Client',
        email: 'client@x.fr',
        preferred_language: 'fr',
      },
      isLoading: false,
    };

    // Route réservée aux staff du cabinet
    renderAt('/dashboard/secret', ['firm_admin', 'lawyer', 'secretary']);

    expect(screen.queryByText('SECRET_ADMIN_CONTENT')).not.toBeInTheDocument();
    expect(screen.getByText('HOME_PAGE')).toBeInTheDocument();
  });

  it('rend les children si user a un des rôles de la liste', () => {
    mockStoreState = {
      user: { id: 'u4' },
      profile: {
        id: 'u4',
        tenant_id: 't1',
        role: 'secretary',
        full_name: 'Sec',
        email: 'sec@x.fr',
        preferred_language: 'fr',
      },
      isLoading: false,
    };

    renderAt('/dashboard/secret', ['firm_admin', 'lawyer', 'secretary']);

    expect(screen.getByText('SECRET_ADMIN_CONTENT')).toBeInTheDocument();
  });

  it('rend les children si pas de restriction de rôle (requiredRole undefined)', () => {
    mockStoreState = {
      user: { id: 'u5' },
      profile: {
        id: 'u5',
        tenant_id: 't1',
        role: 'client',
        full_name: 'Client',
        email: 'client@x.fr',
        preferred_language: 'fr',
      },
      isLoading: false,
    };

    // Route accessible à tous les authentifiés
    renderAt('/dashboard/secret');

    expect(screen.getByText('SECRET_ADMIN_CONTENT')).toBeInTheDocument();
  });
});
