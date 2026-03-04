import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RootRedirectPage from './+page.svelte';
import Landing2RedirectPage from './landing2/+page.svelte';
import OverviewPage from './overview/+page.svelte';
import ChangelogPage from './changelog/+page.svelte';
import PrivacyPage from './privacy/+page.svelte';
import FaqPage from './faq/+page.svelte';
import UninstallPage from './uninstall/+page.svelte';
import NotFoundPage from './404/+page.svelte';
import { privacyContent } from '$lib/content/privacy';

function squish(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

describe('route render smoke coverage', () => {
  it('renders root redirect fallback and metadata', () => {
    const { body, head } = render(RootRedirectPage);
    const html = squish(body);

    expect(html).toContain('Redirecting…');
    expect(head).toContain('Classroom Quick Downloader — The Free Extension That Supercharges Google Classroom');
  });

  it('renders landing2 redirect fallback and metadata', () => {
    const { body, head } = render(Landing2RedirectPage);
    const html = squish(body);

    expect(html).toContain('Redirecting…');
    expect(head).toContain('Classroom Quick Downloader — Overview');
  });

  it('renders overview page shell, hero copy, and CTA sections', () => {
    const { body, head } = render(OverviewPage);
    const html = squish(body);

    expect(head).toContain('The Free Extension That Supercharges Google Classroom');
    expect(html).toContain('The free extension that');
    expect(html).toContain('supercharges');
    expect(html).toContain('Ready to save hours?');
    expect(html).toContain('See where Classroom Quick Downloader is used around the world.');
    expect(html).toContain('l2-page-floats');
    expect(html).not.toContain('Element Editor');
  });

  it('renders changelog loading state and refresh actions', () => {
    const { body, head } = render(ChangelogPage);
    const html = squish(body);

    expect(head).toContain('Changelog — Classroom Quick Downloader');
    expect(html).toContain('Loading changelog from the servers');
    expect(html).toContain('Open changelog on GitHub');
  });

  it('renders uninstall feedback flow and reinstall actions', () => {
    const { body, head } = render(UninstallPage);
    const html = squish(body);

    expect(head).toContain('Uninstall Feedback — Classroom Quick Downloader');
    expect(html).toContain("We'd love to hear why.");
    expect(html).toContain('What made you uninstall?');
    expect(html).toContain('Submit feedback');
    expect(html).toContain('Reinstall for Chrome');
    expect(html).toContain('Firefox');
    expect(html).toContain('Edge');
  });

  it('renders the 404 page with not-found messaging and navigation', () => {
    const { body, head } = render(NotFoundPage);
    const html = squish(body);

    expect(head).toContain('404 — Classroom Quick Downloader');
    expect(html).toContain('Page not found');
    expect(html).toContain('Go home');
    expect(html).toContain('Browse FAQ');
    expect(html).toContain('Overview');
    expect(html).toContain('Changelog');
  });

  it('renders privacy page content from the privacy data module', () => {
    const { body, head } = render(PrivacyPage);
    const html = squish(body);

    expect(head).toContain('Privacy — Classroom Quick Downloader');
    expect(html).toContain(privacyContent.headline);
    expect(html).toContain(privacyContent.sections[0]?.title ?? '');
    expect(html).toContain(privacyContent.sections[1]?.title ?? '');
    expect(html).toContain('Read full privacy policy');
    expect(html).toContain('Zero cookies');
    expect(html).toContain('Zero tracking');
    expect(html).toContain('Zero personal data');
  });

  it('renders FAQ page with multiple sections and known questions', () => {
    const { body, head } = render(FaqPage);
    const html = squish(body);

    expect(head).toContain('FAQ');
    expect(html).toContain('Frequently Asked Questions');
    expect(html).toContain('What is Classroom Quick Downloader?');
    expect(html).toContain('Which browsers are supported?');
    expect(html).toContain('How does');
    expect(html).toContain('Where is the source code?');
    expect(html).toContain('For Students');
    expect(html).toContain('For Developers');
    expect(html).toContain('Search questions');
  });

});
