// ============================================================================
// JurisLink - Phase 4.13 - Tests: secureFile.ts (MIME + size + sanitization)
// ============================================================================
// Emplacement: src/__tests__/secureFile.spec.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  validateFile,
  sanitizeFileName,
  getFileExtension,
  detectMimeByMagicBytes,
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
  ALLOWED_DOCUMENT_EXTENSIONS,
  FORBIDDEN_EXTENSIONS,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  __test__,
} from '../lib/secureFile';

// Helpers pour créer des File factices
function makeFile(name: string, content: string, mime: string = 'application/octet-stream'): File {
  const blob = new Blob([content], { type: mime });
  return new File([blob], name, { type: mime });
}

function makeImageFile(format: 'jpeg' | 'png' | 'gif' | 'webp'): File {
  // Magic bytes réels des formats images
  const magicBytes: Record<string, number[]> = {
    jpeg: [0xFF, 0xD8, 0xFF, 0xE0],
    png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    webp: [0x52, 0x49, 0x46, 0x46],
  };
  const magicBytesFor = magicBytes[format];
  if (!magicBytesFor) {
    throw new Error(`Unknown image format: ${format}`);
  }
  const bytes = new Uint8Array(magicBytesFor);
  const blob = new Blob([bytes], { type: `image/${format === 'jpeg' ? 'jpeg' : format}` });
  return new File([blob], `test.${format === 'jpeg' ? 'jpg' : format}`, { type: `image/${format === 'jpeg' ? 'jpeg' : format}` });
}

describe('secureFile — getFileExtension', () => {
  it('retourne l\'extension en lowercase', () => {
    expect(getFileExtension('file.PDF')).toBe('pdf');
    expect(getFileExtension('image.JPG')).toBe('jpg');
    expect(getFileExtension('doc.docx')).toBe('docx');
  });

  it('retourne vide si pas d\'extension', () => {
    expect(getFileExtension('filename')).toBe('');
    expect(getFileExtension('')).toBe('');
  });

  it('gère les noms avec plusieurs points', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
    expect(getFileExtension('my.file.pdf')).toBe('pdf');
  });
});

describe('secureFile — sanitizeFileName', () => {
  it('retire les path traversal (../)', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('foo/../../bar')).toBe('bar');
    expect(sanitizeFileName('..\\..\\windows\\system32')).toBe('system32');
  });

  it('remplace les caractères non-alphanumériques par _', () => {
    expect(sanitizeFileName('file with spaces.pdf')).toBe('file_with_spaces.pdf');
    expect(sanitizeFileName('file@name#.pdf')).toBe('file_name_.pdf');
    expect(sanitizeFileName('café.pdf')).toBe('caf_.pdf'); // é remplacé
  });

  it('lowercase le nom', () => {
    expect(sanitizeFileName('MyFile.PDF')).toBe('myfile.pdf');
    expect(sanitizeFileName('IMAGE.PNG')).toBe('image.png');
  });

  it('tronque à 100 caractères en gardant l\'extension', () => {
    const longName = 'a'.repeat(120) + '.pdf';
    const sanitized = sanitizeFileName(longName);
    expect(sanitized.length).toBeLessThanOrEqual(100);
    expect(sanitized.endsWith('.pdf')).toBe(true);
  });

  it('ajoute un préfixe aléatoire si demandé', () => {
    const sanitized = sanitizeFileName('test.pdf', true);
    expect(sanitized).toMatch(/^[a-z0-9]{8}_test\.pdf$/);
  });

  it('retire les caractères de contrôle', () => {
    const sanitized = sanitizeFileName('file\x00\x01\x02name.pdf');
    expect(sanitized).toBe('filename.pdf');
  });

  it('gère les noms vides', () => {
    expect(sanitizeFileName('')).toBe('');
  });
});

describe('secureFile — FORBIDDEN_EXTENSIONS', () => {
  it('contient les extensions exécutables courantes', () => {
    expect(FORBIDDEN_EXTENSIONS.has('exe')).toBe(true);
    expect(FORBIDDEN_EXTENSIONS.has('php')).toBe(true);
    expect(FORBIDDEN_EXTENSIONS.has('js')).toBe(true);
    expect(FORBIDDEN_EXTENSIONS.has('html')).toBe(true);
    expect(FORBIDDEN_EXTENSIONS.has('svg')).toBe(true);
  });
});

