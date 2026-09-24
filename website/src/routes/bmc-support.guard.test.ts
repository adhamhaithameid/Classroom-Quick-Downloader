import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* Buy Me a Coffee production guard.
   The support button went missing in production because the layout referenced
   /bmc-button.svg while the asset itself was never committed — nothing failed
   at build time, the <img> just rendered empty. This guard pins every BMC
   surface to a real, tracked asset so a missing file fails CI loudly. */

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const layout = read('./+layout.svelte');
const footer = read('../lib/components/SiteFooter.svelte');
const BMC_URL = 'https://www.buymeacoffee.com/adhamhaithameid';

describe('Buy Me a Coffee support surfaces (production guard)', () => {
  it('ships the official button art in /static', () => {
    const asset = new URL('../../static/bmc-button.svg', import.meta.url);
    expect(existsSync(asset)).toBe(true);
    const svg = read('../../static/bmc-button.svg');
    expect(svg.trimStart().startsWith('<svg') || svg.includes('<svg')).toBe(true);
    expect(svg.length).toBeGreaterThan(1000);
    expect(svg).toContain('viewBox="0 0 545 153"');
  });

  it('keeps the official logo asset available', () => {
    expect(existsSync(new URL('../../static/bmc-logo.svg', import.meta.url))).toBe(true);
  });

  it('references only BMC assets that actually exist in /static', () => {
    const refs = [...layout.matchAll(/src="(\/bmc-[^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(2);
    for (const ref of refs) {
      expect(existsSync(new URL(`../../static${ref}`, import.meta.url)), ref).toBe(true);
    }
  });

  it('renders the button in the nav hover panels and the GitHub mirror card', () => {
    expect(layout.match(/src="\/bmc-button\.svg"/g)?.length).toBe(2);
  });

  it('points every donation link at the official profile', () => {
    expect(layout).toContain(BMC_URL);
    expect(footer).toContain(BMC_URL);
    expect((layout.match(/href=\{BUY_COFFEE_URL\}/g) ?? []).length).toBe(2);
    expect((footer.match(/href=\{BUY_COFFEE_URL\}/g) ?? []).length).toBe(1);
  });

  it('keeps donation links external-safe and SEO-clean', () => {
    const anchorBlocks = [
      ...(layout.match(/<a\s[^>]*href=\{BUY_COFFEE_URL\}[\s\S]*?<\/a>/g) ?? []),
      ...(footer.match(/<a\s[^>]*href=\{BUY_COFFEE_URL\}[\s\S]*?<\/a>/g) ?? []),
    ];
    expect(anchorBlocks.length).toBe(3);
    for (const block of anchorBlocks) {
      expect(block).toContain('target="_blank"');
      expect(block).toContain('rel="noopener noreferrer nofollow"');
    }
  });

  it('keeps images accessible and layout-stable', () => {
    const imgs = layout.match(/<img[^>]+src="\/bmc-button\.svg"[^>]*>/g) ?? [];
    expect(imgs.length).toBe(2);
    for (const img of imgs) {
      expect(img).toContain('alt="Buy Me a Coffee"');
      expect(img).toContain('width="545"');
      expect(img).toContain('height="153"');
      expect(img).toContain('loading="lazy"');
    }
  });
});
