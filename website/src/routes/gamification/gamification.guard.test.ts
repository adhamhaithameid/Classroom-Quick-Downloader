import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import GamificationPage from './+page.svelte';
import { SITE_URL } from '$lib/config';
import { INDEXABLE_SITE_PATHS, SITE_PATH_LASTMOD, lastModForPath } from '$lib/seo/site';

/* SERP head guard for /gamification (levels + milestone celebrations page).
   Same contract as seo-head.guard.test.ts: the title/description/canonical
   cannot silently drift, and the page must keep rendering the full 18-level
   ladder table (level 0 row plus 18 rungs). */

const EXPECTED_TITLE = 'Classroom Quick Downloader Levels and Milestones';
const EXPECTED_DESCRIPTION =
  'How Classroom Quick Downloader levels work: start at level 0, reach level 1 with your first download, and climb to level 18 at one million files.';
const EXPECTED_CANONICAL = `${SITE_URL.replace(/\/+$/, '')}/gamification`;

function meta(head: string, attr: string): string | null {
  const match = head.match(new RegExp(`<meta ${attr} content="([^"]*)"`, 'i'));
  return match ? match[1] : null;
}

describe('gamification page SERP head guard', () => {
  it('renders the brand-front-loaded title within the 60-char budget', () => {
    const { head } = render(GamificationPage);
    expect(head).toContain(`<title>${EXPECTED_TITLE}</title>`);
    expect(EXPECTED_TITLE.length).toBeLessThanOrEqual(60);
    expect(EXPECTED_TITLE.startsWith('Classroom Quick Downloader')).toBe(true);
  });

  it('keeps the meta description inside the 155-char budget', () => {
    const { head } = render(GamificationPage);
    expect(meta(head, 'name="description"')).toBe(EXPECTED_DESCRIPTION);
    expect(EXPECTED_DESCRIPTION.length).toBeLessThanOrEqual(155);
  });

  it('canonicalizes to the /gamification route on the live domain', () => {
    const { head } = render(GamificationPage);
    expect(head).toContain(`<link rel="canonical" href="${EXPECTED_CANONICAL}"`);
    expect(head).not.toContain('pages.dev');
  });

  it('renders a single h1', () => {
    const { body } = render(GamificationPage);
    const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].trim());
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toContain('Levels and Milestones');
  });

  it('renders the full 18-level ladder table', () => {
    const { body } = render(GamificationPage);
    // One confetti cell per rung: exactly 18 celebration rows, level 1 to 18.
    const celebrationCells = body.match(/Confetti burst at/g) ?? [];
    expect(celebrationCells).toHaveLength(18);
    // The level 0 row is present, and the rung extremes render grouped.
    expect(body).toContain('Your starting point');
    expect(body).toMatch(/<td[^>]*>1<\/td><td[^>]*>1<\/td><td[^>]*>Confetti burst at 1 file<\/td>/);
    expect(body).toMatch(
      /<td[^>]*>18<\/td><td[^>]*>1,000,000<\/td><td[^>]*>Confetti burst at 1,000,000 files<\/td>/,
    );
  });

  it('stays indexable and in the sitemap with a curated lastmod', () => {
    const { head } = render(GamificationPage);
    expect(head).toContain('index, follow');
    expect(head).not.toContain('noindex, nofollow');
    expect(INDEXABLE_SITE_PATHS).toContain('/gamification');
    expect(SITE_PATH_LASTMOD['/gamification']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lastModForPath('/gamification')).toBe(SITE_PATH_LASTMOD['/gamification']);
  });
});
