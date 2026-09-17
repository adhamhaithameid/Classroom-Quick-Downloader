// filepath: extension/tests/core/acquire/download-url-property.test.ts
/**
 * ============================================================================
 * DOWNLOAD URL PROPERTY TESTS — fast-check invariants over the pure URL
 * rules (ADR-0008 / S12 T4)
 * ============================================================================
 *
 * Two pure modules are covered:
 *
 *   - src/core/acquire/download-url.ts — the Drive/docs URL → direct-download
 *     mapping and the shape extractor. Contract (machine-checked):
 *       U1  recognized shapes collapse to the byte-serving endpoint with the
 *           exact extracted id (authuser appended when given, never otherwise);
 *       U2  extractDriveFileId is a pure SHAPE extractor: non-null iff the
 *           (authuser-normalized) path matches a file/docs shape or the query
 *           carries a non-empty id/resourceId/fileId — on ANY host, never
 *           throwing; the https/host security gate is the validator's job;
 *       U3  every other URL passes through UNCHANGED (authuser null) or with
 *           only the authuser appended; the warmup depth cap holds;
 *       U4  auth_warmup continue chains convert while depth ≤ 3 and return
 *           the inner URL raw at depth 4.
 *
 *   - src/v2/decision/download-validator.ts — validateDownloadUrl, the pure
 *     security gate every download URL must pass. Contract (machine-checked,
 *     adversarial):
 *       S1  for ANY generated input: valid ⇒ https + allowlisted host +
 *           reason "OK" (no malformed/foreign/scheme-swapped URL ever returns
 *           valid);
 *       S2  http/ftp/file/data/javascript and mixed-case HTTPS spellings are
 *           always rejected, on every host shape;
 *       S3  lookalike and attacker-controlled hosts are always rejected;
 *       S4  double-encoding, path traversal and NUL injections are always
 *           rejected even when the URL shape otherwise matches;
 *       S5  every allowlisted shape with a clean id is accepted;
 *       S6  filterValidDownloadUrls keeps exactly the valid entries, in order.
 *
 * The validator's allowlist is duplicated here ON PURPOSE: it pins the
 * security set — a drift in either copy fails loudly.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DRIVE_DOWNLOAD_ENDPOINT,
  buildDriveDownloadUrlFrom,
  extractDriveFileId,
  toDownloadUrlFrom,
} from '../../../src/core/acquire/download-url';
import {
  filterValidDownloadUrls,
  validateDownloadUrl,
} from '../../../src/v2/decision/download-validator';

// ── Generators ──────────────────────────────────────────────────────────────

/** Build a string arbitrary over a fixed BMP alphabet. */
function chars(alphabet: string, minLen = 0, maxLen = 16): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom(...alphabet.split('')), { minLength: minLen, maxLength: maxLen })
    .map((parts) => parts.join(''));
}

/** URL-safe id alphabet — no percent-encoding surprises, exact round-trips. */
const arbId = chars('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1, 20);

const arbNoise: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 24 }),
  chars('aZ09.-_/?#:=&%\u00e4\u0623\u65e5', 0, 24),
);

/**
 * Recognized Drive/docs/classroom shapes (the core mapping's exact vocabulary).
 * Each carries the id it was built with, so the mapping can be pinned to use
 * THAT id. Trailing junk is limited to '#frag' — the one suffix that never
 * perturbs a path segment or a query value (a glued '&junk=1' on a path shape
 * legitimately becomes part of the captured id: [^/]+ stops at '/' only).
 */
interface DriveShape {
  url: string;
  id: string;
}

const arbFrag = fc.constantFrom('', '#frag');

const arbDriveShape: fc.Arbitrary<DriveShape> = fc.oneof(
  fc
    .record({
      u: fc.constantFrom('', 'u/0/', 'u/12/'),
      id: arbId,
      tail: fc.constantFrom('', '/view', '/edit', '/view?usp=sharing'),
      frag: arbFrag,
    })
    .map(({ u, id, tail, frag }) => ({
      url: `https://drive.google.com/${u}file/d/${id}${tail}${frag}`,
      id,
    })),
  fc
    .record({ id: arbId, which: fc.constantFrom('open', 'uc'), frag: arbFrag })
    .map(({ id, which, frag }) => ({
      url: `https://drive.google.com/${which}?id=${id}${frag}`,
      id,
    })),
  fc
    .record({
      u: fc.constantFrom('', 'u/3/'),
      kind: fc.constantFrom('document', 'presentation', 'drawings', 'spreadsheets'),
      id: arbId,
      tail: fc.constantFrom('', '/edit', '/preview'),
      frag: arbFrag,
    })
    .map(({ u, kind, id, tail, frag }) => ({
      url: `https://docs.google.com/${u}${kind}/d/${id}${tail}${frag}`,
      id,
    })),
  fc
    .record({
      u: fc.constantFrom('', 'u/2/'),
      id: arbId,
      key: fc.constantFrom('id', 'resourceId', 'fileId'),
      frag: arbFrag,
    })
    .map(({ u, id, key, frag }) => ({
      url: `https://classroom.google.com/${u}drive/folders/abc?${key}=${id}${frag}`,
      id,
    })),
);

