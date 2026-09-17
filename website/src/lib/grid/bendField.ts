export interface BendParams {
  radius: number;
  strength: number;
}

export const GRID_PITCH = 60;
export const BEND_DEFAULTS: BendParams = { radius: 190, strength: 10 };
export const FOLLOW = 0.16;
export const DPR_CAP = 2;
export const SAMPLE_PX = 16;

/**
 * Displacement of grid sample point (x, y) for a cursor at (cx, cy).
 * Fisheye lens: points inside the radius spread away from the cursor by a
 * factor `scale = 1 + (strength / 55) · q²`, where q runs 1 at the cursor
 * to 0 at the rim — so lines bunch just inside the boundary and the warp
 * peaks (≈10px at radius 190 / strength 10) around 0.45·radius. Returns
 * null at or beyond the hard boundary r = radius (caller draws a straight
 * line); at the cursor the offset is exactly zero — scale acts on the
 * degenerate vector, so no unit-vector division (and no NaN) exists.
 */
export function bendOffset(
  x: number,
  y: number,
  cx: number,
  cy: number,
  p: BendParams
): { dx: number; dy: number } | null {
  const vx = x - cx;
  const vy = y - cy;
  const r2 = vx * vx + vy * vy;
  const radius2 = p.radius * p.radius;
  if (r2 >= radius2) return null;
  const q = 1 - r2 / radius2;
  const scale = 1 + (p.strength / 55) * q * q;
  return { dx: vx * (scale - 1), dy: vy * (scale - 1) };
}
