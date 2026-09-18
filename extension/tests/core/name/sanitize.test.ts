import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  stripTrailingTypeLabel,
  fileNameExtension,
  hasFileExtension,
  deriveFileNameFromUrl,
} from '../../../src/core/name/sanitize';
import { getTypeLabels } from '../../../src/core/name/type-labels';

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

// ============================================================================
// MUTATION HARDENING (S12) — one assertion per table entry, boundary and
// branch the corpus used to cover. Labels are exercised through the real
// pipeline so a mutated table entry, locale fold or regex quantifier fails.
// ============================================================================

describe('core/name sanitize — mutation hardening (S12)', () => {
  it('strips every English label that had no dedicated case', () => {
    expect(sanitizeFileName('a.pptxMicrosoft PowerPoint')).toBe('a.pptx');
    expect(sanitizeFileName('x.binBinary')).toBe('x.bin');
    expect(sanitizeFileName('s.gsGoogle Sheets')).toBe('s.gs');
    expect(sanitizeFileName('d.gdGoogle Docs')).toBe('d.gd');
    expect(sanitizeFileName('v.mp4Video')).toBe('v.mp4');
    expect(sanitizeFileName('i.pngImage')).toBe('i.png');
    expect(sanitizeFileName('a.mp3Audio')).toBe('a.mp3');
    expect(sanitizeFileName('t.txtText File')).toBe('t.txt');
    expect(sanitizeFileName('c.pyCode')).toBe('c.py');
    expect(sanitizeFileName('l.urlShortcut')).toBe('l.url');
    expect(sanitizeFileName('u.binUnknown')).toBe('u.bin');
    expect(sanitizeFileName('g.zGoogle Slides')).toBe('g.z');
    expect(sanitizeFileName('m.docMicrosoft Word')).toBe('m.doc');
    expect(sanitizeFileName('s.xlsMicrosoft Excel')).toBe('s.xls');
    expect(sanitizeFileName('z.zipCompressed archive')).toBe('z.zip');
    // Short bare labels (each is its own table entry — a dropped entry must
    // fail this sweep, not merely another label's case).
    expect(sanitizeFileName('n.mdText')).toBe('n.md');
    expect(sanitizeFileName('a.docWord')).toBe('a.doc');
    expect(sanitizeFileName('a.xlsExcel')).toBe('a.xls');
    expect(sanitizeFileName('a.pptPowerPoint')).toBe('a.ppt');
    expect(sanitizeFileName('a.rarArchive')).toBe('a.rar');
    expect(sanitizeFileName('a.zipZip')).toBe('a.zip');
    expect(sanitizeFileName('a.docxDocument')).toBe('a.docx');
  });

  it('strips every Hungarian locale label (S12 sweep)', () => {
    const hu: Array<[string, string]> = [
      ['a.pdfGoogle-dokumentumok', 'Google-dokumentumok'],
      ['a.pdfGoogle-táblázatok', 'Google-táblázatok'],
      ['a.pptxGoogle-prezentáció', 'Google-prezentáció'],
      ['a.pdfGoogle-űrlapok', 'Google-űrlapok'],
      ['a.pdfGoogle-rajz', 'Google-rajz'],
      ['a.pdfSaját Drive', 'Saját Drive'],
      ['a.docxSzöveges dokumentum', 'Szöveges dokumentum'],
      ['a.txtSzövegfájl', 'Szövegfájl'],
      ['a.binBináris fájl', 'Bináris fájl'],
      ['a.binBináris', 'Bináris'],
      ['a.binIsmeretlen', 'Ismeretlen'],
      ['a.pdfFájl', 'Fájl'],
      ['a.xlsTáblázat', 'Táblázat'],
      ['a.pptxPrezentáció', 'Prezentáció'],
      ['a.pdfŰrlap', 'Űrlap'],
      ['a.dwgRajz', 'Rajz'],
      ['a.zipMappa', 'Mappa'],
      ['a.mp4Videó', 'Videó'],
      ['a.pngKép', 'Kép'],
      ['a.mp3Hang', 'Hang'],
      ['a.txtSzöveg', 'Szöveg'],
      ['a.urlParancsikon', 'Parancsikon'],
      ['a.pyKód', 'Kód'],
    ];
    for (const [glued, label] of hu) {
      expect(sanitizeFileName(glued, 'hu'), label).toBe(glued.slice(0, glued.length - label.length));
    }
  });

  it('collapses a doubled name case-insensitively', () => {
    expect(sanitizeFileName('Summary.PDFpdf')).toBe('Summary.PDF');
  });

  it('repeated-extension collapse needs a 2-10 char extension', () => {
    // One-char "extensions" are not collapsed.
    expect(sanitizeFileName('x.aa')).toBe('x.aa');
    // A 10-char repeated extension collapses (the second copy is removed).
    expect(sanitizeFileName('x.abcdefghijabcdefghij')).toBe('x.abcdefghij');
    // An 11-char run is not an extension and is left alone.
    expect(sanitizeFileName('x.abcdefghijkabcdefghijk')).toBe('x.abcdefghijkabcdefghijk');
  });

  it('repeated-extension removal preserves the leading run', () => {
    expect(sanitizeFileName('a .pdfpdf')).toBe('a .pdf');
  });

  it('trims the raw name before stripping (S12)', () => {
    expect(sanitizeFileName('x.pdf File ')).toBe('x.pdf');
  });

  it('repeated-extension collapse is anchored to the end of the name (S12)', () => {
    expect(sanitizeFileName('a.pdf.pdfmore')).toBe('a.pdf.pdfmore');
  });

  it('strips the LONGEST matching label (shortest stem wins)', () => {
    // 'Text File' and 'File' both end-match; only 'Text File' leaves a stem
    // with a real extension, and it must be the strip that happens.
    expect(stripTrailingTypeLabel('a.pdfText File')).toBe('a.pdf');
  });

  it('strip corroboration boundaries', () => {
    // Stem without a dot is never treated as carrying an extension.
    expect(stripTrailingTypeLabel('aFile')).toBe('aFile');
    // A whole name that IS a label is left alone (stem would be empty).
    expect(stripTrailingTypeLabel('Document')).toBe('Document');
    expect(stripTrailingTypeLabel('File')).toBe('File');
    // Extension must be 1-10 alphanumerics.
    expect(stripTrailingTypeLabel('a.xFile')).toBe('a.x'); // 1-char ext
    expect(stripTrailingTypeLabel('a.abcdefghiFile')).toBe('a.abcdefghi'); // 10-char ext
    expect(stripTrailingTypeLabel('a.abcdefghijkFile')).toBe('a.abcdefghijkFile'); // 11-char
  });

  it('locale folding is case-insensitive and region-suffix tolerant', () => {
    expect(sanitizeFileName('example.zipTömörített archívum', 'HU')).toBe('example.zip');
    expect(sanitizeFileName('example.zipTömörített archívum', 'hu-HU')).toBe('example.zip');
    expect(getTypeLabels('hu-HU')).toContain('Tömörített archívum');
  });

  it('a known locale without a table gets English only; absent locale merges all', () => {
    const french = getTypeLabels('fr');
    expect(french).toContain('PDF');
    expect(french).not.toContain('Tömörített archívum');

    for (const noLocale of [undefined, '']) {
      const merged = getTypeLabels(noLocale);
      expect(merged).toContain('PDF');
      expect(merged).toContain('Tömörített archívum');
    }
  });

  it('derive handles the empty-path edge', () => {
    expect(deriveFileNameFromUrl('https://example.com/')).toBeNull();
    expect(deriveFileNameFromUrl('https://example.com/a/b.txt')).toBe('b.txt');
    expect(deriveFileNameFromUrl('https://example.com/a/b.txt?download=1')).toBe('b.txt');
    expect(deriveFileNameFromUrl('https://example.com/notes%2Etxt')).toBe('notes.txt');
  });
});
