import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  stripTrailingTypeLabel,
  fileNameExtension,
  hasFileExtension,
  deriveFileNameFromUrl,
} from '../../../src/core/name/sanitize';

describe('core/name sanitize', () => {
  it('strips a trailing type label only when the stem keeps its extension', () => {
    expect(sanitizeFileName('report.pdf Microsoft Word')).toBe('report.pdf');
    expect(sanitizeFileName('example.zipTömörített archívum', 'hu')).toBe('example.zip');
    expect(sanitizeFileName('Design Document')).toBe('Design Document');
  });

  it('collapses doubled filenames and repeated extensions', () => {
    expect(sanitizeFileName('notes.txtnotes.txt')).toBe('notes.txt');
    expect(sanitizeFileName('summary.pdfpdf')).toBe('summary.pdf');
  });

  it('extracts and verifies extensions', () => {
    expect(fileNameExtension('report.pdf')).toBe('pdf');
    expect(fileNameExtension('archive.tar.gz')).toBe('gz');
    expect(fileNameExtension('no-extension')).toBeNull();
    expect(hasFileExtension('report.pdf')).toBe(true);
    expect(hasFileExtension('no-extension')).toBe(false);
  });

  it('derives a filename from a URL path', () => {
    expect(deriveFileNameFromUrl('https://example.com/files/notes.txt')).toBe('notes.txt');
    expect(deriveFileNameFromUrl('https://example.com/no/file/here')).toBeNull();
    expect(deriveFileNameFromUrl('not-a-url')).toBeNull();
  });
});

// ============================================================================
// PROPERTY TESTS — deterministic generators, no deps (fast-check absent)
// ============================================================================

/** Seeded LCG so property runs are reproducible. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const ALPHABETS = [
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-_', // ascii file-ish
  'äöüßáéíóúñç worthwhile diacritics', // latin-1 supplement
  'текст данные файл', // cyrillic
  'ファイル 名前 省略', // CJK (unspaced)
  'עברית קובץ', // rtl
  '🎉🚀📄', // astral plane (surrogate pairs)
];

function randomString(rnd: () => number, maxLength = 40): string {
  const alphabet = ALPHABETS[Math.floor(rnd() * ALPHABETS.length)];
  const length = Math.floor(rnd() * maxLength);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(rnd() * alphabet.length)];
  }
  return out;
}

const EXTENSIONS = ['pdf', 'zip', 'docx', 'txt', 'png', 'mp4', 'csv', 'xlsx', 'html'];
const LABELS = ['PDF', 'Compressed archive', 'Microsoft Word', 'Document', 'File', 'Unknown'];

describe('core/name sanitize — properties', () => {
  const rnd = makeRandom(20260912);

  it('never throws on arbitrary unicode noise (100 cases)', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomString(rnd);
      expect(() => sanitizeFileName(input)).not.toThrow();
      const result = sanitizeFileName(input);
      expect(typeof result).toBe('string');
    }
  });

  it('output is never longer than input (only strips, 100 cases)', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomString(rnd);
      const result = sanitizeFileName(input);
      expect(result.length).toBeLessThanOrEqual(input.length);
    }
  });

  it('is idempotent (100 cases)', () => {
    for (let i = 0; i < 100; i++) {
      const input = randomString(rnd);
      const once = sanitizeFileName(input);
      const twice = sanitizeFileName(once);
      expect(twice).toBe(once);
    }
  });

  it('strips every glued label when a real extension precedes it (100 cases)', () => {
    for (let i = 0; i < 100; i++) {
      const stem = randomString(rnd, 15).replace(/[.\s]/g, 'x').trim() || 'stem';
      const ext = EXTENSIONS[Math.floor(rnd() * EXTENSIONS.length)];
      const label = LABELS[Math.floor(rnd() * LABELS.length)];
      const glued = `${stem}.${ext}${label}`;
      expect(sanitizeFileName(glued)).toBe(`${stem}.${ext}`);
    }
  });

  it('never mutilates a label-free name with a real extension (100 cases)', () => {
    for (let i = 0; i < 100; i++) {
      const stem = randomString(rnd, 15).replace(/[.\s]/g, 'x').trim() || 'stem';
      const ext = EXTENSIONS[Math.floor(rnd() * EXTENSIONS.length)];
      const plain = `${stem}.${ext}`;
      expect(sanitizeFileName(plain)).toBe(plain);
    }
  });
});
