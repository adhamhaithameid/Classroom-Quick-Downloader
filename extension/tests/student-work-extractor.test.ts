import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractResolvedDownloadUrl } from '../src/student_work/extractor';

describe('student_work/extractor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('location', new URL('https://classroom.google.com/g/tg/course/work/submission'));
    document.body.innerHTML = '';
  });

  it('preserves authuser from current /u/{n} path when normalizing drive anchors', () => {
    vi.stubGlobal('location', new URL('https://classroom.google.com/u/7/g/tg/course/work/submission'));
    document.body.innerHTML = `
      <a href="https://drive.google.com/file/d/FILE_AUTH_PATH/view">File</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/u/7/g/tg/course/work/submission',
    );

    expect(result).not.toBeNull();
    expect(result?.url).toContain('id=FILE_AUTH_PATH');
    expect(result?.url).toContain('authuser=7');
  });

  it('prefers authuser embedded in candidate link over current page authuser', () => {
    vi.stubGlobal('location', new URL('https://classroom.google.com/u/1/g/tg/course/work/submission'));
    document.body.innerHTML = `
      <a href="https://drive.google.com/u/9/file/d/FILE_AUTH_LINK/view">File</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/u/1/g/tg/course/work/submission',
    );

    expect(result).not.toBeNull();
    expect(result?.url).toContain('id=FILE_AUTH_LINK');
    expect(result?.url).toContain('authuser=9');
  });

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

  it('uses resolver hint name to pick the matching anchor when multiple candidates exist', () => {
    document.body.innerHTML = `
      <a aria-label="Attachment: JSON: payload.json" href="https://drive.google.com/file/d/FILE_JSON_1/view">JSON</a>
      <a aria-label="Attachment: Image: screenshot.png" href="https://drive.google.com/file/d/FILE_IMAGE_2/view">Image</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?cqd_sw_hint_name=screenshot.png&cqd_sw_hint_ext=png',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('anchor');
    expect(result?.url).toContain('id=FILE_IMAGE_2');
  });

  it('returns null when hinted anchors tie on score (avoid wrong first-match downloads)', () => {
    document.body.innerHTML = `
      <a aria-label="Attachment: PDF: worksheet.pdf" href="https://drive.google.com/file/d/FILE_A/view">PDF A</a>
      <a aria-label="Attachment: PDF: worksheet.pdf" href="https://drive.google.com/file/d/FILE_B/view">PDF B</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?cqd_sw_hint_name=worksheet.pdf&cqd_sw_hint_ext=pdf',
    );

    expect(result).toBeNull();
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

  it('returns null for user-hinted URLs when only generic script fallback is available', () => {
    document.body.innerHTML = `
      <script>
        window.__BOOT = {"driveFileId":"SCRIPT_FILE_777"};
      </script>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?cqd_sw_hint_name=screenshot.png&cqd_sw_hint_ext=png#u=USER_42',
    );

    expect(result).toBeNull();
  });

  it('returns null for user-hinted URLs when hinted anchor score is non-positive', () => {
    document.body.innerHTML = `
      <a href="https://drive.google.com/file/d/GENERIC_FILE_9/view">Open</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?cqd_sw_hint_name=report.json&cqd_sw_hint_ext=json#u=USER_42',
    );

    expect(result).toBeNull();
  });

  it('extracts from performance resource entries when Drive/Docs anchors are absent', () => {
    document.body.innerHTML = `<div>No anchors rendered yet</div>`;
    const resourceSpy = vi.spyOn(window.performance, 'getEntriesByType')
      .mockReturnValue([
        { name: 'https://docs.google.com/file/d/RESOURCE_FILE_42/grading?authuser=0' } as PerformanceEntry,
      ]);

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('resource');
    expect(result?.url).toContain('id=RESOURCE_FILE_42');
    resourceSpy.mockRestore();
  });

  it('keeps strict user-hinted resolution when performance resources expose a single file', () => {
    document.body.innerHTML = `<div>Waiting for rendered attachment...</div>`;
    const resourceSpy = vi.spyOn(window.performance, 'getEntriesByType')
      .mockReturnValue([
        { name: 'https://docs.google.com/file/d/STRICT_RESOURCE_7/grading?authuser=0' } as PerformanceEntry,
      ]);

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/course/work/submission?cqd_sw_hint_name=worksheet.png&cqd_sw_hint_ext=png#u=USER_42',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('resource');
    expect(result?.url).toContain('id=STRICT_RESOURCE_7');
    resourceSpy.mockRestore();
  });

  it('normalizes docs anchors into direct drive download URLs', () => {
    vi.stubGlobal('location', new URL('https://classroom.google.com/u/2/g/tg/course/work/submission'));
    document.body.innerHTML = `
      <a href="https://docs.google.com/document/d/DOCS_FILE_2/edit">Doc</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/u/2/g/tg/course/work/submission',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('anchor');
    expect(result?.url).toContain('id=DOCS_FILE_2');
    expect(result?.url).toContain('authuser=2');
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

  it('uses current URL as fallback when it is already a drive URL', () => {
    vi.stubGlobal('location', new URL('https://classroom.google.com/u/4/g/tg/course/work/submission'));
    document.body.innerHTML = `<div>No links</div>`;

    const result = extractResolvedDownloadUrl(
      document,
      'https://drive.google.com/file/d/FALLBACK_FILE_1/view',
    );

    expect(result).not.toBeNull();
    expect(result?.source).toBe('current_url');
    expect(result?.url).toContain('id=FALLBACK_FILE_1');
    expect(result?.url).toContain('authuser=4');
  });
});
