// ============================================================================
// JurisLink - Phase 4.2 - Helper password policy (entropy + blacklist)
// ============================================================================
// Emplacement: src/lib/passwordPolicy.ts (nouveau fichier)
//
// Stratégie:
//   Validation côté client en complément de la policy serveur (Supabase Auth
//   settings + edge function create-user). Le client informe l'utilisateur
//   en temps réel sur la force de son mot de passe, le serveur rejette les
//   passwords trop faibles.
//
//   Score 0-100 basé sur:
//     - Longueur (jusqu'à 40 points pour 12+ chars)
//     - Diversité de caractères (lowercase, uppercase, digits, symbols)
//     - Entropy (Shannon): estimation des bits d'entropie
//     - Absence de patterns communs (séquences, répétitions)
//     - Absence dans la blacklist (top 1000 passwords leaked)
//
//   Niveaux:
//     0-19  → VeryWeak  (rouge) — interdit
//     20-39 → Weak      (orange) — interdit
//     40-59 → Fair      (jaune) — interdit pour admins, OK pour users non-critiques
//     60-79 → Strong    (vert clair) — minimum acceptable
//     80-100→ VeryStrong (vert) — recommandé pour admins
//
// Notes:
//   - La blacklist est volontairement courte (top 100) pour rester < 5 kB.
//     Une blacklist complète (RockYou ~14M) serait trop lourde pour le bundle.
//     Le serveur (edge function) doit avoir une blacklist plus complète.
//   - Toutes les fonctions sont pures (pas d'effet de bord) pour testabilité.
// ============================================================================

export type PasswordStrength = 'VeryWeak' | 'Weak' | 'Fair' | 'Strong' | 'VeryStrong';

export interface PasswordAnalysis {
  score: number; // 0-100
  strength: PasswordStrength;
  entropyBits: number; // estimation Shannon
  issues: PasswordIssue[]; // liste des problèmes détectés
  suggestions: string[]; // recommandations d'amélioration
  allowedFor: {
    user: boolean; // user non-admin (peut créer un compte avec ce password)
    admin: boolean; // admin/root_admin (exige score ≥ 60)
  };
}

export interface PasswordIssue {
  code: string;
  message: string;
}

// ─── Blacklist (top 100 most common leaked passwords) ─────────────────────
// Source: Have I Been Pwned — top 100 (anonymisée, ordre alphabétique).
// ~1 kB — reste raisonnable pour le bundle client.
const BLACKLIST = new Set<string>([
  '123456', '123456789', 'qwerty', 'password', '111111', '12345678',
  'abc123', '1234567', 'password1', '12345', '1234567890', '123123',
  '000000', 'iloveyou', '1234', '1q2w3e4r5t', 'monkey', 'dragon',
  'sunshine', 'princess', 'football', 'shadow', 'superman', 'iloveu',
  'trustno1', 'welcome', 'letmein', 'admin', 'master', 'login',
  'starwars', 'baseball', 'computer', 'whatever', 'nothing', 'liverpool',
  'huawei', 'qazwsx', 'password123', 'freedom', 'passw0rd', 'zagreb',
  'qwerty123', 'michael1', 'qwerty1', 'matrix', 'asdasd', '1qaz2wsx',
  'jordan', 'jennifer', 'hunter', 'harley', 'ranger', 'robert',
  'soccer', 'thomas', 'george', 'charlie', 'andrew', 'joshua',
  'dallas', 'austin', 'maverick', 'mickey', 'diamond', 'summer',
  'ginger', 'mother', 'forever', 'flower', 'summer1', 'matthew',
  'jessica', 'pepper', 'mountain', 'elephant', 'spider', 'creative',
  'azerty', 'azerty123', 'soleil', 'bonjour', 'amoureux', 'amour',
  'motdepasse', 'mot2passe', 'juju', 'loulou', 'chouchou', 'choupette',
  '123456a', '123456b', 'azertyuiop', 'qwertyuiop', 'motdepasse123',
]);

// ─── Patterns communs ────────────────────────────────────────────────────────
const SEQUENCE_PATTERN = /(abc|bcd|cde|def|123|234|345|456|567|678|789|890|qwe|wer|ert|rty|asd|sdf|dfg|qaz|wsx|edc)/i;
const REPEAT_PATTERN = /(.)\1{2,}/; // même caractère 3+ fois de suite
const KEYBOARD_WALK = /(qwerty|azerty|asdf|zxcv|1qaz|2wsx|3edc)/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calcule l'entropie de Shannon d'un password (en bits).
 * Formule: H = L * log2(N) où:
 *   L = longueur
 *   N = taille de l'alphabet utilisé (lowercase + uppercase + digits + symbols)
 */
export function computeEntropyBits(password: string): number {
  if (!password) return 0;

  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 33; // symbols courants

  return Math.floor(password.length * Math.log2(charsetSize || 1));
}

/**
 * Détermine le niveau de force à partir du score numérique.
 */
