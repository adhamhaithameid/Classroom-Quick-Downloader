import { describe, expect, it } from 'vitest';
import {
  BEND_DEFAULTS,
  DPR_CAP,
  FOLLOW,
  GRID_PITCH,
  SAMPLE_PX,
  bendOffset
} from './bendField';
import type { BendParams } from './bendField';

function expectOffset(o: { dx: number; dy: number } | null): { dx: number; dy: number } {
  if (!o) throw new Error('expected a non-null offset');
  return o;
}

function magnitude(o: { dx: number; dy: number }): number {
  return Math.hypot(o.dx, o.dy);
}

describe('bendOffset (lens)', () => {
  it('returns null at exactly r == radius and well beyond it (hard lens boundary)', () => {
    const r = BEND_DEFAULTS.radius;
    expect(bendOffset(r, 0, 0, 0, BEND_DEFAULTS)).toBeNull();
    expect(bendOffset(3 * r, 0, 0, 0, BEND_DEFAULTS)).toBeNull();
    expect(bendOffset(-4 * r, 5 * r, 0, 0, BEND_DEFAULTS)).toBeNull();
  });

  it('offset at the cursor is exactly {dx: 0, dy: 0} and finite', () => {
    const o = bendOffset(120, 80, 120, 80, BEND_DEFAULTS);
    expect(o).toEqual({ dx: 0, dy: 0 });
    expect(Number.isFinite(o?.dx ?? NaN)).toBe(true);
    expect(Number.isFinite(o?.dy ?? NaN)).toBe(true);
  });

  it('offset points directly away from the cursor (point right of cursor: dx > 0, dy === 0)', () => {
    const o = expectOffset(bendOffset(400, 300, 300, 300, BEND_DEFAULTS));
    expect(o.dx).toBeGreaterThan(0);
    expect(o.dy).toBe(0);
  });

  it('single-bump profile: |offset| at 0.45R exceeds both 0.15R and 0.95R', () => {
    const r = BEND_DEFAULTS.radius;
    const at045 = magnitude(expectOffset(bendOffset(0.45 * r, 0, 0, 0, BEND_DEFAULTS)));
    const at015 = magnitude(expectOffset(bendOffset(0.15 * r, 0, 0, 0, BEND_DEFAULTS)));
    const at095 = magnitude(expectOffset(bendOffset(0.95 * r, 0, 0, 0, BEND_DEFAULTS)));
    expect(at045).toBeGreaterThan(at015);
    expect(at045).toBeGreaterThan(at095);
  });

  it('peak magnitude sweep across the radius lands in [9, 10.5] px at defaults', () => {
    const r = BEND_DEFAULTS.radius;
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      const t = i / 400;
      const o = expectOffset(bendOffset(t * r, 0, 0, 0, BEND_DEFAULTS));
      peak = Math.max(peak, magnitude(o));
    }
    expect(peak).toBeGreaterThanOrEqual(9);
    expect(peak).toBeLessThanOrEqual(10.5);
  });

  it('offset scales monotonically with strength (same point, strength 20 >= strength 10)', () => {
    const p10: BendParams = { radius: 190, strength: 10 };
    const p20: BendParams = { radius: 190, strength: 20 };
    const m10 = magnitude(expectOffset(bendOffset(120, 40, 0, 0, p10)));
    const m20 = magnitude(expectOffset(bendOffset(120, 40, 0, 0, p20)));
    expect(m20).toBeGreaterThanOrEqual(m10);
  });
});

describe('locked tuning constants', () => {
  it('carry the values validated in the prototype', () => {
    expect(BEND_DEFAULTS).toEqual({ radius: 190, strength: 10 });
    expect(GRID_PITCH).toBe(60);
    expect(FOLLOW).toBe(0.16);
    expect(DPR_CAP).toBe(2);
    expect(SAMPLE_PX).toBe(16);
  });
});
