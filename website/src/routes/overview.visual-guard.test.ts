import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import defaultPlacementsSeed from '$lib/svgCatalog/defaultPlacements.v2.json';
import OverviewPage from './overview/+page.svelte';

function squish(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap';

describe('overview visual guardrails', () => {
  it('keeps Plus Jakarta Sans preloaded and does not reintroduce Inter', () => {
    const { head } = render(OverviewPage);
    const normalizedHead = squish(head);

    expect(normalizedHead).toContain('Plus+Jakarta+Sans');
    expect(normalizedHead).not.toContain('family=Inter');
  });

  it('delivers Plus Jakarta Sans from app.html via preconnects and a display=swap stylesheet', () => {
    const html = readFileSync(new URL('../app.html', import.meta.url), 'utf8');

    // Preconnects must be discovered at HTML parse time on every route and
    // sit before the stylesheet link so the font handshake starts early.
    const googleapisPreconnect = html.indexOf(
      '<link rel="preconnect" href="https://fonts.googleapis.com"'
    );
    const gstaticPreconnect = html.indexOf(
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin'
    );
    const stylesheetMatch = html.match(/<link\s[^>]*rel="stylesheet"[^>]*>/);
    expect(googleapisPreconnect).toBeGreaterThan(-1);
    expect(gstaticPreconnect).toBeGreaterThan(-1);
    expect(stylesheetMatch).not.toBeNull();

    const stylesheetTag = stylesheetMatch![0];
    expect(stylesheetTag).toContain(`href="${FONT_STYLESHEET_URL}"`);
    expect(googleapisPreconnect).toBeLessThan(html.indexOf(stylesheetTag));
    expect(gstaticPreconnect).toBeLessThan(html.indexOf(stylesheetTag));

    // Plus Jakarta Sans stays the primary UI font; never Inter.
    expect(html).not.toContain('family=Inter');
  });

  it('keeps required decorative containers for floating and 3D systems', () => {
    const { body } = render(OverviewPage);
    const html = squish(body);

    // The floating entities are rendered by the overview's own
    // editor-connected layer; orbs + grid come from the shared component.
    expect(html).toContain('l2-page-floats');
    expect(html).not.toContain('class="l2-page-orbs"');
    expect(html).not.toContain('class="l2-page-grid"');
  });

  it('sources the shared ambient background (orbs + grid) from the layout-mounted component', () => {
    const ambient = readFileSync(
      new URL('../lib/components/AmbientBackground.svelte', import.meta.url),
      'utf8'
    );
    expect(ambient).toContain('class="l2-page-orbs"');
    expect(ambient).toContain('class="l2-page-grid"');
    expect(ambient).toContain('@keyframes orb-drift');
    expect(ambient).toContain('prefers-reduced-motion');

    const layout = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');
    expect(layout).toContain('AmbientBackground');
  });

  it('keeps a minimum default placement mix and pinned supercharge star', () => {
    const placements = defaultPlacementsSeed.placements;
    const counts = placements.reduce(
      (acc, placement) => {
        acc.total += 1;
        if (placement.type === 'float') acc.float += 1;
        if (placement.type === 'doodle') acc.doodle += 1;
        if (placement.type === '3d') acc.threeD += 1;
        acc.sections.add(placement.section);
        return acc;
      },
      {
        total: 0,
        float: 0,
        doodle: 0,
        threeD: 0,
        sections: new Set<string>()
      }
    );

    expect(counts.total).toBeGreaterThanOrEqual(24);
    expect(counts.float).toBeGreaterThanOrEqual(8);
    expect(counts.doodle).toBeGreaterThanOrEqual(10);
    expect(counts.threeD).toBeGreaterThanOrEqual(2);
    expect(counts.sections.has('hero')).toBe(true);
    expect(counts.sections.has('features')).toBe(true);
    expect(counts.sections.has('proof')).toBe(true);
    expect(counts.sections.has('cta')).toBe(true);

    const pinnedStar = placements.find((placement) => placement.id === 'dd-1772174598462-101');
    expect(pinnedStar?.sampleId).toBe('D-50');
    expect(pinnedStar?.type).toBe('doodle');
  });

  it('renders the disclaimer and store CTAs without overclaiming', () => {
    const { body } = render(OverviewPage);
    const html = squish(body);

    // The page promises exactly what the extension does - no more.
    expect(html).toContain('in one click for every assignment');
    expect(html).toContain('Not affiliated with Google or Google Classroom.');
    expect(html).toContain('Also works on Brave');

    // Store CTAs point at the real listings and open safely.
    expect(html).toContain('chromewebstore.google.com/detail/classroom-quick-downloade');
    expect(html).toContain('addons.mozilla.org/en-US/firefox/addon/classroom-quick-downloader');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('keeps global font token, metric fallback face, and ambient background rules in app.css', () => {
    const css = readFileSync(new URL('../app.css', import.meta.url), 'utf8');

    // Fonts are delivered from app.html now; a CSS @import would be
    // render-blocking and only discovered after the CSS itself downloads.
    expect(css).not.toContain(`@import url('https://fonts.googleapis.com`);

    // Metric-adjusted fallback face keeps line breaks and vertical rhythm
    // stable while the webfont downloads. It must resolve from locally
    // installed fonts only — no remote fetches, no bundled font files.
    const fallbackFace = css.match(/@font-face\s*\{[^{}]*'Plus Jakarta Sans Fallback'[^{}]*\}/);
    expect(fallbackFace).not.toBeNull();
    const face = fallbackFace![0];
    expect(face).toMatch(/src:\s*local\(/);
    expect(face).not.toMatch(/url\(/);
    expect(face).toMatch(/size-adjust:/);
    expect(face).toMatch(/ascent-override:/);
    expect(face).toMatch(/descent-override:/);
    expect(face).toMatch(/line-gap-override:/);

    // Primary font must stay ahead of the metric fallback in the stack.
    expect(css).toContain(
      "--font-ui: 'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;"
    );

    // The shared glass design system lives in app.css; the original body
    // pseudo-orbs are restored as part of the user's background.
    expect(css).toContain('./lib/styles/glass.css');
    expect(css).toContain('--glass-bg');
    expect(css).toContain('--glass-ease');
    expect(css).toContain('body::before');
    expect(css).toContain('body::after');
    expect(css).toContain('@keyframes floatOrb');
  });
});
