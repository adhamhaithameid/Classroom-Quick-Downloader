// filepath: entrypoints/content/styles.ts
import { DOWNLOAD_ICON_SVG_URL, SUCCESS_ICON_SVG_URL, CANCEL_ICON_SVG_URL } from './icons';

const STYLE_ID = 'cqd-style';
const STYLE_ID_STUDENT_WORK = 'cqd-sw-style';
const SPINNER_SIZE_PX = 16;

const TRANSITION_MS = 120; // Reduced from 150ms for snappier feel
const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;

// =============================================================================
// S11 (S10-parked de-dupe): SINGLE SOURCE for the download-button CSS emitted
// by BOTH sheets — the FULL V1 sheet (injectStyles) and the student-work
// SCOPED sheet (injectStudentWorkStyles). The declarations exist exactly once,
// here. Tokens, substituted by renderSharedButtonSheet():
//   %CQD_BTN%         row-button selector — FULL: '.cqd-download-btn';
//                     SW: the data-cqd-sw :is(...) scope argument
//   %CQD_ALL%         download-all selector — FULL: '.cqd-download-all-btn';
//                     SW: the by-status host-scoped descendant
//   %CQD_KF%          cancel/pulse keyframe prefix — FULL: '' (cancelClick);
//                     SW: 'cqdSw' so the coexisting sheets keep distinct
//                     keyframe namespaces
//   %CQD_D%           descendant prefix for the bare helper classes
//                     (.cqd-download-icon / .cqd-error-detail / .cqd-spinner) —
//                     FULL: '' (page-wide classes are FULL-sheet property);
//                     SW: button-scoped so nothing leaks to V2-owned buttons
//   %CQD_ICON_SIZES%  FULL-only icon-size utilities; '' in the SW sheet
//   %CQD_BETWEEN%     FULL-only overlay/flag sections + the Download-All
//                     header; the SW sheet keeps only its own header
// The FULL sheet's rendered output stays byte-identical to the pre-de-dupe
// text; the scoped sheet renders the same declaration blocks.
// =============================================================================

const FULL_SHEET_ICON_SIZES = `
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
`;

const FULL_SHEET_BETWEEN = `
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
      /* Default squircle border-radius - 16px like Google's Material Design */
      /* Use inherit when parent has border-radius, fallback to 16px */
      border-radius: var(--cqd-overlay-radius, 16px);
      overflow: visible !important; /* Allow pulse to go outside */
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-comment),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    /* EDITED OVERLAY (Green/Teal) */
    .cqd-overlay-container.cqd-edited {
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-edited),
        0 0 12px rgba(0, 214, 238, 0.50);
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
    
    /* Base class for all expanding flags (Comment & Edited pills) */
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
      transition: 
        height var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition);
      white-space: nowrap;
    }

    .cqd-flag:hover {
      height: 60px;
      border-radius: 15px;
      z-index: 10000;
    }

    /* Icon stays FIXED - does NOT move on hover */
    .cqd-flag-icon {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      /* NO transform transition - icon is static */
    }

    /* Text span hidden by default - expands like download button */
    .cqd-flag-text {
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 700;
      margin-top: 0;
      text-align: center;
      transition: 
        opacity var(--cqd-transition), 
        max-height var(--cqd-transition);
    }

    /* Expand text on hover - smooth fade like download button */
    .cqd-flag:hover .cqd-flag-text {
      opacity: 1;
      max-height: 20px;
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
      /* BOTH badge: VERTICAL layout - icons stacked, numbers appear under each on hover */
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column; /* VERTICAL layout for icons */
      align-items: center;
      justify-content: flex-start;
      
      /* Base size (collapsed) - tall enough for stacked icons */
      width: 30px;
      height: 60px; /* Fits: icon + plus + icon */
      
      background-color: #FF4036;
      color: #ffffff;
      border-radius: 15px;
      border: none;
      cursor: pointer;
      overflow: hidden;
      padding-top: 5px; /* Minimal padding to maximize space */
      padding-bottom: 10px; /* Minimal padding to maximize space */
      transition: 
        height var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition);
      gap: 0;
    }

    .cqd-both-badge:hover {
      height: 100px; /* Expand to show numbers under each icon */
      border-radius: 15px;
      z-index: 10000;
    }

    /* Each section contains icon + number (stacked vertically) */
    .cqd-both-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    /* Plus sign between icons */
    .cqd-both-plus {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      opacity: 0.8;
      padding: 2px 0;
    }
    
    /* Values hidden by default - appear on hover */
    .cqd-both-value {
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      white-space: nowrap;
      transition: 
        opacity var(--cqd-transition), 
        max-height var(--cqd-transition);
    }

    .cqd-both-badge:hover .cqd-both-value {
      opacity: 1;
      max-height: 20px;
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
      flex-shrink: 0;
      width: 30px;
      height: 24px; /* Reduced to fit in 60px total height */
      display: flex;
      align-items: center;
      justify-content: center;
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
      margin: 1px 0; /* Compact spacing */
      height: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
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
     * =============================== */`;

