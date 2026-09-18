// filepath: extension/tests/core-download-url.test.ts
/**
 * z57 STAGE 1 — the pure download-URL mapping (core/acquire/download-url).
 *
 * Mirrors the V1 url-utils.ts outcome cases; the authuser is a parameter so
 * the module stays core-pure. These tests pin the contract both the v2 click
 * path and the discovery conversion rely on.
 */
import { describe, expect, it } from 'vitest';
import {
  toDownloadUrlFrom,
  extractDriveFileId,
  buildDriveDownloadUrlFrom,
} from '../src/core/acquire/download-url';

const AUTH = '1';

describe('core download-url mapping', () => {
  it('converts drive /file/d/ URLs to the byte-serving endpoint', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/file/d/ABC123/view?usp=classroom_web', null)).toBe(
      buildDriveDownloadUrlFrom('ABC123'),
    );
  });

  it('appends the page authuser to the converted URL', () => {
    const out = toDownloadUrlFrom('https://drive.google.com/file/d/ABC123/view', AUTH);
    expect(out).toContain('drive.usercontent.google.com/download');
    expect(out).toContain('id=ABC123');
    expect(out).toContain('authuser=1');
  });

  it('leaves URLs without an authuser untouched by auth params', () => {
    const out = toDownloadUrlFrom('https://drive.google.com/file/d/ABC123/view', null);
    expect(out).toBe(buildDriveDownloadUrlFrom('ABC123'));
  });

  it('keeps an existing authuser param (append-only, V1 parity)', () => {
    const out = toDownloadUrlFrom('https://drive.google.com/file/d/ABC123/view', '2');
    expect(out).toContain('authuser=2');
    expect(out).toContain('id=ABC123');
  });

  it('converts drive /open and /uc links via their id param', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/open?id=XYZ', null)).toBe(
      buildDriveDownloadUrlFrom('XYZ'),
    );
    expect(toDownloadUrlFrom('https://drive.google.com/uc?id=XYZ&export=download', null)).toContain('id=XYZ');
  });

  it('follows auth_warmup continue chains (depth-capped)', () => {
    const out = toDownloadUrlFrom(
      'https://drive.google.com/auth_warmup?continue=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2FWARM%2Fview',
      null,
    );
    expect(out).toBe(buildDriveDownloadUrlFrom('WARM'));
  });

  it('converts classroom drive-proxy links via id/resourceId/fileId', () => {
    expect(
      toDownloadUrlFrom('https://classroom.google.com/drive/abc?resourceId=RES', null),
    ).toBe(buildDriveDownloadUrlFrom('RES'));
  });

  it('converts docs/sheets/slides/drawings viewer URLs (z57 S2 parity with V1)', () => {
    expect(toDownloadUrlFrom('https://docs.google.com/document/d/DOCID/edit', null)).toBe(
      buildDriveDownloadUrlFrom('DOCID'),
    );
    expect(toDownloadUrlFrom('https://docs.google.com/spreadsheets/d/SHID/edit#gid=0', null)).toBe(
      buildDriveDownloadUrlFrom('SHID'),
    );
    expect(toDownloadUrlFrom('https://docs.google.com/presentation/d/PRES/edit', null)).toBe(
      buildDriveDownloadUrlFrom('PRES'),
    );
    expect(toDownloadUrlFrom('https://docs.google.com/drawings/d/DRAW/edit', null)).toBe(
      buildDriveDownloadUrlFrom('DRAW'),
    );
  });

  it('strips a /u/{n} multi-account path prefix before matching', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/u/1/file/d/PRE1/view', null)).toBe(
      buildDriveDownloadUrlFrom('PRE1'),
    );
  });

  it('passes unrecognized URLs through unchanged (authuser appended)', () => {
    expect(toDownloadUrlFrom('https://example.com/file.pdf', AUTH)).toBe(
      'https://example.com/file.pdf?authuser=1',
    );
    expect(toDownloadUrlFrom('https://docs.google.com/forms/d/FORMID/viewform', null)).toBe(
      'https://docs.google.com/forms/d/FORMID/viewform',
    );
  });

  it('returns garbage input as-is', () => {
    expect(toDownloadUrlFrom('', null)).toBe('');
    expect(toDownloadUrlFrom('not a url', null)).toBe('not a url');
  });

  it('extractDriveFileId finds ids from every supported shape', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/ID1/view')).toBe('ID1');
    expect(extractDriveFileId('https://docs.google.com/document/d/ID2/edit')).toBe('ID2');
    expect(extractDriveFileId('https://drive.google.com/open?id=ID3')).toBe('ID3');
    expect(extractDriveFileId('https://classroom.google.com/drive/x?resourceId=ID4')).toBe('ID4');
    expect(extractDriveFileId('https://example.com/nothing')).toBe('https://example.com/nothing'.slice(0, 0) || null);
  });
});

// ============================================================================
// MUTATION HARDENING (S12) — anchors, param precedence, depth cap, append-only
// authuser. Each test pins one branch boundary the corpus used to cover.
// ============================================================================

