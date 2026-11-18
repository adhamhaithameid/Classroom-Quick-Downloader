import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, 'SiteFooter.svelte'), 'utf8');

/* Bead zp3g: hovering the footer wordmark lagged. The per-frame loop touches
   up to 9000 dots, so it must stay free of per-dot Math.hypot calls and of a
   per-frame rebuilt arc path. */
describe('footer wordmark hot loop (bead zp3g)', () => {
  it('does not call Math.hypot per dot in the physics step', () => {
    expect(src).not.toMatch(/Math\.hypot\(dx, dy\)/);
    expect(src).not.toMatch(/Math\.hypot\(p\.vx, p\.vy\)/);
  });

  it('does not rebuild a Path2D of arcs on every draw', () => {
    expect(src).not.toMatch(/new Path2D\(\)/);
    expect(src).not.toMatch(/path\.arc\(/);
  });

  it('draws dots from a pre-rendered sprite', () => {
    expect(src).toMatch(/drawImage\(sprite/);
  });

  it('blits a pre-rendered rest frame and redraws only dots that moved', () => {
    expect(src).toMatch(/drawImage\(rest,/);
    expect(src).toMatch(/clearRect\(p\.hx - r/);
  });

  it('rejects far dots with squared distance before taking a square root', () => {
    expect(src).toMatch(/REPEL_RADIUS \* REPEL_RADIUS/);
  });
});