const SW_BETWEEN_HEADER = `
    /* ===============================
     * DOWNLOAD ALL (by-status board control)
     * =============================== */`;

// NOTE: the template starts straight after the backtick and is NOT trimmed —
// the leading indent of the first rule is significant CSS text.
export const SHARED_BUTTON_SHEET = `    %CQD_BTN% {
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

    body[data-cqd-dir="rtl"] %CQD_BTN% {
      right: auto;
      left: 8px;
    }

    %CQD_BTN%:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover {
      width: auto;
      max-width: 250px;
      padding-inline: 12px;
      box-shadow: var(--cqd-shadow-hover);
      justify-content: flex-start;
      transform: translateY(-50%) scale(1);
      border-radius: 20px;
    }

    %CQD_BTN%:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
      transform: scale(0.97);
    }

    %CQD_BTN%:active {
      transform: translateY(-50%) scale(0.97);
    }

    %CQD_BTN% .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    %CQD_D%.cqd-download-icon {
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
%CQD_ICON_SIZES%
    %CQD_BTN% .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition);
    }

    %CQD_BTN%:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 4px;
    }

    %CQD_BTN%.cqd-loading,
    %CQD_BTN%.cqd-trying,
    %CQD_BTN%.cqd-success,
    %CQD_BTN%.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-normal);
      width: auto;
      min-width: 140px; /* Consistent width to prevent hover stuttering */
      max-width: 300px;
      transform: translateY(-50%) scale(1);
    }

    %CQD_BTN%.cqd-trying {
      background-color: var(--cqd-color-trying);
      box-shadow: var(--cqd-shadow-trying);
    }

    %CQD_BTN%.cqd-loading:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    %CQD_BTN%.cqd-trying:hover {
      box-shadow: var(--cqd-shadow-trying-strong);
    }

    %CQD_BTN%.cqd-cancel,
    %CQD_BTN%.cqd-cancelled {
      background-color: var(--cqd-color-cancel);
      box-shadow: var(--cqd-shadow-cancel);
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      width: auto;
      min-width: 140px;
      max-width: 300px;
      transform: translateY(-50%) scale(1);
      transition: all var(--cqd-transition);
      cursor: pointer;
    }

    /* Cancel state - smooth entry animation when hover starts */
    %CQD_BTN%.cqd-loading:hover,
    %CQD_BTN%.cqd-trying:hover {
      transition: background-color 0.2s ease-out, box-shadow 0.2s ease-out;
    }

    %CQD_BTN%.cqd-cancelled {
      cursor: not-allowed;
      filter: saturate(0.85) brightness(0.95); /* No transparency, just subtle desaturation */
      /* Click animation class applied via JS */
    }

    /* Click animation: cancel → cancelled */
    @keyframes %CQD_KF_CLICK% {
      0% {
        transform: translateY(-50%) scale(1);
      }
      30% {
        transform: translateY(-50%) scale(1.08);
      }
      60% {
        transform: translateY(-50%) scale(0.96);
      }
      100% {
        transform: translateY(-50%) scale(1);
      }
    }

    %CQD_BTN%.cqd-cancel-click-anim {
      animation: %CQD_KF_CLICK% 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    %CQD_BTN%.cqd-cancel:hover {
      transform: translateY(-50%) scale(1.05);
      box-shadow: var(--cqd-shadow-cancel-strong);
    }

    %CQD_BTN%.cqd-cancel .cqd-label,
    %CQD_BTN%.cqd-cancelled .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 12px;
    }

    /* Cancel icon pulse animation */
    %CQD_BTN%.cqd-cancel .cqd-download-icon {
      animation: %CQD_KF_PULSE% 1.5s ease-in-out infinite;
    }

    @keyframes %CQD_KF_PULSE% {
      0%, 100% {
        transform: scale(1) rotate(0deg);
      }
      50% {
        transform: scale(1.1) rotate(15deg);
      }
    }

    %CQD_BTN%.cqd-loading .cqd-label,
    %CQD_BTN%.cqd-trying .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 12px;
    }

    %CQD_BTN%.cqd-success {
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    %CQD_BTN%.cqd-success:hover {
      box-shadow: var(--cqd-shadow-success-strong);
    }

    %CQD_BTN%.cqd-success .cqd-label {
      opacity: 1;
      max-width: 150px;
      margin-left: 8px;
    }

    %CQD_BTN%.cqd-error {
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

    %CQD_D%.cqd-error-detail {
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

    %CQD_BTN%.cqd-error:hover {
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

    %CQD_BTN%.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin: 0;
    }

    %CQD_BTN%.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    %CQD_D%.cqd-spinner {
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
%CQD_BETWEEN%
    %CQD_ALL% {
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
      opacity: 1;
      transition:
        box-shadow 0.2s ease,
        transform 0.1s ease,
        background-color 0.3s ease,
        padding-inline 0.2s ease,
        opacity 0.25s ease-out;
      transform: translateZ(0);
    }
    
    /* Hidden state with fade-out transition */
    %CQD_ALL%.cqd-hidden {
      opacity: 0;
      pointer-events: none;
    }

    /* When injected into the header flex structure */
    %CQD_ALL%.cqd-in-header {
      position: relative;
      top: auto;
      right: auto;
      left: auto;
      bottom: auto;
      transform: none;
      margin-inline-end: 8px;
      flex-shrink: 0;
      align-self: center;
      /* Prevent text overlap on hover */
      z-index: 100;
      isolation: isolate;
      background-clip: padding-box;
      /* Ensure button doesn't expand beyond its container */
      max-width: fit-content;
    }

    /* Classwork header button: ensure proper positioning next to three-dots */
    %CQD_ALL%.cqd-classwork-header {
      position: relative;
      transform: none;
      flex-shrink: 0;
      z-index: 100;
      /* Prevent text overlap */
      isolation: isolate;
      background-clip: padding-box;
    }

    /* Ensure button hover doesn't overlap adjacent elements */
    %CQD_ALL%.cqd-in-header:hover,
    %CQD_ALL%.cqd-classwork-header:hover {
      z-index: 101;
    }

    /* RTL fallback only for non-header cases (absolute positioned at top corner) */
    body[data-cqd-dir="rtl"] %CQD_ALL%:not(.cqd-in-header) {
      right: auto;
      left: 48px;
    }

    %CQD_ALL%:hover {
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    %CQD_ALL%:active {
      transform: scale(0.97);
    }

    /* Keep pointer cursor even while disabled */
    %CQD_ALL%[disabled] {
      cursor: pointer;
    }

    /* FULL SUCCESS STATE (Solid Green) */
    %CQD_ALL%.cqd-all-success {
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    %CQD_ALL%.cqd-all-error {
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
    }

    /* CANCEL STATE (Orange - hover to cancel during download) */
    %CQD_ALL%.cqd-all-cancel {
      background-color: var(--cqd-color-cancel);
      box-shadow: var(--cqd-shadow-cancel);
      min-width: 140px; /* Keep same width as downloading state */
    }

    %CQD_ALL%.cqd-all-cancelled {
      background-color: var(--cqd-color-cancel);
      box-shadow: var(--cqd-shadow-cancel);
      min-width: 140px; /* Match cancel state width */
    }

    /* PROGRESS BAR OVERLAY (Fills up) */
    %CQD_ALL%::after {
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

    %CQD_ALL%.cqd-all-success::after {
      opacity: 0;
    }

    /* Content layers */
    %CQD_ALL% .cqd-download-all-main,
    %CQD_ALL% .cqd-download-all-sub,
    %CQD_ALL% .cqd-download-all-icon-wrapper {
      position: relative;
      z-index: 2;
    }

    %CQD_ALL% .cqd-download-all-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    %CQD_ALL% .cqd-download-all-icon {
      width: 18px;
      height: 18px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
      flex-shrink: 0;
      /* Smooth icon transitions */
      transition: background-image 0.2s ease-out, transform 0.2s ease-out;
    }

    /* Swap icon on success */
    %CQD_ALL%.cqd-all-success .cqd-download-all-icon {
      background-image: url("${SUCCESS_ICON_SVG_URL}");
    }

    /* Swap icon on cancel/cancelled with smooth transition */
    %CQD_ALL%.cqd-all-cancel .cqd-download-all-icon,
    %CQD_ALL%.cqd-all-cancelled .cqd-download-all-icon {
      background-image: url("${CANCEL_ICON_SVG_URL}");
      animation: none;
      border: none;
      width: 18px;
      height: 18px;
    }

    /* Spinner when disabled (Loading) but not success/error/cancel */
    %CQD_ALL%[disabled]:not(.cqd-all-success):not(.cqd-all-error):not(.cqd-all-cancel):not(.cqd-all-cancelled) .cqd-download-all-icon {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border: 3px solid var(--cqd-spinner-border);
      border-top-color: var(--cqd-spinner-top);
      animation: cqd-spin 0.65s linear infinite;
    }

    %CQD_ALL% .cqd-download-all-main {
      font-weight: 600;
    }

    /* Download All Sub-Text Behavior (Hover & Active) */
    %CQD_ALL% .cqd-download-all-sub {
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
    %CQD_ALL%:not([disabled]):hover .cqd-download-all-sub {
      opacity: 0.9;
      max-width: 100px;
      margin-left: 4px;
    }

    /* Active/Disabled State: Always show sub-text (progress) */
    %CQD_ALL%[disabled] .cqd-download-all-sub {
      opacity: 0.9;
      max-width: 100px;
      margin-left: 4px;
    }`;

