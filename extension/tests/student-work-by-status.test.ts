import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function loadByStatusSidecar() {
  vi.resetModules();

  const createStudentWorkButton = vi.fn((sourceUrl: string) => {
    const button = document.createElement('button');
    button.className = 'cqd-download-btn';
    button.dataset.cqdSwBs = 'true';
    button.dataset.cqdSwSourceUrl = sourceUrl;
    return button;
  });
  const registerButtonsInSubtree = vi.fn();
  const scheduleRefresh = vi.fn();

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

  vi.doMock('../src/download-all/group-manager', () => ({
    registerButtonsInSubtree,
  }));

  vi.doMock('../src/download-all/refresh', () => ({
    scheduleRefresh,
  }));

  const mod = await import('../entrypoints/student_work_by_status.content');
  return { mod, createStudentWorkButton, registerButtonsInSubtree, scheduleRefresh };
}

describe('student_work_by_status content script', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('injects button for by-status g/tg links', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="WkZsyc file-card">
        <a class="vwNuXe" aria-label="Attachment: Image: file.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    const button = document.querySelector<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw-bs="true"]');
    const card = document.querySelector<HTMLElement>('.WkZsyc.file-card');
    expect(button).not.toBeNull();
    expect(card).not.toBeNull();
    expect(card?.contains(button as HTMLButtonElement)).toBe(true);
    expect(card?.style.position).toBe('relative');
  });

  it('injects button on authuser-prefixed by-status route', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/u/1/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="WkZsyc file-card">
        <a class="vwNuXe" aria-label="Attachment: Image: file.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw-bs="true"]')).toHaveLength(1);
  });

  it('uses the original classroom link as source for attachment anchors', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    const sourceHref = 'https://classroom.google.com/g/tg/c/a/s?id=FILE123';
    document.body.innerHTML = `
      <div class="WkZsyc file-card">
        <a class="vwNuXe" aria-label="Attachment: Image: file.png" href="${sourceHref}">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(createStudentWorkButton.mock.calls[0]?.[0]).toBe(sourceHref);
  });

  it('injects per file for data-drive-id attachments', async () => {
    const { mod } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <section class="group">
        <div class="file-card" data-drive-id="DRIVE123">File A</div>
        <div class="file-card" data-drive-id="DRIVE456">File B</div>
      </section>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw-bs="true"]')).toHaveLength(2);
  });

  it('preserves authuser from /u/{n} path for data-drive-id attachments', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/u/3/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <section class="group">
        <div class="file-card" data-drive-id="DRIVE777">File A</div>
      </section>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(createStudentWorkButton).toHaveBeenCalledWith(
      'https://drive.google.com/uc?export=download&id=DRIVE777&authuser=3',
      expect.any(Object),
    );
  });

  it('injects a button for each attachment even in the same container', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="file-card">
        <a class="vwNuXe" aria-label="Attachment: Image: same-name.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE1">Attachment</a>
        <a class="vwNuXe" aria-label="Attachment: Image: same-name.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE2">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(2);
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw-bs="true"]'),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[0].dataset.cqdFileKey).not.toEqual(buttons[1].dataset.cqdFileKey);
  });

  it('ignores open folder links and menu items', async () => {
    const { mod } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="menu">
        <a role="menuitem" aria-label="Open folder for assignment" href="https://drive.google.com/drive/folders/ABC">Folder</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw-bs="true"]')).toHaveLength(0);
  });

  it('removes legacy student work buttons on by-status routes', async () => {
    const { mod } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="legacy">
        <button class="cqd-download-btn" data-cqd-sw="true"></button>
        <a class="vwNuXe" aria-label="Attachment: Image: demo.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE999">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw-bs="true"]')).toHaveLength(1);
  });

  it('re-injects when processed marker exists but button is missing', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="file-card">
        <div jsaction="click:x2MKlc(HrdP0)">
          <a class="vwNuXe" data-cqd-sw-bs-processed="true"
            aria-label="Attachment: Image: file.png"
            href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
        </div>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw-bs="true"]')).toHaveLength(1);
  });

  it('creates a download-all header container for by-status host', async () => {
    const { mod, registerButtonsInSubtree, scheduleRefresh } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div id="host">
        <div id="grid">
          <div class="WkZsyc">
            <a class="vwNuXe" aria-label="Attachment: Image: file1.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE1">Attachment 1</a>
          </div>
          <div class="WkZsyc">
            <a class="vwNuXe" aria-label="Attachment: Image: file2.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE2">Attachment 2</a>
          </div>
        </div>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    const host = document.querySelector<HTMLElement>('#grid');
    expect(host?.getAttribute('data-stream-item-id')).toBeTruthy();
    expect(host?.querySelector('[data-cqd-sw-bs-header="true"]')).not.toBeNull();
    expect(registerButtonsInSubtree).toHaveBeenCalled();
    expect(scheduleRefresh).toHaveBeenCalled();
  });

  it('anchors Download All in the top control row when folder control exists', async () => {
    const { mod } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div id="pane">
        <div id="controls">
          <div class="filters">All</div>
          <div class="pYTkkf-Bz112c-LgbsSe">
            <a class="pYTkkf-Bz112c-mRLv6" href="https://drive.google.com/drive/folders/ABC" aria-label="Open folder for assignment"></a>
          </div>
        </div>
        <div id="grid">
          <div class="WkZsyc">
            <a class="vwNuXe" aria-label="Attachment: Image: file1.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE1">Attachment 1</a>
          </div>
          <div class="WkZsyc">
            <a class="vwNuXe" aria-label="Attachment: Image: file2.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE2">Attachment 2</a>
          </div>
        </div>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    const controls = document.querySelector<HTMLElement>('#controls');
    const header = controls?.querySelector<HTMLElement>('[data-cqd-sw-bs-header="true"]');
    expect(header).not.toBeNull();
    expect(header?.style.position).toBe('absolute');
  });

  it('removes stale by-status Download All host markers', async () => {
    const { mod } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div id="stale" data-cqd-sw-bs-host="true" data-stream-item-id="cqd-sw-bs-host">
        <div class="N5dSp" data-cqd-sw-bs-header="true">
          <button class="cqd-download-all-btn">Old Download all</button>
        </div>
      </div>
      <div id="active">
        <div class="WkZsyc">
          <a class="vwNuXe" aria-label="Attachment: Image: file1.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE1">Attachment 1</a>
        </div>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    const stale = document.querySelector<HTMLElement>('#stale');

    expect(stale?.getAttribute('data-cqd-sw-bs-host')).toBeNull();
    expect(stale?.querySelectorAll('.cqd-download-all-btn')).toHaveLength(0);
    expect(document.querySelectorAll('[data-cqd-sw-bs-host="true"]')).toHaveLength(1);
  });

  it('does not inject buttons for teacher dashboard controls without attachments', async () => {
    const { mod, createStudentWorkButton } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    const fixturePath = resolve(process.cwd(), 'tests/fixtures/classroom/student-work-teacher-en.html');
    document.body.innerHTML = readFileSync(fixturePath, 'utf-8');

    mod.scanStudentWorkByStatus(document);

    expect(createStudentWorkButton).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.cqd-download-btn[data-cqd-sw-bs="true"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-cqd-sw-bs-header="true"]')).toHaveLength(0);
  });

  it('removes flag artifacts from by-status pages', async () => {
    const { mod } = await loadByStatusSidecar();
    mod.setStudentWorkByStatusRunningForTest(true);
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
    );

    document.body.innerHTML = `
      <div class="cqd-comment-badge"></div>
      <div class="cqd-v2-flag"></div>
      <div id="post" data-cqd-v2-flag="true" data-cqd-v2-flag-verdict="comment"></div>
      <div class="WkZsyc file-card">
        <a class="vwNuXe" aria-label="Attachment: Image: file.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">Attachment</a>
      </div>
    `;

    mod.scanStudentWorkByStatus(document);

    expect(document.querySelector('.cqd-comment-badge')).toBeNull();
    expect(document.querySelector('.cqd-v2-flag')).toBeNull();
    const post = document.querySelector<HTMLElement>('#post');
    expect(post?.hasAttribute('data-cqd-v2-flag')).toBe(false);
    expect(post?.hasAttribute('data-cqd-v2-flag-verdict')).toBe(false);
  });
});