/** Hosts that are NOT exactly the three recognized Google hosts. */
const FOREIGN_HOSTS = [
  'example.com',
  'evil.io',
  'drive.google.com.evil.io',
  'notgoogle.com',
  'docs-google.com',
  'googledrive.com.fake',
  'drive.gooogle.com',
  '192.168.1.1',
];

const arbForeignUrl = fc
  .record({
    host: fc.constantFrom(...FOREIGN_HOSTS),
    path: chars('abcdefghijklmnopqrstuvwxyz0123456789/', 1, 20),
    query: fc.constantFrom('', '?id=x', '?a=1&b=2'),
  })
  .map(({ host, path, query }) => `https://${host}/${path}${query}`);

const warmupOf = (inner: string) =>
  `https://drive.google.com/auth_warmup?continue=${encodeURIComponent(inner)}`;

// ── core mapping: recognized shapes ─────────────────────────────────────────

describe('core/acquire download-url — mapping properties', () => {
  it('U1: every recognized shape collapses to the endpoint with the exact id; authuser appended only when given', () => {
    fc.assert(
      fc.property(
        arbDriveShape,
        fc.option(fc.constantFrom('0', '1', '3', '9'), { nil: null }),
        ({ url, id }, authUser) => {
          const result = toDownloadUrlFrom(url, authUser);
          const parsed = new URL(result);
          expect(parsed.hostname).toBe('drive.usercontent.google.com');
          expect(parsed.pathname).toBe('/download');
          expect(parsed.searchParams.get('export')).toBe('download');
          expect(parsed.searchParams.get('confirm')).toBe('t');
          expect(parsed.searchParams.get('authuser')).toBe(authUser);
          // The mapping uses THE id the shape carried — not a re-derived one.
          expect(parsed.searchParams.get('id')).toBe(id);
          if (authUser === null) {
            // Exact collapse: no stray parameters survive the mapping.
            expect(extractDriveFileId(url)).toBe(id);
            expect(result).toBe(buildDriveDownloadUrlFrom(id));
            expect(result).toBe(
              `${DRIVE_DOWNLOAD_ENDPOINT}?id=${id}&export=download&confirm=t`,
            );
          }
        },
      ),
    );
  });

  it('U1: extractDriveFileId returns the exact id for every recognized shape', () => {
    fc.assert(
      fc.property(arbDriveShape, ({ url, id }) => {
        expect(extractDriveFileId(url)).toBe(id);
        expect(id).toMatch(/^[A-Za-z0-9]+$/);
        expect(toDownloadUrlFrom(url, null)).toBe(buildDriveDownloadUrlFrom(id));
      }),
    );
  });
});

// ── core mapping: the shape-extractor contract ──────────────────────────────

describe('core/acquire download-url — extractDriveFileId contract', () => {
  /** The contract, computed from the parsed URL alone (host-agnostic shapes). */
  function hasExtractableShape(raw: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return false;
    }
    const path = parsed.pathname.replace(/^\/u\/\d+(?=\/)/, '');
    if (/^\/file\/d\/[^/]+/.test(path)) return true;
    if (/^\/(?:document|presentation|drawings|spreadsheets)\/d\/[^/]+/.test(path)) return true;
    return ['id', 'resourceId', 'fileId'].some((key) => (parsed.searchParams.get(key) || '') !== '');
  }

  it('U2: non-null iff a file/docs path shape or a non-empty id/resourceId/fileId query param exists — on ANY host, for ANY input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          arbNoise,
          arbForeignUrl,
          arbDriveShape.map((shape) => shape.url),
          fc
            .record({
              scheme: fc.constantFrom('http://', 'ftp://', 'javascript:'),
              host: fc.constantFrom(...FOREIGN_HOSTS),
              rest: chars('/a0?=#&%.', 0, 16),
            })
            .map(({ scheme, host, rest }) => `${scheme}${host}/${rest}`),
        ),
        (raw) => {
          expect(extractDriveFileId(raw) !== null).toBe(hasExtractableShape(raw));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('U2: never throws on arbitrary junk; unparseable input is null, parseable input is null or a non-empty id', () => {
    fc.assert(
      fc.property(arbNoise, (noise) => {
        let parseable = true;
        try {
          new URL(noise);
        } catch {
          parseable = false;
        }
        const result = extractDriveFileId(noise);
        if (!parseable) {
          expect(result).toBeNull();
        } else {
          // A parseable URL may or may not carry an id — but never an empty one.
          if (result !== null) expect(result.length).toBeGreaterThan(0);
        }
      }),
    );
  });
});

