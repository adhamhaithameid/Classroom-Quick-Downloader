// filepath: extension/src/v2/render/flag-renderer.ts
/**
 * ============================================================================
 * FLAG RENDERER — Idempotent Badge Injection for V2
 * ============================================================================
 *
 * V1 had 3 separate renderers:
 * - comment_frame.content.ts → createOverlay()
 * - edited_frame.content.ts → createEditedOverlay()
 * - both-badge.ts → upgradeCombinedBadge()
 *
 * Each ran independently via its own MutationObserver, creating race
 * conditions when both needed to merge into a "both" badge.
 *
 * V2 has a single renderFlagBadge() function that handles all 3 badge
 * types (comment, edited, both) with no race conditions because the
 * verdict is already computed by flag-scoring.ts.
 *
 * Key design decisions:
 * 1. Template cloning — build one template per badge type, then clone.
 *    Same pattern as button-renderer.ts.
 * 2. Idempotent — calling renderFlagBadge() twice with the same verdict
 *    is a no-op. Badge gets its own data-cqd-v2-flag attribute.
 * 3. CSS-only hover/animation — no JS mouseenter/mouseleave.
 * 4. Delegated click handler — one handler on the post root.
 *
 * @author Adham — unified flag rendering, no more race conditions
 * @since v4.0.0
 */

import type { FlagDecision } from '../../engines/types';
import { injectFlagStyles } from './flag-styles';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Data attribute marking a post as having a V2 flag badge */
const FLAG_ATTR = 'data-cqd-v2-flag';

/** Data attribute storing the current badge verdict */
const FLAG_VERDICT_ATTR = 'data-cqd-v2-flag-verdict';

/** Data attribute marking an injected CQD element */
const CQD_INJECTED_ATTR = 'data-cqd-injected';

// ============================================================================
// TEMPLATE CACHE — Build once, clone many
// ============================================================================

/** Cached badge templates (built lazily) */
const templateCache = new Map<string, HTMLElement>();

/**
 * Build or retrieve a badge template for a verdict type.
 *
 * Templates are built once and then cloned via cloneNode(true).
 * This avoids creating elements from scratch on every render.
 */
function getTemplate(verdict: 'comment' | 'edited' | 'both'): HTMLElement {
  const cached = templateCache.get(verdict);
  if (cached) return cached;

  const badge = document.createElement('div');
  badge.className = `cqd-v2-flag cqd-v2-flag-${verdict}`;
  badge.setAttribute(CQD_INJECTED_ATTR, 'true');
  badge.setAttribute('role', 'status');

  if (verdict === 'both') {
    // Both badge: comment icon + separator + edit icon + text
    const commentIcon = document.createElement('span');
    commentIcon.className = 'cqd-v2-flag-icon';
    commentIcon.style.backgroundImage = _getCommentIconUrl();

    const separator = document.createElement('span');
    separator.className = 'cqd-v2-flag-separator';

    const editIcon = document.createElement('span');
    editIcon.className = 'cqd-v2-flag-icon';
    editIcon.style.backgroundImage = _getEditedIconUrl();

    const text = document.createElement('span');
    text.className = 'cqd-v2-flag-text';

    badge.appendChild(commentIcon);
    badge.appendChild(separator);
    badge.appendChild(editIcon);
    badge.appendChild(text);
  } else {
    // Single badge: icon + text
    const icon = document.createElement('span');
    icon.className = 'cqd-v2-flag-icon';

    const text = document.createElement('span');
    text.className = 'cqd-v2-flag-text';

    badge.appendChild(icon);
    badge.appendChild(text);
  }

  templateCache.set(verdict, badge);
  return badge;
}

// ============================================================================
// ICON URLS (inline SVG data URIs)
// ============================================================================

function _getCommentIconUrl(): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z'/%3E%3C/svg%3E")`;
}

