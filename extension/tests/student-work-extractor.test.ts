import { describe, expect, it } from 'vitest';
import { extractResolvedDownloadUrl } from '../src/student_work/extractor';

describe('student_work/extractor', () => {
  it('extracts and normalizes Drive anchor URLs', () => {
    document.body.innerHTML = `
      <a href="https://drive.google.com/file/d/FILE_ABC_123/view?usp=sharing">File</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('anchor');
    expect(result?.url).toContain('https://drive.google.com/uc?');
    expect(result?.url).toContain('id=FILE_ABC_123');
  });

  it('extracts classroom drive proxy anchors via resourceId', () => {
    document.body.innerHTML = `
      <a href="https://classroom.google.com/drive?resourceId=FILE_999">Proxy</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission',
    );

    expect(result?.source).toBe('anchor');
    expect(result?.url).toContain('id=FILE_999');
  });

  it('extracts from script payload driveFileId fallback', () => {
    document.body.innerHTML = `
      <script>
        window.__BOOT = {"driveFileId":"SCRIPT_FILE_777"};
      </script>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('script');
    expect(result?.url).toContain('id=SCRIPT_FILE_777');
  });

  it('falls back to query params when no anchors/scripts resolve', () => {
    document.body.innerHTML = `<div>No links here</div>`;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?resourceId=QUERY_FILE_42',
    );

    expect(result?.source).toBe('query');
    expect(result?.url).toContain('id=QUERY_FILE_42');
  });

  it('returns null when no candidate is found', () => {
    document.body.innerHTML = `<div>still nothing</div>`;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?foo=bar',
    );

    expect(result).toBeNull();
  });
});

