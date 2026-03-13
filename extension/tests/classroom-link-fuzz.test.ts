import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractDriveUrlFromAnchor, toDownloadUrl } from '../entrypoints/content/url-utils';
import { validateDownloadUrl } from '../src/v2/decision/download-validator';

function makeAnchor(href: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  return anchor;
}

describe('classroom link fuzz matrix', () => {
  beforeEach(() => {
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/fixture'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    'https://drive.google.com/file/d/FILE123/view?usp=sharing',
    'https://drive.google.com/u/1/file/d/FILE456/view?usp=sharing',
    'https://docs.google.com/document/d/DOC123/edit?usp=sharing',
    'https://docs.google.com/presentation/d/SLIDE123/edit?usp=sharing',
    'https://docs.google.com/drawings/d/DRAW123/edit?usp=sharing'
  ])('keeps supported classroom-adjacent URLs discoverable: %s', (href) => {
    expect(extractDriveUrlFromAnchor(makeAnchor(href))).toBe(href);
  });

  it.each([
    'https://docs.google.com/forms/d/e/FORM123/viewform?usp=dialog',
    'https://docs.google.com/forms/d/FORM456/viewform',
    'https://docs.google.com/spreadsheets/d/SHEET123/edit?usp=sharing',
    'https://docs.google.com/spreadsheets/d/SHEET456/edit?gid=0#gid=0',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://example.com/resource.pdf',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>'
  ])('rejects unsupported or hostile links before button injection: %s', (href) => {
    expect(extractDriveUrlFromAnchor(makeAnchor(href))).toBeNull();
  });

  it('normalizes viewer variants to direct download URLs', () => {
    expect(
      toDownloadUrl('https://drive.google.com/file/d/FILE123/view?usp=sharing')
    ).toBe('https://drive.google.com/uc?export=download&id=FILE123');

    expect(
      toDownloadUrl('https://drive.google.com/u/1/file/d/FILE456/view?usp=sharing')
    ).toBe('https://drive.google.com/uc?export=download&id=FILE456');

    expect(
      toDownloadUrl('https://docs.google.com/document/d/DOC123/edit?usp=sharing')
    ).toBe('https://drive.google.com/uc?export=download&id=DOC123');

    expect(
      toDownloadUrl('https://docs.google.com/u/1/presentation/d/SLIDE123/edit?usp=sharing')
    ).toBe('https://drive.google.com/uc?export=download&id=SLIDE123');

    expect(
      toDownloadUrl('https://classroom.google.com/u/1/drive?resourceId=FILE999')
    ).toBe('https://drive.google.com/uc?export=download&id=FILE999');
  });

  it.each([
    'https://classroom.google.com/drive?id=FILE789',
    'https://classroom.google.com/u/1/drive?resourceId=FILE999',
    'https://docs.google.com/u/2/presentation/d/SLIDE123/edit?usp=sharing'
  ])('normalizes supported non-anchor shapes even if direct extraction is not the owning path: %s', (href) => {
    const normalized = toDownloadUrl(href);
    expect(validateDownloadUrl(normalized).valid).toBe(true);
  });

  it('accepts a fuzz matrix of known-good download targets', () => {
    const slots = ['0', '1', '2'];
    const ids = ['FILE123', 'FILE456', 'FILE789'];

    const urls = slots.flatMap((slot, index) => [
      `https://drive.google.com/u/${slot}/file/d/${ids[index]}/view?usp=sharing`,
      `https://docs.google.com/u/${slot}/document/d/${ids[index]}/edit?usp=sharing`,
      `https://docs.google.com/u/${slot}/presentation/d/${ids[index]}/edit?usp=sharing`,
      `https://docs.google.com/u/${slot}/drawings/d/${ids[index]}/edit?usp=sharing`,
      `https://classroom.google.com/u/${slot}/drive?id=${ids[index]}`
    ]);

    for (const url of urls) {
      const normalized = toDownloadUrl(url);
      const validation = validateDownloadUrl(normalized);
      expect(validation.valid, `${url} -> ${normalized} should be valid`).toBe(true);
    }
  });

  it('rejects malformed, non-https, and suspiciously encoded targets', () => {
    const hostileUrls = [
      'http://drive.google.com/file/d/FILE123/view',
      'ftp://drive.google.com/file/d/FILE123/view',
      'https://evil.example.com/file/d/FILE123/view',
      'https://drive.google.com/file/d/FILE123/view?redirect=%252F%252Fevil.example.com',
      'https://drive.google.com/../../etc/passwd'
    ];

    for (const url of hostileUrls) {
      expect(validateDownloadUrl(url).valid, `${url} should be rejected`).toBe(false);
    }
  });
});
