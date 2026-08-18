// ============================================================================
// JurisLink - Phase 3.11 - Tests: csrf.ts (génération + rotation + méthodes)
// ============================================================================
// Emplacement: src/__tests__/csrf.spec.ts
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getCsrfToken,
  rotateCsrfToken,
  clearCsrfToken,
  CSRF_HEADER,
  isMutationMethod,
  __test__,
} from '../lib/csrf';

beforeEach(() => {
  // Nettoie sessionStorage avant chaque test
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }
});

afterEach(() => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }
});

describe('csrf — generateCsrfToken', () => {
  it('génère un token base64url de 43 caractères (32 bytes)', () => {
    const { generateCsrfToken } = __test__;
    const token = generateCsrfToken();
    expect(token).toHaveLength(43);
  });

  it('génère des tokens uniques (pas de collision sur 1000 générations)', () => {
    const { generateCsrfToken } = __test__;
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateCsrfToken());
    }
    expect(tokens.size).toBe(1000); // tous uniques
  });

  it('produit uniquement des caractères base64url [A-Za-z0-9_-]', () => {
    const { generateCsrfToken } = __test__;
    const token = generateCsrfToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('csrf — getCsrfToken', () => {
  it('génère un token à la première appel et le persiste', () => {
    const token1 = getCsrfToken();
    expect(token1).toHaveLength(43);

    // Le token doit être stocké en sessionStorage
    const stored = window.sessionStorage.getItem('jurislink.csrf.token');
    expect(stored).toBe(token1);
  });

  it('retourne le même token aux appels suivants (pas de régénération)', () => {
    const token1 = getCsrfToken();
    const token2 = getCsrfToken();
    const token3 = getCsrfToken();
    expect(token1).toBe(token2);
    expect(token2).toBe(token3);
  });
});

describe('csrf — rotateCsrfToken', () => {
  it('génère un nouveau token différent de l\'ancien', () => {
    const original = getCsrfToken();
    const rotated = rotateCsrfToken();
    expect(rotated).not.toBe(original);
  });

  it('le token rotaté est persisté en sessionStorage', () => {
    const rotated = rotateCsrfToken();
    const stored = window.sessionStorage.getItem('jurislink.csrf.token');
    expect(stored).toBe(rotated);
  });

  it('getCsrfToken retourne le token rotaté après rotation', () => {
    const rotated = rotateCsrfToken();
    const subsequent = getCsrfToken();
    expect(subsequent).toBe(rotated);
  });
});

describe('csrf — clearCsrfToken', () => {
  it('supprime le token de sessionStorage', () => {
    getCsrfToken(); // génère + stocke
    expect(window.sessionStorage.getItem('jurislink.csrf.token')).not.toBeNull();

    clearCsrfToken();
    expect(window.sessionStorage.getItem('jurislink.csrf.token')).toBeNull();
  });

  it('après clear, getCsrfToken génère un nouveau token', () => {
    const original = getCsrfToken();
    clearCsrfToken();
    const fresh = getCsrfToken();
    expect(fresh).not.toBe(original);
  });
});

describe('csrf — CSRF_HEADER constant', () => {
  it('expose le nom du header X-CSRF-Token', () => {
    expect(CSRF_HEADER).toBe('X-CSRF-Token');
  });
});

describe('csrf — isMutationMethod', () => {
  it('retourne true pour POST/PUT/PATCH/DELETE (case-insensitive)', () => {
    expect(isMutationMethod('POST')).toBe(true);
    expect(isMutationMethod('post')).toBe(true);
    expect(isMutationMethod('PUT')).toBe(true);
    expect(isMutationMethod('put')).toBe(true);
    expect(isMutationMethod('PATCH')).toBe(true);
    expect(isMutationMethod('patch')).toBe(true);
    expect(isMutationMethod('DELETE')).toBe(true);
    expect(isMutationMethod('delete')).toBe(true);
  });

  it('retourne false pour GET/HEAD/OPTIONS/TRACE', () => {
    expect(isMutationMethod('GET')).toBe(false);
    expect(isMutationMethod('get')).toBe(false);
    expect(isMutationMethod('HEAD')).toBe(false);
    expect(isMutationMethod('OPTIONS')).toBe(false);
    expect(isMutationMethod('TRACE')).toBe(false);
  });

  it('retourne false pour chaîne vide ou méthode inconnue', () => {
    expect(isMutationMethod('')).toBe(false);
    expect(isMutationMethod('FOO')).toBe(false);
    expect(isMutationMethod('connect')).toBe(false);
  });
});
