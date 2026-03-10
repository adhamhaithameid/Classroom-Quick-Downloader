// filepath: extension/src/v2/render/button-styles.ts
/**
 * ============================================================================
 * BUTTON STYLES — CSS-Only Hover States for V2
 * ============================================================================
 *
 * This file injects the CSS for V2's download buttons. The big difference
 * from V1 is that ALL visual state changes happen via CSS pseudo-classes
 * and class toggles — no JavaScript on mouseenter/mouseleave.
 *
 * V1 had separate mouseenter/mouseleave handlers on every button that
 * swapped textContent, backgroundImage, and className on every hover.
 * That's dozens of DOM writes per hover event. V2 does zero DOM writes
 * on hover — it's all CSS.
 *
 * The states are:
 * - .cqd-v2-btn (default idle)
 * - .cqd-v2-btn:hover (hover effect — CSS only!)
 * - .cqd-v2-btn.cqd-loading (downloading...)
 * - .cqd-v2-btn.cqd-loading:hover (show "Cancel" text — CSS only!)
 * - .cqd-v2-btn.cqd-success (downloaded ✓)
 * - .cqd-v2-btn.cqd-error (failed ✗)
 * - .cqd-v2-btn.cqd-cancelled (cancelled)
 *
 * Dark mode: .cqd-v2-btn.cqd-theme-dark uses adjusted colors.
 * RTL: all margins use margin-inline-start/end (never left/right).
 *
 * @author Adham — CSS-only hover states = zero JS overhead on every hover
 * @since v4.0.0
 */

// ============================================================================
// STYLE ID — Prevents duplicate injection
// ============================================================================

const V2_STYLE_ID = 'cqd-v2-button-styles';

// ============================================================================
// CSS — The actual styles
// ============================================================================

/**
 * V2 button CSS with CSS-only hover states.
 *
 * Key techniques used:
 * 1. CSS content property for label text (no JS textContent swaps)
 * 2. Background-image transitions for icon changes
 * 3. margin-inline-start/end for automatic RTL support
 * 4. CSS custom properties for easy theming
 */
