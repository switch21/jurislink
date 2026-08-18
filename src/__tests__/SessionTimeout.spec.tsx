// ============================================================================
// JurisLink - Phase 4.14 - Tests: SessionTimeout component
// ============================================================================
// Emplacement: src/__tests__/SessionTimeout.spec.tsx
// ============================================================================
// Notes sur les fake timers:
//   - vi.useFakeTimers() mocke setTimeout/setInterval et Date.now()
//   - @testing-library/react's waitFor() utilise setTimeout en interne,
//     ce qui peut causer des timeouts si on n'avance pas le temps.
//   - Préférer des assertions synchrones via screen.queryByText après act().
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { SessionTimeout, __test__ } from '../components/common/SessionTimeout';

// --- Mocks --------------------------------------------------------------

const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    profile: {
      id: 'user-123',
      tenant_id: 'tenant-456',
      role: 'firm_admin',
      full_name: 'Test Admin',
      email: 'admin@test.fr',
      preferred_language: 'fr',
    },
    user: { id: 'user-123' },
    signOut: mockSignOut,
  }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

const mockClearCsrf = vi.fn();
vi.mock('../lib/csrf', () => ({
  clearCsrfToken: () => mockClearCsrf(),
}));

// --- Setup --------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  // Unmount any rendered components before switching back to real timers
  cleanup();
  vi.useRealTimers();
});

// --- Tests --------------------------------------------------------------

describe('SessionTimeout — getTimeoutForRole', () => {
  it('retourne 15 min pour root_admin', () => {
    const config = __test__.getTimeoutForRole('root_admin');
    expect(config.timeoutMs).toBe(15 * 60 * 1000);
    expect(config.warningBeforeMs).toBe(60_000);
  });

  it('retourne 30 min pour firm_admin', () => {
    const config = __test__.getTimeoutForRole('firm_admin');
    expect(config.timeoutMs).toBe(30 * 60 * 1000);
  });

  it('retourne 60 min pour lawyer/secretary', () => {
    expect(__test__.getTimeoutForRole('lawyer').timeoutMs).toBe(60 * 60 * 1000);
    expect(__test__.getTimeoutForRole('secretary').timeoutMs).toBe(60 * 60 * 1000);
  });

  it('retourne 120 min pour client', () => {
    expect(__test__.getTimeoutForRole('client').timeoutMs).toBe(120 * 60 * 1000);
  });

  it('retourne le default pour rôle inconnu', () => {
    expect(__test__.getTimeoutForRole('unknown').timeoutMs).toBe(__test__.DEFAULT_TIMEOUT.timeoutMs);
  });

  it('retourne le default pour undefined', () => {
    expect(__test__.getTimeoutForRole(undefined).timeoutMs).toBe(__test__.DEFAULT_TIMEOUT.timeoutMs);
  });
});

describe('SessionTimeout — rendering', () => {
  it('ne rend rien par défaut (pas de warning)', () => {
    const { container } = render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={1_000} />);
    expect(container.firstChild).toBeNull();
  });

  it('n\'affiche pas le warning avant le seuil de warning', () => {
    render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={1_000} />);
    // Avance de 5 secondes (5s < 9s, pas de warning)
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(screen.queryByText(/Inactivité détectée/i)).toBeNull();
  });

  it('affiche le warning quand le seuil est atteint', () => {
    render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={3_000} />);
    // Avance de 8 secondes (8s > 10s - 3s = 7s → warning triggered at 7000ms)
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/Inactivité détectée/i)).toBeInTheDocument();
  });

  it('affiche le bouton "Rester connecté" quand le warning est visible', () => {
    render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={3_000} />);
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/Rester connecté/i)).toBeInTheDocument();
  });

  it('affiche le bouton "Se déconnecter" quand le warning est visible', () => {
    render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={3_000} />);
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/Se déconnecter/i)).toBeInTheDocument();
  });
});

describe('SessionTimeout — auto-logout', () => {
  it('déclenche signOut après expiration du timeout', async () => {
    render(<SessionTimeout timeoutMs={5_000} warningBeforeMs={1_000} />);
    // Async act + advanceTimersByTimeAsync pour flush les microtasks
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('appelle clearCsrfToken au logout', async () => {
    render(<SessionTimeout timeoutMs={5_000} warningBeforeMs={1_000} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mockClearCsrf).toHaveBeenCalled();
  });

  it('insère un audit log SESSION_TIMEOUT', async () => {
    render(<SessionTimeout timeoutMs={5_000} warningBeforeMs={1_000} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'SESSION_TIMEOUT',
      entity: 'auth',
      entity_id: 'user-123',
      tenant_id: 'tenant-456',
    }));
  });

  it('utilise onTimeout custom si fourni (et n\'appelle pas signOut)', async () => {
    const customTimeout = vi.fn().mockResolvedValue(undefined);
    render(
      <SessionTimeout
        timeoutMs={5_000}
        warningBeforeMs={1_000}
        onTimeout={customTimeout}
      />
    );
    // Utiliser async act + advanceTimersByTimeAsync pour flush les microtasks
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(customTimeout).toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

describe('SessionTimeout — interaction utilisateur', () => {
  it('bouton "Rester connecté" ferme le warning', () => {
    render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={3_000} />);
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/Rester connecté/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Rester connecté/i));
    // Le warning disparaît
    expect(screen.queryByText(/Inactivité détectée/i)).toBeNull();
  });

  it('bouton "Se déconnecter" déclenche signOut', async () => {
    render(<SessionTimeout timeoutMs={10_000} warningBeforeMs={3_000} />);
    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/Se déconnecter/i)).toBeInTheDocument();

    // fireEvent.click returns a Promise — await pour flush les microtasks
    await act(async () => {
      await fireEvent.click(screen.getByText(/Se déconnecter/i));
    });
    expect(mockSignOut).toHaveBeenCalled();
  });
});
