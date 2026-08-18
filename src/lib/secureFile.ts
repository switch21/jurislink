// ============================================================================
// JurisLink - Phase 4.3 - Helper file upload security
// ============================================================================
// Emplacement: src/lib/secureFile.ts (nouveau fichier)
//
// Stratégie:
//   Le téléversement de fichiers est un vecteur d'attaque majeur:
//     - Upload de fichiers exécutables déguisés (image.php, .exe, .svg avec XSS)
//     - Path traversal via filename (../../etc/passwd)
//     - XSS via nom de fichier affiché sans escape
//     - DoS via fichiers énormes (> 100 MB)
//     - MIME spoofing (extension .jpg mais contenu PHP)
//
//   Ce helper fournit:
//     1. validateFile() — validation complète d'un File avant upload
//     2. sanitizeFileName() — nettoyage du nom de fichier pour stockage
//     3. checkMagicBytes() — vérification du contenu réel (magic bytes)
//     4. ALLowedMime et AllowedExtensions presets (documents, images)
//
// Notes:
//   - Les magic bytes sont vérifiés côté client quand possible (images).
//     Une vérification serveur (PostgreSQL trigger ou Supabase Storage
//     bucket policies) doit confirmer côté serveur.
//   - Le helper est volontairement SYNCHRONE sauf checkMagicBytes (async
//     car lit le fichier via FileReader).
//   - Le helper est non-bloquant: il retourne un résultat structuré,
//     l'appelant décide quoi faire (afficher une erreur, etc.).
// ============================================================================

export interface FileValidationResult {
  valid: boolean;
  issues: FileIssue[];
  sanitizedName: string; // nom nettoyé pour stockage
  detectedMime: string; // MIME détecté via magic bytes (si image)
  safeToUpload: boolean; // true si valid && no critical issues
}

export interface FileIssue {
  code: string;
  severity: 'critical' | 'warning';
  message: string;
}

// ─── Presets: MIME et extensions autorisées ─────────────────────────────────

export const ALLOWED_DOCUMENT_MIME = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/rtf',
]);

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set<string>([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf',
]);

export const ALLOWED_IMAGE_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set<string>([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
]);

// Extensions interdites même si MIME correct (anti-fake content)
export const FORBIDDEN_EXTENSIONS = new Set<string>([
  'exe', 'bat', 'sh', 'php', 'php3', 'php4', 'php5', 'phtml',
  'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'svg', 'svgz',
  'jsp', 'asp', 'aspx', 'cgi', 'pl', 'py', 'rb', 'go',
]);

// ─── Limites ────────────────────────────────────────────────────────────────

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Magic bytes signatures ──────────────────────────────────────────────────

interface MagicByteSignature {
  mime: string;
  offset: number;
  bytes: number[];
}

