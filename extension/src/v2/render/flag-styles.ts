// filepath: extension/src/v2/render/flag-styles.ts
/**
 * ============================================================================
 * FLAG STYLES — CSS-Only Badges for V2 Flag Detection
 * ============================================================================
 *
 * V1 had badge styles scattered across:
 * - content/styles.ts (comment overlay + edited overlay)
 * - both-badge.ts (combined badge inline styles)
 * Each used manual DOM style manipulation on hover.
 *
 * V2 uses a single <style> element with CSS-only hover effects.
 * Same pattern as button-styles.ts — inject once, remove on cleanup.
 *
 * Badge types:
 * - .cqd-v2-flag-comment (blue) — has comment count
 * - .cqd-v2-flag-edited (orange) — post was edited
 * - .cqd-v2-flag-both (red gradient) — both flags present
 *
 * All badges use CSS-only hover expansion (max-width transition)
 * and CSS-only dark mode via .cqd-theme-dark class.
 *
 * @author Adham — CSS-only = zero JS overhead on hover
 * @since v4.0.0
 */

// ============================================================================
// STYLE ID — Prevents duplicate injection
// ============================================================================

const V2_FLAG_STYLE_ID = 'cqd-v2-flag-styles';

// ============================================================================
// CSS — Flag badge styles
// ============================================================================

const V2_FLAG_CSS = `
/* ====================================================================
   CQD V2 — Flag Badge Styles
   CSS-only hover expansion, dark mode, RTL support
   ==================================================================== */

/* --- Overlay container (wraps the post) --- */
.cqd-v2-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  transition: border-color 0.3s ease;
  z-index: 1;
}

/* Border highlights by flag type */
.cqd-v2-overlay.cqd-v2-flag-border-comment {
  border: 2px solid #4285f4;
}

.cqd-v2-overlay.cqd-v2-flag-border-edited {
  border: 2px solid #f9ab00;
}

.cqd-v2-overlay.cqd-v2-flag-border-both {
  border: 2px solid #ea4335;
}

/* --- Base badge --- */
.cqd-v2-flag {
  position: absolute;
  bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 0;
  height: 28px;
  padding: 0 6px;
  border-radius: 14px;
  font-family: 'Google Sans', Roboto, Arial, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
  z-index: 2;
  overflow: hidden;
  white-space: nowrap;
  transition: max-width 0.3s ease, padding 0.3s ease, gap 0.3s ease;
  max-width: 28px; /* Collapsed: icon only */
}

/* RTL: position from inline-end */
.cqd-v2-flag {
  inset-inline-end: 8px;
}

.cqd-v2-flag:hover {
  max-width: 200px; /* Expand to show text */
  padding: 0 10px;
  gap: 6px;
}

.cqd-v2-flag:active {
  transform: scale(0.95);
}

/* --- Badge icon (always visible) --- */
.cqd-v2-flag-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex-shrink: 0;
}

/* --- Badge text (hidden until hover) --- */
.cqd-v2-flag-text {
  display: inline-block;
  opacity: 0;
  max-width: 0;
  overflow: hidden;
  transition: opacity 0.2s ease 0.1s, max-width 0.3s ease;
}

.cqd-v2-flag:hover .cqd-v2-flag-text {
  opacity: 1;
  max-width: 150px;
}

/* --- Comment badge (blue) --- */
.cqd-v2-flag.cqd-v2-flag-comment {
  background: #4285f4;
}

.cqd-v2-flag.cqd-v2-flag-comment .cqd-v2-flag-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z'/%3E%3C/svg%3E");
}

/* --- Edited badge (orange) --- */
.cqd-v2-flag.cqd-v2-flag-edited {
  background: #f9ab00;
}

.cqd-v2-flag.cqd-v2-flag-edited .cqd-v2-flag-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'/%3E%3C/svg%3E");
}

/* --- Both badge (red gradient) --- */
.cqd-v2-flag.cqd-v2-flag-both {
  background: linear-gradient(135deg, #ea4335, #d93025);
  max-width: 56px; /* Two icons visible by default */
  gap: 2px;
  padding: 0 8px;
}

.cqd-v2-flag.cqd-v2-flag-both:hover {
  max-width: 220px;
  gap: 6px;
  padding: 0 12px;
}

/* Separator between icons in both badge */
.cqd-v2-flag-separator {
  display: inline-block;
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

/* --- Pulse animation on click --- */
@keyframes cqd-v2-flag-pulse {
  0% { box-shadow: 0 0 0 0 currentColor; }
  50% { box-shadow: 0 0 0 6px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}

.cqd-v2-flag.cqd-pulsing {
  animation: cqd-v2-flag-pulse 0.6s ease-out;
}

/* ====================================================================
   DARK MODE
   ==================================================================== */

.cqd-theme-dark .cqd-v2-flag.cqd-v2-flag-comment,
.cqd-v2-flag.cqd-v2-flag-comment.cqd-theme-dark {
  background: #5e97f6;
}

.cqd-theme-dark .cqd-v2-flag.cqd-v2-flag-edited,
.cqd-v2-flag.cqd-v2-flag-edited.cqd-theme-dark {
  background: #fdd663;
  color: #3c4043;
}

.cqd-theme-dark .cqd-v2-flag.cqd-v2-flag-edited .cqd-v2-flag-icon,
.cqd-v2-flag.cqd-v2-flag-edited.cqd-theme-dark .cqd-v2-flag-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233c4043'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'/%3E%3C/svg%3E");
}

.cqd-theme-dark .cqd-v2-flag.cqd-v2-flag-both,
.cqd-v2-flag.cqd-v2-flag-both.cqd-theme-dark {
  background: linear-gradient(135deg, #f28b82, #ee675c);
}

.cqd-theme-dark .cqd-v2-overlay.cqd-v2-flag-border-comment {
  border-color: #5e97f6;
}

.cqd-theme-dark .cqd-v2-overlay.cqd-v2-flag-border-edited {
  border-color: #fdd663;
}

.cqd-theme-dark .cqd-v2-overlay.cqd-v2-flag-border-both {
  border-color: #f28b82;
}
`;

// ============================================================================
// PUBLIC API
// ============================================================================

let stylesInjected = false;

/**
 * Inject V2 flag badge styles into the document.
 * Safe to call multiple times — only injects once.
 */
export function injectFlagStyles(): void {
  if (stylesInjected) return;
  if (typeof document === 'undefined') return;

  if (document.getElementById(V2_FLAG_STYLE_ID)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = V2_FLAG_STYLE_ID;
  style.textContent = V2_FLAG_CSS;

  const head = document.head || document.documentElement;
  head.insertBefore(style, head.firstChild);

  stylesInjected = true;
}

/**
 * Remove V2 flag badge styles from the document.
 * Called on engine destroy/cleanup.
 */
export function removeFlagStyles(): void {
  const existing = document.getElementById(V2_FLAG_STYLE_ID);
  if (existing) {
    existing.remove();
  }
  stylesInjected = false;
}

/**
 * Check if V2 flag styles are currently injected.
 */
export function areFlagStylesInjected(): boolean {
  return stylesInjected;
}
