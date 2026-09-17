export interface BendParams {
  radius: number;
  strength: number;
  swirl: number;
}

export const GRID_PITCH = 60;
// Falloff at or below this draws as a straight line, so the bend zone has a
// hard cutoff and far-field points cost nothing.
export const FADE_EPS = 0.004;
export const BEND_DEFAULTS: BendParams = { radius: 190, strength: 10, swirl: 0.35 };
export const FOLLOW = 0.16;
export const DPR_CAP = 2;
export const SAMPLE_PX = 16;

/**
 * Displacement of grid sample point (x, y) for a cursor at (cx, cy).
 * Gaussian falloff exp(-d²/radius²) scales `strength` along
 * (radial + swirl × tangential), where radial points away from the cursor
 * and tangential is its +90° rotation. Returns null when the falloff has
 * faded past FADE_EPS (caller draws a straight line); at d = 0 the offset
 * is exactly zero.
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
  const d2 = vx * vx + vy * vy;
  const falloff = Math.exp(-d2 / (p.radius * p.radius));
  if (falloff <= FADE_EPS) return null;
  // `|| 1` covers d = 0: the unit vector degenerates to (0, 0), keeping the
  // offset at zero instead of producing NaN.
  const d = Math.sqrt(d2) || 1;
  const ux = vx / d;
  const uy = vy / d;
  const m = falloff * p.strength;
  return { dx: (ux - uy * p.swirl) * m, dy: (uy + ux * p.swirl) * m };
}
