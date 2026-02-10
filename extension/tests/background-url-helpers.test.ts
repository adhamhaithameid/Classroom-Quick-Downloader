import { describe, expect, it } from 'vitest';
import {
  buildUrlWithAuthUser,
  getFilenameExt,
  normalizeUrl,
} from '../entrypoints/background/url-helpers';

describe('background url helpers', () => {
  it('normalizes Google Drive URLs by removing authuser and forcing export download', () => {
    const input = 'https://drive.google.com/open?id=abc123&authuser=2';
    const result = normalizeUrl(input);
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl.includes('authuser=')).toBe(false);
    expect(result.baseUrl.includes('/uc')).toBe(true);
    expect(result.baseUrl.includes('export=download')).toBe(true);
  });

  it('keeps existing drive path/export values when already normalized', () => {
    const input = 'https://drive.google.com/uc?id=abc123&export=download';
    const result = normalizeUrl(input);
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl.includes('/uc')).toBe(true);
    expect(result.baseUrl.includes('export=download')).toBe(true);
  });

  it('returns non-drive URLs untouched', () => {
    const input = 'https://classroom.google.com/u/0/h';
    const result = normalizeUrl(input);
    expect(result.isDrive).toBe(false);
    expect(result.baseUrl).toBe(input);
  });

  it('handles invalid URL values safely', () => {
    const input = 'not-a-url';
    const result = normalizeUrl(input);
    expect(result).toEqual({ baseUrl: input, isDrive: false });
  });

  it('builds authuser URL for valid URLs', () => {
    const input = 'https://drive.google.com/uc?id=abc123';
    const result = buildUrlWithAuthUser(input, 7);
    expect(result.includes('authuser=7')).toBe(true);
  });

  it('returns original string if URL parsing fails', () => {
    expect(buildUrlWithAuthUser('bad:// url', 3)).toBe('bad:// url');
  });

  it('extracts and normalizes filename extension', () => {
    expect(getFilenameExt('report.PDF')).toBe('pdf');
    expect(getFilenameExt('archive.tar.gz')).toBe('gz');
    expect(getFilenameExt('filename-without-ext')).toBeUndefined();
    expect(getFilenameExt(undefined)).toBeUndefined();
  });
});
