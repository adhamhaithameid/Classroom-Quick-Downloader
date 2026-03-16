import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { STUDENT_WORK_CHANNEL_NAME } from '../src/student_work/constants';
import { resolveStudentWorkUrl } from '../src/student_work/resolver';

class FakeBroadcastChannel {
  static channels = new Map<string, Set<FakeBroadcastChannel>>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    const set = FakeBroadcastChannel.channels.get(name) || new Set<FakeBroadcastChannel>();
    set.add(this);
    FakeBroadcastChannel.channels.set(name, set);
  }

  postMessage(data: unknown) {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer === this) continue;
      peer.onmessage?.({ data } as MessageEvent);
    }
  }

  close() {
    const peers = FakeBroadcastChannel.channels.get(this.name);
    peers?.delete(this);
  }

  static reset() {
    FakeBroadcastChannel.channels.clear();
  }
}

function publishResolveMessage(payload: Record<string, unknown>) {
  const sender = new FakeBroadcastChannel(STUDENT_WORK_CHANNEL_NAME);
  sender.postMessage(payload);
  sender.close();
}

describe('student_work/resolver', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  const originalOpen = window.open;

  beforeEach(() => {
    FakeBroadcastChannel.reset();
    vi.useRealTimers();
    // @ts-expect-error - test mock
    globalThis.BroadcastChannel = FakeBroadcastChannel;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  afterAll(() => {
    vi.useFakeTimers();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    window.open = originalOpen;
  });

  it('returns input URL unchanged for non-student-work links', async () => {
    const result = await resolveStudentWorkUrl(
      'https://drive.google.com/file/d/FILE/view',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://drive.google.com/file/d/FILE/view');
    expect(result.reason).toBe('already_direct');
  });

  it('resolves directly from query id without iframe/popup', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c?id=FILE_QUERY_1',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=FILE_QUERY_1');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('resolves via iframe bridge message', async () => {
    const appendSpy = vi.spyOn(document.documentElement, 'appendChild');
    const waitForIframe = vi.fn((node: Node) => {
      if (!(node instanceof HTMLIFrameElement)) return;
      const iframeUrl = new URL(node.src);
      const requestId = iframeUrl.searchParams.get('cqd_sw_req');
      if (!requestId) return;

      setTimeout(() => {
        publishResolveMessage({
          type: 'CQD_SW_RESOLVE_RESULT',
          requestId,
          ok: true,
          resolvedUrl: 'https://drive.google.com/uc?export=download&id=IFRAME_RESOLVED',
          source: 'anchor',
        });
      }, 5);
    });
    appendSpy.mockImplementation((node: Node) => {
      waitForIframe(node);
      return node;
    });

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 50 },
    );

    expect(result.ok).toBe(true);
    expect(result.url).toContain('id=IFRAME_RESOLVED');
    expect(result.source).toBe('anchor');
  });

  it('stays silent (no popup) and fails with iframe timeout when unresolved', async () => {
    vi.spyOn(document.documentElement, 'appendChild').mockImplementation((node: Node) => node);
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 20 },
    );

    expect(openSpy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('resolver_timeout');
  });

  it('returns failure when iframe resolve fails', async () => {
    vi.spyOn(document.documentElement, 'appendChild').mockImplementation((node: Node) => node);

    const result = await resolveStudentWorkUrl(
      'https://classroom.google.com/g/tg/a/b/c',
      { stageTimeoutMs: 10 },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('resolver_timeout');
  });
});
