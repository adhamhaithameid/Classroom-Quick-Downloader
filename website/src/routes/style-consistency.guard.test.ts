import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* Style-consistency guard: every visitor-facing card/panel surface must use
   the shared glass language (tokens from app.css) instead of one-off flat
   backgrounds, legacy easings, or off-palette accents. Mirrors the source-
   level approach of overview.visual-guard.test.ts. */

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const GLASS_UNIFIED_PAGES: Array<{ file: string; label: string }> = [
  { file: './privacy/+page.svelte', label: 'privacy page cards' },
  { file: './faq/+page.svelte', label: 'faq page cards' },
  { file: './404/+page.svelte', label: '404 link cards' },
  { file: './uninstall/+page.svelte', label: 'uninstall form cards' },
  { file: './watch/cqd-demo/+page.svelte', label: 'watch demo page' },
  { file: './watch/manual-vs-cqd/+page.svelte', label: 'watch manual page' },
  { file: './site-map/+page.svelte', label: 'site map cards' },
  { file: '../lib/components/SeoContentPage.svelte', label: 'seo guide cards' },
  { file: './changelog/+page.svelte', label: 'changelog cards' },
  { file: './overview/+page.svelte', label: 'overview cards' }
];

describe('style consistency: shared glass language', () => {
  it.each(GLASS_UNIFIED_PAGES)('uses glass tokens in $label', ({ file }) => {
    const source = read(file);
    expect(source).toContain('var(--glass-bg)');
    expect(source).toContain('var(--glass-ease)');
  });

  it.each(GLASS_UNIFIED_PAGES)('drops legacy ease curve from $label', ({ file }) => {
    const source = read(file);
    expect(source).not.toContain('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(source).not.toContain('cubic-bezier(0.4,0,0.2,1)');
  });

  it.each([
    { file: './privacy/+page.svelte', label: 'privacy page' },
    { file: './404/+page.svelte', label: '404 page' },
    { file: './uninstall/+page.svelte', label: 'uninstall page' },
    { file: './watch/cqd-demo/+page.svelte', label: 'watch demo page' },
    { file: './watch/manual-vs-cqd/+page.svelte', label: 'watch manual page' },
    { file: './site-map/+page.svelte', label: 'site map page' }
  ])('keeps reduced-transparency and reduced-motion guards on $label', ({ file }) => {
    const source = read(file);
    expect(source).toContain('prefers-reduced-transparency');
    expect(source).toContain('prefers-reduced-motion');
  });

  it('keeps the shared glass tokens defined in app.css', () => {
    const css = read('../app.css');
    expect(css).toContain('--glass-ease');
    expect(css).toContain('--glass-bg');
    expect(css).toContain('--glass-border');
    expect(css).toContain('--glass-highlight');
  });

  it('keeps watch pages on the brand green, not the off-palette emerald', () => {
    for (const file of ['./watch/cqd-demo/+page.svelte', './watch/manual-vs-cqd/+page.svelte']) {
      const source = read(file);
      expect(source).not.toContain('#047857');
    }
  });

  it('keeps seo guide and site-map surfaces off solid white and hard gray borders', () => {
    const seo = read('../lib/components/SeoContentPage.svelte');
    expect(seo).not.toMatch(/background:\s*#ffffff/);
    expect(seo).not.toContain('border: 1px solid #e2e8f0');

    const siteMap = read('./site-map/+page.svelte');
    expect(siteMap).not.toMatch(/background:\s*#ffffff/);
    expect(siteMap).not.toContain('border: 1px solid #e2e8f0');
  });
});
