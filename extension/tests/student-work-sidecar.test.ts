import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadSidecar() {
  vi.resetModules();

  const createStudentWorkButton = vi.fn((sourceUrl: string) => {
    const button = document.createElement('button');
    button.className = 'cqd-download-btn';
    button.dataset.cqdSw = 'true';
    button.dataset.cqdSwSourceUrl = sourceUrl;
    return button;
  });

  vi.doMock('../entrypoints/content/flags', () => ({
    subscribeToGlobalState: (onEnabled: () => void) => {
      onEnabled();
      return () => {};
    },
  }));

  vi.doMock('../entrypoints/content/styles', () => ({
    injectStyles: vi.fn(),
  }));

  vi.doMock('../entrypoints/content/file-meta', () => ({
    extractFileMeta: vi.fn(() => ({ name: 'Resolved File', ext: 'pdf', kind: 'other' })),
  }));

  vi.doMock('../src/student_work/button', () => ({
    createStudentWorkButton,
  }));

  const mod = await import('../entrypoints/student_work_sidecar.content');
  return { mod, createStudentWorkButton };
}

describe('student_work_sidecar content script', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('injects sidecar button for Student Work tg links', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkLinks(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(1);
  });

  it('injects sidecar button on authuser-prefixed Student Work routes', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/u/1/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkLinks(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(1);
  });

  it('does not inject on non-student-work routes', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/details'));

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkLinks(document);
    expect(createStudentWorkButton).not.toHaveBeenCalled();
  });

  it('does not duplicate buttons on repeated scans', async () => {
    const { mod } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/submissions/student-1'));

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkLinks(document);
    mod.scanStudentWorkLinks(document);

    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(1);
  });

  it('re-injects when processed marker exists but button is missing', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/submissions/student-1'));

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a data-cqd-sw-processed="true" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkLinks(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(1);
  });

  it('skips containers already owned by existing CQD buttons', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/submissions'));

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
        <button class="cqd-download-btn"></button>
      </div>
    `;

    mod.scanStudentWorkLinks(document);
    expect(createStudentWorkButton).not.toHaveBeenCalled();
  });

  it('injects sidecar button for data-drive-id attachments', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div data-drive-id="DRIVE123">Drive attachment</div>
    `;

    mod.scanStudentWorkLinks(document);

    expect(createStudentWorkButton).toHaveBeenCalledWith(
      'https://drive.google.com/uc?export=download&id=DRIVE123',
      expect.any(Object),
    );
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(1);
  });

  it('preserves authuser from /u/{n} path for data-drive-id attachments', async () => {
    const { mod, createStudentWorkButton } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/u/2/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div data-drive-id="DRIVE777">Drive attachment</div>
    `;

    mod.scanStudentWorkLinks(document);

    expect(createStudentWorkButton).toHaveBeenCalledWith(
      'https://drive.google.com/uc?export=download&id=DRIVE777&authuser=2',
      expect.any(Object),
    );
  });

  it('clears processed markers and sidecar buttons when test reset runs', async () => {
    const { mod } = await loadSidecar();
    mod.setStudentWorkSidecarRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div data-stream-item-id="s1">
        <a href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkLinks(document);

    const anchor = document.querySelector<HTMLAnchorElement>('a[href]');
    expect(anchor?.getAttribute('data-cqd-sw-processed')).toBe('true');
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(1);

    mod.resetStudentWorkSidecarForTest();

    expect(anchor?.hasAttribute('data-cqd-sw-processed')).toBe(false);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(0);
  });
});
