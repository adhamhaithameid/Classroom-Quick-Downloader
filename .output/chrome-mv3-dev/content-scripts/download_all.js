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
  const MIN_FILES_FOR_DOWNLOAD_ALL = 2;
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
      if (document.body) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "data-cqd-all-done"]
        });
      }
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
    if (totalFiles < MIN_FILES_FOR_DOWNLOAD_ALL) {
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
  function findHeaderContainer(root) {
    const internalHeader = root.querySelector(".JZicYb.gmNu1d") || root.querySelector(".N5dSp") || root.querySelector(".JZicYb");
    if (internalHeader) return internalHeader;
    let current = root;
    while (current && current !== document.body && current !== document.documentElement) {
      const parent = current.parentElement;
      if (!parent) break;
      const headers = Array.from(
        parent.querySelectorAll(
          ".JZicYb.gmNu1d, .N5dSp, .JZicYb"
        )
      );
      let best = null;
      for (const h of headers) {
        const rel = h.compareDocumentPosition(current);
        const isBefore = !!(rel & Node.DOCUMENT_POSITION_FOLLOWING);
        const isDisconnected = !!(rel & Node.DOCUMENT_POSITION_DISCONNECTED);
        if (isDisconnected || !isBefore) continue;
        if (!best) {
          best = h;
        } else {
          const rel2 = best.compareDocumentPosition(h);
          const hAfterBest = !!(rel2 & Node.DOCUMENT_POSITION_FOLLOWING);
          if (hAfterBest) best = h;
        }
      }
      if (best) return best;
      current = parent;
    }
    return null;
  }
  function ensureDownloadAllButton(group) {
    const existing = group.downloadAllBtn;
    if (existing && existing.isConnected) return existing;
    const root = group.root;
    const headerContainer = findHeaderContainer(root);
    const targetContainer = headerContainer || root;
    const isInHeader = !!headerContainer;
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
    if (!isInHeader && targetContainer === root) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG93bmxvYWRfYWxsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaWNvbnMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaTE4bi50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9kb3dubG9hZF9hbGwuY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcblxuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuXG4gICAgICAvKiBTcGlubmVyICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmO1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAoTGlnaHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA1REQ3O1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDkzLCAyMTUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgOTMsIDIxNSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0VDNjMwMDtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC10aGVtZS1kYXJrIHtcbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gKFNpbmdsZSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICAgIHRyYW5zZm9ybTogc2NhbGUoMC45Nyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWljb24td3JhcHBlciB7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtaWNvbiB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogdXJsKFwiJHtET1dOTE9BRF9JQ09OX1NWR19VUkx9XCIpO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLXNtYWxsIHtcbiAgICAgIHdpZHRoOiAxNnB4O1xuICAgICAgaGVpZ2h0OiAxNnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAxNnB4IDE2cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLW1lZGl1bSB7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMjRweCAyNHB4O1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1sYXJnZSB7XG4gICAgICB3aWR0aDogMzJweDtcbiAgICAgIGhlaWdodDogMzJweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMzJweCAzMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXgtd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBtYXJnaW4tbGVmdCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgd2lkdGg6IDE1MHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcge1xuICAgICAgd2lkdGg6IDExMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXRyeWluZyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXRyeWluZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcgLmNxZC1sYWJlbCxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogMTJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICB3aWR0aDogOTBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIG1heC13aWR0aDogMTUwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA0MHB4O1xuICAgICAgcGFkZGluZy10b3A6IDA7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogMDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZXJyb3ItZGV0YWlsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxLjM7XG4gICAgICBtYXJnaW46IDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aGl0ZS1zcGFjZTogbm9ybWFsO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDRweCk7XG4gICAgICB0cmFuc2l0aW9uOiBhbGwgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciB7XG4gICAgICB3aWR0aDogMzUwcHg7XG4gICAgICBtYXgtd2lkdGg6IDM2MHB4O1xuICAgICAgaGVpZ2h0OiA2MHB4O1xuICAgICAgbWF4LWhlaWdodDogNjFweDtcbiAgICAgIHBhZGRpbmc6IDhweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDE4cHg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgZ2FwOiA3cHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG1hcmdpbjogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDYwcHg7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGNxZC1zcGluIHtcbiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDIuIENPTU1FTlRTICYgRURJVEVEIChPdmVybGF5KVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICByaWdodDogMDtcbiAgICAgIGJvdHRvbTogMDtcbiAgICAgIHBvaW50ZXItZXZlbnRzOiBub25lO1xuICAgICAgei1pbmRleDogMTA7XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCB2YXIoLS1jcWQtY29sb3ItY29tbWVudCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoOTksIDEwMiwgMjQxLCAwLjUpO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICB3aWR0aDogMTAwJTtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTEwcHgpO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLCB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIC5jcWQtZWRpdGVkLWNvbnRlbnQge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kaWZmLXZhbCB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF1bZGF0YS1jcWQtcHJvY2Vzc2VkXVtkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkXSA+IC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4ICNGRjQwMzYsXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogNzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGRjQwMzY7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHBhZGRpbmctdG9wOiA4cHg7XG4gICAgICB0cmFuc2l0aW9uOiBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtc2VjdGlvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbiB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24tZWRpdGVkIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1wbHVzIHtcbiAgICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBsaW5lLWhlaWdodDogMTtcbiAgICAgIG1hcmdpbjogNXB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSxcbiAgICAuY3FkLWJvdGgtZGl2aWRlciB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXgtaGVpZ2h0IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1hcmdpbi10b3AgMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogMTIwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciAuY3FkLWJvdGgtdmFsdWUge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiA0cHg7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OIChIZWFkZXItYWxpZ25lZClcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4ge1xuICAgICAgLyogUHJvZ3Jlc3MgY29udHJvbCAoMCUgdG8gMTAwJSkgKi9cbiAgICAgIC0tY3FkLXByb2dyZXNzOiAwJTtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMTJweDtcbiAgICAgIHJpZ2h0OiA0OHB4O1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgei1pbmRleDogNjtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgcGFkZGluZzogNHB4IDEycHg7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ub3JtYWwpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEycHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgZ2FwOiA2cHg7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xcyBlYXNlLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIDAuM3MgZWFzZTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWigwKTtcbiAgICB9XG5cbiAgICAvKiBXaGVuIGluamVjdGVkIGludG8gdGhlIGhlYWRlciBmbGV4IHN0cnVjdHVyZSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtaW4taGVhZGVyIHtcbiAgICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICAgIHRvcDogYXV0bztcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgICAgbGVmdDogYXV0bztcbiAgICAgIGJvdHRvbTogYXV0bztcbiAgICAgIHRyYW5zZm9ybTogbm9uZTtcbiAgICAgIFxuICAgICAgLyogSW1wb3J0YW50OiBNYXJnaW4gdG8gc2VwYXJhdGUgZnJvbSB0aGUgXCJUaHJlZSBEb3RzXCIgbWVudSAqL1xuICAgICAgbWFyZ2luLWlubGluZS1lbmQ6IDhweDtcbiAgICAgIFxuICAgICAgLyogRW5zdXJlIGl0IGRvZXNuJ3QgZ2V0IGNydXNoZWQgaW4gZmxleCByb3dzICovXG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIGFsaWduLXNlbGY6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAvKiBSVEwgZmFsbGJhY2sgb25seSBmb3Igbm9uLWhlYWRlciBjYXNlcyAoYWJzb2x1dGUgcG9zaXRpb25lZCBhdCB0b3AgY29ybmVyKSAqL1xuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0bjpub3QoLmNxZC1pbi1oZWFkZXIpIHtcbiAgICAgIHJpZ2h0OiBhdXRvO1xuICAgICAgbGVmdDogNDhweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuOmFjdGl2ZSB7XG4gICAgICB0cmFuc2Zvcm06IHNjYWxlKDAuOTcpO1xuICAgIH1cblxuICAgIC8qIEtlZXAgcG9pbnRlciBjdXJzb3IgZXZlbiB3aGlsZSBkaXNhYmxlZCAqL1xuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bltkaXNhYmxlZF0ge1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgIH1cblxuICAgIC8qIEZVTEwgU1VDQ0VTUyBTVEFURSAoU29saWQgR3JlZW4pICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtc3VjY2VzcyB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLWVycm9yIHtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTtcbiAgICB9XG5cbiAgICAvKiBQUk9HUkVTUyBCQVIgT1ZFUkxBWSAoRmlsbHMgdXApICovXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuOjphZnRlciB7XG4gICAgICBjb250ZW50OiAnJztcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogMDtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICB6LWluZGV4OiAwO1xuXG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG5cbiAgICAgIC8qIFdpZHRoIGNvbnRyb2xsZWQgYnkgSlMgKi9cbiAgICAgIHdpZHRoOiB2YXIoLS1jcWQtcHJvZ3Jlc3MpO1xuICAgICAgdHJhbnNpdGlvbjogd2lkdGggMC4zcyBjdWJpYy1iZXppZXIoMC4yMiwgMC42MSwgMC4zNiwgMSk7XG5cbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuLmNxZC1hbGwtc3VjY2Vzczo6YWZ0ZXIge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICB9XG5cbiAgICAvKiBDb250ZW50IGxheWVycyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1tYWluLFxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1zdWIsXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlciB7XG4gICAgICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gICAgICB6LWluZGV4OiAyO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXIge1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtaWNvbiB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE4cHggMThweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1tYWluIHtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1YiB7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBvcGFjaXR5OiAwLjk7XG4gICAgICBtYXJnaW4tbGVmdDogNHB4O1xuICAgIH1cblxuICBgLnRyaW0oKTtcblxuICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpLmFwcGVuZENoaWxkKHN0eWxlKTtcbn0iLCJjb25zdCBUUkFOU0xBVElPTlM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7XG4gIGVuOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdEb3dubG9hZGluZ+KApicsXG4gICAgdHJ5aW5nOiAnVHJ5aW5n4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRG93bmxvYWRlZCcsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnRG93bmxvYWQgZmFpbGVkLicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdRdWljayBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdjb21tZW50cycsXG4gICAgZWRpdGVkOiAnRWRpdGVkJyxcbiAgICBkb3dubG9hZEFsbDogJ0Rvd25sb2FkIGFsbCcsXG4gIH0sXG4gIGFyOiB7XG4gICAgZG93bmxvYWQ6ICfYqtmG2LLZitmEJyxcbiAgICBkb3dubG9hZGluZzogJ9is2KfYsdmKINin2YTYqtmG2LLZitmE4oCmJyxcbiAgICB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfYqtmFINin2YTYqtmG2LLZitmEJyxcbiAgICBlcnJvcjogJ9iu2LfYoycsXG4gICAgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsXG4gICAgYXJpYURvd25sb2FkOiAn2KrZhtiy2YrZhCcsXG4gICAgdGl0bGVRdWljazogJ9iq2YbYstmK2YQg2LPYsdmK2LknLFxuICAgIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLFxuICAgIGVkaXRlZDogJ9iq2YUg2KfZhNiq2LnYr9mK2YQnLFxuICAgIGRvd25sb2FkQWxsOiAn2KrZhtiy2YrZhCDYp9mE2YPZhCcsXG4gIH0sXG4gIGphOiB7XG4gICAgZG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLFxuICAgIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLFxuICAgIHRyeWluZzogJ+ippuihjOS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+WujOS6hicsXG4gICAgZXJyb3I6ICfjgqjjg6njg7wnLFxuICAgIGZhaWxlZDogJ+WkseaVl+OBl+OBvuOBl+OBn+OAgicsXG4gICAgYXJpYURvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJyxcbiAgICB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJyxcbiAgICBjb21tZW50czogJ+S7tuOBruOCs+ODoeODs+ODiCcsXG4gICAgZWRpdGVkOiAn57eo6ZuG5riI44G/JyxcbiAgfSxcbiAgZXM6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsXG4gICAgdHJ5aW5nOiAnSW50ZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0ZhbGzDsyBsYSBkZXNjYXJnYS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICBoaToge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsXG4gICAgdHJ5aW5nOiAn4KSV4KWL4KS24KS/4KS2IOCknOCkvuCksOClgOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLFxuICAgIGZhaWxlZDogJ+CkteCkv+Ckq+CksiDgpLDgpLngpL4nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KS/4KSv4KS+4KSBJyxcbiAgICBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICBwdDoge1xuICAgIGRvd25sb2FkOiAnQmFpeGFyJyxcbiAgICBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdUZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0JhaXhhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsaGEgYW8gYmFpeGFyLicsXG4gICAgYXJpYURvd25sb2FkOiAnQmFpeGFyJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsXG4gICAgY29tbWVudHM6ICdjb21lbnTDoXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICAncHQtcHQnOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsXG4gICAgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJyxcbiAgICB0cnlpbmc6ICdBIHRlbnRhcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxoYSBhbyBkZXNjYXJyZWdhci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnTDoXJpb3MnLFxuICAgIGVkaXRlZDogJ0VkaXRhZG8nLFxuICB9LFxuICAnemgtY24nOiB7XG4gICAgZG93bmxvYWQ6ICfkuIvovb0nLFxuICAgIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJyxcbiAgICB0cnlpbmc6ICflsJ3or5XkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflt7LkuIvovb0nLFxuICAgIGVycm9yOiAn6ZSZ6K+vJyxcbiAgICBmYWlsZWQ6ICfkuIvovb3lpLHotKUnLFxuICAgIGFyaWFEb3dubG9hZDogJ+S4i+i9vScsXG4gICAgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsXG4gICAgY29tbWVudHM6ICfmnaHor4TorronLFxuICAgIGVkaXRlZDogJ+W3sue8lui+kScsXG4gIH0sXG4gICd6aC10dyc6IHtcbiAgICBkb3dubG9hZDogJ+S4i+i8iScsXG4gICAgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLFxuICAgIHRyeWluZzogJ+WYl+ippuS4reKApicsXG4gICAgZG93bmxvYWRlZDogJ+W3suS4i+i8iScsXG4gICAgZXJyb3I6ICfpjK/oqqQnLFxuICAgIGZhaWxlZDogJ+S4i+i8ieWkseaVlycsXG4gICAgYXJpYURvd25sb2FkOiAn5LiL6LyJJyxcbiAgICB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJyxcbiAgICBjb21tZW50czogJ+WJh+eVmeiogCcsXG4gICAgZWRpdGVkOiAn5bey57eo6LyvJyxcbiAgfSxcbiAgZnI6IHtcbiAgICBkb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLFxuICAgIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsXG4gICAgdHJ5aW5nOiAnRXNzYWnigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUw6lsw6ljaGFyZ8OpJyxcbiAgICBlcnJvcjogJ0VycmV1cicsXG4gICAgZmFpbGVkOiAnw4ljaGVjLicsXG4gICAgYXJpYURvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsXG4gICAgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRhaXJlcycsXG4gICAgZWRpdGVkOiAnTW9kaWZpw6knLFxuICB9LFxuICBkZToge1xuICAgIGRvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsXG4gICAgdHJ5aW5nOiAnVmVyc3VjaGVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmVydGlnJyxcbiAgICBlcnJvcjogJ0ZlaGxlcicsXG4gICAgZmFpbGVkOiAnRmVobGdlc2NobGFnZW4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJyxcbiAgICB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJyxcbiAgICBjb21tZW50czogJ0tvbW1lbnRhcmUnLFxuICAgIGVkaXRlZDogJ0JlYXJiZWl0ZXQnLFxuICB9LFxuICBpdDoge1xuICAgIGRvd25sb2FkOiAnU2NhcmljYScsXG4gICAgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLFxuICAgIHRyeWluZzogJ1Byb3ZhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2NhcmljYXRvJyxcbiAgICBlcnJvcjogJ0Vycm9yZScsXG4gICAgZmFpbGVkOiAnRmFsbGl0by4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1NjYXJpY2EnLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudGknLFxuICAgIGVkaXRlZDogJ01vZGlmaWNhdG8nLFxuICB9LFxuICBydToge1xuICAgIGRvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLFxuICAgIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLFxuICAgIHRyeWluZzogJ9Cf0L7Qv9GL0YLQutCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0KHQutCw0YfQsNC90L4nLFxuICAgIGVycm9yOiAn0J7RiNC40LHQutCwJyxcbiAgICBmYWlsZWQ6ICfQodCx0L7QuS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LzQtdC90YLQsNGA0LjQtdCyJyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdC90LXQvdC+JyxcbiAgfSxcbiAga286IHtcbiAgICBkb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsXG4gICAgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJyxcbiAgICB0cnlpbmc6ICfsi5zrj4Qg7KSR4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn7JmE66OMJyxcbiAgICBlcnJvcjogJ+yYpOulmCcsXG4gICAgZmFpbGVkOiAn7Iuk7Yyo7ZWoJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLFxuICAgIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJyxcbiAgICBjb21tZW50czogJ+qwnCDrjJPquIAnLFxuICAgIGVkaXRlZDogJ+yImOygleuQqCcsXG4gIH0sXG4gIHRyOiB7XG4gICAgZG93bmxvYWQ6ICfEsG5kaXInLFxuICAgIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJyxcbiAgICB0cnlpbmc6ICdEZW5lbml5b3LigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfEsG5kaXJpbGRpJyxcbiAgICBlcnJvcjogJ0hhdGEnLFxuICAgIGZhaWxlZDogJ0JhxZ9hcsSxc8Sxei4nLFxuICAgIGFyaWFEb3dubG9hZDogJ8SwbmRpcicsXG4gICAgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLFxuICAgIGNvbW1lbnRzOiAneW9ydW0nLFxuICAgIGVkaXRlZDogJ0TDvHplbmxlbmRpJyxcbiAgfSxcbiAgdmk6IHtcbiAgICBkb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLFxuICAgIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLFxuICAgIHRyeWluZzogJ8SQYW5nIHRo4but4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnxJDDoyB04bqjaScsXG4gICAgZXJyb3I6ICdM4buXaScsXG4gICAgZmFpbGVkOiAnVGjhuqV0IGLhuqFpLicsXG4gICAgYXJpYURvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsXG4gICAgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLFxuICAgIGNvbW1lbnRzOiAnbmjhuq1uIHjDqXQnLFxuICAgIGVkaXRlZDogJ8SQw6MgY2jhu4luaCBz4butYScsXG4gIH0sXG4gIGlkOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLFxuICAgIHRyeWluZzogJ01lbmNvYmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTZWxlc2FpJyxcbiAgICBlcnJvcjogJ0tlc2FsYWhhbicsXG4gICAgZmFpbGVkOiAnR2FnYWwuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyJyxcbiAgICBlZGl0ZWQ6ICdEaWVkaXQnLFxuICB9LFxuICB0aDoge1xuICAgIGRvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJyxcbiAgICBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsXG4gICAgdHJ5aW5nOiAn4Lie4Lii4Liy4Lii4Liy4Lih4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LmA4Liq4Lij4LmH4LiI4Liq4Li04LmJ4LiZJyxcbiAgICBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsXG4gICAgZmFpbGVkOiAn4Lil4LmJ4Lih4LmA4Lir4Lil4LinJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLFxuICAgIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLFxuICAgIGNvbW1lbnRzOiAn4LiE4Lin4Liy4Lih4LiE4Li04LiU4LmA4Lir4LmH4LiZJyxcbiAgICBlZGl0ZWQ6ICfguYHguIHguYnguYTguILguYHguKXguYnguKcnLFxuICB9LFxuICBwbDoge1xuICAgIGRvd25sb2FkOiAnUG9iaWVyeicsXG4gICAgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJyxcbiAgICB0cnlpbmc6ICdQcsOzYmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQb2JyYW5vJyxcbiAgICBlcnJvcjogJ0LFgsSFZCcsXG4gICAgZmFpbGVkOiAnTmlldWRhbmUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQb2JpZXJ6JyxcbiAgICB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyemUnLFxuICAgIGVkaXRlZDogJ0VkeXRvd2FubycsXG4gIH0sXG4gIG5sOiB7XG4gICAgZG93bmxvYWQ6ICdEb3dubG9hZGVuJyxcbiAgICBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLFxuICAgIHRyeWluZzogJ1Byb2JlcmVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhYXInLFxuICAgIGVycm9yOiAnRm91dCcsXG4gICAgZmFpbGVkOiAnTWlzbHVrdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkZW4nLFxuICAgIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLFxuICAgIGNvbW1lbnRzOiAncmVhY3RpZXMnLFxuICAgIGVkaXRlZDogJ0Jld2Vya3QnLFxuICB9LFxuICBibjoge1xuICAgIGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLFxuICAgIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgprDgppvgp4figKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgpqjgp43gpqgnLFxuICAgIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JyxcbiAgICBmYWlsZWQ6ICfgpqzgp43gpq/gprDgp43gpqUg4Ka54Kav4Ka84KeH4Kab4KeHJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICBjb21tZW50czogJ+Cmn+CmvyDgpq7gpqjgp43gpqTgpqzgp43gpq8nLFxuICAgIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcsXG4gIH0sXG4gIHBhOiB7XG4gICAgZG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLFxuICAgIHRyeWluZzogJ+ColeCpi+CouOCovOCov+CouOCovCDgqJzgqL7gqLDgqYDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgqK7gqYHgqJXgqbDgqK7gqLInLFxuICAgIGVycm9yOiAn4KiX4Kiy4Kik4KmAJyxcbiAgICBmYWlsZWQ6ICfgqIXgqLjgqKvgqLInLFxuICAgIGFyaWFEb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsXG4gICAgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIGNvbW1lbnRzOiAn4Kif4Ki/4Kmx4Kiq4Kij4KmA4KiG4KiCJyxcbiAgICBlZGl0ZWQ6ICfgqLjgqbDgqKrgqL7gqKbgqL/gqKQnLFxuICB9LFxuICB0ZToge1xuICAgIGRvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLFxuICAgIHRyeWluZzogJ+CwquCxjeCwsOCwr+CwpOCxjeCwqOCwv+CwuOCxjeCwpOCxi+CwguCwpuCwv+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CwquCxguCwsOCxjeCwpOCwr+Cwv+CwguCwpuCwvycsXG4gICAgZXJyb3I6ICfgsLLgsYvgsKrgsIInLFxuICAgIGZhaWxlZDogJ+CwteCwv+Cwq+CwsuCwruCxiOCwguCwpuCwvycsXG4gICAgYXJpYURvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJyxcbiAgICB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgY29tbWVudHM6ICfgsLXgsY3gsK/gsL7gsJbgsY3gsK/gsLLgsYEnLFxuICAgIGVkaXRlZDogJ+CwuOCwteCwsOCwv+CwguCwmuCwrOCwoeCwv+CwguCwpuCwvycsXG4gIH0sXG4gIG1yOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLFxuICAgIHRyeWluZzogJ+CkquCljeCksOCkr+CkpOCljeCkqCDgpJXgpLDgpKQg4KSG4KS54KWH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJyxcbiAgICBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsXG4gICAgZmFpbGVkOiAn4KSF4KSv4KS24KS44KWN4KS14KWAJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+CljeCkr+CkvicsXG4gICAgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgdGE6IHtcbiAgICBkb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsXG4gICAgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrqrgr43grqrgrp/gr4HgrpXgrr/grrHgrqTgr4HigKYnLFxuICAgIHRyeWluZzogJ+CuruCvgeCur+CuseCvjeCumuCuv+CuleCvjeCuleCuv+CuseCupOCvgeKApicsXG4gICAgZG93bmxvYWRlZDogJ+CuruCvgeCun+Cuv+CuqOCvjeCupOCupOCvgScsXG4gICAgZXJyb3I6ICfgrqrgrr/grrTgr4gnLFxuICAgIGZhaWxlZDogJ+CupOCvi+CusuCvjeCuteCuvycsXG4gICAgYXJpYURvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJyxcbiAgICB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsXG4gICAgY29tbWVudHM6ICfgrpXgrrDgr4HgrqTgr43grqTgr4HgrpXgrrPgr40nLFxuICAgIGVkaXRlZDogJ+CupOCuv+CusOCvgeCupOCvjeCupOCuquCvjeCuquCun+CvjeCun+CupOCvgScsXG4gIH0sXG4gIHVyOiB7XG4gICAgZG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLFxuICAgIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLFxuICAgIHRyeWluZzogJ9qp2YjYtNi0INis2KfYsduM4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2YXaqdmF2YQnLFxuICAgIGVycm9yOiAn2LrZhNi324wnLFxuICAgIGZhaWxlZDogJ9mG2Kfaqdin2YUnLFxuICAgIGFyaWFEb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsXG4gICAgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsXG4gICAgY29tbWVudHM6ICfYqtio2LXYsduSJyxcbiAgICBlZGl0ZWQ6ICfYqtix2YXbjNmFINi02K/bgScsXG4gIH0sXG4gIGd1OiB7XG4gICAgZG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJyxcbiAgICB0cnlpbmc6ICfgqqrgq43gqrDgqq/gqr7gqrgg4Kqa4Kq+4Kqy4KuB4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Kqq4KuC4Kqw4KuN4KqjJyxcbiAgICBlcnJvcjogJ+CqreCrguCqsicsXG4gICAgZmFpbGVkOiAn4Kqo4Kq/4Kq34KuN4Kqr4KqzJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICBjb21tZW50czogJ+Cqn+Cqv+CqquCrjeCqquCqo+CrgOCqkycsXG4gICAgZWRpdGVkOiAn4Kq44KqC4Kqq4Kq+4Kqm4Kq/4KqkJyxcbiAgfSxcbiAga246IHtcbiAgICBkb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJyxcbiAgICB0cnlpbmc6ICfgsqrgs43gsrDgsq/gsqTgs43gsqjgsr/gsrjgs4HgsqTgs43gsqTgsr/gsqbgs4bigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgsqrgs4LgsrDgs43gsqPgspfgs4rgsoLgsqHgsr/gsqbgs4YnLFxuICAgIGVycm9yOiAn4LKm4LOL4LK3JyxcbiAgICBmYWlsZWQ6ICfgsrXgsr/gsqvgsrLgsrXgsr7gspfgsr/gsqbgs4YnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsXG4gICAgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIGNvbW1lbnRzOiAn4LKV4LK+4LKu4LOG4LKC4LKf4LON4oCM4LKX4LKz4LOBJyxcbiAgICBlZGl0ZWQ6ICfgsrjgsoLgsqrgsr7gsqbgsr/gsrjgsrLgsr7gspfgsr/gsqbgs4YnLFxuICB9LFxuICBtbDoge1xuICAgIGRvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLFxuICAgIHRyeWluZzogJ+C0tuC1jeC0sOC0ruC0v+C0leC1jeC0leC1geC0qOC1jeC0qOC1geKApicsXG4gICAgZG93bmxvYWRlZDogJ+C0quC1guC1vOC0pOC1jeC0pOC0v+C0r+C0vuC0r+C0vycsXG4gICAgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLFxuICAgIGZhaWxlZDogJ+C0quC0sOC0vuC0nOC0r+C0quC1jeC0quC1huC0n+C1jeC0n+C1gScsXG4gICAgYXJpYURvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJyxcbiAgICB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgY29tbWVudHM6ICfgtIXgtK3gtL/gtKrgtY3gtLDgtL7gtK/gtJngtY3gtJngtb4nLFxuICAgIGVkaXRlZDogJ+C0juC0oeC0v+C0seC1jeC0seC1geC0muC1huC0r+C1jeC0pOC1gScsXG4gIH0sXG4gIHVrOiB7XG4gICAgZG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JyxcbiAgICBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsXG4gICAgdHJ5aW5nOiAn0KHQv9GA0L7QsdCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10LLQtNCw0YfQsC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDRltCyJyxcbiAgICBlZGl0ZWQ6ICfQl9C80ZbQvdC10L3QvicsXG4gIH0sXG4gIGVsOiB7XG4gICAgZG93bmxvYWQ6ICfOm86uz4jOtycsXG4gICAgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsXG4gICAgdHJ5aW5nOiAnzqDPgc6/z4PPgM6szrjOtc65zrHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfOn867zr/Ous67zrfPgc+OzrjOt866zrUnLFxuICAgIGVycm9yOiAnzqPPhs6szrvOvM6xJyxcbiAgICBmYWlsZWQ6ICfOkc+Azq3PhM+Fz4fOtS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ86bzq7PiM63JyxcbiAgICB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLFxuICAgIGNvbW1lbnRzOiAnz4PPh8+MzrvOuc6xJyxcbiAgICBlZGl0ZWQ6ICfOlc+AzrXOvs61z4HOs86xz4POvM6tzr3OvycsXG4gIH0sXG4gIGNzOiB7XG4gICAgZG93bmxvYWQ6ICdTdMOhaG5vdXQnLFxuICAgIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLFxuICAgIHRyeWluZzogJ1prb3XFocOtbeKApicsXG4gICAgZG93bmxvYWRlZDogJ1N0YcW+ZW5vJyxcbiAgICBlcnJvcjogJ0NoeWJhJyxcbiAgICBmYWlsZWQ6ICdTZWxoYWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnU3TDoWhub3V0JyxcbiAgICB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLFxuICAgIGNvbW1lbnRzOiAna29tZW50w6HFmcWvJyxcbiAgICBlZGl0ZWQ6ICdVcHJhdmVubycsXG4gIH0sXG4gIHJvOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLFxuICAgIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJyxcbiAgICB0cnlpbmc6ICdTZSDDrm5jZWFyY8SD4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmluYWxpemF0JyxcbiAgICBlcnJvcjogJ0Vyb2FyZScsXG4gICAgZmFpbGVkOiAnRciZdWF0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY8SDcmNhyJtpJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlpJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmljYXQnLFxuICB9LFxuICBodToge1xuICAgIGRvd25sb2FkOiAnTGV0w7ZsdMOpcycsXG4gICAgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJyxcbiAgICB0cnlpbmc6ICdQcsOzYsOhbGtvesOhc+KApicsXG4gICAgZG93bmxvYWRlZDogJ0vDqXN6JyxcbiAgICBlcnJvcjogJ0hpYmEnLFxuICAgIGZhaWxlZDogJ1Npa2VydGVsZW4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMZXTDtmx0w6lzJyxcbiAgICB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsXG4gICAgY29tbWVudHM6ICdtZWdqZWd5esOpcycsXG4gICAgZWRpdGVkOiAnU3plcmtlc3p0dmUnLFxuICB9LFxuICBzdjoge1xuICAgIGRvd25sb2FkOiAnTGFkZGEgbmVyJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLFxuICAgIHRyeWluZzogJ0bDtnJzw7ZrZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLbGFydCcsXG4gICAgZXJyb3I6ICdGZWwnLFxuICAgIGZhaWxlZDogJ01pc3NseWNrYWRlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhZGRhIG5lcicsXG4gICAgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VyYWQnLFxuICB9LFxuICBkYToge1xuICAgIGRvd25sb2FkOiAnSGVudCcsXG4gICAgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLFxuICAgIHRyeWluZzogJ1Byw7h2ZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdIZW50ZXQnLFxuICAgIGVycm9yOiAnRmVqbCcsXG4gICAgZmFpbGVkOiAnTWlzbHlra2VkZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdIZW50JyxcbiAgICB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VyZXQnLFxuICB9LFxuICBmaToge1xuICAgIGRvd25sb2FkOiAnTGF0YWEnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLFxuICAgIHRyeWluZzogJ1lyaXRldMOkw6Ru4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnTGFkYXR0dScsXG4gICAgZXJyb3I6ICdWaXJoZScsXG4gICAgZmFpbGVkOiAnRXDDpG9ubmlzdHVpLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGF0YWEnLFxuICAgIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnR0aWEnLFxuICAgIGVkaXRlZDogJ011b2thdHR1JyxcbiAgfSxcbiAgbm86IHtcbiAgICBkb3dubG9hZDogJ0xhc3QgbmVkJyxcbiAgICBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLFxuICAgIHRyeWluZzogJ1Byw7h2ZXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdGZXJkaWcnLFxuICAgIGVycm9yOiAnRmVpbCcsXG4gICAgZmFpbGVkOiAnTWlzbHlrdGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFzdCBuZWQnLFxuICAgIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZXInLFxuICAgIGVkaXRlZDogJ1JlZGlnZXJ0JyxcbiAgfSxcbiAgaGU6IHtcbiAgICBkb3dubG9hZDogJ9eU15XXqNeT15QnLFxuICAgIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsXG4gICAgdHJ5aW5nOiAn157XoNeh15TigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfXlNeV16nXnNedJyxcbiAgICBlcnJvcjogJ9ep15LXmdeQ15QnLFxuICAgIGZhaWxlZDogJ9eg15vXqdecJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfXlNeV16jXk9eUJyxcbiAgICB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJyxcbiAgICBjb21tZW50czogJ9eq15LXldeR15XXqicsXG4gICAgZWRpdGVkOiAn16DXoteo15onLFxuICB9LFxuICBmYToge1xuICAgIGRvd25sb2FkOiAn2K/Yp9mG2YTZiNivJyxcbiAgICBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJyxcbiAgICB0cnlpbmc6ICfYqtmE2KfYtCDZhdis2K/Yr+KApicsXG4gICAgZG93bmxvYWRlZDogJ9in2YbYrNin2YUg2LTYrycsXG4gICAgZXJyb3I6ICfYrti32KcnLFxuICAgIGZhaWxlZDogJ9mG2KfZhdmI2YHZgicsXG4gICAgYXJpYURvd25sb2FkOiAn2K/Yp9mG2YTZiNivJyxcbiAgICB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JyxcbiAgICBjb21tZW50czogJ9mG2LjYsScsXG4gICAgZWRpdGVkOiAn2YjbjNix2KfbjNi0INi02K/ZhycsXG4gIH0sXG4gIGZpbDoge1xuICAgIGRvd25sb2FkOiAnSS1kb3dubG9hZCcsXG4gICAgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsXG4gICAgdHJ5aW5nOiAnU2ludXN1YnVrYW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUYXBvcyBuYScsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnTmFiaWdvLicsXG4gICAgYXJpYURvd25sb2FkOiAnSS1kb3dubG9hZCcsXG4gICAgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnbWdhIGtvbWVudG8nLFxuICAgIGVkaXRlZDogJ05hLWVkaXQnLFxuICB9LFxuICBtczoge1xuICAgIGRvd25sb2FkOiAnTXVhdCB0dXJ1bicsXG4gICAgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLFxuICAgIHRyeWluZzogJ01lbmN1YmHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTZWxlc2FpJyxcbiAgICBlcnJvcjogJ1JhbGF0JyxcbiAgICBmYWlsZWQ6ICdHYWdhbC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ011YXQgdHVydW4nLFxuICAgIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsXG4gICAgY29tbWVudHM6ICdrb21lbicsXG4gICAgZWRpdGVkOiAnRGllZGl0JyxcbiAgfSxcbiAgc3I6IHtcbiAgICBkb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JyxcbiAgICBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJyxcbiAgICB0cnlpbmc6ICfQn9C+0LrRg9GI0LDQstCw0LzigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQl9Cw0LLRgNGI0LXQvdC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10ZrQtdC90L4nLFxuICB9LFxuICBzazoge1xuICAgIGRvd25sb2FkOiAnU3RpYWhudcWlJyxcbiAgICBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJyxcbiAgICB0cnlpbmc6ICdTa8O6xaFhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0hvdG92bycsXG4gICAgZXJyb3I6ICdDaHliYScsXG4gICAgZmFpbGVkOiAnWmx5aGFsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1N0aWFobnXFpScsXG4gICAgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsXG4gICAgY29tbWVudHM6ICdrb21lbnTDoXJvdicsXG4gICAgZWRpdGVkOiAnVXByYXZlbsOpJyxcbiAgfSxcbiAgYmc6IHtcbiAgICBkb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JyxcbiAgICBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsXG4gICAgdHJ5aW5nOiAn0J7Qv9C40YLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQsCcsXG4gICAgZWRpdGVkOiAn0KDQtdC00LDQutGC0LjRgNCw0L3QvicsXG4gIH0sXG4gIGhyOiB7XG4gICAgZG93bmxvYWQ6ICdQcmV1em1pJyxcbiAgICBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJyxcbiAgICB0cnlpbmc6ICdQb2t1xaFhdmFt4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnR290b3ZvJyxcbiAgICBlcnJvcjogJ0dyZcWha2EnLFxuICAgIGZhaWxlZDogJ05ldXNwamVsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ByZXV6bWknLFxuICAgIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyYScsXG4gICAgZWRpdGVkOiAnVXJlxJFlbm8nLFxuICB9LFxuICBsdDoge1xuICAgIGRvd25sb2FkOiAnQXRzaXNpxbNzdGknLFxuICAgIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsXG4gICAgdHJ5aW5nOiAnQmFuZG9tYeKApicsXG4gICAgZG93bmxvYWRlZDogJ0JhaWd0YScsXG4gICAgZXJyb3I6ICdLbGFpZGEnLFxuICAgIGZhaWxlZDogJ05lcGF2eWtvLicsXG4gICAgYXJpYURvd25sb2FkOiAnQXRzaXNpxbNzdGknLFxuICAgIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLFxuICAgIGNvbW1lbnRzOiAna29tZW50YXJhaScsXG4gICAgZWRpdGVkOiAnUmVkYWd1b3RhJyxcbiAgfSxcbiAgbHY6IHtcbiAgICBkb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JyxcbiAgICBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLFxuICAgIHRyeWluZzogJ03Ek8SjaW5h4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUGFiZWlndHMnLFxuICAgIGVycm9yOiAnS8S8xatkYScsXG4gICAgZmFpbGVkOiAnTmVpemRldsSBcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JyxcbiAgICB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsXG4gICAgY29tbWVudHM6ICdrb21lbnTEgXJpJyxcbiAgICBlZGl0ZWQ6ICdSZWRpxKPEk3RzJyxcbiAgfSxcbiAgZXQ6IHtcbiAgICBkb3dubG9hZDogJ0xhYWRpIGFsbGEnLFxuICAgIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9vdmlu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVmFsbWlzJyxcbiAgICBlcnJvcjogJ1ZpZ2EnLFxuICAgIGZhaWxlZDogJ0ViYcO1bm5lc3R1cy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhYWRpIGFsbGEnLFxuICAgIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhYXJpJyxcbiAgICBlZGl0ZWQ6ICdNdXVkZXR1ZCcsXG4gIH0sXG4gIHNsOiB7XG4gICAgZG93bmxvYWQ6ICdQcmVub3MnLFxuICAgIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLFxuICAgIHRyeWluZzogJ1Bvc2t1xaFhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0tvbsSNYW5vJyxcbiAgICBlcnJvcjogJ05hcGFrYScsXG4gICAgZmFpbGVkOiAnTmkgdXNwZWxvLicsXG4gICAgYXJpYURvd25sb2FkOiAnUHJlbm9zJyxcbiAgICB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyamV2JyxcbiAgICBlZGl0ZWQ6ICdVcmVqZW5vJyxcbiAgfSxcbiAgY2E6IHtcbiAgICBkb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJyxcbiAgICB0cnlpbmc6ICdJbnRlbnRhbnTigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhdCcsXG4gICAgZXJyb3I6ICdFcnJvcicsXG4gICAgZmFpbGVkOiAnSGEgZmFsbGF0LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpcycsXG4gICAgZWRpdGVkOiAnRWRpdGF0JyxcbiAgfSxcbiAgYWY6IHtcbiAgICBkb3dubG9hZDogJ0FmbGFhaScsXG4gICAgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9iZWVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhYXInLFxuICAgIGVycm9yOiAnRm91dCcsXG4gICAgZmFpbGVkOiAnTWlzbHVrLicsXG4gICAgYXJpYURvd25sb2FkOiAnQWZsYWFpJyxcbiAgICB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLFxuICAgIGNvbW1lbnRzOiAna29tbWVudGFyZScsXG4gICAgZWRpdGVkOiAnR2VyZWRpZ2VlcicsXG4gIH0sXG4gIGFtOiB7XG4gICAgZG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLFxuICAgIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsXG4gICAgdHJ5aW5nOiAn4Ymg4YiY4Yie4Yqo4YitIOGIi+GLreKApicsXG4gICAgZG93bmxvYWRlZDogJ+GLiOGIreGLt+GIjScsXG4gICAgZXJyb3I6ICfhiLXhiIXhibDhibUnLFxuICAgIGZhaWxlZDogJ+GKoOGIjeGJsOGIs+GKq+GIneGNoicsXG4gICAgYXJpYURvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JyxcbiAgICB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsXG4gICAgY29tbWVudHM6ICfhiqDhiLXhibDhi6vhi6jhibbhib0nLFxuICAgIGVkaXRlZDogJ+GJsOGIteGJsOGKq+GKreGIj+GIjScsXG4gIH0sXG4gIGh5OiB7XG4gICAgZG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLFxuICAgIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLFxuICAgIHRyeWluZzogJ9WT1bjWgNWx1bjWgtW0INWn4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn1LHVvtWh1oDVv9W+1aHVricsXG4gICAgZXJyb3I6ICfVjdWt1aHVrCcsXG4gICAgZmFpbGVkOiAn1YHVodWt1bjVstW+1aXWgTonLFxuICAgIGFyaWFEb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsXG4gICAgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JyxcbiAgICBjb21tZW50czogJ9W01aXVr9W21aHVotWh1bbVuNaC1anVtdW41oLVticsXG4gICAgZWRpdGVkOiAn1L3VtNWi1aHVo9aA1b7VpdWsINWnJyxcbiAgfSxcbiAgYXM6IHtcbiAgICBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsXG4gICAgdHJ5aW5nOiAn4Kaa4KeH4Ka34KeN4Kaf4Ka+IOCmleCnsOCmvyDgpobgppvgp4figKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgp4Lgp7Dgp43gpqMnLFxuICAgIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JyxcbiAgICBmYWlsZWQ6ICfgpqzgpr/gpqvgprIg4Ka54oCZ4KayJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICBjb21tZW50czogJ+CmruCmqOCnjeCmpOCmrOCnjeCmrycsXG4gICAgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyxcbiAgfSxcbiAgYXo6IHtcbiAgICBkb3dubG9hZDogJ1nDvGtsyZknLFxuICAgIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsXG4gICAgdHJ5aW5nOiAnQ8mZaGQgZWRpbGly4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnQml0ZGknLFxuICAgIGVycm9yOiAnWMmZdGEnLFxuICAgIGZhaWxlZDogJ0FsxLFubWFkxLEuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdZw7xrbMmZJyxcbiAgICB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLFxuICAgIGNvbW1lbnRzOiAnxZ/JmXJoJyxcbiAgICBlZGl0ZWQ6ICdEw7x6yZlsacWfIGVkaWxpYicsXG4gIH0sXG4gIGV1OiB7XG4gICAgZG93bmxvYWQ6ICdEZXNrYXJnYXR1JyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsXG4gICAgdHJ5aW5nOiAnU2FpYXR6ZW7igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdFZ2luZGEnLFxuICAgIGVycm9yOiAnRXJyb3JlYScsXG4gICAgZmFpbGVkOiAnSHV0cyBlZ2luIGR1LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVza2FyZ2F0dScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLFxuICAgIGNvbW1lbnRzOiAnaXJ1emtpbicsXG4gICAgZWRpdGVkOiAnRWRpdGF0dWEnLFxuICB9LFxuICBteToge1xuICAgIGRvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLFxuICAgIHRyeWluZzogJ+GAgOGAvOGAreGAr+GAuOGAheGArOGAuOGAlOGAseKApicsXG4gICAgZG93bmxvYWRlZDogJ+GAleGAvOGAruGAuOGAleGAq+GAleGAvOGAricsXG4gICAgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLFxuICAgIGZhaWxlZDogJ+GAmeGAoeGAseGArOGAhOGAuuGAmeGAvOGAhOGAuuGAleGAq+GBiycsXG4gICAgYXJpYURvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JyxcbiAgICB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgY29tbWVudHM6ICfhgJnhgL7hgJDhgLrhgIHhgLvhgIDhgLrhgJnhgLvhgKzhgLgnLFxuICAgIGVkaXRlZDogJ+GAleGAvOGAhOGAuuGAhuGAhOGAuuGAleGAvOGAruGAuCcsXG4gIH0sXG4gIGdsOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLFxuICAgIHRyeWluZzogJ1RlbnRhbmRv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsXG4gICAgZXJyb3I6ICdFcnJvJyxcbiAgICBmYWlsZWQ6ICdGYWxsb3UuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAga2E6IHtcbiAgICBkb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLFxuICAgIHRyeWluZzogJ+GDm+GDquGDk+GDlOGDmuGDneGDkeGDkOKApicsXG4gICAgZG93bmxvYWRlZDogJ+GDk+GDkOGDoeGDoOGDo+GDmuGDk+GDkCcsXG4gICAgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLFxuICAgIGZhaWxlZDogJ+GDleGDlOGDoCDhg5vhg53hg67hg5Thg6Dhg67hg5Phg5AuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICBjb21tZW50czogJ+GDmeGDneGDm+GDlOGDnOGDouGDkOGDoOGDmCcsXG4gICAgZWRpdGVkOiAn4YOg4YOU4YOT4YOQ4YOl4YOi4YOY4YOg4YOU4YOR4YOj4YOa4YOY4YOQJyxcbiAgfSxcbiAgaXM6IHtcbiAgICBkb3dubG9hZDogJ1PDpmtqYScsXG4gICAgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLFxuICAgIHRyeWluZzogJ1JleW5p4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU8OzdHQnLFxuICAgIGVycm9yOiAnVmlsbGEnLFxuICAgIGZhaWxlZDogJ01pc3TDs2tzdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1PDpmtqYScsXG4gICAgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsXG4gICAgY29tbWVudHM6ICd1bW3DpmxpJyxcbiAgICBlZGl0ZWQ6ICdCcmV5dHQnLFxuICB9LFxuICBnYToge1xuICAgIGRvd25sb2FkOiAnw41vc2zDs2TDoWlsJyxcbiAgICBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsXG4gICAgdHJ5aW5nOiAnQWcgaWFycmFpZGjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfDjW9zbMOzZMOhaWx0ZScsXG4gICAgZXJyb3I6ICdFYXJyw6FpZCcsXG4gICAgZmFpbGVkOiAnVGhlaXAgYWlyLicsXG4gICAgYXJpYURvd25sb2FkOiAnw41vc2zDs2TDoWlsJyxcbiAgICB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLFxuICAgIGNvbW1lbnRzOiAndHLDoWNodCcsXG4gICAgZWRpdGVkOiAnRWFncmFpdGhlJyxcbiAgfSxcbiAga2s6IHtcbiAgICBkb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLFxuICAgIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJyxcbiAgICB0cnlpbmc6ICfTmNGA0LXQutC10YLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQkNGP0pvRgtCw0LvQtNGLJyxcbiAgICBlcnJvcjogJ9Ka0LDRgtC1JyxcbiAgICBmYWlsZWQ6ICfQodOZ0YLRgdGW0LcuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJyxcbiAgICB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsXG4gICAgY29tbWVudHM6ICfQv9GW0LrRltGAJyxcbiAgICBlZGl0ZWQ6ICfTqNC30LPQtdGA0YLRltC70LTRlicsXG4gIH0sXG4gIGttOiB7XG4gICAgZG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLFxuICAgIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJyxcbiAgICB0cnlpbmc6ICfhnoDhn4bhnpbhnrvhnoThnpbhn5LhnpnhnrbhnpnhnrbhnpjigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhnpThnrbhnpPhnpThnonhn5LhnoXhnpThn4snLFxuICAgIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJyxcbiAgICBmYWlsZWQ6ICfhnpThnprhnrbhnofhn5DhnpknLFxuICAgIGFyaWFEb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsXG4gICAgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsXG4gICAgY29tbWVudHM6ICfhnpjhno/hnrcnLFxuICAgIGVkaXRlZDogJ+GelOGetuGek+GegOGfguGen+GemOGfkuGemuGeveGemycsXG4gIH0sXG4gIGxvOiB7XG4gICAgZG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLFxuICAgIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJyxcbiAgICB0cnlpbmc6ICfguoHgurPguqXgurHguofgup7gurDguo3gurLguo3gurLguqHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfguqrgurPgu4DguqXgurHgupQnLFxuICAgIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJyxcbiAgICBmYWlsZWQ6ICfguqXgurvgu4nguqHgu4DguqvguqXguqcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsXG4gICAgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsXG4gICAgY29tbWVudHM6ICfguoTgurPgu4DguqvgurHgupknLFxuICAgIGVkaXRlZDogJ+C7geC6geC7ieC7hOC6guC7geC6peC7ieC6pycsXG4gIH0sXG4gIG1rOiB7XG4gICAgZG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLFxuICAgIHRyeWluZzogJ9Ch0LUg0L7QsdC40LTRg9Cy0LDQvOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQuCcsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXQvdC10YLQvicsXG4gIH0sXG4gIG1uOiB7XG4gICAgZG93bmxvYWQ6ICfQotCw0YLQsNGFJyxcbiAgICBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsXG4gICAgdHJ5aW5nOiAn0J7RgNC70LTQvtC2INCx0LDQudC90LDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQotCw0YLRgdCw0L0nLFxuICAgIGVycm9yOiAn0JDQu9C00LDQsCcsXG4gICAgZmFpbGVkOiAn0JDQvNC20LjQu9GC0LPSr9C5LicsXG4gICAgYXJpYURvd25sb2FkOiAn0KLQsNGC0LDRhScsXG4gICAgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJyxcbiAgICBjb21tZW50czogJ9GB0Y3RgtCz0Y3Qs9C00Y3QuycsXG4gICAgZWRpdGVkOiAn0JfQsNGB0YHQsNC9JyxcbiAgfSxcbiAgbmU6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJyxcbiAgICB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpL7gpLgg4KSX4KSw4KWN4KSm4KWI4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KS+IOCkreCkr+CliycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLFxuICAgIGZhaWxlZDogJ+CkheCkuOCkq+CksiDgpK3gpK/gpYsnLFxuICAgIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KWA4KS54KSw4KWCJyxcbiAgICBlZGl0ZWQ6ICfgpLjgpK7gpY3gpKrgpL7gpKbgpL/gpKQnLFxuICB9LFxuICBvcjoge1xuICAgIGRvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLFxuICAgIHRyeWluZzogJ+CsmuCth+Cst+CtjeCsn+CsviDgrJXgrLDgrYHgrJvgrL/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgrLjgrK7grY3grKrgrYLgrLDgrY3grKPgrY3grKMnLFxuICAgIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JyxcbiAgICBmYWlsZWQ6ICfgrKzgrL/grKvgrLMg4Ky54K2H4Kyy4Ky+JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLFxuICAgIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICBjb21tZW50czogJ+CsruCsqOCtjeCspOCsrOCtjeCtnycsXG4gICAgZWRpdGVkOiAn4Ky44Kyu4K2N4Kyq4Ky+4Kym4Ky/4KykJyxcbiAgfSxcbiAgc2k6IHtcbiAgICBkb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsXG4gICAgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJyxcbiAgICB0cnlpbmc6ICfgtovgtq3gt4rgt4Pgt4/gt4Qg4Laa4La74La44LeS4Lax4LeK4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LaF4LeA4LeD4Lax4LeKJyxcbiAgICBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsXG4gICAgZmFpbGVkOiAn4LaF4LeD4LeP4La74LeK4Lau4Laa4La64LeSJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLFxuICAgIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsXG4gICAgY29tbWVudHM6ICfgtoXgtq/gt4Tgt4Pgt4onLFxuICAgIGVkaXRlZDogJ+C3g+C2guC3g+C3iuC2muC2u+C2q+C2uicsXG4gIH0sXG4gIHN3OiB7XG4gICAgZG93bmxvYWQ6ICdQYWt1YScsXG4gICAgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsXG4gICAgdHJ5aW5nOiAnSW5hamFyaWJ14oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSW1la2FtaWxpa2EnLFxuICAgIGVycm9yOiAnSGl0aWxhZnUnLFxuICAgIGZhaWxlZDogJ0ltZXNoaW5kd2EuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQYWt1YScsXG4gICAgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsXG4gICAgY29tbWVudHM6ICdtYW9uaScsXG4gICAgZWRpdGVkOiAnSW1laGFyaXJpd2EnLFxuICB9LFxuICB1ejoge1xuICAgIGRvd25sb2FkOiAnWXVrbGFzaCcsXG4gICAgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsXG4gICAgdHJ5aW5nOiAnVXJpbmlsbW9xZGHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdUYXl5b3InLFxuICAgIGVycm9yOiAnWGF0bycsXG4gICAgZmFpbGVkOiAnTXV2YWZmYXFpeWF0c2l6LicsXG4gICAgYXJpYURvd25sb2FkOiAnWXVrbGFzaCcsXG4gICAgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJyxcbiAgICBjb21tZW50czogJ3NoYXJobGFyJyxcbiAgICBlZGl0ZWQ6ICdUYWhyaXJsYW5nYW4nLFxuICB9LFxuICBjeToge1xuICAgIGRvd25sb2FkOiAnTGF3cmx3eXRobycsXG4gICAgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJyxcbiAgICB0cnlpbmc6ICdZbiBjZWlzaW/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdXZWRpIGdvcmZmZW4nLFxuICAgIGVycm9yOiAnR3dhbGwnLFxuICAgIGZhaWxlZDogJ01ldGhvZGQuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYXdybHd5dGhvJyxcbiAgICB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLFxuICAgIGNvbW1lbnRzOiAnc3lsd2FkYXUnLFxuICAgIGVkaXRlZDogJ0dvbHlnd3lkJyxcbiAgfSxcbiAgenU6IHtcbiAgICBkb3dubG9hZDogJ0xhbmRhJyxcbiAgICBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsXG4gICAgdHJ5aW5nOiAnSXlhemFtYeKApicsXG4gICAgZG93bmxvYWRlZDogJ0lsYW5kxKt3ZScsXG4gICAgZXJyb3I6ICdJcGh1dGhhJyxcbiAgICBmYWlsZWQ6ICdJaGx1bGVraWxlLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGFuZGEnLFxuICAgIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsXG4gICAgY29tbWVudHM6ICdhbWF6d2FuYScsXG4gICAgZWRpdGVkOiAnS3VobGVsaXdlJyxcbiAgfSxcbiAgc3E6IHtcbiAgICBkb3dubG9hZDogJ1Noa2Fya28nLFxuICAgIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLFxuICAgIHRyeWluZzogJ0R1a2UgcHJvdnVhcuKApicsXG4gICAgZG93bmxvYWRlZDogJ1DDq3JmdW5kb2knLFxuICAgIGVycm9yOiAnR2FiaW0nLFxuICAgIGZhaWxlZDogJ0TDq3NodG9pLicsXG4gICAgYXJpYURvd25sb2FkOiAnU2hrYXJrbycsXG4gICAgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLFxuICAgIGNvbW1lbnRzOiAna29tZW50ZScsXG4gICAgZWRpdGVkOiAnRSByZWRha3R1YXInLFxuICB9LFxufTtcblxuZXhwb3J0IHR5cGUgTGFuZ0tleSA9IGtleW9mIHR5cGVvZiBUUkFOU0xBVElPTlMuZW47XG5cbmV4cG9ydCBmdW5jdGlvbiB0KGtleTogTGFuZ0tleSk6IHN0cmluZyB7XG4gIHRyeSB7XG4gICAgaWYgKCFrZXkgfHwgdHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiAnLi4uJztcbiAgICB9XG5cbiAgICBsZXQgcmF3TGFuZyA9ICdlbic7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmXG4gICAgICBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZ1xuICAgICkge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZ1xuICAgICAgLnRvTG93ZXJDYXNlKClcbiAgICAgIC5zcGxpdCgnOycpWzBdXG4gICAgICAudHJpbSgpXG4gICAgICAucmVwbGFjZSgnXycsICctJyk7XG4gICAgY29uc3QgYmFzZUxhbmcgPSBub3JtYWxpemVkTGFuZy5zcGxpdCgnLScpWzBdO1xuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV07XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TW2Jhc2VMYW5nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ11ba2V5XSA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV07XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgVFJBTlNMQVRJT05TWydlbiddICYmXG4gICAgICB0eXBlb2YgVFJBTlNMQVRJT05TWydlbiddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleTtcbiAgfSBjYXRjaCB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XSB8fCBrZXk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gU3RyaW5nKGtleSB8fCAnRG93bmxvYWQnKTtcbiAgICB9XG4gIH1cbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzXG5cbi8qKlxuICogVEhFTUUgREVURUNUT1JcbiAqXG4gKiBHb2FsOiBcIklzIHRoZSBjb250ZW50IEknbSBkcmF3aW5nIG9uIHZpc3VhbGx5IGRhcmsgb3IgbGlnaHQ/XCJcbiAqIEluc3RlYWQgb2YgZ3Vlc3NpbmcgZnJvbSA8Ym9keT4sIHdlOlxuICogIC0gUmVzcGVjdCBEYXJrIFJlYWRlciBpZiBwcmVzZW50XG4gKiAgLSBMb29rIGZvciBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3Nlc1xuICogIC0gTWVhc3VyZSB0aGUgZWZmZWN0aXZlIGJhY2tncm91bmQgY29sb3Igb2YgYSAqY29udGVudCogZWxlbWVudFxuICogICAgKGUuZy4gR29vZ2xlIENsYXNzcm9vbSBzdHJlYW0gY2FyZHMpXG4gKi9cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhZ2UgKmNvbnRlbnQgYXJlYSogaXMgdmlzdWFsbHkgZGFyay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFnZURhcmsoKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMS4gRmFzdCBwYXRoOiBEYXJrIFJlYWRlciBhdHRyaWJ1dGVcbiAgY29uc3QgZHJTY2hlbWUgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRhcmtyZWFkZXItc2NoZW1lJyk7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2RhcmsnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGRyU2NoZW1lID09PSAnbGlnaHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMi4gSGV1cmlzdGljOiBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3NlcyBvbiA8aHRtbD4gLyA8Ym9keT5cbiAgLy8gKGNvdmVycyBzb21lIGZyYW1ld29ya3MgYW5kIGV4dGVuc2lvbnMpXG4gIGNvbnN0IGRhcmtUb2tlbnMgPSBbJ2RhcmsnLCAnZGFyay10aGVtZScsICd0aGVtZS1kYXJrJywgJ25pZ2h0JywgJ2dtMy1kYXJrLXRoZW1lJ107XG4gIGNvbnN0IGh0bWxDbGFzcyA9IChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBib2R5Q2xhc3MgPSAoZG9jdW1lbnQuYm9keS5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChkYXJrVG9rZW5zLnNvbWUodG9rZW4gPT4gaHRtbENsYXNzLmluY2x1ZGVzKHRva2VuKSB8fCBib2R5Q2xhc3MuaW5jbHVkZXModG9rZW4pKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gMy4gUHJvYmUgYSAqY29udGVudCogZWxlbWVudCwgbm90IHRoZSB3aG9sZSBwYWdlIGJhY2tncm91bmQuXG4gIC8vICAgIEZvciBDbGFzc3Jvb20sIHBvc3RzIGFyZSB0aGUgbWFpbiBzdXJmYWNlIHdlIGRyYXcgb24uXG4gIGNvbnN0IHByb2JlRWwgPVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdbcm9sZT1cIm1haW5cIl0nKSB8fFxuICAgIGRvY3VtZW50LmJvZHk7XG5cbiAgY29uc3QgYmdDb2xvciA9IGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihwcm9iZUVsKTtcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IHBhcnNlQnJpZ2h0bmVzcyhiZ0NvbG9yKTtcblxuICAvLyA0LiBEZWNpZGUgdGhyZXNob2xkLlxuICAvLyAgICAxMjggaXMgXCI1MCUgZ3JheVwiLCBidXQgdGhhdCBmbGlwcyB0b28gZWFybHkgb24gc2xpZ2h0bHkgZ3JheSBVSXMuXG4gIC8vICAgIFVzZSBhIHN0cmljdGVyIHRocmVzaG9sZCBzbyB3ZSBvbmx5IHRyZWF0IGNsZWFybHkgZGFyayBVSXMgYXMgZGFyay5cbiAgcmV0dXJuIGJyaWdodG5lc3MgPCAxMDU7XG59XG5cbi8qKlxuICogV2Fsa3MgdXAgdGhlIERPTSBmcm9tIGEgZ2l2ZW4gZWxlbWVudCB1bnRpbCBpdCBmaW5kcyBhIG5vbi10cmFuc3BhcmVudCBiYWNrZ3JvdW5kIGNvbG9yLlxuICogRmFsbHMgYmFjayB0byA8aHRtbD4gYW5kIGZpbmFsbHkgdG8gcHVyZSB3aGl0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHN0YXJ0OiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIGxldCBlbDogSFRNTEVsZW1lbnQgfCBudWxsID0gc3RhcnQ7XG5cbiAgY29uc3QgaXNUcmFuc3BhcmVudCA9IChjOiBzdHJpbmcgfCBudWxsKSA9PlxuICAgICFjIHx8IGMgPT09ICd0cmFuc3BhcmVudCcgfHwgYyA9PT0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4gIHdoaWxlIChlbCkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIGNvbnN0IGJnID0gc3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICAgIGlmICghaXNUcmFuc3BhcmVudChiZykpIHJldHVybiBiZztcbiAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICAvLyBUcnkgPGh0bWw+IGFzIGEgbGFzdCByZWFsIGVsZW1lbnRcbiAgY29uc3QgaHRtbFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgY29uc3QgaHRtbEJnID0gaHRtbFN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgaWYgKCFpc1RyYW5zcGFyZW50KGh0bWxCZykpIHJldHVybiBodG1sQmc7XG5cbiAgLy8gQWJzb2x1dGUgZmFsbGJhY2s6IGFzc3VtZSB3aGl0ZVxuICByZXR1cm4gJ3JnYigyNTUsIDI1NSwgMjU1KSc7XG59XG5cbi8qKlxuICogSGVscGVyOiBDYWxjdWxhdGVzIGJyaWdodG5lc3MgKDAtMjU1KSBmcm9tIGFuIFJHQihBKSBzdHJpbmcuXG4gKiBVc2VzIHRoZSBIU1AgY29sb3IgZm9ybXVsYTogc3FydCgwLjI5OSpSXjIgKyAwLjU4NypHXjIgKyAwLjExNCpCXjIpXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQnJpZ2h0bmVzcyhyZ2JTdHJpbmc6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IG1hdGNoID0gcmdiU3RyaW5nLm1hdGNoKC8oXFxkKyksXFxzKihcXGQrKSxcXHMqKFxcZCspLyk7XG4gIGlmICghbWF0Y2gpIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBwYXJzZSBpdCwgYXNzdW1lIGJyaWdodCBzbyB3ZSBkb24ndCBhY2NpZGVudGFsbHkgZmxpcCB0byBkYXJrIG1vZGUuXG4gICAgcmV0dXJuIDI1NTtcbiAgfVxuXG4gIGNvbnN0IHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICBjb25zdCBnID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcbiAgY29uc3QgYiA9IHBhcnNlSW50KG1hdGNoWzNdLCAxMCk7XG5cbiAgLy8gSFNQIGVxdWF0aW9uIGlzIHBlcmNlaXZlZCBicmlnaHRuZXNzXG4gIGNvbnN0IGJyaWdodG5lc3MgPSBNYXRoLnNxcnQoXG4gICAgMC4yOTkgKiAociAqIHIpICtcbiAgICAwLjU4NyAqIChnICogZykgK1xuICAgIDAuMTE0ICogKGIgKiBiKVxuICApO1xuXG4gIHJldHVybiBicmlnaHRuZXNzO1xufVxuXG4vKipcbiAqIFdhdGNoZXI6IE5vdGlmaWVzIHlvdSB3aGVuIHRoZSB0aGVtZSBsaWtlbHkgY2hhbmdlZC5cbiAqXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGlmIHlvdSBldmVyIHdhbnQgdG8gZHluYW1pY2FsbHkgcmUtc3R5bGUgdGhpbmdzXG4gKiB3aGVuIHRoZSB1c2VyIC8gZXh0ZW5zaW9uIHRvZ2dsZXMgdGhlbWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaFRoZW1lQ2hhbmdlcyhjYWxsYmFjazogKGlzRGFyazogYm9vbGVhbikgPT4gdm9pZCk6IE11dGF0aW9uT2JzZXJ2ZXIge1xuICBjb25zdCBoYW5kbGVyID0gKCkgPT4ge1xuICAgIGNhbGxiYWNrKGlzUGFnZURhcmsoKSk7XG4gIH07XG5cbiAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihoYW5kbGVyKTtcblxuICAvLyBXYXRjaCBmb3IgYXR0cmlidXRlL2NsYXNzIGNoYW5nZXMgb24gPGh0bWw+IGFuZCA8Ym9keT5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLWRhcmtyZWFkZXItc2NoZW1lJywgJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIC8vIEFsc28gbGlzdGVuIHRvIHN5c3RlbSB0aGVtZSBjaGFuZ2VzIGFzIGEgYmFja3VwIHNpZ25hbFxuICBpZiAodHlwZW9mIHdpbmRvdy5tYXRjaE1lZGlhID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgbXEgPSB3aW5kb3cubWF0Y2hNZWRpYSgnKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKScpO1xuICAgIGlmIChtcSkge1xuICAgICAgY29uc3QgbXFMaXN0ZW5lciA9ICgpID0+IGhhbmRsZXIoKTtcbiAgICAgIC8vIE1vZGVybiBicm93c2Vyc1xuICAgICAgaWYgKChtcSBhcyBhbnkpLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgbXEuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbXFMaXN0ZW5lcik7XG4gICAgICB9IGVsc2UgaWYgKChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKSB7XG4gICAgICAgIC8vIExlZ2FjeSBBUElcbiAgICAgICAgKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIobXFMaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSW5pdGlhbCBjYWxsIHNvIHRoZSBjb25zdW1lciBjYW4gc3luYyBpbW1lZGlhdGVseVxuICBoYW5kbGVyKCk7XG5cbiAgcmV0dXJuIG9ic2VydmVyO1xufVxuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2Rvd25sb2FkX2FsbC5jb250ZW50LnRzXG5cbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vY29udGVudC9zdHlsZXMnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vY29udGVudC9pMThuJztcbmltcG9ydCB7IGlzUGFnZURhcmsgfSBmcm9tICcuL2NvbnRlbnQvdGhlbWUnO1xuXG5jb25zdCBET1dOTE9BRF9CVE5fU0VMRUNUT1IgPSAnLmNxZC1kb3dubG9hZC1idG4nO1xuY29uc3QgR1JPVVBfU0VMRUNUT1IgPSAnZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJztcbmNvbnN0IElOSkVDVEVEX0FUVFIgPSAnZGF0YS1jcWQtaW5qZWN0ZWQnO1xuXG4vLyBLZWVwIHRoaXMgaW4gc3luYyB3aXRoIEZFRURCQUNLX1NVQ0NFU1NfTVMgaW4gY29udGVudC9pbmRleC50c1xuY29uc3QgR1JPVVBfRkVFREJBQ0tfU1VDQ0VTU19NUyA9IDMwMDA7XG5cbi8vIFNob3cgXCJEb3dubG9hZCBhbGxcIiBvbmx5IHdoZW4gdGhlcmUgYXJlIGF0IGxlYXN0IDIgZmlsZXNcbmNvbnN0IE1JTl9GSUxFU19GT1JfRE9XTkxPQURfQUxMID0gMjtcblxudHlwZSBCdXR0b25TdGF0ZSA9ICdpZGxlJyB8ICdsb2FkaW5nJyB8ICd0cnlpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJztcblxuaW50ZXJmYWNlIEZpbGVFbnRyeSB7XG4gIGtleTogc3RyaW5nO1xuICBidXR0b25zOiBTZXQ8SFRNTEJ1dHRvbkVsZW1lbnQ+O1xuICBkb3dubG9hZGVkOiBib29sZWFuOyAgIC8vIGxhdGNoZWQgc3VjY2VzcyBmb3IgY3VycmVudCBiYXRjaFxuICBmYWlsZWQ6IGJvb2xlYW47ICAgICAgIC8vIGxhdGNoZWQgZXJyb3IgZm9yIGN1cnJlbnQgYmF0Y2hcbiAgaW5Qcm9ncmVzczogYm9vbGVhbjsgICAvLyBhbnkgYnV0dG9uIGxvYWRpbmdcbn1cblxuaW50ZXJmYWNlIEdyb3VwU3RhdGUge1xuICByb290OiBIVE1MRWxlbWVudDtcbiAgZmlsZXM6IE1hcDxzdHJpbmcsIEZpbGVFbnRyeT47XG4gIGRvd25sb2FkQWxsQnRuOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGFjdGl2YXRlZDogYm9vbGVhbjsgICAgIC8vIGJhdGNoIGhhcyBiZWVuIHRyaWdnZXJlZCBhdCBsZWFzdCBvbmNlXG4gIGlzQnVzeTogYm9vbGVhbjsgICAgICAgIC8vIGFueSBmaWxlIHN0aWxsIGluIHByb2dyZXNzXG4gIHJlc2V0VGltZW91dElkPzogbnVtYmVyO1xuICBjdXJyZW50UnVuSWQ/OiBudW1iZXI7XG59XG5cbmNvbnN0IGdyb3VwU3RhdGVzID0gbmV3IFdlYWtNYXA8SFRNTEVsZW1lbnQsIEdyb3VwU3RhdGU+KCk7XG5jb25zdCBidXR0b25Ub0dyb3VwID0gbmV3IFdlYWtNYXA8SFRNTEJ1dHRvbkVsZW1lbnQsIEdyb3VwU3RhdGU+KCk7XG5jb25zdCBidXR0b25Ub0ZpbGUgPSBuZXcgV2Vha01hcDxIVE1MQnV0dG9uRWxlbWVudCwgRmlsZUVudHJ5PigpO1xuXG5jb25zdCBkaXJ0eUdyb3VwcyA9IG5ldyBTZXQ8R3JvdXBTdGF0ZT4oKTtcbmxldCByZWZyZXNoU2NoZWR1bGVkID0gZmFsc2U7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJ2h0dHBzOi8vY2xhc3Nyb29tLmdvb2dsZS5jb20vKiddLFxuICBydW5BdDogJ2RvY3VtZW50X2lkbGUnLFxuICBtYWluKCkge1xuICAgIGluamVjdFN0eWxlcygpO1xuICAgIHNhZmVTZXREaXJlY3Rpb24oKTtcblxuICAgIC8vIEluaXRpYWwgZGlzY292ZXJ5XG4gICAgcmVnaXN0ZXJCdXR0b25zSW5TdWJ0cmVlKGRvY3VtZW50KTtcblxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgZm9yIChjb25zdCBtIG9mIG11dGF0aW9ucykge1xuICAgICAgICBpZiAobS50eXBlID09PSAnY2hpbGRMaXN0Jykge1xuICAgICAgICAgIG0uYWRkZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSByZXR1cm47XG4gICAgICAgICAgICByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUobm9kZSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBtLnJlbW92ZWROb2Rlcy5mb3JFYWNoKChub2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSByZXR1cm47XG4gICAgICAgICAgICBjbGVhbnVwUmVtb3ZlZEJ1dHRvbnMobm9kZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAobS50eXBlID09PSAnYXR0cmlidXRlcycpIHtcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSBtLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICB0YXJnZXQgaW5zdGFuY2VvZiBIVE1MQnV0dG9uRWxlbWVudCAmJlxuICAgICAgICAgICAgdGFyZ2V0LmNsYXNzTGlzdC5jb250YWlucygnY3FkLWRvd25sb2FkLWJ0bicpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjb25zdCBncm91cCA9IGVuc3VyZUJ1dHRvblJlZ2lzdGVyZWQodGFyZ2V0KTtcbiAgICAgICAgICAgIGlmIChncm91cCkgbWFya0dyb3VwRGlydHkoZ3JvdXApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzY2hlZHVsZVJlZnJlc2goKTtcbiAgICB9KTtcblxuICAgIGlmIChkb2N1bWVudC5ib2R5KSB7XG4gICAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnY2xhc3MnLCAnZGF0YS1jcWQtYWxsLWRvbmUnXSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEJhY2t1cCBzY2FuXG4gICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShkb2N1bWVudCk7XG4gICAgICBzY2hlZHVsZVJlZnJlc2goKTtcbiAgICB9LCA0MDAwKTtcbiAgfSxcbn0pO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRGlzY292ZXJ5ICYgZ3JvdXBpbmdcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShyb290OiBIVE1MRWxlbWVudCB8IERvY3VtZW50KTogdm9pZCB7XG4gIGlmIChcbiAgICByb290IGluc3RhbmNlb2YgSFRNTEJ1dHRvbkVsZW1lbnQgJiZcbiAgICByb290LmNsYXNzTGlzdC5jb250YWlucygnY3FkLWRvd25sb2FkLWJ0bicpXG4gICkge1xuICAgIHJlZ2lzdGVyU2luZ2xlQnV0dG9uKHJvb3QpO1xuICB9XG5cbiAgY29uc3QgYnV0dG9ucyA9IHJvb3QucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oRE9XTkxPQURfQlROX1NFTEVDVE9SKTtcbiAgYnV0dG9ucy5mb3JFYWNoKChidG4pID0+IHJlZ2lzdGVyU2luZ2xlQnV0dG9uKGJ0bikpO1xufVxuXG5mdW5jdGlvbiByZWdpc3RlclNpbmdsZUJ1dHRvbihidG46IEhUTUxCdXR0b25FbGVtZW50KTogdm9pZCB7XG4gIGlmICghYnRuLmlzQ29ubmVjdGVkKSByZXR1cm47XG4gIGlmIChidXR0b25Ub0dyb3VwLmhhcyhidG4pICYmIGJ1dHRvblRvRmlsZS5oYXMoYnRuKSkgcmV0dXJuO1xuXG4gIGNvbnN0IGdyb3VwUm9vdCA9IGZpbmRHcm91cFJvb3QoYnRuKTtcbiAgaWYgKCFncm91cFJvb3QpIHJldHVybjtcblxuICBsZXQgZ3JvdXAgPSBncm91cFN0YXRlcy5nZXQoZ3JvdXBSb290KTtcbiAgaWYgKCFncm91cCkge1xuICAgIGdyb3VwID0ge1xuICAgICAgcm9vdDogZ3JvdXBSb290LFxuICAgICAgZmlsZXM6IG5ldyBNYXA8c3RyaW5nLCBGaWxlRW50cnk+KCksXG4gICAgICBkb3dubG9hZEFsbEJ0bjogbnVsbCxcbiAgICAgIGFjdGl2YXRlZDogZmFsc2UsXG4gICAgICBpc0J1c3k6IGZhbHNlLFxuICAgIH07XG4gICAgZ3JvdXBTdGF0ZXMuc2V0KGdyb3VwUm9vdCwgZ3JvdXApO1xuICB9XG5cbiAgY29uc3Qga2V5ID0gZ2V0Q2Fub25pY2FsRmlsZUtleShidG4pO1xuICBsZXQgZmlsZSA9IGdyb3VwLmZpbGVzLmdldChrZXkpO1xuXG4gIGlmICghZmlsZSkge1xuICAgIGZpbGUgPSB7XG4gICAgICBrZXksXG4gICAgICBidXR0b25zOiBuZXcgU2V0PEhUTUxCdXR0b25FbGVtZW50PigpLFxuICAgICAgZG93bmxvYWRlZDogZmFsc2UsXG4gICAgICBmYWlsZWQ6IGZhbHNlLFxuICAgICAgaW5Qcm9ncmVzczogZmFsc2UsXG4gICAgfTtcbiAgICBncm91cC5maWxlcy5zZXQoa2V5LCBmaWxlKTtcbiAgfVxuXG4gIGZpbGUuYnV0dG9ucy5hZGQoYnRuKTtcbiAgYnV0dG9uVG9Hcm91cC5zZXQoYnRuLCBncm91cCk7XG4gIGJ1dHRvblRvRmlsZS5zZXQoYnRuLCBmaWxlKTtcblxuICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUJ1dHRvblJlZ2lzdGVyZWQoYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IEdyb3VwU3RhdGUgfCBudWxsIHtcbiAgbGV0IGdyb3VwID0gYnV0dG9uVG9Hcm91cC5nZXQoYnRuKTtcbiAgaWYgKCFncm91cCkge1xuICAgIHJlZ2lzdGVyU2luZ2xlQnV0dG9uKGJ0bik7XG4gICAgZ3JvdXAgPSBidXR0b25Ub0dyb3VwLmdldChidG4pIHx8IG51bGw7XG4gIH1cbiAgcmV0dXJuIGdyb3VwO1xufVxuXG5mdW5jdGlvbiBjbGVhbnVwUmVtb3ZlZEJ1dHRvbnMocm9vdDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgcmVtb3ZlZEJ1dHRvbnMgPSByb290Lm1hdGNoZXMoRE9XTkxPQURfQlROX1NFTEVDVE9SKVxuICAgID8gW3Jvb3QgYXMgSFRNTEJ1dHRvbkVsZW1lbnRdXG4gICAgOiBBcnJheS5mcm9tKHJvb3QucXVlcnlTZWxlY3RvckFsbDxIVE1MQnV0dG9uRWxlbWVudD4oRE9XTkxPQURfQlROX1NFTEVDVE9SKSk7XG5cbiAgcmVtb3ZlZEJ1dHRvbnMuZm9yRWFjaCgoYnRuKSA9PiB7XG4gICAgY29uc3QgZ3JvdXAgPSBidXR0b25Ub0dyb3VwLmdldChidG4pO1xuICAgIGNvbnN0IGZpbGUgPSBidXR0b25Ub0ZpbGUuZ2V0KGJ0bik7XG4gICAgaWYgKCFncm91cCB8fCAhZmlsZSkgcmV0dXJuO1xuXG4gICAgZmlsZS5idXR0b25zLmRlbGV0ZShidG4pO1xuICAgIGJ1dHRvblRvR3JvdXAuZGVsZXRlKGJ0bik7XG4gICAgYnV0dG9uVG9GaWxlLmRlbGV0ZShidG4pO1xuXG4gICAgaWYgKGZpbGUuYnV0dG9ucy5zaXplID09PSAwKSB7XG4gICAgICBncm91cC5maWxlcy5kZWxldGUoZmlsZS5rZXkpO1xuICAgIH1cblxuICAgIG1hcmtHcm91cERpcnR5KGdyb3VwKTtcbiAgfSk7XG59XG5cbi8qKlxuICogR3JvdXAgcm9vdDpcbiAqICAgLSBTdHJlYW06ICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0gcGVyIGNhcmRcbiAqICAgLSBQb3N0IHZpZXc6IGZhbGxiYWNrIHRvIDxtYWluPiAvIFtyb2xlPVwibWFpblwiXVxuICovXG5mdW5jdGlvbiBmaW5kR3JvdXBSb290KGJ0bjogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBjb25zdCBwb3N0ID0gYnRuLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KEdST1VQX1NFTEVDVE9SKTtcbiAgaWYgKHBvc3QpIHJldHVybiBwb3N0O1xuXG4gIGNvbnN0IG1haW4gPVxuICAgIGJ0bi5jbG9zZXN0PEhUTUxFbGVtZW50PignbWFpbicpIHx8XG4gICAgYnRuLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCdkaXZbcm9sZT1cIm1haW5cIl0nKTtcbiAgaWYgKG1haW4pIHJldHVybiBtYWluO1xuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxGaWxlS2V5KGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBzdHJpbmcge1xuICBjb25zdCBkcyA9IGJ0bi5kYXRhc2V0IGFzIGFueTtcbiAgY29uc3QgdXJsID0gZHMuY3FkVXJsIHx8ICcnO1xuXG4gIGlmICh1cmwpIHtcbiAgICBjb25zdCBpZE1hdGNoID1cbiAgICAgIHVybC5tYXRjaCgvXFwvZFxcLyhbYS16QS1aMC05Xy1dKykvKSB8fFxuICAgICAgdXJsLm1hdGNoKC9bPyZdKD86aWR8cmVzb3VyY2VJZHxmaWxlSWQpPShbYS16QS1aMC05Xy1dKykvKTtcblxuICAgIGlmIChpZE1hdGNoICYmIGlkTWF0Y2hbMV0pIHtcbiAgICAgIHJldHVybiBgZHJpdmUtaWQtJHtpZE1hdGNoWzFdfWA7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHUgPSBuZXcgVVJMKHVybCk7XG4gICAgICB1LnNlYXJjaFBhcmFtcy5kZWxldGUoJ2F1dGh1c2VyJyk7XG4gICAgICB1LnNlYXJjaFBhcmFtcy5kZWxldGUoJ3UnKTtcbiAgICAgIHUuc2VhcmNoUGFyYW1zLmRlbGV0ZSgnaGwnKTtcbiAgICAgIHJldHVybiB1LnRvU3RyaW5nKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gdXJsO1xuICAgIH1cbiAgfVxuXG4gIGlmIChkcy5jcWROYW1lKSB7XG4gICAgcmV0dXJuIGAke2RzLmNxZE5hbWV9Ojoke2RzLmNxZEV4dCB8fCAnJ31gO1xuICB9XG5cbiAgcmV0dXJuIGBidG4tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKX1gO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRmlsZS1sZXZlbCBoZWxwZXJzIChwcmltYXJ5IGJ1dHRvbiAmIGRlZHVwKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0UHJpbWFyeUJ1dHRvbihmaWxlOiBGaWxlRW50cnkpOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwge1xuICBpZiAoZmlsZS5idXR0b25zLnNpemUgPT09IDApIHJldHVybiBudWxsO1xuXG4gIGxldCBwcmltYXJ5VmlzaWJsZTogSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGZhbGxiYWNrOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYnRuIG9mIGZpbGUuYnV0dG9ucykge1xuICAgIGlmICghYnRuLmlzQ29ubmVjdGVkKSBjb250aW51ZTtcbiAgICBpZiAoIWZhbGxiYWNrKSBmYWxsYmFjayA9IGJ0bjtcblxuICAgIC8vIE9ubHkgY29uc2lkZXIgbGFpZC1vdXQgZWxlbWVudHMgYXMgdmlzaWJsZVxuICAgIGlmICghYnRuLm9mZnNldFBhcmVudCkgY29udGludWU7XG5cbiAgICBpZiAoIXByaW1hcnlWaXNpYmxlKSB7XG4gICAgICBwcmltYXJ5VmlzaWJsZSA9IGJ0bjtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHBvcyA9IHByaW1hcnlWaXNpYmxlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGJ0bik7XG4gICAgaWYgKHBvcyAmIE5vZGUuRE9DVU1FTlRfUE9TSVRJT05fRk9MTE9XSU5HKSB7XG4gICAgICBwcmltYXJ5VmlzaWJsZSA9IGJ0bjtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcHJpbWFyeVZpc2libGUgfHwgZmFsbGJhY2s7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUZpbGVCdXR0b25zKGZpbGU6IEZpbGVFbnRyeSk6IHZvaWQge1xuICBpZiAoZmlsZS5idXR0b25zLnNpemUgPD0gMSkgcmV0dXJuO1xuXG4gIGNvbnN0IHByaW1hcnkgPSBnZXRQcmltYXJ5QnV0dG9uKGZpbGUpO1xuICBpZiAoIXByaW1hcnkpIHJldHVybjtcblxuICBmb3IgKGNvbnN0IGJ0biBvZiBmaWxlLmJ1dHRvbnMpIHtcbiAgICBpZiAoIWJ0bi5pc0Nvbm5lY3RlZCkgY29udGludWU7XG5cbiAgICBpZiAoYnRuID09PSBwcmltYXJ5KSB7XG4gICAgICBidG4uc3R5bGUucmVtb3ZlUHJvcGVydHkoJ2Rpc3BsYXknKTtcbiAgICAgIGJ0bi5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgndmlzaWJpbGl0eScpO1xuICAgICAgYnRuLnN0eWxlLnJlbW92ZVByb3BlcnR5KCdwb2ludGVyLWV2ZW50cycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBidG4uc3R5bGUuc2V0UHJvcGVydHkoJ2Rpc3BsYXknLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgICAgIGJ0bi5zdHlsZS5zZXRQcm9wZXJ0eSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgICB9XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFJlZnJlc2ggcGlwZWxpbmVcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIG1hcmtHcm91cERpcnR5KGdyb3VwOiBHcm91cFN0YXRlKTogdm9pZCB7XG4gIGRpcnR5R3JvdXBzLmFkZChncm91cCk7XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlUmVmcmVzaCgpOiB2b2lkIHtcbiAgaWYgKHJlZnJlc2hTY2hlZHVsZWQpIHJldHVybjtcbiAgcmVmcmVzaFNjaGVkdWxlZCA9IHRydWU7XG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgcmVmcmVzaFNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIGRpcnR5R3JvdXBzLmZvckVhY2godXBkYXRlR3JvdXBTdGF0ZSk7XG4gICAgZGlydHlHcm91cHMuY2xlYXIoKTtcbiAgfSk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBHcm91cCBzdGF0ZSArIHZpc3VhbCB1cGRhdGVcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHVwZGF0ZUdyb3VwU3RhdGUoZ3JvdXA6IEdyb3VwU3RhdGUpOiB2b2lkIHtcbiAgLy8gUHJ1bmUgKyBkZWR1cCBwZXIgZmlsZVxuICBmb3IgKGNvbnN0IFtrZXksIGZpbGVdIG9mIEFycmF5LmZyb20oZ3JvdXAuZmlsZXMuZW50cmllcygpKSkge1xuICAgIGZvciAoY29uc3QgYnRuIG9mIEFycmF5LmZyb20oZmlsZS5idXR0b25zKSkge1xuICAgICAgaWYgKCFidG4uaXNDb25uZWN0ZWQpIHtcbiAgICAgICAgZmlsZS5idXR0b25zLmRlbGV0ZShidG4pO1xuICAgICAgICBidXR0b25Ub0dyb3VwLmRlbGV0ZShidG4pO1xuICAgICAgICBidXR0b25Ub0ZpbGUuZGVsZXRlKGJ0bik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZpbGUuYnV0dG9ucy5zaXplID09PSAwKSB7XG4gICAgICBncm91cC5maWxlcy5kZWxldGUoa2V5KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIG5vcm1hbGl6ZUZpbGVCdXR0b25zKGZpbGUpO1xuICB9XG5cbiAgY29uc3QgdG90YWxGaWxlcyA9IGdyb3VwLmZpbGVzLnNpemU7XG5cbiAgLy8gT25seSBzaG93IFwiRG93bmxvYWQgYWxsXCIgaWYgd2UgaGF2ZSBhdCBsZWFzdCBNSU5fRklMRVNfRk9SX0RPV05MT0FEX0FMTCBmaWxlc1xuICBpZiAodG90YWxGaWxlcyA8IE1JTl9GSUxFU19GT1JfRE9XTkxPQURfQUxMKSB7XG4gICAgaWYgKGdyb3VwLmRvd25sb2FkQWxsQnRuICYmIGdyb3VwLmRvd25sb2FkQWxsQnRuLmlzQ29ubmVjdGVkKSB7XG4gICAgICBncm91cC5kb3dubG9hZEFsbEJ0bi5yZW1vdmUoKTtcbiAgICB9XG4gICAgZ3JvdXAuZG93bmxvYWRBbGxCdG4gPSBudWxsO1xuICAgIGdyb3VwLmFjdGl2YXRlZCA9IGZhbHNlO1xuICAgIGdyb3VwLmlzQnVzeSA9IGZhbHNlO1xuICAgIGlmIChncm91cC5yZXNldFRpbWVvdXRJZCAhPSBudWxsKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KGdyb3VwLnJlc2V0VGltZW91dElkKTtcbiAgICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBidG4gPSBlbnN1cmVEb3dubG9hZEFsbEJ1dHRvbihncm91cCk7XG5cbiAgLy8gQWdncmVnYXRlIHBlci1maWxlIHN0YXRlIGZyb20gdW5kZXJseWluZyBzaW5nbGUgYnV0dG9ucyxcbiAgLy8gYnV0IExBVENIIHN1Y2Nlc3MvZXJyb3IgZm9yIHRoZSB3aG9sZSBiYXRjaC5cbiAgbGV0IGRvd25sb2FkZWQgPSAwO1xuICBsZXQgZmFpbGVkID0gMDtcbiAgbGV0IGluUHJvZ3Jlc3MgPSAwO1xuXG4gIGZvciAoY29uc3QgZmlsZSBvZiBncm91cC5maWxlcy52YWx1ZXMoKSkge1xuICAgIGxldCBzb21lU3VjY2VzcyA9IGZpbGUuZG93bmxvYWRlZDsgLy8gbGF0Y2hcbiAgICBsZXQgc29tZUVycm9yID0gZmlsZS5mYWlsZWQ7ICAgICAgIC8vIGxhdGNoXG4gICAgbGV0IHNvbWVMb2FkaW5nID0gZmlsZS5pblByb2dyZXNzO1xuXG4gICAgZm9yIChjb25zdCBiIG9mIGZpbGUuYnV0dG9ucykge1xuICAgICAgaWYgKCFiLmlzQ29ubmVjdGVkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGNscyA9IGIuY2xhc3NMaXN0O1xuICAgICAgY29uc3QgZHMgPSBiLmRhdGFzZXQgYXMgYW55O1xuXG4gICAgICBjb25zdCBpc0xvYWRpbmcgPVxuICAgICAgICBjbHMuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykgfHwgY2xzLmNvbnRhaW5zKCdjcWQtdHJ5aW5nJyk7XG4gICAgICBjb25zdCBpc1N1Y2Nlc3MgPVxuICAgICAgICBjbHMuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykgfHwgZHMuY3FkQWxsRG9uZSA9PT0gJ3RydWUnO1xuICAgICAgY29uc3QgaXNFcnJvciA9IGNscy5jb250YWlucygnY3FkLWVycm9yJyk7XG5cbiAgICAgIGlmIChpc0xvYWRpbmcpIHNvbWVMb2FkaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChpc1N1Y2Nlc3MpIHNvbWVTdWNjZXNzID0gdHJ1ZTtcbiAgICAgIGlmIChpc0Vycm9yKSBzb21lRXJyb3IgPSB0cnVlO1xuICAgIH1cblxuICAgIGZpbGUuZG93bmxvYWRlZCA9IHNvbWVTdWNjZXNzO1xuICAgIGZpbGUuaW5Qcm9ncmVzcyA9IHNvbWVMb2FkaW5nO1xuICAgIGZpbGUuZmFpbGVkID0gIWZpbGUuZG93bmxvYWRlZCAmJiBzb21lRXJyb3I7XG5cbiAgICBpZiAoZmlsZS5kb3dubG9hZGVkKSBkb3dubG9hZGVkKys7XG4gICAgZWxzZSBpZiAoZmlsZS5pblByb2dyZXNzKSBpblByb2dyZXNzKys7XG4gICAgZWxzZSBpZiAoZmlsZS5mYWlsZWQpIGZhaWxlZCsrO1xuICB9XG5cbiAgZ3JvdXAuaXNCdXN5ID0gaW5Qcm9ncmVzcyA+IDA7XG5cbiAgLy8gSWYgbmV3IGRvd25sb2FkcyBhcmUgaW4gcHJvZ3Jlc3MsIGtpbGwgYW55IHBlbmRpbmcgcmVzZXQgdGltZXJcbiAgaWYgKGdyb3VwLmlzQnVzeSAmJiBncm91cC5yZXNldFRpbWVvdXRJZCAhPSBudWxsKSB7XG4gICAgd2luZG93LmNsZWFyVGltZW91dChncm91cC5yZXNldFRpbWVvdXRJZCk7XG4gICAgZ3JvdXAucmVzZXRUaW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBtYWluU3BhbiA9IGJ0bi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1hbGwtbWFpbicpO1xuICBjb25zdCBzdWJTcGFuID0gYnRuLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWRvd25sb2FkLWFsbC1zdWInKTtcbiAgaWYgKCFtYWluU3BhbiB8fCAhc3ViU3BhbikgcmV0dXJuO1xuXG4gIGNvbnN0IG5vbmVTdGFydGVkID0gZG93bmxvYWRlZCA9PT0gMCAmJiBmYWlsZWQgPT09IDAgJiYgaW5Qcm9ncmVzcyA9PT0gMDtcbiAgY29uc3QgYWxsU3VjY2VlZGVkID1cbiAgICBkb3dubG9hZGVkID09PSB0b3RhbEZpbGVzICYmIGZhaWxlZCA9PT0gMCAmJiB0b3RhbEZpbGVzID4gMDtcbiAgY29uc3QgYWxsQ29tcGxldGVkID1cbiAgICBkb3dubG9hZGVkICsgZmFpbGVkID09PSB0b3RhbEZpbGVzICYmIGluUHJvZ3Jlc3MgPT09IDAgJiYgdG90YWxGaWxlcyA+IDA7XG5cbiAgLy8gT25jZSBhbnkgZmlsZSBzdGFydHMsIHdlIGNvbnNpZGVyIHRoZSBydW4gXCJhY3RpdmVcIlxuICBpZiAoIWdyb3VwLmFjdGl2YXRlZCAmJiAhbm9uZVN0YXJ0ZWQpIHtcbiAgICBncm91cC5hY3RpdmF0ZWQgPSB0cnVlO1xuICB9XG5cbiAgYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1hbGwtc3VjY2VzcycsICdjcWQtYWxsLWVycm9yJyk7XG5cbiAgLy8gSWRsZSBzdGF0ZTogbm90aGluZyBzdGFydGVkIG9yIHdlJ3ZlIGZ1bGx5IHJlc2V0XG4gIGlmICghZ3JvdXAuYWN0aXZhdGVkIHx8IG5vbmVTdGFydGVkKSB7XG4gICAgZ3JvdXAuYWN0aXZhdGVkID0gZ3JvdXAuYWN0aXZhdGVkICYmICFub25lU3RhcnRlZDtcbiAgICBncm91cC5pc0J1c3kgPSBmYWxzZTtcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBtYWluU3Bhbi50ZXh0Q29udGVudCA9IHQoJ2Rvd25sb2FkQWxsJykgfHwgJ0Rvd25sb2FkIGFsbCc7XG4gICAgc3ViU3Bhbi50ZXh0Q29udGVudCA9IGAke3RvdGFsRmlsZXN9IGZpbGVzYDtcbiAgICBzZXRQcm9ncmVzc1Zpc3VhbChidG4sIDApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEZyb20gaGVyZTogYmF0Y2ggaGFzIGJlZW4gYWN0aXZhdGVkIChhbmQgbWF5IGJlIGluIHByb2dyZXNzIG9yIGluIGZlZWRiYWNrKVxuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuXG4gIGxldCBtYWluVGV4dDogc3RyaW5nO1xuICBsZXQgc3ViVGV4dDogc3RyaW5nO1xuICBsZXQgcHJvZ3Jlc3NSYXRpbyA9IHRvdGFsRmlsZXMgPiAwID8gZG93bmxvYWRlZCAvIHRvdGFsRmlsZXMgOiAwO1xuXG4gIGlmIChhbGxTdWNjZWVkZWQpIHtcbiAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IC8gJHt0b3RhbEZpbGVzfWA7XG4gICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtc3VjY2VzcycpO1xuICAgIHByb2dyZXNzUmF0aW8gPSAxO1xuICAgIHNjaGVkdWxlR3JvdXBSZXNldChncm91cCk7XG4gIH0gZWxzZSBpZiAoYWxsQ29tcGxldGVkICYmIGZhaWxlZCA+IDApIHtcbiAgICBpZiAoZG93bmxvYWRlZCA9PT0gMCkge1xuICAgICAgbWFpblRleHQgPSB0KCdlcnJvcicpIHx8ICdFcnJvcic7XG4gICAgICBzdWJUZXh0ID0gYCR7ZmFpbGVkfSBmYWlsZWRgO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtZXJyb3InKTtcbiAgICAgIHByb2dyZXNzUmF0aW8gPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgICBzdWJUZXh0ID0gYCR7ZG93bmxvYWRlZH0gb2ssICR7ZmFpbGVkfSBmYWlsZWRgO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtc3VjY2VzcycpO1xuICAgIH1cbiAgICBzY2hlZHVsZUdyb3VwUmVzZXQoZ3JvdXApO1xuICB9IGVsc2Uge1xuICAgIC8vIFN0aWxsIGluIHByb2dyZXNzXG4gICAgbWFpblRleHQgPSB0KCdkb3dubG9hZGluZycpIHx8ICdEb3dubG9hZGluZ+KApic7XG4gICAgaWYgKGZhaWxlZCA9PT0gMCkge1xuICAgICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IOKGkiAke3RvdGFsRmlsZXN9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IOKGkiAke3RvdGFsRmlsZXN9ICgke2ZhaWxlZH0gZmFpbGVkKWA7XG4gICAgfVxuICB9XG5cbiAgbWFpblNwYW4udGV4dENvbnRlbnQgPSBtYWluVGV4dDtcbiAgc3ViU3Bhbi50ZXh0Q29udGVudCA9IHN1YlRleHQ7XG4gIHNldFByb2dyZXNzVmlzdWFsKGJ0biwgcHJvZ3Jlc3NSYXRpbyk7XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlR3JvdXBSZXNldChncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICBpZiAoZ3JvdXAucmVzZXRUaW1lb3V0SWQgIT0gbnVsbCkgcmV0dXJuOyAvLyBhbHJlYWR5IHNjaGVkdWxlZFxuXG4gIGdyb3VwLnJlc2V0VGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgIGdyb3VwLmFjdGl2YXRlZCA9IGZhbHNlO1xuICAgIGdyb3VwLmlzQnVzeSA9IGZhbHNlO1xuICAgIGdyb3VwLmN1cnJlbnRSdW5JZCA9IHVuZGVmaW5lZDtcblxuICAgIHRyeSB7XG4gICAgICBkZWxldGUgZ3JvdXAucm9vdC5kYXRhc2V0LmNxZEdyb3VwQWN0aXZlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLyogaWdub3JlICovXG4gICAgfVxuXG4gICAgLy8gQ2xlYXIgbGF0Y2hlZCBwZXItZmlsZSBzdGF0ZSBmb3IgdGhlIG5leHQgcnVuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGdyb3VwLmZpbGVzLnZhbHVlcygpKSB7XG4gICAgICBmaWxlLmRvd25sb2FkZWQgPSBmYWxzZTtcbiAgICAgIGZpbGUuZmFpbGVkID0gZmFsc2U7XG4gICAgICBmaWxlLmluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gICAgc2NoZWR1bGVSZWZyZXNoKCk7XG4gIH0sIEdST1VQX0ZFRURCQUNLX1NVQ0NFU1NfTVMpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogSGVhZGVyIGxvb2t1cCArIERvd25sb2FkIGFsbCBjcmVhdGlvblxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuLyoqXG4gKiBGaW5kIHRoZSAqaGVhZGVyIHJvdyogZm9yIHRoaXMgc3BlY2lmaWMgZ3JvdXA6XG4gKiAgIC0gUHJlZmVyIGhlYWRlciBpbnNpZGUgdGhlIHNhbWUgY29udGFpbmVyIChwb3N0IHZpZXcpXG4gKiAgIC0gT3RoZXJ3aXNlLCBmb3IgYSBzdHJlYW0gY2FyZDogbG9vayBmb3IgYSBoZWFkZXIgc2libGluZyBhYm92ZSB0aGVcbiAqICAgICBkYXRhLXN0cmVhbS1pdGVtIGNvbnRhaW5lciwgYnV0IGRvIE5PVCBmYWxsIGJhY2sgdG8gYSBnbG9iYWwgaGVhZGVyLlxuICovXG5mdW5jdGlvbiBmaW5kSGVhZGVyQ29udGFpbmVyKHJvb3Q6IEhUTUxFbGVtZW50KTogSFRNTEVsZW1lbnQgfCBudWxsIHtcbiAgLy8gMSkgTG9vayAqaW5zaWRlKiB0aGUgcm9vdCBpdHNlbGYgKHBvc3QgdmlldzogbWFpbiBjb250YWlucyAuTjVkU3AgYWJvdmUgY29udGVudClcbiAgY29uc3QgaW50ZXJuYWxIZWFkZXIgPVxuICAgIHJvb3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5KWmljWWIuZ21OdTFkJykgfHxcbiAgICByb290LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuTjVkU3AnKSB8fFxuICAgIHJvb3QucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5KWmljWWInKTtcbiAgaWYgKGludGVybmFsSGVhZGVyKSByZXR1cm4gaW50ZXJuYWxIZWFkZXI7XG5cbiAgLy8gMikgV2FsayBhbmNlc3RvcnMgYW5kLCBmb3IgZWFjaCBwYXJlbnQsIGZpbmQgdGhlIGxhc3QgaGVhZGVyIHRoYXQgYXBwZWFyc1xuICAvLyAgICBiZWZvcmUgYHJvb3RgIGluIERPTSBvcmRlciwgd2l0aGluIHRoYXQgcGFyZW50J3Mgc3VidHJlZS5cbiAgbGV0IGN1cnJlbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCA9IHJvb3Q7XG4gIHdoaWxlIChcbiAgICBjdXJyZW50ICYmXG4gICAgY3VycmVudCAhPT0gZG9jdW1lbnQuYm9keSAmJlxuICAgIGN1cnJlbnQgIT09IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICApIHtcbiAgICBjb25zdCBwYXJlbnQgPSBjdXJyZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgaWYgKCFwYXJlbnQpIGJyZWFrO1xuXG4gICAgY29uc3QgaGVhZGVycyA9IEFycmF5LmZyb20oXG4gICAgICBwYXJlbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgICAgICcuSlppY1liLmdtTnUxZCwgLk41ZFNwLCAuSlppY1liJyxcbiAgICAgICksXG4gICAgKTtcblxuICAgIGxldCBiZXN0OiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gICAgZm9yIChjb25zdCBoIG9mIGhlYWRlcnMpIHtcbiAgICAgIGNvbnN0IHJlbCA9IGguY29tcGFyZURvY3VtZW50UG9zaXRpb24oY3VycmVudCk7XG4gICAgICBjb25zdCBpc0JlZm9yZSA9ICEhKHJlbCAmIE5vZGUuRE9DVU1FTlRfUE9TSVRJT05fRk9MTE9XSU5HKTtcbiAgICAgIGNvbnN0IGlzRGlzY29ubmVjdGVkID0gISEocmVsICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9ESVNDT05ORUNURUQpO1xuXG4gICAgICBpZiAoaXNEaXNjb25uZWN0ZWQgfHwgIWlzQmVmb3JlKSBjb250aW51ZTtcblxuICAgICAgaWYgKCFiZXN0KSB7XG4gICAgICAgIGJlc3QgPSBoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVsMiA9IGJlc3QuY29tcGFyZURvY3VtZW50UG9zaXRpb24oaCk7XG4gICAgICAgIGNvbnN0IGhBZnRlckJlc3QgPSAhIShyZWwyICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9GT0xMT1dJTkcpO1xuICAgICAgICBpZiAoaEFmdGVyQmVzdCkgYmVzdCA9IGg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGJlc3QpIHJldHVybiBiZXN0O1xuXG4gICAgY3VycmVudCA9IHBhcmVudDtcbiAgfVxuXG4gIC8vIDMpIE5vIGhlYWRlciBmb3VuZCBsb2NhbGx5OyBjYWxsZXIgd2lsbCBmYWxsIGJhY2sgdG8gcm9vdCBpdHNlbGYuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVEb3dubG9hZEFsbEJ1dHRvbihncm91cDogR3JvdXBTdGF0ZSk6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgY29uc3QgZXhpc3RpbmcgPSBncm91cC5kb3dubG9hZEFsbEJ0bjtcbiAgaWYgKGV4aXN0aW5nICYmIGV4aXN0aW5nLmlzQ29ubmVjdGVkKSByZXR1cm4gZXhpc3Rpbmc7XG5cbiAgY29uc3Qgcm9vdCA9IGdyb3VwLnJvb3Q7XG5cbiAgY29uc3QgaGVhZGVyQ29udGFpbmVyID0gZmluZEhlYWRlckNvbnRhaW5lcihyb290KTtcbiAgY29uc3QgdGFyZ2V0Q29udGFpbmVyID0gaGVhZGVyQ29udGFpbmVyIHx8IHJvb3Q7XG4gIGNvbnN0IGlzSW5IZWFkZXIgPSAhIWhlYWRlckNvbnRhaW5lcjtcblxuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgYnV0dG9uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYWxsLWJ0bic7XG5cbiAgaWYgKGlzSW5IZWFkZXIpIHtcbiAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLWluLWhlYWRlcicpO1xuICB9XG5cbiAgYnV0dG9uLnNldEF0dHJpYnV0ZShJTkpFQ1RFRF9BVFRSLCAndHJ1ZScpO1xuXG4gIGlmIChpc1BhZ2VEYXJrKCkpIHtcbiAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcbiAgfVxuXG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoXG4gICAgJ2FyaWEtbGFiZWwnLFxuICAgIHQoJ2Rvd25sb2FkQWxsJykgfHwgJ0Rvd25sb2FkIGFsbCBhdHRhY2htZW50cyBpbiB0aGlzIHBvc3QnLFxuICApO1xuICBidXR0b24udGl0bGUgPSB0KCdkb3dubG9hZEFsbCcpIHx8ICdEb3dubG9hZCBhbGwnO1xuXG4gIGNvbnN0IGljb25XcmFwcGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBpY29uV3JhcHBlci5jbGFzc05hbWUgPSAnY3FkLWljb24td3JhcHBlciBjcWQtZG93bmxvYWQtYWxsLWljb24td3JhcHBlcic7XG4gIGNvbnN0IGljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb24uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1hbGwtaWNvbic7XG4gIGljb25XcmFwcGVyLmFwcGVuZENoaWxkKGljb24pO1xuXG4gIGNvbnN0IG1haW5TcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBtYWluU3Bhbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWFsbC1tYWluJztcblxuICBjb25zdCBzdWJTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBzdWJTcGFuLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYWxsLXN1Yic7XG5cbiAgYnV0dG9uLmFwcGVuZENoaWxkKGljb25XcmFwcGVyKTtcbiAgYnV0dG9uLmFwcGVuZENoaWxkKG1haW5TcGFuKTtcbiAgYnV0dG9uLmFwcGVuZENoaWxkKHN1YlNwYW4pO1xuXG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUodGFyZ2V0Q29udGFpbmVyKTtcbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykge1xuICAgIHRhcmdldENvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gIH1cblxuICBpZiAoIWlzSW5IZWFkZXIgJiYgdGFyZ2V0Q29udGFpbmVyID09PSByb290KSB7XG4gICAgLy8gRmFsbGJhY2s6IGVuc3VyZSBjb250YWluZXIgZG9lc24ndCBjbGlwIHRoZSBidXR0b25cbiAgICByb290LnN0eWxlLnNldFByb3BlcnR5KCdvdmVyZmxvdycsICd2aXNpYmxlJywgJ2ltcG9ydGFudCcpO1xuICAgIHJvb3Quc3R5bGUuc2V0UHJvcGVydHkoJ2NvbnRhaW4nLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgfVxuXG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgaGFuZGxlRG93bmxvYWRBbGxDbGljayhncm91cCk7XG4gIH0pO1xuXG4gIHRhcmdldENvbnRhaW5lci5hcHBlbmRDaGlsZChidXR0b24pO1xuICBncm91cC5kb3dubG9hZEFsbEJ0biA9IGJ1dHRvbjtcblxuICByZXR1cm4gYnV0dG9uO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRG93bmxvYWQgYWxsIGNsaWNrXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBoYW5kbGVEb3dubG9hZEFsbENsaWNrKGdyb3VwOiBHcm91cFN0YXRlKTogdm9pZCB7XG4gIC8vIElmIGEgYmF0Y2ggaXMgYWxyZWFkeSBhY3RpdmUgb3IgaW4gZmVlZGJhY2ssIGlnbm9yZSBjbGlja3NcbiAgaWYgKGdyb3VwLmlzQnVzeSB8fCBncm91cC5hY3RpdmF0ZWQpIHJldHVybjtcblxuICBncm91cC5hY3RpdmF0ZWQgPSB0cnVlO1xuICBncm91cC5pc0J1c3kgPSB0cnVlO1xuICBncm91cC5jdXJyZW50UnVuSWQgPSBEYXRlLm5vdygpO1xuXG4gIHRyeSB7XG4gICAgZ3JvdXAucm9vdC5kYXRhc2V0LmNxZEdyb3VwQWN0aXZlID0gJzEnO1xuICB9IGNhdGNoIHtcbiAgICAvKiBpZ25vcmUgKi9cbiAgfVxuXG4gIC8vIFJlc2V0IGxhdGNoZWQgc3RhdGUgZm9yIHRoaXMgbmV3IHJ1blxuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ3JvdXAuZmlsZXMudmFsdWVzKCkpIHtcbiAgICBmaWxlLmRvd25sb2FkZWQgPSBmYWxzZTtcbiAgICBmaWxlLmZhaWxlZCA9IGZhbHNlO1xuICAgIGZpbGUuaW5Qcm9ncmVzcyA9IGZhbHNlO1xuICB9XG5cbiAgaWYgKGdyb3VwLnJlc2V0VGltZW91dElkICE9IG51bGwpIHtcbiAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KGdyb3VwLnJlc2V0VGltZW91dElkKTtcbiAgICBncm91cC5yZXNldFRpbWVvdXRJZCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IGJ0biA9IGdyb3VwLmRvd25sb2FkQWxsQnRuO1xuICBpZiAoYnRuKSB7XG4gICAgYnRuLmRpc2FibGVkID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFRyaWdnZXIgYXQgbW9zdCBvbmUgcHJpbWFyeSBidXR0b24gcGVyIGZpbGVcbiAgZm9yIChjb25zdCBmaWxlIG9mIGdyb3VwLmZpbGVzLnZhbHVlcygpKSB7XG4gICAgY29uc3QgcHJpbWFyeSA9IGdldFByaW1hcnlCdXR0b24oZmlsZSk7XG4gICAgaWYgKCFwcmltYXJ5KSBjb250aW51ZTtcbiAgICBjb25zdCBzID0gZ2V0U2luZ2xlQnV0dG9uU3RhdGUocHJpbWFyeSk7XG4gICAgaWYgKHMgPT09ICdpZGxlJyB8fCBzID09PSAnZXJyb3InKSB7XG4gICAgICBwcmltYXJ5LmNsaWNrKCk7XG4gICAgfVxuICB9XG5cbiAgbWFya0dyb3VwRGlydHkoZ3JvdXApO1xuICBzY2hlZHVsZVJlZnJlc2goKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xlQnV0dG9uU3RhdGUoYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IEJ1dHRvblN0YXRlIHtcbiAgY29uc3QgY2xzID0gYnRuLmNsYXNzTGlzdDtcbiAgaWYgKGNscy5jb250YWlucygnY3FkLWxvYWRpbmcnKSkgcmV0dXJuICdsb2FkaW5nJztcbiAgaWYgKGNscy5jb250YWlucygnY3FkLXRyeWluZycpKSByZXR1cm4gJ3RyeWluZyc7XG4gIGlmIChjbHMuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykpIHJldHVybiAnc3VjY2Vzcyc7XG4gIGlmIChjbHMuY29udGFpbnMoJ2NxZC1lcnJvcicpKSByZXR1cm4gJ2Vycm9yJztcbiAgaWYgKChidG4uZGF0YXNldCBhcyBhbnkpLmNxZEFsbERvbmUgPT09ICd0cnVlJykgcmV0dXJuICdzdWNjZXNzJztcbiAgcmV0dXJuICdpZGxlJztcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFZpc3VhbHM6IHByb2dyZXNzIOKGkiBDU1MgdmFyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2V0UHJvZ3Jlc3NWaXN1YWwoYnRuOiBIVE1MQnV0dG9uRWxlbWVudCwgcmF0aW86IG51bWJlcik6IHZvaWQge1xuICBjb25zdCBjbGFtcGVkID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgcmF0aW8pKTtcbiAgY29uc3QgcGVyY2VudCA9IE1hdGgucm91bmQoY2xhbXBlZCAqIDEwMCk7XG4gIGJ0bi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1jcWQtcHJvZ3Jlc3MnLCBgJHtwZXJjZW50fSVgKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIERpcmVjdGlvbiBoZWxwZXJcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHNhZmVTZXREaXJlY3Rpb24oKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGlyID0gZ2V0UGFnZURpcmVjdGlvbigpO1xuICAgIGRvY3VtZW50LmJvZHkuc2V0QXR0cmlidXRlKCdkYXRhLWNxZC1kaXInLCBkaXIpO1xuICB9IGNhdGNoIHtcbiAgICAvLyBpZ25vcmVcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRQYWdlRGlyZWN0aW9uKCk6ICdsdHInIHwgJ3J0bCcge1xuICBjb25zdCBkb2NEaXIgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZGlyIHx8IGRvY3VtZW50LmJvZHkuZGlyO1xuICBpZiAoZG9jRGlyID09PSAncnRsJykgcmV0dXJuICdydGwnO1xuICBjb25zdCBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHkpLmRpcmVjdGlvbjtcbiAgcmV0dXJuIGNvbXB1dGVkID09PSAncnRsJyA/ICdydGwnIDogJ2x0cic7XG59XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTJCOUIsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUM1QkQsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sa0JBQWtCO0FBRXhCLFFBQU0sZ0JBQWdCO0FBQ3RCLFFBQU0saUJBQWlCLEdBQUcsYUFBYTtBQUVoQyxXQUFTLGVBQXFCO0FBQ25DLFFBQUksT0FBTyxhQUFhLFlBQWE7QUFDckMsUUFBSSxTQUFTLGVBQWUsUUFBUSxFQUFHO0FBRXZDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLEtBQUs7QUFDWCxVQUFNLGNBQWM7QUFBQTtBQUFBLDBCQUVJLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBb0lULHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBaUpyQyxlQUFlO0FBQUEsZ0JBQ2QsZUFBZTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLCtCQWdaQSxxQkFBcUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBaUJoRCxLQUFBO0FBRUYsS0FBQyxTQUFTLFFBQVEsU0FBUyxpQkFBaUIsWUFBWSxLQUFLO0FBQUEsRUFDL0Q7QUM1c0JBLFFBQU0sZUFBb0M7QUFBQSxJQUN4QyxJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsTUFDUixhQUFhO0FBQUEsSUFBQTtBQUFBLElBRWYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLElBQUE7QUFBQSxJQUVmLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixTQUFTO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsU0FBUztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLFNBQVM7QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsS0FBSztBQUFBLE1BQ0gsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsRUFFWjtBQUlPLFdBQVMsRUFBRSxLQUFzQjtBQUN0QyxRQUFJO0FBQ0YsVUFBSSxDQUFDLE9BQU8sT0FBTyxRQUFRLFVBQVU7QUFDbkMsZUFBTztBQUFBLE1BQ1Q7QUFFQSxVQUFJLFVBQVU7QUFDZCxVQUNFLE9BQU8sYUFBYSxlQUNwQixTQUFTLG1CQUNULFNBQVMsZ0JBQWdCLE1BQ3pCO0FBQ0Esa0JBQVUsU0FBUyxnQkFBZ0I7QUFBQSxNQUNyQyxXQUFXLE9BQU8sY0FBYyxlQUFlLFVBQVUsVUFBVTtBQUNqRSxrQkFBVSxVQUFVO0FBQUEsTUFDdEI7QUFFQSxZQUFNLGlCQUFpQixRQUNwQixZQUFBLEVBQ0EsTUFBTSxHQUFHLEVBQUUsQ0FBQyxFQUNaLEtBQUEsRUFDQSxRQUFRLEtBQUssR0FBRztBQUNuQixZQUFNLFdBQVcsZUFBZSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBRTVDLFVBQ0UsYUFBYSxjQUFjLEtBQzNCLE9BQU8sYUFBYSxjQUFjLEVBQUUsR0FBRyxNQUFNLFVBQzdDO0FBQ0EsZUFBTyxhQUFhLGNBQWMsRUFBRSxHQUFHO0FBQUEsTUFDekM7QUFFQSxVQUNFLGFBQWEsUUFBUSxLQUNyQixPQUFPLGFBQWEsUUFBUSxFQUFFLEdBQUcsTUFBTSxVQUN2QztBQUNBLGVBQU8sYUFBYSxRQUFRLEVBQUUsR0FBRztBQUFBLE1BQ25DO0FBRUEsVUFDRSxhQUFhLElBQUksS0FDakIsT0FBTyxhQUFhLElBQUksRUFBRSxHQUFHLE1BQU0sVUFDbkM7QUFDQSxlQUFPLGFBQWEsSUFBSSxFQUFFLEdBQUc7QUFBQSxNQUMvQjtBQUVBLGFBQU87QUFBQSxJQUNULFFBQVE7QUFDTixVQUFJO0FBQ0YsZUFBTyxhQUFhLElBQUksRUFBRSxHQUFHLEtBQUs7QUFBQSxNQUNwQyxRQUFRO0FBQ04sZUFBTyxPQUFPLE9BQU8sVUFBVTtBQUFBLE1BQ2pDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUNoN0JPLFdBQVMsYUFBc0I7QUFDcEMsUUFBSSxPQUFPLGFBQWEsWUFBYSxRQUFPO0FBRzVDLFVBQU0sV0FBVyxTQUFTLGdCQUFnQixhQUFhLHdCQUF3QjtBQUMvRSxRQUFJLGFBQWEsT0FBUSxRQUFPO0FBQ2hDLFFBQUksYUFBYSxRQUFTLFFBQU87QUFJakMsVUFBTSxhQUFhLENBQUMsUUFBUSxjQUFjLGNBQWMsU0FBUyxnQkFBZ0I7QUFDakYsVUFBTSxhQUFhLFNBQVMsZ0JBQWdCLGFBQWEsSUFBSSxZQUFBO0FBQzdELFVBQU0sYUFBYSxTQUFTLEtBQUssYUFBYSxJQUFJLFlBQUE7QUFDbEQsUUFBSSxXQUFXLEtBQUssQ0FBQSxVQUFTLFVBQVUsU0FBUyxLQUFLLEtBQUssVUFBVSxTQUFTLEtBQUssQ0FBQyxHQUFHO0FBQ3BGLGFBQU87QUFBQSxJQUNUO0FBSUEsVUFBTSxVQUNKLFNBQVMsY0FBMkIsMEJBQTBCLEtBQzlELFNBQVMsY0FBMkIsZUFBZSxLQUNuRCxTQUFTO0FBRVgsVUFBTSxVQUFVLDRCQUE0QixPQUFPO0FBQ25ELFVBQU0sYUFBYSxnQkFBZ0IsT0FBTztBQUsxQyxXQUFPLGFBQWE7QUFBQSxFQUN0QjtBQU1BLFdBQVMsNEJBQTRCLE9BQTRCO0FBQy9ELFFBQUksS0FBeUI7QUFFN0IsVUFBTSxnQkFBZ0IsQ0FBQyxNQUNyQixDQUFDLEtBQUssTUFBTSxpQkFBaUIsTUFBTTtBQUVyQyxXQUFPLElBQUk7QUFDVCxZQUFNLFFBQVEsT0FBTyxpQkFBaUIsRUFBRTtBQUN4QyxZQUFNLEtBQUssTUFBTTtBQUNqQixVQUFJLENBQUMsY0FBYyxFQUFFLEVBQUcsUUFBTztBQUMvQixXQUFLLEdBQUc7QUFBQSxJQUNWO0FBR0EsVUFBTSxZQUFZLE9BQU8saUJBQWlCLFNBQVMsZUFBZTtBQUNsRSxVQUFNLFNBQVMsVUFBVTtBQUN6QixRQUFJLENBQUMsY0FBYyxNQUFNLEVBQUcsUUFBTztBQUduQyxXQUFPO0FBQUEsRUFDVDtBQU1BLFdBQVMsZ0JBQWdCLFdBQTJCO0FBQ2xELFVBQU0sUUFBUSxVQUFVLE1BQU0seUJBQXlCO0FBQ3ZELFFBQUksQ0FBQyxPQUFPO0FBRVYsYUFBTztBQUFBLElBQ1Q7QUFFQSxVQUFNLElBQUksU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQy9CLFVBQU0sSUFBSSxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDL0IsVUFBTSxJQUFJLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUcvQixVQUFNLGFBQWEsS0FBSztBQUFBLE1BQ3RCLFNBQVMsSUFBSSxLQUNiLFNBQVMsSUFBSSxLQUNiLFNBQVMsSUFBSTtBQUFBLElBQUE7QUFHZixXQUFPO0FBQUEsRUFDVDtBQzVGQSxRQUFBLHdCQUFBO0FBQ0EsUUFBQSxpQkFBQTtBQUNBLFFBQUEsZ0JBQUE7QUFHQSxRQUFBLDRCQUFBO0FBR0EsUUFBQSw2QkFBQTtBQXNCQSxRQUFBLGNBQUEsb0JBQUEsUUFBQTtBQUNBLFFBQUEsZ0JBQUEsb0JBQUEsUUFBQTtBQUNBLFFBQUEsZUFBQSxvQkFBQSxRQUFBO0FBRUEsUUFBQSxjQUFBLG9CQUFBLElBQUE7QUFDQSxNQUFBLG1CQUFBO0FBRUEsUUFBQSxhQUFBLG9CQUFBO0FBQUEsSUFBbUMsU0FBQSxDQUFBLGdDQUFBO0FBQUEsSUFDUyxPQUFBO0FBQUEsSUFDbkMsT0FBQTtBQUVMLG1CQUFBO0FBQ0EsdUJBQUE7QUFHQSwrQkFBQSxRQUFBO0FBRUEsWUFBQSxXQUFBLElBQUEsaUJBQUEsQ0FBQSxjQUFBO0FBQ0UsbUJBQUEsS0FBQSxXQUFBO0FBQ0UsY0FBQSxFQUFBLFNBQUEsYUFBQTtBQUNFLGNBQUEsV0FBQSxRQUFBLENBQUEsU0FBQTtBQUNFLGtCQUFBLEVBQUEsZ0JBQUEsYUFBQTtBQUNBLHVDQUFBLElBQUE7QUFBQSxZQUE2QixDQUFBO0FBRy9CLGNBQUEsYUFBQSxRQUFBLENBQUEsU0FBQTtBQUNFLGtCQUFBLEVBQUEsZ0JBQUEsYUFBQTtBQUNBLG9DQUFBLElBQUE7QUFBQSxZQUEwQixDQUFBO0FBQUEsVUFDM0IsV0FBQSxFQUFBLFNBQUEsY0FBQTtBQUVELGtCQUFBLFNBQUEsRUFBQTtBQUNBLGdCQUFBLGtCQUFBLHFCQUFBLE9BQUEsVUFBQSxTQUFBLGtCQUFBLEdBQUE7QUFJRSxvQkFBQSxRQUFBLHVCQUFBLE1BQUE7QUFDQSxrQkFBQSxNQUFBLGdCQUFBLEtBQUE7QUFBQSxZQUErQjtBQUFBLFVBQ2pDO0FBQUEsUUFDRjtBQUdGLHdCQUFBO0FBQUEsTUFBZ0IsQ0FBQTtBQUdsQixVQUFBLFNBQUEsTUFBQTtBQUNFLGlCQUFBLFFBQUEsU0FBQSxNQUFBO0FBQUEsVUFBZ0MsV0FBQTtBQUFBLFVBQ25CLFNBQUE7QUFBQSxVQUNGLFlBQUE7QUFBQSxVQUNHLGlCQUFBLENBQUEsU0FBQSxtQkFBQTtBQUFBLFFBQ2tDLENBQUE7QUFBQSxNQUMvQztBQUlILGFBQUEsWUFBQSxNQUFBO0FBQ0UsaUNBQUEsUUFBQTtBQUNBLHdCQUFBO0FBQUEsTUFBZ0IsR0FBQSxHQUFBO0FBQUEsSUFDWDtBQUFBLEVBRVgsQ0FBQTtBQU1BLFdBQUEseUJBQUEsTUFBQTtBQUNFLFFBQUEsZ0JBQUEscUJBQUEsS0FBQSxVQUFBLFNBQUEsa0JBQUEsR0FBQTtBQUlFLDJCQUFBLElBQUE7QUFBQSxJQUF5QjtBQUczQixVQUFBLFVBQUEsS0FBQSxpQkFBQSxxQkFBQTtBQUNBLFlBQUEsUUFBQSxDQUFBLFFBQUEscUJBQUEsR0FBQSxDQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEscUJBQUEsS0FBQTtBQUNFLFFBQUEsQ0FBQSxJQUFBLFlBQUE7QUFDQSxRQUFBLGNBQUEsSUFBQSxHQUFBLEtBQUEsYUFBQSxJQUFBLEdBQUEsRUFBQTtBQUVBLFVBQUEsWUFBQSxjQUFBLEdBQUE7QUFDQSxRQUFBLENBQUEsVUFBQTtBQUVBLFFBQUEsUUFBQSxZQUFBLElBQUEsU0FBQTtBQUNBLFFBQUEsQ0FBQSxPQUFBO0FBQ0UsY0FBQTtBQUFBLFFBQVEsTUFBQTtBQUFBLFFBQ0EsT0FBQSxvQkFBQSxJQUFBO0FBQUEsUUFDNEIsZ0JBQUE7QUFBQSxRQUNsQixXQUFBO0FBQUEsUUFDTCxRQUFBO0FBQUEsTUFDSDtBQUVWLGtCQUFBLElBQUEsV0FBQSxLQUFBO0FBQUEsSUFBZ0M7QUFHbEMsVUFBQSxNQUFBLG9CQUFBLEdBQUE7QUFDQSxRQUFBLE9BQUEsTUFBQSxNQUFBLElBQUEsR0FBQTtBQUVBLFFBQUEsQ0FBQSxNQUFBO0FBQ0UsYUFBQTtBQUFBLFFBQU87QUFBQSxRQUNMLFNBQUEsb0JBQUEsSUFBQTtBQUFBLFFBQ29DLFlBQUE7QUFBQSxRQUN4QixRQUFBO0FBQUEsUUFDSixZQUFBO0FBQUEsTUFDSTtBQUVkLFlBQUEsTUFBQSxJQUFBLEtBQUEsSUFBQTtBQUFBLElBQXlCO0FBRzNCLFNBQUEsUUFBQSxJQUFBLEdBQUE7QUFDQSxrQkFBQSxJQUFBLEtBQUEsS0FBQTtBQUNBLGlCQUFBLElBQUEsS0FBQSxJQUFBO0FBRUEsbUJBQUEsS0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLHVCQUFBLEtBQUE7QUFDRSxRQUFBLFFBQUEsY0FBQSxJQUFBLEdBQUE7QUFDQSxRQUFBLENBQUEsT0FBQTtBQUNFLDJCQUFBLEdBQUE7QUFDQSxjQUFBLGNBQUEsSUFBQSxHQUFBLEtBQUE7QUFBQSxJQUFrQztBQUVwQyxXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsc0JBQUEsTUFBQTtBQUNFLFVBQUEsaUJBQUEsS0FBQSxRQUFBLHFCQUFBLElBQUEsQ0FBQSxJQUFBLElBQUEsTUFBQSxLQUFBLEtBQUEsaUJBQUEscUJBQUEsQ0FBQTtBQUlBLG1CQUFBLFFBQUEsQ0FBQSxRQUFBO0FBQ0UsWUFBQSxRQUFBLGNBQUEsSUFBQSxHQUFBO0FBQ0EsWUFBQSxPQUFBLGFBQUEsSUFBQSxHQUFBO0FBQ0EsVUFBQSxDQUFBLFNBQUEsQ0FBQSxLQUFBO0FBRUEsV0FBQSxRQUFBLE9BQUEsR0FBQTtBQUNBLG9CQUFBLE9BQUEsR0FBQTtBQUNBLG1CQUFBLE9BQUEsR0FBQTtBQUVBLFVBQUEsS0FBQSxRQUFBLFNBQUEsR0FBQTtBQUNFLGNBQUEsTUFBQSxPQUFBLEtBQUEsR0FBQTtBQUFBLE1BQTJCO0FBRzdCLHFCQUFBLEtBQUE7QUFBQSxJQUFvQixDQUFBO0FBQUEsRUFFeEI7QUFPQSxXQUFBLGNBQUEsS0FBQTtBQUNFLFVBQUEsT0FBQSxJQUFBLFFBQUEsY0FBQTtBQUNBLFFBQUEsS0FBQSxRQUFBO0FBRUEsVUFBQSxPQUFBLElBQUEsUUFBQSxNQUFBLEtBQUEsSUFBQSxRQUFBLGtCQUFBO0FBR0EsUUFBQSxLQUFBLFFBQUE7QUFFQSxXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsb0JBQUEsS0FBQTtBQUNFLFVBQUEsS0FBQSxJQUFBO0FBQ0EsVUFBQSxNQUFBLEdBQUEsVUFBQTtBQUVBLFFBQUEsS0FBQTtBQUNFLFlBQUEsVUFBQSxJQUFBLE1BQUEsdUJBQUEsS0FBQSxJQUFBLE1BQUEsK0NBQUE7QUFJQSxVQUFBLFdBQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxlQUFBLFlBQUEsUUFBQSxDQUFBLENBQUE7QUFBQSxNQUE2QjtBQUcvQixVQUFBO0FBQ0UsY0FBQSxJQUFBLElBQUEsSUFBQSxHQUFBO0FBQ0EsVUFBQSxhQUFBLE9BQUEsVUFBQTtBQUNBLFVBQUEsYUFBQSxPQUFBLEdBQUE7QUFDQSxVQUFBLGFBQUEsT0FBQSxJQUFBO0FBQ0EsZUFBQSxFQUFBLFNBQUE7QUFBQSxNQUFrQixRQUFBO0FBRWxCLGVBQUE7QUFBQSxNQUFPO0FBQUEsSUFDVDtBQUdGLFFBQUEsR0FBQSxTQUFBO0FBQ0UsYUFBQSxHQUFBLEdBQUEsT0FBQSxLQUFBLEdBQUEsVUFBQSxFQUFBO0FBQUEsSUFBd0M7QUFHMUMsV0FBQSxPQUFBLEtBQUEsT0FBQSxFQUFBLFNBQUEsRUFBQSxFQUFBLE1BQUEsQ0FBQSxDQUFBO0FBQUEsRUFDRjtBQU1BLFdBQUEsaUJBQUEsTUFBQTtBQUNFLFFBQUEsS0FBQSxRQUFBLFNBQUEsRUFBQSxRQUFBO0FBRUEsUUFBQSxpQkFBQTtBQUNBLFFBQUEsV0FBQTtBQUVBLGVBQUEsT0FBQSxLQUFBLFNBQUE7QUFDRSxVQUFBLENBQUEsSUFBQSxZQUFBO0FBQ0EsVUFBQSxDQUFBLFNBQUEsWUFBQTtBQUdBLFVBQUEsQ0FBQSxJQUFBLGFBQUE7QUFFQSxVQUFBLENBQUEsZ0JBQUE7QUFDRSx5QkFBQTtBQUNBO0FBQUEsTUFBQTtBQUdGLFlBQUEsTUFBQSxlQUFBLHdCQUFBLEdBQUE7QUFDQSxVQUFBLE1BQUEsS0FBQSw2QkFBQTtBQUNFLHlCQUFBO0FBQUEsTUFBaUI7QUFBQSxJQUNuQjtBQUdGLFdBQUEsa0JBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxxQkFBQSxNQUFBO0FBQ0UsUUFBQSxLQUFBLFFBQUEsUUFBQSxFQUFBO0FBRUEsVUFBQSxVQUFBLGlCQUFBLElBQUE7QUFDQSxRQUFBLENBQUEsUUFBQTtBQUVBLGVBQUEsT0FBQSxLQUFBLFNBQUE7QUFDRSxVQUFBLENBQUEsSUFBQSxZQUFBO0FBRUEsVUFBQSxRQUFBLFNBQUE7QUFDRSxZQUFBLE1BQUEsZUFBQSxTQUFBO0FBQ0EsWUFBQSxNQUFBLGVBQUEsWUFBQTtBQUNBLFlBQUEsTUFBQSxlQUFBLGdCQUFBO0FBQUEsTUFBeUMsT0FBQTtBQUV6QyxZQUFBLE1BQUEsWUFBQSxXQUFBLFFBQUEsV0FBQTtBQUNBLFlBQUEsTUFBQSxZQUFBLGtCQUFBLFFBQUEsV0FBQTtBQUFBLE1BQTJEO0FBQUEsSUFDN0Q7QUFBQSxFQUVKO0FBTUEsV0FBQSxlQUFBLE9BQUE7QUFDRSxnQkFBQSxJQUFBLEtBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxrQkFBQTtBQUNFLFFBQUEsaUJBQUE7QUFDQSx1QkFBQTtBQUNBLDBCQUFBLE1BQUE7QUFDRSx5QkFBQTtBQUNBLGtCQUFBLFFBQUEsZ0JBQUE7QUFDQSxrQkFBQSxNQUFBO0FBQUEsSUFBa0IsQ0FBQTtBQUFBLEVBRXRCO0FBTUEsV0FBQSxpQkFBQSxPQUFBO0FBRUUsZUFBQSxDQUFBLEtBQUEsSUFBQSxLQUFBLE1BQUEsS0FBQSxNQUFBLE1BQUEsUUFBQSxDQUFBLEdBQUE7QUFDRSxpQkFBQSxRQUFBLE1BQUEsS0FBQSxLQUFBLE9BQUEsR0FBQTtBQUNFLFlBQUEsQ0FBQSxLQUFBLGFBQUE7QUFDRSxlQUFBLFFBQUEsT0FBQSxJQUFBO0FBQ0Esd0JBQUEsT0FBQSxJQUFBO0FBQ0EsdUJBQUEsT0FBQSxJQUFBO0FBQUEsUUFBdUI7QUFBQSxNQUN6QjtBQUdGLFVBQUEsS0FBQSxRQUFBLFNBQUEsR0FBQTtBQUNFLGNBQUEsTUFBQSxPQUFBLEdBQUE7QUFDQTtBQUFBLE1BQUE7QUFHRiwyQkFBQSxJQUFBO0FBQUEsSUFBeUI7QUFHM0IsVUFBQSxhQUFBLE1BQUEsTUFBQTtBQUdBLFFBQUEsYUFBQSw0QkFBQTtBQUNFLFVBQUEsTUFBQSxrQkFBQSxNQUFBLGVBQUEsYUFBQTtBQUNFLGNBQUEsZUFBQSxPQUFBO0FBQUEsTUFBNEI7QUFFOUIsWUFBQSxpQkFBQTtBQUNBLFlBQUEsWUFBQTtBQUNBLFlBQUEsU0FBQTtBQUNBLFVBQUEsTUFBQSxrQkFBQSxNQUFBO0FBQ0UsZUFBQSxhQUFBLE1BQUEsY0FBQTtBQUNBLGNBQUEsaUJBQUE7QUFBQSxNQUF1QjtBQUV6QjtBQUFBLElBQUE7QUFHRixVQUFBLE1BQUEsd0JBQUEsS0FBQTtBQUlBLFFBQUEsYUFBQTtBQUNBLFFBQUEsU0FBQTtBQUNBLFFBQUEsYUFBQTtBQUVBLGVBQUEsUUFBQSxNQUFBLE1BQUEsT0FBQSxHQUFBO0FBQ0UsVUFBQSxjQUFBLEtBQUE7QUFDQSxVQUFBLFlBQUEsS0FBQTtBQUNBLFVBQUEsY0FBQSxLQUFBO0FBRUEsaUJBQUEsS0FBQSxLQUFBLFNBQUE7QUFDRSxZQUFBLENBQUEsRUFBQSxZQUFBO0FBQ0EsY0FBQSxNQUFBLEVBQUE7QUFDQSxjQUFBLEtBQUEsRUFBQTtBQUVBLGNBQUEsWUFBQSxJQUFBLFNBQUEsYUFBQSxLQUFBLElBQUEsU0FBQSxZQUFBO0FBRUEsY0FBQSxZQUFBLElBQUEsU0FBQSxhQUFBLEtBQUEsR0FBQSxlQUFBO0FBRUEsY0FBQSxVQUFBLElBQUEsU0FBQSxXQUFBO0FBRUEsWUFBQSxVQUFBLGVBQUE7QUFDQSxZQUFBLFVBQUEsZUFBQTtBQUNBLFlBQUEsUUFBQSxhQUFBO0FBQUEsTUFBeUI7QUFHM0IsV0FBQSxhQUFBO0FBQ0EsV0FBQSxhQUFBO0FBQ0EsV0FBQSxTQUFBLENBQUEsS0FBQSxjQUFBO0FBRUEsVUFBQSxLQUFBLFdBQUE7QUFBQSxlQUFxQixLQUFBLFdBQUE7QUFBQSxlQUNLLEtBQUEsT0FBQTtBQUFBLElBQ0o7QUFHeEIsVUFBQSxTQUFBLGFBQUE7QUFHQSxRQUFBLE1BQUEsVUFBQSxNQUFBLGtCQUFBLE1BQUE7QUFDRSxhQUFBLGFBQUEsTUFBQSxjQUFBO0FBQ0EsWUFBQSxpQkFBQTtBQUFBLElBQXVCO0FBR3pCLFVBQUEsV0FBQSxJQUFBLGNBQUEsd0JBQUE7QUFDQSxVQUFBLFVBQUEsSUFBQSxjQUFBLHVCQUFBO0FBQ0EsUUFBQSxDQUFBLFlBQUEsQ0FBQSxRQUFBO0FBRUEsVUFBQSxjQUFBLGVBQUEsS0FBQSxXQUFBLEtBQUEsZUFBQTtBQUNBLFVBQUEsZUFBQSxlQUFBLGNBQUEsV0FBQSxLQUFBLGFBQUE7QUFFQSxVQUFBLGVBQUEsYUFBQSxXQUFBLGNBQUEsZUFBQSxLQUFBLGFBQUE7QUFJQSxRQUFBLENBQUEsTUFBQSxhQUFBLENBQUEsYUFBQTtBQUNFLFlBQUEsWUFBQTtBQUFBLElBQWtCO0FBR3BCLFFBQUEsVUFBQSxPQUFBLG1CQUFBLGVBQUE7QUFHQSxRQUFBLENBQUEsTUFBQSxhQUFBLGFBQUE7QUFDRSxZQUFBLFlBQUEsTUFBQSxhQUFBLENBQUE7QUFDQSxZQUFBLFNBQUE7QUFDQSxVQUFBLFdBQUE7QUFDQSxlQUFBLGNBQUEsRUFBQSxhQUFBLEtBQUE7QUFDQSxjQUFBLGNBQUEsR0FBQSxVQUFBO0FBQ0Esd0JBQUEsS0FBQSxDQUFBO0FBQ0E7QUFBQSxJQUFBO0FBSUYsUUFBQSxXQUFBO0FBRUEsUUFBQTtBQUNBLFFBQUE7QUFDQSxRQUFBLGdCQUFBLGFBQUEsSUFBQSxhQUFBLGFBQUE7QUFFQSxRQUFBLGNBQUE7QUFDRSxpQkFBQSxFQUFBLFlBQUEsS0FBQTtBQUNBLGdCQUFBLEdBQUEsVUFBQSxNQUFBLFVBQUE7QUFDQSxVQUFBLFVBQUEsSUFBQSxpQkFBQTtBQUNBLHNCQUFBO0FBQ0EseUJBQUEsS0FBQTtBQUFBLElBQXdCLFdBQUEsZ0JBQUEsU0FBQSxHQUFBO0FBRXhCLFVBQUEsZUFBQSxHQUFBO0FBQ0UsbUJBQUEsRUFBQSxPQUFBLEtBQUE7QUFDQSxrQkFBQSxHQUFBLE1BQUE7QUFDQSxZQUFBLFVBQUEsSUFBQSxlQUFBO0FBQ0Esd0JBQUE7QUFBQSxNQUFn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
downloadall;