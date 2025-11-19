import { DOWNLOAD_ICON_SVG_URL } from './icons';

const STYLE_ID = 'cqd-style';
const SPINNER_SIZE_PX = 16;

// Smooth, slightly bouncy transition for the "Drop" feel
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
      --cqd-color-primary: #1a73e8;
      --cqd-color-success: #34a853;
      --cqd-color-error: #e05952;
      --cqd-frame-color: #3b82f6;

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
      --cqd-shadow-pill: 0 8px 22px rgba(15, 23, 42, 0.30);
      --cqd-shadow-success: 0 12px 28px rgba(24, 128, 56, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(24, 128, 56, 0.70);
      --cqd-shadow-error: 0 12px 28px rgba(224, 89, 82, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(224, 89, 82, 0.70);
    }

    /* ============================================================
     * CRITICAL OVERRIDES: Force Google Card to show the Badge
     * ============================================================ */
    div[data-stream-item-id] {
        overflow: visible !important;
        contain: none !important;
        z-index: 1;
    }

    /* ===============================
     * 1. EXISTING DOWNLOAD BUTTON STYLES (Unchanged)
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
      width: 40px;
      max-width: calc(100% - 16px);
      padding: 0;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-primary);
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
      transition: width var(--cqd-transition), padding-inline var(--cqd-transition), border-radius var(--cqd-transition), box-shadow var(--cqd-transition), transform var(--cqd-transition), background-color var(--cqd-transition);
    }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-success):not(.cqd-error):hover {
      width: 120px; padding-inline: 12px; box-shadow: var(--cqd-shadow-hover); justify-content: flex-start; transform: translateY(-50%) scale(1); border-radius: 20px;
    }
    .cqd-download-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
    .cqd-download-btn:active { box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3); transform: translateY(-50%) scale(0.97); }
    .cqd-download-btn .cqd-icon-wrapper { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cqd-download-icon {
      display: block; width: 24px; height: 24px; background-image: url("${DOWNLOAD_ICON_SVG_URL}"); background-repeat: no-repeat; background-position: center; background-size: 24px 24px; flex-shrink: 0; transform-origin: center;
      transition: width var(--cqd-transition), height var(--cqd-transition), border-width var(--cqd-transition);
    }
    .cqd-icon-small { width: 16px; height: 16px; background-size: 16px 16px; }
    .cqd-icon-medium { width: 24px; height: 24px; background-size: 24px 24px; }
    .cqd-icon-large { width: 32px; height: 32px; background-size: 32px 32px; }
    .cqd-download-btn .cqd-label { opacity: 0; margin-left: 0; max-width: 0; overflow: hidden; transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition); }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-error):not(.cqd-success):hover .cqd-label { opacity: 1; max-width: 110px; margin-left: 4px; }
    .cqd-download-btn.cqd-loading, .cqd-download-btn.cqd-success, .cqd-download-btn.cqd-error { padding-inline: 12px; border-radius: 20px; justify-content: flex-start; box-shadow: var(--cqd-shadow-pill); cursor: default; width: 150px; transform: translateY(-50%) scale(1); }
    .cqd-download-btn.cqd-loading:active, .cqd-download-btn.cqd-success:active, .cqd-download-btn.cqd-error:active { transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-pill); }
    .cqd-download-btn.cqd-loading .cqd-label { opacity: 1; max-width: 110px; margin-left: 12px; }
    .cqd-download-btn.cqd-loading:hover { padding-inline: 12px; border-radius: 20px; transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-pill); }
    .cqd-download-btn.cqd-success { width: 140px; background-color: var(--cqd-color-success); box-shadow: var(--cqd-shadow-success); }
    .cqd-download-btn.cqd-success .cqd-label { opacity: 1; max-width: 110px; margin-left: 8px; }
    .cqd-download-btn.cqd-success:hover { width: 140px; transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-success-strong); }
    .cqd-download-btn.cqd-error { width: 90px; background-color: var(--cqd-color-error); box-shadow: var(--cqd-shadow-error); height: 40px; max-width: 150px; max-height: 40px; padding-top: 0; padding-bottom: 0; align-items: center; transition: all var(--cqd-transition); }
    .cqd-download-btn.cqd-error .cqd-label { opacity: 1; margin-left: 8px; max-width: 110px; overflow: hidden; flex: 0 0 auto; }
    .cqd-error-detail { display: block; font-size: 11px; font-weight: 500; line-height: 1.3; margin-left: 0; margin-top: 0; opacity: 0; max-height: 0; overflow: hidden; white-space: normal; transform: translateY(4px); transition: all var(--cqd-transition); }
    .cqd-download-btn.cqd-error:hover { width: 350px; max-width: 360px; height: 60px; max-height: 61px; padding-top: 8px; padding-bottom: 8px; border-radius: 18px; align-items: center; white-space: normal; gap: 7px; box-shadow: var(--cqd-shadow-error-strong); }
    .cqd-download-btn.cqd-error:hover .cqd-label { opacity: 0; max-width: 0; margin-left: 0; }
    .cqd-download-btn.cqd-error:hover .cqd-error-detail { opacity: 1; max-height: 60px; margin-top: 4px; transform: translateY(0); }
    .cqd-spinner { background-image: none; border-radius: 9999px; width: ${SPINNER_SIZE_PX}px; height: ${SPINNER_SIZE_PX}px; border: 3px solid rgba(255, 255, 255, 0.22); border-top-color: #ffffff; box-shadow: none; animation: cqd-spin 0.65s linear infinite; }
    @keyframes cqd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    /* ===============================
     * 2. COMMENT FRAME & VERTICAL PILL BADGE
     * =============================== */

    /* The Border Frame */
    .cqd-overlay-container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none; 
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit; 
      transition: all 0.2s ease;
      /* Subtle frame glow */
      box-shadow: inset 0 0 0 2px var(--cqd-frame-color), 0 0 12px rgba(59, 130, 246, 0.4);
    }
    
    /* THE BADGE (Vertical Drop) */
    .cqd-comment-badge {
      position: absolute;
      top: 21px; 
      z-index: 9999; /* Always on top */

      display: flex;
      /* VERTICAL STACKING */
      flex-direction: column; 
      align-items: center;
      justify-content: center;
      
      /* Dimensions */
      width: 30px;      
      height: 30px;
      
      background-color: var(--cqd-frame-color);
      color: #ffffff;
      border-radius: 9999px;
      
      cursor: pointer;
      overflow: hidden;
      
      /* Animate Height */
      transition: 
        height var(--cqd-transition),
        box-shadow 0.2s ease;
    }

    /* HOVER STATE: Expands Vertically to show number */
    .cqd-comment-badge:hover {
      height: 58px; /* Enough space for Icon + Number */
    }

    /* --- ATTACHMENT LOGIC (Centering on the border) --- */

    /* LTR (Left Border) */
    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    /* RTL (Right Border) */
    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0; 
      transform: translateX(50%);
    }

    /* ICON */
    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      
      margin-top: 2px;

      /* Ensure icon stays put during transition */
      transition: transform 0.2s ease;
    }

    /* LABEL (The Number) */
    .cqd-badge-label {
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 700;
      
      opacity: 0;
      transform: translateY(-5px);

      max-height: 0;
      margin-top: 2px;
      overflow: hidden;

      transition:
        opacity 0.15s ease 0.05s,
        transform 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
      
    }
    
    /* Reveal Number on Hover */
    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;   /* enough for one line of text */
    }
  `.trim();

  (document.head || document.documentElement).appendChild(style);
}