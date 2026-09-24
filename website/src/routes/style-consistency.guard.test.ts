import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* Style-consistency guard: every visitor-facing card/panel surface consumes
   the shared glass design system (.glass-panel / .glass-hover / .glass-icon
   from lib/styles/glass.css) instead of re-declaring surfaces, sheens,
   sweeps, hovers, or guards per component. Also pins the single shared
   ambient background: one layout-mounted component, no per-page copies. */

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const GLASS_CONSUMERS: Array<{ file: string; label: string }> = [
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

const AMBIENT_COPIES_GONE: Array<{ file: string; marker: string; label: string }> = [
  { file: './overview/+page.svelte', marker: 'class="l2-page-orbs"', label: 'overview' },
  { file: './overview/+page.svelte', marker: 'class="l2-page-grid"', label: 'overview' },
  {
    file: './overview-editor/+page.svelte',
    marker: 'class="l2-page-orbs"',
    label: 'overview editor'
  },
  { file: './uninstall/+page.svelte', marker: 'class="un-orbs"', label: 'uninstall' },
  { file: './uninstall/+page.svelte', marker: 'class="un-grid-bg"', label: 'uninstall' },
  { file: './404/+page.svelte', marker: 'class="nf-orbs"', label: '404' },
  { file: './404/+page.svelte', marker: 'class="nf-grid-bg"', label: '404' },
  { file: './+error.svelte', marker: 'class="err-orbs"', label: 'error page' },
  {
    file: '../lib/components/SiteFooter.svelte',
    marker: 'class="ft-pattern"',
    label: 'footer'
  },
  { file: '../lib/components/SiteFooter.svelte', marker: 'ft-orb', label: 'footer' },
  { file: './faq/+page.svelte', marker: 'fq-grid-bg', label: 'faq' },
  { file: './privacy/+page.svelte', marker: 'prv-grid-bg', label: 'privacy' },
  { file: './changelog/+page.svelte', marker: 'cl-grid-bg', label: 'changelog' }
];

describe('style consistency: shared glass design system', () => {
  it('defines the shared glass utilities once in lib/styles/glass.css', () => {
    const css = read('../lib/styles/glass.css');

    expect(css).toContain('.glass-panel');
    expect(css).toContain('.glass-hover');
    expect(css).toContain('.glass-icon');
    // Surface + focus/hover guards all live in the shared file. The static
    // sheen and the cursor-tracked sweep were removed: the sheen painted
    // ABOVE card content, and the stacked hover layers read as extreme.
    expect(css).toContain('var(--glass-bg)');
    expect(css).not.toContain('linear-gradient(180deg, rgba(255, 255, 255, 0.8)');
    expect(css).not.toContain('.glass-panel::before');
    expect(css).not.toContain('--card-mx');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('prefers-reduced-transparency');
    expect(css).toContain('@keyframes card-glass-in');
  });

  it('imports the shared glass stylesheet from app.css and keeps the tokens there', () => {
    const css = read('../app.css');
    expect(css).toContain('./lib/styles/glass.css');
    expect(css).toContain('--glass-bg');
    expect(css).toContain('--glass-ease');
    expect(css).toContain('--glass-border');
    expect(css).toContain('--glass-highlight');
  });

  it.each(GLASS_CONSUMERS)('$label consume the shared glass classes', ({ file }) => {
    const source = read(file);
    expect(source).toContain('glass-panel');
  });

  it.each(GLASS_CONSUMERS)('$label drop legacy ease curve and per-page guard duplicates', ({ file }) => {
    const source = read(file);
    expect(source).not.toContain('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(source).not.toContain('cubic-bezier(0.4,0,0.2,1)');
    // Guards are global for utility consumers. A page may keep at most ONE
    // reduced-transparency fallback block for bespoke non-utility surfaces
    // (form fields, sub-rows) — never the old per-card duplication.
    const rtBlocks = source.split('prefers-reduced-transparency').length - 1;
    expect(rtBlocks).toBeLessThanOrEqual(1);
  });

  it('keeps the watch pages on the brand green, not the off-palette emerald', () => {
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

describe('style consistency: floating entities scoping', () => {
  it('resolves placement svg through one shared catalog helper', () => {
    const placements = read('../lib/svgCatalog/placements.ts');
    expect(placements).toContain('export function resolvePlacementSvg');
    const overview = read('./overview/+page.svelte');
    expect(overview).toContain('resolvePlacementSvg');
  });

  it('keeps the entity layer scoped to the overview and its editor', () => {
    // Entities are the overview's editor-connected placement system.
    expect(read('./overview/+page.svelte')).toContain('l2-page-floats');
    expect(read('./overview-editor/+page.svelte')).toContain('l2-page-floats');
    // Nowhere else ships an entity layer.
    for (const file of [
      './changelog/+page.svelte',
      './faq/+page.svelte',
      './privacy/+page.svelte',
      './404/+page.svelte',
      './uninstall/+page.svelte',
      './site-map/+page.svelte'
    ]) {
      expect(read(file)).not.toContain('l2-page-floats');
    }
  });
});

describe('style consistency: one shared ambient background', () => {
  it('renders the pastel orb field + grid from the layout-mounted component', () => {
    const ambient = read('../lib/components/AmbientBackground.svelte');
    expect(ambient).toContain('class="l2-page-orbs"');
    expect(ambient).toContain('class="l2-page-grid"');
    // The user's original look: pastel drifting orbs, no hue-cycle.
    expect(ambient).toContain('orb-drift');
    expect(ambient).not.toContain('aurora-hue');
    expect(ambient).toContain('#bbf7d0');
    expect(ambient).toContain('#a5f3fc');
    expect(ambient).toContain('#e0e7ff');
    // Grid texture: subtle, per the deployed background (user-set 0.05).
    expect(ambient).toMatch(/opacity:\s*0\.05/);
    expect(ambient).toContain('linear-gradient');
    expect(ambient).toContain('prefers-reduced-motion');
    // Entities live ONLY in the overview/editor's own layer.
    expect(ambient).not.toContain('l2-page-floats');
    expect(ambient).not.toContain('defaultPlacements');

    const layout = read('./+layout.svelte');
    expect(layout).toContain('AmbientBackground');
    expect(layout).not.toContain('withFloats');
  });

  it.each(AMBIENT_COPIES_GONE)('$label no longer re-implements the background', ({ file, marker }) => {
    const source = read(file);
    expect(source).not.toContain(marker);
  });

  it('pins the cursor-bend canvas and its gating in the ambient component', () => {
    const ambient = read('../lib/components/AmbientBackground.svelte');
    // Full canvas markup, verbatim: aria-hidden, nested inside the
    // .l2-page-grid wrapper (the wrapper's opacity composites the canvas),
    // gated behind the `lens` prop — the sticky sheet reveal's footer
    // window renders a lens-less ambient copy with the static CSS grid —
    // and carrying the `paused` prop into the action, so a hidden instance
    // (occluded sheet, hidden footer window) never paints at all.
    expect(ambient).toContain(
      `<div class="l2-page-grid" class:ambient-paused={paused} aria-hidden="true">
  {#if lens}
    <canvas class="l2-grid-canvas" aria-hidden="true" use:gridBend={{ paused }}></canvas>
  {/if}
</div>`
    );
    expect(ambient).toContain('export let lens = true');
    expect(ambient).toContain('export let paused = false');
    // A paused instance freezes its orb drift (visibility:hidden alone does
    // not stop animation clocks).
    expect(ambient).toMatch(/\.ambient-paused[^{]*\{[^}]*animation-play-state:\s*paused/);
    // The canvas is display:none until the action activates, and never
    // intercepts pointers.
    expect(ambient).toMatch(/\.l2-grid-canvas\s*\{[^}]*pointer-events:\s*none/);
    // bend-live stands down the CSS gradient only while the canvas paints.
    expect(ambient).toContain('.bend-live');

    const action = read('../lib/actions/gridBend.ts');
    expect(action).toContain('prefers-reduced-motion');
    expect(action).toContain('pointer: fine');
    // The action accepts the paused param and sleeps a fully relaxed field
    // (influence ~0 with the pointer gone) back to the CSS grid.
    expect(action).toContain('applyPaused');
    expect(action).toMatch(/else if \(!inside && active\)/);
  });

  it('keeps the app-level body pseudo-orbs restored as part of the original look', () => {
    const css = read('../app.css');
    expect(css).toContain('body::before');
    expect(css).toContain('body::after');
    expect(css).toContain('@keyframes floatOrb');
    // The canvas color lives on html; body stays transparent so the fixed
    // orbs always paint above the canvas, below content.
    expect(css).toContain('background: var(--bg)');
  });
});