export function strengthFromScore(score: number): PasswordStrength {
  if (score < 20) return 'VeryWeak';
  if (score < 40) return 'Weak';
  if (score < 60) return 'Fair';
  if (score < 80) return 'Strong';
  return 'VeryStrong';
}

/**
 * Vérifie si un password fait partie de la blacklist (case-insensitive).
 */
export function isBlacklisted(password: string): boolean {
  return BLACKLIST.has(password.toLowerCase());
}

// ─── Analyse complète ─────────────────────────────────────────────────────────

/**
 * Analyse un password et retourne un rapport complet.
 *
 * @param password - Le password à analyser
 * @returns PasswordAnalysis avec score, niveau, issues, suggestions
 */
export function analyzePassword(password: string): PasswordAnalysis {
  const issues: PasswordIssue[] = [];
  const suggestions: string[] = [];
  let score = 0;
  let charsetCategories = 0;

  // 1. Longueur (jusqu'à 40 points)
  if (password.length < 8) {
    issues.push({
      code: 'TOO_SHORT',
      message: 'Mot de passe trop court (minimum 8 caractères)',
    });
  }
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 5;

  // 2. Diversité de caractères
  if (/[a-z]/.test(password)) { score += 5; charsetCategories++; }
  else suggestions.push('Ajouter des lettres minuscules');

  if (/[A-Z]/.test(password)) { score += 5; charsetCategories++; }
  else suggestions.push('Ajouter des lettres majuscules');

  if (/[0-9]/.test(password)) { score += 5; charsetCategories++; }
  else suggestions.push('Ajouter des chiffres');

  if (/[^a-zA-Z0-9]/.test(password)) { score += 10; charsetCategories++; }
  else suggestions.push('Ajouter des caractères spéciaux (!@#$...)');

  if (charsetCategories < 3) {
    issues.push({
      code: 'LOW_DIVERSITY',
      message: `Seulement ${charsetCategories} catégorie(s) de caractères (recommandé: 3+)`,
    });
  }

  // 3. Entropy
  const entropyBits = computeEntropyBits(password);
  if (entropyBits >= 60) score += 15;
  else if (entropyBits >= 40) score += 10;
  else if (entropyBits >= 28) score += 5;
  else {
    issues.push({
      code: 'LOW_ENTROPY',
      message: `Entropie faible (${entropyBits} bits — recommandé: ≥ 40)`,
    });
  }

  // 4. Patterns communs (pénalité)
  if (SEQUENCE_PATTERN.test(password)) {
    score -= 15;
    issues.push({
      code: 'COMMON_SEQUENCE',
      message: 'Séquence commune détectée (abc, 123, qwerty...)',
    });
  }

  if (REPEAT_PATTERN.test(password)) {
    score -= 10;
    issues.push({
      code: 'REPEATED_CHARS',
      message: 'Caractère répété 3+ fois consécutives',
    });
  }

  if (KEYBOARD_WALK.test(password)) {
    score -= 15;
    issues.push({
      code: 'KEYBOARD_WALK',
      message: 'Pattern clavier détecté (qwerty, azerty, asdf...)',
    });
  }

  // 5. Blacklist (pénalité massive)
  if (isBlacklisted(password)) {
    score = Math.min(score, 10);
    issues.push({
      code: 'BLACKLISTED',
      message: 'Mot de passe dans le top 100 des passwords les plus fuités',
    });
    suggestions.push('Choisir un mot de passe unique non présent dans les leaks');
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  const strength = strengthFromScore(score);

  // Recommandations finales
  if (score < 60) {
    suggestions.push('Utiliser au moins 12 caractères avec 3+ catégories');
  }
  if (score < 80 && password.length < 16) {
    suggestions.push('Allonger à 16+ caractères pour un niveau VeryStrong');
  }

  return {
    score,
    strength,
    entropyBits,
    issues,
    suggestions,
    allowedFor: {
      user: score >= 40,
      admin: score >= 60,
    },
  };
}

/**
 * Valide rapidement un password (true/false) pour usage dans formulaires.
 *
 * @param password - Password à valider
 * @param requireAdmin - Si true, exige score ≥ 60 (admin/root_admin)
 */
export function isValidPassword(password: string, requireAdmin: boolean = false): boolean {
  const analysis = analyzePassword(password);
  return requireAdmin ? analysis.allowedFor.admin : analysis.allowedFor.user;
}

// ─── Générateur de password fort (pour bouton "Suggérer") ──────────────────

const GENERATOR_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';

/**
 * Génère un password aléatoire de 16 caractères (entropie ~96 bits).
 * Utilise crypto.getRandomValues() (Web Crypto API).
 */
export function generateStrongPassword(length: number = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => GENERATOR_CHARSET[b % GENERATOR_CHARSET.length]).join('');
}

// Export pour les tests
export const __test__ = {
  BLACKLIST,
  computeEntropyBits,
  isBlacklisted,
};
