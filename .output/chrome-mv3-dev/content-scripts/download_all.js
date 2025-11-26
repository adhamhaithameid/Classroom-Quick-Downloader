var downloadall = (function() {
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
    } catch {
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
  const DOWNLOAD_BTN_SELECTOR = ".cqd-download-btn";
  const GROUP_SELECTOR = "div[data-stream-item-id]";
  const INJECTED_ATTR = "data-cqd-injected";
  const GROUP_FEEDBACK_SUCCESS_MS = 3e3;
  const groupStates = /* @__PURE__ */ new WeakMap();
  const buttonToGroup = /* @__PURE__ */ new WeakMap();
  const buttonToFile = /* @__PURE__ */ new WeakMap();
  const dirtyGroups = /* @__PURE__ */ new Set();
  let refreshScheduled = false;
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      injectStyles();
      safeSetDirection();
      registerButtonsInSubtree(document);
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            m.addedNodes.forEach((node) => {
              if (!(node instanceof HTMLElement)) return;
              registerButtonsInSubtree(node);
            });
            m.removedNodes.forEach((node) => {
              if (!(node instanceof HTMLElement)) return;
              cleanupRemovedButtons(node);
            });
          } else if (m.type === "attributes") {
            const target = m.target;
            if (target instanceof HTMLButtonElement && target.classList.contains("cqd-download-btn")) {
              const group = ensureButtonRegistered(target);
              if (group) markGroupDirty(group);
            }
          }
        }
        scheduleRefresh();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "data-cqd-all-done"]
      });
      window.setInterval(() => {
        registerButtonsInSubtree(document);
        scheduleRefresh();
      }, 4e3);
    }
  });
  function registerButtonsInSubtree(root) {
    if (root instanceof HTMLButtonElement && root.classList.contains("cqd-download-btn")) {
      registerSingleButton(root);
    }
    const buttons = root.querySelectorAll(DOWNLOAD_BTN_SELECTOR);
    buttons.forEach((btn) => registerSingleButton(btn));
  }
  function registerSingleButton(btn) {
    if (!btn.isConnected) return;
    if (buttonToGroup.has(btn) && buttonToFile.has(btn)) return;
    const groupRoot = findGroupRoot(btn);
    if (!groupRoot) return;
    let group = groupStates.get(groupRoot);
    if (!group) {
      group = {
        root: groupRoot,
        files: /* @__PURE__ */ new Map(),
        downloadAllBtn: null,
        activated: false,
        isBusy: false
      };
      groupStates.set(groupRoot, group);
    }
    const key = getCanonicalFileKey(btn);
    let file = group.files.get(key);
    if (!file) {
      file = {
        key,
        buttons: /* @__PURE__ */ new Set(),
        downloaded: false,
        failed: false,
        inProgress: false
      };
      group.files.set(key, file);
    }
    file.buttons.add(btn);
    buttonToGroup.set(btn, group);
    buttonToFile.set(btn, file);
    markGroupDirty(group);
  }
  function ensureButtonRegistered(btn) {
    let group = buttonToGroup.get(btn);
    if (!group) {
      registerSingleButton(btn);
      group = buttonToGroup.get(btn) || null;
    }
    return group;
  }
  function cleanupRemovedButtons(root) {
    const removedButtons = root.matches(DOWNLOAD_BTN_SELECTOR) ? [root] : Array.from(root.querySelectorAll(DOWNLOAD_BTN_SELECTOR));
    removedButtons.forEach((btn) => {
      const group = buttonToGroup.get(btn);
      const file = buttonToFile.get(btn);
      if (!group || !file) return;
      file.buttons.delete(btn);
      buttonToGroup.delete(btn);
      buttonToFile.delete(btn);
      if (file.buttons.size === 0) {
        group.files.delete(file.key);
      }
      markGroupDirty(group);
    });
  }
  function findGroupRoot(btn) {
    const post = btn.closest(GROUP_SELECTOR);
    if (post) return post;
    const main = btn.closest("main") || btn.closest('div[role="main"]');
    if (main) return main;
    return null;
  }
  function getCanonicalFileKey(btn) {
    const ds = btn.dataset;
    const url = ds.cqdUrl || "";
    if (url) {
      const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&](?:id|resourceId|fileId)=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        return `drive-id-${idMatch[1]}`;
      }
      try {
        const u = new URL(url);
        u.searchParams.delete("authuser");
        u.searchParams.delete("u");
        u.searchParams.delete("hl");
        return u.toString();
      } catch {
        return url;
      }
    }
    if (ds.cqdName) {
      return `${ds.cqdName}::${ds.cqdExt || ""}`;
    }
    return `btn-${Math.random().toString(36).slice(2)}`;
  }
  function getPrimaryButton(file) {
    if (file.buttons.size === 0) return null;
    let primaryVisible = null;
    let fallback = null;
    for (const btn of file.buttons) {
      if (!btn.isConnected) continue;
      if (!fallback) fallback = btn;
      if (!btn.offsetParent) continue;
      if (!primaryVisible) {
        primaryVisible = btn;
        continue;
      }
      const pos = primaryVisible.compareDocumentPosition(btn);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
        primaryVisible = btn;
      }
    }
    return primaryVisible || fallback;
  }
  function normalizeFileButtons(file) {
    if (file.buttons.size <= 1) return;
    const primary = getPrimaryButton(file);
    if (!primary) return;
    for (const btn of file.buttons) {
      if (!btn.isConnected) continue;
      if (btn === primary) {
        btn.style.removeProperty("display");
        btn.style.removeProperty("visibility");
        btn.style.removeProperty("pointer-events");
      } else {
        btn.style.setProperty("display", "none", "important");
        btn.style.setProperty("pointer-events", "none", "important");
      }
    }
  }
  function markGroupDirty(group) {
    dirtyGroups.add(group);
  }
  function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    requestAnimationFrame(() => {
      refreshScheduled = false;
      dirtyGroups.forEach(updateGroupState);
      dirtyGroups.clear();
    });
  }
  function updateGroupState(group) {
    for (const [key, file] of Array.from(group.files.entries())) {
      for (const btn2 of Array.from(file.buttons)) {
        if (!btn2.isConnected) {
          file.buttons.delete(btn2);
          buttonToGroup.delete(btn2);
          buttonToFile.delete(btn2);
        }
      }
      if (file.buttons.size === 0) {
        group.files.delete(key);
        continue;
      }
      normalizeFileButtons(file);
    }
    const totalFiles = group.files.size;
    if (totalFiles < 2) {
      if (group.downloadAllBtn && group.downloadAllBtn.isConnected) {
        group.downloadAllBtn.remove();
      }
      group.downloadAllBtn = null;
      group.activated = false;
      group.isBusy = false;
      if (group.resetTimeoutId != null) {
        window.clearTimeout(group.resetTimeoutId);
        group.resetTimeoutId = void 0;
      }
      return;
    }
    const btn = ensureDownloadAllButton(group);
    let downloaded = 0;
    let failed = 0;
    let inProgress = 0;
    for (const file of group.files.values()) {
      let someSuccess = file.downloaded;
      let someError = file.failed;
      let someLoading = file.inProgress;
      for (const b of file.buttons) {
        if (!b.isConnected) continue;
        const cls = b.classList;
        const ds = b.dataset;
        const isLoading = cls.contains("cqd-loading") || cls.contains("cqd-trying");
        const isSuccess = cls.contains("cqd-success") || ds.cqdAllDone === "true";
        const isError = cls.contains("cqd-error");
        if (isLoading) someLoading = true;
        if (isSuccess) someSuccess = true;
        if (isError) someError = true;
      }
      file.downloaded = someSuccess;
      file.inProgress = someLoading;
      file.failed = !file.downloaded && someError;
      if (file.downloaded) downloaded++;
      else if (file.inProgress) inProgress++;
      else if (file.failed) failed++;
    }
    group.isBusy = inProgress > 0;
    if (group.isBusy && group.resetTimeoutId != null) {
      window.clearTimeout(group.resetTimeoutId);
      group.resetTimeoutId = void 0;
    }
    const mainSpan = btn.querySelector(".cqd-download-all-main");
    const subSpan = btn.querySelector(".cqd-download-all-sub");
    if (!mainSpan || !subSpan) return;
    const noneStarted = downloaded === 0 && failed === 0 && inProgress === 0;
    const allSucceeded = downloaded === totalFiles && failed === 0 && totalFiles > 0;
    const allCompleted = downloaded + failed === totalFiles && inProgress === 0 && totalFiles > 0;
    if (!group.activated && !noneStarted) {
      group.activated = true;
    }
    btn.classList.remove("cqd-all-success", "cqd-all-error");
    if (!group.activated || noneStarted) {
      group.activated = group.activated && !noneStarted;
      group.isBusy = false;
      btn.disabled = false;
      mainSpan.textContent = t("downloadAll") || "Download all";
      subSpan.textContent = `${totalFiles} files`;
      setProgressVisual(btn, 0);
      return;
    }
    btn.disabled = true;
    let mainText;
    let subText;
    let progressRatio = totalFiles > 0 ? downloaded / totalFiles : 0;
    if (allSucceeded) {
      mainText = t("downloaded") || "Downloaded";
      subText = `${downloaded} / ${totalFiles}`;
      btn.classList.add("cqd-all-success");
      progressRatio = 1;
      scheduleGroupReset(group);
    } else if (allCompleted && failed > 0) {
      if (downloaded === 0) {
        mainText = t("error") || "Error";
        subText = `${failed} failed`;
        btn.classList.add("cqd-all-error");
        progressRatio = 0;
      } else {
        mainText = t("downloaded") || "Downloaded";
        subText = `${downloaded} ok, ${failed} failed`;
        btn.classList.add("cqd-all-success");
      }
      scheduleGroupReset(group);
    } else {
      mainText = t("downloading") || "Downloading…";
      if (failed === 0) {
        subText = `${downloaded} → ${totalFiles}`;
      } else {
        subText = `${downloaded} → ${totalFiles} (${failed} failed)`;
      }
    }
    mainSpan.textContent = mainText;
    subSpan.textContent = subText;
    setProgressVisual(btn, progressRatio);
  }
  function scheduleGroupReset(group) {
    if (group.resetTimeoutId != null) return;
    group.resetTimeoutId = window.setTimeout(() => {
      group.resetTimeoutId = void 0;
      group.activated = false;
      group.isBusy = false;
      group.currentRunId = void 0;
      try {
        delete group.root.dataset.cqdGroupActive;
      } catch {
      }
      for (const file of group.files.values()) {
        file.downloaded = false;
        file.failed = false;
        file.inProgress = false;
      }
      markGroupDirty(group);
      scheduleRefresh();
    }, GROUP_FEEDBACK_SUCCESS_MS);
  }
  function ensureDownloadAllButton(group) {
    const existing = group.downloadAllBtn;
    if (existing && existing.isConnected) return existing;
    const root = group.root;
    let targetContainer = root;
    let isInHeader = false;
    const menuCandidates = Array.from(root.querySelectorAll('div[role="button"], button'));
    const menuBtn = menuCandidates.find((el) => {
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return aria.includes("more options") || aria.includes("stream item options") || aria.includes("menu") || aria.includes("options");
    });
    if (menuBtn) {
      const parent = menuBtn.parentElement;
      if (parent) {
        targetContainer = parent;
        isInHeader = true;
      }
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-all-btn";
    if (isInHeader) {
      button.classList.add("cqd-in-header");
    }
    button.setAttribute(INJECTED_ATTR, "true");
    if (isPageDark()) {
      button.classList.add("cqd-theme-dark");
    }
    button.setAttribute(
      "aria-label",
      t("downloadAll") || "Download all attachments in this post"
    );
    button.title = t("downloadAll") || "Download all";
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper cqd-download-all-icon-wrapper";
    const icon = document.createElement("span");
    icon.className = "cqd-download-all-icon";
    iconWrapper.appendChild(icon);
    const mainSpan = document.createElement("span");
    mainSpan.className = "cqd-download-all-main";
    const subSpan = document.createElement("span");
    subSpan.className = "cqd-download-all-sub";
    button.appendChild(iconWrapper);
    button.appendChild(mainSpan);
    button.appendChild(subSpan);
    const computed = window.getComputedStyle(targetContainer);
    if (computed.position === "static") {
      targetContainer.style.position = "relative";
    }
    if (targetContainer === root) {
      root.style.setProperty("overflow", "visible", "important");
      root.style.setProperty("contain", "none", "important");
    }
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleDownloadAllClick(group);
    });
    targetContainer.appendChild(button);
    group.downloadAllBtn = button;
    return button;
  }
  function handleDownloadAllClick(group) {
    if (group.isBusy || group.activated) return;
    group.activated = true;
    group.isBusy = true;
    group.currentRunId = Date.now();
    try {
      group.root.dataset.cqdGroupActive = "1";
    } catch {
    }
    for (const file of group.files.values()) {
      file.downloaded = false;
      file.failed = false;
      file.inProgress = false;
    }
    if (group.resetTimeoutId != null) {
      window.clearTimeout(group.resetTimeoutId);
      group.resetTimeoutId = void 0;
    }
    const btn = group.downloadAllBtn;
    if (btn) {
      btn.disabled = true;
    }
    for (const file of group.files.values()) {
      const primary = getPrimaryButton(file);
      if (!primary) continue;
      const s = getSingleButtonState(primary);
      if (s === "idle" || s === "error") {
        primary.click();
      }
    }
    markGroupDirty(group);
    scheduleRefresh();
  }
  function getSingleButtonState(btn) {
    const cls = btn.classList;
    if (cls.contains("cqd-loading")) return "loading";
    if (cls.contains("cqd-trying")) return "trying";
    if (cls.contains("cqd-success")) return "success";
    if (cls.contains("cqd-error")) return "error";
    if (btn.dataset.cqdAllDone === "true") return "success";
    return "idle";
  }
  function setProgressVisual(btn, ratio) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const percent = Math.round(clamped * 100);
    btn.style.setProperty("--cqd-progress", `${percent}%`);
  }
  function safeSetDirection() {
    try {
      const dir = getPageDirection();
      document.body.setAttribute("data-cqd-dir", dir);
    } catch {
    }
  }
  function getPageDirection() {
    const docDir = document.documentElement.dir || document.body.dir;
    if (docDir === "rtl") return "rtl";
    const computed = window.getComputedStyle(document.body).direction;
    return computed === "rtl" ? "rtl" : "ltr";
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
    return `${browser?.runtime?.id}:${"download_all"}:${eventName}`;
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
      const ctx = new ContentScriptContext("download_all", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"download_all"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG93bmxvYWRfYWxsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaWNvbnMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaTE4bi50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9kb3dubG9hZF9hbGwuY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcblxuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuXG4gICAgICAvKiBTcGlubmVyICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmO1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAoTGlnaHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA1REQ3O1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDkzLCAyMTUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgOTMsIDIxNSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0VDNjMwMDtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC10aGVtZS1kYXJrIHtcbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gKFNpbmdsZSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWljb24td3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtaWNvbiB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLXNtYWxsIHtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAxNnB4IDE2cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLW1lZGl1bSB7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1sYXJnZSB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMzJweCAzMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXgtd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXJnaW4tbGVmdCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgd2lkdGg6IDE1MHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcge1xuICAgICAgd2lkdGg6IDExMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXRyeWluZyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXRyeWluZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcgLmNxZC1sYWJlbCxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICB3aWR0aDogOTBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIG1heC13aWR0aDogMTUwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA0MHB4O1xuICAgICAgcGFkZGluZy10b3A6IDA7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogMDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZXJyb3ItZGV0YWlsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aGl0ZS1zcGFjZTogbm9ybWFsO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDRweCk7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciB7XG4gICAgICB3aWR0aDogMzUwcHg7XG4gICAgICBtYXgtd2lkdGg6IDM2MHB4O1xuICAgICAgaGVpZ2h0OiA2MHB4O1xuICAgICAgbWF4LWhlaWdodDogNjFweDtcbiAgICAgIHBhZGRpbmc6IDhweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE4cHg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA3cHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDYwcHg7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGNxZC1zcGluIHtcbiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDIuIENPTU1FTlRTICYgRURJVEVEIChPdmVybGF5KVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgei1pbmRleDogMTA7XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCB2YXIoLS1jcWQtY29sb3ItY29tbWVudCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoOTksIDEwMiwgMjQxLCAwLjUpO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwcHgpO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kaWZmLXZhbCB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF1bZGF0YS1jcWQtcHJvY2Vzc2VkXVtkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkXSA+IC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4ICNGRjQwMzYsXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogNzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGRjQwMzY7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHBhZGRpbmctdG9wOiA4cHg7XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtc2VjdGlvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbiB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24tZWRpdGVkIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1wbHVzIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgIG1hcmdpbjogNXB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSxcbiAgICAuY3FkLWJvdGgtZGl2aWRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXgtaGVpZ2h0IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1hcmdpbi10b3AgMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogMTIwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiA0cHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiAxYi4gRE9XTkxPQUQgQUxMIEJVVFRPTiAoSGVhZGVyLWFsaWduZWQpXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biB7XG4gIC8qIFByb2dyZXNzIGNvbnRyb2wgKDAlIHRvIDEwMCUpICovXG4gIC0tY3FkLXByb2dyZXNzOiAwJTtcbiAgcG9zaXRpb246IGFic29sdXRlO1xuICAvKiBEZWZhdWx0IGZhbGxiYWNrIHBvcyBpZiBoZWFkZXIgaW5qZWN0aW9uIGZhaWxzOiAqL1xuICB0b3A6IDEycHg7XG4gIHJpZ2h0OiA0OHB4O1xuICBoZWlnaHQ6IDQwcHg7XG4gIHotaW5kZXg6IDY7XG4gIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICBhbGlnbi1pdGVtczogY2VudGVyO1xuICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgcGFkZGluZzogNHB4IDEycHg7XG4gIGJvcmRlcjogbm9uZTtcbiAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgY29sb3I6ICNmZmZmZmY7XG4gIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctbm9ybWFsKTtcbiAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBnYXA6IDZweDtcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgdHJhbnNpdGlvbjpcbiAgICBib3gtc2hhZG93IDAuMnMgZWFzZSxcbiAgICB0cmFuc2Zvcm0gMC4xcyBlYXNlLFxuICAgIGJhY2tncm91bmQtY29sb3IgMC4zcyBlYXNlO1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVooMCk7XG59XG5cbi8qICogSWYgc3VjY2Vzc2Z1bGx5IGluamVjdGVkIGludG8gdGhlIEhlYWRlciByb3cgKHRoZSBwcmVmZXJyZWQgbG9jYXRpb24pLFxuICogY2VudGVyIGl0IHZlcnRpY2FsbHkgcmVsYXRpdmUgdG8gdGhlIGF1dGhvciB0ZXh0L21lbnUgYnV0dG9uLlxuICovXG4uY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWluLWhlYWRlciB7XG4gIHRvcDogNTAlO1xuICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgdHJhbnNsYXRlWigwKTtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1pbi1oZWFkZXI6YWN0aXZlIHtcbiAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDAuOTcpO1xufVxuXG5ib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWRvd25sb2FkLWFsbC1idG4ge1xuICByaWdodDogYXV0bztcbiAgbGVmdDogNDhweDtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuOmhvdmVyIHtcbiAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bjphY3RpdmUge1xuICB0cmFuc2Zvcm06IHNjYWxlKDAuOTcpO1xufVxuXG4vKiBLZWVwIHBvaW50ZXIgY3Vyc29yIGV2ZW4gd2hpbGUgZGlzYWJsZWQgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bltkaXNhYmxlZF0ge1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG5cbi8qIEZVTEwgU1VDQ0VTUyBTVEFURSAoU29saWQgR3JlZW4pICovXG4uY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXN1Y2Nlc3MpO1xuICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1lcnJvciB7XG4gIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xufVxuXG4vKiBQUk9HUkVTUyBCQVIgT1ZFUkxBWSAoRmlsbHMgdXApICovXG4uY3FkLWRvd25sb2FkLWFsbC1idG46OmFmdGVyIHtcbiAgY29udGVudDogJyc7XG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgdG9wOiAwO1xuICBsZWZ0OiAwO1xuICBib3R0b206IDA7XG4gIHotaW5kZXg6IDA7XG5cbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXN1Y2Nlc3MpO1xuXG4gIC8qIFdpZHRoIGNvbnRyb2xsZWQgYnkgSlMgKi9cbiAgd2lkdGg6IHZhcigtLWNxZC1wcm9ncmVzcyk7XG4gIHRyYW5zaXRpb246IHdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuMjIsIDAuNjEsIDAuMzYsIDEpO1xuXG4gIG9wYWNpdHk6IDE7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLXN1Y2Nlc3M6OmFmdGVyIHtcbiAgb3BhY2l0eTogMDtcbn1cblxuLyogQ29udGVudCBsYXllcnMgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1tYWluLFxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1Yixcbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXIge1xuICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIHotaW5kZXg6IDI7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXIge1xuICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGZsZXgtc2hyaW5rOiAwO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtaWNvbiB7XG4gIHdpZHRoOiAxOHB4O1xuICBoZWlnaHQ6IDE4cHg7XG4gIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICBiYWNrZ3JvdW5kLXNpemU6IDE4cHggMThweDtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1tYWluIHtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1YiB7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgb3BhY2l0eTogMC45O1xuICBtYXJnaW4tbGVmdDogNHB4O1xufVxuXG4gIGAudHJpbSgpO1xuXG4gIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufSIsImNvbnN0IFRSQU5TTEFUSU9OUzogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgZW46IHtcbiAgICBkb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICBkb3dubG9hZGluZzogJ0Rvd25sb2FkaW5n4oCmJyxcbiAgICB0cnlpbmc6ICdUcnlpbmfigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEb3dubG9hZGVkJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdEb3dubG9hZCBmYWlsZWQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ1F1aWNrIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRzJyxcbiAgICBlZGl0ZWQ6ICdFZGl0ZWQnLFxuICAgIGRvd25sb2FkQWxsOiAnRG93bmxvYWQgYWxsJyxcbiAgfSxcbiAgYXI6IHtcbiAgICBkb3dubG9hZDogJ9iq2YbYstmK2YQnLFxuICAgIGRvd25sb2FkaW5nOiAn2KzYp9ix2Yog2KfZhNiq2YbYstmK2YTigKYnLFxuICAgIHRyeWluZzogJ9mF2K3Yp9mI2YTYqeKApicsXG4gICAgZG93bmxvYWRlZDogJ9iq2YUg2KfZhNiq2YbYstmK2YQnLFxuICAgIGVycm9yOiAn2K7Yt9ijJyxcbiAgICBmYWlsZWQ6ICfZgdi02YQg2KfZhNiq2YbYstmK2YQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfYqtmG2LLZitmEJyxcbiAgICB0aXRsZVF1aWNrOiAn2KrZhtiy2YrZhCDYs9ix2YrYuScsXG4gICAgY29tbWVudHM6ICfYqti52YTZitmC2KfYqicsXG4gICAgZWRpdGVkOiAn2KrZhSDYp9mE2KrYudiv2YrZhCcsXG4gICAgZG93bmxvYWRBbGw6ICfYqtmG2LLZitmEINin2YTZg9mEJyxcbiAgfSxcbiAgamE6IHtcbiAgICBkb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsXG4gICAgZG93bmxvYWRpbmc6ICdETOS4reKApicsXG4gICAgdHJ5aW5nOiAn6Kmm6KGM5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5a6M5LqGJyxcbiAgICBlcnJvcjogJ+OCqOODqeODvCcsXG4gICAgZmFpbGVkOiAn5aSx5pWX44GX44G+44GX44Gf44CCJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIHRpdGxlUXVpY2s6ICfjgq/jgqTjg4Pjgq/jg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIGNvbW1lbnRzOiAn5Lu244Gu44Kz44Oh44Oz44OIJyxcbiAgICBlZGl0ZWQ6ICfnt6jpm4bmuIjjgb8nLFxuICB9LFxuICBlczoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcmdhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdJbnRlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnRmFsbMOzIGxhIGRlc2NhcmdhLicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gIGhpOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KSh4KS/4KSC4KSX4oCmJyxcbiAgICB0cnlpbmc6ICfgpJXgpYvgpLbgpL/gpLYg4KSc4KS+4KSw4KWA4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+CkvycsXG4gICAgZmFpbGVkOiAn4KS14KS/4KSr4KSyIOCksOCkueCkvicsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSk4KWN4KS14KSw4KS/4KSkIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpL/gpK/gpL7gpIEnLFxuICAgIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIHB0OiB7XG4gICAgZG93bmxvYWQ6ICdCYWl4YXInLFxuICAgIGRvd25sb2FkaW5nOiAnQmFpeGFuZG/igKYnLFxuICAgIHRyeWluZzogJ1RlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQmFpeGFkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxoYSBhbyBiYWl4YXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdCYWl4YXInLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByw6FwaWRvJyxcbiAgICBjb21tZW50czogJ2NvbWVudMOhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gICdwdC1wdCc6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0EgZGVzY2FycmVnYXLigKYnLFxuICAgIHRyeWluZzogJ0EgdGVudGFy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FycmVnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGhhIGFvIGRlc2NhcnJlZ2FyLicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudMOhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gICd6aC1jbic6IHtcbiAgICBkb3dubG9hZDogJ+S4i+i9vScsXG4gICAgZG93bmxvYWRpbmc6ICfkuIvovb3kuK3igKYnLFxuICAgIHRyeWluZzogJ+WwneivleS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+W3suS4i+i9vScsXG4gICAgZXJyb3I6ICfplJnor68nLFxuICAgIGZhaWxlZDogJ+S4i+i9veWksei0pScsXG4gICAgYXJpYURvd25sb2FkOiAn5LiL6L29JyxcbiAgICB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6L29JyxcbiAgICBjb21tZW50czogJ+adoeivhOiuuicsXG4gICAgZWRpdGVkOiAn5bey57yW6L6RJyxcbiAgfSxcbiAgJ3poLXR3Jzoge1xuICAgIGRvd25sb2FkOiAn5LiL6LyJJyxcbiAgICBkb3dubG9hZGluZzogJ+S4i+i8ieS4reKApicsXG4gICAgdHJ5aW5nOiAn5ZiX6Kmm5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5bey5LiL6LyJJyxcbiAgICBlcnJvcjogJ+mMr+iqpCcsXG4gICAgZmFpbGVkOiAn5LiL6LyJ5aSx5pWXJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfkuIvovIknLFxuICAgIHRpdGxlUXVpY2s6ICflv6vpgJ/kuIvovIknLFxuICAgIGNvbW1lbnRzOiAn5YmH55WZ6KiAJyxcbiAgICBlZGl0ZWQ6ICflt7Lnt6jovK8nLFxuICB9LFxuICBmcjoge1xuICAgIGRvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsXG4gICAgZG93bmxvYWRpbmc6ICdUw6lsw6ljaGFyZ2VtZW504oCmJyxcbiAgICB0cnlpbmc6ICdFc3NhaeKApicsXG4gICAgZG93bmxvYWRlZDogJ1TDqWzDqWNoYXJnw6knLFxuICAgIGVycm9yOiAnRXJyZXVyJyxcbiAgICBmYWlsZWQ6ICfDiWNoZWMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJyxcbiAgICB0aXRsZVF1aWNrOiAnVMOpbMOpY2hhcmdlbWVudCByYXBpZGUnLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudGFpcmVzJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmnDqScsXG4gIH0sXG4gIGRlOiB7XG4gICAgZG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGVu4oCmJyxcbiAgICB0cnlpbmc6ICdWZXJzdWNoZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGZXJ0aWcnLFxuICAgIGVycm9yOiAnRmVobGVyJyxcbiAgICBmYWlsZWQ6ICdGZWhsZ2VzY2hsYWdlbi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLFxuICAgIHRpdGxlUXVpY2s6ICdTY2huZWxsZXIgRG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnS29tbWVudGFyZScsXG4gICAgZWRpdGVkOiAnQmVhcmJlaXRldCcsXG4gIH0sXG4gIGl0OiB7XG4gICAgZG93bmxvYWQ6ICdTY2FyaWNhJyxcbiAgICBkb3dubG9hZGluZzogJ1NjYXJpY2FtZW50b+KApicsXG4gICAgdHJ5aW5nOiAnUHJvdmFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTY2FyaWNhdG8nLFxuICAgIGVycm9yOiAnRXJyb3JlJyxcbiAgICBmYWlsZWQ6ICdGYWxsaXRvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU2NhcmljYScsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIHJhcGlkbycsXG4gICAgY29tbWVudHM6ICdjb21tZW50aScsXG4gICAgZWRpdGVkOiAnTW9kaWZpY2F0bycsXG4gIH0sXG4gIHJ1OiB7XG4gICAgZG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsXG4gICAgZG93bmxvYWRpbmc6ICfQodC60LDRh9C40LLQsNC90LjQteKApicsXG4gICAgdHJ5aW5nOiAn0J/QvtC/0YvRgtC60LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQodC60LDRh9Cw0L3QvicsXG4gICAgZXJyb3I6ICfQntGI0LjQsdC60LAnLFxuICAgIGZhaWxlZDogJ9Ch0LHQvtC5LicsXG4gICAgYXJpYURvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGL0YHRgtGA0L7QtSDRgdC60LDRh9C40LLQsNC90LjQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQvNC10L3RgtCw0YDQuNC10LInLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10L3QtdC90L4nLFxuICB9LFxuICBrbzoge1xuICAgIGRvd25sb2FkOiAn64uk7Jq066Gc65OcJyxcbiAgICBkb3dubG9hZGluZzogJ+uLpOyatOuhnOuTnCDspJHigKYnLFxuICAgIHRyeWluZzogJ+yLnOuPhCDspJHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfsmYTro4wnLFxuICAgIGVycm9yOiAn7Jik66WYJyxcbiAgICBmYWlsZWQ6ICfsi6TtjKjtlagnLFxuICAgIGFyaWFEb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsXG4gICAgdGl0bGVRdWljazogJ+u5oOuluCDri6TsmrTroZzrk5wnLFxuICAgIGNvbW1lbnRzOiAn6rCcIOuMk+q4gCcsXG4gICAgZWRpdGVkOiAn7IiY7KCV65CoJyxcbiAgfSxcbiAgdHI6IHtcbiAgICBkb3dubG9hZDogJ8SwbmRpcicsXG4gICAgZG93bmxvYWRpbmc6ICfEsG5kaXJpbGl5b3LigKYnLFxuICAgIHRyeWluZzogJ0RlbmVuaXlvcuKApicsXG4gICAgZG93bmxvYWRlZDogJ8SwbmRpcmlsZGknLFxuICAgIGVycm9yOiAnSGF0YScsXG4gICAgZmFpbGVkOiAnQmHFn2FyxLFzxLF6LicsXG4gICAgYXJpYURvd25sb2FkOiAnxLBuZGlyJyxcbiAgICB0aXRsZVF1aWNrOiAnSMSxemzEsSBpbmRpcicsXG4gICAgY29tbWVudHM6ICd5b3J1bScsXG4gICAgZWRpdGVkOiAnRMO8emVubGVuZGknLFxuICB9LFxuICB2aToge1xuICAgIGRvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsXG4gICAgZG93bmxvYWRpbmc6ICfEkGFuZyB04bqjaeKApicsXG4gICAgdHJ5aW5nOiAnxJBhbmcgdGjhu63igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfEkMOjIHThuqNpJyxcbiAgICBlcnJvcjogJ0zhu5dpJyxcbiAgICBmYWlsZWQ6ICdUaOG6pXQgYuG6oWkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJyxcbiAgICB0aXRsZVF1aWNrOiAnVOG6o2kgeHXhu5FuZyBuaGFuaCcsXG4gICAgY29tbWVudHM6ICduaOG6rW4geMOpdCcsXG4gICAgZWRpdGVkOiAnxJDDoyBjaOG7iW5oIHPhu61hJyxcbiAgfSxcbiAgaWQ6IHtcbiAgICBkb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICBkb3dubG9hZGluZzogJ01lbmd1bmR1aOKApicsXG4gICAgdHJ5aW5nOiAnTWVuY29iYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1NlbGVzYWknLFxuICAgIGVycm9yOiAnS2VzYWxhaGFuJyxcbiAgICBmYWlsZWQ6ICdHYWdhbC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgY2VwYXQnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXInLFxuICAgIGVkaXRlZDogJ0RpZWRpdCcsXG4gIH0sXG4gIHRoOiB7XG4gICAgZG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLFxuICAgIGRvd25sb2FkaW5nOiAn4LiB4Liz4Lil4Lix4LiH4LmC4Lir4Lil4LiU4oCmJyxcbiAgICB0cnlpbmc6ICfguJ7guKLguLLguKLguLLguKHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfguYDguKrguKPguYfguIjguKrguLTguYnguJknLFxuICAgIGVycm9yOiAn4LiC4LmJ4Lit4Lic4Li04LiU4Lie4Lil4Liy4LiUJyxcbiAgICBmYWlsZWQ6ICfguKXguYnguKHguYDguKvguKXguKcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsXG4gICAgdGl0bGVRdWljazogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lOC4lOC5iOC4p+C4mScsXG4gICAgY29tbWVudHM6ICfguITguKfguLLguKHguITguLTguJTguYDguKvguYfguJknLFxuICAgIGVkaXRlZDogJ+C5geC4geC5ieC5hOC4guC5geC4peC5ieC4pycsXG4gIH0sXG4gIHBsOiB7XG4gICAgZG93bmxvYWQ6ICdQb2JpZXJ6JyxcbiAgICBkb3dubG9hZGluZzogJ1BvYmllcmFuaWXigKYnLFxuICAgIHRyeWluZzogJ1Byw7NiYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1BvYnJhbm8nLFxuICAgIGVycm9yOiAnQsWCxIVkJyxcbiAgICBmYWlsZWQ6ICdOaWV1ZGFuZS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1BvYmllcnonLFxuICAgIHRpdGxlUXVpY2s6ICdTenlia2llIHBvYmllcmFuaWUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJ6ZScsXG4gICAgZWRpdGVkOiAnRWR5dG93YW5vJyxcbiAgfSxcbiAgbmw6IHtcbiAgICBkb3dubG9hZDogJ0Rvd25sb2FkZW4nLFxuICAgIGRvd25sb2FkaW5nOiAnRG93bmxvYWRlbuKApicsXG4gICAgdHJ5aW5nOiAnUHJvYmVyZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFhcicsXG4gICAgZXJyb3I6ICdGb3V0JyxcbiAgICBmYWlsZWQ6ICdNaXNsdWt0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWRlbicsXG4gICAgdGl0bGVRdWljazogJ1NuZWwgZG93bmxvYWRlbicsXG4gICAgY29tbWVudHM6ICdyZWFjdGllcycsXG4gICAgZWRpdGVkOiAnQmV3ZXJrdCcsXG4gIH0sXG4gIGJuOiB7XG4gICAgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahIOCmueCmmuCnjeCmm+Cnh+KApicsXG4gICAgdHJ5aW5nOiAn4Kaa4KeH4Ka34KeN4Kaf4Ka+IOCmleCmsOCmm+Cnh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCmqOCnjeCmqCcsXG4gICAgZXJyb3I6ICfgpqTgp43gprDgp4Hgpp/gpr8nLFxuICAgIGZhaWxlZDogJ+CmrOCnjeCmr+CmsOCnjeCmpSDgprngpq/gprzgp4fgppvgp4cnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgdGl0bGVRdWljazogJ+CmpuCnjeCmsOCngeCmpCDgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIGNvbW1lbnRzOiAn4Kaf4Ka/IOCmruCmqOCnjeCmpOCmrOCnjeCmrycsXG4gICAgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyxcbiAgfSxcbiAgcGE6IHtcbiAgICBkb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgZG93bmxvYWRpbmc6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEg4Ki54KmLIOCosOCov+CoueCovuKApicsXG4gICAgdHJ5aW5nOiAn4KiV4KmL4Ki44Ki84Ki/4Ki44Ki8IOConOCovuCosOCpgOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CoruCpgeColeCpsOCoruCosicsXG4gICAgZXJyb3I6ICfgqJfgqLLgqKTgqYAnLFxuICAgIGZhaWxlZDogJ+CoheCouOCoq+CosicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kik4KmH4Kic4Ki8IOCooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgY29tbWVudHM6ICfgqJ/gqL/gqbHgqKrgqKPgqYDgqIbgqIInLFxuICAgIGVkaXRlZDogJ+CouOCpsOCoquCovuCopuCov+CopCcsXG4gIH0sXG4gIHRlOiB7XG4gICAgZG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIGRvd25sb2FkaW5nOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNIOCwheCwteCxgeCwpOCxi+CwguCwpuCwv+KApicsXG4gICAgdHJ5aW5nOiAn4LCq4LGN4LCw4LCv4LCk4LGN4LCo4LC/4LC44LGN4LCk4LGL4LCC4LCm4LC/4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LCq4LGC4LCw4LGN4LCk4LCv4LC/4LCC4LCm4LC/JyxcbiAgICBlcnJvcjogJ+CwsuCxi+CwquCwgicsXG4gICAgZmFpbGVkOiAn4LC14LC/4LCr4LCy4LCu4LGI4LCC4LCm4LC/JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgsKTgsY3gsLXgsLDgsL/gsKQg4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICBjb21tZW50czogJ+CwteCxjeCwr+CwvuCwluCxjeCwr+CwsuCxgScsXG4gICAgZWRpdGVkOiAn4LC44LC14LCw4LC/4LCC4LCa4LCs4LCh4LC/4LCC4LCm4LC/JyxcbiAgfSxcbiAgbXI6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWL4KSkIOCkhuCkueClh+KApicsXG4gICAgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KSk4KWN4KSoIOCkleCksOCkpCDgpIbgpLngpYfigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KWAJyxcbiAgICBmYWlsZWQ6ICfgpIXgpK/gpLbgpLjgpY3gpLXgpYAnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KWN4KSv4KS+JyxcbiAgICBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICB0YToge1xuICAgIGRvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJyxcbiAgICBkb3dubG9hZGluZzogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuquCvjeCuquCun+CvgeCuleCuv+CuseCupOCvgeKApicsXG4gICAgdHJ5aW5nOiAn4K6u4K+B4K6v4K6x4K+N4K6a4K6/4K6V4K+N4K6V4K6/4K6x4K6k4K+B4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4K6u4K+B4K6f4K6/4K6o4K+N4K6k4K6k4K+BJyxcbiAgICBlcnJvcjogJ+CuquCuv+CutOCviCcsXG4gICAgZmFpbGVkOiAn4K6k4K+L4K6y4K+N4K614K6/JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLFxuICAgIHRpdGxlUXVpY2s6ICfgrrXgrr/grrDgr4jgrrXgr4Eg4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K6u4K+NJyxcbiAgICBjb21tZW50czogJ+CuleCusOCvgeCupOCvjeCupOCvgeCuleCus+CvjScsXG4gICAgZWRpdGVkOiAn4K6k4K6/4K6w4K+B4K6k4K+N4K6k4K6q4K+N4K6q4K6f4K+N4K6f4K6k4K+BJyxcbiAgfSxcbiAgdXI6IHtcbiAgICBkb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsXG4gICAgZG93bmxvYWRpbmc6ICfaiNin2KTZhiDZhNmI2ogg24HZiCDYsduB2Kcg24HbkuKApicsXG4gICAgdHJ5aW5nOiAn2qnZiNi02LQg2KzYp9ix24zigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfZhdqp2YXZhCcsXG4gICAgZXJyb3I6ICfYutmE2LfbjCcsXG4gICAgZmFpbGVkOiAn2YbYp9qp2KfZhScsXG4gICAgYXJpYURvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJyxcbiAgICB0aXRsZVF1aWNrOiAn2YHZiNix24wg2ojYp9ik2YYg2YTZiNqIJyxcbiAgICBjb21tZW50czogJ9iq2KjYtdix25InLFxuICAgIGVkaXRlZDogJ9iq2LHZhduM2YUg2LTYr9uBJyxcbiAgfSxcbiAgZ3U6IHtcbiAgICBkb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgZG93bmxvYWRpbmc6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEg4Kql4KqIIOCqsOCqueCrjeCqr+CrgeCqgiDgqpvgq4figKYnLFxuICAgIHRyeWluZzogJ+CqquCrjeCqsOCqr+CqvuCquCDgqprgqr7gqrLgq4HigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgqqrgq4LgqrDgq43gqqMnLFxuICAgIGVycm9yOiAn4Kqt4KuC4KqyJyxcbiAgICBmYWlsZWQ6ICfgqqjgqr/gqrfgq43gqqvgqrMnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgdGl0bGVRdWljazogJ+CqneCqoeCqquCrgCDgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIGNvbW1lbnRzOiAn4Kqf4Kq/4Kqq4KuN4Kqq4Kqj4KuA4KqTJyxcbiAgICBlZGl0ZWQ6ICfgqrjgqoLgqqrgqr7gqqbgqr/gqqQnLFxuICB9LFxuICBrbjoge1xuICAgIGRvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICBkb3dubG9hZGluZzogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjSDgsobgspfgs4HgsqTgs43gsqTgsr/gsqbgs4bigKYnLFxuICAgIHRyeWluZzogJ+CyquCzjeCysOCyr+CypOCzjeCyqOCyv+CyuOCzgeCypOCzjeCypOCyv+CypuCzhuKApicsXG4gICAgZG93bmxvYWRlZDogJ+CyquCzguCysOCzjeCyo+Cyl+CziuCyguCyoeCyv+CypuCzhicsXG4gICAgZXJyb3I6ICfgsqbgs4vgsrcnLFxuICAgIGZhaWxlZDogJ+CyteCyv+Cyq+CysuCyteCyvuCyl+Cyv+CypuCzhicsXG4gICAgYXJpYURvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICB0aXRsZVF1aWNrOiAn4LKk4LON4LK14LKw4LK/4LKkIOCyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgY29tbWVudHM6ICfgspXgsr7gsq7gs4bgsoLgsp/gs43igIzgspfgsrPgs4EnLFxuICAgIGVkaXRlZDogJ+CyuOCyguCyquCyvuCypuCyv+CyuOCysuCyvuCyl+Cyv+CypuCzhicsXG4gIH0sXG4gIG1sOiB7XG4gICAgZG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIGRvd25sb2FkaW5nOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNIOC0muC1huC0r+C1jeC0r+C1geC0qOC1jeC0qOC1geKApicsXG4gICAgdHJ5aW5nOiAn4LS24LWN4LSw4LSu4LS/4LSV4LWN4LSV4LWB4LSo4LWN4LSo4LWB4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LSq4LWC4LW84LSk4LWN4LSk4LS/4LSv4LS+4LSv4LS/JyxcbiAgICBlcnJvcjogJ+C0quC0v+C0tuC0leC1jScsXG4gICAgZmFpbGVkOiAn4LSq4LSw4LS+4LSc4LSv4LSq4LWN4LSq4LWG4LSf4LWN4LSf4LWBJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgtLXgtYfgtJfgtKTgtY3gtKTgtL/gtb0g4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICBjb21tZW50czogJ+C0heC0reC0v+C0quC1jeC0sOC0vuC0r+C0meC1jeC0meC1vicsXG4gICAgZWRpdGVkOiAn4LSO4LSh4LS/4LSx4LWN4LSx4LWB4LSa4LWG4LSv4LWN4LSk4LWBJyxcbiAgfSxcbiAgdWs6IHtcbiAgICBkb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0JfQsNCy0LDQvdGC0LDQttC10L3QvdGP4oCmJyxcbiAgICB0cnlpbmc6ICfQodC/0YDQvtCx0LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0J/QvtC80LjQu9C60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXQstC00LDRh9CwLicsXG4gICAgYXJpYURvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsXG4gICAgdGl0bGVRdWljazogJ9Co0LLQuNC00LrQtSDQt9Cw0LLQsNC90YLQsNC20LXQvdC90Y8nLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNGW0LInLFxuICAgIGVkaXRlZDogJ9CX0LzRltC90LXQvdC+JyxcbiAgfSxcbiAgZWw6IHtcbiAgICBkb3dubG9hZDogJ86bzq7PiM63JyxcbiAgICBkb3dubG9hZGluZzogJ86bzq7PiM634oCmJyxcbiAgICB0cnlpbmc6ICfOoM+Bzr/Pg8+AzqzOuM61zrnOseKApicsXG4gICAgZG93bmxvYWRlZDogJ86fzrvOv866zrvOt8+Bz47OuM63zrrOtScsXG4gICAgZXJyb3I6ICfOo8+GzqzOu868zrEnLFxuICAgIGZhaWxlZDogJ86Rz4DOrc+Ez4XPh861LicsXG4gICAgYXJpYURvd25sb2FkOiAnzpvOrs+IzrcnLFxuICAgIHRpdGxlUXVpY2s6ICfOk8+Bzq7Os86/z4HOtyDOu86uz4jOtycsXG4gICAgY29tbWVudHM6ICfPg8+Hz4zOu865zrEnLFxuICAgIGVkaXRlZDogJ86Vz4DOtc6+zrXPgc6zzrHPg868zq3Ovc6/JyxcbiAgfSxcbiAgY3M6IHtcbiAgICBkb3dubG9hZDogJ1N0w6Fobm91dCcsXG4gICAgZG93bmxvYWRpbmc6ICdTdGFob3bDoW7DreKApicsXG4gICAgdHJ5aW5nOiAnWmtvdcWhw61t4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU3Rhxb5lbm8nLFxuICAgIGVycm9yOiAnQ2h5YmEnLFxuICAgIGZhaWxlZDogJ1NlbGhhbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTdMOhaG5vdXQnLFxuICAgIHRpdGxlUXVpY2s6ICdSeWNobMOpIHN0YcW+ZW7DrScsXG4gICAgY29tbWVudHM6ICdrb21lbnTDocWZxa8nLFxuICAgIGVkaXRlZDogJ1VwcmF2ZW5vJyxcbiAgfSxcbiAgcm86IHtcbiAgICBkb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsXG4gICAgZG93bmxvYWRpbmc6ICdTZSBkZXNjYXJjxIPigKYnLFxuICAgIHRyeWluZzogJ1NlIMOubmNlYXJjxIPigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGaW5hbGl6YXQnLFxuICAgIGVycm9yOiAnRXJvYXJlJyxcbiAgICBmYWlsZWQ6ICdFyJl1YXQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjxINyY2FyZSByYXBpZMSDJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaWknLFxuICAgIGVkaXRlZDogJ01vZGlmaWNhdCcsXG4gIH0sXG4gIGh1OiB7XG4gICAgZG93bmxvYWQ6ICdMZXTDtmx0w6lzJyxcbiAgICBkb3dubG9hZGluZzogJ0xldMO2bHTDqXPigKYnLFxuICAgIHRyeWluZzogJ1Byw7Niw6Fsa296w6Fz4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS8Opc3onLFxuICAgIGVycm9yOiAnSGliYScsXG4gICAgZmFpbGVkOiAnU2lrZXJ0ZWxlbi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xldMO2bHTDqXMnLFxuICAgIHRpdGxlUXVpY2s6ICdHeW9ycyBsZXTDtmx0w6lzJyxcbiAgICBjb21tZW50czogJ21lZ2plZ3l6w6lzJyxcbiAgICBlZGl0ZWQ6ICdTemVya2VzenR2ZScsXG4gIH0sXG4gIHN2OiB7XG4gICAgZG93bmxvYWQ6ICdMYWRkYSBuZXInLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkZGFyIG5lcuKApicsXG4gICAgdHJ5aW5nOiAnRsO2cnPDtmtlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYXJ0JyxcbiAgICBlcnJvcjogJ0ZlbCcsXG4gICAgZmFpbGVkOiAnTWlzc2x5Y2thZGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFkZGEgbmVyJyxcbiAgICB0aXRsZVF1aWNrOiAnU25hYmIgbmVkbGFkZG5pbmcnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJhZCcsXG4gIH0sXG4gIGRhOiB7XG4gICAgZG93bmxvYWQ6ICdIZW50JyxcbiAgICBkb3dubG9hZGluZzogJ0hlbnRlcuKApicsXG4gICAgdHJ5aW5nOiAnUHLDuHZlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0hlbnRldCcsXG4gICAgZXJyb3I6ICdGZWpsJyxcbiAgICBmYWlsZWQ6ICdNaXNseWtrZWRlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0hlbnQnLFxuICAgIHRpdGxlUXVpY2s6ICdIdXJ0aWcgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJldCcsXG4gIH0sXG4gIGZpOiB7XG4gICAgZG93bmxvYWQ6ICdMYXRhYScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRhdGFhbuKApicsXG4gICAgdHJ5aW5nOiAnWXJpdGV0w6TDpG7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdMYWRhdHR1JyxcbiAgICBlcnJvcjogJ1ZpcmhlJyxcbiAgICBmYWlsZWQ6ICdFcMOkb25uaXN0dWkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXRhYScsXG4gICAgdGl0bGVRdWljazogJ1Bpa2FsYXRhdXMnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudHRpYScsXG4gICAgZWRpdGVkOiAnTXVva2F0dHUnLFxuICB9LFxuICBubzoge1xuICAgIGRvd25sb2FkOiAnTGFzdCBuZWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFzdGVyIG5lZOKApicsXG4gICAgdHJ5aW5nOiAnUHLDuHZlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0ZlcmRpZycsXG4gICAgZXJyb3I6ICdGZWlsJyxcbiAgICBmYWlsZWQ6ICdNaXNseWt0ZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXN0IG5lZCcsXG4gICAgdGl0bGVRdWljazogJ1Jhc2sgbmVkbGFzdGluZycsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcnQnLFxuICB9LFxuICBoZToge1xuICAgIGRvd25sb2FkOiAn15TXldeo15PXlCcsXG4gICAgZG93bmxvYWRpbmc6ICfXnteV16jXmdeT4oCmJyxcbiAgICB0cnlpbmc6ICfXnteg16HXlOKApicsXG4gICAgZG93bmxvYWRlZDogJ9eU15XXqdec150nLFxuICAgIGVycm9yOiAn16nXkteZ15DXlCcsXG4gICAgZmFpbGVkOiAn16DXm9ep15wnLFxuICAgIGFyaWFEb3dubG9hZDogJ9eU15XXqNeT15QnLFxuICAgIHRpdGxlUXVpY2s6ICfXlNeV16jXk9eUINee15TXmdeo15QnLFxuICAgIGNvbW1lbnRzOiAn16rXkteV15HXldeqJyxcbiAgICBlZGl0ZWQ6ICfXoNei16jXmicsXG4gIH0sXG4gIGZhOiB7XG4gICAgZG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLFxuICAgIGRvd25sb2FkaW5nOiAn2K/Ysdit2KfZhCDYr9in2YbZhNmI2K/igKYnLFxuICAgIHRyeWluZzogJ9iq2YTYp9i0INmF2KzYr9iv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2KfZhtis2KfZhSDYtNivJyxcbiAgICBlcnJvcjogJ9iu2LfYpycsXG4gICAgZmFpbGVkOiAn2YbYp9mF2YjZgdmCJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLFxuICAgIHRpdGxlUXVpY2s6ICfYr9in2YbZhNmI2K8g2LPYsduM2LknLFxuICAgIGNvbW1lbnRzOiAn2YbYuNixJyxcbiAgICBlZGl0ZWQ6ICfZiNuM2LHYp9uM2LQg2LTYr9mHJyxcbiAgfSxcbiAgZmlsOiB7XG4gICAgZG93bmxvYWQ6ICdJLWRvd25sb2FkJyxcbiAgICBkb3dubG9hZGluZzogJ05hZ2RhLWRvd25sb2Fk4oCmJyxcbiAgICB0cnlpbmc6ICdTaW51c3VidWthbuKApicsXG4gICAgZG93bmxvYWRlZDogJ1RhcG9zIG5hJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdOYWJpZ28uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdJLWRvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnTWFiaWxpcyBuYSBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdtZ2Ega29tZW50bycsXG4gICAgZWRpdGVkOiAnTmEtZWRpdCcsXG4gIH0sXG4gIG1zOiB7XG4gICAgZG93bmxvYWQ6ICdNdWF0IHR1cnVuJyxcbiAgICBkb3dubG9hZGluZzogJ01lbXVhdCB0dXJ1buKApicsXG4gICAgdHJ5aW5nOiAnTWVuY3ViYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1NlbGVzYWknLFxuICAgIGVycm9yOiAnUmFsYXQnLFxuICAgIGZhaWxlZDogJ0dhZ2FsLicsXG4gICAgYXJpYURvd25sb2FkOiAnTXVhdCB0dXJ1bicsXG4gICAgdGl0bGVRdWljazogJ011YXQgdHVydW4gcGFudGFzJyxcbiAgICBjb21tZW50czogJ2tvbWVuJyxcbiAgICBlZGl0ZWQ6ICdEaWVkaXQnLFxuICB9LFxuICBzcjoge1xuICAgIGRvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0J/RgNC10YPQt9C40LzQsNGa0LXigKYnLFxuICAgIHRyeWluZzogJ9Cf0L7QutGD0YjQsNCy0LDQvOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CX0LDQstGA0YjQtdC90L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YDQt9C+INC/0YDQtdGD0LfQuNC80LDRmtC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQsCcsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXRmtC10L3QvicsXG4gIH0sXG4gIHNrOiB7XG4gICAgZG93bmxvYWQ6ICdTdGlhaG51xaUnLFxuICAgIGRvd25sb2FkaW5nOiAnU8WlYWhvdmFuaWXigKYnLFxuICAgIHRyeWluZzogJ1Nrw7rFoWFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSG90b3ZvJyxcbiAgICBlcnJvcjogJ0NoeWJhJyxcbiAgICBmYWlsZWQ6ICdabHloYWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU3RpYWhudcWlJyxcbiAgICB0aXRsZVF1aWNrOiAnUsO9Y2hsZSBzdGlhaG51dGllJyxcbiAgICBjb21tZW50czogJ2tvbWVudMOhcm92JyxcbiAgICBlZGl0ZWQ6ICdVcHJhdmVuw6knLFxuICB9LFxuICBiZzoge1xuICAgIGRvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0JjQt9GC0LXQs9C70Y/QvdC14oCmJyxcbiAgICB0cnlpbmc6ICfQntC/0LjRguKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRitGA0LfQviDQuNC30YLQtdCz0LvRj9C90LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJyxcbiAgICBlZGl0ZWQ6ICfQoNC10LTQsNC60YLQuNGA0LDQvdC+JyxcbiAgfSxcbiAgaHI6IHtcbiAgICBkb3dubG9hZDogJ1ByZXV6bWknLFxuICAgIGRvd25sb2FkaW5nOiAnUHJldXppbWFuamXigKYnLFxuICAgIHRyeWluZzogJ1Bva3XFoWF2YW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdHb3Rvdm8nLFxuICAgIGVycm9yOiAnR3JlxaFrYScsXG4gICAgZmFpbGVkOiAnTmV1c3BqZWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnUHJldXptaScsXG4gICAgdGl0bGVRdWljazogJ0Jyem8gcHJldXppbWFuamUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJhJyxcbiAgICBlZGl0ZWQ6ICdVcmXEkWVubycsXG4gIH0sXG4gIGx0OiB7XG4gICAgZG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsXG4gICAgZG93bmxvYWRpbmc6ICdTaXVuxI1pYW1h4oCmJyxcbiAgICB0cnlpbmc6ICdCYW5kb21h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQmFpZ3RhJyxcbiAgICBlcnJvcjogJ0tsYWlkYScsXG4gICAgZmFpbGVkOiAnTmVwYXZ5a28uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsXG4gICAgdGl0bGVRdWljazogJ0dyZWl0YXMgYXRzaXNpdW50aW1hcycsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmFpJyxcbiAgICBlZGl0ZWQ6ICdSZWRhZ3VvdGEnLFxuICB9LFxuICBsdjoge1xuICAgIGRvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLFxuICAgIGRvd25sb2FkaW5nOiAnTGVqdXBpZWzEgWTEk+KApicsXG4gICAgdHJ5aW5nOiAnTcSTxKNpbmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQYWJlaWd0cycsXG4gICAgZXJyb3I6ICdLxLzFq2RhJyxcbiAgICBmYWlsZWQ6ICdOZWl6ZGV2xIFzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLFxuICAgIHRpdGxlUXVpY2s6ICfEgHRyxIEgbGVqdXBpZWzEgWRlJyxcbiAgICBjb21tZW50czogJ2tvbWVudMSBcmknLFxuICAgIGVkaXRlZDogJ1JlZGnEo8STdHMnLFxuICB9LFxuICBldDoge1xuICAgIGRvd25sb2FkOiAnTGFhZGkgYWxsYScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWFkaW1pbmXigKYnLFxuICAgIHRyeWluZzogJ1Byb292aW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdWYWxtaXMnLFxuICAgIGVycm9yOiAnVmlnYScsXG4gICAgZmFpbGVkOiAnRWJhw7VubmVzdHVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFhZGkgYWxsYScsXG4gICAgdGl0bGVRdWljazogJ0tpaXJlIGFsbGFsYWFkaW1pbmUnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFhcmknLFxuICAgIGVkaXRlZDogJ011dWRldHVkJyxcbiAgfSxcbiAgc2w6IHtcbiAgICBkb3dubG9hZDogJ1ByZW5vcycsXG4gICAgZG93bmxvYWRpbmc6ICdQcmVuYcWhYW5qZeKApicsXG4gICAgdHJ5aW5nOiAnUG9za3XFoWFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS29uxI1hbm8nLFxuICAgIGVycm9yOiAnTmFwYWthJyxcbiAgICBmYWlsZWQ6ICdOaSB1c3BlbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQcmVub3MnLFxuICAgIHRpdGxlUXVpY2s6ICdIaXRlciBwcmVub3MnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJqZXYnLFxuICAgIGVkaXRlZDogJ1VyZWplbm8nLFxuICB9LFxuICBjYToge1xuICAgIGRvd25sb2FkOiAnRGVzY2FycmVnYScsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJyZWdhbnTigKYnLFxuICAgIHRyeWluZzogJ0ludGVudGFudOKApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2F0JyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdIYSBmYWxsYXQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY8OgcnJlZ2EgcsOgcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlzJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YXQnLFxuICB9LFxuICBhZjoge1xuICAgIGRvd25sb2FkOiAnQWZsYWFpJyxcbiAgICBkb3dubG9hZGluZzogJ0xhYWkgYWbigKYnLFxuICAgIHRyeWluZzogJ1Byb2JlZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFhcicsXG4gICAgZXJyb3I6ICdGb3V0JyxcbiAgICBmYWlsZWQ6ICdNaXNsdWsuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdBZmxhYWknLFxuICAgIHRpdGxlUXVpY2s6ICdWaW5uaWdlIGFmbGFhaScsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlJyxcbiAgICBlZGl0ZWQ6ICdHZXJlZGlnZWVyJyxcbiAgfSxcbiAgYW06IHtcbiAgICBkb3dubG9hZDogJ+GKoOGLjeGIreGLtScsXG4gICAgZG93bmxvYWRpbmc6ICfhiaDhiJvhi43hiKjhi7Ug4YiL4Yut4oCmJyxcbiAgICB0cnlpbmc6ICfhiaDhiJjhiJ7hiqjhiK0g4YiL4Yut4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4YuI4Yit4Yu34YiNJyxcbiAgICBlcnJvcjogJ+GIteGIheGJsOGJtScsXG4gICAgZmFpbGVkOiAn4Yqg4YiN4Ymw4Yiz4Yqr4Yid4Y2iJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLFxuICAgIHRpdGxlUXVpY2s6ICfhjYjhjKPhipUg4Yib4YuN4Yio4Yu1JyxcbiAgICBjb21tZW50czogJ+GKoOGIteGJsOGLq+GLqOGJtuGJvScsXG4gICAgZWRpdGVkOiAn4Ymw4Yi14Ymw4Yqr4Yqt4YiP4YiNJyxcbiAgfSxcbiAgaHk6IHtcbiAgICBkb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsXG4gICAgZG93bmxvYWRpbmc6ICfVhtWl1oDVotWl1bzVttW41oLVtOKApicsXG4gICAgdHJ5aW5nOiAn1ZPVuNaA1bHVuNaC1bQg1afigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfUsdW+1aHWgNW/1b7VodWuJyxcbiAgICBlcnJvcjogJ9WN1a3VodWsJyxcbiAgICBmYWlsZWQ6ICfVgdWh1a3VuNWy1b7VpdaBOicsXG4gICAgYXJpYURvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJyxcbiAgICB0aXRsZVF1aWNrOiAn1LHWgNWh1aMg1bbVpdaA1aLVpdW81bbVuNaC1bQnLFxuICAgIGNvbW1lbnRzOiAn1bTVpdWv1bbVodWi1aHVttW41oLVqdW11bjWgtW2JyxcbiAgICBlZGl0ZWQ6ICfUvdW01aLVodWj1oDVvtWl1awg1acnLFxuICB9LFxuICBhczoge1xuICAgIGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoSDgprngp4gg4KaG4Kab4KeH4oCmJyxcbiAgICB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kew4Ka/IOCmhuCmm+Cnh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCnguCnsOCnjeCmoycsXG4gICAgZXJyb3I6ICfgpqTgp43gp7Dgp4Hgpp/gpr8nLFxuICAgIGZhaWxlZDogJ+CmrOCmv+Cmq+CmsiDgprnigJngprInLFxuICAgIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgdGl0bGVRdWljazogJ+CmpuCnjeCnsOCngeCmpCDgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIGNvbW1lbnRzOiAn4Kau4Kao4KeN4Kak4Kas4KeN4KavJyxcbiAgICBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnLFxuICB9LFxuICBhejoge1xuICAgIGRvd25sb2FkOiAnWcO8a2zJmScsXG4gICAgZG93bmxvYWRpbmc6ICdZw7xrbMmZbmly4oCmJyxcbiAgICB0cnlpbmc6ICdDyZloZCBlZGlsaXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCaXRkaScsXG4gICAgZXJyb3I6ICdYyZl0YScsXG4gICAgZmFpbGVkOiAnQWzEsW5tYWTEsS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1nDvGtsyZknLFxuICAgIHRpdGxlUXVpY2s6ICdTw7xyyZl0bGkgecO8a2zJmW3JmScsXG4gICAgY29tbWVudHM6ICfFn8mZcmgnLFxuICAgIGVkaXRlZDogJ0TDvHrJmWxpxZ8gZWRpbGliJyxcbiAgfSxcbiAgZXU6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2thcmdhdHUnLFxuICAgIGRvd25sb2FkaW5nOiAnRGVza2FyZ2F0emVu4oCmJyxcbiAgICB0cnlpbmc6ICdTYWlhdHplbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0VnaW5kYScsXG4gICAgZXJyb3I6ICdFcnJvcmVhJyxcbiAgICBmYWlsZWQ6ICdIdXRzIGVnaW4gZHUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNrYXJnYXR1JyxcbiAgICB0aXRsZVF1aWNrOiAnRGVza2FyZ2EgYXprYXJyYScsXG4gICAgY29tbWVudHM6ICdpcnV6a2luJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YXR1YScsXG4gIH0sXG4gIG15OiB7XG4gICAgZG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIGRvd25sb2FkaW5nOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6IOGAnOGAr+GAleGAuuGAlOGAseKApicsXG4gICAgdHJ5aW5nOiAn4YCA4YC84YCt4YCv4YC44YCF4YCs4YC44YCU4YCx4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4YCV4YC84YCu4YC44YCV4YCr4YCV4YC84YCuJyxcbiAgICBlcnJvcjogJ+GAoeGAmeGAvuGArOGAuCcsXG4gICAgZmFpbGVkOiAn4YCZ4YCh4YCx4YCs4YCE4YC64YCZ4YC84YCE4YC64YCV4YCr4YGLJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIHRpdGxlUXVpY2s6ICfhgKHhgJnhgLzhgJThgLog4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICBjb21tZW50czogJ+GAmeGAvuGAkOGAuuGAgeGAu+GAgOGAuuGAmeGAu+GArOGAuCcsXG4gICAgZWRpdGVkOiAn4YCV4YC84YCE4YC64YCG4YCE4YC64YCV4YC84YCu4YC4JyxcbiAgfSxcbiAgZ2w6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsXG4gICAgdHJ5aW5nOiAnVGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGxvdS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICBrYToge1xuICAgIGRvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICBkb3dubG9hZGluZzogJ+GDmOGDrOGDlOGDoOGDlOGDkeGDkOKApicsXG4gICAgdHJ5aW5nOiAn4YOb4YOq4YOT4YOU4YOa4YOd4YOR4YOQ4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4YOT4YOQ4YOh4YOg4YOj4YOa4YOT4YOQJyxcbiAgICBlcnJvcjogJ+GDqOGDlOGDquGDk+GDneGDm+GDkCcsXG4gICAgZmFpbGVkOiAn4YOV4YOU4YOgIOGDm+GDneGDruGDlOGDoOGDruGDk+GDkC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgdGl0bGVRdWljazogJ+GDoeGDrOGDoOGDkOGDpOGDmCDhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIGNvbW1lbnRzOiAn4YOZ4YOd4YOb4YOU4YOc4YOi4YOQ4YOg4YOYJyxcbiAgICBlZGl0ZWQ6ICfhg6Dhg5Thg5Phg5Dhg6Xhg6Lhg5jhg6Dhg5Thg5Hhg6Phg5rhg5jhg5AnLFxuICB9LFxuICBpczoge1xuICAgIGRvd25sb2FkOiAnU8Oma2phJyxcbiAgICBkb3dubG9hZGluZzogJ1PDpmtpcuKApicsXG4gICAgdHJ5aW5nOiAnUmV5bmnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTw7N0dCcsXG4gICAgZXJyb3I6ICdWaWxsYScsXG4gICAgZmFpbGVkOiAnTWlzdMOza3N0LicsXG4gICAgYXJpYURvd25sb2FkOiAnU8Oma2phJyxcbiAgICB0aXRsZVF1aWNrOiAnRmzDvXRpbmnDsHVyaGFsJyxcbiAgICBjb21tZW50czogJ3VtbcOmbGknLFxuICAgIGVkaXRlZDogJ0JyZXl0dCcsXG4gIH0sXG4gIGdhOiB7XG4gICAgZG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLFxuICAgIGRvd25sb2FkaW5nOiAnQWcgw61vc2zDs2TDoWls4oCmJyxcbiAgICB0cnlpbmc6ICdBZyBpYXJyYWlkaOKApicsXG4gICAgZG93bmxvYWRlZDogJ8ONb3Nsw7Nkw6FpbHRlJyxcbiAgICBlcnJvcjogJ0VhcnLDoWlkJyxcbiAgICBmYWlsZWQ6ICdUaGVpcCBhaXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLFxuICAgIHRpdGxlUXVpY2s6ICfDjW9zbMOzZMOhaWwgdGFwYScsXG4gICAgY29tbWVudHM6ICd0csOhY2h0JyxcbiAgICBlZGl0ZWQ6ICdFYWdyYWl0aGUnLFxuICB9LFxuICBrazoge1xuICAgIGRvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsXG4gICAgZG93bmxvYWRpbmc6ICfQltKv0LrRgtC10LvRg9C00LXigKYnLFxuICAgIHRyeWluZzogJ9OY0YDQtdC60LXRguKApicsXG4gICAgZG93bmxvYWRlZDogJ9CQ0Y/Sm9GC0LDQu9C00YsnLFxuICAgIGVycm9yOiAn0prQsNGC0LUnLFxuICAgIGZhaWxlZDogJ9Ch05nRgtGB0ZbQty4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLFxuICAgIHRpdGxlUXVpY2s6ICfQltGL0LvQtNCw0Lwg0LbSr9C60YLQtdGDJyxcbiAgICBjb21tZW50czogJ9C/0ZbQutGW0YAnLFxuICAgIGVkaXRlZDogJ9Oo0LfQs9C10YDRgtGW0LvQtNGWJyxcbiAgfSxcbiAga206IHtcbiAgICBkb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsXG4gICAgZG93bmxvYWRpbmc6ICfhnoDhn4bhnpbhnrvhnoThnpHhnrbhnonhnpnhnoDigKYnLFxuICAgIHRyeWluZzogJ+GegOGfhuGeluGeu+GehOGeluGfkuGemeGetuGemeGetuGemOKApicsXG4gICAgZG93bmxvYWRlZDogJ+GelOGetuGek+GelOGeieGfkuGeheGelOGfiycsXG4gICAgZXJyb3I6ICfhnoDhn4bhnqDhnrvhnp8nLFxuICAgIGZhaWxlZDogJ+GelOGemuGetuGeh+GfkOGemScsXG4gICAgYXJpYURvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJyxcbiAgICB0aXRsZVF1aWNrOiAn4Z6R4Z624Z6J4Z6Z4Z6A4Z6b4Z6/4Z6TJyxcbiAgICBjb21tZW50czogJ+GemOGej+GetycsXG4gICAgZWRpdGVkOiAn4Z6U4Z624Z6T4Z6A4Z+C4Z6f4Z6Y4Z+S4Z6a4Z694Z6bJyxcbiAgfSxcbiAgbG86IHtcbiAgICBkb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsXG4gICAgZG93bmxvYWRpbmc6ICfguoHgurPguqXgurHguofgupTgurLguqfgu4LguqvguqXgupTigKYnLFxuICAgIHRyeWluZzogJ+C6geC6s+C6peC6seC6h+C6nuC6sOC6jeC6suC6jeC6suC6oeKApicsXG4gICAgZG93bmxvYWRlZDogJ+C6quC6s+C7gOC6peC6seC6lCcsXG4gICAgZXJyb3I6ICfgupzgurTgupTgup7gurLgupQnLFxuICAgIGZhaWxlZDogJ+C6peC6u+C7ieC6oeC7gOC6q+C6peC6pycsXG4gICAgYXJpYURvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJyxcbiAgICB0aXRsZVF1aWNrOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4LqU4LuI4Lqn4LqZJyxcbiAgICBjb21tZW50czogJ+C6hOC6s+C7gOC6q+C6seC6mScsXG4gICAgZWRpdGVkOiAn4LuB4LqB4LuJ4LuE4LqC4LuB4Lql4LuJ4LqnJyxcbiAgfSxcbiAgbWs6IHtcbiAgICBkb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JyxcbiAgICBkb3dubG9hZGluZzogJ9Cf0YDQtdC30LXQvNCw0ZrQteKApicsXG4gICAgdHJ5aW5nOiAn0KHQtSDQvtCx0LjQtNGD0LLQsNC84oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXQt9C10LzQsNGa0LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNC4JyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdC90LXRgtC+JyxcbiAgfSxcbiAgbW46IHtcbiAgICBkb3dubG9hZDogJ9Ci0LDRgtCw0YUnLFxuICAgIGRvd25sb2FkaW5nOiAn0KLQsNGC0LDQtiDQsdCw0LnQvdCw4oCmJyxcbiAgICB0cnlpbmc6ICfQntGA0LvQtNC+0LYg0LHQsNC50L3QsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9Ci0LDRgtGB0LDQvScsXG4gICAgZXJyb3I6ICfQkNC70LTQsNCwJyxcbiAgICBmYWlsZWQ6ICfQkNC80LbQuNC70YLQs9Kv0LkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQotCw0YLQsNGFJyxcbiAgICB0aXRsZVF1aWNrOiAn0KXRg9GA0LTQsNC9INGC0LDRgtCw0YUnLFxuICAgIGNvbW1lbnRzOiAn0YHRjdGC0LPRjdCz0LTRjdC7JyxcbiAgICBlZGl0ZWQ6ICfQl9Cw0YHRgdCw0L0nLFxuICB9LFxuICBuZToge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoSDgpLngpYHgpIHgpKbgpYjigKYnLFxuICAgIHRyeWluZzogJ+CkquCljeCksOCkr+CkvuCkuCDgpJfgpLDgpY3gpKbgpYjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpL4g4KSt4KSv4KWLJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+CkvycsXG4gICAgZmFpbGVkOiAn4KSF4KS44KSr4KSyIOCkreCkr+CliycsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSb4KS/4KSf4KWLIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpYDgpLngpLDgpYInLFxuICAgIGVkaXRlZDogJ+CkuOCkruCljeCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIG9yOiB7XG4gICAgZG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIGRvd25sb2FkaW5nOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NIOCsueCth+CsieCsm+Csv+KApicsXG4gICAgdHJ5aW5nOiAn4Kya4K2H4Ky34K2N4Kyf4Ky+IOCsleCssOCtgeCsm+Csv+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CsuOCsruCtjeCsquCtguCssOCtjeCso+CtjeCsoycsXG4gICAgZXJyb3I6ICfgrKTgrY3grLDgrYHgrJ/grL8nLFxuICAgIGZhaWxlZDogJ+CsrOCsv+Csq+CssyDgrLngrYfgrLLgrL4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgdGl0bGVRdWljazogJ+CstuCtgOCsmOCtjeCssCDgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIGNvbW1lbnRzOiAn4Kyu4Kyo4K2N4Kyk4Kys4K2N4K2fJyxcbiAgICBlZGl0ZWQ6ICfgrLjgrK7grY3grKrgrL7grKbgrL/grKQnLFxuICB9LFxuICBzaToge1xuICAgIGRvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJyxcbiAgICBkb3dubG9hZGluZzogJ+C2tuC3j+C2nOC2rSDgt4Dgt5ngtrjgt5LgtrHgt4rigKYnLFxuICAgIHRyeWluZzogJ+C2i+C2reC3iuC3g+C3j+C3hCDgtprgtrvgtrjgt5LgtrHgt4rigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgtoXgt4Dgt4PgtrHgt4onLFxuICAgIGVycm9yOiAn4Lav4Led4LeC4La64Laa4LeSJyxcbiAgICBmYWlsZWQ6ICfgtoXgt4Pgt4/gtrvgt4rgtq7gtprgtrrgt5InLFxuICAgIGFyaWFEb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsXG4gICAgdGl0bGVRdWljazogJ+C2ieC2muC3iuC2uOC2seC3iiDgtrbgt4/gtpzgtq0g4Laa4LeS4La74LeT4La4JyxcbiAgICBjb21tZW50czogJ+C2heC2r+C3hOC3g+C3iicsXG4gICAgZWRpdGVkOiAn4LeD4LaC4LeD4LeK4Laa4La74Lar4La6JyxcbiAgfSxcbiAgc3c6IHtcbiAgICBkb3dubG9hZDogJ1Bha3VhJyxcbiAgICBkb3dubG9hZGluZzogJ0luYXBha3Vh4oCmJyxcbiAgICB0cnlpbmc6ICdJbmFqYXJpYnXigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdJbWVrYW1pbGlrYScsXG4gICAgZXJyb3I6ICdIaXRpbGFmdScsXG4gICAgZmFpbGVkOiAnSW1lc2hpbmR3YS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1Bha3VhJyxcbiAgICB0aXRsZVF1aWNrOiAnUGFrdWEgaGFyYWthJyxcbiAgICBjb21tZW50czogJ21hb25pJyxcbiAgICBlZGl0ZWQ6ICdJbWVoYXJpcml3YScsXG4gIH0sXG4gIHV6OiB7XG4gICAgZG93bmxvYWQ6ICdZdWtsYXNoJyxcbiAgICBkb3dubG9hZGluZzogJ1l1a2xhbm1vcWRh4oCmJyxcbiAgICB0cnlpbmc6ICdVcmluaWxtb3FkYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1RheXlvcicsXG4gICAgZXJyb3I6ICdYYXRvJyxcbiAgICBmYWlsZWQ6ICdNdXZhZmZhcWl5YXRzaXouJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdZdWtsYXNoJyxcbiAgICB0aXRsZVF1aWNrOiAnVGV6IHl1a2xhc2gnLFxuICAgIGNvbW1lbnRzOiAnc2hhcmhsYXInLFxuICAgIGVkaXRlZDogJ1RhaHJpcmxhbmdhbicsXG4gIH0sXG4gIGN5OiB7XG4gICAgZG93bmxvYWQ6ICdMYXdybHd5dGhvJyxcbiAgICBkb3dubG9hZGluZzogJ1luIGxhd3Jsd3l0aG/igKYnLFxuICAgIHRyeWluZzogJ1luIGNlaXNpb+KApicsXG4gICAgZG93bmxvYWRlZDogJ1dlZGkgZ29yZmZlbicsXG4gICAgZXJyb3I6ICdHd2FsbCcsXG4gICAgZmFpbGVkOiAnTWV0aG9kZC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhd3Jsd3l0aG8nLFxuICAgIHRpdGxlUXVpY2s6ICdMYXdybHd5dGhvIGN5Zmx5bScsXG4gICAgY29tbWVudHM6ICdzeWx3YWRhdScsXG4gICAgZWRpdGVkOiAnR29seWd3eWQnLFxuICB9LFxuICB6dToge1xuICAgIGRvd25sb2FkOiAnTGFuZGEnLFxuICAgIGRvd25sb2FkaW5nOiAnSXlhbGFuZHdh4oCmJyxcbiAgICB0cnlpbmc6ICdJeWF6YW1h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSWxhbmTEq3dlJyxcbiAgICBlcnJvcjogJ0lwaHV0aGEnLFxuICAgIGZhaWxlZDogJ0lobHVsZWtpbGUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYW5kYScsXG4gICAgdGl0bGVRdWljazogJ1VrdWxhbmRhIG9rdXNoZXNoYXlvJyxcbiAgICBjb21tZW50czogJ2FtYXp3YW5hJyxcbiAgICBlZGl0ZWQ6ICdLdWhsZWxpd2UnLFxuICB9LFxuICBzcToge1xuICAgIGRvd25sb2FkOiAnU2hrYXJrbycsXG4gICAgZG93bmxvYWRpbmc6ICdEdWtlIHNoa2Fya3VhcuKApicsXG4gICAgdHJ5aW5nOiAnRHVrZSBwcm92dWFy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUMOrcmZ1bmRvaScsXG4gICAgZXJyb3I6ICdHYWJpbScsXG4gICAgZmFpbGVkOiAnRMOrc2h0b2kuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTaGthcmtvJyxcbiAgICB0aXRsZVF1aWNrOiAnU2hrYXJraW0gaSBzaHBlanTDqycsXG4gICAgY29tbWVudHM6ICdrb21lbnRlJyxcbiAgICBlZGl0ZWQ6ICdFIHJlZGFrdHVhcicsXG4gIH0sXG59O1xuXG5leHBvcnQgdHlwZSBMYW5nS2V5ID0ga2V5b2YgdHlwZW9mIFRSQU5TTEFUSU9OUy5lbjtcblxuZXhwb3J0IGZ1bmN0aW9uIHQoa2V5OiBMYW5nS2V5KTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICBpZiAoIWtleSB8fCB0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuICcuLi4nO1xuICAgIH1cblxuICAgIGxldCByYXdMYW5nID0gJ2VuJztcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiZcbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nXG4gICAgKSB7XG4gICAgICByYXdMYW5nID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50Lmxhbmc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IubGFuZ3VhZ2UpIHtcbiAgICAgIHJhd0xhbmcgPSBuYXZpZ2F0b3IubGFuZ3VhZ2U7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9ybWFsaXplZExhbmcgPSByYXdMYW5nXG4gICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgLnNwbGl0KCc7JylbMF1cbiAgICAgIC50cmltKClcbiAgICAgIC5yZXBsYWNlKCdfJywgJy0nKTtcbiAgICBjb25zdCBiYXNlTGFuZyA9IG5vcm1hbGl6ZWRMYW5nLnNwbGl0KCctJylbMF07XG5cbiAgICBpZiAoXG4gICAgICBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ11ba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBUUkFOU0xBVElPTlNbYmFzZUxhbmddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ11ba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICBUUkFOU0xBVElPTlNbJ2VuJ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5O1xuICB9IGNhdGNoIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldIHx8IGtleTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBTdHJpbmcoa2V5IHx8ICdEb3dubG9hZCcpO1xuICAgIH1cbiAgfVxufVxuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHNcblxuLyoqXG4gKiBUSEVNRSBERVRFQ1RPUlxuICpcbiAqIEdvYWw6IFwiSXMgdGhlIGNvbnRlbnQgSSdtIGRyYXdpbmcgb24gdmlzdWFsbHkgZGFyayBvciBsaWdodD9cIlxuICogSW5zdGVhZCBvZiBndWVzc2luZyBmcm9tIDxib2R5Piwgd2U6XG4gKiAgLSBSZXNwZWN0IERhcmsgUmVhZGVyIGlmIHByZXNlbnRcbiAqICAtIExvb2sgZm9yIG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzXG4gKiAgLSBNZWFzdXJlIHRoZSBlZmZlY3RpdmUgYmFja2dyb3VuZCBjb2xvciBvZiBhICpjb250ZW50KiBlbGVtZW50XG4gKiAgICAoZS5nLiBHb29nbGUgQ2xhc3Nyb29tIHN0cmVhbSBjYXJkcylcbiAqL1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFnZSAqY29udGVudCBhcmVhKiBpcyB2aXN1YWxseSBkYXJrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQYWdlRGFyaygpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAxLiBGYXN0IHBhdGg6IERhcmsgUmVhZGVyIGF0dHJpYnV0ZVxuICBjb25zdCBkclNjaGVtZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnKTtcbiAgaWYgKGRyU2NoZW1lID09PSAnZGFyaycpIHJldHVybiB0cnVlO1xuICBpZiAoZHJTY2hlbWUgPT09ICdsaWdodCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAyLiBIZXVyaXN0aWM6IG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzIG9uIDxodG1sPiAvIDxib2R5PlxuICAvLyAoY292ZXJzIHNvbWUgZnJhbWV3b3JrcyBhbmQgZXh0ZW5zaW9ucylcbiAgY29uc3QgZGFya1Rva2VucyA9IFsnZGFyaycsICdkYXJrLXRoZW1lJywgJ3RoZW1lLWRhcmsnLCAnbmlnaHQnLCAnZ20zLWRhcmstdGhlbWUnXTtcbiAgY29uc3QgaHRtbENsYXNzID0gKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGJvZHlDbGFzcyA9IChkb2N1bWVudC5ib2R5LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGRhcmtUb2tlbnMuc29tZSh0b2tlbiA9PiBodG1sQ2xhc3MuaW5jbHVkZXModG9rZW4pIHx8IGJvZHlDbGFzcy5pbmNsdWRlcyh0b2tlbikpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyAzLiBQcm9iZSBhICpjb250ZW50KiBlbGVtZW50LCBub3QgdGhlIHdob2xlIHBhZ2UgYmFja2dyb3VuZC5cbiAgLy8gICAgRm9yIENsYXNzcm9vbSwgcG9zdHMgYXJlIHRoZSBtYWluIHN1cmZhY2Ugd2UgZHJhdyBvbi5cbiAgY29uc3QgcHJvYmVFbCA9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXScpIHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tyb2xlPVwibWFpblwiXScpIHx8XG4gICAgZG9jdW1lbnQuYm9keTtcblxuICBjb25zdCBiZ0NvbG9yID0gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHByb2JlRWwpO1xuICBjb25zdCBicmlnaHRuZXNzID0gcGFyc2VCcmlnaHRuZXNzKGJnQ29sb3IpO1xuXG4gIC8vIDQuIERlY2lkZSB0aHJlc2hvbGQuXG4gIC8vICAgIDEyOCBpcyBcIjUwJSBncmF5XCIsIGJ1dCB0aGF0IGZsaXBzIHRvbyBlYXJseSBvbiBzbGlnaHRseSBncmF5IFVJcy5cbiAgLy8gICAgVXNlIGEgc3RyaWN0ZXIgdGhyZXNob2xkIHNvIHdlIG9ubHkgdHJlYXQgY2xlYXJseSBkYXJrIFVJcyBhcyBkYXJrLlxuICByZXR1cm4gYnJpZ2h0bmVzcyA8IDEwNTtcbn1cblxuLyoqXG4gKiBXYWxrcyB1cCB0aGUgRE9NIGZyb20gYSBnaXZlbiBlbGVtZW50IHVudGlsIGl0IGZpbmRzIGEgbm9uLXRyYW5zcGFyZW50IGJhY2tncm91bmQgY29sb3IuXG4gKiBGYWxscyBiYWNrIHRvIDxodG1sPiBhbmQgZmluYWxseSB0byBwdXJlIHdoaXRlLlxuICovXG5mdW5jdGlvbiBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3Ioc3RhcnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBzdGFydDtcblxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gKGM6IHN0cmluZyB8IG51bGwpID0+XG4gICAgIWMgfHwgYyA9PT0gJ3RyYW5zcGFyZW50JyB8fCBjID09PSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgY29uc3QgYmcgPSBzdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgaWYgKCFpc1RyYW5zcGFyZW50KGJnKSkgcmV0dXJuIGJnO1xuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIC8vIFRyeSA8aHRtbD4gYXMgYSBsYXN0IHJlYWwgZWxlbWVudFxuICBjb25zdCBodG1sU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuICBjb25zdCBodG1sQmcgPSBodG1sU3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICBpZiAoIWlzVHJhbnNwYXJlbnQoaHRtbEJnKSkgcmV0dXJuIGh0bWxCZztcblxuICAvLyBBYnNvbHV0ZSBmYWxsYmFjazogYXNzdW1lIHdoaXRlXG4gIHJldHVybiAncmdiKDI1NSwgMjU1LCAyNTUpJztcbn1cblxuLyoqXG4gKiBIZWxwZXI6IENhbGN1bGF0ZXMgYnJpZ2h0bmVzcyAoMC0yNTUpIGZyb20gYW4gUkdCKEEpIHN0cmluZy5cbiAqIFVzZXMgdGhlIEhTUCBjb2xvciBmb3JtdWxhOiBzcXJ0KDAuMjk5KlJeMiArIDAuNTg3KkdeMiArIDAuMTE0KkJeMilcbiAqL1xuZnVuY3Rpb24gcGFyc2VCcmlnaHRuZXNzKHJnYlN0cmluZzogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgbWF0Y2ggPSByZ2JTdHJpbmcubWF0Y2goLyhcXGQrKSxcXHMqKFxcZCspLFxccyooXFxkKykvKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIC8vIElmIHdlIGNhbid0IHBhcnNlIGl0LCBhc3N1bWUgYnJpZ2h0IHNvIHdlIGRvbid0IGFjY2lkZW50YWxseSBmbGlwIHRvIGRhcmsgbW9kZS5cbiAgICByZXR1cm4gMjU1O1xuICB9XG5cbiAgY29uc3QgciA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIGNvbnN0IGcgPSBwYXJzZUludChtYXRjaFsyXSwgMTApO1xuICBjb25zdCBiID0gcGFyc2VJbnQobWF0Y2hbM10sIDEwKTtcblxuICAvLyBIU1AgZXF1YXRpb24gaXMgcGVyY2VpdmVkIGJyaWdodG5lc3NcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IE1hdGguc3FydChcbiAgICAwLjI5OSAqIChyICogcikgK1xuICAgIDAuNTg3ICogKGcgKiBnKSArXG4gICAgMC4xMTQgKiAoYiAqIGIpXG4gICk7XG5cbiAgcmV0dXJuIGJyaWdodG5lc3M7XG59XG5cbi8qKlxuICogV2F0Y2hlcjogTm90aWZpZXMgeW91IHdoZW4gdGhlIHRoZW1lIGxpa2VseSBjaGFuZ2VkLlxuICpcbiAqIFlvdSBjYW4gdXNlIHRoaXMgaWYgeW91IGV2ZXIgd2FudCB0byBkeW5hbWljYWxseSByZS1zdHlsZSB0aGluZ3NcbiAqIHdoZW4gdGhlIHVzZXIgLyBleHRlbnNpb24gdG9nZ2xlcyB0aGVtZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoVGhlbWVDaGFuZ2VzKGNhbGxiYWNrOiAoaXNEYXJrOiBib29sZWFuKSA9PiB2b2lkKTogTXV0YXRpb25PYnNlcnZlciB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoKSA9PiB7XG4gICAgY2FsbGJhY2soaXNQYWdlRGFyaygpKTtcbiAgfTtcblxuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZXIpO1xuXG4gIC8vIFdhdGNoIGZvciBhdHRyaWJ1dGUvY2xhc3MgY2hhbmdlcyBvbiA8aHRtbD4gYW5kIDxib2R5PlxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnLCAnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgLy8gQWxzbyBsaXN0ZW4gdG8gc3lzdGVtIHRoZW1lIGNoYW5nZXMgYXMgYSBiYWNrdXAgc2lnbmFsXG4gIGlmICh0eXBlb2Ygd2luZG93Lm1hdGNoTWVkaWEgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjb25zdCBtcSA9IHdpbmRvdy5tYXRjaE1lZGlhKCcocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspJyk7XG4gICAgaWYgKG1xKSB7XG4gICAgICBjb25zdCBtcUxpc3RlbmVyID0gKCkgPT4gaGFuZGxlcigpO1xuICAgICAgLy8gTW9kZXJuIGJyb3dzZXJzXG4gICAgICBpZiAoKG1xIGFzIGFueSkuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBtcS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBtcUxpc3RlbmVyKTtcbiAgICAgIH0gZWxzZSBpZiAoKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIpIHtcbiAgICAgICAgLy8gTGVnYWN5IEFQSVxuICAgICAgICAobXEgYXMgYW55KS5hZGRMaXN0ZW5lcihtcUxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsIGNhbGwgc28gdGhlIGNvbnN1bWVyIGNhbiBzeW5jIGltbWVkaWF0ZWx5XG4gIGhhbmRsZXIoKTtcblxuICByZXR1cm4gb2JzZXJ2ZXI7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvZG93bmxvYWRfYWxsLmNvbnRlbnQudHNcblxuaW1wb3J0IHsgaW5qZWN0U3R5bGVzIH0gZnJvbSAnLi9jb250ZW50L3N0eWxlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9jb250ZW50L2kxOG4nO1xuaW1wb3J0IHsgaXNQYWdlRGFyayB9IGZyb20gJy4vY29udGVudC90aGVtZSc7XG5cbmNvbnN0IERPV05MT0FEX0JUTl9TRUxFQ1RPUiA9ICcuY3FkLWRvd25sb2FkLWJ0bic7XG5jb25zdCBHUk9VUF9TRUxFQ1RPUiA9ICdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nO1xuY29uc3QgSU5KRUNURURfQVRUUiA9ICdkYXRhLWNxZC1pbmplY3RlZCc7XG5cbi8vIEtlZXAgdGhpcyBpbiBzeW5jIHdpdGggRkVFREJBQ0tfU1VDQ0VTU19NUyBpbiBjb250ZW50L2luZGV4LnRzXG5jb25zdCBHUk9VUF9GRUVEQkFDS19TVUNDRVNTX01TID0gMzAwMDtcblxudHlwZSBCdXR0b25TdGF0ZSA9ICdpZGxlJyB8ICdsb2FkaW5nJyB8ICd0cnlpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJztcblxuaW50ZXJmYWNlIEZpbGVFbnRyeSB7XG4gIGtleTogc3RyaW5nO1xuICBidXR0b25zOiBTZXQ8SFRNTEJ1dHRvbkVsZW1lbnQ+O1xuICBkb3dubG9hZGVkOiBib29sZWFuOyAgIC8vIGxhdGNoZWQgc3VjY2VzcyBmb3IgY3VycmVudCBiYXRjaFxuICBmYWlsZWQ6IGJvb2xlYW47ICAgICAgIC8vIGxhdGNoZWQgZXJyb3IgZm9yIGN1cnJlbnQgYmF0Y2hcbiAgaW5Qcm9ncmVzczogYm9vbGVhbjsgICAvLyBhbnkgYnV0dG9uIGxvYWRpbmdcbn1cblxuaW50ZXJmYWNlIEdyb3VwU3RhdGUge1xuICByb290OiBIVE1MRWxlbWVudDtcbiAgZmlsZXM6IE1hcDxzdHJpbmcsIEZpbGVFbnRyeT47XG4gIGRvd25sb2FkQWxsQnRuOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGFjdGl2YXRlZDogYm9vbGVhbjsgICAgIC8vIGJhdGNoIGhhcyBiZWVuIHRyaWdnZXJlZCBhdCBsZWFzdCBvbmNlXG4gIGlzQnVzeTogYm9vbGVhbjsgICAgICAgIC8vIGFueSBmaWxlIHN0aWxsIGluIHByb2dyZXNzXG4gIHJlc2V0VGltZW91dElkPzogbnVtYmVyO1xuICBjdXJyZW50UnVuSWQ/OiBudW1iZXI7XG59XG5cbmNvbnN0IGdyb3VwU3RhdGVzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIEdyb3VwU3RhdGU+KCk7XG5jb25zdCBidXR0b25Ub0dyb3VwID0gbmV3IFdlYWtNYXA8SFRNTEJ1dHRvbkVsZW1lbnQsIEdyb3VwU3RhdGU+KCk7XG5jb25zdCBidXR0b25Ub0ZpbGUgPSBuZXcgV2Vha01hcDxIVE1MQnV0dG9uRWxlbWVudCwgRmlsZUVudHJ5PigpO1xuXG5jb25zdCBkaXJ0eUdyb3VwcyA9IG5ldyBTZXQ8R3JvdXBTdGF0ZT4oKTtcbmxldCByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJ2h0dHBzOi8vY2xhc3Nyb29tLmdvb2dsZS5jb20vKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBtYWluKCkge1xuICAgIGluamVjdFN0eWxlcygpO1xuICAgIHNhZmVTZXREaXJlY3Rpb24oKTtcblxuICAgIC8vIEluaXRpYWwgZGlzY292ZXJ5XG4gICAgcmVnaXN0ZXJCdXR0b25zSW5TdWJ0cmVlKGRvY3VtZW50KTtcblxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgZm9yIChjb25zdCBtIG9mIG11dGF0aW9ucykge1xuICAgICAgICBpZiAobS50eXBlID09PSAnY2hpbGRMaXN0Jykge1xuICAgICAgICAgIG0uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSByZXR1cm47XG4gICAgICAgICAgICByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUobm9kZSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtLnJlbW92ZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSByZXR1cm47XG4gICAgICAgICAgICBjbGVhbnVwUmVtb3ZlZEJ1dHRvbnMobm9kZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAobS50eXBlID09PSAnYXR0cmlidXRlcycpIHtcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSBtLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB0YXJnZXQgaW5zdGFuY2VvZiBIVE1MQnV0dG9uRWxlbWVudCAmJlxuICAgICAgICAgICAgdGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnY3FkLWRvd25sb2FkLWJ0bicpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb25zdCBncm91cCA9IGVuc3VyZUJ1dHRvblJlZ2lzdGVyZWQodGFyZ2V0KTtcbiAgICAgICAgICAgIGlmIChncm91cCkgbWFya0dyb3VwRGlydHkoZ3JvdXApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzY2hlZHVsZVJlZnJlc2goKTtcbiAgICB9KTtcblxuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnY2xhc3MnLCAnZGF0YS1jcWQtYWxsLWRvbmUnXSxcbiAgICB9KTtcblxuICAgIC8vIEJhY2t1cCBzY2FuXG4gICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShkb2N1bWVudCk7XG4gICAgICBzY2hlZHVsZVJlZnJlc2goKTtcbiAgICB9LCA0MDAwKTtcbiAgfSxcbn0pO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRGlzY292ZXJ5ICYgZ3JvdXBpbmdcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShyb290OiBIVE1MRWxlbWVudCB8IERvY3VtZW50KTogdm9pZCB7XG4gIGlmIChcbiAgICByb290IGluc3RhbmNlb2YgSFRNTEJ1dHRvbkVsZW1lbnQgJiZcbiAgICByb290LmNsYXNzTGlzdC5jb250YWlucygnY3FkLWRvd25sb2FkLWJ0bicpXG4gICkge1xuICAgIHJlZ2lzdGVyU2luZ2xlQnV0dG9uKHJvb3QpO1xuICB9XG5cbiAgY29uc3QgYnV0dG9ucyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oRE9XTkxPQURfQlROX1NFTEVDVE9SKTtcbiAgYnV0dG9ucy5mb3JFYWNoKChidG4pID0+IHJlZ2lzdGVyU2luZ2xlQnV0dG9uKGJ0bikpO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlclNpbmdsZUJ1dHRvbihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gIGlmICghYnRuLmlzQ29ubmVjdGVkKSByZXR1cm47XG4gIGlmIChidXR0b25Ub0dyb3VwLmhhcyhidG4pICYmIGJ1dHRvblRvRmlsZS5oYXMoYnRuKSkgcmV0dXJuO1xuXG4gIGNvbnN0IGdyb3VwUm9vdCA9IGZpbmRHcm91cFJvb3QoYnRuKTtcbiAgaWYgKCFncm91cFJvb3QpIHJldHVybjtcblxuICBsZXQgZ3JvdXAgPSBncm91cFN0YXRlcy5nZXQoZ3JvdXBSb290KTtcbiAgaWYgKCFncm91cCkge1xuICAgIGdyb3VwID0ge1xuICAgICAgcm9vdDogZ3JvdXBSb290LFxuICAgICAgZmlsZXM6IG5ldyBNYXA8c3RyaW5nLCBGaWxlRW50cnk+KCksXG4gICAgICBkb3dubG9hZEFsbEJ0bjogbnVsbCxcbiAgICAgIGFjdGl2YXRlZDogZmFsc2UsXG4gICAgICBpc0J1c3k6IGZhbHNlLFxuICAgIH07XG4gICAgZ3JvdXBTdGF0ZXMuc2V0KGdyb3VwUm9vdCwgZ3JvdXApO1xuICB9XG5cbiAgY29uc3Qga2V5ID0gZ2V0Q2Fub25pY2FsRmlsZUtleShidG4pO1xuICBsZXQgZmlsZSA9IGdyb3VwLmZpbGVzLmdldChrZXkpO1xuXG4gIGlmICghZmlsZSkge1xuICAgIGZpbGUgPSB7XG4gICAgICBrZXksXG4gICAgICBidXR0b25zOiBuZXcgU2V0PEhUTUxCdXR0b25FbGVtZW50PigpLFxuICAgICAgZG93bmxvYWRlZDogZmFsc2UsXG4gICAgICBmYWlsZWQ6IGZhbHNlLFxuICAgICAgaW5Qcm9ncmVzczogZmFsc2UsXG4gICAgfTtcbiAgICBncm91cC5maWxlcy5zZXQoa2V5LCBmaWxlKTtcbiAgfVxuXG4gIGZpbGUuYnV0dG9ucy5hZGQoYnRuKTtcbiAgYnV0dG9uVG9Hcm91cC5zZXQoYnRuLCBncm91cCk7XG4gIGJ1dHRvblRvRmlsZS5zZXQoYnRuLCBmaWxlKTtcblxuICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUJ1dHRvblJlZ2lzdGVyZWQoYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IEdyb3VwU3RhdGUgfCBudWxsIHtcbiAgbGV0IGdyb3VwID0gYnV0dG9uVG9Hcm91cC5nZXQoYnRuKTtcbiAgaWYgKCFncm91cCkge1xuICAgIHJlZ2lzdGVyU2luZ2xlQnV0dG9uKGJ0bik7XG4gICAgZ3JvdXAgPSBidXR0b25Ub0dyb3VwLmdldChidG4pIHx8IG51bGw7XG4gIH1cbiAgcmV0dXJuIGdyb3VwO1xufVxuXG5mdW5jdGlvbiBjbGVhbnVwUmVtb3ZlZEJ1dHRvbnMocm9vdDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgcmVtb3ZlZEJ1dHRvbnMgPSByb290Lm1hdGNoZXMoRE9XTkxPQURfQlROX1NFTEVDVE9SKVxuICAgID8gW3Jvb3QgYXMgSFRNTEJ1dHRvbkVsZW1lbnRdXG4gICAgOiBBcnJheS5mcm9tKHJvb3QucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oRE9XTkxPQURfQlROX1NFTEVDVE9SKSk7XG5cbiAgcmVtb3ZlZEJ1dHRvbnMuZm9yRWFjaCgoYnRuKSA9PiB7XG4gICAgY29uc3QgZ3JvdXAgPSBidXR0b25Ub0dyb3VwLmdldChidG4pO1xuICAgIGNvbnN0IGZpbGUgPSBidXR0b25Ub0ZpbGUuZ2V0KGJ0bik7XG4gICAgaWYgKCFncm91cCB8fCAhZmlsZSkgcmV0dXJuO1xuXG4gICAgZmlsZS5idXR0b25zLmRlbGV0ZShidG4pO1xuICAgIGJ1dHRvblRvR3JvdXAuZGVsZXRlKGJ0bik7XG4gICAgYnV0dG9uVG9GaWxlLmRlbGV0ZShidG4pO1xuXG4gICAgaWYgKGZpbGUuYnV0dG9ucy5zaXplID09PSAwKSB7XG4gICAgICBncm91cC5maWxlcy5kZWxldGUoZmlsZS5rZXkpO1xuICAgIH1cblxuICAgIG1hcmtHcm91cERpcnR5KGdyb3VwKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGZpbmRHcm91cFJvb3QoYnRuOiBIVE1MRWxlbWVudCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IHBvc3QgPSBidG4uY2xvc2VzdDxIVE1MRWxlbWVudD4oR1JPVVBfU0VMRUNUT1IpO1xuICBpZiAocG9zdCkgcmV0dXJuIHBvc3Q7XG5cbiAgY29uc3QgbWFpbiA9XG4gICAgYnRuLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCdtYWluJykgfHxcbiAgICBidG4uY2xvc2VzdDxIVE1MRWxlbWVudD4oJ2Rpdltyb2xlPVwibWFpblwiXScpO1xuICBpZiAobWFpbikgcmV0dXJuIG1haW47XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldENhbm9uaWNhbEZpbGVLZXkoYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IHN0cmluZyB7XG4gIGNvbnN0IGRzID0gYnRuLmRhdGFzZXQgYXMgYW55O1xuICBjb25zdCB1cmwgPSBkcy5jcWRVcmwgfHwgJyc7XG5cbiAgaWYgKHVybCkge1xuICAgIGNvbnN0IGlkTWF0Y2ggPVxuICAgICAgdXJsLm1hdGNoKC9cXC9kXFwvKFthLXpBLVowLTlfLV0rKS8pIHx8XG4gICAgICB1cmwubWF0Y2goL1s/Jl0oPzppZHxyZXNvdXJjZUlkfGZpbGVJZCk9KFthLXpBLVowLTlfLV0rKS8pO1xuXG4gICAgaWYgKGlkTWF0Y2ggJiYgaWRNYXRjaFsxXSkge1xuICAgICAgcmV0dXJuIGBkcml2ZS1pZC0ke2lkTWF0Y2hbMV19YDtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgdSA9IG5ldyBVUkwodXJsKTtcbiAgICAgIHUuc2VhcmNoUGFyYW1zLmRlbGV0ZSgnYXV0aHVzZXInKTtcbiAgICAgIHUuc2VhcmNoUGFyYW1zLmRlbGV0ZSgndScpO1xuICAgICAgdS5zZWFyY2hQYXJhbXMuZGVsZXRlKCdobCcpO1xuICAgICAgcmV0dXJuIHUudG9TdHJpbmcoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB1cmw7XG4gICAgfVxuICB9XG5cbiAgaWYgKGRzLmNxZE5hbWUpIHtcbiAgICByZXR1cm4gYCR7ZHMuY3FkTmFtZX06OiR7ZHMuY3FkRXh0IHx8ICcnfWA7XG4gIH1cblxuICByZXR1cm4gYGJ0bi0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpfWA7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBGaWxlLWxldmVsIGhlbHBlcnMgKHByaW1hcnkgYnV0dG9uICYgZGVkdXApXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBnZXRQcmltYXJ5QnV0dG9uKGZpbGU6IEZpbGVFbnRyeSk6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCB7XG4gIGlmIChmaWxlLmJ1dHRvbnMuc2l6ZSA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgbGV0IHByaW1hcnlWaXNpYmxlOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBsZXQgZmFsbGJhY2s6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCA9IG51bGw7XG5cbiAgZm9yIChjb25zdCBidG4gb2YgZmlsZS5idXR0b25zKSB7XG4gICAgaWYgKCFidG4uaXNDb25uZWN0ZWQpIGNvbnRpbnVlO1xuICAgIGlmICghZmFsbGJhY2spIGZhbGxiYWNrID0gYnRuO1xuXG4gICAgLy8gT25seSBjb25zaWRlciBsYWlkLW91dCBlbGVtZW50cyBhcyB2aXNpYmxlXG4gICAgaWYgKCFidG4ub2Zmc2V0UGFyZW50KSBjb250aW51ZTtcblxuICAgIGlmICghcHJpbWFyeVZpc2libGUpIHtcbiAgICAgIHByaW1hcnlWaXNpYmxlID0gYnRuO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY29uc3QgcG9zID0gcHJpbWFyeVZpc2libGUuY29tcGFyZURvY3VtZW50UG9zaXRpb24oYnRuKTtcbiAgICBpZiAocG9zICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9GT0xMT1dJTkcpIHtcbiAgICAgIHByaW1hcnlWaXNpYmxlID0gYnRuO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwcmltYXJ5VmlzaWJsZSB8fCBmYWxsYmFjaztcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplRmlsZUJ1dHRvbnMoZmlsZTogRmlsZUVudHJ5KTogdm9pZCB7XG4gIGlmIChmaWxlLmJ1dHRvbnMuc2l6ZSA8PSAxKSByZXR1cm47XG5cbiAgY29uc3QgcHJpbWFyeSA9IGdldFByaW1hcnlCdXR0b24oZmlsZSk7XG4gIGlmICghcHJpbWFyeSkgcmV0dXJuO1xuXG4gIGZvciAoY29uc3QgYnRuIG9mIGZpbGUuYnV0dG9ucykge1xuICAgIGlmICghYnRuLmlzQ29ubmVjdGVkKSBjb250aW51ZTtcblxuICAgIGlmIChidG4gPT09IHByaW1hcnkpIHtcbiAgICAgIGJ0bi5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnZGlzcGxheScpO1xuICAgICAgYnRuLnN0eWxlLnJlbW92ZVByb3BlcnR5KCd2aXNpYmlsaXR5Jyk7XG4gICAgICBidG4uc3R5bGUucmVtb3ZlUHJvcGVydHkoJ3BvaW50ZXItZXZlbnRzJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJ0bi5zdHlsZS5zZXRQcm9wZXJ0eSgnZGlzcGxheScsICdub25lJywgJ2ltcG9ydGFudCcpO1xuICAgICAgYnRuLnN0eWxlLnNldFByb3BlcnR5KCdwb2ludGVyLWV2ZW50cycsICdub25lJywgJ2ltcG9ydGFudCcpO1xuICAgIH1cbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogUmVmcmVzaCBwaXBlbGluZVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gbWFya0dyb3VwRGlydHkoZ3JvdXA6IEdyb3VwU3RhdGUpOiB2b2lkIHtcbiAgZGlydHlHcm91cHMuYWRkKGdyb3VwKTtcbn1cblxuZnVuY3Rpb24gc2NoZWR1bGVSZWZyZXNoKCk6IHZvaWQge1xuICBpZiAocmVmcmVzaFNjaGVkdWxlZCkgcmV0dXJuO1xuICByZWZyZXNoU2NoZWR1bGVkID0gdHJ1ZTtcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG4gICAgZGlydHlHcm91cHMuZm9yRWFjaCh1cGRhdGVHcm91cFN0YXRlKTtcbiAgICBkaXJ0eUdyb3Vwcy5jbGVhcigpO1xuICB9KTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEdyb3VwIHN0YXRlICsgdmlzdWFsIHVwZGF0ZVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gdXBkYXRlR3JvdXBTdGF0ZShncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICAvLyBQcnVuZSArIGRlZHVwIHBlciBmaWxlXG4gIGZvciAoY29uc3QgW2tleSwgZmlsZV0gb2YgQXJyYXkuZnJvbShncm91cC5maWxlcy5lbnRyaWVzKCkpKSB7XG4gICAgZm9yIChjb25zdCBidG4gb2YgQXJyYXkuZnJvbShmaWxlLmJ1dHRvbnMpKSB7XG4gICAgICBpZiAoIWJ0bi5pc0Nvbm5lY3RlZCkge1xuICAgICAgICBmaWxlLmJ1dHRvbnMuZGVsZXRlKGJ0bik7XG4gICAgICAgIGJ1dHRvblRvR3JvdXAuZGVsZXRlKGJ0bik7XG4gICAgICAgIGJ1dHRvblRvRmlsZS5kZWxldGUoYnRuKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZmlsZS5idXR0b25zLnNpemUgPT09IDApIHtcbiAgICAgIGdyb3VwLmZpbGVzLmRlbGV0ZShrZXkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgbm9ybWFsaXplRmlsZUJ1dHRvbnMoZmlsZSk7XG4gIH1cblxuICBjb25zdCB0b3RhbEZpbGVzID0gZ3JvdXAuZmlsZXMuc2l6ZTtcblxuICAvLyBPbmx5IHNob3cgXCJEb3dubG9hZCBhbGxcIiBpZiB3ZSBoYXZlIGF0IGxlYXN0IDIgZmlsZXNcbiAgaWYgKHRvdGFsRmlsZXMgPCAyKSB7XG4gICAgaWYgKGdyb3VwLmRvd25sb2FkQWxsQnRuICYmIGdyb3VwLmRvd25sb2FkQWxsQnRuLmlzQ29ubmVjdGVkKSB7XG4gICAgICBncm91cC5kb3dubG9hZEFsbEJ0bi5yZW1vdmUoKTtcbiAgICB9XG4gICAgZ3JvdXAuZG93bmxvYWRBbGxCdG4gPSBudWxsO1xuICAgIGdyb3VwLmFjdGl2YXRlZCA9IGZhbHNlO1xuICAgIGdyb3VwLmlzQnVzeSA9IGZhbHNlO1xuICAgIGlmIChncm91cC5yZXNldFRpbWVvdXRJZCAhPSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KGdyb3VwLnJlc2V0VGltZW91dElkKTtcbiAgICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBidG4gPSBlbnN1cmVEb3dubG9hZEFsbEJ1dHRvbihncm91cCk7XG5cbiAgLy8gQWdncmVnYXRlIHBlci1maWxlIHN0YXRlIGZyb20gdW5kZXJseWluZyBzaW5nbGUgYnV0dG9ucyxcbiAgLy8gYnV0IExBVENIIHN1Y2Nlc3MvZXJyb3IgZm9yIHRoZSB3aG9sZSBiYXRjaC5cbiAgbGV0IGRvd25sb2FkZWQgPSAwO1xuICBsZXQgZmFpbGVkID0gMDtcbiAgbGV0IGluUHJvZ3Jlc3MgPSAwO1xuXG4gIGZvciAoY29uc3QgZmlsZSBvZiBncm91cC5maWxlcy52YWx1ZXMoKSkge1xuICAgIGxldCBzb21lU3VjY2VzcyA9IGZpbGUuZG93bmxvYWRlZDsgLy8gbGF0Y2hcbiAgICBsZXQgc29tZUVycm9yID0gZmlsZS5mYWlsZWQ7ICAgICAgIC8vIGxhdGNoXG4gICAgbGV0IHNvbWVMb2FkaW5nID0gZmlsZS5pblByb2dyZXNzO1xuXG4gICAgZm9yIChjb25zdCBiIG9mIGZpbGUuYnV0dG9ucykge1xuICAgICAgaWYgKCFiLmlzQ29ubmVjdGVkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGNscyA9IGIuY2xhc3NMaXN0O1xuICAgICAgY29uc3QgZHMgPSBiLmRhdGFzZXQgYXMgYW55O1xuXG4gICAgICBjb25zdCBpc0xvYWRpbmcgPVxuICAgICAgICBjbHMuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykgfHwgY2xzLmNvbnRhaW5zKCdjcWQtdHJ5aW5nJyk7XG4gICAgICBjb25zdCBpc1N1Y2Nlc3MgPVxuICAgICAgICBjbHMuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykgfHwgZHMuY3FkQWxsRG9uZSA9PT0gJ3RydWUnO1xuICAgICAgY29uc3QgaXNFcnJvciA9IGNscy5jb250YWlucygnY3FkLWVycm9yJyk7XG5cbiAgICAgIGlmIChpc0xvYWRpbmcpIHNvbWVMb2FkaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChpc1N1Y2Nlc3MpIHNvbWVTdWNjZXNzID0gdHJ1ZTtcbiAgICAgIGlmIChpc0Vycm9yKSBzb21lRXJyb3IgPSB0cnVlO1xuICAgIH1cblxuICAgIGZpbGUuZG93bmxvYWRlZCA9IHNvbWVTdWNjZXNzO1xuICAgIGZpbGUuaW5Qcm9ncmVzcyA9IHNvbWVMb2FkaW5nO1xuICAgIGZpbGUuZmFpbGVkID0gIWZpbGUuZG93bmxvYWRlZCAmJiBzb21lRXJyb3I7XG5cbiAgICBpZiAoZmlsZS5kb3dubG9hZGVkKSBkb3dubG9hZGVkKys7XG4gICAgZWxzZSBpZiAoZmlsZS5pblByb2dyZXNzKSBpblByb2dyZXNzKys7XG4gICAgZWxzZSBpZiAoZmlsZS5mYWlsZWQpIGZhaWxlZCsrO1xuICB9XG5cbiAgZ3JvdXAuaXNCdXN5ID0gaW5Qcm9ncmVzcyA+IDA7XG5cbiAgLy8gSWYgbmV3IGRvd25sb2FkcyBhcmUgaW4gcHJvZ3Jlc3MsIGtpbGwgYW55IHBlbmRpbmcgcmVzZXQgdGltZXJcbiAgaWYgKGdyb3VwLmlzQnVzeSAmJiBncm91cC5yZXNldFRpbWVvdXRJZCAhPSBudWxsKSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dChncm91cC5yZXNldFRpbWVvdXRJZCk7XG4gICAgZ3JvdXAucmVzZXRUaW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBtYWluU3BhbiA9IGJ0bi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1hbGwtbWFpbicpO1xuICBjb25zdCBzdWJTcGFuID0gYnRuLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWRvd25sb2FkLWFsbC1zdWInKTtcbiAgaWYgKCFtYWluU3BhbiB8fCAhc3ViU3BhbikgcmV0dXJuO1xuXG4gIGNvbnN0IG5vbmVTdGFydGVkID0gZG93bmxvYWRlZCA9PT0gMCAmJiBmYWlsZWQgPT09IDAgJiYgaW5Qcm9ncmVzcyA9PT0gMDtcbiAgY29uc3QgYWxsU3VjY2VlZGVkID1cbiAgICBkb3dubG9hZGVkID09PSB0b3RhbEZpbGVzICYmIGZhaWxlZCA9PT0gMCAmJiB0b3RhbEZpbGVzID4gMDtcbiAgY29uc3QgYWxsQ29tcGxldGVkID1cbiAgICBkb3dubG9hZGVkICsgZmFpbGVkID09PSB0b3RhbEZpbGVzICYmIGluUHJvZ3Jlc3MgPT09IDAgJiYgdG90YWxGaWxlcyA+IDA7XG5cbiAgLy8gT25jZSBhbnkgZmlsZSBzdGFydHMsIHdlIGNvbnNpZGVyIHRoZSBydW4gXCJhY3RpdmVcIlxuICBpZiAoIWdyb3VwLmFjdGl2YXRlZCAmJiAhbm9uZVN0YXJ0ZWQpIHtcbiAgICBncm91cC5hY3RpdmF0ZWQgPSB0cnVlO1xuICB9XG5cbiAgYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1hbGwtc3VjY2VzcycsICdjcWQtYWxsLWVycm9yJyk7XG5cbiAgLy8gSWRsZSBzdGF0ZTogbm90aGluZyBzdGFydGVkIG9yIHdlJ3ZlIGZ1bGx5IHJlc2V0XG4gIGlmICghZ3JvdXAuYWN0aXZhdGVkIHx8IG5vbmVTdGFydGVkKSB7XG4gICAgZ3JvdXAuYWN0aXZhdGVkID0gZ3JvdXAuYWN0aXZhdGVkICYmICFub25lU3RhcnRlZDtcbiAgICBncm91cC5pc0J1c3kgPSBmYWxzZTtcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBtYWluU3Bhbi50ZXh0Q29udGVudCA9IHQoJ2Rvd25sb2FkQWxsJykgfHwgJ0Rvd25sb2FkIGFsbCc7XG4gICAgc3ViU3Bhbi50ZXh0Q29udGVudCA9IGAke3RvdGFsRmlsZXN9IGZpbGVzYDtcbiAgICBzZXRQcm9ncmVzc1Zpc3VhbChidG4sIDApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEZyb20gaGVyZTogYmF0Y2ggaGFzIGJlZW4gYWN0aXZhdGVkIChhbmQgbWF5IGJlIGluIHByb2dyZXNzIG9yIGluIGZlZWRiYWNrKVxuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuXG4gIGxldCBtYWluVGV4dDogc3RyaW5nO1xuICBsZXQgc3ViVGV4dDogc3RyaW5nO1xuICBsZXQgcHJvZ3Jlc3NSYXRpbyA9IHRvdGFsRmlsZXMgPiAwID8gZG93bmxvYWRlZCAvIHRvdGFsRmlsZXMgOiAwO1xuXG4gIGlmIChhbGxTdWNjZWVkZWQpIHtcbiAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IC8gJHt0b3RhbEZpbGVzfWA7XG4gICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtc3VjY2VzcycpO1xuICAgIHByb2dyZXNzUmF0aW8gPSAxO1xuICAgIHNjaGVkdWxlR3JvdXBSZXNldChncm91cCk7XG4gIH0gZWxzZSBpZiAoYWxsQ29tcGxldGVkICYmIGZhaWxlZCA+IDApIHtcbiAgICBpZiAoZG93bmxvYWRlZCA9PT0gMCkge1xuICAgICAgbWFpblRleHQgPSB0KCdlcnJvcicpIHx8ICdFcnJvcic7XG4gICAgICBzdWJUZXh0ID0gYCR7ZmFpbGVkfSBmYWlsZWRgO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtZXJyb3InKTtcbiAgICAgIHByb2dyZXNzUmF0aW8gPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgICBzdWJUZXh0ID0gYCR7ZG93bmxvYWRlZH0gb2ssICR7ZmFpbGVkfSBmYWlsZWRgO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtc3VjY2VzcycpO1xuICAgIH1cbiAgICBzY2hlZHVsZUdyb3VwUmVzZXQoZ3JvdXApO1xuICB9IGVsc2Uge1xuICAgIC8vIFN0aWxsIGluIHByb2dyZXNzXG4gICAgbWFpblRleHQgPSB0KCdkb3dubG9hZGluZycpIHx8ICdEb3dubG9hZGluZ+KApic7XG4gICAgaWYgKGZhaWxlZCA9PT0gMCkge1xuICAgICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IOKGkiAke3RvdGFsRmlsZXN9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IOKGkiAke3RvdGFsRmlsZXN9ICgke2ZhaWxlZH0gZmFpbGVkKWA7XG4gICAgfVxuICB9XG5cbiAgbWFpblNwYW4udGV4dENvbnRlbnQgPSBtYWluVGV4dDtcbiAgc3ViU3Bhbi50ZXh0Q29udGVudCA9IHN1YlRleHQ7XG4gIHNldFByb2dyZXNzVmlzdWFsKGJ0biwgcHJvZ3Jlc3NSYXRpbyk7XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlR3JvdXBSZXNldChncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICBpZiAoZ3JvdXAucmVzZXRUaW1lb3V0SWQgIT0gbnVsbCkgcmV0dXJuOyAvLyBhbHJlYWR5IHNjaGVkdWxlZFxuXG4gIGdyb3VwLnJlc2V0VGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgIGdyb3VwLmFjdGl2YXRlZCA9IGZhbHNlO1xuICAgIGdyb3VwLmlzQnVzeSA9IGZhbHNlO1xuICAgIGdyb3VwLmN1cnJlbnRSdW5JZCA9IHVuZGVmaW5lZDtcblxuICAgIHRyeSB7XG4gICAgICBkZWxldGUgZ3JvdXAucm9vdC5kYXRhc2V0LmNxZEdyb3VwQWN0aXZlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLyogaWdub3JlICovXG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgbGF0Y2hlZCBwZXItZmlsZSBzdGF0ZSBmb3IgdGhlIG5leHQgcnVuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGdyb3VwLmZpbGVzLnZhbHVlcygpKSB7XG4gICAgICBmaWxlLmRvd25sb2FkZWQgPSBmYWxzZTtcbiAgICAgIGZpbGUuZmFpbGVkID0gZmFsc2U7XG4gICAgICBmaWxlLmluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gICAgc2NoZWR1bGVSZWZyZXNoKCk7XG4gIH0sIEdST1VQX0ZFRURCQUNLX1NVQ0NFU1NfTVMpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRG93bmxvYWQgYWxsIGNsaWNrXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBlbnN1cmVEb3dubG9hZEFsbEJ1dHRvbihncm91cDogR3JvdXBTdGF0ZSk6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgY29uc3QgZXhpc3RpbmcgPSBncm91cC5kb3dubG9hZEFsbEJ0bjtcbiAgaWYgKGV4aXN0aW5nICYmIGV4aXN0aW5nLmlzQ29ubmVjdGVkKSByZXR1cm4gZXhpc3Rpbmc7XG5cbiAgY29uc3Qgcm9vdCA9IGdyb3VwLnJvb3Q7XG4gIGxldCB0YXJnZXRDb250YWluZXIgPSByb290O1xuICBsZXQgaXNJbkhlYWRlciA9IGZhbHNlO1xuXG4gIC8vIEFnZ3Jlc3NpdmVseSBzZWFyY2ggZm9yIHRoZSBcIlRocmVlIERvdHNcIiBtZW51IGJ1dHRvbiB0byBpZGVudGlmeSB0aGUgaGVhZGVyIHJvdy5cbiAgLy8gV2UgdXNlIG11bHRpcGxlIHNlbGVjdG9ycyBiZWNhdXNlIENsYXNzcm9vbSBjbGFzc2VzIGFyZSBvYmZ1c2NhdGVkLCBidXQgQVJJQSBpcyBzdGFibGUuXG4gIGNvbnN0IG1lbnVDYW5kaWRhdGVzID0gQXJyYXkuZnJvbShyb290LnF1ZXJ5U2VsZWN0b3JBbGwoJ2Rpdltyb2xlPVwiYnV0dG9uXCJdLCBidXR0b24nKSk7XG4gIGNvbnN0IG1lbnVCdG4gPSBtZW51Q2FuZGlkYXRlcy5maW5kKGVsID0+IHtcbiAgICBjb25zdCBhcmlhID0gKGVsLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiAoXG4gICAgICBhcmlhLmluY2x1ZGVzKCdtb3JlIG9wdGlvbnMnKSB8fCBcbiAgICAgIGFyaWEuaW5jbHVkZXMoJ3N0cmVhbSBpdGVtIG9wdGlvbnMnKSB8fCBcbiAgICAgIGFyaWEuaW5jbHVkZXMoJ21lbnUnKSB8fFxuICAgICAgYXJpYS5pbmNsdWRlcygnb3B0aW9ucycpXG4gICAgKTtcbiAgfSk7XG5cbiAgaWYgKG1lbnVCdG4pIHtcbiAgICAvLyBJZiB3ZSBmb3VuZCB0aGUgbWVudSBidXR0b24sIHRoZSBIZWFkZXIgUm93IGlzIHR5cGljYWxseSBpdHMgcGFyZW50IG9yIGdyYW5kcGFyZW50LlxuICAgIC8vIFdlIHdhbnQgdGhlIGNvbnRhaW5lciB0aGF0IHNwYW5zIHRoZSB3aWR0aCAoaGFzIGZsZXggb3IgYmxvY2sgZGlzcGxheSkuXG4gICAgLy8gVXN1YWxseSB0aGUgZGlyZWN0IHBhcmVudCBvZiB0aGUgbWVudSBidXR0b24gaXMgYSBzbWFsbCB3cmFwcGVyLlxuICAgIGNvbnN0IHBhcmVudCA9IG1lbnVCdG4ucGFyZW50RWxlbWVudDtcbiAgICBpZiAocGFyZW50KSB7XG4gICAgICB0YXJnZXRDb250YWluZXIgPSBwYXJlbnQ7XG4gICAgICBpc0luSGVhZGVyID0gdHJ1ZTtcblxuICAgICAgLy8gT3B0aW9uYWw6IGlmIHRoZSBkaXJlY3QgcGFyZW50IGlzIHZlcnkgc21hbGwgKGp1c3QgdGhlIGJ1dHRvbiB3cmFwcGVyKSwgXG4gICAgICAvLyBtYXliZSBnbyBvbmUgbGV2ZWwgdXA/IFVzdWFsbHkgZGlyZWN0IHBhcmVudCBpcyBzYWZlciBmb3IgYWJzb2x1dGUgcG9zaXRpb25pbmcgcmVsYXRpdmUgdG8gdGhlIGRvdHMuXG4gICAgICAvLyBXZSB3aWxsIGFzc3VtZSAncGFyZW50JyBpcyB0aGUgZmxleCBjb250YWluZXIgZm9yIHRoZSBoZWFkZXIgcm93IG9yIHRoZSBhYnNvbHV0ZSB3cmFwcGVyLlxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICBidXR0b24uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1hbGwtYnRuJztcbiAgXG4gIGlmIChpc0luSGVhZGVyKSB7XG4gICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1pbi1oZWFkZXInKTtcbiAgfVxuXG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoSU5KRUNURURfQVRUUiwgJ3RydWUnKTtcblxuICBpZiAoaXNQYWdlRGFyaygpKSB7XG4gICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC10aGVtZS1kYXJrJyk7XG4gIH1cblxuICBidXR0b24uc2V0QXR0cmlidXRlKFxuICAgICdhcmlhLWxhYmVsJyxcbiAgICB0KCdkb3dubG9hZEFsbCcpIHx8ICdEb3dubG9hZCBhbGwgYXR0YWNobWVudHMgaW4gdGhpcyBwb3N0JyxcbiAgKTtcbiAgYnV0dG9uLnRpdGxlID0gdCgnZG93bmxvYWRBbGwnKSB8fCAnRG93bmxvYWQgYWxsJztcblxuICBjb25zdCBpY29uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvbldyYXBwZXIuY2xhc3NOYW1lID0gJ2NxZC1pY29uLXdyYXBwZXIgY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXInO1xuICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBpY29uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYWxsLWljb24nO1xuICBpY29uV3JhcHBlci5hcHBlbmRDaGlsZChpY29uKTtcblxuICBjb25zdCBtYWluU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgbWFpblNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1hbGwtbWFpbic7XG5cbiAgY29uc3Qgc3ViU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgc3ViU3Bhbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWFsbC1zdWInO1xuXG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChpY29uV3JhcHBlcik7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChtYWluU3Bhbik7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChzdWJTcGFuKTtcblxuICBjb25zdCBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhcmdldENvbnRhaW5lcik7XG4gIGlmIChjb21wdXRlZC5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICB0YXJnZXRDb250YWluZXIuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuICB9XG4gIFxuICBpZiAodGFyZ2V0Q29udGFpbmVyID09PSByb290KSB7XG4gICAgLy8gRmFsbGJhY2s6IGlmIHdlIGNvdWxkbid0IGZpbmQgdGhlIGhlYWRlciwgZW5zdXJlIHJvb3QgZG9lc24ndCBoaWRlIGl0XG4gICAgcm9vdC5zdHlsZS5zZXRQcm9wZXJ0eSgnb3ZlcmZsb3cnLCAndmlzaWJsZScsICdpbXBvcnRhbnQnKTtcbiAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCdjb250YWluJywgJ25vbmUnLCAnaW1wb3J0YW50Jyk7XG4gIH1cblxuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGhhbmRsZURvd25sb2FkQWxsQ2xpY2soZ3JvdXApO1xuICB9KTtcblxuICB0YXJnZXRDb250YWluZXIuYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgZ3JvdXAuZG93bmxvYWRBbGxCdG4gPSBidXR0b247XG5cbiAgcmV0dXJuIGJ1dHRvbjtcbn1cblxuZnVuY3Rpb24gaGFuZGxlRG93bmxvYWRBbGxDbGljayhncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICAvLyBJZiBhIGJhdGNoIGlzIGFscmVhZHkgYWN0aXZlIG9yIGluIGZlZWRiYWNrLCBpZ25vcmUgY2xpY2tzXG4gIGlmIChncm91cC5pc0J1c3kgfHwgZ3JvdXAuYWN0aXZhdGVkKSByZXR1cm47XG5cbiAgZ3JvdXAuYWN0aXZhdGVkID0gdHJ1ZTtcbiAgZ3JvdXAuaXNCdXN5ID0gdHJ1ZTtcbiAgZ3JvdXAuY3VycmVudFJ1bklkID0gRGF0ZS5ub3coKTtcblxuICB0cnkge1xuICAgIGdyb3VwLnJvb3QuZGF0YXNldC5jcWRHcm91cEFjdGl2ZSA9ICcxJztcbiAgfSBjYXRjaCB7XG4gICAgLyogaWdub3JlICovXG4gIH1cblxuICAvLyBSZXNldCBsYXRjaGVkIHN0YXRlIGZvciB0aGlzIG5ldyBydW5cbiAgZm9yIChjb25zdCBmaWxlIG9mIGdyb3VwLmZpbGVzLnZhbHVlcygpKSB7XG4gICAgZmlsZS5kb3dubG9hZGVkID0gZmFsc2U7XG4gICAgZmlsZS5mYWlsZWQgPSBmYWxzZTtcbiAgICBmaWxlLmluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgfVxuXG4gIGlmIChncm91cC5yZXNldFRpbWVvdXRJZCAhPSBudWxsKSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dChncm91cC5yZXNldFRpbWVvdXRJZCk7XG4gICAgZ3JvdXAucmVzZXRUaW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBidG4gPSBncm91cC5kb3dubG9hZEFsbEJ0bjtcbiAgaWYgKGJ0bikge1xuICAgIGJ0bi5kaXNhYmxlZCA9IHRydWU7XG4gIH1cblxuICAvLyBUcmlnZ2VyIGF0IG1vc3Qgb25lIHByaW1hcnkgYnV0dG9uIHBlciBmaWxlXG4gIGZvciAoY29uc3QgZmlsZSBvZiBncm91cC5maWxlcy52YWx1ZXMoKSkge1xuICAgIGNvbnN0IHByaW1hcnkgPSBnZXRQcmltYXJ5QnV0dG9uKGZpbGUpO1xuICAgIGlmICghcHJpbWFyeSkgY29udGludWU7XG4gICAgY29uc3QgcyA9IGdldFNpbmdsZUJ1dHRvblN0YXRlKHByaW1hcnkpO1xuICAgIGlmIChzID09PSAnaWRsZScgfHwgcyA9PT0gJ2Vycm9yJykge1xuICAgICAgcHJpbWFyeS5jbGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG1hcmtHcm91cERpcnR5KGdyb3VwKTtcbiAgc2NoZWR1bGVSZWZyZXNoKCk7XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZUJ1dHRvblN0YXRlKGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBCdXR0b25TdGF0ZSB7XG4gIGNvbnN0IGNscyA9IGJ0bi5jbGFzc0xpc3Q7XG4gIGlmIChjbHMuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykpIHJldHVybiAnbG9hZGluZyc7XG4gIGlmIChjbHMuY29udGFpbnMoJ2NxZC10cnlpbmcnKSkgcmV0dXJuICd0cnlpbmcnO1xuICBpZiAoY2xzLmNvbnRhaW5zKCdjcWQtc3VjY2VzcycpKSByZXR1cm4gJ3N1Y2Nlc3MnO1xuICBpZiAoY2xzLmNvbnRhaW5zKCdjcWQtZXJyb3InKSkgcmV0dXJuICdlcnJvcic7XG4gIGlmICgoYnRuLmRhdGFzZXQgYXMgYW55KS5jcWRBbGxEb25lID09PSAndHJ1ZScpIHJldHVybiAnc3VjY2Vzcyc7XG4gIHJldHVybiAnaWRsZSc7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBWaXN1YWxzOiBwcm9ncmVzcyDihpIgQ1NTIHZhcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHNldFByb2dyZXNzVmlzdWFsKGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQsIHJhdGlvOiBudW1iZXIpOiB2b2lkIHtcbiAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIHJhdGlvKSk7XG4gIGNvbnN0IHBlcmNlbnQgPSBNYXRoLnJvdW5kKGNsYW1wZWQgKiAxMDApO1xuICBidG4uc3R5bGUuc2V0UHJvcGVydHkoJy0tY3FkLXByb2dyZXNzJywgYCR7cGVyY2VudH0lYCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBEaXJlY3Rpb24gaGVscGVyXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBzYWZlU2V0RGlyZWN0aW9uKCk6IHZvaWQge1xuICB0cnkge1xuICAgIGNvbnN0IGRpciA9IGdldFBhZ2VEaXJlY3Rpb24oKTtcbiAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnZGF0YS1jcWQtZGlyJywgZGlyKTtcbiAgfSBjYXRjaCB7XG4gICAgLy8gaWdub3JlXG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0UGFnZURpcmVjdGlvbigpOiAnbHRyJyB8ICdydGwnIHtcbiAgY29uc3QgZG9jRGlyID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRpciB8fCBkb2N1bWVudC5ib2R5LmRpcjtcbiAgaWYgKGRvY0RpciA9PT0gJ3J0bCcpIHJldHVybiAncnRsJztcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5kaXJlY3Rpb247XG4gIHJldHVybiBjb21wdXRlZCA9PT0gJ3J0bCcgPyAncnRsJyA6ICdsdHInO1xufSIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNDTyxRQUFNLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMkI5QixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQzVCRCxRQUFNLFdBQVc7QUFDakIsUUFBTSxrQkFBa0I7QUFFeEIsUUFBTSxnQkFBZ0I7QUFDdEIsUUFBTSxpQkFBaUIsR0FBRyxhQUFhO0FBRWhDLFdBQVMsZUFBcUI7QUFDbkMsUUFBSSxPQUFPLGFBQWEsWUFBYTtBQUNyQyxRQUFJLFNBQVMsZUFBZSxRQUFRLEVBQUc7QUFFdkMsVUFBTSxRQUFRLFNBQVMsY0FBYyxPQUFPO0FBQzVDLFVBQU0sS0FBSztBQUNYLFVBQU0sY0FBYztBQUFBO0FBQUEsMEJBRUksY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkFvSVQscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFpSnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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
downloadall;