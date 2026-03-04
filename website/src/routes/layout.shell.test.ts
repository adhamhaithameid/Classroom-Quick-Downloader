import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';

const mockState = vi.hoisted(() => ({
  path: '/overview'
}));

vi.mock('$app/environment', () => ({
  browser: false
}));

vi.mock('$app/paths', () => ({
  base: ''
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe(run: (value: { url: URL }) => void) {
      run({ url: new URL(`https://example.com${mockState.path}`) });
      return () => {};
    }
  }
}));

vi.mock('$lib/assets/cqd-logo.svg', () => ({
  default: '/test-logo.svg'
}));

vi.mock('$lib/analytics/websiteEvents', () => ({
  flushWebsiteEvents: vi.fn(async () => {}),
  initWebsiteEventsClient: vi.fn(() => () => {}),
  trackWebsiteEvent: vi.fn()
}));

import Layout from './+layout.svelte';

function squish(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

describe('site layout shell', () => {
  it('shows nav and footer chrome on overview route', () => {
    mockState.path = '/overview';
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('l2-footer');
    expect(html).toContain('Install for Chrome');
    expect(html).toContain('href="/overview"');
    expect(html).toContain('aria-current="page"');
  });

  it('keeps chrome visible on standard content routes', () => {
    mockState.path = '/privacy';
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('l2-footer');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Contact');
  });
});
