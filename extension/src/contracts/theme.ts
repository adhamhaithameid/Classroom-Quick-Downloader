// filepath: extension/src/contracts/theme.ts
/**
 * ============================================================================
 * THEME CONTRACT — compare-mode palettes
 * ============================================================================
 *
 * A Theme is data, never behaviour. Two exist so that in compare mode the two
 * engines can render over each other at 50% opacity: agreement blends into a
 * composite colour, disagreement shows as a pure single hue.
 *
 * That only works if no two roles share a value, which tests/contracts/
 * theme.test.ts enforces.
 *
 * The structural secondary is NILE GREEN, not nile blue. Blue would collide
 * with the structural tertiary and make secondary/tertiary disagreement
 * unreadable under overlap.
 */

export const THEME_ROLES = [
  'primary',
  'secondary',
  'tertiary',
  'error',
  'success',
] as const;

export type ThemeRole = (typeof THEME_ROLES)[number];

export type Theme = { name: 'keyword' | 'structural' } & Record<ThemeRole, string>;

/** V1 / keyword engine — the existing production palette. */
export const KEYWORD_THEME: Theme = {
  name: 'keyword',
  primary: '#1a73e8',   // blue   — matches src/v2/render/button-styles.ts
  secondary: '#f9ab00', // yellow — matches src/v2/render/flag-styles.ts edited
  tertiary: '#e8710a',  // orange
  error: '#d93025',     // red    — matches flag-styles.ts
  success: '#137333',   // green  — matches button-styles.ts
};

/** V2 / structural engine — deliberately shifted so overlap is legible. */
export const STRUCTURAL_THEME: Theme = {
  name: 'structural',
  primary: '#7b3fe4',   // purple
  secondary: '#1a7f5a', // nile green
  tertiary: '#4285f4',  // blue
  error: '#f28b82',     // lighter red
  success: '#81c995',   // lighter green
};
