import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STUDENT_WORK_CHANNEL_NAME,
  STUDENT_WORK_RESOLVE_PUBLISH_TYPE,
  STUDENT_WORK_RESOLVE_RELAY_TYPE,
} from '../src/student_work/constants';

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();

  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const peers = FakeBroadcastChannel.channels.get(name) || new Set<FakeBroadcastChannel>();
    peers.add(this);
    FakeBroadcastChannel.channels.set(name, peers);
  }

  postMessage(data: unknown) {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;

    for (const peer of peers) {
      if (peer === this || typeof peer.onmessage !== 'function') continue;
      peer.onmessage({ data } as MessageEvent);
    }
  }

  close() {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    peers.delete(this);
    if (peers.size === 0) {
      FakeBroadcastChannel.channels.delete(this.name);
    }
  }

  static reset() {
    FakeBroadcastChannel.channels.clear();
  }
}

describe('student_work/channel', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    FakeBroadcastChannel.reset();
    (globalThis as any).chrome = undefined;
    globalThis.BroadcastChannel = FakeBroadcastChannel as any;
  });

  afterEach(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
    delete (globalThis as any).chrome;
    vi.useRealTimers();
  });

  it('builds resolver request ids with Date.now and crypto.randomUUID', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-fixed-1');
    const { createResolverRequestId } = await import('../src/student_work/channel');

    const requestId = createResolverRequestId();
    expect(requestId).toBe('sw-1800000000000-uuid-fixed-1');
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

  it('receives fallback BroadcastChannel payloads when runtime relay is unavailable', async () => {
    const { waitForResolveResult } = await import('../src/student_work/channel');
    const promise = waitForResolveResult('req-bc-1', 3_000);

    const broadcaster = new FakeBroadcastChannel(STUDENT_WORK_CHANNEL_NAME);
    broadcaster.postMessage({
      type: 'CQD_SW_RESOLVE_RESULT',
      requestId: 'req-bc-1',
      ok: true,
      resolvedUrl: 'https://drive.google.com/uc?export=download&id=BROADCAST_OK',
      source: 'broadcast',
    });
    broadcaster.close();

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        requestId: 'req-bc-1',
        ok: true,
        resolvedUrl: 'https://drive.google.com/uc?export=download&id=BROADCAST_OK',
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
