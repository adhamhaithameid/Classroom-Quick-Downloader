// filepath: extension/src/v2/render/flag-renderer.ts
/**
 * ============================================================================
 * FLAG RENDERER (v2) — Idempotent Badge Injection, V1 markup contract (z57 S4)
 * ============================================================================
 *
 * V2's flag-scoring engine decides; this module renders. The markup is V1's
 * exact badge contract (the QA journeys pin it):
 *
 *   comment → <div class="cqd-flag cqd-comment-badge">  icon + count + tooltip
 *   edited  → <div class="cqd-flag cqd-edited-badge">   icon + ✓ + overlay
 *   both    → ONE .cqd-overlay-container (red frame) holding ONE
 *             .cqd-flag.cqd-both-badge (comment • + edit) — never two pills
 *
 * V1's three independent renderers (comment_frame / edited_frame / both-badge)
 * became one idempotent render because the verdict is already computed by
 * flag-scoring.ts — no merge races.
 *
 * Live toggles (qa-03 golden rule 8): the popup's cqd-flag-toggle message
 * reaches applyFlagToggle (wired in v2_bootstrap), which strips badges of the
 * disabled kind and re-renders enabled ones from the last-decision registry —
 * no reload, no waiting for a scan.
 *
 * RTL (golden rule 7): the product sets data-cqd-dir on <body> and the badge
 * CSS anchors edge-ribbons by it, exactly like V1's styles.ts.
 */

import type { FlagDecision } from '../../engines/types';
import { injectFlagStyles } from './flag-styles';

// ============================================================================
// MARKERS
// ============================================================================

/**
 * Marks a badge as V2-injected. V1's badges share the cqd-flag classes and
 * the data-cqd-injected attribute, so teardown scopes by THIS marker — in
 * shadow mode a v2 destroy must never strip V1's live badges.
 */
const V2_FLAG_ATTR = 'data-cqd-v2-flag';

/** Registry of the last decision per post — the live-toggle re-render source. */
const lastDecisions = new WeakMap<HTMLElement, FlagDecision>();

/** Live flag enable state (popup toggles flip these without a reload). */
const enabled = { comments: true, edited: true };

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Render the badge for one flag decision on a post. Idempotent: the same
 * verdict + count re-renders nothing.
 */
export function renderFlagBadge(decision: FlagDecision, post: HTMLElement): void {
  injectFlagStyles();
  lastDecisions.set(post, decision);

  applyDirection(post.ownerDocument || document);

  const { finalVerdict, commentCount } = decision;

  if (finalVerdict === 'none') {
    removeFlagArtifacts(post);
    return;
  }

  const wantComment = enabled.comments && (finalVerdict === 'comment' || finalVerdict === 'both');
  const wantEdited = enabled.edited && (finalVerdict === 'edited' || finalVerdict === 'both');

  if (!wantComment && !wantEdited) {
    removeFlagArtifacts(post);
    return;
  }

  const dark = isDarkMode();
  const existing = post.querySelector<HTMLElement>(`[${V2_FLAG_ATTR}="badge"]`);
  const existingKind = existing?.getAttribute('data-cqd-flag-kind') ?? null;
  const existingCount = existing?.getAttribute('data-cqd-comment-count') ?? null;

  // Idempotence: same kind + same count → nothing to do.
  const kind = wantComment && wantEdited ? 'both' : wantComment ? 'comment' : 'edited';
  const countKey = wantComment ? String(commentCount ?? '') : null;
  if (existing && existingKind === kind && existingCount === countKey) return;

  removeFlagArtifacts(post);

  if (kind === 'comment') {
    post.appendChild(buildCommentBadge(commentCount ?? 0, dark));
  } else if (kind === 'edited') {
    post.appendChild(buildOverlay('edited', dark));
    post.appendChild(buildEditedBadge(dark));
  } else {
    const overlay = buildOverlay('both', dark);
    overlay.appendChild(buildBothBadge(commentCount ?? 0, dark));
    post.appendChild(overlay);
  }
}

/** Remove badges + overlay from one post (verdict 'none' or kind change). */
export function removeStaleBadges(post: HTMLElement): void {
  removeFlagArtifacts(post);
}

