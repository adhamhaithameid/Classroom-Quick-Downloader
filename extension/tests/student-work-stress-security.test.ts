import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('student_work security + stress matrix', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('resolver never marks malformed inputs as downloadable', async () => {
    const { resolveStudentWorkUrl } = await import('../src/student_work/resolver');

    const cases = [
      '',
      'javascript:alert(1)',
      'data:text/plain,hi',
      'not-a-url',
    ];

    for (const testCase of cases) {
      const result = await resolveStudentWorkUrl(testCase, { stageTimeoutMs: 5 });
      expect(result.ok).toBe(false);
    }
  });

  it('classifier handles large mixed URL matrix deterministically', async () => {
    const {
      isStudentWorkAttachmentUrl,
      isStudentWorkRoute,
      isStudentWorkViewerPath,
    } = await import('../src/student_work/url-classifier');

    const attachmentCases = [
      'https://classroom.google.com/g/tg/a/b/c',
      'https://classroom.google.com/u/1/g/tg/a/b/c',
      'https://classroom.google.com/g/tg/a/b/c?id=X',
      'https://drive.google.com/file/d/X/view',
      'https://classroom.google.com/drive?resourceId=X',
    ];

    expect(isStudentWorkRoute('/c/1/a/2/submissions')).toBe(true);
    expect(isStudentWorkRoute('/c/1/a/2/submissions/student')).toBe(true);
    expect(isStudentWorkRoute('/c/1/m/2/details')).toBe(false);

    expect(isStudentWorkViewerPath('/g/tg/a/b/c')).toBe(true);
    expect(isStudentWorkViewerPath('/u/1/g/tg/a/b/c')).toBe(true);
    expect(isStudentWorkViewerPath('/drive/file/123')).toBe(false);

    const truth = attachmentCases.map((url) => isStudentWorkAttachmentUrl(url));
    expect(truth).toEqual([true, true, true, false, false]);
  });

  it('extractor scales for large pages with many anchors', async () => {
    const { extractResolvedDownloadUrl } = await import('../src/student_work/extractor');

    const links = Array.from({ length: 180 }, (_, index) =>
      `<a href="https://example.com/${index}">noise-${index}</a>`,
    ).join('\n');

    document.body.innerHTML = `
      <section>${links}</section>
      <a href="https://drive.google.com/file/d/STRESS_FILE_123/view">target</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/a/b/c',
    );

    expect(result).not.toBeNull();
    expect(result?.url).toContain('id=STRESS_FILE_123');
  });
});
