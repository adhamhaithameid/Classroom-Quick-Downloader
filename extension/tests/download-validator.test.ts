import { describe, expect, it } from 'vitest';
import {
  validateDownloadUrl,
  filterValidDownloadUrls,
} from '../src/v2/decision/download-validator';

/**
 * DOWNLOAD VALIDATOR — Test Suite
 *
 * Validates the security gate for download URLs.
 * Tests cover: scheme validation, host allowlist, URL shape matching,
 * encoding attacks, and batch filtering.
 */

describe('download-validator', () => {
  // ========================================================================
  // Valid URLs
  // ========================================================================

  describe('valid URLs', () => {
    it('accepts Drive file/d/ URLs', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/file/d/1abc123def/view',
      );
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('OK');
    });

    it('accepts Drive /u/N file URLs', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/u/1/file/d/1abc123def/view',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Drive open? URLs', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/open?id=1abc123def',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Drive uc? export URLs', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/uc?export=download&id=1abc123def',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Docs export URLs', () => {
      const result = validateDownloadUrl(
        'https://docs.google.com/document/d/1abc123def/export?format=pdf',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Docs /u/N export URLs', () => {
      const result = validateDownloadUrl(
        'https://docs.google.com/u/1/document/d/1abc123def/export?format=pdf',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Slides export URLs', () => {
      const result = validateDownloadUrl(
        'https://docs.google.com/presentation/d/1abc123def/export/pptx',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Classroom drive proxy URLs', () => {
      const result = validateDownloadUrl(
        'https://classroom.google.com/drive/file/abc123/view',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Classroom /u/N drive proxy URLs', () => {
      const result = validateDownloadUrl(
        'https://classroom.google.com/u/1/drive/file/abc123/view',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts Drive usercontent URLs', () => {
      const result = validateDownloadUrl(
        'https://drive.usercontent.google.com/download?id=1abc&authuser=0',
      );
      expect(result.valid).toBe(true);
    });

    it('trims whitespace from URLs', () => {
      const result = validateDownloadUrl(
        '  https://drive.google.com/file/d/1abc/view  ',
      );
      expect(result.valid).toBe(true);
    });
  });

  // ========================================================================
  // Invalid URLs
  // ========================================================================

  describe('invalid URLs', () => {
    it('rejects empty strings', () => {
      const result = validateDownloadUrl('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EMPTY_URL');
    });

    it('rejects null/undefined', () => {
      const result = validateDownloadUrl(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EMPTY_URL');
    });

    it('rejects malformed URLs', () => {
      const result = validateDownloadUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('MALFORMED_URL');
    });

    it('rejects HTTP (non-HTTPS) URLs', () => {
      const result = validateDownloadUrl(
        'http://drive.google.com/file/d/1abc/view',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('INVALID_SCHEME');
    });

    it('rejects javascript: scheme', () => {
      const result = validateDownloadUrl('javascript:alert(1)');
      expect(result.valid).toBe(false);
    });

    it('rejects data: scheme', () => {
      const result = validateDownloadUrl('data:text/html,<h1>hi</h1>');
      expect(result.valid).toBe(false);
    });

    it('rejects non-Google hosts', () => {
      const result = validateDownloadUrl('https://evil.com/file/d/1abc/view');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('DISALLOWED_HOST');
    });

    it('rejects Google-lookalike hosts', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com.evil.com/file/d/1abc/view',
      );
      expect(result.valid).toBe(false);
    });

    it('rejects Google host with unexpected URL shape', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/some/random/path',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('UNEXPECTED_URL_SHAPE');
    });

    it('rejects Google Forms and Sheets editor/export URLs', () => {
      const forms = validateDownloadUrl(
        'https://docs.google.com/forms/d/e/1FAIpQLSdZBCCxLrM0oZiJF2QEFBR4RdhBj_byOSGFBD5rs74U8XaAWw/viewform?usp=dialog',
      );
      expect(forms.valid).toBe(false);
      expect(forms.reason).toBe('UNEXPECTED_URL_SHAPE');

      const sheets = validateDownloadUrl(
        'https://docs.google.com/spreadsheets/d/1abc123def/export?format=xlsx',
      );
      expect(sheets.valid).toBe(false);
      expect(sheets.reason).toBe('UNEXPECTED_URL_SHAPE');
    });

    it('rejects double-encoded URLs', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/file/d/1abc%252Fview',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SUSPICIOUS_ENCODING');
    });

    it('rejects path traversal attempts', () => {
      const result = validateDownloadUrl(
        'https://drive.google.com/file/d/../../../etc/passwd',
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('SUSPICIOUS_ENCODING');
    });
  });

  // ========================================================================
  // Batch filtering
  // ========================================================================

  describe('filterValidDownloadUrls', () => {
    it('filters out invalid URLs and preserves indices', () => {
      const urls = [
        'https://drive.google.com/file/d/abc/view',      // valid
        'http://evil.com/malware.exe',                    // invalid
        'https://docs.google.com/document/d/def/export',  // valid
        'javascript:alert(1)',                            // invalid
      ];

      const valid = filterValidDownloadUrls(urls);
      expect(valid).toHaveLength(2);
      expect(valid[0].index).toBe(0);
      expect(valid[1].index).toBe(2);
    });

    it('returns empty array when all URLs are invalid', () => {
      const valid = filterValidDownloadUrls([
        'http://malware.com/bad.exe',
        'ftp://files.com/bad.zip',
      ]);
      expect(valid).toHaveLength(0);
    });
  });
});
