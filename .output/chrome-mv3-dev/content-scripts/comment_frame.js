var commentframe = (function() {
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
  /* Default fallback pos if header injection fails: */
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

/* * If successfully injected into the Header row (the preferred location),
 * center it vertically relative to the author text/menu button.
 */
.cqd-download-all-btn.cqd-in-header {
  top: 50%;
  transform: translateY(-50%) translateZ(0);
}

.cqd-download-all-btn.cqd-in-header:active {
  transform: translateY(-50%) scale(0.97);
}

body[data-cqd-dir="rtl"] .cqd-download-all-btn {
  right: auto;
  left: 48px;
}

.cqd-download-all-btn:hover {
  box-shadow: var(--cqd-shadow-hover);
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
  const POST_SELECTOR = "div[data-stream-item-id]";
  const PROCESSED_ATTR = "data-cqd-processed";
  let commentScanScheduled = false;
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      injectStyles();
      scanForComments();
      const observer = new MutationObserver(() => {
        if (commentScanScheduled) return;
        commentScanScheduled = true;
        requestAnimationFrame(() => {
          commentScanScheduled = false;
          scanForComments();
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      setInterval(() => {
        scanForComments();
      }, 2500);
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          setTimeout(scanForComments, 500);
        }
      }).observe(document, { subtree: true, childList: true });
    }
  });
  function scanForComments() {
    try {
      const direction = getPageDirection();
      document.body.setAttribute("data-cqd-dir", direction);
      const posts = document.querySelectorAll(POST_SELECTOR);
      posts.forEach((post) => {
        if (post.hasAttribute(PROCESSED_ATTR)) {
          const existingOverlay = post.querySelector(".cqd-overlay-container");
          if (existingOverlay) {
            return;
          }
          post.removeAttribute(PROCESSED_ATTR);
        }
        if (post.parentElement?.closest(POST_SELECTOR)) return;
        const rawText = (post.innerText || "") + " " + getAriaLabels(post);
        const match = rawText.match(/(\d+)\s+class comment/i);
        const count = match ? parseInt(match[1], 10) : 0;
        if (count > 0) {
          post.setAttribute(PROCESSED_ATTR, "true");
          createOverlay(post, count);
        }
      });
    } catch (err) {
      console.warn("CQD Scan Error:", err);
    }
  }
  function createOverlay(post, count) {
    const computed = window.getComputedStyle(post);
    const borderRadius = computed.borderRadius || "8px";
    if (computed.position === "static") {
      post.style.position = "relative";
    }
    post.style.setProperty("overflow", "visible", "important");
    post.style.setProperty("contain", "none", "important");
    post.style.zIndex = "1";
    let overlay = post.querySelector(".cqd-overlay-container");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "cqd-overlay-container";
      overlay.style.borderRadius = borderRadius;
      if (isPageDark()) overlay.classList.add("cqd-theme-dark");
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) triggerPostClick(post);
      });
      post.appendChild(overlay);
    }
    if (post.querySelector(".cqd-both-badge")) {
      return;
    }
    const badge = document.createElement("div");
    badge.className = "cqd-comment-badge";
    const explanation = "Number of comments on this post";
    badge.title = explanation;
    badge.setAttribute("aria-label", explanation);
    badge.title = `${count} ${t("comments")}`;
    if (isPageDark()) badge.classList.add("cqd-theme-dark");
    const iconDiv = document.createElement("div");
    iconDiv.className = "cqd-badge-icon";
    iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
    const labelDiv = document.createElement("span");
    labelDiv.className = "cqd-badge-label";
    labelDiv.textContent = `${count}`;
    badge.appendChild(iconDiv);
    badge.appendChild(labelDiv);
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPostClick(post);
    });
    post.appendChild(badge);
  }
  function triggerPostClick(post) {
    const titleLink = post.querySelector('a[href*="/details/"], h2 a');
    if (titleLink) {
      titleLink.click();
    } else {
      post.click();
    }
  }
  function getPageDirection() {
    const docDir = document.documentElement.dir || document.body.dir;
    if (docDir === "rtl") return "rtl";
    const computed = window.getComputedStyle(document.body).direction;
    return computed === "rtl" ? "rtl" : "ltr";
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
    return `${browser?.runtime?.id}:${"comment_frame"}:${eventName}`;
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
      const ctx = new ContentScriptContext("comment_frame", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"comment_frame"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudF9mcmFtZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29tbWVudF9mcmFtZS5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBlbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzXG5cbi8vIFJhdyBTVkdzXG5leHBvcnQgY29uc3QgRE9XTkxPQURfSUNPTl9TVkdfUkFXID0gYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiPlxuICA8ZyBzdHJva2U9XCIjRkZGRkZGXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPlxuICAgIDxwYXRoIGQ9XCJNNiAyMUgxOFwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAzVjE3XCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDE3IDEyXCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDcgMTJcIiAvPlxuICA8L2c+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19SQVcgPSBgPHN2ZyB3aWR0aD1cIjE2MFwiIGhlaWdodD1cIjE2MFwiIHZpZXdCb3g9XCIwIDAgMTYwIDE2MFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPlxuPHJlY3Qgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBmaWxsPVwidXJsKCNwYXR0ZXJuMF8xXzI0ODQpXCIvPlxuPGRlZnM+XG48cGF0dGVybiBpZD1cInBhdHRlcm4wXzFfMjQ4NFwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiIGhlaWdodD1cIjFcIj5cbjx1c2UgeGxpbms6aHJlZj1cIiNpbWFnZTBfMV8yNDg0XCIgdHJhbnNmb3JtPVwic2NhbGUoMC4wMDYyNSlcIi8+XG48L3BhdHRlcm4+XG48aW1hZ2UgaWQ9XCJpbWFnZTBfMV8yNDg0XCIgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFnQUVsRVFWUjRBZTJkQ1hoVjViWDMxMG5JU01oNGhpU29WMnRyaGNvRGF1bDNhd3Y2VmF2WDF0VDJGclZlKy9XMjk3YjNYdTBWZWorMTBlc1U1bEVJUXhKbUVJaGxrRGxrbmdkQ0VpU01BaUt6UmZCVzhHdXJGV3Y5ZjgvLzNmdE5OakZJaG4xT1RzTGV6N055akp5Y3ZkLzEvKzIxM3JYMnUvY1JDY1NXSWVIeWd1OEd5ZkRkSXk5NW5nekpjR2U3TXR5YlhCbStTbGVHZDRjcnc3dlROZGJYNU1wb1kveC9qblhmQiszNWxUNVh2cWNHN2szVVJGNzBqSmFYdk44MXRKTHdRS0RodjMwOEc1Y2dMM252QzNuWk05NzFzcWZBbGVFOTZScnIvWXRybkErdThhWk44TUkxd1FmWHhNdllKQjljam5YZkI1ZnpMMzFQRGJRZTFHYXM5Mk9sMWN1ZUFtcEhEWVZhOXBydHhhVGhRdWd5UEUydXNkNkxydkdFekF2WFJDOWNrNzF3VGZIQk5kVzBhVDY0dEUzM3dhVnRoZyt1dHFiL3pYbHQ5ZE1YK2FLdC8vaTc5ZjNhNzN6VmVsQWJha1N0RkpoZUFubVJXbEpUb2JaQnU3M2t1MXN5dkt0a3JQZDlHZStGVFBSQ0puc2hVN3lRYVQ3SWRCOWtoZy95aWc4eTB3ZVpsUXpKVEliTTlrRm04OVcwT2NrUXgvem5BKzFuOWVvek5LQVcxSVRhVUNOcVJjMm9IVFdrbHRTVTJsSmphaDAwMjR1ZVd5WERzMXpHZWorVUNUeGdIcmc1Z0JrY21BWXRHVEkzR1RJdkJaS1ZBc2xPZ2VTa1FPYTNzUVVwa0xhMk1CWGlXT2Q5ME5hUC9MMnR2NmtEalpwUUcycEVPQmtjcUIwMVZERDZERzJwTWJXbTV0Uyt4N1lNVDR5ODdIbFd4bnJlTWNCanBQTWFaeERQSmc2Q2tTd3J1UlcwaFNtUVJTbVFKU21RcGJSVXlMSlV5SEtyRFlTODZwaGZmTEI4NEtXK3B1K3BBYldnSnRTR0doRlNCZ2RxUncycEpUVmxkS1RHaklvS1JNODdpb0hmdWdjRWxrT1NQOVpUS09NOXhzRW84THlRV1Q3SUhKOEpYYklSeVJhYnNDMUxnYnlhQ2xtUkNsbVpBbG5wZzZ6MFFGWW1RVlltUUZiR0c3WXFBZUtZLzN5Zy9FeC8wK2g3YWtBdFVneHRxQkcxSXBUVWpsRXp4d3drMUpZYXp6Q0REVUVrQTJRaFlORXd3LzBUR2VjNXJ1WUZVeG54TkhqSmtHd1RPaFhsektoRzRISUhRbktUSWJsdVNHNEM1SGR1OUZ0M0RlSTIzWXhyOG03SFZ3dS9qU0hGL3h2RFNyN2pXQUI4TUtUNExueTE0RnZLOTlTQVdsQVRwWTNTaUZvTk5JQmtkbHFTYWtSSHdraU5HUlUxaUdTQWMwUXlRVGI4dW8zMVBpUGpQUitxRU15b3g3Q3MweXdQam1jTXd6cWhXelVROGp1YUYvSzdSTWc2SHp4YmI4SHc4dnZ4VU9PLzQ3LzJ2WXh4aHpJeDgrMkZtSGQ4T2VhZldJV0ZKM01kQzRBUDZHdjZuTDZuQnRUaTRjYi9VTnBRSTJxbE5GUGFEVFMwcEtiVVZrZEZuWjdKZ0U3TFpJT00rR1hMY0krVkNSNmpNbUxVeS9SQzV2bU04TXlJeDVETjhMMHExUUJ2alEreUpnR1JtNjdIYmVYZnhiODAvMTlNT2pJWEMwK3V3dkozMWlwYmVubzFGcDErRFF0UHJjSUN4d0xxZzRXblZ5bmZVd09seCttMVNodHFSSzJvR2JXamhrSXRHVXlvTFRXbTF0U2NxWmtNa0FVeXdhcVpqSkFWVzdlMjhMRjFrdVdETEVnMkpxK3ZwbGpBUzFFSEhiSHBPdHhSL1FDZVBqQVcyU2RmeGRKM1ZvT0R6anE1REhOUExzRWMycWtsbUh0cXFXTTk2QU5xUUMyb0NiV2hSdFNLbWxFN2FrZ3REUkJUTENDYWhRc1pJQXRrd2k4UWpuTS9MUk05RU9iNlY3eVEyVjVqSHNCcWlaTlZUbDVmUzRXc0hRaFo2NFdzOTJCUTJRaU0zditpR3NUQzB5dlZBR2VkWEloV1c0UlpKeGRoMWluSGdzSUgxRUpacTBhRWt0b1JSR3BKVGFtdDBwaGFVM05xVHdiSUF1ZUdaSU9NcUhraGl4UDNVOTBMaEJtZVVUTFIvWkZNOVJnZlBNY0x5ZkZCRmlWRGxqUHFwVUJXcDBMV3BVSmVUMFQvcmRmandjWi94b3hqT2NnNTlTcG1ubGlBNlNkeU1QMWtEbWJRVGwzR1R1ZGdobU9COThIbDlEaHBhRWJ0cUNHMXBLYlVsaHBUYTZVNXRTY0RaSUZNa0EweW9pRDBRTEV6MXZOUTF5QWM1eDBxRTl5bld1Q2JhOEszT0JueUtxc2twbHFDbHdKWm40aVVvaUY0ZkYrNkN1VXpUK1JneXZHNW1ISmlMcWFjdE5pcHVaaGl0ZE56TWFYRjVtSEthY2NDNXdPTDc2MmE4TCt0bWxIRDQzTkJUWm1tcVRHMWx2VUpodlprZ0N5UUNiSkJDTWxLSzRTbmhTeDFhbU9UZVlLbldLYTZJVE85QnRYemZjWU91S1BYVWlCclV5RWJVaUFiRTNGaitmL0NidytOeDZ5VEN6RHBlQ1ltSEorRkNTY3lNZUdreFU1bFlrSmJPNTJKQ1ZacisrL083NS8zbVIwK3NmcWMvOTNlWjFxMW81YkhaeWx0cWZGdkQ0M0RsOHEvb2JSWERKQUZNcUVoSkN1TWhHU0hESkVsTXRYaGJYeFN1a3h4WDVwMld5SWY1M3NtZkpzUzhaV0t2OGV6aHlkZzJvbDV5RGcySFJuSHB5UGpoR2tuWnlCRDI2a1p5SENzOS9oQTY4WlhyU2UxUFRaZGFVM05xYjFzU2pRQ0VabklaWlZzaVlRNkhaT2xDVW5QZG95L2NiNGhNc2w5VG1aNHpJS2pUZVRqZkc5akttUlRFcTRydngxUEhjN0F4T096OFB6UnlYamgyR1M4Y0h3eVhqZ3hwZFZPVHNFTFZqdlY1bmY5Yi96L2pnWE9COXJ2MXRmMnRMRnFTVzJQVFZaYVUzTnFUd2JJZ21LQ2JGZ2pZVGFyWTdab1BGQk1rYTB2M0RJa1JNWjdYcFZwSHFPM3cvSmFGUnptbkkrVWJ4d0kyZXhHWXZFZy9QdUJaOVFaa2Y3MmVLUWZIWS8wWTZZZG40QjBiU2NtSUYzYnlRbElwK25mbmRmZzhrVjcrbWdkK2FyMXBkWnZqMWZha3dHeVFDWVVHeW9Tc2pCSk50Z2hRK3dUa2lteVJjWXV1MDN3akpRcDdvOWtwZ2N5end0WjRJTXM4MEZXSlVQV3BFQTJwRUkyZXhGZWNBMSszUHl2ZVBIdHlYanF5RXQ0NnUyWDhOVFJsL0RVc1pjTk8vNFNubktzNy9sQTYwdXRxZm1SbHhRRFpJRk1rQTNGQ0ZraE0yU0hESkVsTWtXMnlGaTdHOG1jNUY0bE05eVEyUjdJZkM5a0NTOVNKME5XczlKTmdXeEpnZVM1OFkwZDkrT1pJeGtZODliekdIM2tPWXgrK3ptTVB2cmZoaDM3YjR4MnJPLzZRT3RNelk4OHB4Z2dDMlNDYkNoR3lBcVpJVHRraUN5UktiSkZ4dHFOZ2hQZHQ4a1U5d1daNVliTTgwQVcrU0RMZlpEWGtpSHJVaUNiVWlCYjNmQ1czNEpmdmZrYmpIN3JPVHgrK0drOC90WXplUHpJTTNqOGJZc2RmUWFQTzliM2ZHRFZtSnBUKzhOUEt4YklCTmtnSTRvVk1rTjJ5QkJaSWxOa2k0eVJ0Yzl0azVJbXluUTNaSTRIa3VPQkxHWHE1ZlhjWktQSzJlSkRTSDR5N3RrNUN2OTU2TGY0NWNFeCtPWGgzK0NYYjVsMjVEZjRwV05YancrMDdtVGc0QmpGQk5rZ0k3TEZaekJEZHNnUVdTSlRaSXVNa2JWTHRzbHhDVEkxc1ZsbXVpRlpqSDVleUt0Y3hlS0R2SjRNMld5azNtc3FoK0huKzMrTlg3ejVuL2pad1Nmd3M4TVdlK3NKL015eHE4Y0hWdTBQUHFHWUlCdGtSS1ZpTWtOMnlCQlpJbE5raTR5Uk5UTFhzazFPdkZlbUozMGlzOTJRK1l4K1hzZ3FyN0VLWW1NeVpLc1ByZ0lmUmphbHFSMDlldUJYZVBUZ3YrSFJRNllkL2pjODZ0alY1d090UDFrNDhDdkZCaGtoSzJSR3lBNVgwcEFsTWtXMnlOajBwTDhLbVd2WnBpU05sMWVTakR5OTBITnA5R1Boc2MyTnhQS2I4YU05UDhNakIvNFZvdzc4SEtNTy9zS3dRNy9BS01ldVhoOW9EZzc4WExGQlJzZ0ttVkVGaVRVS2tpM09CY2thbVZQYkFnbVRhVW5Ga3BrRXlmWkFsbkNKdG81K1BraGVNaVRmalVIYnY0V0g5djBjRCs1N0RBOGVvUDBVRDc3NVV6eDQwTEdyMmdka2dDeVFpWDJQS1ViSUNwbFI3R3hrSGNGdUNyc3FIb014c2tibXlKNU1qN3RCcGllZWtybHV5QUkzWkprSDhwb1g4cm9Qc2prWnNzMkwwT0pVM05GMFAzNnc5NTl3Lzc2SGNmLytSM0QvQWNkNjBnZmZPL0FJL0dWZEdoZVoyUGV3WW9Tc2tCbXlveGdpUzJTS2JKRXhza2JteUo1TVM3eFhaaVorSWxsdXlDSTNaSVVic3BvTlJlWnhJL3JGbGQrSTcreDZFUGZ0K1RIdTJmc2ozTFB2SDNIUGZzZDYwZ2QzSC9naDdqeVVacHVOUEpTR2I3LzVmZHkxL3dmNGJsZTBKUk43ZjZRWUlTdGtSa1ZCTWtTV3lCVFpJbU5ramN5UlBabVc5S1JrSmtKeWtpQkwzSkJWSHNnYUwyU2pGNUxuZ3hRbUliWDZGbnluK1FlNGEzY2E3dHlUaGp2M3B1SE9mWTcxaEEvdTJwZUdrZnNmd0oxN0g4QUQ5WThncmVZbmVLRDJFYVIxd3g2b2VSamZxM2tJRHpYOEhEL2E5Mzh3Y3YvM082OHZtZGlUcGhnaEsyU0c3Q2lHeUJLWklsdGtqS3lST2JJbjA1T3laSFlpWkg0aVpCbnZqUEpBWHZkQ05ubU5FRnJrd1ExMXQyUGtydS9oanViN2NNZnUrM0RIbnZ0d3gxN0hlc1lILzREYkR0eUZ4NnAraFp6Rk9jaGFsSVBzcGRuSVhzclh6bHZXa216a0xGdUExemV0UjkzT2V2ekgvdi9Dclh2djdMeStaSUpzTk4rSE8zZDlUekVqUlI2REliSkVwc2dXR1NOclpHNUd3anlSVnhJMnlweEV5TUpFeUhLM2NYc2VsMTV2OFVMeVBaQmlIMjZxL3dhK3VldTdHTDdyYmd4dnZodkRkOStONFhzYzZ3a2ZETjA3RW5mc3VoY0w4aGRqWjNrVER1dytnTVA3RHVIUXZvTmR0RU00K2ZaSmZQYkIzMUR3WGdsdTIzTVhidDE5WitmMUpSTmtZOWZkaWhVeVEzWVVRMlNKVFBIV1R6Skcxc2djMlpPWkNSVXlMeEd5S0FteUlnbXkyZ1BaNElGczlVSUtQQWd0VGNaWGQzd0R0Nzl4RjRidEdvbGh6U014YkxkalBlR0RvYnRINGl0N2grUFhWVStodVhZWExyeC9Iblp0NXorN2dCOGUvaWx1Zk9NMkROdDlaOWMwSmh1N1JpcFd5QXpaSVVPS0pUSkZ0c2dZV1NOelpFOW14dFZMRmdGTU5BRjBRemE0SVZzOWtBSTMrcFdtNEN2MVg4ZVFwbS9oYXp1L2lhKzk4VTE4YlpkalBlR0RHNXR2eFIwNzdzUDYwZzA0Yy9UMytQVFRUKzNpRHpOK1B3OERHd2RqOEs2Lzc3cStaR1BuTnhVclpJYnNrQ0hGRXBsYXpTS1hBQ1pDTVVmMlpHWmlrMlFsUUpZa0dvOXFXTU4xWFI1SW5nZFNhQUI0dy9aYmNYUGpOM0JUMDNEY3RITTRibnJEc1VENzRNdHYzSTVyM3hpQzU4cGV4cUhHTi9HblAvM0pOdmgyLzNrZmhqUi9HOWMyM2RJOWJjbEcwM0RGQ3BsUkFCYXlIK2d4bUNKYmZCd0lXU056WkU4eTQ1c2ttd0R5bVN4SmtMVkp4Z3BYTHEwaGdHWEp1Rzc3RUh5NThUWjhxZkZXZktucFZueHBwMk9COW9GMzExZHhWKzBES0NrdndiblQ1L0Mzdi8zTkZnQS8rZXdUL011Ukp4Ry80NGJ1NjBvMkdtOVZySkFac2tPRzFMVmhycG9tVzJTTXJKRTVzcWQrNUNSQWxpWkNjaldBYnVOU1NoRUI5Q0cxYmhDdTJ6RUUxemJjZ21zYmIxRm5DczhXeHdMamc1U21RVWhwSElTcEphL2cyTzZqK09pamoyeUJqeCt5N2crYjRXNzRNcEliYis2K25tU2o0UmJGQ3BraE8xSmtzclRKYlFCSXhzZ2FtVE1Bakd1U25IaklzZ1JJTHUvM1REUWlJSy9sRlNVaHROd0xUKzFOU0swZmhKUWROeU9sNFdha05Eb1dPQjhNUXYrbWEvRDl5b2RSWDFXUDk4KzlqOC93bVMwQW52dmtQZHl4OXg4UXZUMFZxWTJFdkp1NmtvMGROeXRXeUF6WklVUHF1akFqSU5raVkyU056R1hHTVFMR05jbDhFOERYRW8yYmp2bG1BbGhzQUpoVWV5Tzg5VGZCVS84VmVCb2NDNlFQWWh2L0RxbjFnN0dnZURGT0h6eUZpeGN2MmdJZlB5VGoxRlQwcS9Pb0NHamJtT3Evb2xnaE13ckFZZ3VBdktHZGpCRkFNbmRaQURjbkdaZFJpcE1RVXVaQlhPM2ZJYkgrUzBpb3Z3RUpEWTRGeWdmeERkY2p0TUdEeDhwK2liMTFlM0RoL0FYYjRHdjZVN05LNnhIYmsrM1Z0UDRHeFFxWklUc01ZdXFTSEptNlBJQnhrR1h4a05kNHQzc2laSE1pSkQ5Si9iR3J6STMrTmRjZ3R1NWFETmgrTFFiVU94WVlIMXlIMEFZM3JxOGVpblVscitQZG8yZncxMC8vYWd1QUxEeCtmUENmSVRVeGlLMi96bDVOdDErcldDRXpaTWNBTU1sZ1NnR1lZTEEyUDA1SHdOZ215ZEVBeGtQV0pVQTJKVUMySlVLS0V1RXFTMEprVlNxaWF3Y2lxbTRnb3JZNzVtOGZSRzhmaUlqdEtaRHRDWGl5K0dtODFYalkxcmJMcXZmV0lhdzJFV0YxWG5CZnRvNm5icUJpaGN5UUhUS2tXQ0pUWk9zMVR2ZmlvWmpMak9VY01MWkpTQ1AvWjI0N0FKWW1JcnpTaDRpYVpFVFVKaU9pempGLyt5QzhMaGxTSDROYktyNko0cklTdkdkajIrWE14Yk1Zc3VzT1NIV1VndHoyc1pDUm1tVEZqS3ZVQ0dLWEFFakd5SnFLZ0FyQUFVMHlQeGF5TEE2U0d3ZFpGdy9aRkEvWmxnQXBTb0NyTkFHaGxXNzBxL0dnWDYxSFRWbzVjWFhNZno0STJaNkFmclVKR0ZjMENTZjJITGUxN2ZMc2liR1FxbjRJcVhQN1IwTXlVdU5SekpBZE1xUllJbE5raTR5Uk5US1hPWUFSa0FBT2dDeUxOUUdNZzJ5S2cyeUxoeFRGUTByajRhcE1oS3M2Q2E3YUpManFIUE9yRDJxVElOdkRNTExzUHRSWDdiQzE3ZEx3eHliRTF3OVUwUy9FWHpxU0ViSlNtYWpZVVF5UkpUSzF6Z3h5WkkzTWRSUkFxVWlBVkNWQWFoSWd0WTc1MVFkMTBZaXA4aUtuYUFIZU9mZ09QcmFwN1hMeGJ4ZVI5dWJEa0FxQjFDYjZUMGN5UWxiSVRLa1p4SzRJWU00WFIwQUh3RUNkZFBHUXVsQ01LbjRNZSt2MjRvUHpIOWhTOWZKRFZweDdEU0hWRWFyeTllc0oxRkVBeVZ4TEJGUUFEb0RreGtMV3hab3BPQTVTRkFjcGpZTlV4RU9xNGlFMThaQmF4L3pqZ3dSSVhUaVNLMi9FbXBKMU9IdnNYZHZhTG1jdXZvdkJiOXdPcVhTWmtjK1BHcElSc2tKbXlBNFoybVpPNjhnV0dWczJBUEo1QUdNZ3VRTWc2d2FZQU1aQ2ltSWhwYkdRaWpoSVZSeWtKZzVTNjVqOVBpQVFBeUMxWVhpaTZEYzQwdlNXclcyWDlPTXZHcW0zSnRiLytwRVJza0pteUE0WjJtWUdOYkpGeHBiRldBSHMzeVE1TVpDbEpvQnJCMEEyeGtMeVlpR0ZzWkNTV0VoNUhLUXlEbEp0UXNpZE9HYXZEMnBETUtqc05yUHQ4cDV0cTExVTRWSG5nMVNGR3huTTM3cVJFYkpDWnNnT0dTSkxaSXBzRVVDeVJ1WXkrN01LZGdEczhaT3BOaHFoMWYweHRtZ0NUdXc1WVZ2YjVlSm5GNUYyNENGSXVkaDdzbndSeEYwRHNMOFpBV01nYTJNZ0d3ZEE4Z1pBQ2dlWUVUQVdVaGtMcVk2Rk1JdzdacThQYWdValNyK0xIVGEzWFZhY3kwVUlJMTkxbEwzSCswWDZreEd5VW01bVR6SkVsc2dVMmNvMXMyMU9mMnNFZEFEc3NaT3FOaHd4VlVuSUxscUEzOXZZZGxHRng4NWJ6YmtmcDB3QkNoeWRCekM2U1hLaUlVdjdRM0w3UTliMmgyeU1nZVRGUUFwaklDVURJT1VESUpVRElOVURJRFdPMmVlREdFaXRZRlR4bzlpNzNkNjJTL3J4Rjh6VTJ6K3dtcEVSc2tKbXlBNFpJa3RraW15Uk1iSkc1aktqT1FlTWFwS2NLTWpTYUVodXRBbGdmMGhlZjBoaGYwaEpES1E4QmxJWkE2bU9NZnBJTmM0clY1SjB6MWoxaGlDNTRucXo3WExXdHJaTHd4OGJFVi9uaFZTRm12QjE5MWc3OGZka2hLeVFHYkpEaHNqU1JqTzRrVEd5UnViSW5tUkdtZ0JHUVhLalRBQ2pJWG5Sa01Kb1NFbC9TSGwvU0dWL1NEWFBKc2U2N3dNS3lubVpDMDhVamNhUm5mYTFYVlRoc2YvSGx1Z1hZTDNJQ0ZraE0yU0hESkdsaldad0kyTkxvMHdBSTAwQXM2TWdTNklncTZJZ2E4dzNiNDJHRkVSRGl2dER5dnBES3ZwRHFrd0l1UlBIdXVlREdzR2cwcUVvTGl2R2U2ZnRhN3VzT0p1TGtNb3dvKzNTRXhxUkViSkNac2dPR1NKTEJKQnNrVEd5UnVZWS9OUVBCOER1d2RSWm9XdkNFVm9WZ2JGRjQyMXR1NmpDbzJtb0VmMDZlMHgydmI5ckFFWkNsa1NhRVRBS3NqRUtzalVLVWhBRktZNkdsRVZES3FJaFZkR1Fhc2U2N1lNYXdZaVM3MkJIdGIyclhkS1BQUThwRTBoMVpNL3BSRWJJQ3BraE8yU0lMSkdwTldhV0pXdlprZFlJU0FBakhBQURjWExWaENLbU1oN1pSZk50YmJ1b3dxUFdEYWx3OVJ4ODlGK0hBSXhvQzJDRUNXQWtaRTBrWkdNa1pHdWtHUUdqSUdWUmtJb29TRldVMGRSa1k5T3hMdmlBa1lsdGwwZHNiYnVvd21QZmo4em8xOFBha0JHeVFtYUt6U3hLbHNnVTJWcGxCcnZzQ0RNQ3pncHZrcXh3eU9JSXlNb0l5T29JeUlZSXlKWUlTSDRrcENnU1Vob0pLWStFVkVaQ3FoenJtZzhJaGlDNTdGcXNLVm1Mczhmc2E3dXNPTHNTSVJYOUlKWDllbDRmTWtKV3lBelpJVU5raVV5UkxUSkcxc2djMlZNL0hBQURJRnc0cEVyd1JPR1R0clpkemx3OGc4R05RNHpvRnd6Qm9mTUFocGtSTUJ5eU1oeXlPaHl5SWR5TWdCR1FvZ2hJYVFTa1BBSlNHUUdwY3F4TFBxaG0yMldJN1cyWDlLUFBtZkN4OVJJRTJwQVJza0pteUU2K21VM0pGTmtpWTR2RHpRZ1l4Z2pZSG9CaERvQjJpbGtkZ3RES01Jd3RIR2RyMjBVVkhqVkp4dlZlTzQrM081OTFXUUREdmdqQU1NamlNTWhLdmlrTXNvRUFoa1B5d3lGRjRaRFNjRWg1T0tTU2FjU3h6dmtnVE0zOVJoVGZaZXRxRjZQdytDR2tWQ0JWWnVNNUdMUWhJMlNGekpBZE1rU1d5QlRaSW1Oa0xTc01LdmpKckg1Tmt0VVBzcmdmWkdVL3lPcCtKb0Joa1B3d1NGRVlwRFFNVWg0R1VSMTJEdGF4RHZ1Z1doQlRFV3UwWFE3WmQ1T1JVWGlFUWlwRGdrc1BNa0pXeUF6WklVTmJ6S0JHdHNnWVdTTnpaTThCMEo4blV6K2o3Vkwwa0sxdEY2UHd1TVV5OS9QbkdEcjUyWjBHY0dab2syU0ZRQmFIUUZhRVFsYUhRdGFIUWphSFFyYUZRZ3BESVNXaGtMSlFTQVhQT01jNjdJTXFRWEpwS3RZVTI5dDJTVC82ckpGNkdmMkNUUTh5UWxiSUROa2hRMlNKVEpFdE1rYld5QnpaVXo4K0IyQUlaSE1JWkZzSXBEQUVVaElDS1F1QlZIREFqbDNaQnp4SlhaQkt3Uk1GdjhhUm5VZHN1OG1vNGY4MUlMNDZ3YmplcStBTE1qM0lDRmtoTTJTSERKR2w5U0VkQVpCdk10L3NBTmk5azYxS01LaGtzTkYyZWNlZTFTN3E1dks5UDRDVVNQZU96WjlCNUFzQlpKWTFzMjFyQkhRMVNaWUxzdGdGV2VHQ3JIWkIxcnNnbTEyUWJTNUlvUXRTNG9LVXVZenJqT3JNNXRuZFVhT3plSUhjWnF2aTUzYjBHQUw5UGtGb1JhanRiWmNWWjFjZ3BKeVpLSWpIem12UlpJWE1rQjB5UkpiSUZOa2lZMlNOek0xME1RVkxrMlFKWkxGQVZnaGt0VURXQzJTelFMWUpwRkNNTTQ2ckxOVEFUYUFJVlFjc3Fpb2E4V1h4Q0M4S1IwUnhKQ0pMb2hCVkVxVmUrZCtkTmY1dFZBbFhYTEQ5MExGajZNaHgydnFlS3NHSW9wRzJ0bDFVNGRFdzJKejdCZW00eVFOMUlTdU0wbVNIREpFbE1rVzJ5QmhaSTNOa3o2OEFWZ2l1cmIwV1M1cVdZRW5lRXJ5OC9HVTh2L2g1MDE3QTg0czdieThzZWdIakZvekhmYS9mWjBUVllJT3dTaEJURm9Qc3doejgzc2EyUy9yUjlPQ0hMeGdCREMwTHhiTUhud1hPUXoxc1o5K09mV2l1YmNidUxoci90cW1vQ1d2V3JjWE5SWU9NS05pRnlHeHJ4Tk9ad0R5T1VZV2piRzI3R0lWSHZCRlo5TDZDOWJYVEVmQVZhWko1QWxra2tGY0Y4anVCdk40bUJSZWJZWlUzT0hNSG5iRXlRWFJsTlBJdjVLc0g3ZkQ1N24vOTlGTjFBdzRmT2R0WjQ3Y0QvZkdQZjhTUk45N0d0SzNURWNXRmovck02OHh4K2VPOWxZTGtraFJiVjd1b0t4NTcweURVd0IvSGJQZG5raEdtWUI2dk5RV1RLYkpGeHNnYW1TTjc2b2MvQWVRQVN3VERHb2ZoN0NkbmJYdmEwL2svbkVkelZUTitzdTNSNEFHd3d2NjJ5NHAzVnlDRWJZMnVuUHgydzlXUnp3dEtBSGxReFlJeGI0MnhEVUJHempQSHppQ3ZNQStEbUlwN09ncFdDZ1lWRDBKeGVUSGVzNm50b2dxUEhZT05DWDFIeEErRzl3UWxnSFJNbVNDeUloSjVmOGl6RGNJUFAvb1F4NXFQWVZwZXo2ZmkwSEw3Mnk2cThPZ3RxVmZESDdRQThnQjFLcjVvWHlwKy93L3Z0NlppN1lRZWVCMVJOTUxXdG9zcVBQaWNQYTUyNllIeGRIbWZYUUp3cmtBV0NtUzVRRjRUeURxQmJCSklua0FLQkZJa2hpTTR1ZVFPdW1ORmZrekZoWU1Nc2JwemZGMzQyNWpTR0dRWDJkZDJVWVhIbmpURDcxMDRubTdwMDkzOWtSR2VOR1NHN0pBaHNrU215QllaSTJ0a3JxVUlDU1NBcFlMSWNqK2xZbGJGcFdhVHVydU83TVRmanlxd3QrMmlDbzlTWGxQdDVzbmVpVEhZQm0zUUEwaW5GQXVHTlF6RFdYK2s0cnhIQXhjRkt3VEp4U20ycm5aUmhVZjlZS09OMFJNQWRYZWZ2UUpBSHFTL1VuRkJIZ1lGTUJYYnZkb2wvZTEwSTMzMXh1aEhlSHNGZ0R6UUVrRmtXU1R5L3NjUFZiRk94ZG9oM1QyckwvUDNiUC9ZMlhacCtLQUI4Wlh4UnR2bE12dTBMVlg2Ni9NN0RlQjBhWkk1QWxsZ1RoQnpCYkpXSUJzRnNsVWcrWllGQ1p4Y2NnZDJXYUZnNkk2aC9rbkZXeDgxaWlXN2pyWE41NFNXaG1Kc2dYMDNHYW5DWTNlYWNmV2d6YjVzODNjZ1BwZU02SVVJWkljTWtTVXlSYlpZaEpBMU1rZjIxSStlQXBBSFd5Z1ljOWdQRFdxbTRvSkJmb053UktHOWJSZFZlSEFScDkwbmVTQ2dzKzZqVndISUF5OFdSSmI2TVJWejZSYlRqZFZKM2Z6dm1CSjdWN3Vvd21QNzROYTVYemVQejg2eGR2cXplaDJBZEhZdlM4VjJ0MTFVNGNFTDk3MDkrbEhMWGdrZ0Q3cVhwR0xWZHJIeDJTNnE4T0MzQ3VrVlI3MDUrdlZhQUhuZ3JJcDdRU3EycysyaTd2SG9DNFdIOWFUcGxSRlFENENwdU42UFZiSGVUeGRmMlY5VWo5UzFhYlhMaWpNckVGTE1POGpzbmFOMmV0N1dSWCswdTU4dUF6aGZJTXNFc2tvZ2F3U3lRU0JiekRYOXZLYkhGRUZIY1FmK01uNStnWityWWpxN0M4Y2ZXbUsyWGZiYTgwMUdaejQrZzhFc1BPamJMaHhQMFA0Tk5TUXJIQmZ2QnlGRFpJbE1rUzB5UnRZKzE0WUpCZ0FwUkpFZ3NzU1BWYkY2NUhEblJSOVJNTUxXUitxbUgwazNSUEwzU1Ixb3VIczlnSFJZUVFCU2NTZUVpU20ydCsyaUNvOXlmcGx6NTArRW9JMTgycDk5QWtBT0lvaFM4YWg4KzFhN3RGeng2R3VwdDA4QnlNSDRPUlZIRjBVYmM2OHJwTURrUW50WHU2akNveWpFbUNkcDBmclNhNmNqNERScGt0bm14SENwUUZhYUUwWjljem9YRlBLYUh0T0ZMa1M0azBCWXZtRG9kajlVeGRYTmVKVFhpcTgwaG1MQkUvbjJQZHRGWGZHb0cyejQ4MHI3N3EzL1RrYklDcGtoTy9xbWRCWWhaSXVNc2Q0Z2MyUlAvUWhXQURtWWZNR1lRMzY0VnN5Ym1iWU5hbzJDN1FqT2E4bDJ0bDFVNFVGaEFuMGl0ek8ySzU1OFhmMmJQZ1VnblZBb2lDejJUMVU4ZmV0MFhKS0tMVTRQTFFyRjJQeHhPR0ZUMjZXbDhOQ1BPckhzeTI4dzlNUSsraHlBZEdJUHBPSVIrZmF0ZGxHRlIzTmEzMDY5R3ZZK0NTQUh0VTB3NXFCL1V2RmduWXE1bnhKQlRLRzliUmRWZVBCWmVad2JhYUg2Nm11WEFNd1VTSTVBbGxpZWtNVkhLZkJ1Smk0bzFFL0owb1VJZHhKb0t4QkVGa1VpN3ozN1YxQlAzMkttWWtKUkxCaTF6YjYyaTdyaVVUdlk4R0dnZmRZVCt5TWorcEVjWkljTWtTWDlaQ3d5UnRiSVhFc1IwaHNBcERPM0NZYldEY1haaisyOHIvZzhkdkVSSDV0L29xS1RKOStMTlVWcmJQc21vL1MzMGczNGV2TGtEU1NJZlJwQURzNGZxZmo0dTlpd2JRTyt2UEhMK09ubW4rSlE0MkZiSHFtckNvK3llT09TV3lBaDZNbDk5V2tBNlZoL3BPSVBQOFRoL1llUlc1eUx3cG9pbkR2VC9VZnFxc0pqVjlyVmszbzE5SDBlUUE1VXAyS2I3aXYrN0xQUDhPYy8veG5uM3oyUEMvOXpBUjlmL0xqYno2OVJoVWVCV1hob2NhNkcxMDRET0ZXYVpKWkFzaTFGQ0ovanhrY3A4RzRtTHFmUmoramc1Skk3Q0FiYmFtOVZUT0krQTU5ZTJQMnRwZkNnMzRMQlY0RThCakxDNjl3Y085a2hRMlNKVFBIeHZDeEN5QnFaSTN2cVIyOEVNRjhRV1dodlZkeDk5SXhQU0QrY2JnZ1FUQ2Rzb0NDOGFnQ2tRL1BNcXRpbVZHd0hnS3J3S0kwM21zNkJFajJZOW5OVkFjakIraUVWZHhWRVZYaThrV1pFdjJDQ0lwREhjbFVCU01jR1VTcGU4ZnNWQ01ubk53UmRoU1gxNnUwQUFBbEVTVVJCVkhNL0RYbW5BWndpVFRMVC9ONEdmbjhESHlLdEg4L0J0ZnhjVHNNSkpWZHhjSExKSFFTYmJSVU1yYlczUWQzWktLZ0tqNXJCeHBXallQTlBJSStIakZpWFlwRWgvVmdPc3RYNkhTRVFzcWQrOUhZQU9lZ3RnakZ2Mm5ldHVMTUFxc0tEVlYrd25xU0JndkNxQkpETzNkWnpWYkVxUEVyaWphWnpvSVFPMXYxMEMwRDlYU0c5TFFWck1iWUlodGJZdTRMNlNwRlEzVnkrTTgzb2Vlbmp1SnBmcndRZ0dUTytwc3RNd1pQTU9TQy9LMFEvSjFyZkc4eGwrZFlWTVhvZXlKMEVvL0g0TmdjMkZhOTRad1ZDK0pXa3dlNmJRT2xGUDNEMWxGNEpRNGIwUGNINitkQmtqZE0rc3FkKzhKZStBQ0NkbkNlSXpBOU1nMW9WSHRXRGplZ1hLSUdEZlQ5WFBZQVVLRUNwT1AxUXV0RWxjS0pmYTBaMEFEVGJBSDVPeGFyd0tJNDNXbFRCSHBVQ2VYd09nSzBYdy8yVmlpOHBQQUlwYm0vWWx3T2dwVURhTEJoYWJYK0RXaFVlVzBPTXlYWnZnQ0tReDlnbEFGOHh2N21HVmJCK1FoYlg4SE10djNWSkZxc2I3cUMzR0k5M2syRE1BZnNhMUtyd3FCcmNPdmZyTGI0STFISFM1OWFsV1BwK0VQMWtyTlp2U2JKVXdYMFZRRHA5cXlCeVd5VHl6dGx6TTVNcVBOaWE2bTBub3dOZ0QwWk9tMUp4dzRVR3hCZkZHejJ1UUFuYTIvYmpSTUIyUUxjaEZhdkNveW5OU2IxWE9pRWNBTnNCa0U1akttYUR1b3VwK0pMQzQwb2lYTTMvM2lVQVo1aVBUTFUrSlpWRmlMNHZoRXV5OUEzcXZkbTVtd1JEcXpwZkZhdkNvOUlwUERwVWZCSkFza0ptOVAwZ1pFa1hJZnJ4dkdST1hZcWJLUFV5M1FLZ2ZrUWJieUxoT2k2dTUrS2tXOStjeEIzMFZtTjF0bEV3Wm4vbnF1TDBnK21HTS9uM3ZYWHNnVHB1WFFHVEdiMFdrQ3haSDgxbVBCOGFRdlpra2xSY0FpRHZXdUtiK3lLQUZHR0xJREt2NDZsWUZSNkY4Y1lKR0NnUmUvTit2Z2hBc3FVaklJTWUyWk9Kc3ZGekFQTDJ1YjRLSU1YVnFmZ0tOek8xRkI1TUpiMFppa0FlKytVQTFMZGtXZ0VrZXpKUjVzazA4NG1WMWdjVThldlZtWUwxa2l5bVlEMFBET1NBL0xFdk9xa0RxVmdWSGx0QytzNjQvZUhMdHA5SlJzZ0tVekRaSVVOa1NRTkl4b3lub3pJRlo0bU1seWRscXZtMEl0NHd6QVdEWExmRlJhbGN4Nld2aG5CU3FlZUJGTEMzMjJaQjVOWkk1SjF0djBHdENvK0t3YTF6djk0KzNrQWRQeG5SQlFqWklVUDZhMXJKRmhuanc3RElITm1UOFhLdlRKVlAxSjNxWEttcUFXVFZZcjBjMTljQXBDQWJCVU1yMjYrS1ZlSEJTVFRQNkVDSjF4ZjIweFpBWFFFenFPblYwTVpURVQ1UjdNbDR1VUdteXFtV08rT3NxNkoxSzhaYUNmY2xRVGlXRFlMUiswZGZzdksrNFh3RDRndmlqVE81TDBBUnFERlkweStaWVJ2UENpRFowc3Z4eVJ6Wmt3VVNKcE9rV0hnOVdLK0t0aTVJNEllMG5RY0dha0NCMkkrWmlyZWUzYW9nVklWSFk1clJRZ2pFL3Z2U1Bxd0FraGtyZ0dTS0FKSXhza2JtTWlSYzFEWkp4Z3NiZzNQTnIxTnYyd3ZzeXdBU2dJMkNZWlhEOE1FbkgyRDltZlVJMld3V0huMEpqa0NNcFMyQUxFQ3NQY0FGSm1OR0UzcThBUjkvVHBaN1picjh0ZVg3UW5qek1Lc1dheVhNVmdUbmdkeEpJQVlUeUgxd1RKc0ZqKzE2REYrdi9ycFJ3UVZ5LzMxbFg2WWZlVUovcmdJbVUyekJzQUltYTJTdVpac3NDVEpWbWk5YmlEQ1V0cDBIOWtVUSsyS2hGUWk0eVFKTnQxL2FtLzlkV29BMEM1bTdaSnNrRTFWdVpob21xZXhhdDQyQy9HQXRFbmVtZDl4WFh2dmltQUtoRGYxR0l4dGtwTDMrSDVraVc4YjhiK0lsN0tsZkpzcHRNazB1cUJESlpxSDFPVEc2SDhnUDE2bllFYXZ2bllCZGhWWERSemJJaUxYL3A1OEgwOXFBdmlCazdYTmJob1RJVkZuVmtvWlpzYkJ5c1Y0WEp0bDlQUXAyVllTcjllOHVGLzEwOGFHclg3WmZqUDdmS2lGcjdXNVRaS1RNa0kvVXQxbTNUY09NZ25vdTZFUkJKL3JwRTY1dDlDTWpaTVY2K1kwc2NRVU0yU0pqbDkxSTVqUjV0ZDBvcUN0aWhsZEdRVjdyWTg3WGMwSjlRTTdyMVFHbkJvLzY2NlZYWkVOZisyWG1iQnY5eU5abG81K21jb29Na1JseVRoR3I1NEs4aktJdnpla0ZDb3lDT2hKYVFkUWgyWGsxSnVaOTBROWFiNzVxRG5UaFliM3l3VHFDREJuUjc1eVFyUTV0VXlWZFJVRjJyZGs4MUkxcFJrR2RpcmxEN3J4dEpPeUxEbmZHZE9uSnBBR2s5bVNBTEZoVHIxNThTbmJJa0RIM1MrOFFlK3BOR1JJajA2UzRwU0ptRDZkdFFhSlRzUVBocGVMMGRWamJ3cWVyWHV0VkQ3SkNabG9yWDE1MmkrazRnSHpuRkJrcU0rVzA2dDF3RXNsd3FsT3hYcXhxTFVxY1NOajNRV3dQUGpLZzRlTTBqWXpvcXg3cys1RWhzdFNsYlpvOEpKbnlGN1dDUWFkaS9ReHA1bnJ1dUMyRURvaDlEMFFyZURydE12SnArTWdDMS95UkRVN1h5QXJiTG1TSERIVnJteTdQcUZUTWhZVHNEWElIdkVMQ0hXb0lyZW5ZU2NsOUMwQXJmTlNXWmsyN0dqNHlRVGJJQ0ZuaE5kOVg1T2x1c2RmeXh6TmtiSWNnMUkxcURhRVREWHN2akZid3JGR1BHdXQyeXhmQlIyWnMzZHFEa0NHWGVaOXpRbGJIVE1rOHVQWkF0TUxJd1hHeXJnZnB2UGFzTDlwcVFhMjA2WWhuQlk5YVUzTnFyOU91TmZMWkRwOG1lYVpLeHgrMnpBbTVZSUdUVHBiZGJOSHdvSFJhNXZ5QUI2MWhaTmpXa1ZHLzZrRTZyNjJDOTVRdnRDWWFPT3FsOWJQTzlhZ3h0YWJtMUo0TTZEbmZiUGxReUloZnQ1bnlFNWt0eDFzZ1pNWERzcHR6QUo0UkdrUWRFWG53T2lwYVlkUkFjc0NPOWF3UHFJVTJEUjAxMCtEcGlFZHRxVEcxcHViVXZoVys0MEkyQXJLOUlyZEtwaFNxSmlON1BlejVjQUxLTTZJdGlJeUlWaGcxa0ZZbzlhQ2QxOWFvRTBoZlVBc05uQlU2YXFjam5nYVBHbE5yM2Vkam81a3NrSW1BYmxObGdHVEtzekpYM2xGVkQ4OEVuaEZ0UVdTMXJLT2locEZBYWlnNWI5VHRIQTdlc2NENFFQdWRyMW9QdmxxaG8zWnR3ZE5SajVVdXRTY0RaS0hIdGxseW04eVc1VEpYUGxTZGIwNUdOWWdNMDV5a01pcHl6c0FCV1lIazJhV05BM2NzY0Q3UWZ0ZXZEQkphSDJwRnphZ2ROV1JRb2FiVWxobVBXbE56YWg4MDIyeTVXK2JJS3Brbjc3ZEVSSVpwVGxJNUFBMmpGVWdPbEdkWVc5T09jRjVib2JEREYyMzl6TitwZ1JVNEszVFVqaG95dXpIaVVWdHFUSzJEZHN1VTRUSkh4c3NjYVpScytWaWRNUnlBam93OGs2eFFjazdSMXVnRXgrejNRVnMvODNjZDRhZ0p0ZEdSanBveDJsRkRha2xOcVcydjJXWkp2TXlSZTlXQno1TUNtU2NuSlV2K29nYkZhOHNjb0RiQ2FUV2VkWTdaN3dPcmovbmYydjk4cFNZRUxrcytWbHBSTXlPUTNDdlVzbGR2dkFGNXJ0d2djK1FlbVNPalpZNWt5eHpaSkhPbFV1YkpEc21TblpJbFRZNEYxQWM3bGUrcEFiVXdOS0UyOXlxdFdtNGE5eTk1L3grWUZUOXdkMGVoOFFBQUFBQkpSVTVFcmtKZ2dnPT1cIi8+XG48L2RlZnM+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfUkFXID0gYDxzdmcgZmlsbD1cIm5vbmVcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiB3aWR0aD1cIjE2MFwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbiAgPHBhdHRlcm4gaWQ9XCJhXCIgaGVpZ2h0PVwiMVwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiPlxuICAgIDxpbWFnZSBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHRyYW5zZm9ybT1cInNjYWxlKC4wMDYyNSlcIiB3aWR0aD1cIjE2MFwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFNOVVsRVFWUjRBZTNkUzQvYjFoVUg4RE5Bb29YYmpXVWdnRmNCc2tsV1FXYlZJa0JpTFFJajQ4a2dDSkJ2VWZmaDFndWpYZFFweHVPK1AwSzc2QmNvOGkyNlNHcDMwWGViQUVWckozWWN2OGIyekRpK3haL0RQMDNSUTVHVTdpWFBrYzRBeEIxUkZIbnZPVDllWGxJU0paTHdiMzlqNDV0ZnZmZmVoVENaUEpkd003N3FCQkZBenBBNzVEREI2dE92TXB3Ky9jcFhHeHRYSDU4NUV3N2VmdnR5K2kzNkZtSkdBRGxEN3BCRDVETG11cE92YXcvNE5qYy9PbmoxMVhCdzhtUjQvTVliNFdCejgxTHlEZnNHb2tRQXVjcHlkdkprUUE2UlMrUTB5c3BUcndRVlBRQys5Zld3UHhxRmZaR3dmK0pFT0poTUhHSHE0RWRZUC9BaFY4aFpscnZSS0NDWHlLbDZoR1Y4QjhRSGdDTGhZRHgyaEJHQXBGd0Y4U0ZYR1Q3bXpnTENXZmpZR0VlWWtzOWk2NjdEVitST004STIrSXFHZUUrNG1KUUVyMjdDVitST0kwTGkyeStQK2ZLdW14Vi9wblNFQ1JqTnQwcmkyNjhjZHAvSkdYT0tvWldXTVdFWjM5NW9GUFpFV2s5b3NKK1l6SWNtMXF2SytMcmtEcmtlSE9FaStJckdPc0pZbGpxdmgvajJ4dVBXblVhUk4zUTBReUtNZ28rOXBTUHNqR2ZSRnl5TWo3a2JBbUZVZkd5SUkxelVWT3ZYUjhQSDNQV0pNQW0rdkNFK0pteHRhTzRGaVEreG5qcWNFdE84WlI4SXEvZ2V6VnZabXRkbDYvT2VjRzVjVFM4a1BvejVrdVF1SlVMZzI4ZGJNZXZyNGRGb2xEVUFqVWd4SVVEN2swblk4L2VPbTB5MWZoNnh6R0thNDB1UnQyeWR1QktDeTNFeDM3YnJFMThSR0VmWUdsZlRnc1QzS0RVK2RrZ3hFUTZDancxeGhFMjJHcC92SFI5ekZ3TWg4ZUdDWStyRGJ0SHpzUUY1NllmalJtTzFDeEFmeDN4MU1VNDJQeDhUem5VNEpyNCt4bnlOQWZDZXNCWlozUlBFMTl0aHQ5SnhGRG1kcHljRXZyMzhoT1BoYUJRZWlndytJWkI3Zm1KUzUyMXFQdkFoVm9pWmh0ekJFRHF5ekZUVGgxcUo3OUg2ZXRDQ2owRjBoRlBPam55Z0RoODdMMXc1YVVLb0daOGpQTkxiMUV5MStOb2czTnZheWc2N0ducys0bVBwUGVHVXUreUJlbnhISWR6YU92eU9TWGp6emRmRG1UTlhucnoybXJyREx0RlZTMGY0RktFWmZDV0VzQVp6c0NjZkhqLyt3dzlQbkFpZlBQOThDUGxDRDdpdzVoSVhWbGY4eEFUNEVJT0hXazQ0Wm5paEtSaUROWmlEUGJrbzh2WHZpbHordFVqNFZHUUtJVjZrZVVMZ3N3U3M0TnQyRDB2NE5PZUlkY05SRFBoZ0ROWmdEdmJZbDYrZEY5bHhoQXlIN3RJNlBsZ1RrYlZxbEIxaE5TSUtIeThyUG9hNlFQaUpINDRaRXpXbFZYeXdoS05yWGM5WERmQVV3aWY1T0hCWCtYZ3dHMnRnTUk1QitSS09DZEVtdE8zQmVLeDZYSTQ4MEFyc2RNVkhqQm5DWDRtRWY0dUVNa0tzWFBPRUJDMGJ3akkremJGbjNZQVFabUFIaHRyMmZNVEgwaEV5RWdPV3E0cVBJVGVOMFBvbEd1QkRHOUNyczNmUlhNYnErWWlQWmUyWVVITXdzcm9aUGh5ejU5czFobS9lTVIreDFaVlRQZUZYK1Rqd3ZralFQaUdCMXNhRVpYemE0NHY2WVdlSGlVWEhmSFg0T0gvdCt5STdQREd4aHZDQmtiTmo0RU5kc2VOWXhBY2pSMTFrSnFKRlMwZTRhQVJudk43eHpRaE82U25UQ0xVZWpxMGZkbFAzZkNWLzJiOEZ3bi9seDMrTUF5d2NNdTdqUXE2eXd6RjdQdFROUWd3NTVrUHVNU1RyR3g4eFRpRjhuQU84SnhLMFQwUzRxK0FkRTlRQk93VHFwRDF1cUI5MkVPUjZhSHhUQ0g4cEV2NlpWd3dWTkJGSVhON0FZSDlBaE5nMjZtQU5IM0tObkEvVjh4RWZ5K0lTRGZZS2F6M2hVQWl0NG1QUE4rL2JhMFFUdXpTTk1MdnMwV05QYVAyd3F3MGZNV2NJTFI2TzcrVW5KbjBjam9rUDJ6UXhWTW1QYWp6c2FzVlhJTVM0Z0FnUDh2SGdYWkdnZmVvRFlSbWY5bmlnZnRoQmtFUGkwekxtSTdhNk1qczcvb1ZJK0VmZUFEVEVSTUFUOW9SVzhTR0h5S1VWZkVTWklmU2U4REFjVnZGWjYvbUlqNlVqRkpIZHpjMXRuT1RnRUcvaUtHRDBzRXQwMWRJMHdrVXYwUUFmMW1FTkh3NjdtcTd6VlZGMWZWd2dSTVB3Q3p6b0NlNFltTzR1Y0xHYStMQU9FMjNOYzJOMXpOZUVNa1BJRTVObFIyZ1YzOStObm5BMDRlUHpLNEhROFRIZE9zdWxSbWdWMzdJZWR1dDJBZE1JNzlkOGdBSDQ4SnlQK2VyU3JtdCtnUkRqRHZ4cUR3YnF0dzFNZC9DWlBaelpsdDQ3dnJleGtlSERjeWJha01kODJjZDhUZVF6aEQ4WENSWVIzanQxS3V5Ky8vNlBNZUYvaS9nUWUydnZjRFNoNnZxOGFZUzc3N3dUTURtK3Jtblh0YnhkaE1lT2hUdkhqcGs3N0hyUDkrd09VQ0Q4bTdFeG9hVXhIMkxyK0o3Rnh6bFRDUEZqSjBqdWx6NHRGQVBFRUxGMGZHUTJ1M1NFRVhjNHh6Y2JXOTJ6ampBQ1FzZFh4NnZkZkVlNEFFTEgxdzVaMDFJRndyL200eGdFMXNlRXMyTkFmSWlabjNBMEVXdCtmdTE3SWpzL0V3a0lLRzcxRDRDM2ZEb3lCb2dOWW9SWUlXYUlYY29iQlRXbmJ6bVdjSVF0ZGpqSGx4YTdJNXlCMFBHbHhjZTFPOElqRURvKzh1aW5kSVFsaEk2dkgzVFZyUlFJLzVML2RnbE9TcjVZc1FsdHhrM0JFUU0vNGFnU1NmOTRwUkU2dnZUQTJteGhKUkU2dmpZMCtsdG1wUkE2dnY1Z2RkblNTaUIwZkYxSTlMOXNnZkRQK2U5VzRLVGs1aEtjbUxBTnVDOHoydlpUZjRlamYxMHR0NWdoUklLcUNKRkVxeE4ySk1mWFVvQ0N4WllLb2VOVElHcU9La3doeEUzVGVUaTIxQXVpenFpN0gzYm5FS0RnSld2ZkV0bjVRQ1Q4TWYvT3NTVjhxQ3UrSjQyNm93MW9pMytxUllHcXJsVzRPQnI5NVBjaVQ1QlFTNzBnNjRxNm93MWQyKzNMSzRuQXRWT25QcmorNG90UFBoY0pONHhOcURQcWpqWW9DYWRYbzBzRWRyZTJ0bmZmZWl2Y2Z1RUZjL2k0czZEdWFNUHV1KzllNnRKMlgzYmdDTnplM056K2NqSUpOOGRqcy9pSUVHMUFXMjZYN2tVemNIaDk4N01pc0V6NEhPR3NUQ3Q4RHZodUwwblBSM3dzMFJPaWJkNFRLb1NIS3BWN1Bvc25IWVJXVjZKTmZqaFdqdS9HZUJ5UXFHV2UwRVlmRXlxQ3lKNXZGZkJ4eDNLRVNnQ3VJajVIcUFnZkJ1V3IxUE1SSDB1MDNVOU1CZ0RKbmcrRGNpWmpWVXMvTWVrWklQRGRta3pDNStOeCtFekVKNXgwamNjQk1mRkxOSWt4T3I3NkhjNFJPcjdCZTJOSG1BaWg5M3oxUFY5MUdPSUlJeU4wZk8zeEVhTWpqSVRROFhYSDV3Z2o0YnUxdWJuOVJYNjJleDBmenZTcGN3elFFeUtHdC95alhOMVVFdDluNDNIbm9EdlU2WjBWTVhTRUhmdzV2bWxBTVhZb1I5Z1NvT09MajQrQUhXRURRb3Y0K0ZWUEpsbDc2UWhyRUZyRGh6Tk5mSFh5MDN6Qy81aW5IU0RxNXdnckNDM2l3Mjl4WE0zdlRJcTdrK0ovekhPRWxlUnFmMWpHZDAwa2FKL1Fnd0RhbjBUQ2prZzRLM0lSRS83SFBEeUhaYlMzQS9WYitaN1FLajcwZHBkRXduY09iNWVSN2VQNEgvUFlFeHBFdUsyOXM0cGFQOHY0ME52bCtOWktRVm5EUER6bkNFdFIwZmp2RXVKam1CMGhJNkcxWEdKOERMa2paQ1MwbFN1QWp5RjNoSXlFbG5LRjhESGtqcENSR0xxMGlBOC9nVlU1MnkyZmNMUU5hWWFRWjhkWXA1OGR0dzFkcE9XSTc5cDRIUDRub243QzlUSGkyejY4enJmb25Vblh6b3JzWUYwQWpYVmpHeVppOGZSVE5EWXYwUURmemNra1hEZUc3NHBJaUlTUHUzR0JFT3UyaEJDNVF3NlJTemJHUkdrWkh3Nlo2TFVpMzVNNVE0aDFPOExFaEIxZmJZQWRZVzFvSWozaCtCb0Q2UWdiUXpUbkFvNnZkZUFjWWV0UXRWelE4YlVNMU5QRkhPSFRXQ3oybitPYk8zNk9jTzdRNVMrMGlBOC9lNG96MFVSbnUxMURPb1VRZGJOeW5YRHdTelEzOCt0OHVNajhYeEgxRXk3K0tzTkhyTThnUkYwdHhCUzV4M1ZDV0dCamVpbXh3UnVUU2JDRUQ5L2J3Ryt2UmI3SUhDdmVHVUxVRFhWRVhTMGhoSVhlRUZyRXg1NVBLVDRpTGhCaWlJQTZPMEtHSmk4ZFh5VWc4Ujg2d3JxWU9yNjZ5RVNmN3dpcklYVjgxWWdrZit3SUdXTEh4MGowWGpwQ3g5Yzd1dW9HVnhlaDQ2dGFHT3p4NmlGMGZJTmhxOXZ3NmlCMGZIVUdCcCsvL0FnZDMrREltaXF3dkFnZFgxUHUxVHkvWEFqRDZkTmYyOTNhdW9TZmVyTDAzcTZSdDlkU3FUV05FTlpnRHZiazQ1ZGV1dkR4eXkrSC94dy9udDNmVHZ1bk1NcWZhbEgrM200cWZGeXZTWVM0aHlLc3dSenN5WTlFWGo4bmN1VzNlRUlrNENmanRTSjBmTFJYbEtZUXdoYU13UnJNd1Y3V2tyTWlyM3hiNUtQZktFYm8rQXAwMVg5TUlDUStHSU0xbUp0cXlBOFVJM1I4VTZrNjZvRnFoRlY4c0haVUkwUWpRc2QzWktxT21xa1NZV3Q4YkpFbWhJNlBXV2xkcWtMWUdSK2JxUUdoNDJNMk9wY3FFTTZOajgwZEVxSGpZeGJtTGdkRnVEQStObnNJaEk2UDBWKzRIQVJoTkh4c2ZwOElIUitqSHEzc0ZXRjBmQXhESHdnZEg2TWR2ZXdGWVRKOERFZEtoSTZQVVU1V0prV1lIQi9Ea2dLaDQyTjBrNWRKRVBhR2orR0ppZER4TWFxOWxWRVI5bzZQWVlxQjBQRXhtcjJYVVJBT2hvL2hXZ1NoNDJNVUJ5c1hRamc0UG9adEhvU09qOUVidkp3TG9ScDhERjhYaEk2UFVWTlRka0tvRGgvRDJBYWg0Mk8wMUpXdEVLckZ4M0RPUXVqNEdDVzE1VXlFNnZFeHJIVUlWL3dMUkF5UDluSUtJVzZTaWE5bW1NSEg2RllSM3RWOVoxSlcyOHZEQ0JRSWNhZFc1QTdmNGVESDZKRmJFNEVpd3QrSmhEK0loTXRwZnY3S1JDd01WakpEaUp3aGQ4Z2h2c05oQmg4RGpncWZGN2w2NGZBYlVKY2ovL1lhTitObG1naXNuUk81ak53aGgrYndNU2JuUmI1eFR1VENSWkhuT005TEd4RkF6cEE3NURCbGpmOFBOaFdRRDhOeGx0Z0FBQUFBU1VWT1JLNUNZSUk9XCIvPlxuICA8L3BhdHRlcm4+XG4gIDxwYXRoIGQ9XCJtMCAwaDE2MHYxNjBoLTE2MHpcIiBmaWxsPVwidXJsKCNhKVwiLz5cbjwvc3ZnPmA7XG5cbi8vIERhdGEgVVJMc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRE9XTkxPQURfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIFNVQ0NFU1NfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBFUlJPUl9JQ09OX1NWR19SQVcsXG4pfWA7XG5cbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBzdHJva2U9XCIjZmZmZmZmXCI+PGcgaWQ9XCJTVkdSZXBvX2JnQ2FycmllclwiIHN0cm9rZS13aWR0aD1cIjBcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX3RyYWNlckNhcnJpZXJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX2ljb25DYXJyaWVyXCI+PHBhdGggZD1cIk0xMC45NjggMTguNzY5QzE1LjQ5NSAxOC4xMDcgMTkgMTQuNDM0IDE5IDkuOTM4YTguNDkgOC40OSAwIDAgMC0uMjE2LTEuOTEyQzIwLjcxOCA5LjE3OCAyMiAxMS4xODggMjIgMTMuNDc1YTYuMSA2LjEgMCAwIDEtMS4xMTMgMy41MDZjLjA2Ljk0OS4zOTYgMS43ODEgMS4wMSAyLjQ5N2EuNDMuNDMgMCAwIDEtLjM2LjcxYy0xLjM2Ny0uMTExLTIuNDg1LS40MjYtMy4zNTQtLjk0NUE3LjQzNCA3LjQzNCAwIDAgMSAxNSAxOS45NWE3LjM2IDcuMzYgMCAwIDEtNC4wMzItMS4xODF6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PHBhdGggZD1cIk03LjYyNSAxNi42NTdjLjYuMTQyIDEuMjI4LjIxOCAxLjg3NS4yMTggNC4xNDIgMCA3LjUtMy4xMDYgNy41LTYuOTM4QzE3IDYuMTA3IDEzLjY0MiAzIDkuNSAzIDUuMzU4IDMgMiA2LjEwNiAyIDkuOTM4YzAgMS45NDYuODY2IDMuNzA1IDIuMjYyIDQuOTY1YTQuNDA2IDQuNDA2IDAgMCAxLTEuMDQ1IDIuMjkuNDYuNDYgMCAwIDAgLjM4Ni43NmMxLjctLjEzOCAzLjA0MS0uNTcgNC4wMjItMS4yOTZ6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PC9nPjwvc3ZnPmA7XG5cbi8vIDIuIEVkaXRlZDogQSBtaW5pbWFsIHBlbmNpbFxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9TVkdfUkFXID0gYDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPiA8cGF0aCBkPVwiTTEyIDMuOTk5OTdINkM0Ljg5NTQzIDMuOTk5OTcgNCA0Ljg5NTQgNCA1Ljk5OTk3VjE4QzQgMTkuMTA0NSA0Ljg5NTQzIDIwIDYgMjBIMThDMTkuMTA0NiAyMCAyMCAxOS4xMDQ1IDIwIDE4VjEyTTE4LjQxNDIgOC40MTQxN0wxOS41IDcuMzI4NDJDMjAuMjgxIDYuNTQ3MzcgMjAuMjgxIDUuMjgxMDQgMTkuNSA0LjVDMTguNzE4OSAzLjcxODk1IDE3LjQ1MjYgMy43MTg5NSAxNi42NzE1IDQuNTAwMDFMMTUuNTg1OCA1LjU4NTc1TTE4LjQxNDIgOC40MTQxN0wxMi4zNzc5IDE0LjQ1MDVDMTIuMDk4NyAxNC43Mjk3IDExLjc0MzEgMTQuOTIwMSAxMS4zNTYgMTQuOTk3NUw4LjQxNDIyIDE1LjU4NThMOS4wMDI1NyAxMi42NDQxQzkuMDgwMDEgMTIuMjU2OSA5LjI3MDMyIDExLjkwMTMgOS41NDk1MSAxMS42MjIxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTUuNTg1OCA1LjU4NTc1XCIgc3Ryb2tlPVwiI2ZmZmZmZlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L3BhdGg+IDwvZz48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRURJVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRURJVF9JQ09OX1NWR19SQVdcbil9YDtcbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBDT01NRU5UX0lDT05fU1ZHX1JBV1xuKX1gOyIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50c1xuXG5pbXBvcnQgeyBET1dOTE9BRF9JQ09OX1NWR19VUkwgfSBmcm9tICcuL2ljb25zJztcblxuY29uc3QgU1RZTEVfSUQgPSAnY3FkLXN0eWxlJztcbmNvbnN0IFNQSU5ORVJfU0laRV9QWCA9IDE2O1xuXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG5cbiAgICAgIC8qIFNwaW5uZXIgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICNmZmZmZmY7XG5cbiAgICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICAgKiBDT0xPUiBQQUxFVFRFIChMaWdodClcbiAgICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgICAtLWNxZC1jb2xvci1ub3JtYWw6ICMwMDVERDc7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsOiAwIDhweCAyMnB4IHJnYmEoMCwgOTMsIDIxNSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCA5MywgMjE1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3Itc3VjY2VzczogIzAwQTgyRDtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzOiAwIDEycHggMjhweCByZ2JhKDAsIDE2OCwgNDUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDAsIDE2OCwgNDUsIDAuNzApO1xuXG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI0ZGNDAzNjtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRUM2MzAwO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNzApO1xuXG4gICAgICAtLWNxZC1jb2xvci1jb21tZW50OiAjOUIwMEZGO1xuICAgICAgLS1jcWQtY29sb3ItZWRpdGVkOiAjMDA3RjhEO1xuXG4gICAgICAtLWNxZC1zaGFkb3ctYmFzZTogMCAwcHggMTBweCByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc2hhZG93LWhvdmVyOiAwIDEwcHggMjRweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogREFSSyBNT0RFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLXRoZW1lLWRhcmsge1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA2RUZGO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDExMCwgMjU1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDAsIDExMCwgMjU1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3Itc3VjY2VzczogIzA3REEzRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzOiAwIDEycHggMjhweCByZ2JhKDcsIDIxOCwgNjMsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDcsIDIxOCwgNjMsIDAuNzApO1xuXG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI0ZGNDAzNjtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRkY5MTQyO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDE0NSwgNjYsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwRDZFRTtcblxuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7XG4gICAgICAtLWNxZC1zcGlubmVyLXRvcDogIzBmMTcyYTtcbiAgICB9XG5cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0ge1xuICAgICAgb3ZlcmZsb3c6IHZpc2libGUgIWltcG9ydGFudDtcbiAgICAgIGNvbnRhaW46IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIHotaW5kZXg6IDE7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDEuIERPV05MT0FEIEJVVFRPTiAoU2luZ2xlKVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0biB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDUwJTtcbiAgICAgIHJpZ2h0OiA4cHg7XG4gICAgICB6LWluZGV4OiA1O1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBoZWlnaHQ6IDQwcHg7XG4gICAgICB3aWR0aDogNDBweDtcbiAgICAgIG1heC13aWR0aDogY2FsYygxMDAlIC0gMTZweCk7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLW5vcm1hbCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctYmFzZSk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdpbGwtY2hhbmdlOiB0cmFuc2Zvcm0sIGJveC1zaGFkb3csIHdpZHRoLCBib3JkZXItcmFkaXVzLCBwYWRkaW5nLWlubGluZTtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgcGFkZGluZy1pbmxpbmUgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3JkZXItcmFkaXVzIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHRyYW5zZm9ybSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJhY2tncm91bmQtY29sb3IgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOm5vdCguY3FkLWxvYWRpbmcpOm5vdCguY3FkLXRyeWluZyk6bm90KC5jcWQtc3VjY2Vzcyk6bm90KC5jcWQtZXJyb3IpOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAxMjBweDtcbiAgICAgIHBhZGRpbmctaW5saW5lOiAxMnB4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOmZvY3VzLXZpc2libGUge1xuICAgICAgb3V0bGluZTogMnB4IHNvbGlkICNmZmZmZmY7XG4gICAgICBvdXRsaW5lLW9mZnNldDogMnB4O1xuICAgICAgdHJhbnNmb3JtOiBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDAuOTcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIHtcbiAgICAgIHdpZHRoOiAxNDBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3M6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA4cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAuY3FkLXNwaW5uZXIge1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIHdpZHRoOiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGhlaWdodDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBib3JkZXI6IDNweCBzb2xpZCB2YXIoLS1jcWQtc3Bpbm5lci1ib3JkZXIpO1xuICAgICAgYm9yZGVyLXRvcC1jb2xvcjogdmFyKC0tY3FkLXNwaW5uZXItdG9wKTtcbiAgICAgIGFuaW1hdGlvbjogY3FkLXNwaW4gMC42NXMgbGluZWFyIGluZmluaXRlO1xuICAgIH1cblxuICAgIEBrZXlmcmFtZXMgY3FkLXNwaW4ge1xuICAgICAgZnJvbSB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9XG4gICAgICB0byB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH1cbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVFMgJiBFRElURUQgKE92ZXJsYXkpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWNvbW1lbnQpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDApIGludmVydCgxKTtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01cHgpO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIuY3FkLWVkaXRlZCB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMCwgMjE0LCAyMzgsIDAuMyk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZWRpdGVkKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIGRpdltkYXRhLXN0cmVhbS1pdGVtLWlkXVtkYXRhLWNxZC1wcm9jZXNzZWRdW2RhdGEtY3FkLWVkaXRlZC1wcm9jZXNzZWRdID4gLmNxZC1vdmVybGF5LWNvbnRhaW5lciB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiA3MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogI0ZGNDAzNjtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgcGFkZGluZy10b3A6IDhweDtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1zZWN0aW9uIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1pY29uIHtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbi1lZGl0ZWQgc3ZnIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgc3Ryb2tlOiBjdXJyZW50Q29sb3I7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OIChIZWFkZXItYWxpZ25lZClcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIHtcbiAgLyogUHJvZ3Jlc3MgY29udHJvbCAoMCUgdG8gMTAwJSkgKi9cbiAgLS1jcWQtcHJvZ3Jlc3M6IDAlO1xuICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gIC8qIERlZmF1bHQgZmFsbGJhY2sgcG9zIGlmIGhlYWRlciBpbmplY3Rpb24gZmFpbHM6ICovXG4gIHRvcDogMTJweDtcbiAgcmlnaHQ6IDQ4cHg7XG4gIGhlaWdodDogNDBweDtcbiAgei1pbmRleDogNjtcbiAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICBwYWRkaW5nOiA0cHggMTJweDtcbiAgYm9yZGVyOiBub25lO1xuICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICBjb2xvcjogI2ZmZmZmZjtcbiAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBmb250LXdlaWdodDogNjAwO1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIGdhcDogNnB4O1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICB0cmFuc2l0aW9uOlxuICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlLFxuICAgIHRyYW5zZm9ybSAwLjFzIGVhc2UsXG4gICAgYmFja2dyb3VuZC1jb2xvciAwLjNzIGVhc2U7XG4gIHRyYW5zZm9ybTogdHJhbnNsYXRlWigwKTtcbn1cblxuLyogKiBJZiBzdWNjZXNzZnVsbHkgaW5qZWN0ZWQgaW50byB0aGUgSGVhZGVyIHJvdyAodGhlIHByZWZlcnJlZCBsb2NhdGlvbiksXG4gKiBjZW50ZXIgaXQgdmVydGljYWxseSByZWxhdGl2ZSB0byB0aGUgYXV0aG9yIHRleHQvbWVudSBidXR0b24uXG4gKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtaW4taGVhZGVyIHtcbiAgdG9wOiA1MCU7XG4gIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSB0cmFuc2xhdGVaKDApO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWluLWhlYWRlcjphY3RpdmUge1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMC45Nyk7XG59XG5cbmJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0biB7XG4gIHJpZ2h0OiBhdXRvO1xuICBsZWZ0OiA0OHB4O1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWhvdmVyKTtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuOmFjdGl2ZSB7XG4gIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG59XG5cbi8qIEtlZXAgcG9pbnRlciBjdXJzb3IgZXZlbiB3aGlsZSBkaXNhYmxlZCAqL1xuLmNxZC1kb3dubG9hZC1hbGwtYnRuW2Rpc2FibGVkXSB7XG4gIGN1cnNvcjogcG9pbnRlcjtcbn1cblxuLyogRlVMTCBTVUNDRVNTIFNUQVRFIChTb2xpZCBHcmVlbikgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLXN1Y2Nlc3Mge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLWVycm9yIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvcik7XG59XG5cbi8qIFBST0dSRVNTIEJBUiBPVkVSTEFZIChGaWxscyB1cCkgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bjo6YWZ0ZXIge1xuICBjb250ZW50OiAnJztcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICB0b3A6IDA7XG4gIGxlZnQ6IDA7XG4gIGJvdHRvbTogMDtcbiAgei1pbmRleDogMDtcblxuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG5cbiAgLyogV2lkdGggY29udHJvbGxlZCBieSBKUyAqL1xuICB3aWR0aDogdmFyKC0tY3FkLXByb2dyZXNzKTtcbiAgdHJhbnNpdGlvbjogd2lkdGggMC4zcyBjdWJpYy1iZXppZXIoMC4yMiwgMC42MSwgMC4zNiwgMSk7XG5cbiAgb3BhY2l0eTogMTtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtc3VjY2Vzczo6YWZ0ZXIge1xuICBvcGFjaXR5OiAwO1xufVxuXG4vKiBDb250ZW50IGxheWVycyAqL1xuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4sXG4uY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtc3ViLFxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgei1pbmRleDogMjtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uIHtcbiAgd2lkdGg6IDE4cHg7XG4gIGhlaWdodDogMThweDtcbiAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gIGJhY2tncm91bmQtc2l6ZTogMThweCAxOHB4O1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICBmb250LXdlaWdodDogNjAwO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtc3ViIHtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBvcGFjaXR5OiAwLjk7XG4gIG1hcmdpbi1sZWZ0OiA0cHg7XG59XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59IiwiY29uc3QgVFJBTlNMQVRJT05TOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICBlbjoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnRG93bmxvYWRpbmfigKYnLFxuICAgIHRyeWluZzogJ1RyeWluZ+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rvd25sb2FkZWQnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0Rvd25sb2FkIGZhaWxlZC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnUXVpY2sgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudHMnLFxuICAgIGVkaXRlZDogJ0VkaXRlZCcsXG4gICAgZG93bmxvYWRBbGw6ICdEb3dubG9hZCBhbGwnLFxuICB9LFxuICBhcjoge1xuICAgIGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsXG4gICAgZG93bmxvYWRpbmc6ICfYrNin2LHZiiDYp9mE2KrZhtiy2YrZhOKApicsXG4gICAgdHJ5aW5nOiAn2YXYrdin2YjZhNip4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsXG4gICAgZXJyb3I6ICfYrti32KMnLFxuICAgIGZhaWxlZDogJ9mB2LTZhCDYp9mE2KrZhtiy2YrZhC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLFxuICAgIHRpdGxlUXVpY2s6ICfYqtmG2LLZitmEINiz2LHZiti5JyxcbiAgICBjb21tZW50czogJ9iq2LnZhNmK2YLYp9iqJyxcbiAgICBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyxcbiAgICBkb3dubG9hZEFsbDogJ9iq2YbYstmK2YQg2KfZhNmD2YQnLFxuICB9LFxuICBqYToge1xuICAgIGRvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJyxcbiAgICBkb3dubG9hZGluZzogJ0RM5Lit4oCmJyxcbiAgICB0cnlpbmc6ICfoqabooYzkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflrozkuoYnLFxuICAgIGVycm9yOiAn44Ko44Op44O8JyxcbiAgICBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLFxuICAgIGFyaWFEb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsXG4gICAgdGl0bGVRdWljazogJ+OCr+OCpOODg+OCr+ODgOOCpuODs+ODreODvOODiScsXG4gICAgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLFxuICAgIGVkaXRlZDogJ+e3qOmbhua4iOOBvycsXG4gIH0sXG4gIGVzOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLFxuICAgIHRyeWluZzogJ0ludGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgaGk6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKHgpL/gpILgpJfigKYnLFxuICAgIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JyxcbiAgICBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsXG4gICAgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgcHQ6IHtcbiAgICBkb3dubG9hZDogJ0JhaXhhcicsXG4gICAgZG93bmxvYWRpbmc6ICdCYWl4YW5kb+KApicsXG4gICAgdHJ5aW5nOiAnVGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCYWl4YWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0JhaXhhcicsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIHLDoXBpZG8nLFxuICAgIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgJ3B0LXB0Jzoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FycmVnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnQSBkZXNjYXJyZWdhcuKApicsXG4gICAgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgJ3poLWNuJzoge1xuICAgIGRvd25sb2FkOiAn5LiL6L29JyxcbiAgICBkb3dubG9hZGluZzogJ+S4i+i9veS4reKApicsXG4gICAgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5bey5LiL6L29JyxcbiAgICBlcnJvcjogJ+mUmeivrycsXG4gICAgZmFpbGVkOiAn5LiL6L295aSx6LSlJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfkuIvovb0nLFxuICAgIHRpdGxlUXVpY2s6ICflv6vpgJ/kuIvovb0nLFxuICAgIGNvbW1lbnRzOiAn5p2h6K+E6K66JyxcbiAgICBlZGl0ZWQ6ICflt7LnvJbovpEnLFxuICB9LFxuICAnemgtdHcnOiB7XG4gICAgZG93bmxvYWQ6ICfkuIvovIknLFxuICAgIGRvd25sb2FkaW5nOiAn5LiL6LyJ5Lit4oCmJyxcbiAgICB0cnlpbmc6ICflmJfoqabkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflt7LkuIvovIknLFxuICAgIGVycm9yOiAn6Yyv6KqkJyxcbiAgICBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+S4i+i8iScsXG4gICAgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i8iScsXG4gICAgY29tbWVudHM6ICfliYfnlZnoqIAnLFxuICAgIGVkaXRlZDogJ+W3sue3qOi8rycsXG4gIH0sXG4gIGZyOiB7XG4gICAgZG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJyxcbiAgICBkb3dubG9hZGluZzogJ1TDqWzDqWNoYXJnZW1lbnTigKYnLFxuICAgIHRyeWluZzogJ0Vzc2Fp4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVMOpbMOpY2hhcmfDqScsXG4gICAgZXJyb3I6ICdFcnJldXInLFxuICAgIGZhaWxlZDogJ8OJY2hlYy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLFxuICAgIHRpdGxlUXVpY2s6ICdUw6lsw6ljaGFyZ2VtZW50IHJhcGlkZScsXG4gICAgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLFxuICAgIGVkaXRlZDogJ01vZGlmacOpJyxcbiAgfSxcbiAgZGU6IHtcbiAgICBkb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkZW7igKYnLFxuICAgIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0ZlcnRpZycsXG4gICAgZXJyb3I6ICdGZWhsZXInLFxuICAgIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsXG4gICAgYXJpYURvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsXG4gICAgdGl0bGVRdWljazogJ1NjaG5lbGxlciBEb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdLb21tZW50YXJlJyxcbiAgICBlZGl0ZWQ6ICdCZWFyYmVpdGV0JyxcbiAgfSxcbiAgaXQ6IHtcbiAgICBkb3dubG9hZDogJ1NjYXJpY2EnLFxuICAgIGRvd25sb2FkaW5nOiAnU2NhcmljYW1lbnRv4oCmJyxcbiAgICB0cnlpbmc6ICdQcm92YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ1NjYXJpY2F0bycsXG4gICAgZXJyb3I6ICdFcnJvcmUnLFxuICAgIGZhaWxlZDogJ0ZhbGxpdG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTY2FyaWNhJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcmFwaWRvJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRpJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmljYXRvJyxcbiAgfSxcbiAgcnU6IHtcbiAgICBkb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJyxcbiAgICBkb3dubG9hZGluZzogJ9Ch0LrQsNGH0LjQstCw0L3QuNC14oCmJyxcbiAgICB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9Ch0LrQsNGH0LDQvdC+JyxcbiAgICBlcnJvcjogJ9Ce0YjQuNCx0LrQsCcsXG4gICAgZmFpbGVkOiAn0KHQsdC+0LkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YvRgdGC0YDQvtC1INGB0LrQsNGH0LjQstCw0L3QuNC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXQvdC10L3QvicsXG4gIH0sXG4gIGtvOiB7XG4gICAgZG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLFxuICAgIGRvd25sb2FkaW5nOiAn64uk7Jq066Gc65OcIOykkeKApicsXG4gICAgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsXG4gICAgZG93bmxvYWRlZDogJ+yZhOujjCcsXG4gICAgZXJyb3I6ICfsmKTrpZgnLFxuICAgIGZhaWxlZDogJ+yLpO2MqO2VqCcsXG4gICAgYXJpYURvd25sb2FkOiAn64uk7Jq066Gc65OcJyxcbiAgICB0aXRsZVF1aWNrOiAn67mg66W4IOuLpOyatOuhnOuTnCcsXG4gICAgY29tbWVudHM6ICfqsJwg64yT6riAJyxcbiAgICBlZGl0ZWQ6ICfsiJjsoJXrkKgnLFxuICB9LFxuICB0cjoge1xuICAgIGRvd25sb2FkOiAnxLBuZGlyJyxcbiAgICBkb3dubG9hZGluZzogJ8SwbmRpcmlsaXlvcuKApicsXG4gICAgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnxLBuZGlyaWxkaScsXG4gICAgZXJyb3I6ICdIYXRhJyxcbiAgICBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfEsG5kaXInLFxuICAgIHRpdGxlUXVpY2s6ICdIxLF6bMSxIGluZGlyJyxcbiAgICBjb21tZW50czogJ3lvcnVtJyxcbiAgICBlZGl0ZWQ6ICdEw7x6ZW5sZW5kaScsXG4gIH0sXG4gIHZpOiB7XG4gICAgZG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJyxcbiAgICBkb3dubG9hZGluZzogJ8SQYW5nIHThuqNp4oCmJyxcbiAgICB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsXG4gICAgZG93bmxvYWRlZDogJ8SQw6MgdOG6o2knLFxuICAgIGVycm9yOiAnTOG7l2knLFxuICAgIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLFxuICAgIHRpdGxlUXVpY2s6ICdU4bqjaSB4deG7kW5nIG5oYW5oJyxcbiAgICBjb21tZW50czogJ25o4bqtbiB4w6l0JyxcbiAgICBlZGl0ZWQ6ICfEkMOjIGNo4buJbmggc+G7rWEnLFxuICB9LFxuICBpZDoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTWVuZ3VuZHVo4oCmJyxcbiAgICB0cnlpbmc6ICdNZW5jb2Jh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2VsZXNhaScsXG4gICAgZXJyb3I6ICdLZXNhbGFoYW4nLFxuICAgIGZhaWxlZDogJ0dhZ2FsLicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCBjZXBhdCcsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcicsXG4gICAgZWRpdGVkOiAnRGllZGl0JyxcbiAgfSxcbiAgdGg6IHtcbiAgICBkb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsXG4gICAgZG93bmxvYWRpbmc6ICfguIHguLPguKXguLHguIfguYLguKvguKXguJTigKYnLFxuICAgIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsXG4gICAgZG93bmxvYWRlZDogJ+C5gOC4quC4o+C5h+C4iOC4quC4tOC5ieC4mScsXG4gICAgZXJyb3I6ICfguILguYnguK3guJzguLTguJTguJ7guKXguLLguJQnLFxuICAgIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsXG4gICAgYXJpYURvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJyxcbiAgICB0aXRsZVF1aWNrOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiU4LiU4LmI4Lin4LiZJyxcbiAgICBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsXG4gICAgZWRpdGVkOiAn4LmB4LiB4LmJ4LmE4LiC4LmB4Lil4LmJ4LinJyxcbiAgfSxcbiAgcGw6IHtcbiAgICBkb3dubG9hZDogJ1BvYmllcnonLFxuICAgIGRvd25sb2FkaW5nOiAnUG9iaWVyYW5pZeKApicsXG4gICAgdHJ5aW5nOiAnUHLDs2Jh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUG9icmFubycsXG4gICAgZXJyb3I6ICdCxYLEhWQnLFxuICAgIGZhaWxlZDogJ05pZXVkYW5lLicsXG4gICAgYXJpYURvd25sb2FkOiAnUG9iaWVyeicsXG4gICAgdGl0bGVRdWljazogJ1N6eWJraWUgcG9iaWVyYW5pZScsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcnplJyxcbiAgICBlZGl0ZWQ6ICdFZHl0b3dhbm8nLFxuICB9LFxuICBubDoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWRlbicsXG4gICAgZG93bmxvYWRpbmc6ICdEb3dubG9hZGVu4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9iZXJlbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYWFyJyxcbiAgICBlcnJvcjogJ0ZvdXQnLFxuICAgIGZhaWxlZDogJ01pc2x1a3QuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZGVuJyxcbiAgICB0aXRsZVF1aWNrOiAnU25lbCBkb3dubG9hZGVuJyxcbiAgICBjb21tZW50czogJ3JlYWN0aWVzJyxcbiAgICBlZGl0ZWQ6ICdCZXdlcmt0JyxcbiAgfSxcbiAgYm46IHtcbiAgICBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgprLgp4vgpqEg4Ka54Kaa4KeN4Kab4KeH4oCmJyxcbiAgICB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ka44Kau4KeN4Kaq4Kao4KeN4KaoJyxcbiAgICBlcnJvcjogJ+CmpOCnjeCmsOCngeCmn+CmvycsXG4gICAgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsXG4gICAgYXJpYURvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kam4KeN4Kaw4KeB4KakIOCmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJyxcbiAgICBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnLFxuICB9LFxuICBwYToge1xuICAgIGRvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICBkb3dubG9hZGluZzogJ+CooeCovuCoieCoqOCosuCpi+CooSDgqLngqYsg4Kiw4Ki/4Ki54Ki+4oCmJyxcbiAgICB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Kiu4KmB4KiV4Kmw4Kiu4KiyJyxcbiAgICBlcnJvcjogJ+Col+CosuCopOCpgCcsXG4gICAgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgqKTgqYfgqJzgqLwg4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsXG4gICAgZWRpdGVkOiAn4Ki44Kmw4Kiq4Ki+4Kim4Ki/4KikJyxcbiAgfSxcbiAgdGU6IHtcbiAgICBkb3dubG9hZDogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgZG93bmxvYWRpbmc6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0g4LCF4LC14LGB4LCk4LGL4LCC4LCm4LC/4oCmJyxcbiAgICB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgsKrgsYLgsLDgsY3gsKTgsK/gsL/gsILgsKbgsL8nLFxuICAgIGVycm9yOiAn4LCy4LGL4LCq4LCCJyxcbiAgICBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgdGl0bGVRdWljazogJ+CwpOCxjeCwteCwsOCwv+CwpCDgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJyxcbiAgICBlZGl0ZWQ6ICfgsLjgsLXgsLDgsL/gsILgsJrgsKzgsKHgsL/gsILgsKbgsL8nLFxuICB9LFxuICBtcjoge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoSDgpLngpYvgpKQg4KSG4KS54KWH4oCmJyxcbiAgICB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpYAnLFxuICAgIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSk4KWN4KS14KSw4KS/4KSkIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLFxuICAgIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIHRhOiB7XG4gICAgZG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLFxuICAgIGRvd25sb2FkaW5nOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K6q4K+N4K6q4K6f4K+B4K6V4K6/4K6x4K6k4K+B4oCmJyxcbiAgICB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgrq7gr4Hgrp/grr/grqjgr43grqTgrqTgr4EnLFxuICAgIGVycm9yOiAn4K6q4K6/4K604K+IJyxcbiAgICBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsXG4gICAgdGl0bGVRdWljazogJ+CuteCuv+CusOCviOCuteCvgSDgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrq7gr40nLFxuICAgIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJyxcbiAgICBlZGl0ZWQ6ICfgrqTgrr/grrDgr4HgrqTgr43grqTgrqrgr43grqrgrp/gr43grp/grqTgr4EnLFxuICB9LFxuICB1cjoge1xuICAgIGRvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJyxcbiAgICBkb3dubG9hZGluZzogJ9qI2KfYpNmGINmE2YjaiCDbgdmIINix24HYpyDbgduS4oCmJyxcbiAgICB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsXG4gICAgZG93bmxvYWRlZDogJ9mF2qnZhdmEJyxcbiAgICBlcnJvcjogJ9i62YTYt9uMJyxcbiAgICBmYWlsZWQ6ICfZhtin2qnYp9mFJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLFxuICAgIHRpdGxlUXVpY2s6ICfZgdmI2LHbjCDaiNin2KTZhiDZhNmI2ognLFxuICAgIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsXG4gICAgZWRpdGVkOiAn2KrYsdmF24zZhSDYtNiv24EnLFxuICB9LFxuICBndToge1xuICAgIGRvd25sb2FkOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICBkb3dubG9hZGluZzogJ+CqoeCqvuCqieCqqOCqsuCri+CqoSDgqqXgqogg4Kqw4Kq54KuN4Kqv4KuB4KqCIOCqm+Crh+KApicsXG4gICAgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsXG4gICAgZG93bmxvYWRlZDogJ+CqquCrguCqsOCrjeCqoycsXG4gICAgZXJyb3I6ICfgqq3gq4LgqrInLFxuICAgIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsXG4gICAgYXJpYURvd25sb2FkOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kqd4Kqh4Kqq4KuAIOCqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLFxuICAgIGVkaXRlZDogJ+CquOCqguCqquCqvuCqpuCqv+CqpCcsXG4gIH0sXG4gIGtuOiB7XG4gICAgZG93bmxvYWQ6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIGRvd25sb2FkaW5nOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONIOCyhuCyl+CzgeCypOCzjeCypOCyv+CypuCzhuKApicsXG4gICAgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LKq4LOC4LKw4LON4LKj4LKX4LOK4LKC4LKh4LK/4LKm4LOGJyxcbiAgICBlcnJvcjogJ+CypuCzi+CytycsXG4gICAgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIHRpdGxlUXVpY2s6ICfgsqTgs43gsrXgsrDgsr/gsqQg4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsXG4gICAgZWRpdGVkOiAn4LK44LKC4LKq4LK+4LKm4LK/4LK44LKy4LK+4LKX4LK/4LKm4LOGJyxcbiAgfSxcbiAgbWw6IHtcbiAgICBkb3dubG9hZDogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgZG93bmxvYWRpbmc6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0g4LSa4LWG4LSv4LWN4LSv4LWB4LSo4LWN4LSo4LWB4oCmJyxcbiAgICB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgtKrgtYLgtbzgtKTgtY3gtKTgtL/gtK/gtL7gtK/gtL8nLFxuICAgIGVycm9yOiAn4LSq4LS/4LS24LSV4LWNJyxcbiAgICBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgdGl0bGVRdWljazogJ+C0teC1h+C0l+C0pOC1jeC0pOC0v+C1vSDgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JyxcbiAgICBlZGl0ZWQ6ICfgtI7gtKHgtL/gtLHgtY3gtLHgtYHgtJrgtYbgtK/gtY3gtKTgtYEnLFxuICB9LFxuICB1azoge1xuICAgIGRvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQl9Cw0LLQsNC90YLQsNC20LXQvdC90Y/igKYnLFxuICAgIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQn9C+0LzQuNC70LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0KjQstC40LTQutC1INC30LDQstCw0L3RgtCw0LbQtdC90L3RjycsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsXG4gICAgZWRpdGVkOiAn0JfQvNGW0L3QtdC90L4nLFxuICB9LFxuICBlbDoge1xuICAgIGRvd25sb2FkOiAnzpvOrs+IzrcnLFxuICAgIGRvd25sb2FkaW5nOiAnzpvOrs+IzrfigKYnLFxuICAgIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnzp/Ou86/zrrOu863z4HPjs64zrfOus61JyxcbiAgICBlcnJvcjogJ86jz4bOrM67zrzOsScsXG4gICAgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfOm86uz4jOtycsXG4gICAgdGl0bGVRdWljazogJ86Tz4HOrs6zzr/Pgc63IM67zq7PiM63JyxcbiAgICBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsXG4gICAgZWRpdGVkOiAnzpXPgM61zr7Otc+BzrPOsc+DzrzOrc69zr8nLFxuICB9LFxuICBjczoge1xuICAgIGRvd25sb2FkOiAnU3TDoWhub3V0JyxcbiAgICBkb3dubG9hZGluZzogJ1N0YWhvdsOhbsOt4oCmJyxcbiAgICB0cnlpbmc6ICdaa291xaHDrW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTdGHFvmVubycsXG4gICAgZXJyb3I6ICdDaHliYScsXG4gICAgZmFpbGVkOiAnU2VsaGFsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1N0w6Fobm91dCcsXG4gICAgdGl0bGVRdWljazogJ1J5Y2hsw6kgc3Rhxb5lbsOtJyxcbiAgICBjb21tZW50czogJ2tvbWVudMOhxZnFrycsXG4gICAgZWRpdGVkOiAnVXByYXZlbm8nLFxuICB9LFxuICBybzoge1xuICAgIGRvd25sb2FkOiAnRGVzY8SDcmNhyJtpJyxcbiAgICBkb3dubG9hZGluZzogJ1NlIGRlc2NhcmPEg+KApicsXG4gICAgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsXG4gICAgZG93bmxvYWRlZDogJ0ZpbmFsaXphdCcsXG4gICAgZXJyb3I6ICdFcm9hcmUnLFxuICAgIGZhaWxlZDogJ0XImXVhdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2PEg3JjYXJlIHJhcGlkxIMnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpaScsXG4gICAgZWRpdGVkOiAnTW9kaWZpY2F0JyxcbiAgfSxcbiAgaHU6IHtcbiAgICBkb3dubG9hZDogJ0xldMO2bHTDqXMnLFxuICAgIGRvd25sb2FkaW5nOiAnTGV0w7ZsdMOpc+KApicsXG4gICAgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLw6lzeicsXG4gICAgZXJyb3I6ICdIaWJhJyxcbiAgICBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGV0w7ZsdMOpcycsXG4gICAgdGl0bGVRdWljazogJ0d5b3JzIGxldMO2bHTDqXMnLFxuICAgIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLFxuICAgIGVkaXRlZDogJ1N6ZXJrZXN6dHZlJyxcbiAgfSxcbiAgc3Y6IHtcbiAgICBkb3dubG9hZDogJ0xhZGRhIG5lcicsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRkYXIgbmVy4oCmJyxcbiAgICB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhcnQnLFxuICAgIGVycm9yOiAnRmVsJyxcbiAgICBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYWRkYSBuZXInLFxuICAgIHRpdGxlUXVpY2s6ICdTbmFiYiBuZWRsYWRkbmluZycsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcmFkJyxcbiAgfSxcbiAgZGE6IHtcbiAgICBkb3dubG9hZDogJ0hlbnQnLFxuICAgIGRvd25sb2FkaW5nOiAnSGVudGVy4oCmJyxcbiAgICB0cnlpbmc6ICdQcsO4dmVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSGVudGV0JyxcbiAgICBlcnJvcjogJ0ZlamwnLFxuICAgIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnSGVudCcsXG4gICAgdGl0bGVRdWljazogJ0h1cnRpZyBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcmV0JyxcbiAgfSxcbiAgZmk6IHtcbiAgICBkb3dubG9hZDogJ0xhdGFhJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGF0YWFu4oCmJyxcbiAgICB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0xhZGF0dHUnLFxuICAgIGVycm9yOiAnVmlyaGUnLFxuICAgIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhdGFhJyxcbiAgICB0aXRsZVF1aWNrOiAnUGlrYWxhdGF1cycsXG4gICAgY29tbWVudHM6ICdrb21tZW50dGlhJyxcbiAgICBlZGl0ZWQ6ICdNdW9rYXR0dScsXG4gIH0sXG4gIG5vOiB7XG4gICAgZG93bmxvYWQ6ICdMYXN0IG5lZCcsXG4gICAgZG93bmxvYWRpbmc6ICdMYXN0ZXIgbmVk4oCmJyxcbiAgICB0cnlpbmc6ICdQcsO4dmVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmVyZGlnJyxcbiAgICBlcnJvcjogJ0ZlaWwnLFxuICAgIGZhaWxlZDogJ01pc2x5a3Rlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhc3QgbmVkJyxcbiAgICB0aXRsZVF1aWNrOiAnUmFzayBuZWRsYXN0aW5nJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VydCcsXG4gIH0sXG4gIGhlOiB7XG4gICAgZG93bmxvYWQ6ICfXlNeV16jXk9eUJyxcbiAgICBkb3dubG9hZGluZzogJ9ee15XXqNeZ15PigKYnLFxuICAgIHRyeWluZzogJ9ee16DXodeU4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn15TXldep15zXnScsXG4gICAgZXJyb3I6ICfXqdeS15nXkNeUJyxcbiAgICBmYWlsZWQ6ICfXoNeb16nXnCcsXG4gICAgYXJpYURvd25sb2FkOiAn15TXldeo15PXlCcsXG4gICAgdGl0bGVRdWljazogJ9eU15XXqNeT15Qg157XlNeZ16jXlCcsXG4gICAgY29tbWVudHM6ICfXqteS15XXkdeV16onLFxuICAgIGVkaXRlZDogJ9eg16LXqNeaJyxcbiAgfSxcbiAgZmE6IHtcbiAgICBkb3dubG9hZDogJ9iv2KfZhtmE2YjYrycsXG4gICAgZG93bmxvYWRpbmc6ICfYr9ix2K3Yp9mEINiv2KfZhtmE2YjYr+KApicsXG4gICAgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfYp9mG2KzYp9mFINi02K8nLFxuICAgIGVycm9yOiAn2K7Yt9inJyxcbiAgICBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLFxuICAgIGFyaWFEb3dubG9hZDogJ9iv2KfZhtmE2YjYrycsXG4gICAgdGl0bGVRdWljazogJ9iv2KfZhtmE2YjYryDYs9ix24zYuScsXG4gICAgY29tbWVudHM6ICfZhti42LEnLFxuICAgIGVkaXRlZDogJ9mI24zYsdin24zYtCDYtNiv2YcnLFxuICB9LFxuICBmaWw6IHtcbiAgICBkb3dubG9hZDogJ0ktZG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTmFnZGEtZG93bmxvYWTigKYnLFxuICAgIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVGFwb3MgbmEnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ05hYmlnby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0ktZG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdNYWJpbGlzIG5hIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ21nYSBrb21lbnRvJyxcbiAgICBlZGl0ZWQ6ICdOYS1lZGl0JyxcbiAgfSxcbiAgbXM6IHtcbiAgICBkb3dubG9hZDogJ011YXQgdHVydW4nLFxuICAgIGRvd25sb2FkaW5nOiAnTWVtdWF0IHR1cnVu4oCmJyxcbiAgICB0cnlpbmc6ICdNZW5jdWJh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2VsZXNhaScsXG4gICAgZXJyb3I6ICdSYWxhdCcsXG4gICAgZmFpbGVkOiAnR2FnYWwuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdNdWF0IHR1cnVuJyxcbiAgICB0aXRsZVF1aWNrOiAnTXVhdCB0dXJ1biBwYW50YXMnLFxuICAgIGNvbW1lbnRzOiAna29tZW4nLFxuICAgIGVkaXRlZDogJ0RpZWRpdCcsXG4gIH0sXG4gIHNyOiB7XG4gICAgZG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQn9GA0LXRg9C30LjQvNCw0ZrQteKApicsXG4gICAgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JfQsNCy0YDRiNC10L3QvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10YPQt9C40LzQsNGa0LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdGa0LXQvdC+JyxcbiAgfSxcbiAgc2s6IHtcbiAgICBkb3dubG9hZDogJ1N0aWFobnXFpScsXG4gICAgZG93bmxvYWRpbmc6ICdTxaVhaG92YW5pZeKApicsXG4gICAgdHJ5aW5nOiAnU2vDusWhYW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdIb3Rvdm8nLFxuICAgIGVycm9yOiAnQ2h5YmEnLFxuICAgIGZhaWxlZDogJ1pseWhhbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTdGlhaG51xaUnLFxuICAgIHRpdGxlUXVpY2s6ICdSw71jaGxlIHN0aWFobnV0aWUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLFxuICAgIGVkaXRlZDogJ1VwcmF2ZW7DqScsXG4gIH0sXG4gIGJnOiB7XG4gICAgZG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQmNC30YLQtdCz0LvRj9C90LXigKYnLFxuICAgIHRyeWluZzogJ9Ce0L/QuNGC4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGK0YDQt9C+INC40LfRgtC10LPQu9GP0L3QtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLFxuICAgIGVkaXRlZDogJ9Cg0LXQtNCw0LrRgtC40YDQsNC90L4nLFxuICB9LFxuICBocjoge1xuICAgIGRvd25sb2FkOiAnUHJldXptaScsXG4gICAgZG93bmxvYWRpbmc6ICdQcmV1emltYW5qZeKApicsXG4gICAgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0dvdG92bycsXG4gICAgZXJyb3I6ICdHcmXFoWthJyxcbiAgICBmYWlsZWQ6ICdOZXVzcGplbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQcmV1em1pJyxcbiAgICB0aXRsZVF1aWNrOiAnQnJ6byBwcmV1emltYW5qZScsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmEnLFxuICAgIGVkaXRlZDogJ1VyZcSRZW5vJyxcbiAgfSxcbiAgbHQ6IHtcbiAgICBkb3dubG9hZDogJ0F0c2lzacWzc3RpJyxcbiAgICBkb3dubG9hZGluZzogJ1NpdW7EjWlhbWHigKYnLFxuICAgIHRyeWluZzogJ0JhbmRvbWHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCYWlndGEnLFxuICAgIGVycm9yOiAnS2xhaWRhJyxcbiAgICBmYWlsZWQ6ICdOZXBhdnlrby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0F0c2lzacWzc3RpJyxcbiAgICB0aXRsZVF1aWNrOiAnR3JlaXRhcyBhdHNpc2l1bnRpbWFzJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyYWknLFxuICAgIGVkaXRlZDogJ1JlZGFndW90YScsXG4gIH0sXG4gIGx2OiB7XG4gICAgZG93bmxvYWQ6ICdMZWp1cGllbMSBZMSTdCcsXG4gICAgZG93bmxvYWRpbmc6ICdMZWp1cGllbMSBZMST4oCmJyxcbiAgICB0cnlpbmc6ICdNxJPEo2luYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1BhYmVpZ3RzJyxcbiAgICBlcnJvcjogJ0vEvMWrZGEnLFxuICAgIGZhaWxlZDogJ05laXpkZXbEgXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMZWp1cGllbMSBZMSTdCcsXG4gICAgdGl0bGVRdWljazogJ8SAdHLEgSBsZWp1cGllbMSBZGUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50xIFyaScsXG4gICAgZWRpdGVkOiAnUmVkacSjxJN0cycsXG4gIH0sXG4gIGV0OiB7XG4gICAgZG93bmxvYWQ6ICdMYWFkaSBhbGxhJyxcbiAgICBkb3dubG9hZGluZzogJ0xhYWRpbWluZeKApicsXG4gICAgdHJ5aW5nOiAnUHJvb3ZpbuKApicsXG4gICAgZG93bmxvYWRlZDogJ1ZhbG1pcycsXG4gICAgZXJyb3I6ICdWaWdhJyxcbiAgICBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYWFkaSBhbGxhJyxcbiAgICB0aXRsZVF1aWNrOiAnS2lpcmUgYWxsYWxhYWRpbWluZScsXG4gICAgY29tbWVudHM6ICdrb21tZW50YWFyaScsXG4gICAgZWRpdGVkOiAnTXV1ZGV0dWQnLFxuICB9LFxuICBzbDoge1xuICAgIGRvd25sb2FkOiAnUHJlbm9zJyxcbiAgICBkb3dubG9hZGluZzogJ1ByZW5hxaFhbmpl4oCmJyxcbiAgICB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLb27EjWFubycsXG4gICAgZXJyb3I6ICdOYXBha2EnLFxuICAgIGZhaWxlZDogJ05pIHVzcGVsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ByZW5vcycsXG4gICAgdGl0bGVRdWljazogJ0hpdGVyIHByZW5vcycsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmpldicsXG4gICAgZWRpdGVkOiAnVXJlamVubycsXG4gIH0sXG4gIGNhOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJyZWdhJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcnJlZ2FudOKApicsXG4gICAgdHJ5aW5nOiAnSW50ZW50YW504oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FycmVnYXQnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0hhIGZhbGxhdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjw6BycmVnYSByw6BwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaXMnLFxuICAgIGVkaXRlZDogJ0VkaXRhdCcsXG4gIH0sXG4gIGFmOiB7XG4gICAgZG93bmxvYWQ6ICdBZmxhYWknLFxuICAgIGRvd25sb2FkaW5nOiAnTGFhaSBhZuKApicsXG4gICAgdHJ5aW5nOiAnUHJvYmVlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYWFyJyxcbiAgICBlcnJvcjogJ0ZvdXQnLFxuICAgIGZhaWxlZDogJ01pc2x1ay4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0FmbGFhaScsXG4gICAgdGl0bGVRdWljazogJ1Zpbm5pZ2UgYWZsYWFpJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmUnLFxuICAgIGVkaXRlZDogJ0dlcmVkaWdlZXInLFxuICB9LFxuICBhbToge1xuICAgIGRvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JyxcbiAgICBkb3dubG9hZGluZzogJ+GJoOGIm+GLjeGIqOGLtSDhiIvhi63igKYnLFxuICAgIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhi4jhiK3hi7fhiI0nLFxuICAgIGVycm9yOiAn4Yi14YiF4Ymw4Ym1JyxcbiAgICBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLFxuICAgIGFyaWFEb3dubG9hZDogJ+GKoOGLjeGIreGLtScsXG4gICAgdGl0bGVRdWljazogJ+GNiOGMo+GKlSDhiJvhi43hiKjhi7UnLFxuICAgIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JyxcbiAgICBlZGl0ZWQ6ICfhibDhiLXhibDhiqvhiq3hiI/hiI0nLFxuICB9LFxuICBoeToge1xuICAgIGRvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJyxcbiAgICBkb3dubG9hZGluZzogJ9WG1aXWgNWi1aXVvNW21bjWgtW04oCmJyxcbiAgICB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsXG4gICAgZG93bmxvYWRlZDogJ9Sx1b7VodaA1b/VvtWh1a4nLFxuICAgIGVycm9yOiAn1Y3VrdWh1awnLFxuICAgIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLFxuICAgIHRpdGxlUXVpY2s6ICfUsdaA1aHVoyDVttWl1oDVotWl1bzVttW41oLVtCcsXG4gICAgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLFxuICAgIGVkaXRlZDogJ9S91bTVotWh1aPWgNW+1aXVrCDVpycsXG4gIH0sXG4gIGFzOiB7XG4gICAgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahIOCmueCniCDgpobgppvgp4figKYnLFxuICAgIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ka44Kau4KeN4Kaq4KeC4Kew4KeN4KajJyxcbiAgICBlcnJvcjogJ+CmpOCnjeCnsOCngeCmn+CmvycsXG4gICAgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kam4KeN4Kew4KeB4KakIOCmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLFxuICAgIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcsXG4gIH0sXG4gIGF6OiB7XG4gICAgZG93bmxvYWQ6ICdZw7xrbMmZJyxcbiAgICBkb3dubG9hZGluZzogJ1nDvGtsyZluaXLigKYnLFxuICAgIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0JpdGRpJyxcbiAgICBlcnJvcjogJ1jJmXRhJyxcbiAgICBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsXG4gICAgYXJpYURvd25sb2FkOiAnWcO8a2zJmScsXG4gICAgdGl0bGVRdWljazogJ1PDvHLJmXRsaSB5w7xrbMmZbcmZJyxcbiAgICBjb21tZW50czogJ8WfyZlyaCcsXG4gICAgZWRpdGVkOiAnRMO8esmZbGnFnyBlZGlsaWInLFxuICB9LFxuICBldToge1xuICAgIGRvd25sb2FkOiAnRGVza2FyZ2F0dScsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNrYXJnYXR6ZW7igKYnLFxuICAgIHRyeWluZzogJ1NhaWF0emVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRWdpbmRhJyxcbiAgICBlcnJvcjogJ0Vycm9yZWEnLFxuICAgIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2thcmdhdHUnLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNrYXJnYSBhemthcnJhJyxcbiAgICBjb21tZW50czogJ2lydXpraW4nLFxuICAgIGVkaXRlZDogJ0VkaXRhdHVhJyxcbiAgfSxcbiAgbXk6IHtcbiAgICBkb3dubG9hZDogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgZG93bmxvYWRpbmc6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLog4YCc4YCv4YCV4YC64YCU4YCx4oCmJyxcbiAgICB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhgJXhgLzhgK7hgLjhgJXhgKvhgJXhgLzhgK4nLFxuICAgIGVycm9yOiAn4YCh4YCZ4YC+4YCs4YC4JyxcbiAgICBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLFxuICAgIGFyaWFEb3dubG9hZDogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgdGl0bGVRdWljazogJ+GAoeGAmeGAvOGAlOGAuiDhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JyxcbiAgICBlZGl0ZWQ6ICfhgJXhgLzhgIThgLrhgIbhgIThgLrhgJXhgLzhgK7hgLgnLFxuICB9LFxuICBnbDoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcmdhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdUZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsbG91LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gIGthOiB7XG4gICAgZG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIGRvd25sb2FkaW5nOiAn4YOY4YOs4YOU4YOg4YOU4YOR4YOQ4oCmJyxcbiAgICB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhg5Phg5Dhg6Hhg6Dhg6Phg5rhg5Phg5AnLFxuICAgIGVycm9yOiAn4YOo4YOU4YOq4YOT4YOd4YOb4YOQJyxcbiAgICBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsXG4gICAgYXJpYURvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICB0aXRsZVF1aWNrOiAn4YOh4YOs4YOg4YOQ4YOk4YOYIOGDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLFxuICAgIGVkaXRlZDogJ+GDoOGDlOGDk+GDkOGDpeGDouGDmOGDoOGDlOGDkeGDo+GDmuGDmOGDkCcsXG4gIH0sXG4gIGlzOiB7XG4gICAgZG93bmxvYWQ6ICdTw6ZramEnLFxuICAgIGRvd25sb2FkaW5nOiAnU8Oma2ly4oCmJyxcbiAgICB0cnlpbmc6ICdSZXluaeKApicsXG4gICAgZG93bmxvYWRlZDogJ1PDs3R0JyxcbiAgICBlcnJvcjogJ1ZpbGxhJyxcbiAgICBmYWlsZWQ6ICdNaXN0w7Nrc3QuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTw6ZramEnLFxuICAgIHRpdGxlUXVpY2s6ICdGbMO9dGluacOwdXJoYWwnLFxuICAgIGNvbW1lbnRzOiAndW1tw6ZsaScsXG4gICAgZWRpdGVkOiAnQnJleXR0JyxcbiAgfSxcbiAgZ2E6IHtcbiAgICBkb3dubG9hZDogJ8ONb3Nsw7Nkw6FpbCcsXG4gICAgZG93bmxvYWRpbmc6ICdBZyDDrW9zbMOzZMOhaWzigKYnLFxuICAgIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnw41vc2zDs2TDoWlsdGUnLFxuICAgIGVycm9yOiAnRWFycsOhaWQnLFxuICAgIGZhaWxlZDogJ1RoZWlwIGFpci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ8ONb3Nsw7Nkw6FpbCcsXG4gICAgdGl0bGVRdWljazogJ8ONb3Nsw7Nkw6FpbCB0YXBhJyxcbiAgICBjb21tZW50czogJ3Ryw6FjaHQnLFxuICAgIGVkaXRlZDogJ0VhZ3JhaXRoZScsXG4gIH0sXG4gIGtrOiB7XG4gICAgZG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJyxcbiAgICBkb3dubG9hZGluZzogJ9CW0q/QutGC0LXQu9GD0LTQteKApicsXG4gICAgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JDRj9Kb0YLQsNC70LTRiycsXG4gICAgZXJyb3I6ICfSmtCw0YLQtScsXG4gICAgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsXG4gICAgYXJpYURvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsXG4gICAgdGl0bGVRdWljazogJ9CW0YvQu9C00LDQvCDQttKv0LrRgtC10YMnLFxuICAgIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsXG4gICAgZWRpdGVkOiAn06jQt9Cz0LXRgNGC0ZbQu9C00ZYnLFxuICB9LFxuICBrbToge1xuICAgIGRvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJyxcbiAgICBkb3dubG9hZGluZzogJ+GegOGfhuGeluGeu+GehOGekeGetuGeieGemeGegOKApicsXG4gICAgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Z6U4Z624Z6T4Z6U4Z6J4Z+S4Z6F4Z6U4Z+LJyxcbiAgICBlcnJvcjogJ+GegOGfhuGeoOGeu+GenycsXG4gICAgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLFxuICAgIHRpdGxlUXVpY2s6ICfhnpHhnrbhnonhnpnhnoDhnpvhnr/hnpMnLFxuICAgIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JyxcbiAgICBlZGl0ZWQ6ICfhnpThnrbhnpPhnoDhn4Lhnp/hnpjhn5Lhnprhnr3hnpsnLFxuICB9LFxuICBsbzoge1xuICAgIGRvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJyxcbiAgICBkb3dubG9hZGluZzogJ+C6geC6s+C6peC6seC6h+C6lOC6suC6p+C7guC6q+C6peC6lOKApicsXG4gICAgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Lqq4Lqz4LuA4Lql4Lqx4LqUJyxcbiAgICBlcnJvcjogJ+C6nOC6tOC6lOC6nuC6suC6lCcsXG4gICAgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLFxuICAgIHRpdGxlUXVpY2s6ICfgupTgurLguqfgu4LguqvguqXgupTgupTgu4jguqfgupknLFxuICAgIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJyxcbiAgICBlZGl0ZWQ6ICfgu4HguoHgu4ngu4TguoLgu4HguqXgu4nguqcnLFxuICB9LFxuICBtazoge1xuICAgIGRvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0J/RgNC10LfQtdC80LDRmtC14oCmJyxcbiAgICB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YDQt9C+INC/0YDQtdC30LXQvNCw0ZrQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10L3QtdGC0L4nLFxuICB9LFxuICBtbjoge1xuICAgIGRvd25sb2FkOiAn0KLQsNGC0LDRhScsXG4gICAgZG93bmxvYWRpbmc6ICfQotCw0YLQsNC2INCx0LDQudC90LDigKYnLFxuICAgIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0KLQsNGC0YHQsNC9JyxcbiAgICBlcnJvcjogJ9CQ0LvQtNCw0LAnLFxuICAgIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Ci0LDRgtCw0YUnLFxuICAgIHRpdGxlUXVpY2s6ICfQpdGD0YDQtNCw0L0g0YLQsNGC0LDRhScsXG4gICAgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLFxuICAgIGVkaXRlZDogJ9CX0LDRgdGB0LDQvScsXG4gIH0sXG4gIG5lOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueClgeCkgeCkpuCliOKApicsXG4gICAgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCkviDgpK3gpK/gpYsnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JyxcbiAgICBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpJvgpL/gpJ/gpYsg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsXG4gICAgZWRpdGVkOiAn4KS44KSu4KWN4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgb3I6IHtcbiAgICBkb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgZG93bmxvYWRpbmc6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0g4Ky54K2H4KyJ4Kyb4Ky/4oCmJyxcbiAgICB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ky44Kyu4K2N4Kyq4K2C4Kyw4K2N4Kyj4K2N4KyjJyxcbiAgICBlcnJvcjogJ+CspOCtjeCssOCtgeCsn+CsvycsXG4gICAgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICB0aXRsZVF1aWNrOiAn4Ky24K2A4KyY4K2N4KywIOCsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLFxuICAgIGVkaXRlZDogJ+CsuOCsruCtjeCsquCsvuCspuCsv+CspCcsXG4gIH0sXG4gIHNpOiB7XG4gICAgZG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLFxuICAgIGRvd25sb2FkaW5nOiAn4La24LeP4Lac4LatIOC3gOC3meC2uOC3kuC2seC3iuKApicsXG4gICAgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsXG4gICAgZG93bmxvYWRlZDogJ+C2heC3gOC3g+C2seC3iicsXG4gICAgZXJyb3I6ICfgtq/gt53gt4Lgtrrgtprgt5InLFxuICAgIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsXG4gICAgYXJpYURvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJyxcbiAgICB0aXRsZVF1aWNrOiAn4LaJ4Laa4LeK4La44Lax4LeKIOC2tuC3j+C2nOC2rSDgtprgt5Lgtrvgt5PgtrgnLFxuICAgIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJyxcbiAgICBlZGl0ZWQ6ICfgt4PgtoLgt4Pgt4rgtprgtrvgtqvgtronLFxuICB9LFxuICBzdzoge1xuICAgIGRvd25sb2FkOiAnUGFrdWEnLFxuICAgIGRvd25sb2FkaW5nOiAnSW5hcGFrdWHigKYnLFxuICAgIHRyeWluZzogJ0luYWphcmlideKApicsXG4gICAgZG93bmxvYWRlZDogJ0ltZWthbWlsaWthJyxcbiAgICBlcnJvcjogJ0hpdGlsYWZ1JyxcbiAgICBmYWlsZWQ6ICdJbWVzaGluZHdhLicsXG4gICAgYXJpYURvd25sb2FkOiAnUGFrdWEnLFxuICAgIHRpdGxlUXVpY2s6ICdQYWt1YSBoYXJha2EnLFxuICAgIGNvbW1lbnRzOiAnbWFvbmknLFxuICAgIGVkaXRlZDogJ0ltZWhhcmlyaXdhJyxcbiAgfSxcbiAgdXo6IHtcbiAgICBkb3dubG9hZDogJ1l1a2xhc2gnLFxuICAgIGRvd25sb2FkaW5nOiAnWXVrbGFubW9xZGHigKYnLFxuICAgIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVGF5eW9yJyxcbiAgICBlcnJvcjogJ1hhdG8nLFxuICAgIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1l1a2xhc2gnLFxuICAgIHRpdGxlUXVpY2s6ICdUZXogeXVrbGFzaCcsXG4gICAgY29tbWVudHM6ICdzaGFyaGxhcicsXG4gICAgZWRpdGVkOiAnVGFocmlybGFuZ2FuJyxcbiAgfSxcbiAgY3k6IHtcbiAgICBkb3dubG9hZDogJ0xhd3Jsd3l0aG8nLFxuICAgIGRvd25sb2FkaW5nOiAnWW4gbGF3cmx3eXRob+KApicsXG4gICAgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnV2VkaSBnb3JmZmVuJyxcbiAgICBlcnJvcjogJ0d3YWxsJyxcbiAgICBmYWlsZWQ6ICdNZXRob2RkLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGF3cmx3eXRobycsXG4gICAgdGl0bGVRdWljazogJ0xhd3Jsd3l0aG8gY3lmbHltJyxcbiAgICBjb21tZW50czogJ3N5bHdhZGF1JyxcbiAgICBlZGl0ZWQ6ICdHb2x5Z3d5ZCcsXG4gIH0sXG4gIHp1OiB7XG4gICAgZG93bmxvYWQ6ICdMYW5kYScsXG4gICAgZG93bmxvYWRpbmc6ICdJeWFsYW5kd2HigKYnLFxuICAgIHRyeWluZzogJ0l5YXphbWHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdJbGFuZMSrd2UnLFxuICAgIGVycm9yOiAnSXBodXRoYScsXG4gICAgZmFpbGVkOiAnSWhsdWxla2lsZS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhbmRhJyxcbiAgICB0aXRsZVF1aWNrOiAnVWt1bGFuZGEgb2t1c2hlc2hheW8nLFxuICAgIGNvbW1lbnRzOiAnYW1hendhbmEnLFxuICAgIGVkaXRlZDogJ0t1aGxlbGl3ZScsXG4gIH0sXG4gIHNxOiB7XG4gICAgZG93bmxvYWQ6ICdTaGthcmtvJyxcbiAgICBkb3dubG9hZGluZzogJ0R1a2Ugc2hrYXJrdWFy4oCmJyxcbiAgICB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQw6tyZnVuZG9pJyxcbiAgICBlcnJvcjogJ0dhYmltJyxcbiAgICBmYWlsZWQ6ICdEw6tzaHRvaS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1Noa2Fya28nLFxuICAgIHRpdGxlUXVpY2s6ICdTaGthcmtpbSBpIHNocGVqdMOrJyxcbiAgICBjb21tZW50czogJ2tvbWVudGUnLFxuICAgIGVkaXRlZDogJ0UgcmVkYWt0dWFyJyxcbiAgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJlxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmxhbmdcbiAgICApIHtcbiAgICAgIHJhd0xhbmcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci5sYW5ndWFnZSkge1xuICAgICAgcmF3TGFuZyA9IG5hdmlnYXRvci5sYW5ndWFnZTtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkTGFuZyA9IHJhd0xhbmdcbiAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAuc3BsaXQoJzsnKVswXVxuICAgICAgLnRyaW0oKVxuICAgICAgLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1snZW4nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG4gIH0gY2F0Y2gge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC90aGVtZS50c1xuXG4vKipcbiAqIFRIRU1FIERFVEVDVE9SXG4gKlxuICogR29hbDogXCJJcyB0aGUgY29udGVudCBJJ20gZHJhd2luZyBvbiB2aXN1YWxseSBkYXJrIG9yIGxpZ2h0P1wiXG4gKiBJbnN0ZWFkIG9mIGd1ZXNzaW5nIGZyb20gPGJvZHk+LCB3ZTpcbiAqICAtIFJlc3BlY3QgRGFyayBSZWFkZXIgaWYgcHJlc2VudFxuICogIC0gTG9vayBmb3Igb2J2aW91cyBcImRhcmsgbW9kZVwiIGNsYXNzZXNcbiAqICAtIE1lYXN1cmUgdGhlIGVmZmVjdGl2ZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIGEgKmNvbnRlbnQqIGVsZW1lbnRcbiAqICAgIChlLmcuIEdvb2dsZSBDbGFzc3Jvb20gc3RyZWFtIGNhcmRzKVxuICovXG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBwYWdlICpjb250ZW50IGFyZWEqIGlzIHZpc3VhbGx5IGRhcmsuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1BhZ2VEYXJrKCk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIDEuIEZhc3QgcGF0aDogRGFyayBSZWFkZXIgYXR0cmlidXRlXG4gIGNvbnN0IGRyU2NoZW1lID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1kYXJrcmVhZGVyLXNjaGVtZScpO1xuICBpZiAoZHJTY2hlbWUgPT09ICdkYXJrJykgcmV0dXJuIHRydWU7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2xpZ2h0JykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIDIuIEhldXJpc3RpYzogb2J2aW91cyBcImRhcmsgbW9kZVwiIGNsYXNzZXMgb24gPGh0bWw+IC8gPGJvZHk+XG4gIC8vIChjb3ZlcnMgc29tZSBmcmFtZXdvcmtzIGFuZCBleHRlbnNpb25zKVxuICBjb25zdCBkYXJrVG9rZW5zID0gWydkYXJrJywgJ2RhcmstdGhlbWUnLCAndGhlbWUtZGFyaycsICduaWdodCcsICdnbTMtZGFyay10aGVtZSddO1xuICBjb25zdCBodG1sQ2xhc3MgPSAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgYm9keUNsYXNzID0gKGRvY3VtZW50LmJvZHkuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoZGFya1Rva2Vucy5zb21lKHRva2VuID0+IGh0bWxDbGFzcy5pbmNsdWRlcyh0b2tlbikgfHwgYm9keUNsYXNzLmluY2x1ZGVzKHRva2VuKSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIDMuIFByb2JlIGEgKmNvbnRlbnQqIGVsZW1lbnQsIG5vdCB0aGUgd2hvbGUgcGFnZSBiYWNrZ3JvdW5kLlxuICAvLyAgICBGb3IgQ2xhc3Nyb29tLCBwb3N0cyBhcmUgdGhlIG1haW4gc3VyZmFjZSB3ZSBkcmF3IG9uLlxuICBjb25zdCBwcm9iZUVsID1cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJykgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignW3JvbGU9XCJtYWluXCJdJykgfHxcbiAgICBkb2N1bWVudC5ib2R5O1xuXG4gIGNvbnN0IGJnQ29sb3IgPSBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3IocHJvYmVFbCk7XG4gIGNvbnN0IGJyaWdodG5lc3MgPSBwYXJzZUJyaWdodG5lc3MoYmdDb2xvcik7XG5cbiAgLy8gNC4gRGVjaWRlIHRocmVzaG9sZC5cbiAgLy8gICAgMTI4IGlzIFwiNTAlIGdyYXlcIiwgYnV0IHRoYXQgZmxpcHMgdG9vIGVhcmx5IG9uIHNsaWdodGx5IGdyYXkgVUlzLlxuICAvLyAgICBVc2UgYSBzdHJpY3RlciB0aHJlc2hvbGQgc28gd2Ugb25seSB0cmVhdCBjbGVhcmx5IGRhcmsgVUlzIGFzIGRhcmsuXG4gIHJldHVybiBicmlnaHRuZXNzIDwgMTA1O1xufVxuXG4vKipcbiAqIFdhbGtzIHVwIHRoZSBET00gZnJvbSBhIGdpdmVuIGVsZW1lbnQgdW50aWwgaXQgZmluZHMgYSBub24tdHJhbnNwYXJlbnQgYmFja2dyb3VuZCBjb2xvci5cbiAqIEZhbGxzIGJhY2sgdG8gPGh0bWw+IGFuZCBmaW5hbGx5IHRvIHB1cmUgd2hpdGUuXG4gKi9cbmZ1bmN0aW9uIGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihzdGFydDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICBsZXQgZWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IHN0YXJ0O1xuXG4gIGNvbnN0IGlzVHJhbnNwYXJlbnQgPSAoYzogc3RyaW5nIHwgbnVsbCkgPT5cbiAgICAhYyB8fCBjID09PSAndHJhbnNwYXJlbnQnIHx8IGMgPT09ICdyZ2JhKDAsIDAsIDAsIDApJztcblxuICB3aGlsZSAoZWwpIHtcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICBjb25zdCBiZyA9IHN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgICBpZiAoIWlzVHJhbnNwYXJlbnQoYmcpKSByZXR1cm4gYmc7XG4gICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICB9XG5cbiAgLy8gVHJ5IDxodG1sPiBhcyBhIGxhc3QgcmVhbCBlbGVtZW50XG4gIGNvbnN0IGh0bWxTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCk7XG4gIGNvbnN0IGh0bWxCZyA9IGh0bWxTdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gIGlmICghaXNUcmFuc3BhcmVudChodG1sQmcpKSByZXR1cm4gaHRtbEJnO1xuXG4gIC8vIEFic29sdXRlIGZhbGxiYWNrOiBhc3N1bWUgd2hpdGVcbiAgcmV0dXJuICdyZ2IoMjU1LCAyNTUsIDI1NSknO1xufVxuXG4vKipcbiAqIEhlbHBlcjogQ2FsY3VsYXRlcyBicmlnaHRuZXNzICgwLTI1NSkgZnJvbSBhbiBSR0IoQSkgc3RyaW5nLlxuICogVXNlcyB0aGUgSFNQIGNvbG9yIGZvcm11bGE6IHNxcnQoMC4yOTkqUl4yICsgMC41ODcqR14yICsgMC4xMTQqQl4yKVxuICovXG5mdW5jdGlvbiBwYXJzZUJyaWdodG5lc3MocmdiU3RyaW5nOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBtYXRjaCA9IHJnYlN0cmluZy5tYXRjaCgvKFxcZCspLFxccyooXFxkKyksXFxzKihcXGQrKS8pO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgLy8gSWYgd2UgY2FuJ3QgcGFyc2UgaXQsIGFzc3VtZSBicmlnaHQgc28gd2UgZG9uJ3QgYWNjaWRlbnRhbGx5IGZsaXAgdG8gZGFyayBtb2RlLlxuICAgIHJldHVybiAyNTU7XG4gIH1cblxuICBjb25zdCByID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgY29uc3QgZyA9IHBhcnNlSW50KG1hdGNoWzJdLCAxMCk7XG4gIGNvbnN0IGIgPSBwYXJzZUludChtYXRjaFszXSwgMTApO1xuXG4gIC8vIEhTUCBlcXVhdGlvbiBpcyBwZXJjZWl2ZWQgYnJpZ2h0bmVzc1xuICBjb25zdCBicmlnaHRuZXNzID0gTWF0aC5zcXJ0KFxuICAgIDAuMjk5ICogKHIgKiByKSArXG4gICAgMC41ODcgKiAoZyAqIGcpICtcbiAgICAwLjExNCAqIChiICogYilcbiAgKTtcblxuICByZXR1cm4gYnJpZ2h0bmVzcztcbn1cblxuLyoqXG4gKiBXYXRjaGVyOiBOb3RpZmllcyB5b3Ugd2hlbiB0aGUgdGhlbWUgbGlrZWx5IGNoYW5nZWQuXG4gKlxuICogWW91IGNhbiB1c2UgdGhpcyBpZiB5b3UgZXZlciB3YW50IHRvIGR5bmFtaWNhbGx5IHJlLXN0eWxlIHRoaW5nc1xuICogd2hlbiB0aGUgdXNlciAvIGV4dGVuc2lvbiB0b2dnbGVzIHRoZW1lLlxuICovXG5leHBvcnQgZnVuY3Rpb24gd2F0Y2hUaGVtZUNoYW5nZXMoY2FsbGJhY2s6IChpc0Rhcms6IGJvb2xlYW4pID0+IHZvaWQpOiBNdXRhdGlvbk9ic2VydmVyIHtcbiAgY29uc3QgaGFuZGxlciA9ICgpID0+IHtcbiAgICBjYWxsYmFjayhpc1BhZ2VEYXJrKCkpO1xuICB9O1xuXG4gIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoaGFuZGxlcik7XG5cbiAgLy8gV2F0Y2ggZm9yIGF0dHJpYnV0ZS9jbGFzcyBjaGFuZ2VzIG9uIDxodG1sPiBhbmQgPGJvZHk+XG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS1kYXJrcmVhZGVyLXNjaGVtZScsICdzdHlsZScsICdjbGFzcyddLFxuICB9KTtcblxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydzdHlsZScsICdjbGFzcyddLFxuICB9KTtcblxuICAvLyBBbHNvIGxpc3RlbiB0byBzeXN0ZW0gdGhlbWUgY2hhbmdlcyBhcyBhIGJhY2t1cCBzaWduYWxcbiAgaWYgKHR5cGVvZiB3aW5kb3cubWF0Y2hNZWRpYSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnN0IG1xID0gd2luZG93Lm1hdGNoTWVkaWEoJyhwcmVmZXJzLWNvbG9yLXNjaGVtZTogZGFyayknKTtcbiAgICBpZiAobXEpIHtcbiAgICAgIGNvbnN0IG1xTGlzdGVuZXIgPSAoKSA9PiBoYW5kbGVyKCk7XG4gICAgICAvLyBNb2Rlcm4gYnJvd3NlcnNcbiAgICAgIGlmICgobXEgYXMgYW55KS5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIG1xLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG1xTGlzdGVuZXIpO1xuICAgICAgfSBlbHNlIGlmICgobXEgYXMgYW55KS5hZGRMaXN0ZW5lcikge1xuICAgICAgICAvLyBMZWdhY3kgQVBJXG4gICAgICAgIChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKG1xTGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEluaXRpYWwgY2FsbCBzbyB0aGUgY29uc3VtZXIgY2FuIHN5bmMgaW1tZWRpYXRlbHlcbiAgaGFuZGxlcigpO1xuXG4gIHJldHVybiBvYnNlcnZlcjtcbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb21tZW50X2ZyYW1lLmNvbnRlbnQudHNcbmltcG9ydCB7IENPTU1FTlRfSUNPTl9VUkwgfSBmcm9tICcuL2NvbnRlbnQvaWNvbnMnO1xuaW1wb3J0IHsgaW5qZWN0U3R5bGVzIH0gZnJvbSAnLi9jb250ZW50L3N0eWxlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9jb250ZW50L2kxOG4nO1xuaW1wb3J0IHsgaXNQYWdlRGFyayB9IGZyb20gJy4vY29udGVudC90aGVtZSc7XG5cbi8vIFNlbGVjdG9yIGZvciB0aGUgbWFpbiBzdHJlYW0gY2FyZFxuY29uc3QgUE9TVF9TRUxFQ1RPUiA9ICdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nO1xuY29uc3QgUFJPQ0VTU0VEX0FUVFIgPSAnZGF0YS1jcWQtcHJvY2Vzc2VkJztcblxuLy8g8J+UtCBORVc6IGRlYm91bmNlIGZsYWcgc28gd2UgZG9uJ3QgcmVzY2FuIG9uIGV2ZXJ5IHRpbnkgbXV0YXRpb25cbmxldCBjb21tZW50U2NhblNjaGVkdWxlZCA9IGZhbHNlO1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIE1haW4gU2NyaXB0XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL2NsYXNzcm9vbS5nb29nbGUuY29tLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgbWFpbigpIHtcbiAgICBpbmplY3RTdHlsZXMoKTtcbiAgICBzY2FuRm9yQ29tbWVudHMoKTtcblxuICAgIC8vIC0tLSBTVFJBVEVHWSAxOiBNVVRBVElPTiBPQlNFUlZFUiAtLS1cbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIC8vIOKchSBEZWJvdW5jZTogb25seSBvbmUgc2NhbiBwZXIgZnJhbWVcbiAgICAgIGlmIChjb21tZW50U2NhblNjaGVkdWxlZCkgcmV0dXJuO1xuICAgICAgY29tbWVudFNjYW5TY2hlZHVsZWQgPSB0cnVlO1xuXG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICBjb21tZW50U2NhblNjaGVkdWxlZCA9IGZhbHNlO1xuICAgICAgICBzY2FuRm9yQ29tbWVudHMoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgc2NhbkZvckNvbW1lbnRzKCk7XG4gICAgfSwgMjUwMCk7XG5cbiAgICBsZXQgbGFzdFVybCA9IGxvY2F0aW9uLmhyZWY7IFxuICAgIG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGNvbnN0IHVybCA9IGxvY2F0aW9uLmhyZWY7XG4gICAgICBpZiAodXJsICE9PSBsYXN0VXJsKSB7XG4gICAgICAgIGxhc3RVcmwgPSB1cmw7XG4gICAgICAgIHNldFRpbWVvdXQoc2NhbkZvckNvbW1lbnRzLCA1MDApOyBcbiAgICAgIH1cbiAgICB9KS5vYnNlcnZlKGRvY3VtZW50LCB7IHN1YnRyZWU6IHRydWUsIGNoaWxkTGlzdDogdHJ1ZSB9KTtcbiAgfSxcbn0pO1xuXG5mdW5jdGlvbiBzY2FuRm9yQ29tbWVudHMoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGlyZWN0aW9uID0gZ2V0UGFnZURpcmVjdGlvbigpO1xuICAgIGRvY3VtZW50LmJvZHkuc2V0QXR0cmlidXRlKCdkYXRhLWNxZC1kaXInLCBkaXJlY3Rpb24pO1xuXG4gICAgY29uc3QgcG9zdHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PihQT1NUX1NFTEVDVE9SKTtcblxuICAgIHBvc3RzLmZvckVhY2goKHBvc3QpID0+IHtcbiAgICAgIGlmIChwb3N0Lmhhc0F0dHJpYnV0ZShQUk9DRVNTRURfQVRUUikpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdPdmVybGF5ID0gcG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLW92ZXJsYXktY29udGFpbmVyJyk7XG4gICAgICAgIGlmIChleGlzdGluZ092ZXJsYXkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcG9zdC5yZW1vdmVBdHRyaWJ1dGUoUFJPQ0VTU0VEX0FUVFIpO1xuICAgICAgfVxuXG4gICAgICAvLyBQcmV2ZW50IGRvdWJsZSBib3JkZXJzIG9uIG5lc3RlZCBwb3N0c1xuICAgICAgaWYgKHBvc3QucGFyZW50RWxlbWVudD8uY2xvc2VzdChQT1NUX1NFTEVDVE9SKSkgcmV0dXJuO1xuXG4gICAgICBjb25zdCByYXdUZXh0ID0gKHBvc3QuaW5uZXJUZXh0IHx8ICcnKSArICcgJyArIGdldEFyaWFMYWJlbHMocG9zdCk7XG4gICAgICBjb25zdCBtYXRjaCA9IHJhd1RleHQubWF0Y2goLyhcXGQrKVxccytjbGFzcyBjb21tZW50L2kpO1xuICAgICAgY29uc3QgY291bnQgPSBtYXRjaCA/IHBhcnNlSW50KG1hdGNoWzFdLCAxMCkgOiAwO1xuXG4gICAgICBpZiAoY291bnQgPiAwKSB7XG4gICAgICAgIHBvc3Quc2V0QXR0cmlidXRlKFBST0NFU1NFRF9BVFRSLCAndHJ1ZScpO1xuICAgICAgICBjcmVhdGVPdmVybGF5KHBvc3QsIGNvdW50KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS53YXJuKCdDUUQgU2NhbiBFcnJvcjonLCBlcnIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU92ZXJsYXkocG9zdDogSFRNTEVsZW1lbnQsIGNvdW50OiBudW1iZXIpIHtcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShwb3N0KTtcbiAgY29uc3QgYm9yZGVyUmFkaXVzID0gY29tcHV0ZWQuYm9yZGVyUmFkaXVzIHx8ICc4cHgnO1xuXG4gIGlmIChjb21wdXRlZC5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICBwb3N0LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgfVxuXG4gIHBvc3Quc3R5bGUuc2V0UHJvcGVydHkoJ292ZXJmbG93JywgJ3Zpc2libGUnLCAnaW1wb3J0YW50Jyk7XG4gIHBvc3Quc3R5bGUuc2V0UHJvcGVydHkoJ2NvbnRhaW4nLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgcG9zdC5zdHlsZS56SW5kZXggPSAnMSc7XG5cbiAgLy8gUmV1c2Ugb3ZlcmxheSBpZiBlZGl0ZWQgc2NyaXB0IGFscmVhZHkgY3JlYXRlZCBpdFxuICBsZXQgb3ZlcmxheSA9IHBvc3QucXVlcnlTZWxlY3RvcjxIVE1MRGl2RWxlbWVudD4oJy5jcWQtb3ZlcmxheS1jb250YWluZXInKTtcbiAgaWYgKCFvdmVybGF5KSB7XG4gICAgb3ZlcmxheSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG92ZXJsYXkuY2xhc3NOYW1lID0gJ2NxZC1vdmVybGF5LWNvbnRhaW5lcic7XG4gICAgb3ZlcmxheS5zdHlsZS5ib3JkZXJSYWRpdXMgPSBib3JkZXJSYWRpdXM7XG5cbiAgICBpZiAoaXNQYWdlRGFyaygpKSBvdmVybGF5LmNsYXNzTGlzdC5hZGQoJ2NxZC10aGVtZS1kYXJrJyk7XG5cbiAgICBvdmVybGF5LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGlmIChlLnRhcmdldCA9PT0gb3ZlcmxheSkgdHJpZ2dlclBvc3RDbGljayhwb3N0KTtcbiAgICB9KTtcblxuICAgIHBvc3QuYXBwZW5kQ2hpbGQob3ZlcmxheSk7XG4gIH1cblxuICAvLyBEbyBub3QgY3JlYXRlIGEgY29tbWVudCBiYWRnZSBpZiBhIEJPVEggcGlsbCBhbHJlYWR5IGV4aXN0c1xuICBpZiAocG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLWJvdGgtYmFkZ2UnKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGJhZGdlLmNsYXNzTmFtZSA9ICdjcWQtY29tbWVudC1iYWRnZSc7XG5cbiAgLy8g8J+UuSBUb29sdGlwIGZvciBjb21tZW50cyBwaWxsXG4gIGNvbnN0IGV4cGxhbmF0aW9uID0gJ051bWJlciBvZiBjb21tZW50cyBvbiB0aGlzIHBvc3QnO1xuICBiYWRnZS50aXRsZSA9IGV4cGxhbmF0aW9uO1xuICBiYWRnZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBleHBsYW5hdGlvbik7XG5cbiAgYmFkZ2UudGl0bGUgPSBgJHtjb3VudH0gJHt0KCdjb21tZW50cycpfWA7XG4gIGlmIChpc1BhZ2VEYXJrKCkpIGJhZGdlLmNsYXNzTGlzdC5hZGQoJ2NxZC10aGVtZS1kYXJrJyk7XG5cbiAgY29uc3QgaWNvbkRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBpY29uRGl2LmNsYXNzTmFtZSA9ICdjcWQtYmFkZ2UtaWNvbic7XG4gIGljb25EaXYuc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7Q09NTUVOVF9JQ09OX1VSTH1cIilgO1xuXG4gIGNvbnN0IGxhYmVsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBsYWJlbERpdi5jbGFzc05hbWUgPSAnY3FkLWJhZGdlLWxhYmVsJztcbiAgbGFiZWxEaXYudGV4dENvbnRlbnQgPSBgJHtjb3VudH1gO1xuXG4gIGJhZGdlLmFwcGVuZENoaWxkKGljb25EaXYpO1xuICBiYWRnZS5hcHBlbmRDaGlsZChsYWJlbERpdik7XG5cbiAgYmFkZ2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgdHJpZ2dlclBvc3RDbGljayhwb3N0KTtcbiAgfSk7XG5cbiAgcG9zdC5hcHBlbmRDaGlsZChiYWRnZSk7XG59XG5cbmZ1bmN0aW9uIHRyaWdnZXJQb3N0Q2xpY2socG9zdDogSFRNTEVsZW1lbnQpIHtcbiAgY29uc3QgdGl0bGVMaW5rID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignYVtocmVmKj1cIi9kZXRhaWxzL1wiXSwgaDIgYScpO1xuICBpZiAodGl0bGVMaW5rKSB7XG4gICAgdGl0bGVMaW5rLmNsaWNrKCk7XG4gIH0gZWxzZSB7XG4gICAgcG9zdC5jbGljaygpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFBhZ2VEaXJlY3Rpb24oKTogJ2x0cicgfCAncnRsJyB7XG4gIGNvbnN0IGRvY0RpciA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kaXIgfHwgZG9jdW1lbnQuYm9keS5kaXI7XG4gIGlmIChkb2NEaXIgPT09ICdydGwnKSByZXR1cm4gJ3J0bCc7XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSkuZGlyZWN0aW9uO1xuICByZXR1cm4gY29tcHV0ZWQgPT09ICdydGwnID8gJ3J0bCcgOiAnbHRyJztcbn1cblxuZnVuY3Rpb24gZ2V0QXJpYUxhYmVscyhlbDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICByZXR1cm4gQXJyYXkuZnJvbShlbC5xdWVyeVNlbGVjdG9yQWxsKCdbYXJpYS1sYWJlbF0nKSlcbiAgICAubWFwKChub2RlKSA9PiBub2RlLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpIHx8ICcnKVxuICAgIC5qb2luKCcgJyk7XG59XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTJCOUIsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUFVTSxRQUFNLHVCQUF1QjtBQVE3QixRQUFNLG1CQUFtQiwyQkFBMkI7QUFBQSxJQUN6RDtBQUFBLEVBQ0YsQ0FBQztBQ2hERCxRQUFNLFdBQVc7QUFDakIsUUFBTSxrQkFBa0I7QUFFeEIsUUFBTSxnQkFBZ0I7QUFDdEIsUUFBTSxpQkFBaUIsR0FBRyxhQUFhO0FBRWhDLFdBQVMsZUFBcUI7QUFDbkMsUUFBSSxPQUFPLGFBQWEsWUFBYTtBQUNyQyxRQUFJLFNBQVMsZUFBZSxRQUFRLEVBQUc7QUFFdkMsVUFBTSxRQUFRLFNBQVMsY0FBYyxPQUFPO0FBQzVDLFVBQU0sS0FBSztBQUNYLFVBQU0sY0FBYztBQUFBO0FBQUEsMEJBRUksY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFvSVQscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFpSnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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
commentframe;