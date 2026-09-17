// filepath: extension/tests/core/name/property.test.ts
/**
 * ============================================================================
 * NAME PROPERTY TESTS — fast-check invariants over the pure name pipeline
 * (ADR-0008 / S12 T4)
 * ============================================================================
 *
 * Machine-checked invariants that hand-written tests only sample:
 *
 *   P1  sanitize is total — never throws on arbitrary unicode noise.
 *   P2  sanitize only ever REMOVES: the result is a substring of the trimmed
 *       input, so its length can never exceed the input's. (The module has no
 *       illegal-char set and no length clamp of its own — bounding IS the
 *       input; OS-illegal characters are a filesystem concern handled by the
 *       download consumer, not this pure pipeline.)
 *   P3  sanitize preserves a plausible, label-free filename with a real
 *       extension byte-for-byte (stem + "." + ext, ext 2-10 alphanumerics).
 *   P4  sanitize removes exactly the trailing type label — glued or spaced,
 *       English and Hungarian tables — and nothing else.
 *   P5  sanitize is idempotent over the plausible-name grammar.
 *   P6  strip never empties a name: strip(x) === "" iff x === "".
 *   P7  when strip changes a name, the input ended (case-insensitively) with
 *       a known type label, the result keeps a real extension and is strictly
 *       shorter — the module's own anchored + corroborated contract.
 *   P8  strip is idempotent over the plausible-name grammar. (Global
 *       idempotence is deliberately NOT asserted: a render is filename plus
 *       ONE label, and a second strip can misread a genuine stem —
 *       "r.abpdf Binary" → "r.abpdf" → "r.ab" — which is the documented
 *       ambiguity of the design, not a bug.)
 *   P9  verify: hasFileExtension ⟺ fileNameExtension !== null, and the
 *       extracted extension is always 1-10 lowercase alphanumerics.
 *   P10 derive: never throws; null unless the URL parses and its last path
 *       segment carries a "."; positive URLs yield the exact segment.
 *
 * Generators build plausible names from alphabets chosen so the module's
 * anchored rules are exercised exactly: extensions carry no label as a proper
 * suffix and are never a doubled string, so any transformation the modules
 * apply must come from a real label match.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  sanitizeFileName,
  stripTrailingTypeLabel,
  fileNameExtension,
  hasFileExtension,
  deriveFileNameFromUrl,
} from '../../../src/core/name/sanitize';
import { getTypeLabels } from '../../../src/core/name/type-labels';

// ── Generators ──────────────────────────────────────────────────────────────

/** Build a string arbitrary over a fixed BMP alphabet (no astral surprises). */
function chars(alphabet: string, minLen = 0, maxLen = 16): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...alphabet.split('')), { minLength: minLen, maxLength: maxLen })
    .map((parts) => parts.join(''));
}

const STEM_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';

/**
 * Extensions verified against the full merged label table: no label (EN or
 * HU) is a proper suffix of any of them, none IS a label, and none is a
 * doubled string (the repeated-extension collapse would fire). Odd-length
 * entries are trivially non-doubled; even ones are checked by hand.
 */
const EXTENSIONS = ['docx', 'html', 'mp4', 'png', 'csv', 'webm', 'tar', 'txt', 'js', '7z'];

const arbStem = chars(STEM_CHARS, 1, 16);
const arbExt = fc.constantFrom(...EXTENSIONS);
const arbPlainName = arbStem.chain((stem) => arbExt.map((ext) => `${stem}.${ext}`));

/**
 * Labels curated so no label is a (case-insensitive) string suffix of another
 * curated label and no longer table label can span onto the generated stem —
 * the generated label is provably the only corroborated match, so the strip
 * result is exact.
 */
const EN_LABELS = [
  'PDF', 'Video', 'Image', 'Audio', 'Zip', 'Code', 'Unknown', 'Binary',
  'Archive', 'Document', 'Shortcut', 'Text File',
];
const HU_LABELS = ['Tömörített archívum', 'Szöveges dokumentum', 'Fájl', 'Mappa', 'Videó', 'Kép'];

interface Labelled {
  input: string;
  expected: string;
  lang?: string;
}

const arbLabelledName: fc.Arbitrary<Labelled> = fc.oneof(
  // English label, explicit locale, glued or spaced.
  fc
    .record({
      stem: arbStem,
      ext: arbExt,
      label: fc.constantFrom(...EN_LABELS),
      sep: fc.constantFrom('', ' '),
    })
    .map(({ stem, ext, label, sep }): Labelled => ({
      input: `${stem}.${ext}${sep}${label}`,
      expected: `${stem}.${ext}`,
      lang: 'en',
    })),
  // English label, no locale (merges every table — still English-only strip).
  fc
    .record({ stem: arbStem, ext: arbExt, label: fc.constantFrom(...EN_LABELS) })
    .map(({ stem, ext, label }): Labelled => ({
      input: `${stem}.${ext}${label}`,
      expected: `${stem}.${ext}`,
    })),
  // Hungarian label, hu locale (English merged in), glued or spaced.
  fc
    .record({
      stem: arbStem,
      ext: arbExt,
      label: fc.constantFrom(...HU_LABELS),
      sep: fc.constantFrom('', ' '),
    })
    .map(({ stem, ext, label, sep }): Labelled => ({
      input: `${stem}.${ext}${sep}${label}`,
      expected: `${stem}.${ext}`,
      lang: 'hu',
    })),
);

