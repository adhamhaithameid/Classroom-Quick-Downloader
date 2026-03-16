import { beforeEach, describe, expect, it, vi } from 'vitest';

function setupModule() {
  vi.resetModules();

  const handleSingleDownloadClick = vi.fn().mockResolvedValue(undefined);
  const handleCancelClick = vi.fn().mockResolvedValue(undefined);
  const showErrorState = vi.fn().mockResolvedValue(undefined);

  vi.doMock('../entrypoints/content/download-handler', () => ({
    handleSingleDownloadClick,
    handleCancelClick,
    showErrorState,
  }));

  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
  }));

  vi.doMock('../entrypoints/content/theme', () => ({
    isPageDark: () => false,
  }));

  return {
    handleSingleDownloadClick,
    handleCancelClick,
    showErrorState,
  };
}

describe('student_work/button', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('creates a sidecar button with expected metadata', async () => {
    setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'Worksheet.pdf', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=FILE', reason: 'resolved' }),
      },
    );

    expect(button.classList.contains('cqd-download-btn')).toBe(true);
    expect(button.dataset.cqdSw).toBe('true');
    expect(button.dataset.cqdName).toBe('Worksheet.pdf');
    expect(button.dataset.cqdExt).toBe('pdf');
  });

  it('resolves then forwards to existing single-download handler', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=RESOLVED_1', reason: 'resolved' }),
      },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.handleSingleDownloadClick).toHaveBeenCalledTimes(1);
    const [, resolvedUrl] = mocks.handleSingleDownloadClick.mock.calls[0];
    expect(resolvedUrl).toContain('id=RESOLVED_1');
  });

  it('shows error state when resolver fails', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: false, reason: 'resolver_timeout' }),
      },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.showErrorState).toHaveBeenCalledTimes(1);
    expect(mocks.handleSingleDownloadClick).not.toHaveBeenCalled();
  });

  it('cancels in-flight resolution when clicked in cancel state', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');
    const never = () => new Promise<never>(() => {});

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => {
          await never();
          return { ok: false, reason: 'aborted' };
        },
      },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();
    button.classList.add('cqd-cancel');
    button.click();
    await Promise.resolve();

    expect(mocks.handleCancelClick).not.toHaveBeenCalled();
    expect(button.classList.contains('cqd-cancelled')).toBe(true);
  });

  it('appends request nonce to resolved download URL before dispatch', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=NONCE_1', reason: 'resolved' }),
      },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.handleSingleDownloadClick).toHaveBeenCalledTimes(1);
    const [, resolvedUrl] = mocks.handleSingleDownloadClick.mock.calls[0];
    expect(resolvedUrl).toContain('id=NONCE_1');
    expect(resolvedUrl).toContain('cqd_sw_req=');
  });

  it('ignores clicks when source URL is missing', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      '',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=NO_SOURCE', reason: 'resolved' }),
      },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();

    expect(mocks.handleSingleDownloadClick).not.toHaveBeenCalled();
    expect(mocks.showErrorState).not.toHaveBeenCalled();
  });

  it('triggers resolver flow on middle-click auxclick', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=AUX_1', reason: 'resolved' }),
      },
    );
    document.body.appendChild(button);

    button.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.handleSingleDownloadClick).toHaveBeenCalledTimes(1);
    const [, resolvedUrl] = mocks.handleSingleDownloadClick.mock.calls[0];
    expect(resolvedUrl).toContain('id=AUX_1');
  });

  it('does not start duplicate resolve requests while already resolving', async () => {
    const mocks = setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');
    let resolverCalls = 0;
    let releaseResolver: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseResolver = resolve;
    });

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => {
          resolverCalls += 1;
          await gate;
          return { ok: true, url: 'https://drive.google.com/uc?export=download&id=SINGLE_RESOLVE', reason: 'resolved' };
        },
      },
    );
    document.body.appendChild(button);

    button.click();
    button.click();
    await Promise.resolve();
    expect(resolverCalls).toBe(1);

    releaseResolver();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.handleSingleDownloadClick).toHaveBeenCalledTimes(1);
  });
});
