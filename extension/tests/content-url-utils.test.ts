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

    const sheetsAnchor = document.createElement('a');
    sheetsAnchor.href = 'https://docs.google.com/spreadsheets/d/163qjQTcw2skYB8oWJ4FgfwdOvGP9jGUhUSdEYlccrts/edit?gid=0#gid=0';
    // #546: Sheets attachments are downloadable through their Drive file ID —
    // excluding them left assignment detail pages without Download All.
    expect(extractDriveUrlFromAnchor(sheetsAnchor)).toContain('docs.google.com');

    const formsAnchor = document.createElement('a');
    formsAnchor.href = 'https://docs.google.com/forms/d/e/1FAIpQLSdZBCCxLrM0oZiJF2QEFBR4RdhBj_byOSGFBD5rs74U8XaAWw/viewform?usp=dialog';
    expect(extractDriveUrlFromAnchor(formsAnchor)).toBeNull();

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
    expect(url).toContain('drive.usercontent.google.com/download?id=file-123');
    expect(url).toContain('confirm=t');
  });

  it('converts different drive/classroom urls into direct download form', () => {
    setLocation('/c/class1?authuser=2');
    expect(toDownloadUrl('https://drive.google.com/file/d/abc/view')).toContain('drive.usercontent.google.com/download?id=abc');

    const open = toDownloadUrl('https://drive.google.com/open?id=xyz');
    expect(open).toContain('drive.usercontent.google.com/download?id=xyz');
    expect(open).toContain('export=download');
    expect(open).toContain('confirm=t');
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

  it('converts /u/N drive and docs URLs into direct download form', () => {
    setLocation('/u/1/w/class1/t/all');

    const driveUrl = toDownloadUrl('https://drive.google.com/u/1/file/d/abc/view');
    expect(driveUrl).toContain('drive.usercontent.google.com/download?id=abc');
    expect(driveUrl).toContain('authuser=1');

    const docsUrl = toDownloadUrl('https://docs.google.com/u/1/document/d/xyz/edit');
    expect(docsUrl).toContain('drive.usercontent.google.com/download?id=xyz');
    expect(docsUrl).toContain('authuser=1');

    const classroomDrive = toDownloadUrl('https://classroom.google.com/u/1/drive?resourceId=class456');
    expect(classroomDrive).toContain('id=class456');
    expect(classroomDrive).toContain('authuser=1');
  });

  it('returns original url on invalid inputs or excessive recursion depth', () => {
    expect(toDownloadUrl('https://example.com/file.pdf')).toContain('https://example.com/file.pdf');
    expect(toDownloadUrl('not-a-url')).toBe('not-a-url');
    expect(toDownloadUrl('https://drive.google.com/open?id=abc', 4)).toBe('https://drive.google.com/open?id=abc');
    expect(toDownloadUrl('https://docs.google.com/spreadsheets/d/1BigjQBFGGYLQr3N1i6mlLX7SDFIx1FuwvVb-8NU62Fs/edit?usp=sharing'))
      .toContain('drive.usercontent.google.com/download?id=1BigjQBFGGYLQr3N1i6mlLX7SDFIx1FuwvVb-8NU62Fs');
    expect(toDownloadUrl('https://docs.google.com/forms/d/1M3u5g0b2T4p_XIW28TODxnfknP4CAzHqmwjVkl5GljI/viewform'))
      .toBe('https://docs.google.com/forms/d/1M3u5g0b2T4p_XIW28TODxnfknP4CAzHqmwjVkl5GljI/viewform?authuser=1');
  });

  it('emits the drive.usercontent.google.com byte-serving endpoint (#manual-403 regression)', () => {
    // The legacy uc?export=download endpoint 302s into interstitial/error
    // pages (the visible "403 Access Forbidden" tab). The byte-serving
    // usercontent endpoint is where the interstitial's own "Download anyway"
    // link lands — going straight there needs no tab and no click.
    setLocation('/c/class1?authuser=2');
    const file = toDownloadUrl('https://drive.google.com/file/d/abc/view');
    expect(file).toContain('https://drive.usercontent.google.com/download');
    expect(file).toContain('id=abc');
    expect(file).toContain('export=download');
    expect(file).toContain('confirm=t');
    expect(file).toContain('authuser=2');
    expect(file).not.toContain('drive.google.com');

    expect(toDownloadUrl('https://drive.google.com/open?id=xyz'))
      .toContain('drive.usercontent.google.com/download?id=xyz');
    expect(toDownloadUrl('https://drive.google.com/uc?export=download&id=uc1'))
      .toContain('drive.usercontent.google.com/download?id=uc1');
    expect(toDownloadUrl('https://classroom.google.com/drive?resourceId=class123'))
      .toContain('drive.usercontent.google.com/download?id=class123');
    expect(toDownloadUrl('https://docs.google.com/spreadsheets/d/sheet1/edit'))
      .toContain('drive.usercontent.google.com/download?id=sheet1');

    const warmup = toDownloadUrl(
      'https://drive.google.com/auth_warmup?continue=https%3A%2F%2Fdrive.google.com%2Ffile%2Fd%2Fid123%2Fview',
    );
    expect(warmup).toContain('drive.usercontent.google.com/download?id=id123');
  });

  it('passes non-drive urls through untouched', () => {
    setLocation('/c/class1');
    expect(toDownloadUrl('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
  });
});
