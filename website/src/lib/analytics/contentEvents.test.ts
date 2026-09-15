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

function setupBrowserGlobals(activeStorage: MockStorage = new MockStorage()): void {
  const localStorage = activeStorage;

  Object.defineProperty(globalThis, 'window', {
    value: {
      localStorage,
      location: { pathname: '/download-all-attachments-google-classroom' },
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
      sendBeacon: vi.fn().mockReturnValue(true)
    },
    configurable: true
  });
}

const QUEUE_STORAGE_KEY = 'cqd.website.events.queue.v1';

let storage: MockStorage;

function readQueuedEvents(): Array<Record<string, unknown>> {
  const raw = storage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Array<Record<string, unknown>>;
}

describe('content engagement trackers', () => {
  beforeEach(() => {
    vi.resetModules();
    submitWebsiteEventsMock.mockReset();
    storage = new MockStorage();
    setupBrowserGlobals(storage);
  });

  it('guide CTA click queues a cta/guide_cta_click event with placement and page path', async () => {
    const { trackGuideCtaClick } = await import('./websiteEvents');
    trackGuideCtaClick('guide_primary', '/download-all-attachments-google-classroom');

    const events = readQueuedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'cta',
      action: 'guide_cta_click',
      placement: 'guide_primary'
    });
    expect((events[0].meta as Record<string, unknown>).pagePath).toBe('/download-all-attachments-google-classroom');
  });

  it('faq expand queues a content/faq_expand event with question and section metadata', async () => {
    const { trackFaqExpand } = await import('./websiteEvents');
    trackFaqExpand('Which browsers are supported?', 'Installation & Browser Support');

    const events = readQueuedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'content',
      action: 'faq_expand',
      placement: 'faq_item'
    });
    expect(events[0].meta).toMatchObject({
      question: 'Which browsers are supported?',
      section: 'Installation & Browser Support'
    });
  });

  it('guide engagement queues a content/guide_engaged event at the 75% threshold', async () => {
    const { trackGuideEngaged } = await import('./websiteEvents');
    trackGuideEngaged('/security');

    const events = readQueuedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: 'content',
      action: 'guide_engaged',
      placement: 'guide_scroll'
    });
    expect(events[0].meta).toMatchObject({ percent: 75, pagePath: '/security' });
  });

  it('does not queue anything outside a browser environment', async () => {
    // Mirror the SSR case: window/document undefined.
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true });
    const { trackGuideEngaged } = await import('./websiteEvents');
    trackGuideEngaged('/security');

    expect(readQueuedEvents()).toHaveLength(0);
  });
});
