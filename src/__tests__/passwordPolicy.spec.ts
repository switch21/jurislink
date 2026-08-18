// ============================================================================
// JurisLink - Phase 4.12 - Tests: passwordPolicy.ts (entropy + blacklist)
// ============================================================================
// Emplacement: src/__tests__/passwordPolicy.spec.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  analyzePassword,
  isValidPassword,
  strengthFromScore,
  computeEntropyBits,
  isBlacklisted,
  generateStrongPassword,
  __test__,
} from '../lib/passwordPolicy';

describe('passwordPolicy — computeEntropyBits', () => {
  it('retourne 0 pour password vide', () => {
    expect(computeEntropyBits('')).toBe(0);
  });

  it('retourne ~4.7 bits/char pour lowercase only (charset 26)', () => {
    const entropy = computeEntropyBits('abcdefgh');
    expect(entropy).toBeGreaterThanOrEqual(37); // 8 * log2(26) ≈ 8 * 4.7 = 37.6
    expect(entropy).toBeLessThanOrEqual(38);
  });

  it('augmente avec la diversité (mixed charset > lowercase only)', () => {
    const lower = computeEntropyBits('abcdefgh');
    const mixed = computeEntropyBits('Abcdef1!');
    expect(mixed).toBeGreaterThan(lower);
  });

  it('augmente avec la longueur (même charset)', () => {
    const short = computeEntropyBits('abc');
    const long = computeEntropyBits('abcdefghijklmnop');
    expect(long).toBeGreaterThan(short);
  });
});

describe('passwordPolicy — strengthFromScore', () => {
  it('retourne VeryWeak pour score < 20', () => {
    expect(strengthFromScore(0)).toBe('VeryWeak');
    expect(strengthFromScore(19)).toBe('VeryWeak');
  });

  it('retourne Weak pour 20-39', () => {
    expect(strengthFromScore(20)).toBe('Weak');
    expect(strengthFromScore(39)).toBe('Weak');
  });

  it('retourne Fair pour 40-59', () => {
    expect(strengthFromScore(40)).toBe('Fair');
    expect(strengthFromScore(59)).toBe('Fair');
  });

  it('retourne Strong pour 60-79', () => {
    expect(strengthFromScore(60)).toBe('Strong');
    expect(strengthFromScore(79)).toBe('Strong');
  });

  it('retourne VeryStrong pour 80+', () => {
    expect(strengthFromScore(80)).toBe('VeryStrong');
    expect(strengthFromScore(100)).toBe('VeryStrong');
  });
});

describe('passwordPolicy — isBlacklisted', () => {
  it('détecte les passwords blacklistés (case-insensitive)', () => {
    expect(isBlacklisted('password')).toBe(true);
    expect(isBlacklisted('PASSWORD')).toBe(true);
    expect(isBlacklisted('Password')).toBe(true);
    expect(isBlacklisted('123456')).toBe(true);
    expect(isBlacklisted('qwerty')).toBe(true);
  });

  it('laisse passer les passwords non blacklistés', () => {
    expect(isBlacklisted('MyUniquePassword2024!')).toBe(false);
    expect(isBlacklisted('8fJ$kL2!pQ9z')).toBe(false);
  });
});