interface SharedButtonVars {
  /** Row-button selector (FULL: '.cqd-download-btn'; SW: :is(...) scope). */
  btn: string;
  /** Download-all selector (FULL: '.cqd-download-all-btn'; SW: host-scoped). */
  all: string;
  /** Cancel keyframe name (FULL: 'cancelClick'; SW: 'cqdSwCancelClick'). */
  kfClick: string;
  /** Pulse keyframe name (FULL: 'cancelPulse'; SW: 'cqdSwCancelPulse'). */
  kfPulse: string;
  /** Descendant prefix for bare helper classes (FULL: ''; SW: button + ' '). */
  descendant: string;
  /** FULL-only icon-size utilities; '' in the scoped sheet. */
  iconSizes: string;
  /** FULL-only overlay/flag sections + Download-All header; SW keeps its own. */
  between: string;
}

function renderSharedButtonSheet(v: SharedButtonVars): string {
  return SHARED_BUTTON_SHEET.replaceAll('%CQD_BTN%', v.btn)
    .replaceAll('%CQD_ALL%', v.all)
    .replaceAll('%CQD_KF_CLICK%', v.kfClick)
    .replaceAll('%CQD_KF_PULSE%', v.kfPulse)
    .replaceAll('%CQD_D%', v.descendant)
    .replaceAll('%CQD_ICON_SIZES%', v.iconSizes)
    .replaceAll('%CQD_BETWEEN%', v.between);
}

