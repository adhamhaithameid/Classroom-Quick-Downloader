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
