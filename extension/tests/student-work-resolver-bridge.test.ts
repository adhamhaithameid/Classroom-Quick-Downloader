import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('student_work_resolver_bridge content script', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes success when extractor finds a resolved URL', async () => {
    const publishResolveResult = vi.fn();

    vi.doMock('../src/student_work/channel', () => ({
      publishResolveResult,
    }));

    vi.doMock('../src/student_work/extractor', () => ({
      extractResolvedDownloadUrl: vi.fn(() => ({
        url: 'https://drive.google.com/uc?export=download&id=BRIDGE_OK',
        source: 'anchor',
      })),
    }));

    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/g/tg/a/b/c?cqd_sw_req=req-bridge-1&cqd_sw_mode=iframe'),
    );

    const { startBridge } = await import('../entrypoints/student_work_resolver_bridge.content');
    startBridge();

    expect(publishResolveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CQD_SW_RESOLVE_RESULT',
        requestId: 'req-bridge-1',
        ok: true,
      }),
    );
  });

  it('publishes failure after timeout when nothing resolves', async () => {
    const publishResolveResult = vi.fn();

    vi.doMock('../src/student_work/channel', () => ({
      publishResolveResult,
    }));

    vi.doMock('../src/student_work/extractor', () => ({
      extractResolvedDownloadUrl: vi.fn(() => null),
    }));

    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/g/tg/a/b/c?cqd_sw_req=req-bridge-2&cqd_sw_mode=iframe'),
    );

    const { startBridge } = await import('../entrypoints/student_work_resolver_bridge.content');
    startBridge();

    vi.advanceTimersByTime(10_500);

    expect(publishResolveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CQD_SW_RESOLVE_RESULT',
        requestId: 'req-bridge-2',
        ok: false,
      }),
    );
  });

  it('supports authuser-prefixed viewer paths in popup mode', async () => {
    const publishResolveResult = vi.fn();

    vi.doMock('../src/student_work/channel', () => ({
      publishResolveResult,
    }));

    vi.doMock('../src/student_work/extractor', () => ({
      extractResolvedDownloadUrl: vi.fn(() => ({
        url: 'https://drive.google.com/uc?export=download&id=AUTH_PATH_OK',
        source: 'anchor',
      })),
    }));

    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/u/1/g/tg/a/b/c?cqd_sw_req=req-bridge-3&cqd_sw_mode=popup'),
    );

    const { startBridge } = await import('../entrypoints/student_work_resolver_bridge.content');
    startBridge();

    expect(publishResolveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-bridge-3',
        ok: true,
      }),
    );
  });

  it('does not publish when request mode is unsupported', async () => {
    const publishResolveResult = vi.fn();

    vi.doMock('../src/student_work/channel', () => ({
      publishResolveResult,
    }));

    vi.doMock('../src/student_work/extractor', () => ({
      extractResolvedDownloadUrl: vi.fn(() => ({
        url: 'https://drive.google.com/uc?export=download&id=MODE_IGNORED',
        source: 'anchor',
      })),
    }));

    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/g/tg/a/b/c?cqd_sw_req=req-bridge-4&cqd_sw_mode=tab'),
    );

    const { startBridge } = await import('../entrypoints/student_work_resolver_bridge.content');
    startBridge();
    vi.runOnlyPendingTimers();

    expect(publishResolveResult).not.toHaveBeenCalled();
  });
});
