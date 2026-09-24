import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toDownloadUrl } from '../entrypoints/content/url-utils';
import { buildDriveDownloadUrl, DRIVE_DOWNLOAD_ENDPOINT } from '../src/shared/drive-endpoint';
import { TRANSLATIONS } from '../entrypoints/content/i18n';

/**
 * Download language purity: whatever language the Classroom page renders in,
 * a download must fetch the ORIGINAL file bytes under the ORIGINAL file name.
 * These tests pin the two invariants that guarantee it:
 *
 *   1. URL purity — the download URL pipeline never routes through a
 *      translation proxy and never appends locale parameters (`hl`, `tl`);
 *      Drive targets always land on the byte-serving endpoint.
 *   2. Name purity — file names are derived from the page's own attachment
 *      metadata (tooltip/ARIA/text/URL), never from the extension's
 *      translation table, so a translated UI can never rename a download.
 */

function setLocation(pathAndQuery: string) {
  window.history.pushState({}, '', pathAndQuery);
}

describe('URL purity: downloads fetch original bytes, unlocalized', () => {
  it('the Drive endpoint is the byte-serving host, not a translate proxy', () => {
    expect(DRIVE_DOWNLOAD_ENDPOINT).toBe('https://drive.usercontent.google.com/download');
    expect(DRIVE_DOWNLOAD_ENDPOINT).not.toContain('translate');
  });

  it('built download URLs carry no locale parameters', () => {
    const url = new URL(buildDriveDownloadUrl('FILE123'));
    expect(url.hostname).toBe('drive.usercontent.google.com');
    expect(url.searchParams.get('id')).toBe('FILE123');
    for (const localeParam of ['hl', 'tl', 'sl', 'lang']) {
      expect(url.searchParams.has(localeParam)).toBe(false);
    }
  });

  it('every Drive URL shape converts to the byte endpoint with locale params intact-only-never-added', () => {
    setLocation('/u/2/c/ABC123/');
    const cases = [
      'https://drive.google.com/file/d/att-111/view',
      'https://drive.google.com/open?id=att-222',
      'https://classroom.google.com/drive?resourceId=att-333',
      'https://docs.google.com/document/d/doc-444/edit',
    ];
    for (const c of cases) {
      const out = new URL(toDownloadUrl(c));
      expect(out.hostname).toBe('drive.usercontent.google.com');
      expect(out.searchParams.get('confirm')).toBe('t');
      expect(out.searchParams.has('hl')).toBe(false);
      expect(out.searchParams.has('tl')).toBe(false);
    }
  });

  it('already-localized source URLs never gain translation parameters on passthrough', () => {
    setLocation('/c/class1');
    const passthrough = toDownloadUrl('https://example.com/files/report.pdf?hl=de');
    expect(passthrough).toBe('https://example.com/files/report.pdf?hl=de');
    const sourceLocalized = toDownloadUrl('https://example.com/files/report.pdf');
    expect(sourceLocalized).not.toContain('translate');
    expect(new URL(sourceLocalized).searchParams.has('hl')).toBe(false);
  });
});

describe('name purity: file names never come from the translation table', () => {
  const fileMetaSource = readFileSync(
    resolve(process.cwd(), 'entrypoints/content/file-meta.ts'),
    'utf8',
  );

  it('file-meta.ts does not import or call the i18n table', () => {
    expect(fileMetaSource).not.toMatch(/i18n/);
    expect(fileMetaSource).not.toMatch(/\bt\s*\(/);
  });

  it('download URL construction modules do not localize anything', () => {
    const urlUtils = readFileSync(resolve(process.cwd(), 'entrypoints/content/url-utils.ts'), 'utf8');
    const endpoint = readFileSync(resolve(process.cwd(), 'src/shared/drive-endpoint.ts'), 'utf8');
    expect(urlUtils).not.toMatch(/\bt\s*\(/);
    expect(urlUtils).not.toMatch(/i18n/);
    expect(endpoint).not.toMatch(/i18n/);
  });

  it('the translation table holds no filename-shaped keys', () => {
    // Guard against someone adding e.g. a localized "file" suffix used in
    // naming: naming stays DOM/URL-derived, full stop.
    for (const key of Object.keys(TRANSLATIONS.en)) {
      expect(key.toLowerCase()).not.toContain('suffix');
      expect(key.toLowerCase()).not.toContain('rename');
    }
  });
});
