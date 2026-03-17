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

  it('extractor ignores non-drive/doc anchors even when they look noisy', async () => {
    const { extractResolvedDownloadUrl } = await import('../src/student_work/extractor');

    document.body.innerHTML = `
      <a href="javascript:alert(1)">bad-1</a>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">bad-2</a>
      <a href="https://example.com/file/d/PRETEND/view">bad-3</a>
    `;

    const result = extractResolvedDownloadUrl(
      document,
      'https://classroom.google.com/g/tg/a/b/c?foo=bar',
    );

    expect(result).toBeNull();
  });

  it('classifier remains stable across many authuser path variants', async () => {
    const { isStudentWorkRoute } = await import('../src/student_work/url-classifier');

    const positives = Array.from({ length: 12 }, (_, idx) =>
      `/u/${idx}/c/course-${idx}/a/work-${idx}/submissions/student-${idx}`,
    );
    const negatives = Array.from({ length: 12 }, (_, idx) =>
      `/u/${idx}/c/course-${idx}/a/work-${idx}/details`,
    );

    positives.forEach((pathname) => {
      expect(isStudentWorkRoute(pathname)).toBe(true);
    });
    negatives.forEach((pathname) => {
      expect(isStudentWorkRoute(pathname)).toBe(false);
    });
  });

  it('resolver keeps authuser while normalizing many direct-id classroom links', async () => {
    const { resolveStudentWorkUrl } = await import('../src/student_work/resolver');

    const cases = Array.from({ length: 8 }, (_, idx) => ({
      rawUrl: `https://classroom.google.com/u/${idx}/g/tg/a/b/c?id=FILE_${idx}`,
      auth: `${idx}`,
      id: `FILE_${idx}`,
    }));

    for (const testCase of cases) {
      const result = await resolveStudentWorkUrl(testCase.rawUrl, { stageTimeoutMs: 10 });
      expect(result.ok).toBe(true);
      expect(result.url).toContain(`id=${testCase.id}`);
      expect(result.url).toContain(`authuser=${testCase.auth}`);
    }
  });
});
