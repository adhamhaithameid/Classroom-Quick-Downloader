var content = (function() {
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
  const SUCCESS_ICON_SVG_RAW = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<rect width="160" height="160" fill="url(#pattern0_1_2484)"/>
<defs>
<pattern id="pattern0_1_2484" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_1_2484" transform="scale(0.00625)"/>
</pattern>
<image id="image0_1_2484" width="160" height="160" preserveAspectRatio="none" xlink:href="data:image/png;base64,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"/>
</defs>
</svg>`;
  const ERROR_ICON_SVG_RAW = `<svg fill="none" height="160" viewBox="0 0 160 160" width="160" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <pattern id="a" height="1" patternContentUnits="objectBoundingBox" width="1">
    <image height="160" preserveAspectRatio="none" transform="scale(.00625)" width="160" xlink:href="data:image/png;base64,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"/>
  </pattern>
  <path d="m0 0h160v160h-160z" fill="url(#a)"/>
</svg>`;
  const DOWNLOAD_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    DOWNLOAD_ICON_SVG_RAW
  )}`;
  const SUCCESS_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    SUCCESS_ICON_SVG_RAW
  )}`;
  const ERROR_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    ERROR_ICON_SVG_RAW
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
      --cqd-spinner-border: rgba(255, 255, 255, 0.22); /* dark-ish ring */
      --cqd-spinner-top: #ffffff;                   /* solid dark tip */

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
      --cqd-spinner-border: rgba(15, 23, 42, 0.22);
      --cqd-spinner-top: #0f172a;
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

        /* ===============================
     * 1b. DOWNLOAD ALL BUTTON
     * =============================== */

    .cqd-download-all-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-normal);
      color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      gap: 6px;
      box-shadow: var(--cqd-shadow-base);
      white-space: nowrap;
      transition:
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition),
        background-image var(--cqd-transition);
    }

    body[data-cqd-dir="rtl"] .cqd-download-all-btn {
      right: auto;
      left: 8px;
    }

    .cqd-download-all-btn:hover {
      box-shadow: var(--cqd-shadow-hover);
      transform: translateY(-1px);
    }

    .cqd-download-all-btn:active {
      transform: translateY(0);
    }

    .cqd-download-all-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-all-icon {
      width: 18px;
      height: 18px;
      background-image: url("${DOWNLOAD_ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
      flex-shrink: 0;
    }

    .cqd-download-all-main {
      font-weight: 600;
    }

    .cqd-download-all-sub {
      font-size: 11px;
      opacity: 0.9;
      margin-left: 4px;
    }

  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  const TRANSLATIONS = {
    en: { download: "Download", downloading: "Downloading…", trying: "Trying…", downloaded: "Downloaded", error: "Error", failed: "Download failed.", ariaDownload: "Download", titleQuick: "Quick download", comments: "comments", edited: "Edited", downloadAll: "Download all" },
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
      if (!key || typeof key !== "string") {
        return "...";
      }
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
        return String(key || "Download");
      }
    }
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
  const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
  const INJECTED_ATTR = "data-cqd-injected";
  const RESCAN_INTERVAL_MS = 2500;
  const RESCAN_DEBOUNCE_MS = 250;
  const LOADING_MIN_MS = 600;
  const FEEDBACK_SUCCESS_MS = 2e3;
  const FEEDBACK_ERROR_MS = 4e3;
  const DRIVE_ANCHOR_SELECTOR = 'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';
  const ATTACHMENT_CONTAINER_SELECTOR = [
    ".KlRXdf",
    ".z3vRcc",
    ".VfPpkd-aPP78e",
    "[data-drive-id]",
    "[data-id][data-item-id]"
  ].join(", ");
  const DRIVE_URL_PATTERNS = [
    /https:\/\/drive\.google\.com\/file\/d\//,
    /https:\/\/drive\.google\.com\/open\?/,
    /https:\/\/drive\.google\.com\/uc\?/,
    /https:\/\/classroom\.google\.com\/drive\//
  ];
  let scanTimeoutId = null;
  let observer = null;
  let nextRequestSeq = 1;
  const pendingButtons = /* @__PURE__ */ new Map();
  function isGoogleClassroom() {
    if (typeof location === "undefined") return false;
    if (location.hostname !== "classroom.google.com") return false;
    return CLASSROOM_URL_PATTERN.test(location.href);
  }
  function scheduleScan() {
    if (scanTimeoutId !== null) {
      window.clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = window.setTimeout(() => {
      scanTimeoutId = null;
      scanForAttachments(document);
    }, RESCAN_DEBOUNCE_MS);
  }
  function setupObservers() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      window.addEventListener(
        "DOMContentLoaded",
        () => setupObservers(),
        { once: true }
      );
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const roots = /* @__PURE__ */ new Set();
      for (const m of mutations) {
        if (m.type !== "childList") continue;
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node;
          if (el.hasAttribute && el.getAttribute(INJECTED_ATTR) === "true") {
            return;
          }
          roots.add(el);
        });
      }
      if (roots.size === 0) {
        scheduleScan();
        return;
      }
      roots.forEach((root) => scanForAttachments(root));
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    window.setInterval(() => {
      scheduleScan();
    }, RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments(root = document) {
    if (!isGoogleClassroom()) return;
    injectSingleFileButtons(root);
  }
  function injectSingleFileButtons(root = document) {
    const anchors = Array.from(
      root.querySelectorAll(DRIVE_ANCHOR_SELECTOR)
    );
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container || hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      root.querySelectorAll(
        "[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"
      )
    );
    for (const el of metaElements) {
      if (hasInjectedButton(el)) continue;
      const url = findDriveUrl(el);
      if (!url) continue;
      injectButtonIntoAttachment(el, url);
    }
  }
  function hasInjectedButton(container) {
    return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
  }
  function extractDriveUrlFromAnchor(anchor) {
    const href = anchor.href;
    if (!href) return null;
    return DRIVE_URL_PATTERNS.some((re) => re.test(href)) ? href : null;
  }
  function findDriveUrl(element) {
    const nearAnchor = element.querySelector(DRIVE_ANCHOR_SELECTOR) || element.closest(DRIVE_ANCHOR_SELECTOR);
    if (nearAnchor) {
      const href = extractDriveUrlFromAnchor(nearAnchor);
      if (href) return href;
    }
    const driveId = element.getAttribute("data-drive-id") || element.getAttribute("data-id");
    if (driveId) {
      return toDownloadUrl(
        `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
          driveId
        )}`
      );
    }
    return null;
  }
  function getAuthUser() {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    if (params.has("authuser")) return params.get("authuser");
    if (params.has("u")) return params.get("u");
    const pathMatch = window.location.pathname.match(/\/u\/(\d+)\//);
    if (pathMatch) return pathMatch[1];
    return null;
  }
  function toDownloadUrl(originalUrl, depth = 0) {
    if (depth > 3) return originalUrl;
    const authUser = getAuthUser();
    try {
      const parsed = new URL(originalUrl, location.href);
      const appendAuth = (u) => {
        if (!authUser) return u;
        const newU = new URL(u);
        if (!newU.searchParams.has("authuser")) {
          newU.searchParams.set("authuser", authUser);
        }
        return newU.toString();
      };
      if (parsed.hostname === "drive.google.com") {
        if (parsed.pathname.startsWith("/auth_warmup")) {
          const cont = parsed.searchParams.get("continue");
          if (cont) return toDownloadUrl(cont, depth + 1);
          const id = parsed.searchParams.get("id");
          if (id)
            return appendAuth(
              `https://drive.google.com/uc?export=download&id=${id}`
            );
          return appendAuth(originalUrl);
        }
        const fileMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
          return appendAuth(
            `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`
          );
        }
        if (parsed.pathname === "/open" || parsed.pathname === "/uc") {
          parsed.searchParams.set("export", "download");
          if (authUser) parsed.searchParams.set("authuser", authUser);
          return parsed.toString();
        }
      }
      if (parsed.hostname === "classroom.google.com" && parsed.pathname.startsWith("/drive")) {
        const id = parsed.searchParams.get("id") || parsed.searchParams.get("resourceId") || parsed.searchParams.get("fileId");
        if (id)
          return appendAuth(
            `https://drive.google.com/uc?export=download&id=${id}`
          );
      }
      return appendAuth(originalUrl);
    } catch {
      return originalUrl;
    }
  }
  function cleanAttachmentName(rawName) {
    if (!rawName) return "";
    let name = rawName.trim();
    const garbageLabels = [
      "Microsoft Excel",
      "Microsoft Word",
      "Microsoft PowerPoint",
      "Compressed archive",
      "Binary",
      "Unknown",
      "Google Sheets",
      "Google Docs",
      "Google Slides",
      "Text File",
      "PDF",
      "Video",
      "Image",
      "Audio",
      "Text",
      "Word",
      "Excel",
      "PowerPoint",
      "Archive",
      "Zip",
      "File",
      "Document",
      "Shortcut",
      "Code"
    ];
    for (const label of garbageLabels) {
      if (name.endsWith(label)) {
        const potential = name.slice(0, -label.length).trim();
        if (potential.length > 0) {
          name = potential;
          break;
        }
      }
    }
    if (name.length > 0 && name.length % 2 === 0) {
      const mid = name.length / 2;
      const firstHalf = name.slice(0, mid);
      const secondHalf = name.slice(mid);
      if (firstHalf === secondHalf) {
        return firstHalf;
      }
    }
    const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
    const repeatMatch = name.match(repeatRegex);
    if (repeatMatch) {
      return name.slice(0, -repeatMatch[1].length).trim();
    }
    return name;
  }
  function extractFileMeta(container, url) {
    let name;
    const tooltip = container.getAttribute("data-tooltip") || container.getAttribute("aria-label") || container.getAttribute("title");
    if (tooltip && tooltip.trim()) name = tooltip.trim();
    if (!name) {
      const text = (container.textContent || "").trim();
      if (text) {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length > 0) name = lines[0];
      }
    }
    if (!name) {
      try {
        const u = new URL(url);
        const pathName = decodeURIComponent(u.pathname.split("/").pop() || "");
        if (pathName && pathName.includes(".")) name = pathName;
      } catch {
      }
    }
    if (name) name = cleanAttachmentName(name);
    let ext;
    if (name) {
      const m = name.match(/\.([a-zA-Z0-9]{2,10})$/);
      if (m) ext = m[1].toLowerCase();
    }
    let kind = "other";
    if (ext) {
      switch (ext) {
        case "pdf":
          kind = "pdf";
          break;
        case "doc":
        case "docx":
        case "txt":
        case "rtf":
        case "odt":
        case "md":
        case "tex":
        case "cls":
        case "emlx":
          kind = "doc";
          break;
        case "xls":
        case "xlsx":
        case "csv":
        case "ods":
        case "numbers":
          kind = "sheet";
          break;
        case "ppt":
        case "pptx":
        case "odp":
        case "key":
          kind = "slide";
          break;
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
        case "webp":
        case "svg":
        case "bmp":
        case "ico":
        case "avif":
        case "fig":
        case "psd":
        case "ai":
          kind = "image";
          break;
        case "mp4":
        case "mov":
        case "avi":
        case "mkv":
        case "webm":
        case "flv":
        case "wmv":
        case "m4v":
          kind = "video";
          break;
        case "mp3":
        case "wav":
        case "ogg":
        case "m4a":
        case "flac":
        case "aac":
          kind = "audio";
          break;
        case "zip":
        case "rar":
        case "7z":
        case "tar":
        case "gz":
        case "iso":
        case "dmg":
        case "pkg":
        case "mht":
          kind = "archive";
          break;
        case "html":
        case "htm":
        case "xml":
        case "css":
        case "js":
        case "ts":
        case "jsx":
        case "tsx":
        case "json":
        case "php":
        case "sql":
        case "py":
        case "c":
        case "cpp":
        case "cs":
        case "java":
        case "rb":
        case "go":
        case "sh":
        case "bat":
        case "ipynb":
        case "pkt":
        case "lock":
        case "yml":
        case "yaml":
          kind = "code";
          break;
        case "ttf":
        case "otf":
        case "woff":
        case "woff2":
        case "eot":
          kind = "font";
          break;
        case "exe":
        case "msi":
        case "apk":
        case "app":
        case "jar":
        case "dll":
        case "pdb":
        case "lnk":
        case "dat":
        case "sqlite":
        case "db":
        case "drawio":
        case "dmp":
          kind = "binary";
          break;
        default:
          kind = "other";
      }
    }
    return { name, ext, kind };
  }
  function injectButtonIntoAttachment(container, url) {
    if (!url) return;
    const computed = window.getComputedStyle(container);
    if (computed.position === "static") container.style.position = "relative";
    const directUrl = toDownloadUrl(url);
    const fileMeta = extractFileMeta(container, directUrl);
    const button = createDownloadButton(container, directUrl, fileMeta);
    const iconEl = button.querySelector(".cqd-download-icon");
    if (iconEl) iconEl.classList.add("cqd-icon-medium");
    container.appendChild(button);
  }
  function getButtonState(button) {
    if (button.classList.contains("cqd-loading")) return "loading";
    if (button.classList.contains("cqd-trying")) return "trying";
    if (button.classList.contains("cqd-success")) return "success";
    if (button.classList.contains("cqd-error")) return "error";
    return "idle";
  }
  function setButtonState(button, state, options) {
    const icon = button.querySelector(".cqd-download-icon");
    const label = button.querySelector(".cqd-label");
    const errorDetail = button.querySelector(".cqd-error-detail");
    if (!icon || !label || !errorDetail) return;
    button.classList.remove("cqd-loading", "cqd-trying", "cqd-success", "cqd-error");
    icon.classList.remove("cqd-spinner");
    icon.textContent = "";
    button.disabled = false;
    button.style.backgroundColor = "";
    label.textContent = t("download");
    errorDetail.textContent = "";
    icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
    icon.style.backgroundSize = "";
    switch (state) {
      case "idle":
        break;
      case "loading":
      case "trying": {
        const isTrying = state === "trying";
        button.classList.add(isTrying ? "cqd-trying" : "cqd-loading");
        button.disabled = true;
        label.textContent = isTrying ? t("trying") : t("downloading");
        icon.classList.add("cqd-spinner");
        icon.style.backgroundImage = "none";
        break;
      }
      case "success":
        button.classList.add("cqd-success");
        label.textContent = t("downloaded");
        icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        break;
      case "error":
        button.classList.add("cqd-error");
        label.textContent = t("error");
        icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
        icon.style.backgroundSize = "20px 20px";
        errorDetail.textContent = options?.userMessage || t("failed");
        break;
    }
  }
  function createDownloadButton(_container, url, fileMeta) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-btn";
    if (isPageDark()) {
      button.classList.add("cqd-theme-dark");
    }
    button.setAttribute(INJECTED_ATTR, "true");
    button.setAttribute("aria-label", `${t("ariaDownload")} ${fileMeta.name || ""}`);
    button.setAttribute("title", t("titleQuick"));
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper";
    const iconSpan = document.createElement("span");
    iconSpan.className = "cqd-download-icon";
    iconWrapper.appendChild(iconSpan);
    const label = document.createElement("span");
    label.className = "cqd-label";
    label.textContent = t("download");
    const errorDetail = document.createElement("span");
    errorDetail.className = "cqd-error-detail";
    button.appendChild(iconWrapper);
    button.appendChild(label);
    button.appendChild(errorDetail);
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    });
    button.addEventListener("auxclick", async (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      await handleSingleDownloadClick(button, url, fileMeta);
    });
    return button;
  }
  async function handleSingleDownloadClick(button, url, fileMeta) {
    if (!url) return;
    if (getButtonState(button) !== "idle") return;
    const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
    const startedAt = Date.now();
    pendingButtons.set(requestId, {
      button,
      requestId,
      fileMeta,
      startedAt
    });
    setButtonState(button, "loading");
    const startResult = await startBackgroundDownload(requestId, url, fileMeta);
    if (!startResult.ok) {
      pendingButtons.delete(requestId);
      await ensureMinLoading(startedAt);
      await showErrorState(button, startResult.userMessage);
      return;
    }
  }
  function startBackgroundDownload(requestId, url, fileMeta) {
    const finalUrl = toDownloadUrl(url);
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        resolve({ ok: false, userMessage: "Extension runtime not available." });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { type: "CQD_DOWNLOAD", url: finalUrl, requestId, fileMeta },
          (response) => {
            if (chrome.runtime.lastError || !response || response.started === false) {
              resolve({
                ok: false,
                userMessage: response?.userMessage || "Could not start download."
              });
            } else {
              resolve({ ok: true });
            }
          }
        );
      } catch {
        resolve({ ok: false, userMessage: "Extension communication error." });
      }
    });
  }
  async function showErrorState(button, userMessage) {
    setButtonState(button, "error", { userMessage });
    const earliestReset = Date.now() + FEEDBACK_ERROR_MS;
    while (true) {
      await delay(200);
      if (getButtonState(button) !== "error") return;
      if (Date.now() < earliestReset) continue;
      if (!button.matches(":hover")) {
        setButtonState(button, "idle");
        return;
      }
    }
  }
  async function ensureMinLoading(startedAt) {
    const elapsed = Date.now() - startedAt;
    if (elapsed < LOADING_MIN_MS) await delay(LOADING_MIN_MS - elapsed);
  }
  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "CQD_DOWNLOAD_STATUS") return;
      const requestId = message.requestId;
      if (!requestId) return;
      const pending = pendingButtons.get(requestId);
      if (!pending) return;
      const { button, startedAt } = pending;
      (async () => {
        await ensureMinLoading(startedAt);
        const status = message.status;
        const errorCode = message.errorCode;
        const userMessage = message.userMessage;
        if (status === "trying") {
          setButtonState(button, "trying", { userMessage });
          return;
        }
        if (status === "success" || status === "complete") {
          pendingButtons.delete(requestId);
          setButtonState(button, "success");
          await delay(FEEDBACK_SUCCESS_MS);
          if (getButtonState(button) === "success") {
            setButtonState(button, "idle");
          }
          return;
        }
        if (status === "error" || status === "interrupted" || status === "blocked_html") {
          if (errorCode === "AUTH_CHECK") {
            await showErrorState(button, userMessage);
            return;
          }
          pendingButtons.delete(requestId);
          await showErrorState(button, userMessage);
        }
      })();
    });
  }
  function initContentScript() {
    if (!isGoogleClassroom()) return;
    injectStyles();
    setupObservers();
  }
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      initContentScript();
    }
  });
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
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
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
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9pbmRleC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcbmltcG9ydCB7IERPV05MT0FEX0lDT05fU1ZHX1VSTCB9IGZyb20gJy4vaWNvbnMnO1xuXG5jb25zdCBTVFlMRV9JRCA9ICdjcWQtc3R5bGUnO1xuY29uc3QgU1BJTk5FUl9TSVpFX1BYID0gMTY7XG5cbi8vIFNtb290aCwgc2xpZ2h0bHkgYm91bmN5IHRyYW5zaXRpb24gZm9yIHRoZSBcIkRyb3BcIiBmZWVsXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG5cbiAgICAgIC8qIFNwaW5uZXIgKExpZ2h0IHRoZW1lIGRlZmF1bHRzKSAqL1xuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yMik7IC8qIGRhcmstaXNoIHJpbmcgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmOyAgICAgICAgICAgICAgICAgICAvKiBzb2xpZCBkYXJrIHRpcCAqL1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAmIFNIQURPV1MgKExpZ2h0IE1vZGUgLyBEZWZhdWx0KVxuICAgICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAgIFxuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIExpZ2h0OiAjMDA1REQ3ICovXG4gICAgICAtLWNxZC1jb2xvci1ub3JtYWw6ICMwMDVERDc7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsOiAwIDhweCAyMnB4IHJnYmEoMCwgOTMsIDIxNSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCA5MywgMjE1LCAwLjcwKTtcblxuICAgICAgLyogMi4gU3VjY2VzcyAtIExpZ2h0OiAjMDBBODJEICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDBBODJEO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gTGlnaHQ6ICNGRjQwMzYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWVycm9yOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuXG4gICAgICAvKiA0LiBUcnlpbmcgLSBMaWdodDogI0VDNjMwMCAqL1xuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRUM2MzAwO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNzApO1xuXG4gICAgICAvKiA1LiBDb21tZW50IEZyYW1lIC0gTGlnaHQ6ICM5QjAwRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICBcbiAgICAgIC8qIDYuIEVkaXRlZCBGcmFtZSAtIExpZ2h0OiAjMDA3RjhEICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMDdGOEQ7XG5cbiAgICAgIC8qIEJhc2UgU2hhZG93cyAqL1xuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcblxuICAgICAgLyogNy4gQk9USCAoRWRpdGVkICsgQ29tbWVudHMpIC0gTGlnaHQgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICAtLWNxZC1ib3RoLW92ZXJsYXktc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBEQVJLIE1PREUgT1ZFUlJJREVTIChBcHBsaWVkIHZpYSAuY3FkLXRoZW1lLWRhcmsgY2xhc3MpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLXRoZW1lLWRhcmsge1xuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIERhcms6ICMwMDZFRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC8qIDIuIFN1Y2Nlc3MgLSBEYXJrOiAjMDdEQTNGICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDdEQTNGO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gRGFyazogI0ZGNDAzNiAqL1xuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC8qIDQuIFRyeWluZyAtIERhcms6ICNGRjkxNDIgKi9cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC8qIDUuIENvbW1lbnQgRnJhbWUgLSBEYXJrOiAjOUIwMEZGICovXG4gICAgICAtLWNxZC1jb2xvci1jb21tZW50OiAjOUIwMEZGO1xuXG4gICAgICAvKiA2LiBFZGl0ZWQgRnJhbWUgLSBEYXJrOiAjMDBENkVFICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC8qIDcuIEJPVEggKEVkaXRlZCArIENvbW1lbnRzKSAtIERhcmsgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNmZmZmZmY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjMDAwMDAwO1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjg1KTtcbiAgICAgIC0tY3FkLWJvdGgtb3ZlcmxheS1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjZmZmZmZmLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuXG4gICAgICAvKiBTcGlubmVyIChEYXJrIHRoZW1lIG92ZXJyaWRlcykgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogQ1JJVElDQUwgT1ZFUlJJREVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gU1RZTEVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogNTAlO1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIHdpZHRoOiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiBjYWxjKDEwMCUgLSAxNnB4KTtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1iYXNlKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgd2lsbC1jaGFuZ2U6IHRyYW5zZm9ybSwgYm94LXNoYWRvdywgd2lkdGgsIGJvcmRlci1yYWRpdXMsIHBhZGRpbmctaW5saW5lO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBwYWRkaW5nLWlubGluZSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJvcmRlci1yYWRpdXMgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgdHJhbnNmb3JtIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLyogU3RhdGVzICovXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIge1xuICAgICAgd2lkdGg6IDEyMHB4O1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWhvdmVyKTtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46Zm9jdXMtdmlzaWJsZSB7XG4gICAgICBvdXRsaW5lOiAycHggc29saWQgI2ZmZmZmZjtcbiAgICAgIG91dGxpbmUtb2Zmc2V0OiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAvKiBJY29ucyAmIExhYmVscyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLyogUGlsbCBTdGF0ZXMgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC8qIFN1Y2Nlc3MgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC8qIEVycm9yICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAvKiBTcGlubmVyICovXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7XG4gICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgIHRvICAgeyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVCBGUkFNRSAmIEJBREdFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuICAgIFxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMy4gRURJVEVEIEZSQU1FICYgUElMTFxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICBcbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuICAgIFxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjsgXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiA0LiBCT1RIIFNUQVRFIChFZGl0ZWQgKyBDb21tZW50cyDihpIgT05FIHBpbGwpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLyogV2hlbiBhIHBvc3QgaGFzIGJvdGggZGF0YS1jcWQtcHJvY2Vzc2VkIGFuZCBkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkLFxuICAgICAgIGdpdmUgdGhlIGZyYW1lIGEgZGFya2VyIG91dGxpbmUvZ2xvdyBzbyBpdCBmZWVscyBzcGVjaWFsICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdW2RhdGEtY3FkLXByb2Nlc3NlZF1bZGF0YS1jcWQtZWRpdGVkLXByb2Nlc3NlZF0gPiAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjRkY0MDM2LFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDcwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkY0MDM2O1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBwYWRkaW5nLXRvcDogOHB4O1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXNlY3Rpb24ge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24ge1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgLyogbm8gZmlsdGVyIHNvIHRoZSBhc3NldCBzdGF5cyBjcmlzcCBpbiBhbGwgdGhlbWVzICovXG4gICAgfVxuXG4gICAgLyogRWRpdGVkIGljb24gKFNWRykgdXNlcyBjdXJyZW50Q29sb3IgKHdoaXRlKSAqL1xuICAgIC5jcWQtYm90aC1pY29uLWVkaXRlZCBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAvKiBUaGUgXCIrXCIgYmV0d2VlbiBpY29ucyAoYWx3YXlzIHZpc2libGUpICovXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAgICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogOHB4O1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDY7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDRweCAxMnB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLW5vcm1hbCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1iYXNlKTtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBib3gtc2hhZG93IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgdHJhbnNmb3JtIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJhY2tncm91bmQtaW1hZ2UgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0biB7XG4gICAgICByaWdodDogYXV0bztcbiAgICAgIGxlZnQ6IDhweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTFweCk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuOmFjdGl2ZSB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtaWNvbiB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE4cHggMThweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1zdWIge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgb3BhY2l0eTogMC45O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9pMThuLnRzXG5cbi8qKlxuICogU0hBUkVEIERJQ1RJT05BUlkgLSA3NSBMQU5HVUFHRVNcbiAqIE5vdyBpbmNsdWRlcyB0aGUgJ2VkaXRlZCcga2V5d29yZCBmb3IgZGV0ZWN0aW9uLlxuICovXG5cbmNvbnN0IFRSQU5TTEFUSU9OUzogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgZW46IHsgZG93bmxvYWQ6ICdEb3dubG9hZCcsIGRvd25sb2FkaW5nOiAnRG93bmxvYWRpbmfigKYnLCB0cnlpbmc6ICdUcnlpbmfigKYnLCBkb3dubG9hZGVkOiAnRG93bmxvYWRlZCcsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdEb3dubG9hZCBmYWlsZWQuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLCB0aXRsZVF1aWNrOiAnUXVpY2sgZG93bmxvYWQnLCBjb21tZW50czogJ2NvbW1lbnRzJywgZWRpdGVkOiAnRWRpdGVkJywgZG93bmxvYWRBbGw6ICdEb3dubG9hZCBhbGwnIH0sXG4gIGFyOiB7IGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsIGRvd25sb2FkaW5nOiAn2KzYp9ix2Yog2KfZhNiq2YbYstmK2YTigKYnLCB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLCBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsIGVycm9yOiAn2K7Yt9ijJywgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLCB0aXRsZVF1aWNrOiAn2KrZhtiy2YrZhCDYs9ix2YrYuScsIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLCBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyB9LFxuICBqYTogeyBkb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLCB0cnlpbmc6ICfoqabooYzkuK3igKYnLCBkb3dubG9hZGVkOiAn5a6M5LqGJywgZXJyb3I6ICfjgqjjg6njg7wnLCBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLCBhcmlhRG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLCB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJywgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLCBlZGl0ZWQ6ICfnt6jpm4bmuIjjgb8nIH0sXG4gIGVzOiB7IGRvd25sb2FkOiAnRGVzY2FyZ2FyJywgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsIHRyeWluZzogJ0ludGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJywgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJywgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgaGk6IHsgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLCBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcgfSxcbiAgcHQ6IHsgZG93bmxvYWQ6ICdCYWl4YXInLCBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJywgdHJ5aW5nOiAnVGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnQmFpeGFkbycsIGVycm9yOiAnRXJybycsIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLCBhcmlhRG93bmxvYWQ6ICdCYWl4YXInLCB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3B0LXB0JzogeyBkb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJywgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJywgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLCBkb3dubG9hZGVkOiAnRGVzY2FycmVnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJywgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYXInLCB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3poLWNuJzogeyBkb3dubG9hZDogJ+S4i+i9vScsIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJywgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJywgZG93bmxvYWRlZDogJ+W3suS4i+i9vScsIGVycm9yOiAn6ZSZ6K+vJywgZmFpbGVkOiAn5LiL6L295aSx6LSlJywgYXJpYURvd25sb2FkOiAn5LiL6L29JywgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsIGNvbW1lbnRzOiAn5p2h6K+E6K66JywgZWRpdGVkOiAn5bey57yW6L6RJyB9LFxuICAnemgtdHcnOiB7IGRvd25sb2FkOiAn5LiL6LyJJywgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLCB0cnlpbmc6ICflmJfoqabkuK3igKYnLCBkb3dubG9hZGVkOiAn5bey5LiL6LyJJywgZXJyb3I6ICfpjK/oqqQnLCBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLCBhcmlhRG93bmxvYWQ6ICfkuIvovIknLCB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJywgY29tbWVudHM6ICfliYfnlZnoqIAnLCBlZGl0ZWQ6ICflt7Lnt6jovK8nIH0sXG4gIGZyOiB7IGRvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsIHRyeWluZzogJ0Vzc2Fp4oCmJywgZG93bmxvYWRlZDogJ1TDqWzDqWNoYXJnw6knLCBlcnJvcjogJ0VycmV1cicsIGZhaWxlZDogJ8OJY2hlYy4nLCBhcmlhRG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJywgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJywgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLCBlZGl0ZWQ6ICdNb2RpZmnDqScgfSxcbiAgZGU6IHsgZG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJywgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsIGRvd25sb2FkZWQ6ICdGZXJ0aWcnLCBlcnJvcjogJ0ZlaGxlcicsIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsIGFyaWFEb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLCB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJywgY29tbWVudHM6ICdLb21tZW50YXJlJywgZWRpdGVkOiAnQmVhcmJlaXRldCcgfSxcbiAgaXQ6IHsgZG93bmxvYWQ6ICdTY2FyaWNhJywgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLCB0cnlpbmc6ICdQcm92YW5kb+KApicsIGRvd25sb2FkZWQ6ICdTY2FyaWNhdG8nLCBlcnJvcjogJ0Vycm9yZScsIGZhaWxlZDogJ0ZhbGxpdG8uJywgYXJpYURvd25sb2FkOiAnU2NhcmljYScsIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLCBjb21tZW50czogJ2NvbW1lbnRpJywgZWRpdGVkOiAnTW9kaWZpY2F0bycgfSxcbiAgcnU6IHsgZG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLCB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsIGRvd25sb2FkZWQ6ICfQodC60LDRh9Cw0L3QvicsIGVycm9yOiAn0J7RiNC40LHQutCwJywgZmFpbGVkOiAn0KHQsdC+0LkuJywgYXJpYURvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLCB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLCBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsIGVkaXRlZDogJ9CY0LfQvNC10L3QtdC90L4nIH0sXG4gIGtvOiB7IGRvd25sb2FkOiAn64uk7Jq066Gc65OcJywgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJywgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsIGRvd25sb2FkZWQ6ICfsmYTro4wnLCBlcnJvcjogJ+yYpOulmCcsIGZhaWxlZDogJ+yLpO2MqO2VqCcsIGFyaWFEb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJywgY29tbWVudHM6ICfqsJwg64yT6riAJywgZWRpdGVkOiAn7IiY7KCV65CoJyB9LFxuICB0cjogeyBkb3dubG9hZDogJ8SwbmRpcicsIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJywgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJywgZG93bmxvYWRlZDogJ8SwbmRpcmlsZGknLCBlcnJvcjogJ0hhdGEnLCBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJywgYXJpYURvd25sb2FkOiAnxLBuZGlyJywgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLCBjb21tZW50czogJ3lvcnVtJywgZWRpdGVkOiAnRMO8emVubGVuZGknIH0sXG4gIHZpOiB7IGRvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLCB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsIGRvd25sb2FkZWQ6ICfEkMOjIHThuqNpJywgZXJyb3I6ICdM4buXaScsIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLCBhcmlhRG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJywgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLCBjb21tZW50czogJ25o4bqtbiB4w6l0JywgZWRpdGVkOiAnxJDDoyBjaOG7iW5oIHPhu61hJyB9LFxuICBpZDogeyBkb3dubG9hZDogJ0Rvd25sb2FkJywgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLCB0cnlpbmc6ICdNZW5jb2Jh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ0tlc2FsYWhhbicsIGZhaWxlZDogJ0dhZ2FsLicsIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJywgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JywgY29tbWVudHM6ICdrb21lbnRhcicsIGVkaXRlZDogJ0RpZWRpdCcgfSxcbiAgdGg6IHsgZG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLCBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsIGRvd25sb2FkZWQ6ICfguYDguKrguKPguYfguIjguKrguLTguYnguJknLCBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsIGFyaWFEb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLCBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsIGVkaXRlZDogJ+C5geC4geC5ieC5hOC4guC5geC4peC5ieC4pycgfSxcbiAgcGw6IHsgZG93bmxvYWQ6ICdQb2JpZXJ6JywgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJywgdHJ5aW5nOiAnUHLDs2Jh4oCmJywgZG93bmxvYWRlZDogJ1BvYnJhbm8nLCBlcnJvcjogJ0LFgsSFZCcsIGZhaWxlZDogJ05pZXVkYW5lLicsIGFyaWFEb3dubG9hZDogJ1BvYmllcnonLCB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJywgY29tbWVudHM6ICdrb21lbnRhcnplJywgZWRpdGVkOiAnRWR5dG93YW5vJyB9LFxuICBubDogeyBkb3dubG9hZDogJ0Rvd25sb2FkZW4nLCBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLCB0cnlpbmc6ICdQcm9iZXJlbuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1a3QuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWRlbicsIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLCBjb21tZW50czogJ3JlYWN0aWVzJywgZWRpdGVkOiAnQmV3ZXJrdCcgfSxcbiAgYm46IHsgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLCBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLCB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCmqOCnjeCmqCcsIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJywgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJywgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyB9LFxuICBwYTogeyBkb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLCB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJywgZG93bmxvYWRlZDogJ+CoruCpgeColeCpsOCoruCosicsIGVycm9yOiAn4KiX4Kiy4Kik4KmAJywgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJywgYXJpYURvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJywgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLCBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsIGVkaXRlZDogJ+CouOCpsOCoquCovuCopuCov+CopCcgfSxcbiAgdGU6IHsgZG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLCB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLCBkb3dubG9hZGVkOiAn4LCq4LGC4LCw4LGN4LCk4LCv4LC/4LCC4LCm4LC/JywgZXJyb3I6ICfgsLLgsYvgsKrgsIInLCBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLCBhcmlhRG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJywgZWRpdGVkOiAn4LC44LC14LCw4LC/4LCC4LCa4LCs4LCh4LC/4LCC4LCm4LC/JyB9LFxuICBtcjogeyBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLCB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLCBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLCBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnIH0sXG4gIHRhOiB7IGRvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJywgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4HgrpXgrr/grrHgrqTgr4HigKYnLCB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLCBkb3dubG9hZGVkOiAn4K6u4K+B4K6f4K6/4K6o4K+N4K6k4K6k4K+BJywgZXJyb3I6ICfgrqrgrr/grrTgr4gnLCBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLCBhcmlhRG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLCB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJywgZWRpdGVkOiAn4K6k4K6/4K6w4K+B4K6k4K+N4K6k4K6q4K+N4K6q4K6f4K+N4K6f4K6k4K+BJyB9LFxuICB1cjogeyBkb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLCB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsIGRvd25sb2FkZWQ6ICfZhdqp2YXZhCcsIGVycm9yOiAn2LrZhNi324wnLCBmYWlsZWQ6ICfZhtin2qnYp9mFJywgYXJpYURvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJywgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsIGVkaXRlZDogJ9iq2LHZhduM2YUg2LTYr9uBJyB9LFxuICBndTogeyBkb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJywgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsIGRvd25sb2FkZWQ6ICfgqqrgq4LgqrDgq43gqqMnLCBlcnJvcjogJ+CqreCrguCqsicsIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsIGFyaWFEb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJywgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLCBlZGl0ZWQ6ICfgqrjgqoLgqqrgqr7gqqbgqr/gqqQnIH0sXG4gIGtuOiB7IGRvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgZG93bmxvYWRlZDogJ+CyquCzguCysOCzjeCyo+Cyl+CziuCyguCyoeCyv+CypuCzhicsIGVycm9yOiAn4LKm4LOL4LK3JywgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJywgYXJpYURvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLCBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsIGVkaXRlZDogJ+CyuOCyguCyquCyvuCypuCyv+CyuOCysuCyvuCyl+Cyv+CypuCzhicgfSxcbiAgbWw6IHsgZG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLCB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLCBkb3dubG9hZGVkOiAn4LSq4LWC4LW84LSk4LWN4LSk4LS/4LSv4LS+4LSv4LS/JywgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLCBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLCBhcmlhRG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JywgZWRpdGVkOiAn4LSO4LSh4LS/4LSx4LWN4LSx4LWB4LSa4LWG4LSv4LWN4LSk4LWBJyB9LFxuICB1azogeyBkb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLCBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLCBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJywgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJywgYXJpYURvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsIGVkaXRlZDogJ9CX0LzRltC90LXQvdC+JyB9LFxuICBlbDogeyBkb3dubG9hZDogJ86bzq7PiM63JywgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJywgZG93bmxvYWRlZDogJ86fzrvOv866zrvOt8+Bz47OuM63zrrOtScsIGVycm9yOiAnzqPPhs6szrvOvM6xJywgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJywgYXJpYURvd25sb2FkOiAnzpvOrs+IzrcnLCB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLCBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsIGVkaXRlZDogJ86Vz4DOtc6+zrXPgc6zzrHPg868zq3Ovc6/JyB9LFxuICBjczogeyBkb3dubG9hZDogJ1N0w6Fobm91dCcsIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLCB0cnlpbmc6ICdaa291xaHDrW3igKYnLCBkb3dubG9hZGVkOiAnU3Rhxb5lbm8nLCBlcnJvcjogJ0NoeWJhJywgZmFpbGVkOiAnU2VsaGFsby4nLCBhcmlhRG93bmxvYWQ6ICdTdMOhaG5vdXQnLCB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLCBjb21tZW50czogJ2tvbWVudMOhxZnFrycsIGVkaXRlZDogJ1VwcmF2ZW5vJyB9LFxuICBybzogeyBkb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJywgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsIGRvd25sb2FkZWQ6ICdGaW5hbGl6YXQnLCBlcnJvcjogJ0Vyb2FyZScsIGZhaWxlZDogJ0XImXVhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLCB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsIGNvbW1lbnRzOiAnY29tZW50YXJpaScsIGVkaXRlZDogJ01vZGlmaWNhdCcgfSxcbiAgaHU6IHsgZG93bmxvYWQ6ICdMZXTDtmx0w6lzJywgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJywgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLCBkb3dubG9hZGVkOiAnS8Opc3onLCBlcnJvcjogJ0hpYmEnLCBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsIGFyaWFEb3dubG9hZDogJ0xldMO2bHTDqXMnLCB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLCBlZGl0ZWQ6ICdTemVya2VzenR2ZScgfSxcbiAgc3Y6IHsgZG93bmxvYWQ6ICdMYWRkYSBuZXInLCBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLCB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJywgZG93bmxvYWRlZDogJ0tsYXJ0JywgZXJyb3I6ICdGZWwnLCBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJywgYXJpYURvd25sb2FkOiAnTGFkZGEgbmVyJywgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJhZCcgfSxcbiAgZGE6IHsgZG93bmxvYWQ6ICdIZW50JywgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0hlbnRldCcsIGVycm9yOiAnRmVqbCcsIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsIGFyaWFEb3dubG9hZDogJ0hlbnQnLCB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJldCcgfSxcbiAgZmk6IHsgZG93bmxvYWQ6ICdMYXRhYScsIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLCB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsIGRvd25sb2FkZWQ6ICdMYWRhdHR1JywgZXJyb3I6ICdWaXJoZScsIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLCBhcmlhRG93bmxvYWQ6ICdMYXRhYScsIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJywgY29tbWVudHM6ICdrb21tZW50dGlhJywgZWRpdGVkOiAnTXVva2F0dHUnIH0sXG4gIG5vOiB7IGRvd25sb2FkOiAnTGFzdCBuZWQnLCBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0ZlcmRpZycsIGVycm9yOiAnRmVpbCcsIGZhaWxlZDogJ01pc2x5a3Rlcy4nLCBhcmlhRG93bmxvYWQ6ICdMYXN0IG5lZCcsIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLCBjb21tZW50czogJ2tvbW1lbnRhcmVyJywgZWRpdGVkOiAnUmVkaWdlcnQnIH0sXG4gIGhlOiB7IGRvd25sb2FkOiAn15TXldeo15PXlCcsIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsIHRyeWluZzogJ9ee16DXodeU4oCmJywgZG93bmxvYWRlZDogJ9eU15XXqdec150nLCBlcnJvcjogJ9ep15LXmdeQ15QnLCBmYWlsZWQ6ICfXoNeb16nXnCcsIGFyaWFEb3dubG9hZDogJ9eU15XXqNeT15QnLCB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJywgY29tbWVudHM6ICfXqteS15XXkdeV16onLCBlZGl0ZWQ6ICfXoNei16jXmicgfSxcbiAgZmE6IHsgZG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJywgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLCBkb3dubG9hZGVkOiAn2KfZhtis2KfZhSDYtNivJywgZXJyb3I6ICfYrti32KcnLCBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLCBhcmlhRG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JywgY29tbWVudHM6ICfZhti42LEnLCBlZGl0ZWQ6ICfZiNuM2LHYp9uM2LQg2LTYr9mHJyB9LFxuICBmaWw6IHsgZG93bmxvYWQ6ICdJLWRvd25sb2FkJywgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJywgZG93bmxvYWRlZDogJ1RhcG9zIG5hJywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ05hYmlnby4nLCBhcmlhRG93bmxvYWQ6ICdJLWRvd25sb2FkJywgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLCBjb21tZW50czogJ21nYSBrb21lbnRvJywgZWRpdGVkOiAnTmEtZWRpdCcgfSxcbiAgbXM6IHsgZG93bmxvYWQ6ICdNdWF0IHR1cnVuJywgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLCB0cnlpbmc6ICdNZW5jdWJh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ1JhbGF0JywgZmFpbGVkOiAnR2FnYWwuJywgYXJpYURvd25sb2FkOiAnTXVhdCB0dXJ1bicsIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsIGNvbW1lbnRzOiAna29tZW4nLCBlZGl0ZWQ6ICdEaWVkaXQnIH0sXG4gIHNyOiB7IGRvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLCBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJywgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJywgZG93bmxvYWRlZDogJ9CX0LDQstGA0YjQtdC90L4nLCBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLCBhcmlhRG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJywgZWRpdGVkOiAn0JjQt9C80LXRmtC10L3QvicgfSxcbiAgc2s6IHsgZG93bmxvYWQ6ICdTdGlhaG51xaUnLCBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJywgdHJ5aW5nOiAnU2vDusWhYW3igKYnLCBkb3dubG9hZGVkOiAnSG90b3ZvJywgZXJyb3I6ICdDaHliYScsIGZhaWxlZDogJ1pseWhhbG8uJywgYXJpYURvd25sb2FkOiAnU3RpYWhudcWlJywgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLCBlZGl0ZWQ6ICdVcHJhdmVuw6knIH0sXG4gIGJnOiB7IGRvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLCBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsIHRyeWluZzogJ9Ce0L/QuNGC4oCmJywgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsIGVycm9yOiAn0JPRgNC10YjQutCwJywgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsIGFyaWFEb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JywgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLCBlZGl0ZWQ6ICfQoNC10LTQsNC60YLQuNGA0LDQvdC+JyB9LFxuICBocjogeyBkb3dubG9hZDogJ1ByZXV6bWknLCBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJywgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsIGRvd25sb2FkZWQ6ICdHb3Rvdm8nLCBlcnJvcjogJ0dyZcWha2EnLCBmYWlsZWQ6ICdOZXVzcGplbG8uJywgYXJpYURvd25sb2FkOiAnUHJldXptaScsIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJywgY29tbWVudHM6ICdrb21lbnRhcmEnLCBlZGl0ZWQ6ICdVcmXEkWVubycgfSxcbiAgbHQ6IHsgZG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsIHRyeWluZzogJ0JhbmRvbWHigKYnLCBkb3dubG9hZGVkOiAnQmFpZ3RhJywgZXJyb3I6ICdLbGFpZGEnLCBmYWlsZWQ6ICdOZXBhdnlrby4nLCBhcmlhRG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLCBjb21tZW50czogJ2tvbWVudGFyYWknLCBlZGl0ZWQ6ICdSZWRhZ3VvdGEnIH0sXG4gIGx2OiB7IGRvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLCB0cnlpbmc6ICdNxJPEo2luYeKApicsIGRvd25sb2FkZWQ6ICdQYWJlaWd0cycsIGVycm9yOiAnS8S8xatkYScsIGZhaWxlZDogJ05laXpkZXbEgXMuJywgYXJpYURvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsIGNvbW1lbnRzOiAna29tZW50xIFyaScsIGVkaXRlZDogJ1JlZGnEo8STdHMnIH0sXG4gIGV0OiB7IGRvd25sb2FkOiAnTGFhZGkgYWxsYScsIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJywgdHJ5aW5nOiAnUHJvb3ZpbuKApicsIGRvd25sb2FkZWQ6ICdWYWxtaXMnLCBlcnJvcjogJ1ZpZ2EnLCBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJywgYXJpYURvd25sb2FkOiAnTGFhZGkgYWxsYScsIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJywgY29tbWVudHM6ICdrb21tZW50YWFyaScsIGVkaXRlZDogJ011dWRldHVkJyB9LFxuICBzbDogeyBkb3dubG9hZDogJ1ByZW5vcycsIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLCB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLCBkb3dubG9hZGVkOiAnS29uxI1hbm8nLCBlcnJvcjogJ05hcGFrYScsIGZhaWxlZDogJ05pIHVzcGVsby4nLCBhcmlhRG93bmxvYWQ6ICdQcmVub3MnLCB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJywgY29tbWVudHM6ICdrb21lbnRhcmpldicsIGVkaXRlZDogJ1VyZWplbm8nIH0sXG4gIGNhOiB7IGRvd25sb2FkOiAnRGVzY2FycmVnYScsIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJywgdHJ5aW5nOiAnSW50ZW50YW504oCmJywgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2F0JywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ0hhIGZhbGxhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhJywgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaXMnLCBlZGl0ZWQ6ICdFZGl0YXQnIH0sXG4gIGFmOiB7IGRvd25sb2FkOiAnQWZsYWFpJywgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJywgdHJ5aW5nOiAnUHJvYmVlcuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1ay4nLCBhcmlhRG93bmxvYWQ6ICdBZmxhYWknLCB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLCBjb21tZW50czogJ2tvbW1lbnRhcmUnLCBlZGl0ZWQ6ICdHZXJlZGlnZWVyJyB9LFxuICBhbTogeyBkb3dubG9hZDogJ+GKoOGLjeGIreGLtScsIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLCBkb3dubG9hZGVkOiAn4YuI4Yit4Yu34YiNJywgZXJyb3I6ICfhiLXhiIXhibDhibUnLCBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLCBhcmlhRG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLCB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JywgZWRpdGVkOiAn4Ymw4Yi14Ymw4Yqr4Yqt4YiP4YiNJyB9LFxuICBoeTogeyBkb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLCB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsIGRvd25sb2FkZWQ6ICfUsdW+1aHWgNW/1b7VodWuJywgZXJyb3I6ICfVjdWt1aHVrCcsIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JywgYXJpYURvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJywgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JywgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLCBlZGl0ZWQ6ICfUvdW01aLVodWj1oDVvtWl1awg1acnIH0sXG4gIGFzOiB7IGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCnguCnsOCnjeCmoycsIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLCBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnIH0sXG4gIGF6OiB7IGRvd25sb2FkOiAnWcO8a2zJmScsIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsIGRvd25sb2FkZWQ6ICdCaXRkaScsIGVycm9yOiAnWMmZdGEnLCBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsIGFyaWFEb3dubG9hZDogJ1nDvGtsyZknLCB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLCBjb21tZW50czogJ8WfyZlyaCcsIGVkaXRlZDogJ0TDvHrJmWxpxZ8gZWRpbGliJyB9LFxuICBldTogeyBkb3dubG9hZDogJ0Rlc2thcmdhdHUnLCBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsIHRyeWluZzogJ1NhaWF0emVu4oCmJywgZG93bmxvYWRlZDogJ0VnaW5kYScsIGVycm9yOiAnRXJyb3JlYScsIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLCBhcmlhRG93bmxvYWQ6ICdEZXNrYXJnYXR1JywgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLCBjb21tZW50czogJ2lydXpraW4nLCBlZGl0ZWQ6ICdFZGl0YXR1YScgfSxcbiAgbXk6IHsgZG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLCB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLCBkb3dubG9hZGVkOiAn4YCV4YC84YCu4YC44YCV4YCr4YCV4YC84YCuJywgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLCBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLCBhcmlhRG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JywgZWRpdGVkOiAn4YCV4YC84YCE4YC64YCG4YCE4YC64YCV4YC84YCu4YC4JyB9LFxuICBnbDogeyBkb3dubG9hZDogJ0Rlc2NhcmdhcicsIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLCB0cnlpbmc6ICdUZW50YW5kb+KApicsIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsbG91LicsIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJywgY29tbWVudHM6ICdjb21lbnRhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gIGthOiB7IGRvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLCB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLCBkb3dubG9hZGVkOiAn4YOT4YOQ4YOh4YOg4YOj4YOa4YOT4YOQJywgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLCBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsIGFyaWFEb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLCBlZGl0ZWQ6ICfhg6Dhg5Thg5Phg5Dhg6Xhg6Lhg5jhg6Dhg5Thg5Hhg6Phg5rhg5jhg5AnIH0sXG4gIGlzOiB7IGRvd25sb2FkOiAnU8Oma2phJywgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLCB0cnlpbmc6ICdSZXluaeKApicsIGRvd25sb2FkZWQ6ICdTw7N0dCcsIGVycm9yOiAnVmlsbGEnLCBmYWlsZWQ6ICdNaXN0w7Nrc3QuJywgYXJpYURvd25sb2FkOiAnU8Oma2phJywgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsIGNvbW1lbnRzOiAndW1tw6ZsaScsIGVkaXRlZDogJ0JyZXl0dCcgfSxcbiAgZ2E6IHsgZG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJywgZG93bmxvYWRlZDogJ8ONb3Nsw7Nkw6FpbHRlJywgZXJyb3I6ICdFYXJyw6FpZCcsIGZhaWxlZDogJ1RoZWlwIGFpci4nLCBhcmlhRG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLCBjb21tZW50czogJ3Ryw6FjaHQnLCBlZGl0ZWQ6ICdFYWdyYWl0aGUnIH0sXG4gIGtrOiB7IGRvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJywgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJywgZG93bmxvYWRlZDogJ9CQ0Y/Sm9GC0LDQu9C00YsnLCBlcnJvcjogJ9Ka0LDRgtC1JywgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsIGFyaWFEb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLCB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsIGVkaXRlZDogJ9Oo0LfQs9C10YDRgtGW0LvQtNGWJyB9LFxuICBrbTogeyBkb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJywgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJywgZG93bmxvYWRlZDogJ+GelOGetuGek+GelOGeieGfkuGeheGelOGfiycsIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJywgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJywgYXJpYURvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJywgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JywgZWRpdGVkOiAn4Z6U4Z624Z6T4Z6A4Z+C4Z6f4Z6Y4Z+S4Z6a4Z694Z6bJyB9LFxuICBsbzogeyBkb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJywgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJywgZG93bmxvYWRlZDogJ+C6quC6s+C7gOC6peC6seC6lCcsIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJywgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJywgYXJpYURvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJywgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJywgZWRpdGVkOiAn4LuB4LqB4LuJ4LuE4LqC4LuB4Lql4LuJ4LqnJyB9LFxuICBtazogeyBkb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JywgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLCB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLCBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JywgZXJyb3I6ICfQk9GA0LXRiNC60LAnLCBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJywgYXJpYURvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLCB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLCBlZGl0ZWQ6ICfQmNC30LzQtdC90LXRgtC+JyB9LFxuICBtbjogeyBkb3dubG9hZDogJ9Ci0LDRgtCw0YUnLCBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJywgZG93bmxvYWRlZDogJ9Ci0LDRgtGB0LDQvScsIGVycm9yOiAn0JDQu9C00LDQsCcsIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLCBhcmlhRG93bmxvYWQ6ICfQotCw0YLQsNGFJywgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJywgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLCBlZGl0ZWQ6ICfQl9Cw0YHRgdCw0L0nIH0sXG4gIG5lOiB7IGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJywgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpL4g4KSt4KSv4KWLJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsIGVkaXRlZDogJ+CkuOCkruCljeCkquCkvuCkpuCkv+CkpCcgfSxcbiAgb3I6IHsgZG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLCBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLCB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJywgZG93bmxvYWRlZDogJ+CsuOCsruCtjeCsquCtguCssOCtjeCso+CtjeCsoycsIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JywgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsIGFyaWFEb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJywgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLCBlZGl0ZWQ6ICfgrLjgrK7grY3grKrgrL7grKbgrL/grKQnIH0sXG4gIHNpOiB7IGRvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJywgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJywgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsIGRvd25sb2FkZWQ6ICfgtoXgt4Dgt4PgtrHgt4onLCBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsIGFyaWFEb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJywgZWRpdGVkOiAn4LeD4LaC4LeD4LeK4Laa4La74Lar4La6JyB9LFxuICBzdzogeyBkb3dubG9hZDogJ1Bha3VhJywgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsIHRyeWluZzogJ0luYWphcmlideKApicsIGRvd25sb2FkZWQ6ICdJbWVrYW1pbGlrYScsIGVycm9yOiAnSGl0aWxhZnUnLCBmYWlsZWQ6ICdJbWVzaGluZHdhLicsIGFyaWFEb3dubG9hZDogJ1Bha3VhJywgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsIGNvbW1lbnRzOiAnbWFvbmknLCBlZGl0ZWQ6ICdJbWVoYXJpcml3YScgfSxcbiAgdXo6IHsgZG93bmxvYWQ6ICdZdWtsYXNoJywgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJywgZG93bmxvYWRlZDogJ1RheXlvcicsIGVycm9yOiAnWGF0bycsIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLCBhcmlhRG93bmxvYWQ6ICdZdWtsYXNoJywgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJywgY29tbWVudHM6ICdzaGFyaGxhcicsIGVkaXRlZDogJ1RhaHJpcmxhbmdhbicgfSxcbiAgY3k6IHsgZG93bmxvYWQ6ICdMYXdybHd5dGhvJywgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJywgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJywgZG93bmxvYWRlZDogJ1dlZGkgZ29yZmZlbicsIGVycm9yOiAnR3dhbGwnLCBmYWlsZWQ6ICdNZXRob2RkLicsIGFyaWFEb3dubG9hZDogJ0xhd3Jsd3l0aG8nLCB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLCBjb21tZW50czogJ3N5bHdhZGF1JywgZWRpdGVkOiAnR29seWd3eWQnIH0sXG4gIHp1OiB7IGRvd25sb2FkOiAnTGFuZGEnLCBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsIHRyeWluZzogJ0l5YXphbWHigKYnLCBkb3dubG9hZGVkOiAnSWxhbmTEq3dlJywgZXJyb3I6ICdJcGh1dGhhJywgZmFpbGVkOiAnSWhsdWxla2lsZS4nLCBhcmlhRG93bmxvYWQ6ICdMYW5kYScsIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsIGNvbW1lbnRzOiAnYW1hendhbmEnLCBlZGl0ZWQ6ICdLdWhsZWxpd2UnIH0sXG4gIHNxOiB7IGRvd25sb2FkOiAnU2hrYXJrbycsIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLCB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLCBkb3dubG9hZGVkOiAnUMOrcmZ1bmRvaScsIGVycm9yOiAnR2FiaW0nLCBmYWlsZWQ6ICdEw6tzaHRvaS4nLCBhcmlhRG93bmxvYWQ6ICdTaGthcmtvJywgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLCBjb21tZW50czogJ2tvbWVudGUnLCBlZGl0ZWQ6ICdFIHJlZGFrdHVhcicgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZykge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCc7JylbMF0udHJpbSgpLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbYmFzZUxhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbJ2VuJ10gJiYgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG5cbiAgfSBjYXRjaCAoZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59IiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHNcblxuLyoqXG4gKiBUSEVNRSBERVRFQ1RPUlxuICpcbiAqIEdvYWw6IFwiSXMgdGhlIGNvbnRlbnQgSSdtIGRyYXdpbmcgb24gdmlzdWFsbHkgZGFyayBvciBsaWdodD9cIlxuICogSW5zdGVhZCBvZiBndWVzc2luZyBmcm9tIDxib2R5Piwgd2U6XG4gKiAgLSBSZXNwZWN0IERhcmsgUmVhZGVyIGlmIHByZXNlbnRcbiAqICAtIExvb2sgZm9yIG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzXG4gKiAgLSBNZWFzdXJlIHRoZSBlZmZlY3RpdmUgYmFja2dyb3VuZCBjb2xvciBvZiBhICpjb250ZW50KiBlbGVtZW50XG4gKiAgICAoZS5nLiBHb29nbGUgQ2xhc3Nyb29tIHN0cmVhbSBjYXJkcylcbiAqL1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFnZSAqY29udGVudCBhcmVhKiBpcyB2aXN1YWxseSBkYXJrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQYWdlRGFyaygpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAxLiBGYXN0IHBhdGg6IERhcmsgUmVhZGVyIGF0dHJpYnV0ZVxuICBjb25zdCBkclNjaGVtZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnKTtcbiAgaWYgKGRyU2NoZW1lID09PSAnZGFyaycpIHJldHVybiB0cnVlO1xuICBpZiAoZHJTY2hlbWUgPT09ICdsaWdodCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAyLiBIZXVyaXN0aWM6IG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzIG9uIDxodG1sPiAvIDxib2R5PlxuICAvLyAoY292ZXJzIHNvbWUgZnJhbWV3b3JrcyBhbmQgZXh0ZW5zaW9ucylcbiAgY29uc3QgZGFya1Rva2VucyA9IFsnZGFyaycsICdkYXJrLXRoZW1lJywgJ3RoZW1lLWRhcmsnLCAnbmlnaHQnLCAnZ20zLWRhcmstdGhlbWUnXTtcbiAgY29uc3QgaHRtbENsYXNzID0gKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGJvZHlDbGFzcyA9IChkb2N1bWVudC5ib2R5LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGRhcmtUb2tlbnMuc29tZSh0b2tlbiA9PiBodG1sQ2xhc3MuaW5jbHVkZXModG9rZW4pIHx8IGJvZHlDbGFzcy5pbmNsdWRlcyh0b2tlbikpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyAzLiBQcm9iZSBhICpjb250ZW50KiBlbGVtZW50LCBub3QgdGhlIHdob2xlIHBhZ2UgYmFja2dyb3VuZC5cbiAgLy8gICAgRm9yIENsYXNzcm9vbSwgcG9zdHMgYXJlIHRoZSBtYWluIHN1cmZhY2Ugd2UgZHJhdyBvbi5cbiAgY29uc3QgcHJvYmVFbCA9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXScpIHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tyb2xlPVwibWFpblwiXScpIHx8XG4gICAgZG9jdW1lbnQuYm9keTtcblxuICBjb25zdCBiZ0NvbG9yID0gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHByb2JlRWwpO1xuICBjb25zdCBicmlnaHRuZXNzID0gcGFyc2VCcmlnaHRuZXNzKGJnQ29sb3IpO1xuXG4gIC8vIDQuIERlY2lkZSB0aHJlc2hvbGQuXG4gIC8vICAgIDEyOCBpcyBcIjUwJSBncmF5XCIsIGJ1dCB0aGF0IGZsaXBzIHRvbyBlYXJseSBvbiBzbGlnaHRseSBncmF5IFVJcy5cbiAgLy8gICAgVXNlIGEgc3RyaWN0ZXIgdGhyZXNob2xkIHNvIHdlIG9ubHkgdHJlYXQgY2xlYXJseSBkYXJrIFVJcyBhcyBkYXJrLlxuICByZXR1cm4gYnJpZ2h0bmVzcyA8IDEwNTtcbn1cblxuLyoqXG4gKiBXYWxrcyB1cCB0aGUgRE9NIGZyb20gYSBnaXZlbiBlbGVtZW50IHVudGlsIGl0IGZpbmRzIGEgbm9uLXRyYW5zcGFyZW50IGJhY2tncm91bmQgY29sb3IuXG4gKiBGYWxscyBiYWNrIHRvIDxodG1sPiBhbmQgZmluYWxseSB0byBwdXJlIHdoaXRlLlxuICovXG5mdW5jdGlvbiBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3Ioc3RhcnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBzdGFydDtcblxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gKGM6IHN0cmluZyB8IG51bGwpID0+XG4gICAgIWMgfHwgYyA9PT0gJ3RyYW5zcGFyZW50JyB8fCBjID09PSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgY29uc3QgYmcgPSBzdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgaWYgKCFpc1RyYW5zcGFyZW50KGJnKSkgcmV0dXJuIGJnO1xuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIC8vIFRyeSA8aHRtbD4gYXMgYSBsYXN0IHJlYWwgZWxlbWVudFxuICBjb25zdCBodG1sU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuICBjb25zdCBodG1sQmcgPSBodG1sU3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICBpZiAoIWlzVHJhbnNwYXJlbnQoaHRtbEJnKSkgcmV0dXJuIGh0bWxCZztcblxuICAvLyBBYnNvbHV0ZSBmYWxsYmFjazogYXNzdW1lIHdoaXRlXG4gIHJldHVybiAncmdiKDI1NSwgMjU1LCAyNTUpJztcbn1cblxuLyoqXG4gKiBIZWxwZXI6IENhbGN1bGF0ZXMgYnJpZ2h0bmVzcyAoMC0yNTUpIGZyb20gYW4gUkdCKEEpIHN0cmluZy5cbiAqIFVzZXMgdGhlIEhTUCBjb2xvciBmb3JtdWxhOiBzcXJ0KDAuMjk5KlJeMiArIDAuNTg3KkdeMiArIDAuMTE0KkJeMilcbiAqL1xuZnVuY3Rpb24gcGFyc2VCcmlnaHRuZXNzKHJnYlN0cmluZzogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgbWF0Y2ggPSByZ2JTdHJpbmcubWF0Y2goLyhcXGQrKSxcXHMqKFxcZCspLFxccyooXFxkKykvKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIC8vIElmIHdlIGNhbid0IHBhcnNlIGl0LCBhc3N1bWUgYnJpZ2h0IHNvIHdlIGRvbid0IGFjY2lkZW50YWxseSBmbGlwIHRvIGRhcmsgbW9kZS5cbiAgICByZXR1cm4gMjU1O1xuICB9XG5cbiAgY29uc3QgciA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIGNvbnN0IGcgPSBwYXJzZUludChtYXRjaFsyXSwgMTApO1xuICBjb25zdCBiID0gcGFyc2VJbnQobWF0Y2hbM10sIDEwKTtcblxuICAvLyBIU1AgZXF1YXRpb24gaXMgcGVyY2VpdmVkIGJyaWdodG5lc3NcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IE1hdGguc3FydChcbiAgICAwLjI5OSAqIChyICogcikgK1xuICAgIDAuNTg3ICogKGcgKiBnKSArXG4gICAgMC4xMTQgKiAoYiAqIGIpXG4gICk7XG5cbiAgcmV0dXJuIGJyaWdodG5lc3M7XG59XG5cbi8qKlxuICogV2F0Y2hlcjogTm90aWZpZXMgeW91IHdoZW4gdGhlIHRoZW1lIGxpa2VseSBjaGFuZ2VkLlxuICpcbiAqIFlvdSBjYW4gdXNlIHRoaXMgaWYgeW91IGV2ZXIgd2FudCB0byBkeW5hbWljYWxseSByZS1zdHlsZSB0aGluZ3NcbiAqIHdoZW4gdGhlIHVzZXIgLyBleHRlbnNpb24gdG9nZ2xlcyB0aGVtZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoVGhlbWVDaGFuZ2VzKGNhbGxiYWNrOiAoaXNEYXJrOiBib29sZWFuKSA9PiB2b2lkKTogTXV0YXRpb25PYnNlcnZlciB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoKSA9PiB7XG4gICAgY2FsbGJhY2soaXNQYWdlRGFyaygpKTtcbiAgfTtcblxuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZXIpO1xuXG4gIC8vIFdhdGNoIGZvciBhdHRyaWJ1dGUvY2xhc3MgY2hhbmdlcyBvbiA8aHRtbD4gYW5kIDxib2R5PlxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnLCAnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgLy8gQWxzbyBsaXN0ZW4gdG8gc3lzdGVtIHRoZW1lIGNoYW5nZXMgYXMgYSBiYWNrdXAgc2lnbmFsXG4gIGlmICh0eXBlb2Ygd2luZG93Lm1hdGNoTWVkaWEgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjb25zdCBtcSA9IHdpbmRvdy5tYXRjaE1lZGlhKCcocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspJyk7XG4gICAgaWYgKG1xKSB7XG4gICAgICBjb25zdCBtcUxpc3RlbmVyID0gKCkgPT4gaGFuZGxlcigpO1xuICAgICAgLy8gTW9kZXJuIGJyb3dzZXJzXG4gICAgICBpZiAoKG1xIGFzIGFueSkuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBtcS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBtcUxpc3RlbmVyKTtcbiAgICAgIH0gZWxzZSBpZiAoKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIpIHtcbiAgICAgICAgLy8gTGVnYWN5IEFQSVxuICAgICAgICAobXEgYXMgYW55KS5hZGRMaXN0ZW5lcihtcUxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsIGNhbGwgc28gdGhlIGNvbnN1bWVyIGNhbiBzeW5jIGltbWVkaWF0ZWx5XG4gIGhhbmRsZXIoKTtcblxuICByZXR1cm4gb2JzZXJ2ZXI7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9pbmRleC50c1xuXG5jb25zdCBDTEFTU1JPT01fVVJMX1BBVFRFUk4gPSAvXmh0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcLy87XG5cbmltcG9ydCB7XG4gIERPV05MT0FEX0lDT05fU1ZHX1VSTCxcbiAgU1VDQ0VTU19JQ09OX1NWR19VUkwsXG4gIEVSUk9SX0lDT05fU1ZHX1VSTCxcbn0gZnJvbSAnLi9pY29ucyc7XG5cbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vc3R5bGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgaXNQYWdlRGFyayB9IGZyb20gJy4vdGhlbWUnO1xuXG5jb25zdCBJTkpFQ1RFRF9BVFRSID0gJ2RhdGEtY3FkLWluamVjdGVkJztcbmNvbnN0IFJFU0NBTl9JTlRFUlZBTF9NUyA9IDI1MDA7XG5jb25zdCBSRVNDQU5fREVCT1VOQ0VfTVMgPSAyNTA7XG5jb25zdCBMT0FESU5HX01JTl9NUyA9IDYwMDtcbmNvbnN0IEZFRURCQUNLX1NVQ0NFU1NfTVMgPSAyMDAwO1xuY29uc3QgRkVFREJBQ0tfRVJST1JfTVMgPSA0MDAwO1xuXG5jb25zdCBEUklWRV9BTkNIT1JfU0VMRUNUT1IgPVxuICAnYVtocmVmKj1cImh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbVwiXSwgYVtocmVmKj1cIi8vZHJpdmUuZ29vZ2xlLmNvbVwiXSwgYVtocmVmKj1cImNsYXNzcm9vbS5nb29nbGUuY29tL2RyaXZlXCJdJztcblxuY29uc3QgQVRUQUNITUVOVF9DT05UQUlORVJfU0VMRUNUT1IgPSBbXG4gICcuS2xSWGRmJyxcbiAgJy56M3ZSY2MnLFxuICAnLlZmUHBrZC1hUFA3OGUnLFxuICAnW2RhdGEtZHJpdmUtaWRdJyxcbiAgJ1tkYXRhLWlkXVtkYXRhLWl0ZW0taWRdJyxcbl0uam9pbignLCAnKTtcblxuY29uc3QgRFJJVkVfVVJMX1BBVFRFUk5TOiBSZWdFeHBbXSA9IFtcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvZmlsZVxcL2RcXC8vLFxuICAvaHR0cHM6XFwvXFwvZHJpdmVcXC5nb29nbGVcXC5jb21cXC9vcGVuXFw/LyxcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvdWNcXD8vLFxuICAvaHR0cHM6XFwvXFwvY2xhc3Nyb29tXFwuZ29vZ2xlXFwuY29tXFwvZHJpdmVcXC8vLFxuXTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEdsb2JhbCBTdGF0ZVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxudHlwZSBRdWVyeVJvb3QgPSBEb2N1bWVudCB8IEhUTUxFbGVtZW50IHwgRG9jdW1lbnRGcmFnbWVudDtcblxubGV0IHNjYW5UaW1lb3V0SWQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xubGV0IG9ic2VydmVyOiBNdXRhdGlvbk9ic2VydmVyIHwgbnVsbCA9IG51bGw7XG5cbnR5cGUgQnV0dG9uU3RhdGUgPSAnaWRsZScgfCAnbG9hZGluZycgfCAnc3VjY2VzcycgfCAnZXJyb3InIHwgJ3RyeWluZyc7XG5cbnR5cGUgRmlsZU1ldGEgPSB7XG4gIG5hbWU/OiBzdHJpbmc7XG4gIGV4dD86IHN0cmluZztcbiAga2luZD86IHN0cmluZztcbn07XG5cbnR5cGUgUGVuZGluZ0J1dHRvbiA9IHtcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudDtcbiAgcmVxdWVzdElkOiBzdHJpbmc7XG4gIGZpbGVNZXRhPzogRmlsZU1ldGE7XG4gIHN0YXJ0ZWRBdDogbnVtYmVyO1xufTtcblxubGV0IG5leHRSZXF1ZXN0U2VxID0gMTtcbmNvbnN0IHBlbmRpbmdCdXR0b25zID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdCdXR0b24+KCk7XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBFbnZpcm9ubWVudCAvIFBhZ2UgQ2hlY2tzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpc0dvb2dsZUNsYXNzcm9vbSgpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBsb2NhdGlvbiA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcbiAgaWYgKGxvY2F0aW9uLmhvc3RuYW1lICE9PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiBDTEFTU1JPT01fVVJMX1BBVFRFUk4udGVzdChsb2NhdGlvbi5ocmVmKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFNjYW5uaW5nIC8gT2JzZXJ2ZXJzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBzY2hlZHVsZVNjYW4oKTogdm9pZCB7XG4gIC8vIEZ1bGwtZG9jdW1lbnQgc2NhbiwgZGVib3VuY2VkIChiYWNrdXAgb25seSkuXG4gIGlmIChzY2FuVGltZW91dElkICE9PSBudWxsKSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dChzY2FuVGltZW91dElkKTtcbiAgfVxuICBzY2FuVGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIHNjYW5UaW1lb3V0SWQgPSBudWxsO1xuICAgIHNjYW5Gb3JBdHRhY2htZW50cyhkb2N1bWVudCk7XG4gIH0sIFJFU0NBTl9ERUJPVU5DRV9NUyk7XG59XG5cbmZ1bmN0aW9uIHNldHVwT2JzZXJ2ZXJzKCk6IHZvaWQge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuXG4gIGlmICghZG9jdW1lbnQuYm9keSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgJ0RPTUNvbnRlbnRMb2FkZWQnLFxuICAgICAgKCkgPT4gc2V0dXBPYnNlcnZlcnMoKSxcbiAgICAgIHsgb25jZTogdHJ1ZSB9LFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChvYnNlcnZlcikgcmV0dXJuO1xuXG4gIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgIGNvbnN0IHJvb3RzID0gbmV3IFNldDxRdWVyeVJvb3Q+KCk7XG5cbiAgICBmb3IgKGNvbnN0IG0gb2YgbXV0YXRpb25zKSB7XG4gICAgICBpZiAobS50eXBlICE9PSAnY2hpbGRMaXN0JykgY29udGludWU7XG5cbiAgICAgIG0uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgIGlmIChub2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBlbCA9IG5vZGUgYXMgSFRNTEVsZW1lbnQ7XG5cbiAgICAgICAgLy8gSWdub3JlIG91ciBvd24gaW5qZWN0ZWQgYnV0dG9uIG5vZGVzXG4gICAgICAgIGlmIChlbC5oYXNBdHRyaWJ1dGUgJiYgZWwuZ2V0QXR0cmlidXRlKElOSkVDVEVEX0FUVFIpID09PSAndHJ1ZScpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByb290cy5hZGQoZWwpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHJvb3RzLnNpemUgPT09IDApIHtcbiAgICAgIC8vIFdlaXJkIGZyYW1ld29yayB1cGRhdGVzIChhdHRyaWJ1dGVzIG9ubHkpPyBGYWxsIGJhY2sgdG8gYSBmdWxsIHNjYW4uXG4gICAgICBzY2hlZHVsZVNjYW4oKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBGYXN0IHBhdGg6IG9ubHkgc2NhbiB0aGUgbmV3IHN1YnRyZWVzLlxuICAgIHJvb3RzLmZvckVhY2goKHJvb3QpID0+IHNjYW5Gb3JBdHRhY2htZW50cyhyb290KSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICBzdWJ0cmVlOiB0cnVlLFxuICB9KTtcblxuICAvLyBTbG93IGJhY2t1cCBpbiBjYXNlIHdlIG1pc3NlZCBzb21ldGhpbmcuXG4gIHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgc2NoZWR1bGVTY2FuKCk7XG4gIH0sIFJFU0NBTl9JTlRFUlZBTF9NUyk7XG5cbiAgLy8gSW5pdGlhbCBmdWxsIHNjYW4gZm9yIGFscmVhZHktcmVuZGVyZWQgY29udGVudC5cbiAgc2NoZWR1bGVTY2FuKCk7XG59XG5cbi8qKlxuICogU2NhbiBhIHNwZWNpZmljIHN1YnRyZWUgKG9yIHRoZSB3aG9sZSBkb2N1bWVudCkgZm9yIERyaXZlIGxpbmtzXG4gKiBhbmQgaW5qZWN0IGRvd25sb2FkIGJ1dHRvbnMuXG4gKi9cbmZ1bmN0aW9uIHNjYW5Gb3JBdHRhY2htZW50cyhyb290OiBRdWVyeVJvb3QgPSBkb2N1bWVudCk6IHZvaWQge1xuICBpZiAoIWlzR29vZ2xlQ2xhc3Nyb29tKCkpIHJldHVybjtcbiAgaW5qZWN0U2luZ2xlRmlsZUJ1dHRvbnMocm9vdCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTaW5nbGUtZmlsZSBidXR0b25zXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RTaW5nbGVGaWxlQnV0dG9ucyhyb290OiBRdWVyeVJvb3QgPSBkb2N1bWVudCk6IHZvaWQge1xuICBjb25zdCBhbmNob3JzID0gQXJyYXkuZnJvbShcbiAgICByb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEFuY2hvckVsZW1lbnQ+KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUiksXG4gICk7XG5cbiAgZm9yIChjb25zdCBhbmNob3Igb2YgYW5jaG9ycykge1xuICAgIGNvbnN0IHVybCA9IGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IoYW5jaG9yKTtcbiAgICBpZiAoIXVybCkgY29udGludWU7XG5cbiAgICBjb25zdCBjb250YWluZXIgPVxuICAgICAgKGFuY2hvci5jbG9zZXN0KEFUVEFDSE1FTlRfQ09OVEFJTkVSX1NFTEVDVE9SKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpIHx8XG4gICAgICBhbmNob3IucGFyZW50RWxlbWVudCB8fFxuICAgICAgYW5jaG9yO1xuXG4gICAgaWYgKCFjb250YWluZXIgfHwgaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyKSkgY29udGludWU7XG4gICAgaW5qZWN0QnV0dG9uSW50b0F0dGFjaG1lbnQoY29udGFpbmVyLCB1cmwpO1xuICB9XG5cbiAgY29uc3QgbWV0YUVsZW1lbnRzID0gQXJyYXkuZnJvbShcbiAgICByb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgICAgJ1tkYXRhLWRyaXZlLWlkXSwgW2RhdGEtaWRdW2RhdGEtaXRlbS1pZF0sIFtkYXRhLWlkXVtkYXRhLXRvb2x0aXBdJyxcbiAgICApLFxuICApO1xuXG4gIGZvciAoY29uc3QgZWwgb2YgbWV0YUVsZW1lbnRzKSB7XG4gICAgaWYgKGhhc0luamVjdGVkQnV0dG9uKGVsKSkgY29udGludWU7XG5cbiAgICBjb25zdCB1cmwgPSBmaW5kRHJpdmVVcmwoZWwpO1xuICAgIGlmICghdXJsKSBjb250aW51ZTtcblxuICAgIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGVsLCB1cmwpO1xuICB9XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBVUkwgLyBET00gSGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gISFjb250YWluZXIucXVlcnlTZWxlY3RvcihgWyR7SU5KRUNURURfQVRUUn09XCJ0cnVlXCJdYCk7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IoYW5jaG9yOiBIVE1MQW5jaG9yRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBocmVmID0gYW5jaG9yLmhyZWY7XG4gIGlmICghaHJlZikgcmV0dXJuIG51bGw7XG4gIHJldHVybiBEUklWRV9VUkxfUEFUVEVSTlMuc29tZSgocmUpID0+IHJlLnRlc3QoaHJlZikpID8gaHJlZiA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmREcml2ZVVybChlbGVtZW50OiBIVE1MRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBuZWFyQW5jaG9yID1cbiAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEFuY2hvckVsZW1lbnQ+KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUikgfHxcbiAgICAoZWxlbWVudC5jbG9zZXN0KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUikgYXMgSFRNTEFuY2hvckVsZW1lbnQgfCBudWxsKTtcblxuICBpZiAobmVhckFuY2hvcikge1xuICAgIGNvbnN0IGhyZWYgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKG5lYXJBbmNob3IpO1xuICAgIGlmIChocmVmKSByZXR1cm4gaHJlZjtcbiAgfVxuXG4gIGNvbnN0IGRyaXZlSWQgPVxuICAgIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRyaXZlLWlkJykgfHwgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcbiAgaWYgKGRyaXZlSWQpIHtcbiAgICByZXR1cm4gdG9Eb3dubG9hZFVybChcbiAgICAgIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICBkcml2ZUlkLFxuICAgICAgKX1gLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogRGV0ZWN0cyBjdXJyZW50IHVzZXIgaW5kZXggKDAsIDEsIDIsIC4uLikgdG8gZml4IDQwMy9QZXJtaXNzaW9uIGVycm9yc1xuICovXG5mdW5jdGlvbiBnZXRBdXRoVXNlcigpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gbnVsbDtcblxuICAvLyAxLiBDaGVjayBVUkwgUXVlcnkgUGFyYW0gKD9hdXRodXNlcj0xKVxuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuICBpZiAocGFyYW1zLmhhcygnYXV0aHVzZXInKSkgcmV0dXJuIHBhcmFtcy5nZXQoJ2F1dGh1c2VyJyk7XG4gIGlmIChwYXJhbXMuaGFzKCd1JykpIHJldHVybiBwYXJhbXMuZ2V0KCd1Jyk7XG5cbiAgLy8gMi4gQ2hlY2sgVVJMIFBhdGggKC91LzEvLi4uKVxuICBjb25zdCBwYXRoTWF0Y2ggPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUubWF0Y2goL1xcL3VcXC8oXFxkKylcXC8vKTtcbiAgaWYgKHBhdGhNYXRjaCkgcmV0dXJuIHBhdGhNYXRjaFsxXTtcblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gdG9Eb3dubG9hZFVybChvcmlnaW5hbFVybDogc3RyaW5nLCBkZXB0aCA9IDApOiBzdHJpbmcge1xuICBpZiAoZGVwdGggPiAzKSByZXR1cm4gb3JpZ2luYWxVcmw7XG5cbiAgY29uc3QgYXV0aFVzZXIgPSBnZXRBdXRoVXNlcigpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gbmV3IFVSTChvcmlnaW5hbFVybCwgbG9jYXRpb24uaHJlZik7XG5cbiAgICBjb25zdCBhcHBlbmRBdXRoID0gKHU6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKCFhdXRoVXNlcikgcmV0dXJuIHU7XG4gICAgICBjb25zdCBuZXdVID0gbmV3IFVSTCh1KTtcbiAgICAgIGlmICghbmV3VS5zZWFyY2hQYXJhbXMuaGFzKCdhdXRodXNlcicpKSB7XG4gICAgICAgIG5ld1Uuc2VhcmNoUGFyYW1zLnNldCgnYXV0aHVzZXInLCBhdXRoVXNlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3VS50b1N0cmluZygpO1xuICAgIH07XG5cbiAgICBpZiAocGFyc2VkLmhvc3RuYW1lID09PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIGlmIChwYXJzZWQucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2F1dGhfd2FybXVwJykpIHtcbiAgICAgICAgY29uc3QgY29udCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdjb250aW51ZScpO1xuICAgICAgICBpZiAoY29udCkgcmV0dXJuIHRvRG93bmxvYWRVcmwoY29udCwgZGVwdGggKyAxKTtcbiAgICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKTtcbiAgICAgICAgaWYgKGlkKVxuICAgICAgICAgIHJldHVybiBhcHBlbmRBdXRoKFxuICAgICAgICAgICAgYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtpZH1gLFxuICAgICAgICAgICk7XG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKG9yaWdpbmFsVXJsKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZU1hdGNoID0gcGFyc2VkLnBhdGhuYW1lLm1hdGNoKC9eXFwvZmlsZVxcL2RcXC8oW14vXSspLyk7XG4gICAgICBpZiAoZmlsZU1hdGNoKSB7XG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKFxuICAgICAgICAgIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZmlsZU1hdGNoWzFdfWAsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXJzZWQucGF0aG5hbWUgPT09ICcvb3BlbicgfHwgcGFyc2VkLnBhdGhuYW1lID09PSAnL3VjJykge1xuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldCgnZXhwb3J0JywgJ2Rvd25sb2FkJyk7XG4gICAgICAgIGlmIChhdXRoVXNlcikgcGFyc2VkLnNlYXJjaFBhcmFtcy5zZXQoJ2F1dGh1c2VyJywgYXV0aFVzZXIpO1xuICAgICAgICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgcGFyc2VkLmhvc3RuYW1lID09PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nICYmXG4gICAgICBwYXJzZWQucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2RyaXZlJylcbiAgICApIHtcbiAgICAgIGNvbnN0IGlkID1cbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2lkJykgfHxcbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc291cmNlSWQnKSB8fFxuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnZmlsZUlkJyk7XG4gICAgICBpZiAoaWQpXG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKFxuICAgICAgICAgIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7aWR9YCxcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXBwZW5kQXV0aChvcmlnaW5hbFVybCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBvcmlnaW5hbFVybDtcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRmlsZSBtZXRhZGF0YSBleHRyYWN0aW9uXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBjbGVhbkF0dGFjaG1lbnROYW1lKHJhd05hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghcmF3TmFtZSkgcmV0dXJuICcnO1xuICBsZXQgbmFtZSA9IHJhd05hbWUudHJpbSgpO1xuXG4gIGNvbnN0IGdhcmJhZ2VMYWJlbHMgPSBbXG4gICAgJ01pY3Jvc29mdCBFeGNlbCcsXG4gICAgJ01pY3Jvc29mdCBXb3JkJyxcbiAgICAnTWljcm9zb2Z0IFBvd2VyUG9pbnQnLFxuICAgICdDb21wcmVzc2VkIGFyY2hpdmUnLFxuICAgICdCaW5hcnknLFxuICAgICdVbmtub3duJyxcbiAgICAnR29vZ2xlIFNoZWV0cycsXG4gICAgJ0dvb2dsZSBEb2NzJyxcbiAgICAnR29vZ2xlIFNsaWRlcycsXG4gICAgJ1RleHQgRmlsZScsXG4gICAgJ1BERicsXG4gICAgJ1ZpZGVvJyxcbiAgICAnSW1hZ2UnLFxuICAgICdBdWRpbycsXG4gICAgJ1RleHQnLFxuICAgICdXb3JkJyxcbiAgICAnRXhjZWwnLFxuICAgICdQb3dlclBvaW50JyxcbiAgICAnQXJjaGl2ZScsXG4gICAgJ1ppcCcsXG4gICAgJ0ZpbGUnLFxuICAgICdEb2N1bWVudCcsXG4gICAgJ1Nob3J0Y3V0JyxcbiAgICAnQ29kZScsXG4gIF07XG5cbiAgZm9yIChjb25zdCBsYWJlbCBvZiBnYXJiYWdlTGFiZWxzKSB7XG4gICAgaWYgKG5hbWUuZW5kc1dpdGgobGFiZWwpKSB7XG4gICAgICBjb25zdCBwb3RlbnRpYWwgPSBuYW1lLnNsaWNlKDAsIC1sYWJlbC5sZW5ndGgpLnRyaW0oKTtcbiAgICAgIGlmIChwb3RlbnRpYWwubGVuZ3RoID4gMCkge1xuICAgICAgICBuYW1lID0gcG90ZW50aWFsO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBEZWR1cGxpY2F0ZSBlLmcuIFwiZmlsZWZpbGVcIlxuICBpZiAobmFtZS5sZW5ndGggPiAwICYmIG5hbWUubGVuZ3RoICUgMiA9PT0gMCkge1xuICAgIGNvbnN0IG1pZCA9IG5hbWUubGVuZ3RoIC8gMjtcbiAgICBjb25zdCBmaXJzdEhhbGYgPSBuYW1lLnNsaWNlKDAsIG1pZCk7XG4gICAgY29uc3Qgc2Vjb25kSGFsZiA9IG5hbWUuc2xpY2UobWlkKTtcbiAgICBpZiAoZmlyc3RIYWxmID09PSBzZWNvbmRIYWxmKSB7XG4gICAgICByZXR1cm4gZmlyc3RIYWxmO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHJlcGVhdFJlZ2V4ID0gL1xcLihbYS16QS1aMC05XXsyLDEwfSlcXDEkL2k7XG4gIGNvbnN0IHJlcGVhdE1hdGNoID0gbmFtZS5tYXRjaChyZXBlYXRSZWdleCk7XG4gIGlmIChyZXBlYXRNYXRjaCkge1xuICAgIHJldHVybiBuYW1lLnNsaWNlKDAsIC1yZXBlYXRNYXRjaFsxXS5sZW5ndGgpLnRyaW0oKTtcbiAgfVxuXG4gIHJldHVybiBuYW1lO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0RmlsZU1ldGEoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdXJsOiBzdHJpbmcpOiBGaWxlTWV0YSB7XG4gIGxldCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgY29uc3QgdG9vbHRpcCA9XG4gICAgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnZGF0YS10b29sdGlwJykgfHxcbiAgICBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHxcbiAgICBjb250YWluZXIuZ2V0QXR0cmlidXRlKCd0aXRsZScpO1xuXG4gIGlmICh0b29sdGlwICYmIHRvb2x0aXAudHJpbSgpKSBuYW1lID0gdG9vbHRpcC50cmltKCk7XG5cbiAgaWYgKCFuYW1lKSB7XG4gICAgY29uc3QgdGV4dCA9IChjb250YWluZXIudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAodGV4dCkge1xuICAgICAgY29uc3QgbGluZXMgPSB0ZXh0XG4gICAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgICAgLm1hcCgobCkgPT4gbC50cmltKCkpXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAobGluZXMubGVuZ3RoID4gMCkgbmFtZSA9IGxpbmVzWzBdO1xuICAgIH1cbiAgfVxuXG4gIGlmICghbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1ID0gbmV3IFVSTCh1cmwpO1xuICAgICAgY29uc3QgcGF0aE5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQodS5wYXRobmFtZS5zcGxpdCgnLycpLnBvcCgpIHx8ICcnKTtcbiAgICAgIGlmIChwYXRoTmFtZSAmJiBwYXRoTmFtZS5pbmNsdWRlcygnLicpKSBuYW1lID0gcGF0aE5hbWU7XG4gICAgfSBjYXRjaCB7fVxuICB9XG5cbiAgaWYgKG5hbWUpIG5hbWUgPSBjbGVhbkF0dGFjaG1lbnROYW1lKG5hbWUpO1xuXG4gIGxldCBleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaWYgKG5hbWUpIHtcbiAgICBjb25zdCBtID0gbmFtZS5tYXRjaCgvXFwuKFthLXpBLVowLTldezIsMTB9KSQvKTtcbiAgICBpZiAobSkgZXh0ID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xuICB9XG5cbiAgbGV0IGtpbmQ6IHN0cmluZyA9ICdvdGhlcic7XG4gIGlmIChleHQpIHtcbiAgICBzd2l0Y2ggKGV4dCkge1xuICAgICAgY2FzZSAncGRmJzpcbiAgICAgICAga2luZCA9ICdwZGYnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RvYyc6XG4gICAgICBjYXNlICdkb2N4JzpcbiAgICAgIGNhc2UgJ3R4dCc6XG4gICAgICBjYXNlICdydGYnOlxuICAgICAgY2FzZSAnb2R0JzpcbiAgICAgIGNhc2UgJ21kJzpcbiAgICAgIGNhc2UgJ3RleCc6XG4gICAgICBjYXNlICdjbHMnOlxuICAgICAgY2FzZSAnZW1seCc6XG4gICAgICAgIGtpbmQgPSAnZG9jJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd4bHMnOlxuICAgICAgY2FzZSAneGxzeCc6XG4gICAgICBjYXNlICdjc3YnOlxuICAgICAgY2FzZSAnb2RzJzpcbiAgICAgIGNhc2UgJ251bWJlcnMnOlxuICAgICAgICBraW5kID0gJ3NoZWV0JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwcHQnOlxuICAgICAgY2FzZSAncHB0eCc6XG4gICAgICBjYXNlICdvZHAnOlxuICAgICAgY2FzZSAna2V5JzpcbiAgICAgICAga2luZCA9ICdzbGlkZSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnanBnJzpcbiAgICAgIGNhc2UgJ2pwZWcnOlxuICAgICAgY2FzZSAncG5nJzpcbiAgICAgIGNhc2UgJ2dpZic6XG4gICAgICBjYXNlICd3ZWJwJzpcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICBjYXNlICdibXAnOlxuICAgICAgY2FzZSAnaWNvJzpcbiAgICAgIGNhc2UgJ2F2aWYnOlxuICAgICAgY2FzZSAnZmlnJzpcbiAgICAgIGNhc2UgJ3BzZCc6XG4gICAgICBjYXNlICdhaSc6XG4gICAgICAgIGtpbmQgPSAnaW1hZ2UnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ21wNCc6XG4gICAgICBjYXNlICdtb3YnOlxuICAgICAgY2FzZSAnYXZpJzpcbiAgICAgIGNhc2UgJ21rdic6XG4gICAgICBjYXNlICd3ZWJtJzpcbiAgICAgIGNhc2UgJ2Zsdic6XG4gICAgICBjYXNlICd3bXYnOlxuICAgICAgY2FzZSAnbTR2JzpcbiAgICAgICAga2luZCA9ICd2aWRlbyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbXAzJzpcbiAgICAgIGNhc2UgJ3dhdic6XG4gICAgICBjYXNlICdvZ2cnOlxuICAgICAgY2FzZSAnbTRhJzpcbiAgICAgIGNhc2UgJ2ZsYWMnOlxuICAgICAgY2FzZSAnYWFjJzpcbiAgICAgICAga2luZCA9ICdhdWRpbyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnemlwJzpcbiAgICAgIGNhc2UgJ3Jhcic6XG4gICAgICBjYXNlICc3eic6XG4gICAgICBjYXNlICd0YXInOlxuICAgICAgY2FzZSAnZ3onOlxuICAgICAgY2FzZSAnaXNvJzpcbiAgICAgIGNhc2UgJ2RtZyc6XG4gICAgICBjYXNlICdwa2cnOlxuICAgICAgY2FzZSAnbWh0JzpcbiAgICAgICAga2luZCA9ICdhcmNoaXZlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdodG1sJzpcbiAgICAgIGNhc2UgJ2h0bSc6XG4gICAgICBjYXNlICd4bWwnOlxuICAgICAgY2FzZSAnY3NzJzpcbiAgICAgIGNhc2UgJ2pzJzpcbiAgICAgIGNhc2UgJ3RzJzpcbiAgICAgIGNhc2UgJ2pzeCc6XG4gICAgICBjYXNlICd0c3gnOlxuICAgICAgY2FzZSAnanNvbic6XG4gICAgICBjYXNlICdwaHAnOlxuICAgICAgY2FzZSAnc3FsJzpcbiAgICAgIGNhc2UgJ3B5JzpcbiAgICAgIGNhc2UgJ2MnOlxuICAgICAgY2FzZSAnY3BwJzpcbiAgICAgIGNhc2UgJ2NzJzpcbiAgICAgIGNhc2UgJ2phdmEnOlxuICAgICAgY2FzZSAncmInOlxuICAgICAgY2FzZSAnZ28nOlxuICAgICAgY2FzZSAnc2gnOlxuICAgICAgY2FzZSAnYmF0JzpcbiAgICAgIGNhc2UgJ2lweW5iJzpcbiAgICAgIGNhc2UgJ3BrdCc6XG4gICAgICBjYXNlICdsb2NrJzpcbiAgICAgIGNhc2UgJ3ltbCc6XG4gICAgICBjYXNlICd5YW1sJzpcbiAgICAgICAga2luZCA9ICdjb2RlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd0dGYnOlxuICAgICAgY2FzZSAnb3RmJzpcbiAgICAgIGNhc2UgJ3dvZmYnOlxuICAgICAgY2FzZSAnd29mZjInOlxuICAgICAgY2FzZSAnZW90JzpcbiAgICAgICAga2luZCA9ICdmb250JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdleGUnOlxuICAgICAgY2FzZSAnbXNpJzpcbiAgICAgIGNhc2UgJ2Fwayc6XG4gICAgICBjYXNlICdhcHAnOlxuICAgICAgY2FzZSAnamFyJzpcbiAgICAgIGNhc2UgJ2RsbCc6XG4gICAgICBjYXNlICdwZGInOlxuICAgICAgY2FzZSAnbG5rJzpcbiAgICAgIGNhc2UgJ2RhdCc6XG4gICAgICBjYXNlICdzcWxpdGUnOlxuICAgICAgY2FzZSAnZGInOlxuICAgICAgY2FzZSAnZHJhd2lvJzpcbiAgICAgIGNhc2UgJ2RtcCc6XG4gICAgICAgIGtpbmQgPSAnYmluYXJ5JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBraW5kID0gJ290aGVyJztcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBuYW1lLCBleHQsIGtpbmQgfTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEJ1dHRvbiBpbmplY3Rpb25cbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHVybDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghdXJsKSByZXR1cm47XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoY29udGFpbmVyKTtcbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykgY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblxuICBjb25zdCBkaXJlY3RVcmwgPSB0b0Rvd25sb2FkVXJsKHVybCk7XG4gIGNvbnN0IGZpbGVNZXRhID0gZXh0cmFjdEZpbGVNZXRhKGNvbnRhaW5lciwgZGlyZWN0VXJsKTtcbiAgY29uc3QgYnV0dG9uID0gY3JlYXRlRG93bmxvYWRCdXR0b24oY29udGFpbmVyLCBkaXJlY3RVcmwsIGZpbGVNZXRhKTtcblxuICBjb25zdCBpY29uRWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBpZiAoaWNvbkVsKSBpY29uRWwuY2xhc3NMaXN0LmFkZCgnY3FkLWljb24tbWVkaXVtJyk7XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gc3RhdGUgaGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0QnV0dG9uU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCk6IEJ1dHRvblN0YXRlIHtcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykpIHJldHVybiAnbG9hZGluZyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtdHJ5aW5nJykpIHJldHVybiAndHJ5aW5nJztcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykpIHJldHVybiAnc3VjY2Vzcyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtZXJyb3InKSkgcmV0dXJuICdlcnJvcic7XG4gIHJldHVybiAnaWRsZSc7XG59XG5cblxuZnVuY3Rpb24gc2V0QnV0dG9uU3RhdGUoXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIHN0YXRlOiBCdXR0b25TdGF0ZSxcbiAgb3B0aW9ucz86IHsgdXNlck1lc3NhZ2U/OiBzdHJpbmcgfSxcbik6IHZvaWQge1xuICBjb25zdCBpY29uID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWRvd25sb2FkLWljb24nKTtcbiAgY29uc3QgbGFiZWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MU3BhbkVsZW1lbnQ+KCcuY3FkLWxhYmVsJyk7XG4gIGNvbnN0IGVycm9yRGV0YWlsID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTFNwYW5FbGVtZW50PignLmNxZC1lcnJvci1kZXRhaWwnKTtcbiAgaWYgKCFpY29uIHx8ICFsYWJlbCB8fCAhZXJyb3JEZXRhaWwpIHJldHVybjtcblxuICAvLyBSZXNldCB0byBpZGxlIGJhc2VsaW5lXG4gIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdjcWQtbG9hZGluZycsICdjcWQtdHJ5aW5nJywgJ2NxZC1zdWNjZXNzJywgJ2NxZC1lcnJvcicpO1xuICBpY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1zcGlubmVyJyk7XG4gIGljb24udGV4dENvbnRlbnQgPSAnJztcbiAgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJzsgLy8gQ2xlYXIgbWFudWFsIEJHIHRvIGxldCBDU1MgdmFyaWFibGVzIHdvcmtcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZCcpO1xuICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9ICcnO1xuXG4gIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKWA7XG4gIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnJztcblxuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSAnaWRsZSc6XG4gICAgICAvLyBBbHJlYWR5IHJlc2V0IGFib3ZlXG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2xvYWRpbmcnOlxuICAgIGNhc2UgJ3RyeWluZyc6IHtcbiAgICAgIGNvbnN0IGlzVHJ5aW5nID0gc3RhdGUgPT09ICd0cnlpbmcnO1xuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoaXNUcnlpbmcgPyAnY3FkLXRyeWluZycgOiAnY3FkLWxvYWRpbmcnKTtcbiAgICAgIGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IGlzVHJ5aW5nID8gdCgndHJ5aW5nJykgOiB0KCdkb3dubG9hZGluZycpO1xuICAgICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3Bpbm5lcicpO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnbm9uZSc7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlICdzdWNjZXNzJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3VjY2VzcycpO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZGVkJyk7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGB1cmwoXCIke1NVQ0NFU1NfSUNPTl9TVkdfVVJMfVwiKWA7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRTaXplID0gJzIwcHggMjBweCc7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtZXJyb3InKTtcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gdCgnZXJyb3InKTtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RVJST1JfSUNPTl9TVkdfVVJMfVwiKWA7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRTaXplID0gJzIwcHggMjBweCc7XG4gICAgICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9IG9wdGlvbnM/LnVzZXJNZXNzYWdlIHx8IHQoJ2ZhaWxlZCcpO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuXG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gZmFjdG9yeVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gY3JlYXRlRG93bmxvYWRCdXR0b24oXG4gIF9jb250YWluZXI6IEhUTUxFbGVtZW50LFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgYnV0dG9uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYnRuJztcbiAgXG4gIC8vIFRIRU1FIENIRUNLOiBBcHBseSBkYXJrIG1vZGUgY2xhc3MgaWYgbmVlZGVkXG4gIGlmIChpc1BhZ2VEYXJrKCkpIHtcbiAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcbiAgfVxuXG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoSU5KRUNURURfQVRUUiwgJ3RydWUnKTtcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGAke3QoJ2FyaWFEb3dubG9hZCcpfSAke2ZpbGVNZXRhLm5hbWUgfHwgJyd9YCk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgdCgndGl0bGVRdWljaycpKTtcblxuICBjb25zdCBpY29uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvbldyYXBwZXIuY2xhc3NOYW1lID0gJ2NxZC1pY29uLXdyYXBwZXInO1xuICBjb25zdCBpY29uU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvblNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1pY29uJztcbiAgaWNvbldyYXBwZXIuYXBwZW5kQ2hpbGQoaWNvblNwYW4pO1xuXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBsYWJlbC5jbGFzc05hbWUgPSAnY3FkLWxhYmVsJztcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZCcpO1xuXG4gIGNvbnN0IGVycm9yRGV0YWlsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBlcnJvckRldGFpbC5jbGFzc05hbWUgPSAnY3FkLWVycm9yLWRldGFpbCc7XG5cbiAgYnV0dG9uLmFwcGVuZENoaWxkKGljb25XcmFwcGVyKTtcbiAgYnV0dG9uLmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgYnV0dG9uLmFwcGVuZENoaWxkKGVycm9yRGV0YWlsKTtcblxuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGF3YWl0IGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soYnV0dG9uLCB1cmwsIGZpbGVNZXRhKTtcbiAgfSk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2F1eGNsaWNrJywgYXN5bmMgKGUpID0+IHtcbiAgICBpZiAoZS5idXR0b24gIT09IDEpIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBhd2FpdCBoYW5kbGVTaW5nbGVEb3dubG9hZENsaWNrKGJ1dHRvbiwgdXJsLCBmaWxlTWV0YSk7XG4gIH0pO1xuXG4gIHJldHVybiBidXR0b247XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBEb3dubG9hZCBjbGljayBoYW5kbGVyICh1cGRhdGVkIHRvIHJlbHkgb24gYmFja2dyb3VuZClcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIHVybDogc3RyaW5nLFxuICBmaWxlTWV0YTogRmlsZU1ldGEsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF1cmwpIHJldHVybjtcbiAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdpZGxlJykgcmV0dXJuO1xuXG4gIGNvbnN0IHJlcXVlc3RJZCA9IGBjcWQtJHtEYXRlLm5vdygpfS0ke25leHRSZXF1ZXN0U2VxKyt9YDtcbiAgY29uc3Qgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcblxuICAvLyBSZWdpc3RlciB0aGlzIGJ1dHRvbiBzbyBiYWNrZ3JvdW5kIGNhbiB1cGRhdGUgaXQgdmlhIG1lc3NhZ2VzXG4gIHBlbmRpbmdCdXR0b25zLnNldChyZXF1ZXN0SWQsIHtcbiAgICBidXR0b24sXG4gICAgcmVxdWVzdElkLFxuICAgIGZpbGVNZXRhLFxuICAgIHN0YXJ0ZWRBdCxcbiAgfSk7XG5cbiAgLy8gSW1tZWRpYXRlbHkgc2hvdyBsb2FkaW5nXG4gIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2xvYWRpbmcnKTtcblxuICBjb25zdCBzdGFydFJlc3VsdCA9IGF3YWl0IHN0YXJ0QmFja2dyb3VuZERvd25sb2FkKHJlcXVlc3RJZCwgdXJsLCBmaWxlTWV0YSk7XG5cbiAgaWYgKCFzdGFydFJlc3VsdC5vaykge1xuICAgIC8vIENvdWxkIG5vdCBldmVuIHN0YXJ0IHRoZSBkb3dubG9hZFxuICAgIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgIGF3YWl0IGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0KTtcbiAgICBhd2FpdCBzaG93RXJyb3JTdGF0ZShidXR0b24sIHN0YXJ0UmVzdWx0LnVzZXJNZXNzYWdlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBJZiB0aGUgZG93bmxvYWQgc3RhcnRlZCwga2VlcCB0aGUgYnV0dG9uIGluIFwibG9hZGluZ1wiLlxuICAvLyBUaGUgYmFja2dyb3VuZCBzY3JpcHQgd2lsbCBzZW5kIENRRF9ET1dOTE9BRF9TVEFUVVMgd2l0aCBlaXRoZXJcbiAgLy8gXCJzdWNjZXNzXCIgb3IgXCJlcnJvclwiIHdoZW4gaXQga25vd3MgdGhlIGZpbmFsIHJlc3VsdC5cbn1cblxuZnVuY3Rpb24gc3RhcnRCYWNrZ3JvdW5kRG93bmxvYWQoXG4gIHJlcXVlc3RJZDogc3RyaW5nLFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogUHJvbWlzZTx7IG9rOiBib29sZWFuOyB1c2VyTWVzc2FnZT86IHN0cmluZyB9PiB7XG4gIGNvbnN0IGZpbmFsVXJsID0gdG9Eb3dubG9hZFVybCh1cmwpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBpZiAodHlwZW9mIGNocm9tZSA9PT0gJ3VuZGVmaW5lZCcgfHwgIWNocm9tZS5ydW50aW1lPy5zZW5kTWVzc2FnZSkge1xuICAgICAgcmVzb2x2ZSh7IG9rOiBmYWxzZSwgdXNlck1lc3NhZ2U6ICdFeHRlbnNpb24gcnVudGltZSBub3QgYXZhaWxhYmxlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShcbiAgICAgICAgeyB0eXBlOiAnQ1FEX0RPV05MT0FEJywgdXJsOiBmaW5hbFVybCwgcmVxdWVzdElkLCBmaWxlTWV0YSB9LFxuICAgICAgICAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yIHx8ICFyZXNwb25zZSB8fCByZXNwb25zZS5zdGFydGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgdXNlck1lc3NhZ2U6IHJlc3BvbnNlPy51c2VyTWVzc2FnZSB8fCAnQ291bGQgbm90IHN0YXJ0IGRvd25sb2FkLicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzb2x2ZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXNvbHZlKHsgb2s6IGZhbHNlLCB1c2VyTWVzc2FnZTogJ0V4dGVuc2lvbiBjb21tdW5pY2F0aW9uIGVycm9yLicgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFVJIFV0aWxzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5hc3luYyBmdW5jdGlvbiBzaG93RXJyb3JTdGF0ZShcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgdXNlck1lc3NhZ2U/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnZXJyb3InLCB7IHVzZXJNZXNzYWdlIH0pO1xuICBjb25zdCBlYXJsaWVzdFJlc2V0ID0gRGF0ZS5ub3coKSArIEZFRURCQUNLX0VSUk9SX01TO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGF3YWl0IGRlbGF5KDIwMCk7XG4gICAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdlcnJvcicpIHJldHVybjtcbiAgICBpZiAoRGF0ZS5ub3coKSA8IGVhcmxpZXN0UmVzZXQpIGNvbnRpbnVlO1xuICAgIGlmICghYnV0dG9uLm1hdGNoZXMoJzpob3ZlcicpKSB7XG4gICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdpZGxlJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydGVkQXQ7XG4gIGlmIChlbGFwc2VkIDwgTE9BRElOR19NSU5fTVMpIGF3YWl0IGRlbGF5KExPQURJTkdfTUlOX01TIC0gZWxhcHNlZCk7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogTGlzdGVuIGZvciBiYWNrZ3JvdW5kIHN0YXR1cyB1cGRhdGVzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLnJ1bnRpbWU/Lm9uTWVzc2FnZSkge1xuICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS50eXBlICE9PSAnQ1FEX0RPV05MT0FEX1NUQVRVUycpIHJldHVybjtcblxuICAgIGNvbnN0IHJlcXVlc3RJZCA9IG1lc3NhZ2UucmVxdWVzdElkIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIXJlcXVlc3RJZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcGVuZGluZyA9IHBlbmRpbmdCdXR0b25zLmdldChyZXF1ZXN0SWQpO1xuICAgIGlmICghcGVuZGluZykgcmV0dXJuO1xuXG4gICAgY29uc3QgeyBidXR0b24sIHN0YXJ0ZWRBdCB9ID0gcGVuZGluZztcblxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgZW5zdXJlTWluTG9hZGluZyhzdGFydGVkQXQpO1xuXG4gICAgICAgICAgICBjb25zdCBzdGF0dXMgPSBtZXNzYWdlLnN0YXR1cyBhc1xuICAgICAgICB8IEJ1dHRvblN0YXRlXG4gICAgICAgIHwgJ2Jsb2NrZWRfaHRtbCdcbiAgICAgICAgfCAnaW50ZXJydXB0ZWQnXG4gICAgICAgIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgZXJyb3JDb2RlID0gbWVzc2FnZS5lcnJvckNvZGUgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgdXNlck1lc3NhZ2UgPSBtZXNzYWdlLnVzZXJNZXNzYWdlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVFJZSU5HIFBBVEggKG5vbi1kaXJlY3QgZmxvd3M6IGF1dGh1c2VyIGxvb3AgLyB2aXJ1cyBieXBhc3MpXG4gICAgICBpZiAoc3RhdHVzID09PSAndHJ5aW5nJykge1xuICAgICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICd0cnlpbmcnLCB7IHVzZXJNZXNzYWdlIH0pO1xuICAgICAgICAvLyBLZWVwIGl0IHBlbmRpbmcgc28gbGF0ZXIgXCJzdWNjZXNzXCIgY2FuIG92ZXJyaWRlXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gU1VDQ0VTUyBQQVRIXG4gICAgICBpZiAoc3RhdHVzID09PSAnc3VjY2VzcycgfHwgc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdzdWNjZXNzJyk7XG4gICAgICAgIGF3YWl0IGRlbGF5KEZFRURCQUNLX1NVQ0NFU1NfTVMpO1xuICAgICAgICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSA9PT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICAgICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnaWRsZScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gRVJST1IgUEFUSFNcbiAgICAgIGlmIChcbiAgICAgICAgc3RhdHVzID09PSAnZXJyb3InIHx8XG4gICAgICAgIHN0YXR1cyA9PT0gJ2ludGVycnVwdGVkJyB8fFxuICAgICAgICBzdGF0dXMgPT09ICdibG9ja2VkX2h0bWwnXG4gICAgICApIHtcbiAgICAgICAgLy8gQVVUSF9DSEVDSyBlcnJvcnMgYXJlIFwic29mdFwiOiB3ZSBtaWdodCBzdGlsbCBmbGlwIHRvIHN1Y2Nlc3MgbGF0ZXJcbiAgICAgICAgaWYgKGVycm9yQ29kZSA9PT0gJ0FVVEhfQ0hFQ0snKSB7XG4gICAgICAgICAgYXdhaXQgc2hvd0Vycm9yU3RhdGUoYnV0dG9uLCB1c2VyTWVzc2FnZSk7XG4gICAgICAgICAgLy8gS2VlcCBwZW5kaW5nQnV0dG9ucyBzbyBsYXRlciBcInN1Y2Nlc3NcIiBjYW4gb3ZlcnJpZGVcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbnkgb3RoZXIgZXJyb3IgaXMgZmluYWxcbiAgICAgICAgcGVuZGluZ0J1dHRvbnMuZGVsZXRlKHJlcXVlc3RJZCk7XG4gICAgICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgdXNlck1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgfSkoKTtcbiAgfSk7XG59XG5cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEVudHJ5XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbml0Q29udGVudFNjcmlwdCgpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFN0eWxlcygpO1xuICBzZXR1cE9ic2VydmVycygpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL2NsYXNzcm9vbS5nb29nbGUuY29tLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgbWFpbigpIHtcbiAgICBpbml0Q29udGVudFNjcmlwdCgpO1xuICB9LFxufSk7IiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0NPLFFBQU0sd0JBQXdCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFTOUIsUUFBTSx1QkFBdUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBVTdCLFFBQU0scUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVEzQixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQUVNLFFBQU0sdUJBQXVCLDJCQUEyQjtBQUFBLElBQzdEO0FBQUEsRUFDRixDQUFDO0FBRU0sUUFBTSxxQkFBcUIsMkJBQTJCO0FBQUEsSUFDM0Q7QUFBQSxFQUNGLENBQUM7QUNyQ0QsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sa0JBQWtCO0FBR3hCLFFBQU0sZ0JBQWdCO0FBQ3RCLFFBQU0saUJBQWlCLEdBQUcsYUFBYTtBQUVoQyxXQUFTLGVBQXFCO0FBQ25DLFFBQUksT0FBTyxhQUFhLFlBQWE7QUFDckMsUUFBSSxTQUFTLGVBQWUsUUFBUSxFQUFHO0FBRXZDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLEtBQUs7QUFDWCxVQUFNLGNBQWM7QUFBQTtBQUFBLDBCQUVJLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkF5S1QscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQXdKckMsZUFBZTtBQUFBLGdCQUNkLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FB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LFFBQUEsS0FBQTtBQUNFLGNBQUEsS0FBQTtBQUFBLFFBQWEsS0FBQTtBQUVULGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDRyxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBRUgsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDRyxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBRUgsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDRyxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBRUgsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQTtBQUVBLGlCQUFBO0FBQUEsTUFBTztBQUFBLElBQ1g7QUFHRixXQUFBLEVBQUEsTUFBQSxLQUFBLEtBQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSwyQkFBQSxXQUFBLEtBQUE7QUFDRSxRQUFBLENBQUEsSUFBQTtBQUNBLFVBQUEsV0FBQSxPQUFBLGlCQUFBLFNBQUE7QUFDQSxRQUFBLFNBQUEsYUFBQSxTQUFBLFdBQUEsTUFBQSxXQUFBO0FBRUEsVUFBQSxZQUFBLGNBQUEsR0FBQTtBQUNBLFVBQUEsV0FBQSxnQkFBQSxXQUFBLFNBQUE7QUFDQSxVQUFBLFNBQUEscUJBQUEsV0FBQSxXQUFBLFFBQUE7QUFFQSxVQUFBLFNBQUEsT0FBQSxjQUFBLG9CQUFBO0FBQ0EsUUFBQSxPQUFBLFFBQUEsVUFBQSxJQUFBLGlCQUFBO0FBRUEsY0FBQSxZQUFBLE1BQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSxlQUFBLFFBQUE7QUFDRSxRQUFBLE9BQUEsVUFBQSxTQUFBLGFBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxPQUFBLFVBQUEsU0FBQSxZQUFBLEVBQUEsUUFBQTtBQUNBLFFBQUEsT0FBQSxVQUFBLFNBQUEsYUFBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLE9BQUEsVUFBQSxTQUFBLFdBQUEsRUFBQSxRQUFBO0FBQ0EsV0FBQTtBQUFBLEVBQ0Y7QUFHQSxXQUFBLGVBQUEsUUFBQSxPQUFBLFNBQUE7QUFLRSxVQUFBLE9BQUEsT0FBQSxjQUFBLG9CQUFBO0FBQ0EsVUFBQSxRQUFBLE9BQUEsY0FBQSxZQUFBO0FBQ0EsVUFBQSxjQUFBLE9BQUEsY0FBQSxtQkFBQTtBQUNBLFFBQUEsQ0FBQSxRQUFBLENBQUEsU0FBQSxDQUFBLFlBQUE7QUFHQSxXQUFBLFVBQUEsT0FBQSxlQUFBLGNBQUEsZUFBQSxXQUFBO0FBQ0EsU0FBQSxVQUFBLE9BQUEsYUFBQTtBQUNBLFNBQUEsY0FBQTtBQUNBLFdBQUEsV0FBQTtBQUNBLFdBQUEsTUFBQSxrQkFBQTtBQUNBLFVBQUEsY0FBQSxFQUFBLFVBQUE7QUFDQSxnQkFBQSxjQUFBO0FBRUEsU0FBQSxNQUFBLGtCQUFBLFFBQUEscUJBQUE7QUFDQSxTQUFBLE1BQUEsaUJBQUE7QUFFQSxZQUFBLE9BQUE7QUFBQSxNQUFlLEtBQUE7QUFHWDtBQUFBLE1BQUEsS0FBQTtBQUFBLE1BRUcsS0FBQSxVQUFBO0FBRUgsY0FBQSxXQUFBLFVBQUE7QUFDQSxlQUFBLFVBQUEsSUFBQSxXQUFBLGVBQUEsYUFBQTtBQUNBLGVBQUEsV0FBQTtBQUNBLGNBQUEsY0FBQSxXQUFBLEVBQUEsUUFBQSxJQUFBLEVBQUEsYUFBQTtBQUNBLGFBQUEsVUFBQSxJQUFBLGFBQUE7QUFDQSxhQUFBLE1BQUEsa0JBQUE7QUFDQTtBQUFBLE1BQUE7QUFBQSxNQUNGLEtBQUE7QUFHRSxlQUFBLFVBQUEsSUFBQSxhQUFBO0FBQ0EsY0FBQSxjQUFBLEVBQUEsWUFBQTtBQUNBLGFBQUEsTUFBQSxrQkFBQSxRQUFBLG9CQUFBO0FBQ0EsYUFBQSxNQUFBLGlCQUFBO0FBQ0E7QUFBQSxNQUFBLEtBQUE7QUFHQSxlQUFBLFVBQUEsSUFBQSxXQUFBO0FBQ0EsY0FBQSxjQUFBLEVBQUEsT0FBQTtBQUNBLGFBQUEsTUFBQSxrQkFBQSxRQUFBLGtCQUFBO0FBQ0EsYUFBQSxNQUFBLGlCQUFBO0FBQ0Esb0JBQUEsY0FBQSxTQUFBLGVBQUEsRUFBQSxRQUFBO0FBQ0E7QUFBQSxJQUFBO0FBQUEsRUFFTjtBQVFBLFdBQUEscUJBQUEsWUFBQSxLQUFBLFVBQUE7QUFLRSxVQUFBLFNBQUEsU0FBQSxjQUFBLFFBQUE7QUFDQSxXQUFBLE9BQUE7QUFDQSxXQUFBLFlBQUE7QUFHQSxRQUFBLFdBQUEsR0FBQTtBQUNFLGFBQUEsVUFBQSxJQUFBLGdCQUFBO0FBQUEsSUFBcUM7QUFHdkMsV0FBQSxhQUFBLGVBQUEsTUFBQTtBQUNBLFdBQUEsYUFBQSxjQUFBLEdBQUEsRUFBQSxjQUFBLENBQUEsSUFBQSxTQUFBLFFBQUEsRUFBQSxFQUFBO0FBQ0EsV0FBQSxhQUFBLFNBQUEsRUFBQSxZQUFBLENBQUE7QUFFQSxVQUFBLGNBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxnQkFBQSxZQUFBO0FBQ0EsVUFBQSxXQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsYUFBQSxZQUFBO0FBQ0EsZ0JBQUEsWUFBQSxRQUFBO0FBRUEsVUFBQSxRQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsVUFBQSxZQUFBO0FBQ0Es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QyxLQUFLLG1CQUFtQixJQUFJLE1BQU0sTUFBTSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQ3hEO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksWUFBWSxTQUFTLGlCQUFrQjtBQUMzQyxlQUFLLGtCQUFpQjtBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUNBLHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDN0Q7QUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNiw3LDgsOSwxMCwxMV19
content;