const V2_BUTTON_CSS = `
/* ====================================================================
   CQD V2 — Download Button Styles
   CSS-only hover states, dark mode, RTL support
   ==================================================================== */

/* --- CSS Custom Properties (light theme defaults) --- */
:root {
  --cqd-btn-bg: #f1f3f4;
  --cqd-btn-bg-hover: #e8eaed;
  --cqd-btn-text: #3c4043;
  --cqd-btn-text-hover: #1a73e8;
  --cqd-btn-border: transparent;
  --cqd-btn-border-hover: #dadce0;
  --cqd-btn-radius: 18px;
  --cqd-btn-font-size: 12px;
  --cqd-btn-padding: 4px 12px;
  --cqd-btn-gap: 6px;
  --cqd-btn-transition: all 0.2s ease-out;

  /* State colors */
  --cqd-loading-bg: #e8f0fe;
  --cqd-loading-text: #1a73e8;
  --cqd-success-bg: #e6f4ea;
  --cqd-success-text: #137333;
  --cqd-error-bg: #fce8e6;
  --cqd-error-text: #c5221f;
  --cqd-cancel-bg: #fce8e6;
  --cqd-cancel-text: #c5221f;
}

/* --- Base button --- */
.cqd-v2-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--cqd-btn-gap);
  padding: var(--cqd-btn-padding);
  border: 1px solid var(--cqd-btn-border);
  border-radius: var(--cqd-btn-radius);
  background: var(--cqd-btn-bg);
  color: var(--cqd-btn-text);
  font-size: var(--cqd-btn-font-size);
  font-family: 'Google Sans', Roboto, Arial, sans-serif;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: var(--cqd-btn-transition);
  position: relative;
  white-space: nowrap;
  margin-inline-start: 4px;
  vertical-align: middle;
  line-height: 1.4;
  outline: none;
}

/* --- Hover (CSS-only! No JS needed!) --- */
.cqd-v2-btn:hover {
  background: var(--cqd-btn-bg-hover);
  color: var(--cqd-btn-text-hover);
  border-color: var(--cqd-btn-border-hover);
}

.cqd-v2-btn:active {
  transform: scale(0.97);
}

.cqd-v2-btn:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}

/* --- Icon --- */
.cqd-v2-icon {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex-shrink: 0;
  transition: var(--cqd-btn-transition);
}

/* Default download icon (using inline SVG data URL) */
.cqd-v2-icon.cqd-icon-download {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233c4043'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E");
}

.cqd-v2-btn:hover .cqd-icon-download {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231a73e8'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E");
}

/* --- Label --- */
.cqd-v2-label {
  display: inline-block;
}

/* --- Loading state --- */
.cqd-v2-btn.cqd-loading {
  background: var(--cqd-loading-bg);
  color: var(--cqd-loading-text);
  cursor: default;
}

.cqd-v2-btn.cqd-loading .cqd-v2-icon {
  animation: cqd-v2-spin 1s linear infinite;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231a73e8'%3E%3Cpath d='M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z'/%3E%3C/svg%3E");
}

/* Cancel on hover during loading — CSS ONLY, no JS on mouseenter! */
.cqd-v2-btn.cqd-loading:hover {
  background: var(--cqd-cancel-bg);
  color: var(--cqd-cancel-text);
}

.cqd-v2-btn.cqd-loading:hover .cqd-v2-label {
  font-size: 0; /* Hide original text */
}

.cqd-v2-btn.cqd-loading:hover .cqd-v2-label::after {
  content: 'Cancel';
  font-size: var(--cqd-btn-font-size);
}

.cqd-v2-btn.cqd-loading:hover .cqd-v2-icon {
  animation: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23c5221f'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E");
}

/* --- Success state --- */
.cqd-v2-btn.cqd-success {
  background: var(--cqd-success-bg);
  color: var(--cqd-success-text);
  cursor: default;
}

.cqd-v2-btn.cqd-success .cqd-v2-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23137333'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
  animation: none;
}

/* --- Error state --- */
.cqd-v2-btn.cqd-error {
  background: var(--cqd-error-bg);
  color: var(--cqd-error-text);
}

.cqd-v2-btn.cqd-error .cqd-v2-icon {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23c5221f'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E");
  animation: none;
}

/* --- Cancelled state --- */
.cqd-v2-btn.cqd-cancelled {
  background: var(--cqd-btn-bg);
  color: var(--cqd-btn-text);
  opacity: 0.7;
}

/* --- Download All button --- */
.cqd-v2-btn.cqd-download-all {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
}

.cqd-v2-btn.cqd-download-all.cqd-in-header {
  margin-inline-end: 4px;
}

/* --- Download All count badge --- */
.cqd-v2-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.08);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

/* --- Spinner animation --- */
@keyframes cqd-v2-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ====================================================================
   DARK MODE — Overrides via .cqd-theme-dark class
   ==================================================================== */

.cqd-v2-btn.cqd-theme-dark {
  --cqd-btn-bg: #3c4043;
  --cqd-btn-bg-hover: #4a4e51;
  --cqd-btn-text: #e8eaed;
  --cqd-btn-text-hover: #8ab4f8;
  --cqd-btn-border: transparent;
  --cqd-btn-border-hover: #5f6368;
  --cqd-loading-bg: #303134;
  --cqd-loading-text: #8ab4f8;
  --cqd-success-bg: #2d3b2d;
  --cqd-success-text: #81c995;
  --cqd-error-bg: #3b2d2d;
  --cqd-error-text: #f28b82;
  --cqd-cancel-bg: #3b2d2d;
  --cqd-cancel-text: #f28b82;
}

.cqd-v2-btn.cqd-theme-dark .cqd-icon-download {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e8eaed'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E");
}

.cqd-v2-btn.cqd-theme-dark:hover .cqd-icon-download {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238ab4f8'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E");
}

.cqd-v2-btn.cqd-theme-dark .cqd-v2-count {
  background: rgba(255, 255, 255, 0.12);
}
`;

// ============================================================================
// PUBLIC API
// ============================================================================

/** Whether styles have been injected */
let stylesInjected = false;

/**
 * Inject V2 button styles into the document.
 *
 * Safe to call multiple times — only injects once.
 * The style element is given an ID so we can find and remove it on cleanup.
 */
export function injectV2Styles(): void {
  if (stylesInjected) return;
  if (typeof document === 'undefined') return;

  // Check if already injected (e.g., by another engine instance)
  if (document.getElementById(V2_STYLE_ID)) {
    stylesInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = V2_STYLE_ID;
  style.textContent = V2_BUTTON_CSS;

  // Insert at start of <head> so it can be overridden by user stylesheets
  const head = document.head || document.documentElement;
  head.insertBefore(style, head.firstChild);

  stylesInjected = true;
}

/**
 * Remove V2 button styles from the document.
 * Called on engine destroy/cleanup.
 */
export function removeV2Styles(): void {
  const existing = document.getElementById(V2_STYLE_ID);
  if (existing) {
    existing.remove();
  }
  stylesInjected = false;
}

/**
 * Check if V2 styles are currently injected.
 */
export function areV2StylesInjected(): boolean {
  return stylesInjected;
}
