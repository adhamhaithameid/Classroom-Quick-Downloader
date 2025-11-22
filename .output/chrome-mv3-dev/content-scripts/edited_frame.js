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

      /* Spinner (Light theme defaults) */
      --cqd-spinner-border: rgba(15, 23, 42, 0.22); /* dark-ish ring */
      --cqd-spinner-top: #0f172a;                   /* solid dark tip */

      /* =================================================================
       * COLOR PALETTE & SHADOWS (Light Mode / Default)
       * ================================================================= */
      
      /* 1. Normal (Primary) - Light: #005DD7 */
      --cqd-color-normal: #005DD7;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 93, 215, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 93, 215, 0.70);

      /* 2. Success - Light: #00A82D */
      --cqd-color-success: #00A82D;
      --cqd-shadow-success: 0 12px 28px rgba(0, 168, 45, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(0, 168, 45, 0.70);

      /* 3. Error - Light: #FF4036 */
      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      /* 4. Trying - Light: #EC6300 */
      --cqd-color-trying: #EC6300;
      --cqd-shadow-trying: 0 12px 28px rgba(236, 99, 0, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(236, 99, 0, 0.70);

      /* 5. Comment Frame - Light: #9B00FF */
      --cqd-color-comment: #9B00FF;
      
      /* 6. Edited Frame - Light: #007F8D */
      --cqd-color-edited: #007F8D;

      /* Base Shadows */
      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);

      /* 7. BOTH (Edited + Comments) - Light */
      --cqd-both-bg: #FF4036;
      --cqd-both-fg: #FF4036;
      --cqd-both-shadow: 0 8px 22px rgba(255, 64, 54, 0.70);
      --cqd-both-overlay-shadow:
        inset 0 0 0 2px #FF4036,
        0 0 12px rgba(255, 64, 54, 0.70);
    }

    /* =================================================================
     * DARK MODE OVERRIDES (Applied via .cqd-theme-dark class)
     * ================================================================= */
    .cqd-theme-dark {
      /* 1. Normal (Primary) - Dark: #006EFF */
      --cqd-color-normal: #006EFF;
      --cqd-shadow-normal: 0 8px 22px rgba(0, 110, 255, 0.40);
      --cqd-shadow-normal-strong: 0 12px 28px rgba(0, 110, 255, 0.70);

      /* 2. Success - Dark: #07DA3F */
      --cqd-color-success: #07DA3F;
      --cqd-shadow-success: 0 12px 28px rgba(7, 218, 63, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(7, 218, 63, 0.70);

      /* 3. Error - Dark: #FF4036 */
      --cqd-color-error: #FF4036;
      --cqd-shadow-error: 0 12px 28px rgba(255, 64, 54, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(255, 64, 54, 0.70);

      /* 4. Trying - Dark: #FF9142 */
      --cqd-color-trying: #FF9142;
      --cqd-shadow-trying: 0 12px 28px rgba(255, 145, 66, 0.40);
      --cqd-shadow-trying-strong: 0 12px 28px rgba(255, 145, 66, 0.70);

      /* 5. Comment Frame - Dark: #9B00FF */
      --cqd-color-comment: #9B00FF;

      /* 6. Edited Frame - Dark: #00D6EE */
      --cqd-color-edited: #00D6EE;

      /* 7. BOTH (Edited + Comments) - Dark */
      --cqd-both-bg: #ffffff;
      --cqd-both-fg: #000000;
      --cqd-both-shadow: 0 8px 22px rgba(255, 255, 255, 0.85);
      --cqd-both-overlay-shadow:
        inset 0 0 0 2px #ffffff,
        0 0 12px rgba(255, 255, 255, 0.85);

      /* Spinner (Dark theme overrides) */
      --cqd-spinner-border: rgba(255, 255, 255, 0.22);
      --cqd-spinner-top: #ffffff;
    }

    /* ============================================================
     * CRITICAL OVERRIDES
     * ============================================================ */
    div[data-stream-item-id] {
      overflow: visible !important;
      contain: none !important;
      z-index: 1;
    }

    /* ===============================
     * 1. DOWNLOAD BUTTON STYLES
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

    /* States */
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
    }

    .cqd-download-btn:active {
      transform: translateY(-50%) scale(0.97);
    }

    /* Icons & Labels */
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
      transition:
        opacity var(--cqd-transition),
        max-width var(--cqd-transition),
        margin-left var(--cqd-transition);
    }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 4px;
    }

    /* Pill States */
    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-trying,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-normal);
      cursor: default;
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

    /* Success */
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

    /* Error */
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

    /* Spinner */
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
      to   { transform: rotate(360deg); }
    }


    /* ===============================
     * 2. COMMENT FRAME & BADGE
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
      transition:
        height var(--cqd-transition),
        box-shadow 0.2s ease;
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
      transition:
        opacity 0.15s ease 0.05s,
        transform 0.15s ease 0.05s;
    }

    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }

    /* ===============================
     * 3. EDITED FRAME & PILL
     * =============================== */
    
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
      transition:
        height var(--cqd-transition),
        box-shadow 0.2s ease;
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
      transition:
        opacity 0.15s ease 0.05s,
        transform 0.15s ease 0.05s;
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

    /* ===============================
     * 4. BOTH STATE (Edited + Comments → ONE pill)
     * =============================== */

    /* When a post has both data-cqd-processed and data-cqd-edited-processed,
       give the frame a darker outline/glow so it feels special */
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
      transition:
        height var(--cqd-transition),
        box-shadow 0.2s ease;
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
      /* no filter so the asset stays crisp in all themes */
    }

    /* Edited icon (SVG) uses currentColor (white) */
    .cqd-both-icon-edited svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
    }

    /* The "+" between icons (always visible) */
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
    en: { download: "Download", downloading: "Downloading…", trying: "Trying…", downloaded: "Downloaded", error: "Error", failed: "Download failed.", ariaDownload: "Download", titleQuick: "Quick download", comments: "comments", edited: "Edited" },
    ar: { download: "تنزيل", downloading: "جاري التنزيل…", trying: "محاولة…", downloaded: "تم التنزيل", error: "خطأ", failed: "فشل التنزيل.", ariaDownload: "تنزيل", titleQuick: "تنزيل سريع", comments: "تعليقات", edited: "تم التعديل" },
    ja: { download: "ダウンロード", downloading: "DL中…", trying: "試行中…", downloaded: "完了", error: "エラー", failed: "失敗しました。", ariaDownload: "ダウンロード", titleQuick: "クイックダウンロード", comments: "件のコメント", edited: "編集済み" },
    es: { download: "Descargar", downloading: "Descargando…", trying: "Intentando…", downloaded: "Descargado", error: "Error", failed: "Falló la descarga.", ariaDownload: "Descargar", titleQuick: "Descarga rápida", comments: "comentarios", edited: "Editado" },
    hi: { download: "डाउनलोड", downloading: "डाउनलोडिंग…", trying: "कोशिश जारी…", downloaded: "पूर्ण", error: "त्रुटि", failed: "विफल रहा", ariaDownload: "डाउनलोड", titleQuick: "त्वरित डाउनलोड", comments: "टिप्पणियाँ", edited: "संपादित" },
    pt: { download: "Baixar", downloading: "Baixando…", trying: "Tentando…", downloaded: "Baixado", error: "Erro", failed: "Falha ao baixar.", ariaDownload: "Baixar", titleQuick: "Download rápido", comments: "comentários", edited: "Editado" },
    "pt-pt": { download: "Descarregar", downloading: "A descarregar…", trying: "A tentar…", downloaded: "Descarregado", error: "Erro", failed: "Falha ao descarregar.", ariaDownload: "Descarregar", titleQuick: "Descarga rápida", comments: "comentários", edited: "Editado" },
    "zh-cn": { download: "下载", downloading: "下载中…", trying: "尝试中…", downloaded: "已下载", error: "错误", failed: "下载失败", ariaDownload: "下载", titleQuick: "快速下载", comments: "条评论", edited: "已编辑" },
    "zh-tw": { download: "下載", downloading: "下載中…", trying: "嘗試中…", downloaded: "已下載", error: "錯誤", failed: "下載失敗", ariaDownload: "下載", titleQuick: "快速下載", comments: "則留言", edited: "已編輯" },
    fr: { download: "Télécharger", downloading: "Téléchargement…", trying: "Essai…", downloaded: "Téléchargé", error: "Erreur", failed: "Échec.", ariaDownload: "Télécharger", titleQuick: "Téléchargement rapide", comments: "commentaires", edited: "Modifié" },
    de: { download: "Herunterladen", downloading: "Laden…", trying: "Versuchen…", downloaded: "Fertig", error: "Fehler", failed: "Fehlgeschlagen.", ariaDownload: "Herunterladen", titleQuick: "Schneller Download", comments: "Kommentare", edited: "Bearbeitet" },
    it: { download: "Scarica", downloading: "Scaricamento…", trying: "Provando…", downloaded: "Scaricato", error: "Errore", failed: "Fallito.", ariaDownload: "Scarica", titleQuick: "Download rapido", comments: "commenti", edited: "Modificato" },
    ru: { download: "Скачать", downloading: "Скачивание…", trying: "Попытка…", downloaded: "Скачано", error: "Ошибка", failed: "Сбой.", ariaDownload: "Скачать", titleQuick: "Быстрое скачивание", comments: "комментариев", edited: "Изменено" },
    ko: { download: "다운로드", downloading: "다운로드 중…", trying: "시도 중…", downloaded: "완료", error: "오류", failed: "실패함", ariaDownload: "다운로드", titleQuick: "빠른 다운로드", comments: "개 댓글", edited: "수정됨" },
    tr: { download: "İndir", downloading: "İndiriliyor…", trying: "Deneniyor…", downloaded: "İndirildi", error: "Hata", failed: "Başarısız.", ariaDownload: "İndir", titleQuick: "Hızlı indir", comments: "yorum", edited: "Düzenlendi" },
    vi: { download: "Tải xuống", downloading: "Đang tải…", trying: "Đang thử…", downloaded: "Đã tải", error: "Lỗi", failed: "Thất bại.", ariaDownload: "Tải xuống", titleQuick: "Tải xuống nhanh", comments: "nhận xét", edited: "Đã chỉnh sửa" },
    id: { download: "Download", downloading: "Mengunduh…", trying: "Mencoba…", downloaded: "Selesai", error: "Kesalahan", failed: "Gagal.", ariaDownload: "Download", titleQuick: "Download cepat", comments: "komentar", edited: "Diedit" },
    th: { download: "ดาวน์โหลด", downloading: "กำลังโหลด…", trying: "พยายาม…", downloaded: "เสร็จสิ้น", error: "ข้อผิดพลาด", failed: "ล้มเหลว", ariaDownload: "ดาวน์โหลด", titleQuick: "ดาวน์โหลดด่วน", comments: "ความคิดเห็น", edited: "แก้ไขแล้ว" },
    pl: { download: "Pobierz", downloading: "Pobieranie…", trying: "Próba…", downloaded: "Pobrano", error: "Błąd", failed: "Nieudane.", ariaDownload: "Pobierz", titleQuick: "Szybkie pobieranie", comments: "komentarze", edited: "Edytowano" },
    nl: { download: "Downloaden", downloading: "Downloaden…", trying: "Proberen…", downloaded: "Klaar", error: "Fout", failed: "Mislukt.", ariaDownload: "Downloaden", titleQuick: "Snel downloaden", comments: "reacties", edited: "Bewerkt" },
    bn: { download: "ডাউনলোড", downloading: "ডাউনলোড হচ্ছে…", trying: "চেষ্টা করছে…", downloaded: "সম্পন্ন", error: "ত্রুটি", failed: "ব্যর্থ হয়েছে", ariaDownload: "ডাউনলোড", titleQuick: "দ্রুত ডাউনলোড", comments: "টি মন্তব্য", edited: "সম্পাদিত" },
    pa: { download: "ਡਾਉਨਲੋਡ", downloading: "ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…", trying: "ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…", downloaded: "ਮੁਕੰਮਲ", error: "ਗਲਤੀ", failed: "ਅਸਫਲ", ariaDownload: "ਡਾਉਨਲੋਡ", titleQuick: "ਤੇਜ਼ ਡਾਉਨਲੋਡ", comments: "ਟਿੱਪਣੀਆਂ", edited: "ਸੰਪਾਦਿਤ" },
    te: { download: "డౌన్‌లోడ్", downloading: "డౌన్‌లోడ్ అవుతోంది…", trying: "ప్రయత్నిస్తోంది…", downloaded: "పూర్తయింది", error: "లోపం", failed: "విఫలమైంది", ariaDownload: "డౌన్‌లోడ్", titleQuick: "త్వరిత డౌన్‌లోడ్", comments: "వ్యాఖ్యలు", edited: "సవరించబడింది" },
    mr: { download: "डाउनलोड", downloading: "डाउनलोड होत आहे…", trying: "प्रयत्न करत आहे…", downloaded: "पूर्ण", error: "त्रुटी", failed: "अयशस्वी", ariaDownload: "डाउनलोड", titleQuick: "त्वरित डाउनलोड", comments: "टिप्पण्या", edited: "संपादित" },
    ta: { download: "பதிவிறக்கு", downloading: "பதிவிறக்குகிறது…", trying: "முயற்சிக்கிறது…", downloaded: "முடிந்தது", error: "பிழை", failed: "தோல்வி", ariaDownload: "பதிவிறக்கு", titleQuick: "விரைவு பதிவிறக்கம்", comments: "கருத்துகள்", edited: "திருத்தப்பட்டது" },
    ur: { download: "ڈاؤن لوڈ", downloading: "ڈاؤن لوڈ ہو رہا ہے…", trying: "کوشش جاری…", downloaded: "مکمل", error: "غلطی", failed: "ناکام", ariaDownload: "ڈاؤن لوڈ", titleQuick: "فوری ڈاؤن لوڈ", comments: "تبصرے", edited: "ترمیم شدہ" },
    gu: { download: "ડાઉનલોડ", downloading: "ડાઉનલોડ થઈ રહ્યું છે…", trying: "પ્રયાસ ચાલુ…", downloaded: "પૂર્ણ", error: "ભૂલ", failed: "નિષ્ફળ", ariaDownload: "ડાઉનલોડ", titleQuick: "ઝડપી ડાઉનલોડ", comments: "ટિપ્પણીઓ", edited: "સંપાદિત" },
    kn: { download: "ಡೌನ್‌ಲೋಡ್", downloading: "ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…", trying: "ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…", downloaded: "ಪೂರ್ಣಗೊಂಡಿದೆ", error: "ದೋಷ", failed: "ವಿಫಲವಾಗಿದೆ", ariaDownload: "ಡೌನ್‌ಲೋಡ್", titleQuick: "ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್", comments: "ಕಾಮೆಂಟ್‌ಗಳು", edited: "ಸಂಪಾದಿಸಲಾಗಿದೆ" },
    ml: { download: "ഡൗൺലോഡ്", downloading: "ഡൗൺലോഡ് ചെയ്യുന്നു…", trying: "ശ്രമിക്കുന്നു…", downloaded: "പൂർത്തിയായി", error: "പിശക്", failed: "പരാജയപ്പെട്ടു", ariaDownload: "ഡൗൺലോഡ്", titleQuick: "വേഗത്തിൽ ഡൗൺലോഡ്", comments: "അഭിപ്രായങ്ങൾ", edited: "എഡിറ്റുചെയ്തു" },
    uk: { download: "Завантажити", downloading: "Завантаження…", trying: "Спроба…", downloaded: "Готово", error: "Помилка", failed: "Невдача.", ariaDownload: "Завантажити", titleQuick: "Швидке завантаження", comments: "коментарів", edited: "Змінено" },
    el: { download: "Λήψη", downloading: "Λήψη…", trying: "Προσπάθεια…", downloaded: "Ολοκληρώθηκε", error: "Σφάλμα", failed: "Απέτυχε.", ariaDownload: "Λήψη", titleQuick: "Γρήγορη λήψη", comments: "σχόλια", edited: "Επεξεργασμένο" },
    cs: { download: "Stáhnout", downloading: "Stahování…", trying: "Zkouším…", downloaded: "Staženo", error: "Chyba", failed: "Selhalo.", ariaDownload: "Stáhnout", titleQuick: "Rychlé stažení", comments: "komentářů", edited: "Upraveno" },
    ro: { download: "Descărcați", downloading: "Se descarcă…", trying: "Se încearcă…", downloaded: "Finalizat", error: "Eroare", failed: "Eșuat.", ariaDownload: "Descărcați", titleQuick: "Descărcare rapidă", comments: "comentarii", edited: "Modificat" },
    hu: { download: "Letöltés", downloading: "Letöltés…", trying: "Próbálkozás…", downloaded: "Kész", error: "Hiba", failed: "Sikertelen.", ariaDownload: "Letöltés", titleQuick: "Gyors letöltés", comments: "megjegyzés", edited: "Szerkesztve" },
    sv: { download: "Ladda ner", downloading: "Laddar ner…", trying: "Försöker…", downloaded: "Klart", error: "Fel", failed: "Misslyckades.", ariaDownload: "Ladda ner", titleQuick: "Snabb nedladdning", comments: "kommentarer", edited: "Redigerad" },
    da: { download: "Hent", downloading: "Henter…", trying: "Prøver…", downloaded: "Hentet", error: "Fejl", failed: "Mislykkedes.", ariaDownload: "Hent", titleQuick: "Hurtig download", comments: "kommentarer", edited: "Redigeret" },
    fi: { download: "Lataa", downloading: "Ladataan…", trying: "Yritetään…", downloaded: "Ladattu", error: "Virhe", failed: "Epäonnistui.", ariaDownload: "Lataa", titleQuick: "Pikalataus", comments: "kommenttia", edited: "Muokattu" },
    no: { download: "Last ned", downloading: "Laster ned…", trying: "Prøver…", downloaded: "Ferdig", error: "Feil", failed: "Mislyktes.", ariaDownload: "Last ned", titleQuick: "Rask nedlasting", comments: "kommentarer", edited: "Redigert" },
    he: { download: "הורדה", downloading: "מוריד…", trying: "מנסה…", downloaded: "הושלם", error: "שגיאה", failed: "נכשל", ariaDownload: "הורדה", titleQuick: "הורדה מהירה", comments: "תגובות", edited: "נערך" },
    fa: { download: "دانلود", downloading: "درحال دانلود…", trying: "تلاش مجدد…", downloaded: "انجام شد", error: "خطا", failed: "ناموفق", ariaDownload: "دانلود", titleQuick: "دانلود سریع", comments: "نظر", edited: "ویرایش شده" },
    fil: { download: "I-download", downloading: "Nagda-download…", trying: "Sinusubukan…", downloaded: "Tapos na", error: "Error", failed: "Nabigo.", ariaDownload: "I-download", titleQuick: "Mabilis na download", comments: "mga komento", edited: "Na-edit" },
    ms: { download: "Muat turun", downloading: "Memuat turun…", trying: "Mencuba…", downloaded: "Selesai", error: "Ralat", failed: "Gagal.", ariaDownload: "Muat turun", titleQuick: "Muat turun pantas", comments: "komen", edited: "Diedit" },
    sr: { download: "Преузми", downloading: "Преузимање…", trying: "Покушавам…", downloaded: "Завршено", error: "Грешка", failed: "Неуспешно.", ariaDownload: "Преузми", titleQuick: "Брзо преузимање", comments: "коментара", edited: "Измењено" },
    sk: { download: "Stiahnuť", downloading: "Sťahovanie…", trying: "Skúšam…", downloaded: "Hotovo", error: "Chyba", failed: "Zlyhalo.", ariaDownload: "Stiahnuť", titleQuick: "Rýchle stiahnutie", comments: "komentárov", edited: "Upravené" },
    bg: { download: "Изтегли", downloading: "Изтегляне…", trying: "Опит…", downloaded: "Готово", error: "Грешка", failed: "Неуспешно.", ariaDownload: "Изтегли", titleQuick: "Бързо изтегляне", comments: "коментара", edited: "Редактирано" },
    hr: { download: "Preuzmi", downloading: "Preuzimanje…", trying: "Pokušavam…", downloaded: "Gotovo", error: "Greška", failed: "Neuspjelo.", ariaDownload: "Preuzmi", titleQuick: "Brzo preuzimanje", comments: "komentara", edited: "Uređeno" },
    lt: { download: "Atsisiųsti", downloading: "Siunčiama…", trying: "Bandoma…", downloaded: "Baigta", error: "Klaida", failed: "Nepavyko.", ariaDownload: "Atsisiųsti", titleQuick: "Greitas atsisiuntimas", comments: "komentarai", edited: "Redaguota" },
    lv: { download: "Lejupielādēt", downloading: "Lejupielādē…", trying: "Mēģina…", downloaded: "Pabeigts", error: "Kļūda", failed: "Neizdevās.", ariaDownload: "Lejupielādēt", titleQuick: "Ātrā lejupielāde", comments: "komentāri", edited: "Rediģēts" },
    et: { download: "Laadi alla", downloading: "Laadimine…", trying: "Proovin…", downloaded: "Valmis", error: "Viga", failed: "Ebaõnnestus.", ariaDownload: "Laadi alla", titleQuick: "Kiire allalaadimine", comments: "kommentaari", edited: "Muudetud" },
    sl: { download: "Prenos", downloading: "Prenašanje…", trying: "Poskušam…", downloaded: "Končano", error: "Napaka", failed: "Ni uspelo.", ariaDownload: "Prenos", titleQuick: "Hiter prenos", comments: "komentarjev", edited: "Urejeno" },
    ca: { download: "Descarrega", downloading: "Descarregant…", trying: "Intentant…", downloaded: "Descarregat", error: "Error", failed: "Ha fallat.", ariaDownload: "Descarrega", titleQuick: "Descàrrega ràpida", comments: "comentaris", edited: "Editat" },
    af: { download: "Aflaai", downloading: "Laai af…", trying: "Probeer…", downloaded: "Klaar", error: "Fout", failed: "Misluk.", ariaDownload: "Aflaai", titleQuick: "Vinnige aflaai", comments: "kommentare", edited: "Geredigeer" },
    am: { download: "አውርድ", downloading: "በማውረድ ላይ…", trying: "በመሞከር ላይ…", downloaded: "ወርዷል", error: "ስህተት", failed: "አልተሳካም።", ariaDownload: "አውርድ", titleQuick: "ፈጣን ማውረድ", comments: "አስተያየቶች", edited: "ተስተካክሏል" },
    hy: { download: "Ներբեռնել", downloading: "Ներբեռնում…", trying: "Փորձում է…", downloaded: "Ավարտված", error: "Սխալ", failed: "Ձախողվեց:", ariaDownload: "Ներբեռնել", titleQuick: "Արագ ներբեռնում", comments: "մեկնաբանություն", edited: "Խմբագրվել է" },
    as: { download: "ডাউন্লোড", downloading: "ডাউন্লোড হৈ আছে…", trying: "চেষ্টা কৰি আছে…", downloaded: "সম্পূৰ্ণ", error: "ত্ৰুটি", failed: "বিফল হ’ল", ariaDownload: "ডাউন্লোড", titleQuick: "দ্ৰুত ডাউন্লোড", comments: "মন্তব্য", edited: "সম্পাদিত" },
    az: { download: "Yüklə", downloading: "Yüklənir…", trying: "Cəhd edilir…", downloaded: "Bitdi", error: "Xəta", failed: "Alınmadı.", ariaDownload: "Yüklə", titleQuick: "Sürətli yükləmə", comments: "şərh", edited: "Düzəliş edilib" },
    eu: { download: "Deskargatu", downloading: "Deskargatzen…", trying: "Saiatzen…", downloaded: "Eginda", error: "Errorea", failed: "Huts egin du.", ariaDownload: "Deskargatu", titleQuick: "Deskarga azkarra", comments: "iruzkin", edited: "Editatua" },
    my: { download: "ဒေါင်းလုဒ်", downloading: "ဒေါင်းလုဒ် လုပ်နေ…", trying: "ကြိုးစားနေ…", downloaded: "ပြီးပါပြီ", error: "အမှား", failed: "မအောင်မြင်ပါ။", ariaDownload: "ဒေါင်းလုဒ်", titleQuick: "အမြန် ဒေါင်းလုဒ်", comments: "မှတ်ချက်များ", edited: "ပြင်ဆင်ပြီး" },
    gl: { download: "Descargar", downloading: "Descargando…", trying: "Tentando…", downloaded: "Descargado", error: "Erro", failed: "Fallou.", ariaDownload: "Descargar", titleQuick: "Descarga rápida", comments: "comentarios", edited: "Editado" },
    ka: { download: "ჩამოტვირთვა", downloading: "იწერება…", trying: "მცდელობა…", downloaded: "დასრულდა", error: "შეცდომა", failed: "ვერ მოხერხდა.", ariaDownload: "ჩამოტვირთვა", titleQuick: "სწრაფი ჩამოტვირთვა", comments: "კომენტარი", edited: "რედაქტირებულია" },
    is: { download: "Sækja", downloading: "Sækir…", trying: "Reyni…", downloaded: "Sótt", error: "Villa", failed: "Mistókst.", ariaDownload: "Sækja", titleQuick: "Flýtiniðurhal", comments: "ummæli", edited: "Breytt" },
    ga: { download: "Íoslódáil", downloading: "Ag íoslódáil…", trying: "Ag iarraidh…", downloaded: "Íoslódáilte", error: "Earráid", failed: "Theip air.", ariaDownload: "Íoslódáil", titleQuick: "Íoslódáil tapa", comments: "trácht", edited: "Eagraithe" },
    kk: { download: "Жүктеп алу", downloading: "Жүктелуде…", trying: "Әрекет…", downloaded: "Аяқталды", error: "Қате", failed: "Сәтсіз.", ariaDownload: "Жүктеп алу", titleQuick: "Жылдам жүктеу", comments: "пікір", edited: "Өзгертілді" },
    km: { download: "ទាញយក", downloading: "កំពុងទាញយក…", trying: "កំពុងព្យាយាម…", downloaded: "បានបញ្ចប់", error: "កំហុស", failed: "បរាជ័យ", ariaDownload: "ទាញយក", titleQuick: "ទាញយកលឿន", comments: "មតិ", edited: "បានកែសម្រួល" },
    lo: { download: "ດາວໂຫລດ", downloading: "ກຳລັງດາວໂຫລດ…", trying: "ກຳລັງພະຍາຍາມ…", downloaded: "ສຳເລັດ", error: "ຜິດພາດ", failed: "ລົ້ມເຫລວ", ariaDownload: "ດາວໂຫລດ", titleQuick: "ດາວໂຫລດດ່ວນ", comments: "ຄຳເຫັນ", edited: "ແກ້ໄຂແລ້ວ" },
    mk: { download: "Преземи", downloading: "Преземање…", trying: "Се обидувам…", downloaded: "Готово", error: "Грешка", failed: "Неуспешно.", ariaDownload: "Преземи", titleQuick: "Брзо преземање", comments: "коментари", edited: "Изменето" },
    mn: { download: "Татах", downloading: "Татаж байна…", trying: "Орлдож байна…", downloaded: "Татсан", error: "Алдаа", failed: "Амжилтгүй.", ariaDownload: "Татах", titleQuick: "Хурдан татах", comments: "сэтгэгдэл", edited: "Зассан" },
    ne: { download: "डाउनलोड", downloading: "डाउनलोड हुँदै…", trying: "प्रयास गर्दै…", downloaded: "पूरा भयो", error: "त्रुटि", failed: "असफल भयो", ariaDownload: "डाउनलोड", titleQuick: "छिटो डाउनलोड", comments: "टिप्पणीहरू", edited: "सम्पादित" },
    or: { download: "ଡାଉନଲୋଡ୍", downloading: "ଡାଉନଲୋଡ୍ ହେଉଛି…", trying: "ଚେଷ୍ଟା କରୁଛି…", downloaded: "ସମ୍ପୂର୍ଣ୍ଣ", error: "ତ୍ରୁଟି", failed: "ବିଫଳ ହେଲା", ariaDownload: "ଡାଉନଲୋଡ୍", titleQuick: "ଶୀଘ୍ର ଡାଉନଲୋଡ୍", comments: "ମନ୍ତବ୍ୟ", edited: "ସମ୍ପାଦିତ" },
    si: { download: "බාගන්න", downloading: "බාගත වෙමින්…", trying: "උත්සාහ කරමින්…", downloaded: "අවසන්", error: "දෝෂයකි", failed: "අසාර්ථකයි", ariaDownload: "බාගන්න", titleQuick: "ඉක්මන් බාගත කිරීම", comments: "අදහස්", edited: "සංස්කරණය" },
    sw: { download: "Pakua", downloading: "Inapakua…", trying: "Inajaribu…", downloaded: "Imekamilika", error: "Hitilafu", failed: "Imeshindwa.", ariaDownload: "Pakua", titleQuick: "Pakua haraka", comments: "maoni", edited: "Imehaririwa" },
    uz: { download: "Yuklash", downloading: "Yuklanmoqda…", trying: "Urinilmoqda…", downloaded: "Tayyor", error: "Xato", failed: "Muvaffaqiyatsiz.", ariaDownload: "Yuklash", titleQuick: "Tez yuklash", comments: "sharhlar", edited: "Tahrirlangan" },
    cy: { download: "Lawrlwytho", downloading: "Yn lawrlwytho…", trying: "Yn ceisio…", downloaded: "Wedi gorffen", error: "Gwall", failed: "Methodd.", ariaDownload: "Lawrlwytho", titleQuick: "Lawrlwytho cyflym", comments: "sylwadau", edited: "Golygwyd" },
    zu: { download: "Landa", downloading: "Iyalandwa…", trying: "Iyazama…", downloaded: "Ilandīwe", error: "Iphutha", failed: "Ihlulekile.", ariaDownload: "Landa", titleQuick: "Ukulanda okusheshayo", comments: "amazwana", edited: "Kuhleliwe" },
    sq: { download: "Shkarko", downloading: "Duke shkarkuar…", trying: "Duke provuar…", downloaded: "Përfundoi", error: "Gabim", failed: "Dështoi.", ariaDownload: "Shkarko", titleQuick: "Shkarkim i shpejtë", comments: "komente", edited: "E redaktuar" }
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
    } catch (e) {
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
      }, 1e3);
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
            let sourceText = text;
            if (sourceText.length < 5 || !sourceText.toLowerCase().includes(editedWord)) {
              sourceText = aria || title || text;
            }
            diffText = calculateEditDiff(sourceText, editedWord) ?? "+0";
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
  function calculateEditDiff(fullText, _keyword) {
    try {
      const monthRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/gi;
      const matches = fullText.match(monthRegex);
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      if (!matches || matches.length === 0) {
        return null;
      }
      const parseDate = (s) => {
        const d = /* @__PURE__ */ new Date(`${s.trim()} ${currentYear}`);
        return isNaN(d.getTime()) ? null : d;
      };
      let createdDate = null;
      let editedDate = null;
      if (matches.length >= 2) {
        createdDate = parseDate(matches[0]);
        editedDate = parseDate(matches[1]);
      } else {
        createdDate = parseDate(matches[0]);
        editedDate = createdDate;
      }
      if (!createdDate || !editedDate) return null;
      let diffDays = Math.floor(
        (editedDate.getTime() - createdDate.getTime()) / (1e3 * 60 * 60 * 24)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdGVkX2ZyYW1lLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaWNvbnMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9lZGl0ZWRfZnJhbWUuY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcbmltcG9ydCB7IERPV05MT0FEX0lDT05fU1ZHX1VSTCB9IGZyb20gJy4vaWNvbnMnO1xuXG5jb25zdCBTVFlMRV9JRCA9ICdjcWQtc3R5bGUnO1xuY29uc3QgU1BJTk5FUl9TSVpFX1BYID0gMTY7XG5cbi8vIFNtb290aCwgc2xpZ2h0bHkgYm91bmN5IHRyYW5zaXRpb24gZm9yIHRoZSBcIkRyb3BcIiBmZWVsXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG5cbiAgICAgIC8qIFNwaW5uZXIgKExpZ2h0IHRoZW1lIGRlZmF1bHRzKSAqL1xuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7IC8qIGRhcmstaXNoIHJpbmcgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjMGYxNzJhOyAgICAgICAgICAgICAgICAgICAvKiBzb2xpZCBkYXJrIHRpcCAqL1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAmIFNIQURPV1MgKExpZ2h0IE1vZGUgLyBEZWZhdWx0KVxuICAgICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAgIFxuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIExpZ2h0OiAjMDA1REQ3ICovXG4gICAgICAtLWNxZC1jb2xvci1ub3JtYWw6ICMwMDVERDc7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsOiAwIDhweCAyMnB4IHJnYmEoMCwgOTMsIDIxNSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCA5MywgMjE1LCAwLjcwKTtcblxuICAgICAgLyogMi4gU3VjY2VzcyAtIExpZ2h0OiAjMDBBODJEICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDBBODJEO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gTGlnaHQ6ICNGRjQwMzYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWVycm9yOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuXG4gICAgICAvKiA0LiBUcnlpbmcgLSBMaWdodDogI0VDNjMwMCAqL1xuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRUM2MzAwO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNzApO1xuXG4gICAgICAvKiA1LiBDb21tZW50IEZyYW1lIC0gTGlnaHQ6ICM5QjAwRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICBcbiAgICAgIC8qIDYuIEVkaXRlZCBGcmFtZSAtIExpZ2h0OiAjMDA3RjhEICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMDdGOEQ7XG5cbiAgICAgIC8qIEJhc2UgU2hhZG93cyAqL1xuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcblxuICAgICAgLyogNy4gQk9USCAoRWRpdGVkICsgQ29tbWVudHMpIC0gTGlnaHQgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICAtLWNxZC1ib3RoLW92ZXJsYXktc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBEQVJLIE1PREUgT1ZFUlJJREVTIChBcHBsaWVkIHZpYSAuY3FkLXRoZW1lLWRhcmsgY2xhc3MpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLXRoZW1lLWRhcmsge1xuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIERhcms6ICMwMDZFRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC8qIDIuIFN1Y2Nlc3MgLSBEYXJrOiAjMDdEQTNGICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDdEQTNGO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gRGFyazogI0ZGNDAzNiAqL1xuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC8qIDQuIFRyeWluZyAtIERhcms6ICNGRjkxNDIgKi9cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC8qIDUuIENvbW1lbnQgRnJhbWUgLSBEYXJrOiAjOUIwMEZGICovXG4gICAgICAtLWNxZC1jb2xvci1jb21tZW50OiAjOUIwMEZGO1xuXG4gICAgICAvKiA2LiBFZGl0ZWQgRnJhbWUgLSBEYXJrOiAjMDBENkVFICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC8qIDcuIEJPVEggKEVkaXRlZCArIENvbW1lbnRzKSAtIERhcmsgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNmZmZmZmY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjMDAwMDAwO1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjg1KTtcbiAgICAgIC0tY3FkLWJvdGgtb3ZlcmxheS1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjZmZmZmZmLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuXG4gICAgICAvKiBTcGlubmVyIChEYXJrIHRoZW1lIG92ZXJyaWRlcykgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICNmZmZmZmY7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogQ1JJVElDQUwgT1ZFUlJJREVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gU1RZTEVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogNTAlO1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIHdpZHRoOiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiBjYWxjKDEwMCUgLSAxNnB4KTtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1iYXNlKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgd2lsbC1jaGFuZ2U6IHRyYW5zZm9ybSwgYm94LXNoYWRvdywgd2lkdGgsIGJvcmRlci1yYWRpdXMsIHBhZGRpbmctaW5saW5lO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBwYWRkaW5nLWlubGluZSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJvcmRlci1yYWRpdXMgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgdHJhbnNmb3JtIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLyogU3RhdGVzICovXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIge1xuICAgICAgd2lkdGg6IDEyMHB4O1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWhvdmVyKTtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46Zm9jdXMtdmlzaWJsZSB7XG4gICAgICBvdXRsaW5lOiAycHggc29saWQgI2ZmZmZmZjtcbiAgICAgIG91dGxpbmUtb2Zmc2V0OiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAvKiBJY29ucyAmIExhYmVscyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLyogUGlsbCBTdGF0ZXMgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC8qIFN1Y2Nlc3MgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC8qIEVycm9yICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAvKiBTcGlubmVyICovXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7XG4gICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgIHRvICAgeyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVCBGUkFNRSAmIEJBREdFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuICAgIFxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMy4gRURJVEVEIEZSQU1FICYgUElMTFxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICBcbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuICAgIFxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjsgXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiA0LiBCT1RIIFNUQVRFIChFZGl0ZWQgKyBDb21tZW50cyDihpIgT05FIHBpbGwpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLyogV2hlbiBhIHBvc3QgaGFzIGJvdGggZGF0YS1jcWQtcHJvY2Vzc2VkIGFuZCBkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkLFxuICAgICAgIGdpdmUgdGhlIGZyYW1lIGEgZGFya2VyIG91dGxpbmUvZ2xvdyBzbyBpdCBmZWVscyBzcGVjaWFsICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdW2RhdGEtY3FkLXByb2Nlc3NlZF1bZGF0YS1jcWQtZWRpdGVkLXByb2Nlc3NlZF0gPiAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjRkY0MDM2LFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDcwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkY0MDM2O1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBwYWRkaW5nLXRvcDogOHB4O1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXNlY3Rpb24ge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24ge1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgLyogbm8gZmlsdGVyIHNvIHRoZSBhc3NldCBzdGF5cyBjcmlzcCBpbiBhbGwgdGhlbWVzICovXG4gICAgfVxuXG4gICAgLyogRWRpdGVkIGljb24gKFNWRykgdXNlcyBjdXJyZW50Q29sb3IgKHdoaXRlKSAqL1xuICAgIC5jcWQtYm90aC1pY29uLWVkaXRlZCBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAvKiBUaGUgXCIrXCIgYmV0d2VlbiBpY29ucyAoYWx3YXlzIHZpc2libGUpICovXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC90aGVtZS50c1xuXG4vKipcbiAqIFRIRU1FIERFVEVDVE9SXG4gKlxuICogR29hbDogXCJJcyB0aGUgY29udGVudCBJJ20gZHJhd2luZyBvbiB2aXN1YWxseSBkYXJrIG9yIGxpZ2h0P1wiXG4gKiBJbnN0ZWFkIG9mIGd1ZXNzaW5nIGZyb20gPGJvZHk+LCB3ZTpcbiAqICAtIFJlc3BlY3QgRGFyayBSZWFkZXIgaWYgcHJlc2VudFxuICogIC0gTG9vayBmb3Igb2J2aW91cyBcImRhcmsgbW9kZVwiIGNsYXNzZXNcbiAqICAtIE1lYXN1cmUgdGhlIGVmZmVjdGl2ZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIGEgKmNvbnRlbnQqIGVsZW1lbnRcbiAqICAgIChlLmcuIEdvb2dsZSBDbGFzc3Jvb20gc3RyZWFtIGNhcmRzKVxuICovXG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBwYWdlICpjb250ZW50IGFyZWEqIGlzIHZpc3VhbGx5IGRhcmsuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1BhZ2VEYXJrKCk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIDEuIEZhc3QgcGF0aDogRGFyayBSZWFkZXIgYXR0cmlidXRlXG4gIGNvbnN0IGRyU2NoZW1lID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1kYXJrcmVhZGVyLXNjaGVtZScpO1xuICBpZiAoZHJTY2hlbWUgPT09ICdkYXJrJykgcmV0dXJuIHRydWU7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2xpZ2h0JykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIDIuIEhldXJpc3RpYzogb2J2aW91cyBcImRhcmsgbW9kZVwiIGNsYXNzZXMgb24gPGh0bWw+IC8gPGJvZHk+XG4gIC8vIChjb3ZlcnMgc29tZSBmcmFtZXdvcmtzIGFuZCBleHRlbnNpb25zKVxuICBjb25zdCBkYXJrVG9rZW5zID0gWydkYXJrJywgJ2RhcmstdGhlbWUnLCAndGhlbWUtZGFyaycsICduaWdodCcsICdnbTMtZGFyay10aGVtZSddO1xuICBjb25zdCBodG1sQ2xhc3MgPSAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgYm9keUNsYXNzID0gKGRvY3VtZW50LmJvZHkuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoZGFya1Rva2Vucy5zb21lKHRva2VuID0+IGh0bWxDbGFzcy5pbmNsdWRlcyh0b2tlbikgfHwgYm9keUNsYXNzLmluY2x1ZGVzKHRva2VuKSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIDMuIFByb2JlIGEgKmNvbnRlbnQqIGVsZW1lbnQsIG5vdCB0aGUgd2hvbGUgcGFnZSBiYWNrZ3JvdW5kLlxuICAvLyAgICBGb3IgQ2xhc3Nyb29tLCBwb3N0cyBhcmUgdGhlIG1haW4gc3VyZmFjZSB3ZSBkcmF3IG9uLlxuICBjb25zdCBwcm9iZUVsID1cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJykgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignW3JvbGU9XCJtYWluXCJdJykgfHxcbiAgICBkb2N1bWVudC5ib2R5O1xuXG4gIGNvbnN0IGJnQ29sb3IgPSBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3IocHJvYmVFbCk7XG4gIGNvbnN0IGJyaWdodG5lc3MgPSBwYXJzZUJyaWdodG5lc3MoYmdDb2xvcik7XG5cbiAgLy8gNC4gRGVjaWRlIHRocmVzaG9sZC5cbiAgLy8gICAgMTI4IGlzIFwiNTAlIGdyYXlcIiwgYnV0IHRoYXQgZmxpcHMgdG9vIGVhcmx5IG9uIHNsaWdodGx5IGdyYXkgVUlzLlxuICAvLyAgICBVc2UgYSBzdHJpY3RlciB0aHJlc2hvbGQgc28gd2Ugb25seSB0cmVhdCBjbGVhcmx5IGRhcmsgVUlzIGFzIGRhcmsuXG4gIHJldHVybiBicmlnaHRuZXNzIDwgMTA1O1xufVxuXG4vKipcbiAqIFdhbGtzIHVwIHRoZSBET00gZnJvbSBhIGdpdmVuIGVsZW1lbnQgdW50aWwgaXQgZmluZHMgYSBub24tdHJhbnNwYXJlbnQgYmFja2dyb3VuZCBjb2xvci5cbiAqIEZhbGxzIGJhY2sgdG8gPGh0bWw+IGFuZCBmaW5hbGx5IHRvIHB1cmUgd2hpdGUuXG4gKi9cbmZ1bmN0aW9uIGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihzdGFydDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICBsZXQgZWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IHN0YXJ0O1xuXG4gIGNvbnN0IGlzVHJhbnNwYXJlbnQgPSAoYzogc3RyaW5nIHwgbnVsbCkgPT5cbiAgICAhYyB8fCBjID09PSAndHJhbnNwYXJlbnQnIHx8IGMgPT09ICdyZ2JhKDAsIDAsIDAsIDApJztcblxuICB3aGlsZSAoZWwpIHtcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICBjb25zdCBiZyA9IHN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgICBpZiAoIWlzVHJhbnNwYXJlbnQoYmcpKSByZXR1cm4gYmc7XG4gICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICB9XG5cbiAgLy8gVHJ5IDxodG1sPiBhcyBhIGxhc3QgcmVhbCBlbGVtZW50XG4gIGNvbnN0IGh0bWxTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCk7XG4gIGNvbnN0IGh0bWxCZyA9IGh0bWxTdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gIGlmICghaXNUcmFuc3BhcmVudChodG1sQmcpKSByZXR1cm4gaHRtbEJnO1xuXG4gIC8vIEFic29sdXRlIGZhbGxiYWNrOiBhc3N1bWUgd2hpdGVcbiAgcmV0dXJuICdyZ2IoMjU1LCAyNTUsIDI1NSknO1xufVxuXG4vKipcbiAqIEhlbHBlcjogQ2FsY3VsYXRlcyBicmlnaHRuZXNzICgwLTI1NSkgZnJvbSBhbiBSR0IoQSkgc3RyaW5nLlxuICogVXNlcyB0aGUgSFNQIGNvbG9yIGZvcm11bGE6IHNxcnQoMC4yOTkqUl4yICsgMC41ODcqR14yICsgMC4xMTQqQl4yKVxuICovXG5mdW5jdGlvbiBwYXJzZUJyaWdodG5lc3MocmdiU3RyaW5nOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBtYXRjaCA9IHJnYlN0cmluZy5tYXRjaCgvKFxcZCspLFxccyooXFxkKyksXFxzKihcXGQrKS8pO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgLy8gSWYgd2UgY2FuJ3QgcGFyc2UgaXQsIGFzc3VtZSBicmlnaHQgc28gd2UgZG9uJ3QgYWNjaWRlbnRhbGx5IGZsaXAgdG8gZGFyayBtb2RlLlxuICAgIHJldHVybiAyNTU7XG4gIH1cblxuICBjb25zdCByID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgY29uc3QgZyA9IHBhcnNlSW50KG1hdGNoWzJdLCAxMCk7XG4gIGNvbnN0IGIgPSBwYXJzZUludChtYXRjaFszXSwgMTApO1xuXG4gIC8vIEhTUCBlcXVhdGlvbiBpcyBwZXJjZWl2ZWQgYnJpZ2h0bmVzc1xuICBjb25zdCBicmlnaHRuZXNzID0gTWF0aC5zcXJ0KFxuICAgIDAuMjk5ICogKHIgKiByKSArXG4gICAgMC41ODcgKiAoZyAqIGcpICtcbiAgICAwLjExNCAqIChiICogYilcbiAgKTtcblxuICByZXR1cm4gYnJpZ2h0bmVzcztcbn1cblxuLyoqXG4gKiBXYXRjaGVyOiBOb3RpZmllcyB5b3Ugd2hlbiB0aGUgdGhlbWUgbGlrZWx5IGNoYW5nZWQuXG4gKlxuICogWW91IGNhbiB1c2UgdGhpcyBpZiB5b3UgZXZlciB3YW50IHRvIGR5bmFtaWNhbGx5IHJlLXN0eWxlIHRoaW5nc1xuICogd2hlbiB0aGUgdXNlciAvIGV4dGVuc2lvbiB0b2dnbGVzIHRoZW1lLlxuICovXG5leHBvcnQgZnVuY3Rpb24gd2F0Y2hUaGVtZUNoYW5nZXMoY2FsbGJhY2s6IChpc0Rhcms6IGJvb2xlYW4pID0+IHZvaWQpOiBNdXRhdGlvbk9ic2VydmVyIHtcbiAgY29uc3QgaGFuZGxlciA9ICgpID0+IHtcbiAgICBjYWxsYmFjayhpc1BhZ2VEYXJrKCkpO1xuICB9O1xuXG4gIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoaGFuZGxlcik7XG5cbiAgLy8gV2F0Y2ggZm9yIGF0dHJpYnV0ZS9jbGFzcyBjaGFuZ2VzIG9uIDxodG1sPiBhbmQgPGJvZHk+XG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS1kYXJrcmVhZGVyLXNjaGVtZScsICdzdHlsZScsICdjbGFzcyddLFxuICB9KTtcblxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydzdHlsZScsICdjbGFzcyddLFxuICB9KTtcblxuICAvLyBBbHNvIGxpc3RlbiB0byBzeXN0ZW0gdGhlbWUgY2hhbmdlcyBhcyBhIGJhY2t1cCBzaWduYWxcbiAgaWYgKHR5cGVvZiB3aW5kb3cubWF0Y2hNZWRpYSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnN0IG1xID0gd2luZG93Lm1hdGNoTWVkaWEoJyhwcmVmZXJzLWNvbG9yLXNjaGVtZTogZGFyayknKTtcbiAgICBpZiAobXEpIHtcbiAgICAgIGNvbnN0IG1xTGlzdGVuZXIgPSAoKSA9PiBoYW5kbGVyKCk7XG4gICAgICAvLyBNb2Rlcm4gYnJvd3NlcnNcbiAgICAgIGlmICgobXEgYXMgYW55KS5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIG1xLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG1xTGlzdGVuZXIpO1xuICAgICAgfSBlbHNlIGlmICgobXEgYXMgYW55KS5hZGRMaXN0ZW5lcikge1xuICAgICAgICAvLyBMZWdhY3kgQVBJXG4gICAgICAgIChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKG1xTGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEluaXRpYWwgY2FsbCBzbyB0aGUgY29uc3VtZXIgY2FuIHN5bmMgaW1tZWRpYXRlbHlcbiAgaGFuZGxlcigpO1xuXG4gIHJldHVybiBvYnNlcnZlcjtcbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHNcblxuLyoqXG4gKiBTSEFSRUQgRElDVElPTkFSWSAtIDc1IExBTkdVQUdFU1xuICogTm93IGluY2x1ZGVzIHRoZSAnZWRpdGVkJyBrZXl3b3JkIGZvciBkZXRlY3Rpb24uXG4gKi9cblxuY29uc3QgVFJBTlNMQVRJT05TOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICBlbjogeyBkb3dubG9hZDogJ0Rvd25sb2FkJywgZG93bmxvYWRpbmc6ICdEb3dubG9hZGluZ+KApicsIHRyeWluZzogJ1RyeWluZ+KApicsIGRvd25sb2FkZWQ6ICdEb3dubG9hZGVkJywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ0Rvd25sb2FkIGZhaWxlZC4nLCBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsIHRpdGxlUXVpY2s6ICdRdWljayBkb3dubG9hZCcsIGNvbW1lbnRzOiAnY29tbWVudHMnLCBlZGl0ZWQ6ICdFZGl0ZWQnIH0sXG4gIGFyOiB7IGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsIGRvd25sb2FkaW5nOiAn2KzYp9ix2Yog2KfZhNiq2YbYstmK2YTigKYnLCB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLCBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsIGVycm9yOiAn2K7Yt9ijJywgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLCB0aXRsZVF1aWNrOiAn2KrZhtiy2YrZhCDYs9ix2YrYuScsIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLCBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyB9LFxuICBqYTogeyBkb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLCB0cnlpbmc6ICfoqabooYzkuK3igKYnLCBkb3dubG9hZGVkOiAn5a6M5LqGJywgZXJyb3I6ICfjgqjjg6njg7wnLCBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLCBhcmlhRG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLCB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJywgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLCBlZGl0ZWQ6ICfnt6jpm4bmuIjjgb8nIH0sXG4gIGVzOiB7IGRvd25sb2FkOiAnRGVzY2FyZ2FyJywgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsIHRyeWluZzogJ0ludGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJywgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJywgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgaGk6IHsgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLCBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcgfSxcbiAgcHQ6IHsgZG93bmxvYWQ6ICdCYWl4YXInLCBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJywgdHJ5aW5nOiAnVGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnQmFpeGFkbycsIGVycm9yOiAnRXJybycsIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLCBhcmlhRG93bmxvYWQ6ICdCYWl4YXInLCB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3B0LXB0JzogeyBkb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJywgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJywgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLCBkb3dubG9hZGVkOiAnRGVzY2FycmVnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJywgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYXInLCB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3poLWNuJzogeyBkb3dubG9hZDogJ+S4i+i9vScsIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJywgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJywgZG93bmxvYWRlZDogJ+W3suS4i+i9vScsIGVycm9yOiAn6ZSZ6K+vJywgZmFpbGVkOiAn5LiL6L295aSx6LSlJywgYXJpYURvd25sb2FkOiAn5LiL6L29JywgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsIGNvbW1lbnRzOiAn5p2h6K+E6K66JywgZWRpdGVkOiAn5bey57yW6L6RJyB9LFxuICAnemgtdHcnOiB7IGRvd25sb2FkOiAn5LiL6LyJJywgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLCB0cnlpbmc6ICflmJfoqabkuK3igKYnLCBkb3dubG9hZGVkOiAn5bey5LiL6LyJJywgZXJyb3I6ICfpjK/oqqQnLCBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLCBhcmlhRG93bmxvYWQ6ICfkuIvovIknLCB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJywgY29tbWVudHM6ICfliYfnlZnoqIAnLCBlZGl0ZWQ6ICflt7Lnt6jovK8nIH0sXG4gIGZyOiB7IGRvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsIHRyeWluZzogJ0Vzc2Fp4oCmJywgZG93bmxvYWRlZDogJ1TDqWzDqWNoYXJnw6knLCBlcnJvcjogJ0VycmV1cicsIGZhaWxlZDogJ8OJY2hlYy4nLCBhcmlhRG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJywgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJywgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLCBlZGl0ZWQ6ICdNb2RpZmnDqScgfSxcbiAgZGU6IHsgZG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJywgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsIGRvd25sb2FkZWQ6ICdGZXJ0aWcnLCBlcnJvcjogJ0ZlaGxlcicsIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsIGFyaWFEb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLCB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJywgY29tbWVudHM6ICdLb21tZW50YXJlJywgZWRpdGVkOiAnQmVhcmJlaXRldCcgfSxcbiAgaXQ6IHsgZG93bmxvYWQ6ICdTY2FyaWNhJywgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLCB0cnlpbmc6ICdQcm92YW5kb+KApicsIGRvd25sb2FkZWQ6ICdTY2FyaWNhdG8nLCBlcnJvcjogJ0Vycm9yZScsIGZhaWxlZDogJ0ZhbGxpdG8uJywgYXJpYURvd25sb2FkOiAnU2NhcmljYScsIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLCBjb21tZW50czogJ2NvbW1lbnRpJywgZWRpdGVkOiAnTW9kaWZpY2F0bycgfSxcbiAgcnU6IHsgZG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLCB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsIGRvd25sb2FkZWQ6ICfQodC60LDRh9Cw0L3QvicsIGVycm9yOiAn0J7RiNC40LHQutCwJywgZmFpbGVkOiAn0KHQsdC+0LkuJywgYXJpYURvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLCB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLCBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsIGVkaXRlZDogJ9CY0LfQvNC10L3QtdC90L4nIH0sXG4gIGtvOiB7IGRvd25sb2FkOiAn64uk7Jq066Gc65OcJywgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJywgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsIGRvd25sb2FkZWQ6ICfsmYTro4wnLCBlcnJvcjogJ+yYpOulmCcsIGZhaWxlZDogJ+yLpO2MqO2VqCcsIGFyaWFEb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJywgY29tbWVudHM6ICfqsJwg64yT6riAJywgZWRpdGVkOiAn7IiY7KCV65CoJyB9LFxuICB0cjogeyBkb3dubG9hZDogJ8SwbmRpcicsIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJywgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJywgZG93bmxvYWRlZDogJ8SwbmRpcmlsZGknLCBlcnJvcjogJ0hhdGEnLCBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJywgYXJpYURvd25sb2FkOiAnxLBuZGlyJywgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLCBjb21tZW50czogJ3lvcnVtJywgZWRpdGVkOiAnRMO8emVubGVuZGknIH0sXG4gIHZpOiB7IGRvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLCB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsIGRvd25sb2FkZWQ6ICfEkMOjIHThuqNpJywgZXJyb3I6ICdM4buXaScsIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLCBhcmlhRG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJywgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLCBjb21tZW50czogJ25o4bqtbiB4w6l0JywgZWRpdGVkOiAnxJDDoyBjaOG7iW5oIHPhu61hJyB9LFxuICBpZDogeyBkb3dubG9hZDogJ0Rvd25sb2FkJywgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLCB0cnlpbmc6ICdNZW5jb2Jh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ0tlc2FsYWhhbicsIGZhaWxlZDogJ0dhZ2FsLicsIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJywgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JywgY29tbWVudHM6ICdrb21lbnRhcicsIGVkaXRlZDogJ0RpZWRpdCcgfSxcbiAgdGg6IHsgZG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLCBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsIGRvd25sb2FkZWQ6ICfguYDguKrguKPguYfguIjguKrguLTguYnguJknLCBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsIGFyaWFEb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLCBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsIGVkaXRlZDogJ+C5geC4geC5ieC5hOC4guC5geC4peC5ieC4pycgfSxcbiAgcGw6IHsgZG93bmxvYWQ6ICdQb2JpZXJ6JywgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJywgdHJ5aW5nOiAnUHLDs2Jh4oCmJywgZG93bmxvYWRlZDogJ1BvYnJhbm8nLCBlcnJvcjogJ0LFgsSFZCcsIGZhaWxlZDogJ05pZXVkYW5lLicsIGFyaWFEb3dubG9hZDogJ1BvYmllcnonLCB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJywgY29tbWVudHM6ICdrb21lbnRhcnplJywgZWRpdGVkOiAnRWR5dG93YW5vJyB9LFxuICBubDogeyBkb3dubG9hZDogJ0Rvd25sb2FkZW4nLCBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLCB0cnlpbmc6ICdQcm9iZXJlbuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1a3QuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWRlbicsIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLCBjb21tZW50czogJ3JlYWN0aWVzJywgZWRpdGVkOiAnQmV3ZXJrdCcgfSxcbiAgYm46IHsgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLCBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLCB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCmqOCnjeCmqCcsIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJywgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJywgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyB9LFxuICBwYTogeyBkb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLCB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJywgZG93bmxvYWRlZDogJ+CoruCpgeColeCpsOCoruCosicsIGVycm9yOiAn4KiX4Kiy4Kik4KmAJywgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJywgYXJpYURvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJywgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLCBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsIGVkaXRlZDogJ+CouOCpsOCoquCovuCopuCov+CopCcgfSxcbiAgdGU6IHsgZG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLCB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLCBkb3dubG9hZGVkOiAn4LCq4LGC4LCw4LGN4LCk4LCv4LC/4LCC4LCm4LC/JywgZXJyb3I6ICfgsLLgsYvgsKrgsIInLCBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLCBhcmlhRG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJywgZWRpdGVkOiAn4LC44LC14LCw4LC/4LCC4LCa4LCs4LCh4LC/4LCC4LCm4LC/JyB9LFxuICBtcjogeyBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLCB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLCBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLCBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnIH0sXG4gIHRhOiB7IGRvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJywgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4HgrpXgrr/grrHgrqTgr4HigKYnLCB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLCBkb3dubG9hZGVkOiAn4K6u4K+B4K6f4K6/4K6o4K+N4K6k4K6k4K+BJywgZXJyb3I6ICfgrqrgrr/grrTgr4gnLCBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLCBhcmlhRG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLCB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJywgZWRpdGVkOiAn4K6k4K6/4K6w4K+B4K6k4K+N4K6k4K6q4K+N4K6q4K6f4K+N4K6f4K6k4K+BJyB9LFxuICB1cjogeyBkb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLCB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsIGRvd25sb2FkZWQ6ICfZhdqp2YXZhCcsIGVycm9yOiAn2LrZhNi324wnLCBmYWlsZWQ6ICfZhtin2qnYp9mFJywgYXJpYURvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJywgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsIGVkaXRlZDogJ9iq2LHZhduM2YUg2LTYr9uBJyB9LFxuICBndTogeyBkb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJywgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsIGRvd25sb2FkZWQ6ICfgqqrgq4LgqrDgq43gqqMnLCBlcnJvcjogJ+CqreCrguCqsicsIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsIGFyaWFEb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJywgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLCBlZGl0ZWQ6ICfgqrjgqoLgqqrgqr7gqqbgqr/gqqQnIH0sXG4gIGtuOiB7IGRvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgZG93bmxvYWRlZDogJ+CyquCzguCysOCzjeCyo+Cyl+CziuCyguCyoeCyv+CypuCzhicsIGVycm9yOiAn4LKm4LOL4LK3JywgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJywgYXJpYURvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLCBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsIGVkaXRlZDogJ+CyuOCyguCyquCyvuCypuCyv+CyuOCysuCyvuCyl+Cyv+CypuCzhicgfSxcbiAgbWw6IHsgZG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLCB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLCBkb3dubG9hZGVkOiAn4LSq4LWC4LW84LSk4LWN4LSk4LS/4LSv4LS+4LSv4LS/JywgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLCBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLCBhcmlhRG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JywgZWRpdGVkOiAn4LSO4LSh4LS/4LSx4LWN4LSx4LWB4LSa4LWG4LSv4LWN4LSk4LWBJyB9LFxuICB1azogeyBkb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLCBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLCBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJywgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJywgYXJpYURvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsIGVkaXRlZDogJ9CX0LzRltC90LXQvdC+JyB9LFxuICBlbDogeyBkb3dubG9hZDogJ86bzq7PiM63JywgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJywgZG93bmxvYWRlZDogJ86fzrvOv866zrvOt8+Bz47OuM63zrrOtScsIGVycm9yOiAnzqPPhs6szrvOvM6xJywgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJywgYXJpYURvd25sb2FkOiAnzpvOrs+IzrcnLCB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLCBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsIGVkaXRlZDogJ86Vz4DOtc6+zrXPgc6zzrHPg868zq3Ovc6/JyB9LFxuICBjczogeyBkb3dubG9hZDogJ1N0w6Fobm91dCcsIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLCB0cnlpbmc6ICdaa291xaHDrW3igKYnLCBkb3dubG9hZGVkOiAnU3Rhxb5lbm8nLCBlcnJvcjogJ0NoeWJhJywgZmFpbGVkOiAnU2VsaGFsby4nLCBhcmlhRG93bmxvYWQ6ICdTdMOhaG5vdXQnLCB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLCBjb21tZW50czogJ2tvbWVudMOhxZnFrycsIGVkaXRlZDogJ1VwcmF2ZW5vJyB9LFxuICBybzogeyBkb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJywgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsIGRvd25sb2FkZWQ6ICdGaW5hbGl6YXQnLCBlcnJvcjogJ0Vyb2FyZScsIGZhaWxlZDogJ0XImXVhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLCB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsIGNvbW1lbnRzOiAnY29tZW50YXJpaScsIGVkaXRlZDogJ01vZGlmaWNhdCcgfSxcbiAgaHU6IHsgZG93bmxvYWQ6ICdMZXTDtmx0w6lzJywgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJywgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLCBkb3dubG9hZGVkOiAnS8Opc3onLCBlcnJvcjogJ0hpYmEnLCBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsIGFyaWFEb3dubG9hZDogJ0xldMO2bHTDqXMnLCB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLCBlZGl0ZWQ6ICdTemVya2VzenR2ZScgfSxcbiAgc3Y6IHsgZG93bmxvYWQ6ICdMYWRkYSBuZXInLCBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLCB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJywgZG93bmxvYWRlZDogJ0tsYXJ0JywgZXJyb3I6ICdGZWwnLCBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJywgYXJpYURvd25sb2FkOiAnTGFkZGEgbmVyJywgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJhZCcgfSxcbiAgZGE6IHsgZG93bmxvYWQ6ICdIZW50JywgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0hlbnRldCcsIGVycm9yOiAnRmVqbCcsIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsIGFyaWFEb3dubG9hZDogJ0hlbnQnLCB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJldCcgfSxcbiAgZmk6IHsgZG93bmxvYWQ6ICdMYXRhYScsIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLCB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsIGRvd25sb2FkZWQ6ICdMYWRhdHR1JywgZXJyb3I6ICdWaXJoZScsIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLCBhcmlhRG93bmxvYWQ6ICdMYXRhYScsIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJywgY29tbWVudHM6ICdrb21tZW50dGlhJywgZWRpdGVkOiAnTXVva2F0dHUnIH0sXG4gIG5vOiB7IGRvd25sb2FkOiAnTGFzdCBuZWQnLCBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0ZlcmRpZycsIGVycm9yOiAnRmVpbCcsIGZhaWxlZDogJ01pc2x5a3Rlcy4nLCBhcmlhRG93bmxvYWQ6ICdMYXN0IG5lZCcsIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLCBjb21tZW50czogJ2tvbW1lbnRhcmVyJywgZWRpdGVkOiAnUmVkaWdlcnQnIH0sXG4gIGhlOiB7IGRvd25sb2FkOiAn15TXldeo15PXlCcsIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsIHRyeWluZzogJ9ee16DXodeU4oCmJywgZG93bmxvYWRlZDogJ9eU15XXqdec150nLCBlcnJvcjogJ9ep15LXmdeQ15QnLCBmYWlsZWQ6ICfXoNeb16nXnCcsIGFyaWFEb3dubG9hZDogJ9eU15XXqNeT15QnLCB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJywgY29tbWVudHM6ICfXqteS15XXkdeV16onLCBlZGl0ZWQ6ICfXoNei16jXmicgfSxcbiAgZmE6IHsgZG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJywgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLCBkb3dubG9hZGVkOiAn2KfZhtis2KfZhSDYtNivJywgZXJyb3I6ICfYrti32KcnLCBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLCBhcmlhRG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JywgY29tbWVudHM6ICfZhti42LEnLCBlZGl0ZWQ6ICfZiNuM2LHYp9uM2LQg2LTYr9mHJyB9LFxuICBmaWw6IHsgZG93bmxvYWQ6ICdJLWRvd25sb2FkJywgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJywgZG93bmxvYWRlZDogJ1RhcG9zIG5hJywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ05hYmlnby4nLCBhcmlhRG93bmxvYWQ6ICdJLWRvd25sb2FkJywgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLCBjb21tZW50czogJ21nYSBrb21lbnRvJywgZWRpdGVkOiAnTmEtZWRpdCcgfSxcbiAgbXM6IHsgZG93bmxvYWQ6ICdNdWF0IHR1cnVuJywgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLCB0cnlpbmc6ICdNZW5jdWJh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ1JhbGF0JywgZmFpbGVkOiAnR2FnYWwuJywgYXJpYURvd25sb2FkOiAnTXVhdCB0dXJ1bicsIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsIGNvbW1lbnRzOiAna29tZW4nLCBlZGl0ZWQ6ICdEaWVkaXQnIH0sXG4gIHNyOiB7IGRvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLCBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJywgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJywgZG93bmxvYWRlZDogJ9CX0LDQstGA0YjQtdC90L4nLCBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLCBhcmlhRG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJywgZWRpdGVkOiAn0JjQt9C80LXRmtC10L3QvicgfSxcbiAgc2s6IHsgZG93bmxvYWQ6ICdTdGlhaG51xaUnLCBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJywgdHJ5aW5nOiAnU2vDusWhYW3igKYnLCBkb3dubG9hZGVkOiAnSG90b3ZvJywgZXJyb3I6ICdDaHliYScsIGZhaWxlZDogJ1pseWhhbG8uJywgYXJpYURvd25sb2FkOiAnU3RpYWhudcWlJywgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLCBlZGl0ZWQ6ICdVcHJhdmVuw6knIH0sXG4gIGJnOiB7IGRvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLCBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsIHRyeWluZzogJ9Ce0L/QuNGC4oCmJywgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsIGVycm9yOiAn0JPRgNC10YjQutCwJywgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsIGFyaWFEb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JywgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLCBlZGl0ZWQ6ICfQoNC10LTQsNC60YLQuNGA0LDQvdC+JyB9LFxuICBocjogeyBkb3dubG9hZDogJ1ByZXV6bWknLCBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJywgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsIGRvd25sb2FkZWQ6ICdHb3Rvdm8nLCBlcnJvcjogJ0dyZcWha2EnLCBmYWlsZWQ6ICdOZXVzcGplbG8uJywgYXJpYURvd25sb2FkOiAnUHJldXptaScsIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJywgY29tbWVudHM6ICdrb21lbnRhcmEnLCBlZGl0ZWQ6ICdVcmXEkWVubycgfSxcbiAgbHQ6IHsgZG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsIHRyeWluZzogJ0JhbmRvbWHigKYnLCBkb3dubG9hZGVkOiAnQmFpZ3RhJywgZXJyb3I6ICdLbGFpZGEnLCBmYWlsZWQ6ICdOZXBhdnlrby4nLCBhcmlhRG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLCBjb21tZW50czogJ2tvbWVudGFyYWknLCBlZGl0ZWQ6ICdSZWRhZ3VvdGEnIH0sXG4gIGx2OiB7IGRvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLCB0cnlpbmc6ICdNxJPEo2luYeKApicsIGRvd25sb2FkZWQ6ICdQYWJlaWd0cycsIGVycm9yOiAnS8S8xatkYScsIGZhaWxlZDogJ05laXpkZXbEgXMuJywgYXJpYURvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsIGNvbW1lbnRzOiAna29tZW50xIFyaScsIGVkaXRlZDogJ1JlZGnEo8STdHMnIH0sXG4gIGV0OiB7IGRvd25sb2FkOiAnTGFhZGkgYWxsYScsIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJywgdHJ5aW5nOiAnUHJvb3ZpbuKApicsIGRvd25sb2FkZWQ6ICdWYWxtaXMnLCBlcnJvcjogJ1ZpZ2EnLCBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJywgYXJpYURvd25sb2FkOiAnTGFhZGkgYWxsYScsIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJywgY29tbWVudHM6ICdrb21tZW50YWFyaScsIGVkaXRlZDogJ011dWRldHVkJyB9LFxuICBzbDogeyBkb3dubG9hZDogJ1ByZW5vcycsIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLCB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLCBkb3dubG9hZGVkOiAnS29uxI1hbm8nLCBlcnJvcjogJ05hcGFrYScsIGZhaWxlZDogJ05pIHVzcGVsby4nLCBhcmlhRG93bmxvYWQ6ICdQcmVub3MnLCB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJywgY29tbWVudHM6ICdrb21lbnRhcmpldicsIGVkaXRlZDogJ1VyZWplbm8nIH0sXG4gIGNhOiB7IGRvd25sb2FkOiAnRGVzY2FycmVnYScsIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJywgdHJ5aW5nOiAnSW50ZW50YW504oCmJywgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2F0JywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ0hhIGZhbGxhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhJywgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaXMnLCBlZGl0ZWQ6ICdFZGl0YXQnIH0sXG4gIGFmOiB7IGRvd25sb2FkOiAnQWZsYWFpJywgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJywgdHJ5aW5nOiAnUHJvYmVlcuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1ay4nLCBhcmlhRG93bmxvYWQ6ICdBZmxhYWknLCB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLCBjb21tZW50czogJ2tvbW1lbnRhcmUnLCBlZGl0ZWQ6ICdHZXJlZGlnZWVyJyB9LFxuICBhbTogeyBkb3dubG9hZDogJ+GKoOGLjeGIreGLtScsIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLCBkb3dubG9hZGVkOiAn4YuI4Yit4Yu34YiNJywgZXJyb3I6ICfhiLXhiIXhibDhibUnLCBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLCBhcmlhRG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLCB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JywgZWRpdGVkOiAn4Ymw4Yi14Ymw4Yqr4Yqt4YiP4YiNJyB9LFxuICBoeTogeyBkb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLCB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsIGRvd25sb2FkZWQ6ICfUsdW+1aHWgNW/1b7VodWuJywgZXJyb3I6ICfVjdWt1aHVrCcsIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JywgYXJpYURvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJywgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JywgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLCBlZGl0ZWQ6ICfUvdW01aLVodWj1oDVvtWl1awg1acnIH0sXG4gIGFzOiB7IGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCnguCnsOCnjeCmoycsIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLCBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnIH0sXG4gIGF6OiB7IGRvd25sb2FkOiAnWcO8a2zJmScsIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsIGRvd25sb2FkZWQ6ICdCaXRkaScsIGVycm9yOiAnWMmZdGEnLCBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsIGFyaWFEb3dubG9hZDogJ1nDvGtsyZknLCB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLCBjb21tZW50czogJ8WfyZlyaCcsIGVkaXRlZDogJ0TDvHrJmWxpxZ8gZWRpbGliJyB9LFxuICBldTogeyBkb3dubG9hZDogJ0Rlc2thcmdhdHUnLCBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsIHRyeWluZzogJ1NhaWF0emVu4oCmJywgZG93bmxvYWRlZDogJ0VnaW5kYScsIGVycm9yOiAnRXJyb3JlYScsIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLCBhcmlhRG93bmxvYWQ6ICdEZXNrYXJnYXR1JywgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLCBjb21tZW50czogJ2lydXpraW4nLCBlZGl0ZWQ6ICdFZGl0YXR1YScgfSxcbiAgbXk6IHsgZG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLCB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLCBkb3dubG9hZGVkOiAn4YCV4YC84YCu4YC44YCV4YCr4YCV4YC84YCuJywgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLCBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLCBhcmlhRG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JywgZWRpdGVkOiAn4YCV4YC84YCE4YC64YCG4YCE4YC64YCV4YC84YCu4YC4JyB9LFxuICBnbDogeyBkb3dubG9hZDogJ0Rlc2NhcmdhcicsIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLCB0cnlpbmc6ICdUZW50YW5kb+KApicsIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsbG91LicsIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJywgY29tbWVudHM6ICdjb21lbnRhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gIGthOiB7IGRvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLCB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLCBkb3dubG9hZGVkOiAn4YOT4YOQ4YOh4YOg4YOj4YOa4YOT4YOQJywgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLCBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsIGFyaWFEb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLCBlZGl0ZWQ6ICfhg6Dhg5Thg5Phg5Dhg6Xhg6Lhg5jhg6Dhg5Thg5Hhg6Phg5rhg5jhg5AnIH0sXG4gIGlzOiB7IGRvd25sb2FkOiAnU8Oma2phJywgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLCB0cnlpbmc6ICdSZXluaeKApicsIGRvd25sb2FkZWQ6ICdTw7N0dCcsIGVycm9yOiAnVmlsbGEnLCBmYWlsZWQ6ICdNaXN0w7Nrc3QuJywgYXJpYURvd25sb2FkOiAnU8Oma2phJywgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsIGNvbW1lbnRzOiAndW1tw6ZsaScsIGVkaXRlZDogJ0JyZXl0dCcgfSxcbiAgZ2E6IHsgZG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJywgZG93bmxvYWRlZDogJ8ONb3Nsw7Nkw6FpbHRlJywgZXJyb3I6ICdFYXJyw6FpZCcsIGZhaWxlZDogJ1RoZWlwIGFpci4nLCBhcmlhRG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLCBjb21tZW50czogJ3Ryw6FjaHQnLCBlZGl0ZWQ6ICdFYWdyYWl0aGUnIH0sXG4gIGtrOiB7IGRvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJywgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJywgZG93bmxvYWRlZDogJ9CQ0Y/Sm9GC0LDQu9C00YsnLCBlcnJvcjogJ9Ka0LDRgtC1JywgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsIGFyaWFEb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLCB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsIGVkaXRlZDogJ9Oo0LfQs9C10YDRgtGW0LvQtNGWJyB9LFxuICBrbTogeyBkb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJywgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJywgZG93bmxvYWRlZDogJ+GelOGetuGek+GelOGeieGfkuGeheGelOGfiycsIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJywgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJywgYXJpYURvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJywgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JywgZWRpdGVkOiAn4Z6U4Z624Z6T4Z6A4Z+C4Z6f4Z6Y4Z+S4Z6a4Z694Z6bJyB9LFxuICBsbzogeyBkb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJywgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJywgZG93bmxvYWRlZDogJ+C6quC6s+C7gOC6peC6seC6lCcsIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJywgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJywgYXJpYURvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJywgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJywgZWRpdGVkOiAn4LuB4LqB4LuJ4LuE4LqC4LuB4Lql4LuJ4LqnJyB9LFxuICBtazogeyBkb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JywgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLCB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLCBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JywgZXJyb3I6ICfQk9GA0LXRiNC60LAnLCBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJywgYXJpYURvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLCB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLCBlZGl0ZWQ6ICfQmNC30LzQtdC90LXRgtC+JyB9LFxuICBtbjogeyBkb3dubG9hZDogJ9Ci0LDRgtCw0YUnLCBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJywgZG93bmxvYWRlZDogJ9Ci0LDRgtGB0LDQvScsIGVycm9yOiAn0JDQu9C00LDQsCcsIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLCBhcmlhRG93bmxvYWQ6ICfQotCw0YLQsNGFJywgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJywgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLCBlZGl0ZWQ6ICfQl9Cw0YHRgdCw0L0nIH0sXG4gIG5lOiB7IGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJywgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpL4g4KSt4KSv4KWLJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsIGVkaXRlZDogJ+CkuOCkruCljeCkquCkvuCkpuCkv+CkpCcgfSxcbiAgb3I6IHsgZG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLCBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLCB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJywgZG93bmxvYWRlZDogJ+CsuOCsruCtjeCsquCtguCssOCtjeCso+CtjeCsoycsIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JywgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsIGFyaWFEb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJywgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLCBlZGl0ZWQ6ICfgrLjgrK7grY3grKrgrL7grKbgrL/grKQnIH0sXG4gIHNpOiB7IGRvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJywgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJywgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsIGRvd25sb2FkZWQ6ICfgtoXgt4Dgt4PgtrHgt4onLCBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsIGFyaWFEb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJywgZWRpdGVkOiAn4LeD4LaC4LeD4LeK4Laa4La74Lar4La6JyB9LFxuICBzdzogeyBkb3dubG9hZDogJ1Bha3VhJywgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsIHRyeWluZzogJ0luYWphcmlideKApicsIGRvd25sb2FkZWQ6ICdJbWVrYW1pbGlrYScsIGVycm9yOiAnSGl0aWxhZnUnLCBmYWlsZWQ6ICdJbWVzaGluZHdhLicsIGFyaWFEb3dubG9hZDogJ1Bha3VhJywgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsIGNvbW1lbnRzOiAnbWFvbmknLCBlZGl0ZWQ6ICdJbWVoYXJpcml3YScgfSxcbiAgdXo6IHsgZG93bmxvYWQ6ICdZdWtsYXNoJywgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJywgZG93bmxvYWRlZDogJ1RheXlvcicsIGVycm9yOiAnWGF0bycsIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLCBhcmlhRG93bmxvYWQ6ICdZdWtsYXNoJywgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJywgY29tbWVudHM6ICdzaGFyaGxhcicsIGVkaXRlZDogJ1RhaHJpcmxhbmdhbicgfSxcbiAgY3k6IHsgZG93bmxvYWQ6ICdMYXdybHd5dGhvJywgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJywgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJywgZG93bmxvYWRlZDogJ1dlZGkgZ29yZmZlbicsIGVycm9yOiAnR3dhbGwnLCBmYWlsZWQ6ICdNZXRob2RkLicsIGFyaWFEb3dubG9hZDogJ0xhd3Jsd3l0aG8nLCB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLCBjb21tZW50czogJ3N5bHdhZGF1JywgZWRpdGVkOiAnR29seWd3eWQnIH0sXG4gIHp1OiB7IGRvd25sb2FkOiAnTGFuZGEnLCBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsIHRyeWluZzogJ0l5YXphbWHigKYnLCBkb3dubG9hZGVkOiAnSWxhbmTEq3dlJywgZXJyb3I6ICdJcGh1dGhhJywgZmFpbGVkOiAnSWhsdWxla2lsZS4nLCBhcmlhRG93bmxvYWQ6ICdMYW5kYScsIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsIGNvbW1lbnRzOiAnYW1hendhbmEnLCBlZGl0ZWQ6ICdLdWhsZWxpd2UnIH0sXG4gIHNxOiB7IGRvd25sb2FkOiAnU2hrYXJrbycsIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLCB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLCBkb3dubG9hZGVkOiAnUMOrcmZ1bmRvaScsIGVycm9yOiAnR2FiaW0nLCBmYWlsZWQ6ICdEw6tzaHRvaS4nLCBhcmlhRG93bmxvYWQ6ICdTaGthcmtvJywgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLCBjb21tZW50czogJ2tvbWVudGUnLCBlZGl0ZWQ6ICdFIHJlZGFrdHVhcicgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZykge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCc7JylbMF0udHJpbSgpLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbYmFzZUxhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbJ2VuJ10gJiYgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG5cbiAgfSBjYXRjaCAoZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59IiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2VkaXRlZF9mcmFtZS5jb250ZW50LnRzXG5pbXBvcnQgeyBFRElUX0lDT05fU1ZHX1JBVywgQ09NTUVOVF9JQ09OX1VSTCB9IGZyb20gJy4vY29udGVudC9pY29ucyc7XG5pbXBvcnQgeyBpbmplY3RTdHlsZXMgfSBmcm9tICcuL2NvbnRlbnQvc3R5bGVzJztcbmltcG9ydCB7IGlzUGFnZURhcmsgfSBmcm9tICcuL2NvbnRlbnQvdGhlbWUnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vY29udGVudC9pMThuJztcblxuLy8gU2VsZWN0b3IgZm9yIHRoZSBtYWluIHN0cmVhbSBjYXJkXG5jb25zdCBQT1NUX1NFTEVDVE9SID0gJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXSc7XG5jb25zdCBFRElURURfQVRUUiA9ICdkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkJztcblxuLy8g8J+UtCBORVc6IGRlYm91bmNlIGZsYWcgc28gd2UgZG9uJ3QgcmVzY2FuIG9uIGV2ZXJ5IHRpbnkgbXV0YXRpb25cbmxldCBlZGl0ZWRTY2FuU2NoZWR1bGVkID0gZmFsc2U7XG5cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnaHR0cHM6Ly9jbGFzc3Jvb20uZ29vZ2xlLmNvbS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW4oKSB7XG4gICAgaW5qZWN0U3R5bGVzKCk7XG4gICAgc2NhbkZvckVkaXRlZFBvc3RzKCk7XG5cbiAgICAvLyAtLS0gU1RSQVRFR1kgMTogTVVUQVRJT04gT0JTRVJWRVIgKFJlYWN0cyB0byBET00gY2hhbmdlcykgLS0tXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAvLyDinIUgRGVib3VuY2U6IG9ubHkgc2NoZWR1bGUgKm9uZSogc2NhbiBwZXIgZnJhbWVcbiAgICAgIGlmIChlZGl0ZWRTY2FuU2NoZWR1bGVkKSByZXR1cm47XG4gICAgICBlZGl0ZWRTY2FuU2NoZWR1bGVkID0gdHJ1ZTtcblxuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgZWRpdGVkU2NhblNjaGVkdWxlZCA9IGZhbHNlO1xuICAgICAgICBzY2FuRm9yRWRpdGVkUG9zdHMoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcjogWydhcmlhLWxhYmVsJywgJ3RpdGxlJ10sXG4gICAgfSk7XG5cbiAgICAvLyBIZWFydGJlYXRcbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBzY2FuRm9yRWRpdGVkUG9zdHMoKTtcbiAgICB9LCAxMDAwKTtcblxuICAgIC8vIFVSTCB3YXRjaGVyXG4gICAgbGV0IGxhc3RVcmwgPSBsb2NhdGlvbi5ocmVmO1xuICAgIG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IHVybCA9IGxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAodXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICAgIGxhc3RVcmwgPSB1cmw7XG4gICAgICAgIHNldFRpbWVvdXQoc2NhbkZvckVkaXRlZFBvc3RzLCA1MDApO1xuICAgICAgICBzZXRUaW1lb3V0KHNjYW5Gb3JFZGl0ZWRQb3N0cywgMTUwMCk7XG4gICAgICB9XG4gICAgfSkub2JzZXJ2ZShkb2N1bWVudCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSk7XG4gIH0sXG59KTtcblxuZnVuY3Rpb24gc2NhbkZvckVkaXRlZFBvc3RzKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IGdldFBhZ2VEaXJlY3Rpb24oKTtcbiAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnZGF0YS1jcWQtZGlyJywgZGlyZWN0aW9uKTtcblxuICAgIGNvbnN0IGVkaXRlZFdvcmQgPSB0KCdlZGl0ZWQnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHBvc3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oUE9TVF9TRUxFQ1RPUik7XG5cbiAgICBwb3N0cy5mb3JFYWNoKChwb3N0KSA9PiB7XG4gICAgICBsZXQgYWxyZWFkeVByb2Nlc3NlZCA9IGZhbHNlO1xuXG4gICAgICBpZiAocG9zdC5oYXNBdHRyaWJ1dGUoRURJVEVEX0FUVFIpKSB7XG4gICAgICAgIGNvbnN0IGhhc0VkaXRlZE92ZXJsYXkgPVxuICAgICAgICAgICEhcG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQnKSB8fFxuICAgICAgICAgICEhcG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLWVkaXRlZC1iYWRnZScpIHx8XG4gICAgICAgICAgISFwb3N0LnF1ZXJ5U2VsZWN0b3IoJy5jcWQtYm90aC1iYWRnZScpO1xuXG4gICAgICAgIGlmICghaGFzRWRpdGVkT3ZlcmxheSkge1xuICAgICAgICAgIHBvc3QucmVtb3ZlQXR0cmlidXRlKEVESVRFRF9BVFRSKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhbHJlYWR5UHJvY2Vzc2VkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoIWFscmVhZHlQcm9jZXNzZWQpIHtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IEFycmF5LmZyb20oXG4gICAgICAgICAgcG9zdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PignYSwgc3BhbiwgZGl2W2FyaWEtbGFiZWxdJylcbiAgICAgICAgKTtcblxuICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgbGV0IGRpZmZUZXh0OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICBmb3IgKGNvbnN0IGVsIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICAgICAgICBjb25zdCB0ZXh0ID0gKGVsLnRleHRDb250ZW50IHx8ICcnKS50cmltKCk7XG4gICAgICAgICAgY29uc3QgYXJpYSA9IChlbC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSB8fCAnJykudHJpbSgpO1xuICAgICAgICAgIGNvbnN0IHRpdGxlID0gKGVsLmdldEF0dHJpYnV0ZSgndGl0bGUnKSB8fCAnJykudHJpbSgpO1xuXG4gICAgICAgICAgY29uc3QgY29tYmluZWQgPSBgJHt0ZXh0fSAke2FyaWF9ICR7dGl0bGV9YC50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgICAgaWYgKCFjb21iaW5lZC5pbmNsdWRlcyhlZGl0ZWRXb3JkKSkgY29udGludWU7XG5cbiAgICAgICAgICBsZXQgc291cmNlVGV4dCA9IHRleHQ7XG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgc291cmNlVGV4dC5sZW5ndGggPCA1IHx8XG4gICAgICAgICAgICAhc291cmNlVGV4dC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGVkaXRlZFdvcmQpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBzb3VyY2VUZXh0ID0gYXJpYSB8fCB0aXRsZSB8fCB0ZXh0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRpZmZUZXh0ID0gY2FsY3VsYXRlRWRpdERpZmYoc291cmNlVGV4dCwgZWRpdGVkV29yZCkgPz8gJyswJztcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm91bmQgJiYgZGlmZlRleHQgIT09IG51bGwpIHtcbiAgICAgICAgICBwb3N0LnNldEF0dHJpYnV0ZShFRElURURfQVRUUiwgJ3RydWUnKTtcbiAgICAgICAgICBjcmVhdGVFZGl0ZWRPdmVybGF5KHBvc3QsIGRpZmZUZXh0KTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBbHdheXMgdHJ5IHRvIG1lcmdlIGludG8gQk9USCBwaWxsIGlmIGJvdGggc3RhdGVzIGFyZSBwcmVzZW50XG4gICAgICB1cGdyYWRlQ29tYmluZWRCYWRnZShwb3N0KTtcbiAgICB9KTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gU2lsZW50IGZhaWxcbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZXMgdGhlIGRpZmZlcmVuY2UgaW4gZGF5cyBiZXR3ZWVuIGNyZWF0ZWQgYW5kIGVkaXRlZCBkYXRlLlxuICpcbiAqIEV4YW1wbGU6XG4gKiAgXCJPY3QgMSAoRWRpdGVkIE9jdCA1KVwiICAtPiBcIis0XCJcbiAqICBzYW1lLWRheSBlZGl0ICAgICAgICAgICAtPiBcIiswXCJcbiAqXG4gKiBJZiBwYXJzaW5nIGZhaWxzLCByZXR1cm5zIG51bGwgYW5kIGNhbGxlciBmYWxscyBiYWNrIHRvIFwiKzBcIi5cbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlRWRpdERpZmYoZnVsbFRleHQ6IHN0cmluZywgX2tleXdvcmQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICB0cnkge1xuICAgIGNvbnN0IG1vbnRoUmVnZXggPVxuICAgICAgL1xcYig/OkphbnxGZWJ8TWFyfEFwcnxNYXl8SnVufEp1bHxBdWd8U2VwfE9jdHxOb3Z8RGVjKVxccytcXGR7MSwyfVxcYi9naTtcblxuICAgIGNvbnN0IG1hdGNoZXMgPSBmdWxsVGV4dC5tYXRjaChtb250aFJlZ2V4KTtcbiAgICBjb25zdCBjdXJyZW50WWVhciA9IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcblxuICAgIGlmICghbWF0Y2hlcyB8fCBtYXRjaGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyc2VEYXRlID0gKHM6IHN0cmluZyk6IERhdGUgfCBudWxsID0+IHtcbiAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShgJHtzLnRyaW0oKX0gJHtjdXJyZW50WWVhcn1gKTtcbiAgICAgIHJldHVybiBpc05hTihkLmdldFRpbWUoKSkgPyBudWxsIDogZDtcbiAgICB9O1xuXG4gICAgbGV0IGNyZWF0ZWREYXRlOiBEYXRlIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGVkaXRlZERhdGU6IERhdGUgfCBudWxsID0gbnVsbDtcblxuICAgIGlmIChtYXRjaGVzLmxlbmd0aCA+PSAyKSB7XG4gICAgICBjcmVhdGVkRGF0ZSA9IHBhcnNlRGF0ZShtYXRjaGVzWzBdKTtcbiAgICAgIGVkaXRlZERhdGUgPSBwYXJzZURhdGUobWF0Y2hlc1sxXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNyZWF0ZWREYXRlID0gcGFyc2VEYXRlKG1hdGNoZXNbMF0pO1xuICAgICAgZWRpdGVkRGF0ZSA9IGNyZWF0ZWREYXRlO1xuICAgIH1cblxuICAgIGlmICghY3JlYXRlZERhdGUgfHwgIWVkaXRlZERhdGUpIHJldHVybiBudWxsO1xuXG4gICAgbGV0IGRpZmZEYXlzID0gTWF0aC5mbG9vcihcbiAgICAgIChlZGl0ZWREYXRlLmdldFRpbWUoKSAtIGNyZWF0ZWREYXRlLmdldFRpbWUoKSkgL1xuICAgICAgICAoMTAwMCAqIDYwICogNjAgKiAyNClcbiAgICApO1xuXG4gICAgaWYgKGRpZmZEYXlzIDwgMCkgZGlmZkRheXMgPSAwO1xuXG4gICAgcmV0dXJuIGArJHtkaWZmRGF5c31gO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVFZGl0ZWRPdmVybGF5KHBvc3Q6IEhUTUxFbGVtZW50LCBkaWZmVGV4dDogc3RyaW5nKSB7XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocG9zdCk7XG5cbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykgcG9zdC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gIHBvc3Quc3R5bGUuc2V0UHJvcGVydHkoJ292ZXJmbG93JywgJ3Zpc2libGUnLCAnaW1wb3J0YW50Jyk7XG4gIHBvc3Quc3R5bGUuc2V0UHJvcGVydHkoJ2NvbnRhaW4nLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgcG9zdC5zdHlsZS56SW5kZXggPSAnMSc7XG5cbiAgLy8gRnJhbWUgKHJldXNlIGlmIGNvbW1lbnQgc2NyaXB0IGFscmVhZHkgY3JlYXRlZCBpdClcbiAgbGV0IG92ZXJsYXkgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTERpdkVsZW1lbnQ+KCcuY3FkLW92ZXJsYXktY29udGFpbmVyJyk7XG4gIGlmICghb3ZlcmxheSkge1xuICAgIG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBvdmVybGF5LmNsYXNzTmFtZSA9ICdjcWQtb3ZlcmxheS1jb250YWluZXIgY3FkLWVkaXRlZCc7XG4gICAgb3ZlcmxheS5zdHlsZS5ib3JkZXJSYWRpdXMgPSBjb21wdXRlZC5ib3JkZXJSYWRpdXMgfHwgJzhweCc7XG4gICAgaWYgKGlzUGFnZURhcmsoKSkgb3ZlcmxheS5jbGFzc0xpc3QuYWRkKCdjcWQtdGhlbWUtZGFyaycpO1xuXG4gICAgb3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBpZiAoZS50YXJnZXQgPT09IG92ZXJsYXkpIHtcbiAgICAgICAgY29uc3QgbGluayA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2FbaHJlZio9XCIvZGV0YWlscy9cIl0sIGgyIGEnKTtcbiAgICAgICAgaWYgKGxpbmspIGxpbmsuY2xpY2soKTtcbiAgICAgICAgZWxzZSBwb3N0LmNsaWNrKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBwb3N0LmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuICB9IGVsc2Uge1xuICAgIG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgnY3FkLWVkaXRlZCcpO1xuICAgIGlmIChpc1BhZ2VEYXJrKCkpIG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcbiAgfVxuXG4gIC8vIElmIEJPVEggcGlsbCBhbHJlYWR5IGV4aXN0cywgZG9uJ3QgY3JlYXRlIGEgc2VwYXJhdGUgZWRpdGVkIHBpbGxcbiAgaWYgKHBvc3QucXVlcnlTZWxlY3RvcignLmNxZC1ib3RoLWJhZGdlJykpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBSZW1vdmUgYW55IG9sZGVyIGVkaXRlZCBwaWxsIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgY29uc3QgZXhpc3RpbmdFZGl0ZWRCYWRnZSA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZWRpdGVkLWJhZGdlJyk7XG4gIGV4aXN0aW5nRWRpdGVkQmFkZ2U/LnJlbW92ZSgpO1xuXG4gIGNvbnN0IHBpbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcGlsbC5jbGFzc05hbWUgPSAnY3FkLWVkaXRlZC1iYWRnZSc7XG4gIGlmIChpc1BhZ2VEYXJrKCkpIHBpbGwuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcblxuICBjb25zdCBpY29uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBpY29uV3JhcHBlci5jbGFzc05hbWUgPSAnY3FkLWVkaXRlZC1pY29uJztcbiAgaWNvbldyYXBwZXIuaW5uZXJIVE1MID0gRURJVF9JQ09OX1NWR19SQVc7XG4gIHBpbGwuYXBwZW5kQ2hpbGQoaWNvbldyYXBwZXIpO1xuXG4gIGNvbnN0IGNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29udGVudC5jbGFzc05hbWUgPSAnY3FkLWVkaXRlZC1jb250ZW50JztcblxuICBjb25zdCBkaWZmU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgZGlmZlNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kaWZmLXZhbCc7XG4gIGRpZmZTcGFuLnRleHRDb250ZW50ID0gZGlmZlRleHQ7IC8vIFwiKzRcIiwgXCIrMFwiLCBldGMuXG4gIGNvbnRlbnQuYXBwZW5kQ2hpbGQoZGlmZlNwYW4pO1xuXG4gIHBpbGwuYXBwZW5kQ2hpbGQoY29udGVudCk7XG4gIHBvc3QuYXBwZW5kQ2hpbGQocGlsbCk7XG59XG5cbmZ1bmN0aW9uIGdldFBhZ2VEaXJlY3Rpb24oKTogJ2x0cicgfCAncnRsJyB7XG4gIGNvbnN0IGRvY0RpciA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kaXIgfHwgZG9jdW1lbnQuYm9keS5kaXI7XG4gIHJldHVybiBkb2NEaXIgPT09ICdydGwnID8gJ3J0bCcgOiAnbHRyJztcbn1cblxuLyoqXG4gKiBNZXJnZSBjb21tZW50cyBiYWRnZSArIGVkaXRlZCBiYWRnZSBpbnRvIGEgc2luZ2xlIEJPVEggcGlsbFxuICogd2l0aDpcbiAqICAtIGNvbW1lbnQgaWNvbiArIGNvdW50XG4gKiAgLSBcIitcIlxuICogIC0gZGl2aWRlclxuICogIC0gZWRpdGVkIGljb24gKyBcIitOXCJcbiAqL1xuZnVuY3Rpb24gdXBncmFkZUNvbWJpbmVkQmFkZ2UocG9zdDogSFRNTEVsZW1lbnQpIHtcbiAgY29uc3Qgb3ZlcmxheSA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRGl2RWxlbWVudD4oJy5jcWQtb3ZlcmxheS1jb250YWluZXInKTtcbiAgY29uc3QgY29tbWVudEJhZGdlID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1jb21tZW50LWJhZGdlJyk7XG4gIGNvbnN0IGVkaXRlZEJhZGdlID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1lZGl0ZWQtYmFkZ2UnKTtcbiAgbGV0IGJvdGhCYWRnZSA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtYm90aC1iYWRnZScpO1xuXG4gIC8vIERvZXMgdGhpcyBwb3N0IGhhdmUgY29tbWVudHMgJiBlZGl0ZWQgaW5mbz9cbiAgY29uc3QgaGFzQ29tbWVudHMgPVxuICAgICEhY29tbWVudEJhZGdlIHx8IHBvc3QuaGFzQXR0cmlidXRlKCdkYXRhLWNxZC1wcm9jZXNzZWQnKTtcbiAgY29uc3QgaGFzRWRpdGVkID1cbiAgICAhIWVkaXRlZEJhZGdlIHx8IHBvc3QuaGFzQXR0cmlidXRlKCdkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkJyk7XG5cbiAgLy8gSWYgaXQgZG9lc24ndCB0cnVseSBoYXZlIEJPVEgsIG5vIGNvbWJpbmVkIHBpbGxcbiAgaWYgKCFoYXNDb21tZW50cyB8fCAhaGFzRWRpdGVkKSB7XG4gICAgLy8gSWYgd2Ugc29tZWhvdyBoYWQgYW4gb2xkIEJPVEggcGlsbCwgY2xlYW4gaXQgdXBcbiAgICBib3RoQmFkZ2U/LnJlbW92ZSgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLSBFeHRyYWN0IFZBTFVFUyAtLS0tLS0tLS1cblxuICAvLyAxKSBDb21tZW50IGNvdW50XG4gIGxldCBjb21tZW50Q291bnQgPSAnMCc7XG4gIGNvbnN0IGNvbW1lbnRMYWJlbCA9IGNvbW1lbnRCYWRnZT8ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtYmFkZ2UtbGFiZWwnKTtcbiAgaWYgKGNvbW1lbnRMYWJlbD8udGV4dENvbnRlbnQ/LnRyaW0oKSkge1xuICAgIGNvbW1lbnRDb3VudCA9IGNvbW1lbnRMYWJlbC50ZXh0Q29udGVudC50cmltKCk7XG4gIH0gZWxzZSBpZiAoYm90aEJhZGdlKSB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBib3RoQmFkZ2UucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtYm90aC12YWx1ZS1jb21tZW50Jyk7XG4gICAgaWYgKGV4aXN0aW5nPy50ZXh0Q29udGVudD8udHJpbSgpKSB7XG4gICAgICBjb21tZW50Q291bnQgPSBleGlzdGluZy50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gMikgRWRpdCBkaWZmIFwiK05cIlxuICBsZXQgZGlmZlRleHQgPSAnKzAnO1xuICBjb25zdCBkaWZmU3BhbiA9IGVkaXRlZEJhZGdlPy5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kaWZmLXZhbCcpO1xuICBpZiAoZGlmZlNwYW4/LnRleHRDb250ZW50Py50cmltKCkpIHtcbiAgICBkaWZmVGV4dCA9IGRpZmZTcGFuLnRleHRDb250ZW50LnRyaW0oKTtcbiAgfSBlbHNlIGlmIChib3RoQmFkZ2UpIHtcbiAgICBjb25zdCBleGlzdGluZyA9IGJvdGhCYWRnZS5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLXZhbHVlLWVkaXRlZCcpO1xuICAgIGlmIChleGlzdGluZz8udGV4dENvbnRlbnQ/LnRyaW0oKSkge1xuICAgICAgZGlmZlRleHQgPSBleGlzdGluZy50ZXh0Q29udGVudC50cmltKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgQk9USCBiYWRnZSBhbHJlYWR5IGV4aXN0cywganVzdCBzeW5jIGl0cyBudW1iZXJzIGFuZCBleGl0XG4gIGlmIChib3RoQmFkZ2UpIHtcbiAgICBjb25zdCBjYyA9IGJvdGhCYWRnZS5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLXZhbHVlLWNvbW1lbnQnKTtcbiAgICBjb25zdCBkZCA9IGJvdGhCYWRnZS5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1ib3RoLXZhbHVlLWVkaXRlZCcpO1xuICAgIGlmIChjYykgY2MudGV4dENvbnRlbnQgPSBjb21tZW50Q291bnQ7XG4gICAgaWYgKGRkKSBkZC50ZXh0Q29udGVudCA9IGRpZmZUZXh0O1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIC0tLS0tLS0tLSBCdWlsZCB0aGUgbWVyZ2VkIHBpbGwgLS0tLS0tLS0tXG5cbiAgLy8gUmVtb3ZlIHNlcGFyYXRlIGNvbW1lbnQvZWRpdGVkIGJhZGdlcyBzbyB3ZSBvbmx5IGhhdmUgdGhlIGNvbWJpbmVkIG9uZVxuICBjb21tZW50QmFkZ2U/LnJlbW92ZSgpO1xuICBlZGl0ZWRCYWRnZT8ucmVtb3ZlKCk7XG5cbiAgLy8gRW5zdXJlIG92ZXJsYXkgZXhpc3RzIChpbiBjYXNlIGNvbW1lbnRzIHNjcmlwdCBkaWRuJ3QgbWFrZSBvbmUpXG4gIGlmICghb3ZlcmxheSkge1xuICAgIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocG9zdCk7XG4gICAgY29uc3QgbmV3T3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG5ld092ZXJsYXkuY2xhc3NOYW1lID0gJ2NxZC1vdmVybGF5LWNvbnRhaW5lcic7XG4gICAgbmV3T3ZlcmxheS5zdHlsZS5ib3JkZXJSYWRpdXMgPSBjb21wdXRlZC5ib3JkZXJSYWRpdXMgfHwgJzhweCc7XG5cbiAgICBuZXdPdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGlmIChlLnRhcmdldCA9PT0gbmV3T3ZlcmxheSkge1xuICAgICAgICBjb25zdCBsaW5rID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignYVtocmVmKj1cIi9kZXRhaWxzL1wiXSwgaDIgYScpO1xuICAgICAgICBpZiAobGluaykgbGluay5jbGljaygpO1xuICAgICAgICBlbHNlIHBvc3QuY2xpY2soKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHBvc3QuYXBwZW5kQ2hpbGQobmV3T3ZlcmxheSk7XG4gIH1cblxuICBib3RoQmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYm90aEJhZGdlLmNsYXNzTmFtZSA9ICdjcWQtYm90aC1iYWRnZSc7XG5cbiAgLy8gU2VjdGlvbiAxOiBDb21tZW50cyAoaWNvbiArIG51bWJlcilcbiAgY29uc3QgY29tbWVudHNTZWN0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGNvbW1lbnRzU2VjdGlvbi5jbGFzc05hbWUgPSAnY3FkLWJvdGgtc2VjdGlvbiBjcWQtYm90aC1jb21tZW50cyc7XG5cbiAgY29uc3QgY29tbWVudEljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29tbWVudEljb24uY2xhc3NOYW1lID0gJ2NxZC1ib3RoLWljb24gY3FkLWJvdGgtaWNvbi1jb21tZW50JztcbiAgY29tbWVudEljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7Q09NTUVOVF9JQ09OX1VSTH1cIilgO1xuICBjb21tZW50c1NlY3Rpb24uYXBwZW5kQ2hpbGQoY29tbWVudEljb24pO1xuXG4gIGNvbnN0IGNvbW1lbnRWYWx1ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgY29tbWVudFZhbHVlLmNsYXNzTmFtZSA9ICdjcWQtYm90aC12YWx1ZSBjcWQtYm90aC12YWx1ZS1jb21tZW50JztcbiAgY29tbWVudFZhbHVlLnRleHRDb250ZW50ID0gY29tbWVudENvdW50O1xuICBjb21tZW50c1NlY3Rpb24uYXBwZW5kQ2hpbGQoY29tbWVudFZhbHVlKTtcblxuICAvLyBNaWRkbGU6IFwiK1wiXG4gIGNvbnN0IHBsdXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcGx1cy5jbGFzc05hbWUgPSAnY3FkLWJvdGgtcGx1cyc7XG4gIHBsdXMudGV4dENvbnRlbnQgPSAnKyc7XG5cbiAgLy8gRGl2aWRlciAob25seSB2aXNpYmxlIG9uIGhvdmVyKVxuICBjb25zdCBkaXZpZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGRpdmlkZXIuY2xhc3NOYW1lID0gJ2NxZC1ib3RoLWRpdmlkZXInO1xuXG4gIC8vIFNlY3Rpb24gMjogRWRpdGVkIChpY29uICsgK04pXG4gIGNvbnN0IGVkaXRlZFNlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWRpdGVkU2VjdGlvbi5jbGFzc05hbWUgPSAnY3FkLWJvdGgtc2VjdGlvbiBjcWQtYm90aC1lZGl0ZWQnO1xuXG4gIGNvbnN0IGVkaXRlZEljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWRpdGVkSWNvbi5jbGFzc05hbWUgPSAnY3FkLWJvdGgtaWNvbiBjcWQtYm90aC1pY29uLWVkaXRlZCc7XG4gIGVkaXRlZEljb24uaW5uZXJIVE1MID0gRURJVF9JQ09OX1NWR19SQVc7XG4gIGVkaXRlZFNlY3Rpb24uYXBwZW5kQ2hpbGQoZWRpdGVkSWNvbik7XG5cbiAgY29uc3QgZGlmZlZhbHVlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBkaWZmVmFsdWUuY2xhc3NOYW1lID0gJ2NxZC1ib3RoLXZhbHVlIGNxZC1ib3RoLXZhbHVlLWVkaXRlZCc7XG4gIGRpZmZWYWx1ZS50ZXh0Q29udGVudCA9IGRpZmZUZXh0O1xuICBlZGl0ZWRTZWN0aW9uLmFwcGVuZENoaWxkKGRpZmZWYWx1ZSk7XG5cbiAgLy8gRmluYWwgdmVydGljYWwgb3JkZXIgaW5zaWRlIHRoZSBwaWxsOlxuICAvLyAgY29tbWVudHNTZWN0aW9uIChpY29uLCBudW1iZXIpXG4gIC8vICBwbHVzXG4gIC8vICBkaXZpZGVyXG4gIC8vICBlZGl0ZWRTZWN0aW9uIChpY29uLCArTilcbiAgYm90aEJhZGdlLmFwcGVuZENoaWxkKGNvbW1lbnRzU2VjdGlvbik7XG4gIGJvdGhCYWRnZS5hcHBlbmRDaGlsZChwbHVzKTtcbiAgYm90aEJhZGdlLmFwcGVuZENoaWxkKGRpdmlkZXIpO1xuICBib3RoQmFkZ2UuYXBwZW5kQ2hpbGQoZWRpdGVkU2VjdGlvbik7XG5cbiAgYm90aEJhZGdlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHRyaWdnZXJQb3N0Q2xpY2socG9zdCk7XG4gIH0pO1xuXG4gIHBvc3QuYXBwZW5kQ2hpbGQoYm90aEJhZGdlKTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlclBvc3RDbGljayhwb3N0OiBIVE1MRWxlbWVudCkge1xuICBjb25zdCB0aXRsZUxpbmsgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdhW2hyZWYqPVwiL2RldGFpbHMvXCJdLCBoMiBhJyk7XG4gIGlmICh0aXRsZUxpbmspIHtcbiAgICB0aXRsZUxpbmsuY2xpY2soKTtcbiAgfSBlbHNlIHtcbiAgICBwb3N0LmNsaWNrKCk7XG4gIH1cbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNDTyxRQUFNLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMkI5QixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQVVNLFFBQU0sdUJBQXVCO0FBRzdCLFFBQU0sb0JBQW9CO0FBSzFCLFFBQU0sbUJBQW1CLDJCQUEyQjtBQUFBLElBQ3pEO0FBQUEsRUFDRixDQUFDO0FDakRELFFBQU0sV0FBVztBQUNqQixRQUFNLGtCQUFrQjtBQUd4QixRQUFNLGdCQUFnQjtBQUN0QixRQUFNLGlCQUFpQixHQUFHLGFBQWE7QUFFaEMsV0FBUyxlQUFxQjtBQUNuQyxRQUFJLE9BQU8sYUFBYSxZQUFhO0FBQ3JDLFFBQUksU0FBUyxlQUFlLFFBQVEsRUFBRztBQUV2QyxVQUFNLFFBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsVUFBTSxLQUFLO0FBQ1gsVUFBTSxjQUFjO0FBQUE7QUFBQSwwQkFFSSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBeUtULHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUF3SnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUE2UzNCLEtBQUE7QUFFRixLQUFDLFNBQVMsUUFBUSxTQUFTLGlCQUFpQixZQUFZLEtBQUs7QUFBQSxFQUMvRDtBQ3BuQk8sV0FBUyxhQUFzQjtBQUNwQyxRQUFJLE9BQU8sYUFBYSxZQUFhLFFBQU87QUFHNUMsVUFBTSxXQUFXLFNBQVMsZ0JBQWdCLGFBQWEsd0JBQXdCO0FBQy9FLFFBQUksYUFBYSxPQUFRLFFBQU87QUFDaEMsUUFBSSxhQUFhLFFBQVMsUUFBTztBQUlqQyxVQUFNLGFBQWEsQ0FBQyxRQUFRLGNBQWMsY0FBYyxTQUFTLGdCQUFnQjtBQUNqRixVQUFNLGFBQWEsU0FBUyxnQkFBZ0IsYUFBYSxJQUFJLFlBQUE7QUFDN0QsVUFBTSxhQUFhLFNBQVMsS0FBSyxhQUFhLElBQUksWUFBQTtBQUNsRCxRQUFJLFdBQVcsS0FBSyxDQUFBLFVBQVMsVUFBVSxTQUFTLEtBQUssS0FBSyxVQUFVLFNBQVMsS0FBSyxDQUFDLEdBQUc7QUFDcEYsYUFBTztBQUFBLElBQ1Q7QUFJQSxVQUFNLFVBQ0osU0FBUyxjQUEyQiwwQkFBMEIsS0FDOUQsU0FBUyxjQUEyQixlQUFlLEtBQ25ELFNBQVM7QUFFWCxVQUFNLFVBQVUsNEJBQTRCLE9BQU87QUFDbkQsVUFBTSxhQUFhLGdCQUFnQixPQUFPO0FBSzFDLFdBQU8sYUFBYTtBQUFBLEVBQ3RCO0FBTUEsV0FBUyw0QkFBNEIsT0FBNEI7QUFDL0QsUUFBSSxLQUF5QjtBQUU3QixVQUFNLGdCQUFnQixDQUFDLE1BQ3JCLENBQUMsS0FBSyxNQUFNLGlCQUFpQixNQUFNO0FBRXJDLFdBQU8sSUFBSTtBQUNULFlBQU0sUUFBUSxPQUFPLGlCQUFpQixFQUFFO0FBQ3hDLFlBQU0sS0FBSyxNQUFNO0FBQ2pCLFVBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRyxRQUFPO0FBQy9CLFdBQUssR0FBRztBQUFBLElBQ1Y7QUFHQSxVQUFNLFlBQVksT0FBTyxpQkFBaUIsU0FBUyxlQUFlO0FBQ2xFLFVBQU0sU0FBUyxVQUFVO0FBQ3pCLFFBQUksQ0FBQyxjQUFjLE1BQU0sRUFBRyxRQUFPO0FBR25DLFdBQU87QUFBQSxFQUNUO0FBTUEsV0FBUyxnQkFBZ0IsV0FBMkI7QUFDbEQsVUFBTSxRQUFRLFVBQVUsTUFBTSx5QkFBeUI7QUFDdkQsUUFBSSxDQUFDLE9BQU87QUFFVixhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sSUFBSSxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDL0IsVUFBTSxJQUFJLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUMvQixVQUFNLElBQUksU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBRy9CLFVBQU0sYUFBYSxLQUFLO0FBQUEsTUFDdEIsU0FBUyxJQUFJLEtBQ2IsU0FBUyxJQUFJLEtBQ2IsU0FBUyxJQUFJO0FBQUEsSUFBQTtBQUdmLFdBQU87QUFBQSxFQUNUO0FDM0ZBLFFBQU0sZUFBb0M7QUFBQSxJQUN4QyxJQUFJLEVBQUUsVUFBVSxZQUFZLGFBQWEsZ0JBQWdCLFFBQVEsV0FBVyxZQUFZLGNBQWMsT0FBTyxTQUFTLFFBQVEsb0JBQW9CLGNBQWMsWUFBWSxZQUFZLGtCQUFrQixVQUFVLFlBQVksUUFBUSxTQUFBO0FBQUEsSUFDeE8sSUFBSSxFQUFFLFVBQVUsU0FBUyxhQUFhLGlCQUFpQixRQUFRLFdBQVcsWUFBWSxjQUFjLE9BQU8sT0FBTyxRQUFRLGdCQUFnQixjQUFjLFNBQVMsWUFBWSxjQUFjLFVBQVUsV0FBVyxRQUFRLGFBQUE7QUFBQSxJQUN4TixJQUFJLEVBQUUsVUFBVSxVQUFVLGFBQWEsUUFBUSxRQUFRLFFBQVEsWUFBWSxNQUFNLE9BQU8sT0FBTyxRQUFRLFdBQVcsY0FBYyxVQUFVLFlBQVksY0FBYyxVQUFVLFVBQVUsUUFBUSxPQUFBO0FBQUEsSUFDaE0sSUFBSSxFQUFFLFVBQVUsYUFBYSxhQUFhLGdCQUFnQixRQUFRLGVBQWUsWUFBWSxjQUFjLE9BQU8sU0FBUyxRQUFRLHNCQUFzQixjQUFjLGFBQWEsWUFBWSxtQkFBbUIsVUFBVSxlQUFlLFFBQVEsVUFBQTtBQUFBLElBQ3BQLElBQUksRUFBRSxVQUFVLFdBQVcsYUFBYSxlQUFlLFFBQVEsZUFBZSxZQUFZLFNBQVMsT0FBTyxVQUFVLFFBQVEsWUFBWSxjQUFjLFdBQVcsWUFBWSxrQkFBa0IsVUFBVSxjQUFjLFFBQVEsVUFBQTtBQUFBLElBQy9OLElBQUksRUFBRSxVQUFVLFVBQVUsYUFBYSxhQUFhLFFBQVEsYUFBYSxZQUFZLFdBQVcsT0FBTyxRQUFRLFFBQVEsb0JBQW9CLGNBQWMsVUFBVSxZQUFZLG1CQUFtQixVQUFVLGVBQWUsUUFBUSxVQUFBO0FBQUEsSUFDbk8sU0FBUyxFQUFFLFVBQVUsZUFBZSxhQUFhLGtCQUFrQixRQUFRLGFBQWEsWUFBWSxnQkFBZ0IsT0FBTyxRQUFRLFFBQVEseUJBQXlCLGNBQWMsZUFBZSxZQUFZLG1CQUFtQixVQUFVLGVBQWUsUUFBUSxVQUFBO0FBQUEsSUFDalEsU0FBUyxFQUFFLFVBQVUsTUFBTSxhQUFhLFFBQVEsUUFBUSxRQUFRLFlBQVksT0FBTyxPQUFPLE1BQU0sUUFBUSxRQUFRLGNBQWMsTUFBTSxZQUFZLFFBQVEsVUFBVSxPQUFPLFFBQVEsTUFBQTtBQUFBLElBQ2pMLFNBQVMsRUFBRSxVQUFVLE1BQU0sYUFBYSxRQUFRLFFBQVEsUUFBUSxZQUFZLE9BQU8sT0FBTyxNQUFNLFFBQVEsUUFBUSxjQUFjLE1BQU0sWUFBWSxRQUFRLFVBQVUsT0FBTyxRQUFRLE1BQUE7QUFBQSxJQUNqTCxJQUFJLEVBQUUsVUFBVSxlQUFlLGFBQWEsbUJBQW1CLFFBQVEsVUFBVSxZQUFZLGNBQWMsT0FBTyxVQUFVLFFBQVEsVUFBVSxjQUFjLGVBQWUsWUFBWSx5QkFBeUIsVUFBVSxnQkFBZ0IsUUFBUSxVQUFBO0FBQUEsSUFDbFAsSUFBSSxFQUFFLFVBQVUsaUJBQWlCLGFBQWEsVUFBVSxRQUFRLGNBQWMsWUFBWSxVQUFVLE9BQU8sVUFBVSxRQUFRLG1CQUFtQixjQUFjLGlCQUFpQixZQUFZLHNCQUFzQixVQUFVLGNBQWMsUUFBUSxhQUFBO0FBQUEsSUFDalAsSUFBSSxFQUFFLFVBQVUsV0FBVyxhQUFhLGlCQUFpQixRQUFRLGFBQWEsWUFBWSxhQUFhLE9BQU8sVUFBVSxRQUFRLFlBQVksY0FBYyxXQUFXLFlBQVksbUJBQW1CLFVBQVUsWUFBWSxRQUFRLGFBQUE7QUFBQSxJQUNsTyxJQUFJLEVBQUUsVUFBVSxXQUFXLGFBQWEsZUFBZSxRQUFRLFlBQVksWUFBWSxXQUFXLE9BQU8sVUFBVSxRQUFRLFNBQVMsY0FBYyxXQUFXLFlBQVksc0JBQXNCLFVBQVUsZ0JBQWdCLFFBQVEsV0FBQTtBQUFBLElBQ2pPLElBQUksRUFBRSxVQUFVLFFBQVEsYUFBYSxXQUFXLFFBQVEsU0FBUyxZQUFZLE1BQU0sT0FBTyxNQUFNLFFBQVEsT0FBTyxjQUFjLFFBQVEsWUFBWSxXQUFXLFVBQVUsUUFBUSxRQUFRLE1BQUE7QUFBQSxJQUN0TCxJQUFJLEVBQUUsVUFBVSxTQUFTLGFBQWEsZ0JBQWdCLFFBQVEsY0FBYyxZQUFZLGFBQWEsT0FBTyxRQUFRLFFBQVEsY0FBYyxjQUFjLFNBQVMsWUFBWSxlQUFlLFVBQVUsU0FBUyxRQUFRLGFBQUE7QUFBQSxJQUN2TixJQUFJLEVBQUUsVUFBVSxhQUFhLGFBQWEsYUFBYSxRQUFRLGFBQWEsWUFBWSxVQUFVLE9BQU8sT0FBTyxRQUFRLGFBQWEsY0FBYyxhQUFhLFlBQVksbUJBQW1CLFVBQVUsWUFBWSxRQUFRLGVBQUE7QUFBQSxJQUM3TixJQUFJLEVBQUUsVUFBVSxZQUFZLGFBQWEsY0FBYyxRQUFRLFlBQVksWUFBWSxXQUFXLE9BQU8sYUFBYSxRQUFRLFVBQVUsY0FBYyxZQUFZLFlBQVksa0JBQWtCLFVBQVUsWUFBWSxRQUFRLFNBQUE7QUFBQSxJQUM5TixJQUFJLEVBQUUsVUFBVSxhQUFhLGFBQWEsY0FBYyxRQUFRLFdBQVcsWUFBWSxhQUFhLE9BQU8sY0FBYyxRQUFRLFdBQVcsY0FBYyxhQUFhLFlBQVksaUJBQWlCLFVBQVUsZUFBZSxRQUFRLFlBQUE7QUFBQSxJQUNyTyxJQUFJLEVBQUUsVUFBVSxXQUFXLGFBQWEsZUFBZSxRQUFRLFVBQVUsWUFBWSxXQUFXLE9BQU8sUUFBUSxRQUFRLGFBQWEsY0FBYyxXQUFXLFlBQVksc0JBQXNCLFVBQVUsY0FBYyxRQUFRLFlBQUE7QUFBQSxJQUMvTixJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsZUFBZSxRQUFRLGFBQWEsWUFBWSxTQUFTLE9BQU8sUUFBUSxRQUFRLFlBQVksY0FBYyxjQUFjLFlBQVksbUJBQW1CLFVBQVUsWUFBWSxRQUFRLFVBQUE7QUFBQSxJQUNoTyxJQUFJLEVBQUUsVUFBVSxXQUFXLGFBQWEsa0JBQWtCLFFBQVEsZ0JBQWdCLFlBQVksV0FBVyxPQUFPLFVBQVUsUUFBUSxpQkFBaUIsY0FBYyxXQUFXLFlBQVksaUJBQWlCLFVBQVUsY0FBYyxRQUFRLFdBQUE7QUFBQSxJQUN6TyxJQUFJLEVBQUUsVUFBVSxXQUFXLGFBQWEsb0JBQW9CLFFBQVEsaUJBQWlCLFlBQVksVUFBVSxPQUFPLFFBQVEsUUFBUSxRQUFRLGNBQWMsV0FBVyxZQUFZLGdCQUFnQixVQUFVLFlBQVksUUFBUSxVQUFBO0FBQUEsSUFDN04sSUFBSSxFQUFFLFVBQVUsYUFBYSxhQUFhLHVCQUF1QixRQUFRLG9CQUFvQixZQUFZLGNBQWMsT0FBTyxRQUFRLFFBQVEsYUFBYSxjQUFjLGFBQWEsWUFBWSxvQkFBb0IsVUFBVSxhQUFhLFFBQVEsZUFBQTtBQUFBLElBQ3JQLElBQUksRUFBRSxVQUFVLFdBQVcsYUFBYSxvQkFBb0IsUUFBUSxvQkFBb0IsWUFBWSxTQUFTLE9BQU8sVUFBVSxRQUFRLFdBQVcsY0FBYyxXQUFXLFlBQVksa0JBQWtCLFVBQVUsYUFBYSxRQUFRLFVBQUE7QUFBQSxJQUN2TyxJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsb0JBQW9CLFFBQVEsbUJBQW1CLFlBQVksYUFBYSxPQUFPLFFBQVEsUUFBUSxVQUFVLGNBQWMsY0FBYyxZQUFZLHNCQUFzQixVQUFVLGNBQWMsUUFBUSxrQkFBQTtBQUFBLElBQ2xQLElBQUksRUFBRSxVQUFVLFlBQVksYUFBYSx1QkFBdUIsUUFBUSxjQUFjLFlBQVksUUFBUSxPQUFPLFFBQVEsUUFBUSxTQUFTLGNBQWMsWUFBWSxZQUFZLGlCQUFpQixVQUFVLFNBQVMsUUFBUSxZQUFBO0FBQUEsSUFDNU4sSUFBSSxFQUFFLFVBQVUsV0FBVyxhQUFhLHlCQUF5QixRQUFRLGdCQUFnQixZQUFZLFNBQVMsT0FBTyxPQUFPLFFBQVEsVUFBVSxjQUFjLFdBQVcsWUFBWSxnQkFBZ0IsVUFBVSxZQUFZLFFBQVEsVUFBQTtBQUFBLElBQ2pPLElBQUksRUFBRSxVQUFVLGFBQWEsYUFBYSx3QkFBd0IsUUFBUSxxQkFBcUIsWUFBWSxnQkFBZ0IsT0FBTyxPQUFPLFFBQVEsY0FBYyxjQUFjLGFBQWEsWUFBWSxvQkFBb0IsVUFBVSxlQUFlLFFBQVEsZ0JBQUE7QUFBQSxJQUMzUCxJQUFJLEVBQUUsVUFBVSxXQUFXLGFBQWEsdUJBQXVCLFFBQVEsa0JBQWtCLFlBQVksZUFBZSxPQUFPLFNBQVMsUUFBUSxpQkFBaUIsY0FBYyxXQUFXLFlBQVksb0JBQW9CLFVBQVUsZ0JBQWdCLFFBQVEsZ0JBQUE7QUFBQSxJQUN4UCxJQUFJLEVBQUUsVUFBVSxlQUFlLGFBQWEsaUJBQWlCLFFBQVEsV0FBVyxZQUFZLFVBQVUsT0FBTyxXQUFXLFFBQVEsWUFBWSxjQUFjLGVBQWUsWUFBWSx1QkFBdUIsVUFBVSxjQUFjLFFBQVEsVUFBQTtBQUFBLElBQzVPLElBQUksRUFBRSxVQUFVLFFBQVEsYUFBYSxTQUFTLFFBQVEsZUFBZSxZQUFZLGdCQUFnQixPQUFPLFVBQVUsUUFBUSxZQUFZLGNBQWMsUUFBUSxZQUFZLGdCQUFnQixVQUFVLFVBQVUsUUFBUSxnQkFBQTtBQUFBLElBQ3BOLElBQUksRUFBRSxVQUFVLFlBQVksYUFBYSxjQUFjLFFBQVEsWUFBWSxZQUFZLFdBQVcsT0FBTyxTQUFTLFFBQVEsWUFBWSxjQUFjLFlBQVksWUFBWSxrQkFBa0IsVUFBVSxhQUFhLFFBQVEsV0FBQTtBQUFBLElBQzdOLElBQUksRUFBRSxVQUFVLGNBQWMsYUFBYSxnQkFBZ0IsUUFBUSxnQkFBZ0IsWUFBWSxhQUFhLE9BQU8sVUFBVSxRQUFRLFVBQVUsY0FBYyxjQUFjLFlBQVkscUJBQXFCLFVBQVUsY0FBYyxRQUFRLFlBQUE7QUFBQSxJQUM1TyxJQUFJLEVBQUUsVUFBVSxZQUFZLGFBQWEsYUFBYSxRQUFRLGdCQUFnQixZQUFZLFFBQVEsT0FBTyxRQUFRLFFBQVEsZUFBZSxjQUFjLFlBQVksWUFBWSxrQkFBa0IsVUFBVSxjQUFjLFFBQVEsY0FBQTtBQUFBLElBQ2hPLElBQUksRUFBRSxVQUFVLGFBQWEsYUFBYSxlQUFlLFFBQVEsYUFBYSxZQUFZLFNBQVMsT0FBTyxPQUFPLFFBQVEsaUJBQWlCLGNBQWMsYUFBYSxZQUFZLHFCQUFxQixVQUFVLGVBQWUsUUFBUSxZQUFBO0FBQUEsSUFDdk8sSUFBSSxFQUFFLFVBQVUsUUFBUSxhQUFhLFdBQVcsUUFBUSxXQUFXLFlBQVksVUFBVSxPQUFPLFFBQVEsUUFBUSxnQkFBZ0IsY0FBYyxRQUFRLFlBQVksbUJBQW1CLFVBQVUsZUFBZSxRQUFRLFlBQUE7QUFBQSxJQUN0TixJQUFJLEVBQUUsVUFBVSxTQUFTLGFBQWEsYUFBYSxRQUFRLGNBQWMsWUFBWSxXQUFXLE9BQU8sU0FBUyxRQUFRLGdCQUFnQixjQUFjLFNBQVMsWUFBWSxjQUFjLFVBQVUsY0FBYyxRQUFRLFdBQUE7QUFBQSxJQUN6TixJQUFJLEVBQUUsVUFBVSxZQUFZLGFBQWEsZUFBZSxRQUFRLFdBQVcsWUFBWSxVQUFVLE9BQU8sUUFBUSxRQUFRLGNBQWMsY0FBYyxZQUFZLFlBQVksbUJBQW1CLFVBQVUsZUFBZSxRQUFRLFdBQUE7QUFBQSxJQUNoTyxJQUFJLEVBQUUsVUFBVSxTQUFTLGFBQWEsVUFBVSxRQUFRLFNBQVMsWUFBWSxTQUFTLE9BQU8sU0FBUyxRQUFRLFFBQVEsY0FBYyxTQUFTLFlBQVksZUFBZSxVQUFVLFVBQVUsUUFBUSxPQUFBO0FBQUEsSUFDcE0sSUFBSSxFQUFFLFVBQVUsVUFBVSxhQUFhLGlCQUFpQixRQUFRLGNBQWMsWUFBWSxZQUFZLE9BQU8sT0FBTyxRQUFRLFVBQVUsY0FBYyxVQUFVLFlBQVksZUFBZSxVQUFVLE9BQU8sUUFBUSxhQUFBO0FBQUEsSUFDbE4sS0FBSyxFQUFFLFVBQVUsY0FBYyxhQUFhLG1CQUFtQixRQUFRLGdCQUFnQixZQUFZLFlBQVksT0FBTyxTQUFTLFFBQVEsV0FBVyxjQUFjLGNBQWMsWUFBWSx1QkFBdUIsVUFBVSxlQUFlLFFBQVEsVUFBQTtBQUFBLElBQ2xQLElBQUksRUFBRSxVQUFVLGNBQWMsYUFBYSxpQkFBaUIsUUFBUSxZQUFZLFlBQVksV0FBVyxPQUFPLFNBQVMsUUFBUSxVQUFVLGNBQWMsY0FBYyxZQUFZLHFCQUFxQixVQUFVLFNBQVMsUUFBUSxTQUFBO0FBQUEsSUFDak8sSUFBSSxFQUFFLFVBQVUsV0FBVyxhQUFhLGVBQWUsUUFBUSxjQUFjLFlBQVksWUFBWSxPQUFPLFVBQVUsUUFBUSxjQUFjLGNBQWMsV0FBVyxZQUFZLG1CQUFtQixVQUFVLGFBQWEsUUFBUSxXQUFBO0FBQUEsSUFDbk8sSUFBSSxFQUFFLFVBQVUsWUFBWSxhQUFhLGVBQWUsUUFBUSxXQUFXLFlBQVksVUFBVSxPQUFPLFNBQVMsUUFBUSxZQUFZLGNBQWMsWUFBWSxZQUFZLHFCQUFxQixVQUFVLGNBQWMsUUFBUSxXQUFBO0FBQUEsSUFDaE8sSUFBSSxFQUFFLFVBQVUsV0FBVyxhQUFhLGNBQWMsUUFBUSxTQUFTLFlBQVksVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLGNBQWMsV0FBVyxZQUFZLG1CQUFtQixVQUFVLGFBQWEsUUFBUSxjQUFBO0FBQUEsSUFDM04sSUFBSSxFQUFFLFVBQVUsV0FBVyxhQUFhLGdCQUFnQixRQUFRLGNBQWMsWUFBWSxVQUFVLE9BQU8sVUFBVSxRQUFRLGNBQWMsY0FBYyxXQUFXLFlBQVksb0JBQW9CLFVBQVUsYUFBYSxRQUFRLFVBQUE7QUFBQSxJQUNuTyxJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsY0FBYyxRQUFRLFlBQVksWUFBWSxVQUFVLE9BQU8sVUFBVSxRQUFRLGFBQWEsY0FBYyxjQUFjLFlBQVkseUJBQXlCLFVBQVUsY0FBYyxRQUFRLFlBQUE7QUFBQSxJQUMxTyxJQUFJLEVBQUUsVUFBVSxnQkFBZ0IsYUFBYSxnQkFBZ0IsUUFBUSxXQUFXLFlBQVksWUFBWSxPQUFPLFNBQVMsUUFBUSxjQUFjLGNBQWMsZ0JBQWdCLFlBQVksb0JBQW9CLFVBQVUsYUFBYSxRQUFRLFdBQUE7QUFBQSxJQUMzTyxJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsY0FBYyxRQUFRLFlBQVksWUFBWSxVQUFVLE9BQU8sUUFBUSxRQUFRLGdCQUFnQixjQUFjLGNBQWMsWUFBWSx1QkFBdUIsVUFBVSxlQUFlLFFBQVEsV0FBQTtBQUFBLElBQzFPLElBQUksRUFBRSxVQUFVLFVBQVUsYUFBYSxlQUFlLFFBQVEsYUFBYSxZQUFZLFdBQVcsT0FBTyxVQUFVLFFBQVEsY0FBYyxjQUFjLFVBQVUsWUFBWSxnQkFBZ0IsVUFBVSxlQUFlLFFBQVEsVUFBQTtBQUFBLElBQzlOLElBQUksRUFBRSxVQUFVLGNBQWMsYUFBYSxpQkFBaUIsUUFBUSxjQUFjLFlBQVksZUFBZSxPQUFPLFNBQVMsUUFBUSxjQUFjLGNBQWMsY0FBYyxZQUFZLHFCQUFxQixVQUFVLGNBQWMsUUFBUSxTQUFBO0FBQUEsSUFDaFAsSUFBSSxFQUFFLFVBQVUsVUFBVSxhQUFhLFlBQVksUUFBUSxZQUFZLFlBQVksU0FBUyxPQUFPLFFBQVEsUUFBUSxXQUFXLGNBQWMsVUFBVSxZQUFZLGtCQUFrQixVQUFVLGNBQWMsUUFBUSxhQUFBO0FBQUEsSUFDcE4sSUFBSSxFQUFFLFVBQVUsUUFBUSxhQUFhLGFBQWEsUUFBUSxhQUFhLFlBQVksUUFBUSxPQUFPLFFBQVEsUUFBUSxXQUFXLGNBQWMsUUFBUSxZQUFZLFlBQVksVUFBVSxXQUFXLFFBQVEsVUFBQTtBQUFBLElBQ3hNLElBQUksRUFBRSxVQUFVLGFBQWEsYUFBYSxlQUFlLFFBQVEsY0FBYyxZQUFZLFlBQVksT0FBTyxRQUFRLFFBQVEsYUFBYSxjQUFjLGFBQWEsWUFBWSxtQkFBbUIsVUFBVSxtQkFBbUIsUUFBUSxjQUFBO0FBQUEsSUFDMU8sSUFBSSxFQUFFLFVBQVUsWUFBWSxhQUFhLG9CQUFvQixRQUFRLG1CQUFtQixZQUFZLFlBQVksT0FBTyxVQUFVLFFBQVEsWUFBWSxjQUFjLFlBQVksWUFBWSxrQkFBa0IsVUFBVSxXQUFXLFFBQVEsV0FBQTtBQUFBLElBQzFPLElBQUksRUFBRSxVQUFVLFNBQVMsYUFBYSxhQUFhLFFBQVEsZ0JBQWdCLFlBQVksU0FBUyxPQUFPLFFBQVEsUUFBUSxhQUFhLGNBQWMsU0FBUyxZQUFZLG1CQUFtQixVQUFVLFFBQVEsUUFBUSxpQkFBQTtBQUFBLElBQ3BOLElBQUksRUFBRSxVQUFVLGNBQWMsYUFBYSxpQkFBaUIsUUFBUSxhQUFhLFlBQVksVUFBVSxPQUFPLFdBQVcsUUFBUSxpQkFBaUIsY0FBYyxjQUFjLFlBQVksb0JBQW9CLFVBQVUsV0FBVyxRQUFRLFdBQUE7QUFBQSxJQUMzTyxJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsc0JBQXNCLFFBQVEsZUFBZSxZQUFZLGFBQWEsT0FBTyxTQUFTLFFBQVEsaUJBQWlCLGNBQWMsY0FBYyxZQUFZLG9CQUFvQixVQUFVLGdCQUFnQixRQUFRLGNBQUE7QUFBQSxJQUN4UCxJQUFJLEVBQUUsVUFBVSxhQUFhLGFBQWEsZ0JBQWdCLFFBQVEsYUFBYSxZQUFZLGNBQWMsT0FBTyxRQUFRLFFBQVEsV0FBVyxjQUFjLGFBQWEsWUFBWSxtQkFBbUIsVUFBVSxlQUFlLFFBQVEsVUFBQTtBQUFBLElBQ3RPLElBQUksRUFBRSxVQUFVLGVBQWUsYUFBYSxZQUFZLFFBQVEsYUFBYSxZQUFZLFlBQVksT0FBTyxXQUFXLFFBQVEsaUJBQWlCLGNBQWMsZUFBZSxZQUFZLHNCQUFzQixVQUFVLGFBQWEsUUFBUSxpQkFBQTtBQUFBLElBQzlPLElBQUksRUFBRSxVQUFVLFNBQVMsYUFBYSxVQUFVLFFBQVEsVUFBVSxZQUFZLFFBQVEsT0FBTyxTQUFTLFFBQVEsYUFBYSxjQUFjLFNBQVMsWUFBWSxpQkFBaUIsVUFBVSxVQUFVLFFBQVEsU0FBQTtBQUFBLElBQzNNLElBQUksRUFBRSxVQUFVLGFBQWEsYUFBYSxpQkFBaUIsUUFBUSxnQkFBZ0IsWUFBWSxlQUFlLE9BQU8sV0FBVyxRQUFRLGNBQWMsY0FBYyxhQUFhLFlBQVksa0JBQWtCLFVBQVUsVUFBVSxRQUFRLFlBQUE7QUFBQSxJQUMzTyxJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsY0FBYyxRQUFRLFdBQVcsWUFBWSxZQUFZLE9BQU8sUUFBUSxRQUFRLFdBQVcsY0FBYyxjQUFjLFlBQVksaUJBQWlCLFVBQVUsU0FBUyxRQUFRLGFBQUE7QUFBQSxJQUMxTixJQUFJLEVBQUUsVUFBVSxTQUFTLGFBQWEsZUFBZSxRQUFRLGlCQUFpQixZQUFZLGFBQWEsT0FBTyxTQUFTLFFBQVEsVUFBVSxjQUFjLFNBQVMsWUFBWSxZQUFZLFVBQVUsT0FBTyxRQUFRLGNBQUE7QUFBQSxJQUNqTixJQUFJLEVBQUUsVUFBVSxXQUFXLGFBQWEsaUJBQWlCLFFBQVEsaUJBQWlCLFlBQVksVUFBVSxPQUFPLFVBQVUsUUFBUSxZQUFZLGNBQWMsV0FBVyxZQUFZLGVBQWUsVUFBVSxVQUFVLFFBQVEsWUFBQTtBQUFBLElBQzdOLElBQUksRUFBRSxVQUFVLFdBQVcsYUFBYSxjQUFjLFFBQVEsZ0JBQWdCLFlBQVksVUFBVSxPQUFPLFVBQVUsUUFBUSxjQUFjLGNBQWMsV0FBVyxZQUFZLGtCQUFrQixVQUFVLGFBQWEsUUFBUSxXQUFBO0FBQUEsSUFDak8sSUFBSSxFQUFFLFVBQVUsU0FBUyxhQUFhLGdCQUFnQixRQUFRLGlCQUFpQixZQUFZLFVBQVUsT0FBTyxTQUFTLFFBQVEsY0FBYyxjQUFjLFNBQVMsWUFBWSxnQkFBZ0IsVUFBVSxhQUFhLFFBQVEsU0FBQTtBQUFBLElBQzdOLElBQUksRUFBRSxVQUFVLFdBQVcsYUFBYSxrQkFBa0IsUUFBUSxpQkFBaUIsWUFBWSxZQUFZLE9BQU8sVUFBVSxRQUFRLFlBQVksY0FBYyxXQUFXLFlBQVksZ0JBQWdCLFVBQVUsY0FBYyxRQUFRLFdBQUE7QUFBQSxJQUNyTyxJQUFJLEVBQUUsVUFBVSxZQUFZLGFBQWEsbUJBQW1CLFFBQVEsaUJBQWlCLFlBQVksY0FBYyxPQUFPLFVBQVUsUUFBUSxhQUFhLGNBQWMsWUFBWSxZQUFZLGtCQUFrQixVQUFVLFdBQVcsUUFBUSxXQUFBO0FBQUEsSUFDMU8sSUFBSSxFQUFFLFVBQVUsVUFBVSxhQUFhLGdCQUFnQixRQUFRLGtCQUFrQixZQUFZLFNBQVMsT0FBTyxVQUFVLFFBQVEsYUFBYSxjQUFjLFVBQVUsWUFBWSxxQkFBcUIsVUFBVSxTQUFTLFFBQVEsV0FBQTtBQUFBLElBQ2hPLElBQUksRUFBRSxVQUFVLFNBQVMsYUFBYSxhQUFhLFFBQVEsY0FBYyxZQUFZLGVBQWUsT0FBTyxZQUFZLFFBQVEsZUFBZSxjQUFjLFNBQVMsWUFBWSxnQkFBZ0IsVUFBVSxTQUFTLFFBQVEsY0FBQTtBQUFBLElBQzVOLElBQUksRUFBRSxVQUFVLFdBQVcsYUFBYSxnQkFBZ0IsUUFBUSxnQkFBZ0IsWUFBWSxVQUFVLE9BQU8sUUFBUSxRQUFRLG9CQUFvQixjQUFjLFdBQVcsWUFBWSxlQUFlLFVBQVUsWUFBWSxRQUFRLGVBQUE7QUFBQSxJQUNuTyxJQUFJLEVBQUUsVUFBVSxjQUFjLGFBQWEsa0JBQWtCLFFBQVEsY0FBYyxZQUFZLGdCQUFnQixPQUFPLFNBQVMsUUFBUSxZQUFZLGNBQWMsY0FBYyxZQUFZLHFCQUFxQixVQUFVLFlBQVksUUFBUSxXQUFBO0FBQUEsSUFDOU8sSUFBSSxFQUFFLFVBQVUsU0FBUyxhQUFhLGNBQWMsUUFBUSxZQUFZLFlBQVksWUFBWSxPQUFPLFdBQVcsUUFBUSxlQUFlLGNBQWMsU0FBUyxZQUFZLHdCQUF3QixVQUFVLFlBQVksUUFBUSxZQUFBO0FBQUEsSUFDbE8sSUFBSSxFQUFFLFVBQVUsV0FBVyxhQUFhLG1CQUFtQixRQUFRLGlCQUFpQixZQUFZLGFBQWEsT0FBTyxTQUFTLFFBQVEsWUFBWSxjQUFjLFdBQVcsWUFBWSxzQkFBc0IsVUFBVSxXQUFXLFFBQVEsY0FBQTtBQUFBLEVBQzNPO0FBSU8sV0FBUyxFQUFFLEtBQXNCO0FBQ3RDLFFBQUk7QUFDRixVQUFJLENBQUMsT0FBTyxPQUFPLFFBQVEsU0FBVTtBQUlyQyxVQUFJLFVBQVU7QUFDZCxVQUFJLE9BQU8sYUFBYSxlQUFlLFNBQVMsbUJBQW1CLFNBQVMsZ0JBQWdCLE1BQU07QUFDaEcsa0JBQVUsU0FBUyxnQkFBZ0I7QUFBQSxNQUNyQyxXQUFXLE9BQU8sY0FBYyxlQUFlLFVBQVUsVUFBVTtBQUNqRSxrQkFBVSxVQUFVO0FBQUEsTUFDdEI7QUFFQSxZQUFNLGlCQUFpQixRQUFRLFlBQUEsRUFBYyxNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQUUsS0FBQSxFQUFPLFFBQVEsS0FBSyxHQUFHO0FBQ2xGLFlBQU0sV0FBVyxlQUFlLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFNUMsVUFBSSxhQUFhLGNBQWMsS0FBSyxPQUFPLGFBQWEsY0FBYyxFQUFFLEdBQUcsTUFBTSxVQUFVO0FBQ3pGLGVBQU8sYUFBYSxjQUFjLEVBQUUsR0FBRztBQUFBLE1BQ3pDO0FBRUEsVUFBSSxhQUFhLFFBQVEsS0FBSyxPQUFPLGFBQWEsUUFBUSxFQUFFLEdBQUcsTUFBTSxVQUFVO0FBQzdFLGVBQU8sYUFBYSxRQUFRLEVBQUUsR0FBRztBQUFBLE1BQ25DO0FBRUEsVUFBSSxhQUFhLElBQUksS0FBSyxPQUFPLGFBQWEsSUFBSSxFQUFFLEdBQUcsTUFBTSxVQUFVO0FBQ3JFLGVBQU8sYUFBYSxJQUFJLEVBQUUsR0FBRztBQUFBLE1BQy9CO0FBRUEsYUFBTztBQUFBLElBRVQsU0FBUyxHQUFHO0FBQ1YsVUFBSTtBQUNGLGVBQU8sYUFBYSxJQUFJLEVBQUUsR0FBRyxLQUFLO0FBQUEsTUFDcEMsUUFBUTtBQUNOLGVBQU8sT0FBTyxHQUFpQjtBQUFBLE1BQ2pDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUNySEEsUUFBQSxnQkFBQTtBQUNBLFFBQUEsY0FBQTtBQUdBLE1BQUEsc0JBQUE7QUFHQSxRQUFBLGFBQUEsb0JBQUE7QUFBQSxJQUFtQyxTQUFBLENBQUEsZ0NBQUE7QUFBQSxJQUNTLE9BQUE7QUFBQSxJQUNuQyxPQUFBO0FBRUwsbUJBQUE7QUFDQSx5QkFBQTtBQUdBLFlBQUEsV0FBQSxJQUFBLGlCQUFBLE1BQUE7QUFFRSxZQUFBLG9CQUFBO0FBQ0EsOEJBQUE7QUFFQSw4QkFBQSxNQUFBO0FBQ0UsZ0NBQUE7QUFDQSw2QkFBQTtBQUFBLFFBQW1CLENBQUE7QUFBQSxNQUNwQixDQUFBO0FBR0gsZUFBQSxRQUFBLFNBQUEsTUFBQTtBQUFBLFFBQWdDLFdBQUE7QUFBQSxRQUNuQixTQUFBO0FBQUEsUUFDRixZQUFBO0FBQUEsUUFDRyxpQkFBQSxDQUFBLGNBQUEsT0FBQTtBQUFBLE1BQzJCLENBQUE7QUFJekMsa0JBQUEsTUFBQTtBQUNFLDJCQUFBO0FBQUEsTUFBbUIsR0FBQSxHQUFBO0FBSXJCLFVBQUEsVUFBQSxTQUFBO0FBQ0EsVUFBQSxpQkFBQSxNQUFBO0FBQ0UsY0FBQSxNQUFBLFNBQUE7QUFDQSxZQUFBLFFBQUEsU0FBQTtBQUNFLG9CQUFBO0FBQ0EscUJBQUEsb0JBQUEsR0FBQTtBQUNBLHFCQUFBLG9CQUFBLElBQUE7QUFBQSxRQUFtQztBQUFBLE1BQ3JDLENBQUEsRUFBQSxRQUFBLFVBQUEsRUFBQSxTQUFBLE1BQUEsV0FBQSxNQUFBO0FBQUEsSUFDcUQ7QUFBQSxFQUUzRCxDQUFBO0FBRUEsV0FBQSxxQkFBQTtBQUNFLFFBQUE7QUFDRSxZQUFBLFlBQUEsaUJBQUE7QUFDQSxlQUFBLEtBQUEsYUFBQSxnQkFBQSxTQUFBO0FBRUEsWUFBQSxhQUFBLEVBQUEsUUFBQSxFQUFBLFlBQUE7QUFDQSxZQUFBLFFBQUEsU0FBQSxpQkFBQSxhQUFBO0FBRUEsWUFBQSxRQUFBLENBQUEsU0FBQTtBQUNFLFlBQUEsbUJBQUE7QUFFQSxZQUFBLEtBQUEsYUFBQSxXQUFBLEdBQUE7QUFDRSxnQkFBQSxtQkFBQSxDQUFBLENBQUEsS0FBQSxjQUFBLG1DQUFBLEtBQUEsQ0FBQSxDQUFBLEtBQUEsY0FBQSxtQkFBQSxLQUFBLENBQUEsQ0FBQSxLQUFBLGNBQUEsaUJBQUE7QUFLQSxjQUFBLENBQUEsa0JBQUE7QUFDRSxpQkFBQSxnQkFBQSxXQUFBO0FBQUEsVUFBZ0MsT0FBQTtBQUVoQywrQkFBQTtBQUFBLFVBQW1CO0FBQUEsUUFDckI7QUFHRixZQUFBLENBQUEsa0JBQUE7QUFDRSxnQkFBQSxhQUFBLE1BQUE7QUFBQSxZQUF5QixLQUFBLGlCQUFBLDBCQUFBO0FBQUEsVUFDc0M7QUFHL0QsY0FBQSxRQUFBO0FBQ0EsY0FBQSxXQUFBO0FBRUEscUJBQUEsTUFBQSxZQUFBO0FBQ0Usa0JBQUEsUUFBQSxHQUFBLGVBQUEsSUFBQSxLQUFBO0FBQ0Esa0JBQUEsUUFBQSxHQUFBLGFBQUEsWUFBQSxLQUFBLElBQUEsS0FBQTtBQUNBLGtCQUFBLFNBQUEsR0FBQSxhQUFBLE9BQUEsS0FBQSxJQUFBLEtBQUE7QUFFQSxrQkFBQSxXQUFBLEdBQUEsSUFBQSxJQUFBLElBQUEsSUFBQSxLQUFBLEdBQUEsWUFBQTtBQUVBLGdCQUFBLENBQUEsU0FBQSxTQUFBLFVBQUEsRUFBQTtBQUVBLGdCQUFBLGFBQUE7QUFDQSxnQkFBQSxXQUFBLFNBQUEsS0FBQSxDQUFBLFdBQUEsWUFBQSxFQUFBLFNBQUEsVUFBQSxHQUFBO0FBSUUsMkJBQUEsUUFBQSxTQUFBO0FBQUEsWUFBOEI7QUFHaEMsdUJBQUEsa0JBQUEsWUFBQSxVQUFBLEtBQUE7QUFDQSxvQkFBQTtBQUNBO0FBQUEsVUFBQTtBQUdGLGNBQUEsU0FBQSxhQUFBLE1BQUE7QUFDRSxpQkFBQSxhQUFBLGFBQUEsTUFBQTtBQUNBLGdDQUFBLE1BQUEsUUFBQTtBQUFBLFVBQWtDO0FBQUEsUUFDcEM7QUFJRiw2QkFBQSxJQUFBO0FBQUEsTUFBeUIsQ0FBQTtBQUFBLElBQzFCLFFBQUE7QUFBQSxJQUNLO0FBQUEsRUFHVjtBQVdBLFdBQUEsa0JBQUEsVUFBQSxVQUFBO0FBQ0UsUUFBQTtBQUNFLFlBQUEsYUFBQTtBQUdBLFlBQUEsVUFBQSxTQUFBLE1BQUEsVUFBQTtBQUNBLFlBQUEsZUFBQSxvQkFBQSxLQUFBLEdBQUEsWUFBQTtBQUVBLFVBQUEsQ0FBQSxXQUFBLFFBQUEsV0FBQSxHQUFBO0FBQ0UsZUFBQTtBQUFBLE1BQU87QUFHVCxZQUFBLFlBQUEsQ0FBQSxNQUFBO0FBQ0UsY0FBQSxJQUFBLG9CQUFBLEtBQUEsR0FBQSxFQUFBLE1BQUEsSUFBQSxXQUFBLEVBQUE7QUFDQSxlQUFBLE1BQUEsRUFBQSxRQUFBLENBQUEsSUFBQSxPQUFBO0FBQUEsTUFBbUM7QUFHckMsVUFBQSxjQUFBO0FBQ0EsVUFBQSxhQUFBO0FBRUEsVUFBQSxRQUFBLFVBQUEsR0FBQTtBQUNFLHNCQUFBLFVBQUEsUUFBQSxDQUFBLENBQUE7QUFDQSxxQkFBQSxVQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQUEsTUFBaUMsT0FBQTtBQUVqQyxzQkFBQSxVQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0EscUJBQUE7QUFBQSxNQUFhO0FBR2YsVUFBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLFFBQUE7QUFFQSxVQUFBLFdBQUEsS0FBQTtBQUFBLFNBQW9CLFdBQUEsUUFBQSxJQUFBLFlBQUEsUUFBQSxNQUFBLE1BQUEsS0FBQSxLQUFBO0FBQUEsTUFFRTtBQUd0QixVQUFBLFdBQUEsRUFBQSxZQUFBO0FBRUEsYUFBQSxJQUFBLFFBQUE7QUFBQSxJQUFtQixRQUFBO0FBRW5CLGFBQUE7QUFBQSxJQUFPO0FBQUEsRUFFWDtBQUVBLFdBQUEsb0JBQUEsTUFBQSxVQUFBO0FBQ0UsVUFBQSxXQUFBLE9BQUEsaUJBQUEsSUFBQTtBQUVBLFFBQUEsU0FBQSxhQUFBLFNBQUEsTUFBQSxNQUFBLFdBQUE7QUFDQSxTQUFBLE1BQUEsWUFBQSxZQUFBLFdBQUEsV0FBQTtBQUNBLFNBQUEsTUFBQSxZQUFBLFdBQUEsUUFBQSxXQUFBO0FBQ0EsU0FBQSxNQUFBLFNBQUE7QUFHQSxRQUFBLFVBQUEsS0FBQSxjQUFBLHdCQUFBO0FBQ0EsUUFBQSxDQUFBLFNBQUE7QUFDRSxnQkFBQSxTQUFBLGNBQUEsS0FBQTtBQUNBLGNBQUEsWUFBQTtBQUNBLGNBQUEsTUFBQSxlQUFBLFNBQUEsZ0JBQUE7QUFDQSxVQUFBLFdBQUEsRUFBQSxTQUFBLFVBQUEsSUFBQSxnQkFBQTtBQUVBLGNBQUEsaUJBQUEsU0FBQSxDQUFBLE1BQUE7QUFDRSxZQUFBLEVBQUEsV0FBQSxTQUFBO0FBQ0UsZ0JBQUEsT0FBQSxLQUFBLGNBQUEsNEJBQUE7QUFDQSxjQUFBLEtBQUEsTUFBQSxNQUFBO0FBQUEsY0FBcUIsTUFBQSxNQUFBO0FBQUEsUUFDTDtBQUFBLE1BQ2xCLENBQUE7QUFHRixXQUFBLFlBQUEsT0FBQTtBQUFBLElBQXdCLE9BQUE7QUFFeEIsY0FBQSxVQUFBLElBQUEsWUFBQTtBQUNBLFVBQUEsV0FBQSxFQUFBLFNBQUEsVUFBQSxJQUFBLGdCQUFBO0FBQUEsSUFBd0Q7QUFJMUQsUUFBQSxLQUFBLGNBQUEsaUJBQUEsR0FBQTtBQUNFO0FBQUEsSUFBQTtBQUlGLFVBQUEsc0JBQUEsS0FBQSxjQUFBLG1CQUFBO0FBQ0EseUJBQUEsT0FBQTtBQUVBLFVBQUEsT0FBQSxTQUFBLGNBQUEsS0FBQTtBQUNBLFNBQUEsWUFBQTtBQUNBLFFBQUEsV0FBQSxFQUFBLE1BQUEsVUFBQSxJQUFBLGdCQUFBO0FBRUEsVUFBQSxjQUFBLFNBQUEsY0FBQSxLQUFBO0FBQ0EsZ0JBQUEsWUFBQTtBQUNBLGdCQUFBLFlBQUE7QUFDQSxTQUFBLFlBQUEsV0FBQTtBQUVBLFVBQUEsVUFBQSxTQUFBLGNBQUEsS0FBQTtBQUNBLFlBQUEsWUFBQTtBQUVBLFVBQUEsV0FBQSxTQUFBLGNBQUEsTUFBQTtBQUNBLGFBQUEsWUFBQTtBQUNBLGFBQUEsY0FBQTtBQUNBLFlBQUEsWUFBQSxRQUFBO0FBRUEsU0FBQSxZQUFBLE9BQUE7QUFDQSxTQUFBLFlBQUEsSUFBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLG1CQUFBO0FBQ0UsVUFBQSxTQUFBLFNBQUEsZ0JBQUEsT0FBQSxTQUFBLEtBQUE7QUFDQSxXQUFBLFdBQUEsUUFBQSxRQUFBO0FBQUEsRUFDRjtBQVVBLFdBQUEscUJBQUEsTUFBQTtBQUNFLFVBQUEsVUFBQSxLQUFBLGNBQUEsd0JBQUE7QUFDQSxVQUFBLGVBQUEsS0FBQSxjQUFBLG9CQUFBO0FBQ0EsVUFBQSxjQUFBLEtBQUEsY0FBQSxtQkFBQTtBQUNBLFFBQUEsWUFBQSxLQUFBLGNBQUEsaUJBQUE7QUFHQSxVQUFBLGNBQUEsQ0FBQSxDQUFBLGdCQUFBLEtBQUEsYUFBQSxvQkFBQTtBQUVBLFVBQUEsWUFBQSxDQUFBLENBQUEsZUFBQSxLQUFBLGFBQUEsMkJBQUE7QUFJQSxRQUFBLENBQUEsZUFBQSxDQUFBLFdBQUE7QUFFRSxpQkFBQSxPQUFBO0FBQ0E7QUFBQSxJQUFBO0FBTUYsUUFBQSxlQUFBO0FBQ0EsVUFBQSxl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b0JBQW9CLElBQUksU0FBUztBQUMxQyxZQUFJLENBQUMsS0FBSyxPQUFPLFFBQVMsVUFBUyxHQUFHLElBQUk7QUFBQSxNQUM1QyxHQUFHLE9BQU87QUFDVixXQUFLLGNBQWMsTUFBTSxtQkFBbUIsRUFBRSxDQUFDO0FBQy9DLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxpQkFBaUIsUUFBUSxNQUFNLFNBQVMsU0FBUztBQUMvQyxVQUFJLFNBQVMsc0JBQXNCO0FBQ2pDLFlBQUksS0FBSyxRQUFTLE1BQUssZ0JBQWdCLElBQUc7QUFBQSxNQUM1QztBQUNBLGFBQU87QUFBQSxRQUNMLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSTtBQUFBLFFBQ3JEO0FBQUEsUUFDQTtBQUFBLFVBQ0UsR0FBRztBQUFBLFVBQ0gsUUFBUSxLQUFLO0FBQUEsUUFDckI7QUFBQSxNQUNBO0FBQUEsSUFDRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLQSxvQkFBb0I7QUFDbEIsV0FBSyxNQUFNLG9DQUFvQztBQUMvQ0MsZUFBTztBQUFBLFFBQ0wsbUJBQW1CLEtBQUssaUJBQWlCO0FBQUEsTUFDL0M7QUFBQSxJQUNFO0FBQUEsSUFDQSxpQkFBaUI7QUFDZixhQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsTUFBTSxxQkFBcUI7QUFBQSxVQUMzQixtQkFBbUIsS0FBSztBQUFBLFVBQ3hCLFdBQVcsS0FBSyxPQUFNLEVBQUcsU0FBUyxFQUFFLEVBQUUsTUFBTSxDQUFDO0FBQUEsUUFDckQ7QUFBQSxRQUNNO0FBQUEsTUFDTjtBQUFBLElBQ0U7QUFBQSxJQUNBLHlCQUF5QixPQUFPO0FBQzlCLFlBQU0sdUJBQXVCLE1BQU0sTUFBTSxTQUFTLHFCQUFxQjtBQUN2RSxZQUFNLHNCQUFzQixNQUFNLE1BQU0sc0JBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixJQUFJLE1BQU0sTUFBTSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQ3hEO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksWUFBWSxTQUFTLGlCQUFrQjtBQUMzQyxlQUFLLGtCQUFpQjtBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUNBLHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDN0Q7QUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNiw3LDgsOSwxMCwxMV19
editedframe;