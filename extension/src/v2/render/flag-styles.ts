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
 * Badge types (V1 markup contract — the QA journeys pin these classes):
 * - .cqd-flag.cqd-comment-badge (purple) — comment count pill
 * - .cqd-flag.cqd-edited-badge (teal) — edited pill + overlay frame
 * - .cqd-overlay-container.cqd-both holding .cqd-flag.cqd-both-badge
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
   CQD V2 — Flag Badge Styles (V1 .cqd-flag markup contract, z57 S4)
   Edge-ribbon pills, overlay frames, hover expansion, dark + RTL.
   ==================================================================== */

:root {
  --cqd-flag-transition: height 0.25s ease, border-radius 0.25s ease, box-shadow 0.25s ease;
  --cqd-color-comment: #9B00FF;
  --cqd-color-edited: #007F8D;
}

body.cqd-theme-dark {
  --cqd-color-comment: #9B00FF;
  --cqd-color-edited: #00D6EE;
}

/* --- Base edge-ribbon pill (V1 .cqd-flag) --- */
.cqd-flag {
  position: absolute;
  top: 7px;
  z-index: 9999;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 30px;
  width: 30px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  transition: var(--cqd-flag-transition);
  white-space: nowrap;
}

.cqd-flag:hover {
  height: 60px;
  border-radius: 15px;
  z-index: 10000;
}

.cqd-flag-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cqd-flag-text {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  transition: opacity 0.25s ease, max-height 0.25s ease;
}

.cqd-flag:hover .cqd-flag-text {
  opacity: 1;
  max-height: 20px;
}

/* --- Comment badge (purple) --- */
.cqd-comment-badge {
  background-color: var(--cqd-color-comment);
  color: #ffffff;
}

body[data-cqd-dir="ltr"] .cqd-comment-badge {
  left: 0;
  transform: translateX(-50%);
}

body[data-cqd-dir="rtl"] .cqd-comment-badge {
  right: 0;
  transform: translateX(50%);
}

/* --- Edited badge (teal) --- */
.cqd-edited-badge {
  background-color: var(--cqd-color-edited);
  color: #ffffff;
}

body[data-cqd-dir="ltr"] .cqd-edited-badge {
  left: 0;
  transform: translateX(-50%);
}

body[data-cqd-dir="rtl"] .cqd-edited-badge {
  right: 0;
  transform: translateX(50%);
}

.cqd-edited-icon svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
}

/* --- Overlay frame (inset ring around the post) --- */
.cqd-overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
  box-sizing: border-box;
  border-radius: var(--cqd-overlay-radius, 16px);
  overflow: visible !important;
  box-shadow:
    inset 0 0 0 2px var(--cqd-color-comment),
    0 0 12px rgba(99, 102, 241, 0.5);
}

.cqd-overlay-container.cqd-edited {
  box-shadow:
    inset 0 0 0 2px var(--cqd-color-edited),
    0 0 12px rgba(0, 214, 238, 0.50);
}

.cqd-overlay-container.cqd-both {
  box-shadow:
    inset 0 0 0 2px #FF4036,
    0 0 12px rgba(255, 64, 54, 0.70);
}

/* --- Both badge (combined pill inside the overlay) --- */
.cqd-both-badge {
  background: #FF4036;
  color: #ffffff;
  flex-direction: row;
  align-items: center;
  width: auto;
  min-width: 30px;
  padding: 0 8px;
  gap: 2px;
}

body[data-cqd-dir="ltr"] .cqd-both-badge {
  left: 0;
  transform: translateX(-50%);
}

body[data-cqd-dir="rtl"] .cqd-both-badge {
  right: 0;
  transform: translateX(50%);
}

.cqd-both-section {
  display: inline-flex;
  align-items: center;
}

.cqd-both-icon {
  width: 18px;
  height: 18px;
  background-size: 18px 18px;
  background-repeat: no-repeat;
  background-position: center;
}

.cqd-both-value {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  font-weight: 700;
  margin-inline-start: 2px;
}

.cqd-both-plus {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 12px;
  font-weight: 700;
}

/* --- Dark theme (badges carry .cqd-theme-dark) --- */
.cqd-flag.cqd-theme-dark {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
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
