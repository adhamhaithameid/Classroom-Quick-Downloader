// filepath: entrypoints/content/styles.ts
import { DOWNLOAD_ICON_SVG_URL, SUCCESS_ICON_SVG_URL } from './icons';

const STYLE_ID = 'cqd-style';
const SPINNER_SIZE_PX = 16;

const TRANSITION_MS = 150;
const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;

export function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      --cqd-transition: ${TRANSITION_STR};

      /* Spinner */
      --cqd-spinner-border: rgba(255, 255, 255, 0.22);
      --cqd-spinner-top: #ffffff;

      /* =================================================================
       * COLOR PALETTE (Light)
       * ================================================================= */
      --cqd-color-normal: #005DD7;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 93, 215, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 93, 215, 0.70);

      --cqd-color-success: #00A82D;
      --cqd-shadow-success: 0 12px 28px rgba(0, 168, 45, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(0, 168, 45, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #EC6300;
      --cqd-shadow-trying: 0 12px 28px rgba(236, 99, 0, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(236, 99, 0, 0.70);

      --cqd-color-comment: #9B00FF;
      --cqd-color-edited: #007F8D;

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
    }

    /* =================================================================
     * DARK MODE
     * ================================================================= */
    .cqd-theme-dark {
      --cqd-color-normal: #006EFF;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 110, 255, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 110, 255, 0.70);

      --cqd-color-success: #07DA3F;
      --cqd-shadow-success: 0 12px 28px rgba(7, 218, 63, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(7, 218, 63, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #FF9142;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 145, 66, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 145, 66, 0.70);

      --cqd-color-comment: #9B00FF;
      --cqd-color-edited: #00D6EE;

      --cqd-spinner-border: rgba(15, 23, 42, 0.22);
      --cqd-spinner-top: #0f172a;
    }

    div[data-stream-item-id] {
      overflow: visible !important;
      contain: none !important;
      z-index: 1;
    }

    /* ===============================
     * 1. DOWNLOAD BUTTON (Single)
     * =============================== */
    .cqd-download-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      width: auto;
      min-width: 40px;
      max-width: 40px;
      padding: 0;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-base);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        max-width var(--cqd-transition),
        padding-inline var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition);
    }

    body[data-cqd-dir="rtl"] .cqd-download-btn {
      right: auto;
      left: 8px;
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover {
      width: auto;
      max-width: 250px;
      padding-inline: 12px;
      box-shadow: var(--cqd-shadow-hover);
      justify-content: flex-start;
      transform: translateY(-50%) scale(1);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
      transform: scale(0.97);
    }

    .cqd-download-btn:active {
      transform: translateY(-50%) scale(0.97);
    }

    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition: width var(--cqd-transition), height var(--cqd-transition);
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition);
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 4px;
    }

    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-trying,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-normal);
      width: auto;
      max-width: 300px;
      transform: translateY(-50%) scale(1);
    }

    .cqd-download-btn.cqd-trying {
      background-color: var(--cqd-color-trying);
      box-shadow: var(--cqd-shadow-trying);
    }

    .cqd-download-btn.cqd-loading:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    .cqd-download-btn.cqd-trying:hover {
      box-shadow: var(--cqd-shadow-trying-strong);
    }

    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-trying .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-success {
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success:hover {
      box-shadow: var(--cqd-shadow-success-strong);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-error {
      width: auto;
      min-width: 90px;
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
      height: 40px;
      max-width: 150px;
      max-height: 40px;
      padding: 0 12px;
      padding-top: 0;
      padding-bottom: 0;
      align-items: center;
      transition: all var(--cqd-transition);
    }

    .cqd-error-detail {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
      margin: 0;
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      white-space: normal;
      transform: translateY(4px);
      transition: all var(--cqd-transition);
    }

    .cqd-download-btn.cqd-error:hover {
      width: 350px;
      max-width: 360px;
      height: 60px;
      max-height: 61px;
      padding: 8px;
      border-radius: 18px;
      align-items: center;
      gap: 7px;
      box-shadow: var(--cqd-shadow-error-strong);
    }

    .cqd-download-btn.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin: 0;
    }

    .cqd-download-btn.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border: 3px solid var(--cqd-spinner-border);
      border-top-color: var(--cqd-spinner-top);
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ===============================
     * 2. COMMENTS & EDITED (Overlay)
     * =============================== */
    .cqd-overlay-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit;
      overflow: visible !important; /* Allow pulse to go outside */
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-comment),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    /* EDITED OVERLAY (Green/Teal) */
    .cqd-overlay-container.cqd-edited {
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-edited),
        0 0 12px rgba(0, 214, 238, 0.3);
    }

    /* BOTH OVERLAY (Red) - Direct Class */
    .cqd-overlay-container.cqd-both {
      box-shadow:
        inset 0 0 0 2px #FF4036,
        0 0 12px rgba(255, 64, 54, 0.70);
    }

    /* PERMANENT BOLD styling (always applied to marked elements) */
    .cqd-permanent-bold-comment,
    .cqd-permanent-bold-edited {
      font-weight: 900 !important;
      transition: color 0.3s ease, text-shadow 0.3s ease;
    }

    /* COLOR highlight classes (applied on click, temporary) */
    .cqd-color-comment {
      color: var(--cqd-color-comment) !important;
      text-shadow: 0 0 8px rgba(155, 0, 255, 0.4);
    }
    .cqd-color-edited {
      color: var(--cqd-color-edited) !important;
      text-shadow: 0 0 8px rgba(0, 214, 238, 0.4);
    }
    /* Special class for "Both" - applies Red to everything */
    .cqd-color-both {
      color: #FF4036 !important;
      text-shadow: 0 0 8px rgba(255, 64, 54, 0.4);
    }

    /* Inner element pulse (NO SCALE, just color/shadow transition) */
    /* BOTH OVERLAY (Red) - Direct Class */
    .cqd-overlay-container.cqd-both {
      box-shadow:
        inset 0 0 0 2px #FF4036,
        0 0 12px rgba(255, 64, 54, 0.70);
    }

    /* Inner element pulse (NO SCALE, just color/shadow transition) */
    .cqd-inner-pulse {
      /* No animation needed, transition handles color/shadow */
    }

    /* ===============================
     * PULSE ANIMATIONS (Shadow fades out, pulse ripples, shadow fades back)
     * =============================== */
    @keyframes cqd-pulse-comment-anim {
      0% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-comment),
          0 0 12px rgba(99, 102, 241, 0.5);
      }
      15% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-comment),
          0 0 0 0 rgba(155, 0, 255, 0.6);
      }
      50% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-comment),
          0 0 0 14px rgba(155, 0, 255, 0);
      }
      85% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-comment),
          0 0 0 0 rgba(155, 0, 255, 0);
      }
      100% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-comment),
          0 0 12px rgba(99, 102, 241, 0.5);
      }
    }

    @keyframes cqd-pulse-edited-anim {
      0% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-edited),
          0 0 12px rgba(0, 214, 238, 0.3);
      }
      15% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-edited),
          0 0 0 0 rgba(0, 214, 238, 0.6);
      }
      50% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-edited),
          0 0 0 14px rgba(0, 214, 238, 0);
      }
      85% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-edited),
          0 0 0 0 rgba(0, 214, 238, 0);
      }
      100% {
        box-shadow: 
          inset 0 0 0 2px var(--cqd-color-edited),
          0 0 12px rgba(0, 214, 238, 0.3);
      }
    }

    @keyframes cqd-pulse-both-anim {
      0% {
        box-shadow: 
          inset 0 0 0 2px #FF4036,
          0 0 12px rgba(255, 64, 54, 0.7);
      }
      15% {
        box-shadow: 
          inset 0 0 0 2px #FF4036,
          0 0 0 0 rgba(255, 64, 54, 0.6);
      }
      50% {
        box-shadow: 
          inset 0 0 0 2px #FF4036,
          0 0 0 14px rgba(255, 64, 54, 0);
      }
      85% {
        box-shadow: 
          inset 0 0 0 2px #FF4036,
          0 0 0 0 rgba(255, 64, 54, 0);
      }
      100% {
        box-shadow: 
          inset 0 0 0 2px #FF4036,
          0 0 12px rgba(255, 64, 54, 0.7);
      }
    }

    /* Pulse trigger classes - apply animation when class is added */
    .cqd-overlay-container.cqd-pulse-comment {
      animation: cqd-pulse-comment-anim 1.5s ease-out forwards;
    }
    .cqd-overlay-container.cqd-pulse-edited {
      animation: cqd-pulse-edited-anim 1.5s ease-out forwards;
    }
    .cqd-overlay-container.cqd-pulse-both {
      animation: cqd-pulse-both-anim 1.5s ease-out forwards;
    }

    /* ===============================
     * 3. HOVER INTELLIGENCE (Expanding Badges)
     * =============================== */
    
    /* Base class for all expanding flags */
    .cqd-flag {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: row; /* Horizontal layout */
      align-items: center;
      justify-content: flex-start;
      height: 30px; /* Fixed height */
      width: 30px;  /* Collapsed width */
      border-radius: 9999px;
      cursor: pointer;
      overflow: hidden;
      padding: 0;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
      white-space: nowrap;
    }

    .cqd-flag:hover {
      width: auto;
      max-width: 250px; /* Max expand width */
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding-right: 12px; /* Pad text on expand */
    }

    .cqd-flag-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Text span hidden by default */
    .cqd-flag-text {
      opacity: 0;
      max-width: 0;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 700;
      margin-left: 0;
      transform: translateX(-5px);
      transition: 
        opacity 0.2s ease 0.05s, 
        max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
        margin-left 0.3s ease,
        transform 0.2s ease;
    }

    /* Expand text on hover */
    .cqd-flag:hover .cqd-flag-text {
      opacity: 1;
      max-width: 200px;
      margin-left: 0px; 
      transform: translateX(0);
    }

    .cqd-comment-badge {
      /* inherit from .cqd-flag via class list, just add colors */
      background-color: var(--cqd-color-comment);
      color: #ffffff;
      /* Positioning handled by JS direction or body[data-cqd-dir] */
    }

    /* === EXPAND HOVER COMMENTED OUT ===
    .cqd-comment-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }
    === END EXPAND HOVER === */

    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-badge-icon {
      /* Now using .cqd-flag-icon structure */
      width: 18px;
      height: 18px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
    }

    .cqd-badge-label {
      /* Deprecated. Using .cqd-flag-text */
      display: none; 
    }

    /* === NUMBER HOVER ANIMATION COMMENTED OUT - Uncomment to restore ===
    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }
    === END NUMBER HOVER ANIMATION === */

    .cqd-edited-badge {
      /* Inherit .cqd-flag */
      background-color: var(--cqd-color-edited);
      color: #ffffff;
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-edited-badge {
      right: 0;
      transform: translateX(50%);
    }

    body[data-cqd-dir="ltr"] .cqd-edited-badge {
      left: 0;
      transform: translateX(-50%);
    }

    .cqd-edited-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cqd-edited-icon svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    /* === NUMBER HOVER ANIMATION COMMENTED OUT - Uncomment to restore ===
    .cqd-edited-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }
    === END NUMBER HOVER ANIMATION === */

    .cqd-edited-content {
      /* Deprecated. Using .cqd-flag-text */
      display: none;
    }

    /* === NUMBER HOVER ANIMATION COMMENTED OUT - Uncomment to restore ===
    .cqd-edited-badge:hover .cqd-edited-content {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }
    === END NUMBER HOVER ANIMATION === */

    .cqd-diff-val {
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    .cqd-both-badge {
      /* Custom handling for BOTH */
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: row; /* Horizontal */
      align-items: center;
      justify-content: flex-start;
      
      /* Base size */
      width: 50px; 
      height: 30px;
      
      background-color: #FF4036;
      color: #ffffff;
      border-radius: 9999px;
      border: 1px solid rgba(255, 64, 54, 0.70);
      cursor: pointer;
      overflow: hidden;
      padding: 0 8px; /* Padding for icons */
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
      gap: 4px;
    }

    .cqd-both-badge:hover {
      width: auto;
      max-width: 350px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding-right: 12px;
    }

    /* Hide divider on default? No, keep logic. */
    .cqd-both-section {
       display: flex;
       align-items: center;
       gap: 4px;
    }
    
    /* Text spans inside both badge */
    .cqd-both-value {
       opacity: 0;
       max-width: 0;
       overflow: hidden;
       font-family: system-ui, -apple-system, sans-serif;
       font-size: 11px;
       font-weight: 700;
       white-space: nowrap;
       transition: opacity 0.2s ease, max-width 0.3s ease;
    }

    .cqd-both-badge:hover .cqd-both-value {
       opacity: 1;
       max-width: 150px;
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
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .cqd-both-icon {
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    }

    .cqd-both-icon-edited svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    .cqd-both-plus {
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      margin: 5px;
    }

    .cqd-both-value,
    .cqd-both-divider {
      opacity: 0;
      max-height: 0;
      margin-top: 0;
      overflow: hidden;
      transition:
        opacity 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
    }

    .cqd-both-value {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }

    /* === NUMBER HOVER ANIMATION COMMENTED OUT - Uncomment to restore ===
    .cqd-both-badge:hover {
      height: 120px;
      border-radius: 20px;
    }

    .cqd-both-badge:hover .cqd-both-value {
      opacity: 1;
      max-height: 20px;
      margin-top: 2px;
    }

    .cqd-both-badge:hover .cqd-both-divider {
      opacity: 1;
      max-height: 4px;
      margin-top: 2px;
    }
    === END NUMBER HOVER ANIMATION === */

    /* ===============================
     * 1b. DOWNLOAD ALL BUTTON (Header-aligned)
     * =============================== */
    .cqd-download-all-btn {
      /* Progress control (0% to 100%) */
      --cqd-progress: 0%;
      position: absolute;
      top: 12px;
      right: 48px;
      height: 40px;
      z-index: 6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-normal);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;
      transition:
        box-shadow 0.2s ease,
        transform 0.1s ease,
        background-color 0.3s ease,
        padding-inline 0.2s ease;
      transform: translateZ(0);
    }

    /* When injected into the header flex structure */
    .cqd-download-all-btn.cqd-in-header {
      position: relative;
      top: auto;
      right: auto;
      left: auto;
      bottom: auto;
      transform: none;
      margin-inline-end: 8px;
      flex-shrink: 0;
      align-self: center;
    }

    /* RTL fallback only for non-header cases (absolute positioned at top corner) */
    body[data-cqd-dir="rtl"] .cqd-download-all-btn:not(.cqd-in-header) {
      right: auto;
      left: 48px;
    }

    .cqd-download-all-btn:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    .cqd-download-all-btn:active {
      transform: scale(0.97);
    }

    /* Keep pointer cursor even while disabled */
    .cqd-download-all-btn[disabled] {
      cursor: pointer;
    }

    /* FULL SUCCESS STATE (Solid Green) */
    .cqd-download-all-btn.cqd-all-success {
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-all-btn.cqd-all-error {
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
    }

    /* PROGRESS BAR OVERLAY (Fills up) */
    .cqd-download-all-btn::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 0;
      background-color: var(--cqd-color-success);
      /* Width controlled by JS */
      width: var(--cqd-progress);
      transition: width 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
      opacity: 1;
    }

    .cqd-download-all-btn.cqd-all-success::after {
      opacity: 0;
    }

    /* Content layers */
    .cqd-download-all-btn .cqd-download-all-main,
    .cqd-download-all-btn .cqd-download-all-sub,
    .cqd-download-all-btn .cqd-download-all-icon-wrapper {
      position: relative;
      z-index: 2;
    }

    .cqd-download-all-btn .cqd-download-all-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-all-btn .cqd-download-all-icon {
      width: 18px;
      height: 18px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
      flex-shrink: 0;
    }

    /* Swap icon on success */
    .cqd-download-all-btn.cqd-all-success .cqd-download-all-icon {
      background-image: url("${SUCCESS_ICON_SVG_URL}");
    }

    /* Spinner when disabled (Loading) but not success/error */
    .cqd-download-all-btn[disabled]:not(.cqd-all-success):not(.cqd-all-error) .cqd-download-all-icon {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border: 3px solid var(--cqd-spinner-border);
      border-top-color: var(--cqd-spinner-top);
      animation: cqd-spin 0.65s linear infinite;
    }

    .cqd-download-all-btn .cqd-download-all-main {
      font-weight: 600;
    }

    /* Download All Sub-Text Behavior (Hover & Active) */
    .cqd-download-all-btn .cqd-download-all-sub {
      font-size: 11px;
      opacity: 0;
      max-width: 0;
      margin-left: 0;
      overflow: hidden;
      white-space: nowrap;
      transition: 
        opacity 0.2s ease, 
        max-width 0.2s ease, 
        margin-left 0.2s ease;
    }

    /* Hover State: Reveal sub-text */
    .cqd-download-all-btn:not([disabled]):hover .cqd-download-all-sub {
      opacity: 0.9;
      max-width: 100px;
      margin-left: 4px;
    }

    /* Active/Disabled State: Always show sub-text (progress) */
    .cqd-download-all-btn[disabled] .cqd-download-all-sub {
      opacity: 0.9;
      max-width: 100px;
      margin-left: 4px;
    }
  `.trim();
  (document.head || document.documentElement).appendChild(style);
}