function _getEditedIconUrl(): string {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'/%3E%3C/svg%3E")`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Render a flag badge on a post element.
 *
 * This is the single entry point for all flag rendering. It handles:
 * - Creating comment, edited, or both badges
 * - Updating existing badges when the verdict changes
 * - Removing badges when verdict is 'none'
 * - CSS-only hover expansion + click handling
 *
 * Idempotent: calling with the same verdict + count is a no-op.
 *
 * @param decision - The flag decision from flag-scoring.ts
 * @param post - The post element to attach the badge to
 */
export function renderFlagBadge(decision: FlagDecision, post: HTMLElement): void {
  // Ensure styles are injected
  injectFlagStyles();

  const { finalVerdict, commentCount, commentScore, editedScore } = decision;

  // No flags → remove any existing badge
  if (finalVerdict === 'none') {
    removeStaleBadges(post);
    return;
  }

  // Check for existing badge with same verdict
  const existingVerdict = post.getAttribute(FLAG_VERDICT_ATTR);
  const existingBadge = post.querySelector<HTMLElement>(`.cqd-v2-flag`);

  // If same verdict and same comment count, do nothing (idempotent)
  if (existingVerdict === finalVerdict && existingBadge) {
    const existingText = existingBadge.querySelector('.cqd-v2-flag-text');
    const newLabel = _buildLabel(finalVerdict, commentCount);
    if (existingText && existingText.textContent === newLabel) {
      return; // No change needed
    }

    // Update the label if count changed
    if (existingText) {
      existingText.textContent = newLabel;
    }
    return;
  }

  // Remove stale badge if verdict changed
  if (existingBadge) {
    existingBadge.remove();
  }

  // Ensure post has position:relative for absolute badge positioning
  const postPosition = window.getComputedStyle(post).position;
  if (postPosition === 'static') {
    post.style.position = 'relative';
  }

  // Clone the template for this verdict type
  const template = getTemplate(finalVerdict);
  const badge = template.cloneNode(true) as HTMLElement;

  // Set text content
  const textEl = badge.querySelector('.cqd-v2-flag-text');
  if (textEl) {
    textEl.textContent = _buildLabel(finalVerdict, commentCount);
  }

  // Set tooltip
  const tooltip = _buildTooltip(finalVerdict, commentCount, commentScore, editedScore);
  badge.title = tooltip;
  badge.setAttribute('aria-label', tooltip);

  // Dark mode
  if (_isDarkMode()) {
    badge.classList.add('cqd-theme-dark');
  }

  // Add to post
  post.appendChild(badge);
  post.setAttribute(FLAG_ATTR, 'true');
  post.setAttribute(FLAG_VERDICT_ATTR, finalVerdict);

  // Add overlay border
  _addOverlayBorder(post, finalVerdict);

  // Set up click handler (delegated — one per post)
  if (!post.hasAttribute('data-cqd-v2-flag-click')) {
    post.setAttribute('data-cqd-v2-flag-click', 'true');
    post.addEventListener('click', _handleBadgeClick);
  }
}

/**
 * Remove any stale V2 flag badges from a post.
 */
export function removeStaleBadges(post: HTMLElement): void {
  // Remove badge
  const badge = post.querySelector('.cqd-v2-flag');
  if (badge) {
    badge.remove();
  }

  // Remove overlay border
  const overlay = post.querySelector('.cqd-v2-overlay');
  if (overlay) {
    overlay.remove();
  }

  // Clean up attributes
  post.removeAttribute(FLAG_ATTR);
  post.removeAttribute(FLAG_VERDICT_ATTR);
}

/**
 * Remove ALL V2 flag badges from a scope (defaults to document).
 * Used on engine destroy.
 */
export function removeAllV2Badges(scope?: HTMLElement): void {
  const root = scope || document.body;
  if (!root) return;

  // Remove all badges
  const badges = root.querySelectorAll('.cqd-v2-flag');
  for (const badge of badges) {
    badge.remove();
  }

  // Remove all overlays
  const overlays = root.querySelectorAll('.cqd-v2-overlay');
  for (const overlay of overlays) {
    overlay.remove();
  }

  // Clean up attributes
  const flagged = root.querySelectorAll(`[${FLAG_ATTR}]`);
  for (const el of flagged) {
    el.removeAttribute(FLAG_ATTR);
    el.removeAttribute(FLAG_VERDICT_ATTR);
    el.removeAttribute('data-cqd-v2-flag-click');
  }

  // Clear template cache
  templateCache.clear();
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Build the label text for a badge.
 */
function _buildLabel(verdict: string, count: number | null): string {
  switch (verdict) {
    case 'comment':
      return count ? `${count}` : '';
    case 'edited':
      return '✎';
    case 'both':
      return count ? `${count} • ✎` : '✎';
    default:
      return '';
  }
}

/**
 * Build tooltip text for a badge.
 */
function _buildTooltip(
  verdict: string,
  count: number | null,
  commentScore: number,
  editedScore: number,
): string {
  const parts: string[] = [];

  if (verdict === 'comment' || verdict === 'both') {
    parts.push(count ? `${count} comment${count !== 1 ? 's' : ''}` : 'Has comments');
  }
  if (verdict === 'edited' || verdict === 'both') {
    parts.push('Post was edited');
  }

  return parts.join(' | ');
}

/**
 * Add a colored overlay border to the post.
 */
function _addOverlayBorder(post: HTMLElement, verdict: string): void {
  // Remove existing overlay
  const existing = post.querySelector('.cqd-v2-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = `cqd-v2-overlay cqd-v2-flag-border-${verdict}`;
  overlay.setAttribute(CQD_INJECTED_ATTR, 'true');

  if (_isDarkMode()) {
    overlay.classList.add('cqd-theme-dark');
  }

  post.appendChild(overlay);
}

/**
 * Detect dark mode from document classes.
 */
function _isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.body?.classList.contains('cqd-theme-dark') ||
         document.documentElement?.classList.contains('cqd-theme-dark') ||
         false;
}

/**
 * Delegated click handler for badge clicks.
 * Opens the post by finding and clicking the title link.
 */
function _handleBadgeClick(e: Event): void {
  const target = e.target as HTMLElement;

  // Only handle clicks on badge elements
  if (!target.closest('.cqd-v2-flag')) return;

  e.stopPropagation();

  // Pulse animation
  const badge = target.closest('.cqd-v2-flag') as HTMLElement;
  if (badge) {
    badge.classList.add('cqd-pulsing');
    setTimeout(() => badge.classList.remove('cqd-pulsing'), 600);
  }

  // Navigate to the post
  const post = target.closest(`[${FLAG_ATTR}]`) as HTMLElement;
  if (post) {
    const link = post.querySelector<HTMLElement>('a[href*="/details/"], h2 a');
    if (link) {
      link.click();
    } else {
      post.click();
    }
  }
}
