import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STUDENT_WORK_RESOLVE_PUBLISH_TYPE,
  STUDENT_WORK_RESOLVE_RELAY_TYPE,
} from '../src/student_work/constants';

describe('student_work/channel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (globalThis as any).chrome = undefined;
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
    vi.useRealTimers();
  });

  it('builds resolver request ids with Date.now and crypto.randomUUID', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '22222222-2222-4222-8222-222222222222',
    );
    const { createResolverRequestId } = await import('../src/student_work/channel');

    const requestId = createResolverRequestId();
    expect(requestId).toBe('sw-1800000000000-22222222-2222-4222-8222-222222222222');
  });

  it('publishes via runtime relay when chrome.runtime.sendMessage is available', async () => {
    const sendMessage = vi.fn();
    (globalThis as any).chrome = {
      runtime: {
        id: 'ext-runtime-1',
        sendMessage,
      },
    };
    const { publishResolveResult } = await import('../src/student_work/channel');

    const payload = {
      type: 'CQD_SW_RESOLVE_RESULT' as const,
      requestId: 'req-runtime-1',
      ok: true,
      resolvedUrl: 'https://drive.google.com/uc?export=download&id=RUNTIME_OK',
      source: 'runtime',
    };

    publishResolveResult(payload);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      type: STUDENT_WORK_RESOLVE_PUBLISH_TYPE,
      payload,
    });
  });

  it('publish is a no-op when chrome.runtime is unavailable (no unauthenticated channel fallback)', async () => {
    const { publishResolveResult } = await import('../src/student_work/channel');

    expect(() =>
      publishResolveResult({
        type: 'CQD_SW_RESOLVE_RESULT',
        requestId: 'req-no-runtime',
        ok: true,
        resolvedUrl: 'https://drive.google.com/uc?export=download&id=X',
      }),
    ).not.toThrow();
  });

  it('waits resolve results with no runtime by resolving null (S4: no channel fallback)', async () => {
    const { waitForResolveResult } = await import('../src/student_work/channel');

    await expect(waitForResolveResult('req-no-relay', 3_000)).resolves.toBeNull();
  });

  it('ignores mismatched runtime sender ids and accepts matching relay payloads', async () => {
    const listeners = new Set<(message: unknown, sender?: { id?: string }) => void>();
    (globalThis as any).chrome = {
      runtime: {
        id: 'ext-runtime-2',
        onMessage: {
          addListener: (listener: (message: unknown, sender?: { id?: string }) => void) => {
            listeners.add(listener);
          },
          removeListener: (listener: (message: unknown, sender?: { id?: string }) => void) => {
            listeners.delete(listener);
          },
        },
      },
    };
    const { waitForResolveResult } = await import('../src/student_work/channel');
    const promise = waitForResolveResult('req-relay-1', 3_000);
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    const forgedMessage = {
      type: STUDENT_WORK_RESOLVE_RELAY_TYPE,
      payload: {
        type: 'CQD_SW_RESOLVE_RESULT' as const,
        requestId: 'req-relay-1',
        ok: true,
        resolvedUrl: 'https://drive.google.com/uc?export=download&id=FORGED',
      },
    };

    for (const listener of listeners) {
      listener(forgedMessage, { id: 'evil-extension' });
    }
    await Promise.resolve();
    expect(resolved).toBe(false);

    const validMessage = {
      type: STUDENT_WORK_RESOLVE_RELAY_TYPE,
      payload: {
        type: 'CQD_SW_RESOLVE_RESULT' as const,
        requestId: 'req-relay-1',
        ok: true,
        resolvedUrl: 'https://drive.google.com/uc?export=download&id=VALID',
      },
    };

    for (const listener of listeners) {
      listener(validMessage, { id: 'ext-runtime-2' });
    }

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        requestId: 'req-relay-1',
        ok: true,
        resolvedUrl: 'https://drive.google.com/uc?export=download&id=VALID',
      }),
    );
  });

  it('times out cleanly and unregisters runtime listeners when no relay arrives', async () => {
    vi.useFakeTimers();
    const listeners = new Set<(message: unknown, sender?: { id?: string }) => void>();
    (globalThis as any).chrome = {
      runtime: {
        id: 'ext-runtime-timeout',
        onMessage: {
          addListener: (listener: (message: unknown, sender?: { id?: string }) => void) => {
            listeners.add(listener);
          },
          removeListener: (listener: (message: unknown, sender?: { id?: string }) => void) => {
            listeners.delete(listener);
          },
        },
      },
    };
    const { waitForResolveResult } = await import('../src/student_work/channel');

    const promise = waitForResolveResult('req-timeout-1', 250);
    expect(listeners.size).toBe(1);

    vi.advanceTimersByTime(251);
    await expect(promise).resolves.toBeNull();
    expect(listeners.size).toBe(0);
  });
});