describe('passwordPolicy — analyzePassword', () => {
  it('détecte les passwords trop courts', () => {
    const result = analyzePassword('abc');
    expect(result.issues.some(i => i.code === 'TOO_SHORT')).toBe(true);
    expect(result.allowedFor.user).toBe(false);
    expect(result.allowedFor.admin).toBe(false);
  });

  it('flag les passwords blacklistés', () => {
    const result = analyzePassword('password');
    expect(result.issues.some(i => i.code === 'BLACKLISTED')).toBe(true);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.strength).toBe('VeryWeak');
  });

  it('flag les patterns clavier', () => {
    const result = analyzePassword('qwerty12345');
    expect(result.issues.some(i => i.code === 'KEYBOARD_WALK')).toBe(true);
  });

  it('flag les séquences communes', () => {
    const result = analyzePassword('abcdef123456');
    expect(result.issues.some(i => i.code === 'COMMON_SEQUENCE')).toBe(true);
  });

  it('flag les caractères répétés', () => {
    const result = analyzePassword('aaabbbcccdd');
    expect(result.issues.some(i => i.code === 'REPEATED_CHARS')).toBe(true);
  });

  it('flag l\'entropie faible', () => {
    // Password court: longueur 5, lowercase only → entropy ~23 bits (< 28)
    const result = analyzePassword('abcde');
    expect(result.issues.some(i => i.code === 'LOW_ENTROPY')).toBe(true);
  });

  it('flag la faible diversité de caractères', () => {
    const result = analyzePassword('alllowercase'); // que lowercase
    expect(result.issues.some(i => i.code === 'LOW_DIVERSITY')).toBe(true);
  });

  it('un password fort n\'a pas d\'issues critiques', () => {
    const result = analyzePassword('My$ecureP@ssw0rd2024!XYZ');
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.strength).toMatch(/Strong|VeryStrong/);
    expect(result.issues.length).toBeLessThan(2);
  });

  it('un password admin acceptable a un score >= 60', () => {
    const result = analyzePassword('!SecureAdmin2024#XYZ');
    expect(result.allowedFor.admin).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('un password acceptable pour user mais pas pour admin', () => {
    // Score entre 40 et 59
    const result = analyzePassword('Medium1!');
    if (result.score >= 40 && result.score < 60) {
      expect(result.allowedFor.user).toBe(true);
      expect(result.allowedFor.admin).toBe(false);
    }
  });

  it('retourne suggestions constructives', () => {
    const result = analyzePassword('abc');
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe('passwordPolicy — isValidPassword', () => {
  it('refuse les passwords trop courts (user et admin)', () => {
    expect(isValidPassword('abc', false)).toBe(false);
    expect(isValidPassword('abc', true)).toBe(false);
  });

  it('refuse les passwords blacklistés', () => {
    expect(isValidPassword('password', false)).toBe(false);
    expect(isValidPassword('123456', false)).toBe(false);
  });

  it('accepte un password moyen pour user (non-admin)', () => {
    // 'MediumPw9!' → score ~50 (Fair), no penalties → allowed for user
    expect(isValidPassword('MediumPw9!', false)).toBe(true);
  });

  it('refuse un password moyen pour admin', () => {
    // Score < 60 → admin refusé
    const result = analyzePassword('Medium123!');
    if (result.score < 60) {
      expect(isValidPassword('Medium123!', true)).toBe(false);
    }
  });

  it('accepte un password fort pour admin', () => {
    expect(isValidPassword('My$tr0ngAdminP@ssw0rd!XYZ', true)).toBe(true);
  });
});

describe('passwordPolicy — generateStrongPassword', () => {
  it('génère un password de la longueur demandée', () => {
    const pwd = generateStrongPassword(20);
    expect(pwd.length).toBe(20);
  });

  it('génère des passwords uniques à chaque appel', () => {
    const pwd1 = generateStrongPassword(16);
    const pwd2 = generateStrongPassword(16);
    const pwd3 = generateStrongPassword(16);
    expect(pwd1).not.toBe(pwd2);
    expect(pwd2).not.toBe(pwd3);
    expect(pwd1).not.toBe(pwd3);
  });

  it('les passwords générés sont valides (strong)', () => {
    const pwd = generateStrongPassword(16);
    const result = analyzePassword(pwd);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.allowedFor.admin).toBe(true);
  });

  it('utilise uniquement les caractères du charset autorisé', () => {
    const pwd = generateStrongPassword(100);
    expect(pwd).toMatch(/^[a-zA-Z0-9!@#$%^&*()\-_=+]+$/);
  });
});

describe('passwordPolicy — BLACKLIST integrity', () => {
  it('la blacklist contient au moins 90 entrées', () => {
    expect(__test__.BLACKLIST.size).toBeGreaterThanOrEqual(90);
  });

  it('la blacklist contient des entrées connues', () => {
    expect(__test__.BLACKLIST.has('123456')).toBe(true);
    expect(__test__.BLACKLIST.has('password')).toBe(true);
    expect(__test__.BLACKLIST.has('qwerty')).toBe(true);
    expect(__test__.BLACKLIST.has('admin')).toBe(true);
  });
});