describe('secureFile — detectMimeByMagicBytes', () => {
  it('détecte les JPEG via magic bytes', async () => {
    const file = makeImageFile('jpeg');
    const mime = await detectMimeByMagicBytes(file);
    expect(mime).toBe('image/jpeg');
  });

  it('détecte les PNG via magic bytes', async () => {
    const file = makeImageFile('png');
    const mime = await detectMimeByMagicBytes(file);
    expect(mime).toBe('image/png');
  });

  it('détecte les GIF via magic bytes', async () => {
    const file = makeImageFile('gif');
    const mime = await detectMimeByMagicBytes(file);
    expect(mime).toBe('image/gif');
  });

  it('retourne application/octet-stream pour un contenu inconnu', async () => {
    const file = makeFile('unknown.dat', 'hello world');
    const mime = await detectMimeByMagicBytes(file);
    expect(mime).toBe('application/octet-stream');
  });
});

describe('secureFile — validateFile', () => {
  it('accepte un PDF valide', async () => {
    // Magic bytes PDF: %PDF
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const file = new File([blob], 'document.pdf', { type: 'application/pdf' });

    const result = await validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.safeToUpload).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('refuse un fichier trop gros', async () => {
    const file = makeFile('big.pdf', 'x'.repeat(MAX_DOCUMENT_SIZE_BYTES + 1));
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'FILE_TOO_LARGE')).toBe(true);
  });

  it('refuse un fichier vide', async () => {
    const file = makeFile('empty.pdf', '');
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'FILE_EMPTY')).toBe(true);
  });

  it('refuse une extension interdite (.exe)', async () => {
    const file = makeFile('malicious.exe', 'MZ' + 'fake exe content');
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'FORBIDDEN_EXTENSION')).toBe(true);
  });

  it('refuse une extension non autorisée', async () => {
    const file = makeFile('document.xyz', 'content');
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'EXTENSION_NOT_ALLOWED')).toBe(true);
  });

  it('refuse si MIME déclaré ne correspond pas au contenu (magic bytes)', async () => {
    // Fichier .jpg mais contenu texte
    const file = makeFile('image.jpg', 'not an image at all', 'image/jpeg');
    const result = await validateFile(file, { checkMagicBytes: true });
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'MIME_MISMATCH')).toBe(true);
  });

  it('accepte une image PNG valide', async () => {
    const file = makeImageFile('png');
    const result = await validateFile(file, {
      allowedMime: ALLOWED_IMAGE_MIME,
      allowedExtensions: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']),
      maxSizeBytes: MAX_IMAGE_SIZE_BYTES,
    });
    expect(result.valid).toBe(true);
    expect(result.detectedMime).toBe('image/png');
  });

  it('sanitizedName est retourné', async () => {
    const file = makeFile('My Document.pdf', 'content');
    const result = await validateFile(file);
    expect(result.sanitizedName).toBe('my_document.pdf');
  });

  it('warning (non critical) si MIME déclaré absent de la liste', async () => {
    const file = makeFile('doc.pdf', '%PDF-1.4', 'application/octet-stream');
    const result = await validateFile(file, { allowedMime: new Set(['application/pdf']) });
    // Le magic bytes détecte bien application/pdf, donc MIME_MISMATCH peut être déclenché
    // parce que octet-stream != application/pdf
    expect(result.issues.length).toBeGreaterThan(0);
    // Mais le fichier reste acceptable si pas d'erreur critique
    const hasMimeMismatch = result.issues.some(i => i.code === 'MIME_MISMATCH');
    expect(hasMimeMismatch).toBe(true);
  });
});

describe('secureFile — presets', () => {
  it('ALLOWED_DOCUMENT_MIME contient PDF', () => {
    expect(ALLOWED_DOCUMENT_MIME.has('application/pdf')).toBe(true);
  });

  it('ALLOWED_IMAGE_MIME contient JPEG et PNG', () => {
    expect(ALLOWED_IMAGE_MIME.has('image/jpeg')).toBe(true);
    expect(ALLOWED_IMAGE_MIME.has('image/png')).toBe(true);
  });

  it('ALLOWED_DOCUMENT_EXTENSIONS contient pdf, docx, xlsx', () => {
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has('pdf')).toBe(true);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has('docx')).toBe(true);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has('xlsx')).toBe(true);
  });
});

describe('secureFile — __test__.bytesMatchSignature', () => {
  it('retourne true si les bytes correspondent', () => {
    const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
    expect(__test__.bytesMatchSignature(bytes, { mime: '', offset: 0, bytes: [0xFF, 0xD8, 0xFF] })).toBe(true);
  });

  it('retourne false si les bytes ne correspondent pas', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(__test__.bytesMatchSignature(bytes, { mime: '', offset: 0, bytes: [0xFF, 0xD8, 0xFF] })).toBe(false);
  });
});
