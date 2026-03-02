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
}

function setupBrowserGlobals(): MockStorage {
  const localStorage = new MockStorage();

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      location: { pathname: '/overview' },
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      visibilityState: 'visible',
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    configurable: true
  });

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      sendBeacon: vi.fn().mockReturnValue(false)
    },
    configurable: true
  });

  return localStorage;
}

function randomString(seed: number, minLen: number, maxLen: number): string {
  const len = minLen + (seed % (maxLen - minLen + 1));
  let out = '';
  for (let i = 0; i < len; i += 1) {
    const char = 33 + ((seed * (i + 17) + i * 31) % 90);
    out += String.fromCharCode(char);
  }
  return out;
}

describe('website events fuzz and stress safety', () => {
  beforeEach(() => {
    vi.resetModules();
    submitWebsiteEventsMock.mockReset();
    setupBrowserGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles randomized event payloads without throwing and keeps queue bounded', async () => {
    submitWebsiteEventsMock.mockResolvedValue({
      ok: true,
      generatedAt: Date.now(),
      acceptedCount: 24,
      rejectedCount: 0
    });

    const module = await import('./websiteEvents');

    const eventTypes = ['cta', 'map'];
    const actions = ['install_click', 'download_click', 'map_yes', 'map_no'];

    for (let i = 0; i < 1200; i += 1) {
      const eventType = eventTypes[i % eventTypes.length];
      const action = actions[i % actions.length];
      expect(() =>
        module.trackWebsiteEvent({
          eventType: eventType as 'cta' | 'map',
          action: action as 'install_click' | 'download_click' | 'map_yes' | 'map_no',
          placement: randomString(i + 7, 0, 140),
          meta: {
            longKeyNameThatWillBeTrimmedBecauseOfSize: randomString(i + 11, 10, 180),
            booleanFlag: i % 2 === 0,
            numericValue: i,
            nullable: null
          }
        })
      ).not.toThrow();
    }

    const persisted = (globalThis.window as unknown as { localStorage: MockStorage }).localStorage.getItem(
      'cqd.website.events.queue.v1'
    );
    expect(persisted).toBeTruthy();

    const queue = JSON.parse(persisted || '[]') as Array<{ placement?: string; meta?: Record<string, unknown> }>;
    expect(queue.length).toBeLessThanOrEqual(240);

    for (const item of queue) {
      expect((item.placement || '').length).toBeGreaterThanOrEqual(1);
      expect((item.placement || '').length).toBeLessThanOrEqual(140);
      if (item.meta) {
        expect(Object.keys(item.meta).length).toBeLessThanOrEqual(8);
      }
    }

    for (let i = 0; i < 12; i += 1) {
      await module.flushWebsiteEvents();
    }

    const drained = (globalThis.window as unknown as { localStorage: MockStorage }).localStorage.getItem(
      'cqd.website.events.queue.v1'
    );
    expect(drained).toBe('[]');
    expect(submitWebsiteEventsMock.mock.calls.length).toBeGreaterThan(0);
    for (const call of submitWebsiteEventsMock.mock.calls) {
      const payload = call[0] as { events: unknown[] };
      expect(payload.events.length).toBeLessThanOrEqual(24);
    }
  }, 30_000);
});
