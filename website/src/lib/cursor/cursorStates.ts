/* Branded cursor: pure decision seam.
 *
 * The visual layer lives in CursorLayer.svelte and the pointer engine in
 * lib/actions/brandedCursor.ts; everything testable without a DOM lives
 * here, so vitest's node environment can pin the behavior (see
 * cursorStates.test.ts). Values mirror the approved prototype
 * website/prototype-cursor-v3.html: 44px glass cursor, 100ms follow lag,
 * no trailing layer, 36 states.
 */

export const CURSOR_SIZE_PX = 52;
export const CURSOR_LAG_MS = 80;

/** Arrow glyph area inside the 32-unit viewBox; drives the progress fill. */
export const PROGRESS_FILL = { top: 11.8, bottom: 23.9 } as const;

/** Every state the layer can render. `cta` is the site's own addition to
 * the native keyword list; `none` was cut from the design on review and
 * `ring` is the escalation-only ring-only state (no arrow, no glass). */
export const BRANDED_STATES: ReadonlySet<string> = new Set([
  'default', 'auto', 'pointer', 'cta', 'ring', 'text', 'vertical-text',
  'crosshair', 'cell', 'grab', 'grabbing', 'move', 'all-scroll', 'ew-resize',
  'ns-resize', 'nwse-resize', 'nesw-resize', 'n-resize', 's-resize',
  'e-resize', 'w-resize', 'ne-resize', 'nw-resize', 'se-resize', 'sw-resize',
  'col-resize', 'row-resize', 'wait', 'progress', 'not-allowed', 'no-drop',
  'copy', 'alias', 'help', 'context-menu', 'zoom-in', 'zoom-out'
]);

/** Elements that escalate ambient to pointer. */
export const ACTION_SELECTOR = [
  'a[href]', 'button', 'input', 'textarea', 'select', 'summary',
  '[role="button"]', '[contenteditable="true"]'
].join(',');

/** Text-entry subsets of ACTION_SELECTOR that escalate to text instead. */
export const TEXT_ACTION_SELECTOR = [
  'input[type="text"]', 'input[type="search"]', 'input[type="email"]',
  'input[type="url"]', 'input[type="password"]', 'input[type="tel"]',
  'input[type="number"]', 'textarea', '[contenteditable="true"]'
].join(',');

/** Surfaces whose glass clears on hover (approved: buttons AND cards). */
export const CLEAR_SELECTOR = '.glass-panel, [data-cursor-clear]';

/**
 * Ring-only state triggers: anything meaningful under the pointer collapses
 * the cursor to the bare ring. Buttons, cards, text, titles, media (logo,
 * images, video, canvases), the navbar, the footer's mega CQD wordmark, the
 * moving data bar, and anything opting in via [data-cursor-ring].
 */
export const RING_SELECTOR = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
  '[role="button"]', '[contenteditable="true"]',
  'img', 'picture', 'video', 'svg', 'canvas',
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'figcaption',
  'blockquote', 'label', 'strong', 'em', 'code', 'time',
  '.glass-panel', '[data-cursor-clear]', '[data-cursor-ring]',
  '.l2-nav-shell', '.l2-nav-dropdown', '.l2-nav-mobile-panel',
  '.l2-map-section', '.l2-marquee', '.ft-mega'
].join(',');

/** Opt-in seek targets for the ambient arrow tilt. The overview hero's
 * current-browser CTA (.l2-cta-current) and the footer's primary install
 * CTA (.ft-cta-primary) carry the seek effect; anything can opt in via
 * [data-cursor-seek]. */
export const SEEK_SELECTOR = '[data-cursor-seek], .l2-cta-current, .ft-cta-primary';

export interface CursorSample {
  /** Computed `cursor` of the element under the pointer. */
  keyword: string;
  /** Element carries an explicit data-cursor-state override. */
  hasDemo: boolean;
  isAction: boolean;
  isDisabled: boolean;
  isTextAction: boolean;
  /** Over a ring-only trigger: cards, text, media, chrome (RING_SELECTOR). */
  isRingTarget: boolean;
  /** Text is being selected (pressed pointer over a live selection). */
  textSelected: boolean;
}

/**
 * Decision table ported from the approved prototype and the ring-state
 * review:
 *   1. explicit demo override (branded keyword or ring),
 *   2. explicit branded CSS keyword — except `pointer`, which the UA
 *      stylesheet puts on every link, so it demotes to the escalation
 *      below,
 *   3. active text selection -> text,
 *   4. text entry -> text, any other action -> ring,
 *   5. ring triggers (cards, text, media, chrome) -> ring,
 *   6. otherwise ambient.
 */
export function resolveCursorState(s: CursorSample): string {
  if (s.hasDemo) {
    return BRANDED_STATES.has(s.keyword) ? s.keyword : 'auto';
  }
  if (
    BRANDED_STATES.has(s.keyword) &&
    s.keyword !== 'default' &&
    s.keyword !== 'auto' &&
    s.keyword !== 'pointer'
  ) {
    return s.keyword;
  }
  if (s.textSelected) return 'text';
  if (s.isAction && !s.isDisabled) {
    return s.isTextAction ? 'text' : 'ring';
  }
  if (s.isRingTarget) return 'ring';
  return BRANDED_STATES.has(s.keyword) ? s.keyword : 'auto';
}

/**
 * Frame-rate independent exponential easing: after `tauMs` elapses, the
 * remaining gap shrinks by e. tau <= 0 snaps (reduced-motion / locked).
 * Frame gaps clamp at 250ms so a tab-switch wake covers most of the gap
 * in one step instead of teleporting or crawling.
 */
export function easeExponential(current: number, target: number, dtMs: number, tauMs: number): number {
  if (tauMs <= 0) return target;
  const dt = Math.max(0, Math.min(250, dtMs));
  return current + (target - current) * (1 - Math.exp(-dt / tauMs));
}

/** Rotation (deg), normalized to (-180, 180], aiming the down-resting
 * logo arrow at a target. */
export function seekAngleDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return 0;
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI - 90) % 360;
  if (deg > 180) return deg - 360;
  if (deg <= -180) return deg + 360;
  return deg;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