/** Remove ALL V2 flag artifacts in a scope (engine destroy). V1-safe. */
export function removeAllV2Badges(scope?: HTMLElement): void {
  const root = scope || document.body;
  if (!root) return;
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[${V2_FLAG_ATTR}]`))) {
    el.remove();
  }
}

/**
 * Apply a live flag toggle (popup → cqd-flag-toggle). Strips badges of the
 * disabled kind and re-renders enabled ones from the last-decision registry —
 * live, no reload (qa-03 golden rule 8).
 */
export function applyFlagToggle(flag: 'commentsFlagEnabled' | 'editedFlagEnabled', isOn: boolean): void {
  if (flag === 'commentsFlagEnabled') enabled.comments = isOn;
  if (flag === 'editedFlagEnabled') enabled.edited = isOn;

  // Re-render every post this page has a decision for (bounded to live posts).
  for (const post of document.querySelectorAll<HTMLElement>('[data-stream-item-id]')) {
    const decision = lastDecisions.get(post);
    if (!decision) continue;
    if (!post.isConnected) continue;
    renderFlagBadge(decision, post);
  }
}

// ============================================================================
// BADGE BUILDERS — the V1 pill structures
// ============================================================================

const COMMENT_ICON_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z'/%3E%3C/svg%3E";

const EDIT_ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'><path d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'/></svg>";

function buildCommentBadge(count: number, dark: boolean): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-comment-badge cqd-flag';
  badge.setAttribute('data-cqd-injected', 'true');
  badge.setAttribute(V2_FLAG_ATTR, 'badge');
  badge.setAttribute('data-cqd-flag-kind', 'comment');
  badge.setAttribute('data-cqd-comment-count', String(count));
  if (dark) badge.classList.add('cqd-theme-dark');

  const icon = document.createElement('div');
  icon.className = 'cqd-flag-icon';
  icon.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
  icon.style.backgroundSize = '18px 18px';
  icon.style.backgroundRepeat = 'no-repeat';
  icon.style.backgroundPosition = 'center';
  icon.style.filter = 'brightness(0) invert(1)';

  const text = document.createElement('span');
  text.className = 'cqd-flag-text';
  text.textContent = String(count);

  badge.appendChild(icon);
  badge.appendChild(text);

  const tooltip = `${count} comments`;
  badge.title = tooltip;
  badge.setAttribute('aria-label', tooltip);
  return badge;
}

function buildEditedBadge(dark: boolean): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-edited-badge cqd-flag';
  badge.setAttribute('data-cqd-injected', 'true');
  badge.setAttribute(V2_FLAG_ATTR, 'badge');
  badge.setAttribute('data-cqd-flag-kind', 'edited');
  if (dark) badge.classList.add('cqd-theme-dark');

  const icon = document.createElement('div');
  icon.className = 'cqd-flag-icon cqd-edited-icon';
  icon.innerHTML = EDIT_ICON_SVG;

  const text = document.createElement('span');
  text.className = 'cqd-flag-text';
  text.textContent = '✓';

  badge.appendChild(icon);
  badge.appendChild(text);

  const tooltip = 'Edited';
  badge.title = tooltip;
  badge.setAttribute('aria-label', tooltip);
  return badge;
}

/** The frame overlay a post gets for edited/both verdicts (V1 structure). */
function buildOverlay(kind: 'edited' | 'both', dark: boolean): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = `cqd-overlay-container cqd-${kind}`;
  overlay.setAttribute('data-cqd-injected', 'true');
  overlay.setAttribute(V2_FLAG_ATTR, 'overlay');
  if (dark) overlay.classList.add('cqd-theme-dark');

  const post = overlay.parentElement;
  const radius = post ? parseInt(getComputedStyle(post).borderRadius || '0', 10) || 0 : 0;
  overlay.style.setProperty('--cqd-overlay-radius', `${Math.max(radius, 16)}px`);
  return overlay;
}

/** The combined pill inside a both-overlay (comment • + edit, V1 structure). */
function buildBothBadge(count: number, dark: boolean): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'cqd-flag cqd-both-badge';
  badge.setAttribute('data-cqd-injected', 'true');
  badge.setAttribute(V2_FLAG_ATTR, 'badge');
  badge.setAttribute('data-cqd-flag-kind', 'both');
  badge.setAttribute('data-cqd-comment-count', String(count));
  if (dark) badge.classList.add('cqd-theme-dark');

  const commentSection = document.createElement('div');
  commentSection.className = 'cqd-both-section';
  const commentIcon = document.createElement('div');
  commentIcon.className = 'cqd-both-icon cqd-both-icon-comment';
  commentIcon.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
  commentIcon.style.backgroundSize = '18px 18px';
  commentIcon.style.backgroundRepeat = 'no-repeat';
  commentIcon.style.backgroundPosition = 'center';
  commentIcon.style.filter = 'brightness(0) invert(1)';
  const commentValue = document.createElement('span');
  commentValue.className = 'cqd-both-value';
  commentValue.textContent = String(count);
  commentSection.appendChild(commentIcon);
  commentSection.appendChild(commentValue);

  const plus = document.createElement('div');
  plus.className = 'cqd-both-plus';
  plus.textContent = '+';

  const editSection = document.createElement('div');
  editSection.className = 'cqd-both-section';
  const editIcon = document.createElement('div');
  editIcon.className = 'cqd-both-icon cqd-both-icon-edited';
  editIcon.innerHTML = EDIT_ICON_SVG;
  const editValue = document.createElement('span');
  editValue.className = 'cqd-both-value';
  editValue.textContent = '✓';
  editSection.appendChild(editIcon);
  editSection.appendChild(editValue);

  badge.appendChild(commentSection);
  badge.appendChild(plus);
  badge.appendChild(editSection);

  const tooltip = `${count} comments | Edited`;
  badge.title = tooltip;
  badge.setAttribute('aria-label', tooltip);
  return badge;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Strip every v2 flag artifact from a post. */
function removeFlagArtifacts(post: HTMLElement): void {
  for (const el of Array.from(post.querySelectorAll<HTMLElement>(`[${V2_FLAG_ATTR}]`))) {
    el.remove();
  }
}

/**
 * Mirror V1's getPageDirection OUTCOME: element dir first, computed style as
 * the fallback. Published on <body> as data-cqd-dir — the badge CSS anchors
 * the edge-ribbons by it.
 */
function applyDirection(doc: Document): void {
  if (typeof document === 'undefined') return;
  const docDir = doc.documentElement?.dir || doc.body?.dir;
  let direction: 'ltr' | 'rtl' = 'ltr';
  if (docDir === 'rtl') direction = 'rtl';
  else if (typeof window !== 'undefined' && doc.body) {
    try {
      direction = window.getComputedStyle(doc.body).direction === 'rtl' ? 'rtl' : 'ltr';
    } catch { /* keep ltr */ }
  }
  doc.body?.setAttribute('data-cqd-dir', direction);
}

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  const body = document.body;
  return body?.classList.contains('cqd-theme-dark') ||
    body?.getAttribute('data-theme') === 'dark' ||
    document.documentElement?.classList.contains('cqd-theme-dark') ||
    document.documentElement?.classList.contains('gm3-dark-theme') ||
    false;
}
