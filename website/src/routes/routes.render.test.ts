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
import DownloadAllAttachmentsPage from './download-all-attachments-google-classroom/+page.svelte';
import InstallChromePage from './install/chrome/+page.svelte';
import SecurityPage from './security/+page.svelte';
import CompareClassfetchPage from './compare/classroom-quick-downloader-vs-classfetch/+page.svelte';
import { privacyContent } from '$lib/content/privacy';

function squish(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

describe('route render smoke coverage', () => {
  it('renders root redirect fallback and metadata', () => {
    const { body, head } = render(RootRedirectPage);
    const html = squish(body);

    expect(html).toContain('Redirecting…');
    expect(head).toContain('Classroom Quick Downloader — Redirecting To Overview');
    expect(head).toContain('noindex, nofollow');
    expect(head).toContain('/overview');
  });

  it('renders landing2 redirect fallback and metadata', () => {
    const { body, head } = render(Landing2RedirectPage);
    const html = squish(body);

    expect(html).toContain('Redirecting…');
    expect(head).toContain('Classroom Quick Downloader — Redirecting To Overview');
    expect(head).toContain('noindex, nofollow');
  });

  it('renders overview page shell, hero copy, and CTA sections', () => {
    const { body, head } = render(OverviewPage);
    const html = squish(body);

    expect(head).toContain('Download All Google Classroom Files In One Click');
    expect(head).toContain('SoftwareApplication');
    expect(head).toContain('/overview');
    expect(html).toContain('Download all Google Classroom files');
    expect(html).toContain('Ready to save hours?');
    expect(html).toContain('See where Classroom Quick Downloader is used around the world.');
    expect(html).toContain('l2-page-floats');
    expect(html).not.toContain('Element Editor');
  });

  it('renders changelog loading state and refresh actions', () => {
    const { body, head } = render(ChangelogPage);
    const html = squish(body);

    expect(head).toContain('Changelog — Classroom Quick Downloader');
    expect(head).toContain('/changelog');
    expect(html).toContain('RELEASE HISTORY');
    expect(html).toContain('v1.3.9');
    expect(html).toContain('Open changelog on GitHub');
  });

  it('renders uninstall feedback flow and reinstall actions', () => {
    const { body, head } = render(UninstallPage);
    const html = squish(body);

    expect(head).toContain('Uninstall Feedback — Classroom Quick Downloader');
    expect(head).toContain('noindex, nofollow');
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
    expect(head).toContain('noindex, nofollow');
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
    expect(head).toContain('/privacy');
    expect(html).toContain(privacyContent.headline);
    expect(html).toContain(privacyContent.sections[0]?.title ?? '');
    expect(html).toContain(privacyContent.sections[1]?.title ?? '');
    expect(html).toContain('Read full privacy policy');
    expect(html).toContain('Zero cookies');
    expect(html).toContain('No third-party tracking');
    expect(html).toContain('Zero personal data');
  });

  it('renders FAQ page with multiple sections and known questions', () => {
    const { body, head } = render(FaqPage);
    const html = squish(body);

    expect(head).toContain('FAQ');
    expect(head).toContain('/faq');
    expect(head).toContain('FAQPage');
    expect(html).toContain('Frequently Asked Questions');
    expect(html).toContain('Quick answers students search for most');
    expect(html).toContain('What is Classroom Quick Downloader?');
    expect(html).toContain('Which browsers are supported?');
    expect(html).toContain('How does');
    expect(html).toContain('Where is the source code?');
    expect(html).toContain('For Students');
    expect(html).toContain('For Developers');
    expect(html).toContain('Search questions');
  });

  it('renders SEO use-case page content and canonical metadata', () => {
    const { body, head } = render(DownloadAllAttachmentsPage);
    const html = squish(body);

    expect(head).toContain('/download-all-attachments-google-classroom');
    expect(html).toContain('How To Download All Attachments From Google Classroom');
    expect(html).toContain('Install for Chrome');
  });

  it('renders browser install SEO page', () => {
    const { body, head } = render(InstallChromePage);
    const html = squish(body);

    expect(head).toContain('/install/chrome');
    expect(html).toContain('Install CQD For Chrome');
    expect(html).toContain('Install from Chrome Web Store');
  });

  it('renders trust and comparison SEO pages', () => {
    const securityRendered = render(SecurityPage);
    const compareRendered = render(CompareClassfetchPage);
    const securityHtml = squish(securityRendered.body);
    const compareHtml = squish(compareRendered.body);

    expect(securityRendered.head).toContain('/security');
    expect(securityHtml).toContain('Security Overview');
    expect(compareRendered.head).toContain('/compare/classroom-quick-downloader-vs-classfetch');
    expect(compareHtml).toContain('Classroom Quick Downloader vs Classfetch');
  });

});
