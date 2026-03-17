import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { GOOGLE_SITE_VERIFICATION } from '$lib/config';

const mockState = vi.hoisted(() => ({
  path: '/overview',
  status: 200
}));

vi.mock('$app/environment', () => ({
  browser: false
}));

vi.mock('$app/paths', () => ({
  base: ''
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe(run: (value: { url: URL; status: number }) => void) {
      run({ url: new URL(`https://example.com${mockState.path}`), status: mockState.status });
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
  it('emits the default google verification metadata in head', () => {
    const { head } = render(Layout);
    expect(head).toContain('google-site-verification');
    expect(head).toContain(GOOGLE_SITE_VERIFICATION);
  });

  it('shows nav and footer chrome on overview route', () => {
    mockState.path = '/overview';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('l2-footer');
    expect(html).toContain('Install for Chrome');
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-current="page"');
  });

  it('keeps chrome visible on standard content routes', () => {
    mockState.path = '/privacy';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('l2-footer');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Contact');
  });

  it('renders missing-path 404s in the full-bleed route shell', () => {
    mockState.path = '/does-not-exist';
    mockState.status = 404;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('site-main-overview-style');
    expect(html).not.toContain('class="l2-wrap"');
    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('l2-footer');
  });
});
