// ============================================================================
// JurisLink - Phase 5.14 - Tests: hibp.spec.ts (HIBP k-anonymity client)
// ============================================================================
// 14 tests couvrant:
//   - sha1Hex (hashing Web Crypto)
//   - splitHashForKAnonymity (préfixe 5 + suffixe 35)
//   - parseHibpResponse (parsing format HIBP "SUFFIX:COUNT")
//   - checkPasswordBreach (intégration + graceful degradation)
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sha1Hex,
  splitHashForKAnonymity,
  parseHibpResponse,
  checkPasswordBreach,
  checkPasswordBreachCached,
  clearBreachCache,
  __test__,
} from '../lib/hibp';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock fetch global
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof global.fetch;

// Mock AbortSignal.timeout (jsdom ne l'implémente pas)
if (!('timeout' in AbortSignal)) {
  (AbortSignal as any).timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// SHA1 connu de "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const SHA1_PASSWORD = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';

// Réponse HIBP simulée pour le préfixe "5BAA6" (les 35 derniers chars du hash)
// SHA1 de "password" = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
//   prefix = "5BAA6"
//   suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"
const HIBP_RESPONSE_PASSWORD = [
  '0018A45C4D1DEF816FF1234567890123456:3',
  '00A4EDE5F2C4F5F1F2F3F4F5F6F7F8F9F:1',
  '1E4C9B93F3F0682250B6CF8331B7EE68FD8:42', // ← suffix de "password"
  '0BED92EE3FDB1B62EEF2E5F9C5D5F1A2B3C4:5',
].join('\n');

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('hibp — sha1Hex', () => {
  it('hash le password "password" en SHA1 uppercase hex (40 chars)', async () => {
    const hash = await sha1Hex('password');
    expect(hash).toBe(SHA1_PASSWORD);
    expect(hash.length).toBe(40);
    expect(/^[A-F0-9]+$/.test(hash)).toBe(true);
  });

  it('produit des hashes différents pour des passwords différents', async () => {
    const h1 = await sha1Hex('password');
    const h2 = await sha1Hex('password1');
    expect(h1).not.toBe(h2);
  });

  it('gère les passwords unicode (accents, emoji)', async () => {
    const hash = await sha1Hex('motdepasseàé€');
    expect(hash.length).toBe(40);
    expect(/^[A-F0-9]+$/.test(hash)).toBe(true);
  });
});

describe('hibp — splitHashForKAnonymity', () => {
  it('découpe un SHA1 en préfixe 5 + suffixe 35', () => {
    const { prefix, suffix } = splitHashForKAnonymity(SHA1_PASSWORD);
    expect(prefix).toBe('5BAA6');
    expect(suffix).toBe('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(prefix.length).toBe(5);
    expect(suffix.length).toBe(35);
  });

  it('lève une erreur pour un hash de longueur invalide', () => {
    expect(() => splitHashForKAnonymity('TOO_SHORT')).toThrow(/Invalid SHA1 hash length/);
    expect(() => splitHashForKAnonymity('')).toThrow(/Invalid SHA1 hash length/);
  });
});

describe('hibp — parseHibpResponse', () => {
  it('retourne le count si suffix match', () => {
    const suffix = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';
    const count = parseHibpResponse(HIBP_RESPONSE_PASSWORD, suffix);
    expect(count).toBe(42);
  });

  it('retourne 0 si suffix non trouvé', () => {
    const suffix = 'UNKNOWN_SUFFIX_35_CHARS_NOT_FOUND_';
    const count = parseHibpResponse(HIBP_RESPONSE_PASSWORD, suffix);
    expect(count).toBe(0);
  });

  it('gère les lignes malformées sans crash', () => {
    const malformed = 'INVALID\nNO_COLON_HERE\n\n  \n';
    expect(parseHibpResponse(malformed, 'ANYTHING')).toBe(0);
  });

  it('est case-insensitive sur le suffix', () => {
    const suffix = '1e4c9b93f3f0682250b6cf8331b7ee68fd8'; // lowercase
    const count = parseHibpResponse(HIBP_RESPONSE_PASSWORD, suffix);
    expect(count).toBe(42);
  });

  it('retourne 0 si count est NaN', () => {
    const malformed = '1E4C9B93F3F0682250B6CF8331B7EE68FD8:not-a-number';
    const count = parseHibpResponse(malformed, '1E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(count).toBe(0);
  });
});

describe('hibp — checkPasswordBreach', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearBreachCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne pwned=true + count si password trouvé dans la réponse HIBP', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => HIBP_RESPONSE_PASSWORD,
    });

    const result = await checkPasswordBreach('password');
    expect(result.pwned).toBe(true);
    expect(result.count).toBe(42);
    expect(result.skipped).toBe(false);
    expect(result.error).toBeUndefined();

    // Vérifie l'URL appelée
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('https://api.pwnedpasswords.com/range/5BAA6');
  });

  it('retourne pwned=false si password NON trouvé dans la réponse HIBP', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => 'ABCD1234567890123456789012345678901234:3\n',
    });

    const result = await checkPasswordBreach('StrongUniquePass!2024NotInBreach');
    expect(result.pwned).toBe(false);
    expect(result.count).toBe(0);
    expect(result.skipped).toBe(false);
  });

  it('retourne skipped=true + error si fetch throw (offline)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkPasswordBreach('somepassword123');
    expect(result.pwned).toBe(false);
    expect(result.count).toBe(0);
    expect(result.skipped).toBe(true);
    expect(result.error).toContain('Network error');
  });

  it('retourne skipped=true si HIBP API retourne 429 (rate limit)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => '',
    });

    const result = await checkPasswordBreach('somepassword123');
    expect(result.pwned).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.error).toContain('429');
  });

  it('retourne skipped=true si password trop court (< 4 chars)', async () => {
    const result = await checkPasswordBreach('abc');
    expect(result.skipped).toBe(true);
    expect(result.pwned).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retourne skipped=true si password vide', async () => {
    const result = await checkPasswordBreach('');
    expect(result.skipped).toBe(true);
    expect(result.pwned).toBe(false);
  });
});

describe('hibp — checkPasswordBreachCached', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    clearBreachCache();
  });

  it("cache le résultat: 2e appel n'invoque pas fetch", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:42',
    });

    // 1er appel → fetch
    const r1 = await checkPasswordBreachCached('password');
    expect(r1.pwned).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2e appel → cache hit (pas de fetch)
    const r2 = await checkPasswordBreachCached('password');
    expect(r2.pwned).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1); // pas augmenté
  });

  it('clearBreachCache vide le cache', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:42',
    });

    await checkPasswordBreachCached('password');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearBreachCache();

    await checkPasswordBreachCached('password');
    expect(fetchMock).toHaveBeenCalledTimes(2); // re-fetch
  });
});

describe('hibp — __test__ internals', () => {
  it('expose HIBP_RANGE_API', () => {
    expect(__test__.HIBP_RANGE_API).toBe('https://api.pwnedpasswords.com/range/');
  });

  it('expose CACHE_TTL_MS = 5 min', () => {
    expect(__test__.CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
