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
    expect(result.baseUrl.includes('drive.usercontent.google.com/download')).toBe(true);
    expect(result.baseUrl.includes('export=download')).toBe(true);
    expect(result.baseUrl.includes('confirm=t')).toBe(true);
  });

  it('keeps export values when already normalized to the usercontent endpoint', () => {
    const input = 'https://drive.usercontent.google.com/download?id=abc123&export=download&confirm=t';
    const result = normalizeUrl(input);
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl.includes('drive.usercontent.google.com/download')).toBe(true);
    expect(result.baseUrl.includes('export=download')).toBe(true);
  });

  it('normalizes Google Drive /u/N paths before download', () => {
    const input = 'https://drive.google.com/u/1/file/d/abc123/view?authuser=1';
    const result = normalizeUrl(input);
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl).toContain('drive.usercontent.google.com/download');
    expect(result.baseUrl).toContain('id=abc123');
    expect(result.baseUrl).not.toContain('/u/1/');
    expect(result.baseUrl).not.toContain('authuser=');
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

  it('normalizes drive urls to the usercontent byte-serving endpoint (#manual-403 regression)', () => {
    const result = normalizeUrl('https://drive.google.com/file/d/abc123/view');
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl).toContain('https://drive.usercontent.google.com/download');
    expect(result.baseUrl).toContain('id=abc123');
    expect(result.baseUrl).toContain('export=download');
    expect(result.baseUrl).toContain('confirm=t');
    expect(result.baseUrl).not.toContain('authuser=');
  });

  it('is idempotent for already-usercontent urls', () => {
    const input = 'https://drive.usercontent.google.com/download?id=abc123&export=download&confirm=t';
    const result = normalizeUrl(input);
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl).toBe(input);
  });

  it('rewrites legacy uc download urls to the usercontent endpoint', () => {
    const result = normalizeUrl('https://drive.google.com/uc?export=download&id=abc123&authuser=2');
    expect(result.isDrive).toBe(true);
    expect(result.baseUrl).toContain('drive.usercontent.google.com/download');
    expect(result.baseUrl).toContain('id=abc123');
    expect(result.baseUrl).not.toContain('authuser=');
  });
});
