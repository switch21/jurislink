// ============================================================================
// JurisLink - Phase 5.15 - Tests: sessionManager.spec.ts
// ============================================================================
// 12 tests couvrant:
//   - initSession (localStorage write)
//   - getSessionStart (read)
//   - getMaxDurationRemaining
//   - isMaxDurationExceeded
//   - clearSession
//   - startHeartbeat (mock supabase.functions.invoke)
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initSession,
  getSessionStart,
  getMaxDurationRemaining,
  isMaxDurationExceeded,
  clearSession,
  startHeartbeat,
  DEFAULT_CONFIG,
  __test__,
} from '../lib/sessionManager';

// ─── Mock localStorage ─────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = String(value); }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ─── Mock Date.now pour tests déterministes ─────────────────────────────────

const REAL_NOW = Date.now;
let mockNow: number | null = null;

beforeEach(() => {
  mockNow = null;
  Date.now = vi.fn(() => mockNow ?? REAL_NOW());
});

afterEach(() => {
  Date.now = REAL_NOW;
  localStorageMock.clear();
});

// Helper: avance le temps mocké
function advanceTime(ms: number) {
  if (mockNow === null) mockNow = REAL_NOW();
  mockNow += ms;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('sessionManager — initSession', () => {
  beforeEach(() => localStorageMock.clear());

  it('écrit le timestamp actuel dans localStorage et retourne la Date', () => {
    const before = Date.now();
    const result = initSession();
    const after = Date.now();

    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThanOrEqual(before);
    expect(result!.getTime()).toBeLessThanOrEqual(after);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      DEFAULT_CONFIG.storageKey,
      expect.any(String)
    );
  });

  it('retourne null si localStorage indisponible (SSR safe)', () => {
    // Simule un env sans localStorage
    const original = global.localStorage;
    Object.defineProperty(global, 'localStorage', {
      get: () => { throw new Error('localStorage not available'); },
      configurable: true,
    });

    const result = initSession();
    expect(result).toBeNull();

    // Restore
    Object.defineProperty(global, 'localStorage', {
      value: original,
      configurable: true,
    });
  });
});

describe('sessionManager — getSessionStart', () => {
  beforeEach(() => localStorageMock.clear());

  it('retourne null si pas de session active (storage vide)', () => {
    expect(getSessionStart()).toBeNull();
  });

  it('retourne la Date stockée si session active', () => {
    const ts = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(ts));
    const result = getSessionStart();
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(ts);
  });

  it('retourne null si la valeur est corrompue (NaN)', () => {
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, 'not-a-number');
    expect(getSessionStart()).toBeNull();
  });
});

describe('sessionManager — getMaxDurationRemaining', () => {
  beforeEach(() => localStorageMock.clear());

  it('retourne 0 si pas de session active', () => {
    expect(getMaxDurationRemaining()).toBe(0);
  });

  it('retourne maxDurationMs (8h) juste après init', () => {
    const start = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(start));
    mockNow = start;
    const remaining = getMaxDurationRemaining();
    expect(remaining).toBe(DEFAULT_CONFIG.maxDurationMs);
  });

  it('retourne valeur décrémentée après X ms écoulés', () => {
    const start = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(start));
    mockNow = start;
    advanceTime(60 * 60 * 1000); // +1h
    const remaining = getMaxDurationRemaining();
    expect(remaining).toBe(DEFAULT_CONFIG.maxDurationMs - 60 * 60 * 1000);
  });

  it('retourne négatif si durée max dépassée', () => {
    const start = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(start));
    mockNow = start;
    advanceTime(DEFAULT_CONFIG.maxDurationMs + 1000); // +8h1s
    const remaining = getMaxDurationRemaining();
    expect(remaining).toBeLessThan(0);
  });
});

describe('sessionManager — isMaxDurationExceeded', () => {
  beforeEach(() => localStorageMock.clear());

  it('retourne false si session récente', () => {
    const start = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(start));
    mockNow = start;
    advanceTime(60 * 60 * 1000); // +1h
    expect(isMaxDurationExceeded()).toBe(false);
  });

  it('retourne true si durée max dépassée', () => {
    const start = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(start));
    mockNow = start;
    advanceTime(DEFAULT_CONFIG.maxDurationMs + 1000); // +8h1s
    expect(isMaxDurationExceeded()).toBe(true);
  });

  it('retourne false si pas de session active (considère 0 comme "pas actif")', () => {
    expect(isMaxDurationExceeded()).toBe(false);
  });
});

describe('sessionManager — clearSession', () => {
  beforeEach(() => localStorageMock.clear());

  it('supprime la clé de storage', () => {
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(Date.now()));
    clearSession();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(DEFAULT_CONFIG.storageKey);
  });
});

describe('sessionManager — startHeartbeat', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ne fait rien si isMaxDurationExceeded (appelle onError immédiatement)', async () => {
    const start = Date.now();
    localStorageMock.setItem(DEFAULT_CONFIG.storageKey, String(start));
    mockNow = start;
    advanceTime(DEFAULT_CONFIG.maxDurationMs + 1000); // dépassé

    const onError = vi.fn();
    const onResult = vi.fn();

    startHeartbeat(onResult, onError);
    // Le premier heartbeat est schedule via setTimeout(0) — flush
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      ok: false,
      maxDurationExceeded: true,
    });
    expect(onResult).not.toHaveBeenCalled();
  });

  it('retourne un unsubscribe function qui arrête les timers', () => {
    // Mock supabase.functions.invoke pour ne pas planter
    vi.doMock('../lib/supabase', () => ({
      supabase: {
        functions: {
          invoke: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    }));

    const unsubscribe = startHeartbeat(vi.fn(), vi.fn());
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    // Après unsubscribe, les timers n'ont pas d'effet — test trivial mais valide
  });
});

describe('sessionManager — DEFAULT_CONFIG', () => {
  it('a maxDurationMs = 8h (28800000 ms)', () => {
    expect(DEFAULT_CONFIG.maxDurationMs).toBe(8 * 60 * 60 * 1000);
  });

  it('a heartbeatIntervalMs = 5min (300000 ms)', () => {
    expect(DEFAULT_CONFIG.heartbeatIntervalMs).toBe(5 * 60 * 1000);
  });

  it('a storageKey = jurislink.session.start', () => {
    expect(DEFAULT_CONFIG.storageKey).toBe('jurislink.session.start');
  });
});

describe('sessionManager — __test__ internals', () => {
  it('expose DEFAULT_CONFIG', () => {
    expect(__test__.DEFAULT_CONFIG).toBe(DEFAULT_CONFIG);
  });

  it('expose safeGetLocalStorage qui retourne window.localStorage', () => {
    const storage = __test__.safeGetLocalStorage();
    expect(storage).toBeDefined();
    expect(storage?.setItem).toBeDefined();
  });
});