const SW_BTN_SELECTOR =
  ':is(.cqd-download-btn[data-cqd-sw="true"], .cqd-download-btn[data-cqd-sw-bs="true"])';
const SW_ALL_SELECTOR = '[data-cqd-sw-bs-host="true"] .cqd-download-all-btn';

const FULL_SHEET_BUTTONS: SharedButtonVars = {
  btn: '.cqd-download-btn',
  all: '.cqd-download-all-btn',
  kfClick: 'cancelClick',
  kfPulse: 'cancelPulse',
  descendant: '',
  iconSizes: FULL_SHEET_ICON_SIZES,
  between: FULL_SHEET_BETWEEN,
};

const SW_SHEET_BUTTONS: SharedButtonVars = {
  btn: SW_BTN_SELECTOR,
  all: SW_ALL_SELECTOR,
  kfClick: 'cqdSwCancelClick',
  kfPulse: 'cqdSwCancelPulse',
  descendant: `${SW_BTN_SELECTOR} `,
  iconSizes: '',
  between: SW_BETWEEN_HEADER,
};

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

      --cqd-color-trying: #FFD93D;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 217, 61, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 217, 61, 0.70);

      --cqd-color-cancel: #EC6300;
      --cqd-shadow-cancel: 0 12px 28px rgba(236, 99, 0, 0.40);
      --cqd-shadow-cancel-strong: 0 12px 28px rgba(236, 99, 0, 0.70);

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

      --cqd-color-trying: #FFD93D;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 217, 61, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 217, 61, 0.70);

      --cqd-color-cancel: #FF9142;
      --cqd-shadow-cancel: 0 12px 28px rgba(255, 145, 66, 0.40);
      --cqd-shadow-cancel-strong: 0 12px 28px rgba(255, 145, 66, 0.70);

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

    /* Classwork tab: li elements with data-stream-item-id */
    li[data-stream-item-id] {
      overflow: visible !important;
      contain: none !important;
      position: relative;
      z-index: 1;
    }

    /* Classwork tab: ensure header row has proper flex display for button placement */
    li[data-stream-item-id] .jWCzBe.gmNu1d {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
    }

    /* Classwork tab: button styling within header */
    li[data-stream-item-id] .cqd-download-all-btn {
      margin-inline-end: 8px;
    }

    /* Classwork tab: flag badges positioning */
    li[data-stream-item-id] .cqd-flag,
    li[data-stream-item-id] .cqd-comment-badge,
    li[data-stream-item-id] .cqd-edited-badge,
    li[data-stream-item-id] .cqd-both-badge {
      z-index: 9999;
    }

    /* ===============================
     * 1. DOWNLOAD BUTTON (Single)
     * =============================== */