// ── core mapping: passthrough + depth cap ───────────────────────────────────

describe('core/acquire download-url — passthrough and depth cap', () => {
  it('U3: unparseable input passes through untouched, even with an authuser', () => {
    fc.assert(
      fc.property(arbNoise, fc.option(fc.constantFrom('0', '2'), { nil: null }), (noise, authUser) => {
        let parseable = true;
        try {
          new URL(noise);
        } catch {
          parseable = false;
        }
        if (parseable || noise === '') return;
        expect(toDownloadUrlFrom(noise, authUser)).toBe(noise);
      }),
    );
  });

  it('U3: unrecognized URLs pass through with at most the authuser appended', () => {
    fc.assert(
      fc.property(arbForeignUrl, (url) => {
        expect(toDownloadUrlFrom(url, null)).toBe(url);
        const expected = (() => {
          const parsed = new URL(url);
          if (!parsed.searchParams.has('authuser')) parsed.searchParams.set('authuser', '3');
          return parsed.toString();
        })();
        expect(toDownloadUrlFrom(url, '3')).toBe(expected);
      }),
    );
    fc.assert(
      fc.property(
        arbForeignUrl.map((url) => (url.includes('?') ? `${url}&authuser=7` : `${url}?authuser=7`)),
        (url) => {
          // An existing authuser is never overwritten or duplicated.
          const expected = new URL(url).toString();
          expect(toDownloadUrlFrom(url, '3')).toBe(expected);
        },
      ),
    );
  });

  it('U3: the depth cap returns the original URL for depth > 3, for ANY input', () => {
    fc.assert(
      fc.property(arbNoise, fc.integer({ min: 4, max: 12 }), (noise, depth) => {
        expect(toDownloadUrlFrom(noise, null, depth)).toBe(noise);
      }),
    );
  });

  it('U4: warmup continue chains convert at depth ≤ 3 and return the inner URL raw at depth 4', () => {
    fc.assert(
      fc.property(
        arbId,
        fc.integer({ min: 0, max: 4 }),
        (id, levels) => {
          let inner = `https://drive.google.com/file/d/${id}`;
          for (let i = 0; i < levels; i++) inner = warmupOf(inner);
          const result = toDownloadUrlFrom(inner, null);
          if (levels <= 3) {
            expect(result).toBe(buildDriveDownloadUrlFrom(id));
          } else {
            // Depth 4: the innermost URL comes back unchanged.
            expect(result).toBe(`https://drive.google.com/file/d/${id}`);
          }
        },
      ),
    );
  });
});

// ── the security gate: validateDownloadUrl ──────────────────────────────────

/** Pinned copy of the validator's security set — drift must fail loudly. */
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'forms.google.com',
  'classroom.google.com',
  'drive.usercontent.google.com',
  'doc-00-00-docs.googleusercontent.com',
  'doc-0s-00-docs.googleusercontent.com',
  'lh3.googleusercontent.com',
]);
const ALLOWED_SUFFIXES = ['.google.com', '.googleusercontent.com', '.googleapis.com'];
const hostAllowed = (host: string) =>
  ALLOWED_HOSTS.has(host) || ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix));

