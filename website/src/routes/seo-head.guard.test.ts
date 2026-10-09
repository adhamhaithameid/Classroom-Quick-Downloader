import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RootRedirectPage from './+page.svelte';
import { SITE_URL } from '$lib/config';

/* SERP head guard (2026-10-03 SEO pass).
   Google truncated the previous 59-char homepage title mid-word ("Bulk ...")
   because it rendered past the ~580px title-link display width. This guard
   pins the exact title/description/canonical/OG contract and the
   SoftwareApplication JSON-LD so the SERP presentation cannot silently
   drift again. Rating/review markup must NEVER appear: no real store-rating
   data is wired, and fabricating it is forbidden. */

const EXPECTED_TITLE = 'Classroom Quick Downloader — Google Classroom Files';
const EXPECTED_DESCRIPTION =
  'Bulk download all Google Classroom attachments in one click. Free browser extension for Chrome, Firefox, and Edge, built for students and teachers.';
const EXPECTED_CANONICAL = `${SITE_URL.replace(/\/+$/, '')}/`;

function meta(head: string, attr: string): string | null {
  const match = head.match(new RegExp(`<meta ${attr} content="([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

function jsonLdItems(head: string): Array<Record<string, unknown>> {
  return [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .flatMap((match) => {
      try {
        return JSON.parse(match[1].trim()) as unknown;
      } catch {
        return [];
      }
    })
    .flat() as Array<Record<string, unknown>>;
}

describe('homepage SERP head guard', () => {
  it('renders the truncation-safe title within the 60-char budget', () => {
    const { head } = render(RootRedirectPage);
    expect(head).toContain(`<title>${EXPECTED_TITLE}</title>`);
    expect(EXPECTED_TITLE.length).toBeLessThanOrEqual(60);
    // The legacy title's tail was the part Google cut off mid-word.
    expect(EXPECTED_TITLE).not.toContain('Bulk Download');
    expect(EXPECTED_TITLE).toContain('Google Classroom');
  });

  it('keeps the meta description inside the ~160-char SERP budget', () => {
    const { head } = render(RootRedirectPage);
    expect(meta(head, 'name="description"')).toBe(EXPECTED_DESCRIPTION);
    expect(EXPECTED_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(EXPECTED_DESCRIPTION.length).toBeGreaterThanOrEqual(80);
  });

  it('canonicalizes to the live domain root', () => {
    const { head } = render(RootRedirectPage);
    expect(head).toContain(`<link rel="canonical" href="${EXPECTED_CANONICAL}"`);
    expect(EXPECTED_CANONICAL).toContain('classroom-quick-downloader.adhamhaithameid.is-a.dev');
    // The legacy pages.dev host must never leak into canonical or OG tags.
    expect(head).not.toContain('pages.dev');
  });

  it('renders hreflang self-reference and x-default', () => {
    const { head } = render(RootRedirectPage);
    expect(head).toContain(`<link rel="alternate" hreflang="en" href="${EXPECTED_CANONICAL}"`);
    expect(head).toContain(`<link rel="alternate" hreflang="x-default" href="${EXPECTED_CANONICAL}"`);
  });

  it('renders the OG/Twitter card with the 1200x630 social image', () => {
    const { head } = render(RootRedirectPage);
    expect(head).toContain('og:type" content="website"');
    expect(head).toContain('og:site_name" content="Classroom Quick Downloader"');
    expect(meta(head, 'property="og:title"')).toBe(EXPECTED_TITLE);
    expect(meta(head, 'property="og:description"')).toBe(EXPECTED_DESCRIPTION);
    expect(meta(head, 'property="og:url"')).toBe(EXPECTED_CANONICAL);
    expect(meta(head, 'property="og:image:width"')).toBe('1200');
    expect(meta(head, 'property="og:image:height"')).toBe('630');
    expect(meta(head, 'property="og:image"')).toBe(`${EXPECTED_CANONICAL}images/cqd-social-card.png`);
    expect(meta(head, 'name="twitter:card"')).toBe('summary_large_image');
    expect(meta(head, 'name="twitter:image"')).toBe(`${EXPECTED_CANONICAL}images/cqd-social-card.png`);
  });

  it('keeps the homepage indexable', () => {
    const { head } = render(RootRedirectPage);
    expect(head).toContain('index, follow');
    expect(head).not.toContain('noindex, nofollow');
  });

  it('SoftwareApplication JSON-LD is spec-complete and rating-free', () => {
    const { head } = render(RootRedirectPage);
    const app = jsonLdItems(head).find((item) => item['@type'] === 'SoftwareApplication');
    expect(app).toBeDefined();
    expect(app?.['applicationCategory']).toBe('BrowserApplication');
    expect(typeof app?.['browserRequirements']).toBe('string');
    expect(String(app?.['browserRequirements'])).toContain('Firefox');
    expect(app?.['operatingSystem']).toContain('Chrome');
    expect(app?.['isAccessibleForFree']).toBe(true);
    const offers = app?.['offers'] as Record<string, unknown> | undefined;
    expect(offers?.['price']).toBe('0');
    expect(offers?.['priceCurrency']).toBe('USD');

    // No rating or review markup anywhere in the head: the extension's store
    // ratings are not wired to this site, so none may be fabricated.
    expect(head).not.toMatch(/aggregateRating|ratingValue|reviewCount|bestRating/i);
  });
});
