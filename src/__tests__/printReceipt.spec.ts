// ============================================================================
// JurisLink - Phase 2.4 - Tests: printReceipt.ts (XSS escape)
// ============================================================================
// Emplacement: src/__tests__/printReceipt.spec.ts
// Objectif: Capturer la régression du patch XSS sur les 8 points d'injection
// identifiés dans src/utils/printReceipt.ts.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printReceipt, __test__ } from '../utils/printReceipt';
import type { UserProfile } from '../store/authStore';

// Mock window.open pour capturer le HTML injecté sans ouvrir réellement une fenêtre
const mockWrite = vi.fn();
const mockClose = vi.fn();
const mockPrintWindow = {
  document: {
    write: mockWrite,
    close: mockClose,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    ...window,
    open: vi.fn(() => mockPrintWindow),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: 'user-1',
  tenant_id: 'tenant-1',
  role: 'firm_admin',
  full_name: 'Jean Dupont',
  email: 'jean@cabinet.fr',
  preferred_language: 'fr',
  tenant: {
    plan: 'pro',
    max_users: 10,
    max_storage_gb: 50,
    name: 'Cabinet Juridique Dupont',
    logo_url: '',
    address: '12 rue de la Paix, Paris',
    phone: '+3312345678',
    email: 'contact@dupont.fr',
    niu: 'FR12345678900',
    language: 'fr',
    is_active: true,
    ...overrides.tenant,
  },
  ...overrides,
});

const makeInvoice = (overrides: Record<string, unknown> = {}): any => ({
  amount: 1500,
  currency: { symbol: '€', code: 'EUR' },
  client: { full_name: 'Marie Martin' },
  case: { title: 'Affaire #2024-001' },
  ...overrides,
});

describe('printReceipt — escapeHtml (helper)', () => {
  it('échappe les 5 caractères HTML critiques', () => {
    const { escapeHtml } = __test__;
    const input = `<script>alert("XSS")</script>`;
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('échappe les single quotes via &#x27;', () => {
    const { escapeHtml } = __test__;
    expect(escapeHtml(`onerror='evil()'`)).toBe(
      'onerror=&#x27;evil()&#x27;'
    );
  });

  it('retourne chaîne vide pour null/undefined', () => {
    const { escapeHtml } = __test__;
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('échappe & en premier pour éviter double-échappement', () => {
    const { escapeHtml } = __test__;
    // Si on échappait & après <, on aurait &lt; deviendrait &amp;lt; (cassé)
    expect(escapeHtml('<a href="?x=1&y=2">')).toBe(
      '&lt;a href=&quot;?x=1&amp;y=2&quot;&gt;'
    );
  });
});

describe('printReceipt — isSafeUrl (helper)', () => {
  it('accepte http:// et https://', () => {
    const { isSafeUrl } = __test__;
    expect(isSafeUrl('http://example.com/logo.png')).toBe(true);
    expect(isSafeUrl('https://example.com/logo.png')).toBe(true);
  });

  it('refuse javascript:, data:, blob:, file:', () => {
    const { isSafeUrl } = __test__;
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:image/svg+xml;base64,...')).toBe(false);
    expect(isSafeUrl('blob:https://example.com/uuid')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('refuse les non-strings (null, undefined, number)', () => {
    const { isSafeUrl } = __test__;
    // Type guard accepte unknown et vérifie le type interne — test volontaire d'un type invalide
    expect(isSafeUrl(null as unknown as string)).toBe(false);
    expect(isSafeUrl(undefined as unknown as string)).toBe(false);
    expect(isSafeUrl(42 as unknown as string)).toBe(false);
  });
});

describe('printReceipt — intégration XSS', () => {
  it('génère un reçu normal sans modification visible', () => {
    const profile = makeProfile();
    const invoice = makeInvoice();

    printReceipt(invoice, profile);

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockWrite).toHaveBeenCalledTimes(1);

    const html = (mockWrite.mock.calls[0]?.[0] ?? '') as string;

    // Vérifie que les valeurs légitimes apparaissent telles quelles
    expect(html).toContain('Cabinet Juridique Dupont');
    expect(html).toContain('12 rue de la Paix, Paris');
    expect(html).toContain('+3312345678');
    expect(html).toContain('FR12345678900');
    expect(html).toContain('Marie Martin');
    expect(html).toContain('Affaire #2024-001');
    // Le séparateur de milliers en fr-FR est un espace insécable (U+00A0 ou U+202F)
    expect(html).toMatch(/1[\s\u00A0\u202F]500/);
  });

  it('désamorce le XSS via tenant.name (vecteur principal)', () => {
    const profile = makeProfile({
      tenant: {
        plan: 'pro',
        max_users: 10,
        max_storage_gb: 50,
        name: '<script>alert("XSS_NAME")</script>',
        logo_url: '',
        address: '',
        phone: '',
        email: '',
        niu: '',
        language: 'fr',
        is_active: true,
      },
    });
    const invoice = makeInvoice();

    printReceipt(invoice, profile);

    const html = (mockWrite.mock.calls[0]?.[0] ?? '') as string;

    // La chaîne brute ne doit PAS apparaître (sinon = exécution)
    expect(html).not.toContain('<script>alert("XSS_NAME")</script>');
    // La version échappée DOIT apparaître
    expect(html).toContain('&lt;script&gt;alert(&quot;XSS_NAME&quot;)&lt;/script&gt;');
  });

  it('désamorce le XSS via invoice.client.full_name', () => {
    const profile = makeProfile();
    const invoice = makeInvoice({
      client: { full_name: '<img src=x onerror=alert(1)>' },
    });

    printReceipt(invoice, profile);

    const html = (mockWrite.mock.calls[0]?.[0] ?? '') as string;

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
  });

  it('désamorce le XSS via tenant.logo_url (javascript: refusé)', () => {
    const profile = makeProfile({
      tenant: {
        plan: 'pro',
        max_users: 10,
        max_storage_gb: 50,
        name: 'Test Cabinet',
        logo_url: 'javascript:alert(1)',
        address: '',
        phone: '',
        email: '',
        niu: '',
        language: 'fr',
        is_active: true,
      },
    });
    const invoice = makeInvoice();

    printReceipt(invoice, profile);

    const html = (mockWrite.mock.calls[0]?.[0] ?? '') as string;

    // La balise <img> ne doit pas être rendue (URL refusée)
    expect(html).not.toContain('javascript:alert(1)');
    // La condition ternaire retourne logoHtml = '' (chaîne vide)
    // → pas de <img> dans le HTML rendu pour ce tenant
    const imgMatches = html.match(/<img/g) || [];
    expect(imgMatches.length).toBe(0);
  });

  it('génère le reçu sans planter si tenant ou profile est partiel', () => {
    // Le code doit être résilient aux données manquantes
    const profile = makeProfile({
      tenant: {
        plan: 'pro',
        max_users: 10,
        max_storage_gb: 50,
        name: '',
        logo_url: '',
        address: '',
        phone: '',
        email: '',
        niu: '',
        language: 'fr',
        is_active: true,
      },
    });

    expect(() => printReceipt(makeInvoice(), profile)).not.toThrow();
    expect(mockWrite).toHaveBeenCalledTimes(1);
  });
});