/** Noise for totality/monotonicity: printable ASCII plus real unicode. */
const arbNoise: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 24 }),
  chars('aZ 09.-_\u00e4\u00f6\u00fc\u00df\u00e1\u00e9\u05d0\u05d1', 0, 24),
  chars('\u0623\u062d\u0643\u0645\u200f\u200e\u200b\u061c\ufeff\u00ad', 0, 24),
  chars('\u0442\u0435\u043a\u0441\u0442 \u30d5\u30a1\u30a4\u30eb\ud83d\udcc4\ud83d\ude80', 0, 12),
);

// The merged label table (what strip with no locale matches against).
const ALL_LABELS_LOWER = getTypeLabels().map((label) => label.toLowerCase());

// ── sanitize ────────────────────────────────────────────────────────────────

describe('core/name sanitize — properties', () => {
  it('P1: never throws on arbitrary unicode noise and always returns a string', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        const result = sanitizeFileName(noise);
        expect(typeof result).toBe('string');
      }),
    );
  });

  it('P2: output is a substring of the trimmed input (only removes, length bounded by input)', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        const result = sanitizeFileName(noise);
        expect(noise.trim()).toContain(result);
        expect(result.length).toBeLessThanOrEqual(noise.length);
      }),
    );
  });

  it('P3: preserves a plausible label-free filename with a real extension, byte-for-byte', () => {
    fc.assert(
      fc.property(arbPlainName, (name) => {
        expect(sanitizeFileName(name)).toBe(name);
      }),
    );
  });

  it('P4: removes exactly the trailing type label (glued or spaced, EN and HU)', () => {
    fc.assert(
      fc.property(arbLabelledName, ({ input, expected, lang }) => {
        expect(sanitizeFileName(input, lang)).toBe(expected);
      }),
    );
  });

  it('P5: is idempotent over the plausible-name grammar (plain and labelled renders)', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbPlainName.map((input) => ({ input, lang: undefined })), arbLabelledName),
        ({ input, lang }) => {
          const once = sanitizeFileName(input, lang);
          const twice = sanitizeFileName(once, lang);
          expect(twice).toBe(once);
        },
      ),
    );
  });
});

// ── strip ───────────────────────────────────────────────────────────────────

describe('core/name strip — properties', () => {
  it('P6: strip(x) === "" iff x === "" — a non-empty name is never emptied', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        const result = stripTrailingTypeLabel(noise);
        expect(result === '').toBe(noise === '');
      }),
    );
  });

  it('P7: when strip changes a name, the input ended with a known label, the result keeps a real extension and is strictly shorter', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        const result = stripTrailingTypeLabel(noise);
        if (result === noise) return;
        expect(ALL_LABELS_LOWER.some((label) => noise.toLowerCase().endsWith(label))).toBe(true);
        expect(result).toMatch(/\.[a-zA-Z0-9]{1,10}$/);
        expect(result.length).toBeLessThan(noise.length);
      }),
    );
  });

  it('P8: strip is idempotent over the plausible-name grammar', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          arbPlainName.map((input) => ({ input, lang: undefined })),
          arbLabelledName,
        ),
        ({ input, lang }) => {
          const once = stripTrailingTypeLabel(input, lang);
          const twice = stripTrailingTypeLabel(once, lang);
          expect(twice).toBe(once);
        },
      ),
    );
  });
});

// ── verify ──────────────────────────────────────────────────────────────────

describe('core/name verify — properties', () => {
  it('P9: hasFileExtension ⟺ fileNameExtension !== null; extension is 1-10 lowercase alphanumerics; exact on plausible names', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        const ext = fileNameExtension(noise);
        expect(hasFileExtension(noise)).toBe(ext !== null);
        if (ext !== null) expect(ext).toMatch(/^[a-z0-9]{1,10}$/);
      }),
    );
    fc.assert(
      fc.property(arbPlainName, (name) => {
        const dot = name.lastIndexOf('.');
        expect(fileNameExtension(name)).toBe(name.slice(dot + 1));
      }),
    );
  });
});

// ── derive ──────────────────────────────────────────────────────────────────

describe('core/name derive — properties', () => {
  const arbDerivableUrl = fc
    .record({
      dirs: fc.constantFrom('', 'files/', 'a/b/', 'course/files/'),
      stem: chars(STEM_CHARS, 1, 8),
      ext: arbExt,
      suffix: fc.constantFrom('', '?download=1', '#page=3'),
    })
    .map(({ dirs, stem, ext, suffix }) => ({
      url: `https://example.com/${dirs}${stem}.${ext}${suffix}`,
      expected: `${stem}.${ext}`,
    }));

  it('P10: derives the exact last path segment from valid URLs', () => {
    fc.assert(
      fc.property(arbDerivableUrl, ({ url, expected }) => {
        expect(deriveFileNameFromUrl(url)).toBe(expected);
      }),
    );
  });

  it('P10: returns null for URLs whose last path segment has no extension', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', 'files/', 'a/b/'),
        chars(STEM_CHARS, 1, 10),
        (dirs, stem) => {
          expect(deriveFileNameFromUrl(`https://example.com/${dirs}${stem}`)).toBeNull();
        },
      ),
    );
  });

  it('P10: is total over arbitrary strings; a non-null result is the decoded, dot-bearing last segment of a parseable URL', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        let parsed: URL | null = null;
        try {
          parsed = new URL(noise);
        } catch {
          parsed = null;
        }
        if (parsed === null) {
          expect(deriveFileNameFromUrl(noise)).toBeNull();
          return;
        }
        const result = deriveFileNameFromUrl(noise);
        if (result === null) return;
        const seg = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        expect(result).toBe(seg);
        expect(result).toContain('.');
      }),
    );
  });
});
