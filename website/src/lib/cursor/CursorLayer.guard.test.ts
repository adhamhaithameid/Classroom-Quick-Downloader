import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import CursorLayer from './CursorLayer.svelte';
import { brandedCursor, CURSOR_LIVE_CLASS } from '../actions/brandedCursor';
import { CURSOR_LAG_MS, CURSOR_SIZE_PX } from './cursorStates';

const layerSource = readFileSync(new URL('./CursorLayer.svelte', import.meta.url), 'utf8');
const actionSource = readFileSync(new URL('../actions/brandedCursor.ts', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

function squish(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

describe('branded cursor layer (docs/CURSOR.md)', () => {
  it('renders a single aria-hidden layer with pointer events disabled', () => {
    const { body } = render(CursorLayer);
    const html = squish(body);

    expect(html).toContain('cqd-cursor');
    expect(html).toContain('data-state="default"');
    expect(html).toContain('aria-hidden="true"');
    expect(layerSource).toContain('pointer-events: none');
  });

  it('stands the native cursor down site-wide only while the layer is live', () => {
    expect(CURSOR_LIVE_CLASS).toBe('cqd-cursor-live');
    expect(appCss).toContain('html.cqd-cursor-live');
    expect(appCss).toContain('cursor: none !important');
    expect(actionSource).toContain(`rootEl.classList.add(CURSOR_LIVE_CLASS)`);
    /* The class is runtime-only: no-JS markup must never hide cursors. */
    expect(appCss.indexOf('cqd-cursor-live')).toBeGreaterThan(-1);
  });

  it('activates only on fine-pointer, hover-capable devices', () => {
    expect(actionSource).toContain('(pointer: fine) and (hover: hover)');
    expect(actionSource).toContain('fine.matches');
  });

  it('pins the approved 52px size', () => {
    expect(CURSOR_SIZE_PX).toBe(52);
    expect(actionSource).toContain(`CURSOR_SIZE_PX`);
    expect(layerSource).toContain('var(--cqd-cursor-size, 52px)');
  });

  it('follows with the approved 80ms lag and no trailing layer', () => {
    expect(CURSOR_LAG_MS).toBe(80);
    expect(actionSource).toContain('CURSOR_LAG_MS');
    /* The two-layer trailing experiment was cut on review: ring and icon
       move together, so no per-layer trail offsets may exist. */
    expect(actionSource).not.toContain('--trail');
    expect(layerSource).not.toContain('--trail');
  });

  it('eases the whole cursor with the shared exponential helper', () => {
    expect(actionSource).toContain('easeExponential');
  });

  it('marks text selection and text entry with the text state', () => {
    expect(actionSource).toContain('getSelection');
    expect(actionSource).toContain('TEXT_ACTION_SELECTOR');
  });

  it('keeps buttery state transitions with a reduced-motion fallback', () => {
    expect(layerSource).toContain('transition');
    expect(layerSource).toContain('prefers-reduced-motion: reduce');
    expect(actionSource).toContain('prefers-reduced-motion: reduce');
    /* Reduced motion also removes the chase: lag snaps to zero. */
    expect(actionSource).toContain('reduced.matches ? 0 :');
  });

  it('clears the glass over actions and cards', () => {
    expect(actionSource).toContain('CLEAR_SELECTOR');
    expect(layerSource).toContain('.cqd-cursor:global(.clear) .glass');
  });

  it('tilts the arrow toward opt-in seek targets only', () => {
    expect(actionSource).toContain('SEEK_SELECTOR');
    expect(layerSource).toContain('--seek');
  });

  it('drives the progress fill from the top of the arrow downward', () => {
    expect(actionSource).toContain('PROGRESS_FILL');
    expect(layerSource).toContain('pf-rect');
  });

  it('collapses to the ring-only state over ring triggers', () => {
    expect(actionSource).toContain('RING_SELECTOR');
    expect(actionSource).toContain('isRingTarget');
    /* Ring-only: glass hidden, and no arrow glyph shows for the state. */
    expect(layerSource).toContain(".cqd-cursor:global([data-state='ring']) .glass");
    expect(layerSource).not.toContain("[data-state='ring'] .arrow-g");
  });

  it('locks the approved two-tone: white ring, solid logo-green arrow fill', () => {
    /* Chosen from prototype-cursor-green.html (variant D, arrow solid):
       the ring and glass stay white; only the download arrow turns the
       logo green, filled solid. */
    expect(layerSource).toContain('fill: #388e3c');
    expect(layerSource).toContain('.glyph .arrow-path');
    expect(layerSource).toContain('.pfill .arrow-path');
    expect(layerSource).toContain('stroke: #ffffff');
    /* No casing ring or alpha ink var: those were the rejected passes. */
    expect(layerSource).not.toContain('.ring.casing');
    expect(layerSource).not.toContain('--ink');
  });

  it('renders every approved state glyph group', () => {
    for (const group of ['arrow-g', 'ibeam', 'cross', 'cell', 'move', 'scroll', 'dbl', 'divider', 'help', 'menu', 'zoomin', 'zoomout', 'badge', 'slash', 'pfill']) {
      expect(layerSource).toContain(group);
    }
  });
});
