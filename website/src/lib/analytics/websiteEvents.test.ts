import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function setupBrowserGlobals(): void {
  const localStorage = new MockStorage();
  const listeners = new Map<string, EventListener[]>();

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      location: { pathname: '/overview' },
      addEventListener: (event: string, callback: EventListener) => {
        const list = listeners.get(event) || [];
        list.push(callback);
        listeners.set(event, list);
      },
      removeEventListener: () => {}
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      visibilityState: 'visible',
      addEventListener: (event: string, callback: EventListener) => {
        const list = listeners.get(event) || [];
        list.push(callback);
        listeners.set(event, list);
      },
      removeEventListener: () => {}
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      sendBeacon: vi.fn().mockReturnValue(true)
    },
    configurable: true
  });
}

describe('websiteEvents telemetry queue', () => {
  beforeEach(() => {
    vi.resetModules();
    submitWebsiteEventsMock.mockReset();
    setupBrowserGlobals();
  });

  it('tracks and flushes website events', async () => {
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
      placement: 'hero_install'
    });

    await module.flushWebsiteEvents();

    expect(submitWebsiteEventsMock).toHaveBeenCalledTimes(1);
    const payload = submitWebsiteEventsMock.mock.calls[0][0] as {
      events: Array<{ action: string; placement: string }>;
      pagePath: string;
    };
    expect(payload.pagePath).toBe('/overview');
    expect(payload.events).toHaveLength(1);
    expect(payload.events[0]).toMatchObject({ action: 'install_click', placement: 'hero_install' });
  });

  it('retains queue on upstream error for retry', async () => {
    submitWebsiteEventsMock.mockRejectedValue(new Error('network down'));

    const module = await import('./websiteEvents');
    module.trackWebsiteEvent({
      eventType: 'map',
      action: 'map_yes',
      placement: 'map_prompt_yes'
    });

    await module.flushWebsiteEvents();

    expect(submitWebsiteEventsMock).toHaveBeenCalledTimes(1);
    const persisted = (globalThis.window as unknown as { localStorage: MockStorage }).localStorage.getItem('cqd.website.events.queue.v1');
    expect(persisted).toContain('map_prompt_yes');
  });
});