describe('v2/decision download-validator — security properties', () => {
  it('S1: for ANY input, valid ⇒ https + allowlisted host + reason "OK" + trimmed url', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbNoise, arbForeignUrl, arbDriveShape.map((shape) => shape.url), arbValidatorPositive),
        (raw) => {
          const result = validateDownloadUrl(raw);
          if (!result.valid) return;
          const parsed = new URL(result.url);
          expect(parsed.protocol).toBe('https:');
          expect(hostAllowed(parsed.hostname.toLowerCase())).toBe(true);
          expect(result.reason).toBe('OK');
          expect(result.url).toBe(raw.trim());
          expect(result.host).toBe(parsed.hostname.toLowerCase());
          expect(result.url).not.toContain('%25');
          expect(result.url).not.toContain('..');
          expect(result.url).not.toContain('\x00');
        },
      ),
      { numRuns: 300 },
    );
  });

  it('S2: non-https and mixed-case HTTPS spellings are always rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('http://', 'ftp://', 'file://', 'javascript:', 'data:', 'HTTP://', 'HtTpS://'),
        fc.constantFrom(
          'drive.google.com/file/d/ABC123',
          'drive.usercontent.google.com/download?id=x',
          'docs.google.com/document/d/ABC/edit',
          'classroom.google.com/drive/folders/x?id=y',
        ),
        (scheme, rest) => {
          expect(validateDownloadUrl(`${scheme}${rest}`).valid).toBe(false);
        },
      ),
    );
  });

  it('S3: lookalike and attacker-controlled hosts are always rejected, whatever the path shape', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'evil.com',
          'drive.google.com.evil.io',
          'notgoogle.com',
          'googledrive.com.fake',
          'drive.gooogle.com',
          '192.168.1.1',
          'localhost',
          'docs-google.com',
          'google.com.attacker.io',
          'drive.google.com:8080',
        ),
        fc.constantFrom(
          'file/d/ABC123',
          'open?id=x',
          'uc?id=x',
          'drive/folders/x?id=y',
          'document/d/ABC/edit',
        ),
        (host, path) => {
          const result = validateDownloadUrl(`https://${host}/${path}`);
          expect(result.valid).toBe(false);
        },
      ),
    );
  });

  it('S4: double-encoding, traversal and NUL injections are rejected even with a valid shape', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('..%2Fx', 'a%252Fb', 'a%2F..%2Fb'),
        (payload) => {
          expect(validateDownloadUrl(`https://drive.google.com/file/d/${payload}`).valid).toBe(false);
          expect(validateDownloadUrl(`https://drive.google.com/uc?id=${payload}`).valid).toBe(false);
        },
      ),
    );
  });

  it('S5: every allowlisted shape with a clean id is accepted', () => {
    fc.assert(
      fc.property(arbValidatorPositive, (url) => {
        const result = validateDownloadUrl(url);
        expect(result.valid).toBe(true);
        expect(result.reason).toBe('OK');
      }),
    );
  });

  it('S6: filterValidDownloadUrls keeps exactly the valid entries, in order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(arbValidatorPositive, arbForeignUrl, arbNoise), { maxLength: 8 }),
        (urls) => {
          const kept = filterValidDownloadUrls(urls);
          const expectedIndexes = urls
            .map((url, index) => ({ url, index }))
            .filter(({ url }) => validateDownloadUrl(url).valid)
            .map(({ index }) => index);
          expect(kept.map((entry) => entry.index)).toEqual(expectedIndexes);
          expect(kept.every((entry) => entry.result.valid)).toBe(true);
        },
      ),
    );
  });
});

/**
 * Positive shapes for the validator: hosts from the allowlist (explicit or by
 * suffix), paths matching the expected patterns, ids clean of %25/../\0.
 */
const arbValidatorPositive: fc.Arbitrary<string> = fc.oneof(
  fc
    .record({ id: arbId, tail: fc.constantFrom('', '/view') })
    .map(({ id, tail }) => `https://drive.google.com/file/d/${id}${tail}`),
  fc
    .record({ id: arbId, which: fc.constantFrom('open', 'uc') })
    .map(({ id, which }) => `https://drive.google.com/${which}?id=${id}`),
  arbId.map((id) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`),
  fc
    .record({
      u: fc.constantFrom('', 'u/1/'),
      kind: fc.constantFrom('document', 'presentation', 'drawings', 'spreadsheets'),
      id: arbId,
    })
    .map(({ u, kind, id }) => `https://docs.google.com/${u}${kind}/d/${id}/edit`),
  fc
    .record({ u: fc.constantFrom('', 'u/0/'), id: arbId })
    .map(({ u, id }) => `https://classroom.google.com/${u}drive/folders/x?id=${id}`),
  fc
    .record({ a: chars('0123456789abcdef', 1, 4), b: chars('0123456789abcdef', 1, 4) })
    .map(({ a, b }) => `https://doc-${a}-${b}-docs.googleusercontent.com/docs/sec?id=z1`),
  arbId.map((id) => `https://lh3.googleusercontent.com/d/file/d/${id}`),
  fc
    .record({ sub: chars('abcdefghijklmnopqrstuvwxyz0123456789', 1, 6), id: arbId })
    .map(({ sub, id }) => `https://${sub}.google.com/x/file/d/${id}`),
);
