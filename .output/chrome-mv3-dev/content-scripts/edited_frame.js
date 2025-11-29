var editedframe = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const DOWNLOAD_ICON_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`;
  const DOWNLOAD_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    DOWNLOAD_ICON_SVG_RAW
  )}`;
  const COMMENT_ICON_SVG_RAW = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M10.968 18.769C15.495 18.107 19 14.434 19 9.938a8.49 8.49 0 0 0-.216-1.912C20.718 9.178 22 11.188 22 13.475a6.1 6.1 0 0 1-1.113 3.506c.06.949.396 1.781 1.01 2.497a.43.43 0 0 1-.36.71c-1.367-.111-2.485-.426-3.354-.945A7.434 7.434 0 0 1 15 19.95a7.36 7.36 0 0 1-4.032-1.181z" fill="#ffffff"></path><path d="M7.625 16.657c.6.142 1.228.218 1.875.218 4.142 0 7.5-3.106 7.5-6.938C17 6.107 13.642 3 9.5 3 5.358 3 2 6.106 2 9.938c0 1.946.866 3.705 2.262 4.965a4.406 4.406 0 0 1-1.045 2.29.46.46 0 0 0 .386.76c1.7-.138 3.041-.57 4.022-1.296z" fill="#ffffff"></path></g></svg>`;
  const EDIT_ICON_SVG_RAW = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 3.99997H6C4.89543 3.99997 4 4.8954 4 5.99997V18C4 19.1045 4.89543 20 6 20H18C19.1046 20 20 19.1045 20 18V12M18.4142 8.41417L19.5 7.32842C20.281 6.54737 20.281 5.28104 19.5 4.5C18.7189 3.71895 17.4526 3.71895 16.6715 4.50001L15.5858 5.58575M18.4142 8.41417L12.3779 14.4505C12.0987 14.7297 11.7431 14.9201 11.356 14.9975L8.41422 15.5858L9.00257 12.6441C9.08001 12.2569 9.27032 11.9013 9.54951 11.6221L15.5858 5.58575M18.4142 8.41417L15.5858 5.58575" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`;
  const COMMENT_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    COMMENT_ICON_SVG_RAW
  )}`;
  const STYLE_ID = "cqd-style";
  const SPINNER_SIZE_PX = 16;
  const TRANSITION_MS = 150;
  const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
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
      width: 40px;
      max-width: calc(100% - 16px);
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
        width var(--cqd-transition),
        padding-inline var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition);
    }

    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover {
      width: 120px;
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
      max-width: 110px;
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
      width: 150px;
      transform: translateY(-50%) scale(1);
    }

    .cqd-download-btn.cqd-trying {
      width: 110px;
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
      max-width: 110px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-success {
      width: 140px;
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success:hover {
      box-shadow: var(--cqd-shadow-success-strong);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-error {
      width: 90px;
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
      height: 40px;
      max-width: 150px;
      max-height: 40px;
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
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-comment),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    .cqd-comment-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 30px;
      background-color: var(--cqd-color-comment);
      color: #ffffff;
      border-radius: 9999px;
      cursor: pointer;
      overflow: hidden;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
    }

    .cqd-comment-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }

    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      margin-top: 4px;
    }

    .cqd-badge-label {
      display: block;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      opacity: 0;
      transform: translateY(-5px);
      max-height: 0;
      margin-top: 2px;
      overflow: hidden;
      transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
    }

    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    .cqd-overlay-container.cqd-edited {
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-edited),
        0 0 12px rgba(0, 214, 238, 0.3);
    }

    .cqd-edited-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 30px;
      background-color: var(--cqd-color-edited);
      color: #ffffff;
      border-radius: 9999px;
      cursor: default;
      overflow: hidden;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
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

    .cqd-edited-badge:hover {
      height: 50px;
      border-radius: 20px;
      padding-bottom: 8px;
      z-index: 10000;
    }

    .cqd-edited-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    .cqd-edited-badge:hover .cqd-edited-content {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    .cqd-diff-val {
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 13px;
    }

    div[data-stream-item-id][data-cqd-processed][data-cqd-edited-processed] > .cqd-overlay-container {
      box-shadow:
        inset 0 0 0 2px #FF4036,
        0 0 12px rgba(255, 64, 54, 0.70);
    }

    .cqd-both-badge {
      position: absolute;
      top: 7px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      width: 30px;
      height: 70px;
      background-color: #FF4036;
      color: #ffffff;
      border-radius: 9999px;
      border: 1px solid rgba(255, 64, 54, 0.70);
      cursor: pointer;
      overflow: hidden;
      padding-top: 8px;
      transition: height var(--cqd-transition), box-shadow 0.2s ease;
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
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;
      transition:
        box-shadow 0.2s ease,
        transform 0.1s ease,
        background-color 0.3s ease;
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
      
      /* Important: Margin to separate from the "Three Dots" menu */
      margin-inline-end: 8px;
      
      /* Ensure it doesn't get crushed in flex rows */
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

    .cqd-download-all-btn .cqd-download-all-main {
      font-weight: 600;
    }

    .cqd-download-all-btn .cqd-download-all-sub {
      font-size: 11px;
      opacity: 0.9;
      margin-left: 4px;
    }

  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  function isPageDark() {
    if (typeof document === "undefined") return false;
    const drScheme = document.documentElement.getAttribute("data-darkreader-scheme");
    if (drScheme === "dark") return true;
    if (drScheme === "light") return false;
    const darkTokens = ["dark", "dark-theme", "theme-dark", "night", "gm3-dark-theme"];
    const htmlClass = (document.documentElement.className || "").toLowerCase();
    const bodyClass = (document.body.className || "").toLowerCase();
    if (darkTokens.some((token) => htmlClass.includes(token) || bodyClass.includes(token))) {
      return true;
    }
    const probeEl = document.querySelector("div[data-stream-item-id]") || document.querySelector('[role="main"]') || document.body;
    const bgColor = getEffectiveBackgroundColor(probeEl);
    const brightness = parseBrightness(bgColor);
    return brightness < 105;
  }
  function getEffectiveBackgroundColor(start) {
    let el = start;
    const isTransparent = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
    while (el) {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor;
      if (!isTransparent(bg)) return bg;
      el = el.parentElement;
    }
    const htmlStyle = window.getComputedStyle(document.documentElement);
    const htmlBg = htmlStyle.backgroundColor;
    if (!isTransparent(htmlBg)) return htmlBg;
    return "rgb(255, 255, 255)";
  }
  function parseBrightness(rgbString) {
    const match = rgbString.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (!match) {
      return 255;
    }
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const brightness = Math.sqrt(
      0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)
    );
    return brightness;
  }
  const TRANSLATIONS = {
    en: {
      download: "Download",
      downloading: "Downloading…",
      trying: "Trying…",
      downloaded: "Downloaded",
      error: "Error",
      failed: "Download failed.",
      ariaDownload: "Download",
      titleQuick: "Quick download",
      comments: "comments",
      edited: "Edited",
      downloadAll: "Download all"
    },
    ar: {
      download: "تنزيل",
      downloading: "جاري التنزيل…",
      trying: "محاولة…",
      downloaded: "تم التنزيل",
      error: "خطأ",
      failed: "فشل التنزيل.",
      ariaDownload: "تنزيل",
      titleQuick: "تنزيل سريع",
      comments: "تعليقات",
      edited: "تم التعديل",
      downloadAll: "تنزيل الكل"
    },
    ja: {
      download: "ダウンロード",
      downloading: "DL中…",
      trying: "試行中…",
      downloaded: "完了",
      error: "エラー",
      failed: "失敗しました。",
      ariaDownload: "ダウンロード",
      titleQuick: "クイックダウンロード",
      comments: "件のコメント",
      edited: "編集済み"
    },
    es: {
      download: "Descargar",
      downloading: "Descargando…",
      trying: "Intentando…",
      downloaded: "Descargado",
      error: "Error",
      failed: "Falló la descarga.",
      ariaDownload: "Descargar",
      titleQuick: "Descarga rápida",
      comments: "comentarios",
      edited: "Editado"
    },
    hi: {
      download: "डाउनलोड",
      downloading: "डाउनलोडिंग…",
      trying: "कोशिश जारी…",
      downloaded: "पूर्ण",
      error: "त्रुटि",
      failed: "विफल रहा",
      ariaDownload: "डाउनलोड",
      titleQuick: "त्वरित डाउनलोड",
      comments: "टिप्पणियाँ",
      edited: "संपादित"
    },
    pt: {
      download: "Baixar",
      downloading: "Baixando…",
      trying: "Tentando…",
      downloaded: "Baixado",
      error: "Erro",
      failed: "Falha ao baixar.",
      ariaDownload: "Baixar",
      titleQuick: "Download rápido",
      comments: "comentários",
      edited: "Editado"
    },
    "pt-pt": {
      download: "Descarregar",
      downloading: "A descarregar…",
      trying: "A tentar…",
      downloaded: "Descarregado",
      error: "Erro",
      failed: "Falha ao descarregar.",
      ariaDownload: "Descarregar",
      titleQuick: "Descarga rápida",
      comments: "comentários",
      edited: "Editado"
    },
    "zh-cn": {
      download: "下载",
      downloading: "下载中…",
      trying: "尝试中…",
      downloaded: "已下载",
      error: "错误",
      failed: "下载失败",
      ariaDownload: "下载",
      titleQuick: "快速下载",
      comments: "条评论",
      edited: "已编辑"
    },
    "zh-tw": {
      download: "下載",
      downloading: "下載中…",
      trying: "嘗試中…",
      downloaded: "已下載",
      error: "錯誤",
      failed: "下載失敗",
      ariaDownload: "下載",
      titleQuick: "快速下載",
      comments: "則留言",
      edited: "已編輯"
    },
    fr: {
      download: "Télécharger",
      downloading: "Téléchargement…",
      trying: "Essai…",
      downloaded: "Téléchargé",
      error: "Erreur",
      failed: "Échec.",
      ariaDownload: "Télécharger",
      titleQuick: "Téléchargement rapide",
      comments: "commentaires",
      edited: "Modifié"
    },
    de: {
      download: "Herunterladen",
      downloading: "Laden…",
      trying: "Versuchen…",
      downloaded: "Fertig",
      error: "Fehler",
      failed: "Fehlgeschlagen.",
      ariaDownload: "Herunterladen",
      titleQuick: "Schneller Download",
      comments: "Kommentare",
      edited: "Bearbeitet"
    },
    it: {
      download: "Scarica",
      downloading: "Scaricamento…",
      trying: "Provando…",
      downloaded: "Scaricato",
      error: "Errore",
      failed: "Fallito.",
      ariaDownload: "Scarica",
      titleQuick: "Download rapido",
      comments: "commenti",
      edited: "Modificato"
    },
    ru: {
      download: "Скачать",
      downloading: "Скачивание…",
      trying: "Попытка…",
      downloaded: "Скачано",
      error: "Ошибка",
      failed: "Сбой.",
      ariaDownload: "Скачать",
      titleQuick: "Быстрое скачивание",
      comments: "комментариев",
      edited: "Изменено"
    },
    ko: {
      download: "다운로드",
      downloading: "다운로드 중…",
      trying: "시도 중…",
      downloaded: "완료",
      error: "오류",
      failed: "실패함",
      ariaDownload: "다운로드",
      titleQuick: "빠른 다운로드",
      comments: "개 댓글",
      edited: "수정됨"
    },
    tr: {
      download: "İndir",
      downloading: "İndiriliyor…",
      trying: "Deneniyor…",
      downloaded: "İndirildi",
      error: "Hata",
      failed: "Başarısız.",
      ariaDownload: "İndir",
      titleQuick: "Hızlı indir",
      comments: "yorum",
      edited: "Düzenlendi"
    },
    vi: {
      download: "Tải xuống",
      downloading: "Đang tải…",
      trying: "Đang thử…",
      downloaded: "Đã tải",
      error: "Lỗi",
      failed: "Thất bại.",
      ariaDownload: "Tải xuống",
      titleQuick: "Tải xuống nhanh",
      comments: "nhận xét",
      edited: "Đã chỉnh sửa"
    },
    id: {
      download: "Download",
      downloading: "Mengunduh…",
      trying: "Mencoba…",
      downloaded: "Selesai",
      error: "Kesalahan",
      failed: "Gagal.",
      ariaDownload: "Download",
      titleQuick: "Download cepat",
      comments: "komentar",
      edited: "Diedit"
    },
    th: {
      download: "ดาวน์โหลด",
      downloading: "กำลังโหลด…",
      trying: "พยายาม…",
      downloaded: "เสร็จสิ้น",
      error: "ข้อผิดพลาด",
      failed: "ล้มเหลว",
      ariaDownload: "ดาวน์โหลด",
      titleQuick: "ดาวน์โหลดด่วน",
      comments: "ความคิดเห็น",
      edited: "แก้ไขแล้ว"
    },
    pl: {
      download: "Pobierz",
      downloading: "Pobieranie…",
      trying: "Próba…",
      downloaded: "Pobrano",
      error: "Błąd",
      failed: "Nieudane.",
      ariaDownload: "Pobierz",
      titleQuick: "Szybkie pobieranie",
      comments: "komentarze",
      edited: "Edytowano"
    },
    nl: {
      download: "Downloaden",
      downloading: "Downloaden…",
      trying: "Proberen…",
      downloaded: "Klaar",
      error: "Fout",
      failed: "Mislukt.",
      ariaDownload: "Downloaden",
      titleQuick: "Snel downloaden",
      comments: "reacties",
      edited: "Bewerkt"
    },
    bn: {
      download: "ডাউনলোড",
      downloading: "ডাউনলোড হচ্ছে…",
      trying: "চেষ্টা করছে…",
      downloaded: "সম্পন্ন",
      error: "ত্রুটি",
      failed: "ব্যর্থ হয়েছে",
      ariaDownload: "ডাউনলোড",
      titleQuick: "দ্রুত ডাউনলোড",
      comments: "টি মন্তব্য",
      edited: "সম্পাদিত"
    },
    pa: {
      download: "ਡਾਉਨਲੋਡ",
      downloading: "ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…",
      trying: "ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…",
      downloaded: "ਮੁਕੰਮਲ",
      error: "ਗਲਤੀ",
      failed: "ਅਸਫਲ",
      ariaDownload: "ਡਾਉਨਲੋਡ",
      titleQuick: "ਤੇਜ਼ ਡਾਉਨਲੋਡ",
      comments: "ਟਿੱਪਣੀਆਂ",
      edited: "ਸੰਪਾਦਿਤ"
    },
    te: {
      download: "డౌన్‌లోడ్",
      downloading: "డౌన్‌లోడ్ అవుతోంది…",
      trying: "ప్రయత్నిస్తోంది…",
      downloaded: "పూర్తయింది",
      error: "లోపం",
      failed: "విఫలమైంది",
      ariaDownload: "డౌన్‌లోడ్",
      titleQuick: "త్వరిత డౌన్‌లోడ్",
      comments: "వ్యాఖ్యలు",
      edited: "సవరించబడింది"
    },
    mr: {
      download: "डाउनलोड",
      downloading: "डाउनलोड होत आहे…",
      trying: "प्रयत्न करत आहे…",
      downloaded: "पूर्ण",
      error: "त्रुटी",
      failed: "अयशस्वी",
      ariaDownload: "डाउनलोड",
      titleQuick: "त्वरित डाउनलोड",
      comments: "टिप्पण्या",
      edited: "संपादित"
    },
    ta: {
      download: "பதிவிறக்கு",
      downloading: "பதிவிறக்கப்படுகிறது…",
      trying: "முயற்சிக்கிறது…",
      downloaded: "முடிந்தது",
      error: "பிழை",
      failed: "தோல்வி",
      ariaDownload: "பதிவிறக்கு",
      titleQuick: "விரைவு பதிவிறக்கம்",
      comments: "கருத்துகள்",
      edited: "திருத்தப்பட்டது"
    },
    ur: {
      download: "ڈاؤن لوڈ",
      downloading: "ڈاؤن لوڈ ہو رہا ہے…",
      trying: "کوشش جاری…",
      downloaded: "مکمل",
      error: "غلطی",
      failed: "ناکام",
      ariaDownload: "ڈاؤن لوڈ",
      titleQuick: "فوری ڈاؤن لوڈ",
      comments: "تبصرے",
      edited: "ترمیم شدہ"
    },
    gu: {
      download: "ડાઉનલોડ",
      downloading: "ડાઉનલોડ થઈ રહ્યું છે…",
      trying: "પ્રયાસ ચાલુ…",
      downloaded: "પૂર્ણ",
      error: "ભૂલ",
      failed: "નિષ્ફળ",
      ariaDownload: "ડાઉનલોડ",
      titleQuick: "ઝડપી ડાઉનલોડ",
      comments: "ટિપ્પણીઓ",
      edited: "સંપાદિત"
    },
    kn: {
      download: "ಡೌನ್‌ಲೋಡ್",
      downloading: "ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
      trying: "ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…",
      downloaded: "ಪೂರ್ಣಗೊಂಡಿದೆ",
      error: "ದೋಷ",
      failed: "ವಿಫಲವಾಗಿದೆ",
      ariaDownload: "ಡೌನ್‌ಲೋಡ್",
      titleQuick: "ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್",
      comments: "ಕಾಮೆಂಟ್‌ಗಳು",
      edited: "ಸಂಪಾದಿಸಲಾಗಿದೆ"
    },
    ml: {
      download: "ഡൗൺലോഡ്",
      downloading: "ഡൗൺലോഡ് ചെയ്യുന്നു…",
      trying: "ശ്രമിക്കുന്നു…",
      downloaded: "പൂർത്തിയായി",
      error: "പിശക്",
      failed: "പരാജയപ്പെട്ടു",
      ariaDownload: "ഡൗൺലോഡ്",
      titleQuick: "വേഗത്തിൽ ഡൗൺലോഡ്",
      comments: "അഭിപ്രായങ്ങൾ",
      edited: "എഡിറ്റുചെയ്തു"
    },
    uk: {
      download: "Завантажити",
      downloading: "Завантаження…",
      trying: "Спроба…",
      downloaded: "Готово",
      error: "Помилка",
      failed: "Невдача.",
      ariaDownload: "Завантажити",
      titleQuick: "Швидке завантаження",
      comments: "коментарів",
      edited: "Змінено"
    },
    el: {
      download: "Λήψη",
      downloading: "Λήψη…",
      trying: "Προσπάθεια…",
      downloaded: "Ολοκληρώθηκε",
      error: "Σφάλμα",
      failed: "Απέτυχε.",
      ariaDownload: "Λήψη",
      titleQuick: "Γρήγορη λήψη",
      comments: "σχόλια",
      edited: "Επεξεργασμένο"
    },
    cs: {
      download: "Stáhnout",
      downloading: "Stahování…",
      trying: "Zkouším…",
      downloaded: "Staženo",
      error: "Chyba",
      failed: "Selhalo.",
      ariaDownload: "Stáhnout",
      titleQuick: "Rychlé stažení",
      comments: "komentářů",
      edited: "Upraveno"
    },
    ro: {
      download: "Descărcați",
      downloading: "Se descarcă…",
      trying: "Se încearcă…",
      downloaded: "Finalizat",
      error: "Eroare",
      failed: "Eșuat.",
      ariaDownload: "Descărcați",
      titleQuick: "Descărcare rapidă",
      comments: "comentarii",
      edited: "Modificat"
    },
    hu: {
      download: "Letöltés",
      downloading: "Letöltés…",
      trying: "Próbálkozás…",
      downloaded: "Kész",
      error: "Hiba",
      failed: "Sikertelen.",
      ariaDownload: "Letöltés",
      titleQuick: "Gyors letöltés",
      comments: "megjegyzés",
      edited: "Szerkesztve"
    },
    sv: {
      download: "Ladda ner",
      downloading: "Laddar ner…",
      trying: "Försöker…",
      downloaded: "Klart",
      error: "Fel",
      failed: "Misslyckades.",
      ariaDownload: "Ladda ner",
      titleQuick: "Snabb nedladdning",
      comments: "kommentarer",
      edited: "Redigerad"
    },
    da: {
      download: "Hent",
      downloading: "Henter…",
      trying: "Prøver…",
      downloaded: "Hentet",
      error: "Fejl",
      failed: "Mislykkedes.",
      ariaDownload: "Hent",
      titleQuick: "Hurtig download",
      comments: "kommentarer",
      edited: "Redigeret"
    },
    fi: {
      download: "Lataa",
      downloading: "Ladataan…",
      trying: "Yritetään…",
      downloaded: "Ladattu",
      error: "Virhe",
      failed: "Epäonnistui.",
      ariaDownload: "Lataa",
      titleQuick: "Pikalataus",
      comments: "kommenttia",
      edited: "Muokattu"
    },
    no: {
      download: "Last ned",
      downloading: "Laster ned…",
      trying: "Prøver…",
      downloaded: "Ferdig",
      error: "Feil",
      failed: "Mislyktes.",
      ariaDownload: "Last ned",
      titleQuick: "Rask nedlasting",
      comments: "kommentarer",
      edited: "Redigert"
    },
    he: {
      download: "הורדה",
      downloading: "מוריד…",
      trying: "מנסה…",
      downloaded: "הושלם",
      error: "שגיאה",
      failed: "נכשל",
      ariaDownload: "הורדה",
      titleQuick: "הורדה מהירה",
      comments: "תגובות",
      edited: "נערך"
    },
    fa: {
      download: "دانلود",
      downloading: "درحال دانلود…",
      trying: "تلاش مجدد…",
      downloaded: "انجام شد",
      error: "خطا",
      failed: "ناموفق",
      ariaDownload: "دانلود",
      titleQuick: "دانلود سریع",
      comments: "نظر",
      edited: "ویرایش شده"
    },
    fil: {
      download: "I-download",
      downloading: "Nagda-download…",
      trying: "Sinusubukan…",
      downloaded: "Tapos na",
      error: "Error",
      failed: "Nabigo.",
      ariaDownload: "I-download",
      titleQuick: "Mabilis na download",
      comments: "mga komento",
      edited: "Na-edit"
    },
    ms: {
      download: "Muat turun",
      downloading: "Memuat turun…",
      trying: "Mencuba…",
      downloaded: "Selesai",
      error: "Ralat",
      failed: "Gagal.",
      ariaDownload: "Muat turun",
      titleQuick: "Muat turun pantas",
      comments: "komen",
      edited: "Diedit"
    },
    sr: {
      download: "Преузми",
      downloading: "Преузимање…",
      trying: "Покушавам…",
      downloaded: "Завршено",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Преузми",
      titleQuick: "Брзо преузимање",
      comments: "коментара",
      edited: "Измењено"
    },
    sk: {
      download: "Stiahnuť",
      downloading: "Sťahovanie…",
      trying: "Skúšam…",
      downloaded: "Hotovo",
      error: "Chyba",
      failed: "Zlyhalo.",
      ariaDownload: "Stiahnuť",
      titleQuick: "Rýchle stiahnutie",
      comments: "komentárov",
      edited: "Upravené"
    },
    bg: {
      download: "Изтегли",
      downloading: "Изтегляне…",
      trying: "Опит…",
      downloaded: "Готово",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Изтегли",
      titleQuick: "Бързо изтегляне",
      comments: "коментара",
      edited: "Редактирано"
    },
    hr: {
      download: "Preuzmi",
      downloading: "Preuzimanje…",
      trying: "Pokušavam…",
      downloaded: "Gotovo",
      error: "Greška",
      failed: "Neuspjelo.",
      ariaDownload: "Preuzmi",
      titleQuick: "Brzo preuzimanje",
      comments: "komentara",
      edited: "Uređeno"
    },
    lt: {
      download: "Atsisiųsti",
      downloading: "Siunčiama…",
      trying: "Bandoma…",
      downloaded: "Baigta",
      error: "Klaida",
      failed: "Nepavyko.",
      ariaDownload: "Atsisiųsti",
      titleQuick: "Greitas atsisiuntimas",
      comments: "komentarai",
      edited: "Redaguota"
    },
    lv: {
      download: "Lejupielādēt",
      downloading: "Lejupielādē…",
      trying: "Mēģina…",
      downloaded: "Pabeigts",
      error: "Kļūda",
      failed: "Neizdevās.",
      ariaDownload: "Lejupielādēt",
      titleQuick: "Ātrā lejupielāde",
      comments: "komentāri",
      edited: "Rediģēts"
    },
    et: {
      download: "Laadi alla",
      downloading: "Laadimine…",
      trying: "Proovin…",
      downloaded: "Valmis",
      error: "Viga",
      failed: "Ebaõnnestus.",
      ariaDownload: "Laadi alla",
      titleQuick: "Kiire allalaadimine",
      comments: "kommentaari",
      edited: "Muudetud"
    },
    sl: {
      download: "Prenos",
      downloading: "Prenašanje…",
      trying: "Poskušam…",
      downloaded: "Končano",
      error: "Napaka",
      failed: "Ni uspelo.",
      ariaDownload: "Prenos",
      titleQuick: "Hiter prenos",
      comments: "komentarjev",
      edited: "Urejeno"
    },
    ca: {
      download: "Descarrega",
      downloading: "Descarregant…",
      trying: "Intentant…",
      downloaded: "Descarregat",
      error: "Error",
      failed: "Ha fallat.",
      ariaDownload: "Descarrega",
      titleQuick: "Descàrrega ràpida",
      comments: "comentaris",
      edited: "Editat"
    },
    af: {
      download: "Aflaai",
      downloading: "Laai af…",
      trying: "Probeer…",
      downloaded: "Klaar",
      error: "Fout",
      failed: "Misluk.",
      ariaDownload: "Aflaai",
      titleQuick: "Vinnige aflaai",
      comments: "kommentare",
      edited: "Geredigeer"
    },
    am: {
      download: "አውርድ",
      downloading: "በማውረድ ላይ…",
      trying: "በመሞከር ላይ…",
      downloaded: "ወርዷል",
      error: "ስህተት",
      failed: "አልተሳካም።",
      ariaDownload: "አውርድ",
      titleQuick: "ፈጣን ማውረድ",
      comments: "አስተያየቶች",
      edited: "ተስተካክሏል"
    },
    hy: {
      download: "Ներբեռնել",
      downloading: "Ներբեռնում…",
      trying: "Փորձում է…",
      downloaded: "Ավարտված",
      error: "Սխալ",
      failed: "Ձախողվեց:",
      ariaDownload: "Ներբեռնել",
      titleQuick: "Արագ ներբեռնում",
      comments: "մեկնաբանություն",
      edited: "Խմբագրվել է"
    },
    as: {
      download: "ডাউন্লোড",
      downloading: "ডাউন্লোড হৈ আছে…",
      trying: "চেষ্টা কৰি আছে…",
      downloaded: "সম্পূৰ্ণ",
      error: "ত্ৰুটি",
      failed: "বিফল হ’ল",
      ariaDownload: "ডাউন্লোড",
      titleQuick: "দ্ৰুত ডাউন্লোড",
      comments: "মন্তব্য",
      edited: "সম্পাদিত"
    },
    az: {
      download: "Yüklə",
      downloading: "Yüklənir…",
      trying: "Cəhd edilir…",
      downloaded: "Bitdi",
      error: "Xəta",
      failed: "Alınmadı.",
      ariaDownload: "Yüklə",
      titleQuick: "Sürətli yükləmə",
      comments: "şərh",
      edited: "Düzəliş edilib"
    },
    eu: {
      download: "Deskargatu",
      downloading: "Deskargatzen…",
      trying: "Saiatzen…",
      downloaded: "Eginda",
      error: "Errorea",
      failed: "Huts egin du.",
      ariaDownload: "Deskargatu",
      titleQuick: "Deskarga azkarra",
      comments: "iruzkin",
      edited: "Editatua"
    },
    my: {
      download: "ဒေါင်းလုဒ်",
      downloading: "ဒေါင်းလုဒ် လုပ်နေ…",
      trying: "ကြိုးစားနေ…",
      downloaded: "ပြီးပါပြီ",
      error: "အမှား",
      failed: "မအောင်မြင်ပါ။",
      ariaDownload: "ဒေါင်းလုဒ်",
      titleQuick: "အမြန် ဒေါင်းလုဒ်",
      comments: "မှတ်ချက်များ",
      edited: "ပြင်ဆင်ပြီး"
    },
    gl: {
      download: "Descargar",
      downloading: "Descargando…",
      trying: "Tentando…",
      downloaded: "Descargado",
      error: "Erro",
      failed: "Fallou.",
      ariaDownload: "Descargar",
      titleQuick: "Descarga rápida",
      comments: "comentarios",
      edited: "Editado"
    },
    ka: {
      download: "ჩამოტვირთვა",
      downloading: "იწერება…",
      trying: "მცდელობა…",
      downloaded: "დასრულდა",
      error: "შეცდომა",
      failed: "ვერ მოხერხდა.",
      ariaDownload: "ჩამოტვირთვა",
      titleQuick: "სწრაფი ჩამოტვირთვა",
      comments: "კომენტარი",
      edited: "რედაქტირებულია"
    },
    is: {
      download: "Sækja",
      downloading: "Sækir…",
      trying: "Reyni…",
      downloaded: "Sótt",
      error: "Villa",
      failed: "Mistókst.",
      ariaDownload: "Sækja",
      titleQuick: "Flýtiniðurhal",
      comments: "ummæli",
      edited: "Breytt"
    },
    ga: {
      download: "Íoslódáil",
      downloading: "Ag íoslódáil…",
      trying: "Ag iarraidh…",
      downloaded: "Íoslódáilte",
      error: "Earráid",
      failed: "Theip air.",
      ariaDownload: "Íoslódáil",
      titleQuick: "Íoslódáil tapa",
      comments: "trácht",
      edited: "Eagraithe"
    },
    kk: {
      download: "Жүктеп алу",
      downloading: "Жүктелуде…",
      trying: "Әрекет…",
      downloaded: "Аяқталды",
      error: "Қате",
      failed: "Сәтсіз.",
      ariaDownload: "Жүктеп алу",
      titleQuick: "Жылдам жүктеу",
      comments: "пікір",
      edited: "Өзгертілді"
    },
    km: {
      download: "ទាញយក",
      downloading: "កំពុងទាញយក…",
      trying: "កំពុងព្យាយាម…",
      downloaded: "បានបញ្ចប់",
      error: "កំហុស",
      failed: "បរាជ័យ",
      ariaDownload: "ទាញយក",
      titleQuick: "ទាញយកលឿន",
      comments: "មតិ",
      edited: "បានកែសម្រួល"
    },
    lo: {
      download: "ດາວໂຫລດ",
      downloading: "ກຳລັງດາວໂຫລດ…",
      trying: "ກຳລັງພະຍາຍາມ…",
      downloaded: "ສຳເລັດ",
      error: "ຜິດພາດ",
      failed: "ລົ້ມເຫລວ",
      ariaDownload: "ດາວໂຫລດ",
      titleQuick: "ດາວໂຫລດດ່ວນ",
      comments: "ຄຳເຫັນ",
      edited: "ແກ້ໄຂແລ້ວ"
    },
    mk: {
      download: "Преземи",
      downloading: "Преземање…",
      trying: "Се обидувам…",
      downloaded: "Готово",
      error: "Грешка",
      failed: "Неуспешно.",
      ariaDownload: "Преземи",
      titleQuick: "Брзо преземање",
      comments: "коментари",
      edited: "Изменето"
    },
    mn: {
      download: "Татах",
      downloading: "Татаж байна…",
      trying: "Орлдож байна…",
      downloaded: "Татсан",
      error: "Алдаа",
      failed: "Амжилтгүй.",
      ariaDownload: "Татах",
      titleQuick: "Хурдан татах",
      comments: "сэтгэгдэл",
      edited: "Зассан"
    },
    ne: {
      download: "डाउनलोड",
      downloading: "डाउनलोड हुँदै…",
      trying: "प्रयास गर्दै…",
      downloaded: "पूरा भयो",
      error: "त्रुटि",
      failed: "असफल भयो",
      ariaDownload: "डाउनलोड",
      titleQuick: "छिटो डाउनलोड",
      comments: "टिप्पणीहरू",
      edited: "सम्पादित"
    },
    or: {
      download: "ଡାଉନଲୋଡ୍",
      downloading: "ଡାଉନଲୋଡ୍ ହେଉଛି…",
      trying: "ଚେଷ୍ଟା କରୁଛି…",
      downloaded: "ସମ୍ପୂର୍ଣ୍ଣ",
      error: "ତ୍ରୁଟି",
      failed: "ବିଫଳ ହେଲା",
      ariaDownload: "ଡାଉନଲୋଡ୍",
      titleQuick: "ଶୀଘ୍ର ଡାଉନଲୋଡ୍",
      comments: "ମନ୍ତବ୍ୟ",
      edited: "ସମ୍ପାଦିତ"
    },
    si: {
      download: "බාගන්න",
      downloading: "බාගත වෙමින්…",
      trying: "උත්සාහ කරමින්…",
      downloaded: "අවසන්",
      error: "දෝෂයකි",
      failed: "අසාර්ථකයි",
      ariaDownload: "බාගන්න",
      titleQuick: "ඉක්මන් බාගත කිරීම",
      comments: "අදහස්",
      edited: "සංස්කරණය"
    },
    sw: {
      download: "Pakua",
      downloading: "Inapakua…",
      trying: "Inajaribu…",
      downloaded: "Imekamilika",
      error: "Hitilafu",
      failed: "Imeshindwa.",
      ariaDownload: "Pakua",
      titleQuick: "Pakua haraka",
      comments: "maoni",
      edited: "Imehaririwa"
    },
    uz: {
      download: "Yuklash",
      downloading: "Yuklanmoqda…",
      trying: "Urinilmoqda…",
      downloaded: "Tayyor",
      error: "Xato",
      failed: "Muvaffaqiyatsiz.",
      ariaDownload: "Yuklash",
      titleQuick: "Tez yuklash",
      comments: "sharhlar",
      edited: "Tahrirlangan"
    },
    cy: {
      download: "Lawrlwytho",
      downloading: "Yn lawrlwytho…",
      trying: "Yn ceisio…",
      downloaded: "Wedi gorffen",
      error: "Gwall",
      failed: "Methodd.",
      ariaDownload: "Lawrlwytho",
      titleQuick: "Lawrlwytho cyflym",
      comments: "sylwadau",
      edited: "Golygwyd"
    },
    zu: {
      download: "Landa",
      downloading: "Iyalandwa…",
      trying: "Iyazama…",
      downloaded: "Ilandīwe",
      error: "Iphutha",
      failed: "Ihlulekile.",
      ariaDownload: "Landa",
      titleQuick: "Ukulanda okusheshayo",
      comments: "amazwana",
      edited: "Kuhleliwe"
    },
    sq: {
      download: "Shkarko",
      downloading: "Duke shkarkuar…",
      trying: "Duke provuar…",
      downloaded: "Përfundoi",
      error: "Gabim",
      failed: "Dështoi.",
      ariaDownload: "Shkarko",
      titleQuick: "Shkarkim i shpejtë",
      comments: "komente",
      edited: "E redaktuar"
    }
  };
  function t(key) {
    try {
      if (!key || typeof key !== "string") ;
      let rawLang = "en";
      if (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) {
        rawLang = document.documentElement.lang;
      } else if (typeof navigator !== "undefined" && navigator.language) {
        rawLang = navigator.language;
      }
      const normalizedLang = rawLang.toLowerCase().split(";")[0].trim().replace("_", "-");
      const baseLang = normalizedLang.split("-")[0];
      if (TRANSLATIONS[normalizedLang] && typeof TRANSLATIONS[normalizedLang][key] === "string") {
        return TRANSLATIONS[normalizedLang][key];
      }
      if (TRANSLATIONS[baseLang] && typeof TRANSLATIONS[baseLang][key] === "string") {
        return TRANSLATIONS[baseLang][key];
      }
      if (TRANSLATIONS["en"] && typeof TRANSLATIONS["en"][key] === "string") {
        return TRANSLATIONS["en"][key];
      }
      return key;
    } catch {
      try {
        return TRANSLATIONS["en"][key] || key;
      } catch {
        return String(key);
      }
    }
  }
  const POST_SELECTOR = "div[data-stream-item-id]";
  const EDITED_ATTR = "data-cqd-edited-processed";
  let editedScanScheduled = false;
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      injectStyles();
      scanForEditedPosts();
      const observer = new MutationObserver(() => {
        if (editedScanScheduled) return;
        editedScanScheduled = true;
        requestAnimationFrame(() => {
          editedScanScheduled = false;
          scanForEditedPosts();
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-label", "title"]
      });
      setInterval(() => {
        scanForEditedPosts();
      }, 2500);
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          setTimeout(scanForEditedPosts, 500);
          setTimeout(scanForEditedPosts, 1500);
        }
      }).observe(document, { subtree: true, childList: true });
    }
  });
  function scanForEditedPosts() {
    try {
      const direction = getPageDirection();
      document.body.setAttribute("data-cqd-dir", direction);
      const editedWord = t("edited").toLowerCase();
      const posts = document.querySelectorAll(POST_SELECTOR);
      posts.forEach((post) => {
        let alreadyProcessed = false;
        if (post.hasAttribute(EDITED_ATTR)) {
          const hasEditedOverlay = !!post.querySelector(".cqd-overlay-container.cqd-edited") || !!post.querySelector(".cqd-edited-badge") || !!post.querySelector(".cqd-both-badge");
          if (!hasEditedOverlay) {
            post.removeAttribute(EDITED_ATTR);
          } else {
            alreadyProcessed = true;
          }
        }
        if (!alreadyProcessed) {
          const candidates = Array.from(
            post.querySelectorAll("a, span, div[aria-label]")
          );
          let found = false;
          let diffText = null;
          for (const el of candidates) {
            const text = (el.textContent || "").trim();
            const aria = (el.getAttribute("aria-label") || "").trim();
            const title = (el.getAttribute("title") || "").trim();
            const combined = `${text} ${aria} ${title}`.toLowerCase();
            if (!combined.includes(editedWord)) continue;
            const fullPostText = (post.innerText || "") + " " + getAriaLabels(post);
            diffText = calculateEditDiff(fullPostText, editedWord) ?? "+0";
            found = true;
            break;
          }
          if (found && diffText !== null) {
            post.setAttribute(EDITED_ATTR, "true");
            createEditedOverlay(post, diffText);
          }
        }
        upgradeCombinedBadge(post);
      });
    } catch {
    }
  }
  function calculateEditDiff(fullText, editedKeyword) {
    try {
      const normalized = (fullText || "").replace(/\s+/g, " ").trim();
      if (!normalized) return null;
      const lower = normalized.toLowerCase();
      const key = editedKeyword.toLowerCase();
      const editedIndex = lower.indexOf(key);
      const monthPattern = "\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}\\b";
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      const parseDate = (s) => {
        const d = /* @__PURE__ */ new Date(`${s.trim()} ${currentYear}`);
        return isNaN(d.getTime()) ? null : d;
      };
      let createdDate = null;
      let editedDate = null;
      if (editedIndex !== -1) {
        const beforeText = normalized.slice(0, editedIndex);
        const afterText = normalized.slice(editedIndex);
        const beforeMatches = beforeText.match(new RegExp(monthPattern, "gi")) || [];
        const afterMatches = afterText.match(new RegExp(monthPattern, "gi")) || [];
        if (beforeMatches.length > 0) {
          const createdStr = beforeMatches[beforeMatches.length - 1];
          createdDate = parseDate(createdStr);
        }
        if (afterMatches.length > 0) {
          const editedStr = afterMatches[0];
          editedDate = parseDate(editedStr);
        }
      }
      if (!createdDate || !editedDate) {
        const allMatches = normalized.match(
          new RegExp(monthPattern, "gi")
        );
        if (!allMatches || allMatches.length === 0) {
          return null;
        }
        const parsedDates = allMatches.map((m) => parseDate(m)).filter((d) => !!d);
        if (!parsedDates.length) return null;
        createdDate = parsedDates[0];
        editedDate = parsedDates.length > 1 ? parsedDates[parsedDates.length - 1] : parsedDates[0];
      }
      if (!createdDate || !editedDate) return null;
      const dayMs = 1e3 * 60 * 60 * 24;
      let diffDays = Math.floor(
        (editedDate.getTime() - createdDate.getTime()) / dayMs
      );
      if (diffDays < 0) diffDays = 0;
      return `+${diffDays}`;
    } catch {
      return null;
    }
  }
  function createEditedOverlay(post, diffText) {
    const computed = window.getComputedStyle(post);
    if (computed.position === "static") post.style.position = "relative";
    post.style.setProperty("overflow", "visible", "important");
    post.style.setProperty("contain", "none", "important");
    post.style.zIndex = "1";
    let overlay = post.querySelector(".cqd-overlay-container");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "cqd-overlay-container cqd-edited";
      overlay.style.borderRadius = computed.borderRadius || "8px";
      if (isPageDark()) overlay.classList.add("cqd-theme-dark");
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          const link = post.querySelector('a[href*="/details/"], h2 a');
          if (link) link.click();
          else post.click();
        }
      });
      post.appendChild(overlay);
    } else {
      overlay.classList.add("cqd-edited");
      if (isPageDark()) overlay.classList.add("cqd-theme-dark");
    }
    if (post.querySelector(".cqd-both-badge")) {
      return;
    }
    const existingEditedBadge = post.querySelector(".cqd-edited-badge");
    existingEditedBadge?.remove();
    const pill = document.createElement("div");
    pill.className = "cqd-edited-badge";
    if (isPageDark()) pill.classList.add("cqd-theme-dark");
    pill.title = "Days between posting and the last edit";
    pill.setAttribute("aria-label", pill.title);
    const iconWrapper = document.createElement("div");
    iconWrapper.className = "cqd-edited-icon";
    iconWrapper.innerHTML = EDIT_ICON_SVG_RAW;
    pill.appendChild(iconWrapper);
    const content = document.createElement("div");
    content.className = "cqd-edited-content";
    const diffSpan = document.createElement("span");
    diffSpan.className = "cqd-diff-val";
    diffSpan.textContent = diffText;
    content.appendChild(diffSpan);
    pill.appendChild(content);
    post.appendChild(pill);
  }
  function getPageDirection() {
    const docDir = document.documentElement.dir || document.body.dir;
    return docDir === "rtl" ? "rtl" : "ltr";
  }
  function upgradeCombinedBadge(post) {
    const overlay = post.querySelector(".cqd-overlay-container");
    const commentBadge = post.querySelector(".cqd-comment-badge");
    const editedBadge = post.querySelector(".cqd-edited-badge");
    let bothBadge = post.querySelector(".cqd-both-badge");
    const hasComments = !!commentBadge || post.hasAttribute("data-cqd-processed");
    const hasEdited = !!editedBadge || post.hasAttribute("data-cqd-edited-processed");
    if (!hasComments || !hasEdited) {
      bothBadge?.remove();
      return;
    }
    let commentCount = "0";
    const commentLabel = commentBadge?.querySelector(".cqd-badge-label");
    if (commentLabel?.textContent?.trim()) {
      commentCount = commentLabel.textContent.trim();
    } else if (bothBadge) {
      const existing = bothBadge.querySelector(".cqd-both-value-comment");
      if (existing?.textContent?.trim()) {
        commentCount = existing.textContent.trim();
      }
    }
    let diffText = "+0";
    const diffSpan = editedBadge?.querySelector(".cqd-diff-val");
    if (diffSpan?.textContent?.trim()) {
      diffText = diffSpan.textContent.trim();
    } else if (bothBadge) {
      const existing = bothBadge.querySelector(".cqd-both-value-edited");
      if (existing?.textContent?.trim()) {
        diffText = existing.textContent.trim();
      }
    }
    if (bothBadge) {
      const cc = bothBadge.querySelector(".cqd-both-value-comment");
      const dd = bothBadge.querySelector(".cqd-both-value-edited");
      if (cc) cc.textContent = commentCount;
      if (dd) dd.textContent = diffText;
      return;
    }
    commentBadge?.remove();
    editedBadge?.remove();
    if (!overlay) {
      const computed = window.getComputedStyle(post);
      const newOverlay = document.createElement("div");
      newOverlay.className = "cqd-overlay-container";
      newOverlay.style.borderRadius = computed.borderRadius || "8px";
      newOverlay.addEventListener("click", (e) => {
        if (e.target === newOverlay) {
          const link = post.querySelector('a[href*="/details/"], h2 a');
          if (link) link.click();
          else post.click();
        }
      });
      post.appendChild(newOverlay);
    }
    bothBadge = document.createElement("div");
    bothBadge.className = "cqd-both-badge";
    bothBadge.title = "Top: number of comments. Bottom: days between posting and last edit.";
    bothBadge.setAttribute("aria-label", bothBadge.title);
    const commentsSection = document.createElement("div");
    commentsSection.className = "cqd-both-section cqd-both-comments";
    const commentIcon = document.createElement("div");
    commentIcon.className = "cqd-both-icon cqd-both-icon-comment";
    commentIcon.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
    commentsSection.appendChild(commentIcon);
    const commentValue = document.createElement("span");
    commentValue.className = "cqd-both-value cqd-both-value-comment";
    commentValue.textContent = commentCount;
    commentsSection.appendChild(commentValue);
    const plus = document.createElement("div");
    plus.className = "cqd-both-plus";
    plus.textContent = "+";
    const divider = document.createElement("div");
    divider.className = "cqd-both-divider";
    const editedSection = document.createElement("div");
    editedSection.className = "cqd-both-section cqd-both-edited";
    const editedIcon = document.createElement("div");
    editedIcon.className = "cqd-both-icon cqd-both-icon-edited";
    editedIcon.innerHTML = EDIT_ICON_SVG_RAW;
    editedSection.appendChild(editedIcon);
    const diffValue = document.createElement("span");
    diffValue.className = "cqd-both-value cqd-both-value-edited";
    diffValue.textContent = diffText;
    editedSection.appendChild(diffValue);
    bothBadge.appendChild(commentsSection);
    bothBadge.appendChild(plus);
    bothBadge.appendChild(divider);
    bothBadge.appendChild(editedSection);
    bothBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPostClick(post);
    });
    post.appendChild(bothBadge);
  }
  function triggerPostClick(post) {
    const titleLink = post.querySelector('a[href*="/details/"], h2 a');
    if (titleLink) {
      titleLink.click();
    } else {
      post.click();
    }
  }
  function getAriaLabels(el) {
    return Array.from(el.querySelectorAll("[aria-label]")).map((node) => node.getAttribute("aria-label") || "").join(" ");
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"edited_frame"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("edited_frame", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"edited_frame"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdGVkX2ZyYW1lLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaWNvbnMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9lZGl0ZWRfZnJhbWUuY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcblxuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuXG4gICAgICAvKiBTcGlubmVyICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmO1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAoTGlnaHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA1REQ3O1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDkzLCAyMTUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgOTMsIDIxNSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0VDNjMwMDtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC10aGVtZS1kYXJrIHtcbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gKFNpbmdsZSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWljb24td3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtaWNvbiB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLXNtYWxsIHtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAxNnB4IDE2cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLW1lZGl1bSB7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1sYXJnZSB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMzJweCAzMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXgtd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXJnaW4tbGVmdCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgd2lkdGg6IDE1MHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcge1xuICAgICAgd2lkdGg6IDExMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXRyeWluZyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXRyeWluZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcgLmNxZC1sYWJlbCxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICB3aWR0aDogOTBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIG1heC13aWR0aDogMTUwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA0MHB4O1xuICAgICAgcGFkZGluZy10b3A6IDA7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogMDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZXJyb3ItZGV0YWlsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aGl0ZS1zcGFjZTogbm9ybWFsO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDRweCk7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciB7XG4gICAgICB3aWR0aDogMzUwcHg7XG4gICAgICBtYXgtd2lkdGg6IDM2MHB4O1xuICAgICAgaGVpZ2h0OiA2MHB4O1xuICAgICAgbWF4LWhlaWdodDogNjFweDtcbiAgICAgIHBhZGRpbmc6IDhweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE4cHg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA3cHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDYwcHg7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGNxZC1zcGluIHtcbiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDIuIENPTU1FTlRTICYgRURJVEVEIChPdmVybGF5KVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgei1pbmRleDogMTA7XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCB2YXIoLS1jcWQtY29sb3ItY29tbWVudCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoOTksIDEwMiwgMjQxLCAwLjUpO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwcHgpO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kaWZmLXZhbCB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF1bZGF0YS1jcWQtcHJvY2Vzc2VkXVtkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkXSA+IC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4ICNGRjQwMzYsXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogNzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGRjQwMzY7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHBhZGRpbmctdG9wOiA4cHg7XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtc2VjdGlvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbiB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24tZWRpdGVkIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1wbHVzIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgIG1hcmdpbjogNXB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSxcbiAgICAuY3FkLWJvdGgtZGl2aWRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXgtaGVpZ2h0IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1hcmdpbi10b3AgMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogMTIwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiA0cHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OIChIZWFkZXItYWxpZ25lZClcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4ge1xuICAgICAgLyogUHJvZ3Jlc3MgY29udHJvbCAoMCUgdG8gMTAwJSkgKi9cbiAgICAgIC0tY3FkLXByb2dyZXNzOiAwJTtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMTJweDtcbiAgICAgIHJpZ2h0OiA0OHB4O1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgei1pbmRleDogNjtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgcGFkZGluZzogNHB4IDEycHg7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgZ2FwOiA2cHg7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xcyBlYXNlLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIDAuM3MgZWFzZTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWigwKTtcbiAgICB9XG5cbiAgICAvKiBXaGVuIGluamVjdGVkIGludG8gdGhlIGhlYWRlciBmbGV4IHN0cnVjdHVyZSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtaW4taGVhZGVyIHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHRvcDogYXV0bztcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgICAgbGVmdDogYXV0bztcbiAgICAgIGJvdHRvbTogYXV0bztcbiAgICAgIHRyYW5zZm9ybTogbm9uZTtcbiAgICAgIFxuICAgICAgLyogSW1wb3J0YW50OiBNYXJnaW4gdG8gc2VwYXJhdGUgZnJvbSB0aGUgXCJUaHJlZSBEb3RzXCIgbWVudSAqL1xuICAgICAgbWFyZ2luLWlubGluZS1lbmQ6IDhweDtcbiAgICAgIFxuICAgICAgLyogRW5zdXJlIGl0IGRvZXNuJ3QgZ2V0IGNydXNoZWQgaW4gZmxleCByb3dzICovXG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAvKiBSVEwgZmFsbGJhY2sgb25seSBmb3Igbm9uLWhlYWRlciBjYXNlcyAoYWJzb2x1dGUgcG9zaXRpb25lZCBhdCB0b3AgY29ybmVyKSAqL1xuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0bjpub3QoLmNxZC1pbi1oZWFkZXIpIHtcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgICAgbGVmdDogNDhweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLyogS2VlcCBwb2ludGVyIGN1cnNvciBldmVuIHdoaWxlIGRpc2FibGVkICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuW2Rpc2FibGVkXSB7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgfVxuXG4gICAgLyogRlVMTCBTVUNDRVNTIFNUQVRFIChTb2xpZCBHcmVlbikgKi9cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtZXJyb3Ige1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgIH1cblxuICAgIC8qIFBST0dSRVNTIEJBUiBPVkVSTEFZIChGaWxscyB1cCkgKi9cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46OmFmdGVyIHtcbiAgICAgIGNvbnRlbnQ6ICcnO1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHotaW5kZXg6IDA7XG5cbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcblxuICAgICAgLyogV2lkdGggY29udHJvbGxlZCBieSBKUyAqL1xuICAgICAgd2lkdGg6IHZhcigtLWNxZC1wcm9ncmVzcyk7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCAwLjNzIGN1YmljLWJlemllcigwLjIyLCAwLjYxLCAwLjM2LCAxKTtcblxuICAgICAgb3BhY2l0eTogMTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzOjphZnRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgIH1cblxuICAgIC8qIENvbnRlbnQgbGF5ZXJzICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4sXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1YixcbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyIHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHotaW5kZXg6IDI7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMThweCAxOHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtc3ViIHtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIG9wYWNpdHk6IDAuOTtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gIGAudHJpbSgpO1xuXG4gIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufSIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzXG5cbi8qKlxuICogVEhFTUUgREVURUNUT1JcbiAqXG4gKiBHb2FsOiBcIklzIHRoZSBjb250ZW50IEknbSBkcmF3aW5nIG9uIHZpc3VhbGx5IGRhcmsgb3IgbGlnaHQ/XCJcbiAqIEluc3RlYWQgb2YgZ3Vlc3NpbmcgZnJvbSA8Ym9keT4sIHdlOlxuICogIC0gUmVzcGVjdCBEYXJrIFJlYWRlciBpZiBwcmVzZW50XG4gKiAgLSBMb29rIGZvciBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3Nlc1xuICogIC0gTWVhc3VyZSB0aGUgZWZmZWN0aXZlIGJhY2tncm91bmQgY29sb3Igb2YgYSAqY29udGVudCogZWxlbWVudFxuICogICAgKGUuZy4gR29vZ2xlIENsYXNzcm9vbSBzdHJlYW0gY2FyZHMpXG4gKi9cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhZ2UgKmNvbnRlbnQgYXJlYSogaXMgdmlzdWFsbHkgZGFyay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFnZURhcmsoKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMS4gRmFzdCBwYXRoOiBEYXJrIFJlYWRlciBhdHRyaWJ1dGVcbiAgY29uc3QgZHJTY2hlbWUgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRhcmtyZWFkZXItc2NoZW1lJyk7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2RhcmsnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGRyU2NoZW1lID09PSAnbGlnaHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMi4gSGV1cmlzdGljOiBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3NlcyBvbiA8aHRtbD4gLyA8Ym9keT5cbiAgLy8gKGNvdmVycyBzb21lIGZyYW1ld29ya3MgYW5kIGV4dGVuc2lvbnMpXG4gIGNvbnN0IGRhcmtUb2tlbnMgPSBbJ2RhcmsnLCAnZGFyay10aGVtZScsICd0aGVtZS1kYXJrJywgJ25pZ2h0JywgJ2dtMy1kYXJrLXRoZW1lJ107XG4gIGNvbnN0IGh0bWxDbGFzcyA9IChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBib2R5Q2xhc3MgPSAoZG9jdW1lbnQuYm9keS5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChkYXJrVG9rZW5zLnNvbWUodG9rZW4gPT4gaHRtbENsYXNzLmluY2x1ZGVzKHRva2VuKSB8fCBib2R5Q2xhc3MuaW5jbHVkZXModG9rZW4pKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gMy4gUHJvYmUgYSAqY29udGVudCogZWxlbWVudCwgbm90IHRoZSB3aG9sZSBwYWdlIGJhY2tncm91bmQuXG4gIC8vICAgIEZvciBDbGFzc3Jvb20sIHBvc3RzIGFyZSB0aGUgbWFpbiBzdXJmYWNlIHdlIGRyYXcgb24uXG4gIGNvbnN0IHByb2JlRWwgPVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdbcm9sZT1cIm1haW5cIl0nKSB8fFxuICAgIGRvY3VtZW50LmJvZHk7XG5cbiAgY29uc3QgYmdDb2xvciA9IGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihwcm9iZUVsKTtcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IHBhcnNlQnJpZ2h0bmVzcyhiZ0NvbG9yKTtcblxuICAvLyA0LiBEZWNpZGUgdGhyZXNob2xkLlxuICAvLyAgICAxMjggaXMgXCI1MCUgZ3JheVwiLCBidXQgdGhhdCBmbGlwcyB0b28gZWFybHkgb24gc2xpZ2h0bHkgZ3JheSBVSXMuXG4gIC8vICAgIFVzZSBhIHN0cmljdGVyIHRocmVzaG9sZCBzbyB3ZSBvbmx5IHRyZWF0IGNsZWFybHkgZGFyayBVSXMgYXMgZGFyay5cbiAgcmV0dXJuIGJyaWdodG5lc3MgPCAxMDU7XG59XG5cbi8qKlxuICogV2Fsa3MgdXAgdGhlIERPTSBmcm9tIGEgZ2l2ZW4gZWxlbWVudCB1bnRpbCBpdCBmaW5kcyBhIG5vbi10cmFuc3BhcmVudCBiYWNrZ3JvdW5kIGNvbG9yLlxuICogRmFsbHMgYmFjayB0byA8aHRtbD4gYW5kIGZpbmFsbHkgdG8gcHVyZSB3aGl0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHN0YXJ0OiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIGxldCBlbDogSFRNTEVsZW1lbnQgfCBudWxsID0gc3RhcnQ7XG5cbiAgY29uc3QgaXNUcmFuc3BhcmVudCA9IChjOiBzdHJpbmcgfCBudWxsKSA9PlxuICAgICFjIHx8IGMgPT09ICd0cmFuc3BhcmVudCcgfHwgYyA9PT0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4gIHdoaWxlIChlbCkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIGNvbnN0IGJnID0gc3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICAgIGlmICghaXNUcmFuc3BhcmVudChiZykpIHJldHVybiBiZztcbiAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICAvLyBUcnkgPGh0bWw+IGFzIGEgbGFzdCByZWFsIGVsZW1lbnRcbiAgY29uc3QgaHRtbFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgY29uc3QgaHRtbEJnID0gaHRtbFN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgaWYgKCFpc1RyYW5zcGFyZW50KGh0bWxCZykpIHJldHVybiBodG1sQmc7XG5cbiAgLy8gQWJzb2x1dGUgZmFsbGJhY2s6IGFzc3VtZSB3aGl0ZVxuICByZXR1cm4gJ3JnYigyNTUsIDI1NSwgMjU1KSc7XG59XG5cbi8qKlxuICogSGVscGVyOiBDYWxjdWxhdGVzIGJyaWdodG5lc3MgKDAtMjU1KSBmcm9tIGFuIFJHQihBKSBzdHJpbmcuXG4gKiBVc2VzIHRoZSBIU1AgY29sb3IgZm9ybXVsYTogc3FydCgwLjI5OSpSXjIgKyAwLjU4NypHXjIgKyAwLjExNCpCXjIpXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQnJpZ2h0bmVzcyhyZ2JTdHJpbmc6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IG1hdGNoID0gcmdiU3RyaW5nLm1hdGNoKC8oXFxkKyksXFxzKihcXGQrKSxcXHMqKFxcZCspLyk7XG4gIGlmICghbWF0Y2gpIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBwYXJzZSBpdCwgYXNzdW1lIGJyaWdodCBzbyB3ZSBkb24ndCBhY2NpZGVudGFsbHkgZmxpcCB0byBkYXJrIG1vZGUuXG4gICAgcmV0dXJuIDI1NTtcbiAgfVxuXG4gIGNvbnN0IHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICBjb25zdCBnID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcbiAgY29uc3QgYiA9IHBhcnNlSW50KG1hdGNoWzNdLCAxMCk7XG5cbiAgLy8gSFNQIGVxdWF0aW9uIGlzIHBlcmNlaXZlZCBicmlnaHRuZXNzXG4gIGNvbnN0IGJyaWdodG5lc3MgPSBNYXRoLnNxcnQoXG4gICAgMC4yOTkgKiAociAqIHIpICtcbiAgICAwLjU4NyAqIChnICogZykgK1xuICAgIDAuMTE0ICogKGIgKiBiKVxuICApO1xuXG4gIHJldHVybiBicmlnaHRuZXNzO1xufVxuXG4vKipcbiAqIFdhdGNoZXI6IE5vdGlmaWVzIHlvdSB3aGVuIHRoZSB0aGVtZSBsaWtlbHkgY2hhbmdlZC5cbiAqXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGlmIHlvdSBldmVyIHdhbnQgdG8gZHluYW1pY2FsbHkgcmUtc3R5bGUgdGhpbmdzXG4gKiB3aGVuIHRoZSB1c2VyIC8gZXh0ZW5zaW9uIHRvZ2dsZXMgdGhlbWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaFRoZW1lQ2hhbmdlcyhjYWxsYmFjazogKGlzRGFyazogYm9vbGVhbikgPT4gdm9pZCk6IE11dGF0aW9uT2JzZXJ2ZXIge1xuICBjb25zdCBoYW5kbGVyID0gKCkgPT4ge1xuICAgIGNhbGxiYWNrKGlzUGFnZURhcmsoKSk7XG4gIH07XG5cbiAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihoYW5kbGVyKTtcblxuICAvLyBXYXRjaCBmb3IgYXR0cmlidXRlL2NsYXNzIGNoYW5nZXMgb24gPGh0bWw+IGFuZCA8Ym9keT5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLWRhcmtyZWFkZXItc2NoZW1lJywgJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIC8vIEFsc28gbGlzdGVuIHRvIHN5c3RlbSB0aGVtZSBjaGFuZ2VzIGFzIGEgYmFja3VwIHNpZ25hbFxuICBpZiAodHlwZW9mIHdpbmRvdy5tYXRjaE1lZGlhID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgbXEgPSB3aW5kb3cubWF0Y2hNZWRpYSgnKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKScpO1xuICAgIGlmIChtcSkge1xuICAgICAgY29uc3QgbXFMaXN0ZW5lciA9ICgpID0+IGhhbmRsZXIoKTtcbiAgICAgIC8vIE1vZGVybiBicm93c2Vyc1xuICAgICAgaWYgKChtcSBhcyBhbnkpLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgbXEuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbXFMaXN0ZW5lcik7XG4gICAgICB9IGVsc2UgaWYgKChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKSB7XG4gICAgICAgIC8vIExlZ2FjeSBBUElcbiAgICAgICAgKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIobXFMaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSW5pdGlhbCBjYWxsIHNvIHRoZSBjb25zdW1lciBjYW4gc3luYyBpbW1lZGlhdGVseVxuICBoYW5kbGVyKCk7XG5cbiAgcmV0dXJuIG9ic2VydmVyO1xufVxuIiwiY29uc3QgVFJBTlNMQVRJT05TOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICBlbjoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnRG93bmxvYWRpbmfigKYnLFxuICAgIHRyeWluZzogJ1RyeWluZ+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rvd25sb2FkZWQnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0Rvd25sb2FkIGZhaWxlZC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnUXVpY2sgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudHMnLFxuICAgIGVkaXRlZDogJ0VkaXRlZCcsXG4gICAgZG93bmxvYWRBbGw6ICdEb3dubG9hZCBhbGwnLFxuICB9LFxuICBhcjoge1xuICAgIGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsXG4gICAgZG93bmxvYWRpbmc6ICfYrNin2LHZiiDYp9mE2KrZhtiy2YrZhOKApicsXG4gICAgdHJ5aW5nOiAn2YXYrdin2YjZhNip4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsXG4gICAgZXJyb3I6ICfYrti32KMnLFxuICAgIGZhaWxlZDogJ9mB2LTZhCDYp9mE2KrZhtiy2YrZhC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLFxuICAgIHRpdGxlUXVpY2s6ICfYqtmG2LLZitmEINiz2LHZiti5JyxcbiAgICBjb21tZW50czogJ9iq2LnZhNmK2YLYp9iqJyxcbiAgICBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyxcbiAgICBkb3dubG9hZEFsbDogJ9iq2YbYstmK2YQg2KfZhNmD2YQnLFxuICB9LFxuICBqYToge1xuICAgIGRvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJyxcbiAgICBkb3dubG9hZGluZzogJ0RM5Lit4oCmJyxcbiAgICB0cnlpbmc6ICfoqabooYzkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflrozkuoYnLFxuICAgIGVycm9yOiAn44Ko44Op44O8JyxcbiAgICBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLFxuICAgIGFyaWFEb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsXG4gICAgdGl0bGVRdWljazogJ+OCr+OCpOODg+OCr+ODgOOCpuODs+ODreODvOODiScsXG4gICAgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLFxuICAgIGVkaXRlZDogJ+e3qOmbhua4iOOBvycsXG4gIH0sXG4gIGVzOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLFxuICAgIHRyeWluZzogJ0ludGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgaGk6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKHgpL/gpILgpJfigKYnLFxuICAgIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JyxcbiAgICBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsXG4gICAgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgcHQ6IHtcbiAgICBkb3dubG9hZDogJ0JhaXhhcicsXG4gICAgZG93bmxvYWRpbmc6ICdCYWl4YW5kb+KApicsXG4gICAgdHJ5aW5nOiAnVGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCYWl4YWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0JhaXhhcicsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIHLDoXBpZG8nLFxuICAgIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgJ3B0LXB0Jzoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FycmVnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnQSBkZXNjYXJyZWdhcuKApicsXG4gICAgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgJ3poLWNuJzoge1xuICAgIGRvd25sb2FkOiAn5LiL6L29JyxcbiAgICBkb3dubG9hZGluZzogJ+S4i+i9veS4reKApicsXG4gICAgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5bey5LiL6L29JyxcbiAgICBlcnJvcjogJ+mUmeivrycsXG4gICAgZmFpbGVkOiAn5LiL6L295aSx6LSlJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfkuIvovb0nLFxuICAgIHRpdGxlUXVpY2s6ICflv6vpgJ/kuIvovb0nLFxuICAgIGNvbW1lbnRzOiAn5p2h6K+E6K66JyxcbiAgICBlZGl0ZWQ6ICflt7LnvJbovpEnLFxuICB9LFxuICAnemgtdHcnOiB7XG4gICAgZG93bmxvYWQ6ICfkuIvovIknLFxuICAgIGRvd25sb2FkaW5nOiAn5LiL6LyJ5Lit4oCmJyxcbiAgICB0cnlpbmc6ICflmJfoqabkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflt7LkuIvovIknLFxuICAgIGVycm9yOiAn6Yyv6KqkJyxcbiAgICBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+S4i+i8iScsXG4gICAgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i8iScsXG4gICAgY29tbWVudHM6ICfliYfnlZnoqIAnLFxuICAgIGVkaXRlZDogJ+W3sue3qOi8rycsXG4gIH0sXG4gIGZyOiB7XG4gICAgZG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJyxcbiAgICBkb3dubG9hZGluZzogJ1TDqWzDqWNoYXJnZW1lbnTigKYnLFxuICAgIHRyeWluZzogJ0Vzc2Fp4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVMOpbMOpY2hhcmfDqScsXG4gICAgZXJyb3I6ICdFcnJldXInLFxuICAgIGZhaWxlZDogJ8OJY2hlYy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLFxuICAgIHRpdGxlUXVpY2s6ICdUw6lsw6ljaGFyZ2VtZW50IHJhcGlkZScsXG4gICAgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLFxuICAgIGVkaXRlZDogJ01vZGlmacOpJyxcbiAgfSxcbiAgZGU6IHtcbiAgICBkb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkZW7igKYnLFxuICAgIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0ZlcnRpZycsXG4gICAgZXJyb3I6ICdGZWhsZXInLFxuICAgIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsXG4gICAgYXJpYURvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsXG4gICAgdGl0bGVRdWljazogJ1NjaG5lbGxlciBEb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdLb21tZW50YXJlJyxcbiAgICBlZGl0ZWQ6ICdCZWFyYmVpdGV0JyxcbiAgfSxcbiAgaXQ6IHtcbiAgICBkb3dubG9hZDogJ1NjYXJpY2EnLFxuICAgIGRvd25sb2FkaW5nOiAnU2NhcmljYW1lbnRv4oCmJyxcbiAgICB0cnlpbmc6ICdQcm92YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ1NjYXJpY2F0bycsXG4gICAgZXJyb3I6ICdFcnJvcmUnLFxuICAgIGZhaWxlZDogJ0ZhbGxpdG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTY2FyaWNhJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcmFwaWRvJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRpJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmljYXRvJyxcbiAgfSxcbiAgcnU6IHtcbiAgICBkb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJyxcbiAgICBkb3dubG9hZGluZzogJ9Ch0LrQsNGH0LjQstCw0L3QuNC14oCmJyxcbiAgICB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9Ch0LrQsNGH0LDQvdC+JyxcbiAgICBlcnJvcjogJ9Ce0YjQuNCx0LrQsCcsXG4gICAgZmFpbGVkOiAn0KHQsdC+0LkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YvRgdGC0YDQvtC1INGB0LrQsNGH0LjQstCw0L3QuNC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXQvdC10L3QvicsXG4gIH0sXG4gIGtvOiB7XG4gICAgZG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLFxuICAgIGRvd25sb2FkaW5nOiAn64uk7Jq066Gc65OcIOykkeKApicsXG4gICAgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsXG4gICAgZG93bmxvYWRlZDogJ+yZhOujjCcsXG4gICAgZXJyb3I6ICfsmKTrpZgnLFxuICAgIGZhaWxlZDogJ+yLpO2MqO2VqCcsXG4gICAgYXJpYURvd25sb2FkOiAn64uk7Jq066Gc65OcJyxcbiAgICB0aXRsZVF1aWNrOiAn67mg66W4IOuLpOyatOuhnOuTnCcsXG4gICAgY29tbWVudHM6ICfqsJwg64yT6riAJyxcbiAgICBlZGl0ZWQ6ICfsiJjsoJXrkKgnLFxuICB9LFxuICB0cjoge1xuICAgIGRvd25sb2FkOiAnxLBuZGlyJyxcbiAgICBkb3dubG9hZGluZzogJ8SwbmRpcmlsaXlvcuKApicsXG4gICAgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnxLBuZGlyaWxkaScsXG4gICAgZXJyb3I6ICdIYXRhJyxcbiAgICBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfEsG5kaXInLFxuICAgIHRpdGxlUXVpY2s6ICdIxLF6bMSxIGluZGlyJyxcbiAgICBjb21tZW50czogJ3lvcnVtJyxcbiAgICBlZGl0ZWQ6ICdEw7x6ZW5sZW5kaScsXG4gIH0sXG4gIHZpOiB7XG4gICAgZG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJyxcbiAgICBkb3dubG9hZGluZzogJ8SQYW5nIHThuqNp4oCmJyxcbiAgICB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsXG4gICAgZG93bmxvYWRlZDogJ8SQw6MgdOG6o2knLFxuICAgIGVycm9yOiAnTOG7l2knLFxuICAgIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLFxuICAgIHRpdGxlUXVpY2s6ICdU4bqjaSB4deG7kW5nIG5oYW5oJyxcbiAgICBjb21tZW50czogJ25o4bqtbiB4w6l0JyxcbiAgICBlZGl0ZWQ6ICfEkMOjIGNo4buJbmggc+G7rWEnLFxuICB9LFxuICBpZDoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTWVuZ3VuZHVo4oCmJyxcbiAgICB0cnlpbmc6ICdNZW5jb2Jh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2VsZXNhaScsXG4gICAgZXJyb3I6ICdLZXNhbGFoYW4nLFxuICAgIGZhaWxlZDogJ0dhZ2FsLicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCBjZXBhdCcsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcicsXG4gICAgZWRpdGVkOiAnRGllZGl0JyxcbiAgfSxcbiAgdGg6IHtcbiAgICBkb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsXG4gICAgZG93bmxvYWRpbmc6ICfguIHguLPguKXguLHguIfguYLguKvguKXguJTigKYnLFxuICAgIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsXG4gICAgZG93bmxvYWRlZDogJ+C5gOC4quC4o+C5h+C4iOC4quC4tOC5ieC4mScsXG4gICAgZXJyb3I6ICfguILguYnguK3guJzguLTguJTguJ7guKXguLLguJQnLFxuICAgIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsXG4gICAgYXJpYURvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJyxcbiAgICB0aXRsZVF1aWNrOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiU4LiU4LmI4Lin4LiZJyxcbiAgICBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsXG4gICAgZWRpdGVkOiAn4LmB4LiB4LmJ4LmE4LiC4LmB4Lil4LmJ4LinJyxcbiAgfSxcbiAgcGw6IHtcbiAgICBkb3dubG9hZDogJ1BvYmllcnonLFxuICAgIGRvd25sb2FkaW5nOiAnUG9iaWVyYW5pZeKApicsXG4gICAgdHJ5aW5nOiAnUHLDs2Jh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUG9icmFubycsXG4gICAgZXJyb3I6ICdCxYLEhWQnLFxuICAgIGZhaWxlZDogJ05pZXVkYW5lLicsXG4gICAgYXJpYURvd25sb2FkOiAnUG9iaWVyeicsXG4gICAgdGl0bGVRdWljazogJ1N6eWJraWUgcG9iaWVyYW5pZScsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcnplJyxcbiAgICBlZGl0ZWQ6ICdFZHl0b3dhbm8nLFxuICB9LFxuICBubDoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWRlbicsXG4gICAgZG93bmxvYWRpbmc6ICdEb3dubG9hZGVu4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9iZXJlbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYWFyJyxcbiAgICBlcnJvcjogJ0ZvdXQnLFxuICAgIGZhaWxlZDogJ01pc2x1a3QuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZGVuJyxcbiAgICB0aXRsZVF1aWNrOiAnU25lbCBkb3dubG9hZGVuJyxcbiAgICBjb21tZW50czogJ3JlYWN0aWVzJyxcbiAgICBlZGl0ZWQ6ICdCZXdlcmt0JyxcbiAgfSxcbiAgYm46IHtcbiAgICBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgprLgp4vgpqEg4Ka54Kaa4KeN4Kab4KeH4oCmJyxcbiAgICB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ka44Kau4KeN4Kaq4Kao4KeN4KaoJyxcbiAgICBlcnJvcjogJ+CmpOCnjeCmsOCngeCmn+CmvycsXG4gICAgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsXG4gICAgYXJpYURvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kam4KeN4Kaw4KeB4KakIOCmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJyxcbiAgICBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnLFxuICB9LFxuICBwYToge1xuICAgIGRvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICBkb3dubG9hZGluZzogJ+CooeCovuCoieCoqOCosuCpi+CooSDgqLngqYsg4Kiw4Ki/4Ki54Ki+4oCmJyxcbiAgICB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Kiu4KmB4KiV4Kmw4Kiu4KiyJyxcbiAgICBlcnJvcjogJ+Col+CosuCopOCpgCcsXG4gICAgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgqKTgqYfgqJzgqLwg4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsXG4gICAgZWRpdGVkOiAn4Ki44Kmw4Kiq4Ki+4Kim4Ki/4KikJyxcbiAgfSxcbiAgdGU6IHtcbiAgICBkb3dubG9hZDogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgZG93bmxvYWRpbmc6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0g4LCF4LC14LGB4LCk4LGL4LCC4LCm4LC/4oCmJyxcbiAgICB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgsKrgsYLgsLDgsY3gsKTgsK/gsL/gsILgsKbgsL8nLFxuICAgIGVycm9yOiAn4LCy4LGL4LCq4LCCJyxcbiAgICBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgdGl0bGVRdWljazogJ+CwpOCxjeCwteCwsOCwv+CwpCDgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJyxcbiAgICBlZGl0ZWQ6ICfgsLjgsLXgsLDgsL/gsILgsJrgsKzgsKHgsL/gsILgsKbgsL8nLFxuICB9LFxuICBtcjoge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoSDgpLngpYvgpKQg4KSG4KS54KWH4oCmJyxcbiAgICB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpYAnLFxuICAgIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSk4KWN4KS14KSw4KS/4KSkIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLFxuICAgIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIHRhOiB7XG4gICAgZG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLFxuICAgIGRvd25sb2FkaW5nOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K6q4K+N4K6q4K6f4K+B4K6V4K6/4K6x4K6k4K+B4oCmJyxcbiAgICB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgrq7gr4Hgrp/grr/grqjgr43grqTgrqTgr4EnLFxuICAgIGVycm9yOiAn4K6q4K6/4K604K+IJyxcbiAgICBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsXG4gICAgdGl0bGVRdWljazogJ+CuteCuv+CusOCviOCuteCvgSDgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrq7gr40nLFxuICAgIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJyxcbiAgICBlZGl0ZWQ6ICfgrqTgrr/grrDgr4HgrqTgr43grqTgrqrgr43grqrgrp/gr43grp/grqTgr4EnLFxuICB9LFxuICB1cjoge1xuICAgIGRvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJyxcbiAgICBkb3dubG9hZGluZzogJ9qI2KfYpNmGINmE2YjaiCDbgdmIINix24HYpyDbgduS4oCmJyxcbiAgICB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsXG4gICAgZG93bmxvYWRlZDogJ9mF2qnZhdmEJyxcbiAgICBlcnJvcjogJ9i62YTYt9uMJyxcbiAgICBmYWlsZWQ6ICfZhtin2qnYp9mFJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLFxuICAgIHRpdGxlUXVpY2s6ICfZgdmI2LHbjCDaiNin2KTZhiDZhNmI2ognLFxuICAgIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsXG4gICAgZWRpdGVkOiAn2KrYsdmF24zZhSDYtNiv24EnLFxuICB9LFxuICBndToge1xuICAgIGRvd25sb2FkOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICBkb3dubG9hZGluZzogJ+CqoeCqvuCqieCqqOCqsuCri+CqoSDgqqXgqogg4Kqw4Kq54KuN4Kqv4KuB4KqCIOCqm+Crh+KApicsXG4gICAgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsXG4gICAgZG93bmxvYWRlZDogJ+CqquCrguCqsOCrjeCqoycsXG4gICAgZXJyb3I6ICfgqq3gq4LgqrInLFxuICAgIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsXG4gICAgYXJpYURvd25sb2FkOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kqd4Kqh4Kqq4KuAIOCqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLFxuICAgIGVkaXRlZDogJ+CquOCqguCqquCqvuCqpuCqv+CqpCcsXG4gIH0sXG4gIGtuOiB7XG4gICAgZG93bmxvYWQ6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIGRvd25sb2FkaW5nOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONIOCyhuCyl+CzgeCypOCzjeCypOCyv+CypuCzhuKApicsXG4gICAgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LKq4LOC4LKw4LON4LKj4LKX4LOK4LKC4LKh4LK/4LKm4LOGJyxcbiAgICBlcnJvcjogJ+CypuCzi+CytycsXG4gICAgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIHRpdGxlUXVpY2s6ICfgsqTgs43gsrXgsrDgsr/gsqQg4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsXG4gICAgZWRpdGVkOiAn4LK44LKC4LKq4LK+4LKm4LK/4LK44LKy4LK+4LKX4LK/4LKm4LOGJyxcbiAgfSxcbiAgbWw6IHtcbiAgICBkb3dubG9hZDogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgZG93bmxvYWRpbmc6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0g4LSa4LWG4LSv4LWN4LSv4LWB4LSo4LWN4LSo4LWB4oCmJyxcbiAgICB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgtKrgtYLgtbzgtKTgtY3gtKTgtL/gtK/gtL7gtK/gtL8nLFxuICAgIGVycm9yOiAn4LSq4LS/4LS24LSV4LWNJyxcbiAgICBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgdGl0bGVRdWljazogJ+C0teC1h+C0l+C0pOC1jeC0pOC0v+C1vSDgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JyxcbiAgICBlZGl0ZWQ6ICfgtI7gtKHgtL/gtLHgtY3gtLHgtYHgtJrgtYbgtK/gtY3gtKTgtYEnLFxuICB9LFxuICB1azoge1xuICAgIGRvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQl9Cw0LLQsNC90YLQsNC20LXQvdC90Y/igKYnLFxuICAgIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQn9C+0LzQuNC70LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0KjQstC40LTQutC1INC30LDQstCw0L3RgtCw0LbQtdC90L3RjycsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsXG4gICAgZWRpdGVkOiAn0JfQvNGW0L3QtdC90L4nLFxuICB9LFxuICBlbDoge1xuICAgIGRvd25sb2FkOiAnzpvOrs+IzrcnLFxuICAgIGRvd25sb2FkaW5nOiAnzpvOrs+IzrfigKYnLFxuICAgIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnzp/Ou86/zrrOu863z4HPjs64zrfOus61JyxcbiAgICBlcnJvcjogJ86jz4bOrM67zrzOsScsXG4gICAgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfOm86uz4jOtycsXG4gICAgdGl0bGVRdWljazogJ86Tz4HOrs6zzr/Pgc63IM67zq7PiM63JyxcbiAgICBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsXG4gICAgZWRpdGVkOiAnzpXPgM61zr7Otc+BzrPOsc+DzrzOrc69zr8nLFxuICB9LFxuICBjczoge1xuICAgIGRvd25sb2FkOiAnU3TDoWhub3V0JyxcbiAgICBkb3dubG9hZGluZzogJ1N0YWhvdsOhbsOt4oCmJyxcbiAgICB0cnlpbmc6ICdaa291xaHDrW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTdGHFvmVubycsXG4gICAgZXJyb3I6ICdDaHliYScsXG4gICAgZmFpbGVkOiAnU2VsaGFsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1N0w6Fobm91dCcsXG4gICAgdGl0bGVRdWljazogJ1J5Y2hsw6kgc3Rhxb5lbsOtJyxcbiAgICBjb21tZW50czogJ2tvbWVudMOhxZnFrycsXG4gICAgZWRpdGVkOiAnVXByYXZlbm8nLFxuICB9LFxuICBybzoge1xuICAgIGRvd25sb2FkOiAnRGVzY8SDcmNhyJtpJyxcbiAgICBkb3dubG9hZGluZzogJ1NlIGRlc2NhcmPEg+KApicsXG4gICAgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsXG4gICAgZG93bmxvYWRlZDogJ0ZpbmFsaXphdCcsXG4gICAgZXJyb3I6ICdFcm9hcmUnLFxuICAgIGZhaWxlZDogJ0XImXVhdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2PEg3JjYXJlIHJhcGlkxIMnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpaScsXG4gICAgZWRpdGVkOiAnTW9kaWZpY2F0JyxcbiAgfSxcbiAgaHU6IHtcbiAgICBkb3dubG9hZDogJ0xldMO2bHTDqXMnLFxuICAgIGRvd25sb2FkaW5nOiAnTGV0w7ZsdMOpc+KApicsXG4gICAgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLw6lzeicsXG4gICAgZXJyb3I6ICdIaWJhJyxcbiAgICBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGV0w7ZsdMOpcycsXG4gICAgdGl0bGVRdWljazogJ0d5b3JzIGxldMO2bHTDqXMnLFxuICAgIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLFxuICAgIGVkaXRlZDogJ1N6ZXJrZXN6dHZlJyxcbiAgfSxcbiAgc3Y6IHtcbiAgICBkb3dubG9hZDogJ0xhZGRhIG5lcicsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRkYXIgbmVy4oCmJyxcbiAgICB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhcnQnLFxuICAgIGVycm9yOiAnRmVsJyxcbiAgICBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYWRkYSBuZXInLFxuICAgIHRpdGxlUXVpY2s6ICdTbmFiYiBuZWRsYWRkbmluZycsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcmFkJyxcbiAgfSxcbiAgZGE6IHtcbiAgICBkb3dubG9hZDogJ0hlbnQnLFxuICAgIGRvd25sb2FkaW5nOiAnSGVudGVy4oCmJyxcbiAgICB0cnlpbmc6ICdQcsO4dmVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSGVudGV0JyxcbiAgICBlcnJvcjogJ0ZlamwnLFxuICAgIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnSGVudCcsXG4gICAgdGl0bGVRdWljazogJ0h1cnRpZyBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcmV0JyxcbiAgfSxcbiAgZmk6IHtcbiAgICBkb3dubG9hZDogJ0xhdGFhJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGF0YWFu4oCmJyxcbiAgICB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0xhZGF0dHUnLFxuICAgIGVycm9yOiAnVmlyaGUnLFxuICAgIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhdGFhJyxcbiAgICB0aXRsZVF1aWNrOiAnUGlrYWxhdGF1cycsXG4gICAgY29tbWVudHM6ICdrb21tZW50dGlhJyxcbiAgICBlZGl0ZWQ6ICdNdW9rYXR0dScsXG4gIH0sXG4gIG5vOiB7XG4gICAgZG93bmxvYWQ6ICdMYXN0IG5lZCcsXG4gICAgZG93bmxvYWRpbmc6ICdMYXN0ZXIgbmVk4oCmJyxcbiAgICB0cnlpbmc6ICdQcsO4dmVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmVyZGlnJyxcbiAgICBlcnJvcjogJ0ZlaWwnLFxuICAgIGZhaWxlZDogJ01pc2x5a3Rlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhc3QgbmVkJyxcbiAgICB0aXRsZVF1aWNrOiAnUmFzayBuZWRsYXN0aW5nJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VydCcsXG4gIH0sXG4gIGhlOiB7XG4gICAgZG93bmxvYWQ6ICfXlNeV16jXk9eUJyxcbiAgICBkb3dubG9hZGluZzogJ9ee15XXqNeZ15PigKYnLFxuICAgIHRyeWluZzogJ9ee16DXodeU4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn15TXldep15zXnScsXG4gICAgZXJyb3I6ICfXqdeS15nXkNeUJyxcbiAgICBmYWlsZWQ6ICfXoNeb16nXnCcsXG4gICAgYXJpYURvd25sb2FkOiAn15TXldeo15PXlCcsXG4gICAgdGl0bGVRdWljazogJ9eU15XXqNeT15Qg157XlNeZ16jXlCcsXG4gICAgY29tbWVudHM6ICfXqteS15XXkdeV16onLFxuICAgIGVkaXRlZDogJ9eg16LXqNeaJyxcbiAgfSxcbiAgZmE6IHtcbiAgICBkb3dubG9hZDogJ9iv2KfZhtmE2YjYrycsXG4gICAgZG93bmxvYWRpbmc6ICfYr9ix2K3Yp9mEINiv2KfZhtmE2YjYr+KApicsXG4gICAgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfYp9mG2KzYp9mFINi02K8nLFxuICAgIGVycm9yOiAn2K7Yt9inJyxcbiAgICBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLFxuICAgIGFyaWFEb3dubG9hZDogJ9iv2KfZhtmE2YjYrycsXG4gICAgdGl0bGVRdWljazogJ9iv2KfZhtmE2YjYryDYs9ix24zYuScsXG4gICAgY29tbWVudHM6ICfZhti42LEnLFxuICAgIGVkaXRlZDogJ9mI24zYsdin24zYtCDYtNiv2YcnLFxuICB9LFxuICBmaWw6IHtcbiAgICBkb3dubG9hZDogJ0ktZG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTmFnZGEtZG93bmxvYWTigKYnLFxuICAgIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVGFwb3MgbmEnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ05hYmlnby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0ktZG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdNYWJpbGlzIG5hIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ21nYSBrb21lbnRvJyxcbiAgICBlZGl0ZWQ6ICdOYS1lZGl0JyxcbiAgfSxcbiAgbXM6IHtcbiAgICBkb3dubG9hZDogJ011YXQgdHVydW4nLFxuICAgIGRvd25sb2FkaW5nOiAnTWVtdWF0IHR1cnVu4oCmJyxcbiAgICB0cnlpbmc6ICdNZW5jdWJh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2VsZXNhaScsXG4gICAgZXJyb3I6ICdSYWxhdCcsXG4gICAgZmFpbGVkOiAnR2FnYWwuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdNdWF0IHR1cnVuJyxcbiAgICB0aXRsZVF1aWNrOiAnTXVhdCB0dXJ1biBwYW50YXMnLFxuICAgIGNvbW1lbnRzOiAna29tZW4nLFxuICAgIGVkaXRlZDogJ0RpZWRpdCcsXG4gIH0sXG4gIHNyOiB7XG4gICAgZG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQn9GA0LXRg9C30LjQvNCw0ZrQteKApicsXG4gICAgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JfQsNCy0YDRiNC10L3QvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10YPQt9C40LzQsNGa0LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdGa0LXQvdC+JyxcbiAgfSxcbiAgc2s6IHtcbiAgICBkb3dubG9hZDogJ1N0aWFobnXFpScsXG4gICAgZG93bmxvYWRpbmc6ICdTxaVhaG92YW5pZeKApicsXG4gICAgdHJ5aW5nOiAnU2vDusWhYW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdIb3Rvdm8nLFxuICAgIGVycm9yOiAnQ2h5YmEnLFxuICAgIGZhaWxlZDogJ1pseWhhbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTdGlhaG51xaUnLFxuICAgIHRpdGxlUXVpY2s6ICdSw71jaGxlIHN0aWFobnV0aWUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLFxuICAgIGVkaXRlZDogJ1VwcmF2ZW7DqScsXG4gIH0sXG4gIGJnOiB7XG4gICAgZG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQmNC30YLQtdCz0LvRj9C90LXigKYnLFxuICAgIHRyeWluZzogJ9Ce0L/QuNGC4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGK0YDQt9C+INC40LfRgtC10LPQu9GP0L3QtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLFxuICAgIGVkaXRlZDogJ9Cg0LXQtNCw0LrRgtC40YDQsNC90L4nLFxuICB9LFxuICBocjoge1xuICAgIGRvd25sb2FkOiAnUHJldXptaScsXG4gICAgZG93bmxvYWRpbmc6ICdQcmV1emltYW5qZeKApicsXG4gICAgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0dvdG92bycsXG4gICAgZXJyb3I6ICdHcmXFoWthJyxcbiAgICBmYWlsZWQ6ICdOZXVzcGplbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQcmV1em1pJyxcbiAgICB0aXRsZVF1aWNrOiAnQnJ6byBwcmV1emltYW5qZScsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmEnLFxuICAgIGVkaXRlZDogJ1VyZcSRZW5vJyxcbiAgfSxcbiAgbHQ6IHtcbiAgICBkb3dubG9hZDogJ0F0c2lzacWzc3RpJyxcbiAgICBkb3dubG9hZGluZzogJ1NpdW7EjWlhbWHigKYnLFxuICAgIHRyeWluZzogJ0JhbmRvbWHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCYWlndGEnLFxuICAgIGVycm9yOiAnS2xhaWRhJyxcbiAgICBmYWlsZWQ6ICdOZXBhdnlrby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0F0c2lzacWzc3RpJyxcbiAgICB0aXRsZVF1aWNrOiAnR3JlaXRhcyBhdHNpc2l1bnRpbWFzJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyYWknLFxuICAgIGVkaXRlZDogJ1JlZGFndW90YScsXG4gIH0sXG4gIGx2OiB7XG4gICAgZG93bmxvYWQ6ICdMZWp1cGllbMSBZMSTdCcsXG4gICAgZG93bmxvYWRpbmc6ICdMZWp1cGllbMSBZMST4oCmJyxcbiAgICB0cnlpbmc6ICdNxJPEo2luYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1BhYmVpZ3RzJyxcbiAgICBlcnJvcjogJ0vEvMWrZGEnLFxuICAgIGZhaWxlZDogJ05laXpkZXbEgXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMZWp1cGllbMSBZMSTdCcsXG4gICAgdGl0bGVRdWljazogJ8SAdHLEgSBsZWp1cGllbMSBZGUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50xIFyaScsXG4gICAgZWRpdGVkOiAnUmVkacSjxJN0cycsXG4gIH0sXG4gIGV0OiB7XG4gICAgZG93bmxvYWQ6ICdMYWFkaSBhbGxhJyxcbiAgICBkb3dubG9hZGluZzogJ0xhYWRpbWluZeKApicsXG4gICAgdHJ5aW5nOiAnUHJvb3ZpbuKApicsXG4gICAgZG93bmxvYWRlZDogJ1ZhbG1pcycsXG4gICAgZXJyb3I6ICdWaWdhJyxcbiAgICBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYWFkaSBhbGxhJyxcbiAgICB0aXRsZVF1aWNrOiAnS2lpcmUgYWxsYWxhYWRpbWluZScsXG4gICAgY29tbWVudHM6ICdrb21tZW50YWFyaScsXG4gICAgZWRpdGVkOiAnTXV1ZGV0dWQnLFxuICB9LFxuICBzbDoge1xuICAgIGRvd25sb2FkOiAnUHJlbm9zJyxcbiAgICBkb3dubG9hZGluZzogJ1ByZW5hxaFhbmpl4oCmJyxcbiAgICB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLb27EjWFubycsXG4gICAgZXJyb3I6ICdOYXBha2EnLFxuICAgIGZhaWxlZDogJ05pIHVzcGVsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ByZW5vcycsXG4gICAgdGl0bGVRdWljazogJ0hpdGVyIHByZW5vcycsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmpldicsXG4gICAgZWRpdGVkOiAnVXJlamVubycsXG4gIH0sXG4gIGNhOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJyZWdhJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcnJlZ2FudOKApicsXG4gICAgdHJ5aW5nOiAnSW50ZW50YW504oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FycmVnYXQnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0hhIGZhbGxhdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjw6BycmVnYSByw6BwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaXMnLFxuICAgIGVkaXRlZDogJ0VkaXRhdCcsXG4gIH0sXG4gIGFmOiB7XG4gICAgZG93bmxvYWQ6ICdBZmxhYWknLFxuICAgIGRvd25sb2FkaW5nOiAnTGFhaSBhZuKApicsXG4gICAgdHJ5aW5nOiAnUHJvYmVlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYWFyJyxcbiAgICBlcnJvcjogJ0ZvdXQnLFxuICAgIGZhaWxlZDogJ01pc2x1ay4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0FmbGFhaScsXG4gICAgdGl0bGVRdWljazogJ1Zpbm5pZ2UgYWZsYWFpJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmUnLFxuICAgIGVkaXRlZDogJ0dlcmVkaWdlZXInLFxuICB9LFxuICBhbToge1xuICAgIGRvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JyxcbiAgICBkb3dubG9hZGluZzogJ+GJoOGIm+GLjeGIqOGLtSDhiIvhi63igKYnLFxuICAgIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhi4jhiK3hi7fhiI0nLFxuICAgIGVycm9yOiAn4Yi14YiF4Ymw4Ym1JyxcbiAgICBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLFxuICAgIGFyaWFEb3dubG9hZDogJ+GKoOGLjeGIreGLtScsXG4gICAgdGl0bGVRdWljazogJ+GNiOGMo+GKlSDhiJvhi43hiKjhi7UnLFxuICAgIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JyxcbiAgICBlZGl0ZWQ6ICfhibDhiLXhibDhiqvhiq3hiI/hiI0nLFxuICB9LFxuICBoeToge1xuICAgIGRvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJyxcbiAgICBkb3dubG9hZGluZzogJ9WG1aXWgNWi1aXVvNW21bjWgtW04oCmJyxcbiAgICB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsXG4gICAgZG93bmxvYWRlZDogJ9Sx1b7VodaA1b/VvtWh1a4nLFxuICAgIGVycm9yOiAn1Y3VrdWh1awnLFxuICAgIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLFxuICAgIHRpdGxlUXVpY2s6ICfUsdaA1aHVoyDVttWl1oDVotWl1bzVttW41oLVtCcsXG4gICAgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLFxuICAgIGVkaXRlZDogJ9S91bTVotWh1aPWgNW+1aXVrCDVpycsXG4gIH0sXG4gIGFzOiB7XG4gICAgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahIOCmueCniCDgpobgppvgp4figKYnLFxuICAgIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ka44Kau4KeN4Kaq4KeC4Kew4KeN4KajJyxcbiAgICBlcnJvcjogJ+CmpOCnjeCnsOCngeCmn+CmvycsXG4gICAgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kam4KeN4Kew4KeB4KakIOCmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLFxuICAgIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcsXG4gIH0sXG4gIGF6OiB7XG4gICAgZG93bmxvYWQ6ICdZw7xrbMmZJyxcbiAgICBkb3dubG9hZGluZzogJ1nDvGtsyZluaXLigKYnLFxuICAgIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0JpdGRpJyxcbiAgICBlcnJvcjogJ1jJmXRhJyxcbiAgICBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsXG4gICAgYXJpYURvd25sb2FkOiAnWcO8a2zJmScsXG4gICAgdGl0bGVRdWljazogJ1PDvHLJmXRsaSB5w7xrbMmZbcmZJyxcbiAgICBjb21tZW50czogJ8WfyZlyaCcsXG4gICAgZWRpdGVkOiAnRMO8esmZbGnFnyBlZGlsaWInLFxuICB9LFxuICBldToge1xuICAgIGRvd25sb2FkOiAnRGVza2FyZ2F0dScsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNrYXJnYXR6ZW7igKYnLFxuICAgIHRyeWluZzogJ1NhaWF0emVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRWdpbmRhJyxcbiAgICBlcnJvcjogJ0Vycm9yZWEnLFxuICAgIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2thcmdhdHUnLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNrYXJnYSBhemthcnJhJyxcbiAgICBjb21tZW50czogJ2lydXpraW4nLFxuICAgIGVkaXRlZDogJ0VkaXRhdHVhJyxcbiAgfSxcbiAgbXk6IHtcbiAgICBkb3dubG9hZDogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgZG93bmxvYWRpbmc6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLog4YCc4YCv4YCV4YC64YCU4YCx4oCmJyxcbiAgICB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhgJXhgLzhgK7hgLjhgJXhgKvhgJXhgLzhgK4nLFxuICAgIGVycm9yOiAn4YCh4YCZ4YC+4YCs4YC4JyxcbiAgICBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLFxuICAgIGFyaWFEb3dubG9hZDogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgdGl0bGVRdWljazogJ+GAoeGAmeGAvOGAlOGAuiDhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JyxcbiAgICBlZGl0ZWQ6ICfhgJXhgLzhgIThgLrhgIbhgIThgLrhgJXhgLzhgK7hgLgnLFxuICB9LFxuICBnbDoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcmdhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdUZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsbG91LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gIGthOiB7XG4gICAgZG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIGRvd25sb2FkaW5nOiAn4YOY4YOs4YOU4YOg4YOU4YOR4YOQ4oCmJyxcbiAgICB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhg5Phg5Dhg6Hhg6Dhg6Phg5rhg5Phg5AnLFxuICAgIGVycm9yOiAn4YOo4YOU4YOq4YOT4YOd4YOb4YOQJyxcbiAgICBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsXG4gICAgYXJpYURvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICB0aXRsZVF1aWNrOiAn4YOh4YOs4YOg4YOQ4YOk4YOYIOGDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLFxuICAgIGVkaXRlZDogJ+GDoOGDlOGDk+GDkOGDpeGDouGDmOGDoOGDlOGDkeGDo+GDmuGDmOGDkCcsXG4gIH0sXG4gIGlzOiB7XG4gICAgZG93bmxvYWQ6ICdTw6ZramEnLFxuICAgIGRvd25sb2FkaW5nOiAnU8Oma2ly4oCmJyxcbiAgICB0cnlpbmc6ICdSZXluaeKApicsXG4gICAgZG93bmxvYWRlZDogJ1PDs3R0JyxcbiAgICBlcnJvcjogJ1ZpbGxhJyxcbiAgICBmYWlsZWQ6ICdNaXN0w7Nrc3QuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTw6ZramEnLFxuICAgIHRpdGxlUXVpY2s6ICdGbMO9dGluacOwdXJoYWwnLFxuICAgIGNvbW1lbnRzOiAndW1tw6ZsaScsXG4gICAgZWRpdGVkOiAnQnJleXR0JyxcbiAgfSxcbiAgZ2E6IHtcbiAgICBkb3dubG9hZDogJ8ONb3Nsw7Nkw6FpbCcsXG4gICAgZG93bmxvYWRpbmc6ICdBZyDDrW9zbMOzZMOhaWzigKYnLFxuICAgIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnw41vc2zDs2TDoWlsdGUnLFxuICAgIGVycm9yOiAnRWFycsOhaWQnLFxuICAgIGZhaWxlZDogJ1RoZWlwIGFpci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ8ONb3Nsw7Nkw6FpbCcsXG4gICAgdGl0bGVRdWljazogJ8ONb3Nsw7Nkw6FpbCB0YXBhJyxcbiAgICBjb21tZW50czogJ3Ryw6FjaHQnLFxuICAgIGVkaXRlZDogJ0VhZ3JhaXRoZScsXG4gIH0sXG4gIGtrOiB7XG4gICAgZG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJyxcbiAgICBkb3dubG9hZGluZzogJ9CW0q/QutGC0LXQu9GD0LTQteKApicsXG4gICAgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JDRj9Kb0YLQsNC70LTRiycsXG4gICAgZXJyb3I6ICfSmtCw0YLQtScsXG4gICAgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsXG4gICAgYXJpYURvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsXG4gICAgdGl0bGVRdWljazogJ9CW0YvQu9C00LDQvCDQttKv0LrRgtC10YMnLFxuICAgIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsXG4gICAgZWRpdGVkOiAn06jQt9Cz0LXRgNGC0ZbQu9C00ZYnLFxuICB9LFxuICBrbToge1xuICAgIGRvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJyxcbiAgICBkb3dubG9hZGluZzogJ+GegOGfhuGeluGeu+GehOGekeGetuGeieGemeGegOKApicsXG4gICAgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Z6U4Z624Z6T4Z6U4Z6J4Z+S4Z6F4Z6U4Z+LJyxcbiAgICBlcnJvcjogJ+GegOGfhuGeoOGeu+GenycsXG4gICAgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLFxuICAgIHRpdGxlUXVpY2s6ICfhnpHhnrbhnonhnpnhnoDhnpvhnr/hnpMnLFxuICAgIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JyxcbiAgICBlZGl0ZWQ6ICfhnpThnrbhnpPhnoDhn4Lhnp/hnpjhn5Lhnprhnr3hnpsnLFxuICB9LFxuICBsbzoge1xuICAgIGRvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJyxcbiAgICBkb3dubG9hZGluZzogJ+C6geC6s+C6peC6seC6h+C6lOC6suC6p+C7guC6q+C6peC6lOKApicsXG4gICAgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Lqq4Lqz4LuA4Lql4Lqx4LqUJyxcbiAgICBlcnJvcjogJ+C6nOC6tOC6lOC6nuC6suC6lCcsXG4gICAgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLFxuICAgIHRpdGxlUXVpY2s6ICfgupTgurLguqfgu4LguqvguqXgupTgupTgu4jguqfgupknLFxuICAgIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJyxcbiAgICBlZGl0ZWQ6ICfgu4HguoHgu4ngu4TguoLgu4HguqXgu4nguqcnLFxuICB9LFxuICBtazoge1xuICAgIGRvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0J/RgNC10LfQtdC80LDRmtC14oCmJyxcbiAgICB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YDQt9C+INC/0YDQtdC30LXQvNCw0ZrQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10L3QtdGC0L4nLFxuICB9LFxuICBtbjoge1xuICAgIGRvd25sb2FkOiAn0KLQsNGC0LDRhScsXG4gICAgZG93bmxvYWRpbmc6ICfQotCw0YLQsNC2INCx0LDQudC90LDigKYnLFxuICAgIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0KLQsNGC0YHQsNC9JyxcbiAgICBlcnJvcjogJ9CQ0LvQtNCw0LAnLFxuICAgIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Ci0LDRgtCw0YUnLFxuICAgIHRpdGxlUXVpY2s6ICfQpdGD0YDQtNCw0L0g0YLQsNGC0LDRhScsXG4gICAgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLFxuICAgIGVkaXRlZDogJ9CX0LDRgdGB0LDQvScsXG4gIH0sXG4gIG5lOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueClgeCkgeCkpuCliOKApicsXG4gICAgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCkviDgpK3gpK/gpYsnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JyxcbiAgICBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpJvgpL/gpJ/gpYsg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsXG4gICAgZWRpdGVkOiAn4KS44KSu4KWN4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgb3I6IHtcbiAgICBkb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgZG93bmxvYWRpbmc6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0g4Ky54K2H4KyJ4Kyb4Ky/4oCmJyxcbiAgICB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ky44Kyu4K2N4Kyq4K2C4Kyw4K2N4Kyj4K2N4KyjJyxcbiAgICBlcnJvcjogJ+CspOCtjeCssOCtgeCsn+CsvycsXG4gICAgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICB0aXRsZVF1aWNrOiAn4Ky24K2A4KyY4K2N4KywIOCsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLFxuICAgIGVkaXRlZDogJ+CsuOCsruCtjeCsquCsvuCspuCsv+CspCcsXG4gIH0sXG4gIHNpOiB7XG4gICAgZG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLFxuICAgIGRvd25sb2FkaW5nOiAn4La24LeP4Lac4LatIOC3gOC3meC2uOC3kuC2seC3iuKApicsXG4gICAgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsXG4gICAgZG93bmxvYWRlZDogJ+C2heC3gOC3g+C2seC3iicsXG4gICAgZXJyb3I6ICfgtq/gt53gt4Lgtrrgtprgt5InLFxuICAgIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsXG4gICAgYXJpYURvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJyxcbiAgICB0aXRsZVF1aWNrOiAn4LaJ4Laa4LeK4La44Lax4LeKIOC2tuC3j+C2nOC2rSDgtprgt5Lgtrvgt5PgtrgnLFxuICAgIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJyxcbiAgICBlZGl0ZWQ6ICfgt4PgtoLgt4Pgt4rgtprgtrvgtqvgtronLFxuICB9LFxuICBzdzoge1xuICAgIGRvd25sb2FkOiAnUGFrdWEnLFxuICAgIGRvd25sb2FkaW5nOiAnSW5hcGFrdWHigKYnLFxuICAgIHRyeWluZzogJ0luYWphcmlideKApicsXG4gICAgZG93bmxvYWRlZDogJ0ltZWthbWlsaWthJyxcbiAgICBlcnJvcjogJ0hpdGlsYWZ1JyxcbiAgICBmYWlsZWQ6ICdJbWVzaGluZHdhLicsXG4gICAgYXJpYURvd25sb2FkOiAnUGFrdWEnLFxuICAgIHRpdGxlUXVpY2s6ICdQYWt1YSBoYXJha2EnLFxuICAgIGNvbW1lbnRzOiAnbWFvbmknLFxuICAgIGVkaXRlZDogJ0ltZWhhcmlyaXdhJyxcbiAgfSxcbiAgdXo6IHtcbiAgICBkb3dubG9hZDogJ1l1a2xhc2gnLFxuICAgIGRvd25sb2FkaW5nOiAnWXVrbGFubW9xZGHigKYnLFxuICAgIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVGF5eW9yJyxcbiAgICBlcnJvcjogJ1hhdG8nLFxuICAgIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1l1a2xhc2gnLFxuICAgIHRpdGxlUXVpY2s6ICdUZXogeXVrbGFzaCcsXG4gICAgY29tbWVudHM6ICdzaGFyaGxhcicsXG4gICAgZWRpdGVkOiAnVGFocmlybGFuZ2FuJyxcbiAgfSxcbiAgY3k6IHtcbiAgICBkb3dubG9hZDogJ0xhd3Jsd3l0aG8nLFxuICAgIGRvd25sb2FkaW5nOiAnWW4gbGF3cmx3eXRob+KApicsXG4gICAgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnV2VkaSBnb3JmZmVuJyxcbiAgICBlcnJvcjogJ0d3YWxsJyxcbiAgICBmYWlsZWQ6ICdNZXRob2RkLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGF3cmx3eXRobycsXG4gICAgdGl0bGVRdWljazogJ0xhd3Jsd3l0aG8gY3lmbHltJyxcbiAgICBjb21tZW50czogJ3N5bHdhZGF1JyxcbiAgICBlZGl0ZWQ6ICdHb2x5Z3d5ZCcsXG4gIH0sXG4gIHp1OiB7XG4gICAgZG93bmxvYWQ6ICdMYW5kYScsXG4gICAgZG93bmxvYWRpbmc6ICdJeWFsYW5kd2HigKYnLFxuICAgIHRyeWluZzogJ0l5YXphbWHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdJbGFuZMSrd2UnLFxuICAgIGVycm9yOiAnSXBodXRoYScsXG4gICAgZmFpbGVkOiAnSWhsdWxla2lsZS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhbmRhJyxcbiAgICB0aXRsZVF1aWNrOiAnVWt1bGFuZGEgb2t1c2hlc2hheW8nLFxuICAgIGNvbW1lbnRzOiAnYW1hendhbmEnLFxuICAgIGVkaXRlZDogJ0t1aGxlbGl3ZScsXG4gIH0sXG4gIHNxOiB7XG4gICAgZG93bmxvYWQ6ICdTaGthcmtvJyxcbiAgICBkb3dubG9hZGluZzogJ0R1a2Ugc2hrYXJrdWFy4oCmJyxcbiAgICB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQw6tyZnVuZG9pJyxcbiAgICBlcnJvcjogJ0dhYmltJyxcbiAgICBmYWlsZWQ6ICdEw6tzaHRvaS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1Noa2Fya28nLFxuICAgIHRpdGxlUXVpY2s6ICdTaGthcmtpbSBpIHNocGVqdMOrJyxcbiAgICBjb21tZW50czogJ2tvbWVudGUnLFxuICAgIGVkaXRlZDogJ0UgcmVkYWt0dWFyJyxcbiAgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJlxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmxhbmdcbiAgICApIHtcbiAgICAgIHJhd0xhbmcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci5sYW5ndWFnZSkge1xuICAgICAgcmF3TGFuZyA9IG5hdmlnYXRvci5sYW5ndWFnZTtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkTGFuZyA9IHJhd0xhbmdcbiAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAuc3BsaXQoJzsnKVswXVxuICAgICAgLnRyaW0oKVxuICAgICAgLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1snZW4nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG4gIH0gY2F0Y2gge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvZWRpdGVkX2ZyYW1lLmNvbnRlbnQudHNcbmltcG9ydCB7IEVESVRfSUNPTl9TVkdfUkFXLCBDT01NRU5UX0lDT05fVVJMIH0gZnJvbSAnLi9jb250ZW50L2ljb25zJztcbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vY29udGVudC9zdHlsZXMnO1xuaW1wb3J0IHsgaXNQYWdlRGFyayB9IGZyb20gJy4vY29udGVudC90aGVtZSc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9jb250ZW50L2kxOG4nO1xuXG4vLyBTZWxlY3RvciBmb3IgdGhlIG1haW4gc3RyZWFtIGNhcmRcbmNvbnN0IFBPU1RfU0VMRUNUT1IgPSAnZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJztcbmNvbnN0IEVESVRFRF9BVFRSID0gJ2RhdGEtY3FkLWVkaXRlZC1wcm9jZXNzZWQnO1xuXG4vLyDwn5S0IE5FVzogZGVib3VuY2UgZmxhZyBzbyB3ZSBkb24ndCByZXNjYW4gb24gZXZlcnkgdGlueSBtdXRhdGlvblxubGV0IGVkaXRlZFNjYW5TY2hlZHVsZWQgPSBmYWxzZTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnaHR0cHM6Ly9jbGFzc3Jvb20uZ29vZ2xlLmNvbS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW4oKSB7XG4gICAgaW5qZWN0U3R5bGVzKCk7XG4gICAgc2NhbkZvckVkaXRlZFBvc3RzKCk7XG5cbiAgICAvLyAtLS0gU1RSQVRFR1kgMTogTVVUQVRJT04gT0JTRVJWRVIgKFJlYWN0cyB0byBET00gY2hhbmdlcykgLS0tXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAvLyDinIUgRGVib3VuY2U6IG9ubHkgc2NoZWR1bGUgKm9uZSogc2NhbiBwZXIgZnJhbWVcbiAgICAgIGlmIChlZGl0ZWRTY2FuU2NoZWR1bGVkKSByZXR1cm47XG4gICAgICBlZGl0ZWRTY2FuU2NoZWR1bGVkID0gdHJ1ZTtcblxuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgZWRpdGVkU2NhblNjaGVkdWxlZCA9IGZhbHNlO1xuICAgICAgICBzY2FuRm9yRWRpdGVkUG9zdHMoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcjogWydhcmlhLWxhYmVsJywgJ3RpdGxlJ10sXG4gICAgfSk7XG5cbiAgICAvLyBIZWFydGJlYXRcbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBzY2FuRm9yRWRpdGVkUG9zdHMoKTtcbiAgICB9LCAyNTAwKTtcblxuICAgIC8vIFVSTCB3YXRjaGVyXG4gICAgbGV0IGxhc3RVcmwgPSBsb2NhdGlvbi5ocmVmO1xuICAgIG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IHVybCA9IGxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAodXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICAgIGxhc3RVcmwgPSB1cmw7XG4gICAgICAgIHNldFRpbWVvdXQoc2NhbkZvckVkaXRlZFBvc3RzLCA1MDApO1xuICAgICAgICBzZXRUaW1lb3V0KHNjYW5Gb3JFZGl0ZWRQb3N0cywgMTUwMCk7XG4gICAgICB9XG4gICAgfSkub2JzZXJ2ZShkb2N1bWVudCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSk7XG4gIH0sXG59KTtcblxuZnVuY3Rpb24gc2NhbkZvckVkaXRlZFBvc3RzKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IGdldFBhZ2VEaXJlY3Rpb24oKTtcbiAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnZGF0YS1jcWQtZGlyJywgZGlyZWN0aW9uKTtcblxuICAgIGNvbnN0IGVkaXRlZFdvcmQgPSB0KCdlZGl0ZWQnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHBvc3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oUE9TVF9TRUxFQ1RPUik7XG5cbiAgICBwb3N0cy5mb3JFYWNoKChwb3N0KSA9PiB7XG4gICAgICBsZXQgYWxyZWFkeVByb2Nlc3NlZCA9IGZhbHNlO1xuXG4gICAgICBpZiAocG9zdC5oYXNBdHRyaWJ1dGUoRURJVEVEX0FUVFIpKSB7XG4gICAgICAgIGNvbnN0IGhhc0VkaXRlZE92ZXJsYXkgPVxuICAgICAgICAgICEhcG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQnKSB8fFxuICAgICAgICAgICEhcG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLWVkaXRlZC1iYWRnZScpIHx8XG4gICAgICAgICAgISFwb3N0LnF1ZXJ5U2VsZWN0b3IoJy5jcWQtYm90aC1iYWRnZScpO1xuXG4gICAgICAgIGlmICghaGFzRWRpdGVkT3ZlcmxheSkge1xuICAgICAgICAgIHBvc3QucmVtb3ZlQXR0cmlidXRlKEVESVRFRF9BVFRSKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhbHJlYWR5UHJvY2Vzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWFscmVhZHlQcm9jZXNzZWQpIHtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmZyb20oXG4gICAgICAgICAgcG9zdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PignYSwgc3BhbiwgZGl2W2FyaWEtbGFiZWxdJylcbiAgICAgICAgKTtcblxuICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgbGV0IGRpZmZUZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICBmb3IgKGNvbnN0IGVsIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gKGVsLnRleHRDb250ZW50IHx8ICcnKS50cmltKCk7XG4gICAgICAgICAgY29uc3QgYXJpYSA9IChlbC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSB8fCAnJykudHJpbSgpO1xuICAgICAgICAgIGNvbnN0IHRpdGxlID0gKGVsLmdldEF0dHJpYnV0ZSgndGl0bGUnKSB8fCAnJykudHJpbSgpO1xuXG4gICAgICAgICAgY29uc3QgY29tYmluZWQgPSBgJHt0ZXh0fSAke2FyaWF9ICR7dGl0bGV9YC50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgICAgLy8gV2Ugb25seSBjYXJlIGFib3V0IGVsZW1lbnRzIHRoYXQgbWVudGlvbiBcImVkaXRlZFwiXG4gICAgICAgICAgaWYgKCFjb21iaW5lZC5pbmNsdWRlcyhlZGl0ZWRXb3JkKSkgY29udGludWU7XG5cbiAgICAgICAgICAvLyDwn5SlIE5FVzogdXNlIHRoZSBGVUxMIHBvc3QgdGV4dCAodmlzaWJsZSB0ZXh0ICsgYXJpYSBsYWJlbHMpXG4gICAgICAgICAgY29uc3QgZnVsbFBvc3RUZXh0ID1cbiAgICAgICAgICAgIChwb3N0LmlubmVyVGV4dCB8fCAnJykgKyAnICcgKyBnZXRBcmlhTGFiZWxzKHBvc3QpO1xuXG4gICAgICAgICAgZGlmZlRleHQgPSBjYWxjdWxhdGVFZGl0RGlmZihmdWxsUG9zdFRleHQsIGVkaXRlZFdvcmQpID8/ICcrMCc7XG4gICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZvdW5kICYmIGRpZmZUZXh0ICE9PSBudWxsKSB7XG4gICAgICAgICAgcG9zdC5zZXRBdHRyaWJ1dGUoRURJVEVEX0FUVFIsICd0cnVlJyk7XG4gICAgICAgICAgY3JlYXRlRWRpdGVkT3ZlcmxheShwb3N0LCBkaWZmVGV4dCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQWx3YXlzIHRyeSB0byBtZXJnZSBpbnRvIEJPVEggcGlsbCBpZiBib3RoIHN0YXRlcyBhcmUgcHJlc2VudFxuICAgICAgdXBncmFkZUNvbWJpbmVkQmFkZ2UocG9zdCk7XG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIFNpbGVudCBmYWlsXG4gIH1cbn1cblxuXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGRpZmZlcmVuY2UgaW4gZGF5cyBiZXR3ZWVuIGNyZWF0ZWQgYW5kIGVkaXRlZCBkYXRlLlxuICpcbiAqIFdlIG5vdyB3b3JrIG9uIHRoZSBGVUxMIHBvc3QgdGV4dCwgZS5nLjpcbiAqICAgXCJaZWluYSBTaGVyaWYgLi4uIE5vdiAxIChFZGl0ZWQgTm92IDUpXCJcbiAqXG4gKiBTdHJhdGVneTpcbiAqICAtIEZpbmQgdGhlIHBvc2l0aW9uIG9mIFwiZWRpdGVkXCIgaW4gdGhlIHN0cmluZ1xuICogIC0gVGFrZSBhbGwgbW9udGgvZGF5IGRhdGVzICpiZWZvcmUqIHRoYXQg4oaSIGNyZWF0ZWQgZGF0ZSA9IGxhc3Qgb25lIGJlZm9yZVxuICogIC0gVGFrZSBhbGwgbW9udGgvZGF5IGRhdGVzICphZnRlciogdGhhdCDihpIgZWRpdGVkIGRhdGUgPSBmaXJzdCBvbmUgYWZ0ZXJcbiAqICAtIElmIHRoYXQgZmFpbHMsIGZhbGwgYmFjayB0byBcImZpcnN0IGRhdGVcIiB2cyBcImxhc3QgZGF0ZVwiIGluIHRoZSBzdHJpbmdcbiAqXG4gKiBJZiBwYXJzaW5nIGZhaWxzIGNvbXBsZXRlbHksIHJldHVybnMgbnVsbCBhbmQgY2FsbGVyIGZhbGxzIGJhY2sgdG8gXCIrMFwiLlxuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVFZGl0RGlmZihmdWxsVGV4dDogc3RyaW5nLCBlZGl0ZWRLZXl3b3JkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gKGZ1bGxUZXh0IHx8ICcnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpO1xuICAgIGlmICghbm9ybWFsaXplZCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBsb3dlciA9IG5vcm1hbGl6ZWQudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBrZXkgPSBlZGl0ZWRLZXl3b3JkLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZWRpdGVkSW5kZXggPSBsb3dlci5pbmRleE9mKGtleSk7XG4gICAgY29uc3QgbW9udGhQYXR0ZXJuID1cbiAgICAgICdcXFxcYig/OkphbnxGZWJ8TWFyfEFwcnxNYXl8SnVufEp1bHxBdWd8U2VwfE9jdHxOb3Z8RGVjKVxcXFxzK1xcXFxkezEsMn1cXFxcYic7XG4gICAgY29uc3QgY3VycmVudFllYXIgPSBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XG5cbiAgICBjb25zdCBwYXJzZURhdGUgPSAoczogc3RyaW5nKTogRGF0ZSB8IG51bGwgPT4ge1xuICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKGAke3MudHJpbSgpfSAke2N1cnJlbnRZZWFyfWApO1xuICAgICAgcmV0dXJuIGlzTmFOKGQuZ2V0VGltZSgpKSA/IG51bGwgOiBkO1xuICAgIH07XG5cbiAgICBsZXQgY3JlYXRlZERhdGU6IERhdGUgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgZWRpdGVkRGF0ZTogRGF0ZSB8IG51bGwgPSBudWxsO1xuXG4gICAgLy8gMSkgUHJlZmVycmVkIHBhdGg6IHVzZSBkYXRlcyBhcm91bmQgdGhlIFwiZWRpdGVkXCIga2V5d29yZFxuICAgIGlmIChlZGl0ZWRJbmRleCAhPT0gLTEpIHtcbiAgICAgIGNvbnN0IGJlZm9yZVRleHQgPSBub3JtYWxpemVkLnNsaWNlKDAsIGVkaXRlZEluZGV4KTtcbiAgICAgIGNvbnN0IGFmdGVyVGV4dCA9IG5vcm1hbGl6ZWQuc2xpY2UoZWRpdGVkSW5kZXgpO1xuXG4gICAgICBjb25zdCBiZWZvcmVNYXRjaGVzID1cbiAgICAgICAgYmVmb3JlVGV4dC5tYXRjaChuZXcgUmVnRXhwKG1vbnRoUGF0dGVybiwgJ2dpJykpIHx8IFtdO1xuICAgICAgY29uc3QgYWZ0ZXJNYXRjaGVzID1cbiAgICAgICAgYWZ0ZXJUZXh0Lm1hdGNoKG5ldyBSZWdFeHAobW9udGhQYXR0ZXJuLCAnZ2knKSkgfHwgW107XG5cbiAgICAgIGlmIChiZWZvcmVNYXRjaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY3JlYXRlZFN0ciA9IGJlZm9yZU1hdGNoZXNbYmVmb3JlTWF0Y2hlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgY3JlYXRlZERhdGUgPSBwYXJzZURhdGUoY3JlYXRlZFN0cik7XG4gICAgICB9XG5cbiAgICAgIGlmIChhZnRlck1hdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBlZGl0ZWRTdHIgPSBhZnRlck1hdGNoZXNbMF07XG4gICAgICAgIGVkaXRlZERhdGUgPSBwYXJzZURhdGUoZWRpdGVkU3RyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAyKSBGYWxsYmFjazoganVzdCB1c2UgZmlyc3QgYW5kIGxhc3QgZGF0ZXMgaW4gdGhlIHdob2xlIHN0cmluZ1xuICAgIGlmICghY3JlYXRlZERhdGUgfHwgIWVkaXRlZERhdGUpIHtcbiAgICAgIGNvbnN0IGFsbE1hdGNoZXMgPSBub3JtYWxpemVkLm1hdGNoKFxuICAgICAgICBuZXcgUmVnRXhwKG1vbnRoUGF0dGVybiwgJ2dpJyksXG4gICAgICApO1xuXG4gICAgICBpZiAoIWFsbE1hdGNoZXMgfHwgYWxsTWF0Y2hlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBhcnNlZERhdGVzID0gYWxsTWF0Y2hlc1xuICAgICAgICAubWFwKChtKSA9PiBwYXJzZURhdGUobSkpXG4gICAgICAgIC5maWx0ZXIoKGQpOiBkIGlzIERhdGUgPT4gISFkKTtcblxuICAgICAgaWYgKCFwYXJzZWREYXRlcy5sZW5ndGgpIHJldHVybiBudWxsO1xuXG4gICAgICBjcmVhdGVkRGF0ZSA9IHBhcnNlZERhdGVzWzBdO1xuICAgICAgZWRpdGVkRGF0ZSA9XG4gICAgICAgIHBhcnNlZERhdGVzLmxlbmd0aCA+IDFcbiAgICAgICAgICA/IHBhcnNlZERhdGVzW3BhcnNlZERhdGVzLmxlbmd0aCAtIDFdXG4gICAgICAgICAgOiBwYXJzZWREYXRlc1swXTtcbiAgICB9XG5cbiAgICBpZiAoIWNyZWF0ZWREYXRlIHx8ICFlZGl0ZWREYXRlKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRheU1zID0gMTAwMCAqIDYwICogNjAgKiAyNDtcbiAgICBsZXQgZGlmZkRheXMgPSBNYXRoLmZsb29yKFxuICAgICAgKGVkaXRlZERhdGUuZ2V0VGltZSgpIC0gY3JlYXRlZERhdGUuZ2V0VGltZSgpKSAvIGRheU1zLFxuICAgICk7XG5cbiAgICAvLyBEZWZlbnNpdmU6IG5ldmVyIG5lZ2F0aXZlIChlLmcuIHdlaXJkIHllYXIgZWRnZSBjYXNlcylcbiAgICBpZiAoZGlmZkRheXMgPCAwKSBkaWZmRGF5cyA9IDA7XG5cbiAgICByZXR1cm4gYCske2RpZmZEYXlzfWA7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cblxuLyoqXG4gKiBIZWxwZXI6IGNvbGxlY3QgYXJpYS1sYWJlbC90aXRsZSB0ZXh0IGZyb20gaW5zaWRlIHRoZSBwb3N0LFxuICogc28gd2UgY2FuIGFsc28gc2VlIGRhdGVzIHRoYXQgYXJlIG9ubHkgZXhwb3NlZCB0aGVyZS5cbiAqL1xuZnVuY3Rpb24gZ2V0QXJpYUxhYmVsc0Zyb21Qb3N0KHBvc3Q6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgcmV0dXJuIEFycmF5LmZyb20oXG4gICAgcG9zdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PignW2FyaWEtbGFiZWxdLCBbdGl0bGVdJylcbiAgKVxuICAgIC5tYXAoXG4gICAgICAoZWwpID0+XG4gICAgICAgIChlbC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSB8fCAnJykgK1xuICAgICAgICAnICcgK1xuICAgICAgICAoZWwuZ2V0QXR0cmlidXRlKCd0aXRsZScpIHx8ICcnKVxuICAgIClcbiAgICAuam9pbignICcpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVFZGl0ZWRPdmVybGF5KHBvc3Q6IEhUTUxFbGVtZW50LCBkaWZmVGV4dDogc3RyaW5nKSB7XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocG9zdCk7XG5cbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykgcG9zdC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gIHBvc3Quc3R5bGUuc2V0UHJvcGVydHkoJ292ZXJmbG93JywgJ3Zpc2libGUnLCAnaW1wb3J0YW50Jyk7XG4gIHBvc3Quc3R5bGUuc2V0UHJvcGVydHkoJ2NvbnRhaW4nLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgcG9zdC5zdHlsZS56SW5kZXggPSAnMSc7XG5cbiAgLy8gRnJhbWUgKHJldXNlIGlmIGNvbW1lbnQgc2NyaXB0IGFscmVhZHkgY3JlYXRlZCBpdClcbiAgbGV0IG92ZXJsYXkgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTERpdkVsZW1lbnQ+KCcuY3FkLW92ZXJsYXktY29udGFpbmVyJyk7XG4gIGlmICghb3ZlcmxheSkge1xuICAgIG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBvdmVybGF5LmNsYXNzTmFtZSA9ICdjcWQtb3ZlcmxheS1jb250YWluZXIgY3FkLWVkaXRlZCc7XG4gICAgb3ZlcmxheS5zdHlsZS5ib3JkZXJSYWRpdXMgPSBjb21wdXRlZC5ib3JkZXJSYWRpdXMgfHwgJzhweCc7XG4gICAgaWYgKGlzUGFnZURhcmsoKSkgb3ZlcmxheS5jbGFzc0xpc3QuYWRkKCdjcWQtdGhlbWUtZGFyaycpO1xuXG4gICAgb3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBpZiAoZS50YXJnZXQgPT09IG92ZXJsYXkpIHtcbiAgICAgICAgY29uc3QgbGluayA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2FbaHJlZio9XCIvZGV0YWlscy9cIl0sIGgyIGEnKTtcbiAgICAgICAgaWYgKGxpbmspIGxpbmsuY2xpY2soKTtcbiAgICAgICAgZWxzZSBwb3N0LmNsaWNrKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBwb3N0LmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuICB9IGVsc2Uge1xuICAgIG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgnY3FkLWVkaXRlZCcpO1xuICAgIGlmIChpc1BhZ2VEYXJrKCkpIG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcbiAgfVxuXG4gIC8vIElmIEJPVEggcGlsbCBhbHJlYWR5IGV4aXN0cywgZG9uJ3QgY3JlYXRlIGEgc2VwYXJhdGUgZWRpdGVkIHBpbGxcbiAgaWYgKHBvc3QucXVlcnlTZWxlY3RvcignLmNxZC1ib3RoLWJhZGdlJykpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBSZW1vdmUgYW55IG9sZGVyIGVkaXRlZCBwaWxsIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgY29uc3QgZXhpc3RpbmdFZGl0ZWRCYWRnZSA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZWRpdGVkLWJhZGdlJyk7XG4gIGV4aXN0aW5nRWRpdGVkQmFkZ2U/LnJlbW92ZSgpO1xuXG4gIGNvbnN0IHBpbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcGlsbC5jbGFzc05hbWUgPSAnY3FkLWVkaXRlZC1iYWRnZSc7XG4gIGlmIChpc1BhZ2VEYXJrKCkpIHBpbGwuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcblxuICAvLyDwn5S5IFRvb2x0aXAgZm9yIGVkaXRlZCBwaWxsXG4gIHBpbGwudGl0bGUgPSAnRGF5cyBiZXR3ZWVuIHBvc3RpbmcgYW5kIHRoZSBsYXN0IGVkaXQnO1xuICBwaWxsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHBpbGwudGl0bGUpO1xuXG4gIGNvbnN0IGljb25XcmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGljb25XcmFwcGVyLmNsYXNzTmFtZSA9ICdjcWQtZWRpdGVkLWljb24nO1xuICBpY29uV3JhcHBlci5pbm5lckhUTUwgPSBFRElUX0lDT05fU1ZHX1JBVztcbiAgcGlsbC5hcHBlbmRDaGlsZChpY29uV3JhcHBlcik7XG5cbiAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBjb250ZW50LmNsYXNzTmFtZSA9ICdjcWQtZWRpdGVkLWNvbnRlbnQnO1xuXG4gIGNvbnN0IGRpZmZTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBkaWZmU3Bhbi5jbGFzc05hbWUgPSAnY3FkLWRpZmYtdmFsJztcbiAgZGlmZlNwYW4udGV4dENvbnRlbnQgPSBkaWZmVGV4dDsgLy8gXCIrOVwiLCBcIisyM1wiLCBcIiswXCIsIGV0Yy5cbiAgY29udGVudC5hcHBlbmRDaGlsZChkaWZmU3Bhbik7XG5cbiAgcGlsbC5hcHBlbmRDaGlsZChjb250ZW50KTtcbiAgcG9zdC5hcHBlbmRDaGlsZChwaWxsKTtcbn1cblxuZnVuY3Rpb24gZ2V0UGFnZURpcmVjdGlvbigpOiAnbHRyJyB8ICdydGwnIHtcbiAgY29uc3QgZG9jRGlyID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRpciB8fCBkb2N1bWVudC5ib2R5LmRpcjtcbiAgcmV0dXJuIGRvY0RpciA9PT0gJ3J0bCcgPyAncnRsJyA6ICdsdHInO1xufVxuXG4vKipcbiAqIE1lcmdlIGNvbW1lbnRzIGJhZGdlICsgZWRpdGVkIGJhZGdlIGludG8gYSBzaW5nbGUgQk9USCBwaWxsXG4gKiB3aXRoOlxuICogIC0gY29tbWVudCBpY29uICsgY291bnRcbiAqICAtIFwiK1wiXG4gKiAgLSBkaXZpZGVyXG4gKiAgLSBlZGl0ZWQgaWNvbiArIFwiK05cIlxuICovXG5mdW5jdGlvbiB1cGdyYWRlQ29tYmluZWRCYWRnZShwb3N0OiBIVE1MRWxlbWVudCkge1xuICBjb25zdCBvdmVybGF5ID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxEaXZFbGVtZW50PignLmNxZC1vdmVybGF5LWNvbnRhaW5lcicpO1xuICBjb25zdCBjb21tZW50QmFkZ2UgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWNvbW1lbnQtYmFkZ2UnKTtcbiAgY29uc3QgZWRpdGVkQmFkZ2UgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWVkaXRlZC1iYWRnZScpO1xuICBsZXQgYm90aEJhZGdlID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLWJhZGdlJyk7XG5cbiAgLy8gRG9lcyB0aGlzIHBvc3QgaGF2ZSBjb21tZW50cyAmIGVkaXRlZCBpbmZvP1xuICBjb25zdCBoYXNDb21tZW50cyA9XG4gICAgISFjb21tZW50QmFkZ2UgfHwgcG9zdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtY3FkLXByb2Nlc3NlZCcpO1xuICBjb25zdCBoYXNFZGl0ZWQgPVxuICAgICEhZWRpdGVkQmFkZ2UgfHwgcG9zdC5oYXNBdHRyaWJ1dGUoJ2RhdGEtY3FkLWVkaXRlZC1wcm9jZXNzZWQnKTtcblxuICAvLyBJZiBpdCBkb2Vzbid0IHRydWx5IGhhdmUgQk9USCwgbm8gY29tYmluZWQgcGlsbFxuICBpZiAoIWhhc0NvbW1lbnRzIHx8ICFoYXNFZGl0ZWQpIHtcbiAgICBib3RoQmFkZ2U/LnJlbW92ZSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLSBFeHRyYWN0IFZBTFVFUyAtLS0tLS0tLS1cblxuICAvLyAxKSBDb21tZW50IGNvdW50XG4gIGxldCBjb21tZW50Q291bnQgPSAnMCc7XG4gIGNvbnN0IGNvbW1lbnRMYWJlbCA9IGNvbW1lbnRCYWRnZT8ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtYmFkZ2UtbGFiZWwnKTtcbiAgaWYgKGNvbW1lbnRMYWJlbD8udGV4dENvbnRlbnQ/LnRyaW0oKSkge1xuICAgIGNvbW1lbnRDb3VudCA9IGNvbW1lbnRMYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIH0gZWxzZSBpZiAoYm90aEJhZGdlKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBib3RoQmFkZ2UucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtYm90aC12YWx1ZS1jb21tZW50Jyk7XG4gICAgaWYgKGV4aXN0aW5nPy50ZXh0Q29udGVudD8udHJpbSgpKSB7XG4gICAgICBjb21tZW50Q291bnQgPSBleGlzdGluZy50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gMikgRWRpdCBkaWZmIFwiK05cIlxuICBsZXQgZGlmZlRleHQgPSAnKzAnO1xuICBjb25zdCBkaWZmU3BhbiA9IGVkaXRlZEJhZGdlPy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kaWZmLXZhbCcpO1xuICBpZiAoZGlmZlNwYW4/LnRleHRDb250ZW50Py50cmltKCkpIHtcbiAgICBkaWZmVGV4dCA9IGRpZmZTcGFuLnRleHRDb250ZW50LnRyaW0oKTtcbiAgfSBlbHNlIGlmIChib3RoQmFkZ2UpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IGJvdGhCYWRnZS5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLXZhbHVlLWVkaXRlZCcpO1xuICAgIGlmIChleGlzdGluZz8udGV4dENvbnRlbnQ/LnRyaW0oKSkge1xuICAgICAgZGlmZlRleHQgPSBleGlzdGluZy50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgQk9USCBiYWRnZSBhbHJlYWR5IGV4aXN0cywganVzdCBzeW5jIGl0cyBudW1iZXJzIGFuZCBleGl0XG4gIGlmIChib3RoQmFkZ2UpIHtcbiAgICBjb25zdCBjYyA9IGJvdGhCYWRnZS5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLXZhbHVlLWNvbW1lbnQnKTtcbiAgICBjb25zdCBkZCA9IGJvdGhCYWRnZS5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLXZhbHVlLWVkaXRlZCcpO1xuICAgIGlmIChjYykgY2MudGV4dENvbnRlbnQgPSBjb21tZW50Q291bnQ7XG4gICAgaWYgKGRkKSBkZC50ZXh0Q29udGVudCA9IGRpZmZUZXh0O1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLSBCdWlsZCB0aGUgbWVyZ2VkIHBpbGwgLS0tLS0tLS0tXG5cbiAgLy8gUmVtb3ZlIHNlcGFyYXRlIGNvbW1lbnQvZWRpdGVkIGJhZGdlcyBzbyB3ZSBvbmx5IGhhdmUgdGhlIGNvbWJpbmVkIG9uZVxuICBjb21tZW50QmFkZ2U/LnJlbW92ZSgpO1xuICBlZGl0ZWRCYWRnZT8ucmVtb3ZlKCk7XG5cbiAgLy8gRW5zdXJlIG92ZXJsYXkgZXhpc3RzIChpbiBjYXNlIGNvbW1lbnRzIHNjcmlwdCBkaWRuJ3QgbWFrZSBvbmUpXG4gIGlmICghb3ZlcmxheSkge1xuICAgIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocG9zdCk7XG4gICAgY29uc3QgbmV3T3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG5ld092ZXJsYXkuY2xhc3NOYW1lID0gJ2NxZC1vdmVybGF5LWNvbnRhaW5lcic7XG4gICAgbmV3T3ZlcmxheS5zdHlsZS5ib3JkZXJSYWRpdXMgPSBjb21wdXRlZC5ib3JkZXJSYWRpdXMgfHwgJzhweCc7XG5cbiAgICBuZXdPdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGlmIChlLnRhcmdldCA9PT0gbmV3T3ZlcmxheSkge1xuICAgICAgICBjb25zdCBsaW5rID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignYVtocmVmKj1cIi9kZXRhaWxzL1wiXSwgaDIgYScpO1xuICAgICAgICBpZiAobGluaykgbGluay5jbGljaygpO1xuICAgICAgICBlbHNlIHBvc3QuY2xpY2soKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHBvc3QuYXBwZW5kQ2hpbGQobmV3T3ZlcmxheSk7XG4gIH1cblxuICBib3RoQmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYm90aEJhZGdlLmNsYXNzTmFtZSA9ICdjcWQtYm90aC1iYWRnZSc7XG5cbiAgLy8g8J+UuSBUb29sdGlwIGZvciBCT1RIIHBpbGxcbiAgYm90aEJhZGdlLnRpdGxlID0gJ1RvcDogbnVtYmVyIG9mIGNvbW1lbnRzLiBCb3R0b206IGRheXMgYmV0d2VlbiBwb3N0aW5nIGFuZCBsYXN0IGVkaXQuJztcbiAgYm90aEJhZGdlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGJvdGhCYWRnZS50aXRsZSk7XG5cbiAgLy8gU2VjdGlvbiAxOiBDb21tZW50cyAoaWNvbiArIG51bWJlcilcbiAgY29uc3QgY29tbWVudHNTZWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGNvbW1lbnRzU2VjdGlvbi5jbGFzc05hbWUgPSAnY3FkLWJvdGgtc2VjdGlvbiBjcWQtYm90aC1jb21tZW50cyc7XG5cbiAgY29uc3QgY29tbWVudEljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29tbWVudEljb24uY2xhc3NOYW1lID0gJ2NxZC1ib3RoLWljb24gY3FkLWJvdGgtaWNvbi1jb21tZW50JztcbiAgY29tbWVudEljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7Q09NTUVOVF9JQ09OX1VSTH1cIilgO1xuICBjb21tZW50c1NlY3Rpb24uYXBwZW5kQ2hpbGQoY29tbWVudEljb24pO1xuXG4gIGNvbnN0IGNvbW1lbnRWYWx1ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgY29tbWVudFZhbHVlLmNsYXNzTmFtZSA9ICdjcWQtYm90aC12YWx1ZSBjcWQtYm90aC12YWx1ZS1jb21tZW50JztcbiAgY29tbWVudFZhbHVlLnRleHRDb250ZW50ID0gY29tbWVudENvdW50O1xuICBjb21tZW50c1NlY3Rpb24uYXBwZW5kQ2hpbGQoY29tbWVudFZhbHVlKTtcblxuICAvLyBNaWRkbGU6IFwiK1wiXG4gIGNvbnN0IHBsdXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcGx1cy5jbGFzc05hbWUgPSAnY3FkLWJvdGgtcGx1cyc7XG4gIHBsdXMudGV4dENvbnRlbnQgPSAnKyc7XG5cbiAgLy8gRGl2aWRlciAob25seSB2aXNpYmxlIG9uIGhvdmVyKVxuICBjb25zdCBkaXZpZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGRpdmlkZXIuY2xhc3NOYW1lID0gJ2NxZC1ib3RoLWRpdmlkZXInO1xuXG4gIC8vIFNlY3Rpb24gMjogRWRpdGVkIChpY29uICsgK04pXG4gIGNvbnN0IGVkaXRlZFNlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWRpdGVkU2VjdGlvbi5jbGFzc05hbWUgPSAnY3FkLWJvdGgtc2VjdGlvbiBjcWQtYm90aC1lZGl0ZWQnO1xuXG4gIGNvbnN0IGVkaXRlZEljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWRpdGVkSWNvbi5jbGFzc05hbWUgPSAnY3FkLWJvdGgtaWNvbiBjcWQtYm90aC1pY29uLWVkaXRlZCc7XG4gIGVkaXRlZEljb24uaW5uZXJIVE1MID0gRURJVF9JQ09OX1NWR19SQVc7XG4gIGVkaXRlZFNlY3Rpb24uYXBwZW5kQ2hpbGQoZWRpdGVkSWNvbik7XG5cbiAgY29uc3QgZGlmZlZhbHVlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBkaWZmVmFsdWUuY2xhc3NOYW1lID0gJ2NxZC1ib3RoLXZhbHVlIGNxZC1ib3RoLXZhbHVlLWVkaXRlZCc7XG4gIGRpZmZWYWx1ZS50ZXh0Q29udGVudCA9IGRpZmZUZXh0O1xuICBlZGl0ZWRTZWN0aW9uLmFwcGVuZENoaWxkKGRpZmZWYWx1ZSk7XG5cbiAgLy8gRmluYWwgdmVydGljYWwgb3JkZXI6XG4gIC8vICBjb21tZW50c1NlY3Rpb24gKGljb24sIG51bWJlcilcbiAgLy8gIHBsdXNcbiAgLy8gIGRpdmlkZXJcbiAgLy8gIGVkaXRlZFNlY3Rpb24gKGljb24sICtOKVxuICBib3RoQmFkZ2UuYXBwZW5kQ2hpbGQoY29tbWVudHNTZWN0aW9uKTtcbiAgYm90aEJhZGdlLmFwcGVuZENoaWxkKHBsdXMpO1xuICBib3RoQmFkZ2UuYXBwZW5kQ2hpbGQoZGl2aWRlcik7XG4gIGJvdGhCYWRnZS5hcHBlbmRDaGlsZChlZGl0ZWRTZWN0aW9uKTtcblxuICBib3RoQmFkZ2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdHJpZ2dlclBvc3RDbGljayhwb3N0KTtcbiAgfSk7XG5cbiAgcG9zdC5hcHBlbmRDaGlsZChib3RoQmFkZ2UpO1xufVxuXG5mdW5jdGlvbiB0cmlnZ2VyUG9zdENsaWNrKHBvc3Q6IEhUTUxFbGVtZW50KSB7XG4gIGNvbnN0IHRpdGxlTGluayA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2FbaHJlZio9XCIvZGV0YWlscy9cIl0sIGgyIGEnKTtcbiAgaWYgKHRpdGxlTGluaykge1xuICAgIHRpdGxlTGluay5jbGljaygpO1xuICB9IGVsc2Uge1xuICAgIHBvc3QuY2xpY2soKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRBcmlhTGFiZWxzKGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIHJldHVybiBBcnJheS5mcm9tKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsXScpKVxuICAgIC5tYXAoKG5vZGUpID0+IG5vZGUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHwgJycpXG4gICAgLmpvaW4oJyAnKTtcbn0iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTJCOUIsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUFVTSxRQUFNLHVCQUF1QjtBQUc3QixRQUFNLG9CQUFvQjtBQUsxQixRQUFNLG1CQUFtQiwyQkFBMkI7QUFBQSxJQUN6RDtBQUFBLEVBQ0YsQ0FBQztBQ2hERCxRQUFNLFdBQVc7QUFDakIsUUFBTSxrQkFBa0I7QUFFeEIsUUFBTSxnQkFBZ0I7QUFDdEIsUUFBTSxpQkFBaUIsR0FBRyxhQUFhO0FBRWhDLFdBQVMsZUFBcUI7QUFDbkMsUUFBSSxPQUFPLGFBQWEsWUFBYTtBQUNyQyxRQUFJLFNBQVMsZUFBZSxRQUFRLEVBQUc7QUFFdkMsVUFBTSxRQUFRLFNBQVMsY0FBYyxPQUFPO0FBQzVDLFVBQU0sS0FBSztBQUNYLFVBQU0sY0FBYztBQUFBO0FBQUEsMEJBRUksY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFvSVQscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFpSnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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QUE7QUFFQSxjQUFBLGlCQUFBLFNBQUEsQ0FBQSxNQUFBO0FBQ0UsWUFBQSxFQUFBLFdBQUEsU0FBQTtBQUNFLGdCQUFBLE9BQUEsS0FBQSxjQUFBLDRCQUFBO0FBQ0EsY0FBQSxLQUFBLE1BQUEsTUFBQTtBQUFBLGNBQXFCLE1BQUEsTUFBQTtBQUFBLFFBQ0w7QUFBQSxNQUNsQixDQUFBO0FBR0YsV0FBQSxZQUFBLE9BQUE7QUFBQSxJQUF3QixPQUFBO0FBRXhCLGNBQUEsVUFBQSxJQUFBLFlBQUE7QUFDQSxVQUFBLFdBQUEsRUFBQSxTQUFBLFVBQUEsSUFBQSxnQkFBQTtBQUFBLElBQXdEO0FBSTFELFFBQUEsS0FBQSxjQUFBLGlCQUFBLEdBQUE7QUFDRTtBQUFBLElBQUE7QUFJRixVQUFBLHNCQUFBLEtBQUEsY0FBQSxtQkFBQTtBQUNBLHlCQUFBLE9BQUE7QUFFQSxVQUFBLE9BQUEsU0FBQSxjQUFBLEtBQUE7QUFDQSxTQUFBLFlBQUE7QUFDQSxRQUFBLFdBQUEsRUFBQSxNQUFBLFVBQUEsSUFBQSxnQkFBQTtBQUdBLFNBQUEsUUFBQTtBQUNBLFNBQUEsYUFBQSxjQUFBLEtBQUEsS0FBQTtBQUVBLFVBQUEsY0FBQSxTQUFBLGNBQUEsS0FBQTtBQUNBLGdCQUFBLFlBQUE7QUFDQSxnQkFBQSxZQUFBO0FBQ0EsU0FBQSxZQUFBLFdBQUE7QUFFQSxVQUFBLFVBQUEsU0FBQSxjQUFBLEtBQUE7QUFDQSxZQUFBLFlBQUE7QUFFQSxVQUFBLFdBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxhQUFBLFlBQUE7QUFDQSxhQUFBLGNBQUE7QUFDQSxZQUFBLFlBQUEsUUFBQTtBQUVBLFNBQUEsWUFBQSxPQUFBO0FBQ0EsU0FBQSxZQUFBLElBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxtQkFBQTtBQUNFLFVBQUEsU0FBQSxTQUFBLGdCQUFBLE9BQUEsU0FBQSxLQUFBO0FBQ0EsV0FBQSxXQUFBLFFBQUEsUUFBQTtBQUFBLEVBQ0Y7QUFVQSxXQUFBLHFCQUFBLE1BQUE7QUFDRSxVQUFBLFVBQUEsS0FBQSxjQUFBLHdC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
editedframe;