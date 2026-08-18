// ============================================================================
// JurisLink - Phase 4.11 - Tests: rateLimit.ts (throttle + circuit + backoff)
// ============================================================================
// Emplacement: src/__tests__/rateLimit.spec.ts
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  tryAcquireThrottle,
  releaseThrottle,
  isCircuitOpen,
  recordFailure,
  resetCircuit,
  getCircuitResetTime,
  computeBackoff,
  extractRetryAfterMs,
  retryWithBackoff,
  __test__,
} from '../lib/rateLimit';

beforeEach(() => {
  // Nettoie les états in-memory
  __test__.throttleMap.clear();
  // Nettoie sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }
});

describe('rateLimit — tryAcquireThrottle', () => {
  it('autorise la première acquisition', () => {
    expect(tryAcquireThrottle('action1', 1000)).toBe(true);
  });

  it('bloque la seconde acquisition dans la fenêtre de throttle', () => {
    tryAcquireThrottle('action1', 1000);
    expect(tryAcquireThrottle('action1', 1000)).toBe(false);
  });

  it('autorise une nouvelle acquisition après expiration', async () => {
    tryAcquireThrottle('action1', 50); // 50ms
    expect(tryAcquireThrottle('action1', 50)).toBe(false);
    await new Promise(r => setTimeout(r, 60));
    expect(tryAcquireThrottle('action1', 50)).toBe(true);
  });

  it('les clés différentes sont indépendantes', () => {
    tryAcquireThrottle('action1', 1000);
    expect(tryAcquireThrottle('action2', 1000)).toBe(true);
  });

  it('releaseThrottle libère le throttle immédiatement', () => {
    tryAcquireThrottle('action1', 1000);
    releaseThrottle('action1');
    expect(tryAcquireThrottle('action1', 1000)).toBe(true);
  });
});

describe('rateLimit — computeBackoff', () => {
  it('retourne le délai de base pour attempt=0', () => {
    const delay = computeBackoff(0, 500, 30000);
    // delay = 500 * 2^0 = 500 + jitter(0..500) = [500, 1000]
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('double approximativement le délai à chaque attempt', () => {
    const delay0 = computeBackoff(0, 100, 30000);
    const delay1 = computeBackoff(1, 100, 30000);
    const delay2 = computeBackoff(2, 100, 30000);
    // 100 * 2^0=100, 100*2^1=200, 100*2^2=400
    // Avec jitter (0..100), les ranges sont [100,200], [200,300], [400,500]
    expect(delay0).toBeLessThan(delay1);
    expect(delay1).toBeLessThan(delay2);
  });

  it('plafonne à maxDelay', () => {
    const delay = computeBackoff(20, 500, 5000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  it('jamais négatif', () => {
    for (let i = 0; i < 10; i++) {
      const delay = computeBackoff(i, 500, 30000);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('rateLimit — extractRetryAfterMs', () => {
  it('retourne 0 si header absent', () => {
    const response = new Response(null, {});
    expect(extractRetryAfterMs(response)).toBe(0);
  });

  it('retourne le nombre de secondes * 1000 si header numérique', () => {
    const response = new Response(null, { headers: { 'Retry-After': '60' } });
    expect(extractRetryAfterMs(response)).toBe(60000);
  });

  it('retourne le délai jusqu\'à une date HTTP', () => {
    const future = new Date(Date.now() + 30000).toUTCString();
    const response = new Response(null, { headers: { 'Retry-After': future } });
    const delay = extractRetryAfterMs(response);
    // Tolère une marge de 2 secondes pour le parsing
    expect(delay).toBeGreaterThan(28000);
    expect(delay).toBeLessThan(32000);
  });

  it('retourne 0 si header invalide', () => {
    const response = new Response(null, { headers: { 'Retry-After': 'invalid' } });
    expect(extractRetryAfterMs(response)).toBe(0);
  });
});

describe('rateLimit — circuit breaker', () => {
  it('circuit fermé par défaut (pas d\'état)', () => {
    expect(isCircuitOpen('route1')).toBe(false);
    expect(getCircuitResetTime('route1')).toBe(0);
  });

  it('circuit reste fermé sous le seuil', () => {
    for (let i = 0; i < 4; i++) {
      const opened = recordFailure('route1', 5, 60000);
      expect(opened).toBe(false);
    }
    expect(isCircuitOpen('route1')).toBe(false);
  });

  it('circuit s\'ouvre au seuil', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure('route1', 5, 60000);
    }
    expect(isCircuitOpen('route1')).toBe(true);
    expect(getCircuitResetTime('route1')).toBeGreaterThan(0);
  });

  it('callback onOpen est appelé à l\'ouverture', () => {
    const onOpen = vi.fn();
    for (let i = 0; i < 5; i++) {
      recordFailure('route2', 5, 60000, onOpen);
    }
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('route2', 60000);
  });

  it('resetCircuit réinitialise l\'état', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure('route3', 5, 60000);
    }
    expect(isCircuitOpen('route3')).toBe(true);
    resetCircuit('route3');
    expect(isCircuitOpen('route3')).toBe(false);
  });

  it('persistance en sessionStorage', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure('route4', 5, 60000);
    }
    // Vérifie que l'état est en sessionStorage
    const stored = window.sessionStorage.getItem('jurislink.circuit.route4');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.failureCount).toBe(5);
    expect(parsed.openUntil).toBeGreaterThan(Date.now());
  });
});

describe('rateLimit — retryWithBackoff', () => {
  it('retourne directement si la fonction réussit', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(new Response('ok', { status: 200 })); };
    const result = await retryWithBackoff(fn, { maxRetries: 3 });
    expect(calls).toBe(1);
    expect(result.status).toBe(200);
  });

  it('ne retry pas sur 200', async () => {
    let calls = 0;
    const fn = () => { calls++; return Promise.resolve(new Response('ok', { status: 200 })); };
    await retryWithBackoff(fn, { maxRetries: 3 });
    expect(calls).toBe(1);
  });

  it('retry sur 429 puis réussit', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls === 1) return Promise.resolve(new Response('rate limited', { status: 429 }));
      return Promise.resolve(new Response('ok', { status: 200 }));
    };
    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 10, // accélère le test
      maxDelayMs: 100,
    });
    expect(calls).toBe(2);
    expect(result.status).toBe(200);
  });

  it('respecte Retry-After header pour le délai', async () => {
    let calls = 0;
    const start = Date.now();
    const fn = () => {
      calls++;
      if (calls === 1) return Promise.resolve(new Response('', {
        status: 429,
        headers: { 'Retry-After': '1' } // 1 seconde (valeur minimale acceptable pour test)
      }));
      return Promise.resolve(new Response('ok', { status: 200 }));
    };
    const result = await retryWithBackoff(fn, { maxRetries: 1, baseDelayMs: 10 });
    expect(calls).toBe(2);
    expect(result.status).toBe(200);
    expect(Date.now() - start).toBeGreaterThanOrEqual(900);
  });

  it('lance l\'erreur après épuisement des retries', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      throw new Error('network failure');
    };
    await expect(
      retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 })
    ).rejects.toThrow('network failure');
    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it('retourne 429 si tous les retries échouent', async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.resolve(new Response('rate limited', { status: 429 }));
    };
    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });
    expect(result.status).toBe(429);
    expect(calls).toBe(3);
  });
});
