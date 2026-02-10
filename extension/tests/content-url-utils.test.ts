import { describe, expect, it } from 'vitest';
import {
  extractDriveUrlFromAnchor,
  findDriveUrl,
  getAuthUser,
  toDownloadUrl,
} from '../entrypoints/content/url-utils';

function setLocation(pathAndQuery: string) {
  window.history.pushState({}, '', pathAndQuery);
}

describe('content url utils', () => {
  it('extracts authuser from query and path patterns', () => {
    setLocation('/u/7/h');
    expect(getAuthUser()).toBe('7');
    setLocation('/c/class1?authuser=3');
    expect(getAuthUser()).toBe('3');
    setLocation('/c/class1?u=4');
    expect(getAuthUser()).toBe('4');
    setLocation('/c/class1');
    expect(getAuthUser()).toBeNull();
  });

  it('extracts drive urls from anchor and from container', () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://drive.google.com/file/d/abc/view';
    expect(extractDriveUrlFromAnchor(anchor)).toContain('drive.google.com');

    const nonDrive = document.createElement('a');
    nonDrive.href = 'https://example.com';
    expect(extractDriveUrlFromAnchor(nonDrive)).toBeNull();

    const container = document.createElement('div');
    container.append(anchor);
    expect(findDriveUrl(container)).toContain('drive.google.com/file/d/abc');
  });

  it('builds fallback drive url from element attributes', () => {
    const container = document.createElement('div');
    container.setAttribute('data-drive-id', 'file-123');
    const url = findDriveUrl(container);
    expect(url).toContain('drive.google.com/uc?export=download&id=file-123');
  });

  it('converts different drive/classroom urls into direct download form', () => {
    setLocation('/c/class1?authuser=2');
    expect(toDownloadUrl('https://drive.google.com/file/d/abc/view')).toContain('uc?export=download&id=abc');

    const open = toDownloadUrl('https://drive.google.com/open?id=xyz');
    expect(open).toContain('export=download');
    expect(open).toContain('authuser=2');

    const warmupContinue = toDownloadUrl(
      'https://drive.google.com/auth_warmup?continue=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2Fid123%2Fview',
    );
    expect(warmupContinue).toContain('id=id123');

    const warmupId = toDownloadUrl('https://drive.google.com/auth_warmup?id=warm123');
    expect(warmupId).toContain('id=warm123');

    const classroomDrive = toDownloadUrl('https://classroom.google.com/drive?resourceId=class123');
    expect(classroomDrive).toContain('id=class123');
  });

  it('returns original url on invalid inputs or excessive recursion depth', () => {
    expect(toDownloadUrl('https://example.com/file.pdf')).toContain('https://example.com/file.pdf');
    expect(toDownloadUrl('not-a-url')).toBe('not-a-url');
    expect(toDownloadUrl('https://drive.google.com/open?id=abc', 4)).toBe('https://drive.google.com/open?id=abc');
  });
});