describe('core download-url mapping — mutation hardening (S12)', () => {
  it('strips a multi-digit /u/{n} prefix', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/u/12/file/d/PRE12/view', null)).toBe(
      buildDriveDownloadUrlFrom('PRE12'),
    );
    expect(extractDriveFileId('https://drive.google.com/u/12/file/d/PRE12/view')).toBe('PRE12');
  });

  it('does not strip a mid-path /u/{n}-like segment (anchored match only)', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/x/u/1/file/d/NOPE/view', null)).toBe(
      'https://drive.google.com/x/u/1/file/d/NOPE/view',
    );
    expect(extractDriveFileId('https://example.com/x/file/d/NOPE')).toBeNull();
  });

  it('extractDriveFileId reads a bare fileId param', () => {
    expect(extractDriveFileId('https://classroom.google.com/drive/x?fileId=FID3')).toBe('FID3');
  });

  it('appendAuth never duplicates or overrides an existing authuser', () => {
    expect(toDownloadUrlFrom('https://example.com/a?authuser=3', '1')).toBe(
      'https://example.com/a?authuser=3',
    );
    const converted = toDownloadUrlFrom('https://drive.google.com/file/d/A1/view?authuser=3', '1');
    expect(converted).toContain('id=A1');
    expect(converted).toContain('authuser=1');
  });

  it('auth_warmup prefers its continue target over an id param', () => {
    const inner = 'https://drive.google.com/open?id=REAL9';
    expect(
      toDownloadUrlFrom(`https://drive.google.com/auth_warmup?continue=${encodeURIComponent(inner)}&id=FAKE1`, null),
    ).toBe(buildDriveDownloadUrlFrom('REAL9'));
  });

  it('caps continue-chain depth: the fourth hop is returned raw, unconverted', () => {
    const url3 = 'https://drive.google.com/file/d/TAIL/view';
    // Build a 3-warmup chain into a file URL:
    const one = `https://drive.google.com/auth_warmup?continue=${encodeURIComponent(url3)}`;
    const two = `https://drive.google.com/auth_warmup?continue=${encodeURIComponent(one)}`;
    const three = `https://drive.google.com/auth_warmup?continue=${encodeURIComponent(two)}`;
    const four = `https://drive.google.com/auth_warmup?continue=${encodeURIComponent(three)}`;

    // depth 0 → 1 → 2 → 3 (warmup) → 4 (file): the file URL is entered at
    // depth 4 > 3, so it is returned verbatim, NOT converted.
    expect(toDownloadUrlFrom(four, null)).toBe(url3);

    // Three warmups still convert the inner file URL (cap not yet hit).
    expect(toDownloadUrlFrom(three, null)).toBe(buildDriveDownloadUrlFrom('TAIL'));
  });

  it('does not convert file paths on foreign hosts', () => {
    expect(toDownloadUrlFrom('https://example.com/file/d/X/view', null)).toBe(
      'https://example.com/file/d/X/view',
    );
    expect(toDownloadUrlFrom('https://evil.example.com/document/d/Y/edit', null)).toBe(
      'https://evil.example.com/document/d/Y/edit',
    );
  });

  it('drive /open and /uc without an id pass through with only the authuser appended', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/open', '2')).toBe(
      'https://drive.google.com/open?authuser=2',
    );
    expect(toDownloadUrlFrom('https://drive.google.com/uc', '2')).toBe(
      'https://drive.google.com/uc?authuser=2',
    );
  });

  it('classroom drive-proxy id params win in id → resourceId → fileId order', () => {
    expect(
      toDownloadUrlFrom('https://classroom.google.com/drive/p?fileId=ONLYFILE', null),
    ).toBe(buildDriveDownloadUrlFrom('ONLYFILE'));
    expect(
      toDownloadUrlFrom('https://classroom.google.com/drive/p?id=I1&fileId=F1', null),
    ).toBe(buildDriveDownloadUrlFrom('I1'));
    expect(
      toDownloadUrlFrom('https://classroom.google.com/drive/p?resourceId=R1&fileId=F1', null),
    ).toBe(buildDriveDownloadUrlFrom('R1'));
  });

  it('warmup without continue or id passes through with the authuser appended', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/auth_warmup', '1')).toBe(
      'https://drive.google.com/auth_warmup?authuser=1',
    );
  });

  it('warmup with an id (no continue) converts via the id param (S12)', () => {
    expect(toDownloadUrlFrom('https://drive.google.com/auth_warmup?id=WARM1', null)).toBe(
      buildDriveDownloadUrlFrom('WARM1'),
    );
  });

  it('foreign URLs carrying an id param are never classroom-converted (S12)', () => {
    expect(toDownloadUrlFrom('https://example.com/?id=Q9', null)).toBe('https://example.com/?id=Q9');
    expect(toDownloadUrlFrom('https://docs.google.com/drive/x?id=Q9', null)).toBe(
      'https://docs.google.com/drive/x?id=Q9',
    );
    expect(toDownloadUrlFrom('https://drive.google.com/other?id=Y7', null)).toBe(
      'https://drive.google.com/other?id=Y7',
    );
  });
});
