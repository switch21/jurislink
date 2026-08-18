// ============================================================================
// JurisLink - Phase 3.12 - Tests: audit.ts (helper logAudit)
// ============================================================================
// Emplacement: src/__tests__/audit.spec.ts
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAudit, __test__ } from '../lib/audit';

// --- Mock supabase ----------------------------------------------------------
const mockInsert = vi.fn(() => Promise.resolve({ data: null, error: null }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

// --- Mock useAuthStore ------------------------------------------------------
type StoreState = {
  user: { id: string } | null;
  profile: {
    id: string;
    tenant_id: string;
    role: string;
    full_name: string;
    email: string;
    preferred_language: string;
  } | null;
  isLoading: boolean;
};

let mockStoreState: StoreState = {
  user: null,
  profile: null,
  isLoading: false,
};

vi.mock('../store/authStore', () => ({
  useAuthStore: {
    getState: () => mockStoreState,
  },
}));

// --- Mock sessionStorage -----------------------------------------------------
const sessionStore: Record<string, string> = {};
beforeEach(() => {
  vi.clearAllMocks();
  // Reset store
  mockStoreState = {
    user: { id: 'user-123' },
    profile: {
      id: 'user-123',
      tenant_id: 'tenant-456',
      role: 'firm_admin',
      full_name: 'Test Admin',
      email: 'admin@test.fr',
      preferred_language: 'fr',
    },
    isLoading: false,
  };
  // Reset sessionStorage mock
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
});

// Stub window.sessionStorage BEFORE importing the module
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => sessionStore[key] ?? null,
  setItem: (key: string, value: string) => {
    sessionStore[key] = value;
  },
  removeItem: (key: string) => {
    delete sessionStore[key];
  },
});

describe('audit — getSessionId (helper)', () => {
  it('génère un UUID à la première appel', () => {
    const sid = __test__.getSessionId();
    expect(sid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('persiste le session_id en sessionStorage et le réutilise', () => {
    const sid1 = __test__.getSessionId();
    const sid2 = __test__.getSessionId();
    expect(sid1).toBe(sid2);
    expect(sessionStore['jurislink.session.id']).toBe(sid1);
  });
});

describe('audit — getUserAgent (helper)', () => {
  it('retourne navigator.userAgent', () => {
    const ua = __test__.getUserAgent();
    // En jsdom, navigator.userAgent est une string non vide
    expect(typeof ua).toBe('string');
    expect(ua.length).toBeGreaterThan(0);
  });
});

describe('audit — logAudit', () => {
  it('insère un log avec tous les champs attendus', async () => {
    await logAudit({
      action: 'USER_CREATE',
      entity: 'users',
      entity_id: 'new-user-789',
      new_state: { id: 'new-user-789', email: 'test@example.com' },
      metadata: { source: 'UI:TestComponent', custom: 'value' },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    // Cast à any[] pour contourner le typage strict Parameters<>[] qui
    // produit un tuple vide et empêche l'indexation avec noUncheckedIndexedAccess.
    const calls = mockInsert.mock.calls as any[];
    const inserted = calls[0]?.[0];
    expect(inserted).toBeTruthy();
    expect(inserted.tenant_id).toBe('tenant-456');
    expect(inserted.user_id).toBe('user-123');
    expect(inserted.action).toBe('USER_CREATE');
    expect(inserted.entity).toBe('users');
    expect(inserted.entity_id).toBe('new-user-789');
    expect(inserted.new_state).toEqual({ id: 'new-user-789', email: 'test@example.com' });
    expect(inserted.previous_state).toBeNull();
    expect(inserted.metadata).toMatchObject({
      ip: null,
      user_agent: expect.any(String),
      session_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      source: 'UI:TestComponent',
      custom: 'value',
    });
  });

  it('génère un request_id unique à chaque log', async () => {
    await logAudit({ action: 'ACTION_1', entity: 'e', entity_id: 'id1' });
    await logAudit({ action: 'ACTION_2', entity: 'e', entity_id: 'id2' });
    await logAudit({ action: 'ACTION_3', entity: 'e', entity_id: 'id3' });

    expect(mockInsert).toHaveBeenCalledTimes(3);
    const requestIds = mockInsert.mock.calls.map((c: any[]) => c[0]?.metadata?.request_id);
    const unique = new Set(requestIds);
    expect(unique.size).toBe(3); // 3 request_id différents
  });

  it('rétro-compatibilité: insert sans metadata ne plante pas', async () => {
    await logAudit({
      action: 'LOGIN',
      entity: 'auth',
      entity_id: 'user-123',
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    // Cast à any[] pour contourner le typage strict Parameters<>[] qui
    // produit un tuple vide et empêche l'indexation avec noUncheckedIndexedAccess.
    const calls = mockInsert.mock.calls as any[];
    const inserted = calls[0]?.[0];
    expect(inserted).toBeTruthy();
    expect(inserted.metadata).toMatchObject({
      ip: null,
      source: 'UI', // default
    });
  });

  it('ne rejette jamais — erreur supabase est catchée', async () => {
    // Mock supabase retourne une erreur
    mockInsert.mockResolvedValueOnce({ data: null, error: { message: 'DB connection failed' } } as any);

    // Le helper ne doit pas throw — il résout void et logge l'erreur
    await expect(
      logAudit({ action: 'TEST', entity: 'test', entity_id: 'x' })
    ).resolves.toBeUndefined();
  });

  it('skip si pas d\'utilisateur authentifié dans le store', async () => {
    mockStoreState = { user: null, profile: null, isLoading: false };

    await logAudit({ action: 'TEST', entity: 'test', entity_id: 'x' });

    // L'insert ne doit PAS être appelé car pas de user
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('catch les erreurs inattendues sans throw (audit ne doit jamais planter)', async () => {
    // Mock qui throw une erreur inattendue
    mockInsert.mockRejectedValueOnce(new Error('Network failure'));

    // Le helper doit attraper et résoudre void
    await expect(
      logAudit({ action: 'TEST', entity: 'test', entity_id: 'x' })
    ).resolves.toBeUndefined();
  });
});
