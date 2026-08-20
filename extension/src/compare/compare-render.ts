// filepath: extension/src/compare/compare-render.ts
/**
 * ============================================================================
 * COMPARE RENDER — the structural engine's overlapping badge
 * ============================================================================
 *
 * WHY NOT REUSE renderFlagBadge
 * `src/v2/render/flag-renderer.ts` is single-badge-per-post by design: it
 * queries `.cqd-v2-flag`, removes any stale badge, and stamps
 * `data-cqd-v2-flag*` attributes on the post element. Calling it a second time
 * for the structural engine would delete the keyword engine's badge — the two
 * would take turns, not overlap. So compare mode gets its own tiny renderer in
 * its own class namespace (`cqd-compare-*`), and the production renderer is
 * not touched at all.
 *
 * OVERLAP, NOT OFFSET
 * Both badges render in the same position. At 50% opacity, agreement blends
 * into a composite colour and disagreement shows as a pure single hue, so a
 * post found by only one engine is visually obvious at a glance.
 *
 * THE DEV TRANSFORM IS ONE CLASS ON THE ROOT
 * `cqd-compare` goes on the render root once; the CSS applies opacity and a
 * drop shadow to every `cqd-*` descendant. No per-component edits, so there is
 * nothing to leak into production even if this module were somehow reached.
 *
 * Everything here is compare-build only. Callers guard on IS_COMPARE_BUILD.
 */
import { STRUCTURAL_THEME } from '../contracts/theme';
import type { PostDecision } from '../contracts/detection';

const STYLE_ID = 'cqd-compare-styles';
const BADGE_CLASS = 'cqd-compare-flag';
const ROOT_CLASS = 'cqd-compare';

const COMPARE_CSS = `
/* ====================================================================
   CQD COMPARE MODE — dev only, never in a store build
   ==================================================================== */

/* The dev transform: one class on the render root, applied to all CQD
   elements underneath it. Overlap at 50% opacity is the whole point. */
.${ROOT_CLASS} [class*="cqd-"] {
  opacity: 0.5;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.45));
}

.${BADGE_CLASS} {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font: 500 12px/1.6 Roboto, Arial, sans-serif;
  color: #fff;
  pointer-events: none;
  white-space: nowrap;
}

.${BADGE_CLASS}[data-verdict="comment"] { background: ${STRUCTURAL_THEME.primary}; }
.${BADGE_CLASS}[data-verdict="edited"]  { background: ${STRUCTURAL_THEME.secondary}; }
.${BADGE_CLASS}[data-verdict="both"]    { background: ${STRUCTURAL_THEME.tertiary}; }
`;

/** Inject the compare stylesheet once. */
export function injectCompareStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = COMPARE_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

/** Put the dev transform class on the render root. Idempotent. */
export function markCompareRoot(root: HTMLElement): void {
  root.classList.add(ROOT_CLASS);
}

/** Remove every compare artefact. Used on teardown and by tests. */
export function removeCompareArtefacts(doc: Document = document): void {
  doc.getElementById(STYLE_ID)?.remove();
  doc.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
  doc.querySelectorAll(`.${ROOT_CLASS}`).forEach((el) => el.classList.remove(ROOT_CLASS));
}

/**
 * Render the structural engine's badge over a post.
 *
 * Deliberately dumb: no idempotency games, no attribute stamping on the post.
 * It removes its own previous badge and appends a fresh one, so it cannot
 * interfere with the keyword engine's badge or its attributes.
 */
export function renderStructuralBadge(decision: PostDecision, post: HTMLElement): void {
  injectCompareStyles(post.ownerDocument);

  post.querySelectorAll(`:scope > .${BADGE_CLASS}`).forEach((el) => el.remove());

  if (decision.verdict === 'none') return;

  if (post.ownerDocument.defaultView?.getComputedStyle(post).position === 'static') {
    post.style.position = 'relative';
  }

  const badge = post.ownerDocument.createElement('span');
  badge.className = BADGE_CLASS;
  badge.setAttribute('data-verdict', decision.verdict);
  badge.setAttribute('data-engine', 'structural');
  badge.textContent =
    decision.verdict === 'comment' && decision.commentCount !== null
      ? `S:${decision.commentCount}`
      : `S:${decision.verdict}`;

  post.appendChild(badge);
}
