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

  /* Position inside the post card, near the 3-dots */
  top: 12px;       /* <— key change: small positive offset */
  right: 48px;
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

body[data-cqd-dir="rtl"] .cqd-download-all-btn {
  right: auto;
  left: 48px;
}

.cqd-download-all-btn:hover {
  box-shadow: var(--cqd-shadow-hover);
  transform: translateY(-1px);
}

.cqd-download-all-btn:active {
  transform: translateY(0);
}

/* Keep pointer cursor even while disabled (you already wanted this behavior) */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudF9mcmFtZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29tbWVudF9mcmFtZS5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBlbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzXG5cbi8vIFJhdyBTVkdzXG5leHBvcnQgY29uc3QgRE9XTkxPQURfSUNPTl9TVkdfUkFXID0gYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiPlxuICA8ZyBzdHJva2U9XCIjRkZGRkZGXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPlxuICAgIDxwYXRoIGQ9XCJNNiAyMUgxOFwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAzVjE3XCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDE3IDEyXCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDcgMTJcIiAvPlxuICA8L2c+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19SQVcgPSBgPHN2ZyB3aWR0aD1cIjE2MFwiIGhlaWdodD1cIjE2MFwiIHZpZXdCb3g9XCIwIDAgMTYwIDE2MFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPlxuPHJlY3Qgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBmaWxsPVwidXJsKCNwYXR0ZXJuMF8xXzI0ODQpXCIvPlxuPGRlZnM+XG48cGF0dGVybiBpZD1cInBhdHRlcm4wXzFfMjQ4NFwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiIGhlaWdodD1cIjFcIj5cbjx1c2UgeGxpbms6aHJlZj1cIiNpbWFnZTBfMV8yNDg0XCIgdHJhbnNmb3JtPVwic2NhbGUoMC4wMDYyNSlcIi8+XG48L3BhdHRlcm4+XG48aW1hZ2UgaWQ9XCJpbWFnZTBfMV8yNDg0XCIgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFnQUVsRVFWUjRBZTJkQ1hoVjViWDMxMG5JU01oNGhpU29WMnRyaGNvRGF1bDNhd3Y2VmF2WDF0VDJGclZlKy9XMjk3YjNYdTBWZWorMTBlc1U1bEVJUXhKbUVJaGxrRGxrbmdkQ0VpU01BaUt6UmZCVzhHdXJGV3Y5ZjgvLzNmdE5OakZJaG4xT1RzTGV6N055akp5Y3ZkLzEvKzIxM3JYMnUvY1JDY1NXSWVIeWd1OEd5ZkRkSXk5NW5nekpjR2U3TXR5YlhCbStTbGVHZDRjcnc3dlROZGJYNU1wb1kveC9qblhmQiszNWxUNVh2cWNHN2szVVJGNzBqSmFYdk44MXRKTHdRS0RodjMwOEc1Y2dMM252QzNuWk05NzFzcWZBbGVFOTZScnIvWXRybkErdThhWk44TUkxd1FmWHhNdllKQjljam5YZkI1ZnpMMzFQRGJRZTFHYXM5Mk9sMWN1ZUFtcEhEWVZhOXBydHhhVGhRdWd5UEUydXNkNkxydkdFekF2WFJDOWNrNzF3VGZIQk5kVzBhVDY0dEUzM3dhVnRoZyt1dHFiL3pYbHQ5ZE1YK2FLdC8vaTc5ZjNhNzN6VmVsQWJha1N0RkpoZUFubVJXbEpUb2JaQnU3M2t1MXN5dkt0a3JQZDlHZStGVFBSQ0puc2hVN3lRYVQ3SWRCOWtoZy95aWc4eTB3ZVpsUXpKVEliTTlrRm04OVcwT2NrUXgvem5BKzFuOWVvek5LQVcxSVRhVUNOcVJjMm9IVFdrbHRTVTJsSmphaDAwMjR1ZVd5WERzMXpHZWorVUNUeGdIcmc1Z0JrY21BWXRHVEkzR1RJdkJaS1ZBc2xPZ2VTa1FPYTNzUVVwa0xhMk1CWGlXT2Q5ME5hUC9MMnR2NmtEalpwUUcycEVPQmtjcUIwMVZERDZERzJwTWJXbTV0Uyt4N1lNVDR5ODdIbFd4bnJlTWNCanBQTWFaeERQSmc2Q2tTd3J1UlcwaFNtUVJTbVFKU21RcGJSVXlMSlV5SEtyRFlTODZwaGZmTEI4NEtXK3B1K3BBYldnSnRTR0doRlNCZ2RxUncycEpUVmxkS1RHaklvS1JNODdpb0hmdWdjRWxrT1NQOVpUS09NOXhzRW84THlRV1Q3SUhKOEpYYklSeVJhYnNDMUxnYnlhQ2xtUkNsbVpBbG5wZzZ6MFFGWW1RVlltUUZiR0c3WXFBZUtZLzN5Zy9FeC8wK2g3YWtBdFVneHRxQkcxSXBUVWpsRXp4d3drMUpZYXp6Q0REVUVrQTJRaFlORXd3LzBUR2VjNXJ1WUZVeG54TkhqSmtHd1RPaFhsektoRzRISUhRbktUSWJsdVNHNEM1SGR1OUZ0M0RlSTIzWXhyOG03SFZ3dS9qU0hGL3h2RFNyN2pXQUI4TUtUNExueTE0RnZLOTlTQVdsQVRwWTNTaUZvTk5JQmtkbHFTYWtSSHdraU5HUlUxaUdTQWMwUXlRVGI4dW8zMVBpUGpQUitxRU15b3g3Q3MweXdQam1jTXd6cWhXelVROGp1YUYvSzdSTWc2SHp4YmI4SHc4dnZ4VU9PLzQ3LzJ2WXh4aHpJeDgrMkZtSGQ4T2VhZldJV0ZKM01kQzRBUDZHdjZuTDZuQnRUaTRjYi9VTnBRSTJxbE5GUGFEVFMwcEtiVVZrZEZuWjdKZ0U3TFpJT00rR1hMY0krVkNSNmpNbUxVeS9SQzV2bU04TXlJeDVETjhMMHExUUJ2alEreUpnR1JtNjdIYmVYZnhiODAvMTlNT2pJWEMwK3V3dkozMWlwYmVubzFGcDErRFF0UHJjSUN4d0xxZzRXblZ5bmZVd09seCttMVNodHFSSzJvR2JXamhrSXRHVXlvTFRXbTF0U2NxWmtNa0FVeXdhcVpqSkFWVzdlMjhMRjFrdVdETEVnMkpxK3ZwbGpBUzFFSEhiSHBPdHhSL1FDZVBqQVcyU2RmeGRKM1ZvT0R6anE1REhOUExzRWMycWtsbUh0cXFXTTk2QU5xUUMyb0NiV2hSdFNLbWxFN2FrZ3REUkJUTENDYWhRc1pJQXRrd2k4UWpuTS9MUk05RU9iNlY3eVEyVjVqSHNCcWlaTlZUbDVmUzRXc0hRaFo2NFdzOTJCUTJRaU0zditpR3NUQzB5dlZBR2VkWEloV1c0UlpKeGRoMWluSGdzSUgxRUpacTBhRWt0b1JSR3BKVGFtdDBwaGFVM05xVHdiSUF1ZUdaSU9NcUhraGl4UDNVOTBMaEJtZVVUTFIvWkZNOVJnZlBNY0x5ZkZCRmlWRGxqUHFwVUJXcDBMV3BVSmVUMFQvcmRmandjWi94b3hqT2NnNTlTcG1ubGlBNlNkeU1QMWtEbWJRVGwzR1R1ZGdobU9COThIbDlEaHBhRWJ0cUNHMXBLYlVsaHBUYTZVNXRTY0RaSUZNa0EweW9pRDBRTEV6MXZOUTF5QWM1eDBxRTl5bld1Q2JhOEszT0JueUtxc2twbHFDbHdKWm40aVVvaUY0ZkYrNkN1VXpUK1JneXZHNW1ISmlMcWFjdE5pcHVaaGl0ZE56TWFYRjVtSEthY2NDNXdPTDc2MmE4TCt0bWxIRDQzTkJUWm1tcVRHMWx2VUpodlprZ0N5UUNiSkJDTWxLSzRTbmhTeDFhbU9UZVlLbldLYTZJVE85QnRYemZjWU91S1BYVWlCclV5RWJVaUFiRTNGaitmL0NidytOeDZ5VEN6RHBlQ1ltSEorRkNTY3lNZUdreFU1bFlrSmJPNTJKQ1ZacisrL083NS8zbVIwK3NmcWMvOTNlWjFxMW81YkhaeWx0cWZGdkQ0M0RsOHEvb2JSWERKQUZNcUVoSkN1TWhHU0hESkVsTXRYaGJYeFN1a3h4WDVwMld5SWY1M3NtZkpzUzhaV0t2OGV6aHlkZzJvbDV5RGcySFJuSHB5UGpoR2tuWnlCRDI2a1p5SENzOS9oQTY4WlhyU2UxUFRaZGFVM05xYjFzU2pRQ0VabklaWlZzaVlRNkhaT2xDVW5QZG95L2NiNGhNc2w5VG1aNHpJS2pUZVRqZkc5akttUlRFcTRydngxUEhjN0F4T096OFB6UnlYamgyR1M4Y0h3eVhqZ3hwZFZPVHNFTFZqdlY1bmY5Yi96L2pnWE9COXJ2MXRmMnRMRnFTVzJQVFZaYVUzTnFUd2JJZ21LQ2JGZ2pZVGFyWTdab1BGQk1rYTB2M0RJa1JNWjdYcFZwSHFPM3cvSmFGUnptbkkrVWJ4d0kyZXhHWXZFZy9QdUJaOVFaa2Y3MmVLUWZIWS8wWTZZZG40QjBiU2NtSUYzYnlRbElwK25mbmRmZzhrVjcrbWdkK2FyMXBkWnZqMWZha3dHeVFDWVVHeW9Tc2pCSk50Z2hRK3dUa2lteVJjWXV1MDN3akpRcDdvOWtwZ2N5end0WjRJTXM4MEZXSlVQV3BFQTJwRUkyZXhGZWNBMSszUHl2ZVBIdHlYanF5RXQ0NnUyWDhOVFJsL0RVc1pjTk8vNFNubktzNy9sQTYwdXRxZm1SbHhRRFpJRk1rQTNGQ0ZraE0yU0hESkVsTWtXMnlGaTdHOG1jNUY0bE05eVEyUjdJZkM5a0NTOVNKME5XczlKTmdXeEpnZVM1OFkwZDkrT1pJeGtZODliekdIM2tPWXgrK3ptTVB2cmZoaDM3YjR4MnJPLzZRT3RNelk4OHB4Z2dDMlNDYkNoR3lBcVpJVHRraUN5UktiSkZ4dHFOZ2hQZHQ4a1U5d1daNVliTTgwQVcrU0RMZlpEWGtpSHJVaUNiVWlCYjNmQ1czNEpmdmZrYmpIN3JPVHgrK0drOC90WXplUHpJTTNqOGJZc2RmUWFQTzliM2ZHRFZtSnBUKzhOUEt4YklCTmtnSTRvVk1rTjJ5QkJaSWxOa2k0eVJ0Yzl0azVJbXluUTNaSTRIa3VPQkxHWHE1ZlhjWktQSzJlSkRTSDR5N3RrNUN2OTU2TGY0NWNFeCtPWGgzK0NYYjVsMjVEZjRwV05YancrMDdtVGc0QmpGQk5rZ0k3TEZaekJEZHNnUVdTSlRaSXVNa2JWTHRzbHhDVEkxc1ZsbXVpRlpqSDVleUt0Y3hlS0R2SjRNMld5azNtc3FoK0huKzMrTlg3ejVuL2pad1Nmd3M4TVdlK3NKL015eHE4Y0hWdTBQUHFHWUlCdGtSS1ZpTWtOMnlCQlpJbE5raTR5Uk5UTFhzazFPdkZlbUozMGlzOTJRK1l4K1hzZ3FyN0VLWW1NeVpLc1ByZ0lmUmphbHFSMDlldUJYZVBUZ3YrSFJRNllkL2pjODZ0alY1d090UDFrNDhDdkZCaGtoSzJSR3lBNVgwcEFsTWtXMnlOajBwTDhLbVd2WnBpU05sMWVTakR5OTBITnA5R1Boc2MyTnhQS2I4YU05UDhNakIvNFZvdzc4SEtNTy9zS3dRNy9BS01ldVhoOW9EZzc4WExGQlJzZ0ttVkVGaVRVS2tpM09CY2thbVZQYkFnbVRhVW5Ga3BrRXlmWkFsbkNKdG81K1BraGVNaVRmalVIYnY0V0g5djBjRCs1N0RBOGVvUDBVRDc3NVV6eDQwTEdyMmdka2dDeVFpWDJQS1ViSUNwbFI3R3hrSGNGdUNyc3FIb014c2tibXlKNU1qN3RCcGllZWtybHV5QUkzWkprSDhwb1g4cm9Qc2prWnNzMkwwT0pVM05GMFAzNnc5NTl3Lzc2SGNmLytSM0QvQWNkNjBnZmZPL0FJL0dWZEdoZVoyUGV3WW9Tc2tCbXlveGdpUzJTS2JKRXhza2JteUo1TVM3eFhaaVorSWxsdXlDSTNaSVVic3BvTlJlWnhJL3JGbGQrSTcreDZFUGZ0K1RIdTJmc2ozTFB2SDNIUGZzZDYwZ2QzSC9naDdqeVVacHVOUEpTR2I3LzVmZHkxL3dmNGJsZTBKUk43ZjZRWUlTdGtSa1ZCTWtTV3lCVFpJbU5ramN5UlBabVc5S1JrSmtKeWtpQkwzSkJWSHNnYUwyU2pGNUxuZ3hRbUliWDZGbnluK1FlNGEzY2E3dHlUaGp2M3B1SE9mWTcxaEEvdTJwZUdrZnNmd0oxN0g4QUQ5WThncmVZbmVLRDJFYVIxd3g2b2VSamZxM2tJRHpYOEhEL2E5Mzh3Y3YvM082OHZtZGlUcGhnaEsyU0c3Q2lHeUJLWklsdGtqS3lST2JJbjA1T3laSFlpWkg0aVpCbnZqUEpBWHZkQ05ubU5FRnJrd1ExMXQyUGtydS9oanViN2NNZnUrM0RIbnZ0d3gxN0hlc1lILzREYkR0eUZ4NnAraFp6Rk9jaGFsSVBzcGRuSVhzclh6bHZXa216a0xGdUExemV0UjkzT2V2ekgvdi9Dclh2djdMeStaSUpzTk4rSE8zZDlUekVqUlI2REliSkVwc2dXR1NOclpHNUd3anlSVnhJMnlweEV5TUpFeUhLM2NYc2VsMTV2OFVMeVBaQmlIMjZxL3dhK3VldTdHTDdyYmd4dnZodkRkOStONFhzYzZ3a2ZETjA3RW5mc3VoY0w4aGRqWjNrVER1dytnTVA3RHVIUXZvTmR0RU00K2ZaSmZQYkIzMUR3WGdsdTIzTVhidDE5WitmMUpSTmtZOWZkaWhVeVEzWVVRMlNKVFBIV1R6Skcxc2djMlpPWkNSVXlMeEd5S0FteUlnbXkyZ1BaNElGczlVSUtQQWd0VGNaWGQzd0R0Nzl4RjRidEdvbGh6U014YkxkalBlR0RvYnRINGl0N2grUFhWVStodVhZWExyeC9Iblp0NXorN2dCOGUvaWx1Zk9NMkROdDlaOWMwSmh1N1JpcFd5QXpaSVVPS0pUSkZ0c2dZV1NOelpFOW14dFZMRmdGTU5BRjBRemE0SVZzOWtBSTMrcFdtNEN2MVg4ZVFwbS9oYXp1L2lhKzk4VTE4YlpkalBlR0RHNXR2eFIwNzdzUDYwZzA0Yy9UMytQVFRUKzNpRHpOK1B3OERHd2RqOEs2Lzc3cStaR1BuTnhVclpJYnNrQ0hGRXBsYXpTS1hBQ1pDTVVmMlpHWmlrMlFsUUpZa0dvOXFXTU4xWFI1SW5nZFNhQUI0dy9aYmNYUGpOM0JUMDNEY3RITTRibnJEc1VENzRNdHYzSTVyM3hpQzU4cGV4cUhHTi9HblAvM0pOdmgyLzNrZmhqUi9HOWMyM2RJOWJjbEcwM0RGQ3BsUkFCYXlIK2d4bUNKYmZCd0lXU056WkU4eTQ1c2ttd0R5bVN4SmtMVkp4Z3BYTHEwaGdHWEp1Rzc3RUh5NThUWjhxZkZXZktucFZueHBwMk9COW9GMzExZHhWKzBES0NrdndiblQ1L0Mzdi8zTkZnQS8rZXdUL011Ukp4Ry80NGJ1NjBvMkdtOVZySkFac2tPRzFMVmhycG9tVzJTTXJKRTVzcWQrNUNSQWxpWkNjaldBYnVOU1NoRUI5Q0cxYmhDdTJ6RUUxemJjZ21zYmIxRm5DczhXeHdMamc1U21RVWhwSElTcEphL2cyTzZqK09pamoyeUJqeCt5N2crYjRXNzRNcEliYis2K25tU2o0UmJGQ3BraE8xSmtzclRKYlFCSXhzZ2FtVE1Bakd1U25IaklzZ1JJTHUvM1REUWlJSy9sRlNVaHROd0xUKzFOU0swZmhKUWROeU9sNFdha05Eb1dPQjhNUXYrbWEvRDl5b2RSWDFXUDk4KzlqOC93bVMwQW52dmtQZHl4OXg4UXZUMFZxWTJFdkp1NmtvMGROeXRXeUF6WklVUHF1akFqSU5raVkyU056R1hHTVFMR05jbDhFOERYRW8yYmp2bG1BbGhzQUpoVWV5Tzg5VGZCVS84VmVCb2NDNlFQWWh2L0RxbjFnN0dnZURGT0h6eUZpeGN2MmdJZlB5VGoxRlQwcS9Pb0NHamJtT3Evb2xnaE13ckFZZ3VBdktHZGpCRkFNbmRaQURjbkdaZFJpcE1RVXVaQlhPM2ZJYkgrUzBpb3Z3RUpEWTRGeWdmeERkY2p0TUdEeDhwK2liMTFlM0RoL0FYYjRHdjZVN05LNnhIYmsrM1Z0UDRHeFFxWklUc01ZdXFTSEptNlBJQnhrR1h4a05kNHQzc2laSE1pSkQ5Si9iR3J6STMrTmRjZ3R1NWFETmgrTFFiVU94WVlIMXlIMEFZM3JxOGVpblVscitQZG8yZncxMC8vYWd1QUxEeCtmUENmSVRVeGlLMi96bDVOdDErcldDRXpaTWNBTU1sZ1NnR1lZTEEyUDA1SHdOZ215ZEVBeGtQV0pVQTJKVUMySlVLS0V1RXFTMEprVlNxaWF3Y2lxbTRnb3JZNzVtOGZSRzhmaUlqdEtaRHRDWGl5K0dtODFYalkxcmJMcXZmV0lhdzJFV0YxWG5CZnRvNm5icUJpaGN5UUhUS2tXQ0pUWk9zMVR2ZmlvWmpMak9VY01MWkpTQ1AvWjI0N0FKWW1JcnpTaDRpYVpFVFVKaU9pempGLyt5QzhMaGxTSDROYktyNko0cklTdkdkajIrWE14Yk1Zc3VzT1NIV1VndHoyc1pDUm1tVEZqS3ZVQ0dLWEFFakd5SnFLZ0FyQUFVMHlQeGF5TEE2U0d3ZFpGdy9aRkEvWmxnQXBTb0NyTkFHaGxXNzBxL0dnWDYxSFRWbzVjWFhNZno0STJaNkFmclVKR0ZjMENTZjJITGUxN2ZMc2liR1FxbjRJcVhQN1IwTXlVdU5SekpBZE1xUllJbE5raTR5Uk5US1hPWUFSa0FBT2dDeUxOUUdNZzJ5S2cyeUxoeFRGUTByajRhcE1oS3M2Q2E3YUpManFIUE9yRDJxVElOdkRNTExzUHRSWDdiQzE3ZEx3eHliRTF3OVUwUy9FWHpxU0ViSlNtYWpZVVF5UkpUSzF6Z3h5WkkzTWRSUkFxVWlBVkNWQWFoSWd0WTc1MVFkMTBZaXA4aUtuYUFIZU9mZ09QcmFwN1hMeGJ4ZVI5dWJEa0FxQjFDYjZUMGN5UWxiSVRLa1p4SzRJWU00WFIwQUh3RUNkZFBHUXVsQ01LbjRNZSt2MjRvUHpIOWhTOWZKRFZweDdEU0hWRWFyeTllc0oxRkVBeVZ4TEJGUUFEb0RreGtMV3hab3BPQTVTRkFjcGpZTlV4RU9xNGlFMThaQmF4L3pqZ3dSSVhUaVNLMi9FbXBKMU9IdnNYZHZhTG1jdXZvdkJiOXdPcVhTWmtjK1BHcElSc2tKbXlBNFoybVpPNjhnV0dWczJBUEo1QUdNZ3VRTWc2d2FZQU1aQ2ltSWhwYkdRaWpoSVZSeWtKZzVTNjVqOVBpQVFBeUMxWVhpaTZEYzQwdlNXclcyWDlPTXZHcW0zSnRiLytwRVJza0pteUE0WjJtWUdOYkpGeHBiRldBSHMzeVE1TVpDbEpvQnJCMEEyeGtMeVlpR0ZzWkNTV0VoNUhLUXlEbEp0UXNpZE9HYXZEMnBETUtqc05yUHQ4cDV0cTExVTRWSG5nMVNGR3huTTM3cVJFYkpDWnNnT0dTSkxaSXBzRVVDeVJ1WXkrN01LZGdEczhaT3BOaHFoMWYweHRtZ0NUdXc1WVZ2YjVlSm5GNUYyNENGSXVkaDdzbndSeEYwRHNMOFpBV01nYTJNZ0d3ZEE4Z1pBQ2dlWUVUQVdVaGtMcVk2Rk1JdzdacThQYWdValNyK0xIVGEzWFZhY3kwVUlJMTkxbEwzSCswWDZreEd5VW01bVR6SkVsc2dVMmNvMXMyMU9mMnNFZEFEc3NaT3FOaHd4VlVuSUxscUEzOXZZZGxHRng4NWJ6YmtmcDB3QkNoeWRCekM2U1hLaUlVdjdRM0w3UTliMmgyeU1nZVRGUUFwaklDVURJT1VESUpVRElOVURJRFdPMmVlREdFaXRZRlR4bzlpNzNkNjJTL3J4Rjh6VTJ6K3dtcEVSc2tKbXlBNFpJa3RraW15Uk1iSkc1aktqT1FlTWFwS2NLTWpTYUVodXRBbGdmMGhlZjBoaGYwaEpES1E4QmxJWkE2bU9NZnBJTmM0clY1SjB6MWoxaGlDNTRucXo3WExXdHJaTHd4OGJFVi9uaFZTRm12QjE5MWc3OGZka2hLeVFHYkpEaHNqU1JqTzRrVEd5UnViSW5tUkdtZ0JHUVhLalRBQ2pJWG5Sa01Kb1NFbC9TSGwvU0dWL1NEWFBKc2U2N3dNS3lubVpDMDhVamNhUm5mYTFYVlRoc2YvSGx1Z1hZTDNJQ0ZraE0yU0hESkdsaldad0kyTkxvMHdBSTAwQXM2TWdTNklncTZJZ2E4dzNiNDJHRkVSRGl2dER5dnBES3ZwRHFrd0l1UlBIdXVlREdzR2cwcUVvTGl2R2U2ZnRhN3VzT0p1TGtNb3dvKzNTRXhxUkViSkNac2dPR1NKTEJKQnNrVEd5UnVZWS9OUVBCOER1d2RSWm9XdkNFVm9WZ2JGRjQyMXR1NmpDbzJtb0VmMDZlMHgydmI5ckFFWkNsa1NhRVRBS3NqRUtzalVLVWhBRktZNkdsRVZES3FJaFZkR1Fhc2U2N1lNYXdZaVM3MkJIdGIyclhkS1BQUThwRTBoMVpNL3BSRWJJQ3BraE8yU0lMSkdwTldhV0pXdlprZFlJU0FBakhBQURjWExWaENLbU1oN1pSZk50YmJ1b3dxUFdEYWx3OVJ4ODlGK0hBSXhvQzJDRUNXQWtaRTBrWkdNa1pHdWtHUUdqSUdWUmtJb29TRldVMGRSa1k5T3hMdmlBa1lsdGwwZHNiYnVvd21QZmo4em8xOFBha0JHeVFtYUt6U3hLbHNnVTJWcGxCcnZzQ0RNQ3pncHZrcXh3eU9JSXlNb0l5T29JeUlZSXlKWUlTSDRrcENnU1Vob0pLWStFVkVaQ3FoenJtZzhJaGlDNTdGcXNLVm1Mczhmc2E3dXNPTHNTSVJYOUlKWDllbDRmTWtKV3lBelpJVU5raVV5UkxUSkcxc2djMlZNL0hBQURJRnc0cEVyd1JPR1R0clpkemx3OGc4R05RNHpvRnd6Qm9mTUFocGtSTUJ5eU1oeXlPaHl5SWR5TWdCR1FvZ2hJYVFTa1BBSlNHUUdwY3F4TFBxaG0yMldJN1cyWDlLUFBtZkN4OVJJRTJwQVJza0pteUU2K21VM0pGTmtpWTR2RHpRZ1l4Z2pZSG9CaERvQjJpbGtkZ3RES01Jd3RIR2RyMjBVVkhqVkp4dlZlTzQrM081OTFXUUREdmdqQU1NamlNTWhLdmlrTXNvRUFoa1B5d3lGRjRaRFNjRWg1T0tTU2FjU3h6dmtnVE0zOVJoVGZaZXRxRjZQdytDR2tWQ0JWWnVNNUdMUWhJMlNGekpBZE1rU1d5QlRaSW1Oa0xTc01LdmpKckg1Tmt0VVBzcmdmWkdVL3lPcCtKb0Joa1B3d1NGRVlwRFFNVWg0R1VSMTJEdGF4RHZ1Z1doQlRFV3UwWFE3WmQ1T1JVWGlFUWlwRGdrc1BNa0pXeUF6WklVTmJ6S0JHdHNnWVdTTnpaTThCMEo4blV6K2o3Vkwwa0sxdEY2UHd1TVV5OS9QbkdEcjUyWjBHY0dab2syU0ZRQmFIUUZhRVFsYUhRdGFIUWphSFFyYUZRZ3BESVNXaGtMSlFTQVhQT01jNjdJTXFRWEpwS3RZVTI5dDJTVC82ckpGNkdmMkNUUTh5UWxiSUROa2hRMlNKVEpFdE1rYld5QnpaVXo4K0IyQUlaSE1JWkZzSXBEQUVVaElDS1F1QlZIREFqbDNaQnp4SlhaQkt3Uk1GdjhhUm5VZHN1OG1vNGY4MUlMNDZ3YmplcStBTE1qM0lDRmtoTTJTSERKR2w5U0VkQVpCdk10L3NBTmk5azYxS01LaGtzTkYyZWNlZTFTN3E1dks5UDRDVVNQZU96WjlCNUFzQlpKWTFzMjFyQkhRMVNaWUxzdGdGV2VHQ3JIWkIxcnNnbTEyUWJTNUlvUXRTNG9LVXVZenJqT3JNNXRuZFVhT3plSUhjWnF2aTUzYjBHQUw5UGtGb1JhanRiWmNWWjFjZ3BKeVpLSWpIem12UlpJWE1rQjB5UkpiSUZOa2lZMlNOek0xME1RVkxrMlFKWkxGQVZnaGt0VURXQzJTelFMWUpwRkNNTTQ2ckxOVEFUYUFJVlFjc3Fpb2E4V1h4Q0M4S1IwUnhKQ0pMb2hCVkVxVmUrZCtkTmY1dFZBbFhYTEQ5MExGajZNaHgydnFlS3NHSW9wRzJ0bDFVNGRFdzJKejdCZW00eVFOMUlTdU0wbVNIREpFbE1rVzJ5QmhaSTNOa3o2OEFWZ2l1cmIwV1M1cVdZRW5lRXJ5OC9HVTh2L2g1MDE3QTg0czdieThzZWdIakZvekhmYS9mWjBUVllJT3dTaEJURm9Qc3doejgzc2EyUy9yUjlPQ0hMeGdCREMwTHhiTUhud1hPUXoxc1o5K09mV2l1YmNidUxoci90cW1vQ1d2V3JjWE5SWU9NS05pRnlHeHJ4Tk9ad0R5T1VZV2piRzI3R0lWSHZCRlo5TDZDOWJYVEVmQVZhWko1QWxra2tGY0Y4anVCdk40bUJSZWJZWlUzT0hNSG5iRXlRWFJsTlBJdjVLc0g3ZkQ1N24vOTlGTjFBdzRmT2R0WjQ3Y0QvZkdQZjhTUk45N0d0SzNURWNXRmovck02OHh4K2VPOWxZTGtraFJiVjd1b0t4NTcweURVd0IvSGJQZG5raEdtWUI2dk5RV1RLYkpGeHNnYW1TTjc2b2MvQWVRQVN3VERHb2ZoN0NkbmJYdmEwL2svbkVkelZUTitzdTNSNEFHd3d2NjJ5NHAzVnlDRWJZMnVuUHgydzlXUnp3dEtBSGxReFlJeGI0MnhEVUJHempQSHppQ3ZNQStEbUlwN09ncFdDZ1lWRDBKeGVUSGVzNm50b2dxUEhZT05DWDFIeEErRzl3UWxnSFJNbVNDeUloSjVmOGl6RGNJUFAvb1F4NXFQWVZwZXo2ZmkwSEw3Mnk2cThPZ3RxVmZESDdRQThnQjFLcjVvWHlwKy93L3Z0NlppN1lRZWVCMVJOTUxXdG9zcVBQaWNQYTUyNllIeGRIbWZYUUp3cmtBV0NtUzVRRjRUeURxQmJCSklua0FLQkZJa2hpTTR1ZVFPdW1ORmZrekZoWU1Nc2JwemZGMzQyNWpTR0dRWDJkZDJVWVhIbmpURDcxMDRubTdwMDkzOWtSR2VOR1NHN0pBaHNrU215QllaSTJ0a3JxVUlDU1NBcFlMSWNqK2xZbGJGcFdhVHVydU83TVRmanlxd3QrMmlDbzlTWGxQdDVzbmVpVEhZQm0zUUEwaW5GQXVHTlF6RFdYK2s0cnhIQXhjRkt3VEp4U20ycm5aUmhVZjlZS09OMFJNQWRYZWZ2UUpBSHFTL1VuRkJIZ1lGTUJYYnZkb2wvZTEwSTMzMXh1aEhlSHNGZ0R6UUVrRmtXU1R5L3NjUFZiRk94ZG9oM1QyckwvUDNiUC9ZMlhacCtLQUI4Wlh4UnR2bE12dTBMVlg2Ni9NN0RlQjBhWkk1QWxsZ1RoQnpCYkpXSUJzRnNsVWcrWllGQ1p4Y2NnZDJXYUZnNkk2aC9rbkZXeDgxaWlXN2pyWE41NFNXaG1Kc2dYMDNHYW5DWTNlYWNmV2d6YjVzODNjZ1BwZU02SVVJWkljTWtTVXlSYlpZaEpBMU1rZjIxSStlQXBBSFd5Z1ljOWdQRFdxbTRvSkJmb053UktHOWJSZFZlSEFScDkwbmVTQ2dzKzZqVndISUF5OFdSSmI2TVJWejZSYlRqZFZKM2Z6dm1CSjdWN3Vvd21QNzROYTVYemVQejg2eGR2cXplaDJBZEhZdlM4VjJ0MTFVNGNFTDk3MDkrbEhMWGdrZ0Q3cVhwR0xWZHJIeDJTNnE4T0MzQ3VrVlI3MDUrdlZhQUhuZ3JJcDdRU3EycysyaTd2SG9DNFdIOWFUcGxSRlFENENwdU42UFZiSGVUeGRmMlY5VWo5UzFhYlhMaWpNckVGTE1POGpzbmFOMmV0N1dSWCswdTU4dUF6aGZJTXNFc2tvZ2F3U3lRU0JiekRYOXZLYkhGRUZIY1FmK01uNStnWityWWpxN0M4Y2ZXbUsyWGZiYTgwMUdaejQrZzhFc1BPamJMaHhQMFA0Tk5TUXJIQmZ2QnlGRFpJbE1rUzB5UnRZKzE0WUpCZ0FwUkpFZ3NzU1BWYkY2NUhEblJSOVJNTUxXUitxbUgwazNSUEwzU1Ixb3VIczlnSFJZUVFCU2NTZUVpU20ydCsyaUNvOXlmcGx6NTArRW9JMTgycDk5QWtBT0lvaFM4YWg4KzFhN3RGeng2R3VwdDA4QnlNSDRPUlZIRjBVYmM2OHJwTURrUW50WHU2akNveWpFbUNkcDBmclNhNmNqNERScGt0bm14SENwUUZhYUUwWjljem9YRlBLYUh0T0ZMa1M0azBCWXZtRG9kajlVeGRYTmVKVFhpcTgwaG1MQkUvbjJQZHRGWGZHb0cyejQ4MHI3N3EzL1RrYklDcGtoTy9xbWRCWWhaSXVNc2Q0Z2MyUlAvUWhXQURtWWZNR1lRMzY0VnN5Ym1iWU5hbzJDN1FqT2E4bDJ0bDFVNFVGaEFuMGl0ek8ySzU1OFhmMmJQZ1VnblZBb2lDejJUMVU4ZmV0MFhKS0tMVTRQTFFyRjJQeHhPR0ZUMjZXbDhOQ1BPckhzeTI4dzlNUSsraHlBZEdJUHBPSVIrZmF0ZGxHRlIzTmEzMDY5R3ZZK0NTQUh0VTB3NXFCL1V2RmduWXE1bnhKQlRLRzliUmRWZVBCWmVad2JhYUg2Nm11WEFNd1VTSTVBbGxpZWtNVkhLZkJ1Smk0bzFFL0owb1VJZHhKb0t4QkVGa1VpN3ozN1YxQlAzMkttWWtKUkxCaTF6YjYyaTdyaVVUdlk4R0dnZmRZVCt5TWorcEVjWkljTWtTWDlaQ3d5UnRiSVhFc1IwaHNBcERPM0NZYldEY1haaisyOHIvZzhkdkVSSDV0L29xS1RKOStMTlVWcmJQc21vL1MzMGczNGV2TGtEU1NJZlJwQURzNGZxZmo0dTlpd2JRTyt2UEhMK09ubW4rSlE0MkZiSHFtckNvK3llT09TV3lBaDZNbDk5V2tBNlZoL3BPSVBQOFRoL1llUlc1eUx3cG9pbkR2VC9VZnFxc0pqVjlyVmszbzE5SDBlUUE1VXAyS2I3aXYrN0xQUDhPYy8veG5uM3oyUEMvOXpBUjlmL0xqYno2OVJoVWVCV1hob2NhNkcxMDRET0ZXYVpKWkFzaTFGQ0ovanhrY3A4RzRtTHFmUmoramc1Skk3Q0FiYmFtOVZUT0krQTU5ZTJQMnRwZkNnMzRMQlY0RThCakxDNjl3Y085a2hRMlNKVFBIeHZDeEN5QnFaSTN2cVIyOEVNRjhRV1dodlZkeDk5SXhQU0QrY2JnZ1FUQ2Rzb0NDOGFnQ2tRL1BNcXRpbVZHd0hnS3J3S0kwM21zNkJFajJZOW5OVkFjakIraUVWZHhWRVZYaThrV1pFdjJDQ0lwREhjbFVCU01jR1VTcGU4ZnNWQ01ubk53UmRoU1gxNnUwQUFBbEVTVVJCVkhNL0RYbW5BWndpVFRMVC9ONEdmbjhESHlLdEg4L0J0ZnhjVHNNSkpWZHhjSExKSFFTYmJSVU1yYlczUWQzWktLZ0tqNXJCeHBXallQTlBJSStIakZpWFlwRWgvVmdPc3RYNkhTRVFzcWQrOUhZQU9lZ3RnakZ2Mm5ldHVMTUFxc0tEVlYrd25xU0JndkNxQkpETzNkWnpWYkVxUEVyaWphWnpvSVFPMXYxMEMwRDlYU0c5TFFWck1iWUlodGJZdTRMNlNwRlEzVnkrTTgzb2Vlbmp1SnBmcndRZ0dUTytwc3RNd1pQTU9TQy9LMFEvSjFyZkc4eGwrZFlWTVhvZXlKMEVvL0g0TmdjMkZhOTRad1ZDK0pXa3dlNmJRT2xGUDNEMWxGNEpRNGIwUGNINitkQmtqZE0rc3FkKzhKZStBQ0NkbkNlSXpBOU1nMW9WSHRXRGplZ1hLSUdEZlQ5WFBZQVVLRUNwT1AxUXV0RWxjS0pmYTBaMEFEVGJBSDVPeGFyd0tJNDNXbFRCSHBVQ2VYd09nSzBYdy8yVmlpOHBQQUlwYm0vWWx3T2dwVURhTEJoYWJYK0RXaFVlVzBPTXlYWnZnQ0tReDlnbEFGOHh2N21HVmJCK1FoYlg4SE10djNWSkZxc2I3cUMzR0k5M2syRE1BZnNhMUtyd3FCcmNPdmZyTGI0STFISFM1OWFsV1BwK0VQMWtyTlp2U2JKVXdYMFZRRHA5cXlCeVd5VHl6dGx6TTVNcVBOaWE2bTBub3dOZ0QwWk9tMUp4dzRVR3hCZkZHejJ1UUFuYTIvYmpSTUIyUUxjaEZhdkNveW5OU2IxWE9pRWNBTnNCa0U1akttYUR1b3VwK0pMQzQwb2lYTTMvM2lVQVo1aVBUTFUrSlpWRmlMNHZoRXV5OUEzcXZkbTVtd1JEcXpwZkZhdkNvOUlwUERwVWZCSkFza0ptOVAwZ1pFa1hJZnJ4dkdST1hZcWJLUFV5M1FLZ2ZrUWJieUxoT2k2dTUrS2tXOStjeEIzMFZtTjF0bEV3Wm4vbnF1TDBnK21HTS9uM3ZYWHNnVHB1WFFHVEdiMFdrQ3haSDgxbVBCOGFRdlpra2xSY0FpRHZXdUtiK3lLQUZHR0xJREt2NDZsWUZSNkY4Y1lKR0NnUmUvTit2Z2hBc3FVaklJTWUyWk9Kc3ZGekFQTDJ1YjRLSU1YVnFmZ0tOek8xRkI1TUpiMFppa0FlKytVQTFMZGtXZ0VrZXpKUjVzazA4NG1WMWdjVThldlZtWUwxa2l5bVlEMFBET1NBL0xFdk9xa0RxVmdWSGx0QytzNjQvZUhMdHA5SlJzZ0tVekRaSVVOa1NRTkl4b3lub3pJRlo0bU1seWRscXZtMEl0NHd6QVdEWExmRlJhbGN4Nld2aG5CU3FlZUJGTEMzMjJaQjVOWkk1SjF0djBHdENvK0t3YTF6djk0KzNrQWRQeG5SQlFqWklVUDZhMXJKRmhuanc3RElITm1UOFhLdlRKVlAxSjNxWEttcUFXVFZZcjBjMTljQXBDQWJCVU1yMjYrS1ZlSEJTVFRQNkVDSjF4ZjIweFpBWFFFenFPblYwTVpURVQ1UjdNbDR1VUdteXFtV08rT3NxNkoxSzhaYUNmY2xRVGlXRFlMUiswZGZzdksrNFh3RDRndmlqVE81TDBBUnFERlkweStaWVJ2UENpRFowc3Z4eVJ6Wmt3VVNKcE9rV0hnOVdLK0t0aTVJNEllMG5RY0dha0NCMkkrWmlyZWUzYW9nVklWSFk1clJRZ2pFL3Z2U1Bxd0FraGtyZ0dTS0FKSXhza2JtTWlSYzFEWkp4Z3NiZzNQTnIxTnYyd3ZzeXdBU2dJMkNZWlhEOE1FbkgyRDltZlVJMld3V0huMEpqa0NNcFMyQUxFQ3NQY0FGSm1OR0UzcThBUjkvVHBaN1picjh0ZVg3UW5qek1Lc1dheVhNVmdUbmdkeEpJQVlUeUgxd1RKc0ZqKzE2REYrdi9ycFJ3UVZ5LzMxbFg2WWZlVUovcmdJbVUyekJzQUltYTJTdVpac3NDVEpWbWk5YmlEQ1V0cDBIOWtVUSsyS2hGUWk0eVFKTnQxL2FtLzlkV29BMEM1bTdaSnNrRTFWdVpob21xZXhhdDQyQy9HQXRFbmVtZDl4WFh2dmltQUtoRGYxR0l4dGtwTDMrSDVraVc4YjhiK0lsN0tsZkpzcHRNazB1cUJESlpxSDFPVEc2SDhnUDE2bllFYXZ2bllCZGhWWERSemJJaUxYL3A1OEgwOXFBdmlCazdYTmJob1RJVkZuVmtvWlpzYkJ5c1Y0WEp0bDlQUXAyVllTcjllOHVGLzEwOGFHclg3WmZqUDdmS2lGcjdXNVRaS1RNa0kvVXQxbTNUY09NZ25vdTZFUkJKL3JwRTY1dDlDTWpaTVY2K1kwc2NRVU0yU0pqbDkxSTVqUjV0ZDBvcUN0aWhsZEdRVjdyWTg3WGMwSjlRTTdyMVFHbkJvLzY2NlZYWkVOZisyWG1iQnY5eU5abG81K21jb29Na1JseVRoR3I1NEs4aktJdnpla0ZDb3lDT2hKYVFkUWgyWGsxSnVaOTBROWFiNzVxRG5UaFliM3l3VHFDREJuUjc1eVFyUTV0VXlWZFJVRjJyZGs4MUkxcFJrR2RpcmxEN3J4dEpPeUxEbmZHZE9uSnBBR2s5bVNBTEZoVHIxNThTbmJJa0RIM1MrOFFlK3BOR1JJajA2UzRwU0ptRDZkdFFhSlRzUVBocGVMMGRWamJ3cWVyWHV0VkQ3SkNabG9yWDE1MmkrazRnSHpuRkJrcU0rVzA2dDF3RXNsd3FsT3hYcXhxTFVxY1NOajNRV3dQUGpLZzRlTTBqWXpvcXg3cys1RWhzdFNsYlpvOEpKbnlGN1dDUWFkaS9ReHA1bnJ1dUMyRURvaDlEMFFyZURydE12SnArTWdDMS95UkRVN1h5QXJiTG1TSERIVnJteTdQcUZUTWhZVHNEWElIdkVMQ0hXb0lyZW5ZU2NsOUMwQXJmTlNXWmsyN0dqNHlRVGJJQ0ZuaE5kOVg1T2x1c2RmeXh6TmtiSWNnMUkxcURhRVREWHN2akZid3JGR1BHdXQyeXhmQlIyWnMzZHFEa0NHWGVaOXpRbGJIVE1rOHVQWkF0TUxJd1hHeXJnZnB2UGFzTDlwcVFhMjA2WWhuQlk5YVUzTnFyOU91TmZMWkRwOG1lYVpLeHgrMnpBbTVZSUdUVHBiZGJOSHdvSFJhNXZ5QUI2MWhaTmpXa1ZHLzZrRTZyNjJDOTVRdnRDWWFPT3FsOWJQTzlhZ3h0YWJtMUo0TTZEbmZiUGxReUloZnQ1bnlFNWt0eDFzZ1pNWERzcHR6QUo0UkdrUWRFWG53T2lwYVlkUkFjc0NPOWF3UHFJVTJEUjAxMCtEcGlFZHRxVEcxcHViVXZoVys0MEkyQXJLOUlyZEtwaFNxSmlON1BlejVjQUxLTTZJdGlJeUlWaGcxa0ZZbzlhQ2QxOWFvRTBoZlVBc05uQlU2YXFjam5nYVBHbE5yM2Vkam81a3NrSW1BYmxObGdHVEtzekpYM2xGVkQ4OEVuaEZ0UVdTMXJLT2locEZBYWlnNWI5VHRIQTdlc2NENFFQdWRyMW9QdmxxaG8zWnR3ZE5SajVVdXRTY0RaS0hIdGxseW04eVc1VEpYUGxTZGIwNUdOWWdNMDV5a01pcHl6c0FCV1lIazJhV05BM2NzY0Q3UWZ0ZXZEQkphSDJwRnphZ2ROV1JRb2FiVWxobVBXbE56YWg4MDIyeTVXK2JJS3Brbjc3ZEVSSVpwVGxJNUFBMmpGVWdPbEdkWVc5T09jRjVib2JEREYyMzl6TitwZ1JVNEszVFVqaG95dXpIaVVWdHFUSzJEZHN1VTRUSkh4c3NjYVpScytWaWRNUnlBam93OGs2eFFjazdSMXVnRXgrejNRVnMvODNjZDRhZ0p0ZEdSanBveDJsRkRha2xOcVcydjJXWkp2TXlSZTlXQno1TUNtU2NuSlV2K29nYkZhOHNjb0RiQ2FUV2VkWTdaN3dPcmovbmYydjk4cFNZRUxrcytWbHBSTXlPUTNDdlVzbGR2dkFGNXJ0d2djK1FlbVNPalpZNWt5eHpaSkhPbFV1YkpEc21TblpJbFRZNEYxQWM3bGUrcEFiVXdOS0UyOXlxdFdtNGE5eTk1L3grWUZUOXdkMGVoOFFBQUFBQkpSVTVFcmtKZ2dnPT1cIi8+XG48L2RlZnM+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfUkFXID0gYDxzdmcgZmlsbD1cIm5vbmVcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiB3aWR0aD1cIjE2MFwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbiAgPHBhdHRlcm4gaWQ9XCJhXCIgaGVpZ2h0PVwiMVwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiPlxuICAgIDxpbWFnZSBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHRyYW5zZm9ybT1cInNjYWxlKC4wMDYyNSlcIiB3aWR0aD1cIjE2MFwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFNOVVsRVFWUjRBZTNkUzQvYjFoVUg4RE5Bb29YYmpXVWdnRmNCc2tsV1FXYlZJa0JpTFFJajQ4a2dDSkJ2VWZmaDFndWpYZFFweHVPK1AwSzc2QmNvOGkyNlNHcDMwWGViQUVWckozWWN2OGIyekRpK3haL0RQMDNSUTVHVTdpWFBrYzRBeEIxUkZIbnZPVDllWGxJU0paTHdiMzlqNDV0ZnZmZmVoVENaUEpkd003N3FCQkZBenBBNzVEREI2dE92TXB3Ky9jcFhHeHRYSDU4NUV3N2VmdnR5K2kzNkZtSkdBRGxEN3BCRDVETG11cE92YXcvNE5qYy9PbmoxMVhCdzhtUjQvTVliNFdCejgxTHlEZnNHb2tRQXVjcHlkdkprUUE2UlMrUTB5c3BUcndRVlBRQys5Zld3UHhxRmZaR3dmK0pFT0poTUhHSHE0RWRZUC9BaFY4aFpscnZSS0NDWHlLbDZoR1Y4QjhRSGdDTGhZRHgyaEJHQXBGd0Y4U0ZYR1Q3bXpnTENXZmpZR0VlWWtzOWk2NjdEVitST004STIrSXFHZUUrNG1KUUVyMjdDVitST0kwTGkyeStQK2ZLdW14Vi9wblNFQ1JqTnQwcmkyNjhjZHAvSkdYT0tvWldXTVdFWjM5NW9GUFpFV2s5b3NKK1l6SWNtMXF2SytMcmtEcmtlSE9FaStJckdPc0pZbGpxdmgvajJ4dVBXblVhUk4zUTBReUtNZ28rOXBTUHNqR2ZSRnl5TWo3a2JBbUZVZkd5SUkxelVWT3ZYUjhQSDNQV0pNQW0rdkNFK0pteHRhTzRGaVEreG5qcWNFdE84WlI4SXEvZ2V6VnZabXRkbDYvT2VjRzVjVFM4a1BvejVrdVF1SlVMZzI4ZGJNZXZyNGRGb2xEVUFqVWd4SVVEN2swblk4L2VPbTB5MWZoNnh6R0thNDB1UnQyeWR1QktDeTNFeDM3YnJFMThSR0VmWUdsZlRnc1QzS0RVK2RrZ3hFUTZDancxeGhFMjJHcC92SFI5ekZ3TWg4ZUdDWStyRGJ0SHpzUUY1NllmalJtTzFDeEFmeDN4MU1VNDJQeDhUem5VNEpyNCt4bnlOQWZDZXNCWlozUlBFMTl0aHQ5SnhGRG1kcHljRXZyMzhoT1BoYUJRZWlndytJWkI3Zm1KUzUyMXFQdkFoVm9pWmh0ekJFRHF5ekZUVGgxcUo3OUg2ZXRDQ2owRjBoRlBPam55Z0RoODdMMXc1YVVLb0daOGpQTkxiMUV5MStOb2czTnZheWc2N0ducys0bVBwUGVHVXUreUJlbnhISWR6YU92eU9TWGp6emRmRG1UTlhucnoybXJyREx0RlZTMGY0RktFWmZDV0VzQVp6c0NjZkhqLyt3dzlQbkFpZlBQOThDUGxDRDdpdzVoSVhWbGY4eEFUNEVJT0hXazQ0Wm5paEtSaUROWmlEUGJrbzh2WHZpbHordFVqNFZHUUtJVjZrZVVMZ3N3U3M0TnQyRDB2NE5PZUlkY05SRFBoZ0ROWmdEdmJZbDYrZEY5bHhoQXlIN3RJNlBsZ1RrYlZxbEIxaE5TSUtIeThyUG9hNlFQaUpINDRaRXpXbFZYeXdoS05yWGM5WERmQVV3aWY1T0hCWCtYZ3dHMnRnTUk1QitSS09DZEVtdE8zQmVLeDZYSTQ4MEFyc2RNVkhqQm5DWDRtRWY0dUVNa0tzWFBPRUJDMGJ3akkremJGbjNZQVFabUFIaHRyMmZNVEgwaEV5RWdPV3E0cVBJVGVOMFBvbEd1QkRHOUNyczNmUlhNYnErWWlQWmUyWVVITXdzcm9aUGh5ejU5czFobS9lTVIreDFaVlRQZUZYK1Rqd3ZralFQaUdCMXNhRVpYemE0NHY2WVdlSGlVWEhmSFg0T0gvdCt5STdQREd4aHZDQmtiTmo0RU5kc2VOWXhBY2pSMTFrSnFKRlMwZTRhQVJudk43eHpRaE82U25UQ0xVZWpxMGZkbFAzZkNWLzJiOEZ3bi9seDMrTUF5d2NNdTdqUXE2eXd6RjdQdFROUWd3NTVrUHVNU1RyR3g4eFRpRjhuQU84SnhLMFQwUzRxK0FkRTlRQk93VHFwRDF1cUI5MkVPUjZhSHhUQ0g4cEV2NlpWd3dWTkJGSVhON0FZSDlBaE5nMjZtQU5IM0tObkEvVjh4RWZ5K0lTRGZZS2F6M2hVQWl0NG1QUE4rL2JhMFFUdXpTTk1MdnMwV05QYVAyd3F3MGZNV2NJTFI2TzcrVW5KbjBjam9rUDJ6UXhWTW1QYWp6c2FzVlhJTVM0Z0FnUDh2SGdYWkdnZmVvRFlSbWY5bmlnZnRoQmtFUGkwekxtSTdhNk1qczcvb1ZJK0VmZUFEVEVSTUFUOW9SVzhTR0h5S1VWZkVTWklmU2U4REFjVnZGWjYvbUlqNlVqRkpIZHpjMXRuT1RnRUcvaUtHRDBzRXQwMWRJMHdrVXYwUUFmMW1FTkh3NjdtcTd6VlZGMWZWd2dSTVB3Q3p6b0NlNFltTzR1Y0xHYStMQU9FMjNOYzJOMXpOZUVNa1BJRTVObFIyZ1YzOStObm5BMDRlUHpLNEhROFRIZE9zdWxSbWdWMzdJZWR1dDJBZE1JNzlkOGdBSDQ4SnlQK2VyU3JtdCtnUkRqRHZ4cUR3YnF0dzFNZC9DWlBaelpsdDQ3dnJleGtlSERjeWJha01kODJjZDhUZVF6aEQ4WENSWVIzanQxS3V5Ky8vNlBNZUYvaS9nUWUydnZjRFNoNnZxOGFZUzc3N3dUTURtK3Jtblh0YnhkaE1lT2hUdkhqcGs3N0hyUDkrd09VQ0Q4bTdFeG9hVXhIMkxyK0o3Rnh6bFRDUEZqSjBqdWx6NHRGQVBFRUxGMGZHUTJ1M1NFRVhjNHh6Y2JXOTJ6ampBQ1FzZFh4NnZkZkVlNEFFTEgxdzVaMDFJRndyL200eGdFMXNlRXMyTkFmSWlabjNBMEVXdCtmdTE3SWpzL0V3a0lLRzcxRDRDM2ZEb3lCb2dOWW9SWUlXYUlYY29iQlRXbmJ6bVdjSVF0ZGpqSGx4YTdJNXlCMFBHbHhjZTFPOElqRURvKzh1aW5kSVFsaEk2dkgzVFZyUlFJLzVML2RnbE9TcjVZc1FsdHhrM0JFUU0vNGFnU1NmOTRwUkU2dnZUQTJteGhKUkU2dmpZMCtsdG1wUkE2dnY1Z2RkblNTaUIwZkYxSTlMOXNnZkRQK2U5VzRLVGs1aEtjbUxBTnVDOHoydlpUZjRlamYxMHR0NWdoUklLcUNKRkVxeE4ySk1mWFVvQ0N4WllLb2VOVElHcU9La3doeEUzVGVUaTIxQXVpenFpN0gzYm5FS0RnSld2ZkV0bjVRQ1Q4TWYvT3NTVjhxQ3UrSjQyNm93MW9pMytxUllHcXJsVzRPQnI5NVBjaVQ1QlFTNzBnNjRxNm93MWQyKzNMSzRuQXRWT25QcmorNG90UFBoY0pONHhOcURQcWpqWW9DYWRYbzBzRWRyZTJ0bmZmZWl2Y2Z1RUZjL2k0czZEdWFNUHV1KzllNnRKMlgzYmdDTnplM056K2NqSUpOOGRqcy9pSUVHMUFXMjZYN2tVemNIaDk4N01pc0V6NEhPR3NUQ3Q4RHZodUwwblBSM3dzMFJPaWJkNFRLb1NIS3BWN1Bvc25IWVJXVjZKTmZqaFdqdS9HZUJ5UXFHV2UwRVlmRXlxQ3lKNXZGZkJ4eDNLRVNnQ3VJajVIcUFnZkJ1V3IxUE1SSDB1MDNVOU1CZ0RKbmcrRGNpWmpWVXMvTWVrWklQRGRta3pDNStOeCtFekVKNXgwamNjQk1mRkxOSWt4T3I3NkhjNFJPcjdCZTJOSG1BaWg5M3oxUFY5MUdPSUlJeU4wZk8zeEVhTWpqSVRROFhYSDV3Z2o0YnUxdWJuOVJYNjJleDBmenZTcGN3elFFeUtHdC95alhOMVVFdDluNDNIbm9EdlU2WjBWTVhTRUhmdzV2bWxBTVhZb1I5Z1NvT09MajQrQUhXRURRb3Y0K0ZWUEpsbDc2UWhyRUZyRGh6Tk5mSFh5MDN6Qy81aW5IU0RxNXdnckNDM2l3Mjl4WE0zdlRJcTdrK0ovekhPRWxlUnFmMWpHZDAwa2FKL1Fnd0RhbjBUQ2prZzRLM0lSRS83SFBEeUhaYlMzQS9WYitaN1FLajcwZHBkRXduY09iNWVSN2VQNEgvUFlFeHBFdUsyOXM0cGFQOHY0ME52bCtOWktRVm5EUER6bkNFdFIwZmp2RXVKam1CMGhJNkcxWEdKOERMa2paQ1MwbFN1QWp5RjNoSXlFbG5LRjhESGtqcENSR0xxMGlBOC9nVlU1MnkyZmNMUU5hWWFRWjhkWXA1OGR0dzFkcE9XSTc5cDRIUDRub243QzlUSGkyejY4enJmb25Vblh6b3JzWUYwQWpYVmpHeVppOGZSVE5EWXYwUURmemNra1hEZUc3NHBJaUlTUHUzR0JFT3UyaEJDNVF3NlJTemJHUkdrWkh3Nlo2TFVpMzVNNVE0aDFPOExFaEIxZmJZQWRZVzFvSWozaCtCb0Q2UWdiUXpUbkFvNnZkZUFjWWV0UXRWelE4YlVNMU5QRkhPSFRXQ3oybitPYk8zNk9jTzdRNVMrMGlBOC9lNG96MFVSbnUxMURPb1VRZGJOeW5YRHdTelEzOCt0OHVNajhYeEgxRXk3K0tzTkhyTThnUkYwdHhCUzV4M1ZDV0dCamVpbXh3UnVUU2JDRUQ5L2J3Ryt2UmI3SUhDdmVHVUxVRFhWRVhTMGhoSVhlRUZyRXg1NVBLVDRpTGhCaWlJQTZPMEtHSmk4ZFh5VWc4Ujg2d3JxWU9yNjZ5RVNmN3dpcklYVjgxWWdrZit3SUdXTEh4MGowWGpwQ3g5Yzd1dW9HVnhlaDQ2dGFHT3p4NmlGMGZJTmhxOXZ3NmlCMGZIVUdCcCsvL0FnZDMrREltaXF3dkFnZFgxUHUxVHkvWEFqRDZkTmYyOTNhdW9TZmVyTDAzcTZSdDlkU3FUV05FTlpnRHZiazQ1ZGV1dkR4eXkrSC94dy9udDNmVHZ1bk1NcWZhbEgrM200cWZGeXZTWVM0aHlLc3dSenN5WTlFWGo4bmN1VzNlRUlrNENmanRTSjBmTFJYbEtZUXdoYU13UnJNd1Y3V2tyTWlyM3hiNUtQZktFYm8rQXAwMVg5TUlDUStHSU0xbUp0cXlBOFVJM1I4VTZrNjZvRnFoRlY4c0haVUkwUWpRc2QzWktxT21xa1NZV3Q4YkpFbWhJNlBXV2xkcWtMWUdSK2JxUUdoNDJNMk9wY3FFTTZOajgwZEVxSGpZeGJtTGdkRnVEQStObnNJaEk2UDBWKzRIQVJoTkh4c2ZwOElIUitqSHEzc0ZXRjBmQXhESHdnZEg2TWR2ZXdGWVRKOERFZEtoSTZQVVU1V0prV1lIQi9Ea2dLaDQyTjBrNWRKRVBhR2orR0ppZER4TWFxOWxWRVI5bzZQWVlxQjBQRXhtcjJYVVJBT2hvL2hXZ1NoNDJNVUJ5c1hRamc0UG9adEhvU09qOUVidkp3TG9ScDhERjhYaEk2UFVWTlRka0tvRGgvRDJBYWg0Mk8wMUpXdEVLckZ4M0RPUXVqNEdDVzE1VXlFNnZFeHJIVUlWL3dMUkF5UDluSUtJVzZTaWE5bW1NSEg2RllSM3RWOVoxSlcyOHZEQ0JRSWNhZFc1QTdmNGVESDZKRmJFNEVpd3QrSmhEK0loTXRwZnY3S1JDd01WakpEaUp3aGQ4Z2h2c05oQmg4RGpncWZGN2w2NGZBYlVKY2ovL1lhTitObG1naXNuUk81ak53aGgrYndNU2JuUmI1eFR1VENSWkhuT005TEd4RkF6cEE3NURCbGpmOFBOaFdRRDhOeGx0Z0FBQUFBU1VWT1JLNUNZSUk9XCIvPlxuICA8L3BhdHRlcm4+XG4gIDxwYXRoIGQ9XCJtMCAwaDE2MHYxNjBoLTE2MHpcIiBmaWxsPVwidXJsKCNhKVwiLz5cbjwvc3ZnPmA7XG5cbi8vIERhdGEgVVJMc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRE9XTkxPQURfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIFNVQ0NFU1NfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBFUlJPUl9JQ09OX1NWR19SQVcsXG4pfWA7XG5cbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBzdHJva2U9XCIjZmZmZmZmXCI+PGcgaWQ9XCJTVkdSZXBvX2JnQ2FycmllclwiIHN0cm9rZS13aWR0aD1cIjBcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX3RyYWNlckNhcnJpZXJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX2ljb25DYXJyaWVyXCI+PHBhdGggZD1cIk0xMC45NjggMTguNzY5QzE1LjQ5NSAxOC4xMDcgMTkgMTQuNDM0IDE5IDkuOTM4YTguNDkgOC40OSAwIDAgMC0uMjE2LTEuOTEyQzIwLjcxOCA5LjE3OCAyMiAxMS4xODggMjIgMTMuNDc1YTYuMSA2LjEgMCAwIDEtMS4xMTMgMy41MDZjLjA2Ljk0OS4zOTYgMS43ODEgMS4wMSAyLjQ5N2EuNDMuNDMgMCAwIDEtLjM2LjcxYy0xLjM2Ny0uMTExLTIuNDg1LS40MjYtMy4zNTQtLjk0NUE3LjQzNCA3LjQzNCAwIDAgMSAxNSAxOS45NWE3LjM2IDcuMzYgMCAwIDEtNC4wMzItMS4xODF6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PHBhdGggZD1cIk03LjYyNSAxNi42NTdjLjYuMTQyIDEuMjI4LjIxOCAxLjg3NS4yMTggNC4xNDIgMCA3LjUtMy4xMDYgNy41LTYuOTM4QzE3IDYuMTA3IDEzLjY0MiAzIDkuNSAzIDUuMzU4IDMgMiA2LjEwNiAyIDkuOTM4YzAgMS45NDYuODY2IDMuNzA1IDIuMjYyIDQuOTY1YTQuNDA2IDQuNDA2IDAgMCAxLTEuMDQ1IDIuMjkuNDYuNDYgMCAwIDAgLjM4Ni43NmMxLjctLjEzOCAzLjA0MS0uNTcgNC4wMjItMS4yOTZ6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PC9nPjwvc3ZnPmA7XG5cbi8vIDIuIEVkaXRlZDogQSBtaW5pbWFsIHBlbmNpbFxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9TVkdfUkFXID0gYDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPiA8cGF0aCBkPVwiTTEyIDMuOTk5OTdINkM0Ljg5NTQzIDMuOTk5OTcgNCA0Ljg5NTQgNCA1Ljk5OTk3VjE4QzQgMTkuMTA0NSA0Ljg5NTQzIDIwIDYgMjBIMThDMTkuMTA0NiAyMCAyMCAxOS4xMDQ1IDIwIDE4VjEyTTE4LjQxNDIgOC40MTQxN0wxOS41IDcuMzI4NDJDMjAuMjgxIDYuNTQ3MzcgMjAuMjgxIDUuMjgxMDQgMTkuNSA0LjVDMTguNzE4OSAzLjcxODk1IDE3LjQ1MjYgMy43MTg5NSAxNi42NzE1IDQuNTAwMDFMMTUuNTg1OCA1LjU4NTc1TTE4LjQxNDIgOC40MTQxN0wxMi4zNzc5IDE0LjQ1MDVDMTIuMDk4NyAxNC43Mjk3IDExLjc0MzEgMTQuOTIwMSAxMS4zNTYgMTQuOTk3NUw4LjQxNDIyIDE1LjU4NThMOS4wMDI1NyAxMi42NDQxQzkuMDgwMDEgMTIuMjU2OSA5LjI3MDMyIDExLjkwMTMgOS41NDk1MSAxMS42MjIxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTUuNTg1OCA1LjU4NTc1XCIgc3Ryb2tlPVwiI2ZmZmZmZlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L3BhdGg+IDwvZz48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRURJVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRURJVF9JQ09OX1NWR19SQVdcbil9YDtcbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBDT01NRU5UX0lDT05fU1ZHX1JBV1xuKX1gOyIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50c1xuXG5pbXBvcnQgeyBET1dOTE9BRF9JQ09OX1NWR19VUkwgfSBmcm9tICcuL2ljb25zJztcblxuY29uc3QgU1RZTEVfSUQgPSAnY3FkLXN0eWxlJztcbmNvbnN0IFNQSU5ORVJfU0laRV9QWCA9IDE2O1xuXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG5cbiAgICAgIC8qIFNwaW5uZXIgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICNmZmZmZmY7XG5cbiAgICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICAgKiBDT0xPUiBQQUxFVFRFIChMaWdodClcbiAgICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgICAtLWNxZC1jb2xvci1ub3JtYWw6ICMwMDVERDc7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsOiAwIDhweCAyMnB4IHJnYmEoMCwgOTMsIDIxNSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCA5MywgMjE1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3Itc3VjY2VzczogIzAwQTgyRDtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzOiAwIDEycHggMjhweCByZ2JhKDAsIDE2OCwgNDUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDAsIDE2OCwgNDUsIDAuNzApO1xuXG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI0ZGNDAzNjtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRUM2MzAwO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNzApO1xuXG4gICAgICAtLWNxZC1jb2xvci1jb21tZW50OiAjOUIwMEZGO1xuICAgICAgLS1jcWQtY29sb3ItZWRpdGVkOiAjMDA3RjhEO1xuXG4gICAgICAtLWNxZC1zaGFkb3ctYmFzZTogMCAwcHggMTBweCByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc2hhZG93LWhvdmVyOiAwIDEwcHggMjRweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogREFSSyBNT0RFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLXRoZW1lLWRhcmsge1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA2RUZGO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDExMCwgMjU1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDAsIDExMCwgMjU1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3Itc3VjY2VzczogIzA3REEzRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzOiAwIDEycHggMjhweCByZ2JhKDcsIDIxOCwgNjMsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDcsIDIxOCwgNjMsIDAuNzApO1xuXG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI0ZGNDAzNjtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRkY5MTQyO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDE0NSwgNjYsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwRDZFRTtcblxuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7XG4gICAgICAtLWNxZC1zcGlubmVyLXRvcDogIzBmMTcyYTtcbiAgICB9XG5cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0ge1xuICAgICAgb3ZlcmZsb3c6IHZpc2libGUgIWltcG9ydGFudDtcbiAgICAgIGNvbnRhaW46IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIHotaW5kZXg6IDE7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDEuIERPV05MT0FEIEJVVFRPTiAoU2luZ2xlKVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0biB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDUwJTtcbiAgICAgIHJpZ2h0OiA4cHg7XG4gICAgICB6LWluZGV4OiA1O1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBoZWlnaHQ6IDQwcHg7XG4gICAgICB3aWR0aDogNDBweDtcbiAgICAgIG1heC13aWR0aDogY2FsYygxMDAlIC0gMTZweCk7XG4gICAgICBwYWRkaW5nOiAwO1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLW5vcm1hbCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctYmFzZSk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdpbGwtY2hhbmdlOiB0cmFuc2Zvcm0sIGJveC1zaGFkb3csIHdpZHRoLCBib3JkZXItcmFkaXVzLCBwYWRkaW5nLWlubGluZTtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgcGFkZGluZy1pbmxpbmUgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3JkZXItcmFkaXVzIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHRyYW5zZm9ybSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJhY2tncm91bmQtY29sb3IgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOm5vdCguY3FkLWxvYWRpbmcpOm5vdCguY3FkLXRyeWluZyk6bm90KC5jcWQtc3VjY2Vzcyk6bm90KC5jcWQtZXJyb3IpOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAxMjBweDtcbiAgICAgIHBhZGRpbmctaW5saW5lOiAxMnB4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOmZvY3VzLXZpc2libGUge1xuICAgICAgb3V0bGluZTogMnB4IHNvbGlkICNmZmZmZmY7XG4gICAgICBvdXRsaW5lLW9mZnNldDogMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOmFjdGl2ZSB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1pY29uLXdyYXBwZXIge1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWljb24ge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDI0cHggMjRweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgdHJhbnNmb3JtLW9yaWdpbjogY2VudGVyO1xuICAgICAgdHJhbnNpdGlvbjogd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1zbWFsbCB7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMTZweCAxNnB4O1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1tZWRpdW0ge1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDI0cHggMjRweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbGFyZ2Uge1xuICAgICAgd2lkdGg6IDMycHg7XG4gICAgICBoZWlnaHQ6IDMycHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDMycHggMzJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXJnaW4tbGVmdDogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgbWF4LXdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgbWFyZ2luLWxlZnQgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOm5vdCguY3FkLWxvYWRpbmcpOm5vdCguY3FkLXRyeWluZyk6bm90KC5jcWQtc3VjY2Vzcyk6bm90KC5jcWQtZXJyb3IpOmhvdmVyIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogNHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHBhZGRpbmctaW5saW5lOiAxMnB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctbm9ybWFsKTtcbiAgICAgIHdpZHRoOiAxNTBweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nIHtcbiAgICAgIHdpZHRoOiAxMTBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci10cnlpbmcpO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXRyeWluZy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nIC5jcWQtbGFiZWwsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDEycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3Mge1xuICAgICAgd2lkdGg6IDE0MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXN1Y2Nlc3MpO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2Vzczpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDhweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgd2lkdGg6IDkwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZXJyb3IpO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvcik7XG4gICAgICBoZWlnaHQ6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IDE1MHB4O1xuICAgICAgbWF4LWhlaWdodDogNDBweDtcbiAgICAgIHBhZGRpbmctdG9wOiAwO1xuICAgICAgcGFkZGluZy1ib3R0b206IDA7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgdHJhbnNpdGlvbjogYWxsIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICBsaW5lLWhlaWdodDogMS4zO1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vcm1hbDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSg0cHgpO1xuICAgICAgdHJhbnNpdGlvbjogYWxsIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIge1xuICAgICAgd2lkdGg6IDM1MHB4O1xuICAgICAgbWF4LXdpZHRoOiAzNjBweDtcbiAgICAgIGhlaWdodDogNjBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDYxcHg7XG4gICAgICBwYWRkaW5nOiA4cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxOHB4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogN3B4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBtYXJnaW46IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIC5jcWQtZXJyb3ItZGV0YWlsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiA2MHB4O1xuICAgICAgbWFyZ2luLXRvcDogNHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgIH1cblxuICAgIC5jcWQtc3Bpbm5lciB7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgd2lkdGg6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgaGVpZ2h0OiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGJvcmRlcjogM3B4IHNvbGlkIHZhcigtLWNxZC1zcGlubmVyLWJvcmRlcik7XG4gICAgICBib3JkZXItdG9wLWNvbG9yOiB2YXIoLS1jcWQtc3Bpbm5lci10b3ApO1xuICAgICAgYW5pbWF0aW9uOiBjcWQtc3BpbiAwLjY1cyBsaW5lYXIgaW5maW5pdGU7XG4gICAgfVxuXG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7XG4gICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgIHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMzYwZGVnKTsgfVxuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAyLiBDT01NRU5UUyAmIEVESVRFRCAoT3ZlcmxheSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1vdmVybGF5LWNvbnRhaW5lciB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDA7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IGluaGVyaXQ7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWNvbG9yLWNvbW1lbnQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDk5LCAxMDIsIDI0MSwgMC41KTtcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItY29tbWVudCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiA1MHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiA4cHg7XG4gICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWNvbW1lbnQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWNvbW1lbnQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWJhZGdlLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBmaWx0ZXI6IGJyaWdodG5lc3MoMCkgaW52ZXJ0KDEpO1xuICAgICAgbWFyZ2luLXRvcDogNHB4O1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtbGFiZWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTVweCk7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xNXMgZWFzZSAwLjA1cywgdHJhbnNmb3JtIDAuMTVzIGVhc2UgMC4wNXM7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIC5jcWQtYmFkZ2UtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1vdmVybGF5LWNvbnRhaW5lci5jcWQtZWRpdGVkIHtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCB2YXIoLS1jcWQtY29sb3ItZWRpdGVkKSxcbiAgICAgICAgMCAwIDEycHggcmdiYSgwLCAyMTQsIDIzOCwgMC4zKTtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24gc3ZnIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgc3Ryb2tlOiBjdXJyZW50Q29sb3I7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiA1MHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiA4cHg7XG4gICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1jb250ZW50IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xMHB4KTtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4xNXMgZWFzZSAwLjA1cywgdHJhbnNmb3JtIDAuMTVzIGVhc2UgMC4wNXM7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZTpob3ZlciAuY3FkLWVkaXRlZC1jb250ZW50IHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtZGlmZi12YWwge1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdW2RhdGEtY3FkLXByb2Nlc3NlZF1bZGF0YS1jcWQtZWRpdGVkLXByb2Nlc3NlZF0gPiAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjRkY0MDM2LFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDcwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkY0MDM2O1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBwYWRkaW5nLXRvcDogOHB4O1xuICAgICAgdHJhbnNpdGlvbjogaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXNlY3Rpb24ge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24ge1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1pY29uLWVkaXRlZCBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtcGx1cyB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICBtYXJnaW46IDVweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtdmFsdWUsXG4gICAgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIG9wYWNpdHkgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWF4LWhlaWdodCAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXJnaW4tdG9wIDAuMTVzIGVhc2UgMC4wNXM7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDEyMHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLXZhbHVlIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciAuY3FkLWJvdGgtZGl2aWRlciB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNHB4O1xuICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgIH1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogMWIuIERPV05MT0FEIEFMTCBCVVRUT04gKEhlYWRlci1hbGlnbmVkKVxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4ge1xuICAvKiBQcm9ncmVzcyBjb250cm9sICgwJSB0byAxMDAlKSAqL1xuICAtLWNxZC1wcm9ncmVzczogMCU7XG5cbiAgcG9zaXRpb246IGFic29sdXRlO1xuXG4gIC8qIFBvc2l0aW9uIGluc2lkZSB0aGUgcG9zdCBjYXJkLCBuZWFyIHRoZSAzLWRvdHMgKi9cbiAgdG9wOiAxMnB4OyAgICAgICAvKiA84oCUIGtleSBjaGFuZ2U6IHNtYWxsIHBvc2l0aXZlIG9mZnNldCAqL1xuICByaWdodDogNDhweDtcbiAgei1pbmRleDogNjtcblxuICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIHBhZGRpbmc6IDRweCAxMnB4O1xuICBib3JkZXI6IG5vbmU7XG4gIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcblxuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgY29sb3I6ICNmZmZmZmY7XG4gIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctbm9ybWFsKTtcblxuICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgZm9udC1zaXplOiAxMnB4O1xuICBmb250LXdlaWdodDogNjAwO1xuICBjdXJzb3I6IHBvaW50ZXI7XG4gIGdhcDogNnB4O1xuICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuXG4gIHRyYW5zaXRpb246XG4gICAgYm94LXNoYWRvdyAwLjJzIGVhc2UsXG4gICAgdHJhbnNmb3JtIDAuMXMgZWFzZSxcbiAgICBiYWNrZ3JvdW5kLWNvbG9yIDAuM3MgZWFzZTtcblxuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVooMCk7XG59XG5cbmJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0biB7XG4gIHJpZ2h0OiBhdXRvO1xuICBsZWZ0OiA0OHB4O1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWhvdmVyKTtcbiAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xcHgpO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG46YWN0aXZlIHtcbiAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xufVxuXG4vKiBLZWVwIHBvaW50ZXIgY3Vyc29yIGV2ZW4gd2hpbGUgZGlzYWJsZWQgKHlvdSBhbHJlYWR5IHdhbnRlZCB0aGlzIGJlaGF2aW9yKSAqL1xuLmNxZC1kb3dubG9hZC1hbGwtYnRuW2Rpc2FibGVkXSB7XG4gIGN1cnNvcjogcG9pbnRlcjtcbn1cblxuLyogRlVMTCBTVUNDRVNTIFNUQVRFIChTb2xpZCBHcmVlbikgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLXN1Y2Nlc3Mge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLWVycm9yIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvcik7XG59XG5cbi8qIFBST0dSRVNTIEJBUiBPVkVSTEFZIChGaWxscyB1cCkgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bjo6YWZ0ZXIge1xuICBjb250ZW50OiAnJztcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICB0b3A6IDA7XG4gIGxlZnQ6IDA7XG4gIGJvdHRvbTogMDtcbiAgei1pbmRleDogMDtcblxuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG5cbiAgLyogV2lkdGggY29udHJvbGxlZCBieSBKUyAqL1xuICB3aWR0aDogdmFyKC0tY3FkLXByb2dyZXNzKTtcbiAgdHJhbnNpdGlvbjogd2lkdGggMC4zcyBjdWJpYy1iZXppZXIoMC4yMiwgMC42MSwgMC4zNiwgMSk7XG5cbiAgb3BhY2l0eTogMTtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtc3VjY2Vzczo6YWZ0ZXIge1xuICBvcGFjaXR5OiAwO1xufVxuXG4vKiBDb250ZW50IGxheWVycyAqL1xuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4sXG4uY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtc3ViLFxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgei1pbmRleDogMjtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uIHtcbiAgd2lkdGg6IDE4cHg7XG4gIGhlaWdodDogMThweDtcbiAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gIGJhY2tncm91bmQtc2l6ZTogMThweCAxOHB4O1xuICBmbGV4LXNocmluazogMDtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICBmb250LXdlaWdodDogNjAwO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtc3ViIHtcbiAgZm9udC1zaXplOiAxMXB4O1xuICBvcGFjaXR5OiAwLjk7XG4gIG1hcmdpbi1sZWZ0OiA0cHg7XG59XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG4iLCJjb25zdCBUUkFOU0xBVElPTlM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gIGVuOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdEb3dubG9hZGluZ+KApicsXG4gICAgdHJ5aW5nOiAnVHJ5aW5n4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRG93bmxvYWRlZCcsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnRG93bmxvYWQgZmFpbGVkLicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdRdWljayBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdjb21tZW50cycsXG4gICAgZWRpdGVkOiAnRWRpdGVkJyxcbiAgICBkb3dubG9hZEFsbDogJ0Rvd25sb2FkIGFsbCcsXG4gIH0sXG4gIGFyOiB7XG4gICAgZG93bmxvYWQ6ICfYqtmG2LLZitmEJyxcbiAgICBkb3dubG9hZGluZzogJ9is2KfYsdmKINin2YTYqtmG2LLZitmE4oCmJyxcbiAgICB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfYqtmFINin2YTYqtmG2LLZitmEJyxcbiAgICBlcnJvcjogJ9iu2LfYoycsXG4gICAgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsXG4gICAgYXJpYURvd25sb2FkOiAn2KrZhtiy2YrZhCcsXG4gICAgdGl0bGVRdWljazogJ9iq2YbYstmK2YQg2LPYsdmK2LknLFxuICAgIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLFxuICAgIGVkaXRlZDogJ9iq2YUg2KfZhNiq2LnYr9mK2YQnLFxuICAgIGRvd25sb2FkQWxsOiAn2KrZhtiy2YrZhCDYp9mE2YPZhCcsXG4gIH0sXG4gIGphOiB7XG4gICAgZG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLFxuICAgIHRyeWluZzogJ+ippuihjOS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+WujOS6hicsXG4gICAgZXJyb3I6ICfjgqjjg6njg7wnLFxuICAgIGZhaWxlZDogJ+WkseaVl+OBl+OBvuOBl+OBn+OAgicsXG4gICAgYXJpYURvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJyxcbiAgICB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJyxcbiAgICBjb21tZW50czogJ+S7tuOBruOCs+ODoeODs+ODiCcsXG4gICAgZWRpdGVkOiAn57eo6ZuG5riI44G/JyxcbiAgfSxcbiAgZXM6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsXG4gICAgdHJ5aW5nOiAnSW50ZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0ZhbGzDsyBsYSBkZXNjYXJnYS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICBoaToge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsXG4gICAgdHJ5aW5nOiAn4KSV4KWL4KS24KS/4KS2IOCknOCkvuCksOClgOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLFxuICAgIGZhaWxlZDogJ+CkteCkv+Ckq+CksiDgpLDgpLngpL4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KS/4KSv4KS+4KSBJyxcbiAgICBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICBwdDoge1xuICAgIGRvd25sb2FkOiAnQmFpeGFyJyxcbiAgICBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdUZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0JhaXhhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsaGEgYW8gYmFpeGFyLicsXG4gICAgYXJpYURvd25sb2FkOiAnQmFpeGFyJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsXG4gICAgY29tbWVudHM6ICdjb21lbnTDoXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICAncHQtcHQnOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJyxcbiAgICB0cnlpbmc6ICdBIHRlbnRhcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxoYSBhbyBkZXNjYXJyZWdhci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnTDoXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICAnemgtY24nOiB7XG4gICAgZG93bmxvYWQ6ICfkuIvovb0nLFxuICAgIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJyxcbiAgICB0cnlpbmc6ICflsJ3or5XkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflt7LkuIvovb0nLFxuICAgIGVycm9yOiAn6ZSZ6K+vJyxcbiAgICBmYWlsZWQ6ICfkuIvovb3lpLHotKUnLFxuICAgIGFyaWFEb3dubG9hZDogJ+S4i+i9vScsXG4gICAgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsXG4gICAgY29tbWVudHM6ICfmnaHor4TorronLFxuICAgIGVkaXRlZDogJ+W3sue8lui+kScsXG4gIH0sXG4gICd6aC10dyc6IHtcbiAgICBkb3dubG9hZDogJ+S4i+i8iScsXG4gICAgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLFxuICAgIHRyeWluZzogJ+WYl+ippuS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+W3suS4i+i8iScsXG4gICAgZXJyb3I6ICfpjK/oqqQnLFxuICAgIGZhaWxlZDogJ+S4i+i8ieWkseaVlycsXG4gICAgYXJpYURvd25sb2FkOiAn5LiL6LyJJyxcbiAgICB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJyxcbiAgICBjb21tZW50czogJ+WJh+eVmeiogCcsXG4gICAgZWRpdGVkOiAn5bey57eo6LyvJyxcbiAgfSxcbiAgZnI6IHtcbiAgICBkb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLFxuICAgIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsXG4gICAgdHJ5aW5nOiAnRXNzYWnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUw6lsw6ljaGFyZ8OpJyxcbiAgICBlcnJvcjogJ0VycmV1cicsXG4gICAgZmFpbGVkOiAnw4ljaGVjLicsXG4gICAgYXJpYURvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsXG4gICAgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRhaXJlcycsXG4gICAgZWRpdGVkOiAnTW9kaWZpw6knLFxuICB9LFxuICBkZToge1xuICAgIGRvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsXG4gICAgdHJ5aW5nOiAnVmVyc3VjaGVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmVydGlnJyxcbiAgICBlcnJvcjogJ0ZlaGxlcicsXG4gICAgZmFpbGVkOiAnRmVobGdlc2NobGFnZW4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJyxcbiAgICB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJyxcbiAgICBjb21tZW50czogJ0tvbW1lbnRhcmUnLFxuICAgIGVkaXRlZDogJ0JlYXJiZWl0ZXQnLFxuICB9LFxuICBpdDoge1xuICAgIGRvd25sb2FkOiAnU2NhcmljYScsXG4gICAgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLFxuICAgIHRyeWluZzogJ1Byb3ZhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2NhcmljYXRvJyxcbiAgICBlcnJvcjogJ0Vycm9yZScsXG4gICAgZmFpbGVkOiAnRmFsbGl0by4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1NjYXJpY2EnLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudGknLFxuICAgIGVkaXRlZDogJ01vZGlmaWNhdG8nLFxuICB9LFxuICBydToge1xuICAgIGRvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLFxuICAgIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLFxuICAgIHRyeWluZzogJ9Cf0L7Qv9GL0YLQutCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0KHQutCw0YfQsNC90L4nLFxuICAgIGVycm9yOiAn0J7RiNC40LHQutCwJyxcbiAgICBmYWlsZWQ6ICfQodCx0L7QuS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LzQtdC90YLQsNGA0LjQtdCyJyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdC90LXQvdC+JyxcbiAgfSxcbiAga286IHtcbiAgICBkb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsXG4gICAgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJyxcbiAgICB0cnlpbmc6ICfsi5zrj4Qg7KSR4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn7JmE66OMJyxcbiAgICBlcnJvcjogJ+yYpOulmCcsXG4gICAgZmFpbGVkOiAn7Iuk7Yyo7ZWoJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLFxuICAgIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJyxcbiAgICBjb21tZW50czogJ+qwnCDrjJPquIAnLFxuICAgIGVkaXRlZDogJ+yImOygleuQqCcsXG4gIH0sXG4gIHRyOiB7XG4gICAgZG93bmxvYWQ6ICfEsG5kaXInLFxuICAgIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJyxcbiAgICB0cnlpbmc6ICdEZW5lbml5b3LigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfEsG5kaXJpbGRpJyxcbiAgICBlcnJvcjogJ0hhdGEnLFxuICAgIGZhaWxlZDogJ0JhxZ9hcsSxc8Sxei4nLFxuICAgIGFyaWFEb3dubG9hZDogJ8SwbmRpcicsXG4gICAgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLFxuICAgIGNvbW1lbnRzOiAneW9ydW0nLFxuICAgIGVkaXRlZDogJ0TDvHplbmxlbmRpJyxcbiAgfSxcbiAgdmk6IHtcbiAgICBkb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLFxuICAgIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLFxuICAgIHRyeWluZzogJ8SQYW5nIHRo4but4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnxJDDoyB04bqjaScsXG4gICAgZXJyb3I6ICdM4buXaScsXG4gICAgZmFpbGVkOiAnVGjhuqV0IGLhuqFpLicsXG4gICAgYXJpYURvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsXG4gICAgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLFxuICAgIGNvbW1lbnRzOiAnbmjhuq1uIHjDqXQnLFxuICAgIGVkaXRlZDogJ8SQw6MgY2jhu4luaCBz4butYScsXG4gIH0sXG4gIGlkOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLFxuICAgIHRyeWluZzogJ01lbmNvYmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTZWxlc2FpJyxcbiAgICBlcnJvcjogJ0tlc2FsYWhhbicsXG4gICAgZmFpbGVkOiAnR2FnYWwuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyJyxcbiAgICBlZGl0ZWQ6ICdEaWVkaXQnLFxuICB9LFxuICB0aDoge1xuICAgIGRvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJyxcbiAgICBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsXG4gICAgdHJ5aW5nOiAn4Lie4Lii4Liy4Lii4Liy4Lih4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LmA4Liq4Lij4LmH4LiI4Liq4Li04LmJ4LiZJyxcbiAgICBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsXG4gICAgZmFpbGVkOiAn4Lil4LmJ4Lih4LmA4Lir4Lil4LinJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLFxuICAgIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLFxuICAgIGNvbW1lbnRzOiAn4LiE4Lin4Liy4Lih4LiE4Li04LiU4LmA4Lir4LmH4LiZJyxcbiAgICBlZGl0ZWQ6ICfguYHguIHguYnguYTguILguYHguKXguYnguKcnLFxuICB9LFxuICBwbDoge1xuICAgIGRvd25sb2FkOiAnUG9iaWVyeicsXG4gICAgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJyxcbiAgICB0cnlpbmc6ICdQcsOzYmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQb2JyYW5vJyxcbiAgICBlcnJvcjogJ0LFgsSFZCcsXG4gICAgZmFpbGVkOiAnTmlldWRhbmUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQb2JpZXJ6JyxcbiAgICB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyemUnLFxuICAgIGVkaXRlZDogJ0VkeXRvd2FubycsXG4gIH0sXG4gIG5sOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZGVuJyxcbiAgICBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLFxuICAgIHRyeWluZzogJ1Byb2JlcmVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhYXInLFxuICAgIGVycm9yOiAnRm91dCcsXG4gICAgZmFpbGVkOiAnTWlzbHVrdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkZW4nLFxuICAgIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLFxuICAgIGNvbW1lbnRzOiAncmVhY3RpZXMnLFxuICAgIGVkaXRlZDogJ0Jld2Vya3QnLFxuICB9LFxuICBibjoge1xuICAgIGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLFxuICAgIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgprDgppvgp4figKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgpqjgp43gpqgnLFxuICAgIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JyxcbiAgICBmYWlsZWQ6ICfgpqzgp43gpq/gprDgp43gpqUg4Ka54Kav4Ka84KeH4Kab4KeHJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICBjb21tZW50czogJ+Cmn+CmvyDgpq7gpqjgp43gpqTgpqzgp43gpq8nLFxuICAgIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcsXG4gIH0sXG4gIHBhOiB7XG4gICAgZG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLFxuICAgIHRyeWluZzogJ+ColeCpi+CouOCovOCov+CouOCovCDgqJzgqL7gqLDgqYDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgqK7gqYHgqJXgqbDgqK7gqLInLFxuICAgIGVycm9yOiAn4KiX4Kiy4Kik4KmAJyxcbiAgICBmYWlsZWQ6ICfgqIXgqLjgqKvgqLInLFxuICAgIGFyaWFEb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIGNvbW1lbnRzOiAn4Kif4Ki/4Kmx4Kiq4Kij4KmA4KiG4KiCJyxcbiAgICBlZGl0ZWQ6ICfgqLjgqbDgqKrgqL7gqKbgqL/gqKQnLFxuICB9LFxuICB0ZToge1xuICAgIGRvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLFxuICAgIHRyeWluZzogJ+CwquCxjeCwsOCwr+CwpOCxjeCwqOCwv+CwuOCxjeCwpOCxi+CwguCwpuCwv+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CwquCxguCwsOCxjeCwpOCwr+Cwv+CwguCwpuCwvycsXG4gICAgZXJyb3I6ICfgsLLgsYvgsKrgsIInLFxuICAgIGZhaWxlZDogJ+CwteCwv+Cwq+CwsuCwruCxiOCwguCwpuCwvycsXG4gICAgYXJpYURvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgY29tbWVudHM6ICfgsLXgsY3gsK/gsL7gsJbgsY3gsK/gsLLgsYEnLFxuICAgIGVkaXRlZDogJ+CwuOCwteCwsOCwv+CwguCwmuCwrOCwoeCwv+CwguCwpuCwvycsXG4gIH0sXG4gIG1yOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLFxuICAgIHRyeWluZzogJ+CkquCljeCksOCkr+CkpOCljeCkqCDgpJXgpLDgpKQg4KSG4KS54KWH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsXG4gICAgZmFpbGVkOiAn4KSF4KSv4KS24KS44KWN4KS14KWAJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+CljeCkr+CkvicsXG4gICAgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgdGE6IHtcbiAgICBkb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsXG4gICAgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrqrgr43grqrgrp/gr4HgrpXgrr/grrHgrqTgr4HigKYnLFxuICAgIHRyeWluZzogJ+CuruCvgeCur+CuseCvjeCumuCuv+CuleCvjeCuleCuv+CuseCupOCvgeKApicsXG4gICAgZG93bmxvYWRlZDogJ+CuruCvgeCun+Cuv+CuqOCvjeCupOCupOCvgScsXG4gICAgZXJyb3I6ICfgrqrgrr/grrTgr4gnLFxuICAgIGZhaWxlZDogJ+CupOCvi+CusuCvjeCuteCuvycsXG4gICAgYXJpYURvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJyxcbiAgICB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsXG4gICAgY29tbWVudHM6ICfgrpXgrrDgr4HgrqTgr43grqTgr4HgrpXgrrPgr40nLFxuICAgIGVkaXRlZDogJ+CupOCuv+CusOCvgeCupOCvjeCupOCuquCvjeCuquCun+CvjeCun+CupOCvgScsXG4gIH0sXG4gIHVyOiB7XG4gICAgZG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLFxuICAgIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLFxuICAgIHRyeWluZzogJ9qp2YjYtNi0INis2KfYsduM4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2YXaqdmF2YQnLFxuICAgIGVycm9yOiAn2LrZhNi324wnLFxuICAgIGZhaWxlZDogJ9mG2Kfaqdin2YUnLFxuICAgIGFyaWFEb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsXG4gICAgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsXG4gICAgY29tbWVudHM6ICfYqtio2LXYsduSJyxcbiAgICBlZGl0ZWQ6ICfYqtix2YXbjNmFINi02K/bgScsXG4gIH0sXG4gIGd1OiB7XG4gICAgZG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJyxcbiAgICB0cnlpbmc6ICfgqqrgq43gqrDgqq/gqr7gqrgg4Kqa4Kq+4Kqy4KuB4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Kqq4KuC4Kqw4KuN4KqjJyxcbiAgICBlcnJvcjogJ+CqreCrguCqsicsXG4gICAgZmFpbGVkOiAn4Kqo4Kq/4Kq34KuN4Kqr4KqzJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICBjb21tZW50czogJ+Cqn+Cqv+CqquCrjeCqquCqo+CrgOCqkycsXG4gICAgZWRpdGVkOiAn4Kq44KqC4Kqq4Kq+4Kqm4Kq/4KqkJyxcbiAgfSxcbiAga246IHtcbiAgICBkb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJyxcbiAgICB0cnlpbmc6ICfgsqrgs43gsrDgsq/gsqTgs43gsqjgsr/gsrjgs4HgsqTgs43gsqTgsr/gsqbgs4bigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgsqrgs4LgsrDgs43gsqPgspfgs4rgsoLgsqHgsr/gsqbgs4YnLFxuICAgIGVycm9yOiAn4LKm4LOL4LK3JyxcbiAgICBmYWlsZWQ6ICfgsrXgsr/gsqvgsrLgsrXgsr7gspfgsr/gsqbgs4YnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIGNvbW1lbnRzOiAn4LKV4LK+4LKu4LOG4LKC4LKf4LON4oCM4LKX4LKz4LOBJyxcbiAgICBlZGl0ZWQ6ICfgsrjgsoLgsqrgsr7gsqbgsr/gsrjgsrLgsr7gspfgsr/gsqbgs4YnLFxuICB9LFxuICBtbDoge1xuICAgIGRvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLFxuICAgIHRyeWluZzogJ+C0tuC1jeC0sOC0ruC0v+C0leC1jeC0leC1geC0qOC1jeC0qOC1geKApicsXG4gICAgZG93bmxvYWRlZDogJ+C0quC1guC1vOC0pOC1jeC0pOC0v+C0r+C0vuC0r+C0vycsXG4gICAgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLFxuICAgIGZhaWxlZDogJ+C0quC0sOC0vuC0nOC0r+C0quC1jeC0quC1huC0n+C1jeC0n+C1gScsXG4gICAgYXJpYURvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgY29tbWVudHM6ICfgtIXgtK3gtL/gtKrgtY3gtLDgtL7gtK/gtJngtY3gtJngtb4nLFxuICAgIGVkaXRlZDogJ+C0juC0oeC0v+C0seC1jeC0seC1geC0muC1huC0r+C1jeC0pOC1gScsXG4gIH0sXG4gIHVrOiB7XG4gICAgZG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JyxcbiAgICBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsXG4gICAgdHJ5aW5nOiAn0KHQv9GA0L7QsdCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10LLQtNCw0YfQsC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDRltCyJyxcbiAgICBlZGl0ZWQ6ICfQl9C80ZbQvdC10L3QvicsXG4gIH0sXG4gIGVsOiB7XG4gICAgZG93bmxvYWQ6ICfOm86uz4jOtycsXG4gICAgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsXG4gICAgdHJ5aW5nOiAnzqDPgc6/z4PPgM6szrjOtc65zrHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfOn867zr/Ous67zrfPgc+OzrjOt866zrUnLFxuICAgIGVycm9yOiAnzqPPhs6szrvOvM6xJyxcbiAgICBmYWlsZWQ6ICfOkc+Azq3PhM+Fz4fOtS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ86bzq7PiM63JyxcbiAgICB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLFxuICAgIGNvbW1lbnRzOiAnz4PPh8+MzrvOuc6xJyxcbiAgICBlZGl0ZWQ6ICfOlc+AzrXOvs61z4HOs86xz4POvM6tzr3OvycsXG4gIH0sXG4gIGNzOiB7XG4gICAgZG93bmxvYWQ6ICdTdMOhaG5vdXQnLFxuICAgIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLFxuICAgIHRyeWluZzogJ1prb3XFocOtbeKApicsXG4gICAgZG93bmxvYWRlZDogJ1N0YcW+ZW5vJyxcbiAgICBlcnJvcjogJ0NoeWJhJyxcbiAgICBmYWlsZWQ6ICdTZWxoYWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU3TDoWhub3V0JyxcbiAgICB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLFxuICAgIGNvbW1lbnRzOiAna29tZW50w6HFmcWvJyxcbiAgICBlZGl0ZWQ6ICdVcHJhdmVubycsXG4gIH0sXG4gIHJvOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLFxuICAgIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJyxcbiAgICB0cnlpbmc6ICdTZSDDrm5jZWFyY8SD4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmluYWxpemF0JyxcbiAgICBlcnJvcjogJ0Vyb2FyZScsXG4gICAgZmFpbGVkOiAnRciZdWF0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY8SDcmNhyJtpJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlpJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmljYXQnLFxuICB9LFxuICBodToge1xuICAgIGRvd25sb2FkOiAnTGV0w7ZsdMOpcycsXG4gICAgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJyxcbiAgICB0cnlpbmc6ICdQcsOzYsOhbGtvesOhc+KApicsXG4gICAgZG93bmxvYWRlZDogJ0vDqXN6JyxcbiAgICBlcnJvcjogJ0hpYmEnLFxuICAgIGZhaWxlZDogJ1Npa2VydGVsZW4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMZXTDtmx0w6lzJyxcbiAgICB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsXG4gICAgY29tbWVudHM6ICdtZWdqZWd5esOpcycsXG4gICAgZWRpdGVkOiAnU3plcmtlc3p0dmUnLFxuICB9LFxuICBzdjoge1xuICAgIGRvd25sb2FkOiAnTGFkZGEgbmVyJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLFxuICAgIHRyeWluZzogJ0bDtnJzw7ZrZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFydCcsXG4gICAgZXJyb3I6ICdGZWwnLFxuICAgIGZhaWxlZDogJ01pc3NseWNrYWRlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhZGRhIG5lcicsXG4gICAgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VyYWQnLFxuICB9LFxuICBkYToge1xuICAgIGRvd25sb2FkOiAnSGVudCcsXG4gICAgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLFxuICAgIHRyeWluZzogJ1Byw7h2ZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdIZW50ZXQnLFxuICAgIGVycm9yOiAnRmVqbCcsXG4gICAgZmFpbGVkOiAnTWlzbHlra2VkZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdIZW50JyxcbiAgICB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VyZXQnLFxuICB9LFxuICBmaToge1xuICAgIGRvd25sb2FkOiAnTGF0YWEnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLFxuICAgIHRyeWluZzogJ1lyaXRldMOkw6Ru4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnTGFkYXR0dScsXG4gICAgZXJyb3I6ICdWaXJoZScsXG4gICAgZmFpbGVkOiAnRXDDpG9ubmlzdHVpLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGF0YWEnLFxuICAgIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnR0aWEnLFxuICAgIGVkaXRlZDogJ011b2thdHR1JyxcbiAgfSxcbiAgbm86IHtcbiAgICBkb3dubG9hZDogJ0xhc3QgbmVkJyxcbiAgICBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLFxuICAgIHRyeWluZzogJ1Byw7h2ZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGZXJkaWcnLFxuICAgIGVycm9yOiAnRmVpbCcsXG4gICAgZmFpbGVkOiAnTWlzbHlrdGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFzdCBuZWQnLFxuICAgIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJ0JyxcbiAgfSxcbiAgaGU6IHtcbiAgICBkb3dubG9hZDogJ9eU15XXqNeT15QnLFxuICAgIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsXG4gICAgdHJ5aW5nOiAn157XoNeh15TigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfXlNeV16nXnNedJyxcbiAgICBlcnJvcjogJ9ep15LXmdeQ15QnLFxuICAgIGZhaWxlZDogJ9eg15vXqdecJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfXlNeV16jXk9eUJyxcbiAgICB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJyxcbiAgICBjb21tZW50czogJ9eq15LXldeR15XXqicsXG4gICAgZWRpdGVkOiAn16DXoteo15onLFxuICB9LFxuICBmYToge1xuICAgIGRvd25sb2FkOiAn2K/Yp9mG2YTZiNivJyxcbiAgICBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJyxcbiAgICB0cnlpbmc6ICfYqtmE2KfYtCDZhdis2K/Yr+KApicsXG4gICAgZG93bmxvYWRlZDogJ9in2YbYrNin2YUg2LTYrycsXG4gICAgZXJyb3I6ICfYrti32KcnLFxuICAgIGZhaWxlZDogJ9mG2KfZhdmI2YHZgicsXG4gICAgYXJpYURvd25sb2FkOiAn2K/Yp9mG2YTZiNivJyxcbiAgICB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JyxcbiAgICBjb21tZW50czogJ9mG2LjYsScsXG4gICAgZWRpdGVkOiAn2YjbjNix2KfbjNi0INi02K/ZhycsXG4gIH0sXG4gIGZpbDoge1xuICAgIGRvd25sb2FkOiAnSS1kb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsXG4gICAgdHJ5aW5nOiAnU2ludXN1YnVrYW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUYXBvcyBuYScsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnTmFiaWdvLicsXG4gICAgYXJpYURvd25sb2FkOiAnSS1kb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnbWdhIGtvbWVudG8nLFxuICAgIGVkaXRlZDogJ05hLWVkaXQnLFxuICB9LFxuICBtczoge1xuICAgIGRvd25sb2FkOiAnTXVhdCB0dXJ1bicsXG4gICAgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLFxuICAgIHRyeWluZzogJ01lbmN1YmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTZWxlc2FpJyxcbiAgICBlcnJvcjogJ1JhbGF0JyxcbiAgICBmYWlsZWQ6ICdHYWdhbC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ011YXQgdHVydW4nLFxuICAgIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsXG4gICAgY29tbWVudHM6ICdrb21lbicsXG4gICAgZWRpdGVkOiAnRGllZGl0JyxcbiAgfSxcbiAgc3I6IHtcbiAgICBkb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JyxcbiAgICBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJyxcbiAgICB0cnlpbmc6ICfQn9C+0LrRg9GI0LDQstCw0LzigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQl9Cw0LLRgNGI0LXQvdC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10ZrQtdC90L4nLFxuICB9LFxuICBzazoge1xuICAgIGRvd25sb2FkOiAnU3RpYWhudcWlJyxcbiAgICBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJyxcbiAgICB0cnlpbmc6ICdTa8O6xaFhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0hvdG92bycsXG4gICAgZXJyb3I6ICdDaHliYScsXG4gICAgZmFpbGVkOiAnWmx5aGFsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1N0aWFobnXFpScsXG4gICAgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsXG4gICAgY29tbWVudHM6ICdrb21lbnTDoXJvdicsXG4gICAgZWRpdGVkOiAnVXByYXZlbsOpJyxcbiAgfSxcbiAgYmc6IHtcbiAgICBkb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JyxcbiAgICBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsXG4gICAgdHJ5aW5nOiAn0J7Qv9C40YLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQsCcsXG4gICAgZWRpdGVkOiAn0KDQtdC00LDQutGC0LjRgNCw0L3QvicsXG4gIH0sXG4gIGhyOiB7XG4gICAgZG93bmxvYWQ6ICdQcmV1em1pJyxcbiAgICBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJyxcbiAgICB0cnlpbmc6ICdQb2t1xaFhdmFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnR290b3ZvJyxcbiAgICBlcnJvcjogJ0dyZcWha2EnLFxuICAgIGZhaWxlZDogJ05ldXNwamVsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ByZXV6bWknLFxuICAgIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyYScsXG4gICAgZWRpdGVkOiAnVXJlxJFlbm8nLFxuICB9LFxuICBsdDoge1xuICAgIGRvd25sb2FkOiAnQXRzaXNpxbNzdGknLFxuICAgIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsXG4gICAgdHJ5aW5nOiAnQmFuZG9tYeKApicsXG4gICAgZG93bmxvYWRlZDogJ0JhaWd0YScsXG4gICAgZXJyb3I6ICdLbGFpZGEnLFxuICAgIGZhaWxlZDogJ05lcGF2eWtvLicsXG4gICAgYXJpYURvd25sb2FkOiAnQXRzaXNpxbNzdGknLFxuICAgIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJhaScsXG4gICAgZWRpdGVkOiAnUmVkYWd1b3RhJyxcbiAgfSxcbiAgbHY6IHtcbiAgICBkb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JyxcbiAgICBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLFxuICAgIHRyeWluZzogJ03Ek8SjaW5h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUGFiZWlndHMnLFxuICAgIGVycm9yOiAnS8S8xatkYScsXG4gICAgZmFpbGVkOiAnTmVpemRldsSBcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JyxcbiAgICB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsXG4gICAgY29tbWVudHM6ICdrb21lbnTEgXJpJyxcbiAgICBlZGl0ZWQ6ICdSZWRpxKPEk3RzJyxcbiAgfSxcbiAgZXQ6IHtcbiAgICBkb3dubG9hZDogJ0xhYWRpIGFsbGEnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9vdmlu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVmFsbWlzJyxcbiAgICBlcnJvcjogJ1ZpZ2EnLFxuICAgIGZhaWxlZDogJ0ViYcO1bm5lc3R1cy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhYWRpIGFsbGEnLFxuICAgIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhYXJpJyxcbiAgICBlZGl0ZWQ6ICdNdXVkZXR1ZCcsXG4gIH0sXG4gIHNsOiB7XG4gICAgZG93bmxvYWQ6ICdQcmVub3MnLFxuICAgIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLFxuICAgIHRyeWluZzogJ1Bvc2t1xaFhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0tvbsSNYW5vJyxcbiAgICBlcnJvcjogJ05hcGFrYScsXG4gICAgZmFpbGVkOiAnTmkgdXNwZWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnUHJlbm9zJyxcbiAgICB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyamV2JyxcbiAgICBlZGl0ZWQ6ICdVcmVqZW5vJyxcbiAgfSxcbiAgY2E6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJyxcbiAgICB0cnlpbmc6ICdJbnRlbnRhbnTigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhdCcsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnSGEgZmFsbGF0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpcycsXG4gICAgZWRpdGVkOiAnRWRpdGF0JyxcbiAgfSxcbiAgYWY6IHtcbiAgICBkb3dubG9hZDogJ0FmbGFhaScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9iZWVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhYXInLFxuICAgIGVycm9yOiAnRm91dCcsXG4gICAgZmFpbGVkOiAnTWlzbHVrLicsXG4gICAgYXJpYURvd25sb2FkOiAnQWZsYWFpJyxcbiAgICB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZScsXG4gICAgZWRpdGVkOiAnR2VyZWRpZ2VlcicsXG4gIH0sXG4gIGFtOiB7XG4gICAgZG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLFxuICAgIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsXG4gICAgdHJ5aW5nOiAn4Ymg4YiY4Yie4Yqo4YitIOGIi+GLreKApicsXG4gICAgZG93bmxvYWRlZDogJ+GLiOGIreGLt+GIjScsXG4gICAgZXJyb3I6ICfhiLXhiIXhibDhibUnLFxuICAgIGZhaWxlZDogJ+GKoOGIjeGJsOGIs+GKq+GIneGNoicsXG4gICAgYXJpYURvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JyxcbiAgICB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsXG4gICAgY29tbWVudHM6ICfhiqDhiLXhibDhi6vhi6jhibbhib0nLFxuICAgIGVkaXRlZDogJ+GJsOGIteGJsOGKq+GKreGIj+GIjScsXG4gIH0sXG4gIGh5OiB7XG4gICAgZG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLFxuICAgIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLFxuICAgIHRyeWluZzogJ9WT1bjWgNWx1bjWgtW0INWn4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn1LHVvtWh1oDVv9W+1aHVricsXG4gICAgZXJyb3I6ICfVjdWt1aHVrCcsXG4gICAgZmFpbGVkOiAn1YHVodWt1bjVstW+1aXWgTonLFxuICAgIGFyaWFEb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsXG4gICAgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JyxcbiAgICBjb21tZW50czogJ9W01aXVr9W21aHVotWh1bbVuNaC1anVtdW41oLVticsXG4gICAgZWRpdGVkOiAn1L3VtNWi1aHVo9aA1b7VpdWsINWnJyxcbiAgfSxcbiAgYXM6IHtcbiAgICBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsXG4gICAgdHJ5aW5nOiAn4Kaa4KeH4Ka34KeN4Kaf4Ka+IOCmleCnsOCmvyDgpobgppvgp4figKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgp4Lgp7Dgp43gpqMnLFxuICAgIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JyxcbiAgICBmYWlsZWQ6ICfgpqzgpr/gpqvgprIg4Ka54oCZ4KayJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICBjb21tZW50czogJ+CmruCmqOCnjeCmpOCmrOCnjeCmrycsXG4gICAgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyxcbiAgfSxcbiAgYXo6IHtcbiAgICBkb3dubG9hZDogJ1nDvGtsyZknLFxuICAgIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsXG4gICAgdHJ5aW5nOiAnQ8mZaGQgZWRpbGly4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQml0ZGknLFxuICAgIGVycm9yOiAnWMmZdGEnLFxuICAgIGZhaWxlZDogJ0FsxLFubWFkxLEuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdZw7xrbMmZJyxcbiAgICB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLFxuICAgIGNvbW1lbnRzOiAnxZ/JmXJoJyxcbiAgICBlZGl0ZWQ6ICdEw7x6yZlsacWfIGVkaWxpYicsXG4gIH0sXG4gIGV1OiB7XG4gICAgZG93bmxvYWQ6ICdEZXNrYXJnYXR1JyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsXG4gICAgdHJ5aW5nOiAnU2FpYXR6ZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdFZ2luZGEnLFxuICAgIGVycm9yOiAnRXJyb3JlYScsXG4gICAgZmFpbGVkOiAnSHV0cyBlZ2luIGR1LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVza2FyZ2F0dScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLFxuICAgIGNvbW1lbnRzOiAnaXJ1emtpbicsXG4gICAgZWRpdGVkOiAnRWRpdGF0dWEnLFxuICB9LFxuICBteToge1xuICAgIGRvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLFxuICAgIHRyeWluZzogJ+GAgOGAvOGAreGAr+GAuOGAheGArOGAuOGAlOGAseKApicsXG4gICAgZG93bmxvYWRlZDogJ+GAleGAvOGAruGAuOGAleGAq+GAleGAvOGAricsXG4gICAgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLFxuICAgIGZhaWxlZDogJ+GAmeGAoeGAseGArOGAhOGAuuGAmeGAvOGAhOGAuuGAleGAq+GBiycsXG4gICAgYXJpYURvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgY29tbWVudHM6ICfhgJnhgL7hgJDhgLrhgIHhgLvhgIDhgLrhgJnhgLvhgKzhgLgnLFxuICAgIGVkaXRlZDogJ+GAleGAvOGAhOGAuuGAhuGAhOGAuuGAleGAvOGAruGAuCcsXG4gIH0sXG4gIGdsOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLFxuICAgIHRyeWluZzogJ1RlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxsb3UuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAga2E6IHtcbiAgICBkb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLFxuICAgIHRyeWluZzogJ+GDm+GDquGDk+GDlOGDmuGDneGDkeGDkOKApicsXG4gICAgZG93bmxvYWRlZDogJ+GDk+GDkOGDoeGDoOGDo+GDmuGDk+GDkCcsXG4gICAgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLFxuICAgIGZhaWxlZDogJ+GDleGDlOGDoCDhg5vhg53hg67hg5Thg6Dhg67hg5Phg5AuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICBjb21tZW50czogJ+GDmeGDneGDm+GDlOGDnOGDouGDkOGDoOGDmCcsXG4gICAgZWRpdGVkOiAn4YOg4YOU4YOT4YOQ4YOl4YOi4YOY4YOg4YOU4YOR4YOj4YOa4YOY4YOQJyxcbiAgfSxcbiAgaXM6IHtcbiAgICBkb3dubG9hZDogJ1PDpmtqYScsXG4gICAgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLFxuICAgIHRyeWluZzogJ1JleW5p4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU8OzdHQnLFxuICAgIGVycm9yOiAnVmlsbGEnLFxuICAgIGZhaWxlZDogJ01pc3TDs2tzdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1PDpmtqYScsXG4gICAgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsXG4gICAgY29tbWVudHM6ICd1bW3DpmxpJyxcbiAgICBlZGl0ZWQ6ICdCcmV5dHQnLFxuICB9LFxuICBnYToge1xuICAgIGRvd25sb2FkOiAnw41vc2zDs2TDoWlsJyxcbiAgICBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsXG4gICAgdHJ5aW5nOiAnQWcgaWFycmFpZGjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfDjW9zbMOzZMOhaWx0ZScsXG4gICAgZXJyb3I6ICdFYXJyw6FpZCcsXG4gICAgZmFpbGVkOiAnVGhlaXAgYWlyLicsXG4gICAgYXJpYURvd25sb2FkOiAnw41vc2zDs2TDoWlsJyxcbiAgICB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLFxuICAgIGNvbW1lbnRzOiAndHLDoWNodCcsXG4gICAgZWRpdGVkOiAnRWFncmFpdGhlJyxcbiAgfSxcbiAga2s6IHtcbiAgICBkb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLFxuICAgIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJyxcbiAgICB0cnlpbmc6ICfTmNGA0LXQutC10YLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQkNGP0pvRgtCw0LvQtNGLJyxcbiAgICBlcnJvcjogJ9Ka0LDRgtC1JyxcbiAgICBmYWlsZWQ6ICfQodOZ0YLRgdGW0LcuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJyxcbiAgICB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsXG4gICAgY29tbWVudHM6ICfQv9GW0LrRltGAJyxcbiAgICBlZGl0ZWQ6ICfTqNC30LPQtdGA0YLRltC70LTRlicsXG4gIH0sXG4gIGttOiB7XG4gICAgZG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLFxuICAgIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJyxcbiAgICB0cnlpbmc6ICfhnoDhn4bhnpbhnrvhnoThnpbhn5LhnpnhnrbhnpnhnrbhnpjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhnpThnrbhnpPhnpThnonhn5LhnoXhnpThn4snLFxuICAgIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJyxcbiAgICBmYWlsZWQ6ICfhnpThnprhnrbhnofhn5DhnpknLFxuICAgIGFyaWFEb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsXG4gICAgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsXG4gICAgY29tbWVudHM6ICfhnpjhno/hnrcnLFxuICAgIGVkaXRlZDogJ+GelOGetuGek+GegOGfguGen+GemOGfkuGemuGeveGemycsXG4gIH0sXG4gIGxvOiB7XG4gICAgZG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLFxuICAgIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJyxcbiAgICB0cnlpbmc6ICfguoHgurPguqXgurHguofgup7gurDguo3gurLguo3gurLguqHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfguqrgurPgu4DguqXgurHgupQnLFxuICAgIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJyxcbiAgICBmYWlsZWQ6ICfguqXgurvgu4nguqHgu4DguqvguqXguqcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsXG4gICAgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsXG4gICAgY29tbWVudHM6ICfguoTgurPgu4DguqvgurHgupknLFxuICAgIGVkaXRlZDogJ+C7geC6geC7ieC7hOC6guC7geC6peC7ieC6pycsXG4gIH0sXG4gIG1rOiB7XG4gICAgZG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLFxuICAgIHRyeWluZzogJ9Ch0LUg0L7QsdC40LTRg9Cy0LDQvOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQuCcsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXQvdC10YLQvicsXG4gIH0sXG4gIG1uOiB7XG4gICAgZG93bmxvYWQ6ICfQotCw0YLQsNGFJyxcbiAgICBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsXG4gICAgdHJ5aW5nOiAn0J7RgNC70LTQvtC2INCx0LDQudC90LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQotCw0YLRgdCw0L0nLFxuICAgIGVycm9yOiAn0JDQu9C00LDQsCcsXG4gICAgZmFpbGVkOiAn0JDQvNC20LjQu9GC0LPSr9C5LicsXG4gICAgYXJpYURvd25sb2FkOiAn0KLQsNGC0LDRhScsXG4gICAgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJyxcbiAgICBjb21tZW50czogJ9GB0Y3RgtCz0Y3Qs9C00Y3QuycsXG4gICAgZWRpdGVkOiAn0JfQsNGB0YHQsNC9JyxcbiAgfSxcbiAgbmU6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJyxcbiAgICB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpL7gpLgg4KSX4KSw4KWN4KSm4KWI4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KS+IOCkreCkr+CliycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLFxuICAgIGZhaWxlZDogJ+CkheCkuOCkq+CksiDgpK3gpK/gpYsnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KWA4KS54KSw4KWCJyxcbiAgICBlZGl0ZWQ6ICfgpLjgpK7gpY3gpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICBvcjoge1xuICAgIGRvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLFxuICAgIHRyeWluZzogJ+CsmuCth+Cst+CtjeCsn+CsviDgrJXgrLDgrYHgrJvgrL/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgrLjgrK7grY3grKrgrYLgrLDgrY3grKPgrY3grKMnLFxuICAgIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JyxcbiAgICBmYWlsZWQ6ICfgrKzgrL/grKvgrLMg4Ky54K2H4Kyy4Ky+JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICBjb21tZW50czogJ+CsruCsqOCtjeCspOCsrOCtjeCtnycsXG4gICAgZWRpdGVkOiAn4Ky44Kyu4K2N4Kyq4Ky+4Kym4Ky/4KykJyxcbiAgfSxcbiAgc2k6IHtcbiAgICBkb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsXG4gICAgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJyxcbiAgICB0cnlpbmc6ICfgtovgtq3gt4rgt4Pgt4/gt4Qg4Laa4La74La44LeS4Lax4LeK4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LaF4LeA4LeD4Lax4LeKJyxcbiAgICBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsXG4gICAgZmFpbGVkOiAn4LaF4LeD4LeP4La74LeK4Lau4Laa4La64LeSJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLFxuICAgIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsXG4gICAgY29tbWVudHM6ICfgtoXgtq/gt4Tgt4Pgt4onLFxuICAgIGVkaXRlZDogJ+C3g+C2guC3g+C3iuC2muC2u+C2q+C2uicsXG4gIH0sXG4gIHN3OiB7XG4gICAgZG93bmxvYWQ6ICdQYWt1YScsXG4gICAgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsXG4gICAgdHJ5aW5nOiAnSW5hamFyaWJ14oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSW1la2FtaWxpa2EnLFxuICAgIGVycm9yOiAnSGl0aWxhZnUnLFxuICAgIGZhaWxlZDogJ0ltZXNoaW5kd2EuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQYWt1YScsXG4gICAgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsXG4gICAgY29tbWVudHM6ICdtYW9uaScsXG4gICAgZWRpdGVkOiAnSW1laGFyaXJpd2EnLFxuICB9LFxuICB1ejoge1xuICAgIGRvd25sb2FkOiAnWXVrbGFzaCcsXG4gICAgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsXG4gICAgdHJ5aW5nOiAnVXJpbmlsbW9xZGHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUYXl5b3InLFxuICAgIGVycm9yOiAnWGF0bycsXG4gICAgZmFpbGVkOiAnTXV2YWZmYXFpeWF0c2l6LicsXG4gICAgYXJpYURvd25sb2FkOiAnWXVrbGFzaCcsXG4gICAgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJyxcbiAgICBjb21tZW50czogJ3NoYXJobGFyJyxcbiAgICBlZGl0ZWQ6ICdUYWhyaXJsYW5nYW4nLFxuICB9LFxuICBjeToge1xuICAgIGRvd25sb2FkOiAnTGF3cmx3eXRobycsXG4gICAgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJyxcbiAgICB0cnlpbmc6ICdZbiBjZWlzaW/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdXZWRpIGdvcmZmZW4nLFxuICAgIGVycm9yOiAnR3dhbGwnLFxuICAgIGZhaWxlZDogJ01ldGhvZGQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXdybHd5dGhvJyxcbiAgICB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLFxuICAgIGNvbW1lbnRzOiAnc3lsd2FkYXUnLFxuICAgIGVkaXRlZDogJ0dvbHlnd3lkJyxcbiAgfSxcbiAgenU6IHtcbiAgICBkb3dubG9hZDogJ0xhbmRhJyxcbiAgICBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsXG4gICAgdHJ5aW5nOiAnSXlhemFtYeKApicsXG4gICAgZG93bmxvYWRlZDogJ0lsYW5kxKt3ZScsXG4gICAgZXJyb3I6ICdJcGh1dGhhJyxcbiAgICBmYWlsZWQ6ICdJaGx1bGVraWxlLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFuZGEnLFxuICAgIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsXG4gICAgY29tbWVudHM6ICdhbWF6d2FuYScsXG4gICAgZWRpdGVkOiAnS3VobGVsaXdlJyxcbiAgfSxcbiAgc3E6IHtcbiAgICBkb3dubG9hZDogJ1Noa2Fya28nLFxuICAgIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLFxuICAgIHRyeWluZzogJ0R1a2UgcHJvdnVhcuKApicsXG4gICAgZG93bmxvYWRlZDogJ1DDq3JmdW5kb2knLFxuICAgIGVycm9yOiAnR2FiaW0nLFxuICAgIGZhaWxlZDogJ0TDq3NodG9pLicsXG4gICAgYXJpYURvd25sb2FkOiAnU2hrYXJrbycsXG4gICAgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLFxuICAgIGNvbW1lbnRzOiAna29tZW50ZScsXG4gICAgZWRpdGVkOiAnRSByZWRha3R1YXInLFxuICB9LFxufTtcblxuZXhwb3J0IHR5cGUgTGFuZ0tleSA9IGtleW9mIHR5cGVvZiBUUkFOU0xBVElPTlMuZW47XG5cbmV4cG9ydCBmdW5jdGlvbiB0KGtleTogTGFuZ0tleSk6IHN0cmluZyB7XG4gIHRyeSB7XG4gICAgaWYgKCFrZXkgfHwgdHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiAnLi4uJztcbiAgICB9XG5cbiAgICBsZXQgcmF3TGFuZyA9ICdlbic7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmXG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZ1xuICAgICkge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZ1xuICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgIC5zcGxpdCgnOycpWzBdXG4gICAgICAudHJpbSgpXG4gICAgICAucmVwbGFjZSgnXycsICctJyk7XG4gICAgY29uc3QgYmFzZUxhbmcgPSBub3JtYWxpemVkTGFuZy5zcGxpdCgnLScpWzBdO1xuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV07XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TW2Jhc2VMYW5nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV07XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TWydlbiddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TWydlbiddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleTtcbiAgfSBjYXRjaCB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XSB8fCBrZXk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gU3RyaW5nKGtleSB8fCAnRG93bmxvYWQnKTtcbiAgICB9XG4gIH1cbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzXG5cbi8qKlxuICogVEhFTUUgREVURUNUT1JcbiAqXG4gKiBHb2FsOiBcIklzIHRoZSBjb250ZW50IEknbSBkcmF3aW5nIG9uIHZpc3VhbGx5IGRhcmsgb3IgbGlnaHQ/XCJcbiAqIEluc3RlYWQgb2YgZ3Vlc3NpbmcgZnJvbSA8Ym9keT4sIHdlOlxuICogIC0gUmVzcGVjdCBEYXJrIFJlYWRlciBpZiBwcmVzZW50XG4gKiAgLSBMb29rIGZvciBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3Nlc1xuICogIC0gTWVhc3VyZSB0aGUgZWZmZWN0aXZlIGJhY2tncm91bmQgY29sb3Igb2YgYSAqY29udGVudCogZWxlbWVudFxuICogICAgKGUuZy4gR29vZ2xlIENsYXNzcm9vbSBzdHJlYW0gY2FyZHMpXG4gKi9cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhZ2UgKmNvbnRlbnQgYXJlYSogaXMgdmlzdWFsbHkgZGFyay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFnZURhcmsoKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMS4gRmFzdCBwYXRoOiBEYXJrIFJlYWRlciBhdHRyaWJ1dGVcbiAgY29uc3QgZHJTY2hlbWUgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRhcmtyZWFkZXItc2NoZW1lJyk7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2RhcmsnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGRyU2NoZW1lID09PSAnbGlnaHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMi4gSGV1cmlzdGljOiBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3NlcyBvbiA8aHRtbD4gLyA8Ym9keT5cbiAgLy8gKGNvdmVycyBzb21lIGZyYW1ld29ya3MgYW5kIGV4dGVuc2lvbnMpXG4gIGNvbnN0IGRhcmtUb2tlbnMgPSBbJ2RhcmsnLCAnZGFyay10aGVtZScsICd0aGVtZS1kYXJrJywgJ25pZ2h0JywgJ2dtMy1kYXJrLXRoZW1lJ107XG4gIGNvbnN0IGh0bWxDbGFzcyA9IChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBib2R5Q2xhc3MgPSAoZG9jdW1lbnQuYm9keS5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChkYXJrVG9rZW5zLnNvbWUodG9rZW4gPT4gaHRtbENsYXNzLmluY2x1ZGVzKHRva2VuKSB8fCBib2R5Q2xhc3MuaW5jbHVkZXModG9rZW4pKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gMy4gUHJvYmUgYSAqY29udGVudCogZWxlbWVudCwgbm90IHRoZSB3aG9sZSBwYWdlIGJhY2tncm91bmQuXG4gIC8vICAgIEZvciBDbGFzc3Jvb20sIHBvc3RzIGFyZSB0aGUgbWFpbiBzdXJmYWNlIHdlIGRyYXcgb24uXG4gIGNvbnN0IHByb2JlRWwgPVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdbcm9sZT1cIm1haW5cIl0nKSB8fFxuICAgIGRvY3VtZW50LmJvZHk7XG5cbiAgY29uc3QgYmdDb2xvciA9IGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihwcm9iZUVsKTtcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IHBhcnNlQnJpZ2h0bmVzcyhiZ0NvbG9yKTtcblxuICAvLyA0LiBEZWNpZGUgdGhyZXNob2xkLlxuICAvLyAgICAxMjggaXMgXCI1MCUgZ3JheVwiLCBidXQgdGhhdCBmbGlwcyB0b28gZWFybHkgb24gc2xpZ2h0bHkgZ3JheSBVSXMuXG4gIC8vICAgIFVzZSBhIHN0cmljdGVyIHRocmVzaG9sZCBzbyB3ZSBvbmx5IHRyZWF0IGNsZWFybHkgZGFyayBVSXMgYXMgZGFyay5cbiAgcmV0dXJuIGJyaWdodG5lc3MgPCAxMDU7XG59XG5cbi8qKlxuICogV2Fsa3MgdXAgdGhlIERPTSBmcm9tIGEgZ2l2ZW4gZWxlbWVudCB1bnRpbCBpdCBmaW5kcyBhIG5vbi10cmFuc3BhcmVudCBiYWNrZ3JvdW5kIGNvbG9yLlxuICogRmFsbHMgYmFjayB0byA8aHRtbD4gYW5kIGZpbmFsbHkgdG8gcHVyZSB3aGl0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHN0YXJ0OiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIGxldCBlbDogSFRNTEVsZW1lbnQgfCBudWxsID0gc3RhcnQ7XG5cbiAgY29uc3QgaXNUcmFuc3BhcmVudCA9IChjOiBzdHJpbmcgfCBudWxsKSA9PlxuICAgICFjIHx8IGMgPT09ICd0cmFuc3BhcmVudCcgfHwgYyA9PT0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4gIHdoaWxlIChlbCkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIGNvbnN0IGJnID0gc3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICAgIGlmICghaXNUcmFuc3BhcmVudChiZykpIHJldHVybiBiZztcbiAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICAvLyBUcnkgPGh0bWw+IGFzIGEgbGFzdCByZWFsIGVsZW1lbnRcbiAgY29uc3QgaHRtbFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgY29uc3QgaHRtbEJnID0gaHRtbFN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgaWYgKCFpc1RyYW5zcGFyZW50KGh0bWxCZykpIHJldHVybiBodG1sQmc7XG5cbiAgLy8gQWJzb2x1dGUgZmFsbGJhY2s6IGFzc3VtZSB3aGl0ZVxuICByZXR1cm4gJ3JnYigyNTUsIDI1NSwgMjU1KSc7XG59XG5cbi8qKlxuICogSGVscGVyOiBDYWxjdWxhdGVzIGJyaWdodG5lc3MgKDAtMjU1KSBmcm9tIGFuIFJHQihBKSBzdHJpbmcuXG4gKiBVc2VzIHRoZSBIU1AgY29sb3IgZm9ybXVsYTogc3FydCgwLjI5OSpSXjIgKyAwLjU4NypHXjIgKyAwLjExNCpCXjIpXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQnJpZ2h0bmVzcyhyZ2JTdHJpbmc6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IG1hdGNoID0gcmdiU3RyaW5nLm1hdGNoKC8oXFxkKyksXFxzKihcXGQrKSxcXHMqKFxcZCspLyk7XG4gIGlmICghbWF0Y2gpIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBwYXJzZSBpdCwgYXNzdW1lIGJyaWdodCBzbyB3ZSBkb24ndCBhY2NpZGVudGFsbHkgZmxpcCB0byBkYXJrIG1vZGUuXG4gICAgcmV0dXJuIDI1NTtcbiAgfVxuXG4gIGNvbnN0IHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICBjb25zdCBnID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcbiAgY29uc3QgYiA9IHBhcnNlSW50KG1hdGNoWzNdLCAxMCk7XG5cbiAgLy8gSFNQIGVxdWF0aW9uIGlzIHBlcmNlaXZlZCBicmlnaHRuZXNzXG4gIGNvbnN0IGJyaWdodG5lc3MgPSBNYXRoLnNxcnQoXG4gICAgMC4yOTkgKiAociAqIHIpICtcbiAgICAwLjU4NyAqIChnICogZykgK1xuICAgIDAuMTE0ICogKGIgKiBiKVxuICApO1xuXG4gIHJldHVybiBicmlnaHRuZXNzO1xufVxuXG4vKipcbiAqIFdhdGNoZXI6IE5vdGlmaWVzIHlvdSB3aGVuIHRoZSB0aGVtZSBsaWtlbHkgY2hhbmdlZC5cbiAqXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGlmIHlvdSBldmVyIHdhbnQgdG8gZHluYW1pY2FsbHkgcmUtc3R5bGUgdGhpbmdzXG4gKiB3aGVuIHRoZSB1c2VyIC8gZXh0ZW5zaW9uIHRvZ2dsZXMgdGhlbWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaFRoZW1lQ2hhbmdlcyhjYWxsYmFjazogKGlzRGFyazogYm9vbGVhbikgPT4gdm9pZCk6IE11dGF0aW9uT2JzZXJ2ZXIge1xuICBjb25zdCBoYW5kbGVyID0gKCkgPT4ge1xuICAgIGNhbGxiYWNrKGlzUGFnZURhcmsoKSk7XG4gIH07XG5cbiAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihoYW5kbGVyKTtcblxuICAvLyBXYXRjaCBmb3IgYXR0cmlidXRlL2NsYXNzIGNoYW5nZXMgb24gPGh0bWw+IGFuZCA8Ym9keT5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLWRhcmtyZWFkZXItc2NoZW1lJywgJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIC8vIEFsc28gbGlzdGVuIHRvIHN5c3RlbSB0aGVtZSBjaGFuZ2VzIGFzIGEgYmFja3VwIHNpZ25hbFxuICBpZiAodHlwZW9mIHdpbmRvdy5tYXRjaE1lZGlhID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgbXEgPSB3aW5kb3cubWF0Y2hNZWRpYSgnKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKScpO1xuICAgIGlmIChtcSkge1xuICAgICAgY29uc3QgbXFMaXN0ZW5lciA9ICgpID0+IGhhbmRsZXIoKTtcbiAgICAgIC8vIE1vZGVybiBicm93c2Vyc1xuICAgICAgaWYgKChtcSBhcyBhbnkpLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgbXEuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbXFMaXN0ZW5lcik7XG4gICAgICB9IGVsc2UgaWYgKChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKSB7XG4gICAgICAgIC8vIExlZ2FjeSBBUElcbiAgICAgICAgKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIobXFMaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSW5pdGlhbCBjYWxsIHNvIHRoZSBjb25zdW1lciBjYW4gc3luYyBpbW1lZGlhdGVseVxuICBoYW5kbGVyKCk7XG5cbiAgcmV0dXJuIG9ic2VydmVyO1xufVxuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbW1lbnRfZnJhbWUuY29udGVudC50c1xuaW1wb3J0IHsgQ09NTUVOVF9JQ09OX1VSTCB9IGZyb20gJy4vY29udGVudC9pY29ucyc7XG5pbXBvcnQgeyBpbmplY3RTdHlsZXMgfSBmcm9tICcuL2NvbnRlbnQvc3R5bGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2NvbnRlbnQvaTE4bic7XG5pbXBvcnQgeyBpc1BhZ2VEYXJrIH0gZnJvbSAnLi9jb250ZW50L3RoZW1lJztcblxuLy8gU2VsZWN0b3IgZm9yIHRoZSBtYWluIHN0cmVhbSBjYXJkXG5jb25zdCBQT1NUX1NFTEVDVE9SID0gJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXSc7XG5jb25zdCBQUk9DRVNTRURfQVRUUiA9ICdkYXRhLWNxZC1wcm9jZXNzZWQnO1xuXG4vLyDwn5S0IE5FVzogZGVib3VuY2UgZmxhZyBzbyB3ZSBkb24ndCByZXNjYW4gb24gZXZlcnkgdGlueSBtdXRhdGlvblxubGV0IGNvbW1lbnRTY2FuU2NoZWR1bGVkID0gZmFsc2U7XG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogTWFpbiBTY3JpcHRcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJ2h0dHBzOi8vY2xhc3Nyb29tLmdvb2dsZS5jb20vKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBtYWluKCkge1xuICAgIGluamVjdFN0eWxlcygpO1xuICAgIHNjYW5Gb3JDb21tZW50cygpO1xuXG4gICAgLy8gLS0tIFNUUkFURUdZIDE6IE1VVEFUSU9OIE9CU0VSVkVSIC0tLVxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgLy8g4pyFIERlYm91bmNlOiBvbmx5IG9uZSBzY2FuIHBlciBmcmFtZVxuICAgICAgaWYgKGNvbW1lbnRTY2FuU2NoZWR1bGVkKSByZXR1cm47XG4gICAgICBjb21tZW50U2NhblNjaGVkdWxlZCA9IHRydWU7XG5cbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgIGNvbW1lbnRTY2FuU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgICAgIHNjYW5Gb3JDb21tZW50cygpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgfSk7XG5cbiAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBzY2FuRm9yQ29tbWVudHMoKTtcbiAgICB9LCAyNTAwKTtcblxuICAgIGxldCBsYXN0VXJsID0gbG9jYXRpb24uaHJlZjsgXG4gICAgbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgY29uc3QgdXJsID0gbG9jYXRpb24uaHJlZjtcbiAgICAgIGlmICh1cmwgIT09IGxhc3RVcmwpIHtcbiAgICAgICAgbGFzdFVybCA9IHVybDtcbiAgICAgICAgc2V0VGltZW91dChzY2FuRm9yQ29tbWVudHMsIDUwMCk7IFxuICAgICAgfVxuICAgIH0pLm9ic2VydmUoZG9jdW1lbnQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlIH0pO1xuICB9LFxufSk7XG5cbmZ1bmN0aW9uIHNjYW5Gb3JDb21tZW50cygpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXJlY3Rpb24gPSBnZXRQYWdlRGlyZWN0aW9uKCk7XG4gICAgZG9jdW1lbnQuYm9keS5zZXRBdHRyaWJ1dGUoJ2RhdGEtY3FkLWRpcicsIGRpcmVjdGlvbik7XG5cbiAgICBjb25zdCBwb3N0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFBPU1RfU0VMRUNUT1IpO1xuXG4gICAgcG9zdHMuZm9yRWFjaCgocG9zdCkgPT4ge1xuICAgICAgaWYgKHBvc3QuaGFzQXR0cmlidXRlKFBST0NFU1NFRF9BVFRSKSkge1xuICAgICAgICBjb25zdCBleGlzdGluZ092ZXJsYXkgPSBwb3N0LnF1ZXJ5U2VsZWN0b3IoJy5jcWQtb3ZlcmxheS1jb250YWluZXInKTtcbiAgICAgICAgaWYgKGV4aXN0aW5nT3ZlcmxheSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBwb3N0LnJlbW92ZUF0dHJpYnV0ZShQUk9DRVNTRURfQVRUUik7XG4gICAgICB9XG5cbiAgICAgIC8vIFByZXZlbnQgZG91YmxlIGJvcmRlcnMgb24gbmVzdGVkIHBvc3RzXG4gICAgICBpZiAocG9zdC5wYXJlbnRFbGVtZW50Py5jbG9zZXN0KFBPU1RfU0VMRUNUT1IpKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IHJhd1RleHQgPSAocG9zdC5pbm5lclRleHQgfHwgJycpICsgJyAnICsgZ2V0QXJpYUxhYmVscyhwb3N0KTtcbiAgICAgIGNvbnN0IG1hdGNoID0gcmF3VGV4dC5tYXRjaCgvKFxcZCspXFxzK2NsYXNzIGNvbW1lbnQvaSk7XG4gICAgICBjb25zdCBjb3VudCA9IG1hdGNoID8gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKSA6IDA7XG5cbiAgICAgIGlmIChjb3VudCA+IDApIHtcbiAgICAgICAgcG9zdC5zZXRBdHRyaWJ1dGUoUFJPQ0VTU0VEX0FUVFIsICd0cnVlJyk7XG4gICAgICAgIGNyZWF0ZU92ZXJsYXkocG9zdCwgY291bnQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLndhcm4oJ0NRRCBTY2FuIEVycm9yOicsIGVycik7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlT3ZlcmxheShwb3N0OiBIVE1MRWxlbWVudCwgY291bnQ6IG51bWJlcikge1xuICBjb25zdCBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHBvc3QpO1xuICBjb25zdCBib3JkZXJSYWRpdXMgPSBjb21wdXRlZC5ib3JkZXJSYWRpdXMgfHwgJzhweCc7XG5cbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykge1xuICAgIHBvc3Quc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuICB9XG5cbiAgcG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSgnb3ZlcmZsb3cnLCAndmlzaWJsZScsICdpbXBvcnRhbnQnKTtcbiAgcG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSgnY29udGFpbicsICdub25lJywgJ2ltcG9ydGFudCcpO1xuICBwb3N0LnN0eWxlLnpJbmRleCA9ICcxJztcblxuICAvLyBSZXVzZSBvdmVybGF5IGlmIGVkaXRlZCBzY3JpcHQgYWxyZWFkeSBjcmVhdGVkIGl0XG4gIGxldCBvdmVybGF5ID0gcG9zdC5xdWVyeVNlbGVjdG9yPEhUTUxEaXZFbGVtZW50PignLmNxZC1vdmVybGF5LWNvbnRhaW5lcicpO1xuICBpZiAoIW92ZXJsYXkpIHtcbiAgICBvdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgb3ZlcmxheS5jbGFzc05hbWUgPSAnY3FkLW92ZXJsYXktY29udGFpbmVyJztcbiAgICBvdmVybGF5LnN0eWxlLmJvcmRlclJhZGl1cyA9IGJvcmRlclJhZGl1cztcblxuICAgIGlmIChpc1BhZ2VEYXJrKCkpIG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcblxuICAgIG92ZXJsYXkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgaWYgKGUudGFyZ2V0ID09PSBvdmVybGF5KSB0cmlnZ2VyUG9zdENsaWNrKHBvc3QpO1xuICAgIH0pO1xuXG4gICAgcG9zdC5hcHBlbmRDaGlsZChvdmVybGF5KTtcbiAgfVxuXG4gIC8vIERvIG5vdCBjcmVhdGUgYSBjb21tZW50IGJhZGdlIGlmIGEgQk9USCBwaWxsIGFscmVhZHkgZXhpc3RzXG4gIGlmIChwb3N0LnF1ZXJ5U2VsZWN0b3IoJy5jcWQtYm90aC1iYWRnZScpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgYmFkZ2UuY2xhc3NOYW1lID0gJ2NxZC1jb21tZW50LWJhZGdlJztcblxuICAvLyDwn5S5IFRvb2x0aXAgZm9yIGNvbW1lbnRzIHBpbGxcbiAgY29uc3QgZXhwbGFuYXRpb24gPSAnTnVtYmVyIG9mIGNvbW1lbnRzIG9uIHRoaXMgcG9zdCc7XG4gIGJhZGdlLnRpdGxlID0gZXhwbGFuYXRpb247XG4gIGJhZGdlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGV4cGxhbmF0aW9uKTtcblxuICBiYWRnZS50aXRsZSA9IGAke2NvdW50fSAke3QoJ2NvbW1lbnRzJyl9YDtcbiAgaWYgKGlzUGFnZURhcmsoKSkgYmFkZ2UuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcblxuICBjb25zdCBpY29uRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGljb25EaXYuY2xhc3NOYW1lID0gJ2NxZC1iYWRnZS1pY29uJztcbiAgaWNvbkRpdi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtDT01NRU5UX0lDT05fVVJMfVwiKWA7XG5cbiAgY29uc3QgbGFiZWxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGxhYmVsRGl2LmNsYXNzTmFtZSA9ICdjcWQtYmFkZ2UtbGFiZWwnO1xuICBsYWJlbERpdi50ZXh0Q29udGVudCA9IGAke2NvdW50fWA7XG5cbiAgYmFkZ2UuYXBwZW5kQ2hpbGQoaWNvbkRpdik7XG4gIGJhZGdlLmFwcGVuZENoaWxkKGxhYmVsRGl2KTtcblxuICBiYWRnZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0cmlnZ2VyUG9zdENsaWNrKHBvc3QpO1xuICB9KTtcblxuICBwb3N0LmFwcGVuZENoaWxkKGJhZGdlKTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlclBvc3RDbGljayhwb3N0OiBIVE1MRWxlbWVudCkge1xuICBjb25zdCB0aXRsZUxpbmsgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdhW2hyZWYqPVwiL2RldGFpbHMvXCJdLCBoMiBhJyk7XG4gIGlmICh0aXRsZUxpbmspIHtcbiAgICB0aXRsZUxpbmsuY2xpY2soKTtcbiAgfSBlbHNlIHtcbiAgICBwb3N0LmNsaWNrKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0UGFnZURpcmVjdGlvbigpOiAnbHRyJyB8ICdydGwnIHtcbiAgY29uc3QgZG9jRGlyID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRpciB8fCBkb2N1bWVudC5ib2R5LmRpcjtcbiAgaWYgKGRvY0RpciA9PT0gJ3J0bCcpIHJldHVybiAncnRsJztcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5kaXJlY3Rpb247XG4gIHJldHVybiBjb21wdXRlZCA9PT0gJ3J0bCcgPyAncnRsJyA6ICdsdHInO1xufVxuXG5mdW5jdGlvbiBnZXRBcmlhTGFiZWxzKGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIHJldHVybiBBcnJheS5mcm9tKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsXScpKVxuICAgIC5tYXAoKG5vZGUpID0+IG5vZGUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHwgJycpXG4gICAgLmpvaW4oJyAnKTtcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNDTyxRQUFNLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMkI5QixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQVVNLFFBQU0sdUJBQXVCO0FBUTdCLFFBQU0sbUJBQW1CLDJCQUEyQjtBQUFBLElBQ3pEO0FBQUEsRUFDRixDQUFDO0FDaERELFFBQU0sV0FBVztBQUNqQixRQUFNLGtCQUFrQjtBQUV4QixRQUFNLGdCQUFnQjtBQUN0QixRQUFNLGlCQUFpQixHQUFHLGFBQWE7QUFFaEMsV0FBUyxlQUFxQjtBQUNuQyxRQUFJLE9BQU8sYUFBYSxZQUFhO0FBQ3JDLFFBQUksU0FBUyxlQUFlLFFBQVEsRUFBRztBQUV2QyxVQUFNLFFBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsVUFBTSxLQUFLO0FBQ1gsVUFBTSxjQUFjO0FBQUE7QUFBQSwwQkFFSSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFtSVQscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFpSnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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QVMsVUFBUyxHQUFHLElBQUk7QUFBQSxNQUM1QyxHQUFHLE9BQU87QUFDVixXQUFLLGNBQWMsTUFBTSxtQkFBbUIsRUFBRSxDQUFDO0FBQy9DLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxpQkFBaUIsUUFBUSxNQUFNLFNBQVMsU0FBUztBQUMvQyxVQUFJLFNBQVMsc0JBQXNCO0FBQ2pDLFlBQUksS0FBSyxRQUFTLE1BQUssZ0JBQWdCLElBQUc7QUFBQSxNQUM1QztBQUNBLGFBQU87QUFBQSxRQUNMLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSTtBQUFBLFFBQ3JEO0FBQUEsUUFDQTtBQUFBLFVBQ0UsR0FBRztBQUFBLFVBQ0gsUUFBUSxLQUFLO0FBQUEsUUFDckI7QUFBQSxNQUNBO0FBQUEsSUFDRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLQSxvQkFBb0I7QUFDbEIsV0FBSyxNQUFNLG9DQUFvQztBQUMvQ0MsZUFBTztBQUFBLFFBQ0wsbUJBQW1CLEtBQUssaUJBQWlCO0FBQUEsTUFDL0M7QUFBQSxJQUNFO0FBQUEsSUFDQSxpQkFBaUI7QUFDZixhQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsTUFBTSxxQkFBcUI7QUFBQSxVQUMzQixtQkFBbUIsS0FBSztBQUFBLFVBQ3hCLFdBQVcsS0FBSyxPQUFNLEVBQUcsU0FBUyxFQUFFLEVBQUUsTUFBTSxDQUFDO0FBQUEsUUFDckQ7QUFBQSxRQUNNO0FBQUEsTUFDTjtBQUFBLElBQ0U7QUFBQSxJQUNBLHlCQUF5QixPQUFPO0FBQzlCLFlBQU0sdUJBQXVCLE1BQU0sTUFBTSxTQUFTLHFCQUFxQjtBQUN2RSxZQUFNLHNCQUFzQixNQUFNLE1BQU0sc0JBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixJQUFJLE1BQU0sTUFBTSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQ3hEO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksWUFBWSxTQUFTLGlCQUFrQjtBQUMzQyxlQUFLLGtCQUFpQjtBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUNBLHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDN0Q7QUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNiw3LDgsOSwxMCwxMV19
commentframe;