const MAGIC_SIGNATURES: MagicByteSignature[] = [
  // Images
  { mime: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/gif', offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  // Documents
  { mime: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extrait l'extension d'un nom de fichier (lowercase, sans le point).
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  // noUncheckedIndexedAccess: accès sécurisé
  const last = parts[parts.length - 1];
  return (last ?? '').toLowerCase();
}

/**
 * Nettoie un nom de fichier pour stockage:
 *   - Retire les ../ (path traversal)
 *   - Remplace les caractères non-alphanumériques (sauf . _ -) par _
 *   - Tronque à 100 caractères
 *   - Lowercase
 *   - Préfixe aléatoire optionnel pour éviter les collisions
 *
 * @param filename - Nom de fichier original
 * @param randomPrefix - Si true, ajoute un préfixe aléatoire de 8 chars
 */
export function sanitizeFileName(filename: string, randomPrefix: boolean = false): string {
  if (!filename) return '';

  // Étape 1: retirer path traversal
  const basename = filename.split(/[\\/]/).pop() ?? filename;

  // Étape 2: retirer ../ et ..\
  let safe = basename.replace(/\.\./g, '');

  // Étape 3: retirer caractères de contrôle et unicode problématiques
  safe = safe.replace(/[\x00-\x1f\x7f]/g, '');

  // Étape 4: remplacer tout ce qui n'est pas [a-zA-Z0-9._-] par _
  safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Étape 5: lowercase
  safe = safe.toLowerCase();

  // Étape 6: tronquer à 100 caractères (en gardant l'extension)
  if (safe.length > 100) {
    const ext = getFileExtension(safe);
    const maxBase = ext ? 100 - ext.length - 1 : 100;
    safe = safe.substring(0, maxBase) + (ext ? '.' + ext : '');
  }

  // Étape 7: préfixe aléatoire optionnel
  if (randomPrefix) {
    const prefix = generateRandomString(8);
    const ext = getFileExtension(safe);
    const base = ext ? safe.substring(0, safe.length - ext.length - 1) : safe;
    safe = ext ? `${prefix}_${base}.${ext}` : `${prefix}_${base}`;
  }

  return safe;
}

function generateRandomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(bytes, b => charset[b % charset.length]).join('');
}

/**
 * Lit les premiers bytes d'un fichier pour détecter son vrai MIME via signature.
 *
 * @param file - Le fichier à inspecter
 * @param bytesToRead - Nombre de bytes à lire (default: 16)
 * @returns Le MIME détecté, ou 'application/octet-stream' si inconnu
 */
export function detectMimeByMagicBytes(file: File): Promise<string> {
  return new Promise((resolve) => {
    // Seuls les fichiers image sont vérifiés via magic bytes côté client
    // (PDF, DOC, etc. ont des signatures plus complexes et sont déjà filtrés
    // par extension + MIME côté serveur via Supabase Storage policies)
    const slice = file.slice(0, 16);
    const reader = new FileReader();

    reader.onload = () => {
      const buf = reader.result;
      if (!(buf instanceof ArrayBuffer)) {
        resolve('application/octet-stream');
        return;
      }
      const bytes = new Uint8Array(buf);

      for (const sig of MAGIC_SIGNATURES) {
        if (bytesMatchSignature(bytes, sig)) {
          resolve(sig.mime);
          return;
        }
      }

      resolve('application/octet-stream');
    };

    reader.onerror = () => resolve('application/octet-stream');
    reader.readAsArrayBuffer(slice);
  });
}

function bytesMatchSignature(bytes: Uint8Array, sig: MagicByteSignature): boolean {
  for (let i = 0; i < sig.bytes.length; i++) {
    if (bytes[sig.offset + i] !== sig.bytes[i]) return false;
  }
  return true;
}

// ─── Validation principale ──────────────────────────────────────────────────

export interface ValidateFileOptions {
  allowedMime?: Set<string>;
  allowedExtensions?: Set<string>;
  maxSizeBytes?: number;
  checkMagicBytes?: boolean; // default: true pour images, false pour documents
}

/**
 * Valide un fichier avant upload.
 *
 * Retourne un résultat structuré avec:
 *   - valid: true si aucune issue critique
 *   - issues: liste des problèmes (severity: critical | warning)
 *   - sanitizedName: nom nettoyé pour stockage
 *   - detectedMime: MIME détecté via magic bytes (si applicable)
 *   - safeToUpload: true si valid && toutes les vérifications passées
 *
 * @param file - Le fichier File à valider
 * @param options - Options de validation
 */
export async function validateFile(
  file: File,
  options: ValidateFileOptions = {}
): Promise<FileValidationResult> {
  const issues: FileIssue[] = [];
  let detectedMime = 'application/octet-stream';

  const allowedMime = options.allowedMime ?? ALLOWED_DOCUMENT_MIME;
  const allowedExtensions = options.allowedExtensions ?? ALLOWED_DOCUMENT_EXTENSIONS;
  const maxSize = options.maxSizeBytes ?? MAX_DOCUMENT_SIZE_BYTES;

  // 1. Vérifie la taille
  if (file.size > maxSize) {
    issues.push({
      code: 'FILE_TOO_LARGE',
      severity: 'critical',
      message: `Taille ${(file.size / 1024 / 1024).toFixed(2)} MB dépasse la limite ${(maxSize / 1024 / 1024).toFixed(0)} MB`,
    });
  }

  if (file.size === 0) {
    issues.push({
      code: 'FILE_EMPTY',
      severity: 'critical',
      message: 'Fichier vide',
    });
  }

  // 2. Vérifie l'extension
  const ext = getFileExtension(file.name);

  if (!ext) {
    issues.push({
      code: 'NO_EXTENSION',
      severity: 'warning',
      message: 'Fichier sans extension',
    });
  }

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    issues.push({
      code: 'FORBIDDEN_EXTENSION',
      severity: 'critical',
      message: `Extension .${ext} interdite pour des raisons de sécurité`,
    });
  }

  if (allowedExtensions.size > 0 && ext && !allowedExtensions.has(ext)) {
    issues.push({
      code: 'EXTENSION_NOT_ALLOWED',
      severity: 'critical',
      message: `Extension .${ext} non autorisée (autorisées: ${Array.from(allowedExtensions).join(', ')})`,
    });
  }

  // 3. Vérifie le MIME déclaré par le navigateur
  if (file.type && allowedMime.size > 0 && !allowedMime.has(file.type)) {
    issues.push({
      code: 'MIME_NOT_ALLOWED',
      severity: 'warning',
      message: `Type MIME ${file.type} non dans la liste autorisée`,
    });
  }

  // 4. Vérification magic bytes pour images et PDFs
  if (options.checkMagicBytes !== false && (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'pdf')) {
    detectedMime = await detectMimeByMagicBytes(file);

    // Si le MIME détecté ne correspond pas au MIME déclaré → suspicious
    // (cela inclut le cas où detectedMime = 'application/octet-stream'
    // car on n'a pas reconnu la signature attendue)
    if (file.type && detectedMime !== file.type) {
      issues.push({
        code: 'MIME_MISMATCH',
        severity: 'critical',
        message: `Le contenu du fichier (${detectedMime}) ne correspond pas à son type déclaré (${file.type})`,
      });
    }
  }

  // 5. Sanitize le nom
  const sanitizedName = sanitizeFileName(file.name, false);

  // 6. Vérifie le nom sanitizé n'est pas vide
  if (!sanitizedName) {
    issues.push({
      code: 'INVALID_FILENAME',
      severity: 'critical',
      message: 'Nom de fichier invalide après nettoyage',
    });
  }

  const hasCritical = issues.some(i => i.severity === 'critical');

  return {
    valid: !hasCritical,
    issues,
    sanitizedName,
    detectedMime,
    safeToUpload: !hasCritical,
  };
}

// Export pour les tests
export const __test__ = {
  getFileExtension,
  sanitizeFileName,
  bytesMatchSignature,
  MAGIC_SIGNATURES,
  FORBIDDEN_EXTENSIONS,
};
