import { describe, expect, it } from 'vitest';
import { extractAuthUserFromUrl, extractDriveFileId } from '../entrypoints/background/auth-utils';

describe('background auth utils', () => {
  it('extracts authuser from query parameters and path forms', () => {
    expect(extractAuthUserFromUrl('https://drive.google.com/open?id=abc&authuser=2')).toBe(2);
    expect(extractAuthUserFromUrl('https://classroom.google.com/u/3/h')).toBe(3);
    expect(extractAuthUserFromUrl('https://classroom.google.com/c/abc?u=4')).toBe(4);
  });

  it('returns undefined for invalid auth values', () => {
    expect(extractAuthUserFromUrl('https://drive.google.com/open?id=abc&authuser=25')).toBeUndefined();
    expect(extractAuthUserFromUrl('https://drive.google.com/open?id=abc&authuser=NaN')).toBeUndefined();
    expect(extractAuthUserFromUrl('not a url')).toBeUndefined();
  });

  it('extracts drive file id from known URL formats', () => {
    expect(extractDriveFileId('https://drive.google.com/open?id=file123')).toBe('file123');
    expect(extractDriveFileId('https://drive.google.com/file/d/fileABC/view')).toBe('fileABC');
    expect(extractDriveFileId('https://drive.google.com/d/fileXYZ/edit')).toBe('fileXYZ');
  });

  it('returns null for missing or invalid drive file id', () => {
    expect(extractDriveFileId('')).toBeNull();
    expect(extractDriveFileId('https://example.com/file')).toBeNull();
    expect(extractDriveFileId('bad:// url')).toBeNull();
  });
});

