// ============================================================================
// JurisLink - Phase 5.16 - Tests: securityHeaders.spec.ts
// ============================================================================
// 12 tests couvrant:
//   - buildCsp (directive par directive)
//   - buildCspMetaTag (génération HTML)
//   - buildSecurityHeaders (headers hors CSP)
//   - buildServerHeaders (combo pour Vite)
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildCsp,
  buildCspMetaTag,
  buildSecurityHeaders,
  buildServerHeaders,
  __test__,
} from '../lib/securityHeaders';

// ─── Tests: buildCsp ────────────────────────────────────────────────────────

describe('securityHeaders — buildCsp', () => {
  it('contient default-src "self"', () => {
    const csp = buildCsp();
    expect(csp).toContain("default-src 'self'");
  });

  it('n\'autorise PAS unsafe-inline pour scripts (XSS protection)', () => {
    const csp = buildCsp();
    expect(csp).toMatch(/script-src 'self'(?!\s+'unsafe-inline)/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('autorise unsafe-inline pour styles (React inline styles)', () => {
    const csp = buildCsp();
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('inclut connect-src avec l\'URL Supabase', () => {
    const supabaseUrl = 'https://xyz.supabase.co';
    const csp = buildCsp({ supabaseUrl });
    // URL HTTP et URL WebSocket doivent être dans connect-src
    expect(csp).toContain(`connect-src 'self' ${supabaseUrl} wss://xyz.supabase.co`);
  });

  it('inclut l\'API HIBP dans connect-src', () => {
    const csp = buildCsp();
    expect(csp).toContain('https://api.pwnedpasswords.com');
  });

  it('inclut frame-ancestors "none" (anti-clickjacking)', () => {
    const csp = buildCsp();
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('inclut object-src "none" (pas de plugins)', () => {
    const csp = buildCsp();
    expect(csp).toContain("object-src 'none'");
  });

  it('inclut upgrade-insecure-requests en mode prod', () => {
    const csp = buildCsp({ devMode: false });
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('N\'inclut PAS upgrade-insecure-requests en mode dev (HMR HTTP)', () => {
    const csp = buildCsp({ devMode: true });
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(csp).toContain('ws://localhost:*');
  });

  it('inclut report-uri si fourni', () => {
    const csp = buildCsp({ reportUri: 'https://report.example.com/csp' });
    expect(csp).toContain('report-uri https://report.example.com/csp');
  });
});

// ─── Tests: buildCspMetaTag ──────────────────────────────────────────────────

describe('securityHeaders — buildCspMetaTag', () => {
  it('retourne un tag <meta http-equiv="Content-Security-Policy">', () => {
    const tag = buildCspMetaTag();
    expect(tag).toMatch(/^<meta http-equiv="Content-Security-Policy" content=".*">$/);
  });

  it('utilise "Content-Security-Policy-Report-Only" si reportOnly=true', () => {
    const tag = buildCspMetaTag({ reportOnly: true });
    expect(tag).toContain('Content-Security-Policy-Report-Only');
  });
});

// ─── Tests: buildSecurityHeaders ─────────────────────────────────────────────

describe('securityHeaders — buildSecurityHeaders', () => {
  it('inclut X-Content-Type-Options: nosniff', () => {
    const headers = buildSecurityHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('inclut X-Frame-Options: DENY', () => {
    const headers = buildSecurityHeaders();
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('inclut Referrer-Policy: strict-origin-when-cross-origin', () => {
    const headers = buildSecurityHeaders();
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('inclut Permissions-Policy avec geolocation/mic/camera désactivés', () => {
    const headers = buildSecurityHeaders();
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });

  it('inclut HSTS par défaut', () => {
    const headers = buildSecurityHeaders();
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(headers['Strict-Transport-Security']).toContain('preload');
  });

  it('désactive HSTS si option hsts=false (dev mode)', () => {
    const headers = buildSecurityHeaders({ hsts: false });
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('inclut Cross-Origin-Opener-Policy: same-origin', () => {
    const headers = buildSecurityHeaders();
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });
});

// ─── Tests: buildServerHeaders ───────────────────────────────────────────────

describe('securityHeaders — buildServerHeaders', () => {
  it('combine security headers + CSP', () => {
    const supabaseUrl = 'https://example.supabase.co';
    const headers = buildServerHeaders(supabaseUrl);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain(supabaseUrl);
  });

  it('fonctionne sans supabaseUrl (juste self)', () => {
    const headers = buildServerHeaders();
    expect(headers['Content-Security-Policy']).toContain("connect-src 'self'");
    expect(headers['Content-Security-Policy']).toContain('https://api.pwnedpasswords.com');
  });
});

// ─── Tests: __test__ internals ───────────────────────────────────────────────

describe('securityHeaders — __test__ internals', () => {
  it('expose buildCsp', () => {
    expect(typeof __test__.buildCsp).toBe('function');
  });

  it('expose buildCspMetaTag', () => {
    expect(typeof __test__.buildCspMetaTag).toBe('function');
  });

  it('expose buildSecurityHeaders', () => {
    expect(typeof __test__.buildSecurityHeaders).toBe('function');
  });
});
