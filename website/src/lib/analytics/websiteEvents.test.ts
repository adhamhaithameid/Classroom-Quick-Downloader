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

  it('dedupes and caps page_error events, sanitizing sensitive content', async () => {
    submitWebsiteEventsMock.mockResolvedValue({
      ok: true,
      generatedAt: Date.now(),
      acceptedCount: 5,
      rejectedCount: 0
    });

    const module = await import('./websiteEvents');
    module.trackPageError('TypeError: cannot read property x of undefined', 'global_error', 'app.js');
    // Identical signature is deduped.
    module.trackPageError('TypeError: cannot read property x of undefined', 'global_error', 'app.js');
    // URLs and emails are scrubbed from messages.
    module.trackPageError('failed loading https://secret.example/private for user@school.edu', 'unhandled_rejection');

    await module.flushWebsiteEvents();

    const payload = submitWebsiteEventsMock.mock.calls[0][0] as {
      events: Array<{ action: string; placement: string; meta?: Record<string, unknown> }>;
    };
    const errors = payload.events.filter((event) => event.action === 'page_error');
    expect(errors).toHaveLength(2);
    expect(errors[0].placement).toBe('global_error');
    expect(String(errors[0].meta?.msg)).toContain('TypeError');
    expect(String(errors[1].meta?.msg)).not.toContain('secret.example');
    expect(String(errors[1].meta?.msg)).not.toContain('user@school.edu');
    expect(String(errors[1].meta?.msg)).toContain('[url]');
    expect(String(errors[1].meta?.msg)).toContain('[email]');
  });

  it('stops reporting page_error after the per-session cap', async () => {
    submitWebsiteEventsMock.mockResolvedValue({
      ok: true,
      generatedAt: Date.now(),
      acceptedCount: 5,
      rejectedCount: 0
    });

    const module = await import('./websiteEvents');
    for (let i = 0; i < 10; i += 1) {
      module.trackPageError(`unique error number ${i}`, 'global_error');
    }

    await module.flushWebsiteEvents();

    const payload = submitWebsiteEventsMock.mock.calls[0][0] as {
      events: Array<{ action: string }>;
    };
    const errors = payload.events.filter((event) => event.action === 'page_error');
    expect(errors).toHaveLength(module.MAX_ERRORS_PER_SESSION);
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
