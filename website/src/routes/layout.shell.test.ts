import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { APP_VERSION, GOOGLE_SITE_VERIFICATION, STORE_LINKS } from '$lib/config';

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
  navigating: {
    subscribe(run: (value: boolean) => void) {
      run(false);
      return () => {};
    }
  },
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
    expect(html).toContain('cqd-footer');
    expect(html).toContain('Install for Chrome');
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-current="page"');
  });

  it('mounts the shared ambient background (orbs + grid) on every route', () => {
    mockState.path = '/faq';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-page-orbs');
    expect(html).toContain('l2-page-grid');
  });

  it('mounts the branded cursor layer on every route', () => {
    mockState.path = '/faq';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('cqd-cursor');
    expect(html).toContain('data-state="default"');
    expect(html).toContain('aria-hidden');
  });

  it('renders crawlable hover megamenus with described links in server markup', () => {
    mockState.path = '/overview';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('aria-haspopup="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('l2-nav-dropdown');
    // Dropdown panels ship in SSR HTML (hidden until hover) so crawlers see
    // the internal link graph even without JavaScript.
    expect(html).toContain('href="/security"');
    expect(html).toContain('href="/watch/cqd-demo"');
    expect(html).toContain('href="/download-all-attachments-google-classroom"');
    expect(html).toContain('href="/bulk-download-google-classroom-assignments"');
    expect(html).toContain('href="/download-google-classroom-materials-fast"');
    expect(html).toContain('href="/support"');
    expect(html).toContain('href="/google-workspace-school-accounts-support"');
    expect(html).toContain('href="/google-drive-cant-scan-virus-warning-download"');
    expect(html).toContain('href="/press-kit"');
    expect(html).toContain('href="/featured"');
    expect(html).toContain('l2-nav-menu-featured');
  });

  it('renders the GitHub hover preview and alternate-browser install circles', () => {
    mockState.path = '/overview';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    // GitHub link is a menu trigger wired to the shared panel.
    expect(html).toContain('data-menu-key="github"');
    expect(html).toContain('id="nav-menu-github"');
    expect(html).toContain('aria-controls="nav-menu-github"');
    expect(html).toContain('Star on GitHub');
    expect(html).toContain('adhamhaithameid/Classroom-Quick-Downloader');

    // Alternate-browser circles under the install CTA open the real stores.
    expect(html).toContain('aria-label="Install for Firefox"');
    expect(html).toContain('aria-label="Install for Microsoft Edge"');
    expect(html).toContain(`href="${STORE_LINKS.firefox}"`);
    expect(html).toContain(`href="${STORE_LINKS.edge}"`);
  });

  it('ships the pill scroll shell without a pre-hydrated scrolled state', () => {
    mockState.path = '/overview';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-nav-float');
    expect(html).toContain('l2-nav-bar');
    expect(html).toContain('l2-nav-backdrop');
    // Scroll state is client-only: SSR must never ship the pill pre-applied.
    expect(html).not.toContain('is-scrolled');
    expect(html).not.toContain('menu-open');
  });

  it('renders the four-layer premium footer with CTA, navigation, principles, and legal bar', () => {
    mockState.path = '/overview';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    // Layer 1: final installation CTA
    expect(html).toContain('One last click');
    expect(html).toContain('Ready to save hours?');
    expect(html).toContain('Install Classroom Quick Downloader in under 10 seconds. Free forever. No account required.');
    expect(html).toContain('Works with Brave, Opera, Vivaldi, Arc and more.');
    // Layer 2: product identity (logo, no wordmark) + five-column navigation grid
    expect(html).toContain('Download Classroom files without repetitive clicking.');
    expect(html).toContain('Version');
    expect(html).toContain(`>${APP_VERSION}<`);
    expect(html).toContain('aria-label="Product"');
    expect(html).toContain('aria-label="Compare"');
    expect(html).toContain('aria-label="Install"');
    expect(html).toContain('aria-label="Resources"');
    expect(html).toContain('aria-label="Connect"');
    expect(html).toContain('How it works');
    expect(html).toContain('Report issue');
    expect(html).toContain('ft-mega');
    // The wordmark canvas ships in SSR markup; the shatter/ripple
    // interaction is progressive enhancement layered on top of it.
    expect(html).toContain('ft-mega-canvas');
    expect(html).toContain('aria-hidden="true"');
    // Layer 3: principles strip
    expect(html).toContain('Instant.');
    expect(html).toContain('Private.');
    expect(html).toContain('Transparent.');
    expect(html).toContain('Universal.');
    // Layer 4: legal + identity bar
    expect(html).toContain(`© ${new Date().getFullYear()} Classroom Quick Downloader`);
    expect(html).toContain('Not affiliated with Google or Google Classroom');
    expect(html).toContain('Built by Adham Haitham');
    // Store install links come from the centralized config
    expect(html).toContain(`href="${STORE_LINKS.chrome}"`);
    expect(html).toContain(`href="${STORE_LINKS.firefox}"`);
    expect(html).toContain(`href="${STORE_LINKS.edge}"`);
  });

  it('never ships hidden cascade state in server-rendered footer markup', () => {
    // The footer cascade must fail open: content is visible by default and
    // only hidden client-side when the zone observers are actually running.
    // If SSR markup ever shipped the armed/go states, a missed observer
    // callback (fast scroll, layout shift, no-JS) would leave the footer
    // permanently blank. SSR ships the zone/step markers only.
    mockState.path = '/overview';
    mockState.status = 200;
    const { body } = render(Layout);

    expect(body).toContain('data-ft-zone');
    expect(body).toContain('data-ft');
    expect(body).not.toContain('ft-armed');
    expect(body).not.toContain('ft-go');
    expect(body).not.toContain('ft-under-live');
    expect(body).not.toContain('reveal-live');
    expect(body).not.toContain('is-revealing');
    expect(body).not.toContain('ft-mega-pending');
    expect(body).not.toContain('cqd-reveal');
  });

  it('keeps chrome visible on standard content routes', () => {
    mockState.path = '/privacy';
    mockState.status = 200;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('cqd-footer');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Built by Adham Haitham');
  });

  it('renders missing-path 404s in the full-bleed route shell', () => {
    mockState.path = '/does-not-exist';
    mockState.status = 404;
    const { body } = render(Layout);
    const html = squish(body);

    expect(html).toContain('site-main-overview-style');
    expect(html).not.toContain('class="l2-wrap"');
    expect(html).toContain('l2-nav-shell');
    expect(html).toContain('cqd-footer');
  });
});