${renderSharedButtonSheet(FULL_SHEET_BUTTONS)}
  `.trim();
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Student-work-scoped stylesheet (z57 tail).
 *
 * The two student-work entrypoints run in EVERY engine mode, but in v2 the
 * V2 engine ships its own stylesheet for the SAME `.cqd-download-btn` /
 * `.cqd-download-all-btn` markup contract. Injecting the full V1 sheet there
 * re-imposes V1 geometry (absolute 40px circles, z-index 5) on V2's buttons,
 * making neighbors intercept each other's clicks (qa-06 regression). So the
 * student-work stacks inject THIS sheet instead: the same button CSS, scoped
 * to the buttons THEY create —
 *   - row buttons carry data-cqd-sw / data-cqd-sw-bs (entrypoints set them),
 *   - the by-status Download All control lives under the host marked
 *     data-cqd-sw-bs-host (student_work_by_status sets it).
 * The full sheet stays owned by the V1 stacks (observers/download_all/frames);
 * in legacy mode both sheets coexist and the scoped rules resolve to the same
 * visual result. The declarations are the shared SHARED_BUTTON_SHEET
 * constant — the SAME single source injectStyles renders; only the selectors,
 * keyframe prefix and FULL-only sections differ per sheet.
 */
export function injectStudentWorkStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID_STUDENT_WORK)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID_STUDENT_WORK;
  style.textContent = `
    :root {
      --cqd-transition: ${TRANSITION_STR};

      /* Spinner */
      --cqd-spinner-border: rgba(255, 255, 255, 0.22);
      --cqd-spinner-top: #ffffff;

      --cqd-color-normal: #005DD7;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 93, 215, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 93, 215, 0.70);

      --cqd-color-success: #00A82D;
      --cqd-shadow-success: 0 12px 28px rgba(0, 168, 45, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(0, 168, 45, 0.70);

      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      --cqd-color-trying: #FFD93D;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 217, 61, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 217, 61, 0.70);

      --cqd-color-cancel: #EC6300;
      --cqd-shadow-cancel: 0 12px 28px rgba(236, 99, 0, 0.40);
      --cqd-shadow-cancel-strong: 0 12px 28px rgba(236, 99, 0, 0.70);

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
    }

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

      --cqd-color-trying: #FFD93D;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 217, 61, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 217, 61, 0.70);

      --cqd-color-cancel: #FF9142;
      --cqd-shadow-cancel: 0 12px 28px rgba(255, 145, 66, 0.40);
      --cqd-shadow-cancel-strong: 0 12px 28px rgba(255, 145, 66, 0.70);

      --cqd-spinner-border: rgba(15, 23, 42, 0.22);
      --cqd-spinner-top: #0f172a;
    }

    /* ===============================
     * DOWNLOAD BUTTON (student-work rows)
     * =============================== */
${renderSharedButtonSheet(SW_SHEET_BUTTONS)}
  `.trim();
  (document.head || document.documentElement).appendChild(style);
}