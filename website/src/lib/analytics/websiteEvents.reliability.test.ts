import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const submitWebsiteEventsMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/publicSite', () => ({
  submitWebsiteEvents: submitWebsiteEventsMock
}));

class MockStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

type ListenerMap = Map<string, EventListener[]>;

function setupBrowserGlobals(): { localStorage: MockStorage; listeners: ListenerMap } {
  const localStorage = new MockStorage();
  const listeners: ListenerMap = new Map();

  const add = (event: string, callback: EventListener) => {
    const list = listeners.get(event) || [];
    list.push(callback);
    listeners.set(event, list);
  };
  const remove = (event: string, callback: EventListener) => {
    const list = listeners.get(event) || [];
    listeners.set(
      event,
      list.filter((item) => item !== callback)
    );
  };

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      location: { pathname: '/overview' },
      addEventListener: add,
      removeEventListener: remove
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      visibilityState: 'visible',
      addEventListener: add,
      removeEventListener: remove
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      sendBeacon: vi.fn().mockReturnValue(true)
    },
    configurable: true
  });

  return { localStorage, listeners };
}

describe('website events reliability', () => {
  beforeEach(() => {
    vi.resetModules();
    submitWebsiteEventsMock.mockReset();
    vi.useFakeTimers();
    setupBrowserGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries a failed flush and drains the queue on next successful attempt', async () => {
    submitWebsiteEventsMock
      .mockRejectedValueOnce(new Error('upstream temporary failure'))
      .mockResolvedValue({ ok: true, generatedAt: Date.now(), acceptedCount: 3, rejectedCount: 0 });

    const module = await import('./websiteEvents');

    for (let i = 0; i < 3; i += 1) {
      module.trackWebsiteEvent({
        eventType: 'cta',
        action: 'download_click',
        placement: `footer_download_${i}`
      });
    }

    await module.flushWebsiteEvents();
    expect(submitWebsiteEventsMock).toHaveBeenCalledTimes(1);

    const persistedAfterFailure = (globalThis.window as unknown as { localStorage: MockStorage }).localStorage.getItem(
      'cqd.website.events.queue.v1'
    );
    expect(persistedAfterFailure).toContain('footer_download_0');

    await module.flushWebsiteEvents();
    expect(submitWebsiteEventsMock).toHaveBeenCalledTimes(2);

    const persistedAfterRetry = (globalThis.window as unknown as { localStorage: MockStorage }).localStorage.getItem(
      'cqd.website.events.queue.v1'
    );
    expect(persistedAfterRetry).toBe('[]');
  });

  it('flush timer starts once and is fully cleaned up after dispose', async () => {
    submitWebsiteEventsMock.mockResolvedValue({
      ok: true,
      generatedAt: Date.now(),
      acceptedCount: 1,
      rejectedCount: 0
    });

    const module = await import('./websiteEvents');

    module.trackWebsiteEvent({
      eventType: 'cta',
      action: 'install_click',
      placement: 'nav_install'
    });

    const disposeA = module.initWebsiteEventsClient();
    const disposeB = module.initWebsiteEventsClient();

    await vi.advanceTimersByTimeAsync(16_000);
    expect(submitWebsiteEventsMock).toHaveBeenCalledTimes(1);

    disposeA();
    disposeB();

    module.trackWebsiteEvent({
      eventType: 'map',
      action: 'map_yes',
      placement: 'map_prompt_yes'
    });

    const callsBefore = submitWebsiteEventsMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(16_000);
    expect(submitWebsiteEventsMock.mock.calls.length).toBe(callsBefore);
  });
});
