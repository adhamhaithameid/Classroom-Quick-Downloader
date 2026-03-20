import { beforeEach, describe, expect, it, vi } from 'vitest';

interface SetupModuleOptions {
  onSingleDownloadClick?: (...args: any[]) => void | Promise<void>;
}

function setupModule(options: SetupModuleOptions = {}) {
  vi.resetModules();

  const handleSingleDownloadClick = vi.fn(async (...args: any[]) => {
    await options.onSingleDownloadClick?.(...args);
  });
  const handleCancelClick = vi.fn().mockResolvedValue(undefined);
  const showErrorState = vi.fn().mockResolvedValue(undefined);
  const ensureMinLoading = vi.fn().mockResolvedValue(undefined);
  const waitForSuccessReset = vi.fn().mockResolvedValue(undefined);

  vi.doMock('../entrypoints/content/download-handler', () => ({
    handleSingleDownloadClick,
    handleCancelClick,
    showErrorState,
    ensureMinLoading,
    waitForSuccessReset,
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
    ensureMinLoading,
    waitForSuccessReset,
  };
}

describe('student_work/button', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
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
    vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_000);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111',
    );
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
    const parsed = new URL(resolvedUrl);
    expect(parsed.searchParams.get('id')).toBe('NONCE_1');
    expect(parsed.searchParams.get('cqd_sw_req')).toBe(
      '1717171717000-11111111-1111-4111-8111-111111111111',
    );
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

  it('watchdog recovers from loading+cancel hover overlay and does not hang forever', async () => {
    vi.useFakeTimers();
    const mocks = setupModule({
      onSingleDownloadClick: (button: HTMLButtonElement) => {
        button.classList.add('cqd-loading');
        button.classList.add('cqd-cancel');
        (button.dataset as any).cqdMouseOver = 'true';
      },
    });
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=WATCHDOG_FILE', reason: 'resolved' }),
      },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    vi.advanceTimersByTime(45_100);
    await Promise.resolve();

    expect(mocks.showErrorState).toHaveBeenCalledWith(
      button,
      'Download did not finish in time. Please retry.',
    );
    vi.useRealTimers();
  });

  it('passes resolver hint params for classroom Student Work links', async () => {
    setupModule();
    const { createStudentWorkButton } = await import('../src/student_work/button');
    const resolver = vi.fn(async () => ({ ok: false, reason: 'resolver_timeout' as const }));

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'screenshot.png', ext: 'png', kind: 'other' },
      { resolve: resolver },
    );
    document.body.appendChild(button);

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(resolver).toHaveBeenCalledTimes(1);
    const hintedUrl = String((resolver.mock.calls as any[][])[0]?.[0] ?? '');
    expect(hintedUrl).toContain('cqd_sw_hint_name=screenshot.png');
    expect(hintedUrl).toContain('cqd_sw_hint_ext=png');
  });

  it('handles background success status in Student Work bundle listener', async () => {
    const mocks = setupModule();
    const listeners: Array<(message: any, sender: any, sendResponse: any) => void> = [];
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: (listener: (message: any, sender: any, sendResponse: any) => void) => {
            listeners.push(listener);
          },
        },
      },
    });

    const { pendingButtons } = await import('../entrypoints/content/state');
    const { setButtonState } = await import('../entrypoints/content/button-state');
    const { createStudentWorkButton } = await import('../src/student_work/button');

    const button = createStudentWorkButton(
      'https://classroom.google.com/g/tg/a/b/c',
      { name: 'File', ext: 'pdf', kind: 'other' },
      {
        resolve: async () => ({ ok: true, url: 'https://drive.google.com/uc?export=download&id=SW_FILE', reason: 'resolved' }),
      },
    );
    document.body.appendChild(button);

    const requestId = 'req-student-work-status-1';
    pendingButtons.set(requestId, {
      button,
      requestId,
      fileMeta: { name: 'File', ext: 'pdf', kind: 'other' },
      startedAt: Date.now() - 1000,
    });
    setButtonState(button, 'loading');

    listeners.forEach((listener) => listener(
      { type: 'CQD_DOWNLOAD_STATUS', requestId, status: 'success' },
      null,
      () => {},
    ));

    await Promise.resolve();
    await Promise.resolve();

    expect(pendingButtons.has(requestId)).toBe(false);
    expect(mocks.ensureMinLoading).toHaveBeenCalled();
    expect(mocks.waitForSuccessReset).toHaveBeenCalled();
  });
});
