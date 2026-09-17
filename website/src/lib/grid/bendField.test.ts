import { describe, expect, it } from 'vitest';
import {
  BEND_DEFAULTS,
  DPR_CAP,
  FADE_EPS,
  FOLLOW,
  GRID_PITCH,
  SAMPLE_PX,
  bendOffset
} from './bendField';
import type { BendParams } from './bendField';

const NO_SWIRL: BendParams = { radius: 190, strength: 10, swirl: 0 };

function expectOffset(o: { dx: number; dy: number } | null): { dx: number; dy: number } {
  if (!o) throw new Error('expected a non-null offset');
  return o;
}

function magnitude(o: { dx: number; dy: number }): number {
  return Math.hypot(o.dx, o.dy);
}

describe('bendOffset', () => {
  it('returns null well beyond the radius (no displacement in far field)', () => {
    const r = BEND_DEFAULTS.radius;
    expect(bendOffset(3 * r, 0, 0, 0, BEND_DEFAULTS)).toBeNull();
    expect(bendOffset(-4 * r, 5 * r, 0, 0, BEND_DEFAULTS)).toBeNull();
  });

  it('offset at the cursor itself is zero (r → 0 guard, no NaN)', () => {
    const o = bendOffset(120, 80, 120, 80, BEND_DEFAULTS);
    expect(o).toEqual({ dx: 0, dy: 0 });
    expect(Number.isFinite(o?.dx ?? NaN)).toBe(true);
    expect(Number.isFinite(o?.dy ?? NaN)).toBe(true);
  });

  it('a point directly above the cursor is pushed further up with swirl 0', () => {
    // Screen coords: above the cursor means smaller y, so the away-from-cursor
    // radial unit vector is (0, -1).
    const o = expectOffset(bendOffset(300, 200, 300, 300, NO_SWIRL));
    expect(o.dx).toBe(0);
    expect(o.dy).toBeLessThan(0);
  });

  it('swirl 0.35 rotates the offset counter-clockwise relative to the radial direction', () => {
    // Point right of cursor: radial = (1, 0), tangential = (0, 1); the offset
    // should sit between them, i.e. at a positive atan2 angle off the radial.
    const o = expectOffset(bendOffset(400, 300, 300, 300, BEND_DEFAULTS));
    expect(o.dx).toBeGreaterThan(0);
    expect(o.dy).toBeGreaterThan(0);
    // offset = m * (radial + swirl * tangential) → dy/dx equals swirl exactly.
    expect(o.dy / o.dx).toBeCloseTo(BEND_DEFAULTS.swirl, 5);
    const angle = Math.atan2(o.dy, o.dx);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(Math.PI / 2);
  });

  it('displacement magnitude grows monotonically with strength', () => {
    let prev = 0;
    for (const strength of [2, 5, 10, 20, 40]) {
      const o = expectOffset(
        bendOffset(120, 40, 0, 0, { radius: 190, strength, swirl: 0.35 })
      );
      const m = magnitude(o);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it('falloff decays: offset magnitude at distance 2R is far smaller than at R', () => {
    const r = BEND_DEFAULTS.radius;
    const atR = magnitude(expectOffset(bendOffset(r, 0, 0, 0, BEND_DEFAULTS)));
    const at2R = magnitude(expectOffset(bendOffset(2 * r, 0, 0, 0, BEND_DEFAULTS)));
    expect(at2R).toBeLessThan(atR);
    expect(at2R / atR).toBeLessThan(0.1);
  });
});

describe('locked tuning constants', () => {
  it('carry the values validated in the prototype', () => {
    expect(GRID_PITCH).toBe(60);
    expect(FADE_EPS).toBe(0.004);
    expect(BEND_DEFAULTS).toEqual({ radius: 190, strength: 10, swirl: 0.35 });
    expect(FOLLOW).toBe(0.16);
    expect(DPR_CAP).toBe(2);
    expect(SAMPLE_PX).toBe(16);
  });
});
