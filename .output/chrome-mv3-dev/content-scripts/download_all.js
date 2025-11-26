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
        // watch per-file status
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
      let someSuccess = false;
      let someError = false;
      let someLoading = false;
      for (const b of file.buttons) {
        if (!b.isConnected) continue;
        const cls = b.classList;
        const isLoading = cls.contains("cqd-loading") || cls.contains("cqd-trying");
        const isSuccess = cls.contains("cqd-success") || b.dataset.cqdAllDone === "true";
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
      markGroupDirty(group);
      scheduleRefresh();
    }, GROUP_FEEDBACK_SUCCESS_MS);
  }
  function ensureDownloadAllButton(group) {
    const existing = group.downloadAllBtn;
    if (existing && existing.isConnected) return existing;
    const root = group.root;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-all-btn";
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
    const computed = window.getComputedStyle(root);
    if (computed.position === "static") {
      root.style.position = "relative";
    }
    root.style.setProperty("overflow", "visible", "important");
    root.style.setProperty("contain", "none", "important");
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleDownloadAllClick(group);
    });
    root.appendChild(button);
    group.downloadAllBtn = button;
    return button;
  }
  function handleDownloadAllClick(group) {
    if (group.isBusy || group.activated) return;
    group.activated = true;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG93bmxvYWRfYWxsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaWNvbnMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaTE4bi50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9kb3dubG9hZF9hbGwuY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcblxuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuY29uc3QgVFJBTlNJVElPTl9NUyA9IDE1MDtcbmNvbnN0IFRSQU5TSVRJT05fU1RSID0gYCR7VFJBTlNJVElPTl9NU31tcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKWA7XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIDpyb290IHtcbiAgICAgIC0tY3FkLXRyYW5zaXRpb246ICR7VFJBTlNJVElPTl9TVFJ9O1xuXG4gICAgICAvKiBTcGlubmVyICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmO1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAoTGlnaHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA1REQ3O1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDkzLCAyMTUsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgOTMsIDIxNSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0VDNjMwMDtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERVxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC10aGVtZS1kYXJrIHtcbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gKFNpbmdsZSlcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDAuOTcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIHtcbiAgICAgIHdpZHRoOiAxNDBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3M6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA4cHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAuY3FkLXNwaW5uZXIge1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIHdpZHRoOiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGhlaWdodDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBib3JkZXI6IDNweCBzb2xpZCB2YXIoLS1jcWQtc3Bpbm5lci1ib3JkZXIpO1xuICAgICAgYm9yZGVyLXRvcC1jb2xvcjogdmFyKC0tY3FkLXNwaW5uZXItdG9wKTtcbiAgICAgIGFuaW1hdGlvbjogY3FkLXNwaW4gMC42NXMgbGluZWFyIGluZmluaXRlO1xuICAgIH1cblxuICAgIEBrZXlmcmFtZXMgY3FkLXNwaW4ge1xuICAgICAgZnJvbSB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9XG4gICAgICB0byB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH1cbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVFMgJiBFRElURUQgKE92ZXJsYXkpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWNvbW1lbnQpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjogaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDApIGludmVydCgxKTtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01cHgpO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIuY3FkLWVkaXRlZCB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMCwgMjE0LCAyMzgsIDAuMyk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZWRpdGVkKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIGRpdltkYXRhLXN0cmVhbS1pdGVtLWlkXVtkYXRhLWNxZC1wcm9jZXNzZWRdW2RhdGEtY3FkLWVkaXRlZC1wcm9jZXNzZWRdID4gLmNxZC1vdmVybGF5LWNvbnRhaW5lciB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiA3MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogI0ZGNDAzNjtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYm9yZGVyOiAxcHggc29saWQgcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgcGFkZGluZy10b3A6IDhweDtcbiAgICAgIHRyYW5zaXRpb246IGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1zZWN0aW9uIHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1pY29uIHtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbi1lZGl0ZWQgc3ZnIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgc3Ryb2tlOiBjdXJyZW50Q29sb3I7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OIChIZWFkZXItYWxpZ25lZClcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIHtcbiAgLyogUHJvZ3Jlc3MgY29udHJvbCAoMCUgdG8gMTAwJSkgKi9cbiAgLS1jcWQtcHJvZ3Jlc3M6IDAlO1xuXG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcblxuICAvKiBQb3NpdGlvbiBpbnNpZGUgdGhlIHBvc3QgY2FyZCwgbmVhciB0aGUgMy1kb3RzICovXG4gIHRvcDogMTJweDsgICAgICAgLyogPOKAlCBrZXkgY2hhbmdlOiBzbWFsbCBwb3NpdGl2ZSBvZmZzZXQgKi9cbiAgcmlnaHQ6IDQ4cHg7XG4gIHotaW5kZXg6IDY7XG5cbiAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICBwYWRkaW5nOiA0cHggMTJweDtcbiAgYm9yZGVyOiBub25lO1xuICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG5cbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLW5vcm1hbCk7XG4gIGNvbG9yOiAjZmZmZmZmO1xuICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG5cbiAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gIGZvbnQtc2l6ZTogMTJweDtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgY3Vyc29yOiBwb2ludGVyO1xuICBnYXA6IDZweDtcbiAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgb3ZlcmZsb3c6IGhpZGRlbjtcblxuICB0cmFuc2l0aW9uOlxuICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlLFxuICAgIHRyYW5zZm9ybSAwLjFzIGVhc2UsXG4gICAgYmFja2dyb3VuZC1jb2xvciAwLjNzIGVhc2U7XG5cbiAgdHJhbnNmb3JtOiB0cmFuc2xhdGVaKDApO1xufVxuXG5ib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWRvd25sb2FkLWFsbC1idG4ge1xuICByaWdodDogYXV0bztcbiAgbGVmdDogNDhweDtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuOmhvdmVyIHtcbiAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG4gIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMXB4KTtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuOmFjdGl2ZSB7XG4gIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbn1cblxuLyogS2VlcCBwb2ludGVyIGN1cnNvciBldmVuIHdoaWxlIGRpc2FibGVkICh5b3UgYWxyZWFkeSB3YW50ZWQgdGhpcyBiZWhhdmlvcikgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bltkaXNhYmxlZF0ge1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG5cbi8qIEZVTEwgU1VDQ0VTUyBTVEFURSAoU29saWQgR3JlZW4pICovXG4uY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1zdWNjZXNzIHtcbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXN1Y2Nlc3MpO1xuICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4uY3FkLWFsbC1lcnJvciB7XG4gIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1lcnJvcik7XG4gIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xufVxuXG4vKiBQUk9HUkVTUyBCQVIgT1ZFUkxBWSAoRmlsbHMgdXApICovXG4uY3FkLWRvd25sb2FkLWFsbC1idG46OmFmdGVyIHtcbiAgY29udGVudDogJyc7XG4gIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgdG9wOiAwO1xuICBsZWZ0OiAwO1xuICBib3R0b206IDA7XG4gIHotaW5kZXg6IDA7XG5cbiAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXN1Y2Nlc3MpO1xuXG4gIC8qIFdpZHRoIGNvbnRyb2xsZWQgYnkgSlMgKi9cbiAgd2lkdGg6IHZhcigtLWNxZC1wcm9ncmVzcyk7XG4gIHRyYW5zaXRpb246IHdpZHRoIDAuM3MgY3ViaWMtYmV6aWVyKDAuMjIsIDAuNjEsIDAuMzYsIDEpO1xuXG4gIG9wYWNpdHk6IDE7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0bi5jcWQtYWxsLXN1Y2Nlc3M6OmFmdGVyIHtcbiAgb3BhY2l0eTogMDtcbn1cblxuLyogQ29udGVudCBsYXllcnMgKi9cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1tYWluLFxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1Yixcbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXIge1xuICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIHotaW5kZXg6IDI7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXIge1xuICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gIGZsZXgtc2hyaW5rOiAwO1xufVxuXG4uY3FkLWRvd25sb2FkLWFsbC1idG4gLmNxZC1kb3dubG9hZC1hbGwtaWNvbiB7XG4gIHdpZHRoOiAxOHB4O1xuICBoZWlnaHQ6IDE4cHg7XG4gIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICBiYWNrZ3JvdW5kLXNpemU6IDE4cHggMThweDtcbiAgZmxleC1zaHJpbms6IDA7XG59XG5cbi5jcWQtZG93bmxvYWQtYWxsLWJ0biAuY3FkLWRvd25sb2FkLWFsbC1tYWluIHtcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbn1cblxuLmNxZC1kb3dubG9hZC1hbGwtYnRuIC5jcWQtZG93bmxvYWQtYWxsLXN1YiB7XG4gIGZvbnQtc2l6ZTogMTFweDtcbiAgb3BhY2l0eTogMC45O1xuICBtYXJnaW4tbGVmdDogNHB4O1xufVxuXG4gIGAudHJpbSgpO1xuXG4gIChkb2N1bWVudC5oZWFkIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkuYXBwZW5kQ2hpbGQoc3R5bGUpO1xufVxuIiwiY29uc3QgVFJBTlNMQVRJT05TOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICBlbjoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnRG93bmxvYWRpbmfigKYnLFxuICAgIHRyeWluZzogJ1RyeWluZ+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rvd25sb2FkZWQnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0Rvd25sb2FkIGZhaWxlZC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJyxcbiAgICB0aXRsZVF1aWNrOiAnUXVpY2sgZG93bmxvYWQnLFxuICAgIGNvbW1lbnRzOiAnY29tbWVudHMnLFxuICAgIGVkaXRlZDogJ0VkaXRlZCcsXG4gICAgZG93bmxvYWRBbGw6ICdEb3dubG9hZCBhbGwnLFxuICB9LFxuICBhcjoge1xuICAgIGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsXG4gICAgZG93bmxvYWRpbmc6ICfYrNin2LHZiiDYp9mE2KrZhtiy2YrZhOKApicsXG4gICAgdHJ5aW5nOiAn2YXYrdin2YjZhNip4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsXG4gICAgZXJyb3I6ICfYrti32KMnLFxuICAgIGZhaWxlZDogJ9mB2LTZhCDYp9mE2KrZhtiy2YrZhC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLFxuICAgIHRpdGxlUXVpY2s6ICfYqtmG2LLZitmEINiz2LHZiti5JyxcbiAgICBjb21tZW50czogJ9iq2LnZhNmK2YLYp9iqJyxcbiAgICBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyxcbiAgICBkb3dubG9hZEFsbDogJ9iq2YbYstmK2YQg2KfZhNmD2YQnLFxuICB9LFxuICBqYToge1xuICAgIGRvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJyxcbiAgICBkb3dubG9hZGluZzogJ0RM5Lit4oCmJyxcbiAgICB0cnlpbmc6ICfoqabooYzkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflrozkuoYnLFxuICAgIGVycm9yOiAn44Ko44Op44O8JyxcbiAgICBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLFxuICAgIGFyaWFEb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsXG4gICAgdGl0bGVRdWljazogJ+OCr+OCpOODg+OCr+ODgOOCpuODs+ODreODvOODiScsXG4gICAgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLFxuICAgIGVkaXRlZDogJ+e3qOmbhua4iOOBvycsXG4gIH0sXG4gIGVzOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLFxuICAgIHRyeWluZzogJ0ludGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJyxcbiAgICBlcnJvcjogJ0Vycm9yJyxcbiAgICBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgaGk6IHtcbiAgICBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKHgpL/gpILgpJfigKYnLFxuICAgIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JyxcbiAgICBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsXG4gICAgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgcHQ6IHtcbiAgICBkb3dubG9hZDogJ0JhaXhhcicsXG4gICAgZG93bmxvYWRpbmc6ICdCYWl4YW5kb+KApicsXG4gICAgdHJ5aW5nOiAnVGVudGFuZG/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCYWl4YWRvJyxcbiAgICBlcnJvcjogJ0Vycm8nLFxuICAgIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0JhaXhhcicsXG4gICAgdGl0bGVRdWljazogJ0Rvd25sb2FkIHLDoXBpZG8nLFxuICAgIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgJ3B0LXB0Jzoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FycmVnYXInLFxuICAgIGRvd25sb2FkaW5nOiAnQSBkZXNjYXJyZWdhcuKApicsXG4gICAgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsXG4gICAgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJyxcbiAgICBlZGl0ZWQ6ICdFZGl0YWRvJyxcbiAgfSxcbiAgJ3poLWNuJzoge1xuICAgIGRvd25sb2FkOiAn5LiL6L29JyxcbiAgICBkb3dubG9hZGluZzogJ+S4i+i9veS4reKApicsXG4gICAgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn5bey5LiL6L29JyxcbiAgICBlcnJvcjogJ+mUmeivrycsXG4gICAgZmFpbGVkOiAn5LiL6L295aSx6LSlJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfkuIvovb0nLFxuICAgIHRpdGxlUXVpY2s6ICflv6vpgJ/kuIvovb0nLFxuICAgIGNvbW1lbnRzOiAn5p2h6K+E6K66JyxcbiAgICBlZGl0ZWQ6ICflt7LnvJbovpEnLFxuICB9LFxuICAnemgtdHcnOiB7XG4gICAgZG93bmxvYWQ6ICfkuIvovIknLFxuICAgIGRvd25sb2FkaW5nOiAn5LiL6LyJ5Lit4oCmJyxcbiAgICB0cnlpbmc6ICflmJfoqabkuK3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICflt7LkuIvovIknLFxuICAgIGVycm9yOiAn6Yyv6KqkJyxcbiAgICBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLFxuICAgIGFyaWFEb3dubG9hZDogJ+S4i+i8iScsXG4gICAgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i8iScsXG4gICAgY29tbWVudHM6ICfliYfnlZnoqIAnLFxuICAgIGVkaXRlZDogJ+W3sue3qOi8rycsXG4gIH0sXG4gIGZyOiB7XG4gICAgZG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJyxcbiAgICBkb3dubG9hZGluZzogJ1TDqWzDqWNoYXJnZW1lbnTigKYnLFxuICAgIHRyeWluZzogJ0Vzc2Fp4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVMOpbMOpY2hhcmfDqScsXG4gICAgZXJyb3I6ICdFcnJldXInLFxuICAgIGZhaWxlZDogJ8OJY2hlYy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLFxuICAgIHRpdGxlUXVpY2s6ICdUw6lsw6ljaGFyZ2VtZW50IHJhcGlkZScsXG4gICAgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLFxuICAgIGVkaXRlZDogJ01vZGlmacOpJyxcbiAgfSxcbiAgZGU6IHtcbiAgICBkb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLFxuICAgIGRvd25sb2FkaW5nOiAnTGFkZW7igKYnLFxuICAgIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0ZlcnRpZycsXG4gICAgZXJyb3I6ICdGZWhsZXInLFxuICAgIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsXG4gICAgYXJpYURvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsXG4gICAgdGl0bGVRdWljazogJ1NjaG5lbGxlciBEb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdLb21tZW50YXJlJyxcbiAgICBlZGl0ZWQ6ICdCZWFyYmVpdGV0JyxcbiAgfSxcbiAgaXQ6IHtcbiAgICBkb3dubG9hZDogJ1NjYXJpY2EnLFxuICAgIGRvd25sb2FkaW5nOiAnU2NhcmljYW1lbnRv4oCmJyxcbiAgICB0cnlpbmc6ICdQcm92YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ1NjYXJpY2F0bycsXG4gICAgZXJyb3I6ICdFcnJvcmUnLFxuICAgIGZhaWxlZDogJ0ZhbGxpdG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTY2FyaWNhJyxcbiAgICB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcmFwaWRvJyxcbiAgICBjb21tZW50czogJ2NvbW1lbnRpJyxcbiAgICBlZGl0ZWQ6ICdNb2RpZmljYXRvJyxcbiAgfSxcbiAgcnU6IHtcbiAgICBkb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJyxcbiAgICBkb3dubG9hZGluZzogJ9Ch0LrQsNGH0LjQstCw0L3QuNC14oCmJyxcbiAgICB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9Ch0LrQsNGH0LDQvdC+JyxcbiAgICBlcnJvcjogJ9Ce0YjQuNCx0LrQsCcsXG4gICAgZmFpbGVkOiAn0KHQsdC+0LkuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YvRgdGC0YDQvtC1INGB0LrQsNGH0LjQstCw0L3QuNC1JyxcbiAgICBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsXG4gICAgZWRpdGVkOiAn0JjQt9C80LXQvdC10L3QvicsXG4gIH0sXG4gIGtvOiB7XG4gICAgZG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLFxuICAgIGRvd25sb2FkaW5nOiAn64uk7Jq066Gc65OcIOykkeKApicsXG4gICAgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsXG4gICAgZG93bmxvYWRlZDogJ+yZhOujjCcsXG4gICAgZXJyb3I6ICfsmKTrpZgnLFxuICAgIGZhaWxlZDogJ+yLpO2MqO2VqCcsXG4gICAgYXJpYURvd25sb2FkOiAn64uk7Jq066Gc65OcJyxcbiAgICB0aXRsZVF1aWNrOiAn67mg66W4IOuLpOyatOuhnOuTnCcsXG4gICAgY29tbWVudHM6ICfqsJwg64yT6riAJyxcbiAgICBlZGl0ZWQ6ICfsiJjsoJXrkKgnLFxuICB9LFxuICB0cjoge1xuICAgIGRvd25sb2FkOiAnxLBuZGlyJyxcbiAgICBkb3dubG9hZGluZzogJ8SwbmRpcmlsaXlvcuKApicsXG4gICAgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnxLBuZGlyaWxkaScsXG4gICAgZXJyb3I6ICdIYXRhJyxcbiAgICBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfEsG5kaXInLFxuICAgIHRpdGxlUXVpY2s6ICdIxLF6bMSxIGluZGlyJyxcbiAgICBjb21tZW50czogJ3lvcnVtJyxcbiAgICBlZGl0ZWQ6ICdEw7x6ZW5sZW5kaScsXG4gIH0sXG4gIHZpOiB7XG4gICAgZG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJyxcbiAgICBkb3dubG9hZGluZzogJ8SQYW5nIHThuqNp4oCmJyxcbiAgICB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsXG4gICAgZG93bmxvYWRlZDogJ8SQw6MgdOG6o2knLFxuICAgIGVycm9yOiAnTOG7l2knLFxuICAgIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLFxuICAgIHRpdGxlUXVpY2s6ICdU4bqjaSB4deG7kW5nIG5oYW5oJyxcbiAgICBjb21tZW50czogJ25o4bqtbiB4w6l0JyxcbiAgICBlZGl0ZWQ6ICfEkMOjIGNo4buJbmggc+G7rWEnLFxuICB9LFxuICBpZDoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTWVuZ3VuZHVo4oCmJyxcbiAgICB0cnlpbmc6ICdNZW5jb2Jh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2VsZXNhaScsXG4gICAgZXJyb3I6ICdLZXNhbGFoYW4nLFxuICAgIGZhaWxlZDogJ0dhZ2FsLicsXG4gICAgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdEb3dubG9hZCBjZXBhdCcsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcicsXG4gICAgZWRpdGVkOiAnRGllZGl0JyxcbiAgfSxcbiAgdGg6IHtcbiAgICBkb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsXG4gICAgZG93bmxvYWRpbmc6ICfguIHguLPguKXguLHguIfguYLguKvguKXguJTigKYnLFxuICAgIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsXG4gICAgZG93bmxvYWRlZDogJ+C5gOC4quC4o+C5h+C4iOC4quC4tOC5ieC4mScsXG4gICAgZXJyb3I6ICfguILguYnguK3guJzguLTguJTguJ7guKXguLLguJQnLFxuICAgIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsXG4gICAgYXJpYURvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJyxcbiAgICB0aXRsZVF1aWNrOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiU4LiU4LmI4Lin4LiZJyxcbiAgICBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsXG4gICAgZWRpdGVkOiAn4LmB4LiB4LmJ4LmE4LiC4LmB4Lil4LmJ4LinJyxcbiAgfSxcbiAgcGw6IHtcbiAgICBkb3dubG9hZDogJ1BvYmllcnonLFxuICAgIGRvd25sb2FkaW5nOiAnUG9iaWVyYW5pZeKApicsXG4gICAgdHJ5aW5nOiAnUHLDs2Jh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnUG9icmFubycsXG4gICAgZXJyb3I6ICdCxYLEhWQnLFxuICAgIGZhaWxlZDogJ05pZXVkYW5lLicsXG4gICAgYXJpYURvd25sb2FkOiAnUG9iaWVyeicsXG4gICAgdGl0bGVRdWljazogJ1N6eWJraWUgcG9iaWVyYW5pZScsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcnplJyxcbiAgICBlZGl0ZWQ6ICdFZHl0b3dhbm8nLFxuICB9LFxuICBubDoge1xuICAgIGRvd25sb2FkOiAnRG93bmxvYWRlbicsXG4gICAgZG93bmxvYWRpbmc6ICdEb3dubG9hZGVu4oCmJyxcbiAgICB0cnlpbmc6ICdQcm9iZXJlbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYWFyJyxcbiAgICBlcnJvcjogJ0ZvdXQnLFxuICAgIGZhaWxlZDogJ01pc2x1a3QuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZGVuJyxcbiAgICB0aXRsZVF1aWNrOiAnU25lbCBkb3dubG9hZGVuJyxcbiAgICBjb21tZW50czogJ3JlYWN0aWVzJyxcbiAgICBlZGl0ZWQ6ICdCZXdlcmt0JyxcbiAgfSxcbiAgYm46IHtcbiAgICBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgprLgp4vgpqEg4Ka54Kaa4KeN4Kab4KeH4oCmJyxcbiAgICB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ka44Kau4KeN4Kaq4Kao4KeN4KaoJyxcbiAgICBlcnJvcjogJ+CmpOCnjeCmsOCngeCmn+CmvycsXG4gICAgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsXG4gICAgYXJpYURvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kam4KeN4Kaw4KeB4KakIOCmoeCmvuCmieCmqOCmsuCni+CmoScsXG4gICAgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJyxcbiAgICBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnLFxuICB9LFxuICBwYToge1xuICAgIGRvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICBkb3dubG9hZGluZzogJ+CooeCovuCoieCoqOCosuCpi+CooSDgqLngqYsg4Kiw4Ki/4Ki54Ki+4oCmJyxcbiAgICB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Kiu4KmB4KiV4Kmw4Kiu4KiyJyxcbiAgICBlcnJvcjogJ+Col+CosuCopOCpgCcsXG4gICAgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgqKTgqYfgqJzgqLwg4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJyxcbiAgICBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsXG4gICAgZWRpdGVkOiAn4Ki44Kmw4Kiq4Ki+4Kim4Ki/4KikJyxcbiAgfSxcbiAgdGU6IHtcbiAgICBkb3dubG9hZDogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgZG93bmxvYWRpbmc6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0g4LCF4LC14LGB4LCk4LGL4LCC4LCm4LC/4oCmJyxcbiAgICB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgsKrgsYLgsLDgsY3gsKTgsK/gsL/gsILgsKbgsL8nLFxuICAgIGVycm9yOiAn4LCy4LGL4LCq4LCCJyxcbiAgICBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsXG4gICAgdGl0bGVRdWljazogJ+CwpOCxjeCwteCwsOCwv+CwpCDgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLFxuICAgIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJyxcbiAgICBlZGl0ZWQ6ICfgsLjgsLXgsLDgsL/gsILgsJrgsKzgsKHgsL/gsILgsKbgsL8nLFxuICB9LFxuICBtcjoge1xuICAgIGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoSDgpLngpYvgpKQg4KSG4KS54KWH4oCmJyxcbiAgICB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsXG4gICAgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpYAnLFxuICAgIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsXG4gICAgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICB0aXRsZVF1aWNrOiAn4KSk4KWN4KS14KSw4KS/4KSkIOCkoeCkvuCkieCkqOCksuCli+CkoScsXG4gICAgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLFxuICAgIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcsXG4gIH0sXG4gIHRhOiB7XG4gICAgZG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLFxuICAgIGRvd25sb2FkaW5nOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K6q4K+N4K6q4K6f4K+B4K6V4K6/4K6x4K6k4K+B4oCmJyxcbiAgICB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgrq7gr4Hgrp/grr/grqjgr43grqTgrqTgr4EnLFxuICAgIGVycm9yOiAn4K6q4K6/4K604K+IJyxcbiAgICBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLFxuICAgIGFyaWFEb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsXG4gICAgdGl0bGVRdWljazogJ+CuteCuv+CusOCviOCuteCvgSDgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrq7gr40nLFxuICAgIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJyxcbiAgICBlZGl0ZWQ6ICfgrqTgrr/grrDgr4HgrqTgr43grqTgrqrgr43grqrgrp/gr43grp/grqTgr4EnLFxuICB9LFxuICB1cjoge1xuICAgIGRvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJyxcbiAgICBkb3dubG9hZGluZzogJ9qI2KfYpNmGINmE2YjaiCDbgdmIINix24HYpyDbgduS4oCmJyxcbiAgICB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsXG4gICAgZG93bmxvYWRlZDogJ9mF2qnZhdmEJyxcbiAgICBlcnJvcjogJ9i62YTYt9uMJyxcbiAgICBmYWlsZWQ6ICfZhtin2qnYp9mFJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLFxuICAgIHRpdGxlUXVpY2s6ICfZgdmI2LHbjCDaiNin2KTZhiDZhNmI2ognLFxuICAgIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsXG4gICAgZWRpdGVkOiAn2KrYsdmF24zZhSDYtNiv24EnLFxuICB9LFxuICBndToge1xuICAgIGRvd25sb2FkOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICBkb3dubG9hZGluZzogJ+CqoeCqvuCqieCqqOCqsuCri+CqoSDgqqXgqogg4Kqw4Kq54KuN4Kqv4KuB4KqCIOCqm+Crh+KApicsXG4gICAgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsXG4gICAgZG93bmxvYWRlZDogJ+CqquCrguCqsOCrjeCqoycsXG4gICAgZXJyb3I6ICfgqq3gq4LgqrInLFxuICAgIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsXG4gICAgYXJpYURvd25sb2FkOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kqd4Kqh4Kqq4KuAIOCqoeCqvuCqieCqqOCqsuCri+CqoScsXG4gICAgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLFxuICAgIGVkaXRlZDogJ+CquOCqguCqquCqvuCqpuCqv+CqpCcsXG4gIH0sXG4gIGtuOiB7XG4gICAgZG93bmxvYWQ6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIGRvd25sb2FkaW5nOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONIOCyhuCyl+CzgeCypOCzjeCypOCyv+CypuCzhuKApicsXG4gICAgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4LKq4LOC4LKw4LON4LKj4LKX4LOK4LKC4LKh4LK/4LKm4LOGJyxcbiAgICBlcnJvcjogJ+CypuCzi+CytycsXG4gICAgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLFxuICAgIHRpdGxlUXVpY2s6ICfgsqTgs43gsrXgsrDgsr/gsqQg4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJyxcbiAgICBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsXG4gICAgZWRpdGVkOiAn4LK44LKC4LKq4LK+4LKm4LK/4LK44LKy4LK+4LKX4LK/4LKm4LOGJyxcbiAgfSxcbiAgbWw6IHtcbiAgICBkb3dubG9hZDogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgZG93bmxvYWRpbmc6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0g4LSa4LWG4LSv4LWN4LSv4LWB4LSo4LWN4LSo4LWB4oCmJyxcbiAgICB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfgtKrgtYLgtbzgtKTgtY3gtKTgtL/gtK/gtL7gtK/gtL8nLFxuICAgIGVycm9yOiAn4LSq4LS/4LS24LSV4LWNJyxcbiAgICBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLFxuICAgIGFyaWFEb3dubG9hZDogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jScsXG4gICAgdGl0bGVRdWljazogJ+C0teC1h+C0l+C0pOC1jeC0pOC0v+C1vSDgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLFxuICAgIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JyxcbiAgICBlZGl0ZWQ6ICfgtI7gtKHgtL/gtLHgtY3gtLHgtYHgtJrgtYbgtK/gtY3gtKTgtYEnLFxuICB9LFxuICB1azoge1xuICAgIGRvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQl9Cw0LLQsNC90YLQsNC20LXQvdC90Y/igKYnLFxuICAgIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsXG4gICAgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsXG4gICAgZXJyb3I6ICfQn9C+0LzQuNC70LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0KjQstC40LTQutC1INC30LDQstCw0L3RgtCw0LbQtdC90L3RjycsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsXG4gICAgZWRpdGVkOiAn0JfQvNGW0L3QtdC90L4nLFxuICB9LFxuICBlbDoge1xuICAgIGRvd25sb2FkOiAnzpvOrs+IzrcnLFxuICAgIGRvd25sb2FkaW5nOiAnzpvOrs+IzrfigKYnLFxuICAgIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnzp/Ou86/zrrOu863z4HPjs64zrfOus61JyxcbiAgICBlcnJvcjogJ86jz4bOrM67zrzOsScsXG4gICAgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfOm86uz4jOtycsXG4gICAgdGl0bGVRdWljazogJ86Tz4HOrs6zzr/Pgc63IM67zq7PiM63JyxcbiAgICBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsXG4gICAgZWRpdGVkOiAnzpXPgM61zr7Otc+BzrPOsc+DzrzOrc69zr8nLFxuICB9LFxuICBjczoge1xuICAgIGRvd25sb2FkOiAnU3TDoWhub3V0JyxcbiAgICBkb3dubG9hZGluZzogJ1N0YWhvdsOhbsOt4oCmJyxcbiAgICB0cnlpbmc6ICdaa291xaHDrW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdTdGHFvmVubycsXG4gICAgZXJyb3I6ICdDaHliYScsXG4gICAgZmFpbGVkOiAnU2VsaGFsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1N0w6Fobm91dCcsXG4gICAgdGl0bGVRdWljazogJ1J5Y2hsw6kgc3Rhxb5lbsOtJyxcbiAgICBjb21tZW50czogJ2tvbWVudMOhxZnFrycsXG4gICAgZWRpdGVkOiAnVXByYXZlbm8nLFxuICB9LFxuICBybzoge1xuICAgIGRvd25sb2FkOiAnRGVzY8SDcmNhyJtpJyxcbiAgICBkb3dubG9hZGluZzogJ1NlIGRlc2NhcmPEg+KApicsXG4gICAgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsXG4gICAgZG93bmxvYWRlZDogJ0ZpbmFsaXphdCcsXG4gICAgZXJyb3I6ICdFcm9hcmUnLFxuICAgIGZhaWxlZDogJ0XImXVhdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsXG4gICAgdGl0bGVRdWljazogJ0Rlc2PEg3JjYXJlIHJhcGlkxIMnLFxuICAgIGNvbW1lbnRzOiAnY29tZW50YXJpaScsXG4gICAgZWRpdGVkOiAnTW9kaWZpY2F0JyxcbiAgfSxcbiAgaHU6IHtcbiAgICBkb3dubG9hZDogJ0xldMO2bHTDqXMnLFxuICAgIGRvd25sb2FkaW5nOiAnTGV0w7ZsdMOpc+KApicsXG4gICAgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLw6lzeicsXG4gICAgZXJyb3I6ICdIaWJhJyxcbiAgICBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGV0w7ZsdMOpcycsXG4gICAgdGl0bGVRdWljazogJ0d5b3JzIGxldMO2bHTDqXMnLFxuICAgIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLFxuICAgIGVkaXRlZDogJ1N6ZXJrZXN6dHZlJyxcbiAgfSxcbiAgc3Y6IHtcbiAgICBkb3dubG9hZDogJ0xhZGRhIG5lcicsXG4gICAgZG93bmxvYWRpbmc6ICdMYWRkYXIgbmVy4oCmJyxcbiAgICB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnS2xhcnQnLFxuICAgIGVycm9yOiAnRmVsJyxcbiAgICBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYWRkYSBuZXInLFxuICAgIHRpdGxlUXVpY2s6ICdTbmFiYiBuZWRsYWRkbmluZycsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcmFkJyxcbiAgfSxcbiAgZGE6IHtcbiAgICBkb3dubG9hZDogJ0hlbnQnLFxuICAgIGRvd25sb2FkaW5nOiAnSGVudGVy4oCmJyxcbiAgICB0cnlpbmc6ICdQcsO4dmVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnSGVudGV0JyxcbiAgICBlcnJvcjogJ0ZlamwnLFxuICAgIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsXG4gICAgYXJpYURvd25sb2FkOiAnSGVudCcsXG4gICAgdGl0bGVRdWljazogJ0h1cnRpZyBkb3dubG9hZCcsXG4gICAgY29tbWVudHM6ICdrb21tZW50YXJlcicsXG4gICAgZWRpdGVkOiAnUmVkaWdlcmV0JyxcbiAgfSxcbiAgZmk6IHtcbiAgICBkb3dubG9hZDogJ0xhdGFhJyxcbiAgICBkb3dubG9hZGluZzogJ0xhZGF0YWFu4oCmJyxcbiAgICB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsXG4gICAgZG93bmxvYWRlZDogJ0xhZGF0dHUnLFxuICAgIGVycm9yOiAnVmlyaGUnLFxuICAgIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhdGFhJyxcbiAgICB0aXRsZVF1aWNrOiAnUGlrYWxhdGF1cycsXG4gICAgY29tbWVudHM6ICdrb21tZW50dGlhJyxcbiAgICBlZGl0ZWQ6ICdNdW9rYXR0dScsXG4gIH0sXG4gIG5vOiB7XG4gICAgZG93bmxvYWQ6ICdMYXN0IG5lZCcsXG4gICAgZG93bmxvYWRpbmc6ICdMYXN0ZXIgbmVk4oCmJyxcbiAgICB0cnlpbmc6ICdQcsO4dmVy4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRmVyZGlnJyxcbiAgICBlcnJvcjogJ0ZlaWwnLFxuICAgIGZhaWxlZDogJ01pc2x5a3Rlcy4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhc3QgbmVkJyxcbiAgICB0aXRsZVF1aWNrOiAnUmFzayBuZWRsYXN0aW5nJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmVyJyxcbiAgICBlZGl0ZWQ6ICdSZWRpZ2VydCcsXG4gIH0sXG4gIGhlOiB7XG4gICAgZG93bmxvYWQ6ICfXlNeV16jXk9eUJyxcbiAgICBkb3dubG9hZGluZzogJ9ee15XXqNeZ15PigKYnLFxuICAgIHRyeWluZzogJ9ee16DXodeU4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn15TXldep15zXnScsXG4gICAgZXJyb3I6ICfXqdeS15nXkNeUJyxcbiAgICBmYWlsZWQ6ICfXoNeb16nXnCcsXG4gICAgYXJpYURvd25sb2FkOiAn15TXldeo15PXlCcsXG4gICAgdGl0bGVRdWljazogJ9eU15XXqNeT15Qg157XlNeZ16jXlCcsXG4gICAgY29tbWVudHM6ICfXqteS15XXkdeV16onLFxuICAgIGVkaXRlZDogJ9eg16LXqNeaJyxcbiAgfSxcbiAgZmE6IHtcbiAgICBkb3dubG9hZDogJ9iv2KfZhtmE2YjYrycsXG4gICAgZG93bmxvYWRpbmc6ICfYr9ix2K3Yp9mEINiv2KfZhtmE2YjYr+KApicsXG4gICAgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfYp9mG2KzYp9mFINi02K8nLFxuICAgIGVycm9yOiAn2K7Yt9inJyxcbiAgICBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLFxuICAgIGFyaWFEb3dubG9hZDogJ9iv2KfZhtmE2YjYrycsXG4gICAgdGl0bGVRdWljazogJ9iv2KfZhtmE2YjYryDYs9ix24zYuScsXG4gICAgY29tbWVudHM6ICfZhti42LEnLFxuICAgIGVkaXRlZDogJ9mI24zYsdin24zYtCDYtNiv2YcnLFxuICB9LFxuICBmaWw6IHtcbiAgICBkb3dubG9hZDogJ0ktZG93bmxvYWQnLFxuICAgIGRvd25sb2FkaW5nOiAnTmFnZGEtZG93bmxvYWTigKYnLFxuICAgIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVGFwb3MgbmEnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ05hYmlnby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0ktZG93bmxvYWQnLFxuICAgIHRpdGxlUXVpY2s6ICdNYWJpbGlzIG5hIGRvd25sb2FkJyxcbiAgICBjb21tZW50czogJ21nYSBrb21lbnRvJyxcbiAgICBlZGl0ZWQ6ICdOYS1lZGl0JyxcbiAgfSxcbiAgbXM6IHtcbiAgICBkb3dubG9hZDogJ011YXQgdHVydW4nLFxuICAgIGRvd25sb2FkaW5nOiAnTWVtdWF0IHR1cnVu4oCmJyxcbiAgICB0cnlpbmc6ICdNZW5jdWJh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnU2VsZXNhaScsXG4gICAgZXJyb3I6ICdSYWxhdCcsXG4gICAgZmFpbGVkOiAnR2FnYWwuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdNdWF0IHR1cnVuJyxcbiAgICB0aXRsZVF1aWNrOiAnTXVhdCB0dXJ1biBwYW50YXMnLFxuICAgIGNvbW1lbnRzOiAna29tZW4nLFxuICAgIGVkaXRlZDogJ0RpZWRpdCcsXG4gIH0sXG4gIHNyOiB7XG4gICAgZG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQn9GA0LXRg9C30LjQvNCw0ZrQteKApicsXG4gICAgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JfQsNCy0YDRiNC10L3QvicsXG4gICAgZXJyb3I6ICfQk9GA0LXRiNC60LAnLFxuICAgIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JyxcbiAgICB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10YPQt9C40LzQsNGa0LUnLFxuICAgIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJyxcbiAgICBlZGl0ZWQ6ICfQmNC30LzQtdGa0LXQvdC+JyxcbiAgfSxcbiAgc2s6IHtcbiAgICBkb3dubG9hZDogJ1N0aWFobnXFpScsXG4gICAgZG93bmxvYWRpbmc6ICdTxaVhaG92YW5pZeKApicsXG4gICAgdHJ5aW5nOiAnU2vDusWhYW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdIb3Rvdm8nLFxuICAgIGVycm9yOiAnQ2h5YmEnLFxuICAgIGZhaWxlZDogJ1pseWhhbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTdGlhaG51xaUnLFxuICAgIHRpdGxlUXVpY2s6ICdSw71jaGxlIHN0aWFobnV0aWUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLFxuICAgIGVkaXRlZDogJ1VwcmF2ZW7DqScsXG4gIH0sXG4gIGJnOiB7XG4gICAgZG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsXG4gICAgZG93bmxvYWRpbmc6ICfQmNC30YLQtdCz0LvRj9C90LXigKYnLFxuICAgIHRyeWluZzogJ9Ce0L/QuNGC4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JyxcbiAgICBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsXG4gICAgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsXG4gICAgYXJpYURvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLFxuICAgIHRpdGxlUXVpY2s6ICfQkdGK0YDQt9C+INC40LfRgtC10LPQu9GP0L3QtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLFxuICAgIGVkaXRlZDogJ9Cg0LXQtNCw0LrRgtC40YDQsNC90L4nLFxuICB9LFxuICBocjoge1xuICAgIGRvd25sb2FkOiAnUHJldXptaScsXG4gICAgZG93bmxvYWRpbmc6ICdQcmV1emltYW5qZeKApicsXG4gICAgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsXG4gICAgZG93bmxvYWRlZDogJ0dvdG92bycsXG4gICAgZXJyb3I6ICdHcmXFoWthJyxcbiAgICBmYWlsZWQ6ICdOZXVzcGplbG8uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdQcmV1em1pJyxcbiAgICB0aXRsZVF1aWNrOiAnQnJ6byBwcmV1emltYW5qZScsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmEnLFxuICAgIGVkaXRlZDogJ1VyZcSRZW5vJyxcbiAgfSxcbiAgbHQ6IHtcbiAgICBkb3dubG9hZDogJ0F0c2lzacWzc3RpJyxcbiAgICBkb3dubG9hZGluZzogJ1NpdW7EjWlhbWHigKYnLFxuICAgIHRyeWluZzogJ0JhbmRvbWHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdCYWlndGEnLFxuICAgIGVycm9yOiAnS2xhaWRhJyxcbiAgICBmYWlsZWQ6ICdOZXBhdnlrby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0F0c2lzacWzc3RpJyxcbiAgICB0aXRsZVF1aWNrOiAnR3JlaXRhcyBhdHNpc2l1bnRpbWFzJyxcbiAgICBjb21tZW50czogJ2tvbWVudGFyYWknLFxuICAgIGVkaXRlZDogJ1JlZGFndW90YScsXG4gIH0sXG4gIGx2OiB7XG4gICAgZG93bmxvYWQ6ICdMZWp1cGllbMSBZMSTdCcsXG4gICAgZG93bmxvYWRpbmc6ICdMZWp1cGllbMSBZMST4oCmJyxcbiAgICB0cnlpbmc6ICdNxJPEo2luYeKApicsXG4gICAgZG93bmxvYWRlZDogJ1BhYmVpZ3RzJyxcbiAgICBlcnJvcjogJ0vEvMWrZGEnLFxuICAgIGZhaWxlZDogJ05laXpkZXbEgXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMZWp1cGllbMSBZMSTdCcsXG4gICAgdGl0bGVRdWljazogJ8SAdHLEgSBsZWp1cGllbMSBZGUnLFxuICAgIGNvbW1lbnRzOiAna29tZW50xIFyaScsXG4gICAgZWRpdGVkOiAnUmVkacSjxJN0cycsXG4gIH0sXG4gIGV0OiB7XG4gICAgZG93bmxvYWQ6ICdMYWFkaSBhbGxhJyxcbiAgICBkb3dubG9hZGluZzogJ0xhYWRpbWluZeKApicsXG4gICAgdHJ5aW5nOiAnUHJvb3ZpbuKApicsXG4gICAgZG93bmxvYWRlZDogJ1ZhbG1pcycsXG4gICAgZXJyb3I6ICdWaWdhJyxcbiAgICBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdMYWFkaSBhbGxhJyxcbiAgICB0aXRsZVF1aWNrOiAnS2lpcmUgYWxsYWxhYWRpbWluZScsXG4gICAgY29tbWVudHM6ICdrb21tZW50YWFyaScsXG4gICAgZWRpdGVkOiAnTXV1ZGV0dWQnLFxuICB9LFxuICBzbDoge1xuICAgIGRvd25sb2FkOiAnUHJlbm9zJyxcbiAgICBkb3dubG9hZGluZzogJ1ByZW5hxaFhbmpl4oCmJyxcbiAgICB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLFxuICAgIGRvd25sb2FkZWQ6ICdLb27EjWFubycsXG4gICAgZXJyb3I6ICdOYXBha2EnLFxuICAgIGZhaWxlZDogJ05pIHVzcGVsby4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1ByZW5vcycsXG4gICAgdGl0bGVRdWljazogJ0hpdGVyIHByZW5vcycsXG4gICAgY29tbWVudHM6ICdrb21lbnRhcmpldicsXG4gICAgZWRpdGVkOiAnVXJlamVubycsXG4gIH0sXG4gIGNhOiB7XG4gICAgZG93bmxvYWQ6ICdEZXNjYXJyZWdhJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcnJlZ2FudOKApicsXG4gICAgdHJ5aW5nOiAnSW50ZW50YW504oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRGVzY2FycmVnYXQnLFxuICAgIGVycm9yOiAnRXJyb3InLFxuICAgIGZhaWxlZDogJ0hhIGZhbGxhdC4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNjw6BycmVnYSByw6BwaWRhJyxcbiAgICBjb21tZW50czogJ2NvbWVudGFyaXMnLFxuICAgIGVkaXRlZDogJ0VkaXRhdCcsXG4gIH0sXG4gIGFmOiB7XG4gICAgZG93bmxvYWQ6ICdBZmxhYWknLFxuICAgIGRvd25sb2FkaW5nOiAnTGFhaSBhZuKApicsXG4gICAgdHJ5aW5nOiAnUHJvYmVlcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0tsYWFyJyxcbiAgICBlcnJvcjogJ0ZvdXQnLFxuICAgIGZhaWxlZDogJ01pc2x1ay4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0FmbGFhaScsXG4gICAgdGl0bGVRdWljazogJ1Zpbm5pZ2UgYWZsYWFpJyxcbiAgICBjb21tZW50czogJ2tvbW1lbnRhcmUnLFxuICAgIGVkaXRlZDogJ0dlcmVkaWdlZXInLFxuICB9LFxuICBhbToge1xuICAgIGRvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JyxcbiAgICBkb3dubG9hZGluZzogJ+GJoOGIm+GLjeGIqOGLtSDhiIvhi63igKYnLFxuICAgIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhi4jhiK3hi7fhiI0nLFxuICAgIGVycm9yOiAn4Yi14YiF4Ymw4Ym1JyxcbiAgICBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLFxuICAgIGFyaWFEb3dubG9hZDogJ+GKoOGLjeGIreGLtScsXG4gICAgdGl0bGVRdWljazogJ+GNiOGMo+GKlSDhiJvhi43hiKjhi7UnLFxuICAgIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JyxcbiAgICBlZGl0ZWQ6ICfhibDhiLXhibDhiqvhiq3hiI/hiI0nLFxuICB9LFxuICBoeToge1xuICAgIGRvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJyxcbiAgICBkb3dubG9hZGluZzogJ9WG1aXWgNWi1aXVvNW21bjWgtW04oCmJyxcbiAgICB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsXG4gICAgZG93bmxvYWRlZDogJ9Sx1b7VodaA1b/VvtWh1a4nLFxuICAgIGVycm9yOiAn1Y3VrdWh1awnLFxuICAgIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JyxcbiAgICBhcmlhRG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLFxuICAgIHRpdGxlUXVpY2s6ICfUsdaA1aHVoyDVttWl1oDVotWl1bzVttW41oLVtCcsXG4gICAgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLFxuICAgIGVkaXRlZDogJ9S91bTVotWh1aPWgNW+1aXVrCDVpycsXG4gIH0sXG4gIGFzOiB7XG4gICAgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLFxuICAgIGRvd25sb2FkaW5nOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahIOCmueCniCDgpobgppvgp4figKYnLFxuICAgIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ka44Kau4KeN4Kaq4KeC4Kew4KeN4KajJyxcbiAgICBlcnJvcjogJ+CmpOCnjeCnsOCngeCmn+CmvycsXG4gICAgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJyxcbiAgICB0aXRsZVF1aWNrOiAn4Kam4KeN4Kew4KeB4KakIOCmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsXG4gICAgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLFxuICAgIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcsXG4gIH0sXG4gIGF6OiB7XG4gICAgZG93bmxvYWQ6ICdZw7xrbMmZJyxcbiAgICBkb3dubG9hZGluZzogJ1nDvGtsyZluaXLigKYnLFxuICAgIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsXG4gICAgZG93bmxvYWRlZDogJ0JpdGRpJyxcbiAgICBlcnJvcjogJ1jJmXRhJyxcbiAgICBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsXG4gICAgYXJpYURvd25sb2FkOiAnWcO8a2zJmScsXG4gICAgdGl0bGVRdWljazogJ1PDvHLJmXRsaSB5w7xrbMmZbcmZJyxcbiAgICBjb21tZW50czogJ8WfyZlyaCcsXG4gICAgZWRpdGVkOiAnRMO8esmZbGnFnyBlZGlsaWInLFxuICB9LFxuICBldToge1xuICAgIGRvd25sb2FkOiAnRGVza2FyZ2F0dScsXG4gICAgZG93bmxvYWRpbmc6ICdEZXNrYXJnYXR6ZW7igKYnLFxuICAgIHRyeWluZzogJ1NhaWF0emVu4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnRWdpbmRhJyxcbiAgICBlcnJvcjogJ0Vycm9yZWEnLFxuICAgIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0Rlc2thcmdhdHUnLFxuICAgIHRpdGxlUXVpY2s6ICdEZXNrYXJnYSBhemthcnJhJyxcbiAgICBjb21tZW50czogJ2lydXpraW4nLFxuICAgIGVkaXRlZDogJ0VkaXRhdHVhJyxcbiAgfSxcbiAgbXk6IHtcbiAgICBkb3dubG9hZDogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgZG93bmxvYWRpbmc6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLog4YCc4YCv4YCV4YC64YCU4YCx4oCmJyxcbiAgICB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhgJXhgLzhgK7hgLjhgJXhgKvhgJXhgLzhgK4nLFxuICAgIGVycm9yOiAn4YCh4YCZ4YC+4YCs4YC4JyxcbiAgICBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLFxuICAgIGFyaWFEb3dubG9hZDogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsXG4gICAgdGl0bGVRdWljazogJ+GAoeGAmeGAvOGAlOGAuiDhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLFxuICAgIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JyxcbiAgICBlZGl0ZWQ6ICfhgJXhgLzhgIThgLrhgIbhgIThgLrhgJXhgLzhgK7hgLgnLFxuICB9LFxuICBnbDoge1xuICAgIGRvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICBkb3dubG9hZGluZzogJ0Rlc2NhcmdhbmRv4oCmJyxcbiAgICB0cnlpbmc6ICdUZW50YW5kb+KApicsXG4gICAgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLFxuICAgIGVycm9yOiAnRXJybycsXG4gICAgZmFpbGVkOiAnRmFsbG91LicsXG4gICAgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJyxcbiAgICB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsXG4gICAgY29tbWVudHM6ICdjb21lbnRhcmlvcycsXG4gICAgZWRpdGVkOiAnRWRpdGFkbycsXG4gIH0sXG4gIGthOiB7XG4gICAgZG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLFxuICAgIGRvd25sb2FkaW5nOiAn4YOY4YOs4YOU4YOg4YOU4YOR4YOQ4oCmJyxcbiAgICB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfhg5Phg5Dhg6Hhg6Dhg6Phg5rhg5Phg5AnLFxuICAgIGVycm9yOiAn4YOo4YOU4YOq4YOT4YOd4YOb4YOQJyxcbiAgICBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsXG4gICAgYXJpYURvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJyxcbiAgICB0aXRsZVF1aWNrOiAn4YOh4YOs4YOg4YOQ4YOk4YOYIOGDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsXG4gICAgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLFxuICAgIGVkaXRlZDogJ+GDoOGDlOGDk+GDkOGDpeGDouGDmOGDoOGDlOGDkeGDo+GDmuGDmOGDkCcsXG4gIH0sXG4gIGlzOiB7XG4gICAgZG93bmxvYWQ6ICdTw6ZramEnLFxuICAgIGRvd25sb2FkaW5nOiAnU8Oma2ly4oCmJyxcbiAgICB0cnlpbmc6ICdSZXluaeKApicsXG4gICAgZG93bmxvYWRlZDogJ1PDs3R0JyxcbiAgICBlcnJvcjogJ1ZpbGxhJyxcbiAgICBmYWlsZWQ6ICdNaXN0w7Nrc3QuJyxcbiAgICBhcmlhRG93bmxvYWQ6ICdTw6ZramEnLFxuICAgIHRpdGxlUXVpY2s6ICdGbMO9dGluacOwdXJoYWwnLFxuICAgIGNvbW1lbnRzOiAndW1tw6ZsaScsXG4gICAgZWRpdGVkOiAnQnJleXR0JyxcbiAgfSxcbiAgZ2E6IHtcbiAgICBkb3dubG9hZDogJ8ONb3Nsw7Nkw6FpbCcsXG4gICAgZG93bmxvYWRpbmc6ICdBZyDDrW9zbMOzZMOhaWzigKYnLFxuICAgIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnw41vc2zDs2TDoWlsdGUnLFxuICAgIGVycm9yOiAnRWFycsOhaWQnLFxuICAgIGZhaWxlZDogJ1RoZWlwIGFpci4nLFxuICAgIGFyaWFEb3dubG9hZDogJ8ONb3Nsw7Nkw6FpbCcsXG4gICAgdGl0bGVRdWljazogJ8ONb3Nsw7Nkw6FpbCB0YXBhJyxcbiAgICBjb21tZW50czogJ3Ryw6FjaHQnLFxuICAgIGVkaXRlZDogJ0VhZ3JhaXRoZScsXG4gIH0sXG4gIGtrOiB7XG4gICAgZG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJyxcbiAgICBkb3dubG9hZGluZzogJ9CW0q/QutGC0LXQu9GD0LTQteKApicsXG4gICAgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0JDRj9Kb0YLQsNC70LTRiycsXG4gICAgZXJyb3I6ICfSmtCw0YLQtScsXG4gICAgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsXG4gICAgYXJpYURvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsXG4gICAgdGl0bGVRdWljazogJ9CW0YvQu9C00LDQvCDQttKv0LrRgtC10YMnLFxuICAgIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsXG4gICAgZWRpdGVkOiAn06jQt9Cz0LXRgNGC0ZbQu9C00ZYnLFxuICB9LFxuICBrbToge1xuICAgIGRvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJyxcbiAgICBkb3dubG9hZGluZzogJ+GegOGfhuGeluGeu+GehOGekeGetuGeieGemeGegOKApicsXG4gICAgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Z6U4Z624Z6T4Z6U4Z6J4Z+S4Z6F4Z6U4Z+LJyxcbiAgICBlcnJvcjogJ+GegOGfhuGeoOGeu+GenycsXG4gICAgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLFxuICAgIHRpdGxlUXVpY2s6ICfhnpHhnrbhnonhnpnhnoDhnpvhnr/hnpMnLFxuICAgIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JyxcbiAgICBlZGl0ZWQ6ICfhnpThnrbhnpPhnoDhn4Lhnp/hnpjhn5Lhnprhnr3hnpsnLFxuICB9LFxuICBsbzoge1xuICAgIGRvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJyxcbiAgICBkb3dubG9hZGluZzogJ+C6geC6s+C6peC6seC6h+C6lOC6suC6p+C7guC6q+C6peC6lOKApicsXG4gICAgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Lqq4Lqz4LuA4Lql4Lqx4LqUJyxcbiAgICBlcnJvcjogJ+C6nOC6tOC6lOC6nuC6suC6lCcsXG4gICAgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLFxuICAgIHRpdGxlUXVpY2s6ICfgupTgurLguqfgu4LguqvguqXgupTgupTgu4jguqfgupknLFxuICAgIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJyxcbiAgICBlZGl0ZWQ6ICfgu4HguoHgu4ngu4TguoLgu4HguqXgu4nguqcnLFxuICB9LFxuICBtazoge1xuICAgIGRvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLFxuICAgIGRvd25sb2FkaW5nOiAn0J/RgNC10LfQtdC80LDRmtC14oCmJyxcbiAgICB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLFxuICAgIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLFxuICAgIGVycm9yOiAn0JPRgNC10YjQutCwJyxcbiAgICBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsXG4gICAgdGl0bGVRdWljazogJ9CR0YDQt9C+INC/0YDQtdC30LXQvNCw0ZrQtScsXG4gICAgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLFxuICAgIGVkaXRlZDogJ9CY0LfQvNC10L3QtdGC0L4nLFxuICB9LFxuICBtbjoge1xuICAgIGRvd25sb2FkOiAn0KLQsNGC0LDRhScsXG4gICAgZG93bmxvYWRpbmc6ICfQotCw0YLQsNC2INCx0LDQudC90LDigKYnLFxuICAgIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn0KLQsNGC0YHQsNC9JyxcbiAgICBlcnJvcjogJ9CQ0LvQtNCw0LAnLFxuICAgIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ9Ci0LDRgtCw0YUnLFxuICAgIHRpdGxlUXVpY2s6ICfQpdGD0YDQtNCw0L0g0YLQsNGC0LDRhScsXG4gICAgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLFxuICAgIGVkaXRlZDogJ9CX0LDRgdGB0LDQvScsXG4gIH0sXG4gIG5lOiB7XG4gICAgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueClgeCkgeCkpuCliOKApicsXG4gICAgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsXG4gICAgZG93bmxvYWRlZDogJ+CkquClguCksOCkviDgpK3gpK/gpYsnLFxuICAgIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JyxcbiAgICBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJyxcbiAgICBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLFxuICAgIHRpdGxlUXVpY2s6ICfgpJvgpL/gpJ/gpYsg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJyxcbiAgICBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsXG4gICAgZWRpdGVkOiAn4KS44KSu4KWN4KSq4KS+4KSm4KS/4KSkJyxcbiAgfSxcbiAgb3I6IHtcbiAgICBkb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgZG93bmxvYWRpbmc6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0g4Ky54K2H4KyJ4Kyb4Ky/4oCmJyxcbiAgICB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJyxcbiAgICBkb3dubG9hZGVkOiAn4Ky44Kyu4K2N4Kyq4K2C4Kyw4K2N4Kyj4K2N4KyjJyxcbiAgICBlcnJvcjogJ+CspOCtjeCssOCtgeCsn+CsvycsXG4gICAgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsXG4gICAgYXJpYURvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJyxcbiAgICB0aXRsZVF1aWNrOiAn4Ky24K2A4KyY4K2N4KywIOCsoeCsvuCsieCsqOCssuCti+CsoeCtjScsXG4gICAgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLFxuICAgIGVkaXRlZDogJ+CsuOCsruCtjeCsquCsvuCspuCsv+CspCcsXG4gIH0sXG4gIHNpOiB7XG4gICAgZG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLFxuICAgIGRvd25sb2FkaW5nOiAn4La24LeP4Lac4LatIOC3gOC3meC2uOC3kuC2seC3iuKApicsXG4gICAgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsXG4gICAgZG93bmxvYWRlZDogJ+C2heC3gOC3g+C2seC3iicsXG4gICAgZXJyb3I6ICfgtq/gt53gt4Lgtrrgtprgt5InLFxuICAgIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsXG4gICAgYXJpYURvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJyxcbiAgICB0aXRsZVF1aWNrOiAn4LaJ4Laa4LeK4La44Lax4LeKIOC2tuC3j+C2nOC2rSDgtprgt5Lgtrvgt5PgtrgnLFxuICAgIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJyxcbiAgICBlZGl0ZWQ6ICfgt4PgtoLgt4Pgt4rgtprgtrvgtqvgtronLFxuICB9LFxuICBzdzoge1xuICAgIGRvd25sb2FkOiAnUGFrdWEnLFxuICAgIGRvd25sb2FkaW5nOiAnSW5hcGFrdWHigKYnLFxuICAgIHRyeWluZzogJ0luYWphcmlideKApicsXG4gICAgZG93bmxvYWRlZDogJ0ltZWthbWlsaWthJyxcbiAgICBlcnJvcjogJ0hpdGlsYWZ1JyxcbiAgICBmYWlsZWQ6ICdJbWVzaGluZHdhLicsXG4gICAgYXJpYURvd25sb2FkOiAnUGFrdWEnLFxuICAgIHRpdGxlUXVpY2s6ICdQYWt1YSBoYXJha2EnLFxuICAgIGNvbW1lbnRzOiAnbWFvbmknLFxuICAgIGVkaXRlZDogJ0ltZWhhcmlyaXdhJyxcbiAgfSxcbiAgdXo6IHtcbiAgICBkb3dubG9hZDogJ1l1a2xhc2gnLFxuICAgIGRvd25sb2FkaW5nOiAnWXVrbGFubW9xZGHigKYnLFxuICAgIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnVGF5eW9yJyxcbiAgICBlcnJvcjogJ1hhdG8nLFxuICAgIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1l1a2xhc2gnLFxuICAgIHRpdGxlUXVpY2s6ICdUZXogeXVrbGFzaCcsXG4gICAgY29tbWVudHM6ICdzaGFyaGxhcicsXG4gICAgZWRpdGVkOiAnVGFocmlybGFuZ2FuJyxcbiAgfSxcbiAgY3k6IHtcbiAgICBkb3dubG9hZDogJ0xhd3Jsd3l0aG8nLFxuICAgIGRvd25sb2FkaW5nOiAnWW4gbGF3cmx3eXRob+KApicsXG4gICAgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJyxcbiAgICBkb3dubG9hZGVkOiAnV2VkaSBnb3JmZmVuJyxcbiAgICBlcnJvcjogJ0d3YWxsJyxcbiAgICBmYWlsZWQ6ICdNZXRob2RkLicsXG4gICAgYXJpYURvd25sb2FkOiAnTGF3cmx3eXRobycsXG4gICAgdGl0bGVRdWljazogJ0xhd3Jsd3l0aG8gY3lmbHltJyxcbiAgICBjb21tZW50czogJ3N5bHdhZGF1JyxcbiAgICBlZGl0ZWQ6ICdHb2x5Z3d5ZCcsXG4gIH0sXG4gIHp1OiB7XG4gICAgZG93bmxvYWQ6ICdMYW5kYScsXG4gICAgZG93bmxvYWRpbmc6ICdJeWFsYW5kd2HigKYnLFxuICAgIHRyeWluZzogJ0l5YXphbWHigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdJbGFuZMSrd2UnLFxuICAgIGVycm9yOiAnSXBodXRoYScsXG4gICAgZmFpbGVkOiAnSWhsdWxla2lsZS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ0xhbmRhJyxcbiAgICB0aXRsZVF1aWNrOiAnVWt1bGFuZGEgb2t1c2hlc2hheW8nLFxuICAgIGNvbW1lbnRzOiAnYW1hendhbmEnLFxuICAgIGVkaXRlZDogJ0t1aGxlbGl3ZScsXG4gIH0sXG4gIHNxOiB7XG4gICAgZG93bmxvYWQ6ICdTaGthcmtvJyxcbiAgICBkb3dubG9hZGluZzogJ0R1a2Ugc2hrYXJrdWFy4oCmJyxcbiAgICB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLFxuICAgIGRvd25sb2FkZWQ6ICdQw6tyZnVuZG9pJyxcbiAgICBlcnJvcjogJ0dhYmltJyxcbiAgICBmYWlsZWQ6ICdEw6tzaHRvaS4nLFxuICAgIGFyaWFEb3dubG9hZDogJ1Noa2Fya28nLFxuICAgIHRpdGxlUXVpY2s6ICdTaGthcmtpbSBpIHNocGVqdMOrJyxcbiAgICBjb21tZW50czogJ2tvbWVudGUnLFxuICAgIGVkaXRlZDogJ0UgcmVkYWt0dWFyJyxcbiAgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJlxuICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmxhbmdcbiAgICApIHtcbiAgICAgIHJhd0xhbmcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci5sYW5ndWFnZSkge1xuICAgICAgcmF3TGFuZyA9IG5hdmlnYXRvci5sYW5ndWFnZTtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkTGFuZyA9IHJhd0xhbmdcbiAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAuc3BsaXQoJzsnKVswXVxuICAgICAgLnRyaW0oKVxuICAgICAgLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ10gJiZcbiAgICAgIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnXG4gICAgKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIFRSQU5TTEFUSU9OU1snZW4nXSAmJlxuICAgICAgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJ1xuICAgICkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG4gIH0gY2F0Y2gge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC90aGVtZS50c1xuXG4vKipcbiAqIFRIRU1FIERFVEVDVE9SXG4gKlxuICogR29hbDogXCJJcyB0aGUgY29udGVudCBJJ20gZHJhd2luZyBvbiB2aXN1YWxseSBkYXJrIG9yIGxpZ2h0P1wiXG4gKiBJbnN0ZWFkIG9mIGd1ZXNzaW5nIGZyb20gPGJvZHk+LCB3ZTpcbiAqICAtIFJlc3BlY3QgRGFyayBSZWFkZXIgaWYgcHJlc2VudFxuICogIC0gTG9vayBmb3Igb2J2aW91cyBcImRhcmsgbW9kZVwiIGNsYXNzZXNcbiAqICAtIE1lYXN1cmUgdGhlIGVmZmVjdGl2ZSBiYWNrZ3JvdW5kIGNvbG9yIG9mIGEgKmNvbnRlbnQqIGVsZW1lbnRcbiAqICAgIChlLmcuIEdvb2dsZSBDbGFzc3Jvb20gc3RyZWFtIGNhcmRzKVxuICovXG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBwYWdlICpjb250ZW50IGFyZWEqIGlzIHZpc3VhbGx5IGRhcmsuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1BhZ2VEYXJrKCk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIDEuIEZhc3QgcGF0aDogRGFyayBSZWFkZXIgYXR0cmlidXRlXG4gIGNvbnN0IGRyU2NoZW1lID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1kYXJrcmVhZGVyLXNjaGVtZScpO1xuICBpZiAoZHJTY2hlbWUgPT09ICdkYXJrJykgcmV0dXJuIHRydWU7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2xpZ2h0JykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIDIuIEhldXJpc3RpYzogb2J2aW91cyBcImRhcmsgbW9kZVwiIGNsYXNzZXMgb24gPGh0bWw+IC8gPGJvZHk+XG4gIC8vIChjb3ZlcnMgc29tZSBmcmFtZXdvcmtzIGFuZCBleHRlbnNpb25zKVxuICBjb25zdCBkYXJrVG9rZW5zID0gWydkYXJrJywgJ2RhcmstdGhlbWUnLCAndGhlbWUtZGFyaycsICduaWdodCcsICdnbTMtZGFyay10aGVtZSddO1xuICBjb25zdCBodG1sQ2xhc3MgPSAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgY29uc3QgYm9keUNsYXNzID0gKGRvY3VtZW50LmJvZHkuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBpZiAoZGFya1Rva2Vucy5zb21lKHRva2VuID0+IGh0bWxDbGFzcy5pbmNsdWRlcyh0b2tlbikgfHwgYm9keUNsYXNzLmluY2x1ZGVzKHRva2VuKSkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIDMuIFByb2JlIGEgKmNvbnRlbnQqIGVsZW1lbnQsIG5vdCB0aGUgd2hvbGUgcGFnZSBiYWNrZ3JvdW5kLlxuICAvLyAgICBGb3IgQ2xhc3Nyb29tLCBwb3N0cyBhcmUgdGhlIG1haW4gc3VyZmFjZSB3ZSBkcmF3IG9uLlxuICBjb25zdCBwcm9iZUVsID1cbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJykgfHxcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignW3JvbGU9XCJtYWluXCJdJykgfHxcbiAgICBkb2N1bWVudC5ib2R5O1xuXG4gIGNvbnN0IGJnQ29sb3IgPSBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3IocHJvYmVFbCk7XG4gIGNvbnN0IGJyaWdodG5lc3MgPSBwYXJzZUJyaWdodG5lc3MoYmdDb2xvcik7XG5cbiAgLy8gNC4gRGVjaWRlIHRocmVzaG9sZC5cbiAgLy8gICAgMTI4IGlzIFwiNTAlIGdyYXlcIiwgYnV0IHRoYXQgZmxpcHMgdG9vIGVhcmx5IG9uIHNsaWdodGx5IGdyYXkgVUlzLlxuICAvLyAgICBVc2UgYSBzdHJpY3RlciB0aHJlc2hvbGQgc28gd2Ugb25seSB0cmVhdCBjbGVhcmx5IGRhcmsgVUlzIGFzIGRhcmsuXG4gIHJldHVybiBicmlnaHRuZXNzIDwgMTA1O1xufVxuXG4vKipcbiAqIFdhbGtzIHVwIHRoZSBET00gZnJvbSBhIGdpdmVuIGVsZW1lbnQgdW50aWwgaXQgZmluZHMgYSBub24tdHJhbnNwYXJlbnQgYmFja2dyb3VuZCBjb2xvci5cbiAqIEZhbGxzIGJhY2sgdG8gPGh0bWw+IGFuZCBmaW5hbGx5IHRvIHB1cmUgd2hpdGUuXG4gKi9cbmZ1bmN0aW9uIGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihzdGFydDogSFRNTEVsZW1lbnQpOiBzdHJpbmcge1xuICBsZXQgZWw6IEhUTUxFbGVtZW50IHwgbnVsbCA9IHN0YXJ0O1xuXG4gIGNvbnN0IGlzVHJhbnNwYXJlbnQgPSAoYzogc3RyaW5nIHwgbnVsbCkgPT5cbiAgICAhYyB8fCBjID09PSAndHJhbnNwYXJlbnQnIHx8IGMgPT09ICdyZ2JhKDAsIDAsIDAsIDApJztcblxuICB3aGlsZSAoZWwpIHtcbiAgICBjb25zdCBzdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcbiAgICBjb25zdCBiZyA9IHN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgICBpZiAoIWlzVHJhbnNwYXJlbnQoYmcpKSByZXR1cm4gYmc7XG4gICAgZWwgPSBlbC5wYXJlbnRFbGVtZW50O1xuICB9XG5cbiAgLy8gVHJ5IDxodG1sPiBhcyBhIGxhc3QgcmVhbCBlbGVtZW50XG4gIGNvbnN0IGh0bWxTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCk7XG4gIGNvbnN0IGh0bWxCZyA9IGh0bWxTdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gIGlmICghaXNUcmFuc3BhcmVudChodG1sQmcpKSByZXR1cm4gaHRtbEJnO1xuXG4gIC8vIEFic29sdXRlIGZhbGxiYWNrOiBhc3N1bWUgd2hpdGVcbiAgcmV0dXJuICdyZ2IoMjU1LCAyNTUsIDI1NSknO1xufVxuXG4vKipcbiAqIEhlbHBlcjogQ2FsY3VsYXRlcyBicmlnaHRuZXNzICgwLTI1NSkgZnJvbSBhbiBSR0IoQSkgc3RyaW5nLlxuICogVXNlcyB0aGUgSFNQIGNvbG9yIGZvcm11bGE6IHNxcnQoMC4yOTkqUl4yICsgMC41ODcqR14yICsgMC4xMTQqQl4yKVxuICovXG5mdW5jdGlvbiBwYXJzZUJyaWdodG5lc3MocmdiU3RyaW5nOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCBtYXRjaCA9IHJnYlN0cmluZy5tYXRjaCgvKFxcZCspLFxccyooXFxkKyksXFxzKihcXGQrKS8pO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgLy8gSWYgd2UgY2FuJ3QgcGFyc2UgaXQsIGFzc3VtZSBicmlnaHQgc28gd2UgZG9uJ3QgYWNjaWRlbnRhbGx5IGZsaXAgdG8gZGFyayBtb2RlLlxuICAgIHJldHVybiAyNTU7XG4gIH1cblxuICBjb25zdCByID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgY29uc3QgZyA9IHBhcnNlSW50KG1hdGNoWzJdLCAxMCk7XG4gIGNvbnN0IGIgPSBwYXJzZUludChtYXRjaFszXSwgMTApO1xuXG4gIC8vIEhTUCBlcXVhdGlvbiBpcyBwZXJjZWl2ZWQgYnJpZ2h0bmVzc1xuICBjb25zdCBicmlnaHRuZXNzID0gTWF0aC5zcXJ0KFxuICAgIDAuMjk5ICogKHIgKiByKSArXG4gICAgMC41ODcgKiAoZyAqIGcpICtcbiAgICAwLjExNCAqIChiICogYilcbiAgKTtcblxuICByZXR1cm4gYnJpZ2h0bmVzcztcbn1cblxuLyoqXG4gKiBXYXRjaGVyOiBOb3RpZmllcyB5b3Ugd2hlbiB0aGUgdGhlbWUgbGlrZWx5IGNoYW5nZWQuXG4gKlxuICogWW91IGNhbiB1c2UgdGhpcyBpZiB5b3UgZXZlciB3YW50IHRvIGR5bmFtaWNhbGx5IHJlLXN0eWxlIHRoaW5nc1xuICogd2hlbiB0aGUgdXNlciAvIGV4dGVuc2lvbiB0b2dnbGVzIHRoZW1lLlxuICovXG5leHBvcnQgZnVuY3Rpb24gd2F0Y2hUaGVtZUNoYW5nZXMoY2FsbGJhY2s6IChpc0Rhcms6IGJvb2xlYW4pID0+IHZvaWQpOiBNdXRhdGlvbk9ic2VydmVyIHtcbiAgY29uc3QgaGFuZGxlciA9ICgpID0+IHtcbiAgICBjYWxsYmFjayhpc1BhZ2VEYXJrKCkpO1xuICB9O1xuXG4gIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoaGFuZGxlcik7XG5cbiAgLy8gV2F0Y2ggZm9yIGF0dHJpYnV0ZS9jbGFzcyBjaGFuZ2VzIG9uIDxodG1sPiBhbmQgPGJvZHk+XG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnZGF0YS1kYXJrcmVhZGVyLXNjaGVtZScsICdzdHlsZScsICdjbGFzcyddLFxuICB9KTtcblxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydzdHlsZScsICdjbGFzcyddLFxuICB9KTtcblxuICAvLyBBbHNvIGxpc3RlbiB0byBzeXN0ZW0gdGhlbWUgY2hhbmdlcyBhcyBhIGJhY2t1cCBzaWduYWxcbiAgaWYgKHR5cGVvZiB3aW5kb3cubWF0Y2hNZWRpYSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNvbnN0IG1xID0gd2luZG93Lm1hdGNoTWVkaWEoJyhwcmVmZXJzLWNvbG9yLXNjaGVtZTogZGFyayknKTtcbiAgICBpZiAobXEpIHtcbiAgICAgIGNvbnN0IG1xTGlzdGVuZXIgPSAoKSA9PiBoYW5kbGVyKCk7XG4gICAgICAvLyBNb2Rlcm4gYnJvd3NlcnNcbiAgICAgIGlmICgobXEgYXMgYW55KS5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgIG1xLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIG1xTGlzdGVuZXIpO1xuICAgICAgfSBlbHNlIGlmICgobXEgYXMgYW55KS5hZGRMaXN0ZW5lcikge1xuICAgICAgICAvLyBMZWdhY3kgQVBJXG4gICAgICAgIChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKG1xTGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEluaXRpYWwgY2FsbCBzbyB0aGUgY29uc3VtZXIgY2FuIHN5bmMgaW1tZWRpYXRlbHlcbiAgaGFuZGxlcigpO1xuXG4gIHJldHVybiBvYnNlcnZlcjtcbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9kb3dubG9hZF9hbGwuY29udGVudC50c1xuXG5pbXBvcnQgeyBpbmplY3RTdHlsZXMgfSBmcm9tICcuL2NvbnRlbnQvc3R5bGVzJztcbmltcG9ydCB7IHQgfSBmcm9tICcuL2NvbnRlbnQvaTE4bic7XG5pbXBvcnQgeyBpc1BhZ2VEYXJrIH0gZnJvbSAnLi9jb250ZW50L3RoZW1lJztcblxuY29uc3QgRE9XTkxPQURfQlROX1NFTEVDVE9SID0gJy5jcWQtZG93bmxvYWQtYnRuJztcbmNvbnN0IEdST1VQX1NFTEVDVE9SID0gJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXSc7XG5jb25zdCBJTkpFQ1RFRF9BVFRSID0gJ2RhdGEtY3FkLWluamVjdGVkJztcblxuLy8gS2VlcCB0aGlzIGluIHN5bmMgd2l0aCBGRUVEQkFDS19TVUNDRVNTX01TIGluIGNvbnRlbnQvaW5kZXgudHNcbmNvbnN0IEdST1VQX0ZFRURCQUNLX1NVQ0NFU1NfTVMgPSAzMDAwO1xuXG50eXBlIEJ1dHRvblN0YXRlID0gJ2lkbGUnIHwgJ2xvYWRpbmcnIHwgJ3RyeWluZycgfCAnc3VjY2VzcycgfCAnZXJyb3InO1xuXG5pbnRlcmZhY2UgRmlsZUVudHJ5IHtcbiAga2V5OiBzdHJpbmc7XG4gIGJ1dHRvbnM6IFNldDxIVE1MQnV0dG9uRWxlbWVudD47XG4gIGRvd25sb2FkZWQ6IGJvb2xlYW47XG4gIGZhaWxlZDogYm9vbGVhbjtcbiAgaW5Qcm9ncmVzczogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIEdyb3VwU3RhdGUge1xuICByb290OiBIVE1MRWxlbWVudDtcbiAgZmlsZXM6IE1hcDxzdHJpbmcsIEZpbGVFbnRyeT47XG4gIGRvd25sb2FkQWxsQnRuOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGFjdGl2YXRlZDogYm9vbGVhbjtcbiAgaXNCdXN5OiBib29sZWFuO1xuICByZXNldFRpbWVvdXRJZD86IG51bWJlcjtcbn1cblxuY29uc3QgZ3JvdXBTdGF0ZXMgPSBuZXcgV2Vha01hcDxIVE1MRWxlbWVudCwgR3JvdXBTdGF0ZT4oKTtcbmNvbnN0IGJ1dHRvblRvR3JvdXAgPSBuZXcgV2Vha01hcDxIVE1MQnV0dG9uRWxlbWVudCwgR3JvdXBTdGF0ZT4oKTtcbmNvbnN0IGJ1dHRvblRvRmlsZSA9IG5ldyBXZWFrTWFwPEhUTUxCdXR0b25FbGVtZW50LCBGaWxlRW50cnk+KCk7XG5cbmNvbnN0IGRpcnR5R3JvdXBzID0gbmV3IFNldDxHcm91cFN0YXRlPigpO1xubGV0IHJlZnJlc2hTY2hlZHVsZWQgPSBmYWxzZTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnaHR0cHM6Ly9jbGFzc3Jvb20uZ29vZ2xlLmNvbS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW4oKSB7XG4gICAgaW5qZWN0U3R5bGVzKCk7XG4gICAgc2FmZVNldERpcmVjdGlvbigpO1xuXG4gICAgLy8gSW5pdGlhbCBkaXNjb3ZlcnlcbiAgICByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUoZG9jdW1lbnQpO1xuXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IG0gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgIGlmIChtLnR5cGUgPT09ICdjaGlsZExpc3QnKSB7XG4gICAgICAgICAgbS5hZGRlZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHJldHVybjtcbiAgICAgICAgICAgIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShub2RlKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG0ucmVtb3ZlZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHJldHVybjtcbiAgICAgICAgICAgIGNsZWFudXBSZW1vdmVkQnV0dG9ucyhub2RlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtLnR5cGUgPT09ICdhdHRyaWJ1dGVzJykge1xuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IG0udGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHRhcmdldCBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50ICYmXG4gICAgICAgICAgICB0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtZG93bmxvYWQtYnRuJylcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZW5zdXJlQnV0dG9uUmVnaXN0ZXJlZCh0YXJnZXQpO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNjaGVkdWxlUmVmcmVzaCgpO1xuICAgIH0pO1xuXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgICBjaGlsZExpc3Q6IHRydWUsXG4gICAgICBzdWJ0cmVlOiB0cnVlLFxuICAgICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICAgIGF0dHJpYnV0ZUZpbHRlcjogWydjbGFzcycsICdkYXRhLWNxZC1hbGwtZG9uZSddLCAvLyB3YXRjaCBwZXItZmlsZSBzdGF0dXNcbiAgICB9KTtcblxuICAgIC8vIEJhY2t1cCBzY2FuIChpbiBjYXNlIHdlIG1pc3Mgc29tZXRoaW5nKVxuICAgIHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUoZG9jdW1lbnQpO1xuICAgICAgc2NoZWR1bGVSZWZyZXNoKCk7XG4gICAgfSwgNDAwMCk7XG4gIH0sXG59KTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIERpc2NvdmVyeSAmIGdyb3VwaW5nXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUocm9vdDogSFRNTEVsZW1lbnQgfCBEb2N1bWVudCk6IHZvaWQge1xuICBpZiAoXG4gICAgcm9vdCBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50ICYmXG4gICAgcm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1kb3dubG9hZC1idG4nKVxuICApIHtcbiAgICByZWdpc3RlclNpbmdsZUJ1dHRvbihyb290KTtcbiAgfVxuXG4gIGNvbnN0IGJ1dHRvbnMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KERPV05MT0FEX0JUTl9TRUxFQ1RPUik7XG4gIGJ1dHRvbnMuZm9yRWFjaCgoYnRuKSA9PiByZWdpc3RlclNpbmdsZUJ1dHRvbihidG4pKTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJTaW5nbGVCdXR0b24oYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IHZvaWQge1xuICBpZiAoIWJ0bi5pc0Nvbm5lY3RlZCkgcmV0dXJuO1xuICBpZiAoYnV0dG9uVG9Hcm91cC5oYXMoYnRuKSAmJiBidXR0b25Ub0ZpbGUuaGFzKGJ0bikpIHJldHVybjtcblxuICBjb25zdCBncm91cFJvb3QgPSBmaW5kR3JvdXBSb290KGJ0bik7XG4gIGlmICghZ3JvdXBSb290KSByZXR1cm47XG5cbiAgbGV0IGdyb3VwID0gZ3JvdXBTdGF0ZXMuZ2V0KGdyb3VwUm9vdCk7XG4gIGlmICghZ3JvdXApIHtcbiAgICBncm91cCA9IHtcbiAgICAgIHJvb3Q6IGdyb3VwUm9vdCxcbiAgICAgIGZpbGVzOiBuZXcgTWFwPHN0cmluZywgRmlsZUVudHJ5PigpLFxuICAgICAgZG93bmxvYWRBbGxCdG46IG51bGwsXG4gICAgICBhY3RpdmF0ZWQ6IGZhbHNlLFxuICAgICAgaXNCdXN5OiBmYWxzZSxcbiAgICB9O1xuICAgIGdyb3VwU3RhdGVzLnNldChncm91cFJvb3QsIGdyb3VwKTtcbiAgfVxuXG4gIGNvbnN0IGtleSA9IGdldENhbm9uaWNhbEZpbGVLZXkoYnRuKTtcbiAgbGV0IGZpbGUgPSBncm91cC5maWxlcy5nZXQoa2V5KTtcblxuICBpZiAoIWZpbGUpIHtcbiAgICBmaWxlID0ge1xuICAgICAga2V5LFxuICAgICAgYnV0dG9uczogbmV3IFNldDxIVE1MQnV0dG9uRWxlbWVudD4oKSxcbiAgICAgIGRvd25sb2FkZWQ6IGZhbHNlLFxuICAgICAgZmFpbGVkOiBmYWxzZSxcbiAgICAgIGluUHJvZ3Jlc3M6IGZhbHNlLFxuICAgIH07XG4gICAgZ3JvdXAuZmlsZXMuc2V0KGtleSwgZmlsZSk7XG4gIH1cblxuICBmaWxlLmJ1dHRvbnMuYWRkKGJ0bik7XG4gIGJ1dHRvblRvR3JvdXAuc2V0KGJ0biwgZ3JvdXApO1xuICBidXR0b25Ub0ZpbGUuc2V0KGJ0biwgZmlsZSk7XG5cbiAgbWFya0dyb3VwRGlydHkoZ3JvdXApO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVCdXR0b25SZWdpc3RlcmVkKGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBHcm91cFN0YXRlIHwgbnVsbCB7XG4gIGxldCBncm91cCA9IGJ1dHRvblRvR3JvdXAuZ2V0KGJ0bik7XG4gIGlmICghZ3JvdXApIHtcbiAgICByZWdpc3RlclNpbmdsZUJ1dHRvbihidG4pO1xuICAgIGdyb3VwID0gYnV0dG9uVG9Hcm91cC5nZXQoYnRuKSB8fCBudWxsO1xuICB9XG4gIHJldHVybiBncm91cDtcbn1cblxuZnVuY3Rpb24gY2xlYW51cFJlbW92ZWRCdXR0b25zKHJvb3Q6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IHJlbW92ZWRCdXR0b25zID0gcm9vdC5tYXRjaGVzKERPV05MT0FEX0JUTl9TRUxFQ1RPUilcbiAgICA/IFtyb290IGFzIEhUTUxCdXR0b25FbGVtZW50XVxuICAgIDogQXJyYXkuZnJvbShyb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KERPV05MT0FEX0JUTl9TRUxFQ1RPUikpO1xuXG4gIHJlbW92ZWRCdXR0b25zLmZvckVhY2goKGJ0bikgPT4ge1xuICAgIGNvbnN0IGdyb3VwID0gYnV0dG9uVG9Hcm91cC5nZXQoYnRuKTtcbiAgICBjb25zdCBmaWxlID0gYnV0dG9uVG9GaWxlLmdldChidG4pO1xuICAgIGlmICghZ3JvdXAgfHwgIWZpbGUpIHJldHVybjtcblxuICAgIGZpbGUuYnV0dG9ucy5kZWxldGUoYnRuKTtcbiAgICBidXR0b25Ub0dyb3VwLmRlbGV0ZShidG4pO1xuICAgIGJ1dHRvblRvRmlsZS5kZWxldGUoYnRuKTtcblxuICAgIGlmIChmaWxlLmJ1dHRvbnMuc2l6ZSA9PT0gMCkge1xuICAgICAgZ3JvdXAuZmlsZXMuZGVsZXRlKGZpbGUua2V5KTtcbiAgICB9XG5cbiAgICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmaW5kR3JvdXBSb290KGJ0bjogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICBjb25zdCBwb3N0ID0gYnRuLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KEdST1VQX1NFTEVDVE9SKTtcbiAgaWYgKHBvc3QpIHJldHVybiBwb3N0O1xuXG4gIGNvbnN0IG1haW4gPVxuICAgIGJ0bi5jbG9zZXN0PEhUTUxFbGVtZW50PignbWFpbicpIHx8XG4gICAgYnRuLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCdkaXZbcm9sZT1cIm1haW5cIl0nKTtcbiAgaWYgKG1haW4pIHJldHVybiBtYWluO1xuXG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBnZXRDYW5vbmljYWxGaWxlS2V5KGJ0bjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBzdHJpbmcge1xuICBjb25zdCBkcyA9IGJ0bi5kYXRhc2V0IGFzIGFueTtcbiAgY29uc3QgdXJsID0gZHMuY3FkVXJsIHx8ICcnO1xuXG4gIGlmICh1cmwpIHtcbiAgICBjb25zdCBpZE1hdGNoID1cbiAgICAgIHVybC5tYXRjaCgvXFwvZFxcLyhbYS16QS1aMC05Xy1dKykvKSB8fFxuICAgICAgdXJsLm1hdGNoKC9bPyZdKD86aWR8cmVzb3VyY2VJZHxmaWxlSWQpPShbYS16QS1aMC05Xy1dKykvKTtcblxuICAgIGlmIChpZE1hdGNoICYmIGlkTWF0Y2hbMV0pIHtcbiAgICAgIHJldHVybiBgZHJpdmUtaWQtJHtpZE1hdGNoWzFdfWA7XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHUgPSBuZXcgVVJMKHVybCk7XG4gICAgICB1LnNlYXJjaFBhcmFtcy5kZWxldGUoJ2F1dGh1c2VyJyk7XG4gICAgICB1LnNlYXJjaFBhcmFtcy5kZWxldGUoJ3UnKTtcbiAgICAgIHUuc2VhcmNoUGFyYW1zLmRlbGV0ZSgnaGwnKTtcbiAgICAgIHJldHVybiB1LnRvU3RyaW5nKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gdXJsO1xuICAgIH1cbiAgfVxuXG4gIGlmIChkcy5jcWROYW1lKSB7XG4gICAgcmV0dXJuIGAke2RzLmNxZE5hbWV9Ojoke2RzLmNxZEV4dCB8fCAnJ31gO1xuICB9XG5cbiAgcmV0dXJuIGBidG4tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKX1gO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRmlsZS1sZXZlbCBoZWxwZXJzIChwcmltYXJ5IGJ1dHRvbiAmIGRlZHVwKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0UHJpbWFyeUJ1dHRvbihmaWxlOiBGaWxlRW50cnkpOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwge1xuICBpZiAoZmlsZS5idXR0b25zLnNpemUgPT09IDApIHJldHVybiBudWxsO1xuXG4gIGxldCBwcmltYXJ5VmlzaWJsZTogSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgbGV0IGZhbGxiYWNrOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXG4gIGZvciAoY29uc3QgYnRuIG9mIGZpbGUuYnV0dG9ucykge1xuICAgIGlmICghYnRuLmlzQ29ubmVjdGVkKSBjb250aW51ZTtcbiAgICBpZiAoIWZhbGxiYWNrKSBmYWxsYmFjayA9IGJ0bjtcblxuICAgIC8vIE9ubHkgY29uc2lkZXIgdmlzdWFsbHkgbGFpZC1vdXQgZWxlbWVudHMgYXMgXCJ2aXNpYmxlXCJcbiAgICBpZiAoIWJ0bi5vZmZzZXRQYXJlbnQpIGNvbnRpbnVlO1xuXG4gICAgaWYgKCFwcmltYXJ5VmlzaWJsZSkge1xuICAgICAgcHJpbWFyeVZpc2libGUgPSBidG47XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBDaG9vc2UgdGhlIGxhc3Qgb25lIGluIERPTSBvcmRlciAobW9yZSBsaWtlbHkgdG8gYmUgdGhlIFwicmVhbFwiIHZpc2libGUgb25lKVxuICAgIGNvbnN0IHBvcyA9IHByaW1hcnlWaXNpYmxlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGJ0bik7XG4gICAgaWYgKHBvcyAmIE5vZGUuRE9DVU1FTlRfUE9TSVRJT05fRk9MTE9XSU5HKSB7XG4gICAgICBwcmltYXJ5VmlzaWJsZSA9IGJ0bjtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcHJpbWFyeVZpc2libGUgfHwgZmFsbGJhY2s7XG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUZpbGVCdXR0b25zKGZpbGU6IEZpbGVFbnRyeSk6IHZvaWQge1xuICBpZiAoZmlsZS5idXR0b25zLnNpemUgPD0gMSkgcmV0dXJuO1xuXG4gIGNvbnN0IHByaW1hcnkgPSBnZXRQcmltYXJ5QnV0dG9uKGZpbGUpO1xuICBpZiAoIXByaW1hcnkpIHJldHVybjtcblxuICBmb3IgKGNvbnN0IGJ0biBvZiBmaWxlLmJ1dHRvbnMpIHtcbiAgICBpZiAoIWJ0bi5pc0Nvbm5lY3RlZCkgY29udGludWU7XG5cbiAgICBpZiAoYnRuID09PSBwcmltYXJ5KSB7XG4gICAgICAvLyBQcmltYXJ5IHN0YXlzIHZpc2libGUgJiBjbGlja2FibGVcbiAgICAgIGJ0bi5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnZGlzcGxheScpO1xuICAgICAgYnRuLnN0eWxlLnJlbW92ZVByb3BlcnR5KCd2aXNpYmlsaXR5Jyk7XG4gICAgICBidG4uc3R5bGUucmVtb3ZlUHJvcGVydHkoJ3BvaW50ZXItZXZlbnRzJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEhpZGUgZHVwbGljYXRlcyBzbyB3ZSBkb24ndCBzZWUgYSBzZWNvbmQgbGF5ZXIgb2YgYmx1ZSBjaXJjbGVzXG4gICAgICBidG4uc3R5bGUuc2V0UHJvcGVydHkoJ2Rpc3BsYXknLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgICAgIGJ0bi5zdHlsZS5zZXRQcm9wZXJ0eSgncG9pbnRlci1ldmVudHMnLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgICB9XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFJlZnJlc2ggcGlwZWxpbmVcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIG1hcmtHcm91cERpcnR5KGdyb3VwOiBHcm91cFN0YXRlKTogdm9pZCB7XG4gIGRpcnR5R3JvdXBzLmFkZChncm91cCk7XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlUmVmcmVzaCgpOiB2b2lkIHtcbiAgaWYgKHJlZnJlc2hTY2hlZHVsZWQpIHJldHVybjtcbiAgcmVmcmVzaFNjaGVkdWxlZCA9IHRydWU7XG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgcmVmcmVzaFNjaGVkdWxlZCA9IGZhbHNlO1xuICAgIGRpcnR5R3JvdXBzLmZvckVhY2godXBkYXRlR3JvdXBTdGF0ZSk7XG4gICAgZGlydHlHcm91cHMuY2xlYXIoKTtcbiAgfSk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBHcm91cCBzdGF0ZSArIHZpc3VhbCB1cGRhdGVcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHVwZGF0ZUdyb3VwU3RhdGUoZ3JvdXA6IEdyb3VwU3RhdGUpOiB2b2lkIHtcbiAgLy8gUHJ1bmUgZGVhZCBidXR0b25zIGFuZCBub3JtYWxpemUgZHVwbGljYXRlcyBwZXIgZmlsZVxuICBmb3IgKGNvbnN0IFtrZXksIGZpbGVdIG9mIEFycmF5LmZyb20oZ3JvdXAuZmlsZXMuZW50cmllcygpKSkge1xuICAgIGZvciAoY29uc3QgYnRuIG9mIEFycmF5LmZyb20oZmlsZS5idXR0b25zKSkge1xuICAgICAgaWYgKCFidG4uaXNDb25uZWN0ZWQpIHtcbiAgICAgICAgZmlsZS5idXR0b25zLmRlbGV0ZShidG4pO1xuICAgICAgICBidXR0b25Ub0dyb3VwLmRlbGV0ZShidG4pO1xuICAgICAgICBidXR0b25Ub0ZpbGUuZGVsZXRlKGJ0bik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZpbGUuYnV0dG9ucy5zaXplID09PSAwKSB7XG4gICAgICBncm91cC5maWxlcy5kZWxldGUoa2V5KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIG5vcm1hbGl6ZUZpbGVCdXR0b25zKGZpbGUpO1xuICB9XG5cbiAgY29uc3QgdG90YWxGaWxlcyA9IGdyb3VwLmZpbGVzLnNpemU7XG5cbiAgLy8gUmVxdWlyZSBhdCBsZWFzdCAyIGZpbGVzIHRvIHNob3cgXCJEb3dubG9hZCBhbGxcIlxuICBpZiAodG90YWxGaWxlcyA8IDIpIHtcbiAgICBpZiAoZ3JvdXAuZG93bmxvYWRBbGxCdG4gJiYgZ3JvdXAuZG93bmxvYWRBbGxCdG4uaXNDb25uZWN0ZWQpIHtcbiAgICAgIGdyb3VwLmRvd25sb2FkQWxsQnRuLnJlbW92ZSgpO1xuICAgIH1cbiAgICBncm91cC5kb3dubG9hZEFsbEJ0biA9IG51bGw7XG4gICAgZ3JvdXAuYWN0aXZhdGVkID0gZmFsc2U7XG4gICAgZ3JvdXAuaXNCdXN5ID0gZmFsc2U7XG4gICAgaWYgKGdyb3VwLnJlc2V0VGltZW91dElkICE9IG51bGwpIHtcbiAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoZ3JvdXAucmVzZXRUaW1lb3V0SWQpO1xuICAgICAgZ3JvdXAucmVzZXRUaW1lb3V0SWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGJ0biA9IGVuc3VyZURvd25sb2FkQWxsQnV0dG9uKGdyb3VwKTtcblxuICAvLyBBZ2dyZWdhdGUgY3VycmVudCBET00gc3RhdGUgZGlyZWN0bHkgZnJvbSB0aGUgc2luZ2xlLWZpbGUgYnV0dG9uc1xuICBsZXQgZG93bmxvYWRlZCA9IDA7XG4gIGxldCBmYWlsZWQgPSAwO1xuICBsZXQgaW5Qcm9ncmVzcyA9IDA7XG5cbiAgZm9yIChjb25zdCBmaWxlIG9mIGdyb3VwLmZpbGVzLnZhbHVlcygpKSB7XG4gICAgbGV0IHNvbWVTdWNjZXNzID0gZmFsc2U7XG4gICAgbGV0IHNvbWVFcnJvciA9IGZhbHNlO1xuICAgIGxldCBzb21lTG9hZGluZyA9IGZhbHNlO1xuXG4gICAgZm9yIChjb25zdCBiIG9mIGZpbGUuYnV0dG9ucykge1xuICAgICAgaWYgKCFiLmlzQ29ubmVjdGVkKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGNscyA9IGIuY2xhc3NMaXN0O1xuXG4gICAgICBjb25zdCBpc0xvYWRpbmcgPVxuICAgICAgICBjbHMuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykgfHwgY2xzLmNvbnRhaW5zKCdjcWQtdHJ5aW5nJyk7XG4gICAgICBjb25zdCBpc1N1Y2Nlc3MgPVxuICAgICAgICBjbHMuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykgfHxcbiAgICAgICAgKGIuZGF0YXNldCBhcyBhbnkpLmNxZEFsbERvbmUgPT09ICd0cnVlJztcbiAgICAgIGNvbnN0IGlzRXJyb3IgPSBjbHMuY29udGFpbnMoJ2NxZC1lcnJvcicpO1xuXG4gICAgICBpZiAoaXNMb2FkaW5nKSBzb21lTG9hZGluZyA9IHRydWU7XG4gICAgICBpZiAoaXNTdWNjZXNzKSBzb21lU3VjY2VzcyA9IHRydWU7XG4gICAgICBpZiAoaXNFcnJvcikgc29tZUVycm9yID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmaWxlLmRvd25sb2FkZWQgPSBzb21lU3VjY2VzcztcbiAgICBmaWxlLmluUHJvZ3Jlc3MgPSBzb21lTG9hZGluZztcbiAgICBmaWxlLmZhaWxlZCA9ICFmaWxlLmRvd25sb2FkZWQgJiYgc29tZUVycm9yO1xuXG4gICAgaWYgKGZpbGUuZG93bmxvYWRlZCkgZG93bmxvYWRlZCsrO1xuICAgIGVsc2UgaWYgKGZpbGUuaW5Qcm9ncmVzcykgaW5Qcm9ncmVzcysrO1xuICAgIGVsc2UgaWYgKGZpbGUuZmFpbGVkKSBmYWlsZWQrKztcbiAgfVxuXG4gIGdyb3VwLmlzQnVzeSA9IGluUHJvZ3Jlc3MgPiAwO1xuXG4gIC8vIElmIG5ldyBkb3dubG9hZHMgc3RhcnRlZCwgY2FuY2VsIGFueSBwZW5kaW5nIHJlc2V0IHRpbWVyXG4gIGlmIChncm91cC5pc0J1c3kgJiYgZ3JvdXAucmVzZXRUaW1lb3V0SWQgIT0gbnVsbCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoZ3JvdXAucmVzZXRUaW1lb3V0SWQpO1xuICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgbWFpblNwYW4gPSBidG4ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtYWxsLW1haW4nKTtcbiAgY29uc3Qgc3ViU3BhbiA9IGJ0bi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1hbGwtc3ViJyk7XG4gIGlmICghbWFpblNwYW4gfHwgIXN1YlNwYW4pIHJldHVybjtcblxuICBjb25zdCBub25lU3RhcnRlZCA9IGRvd25sb2FkZWQgPT09IDAgJiYgZmFpbGVkID09PSAwICYmIGluUHJvZ3Jlc3MgPT09IDA7XG4gIGNvbnN0IGFsbFN1Y2NlZWRlZCA9XG4gICAgZG93bmxvYWRlZCA9PT0gdG90YWxGaWxlcyAmJiBmYWlsZWQgPT09IDAgJiYgdG90YWxGaWxlcyA+IDA7XG4gIGNvbnN0IGFsbENvbXBsZXRlZCA9XG4gICAgZG93bmxvYWRlZCArIGZhaWxlZCA9PT0gdG90YWxGaWxlcyAmJiBpblByb2dyZXNzID09PSAwICYmIHRvdGFsRmlsZXMgPiAwO1xuXG4gIC8vIEFjdGl2YXRpb24gY2hlY2s6IG9uY2UgYW55IGZpbGUgaGFzIHN0YXJ0ZWQsIHdlIGNvbnNpZGVyIHRoZSBydW4gXCJhY3RpdmVcIlxuICBpZiAoIWdyb3VwLmFjdGl2YXRlZCAmJiAhbm9uZVN0YXJ0ZWQpIHtcbiAgICBncm91cC5hY3RpdmF0ZWQgPSB0cnVlO1xuICB9XG5cbiAgLy8gUmVzZXQgdmlzdWFsIGNsYXNzZXNcbiAgYnRuLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1hbGwtc3VjY2VzcycsICdjcWQtYWxsLWVycm9yJyk7XG5cbiAgLy8gSWRsZSBzdGF0ZTogbm8gZG93bmxvYWRzIHlldCBPUiBldmVyeXRoaW5nIHdlbnQgYmFjayB0byBpZGxlXG4gIGlmICghZ3JvdXAuYWN0aXZhdGVkIHx8IG5vbmVTdGFydGVkKSB7XG4gICAgZ3JvdXAuYWN0aXZhdGVkID0gZ3JvdXAuYWN0aXZhdGVkICYmICFub25lU3RhcnRlZDtcbiAgICBncm91cC5pc0J1c3kgPSBmYWxzZTtcbiAgICBidG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICBtYWluU3Bhbi50ZXh0Q29udGVudCA9IHQoJ2Rvd25sb2FkQWxsJykgfHwgJ0Rvd25sb2FkIGFsbCc7XG4gICAgc3ViU3Bhbi50ZXh0Q29udGVudCA9IGAke3RvdGFsRmlsZXN9IGZpbGVzYDtcbiAgICBzZXRQcm9ncmVzc1Zpc3VhbChidG4sIDApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEZyb20gaGVyZTogcnVuIGlzIGFjdGl2ZSBvciB3ZeKAmXJlIGluIHRoZSBzdWNjZXNzL2Vycm9yIGZlZWRiYWNrIHdpbmRvd1xuICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuXG4gIC8vIEFjdGl2ZS9jb21wbGV0ZWQgc3RhdGVzXG4gIGxldCBtYWluVGV4dDogc3RyaW5nO1xuICBsZXQgc3ViVGV4dDogc3RyaW5nO1xuICBsZXQgcHJvZ3Jlc3NSYXRpbyA9IHRvdGFsRmlsZXMgPiAwID8gZG93bmxvYWRlZCAvIHRvdGFsRmlsZXMgOiAwO1xuXG4gIGlmIChhbGxTdWNjZWVkZWQpIHtcbiAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IC8gJHt0b3RhbEZpbGVzfWA7XG4gICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtc3VjY2VzcycpO1xuICAgIHByb2dyZXNzUmF0aW8gPSAxO1xuICAgIHNjaGVkdWxlR3JvdXBSZXNldChncm91cCk7XG4gIH0gZWxzZSBpZiAoYWxsQ29tcGxldGVkICYmIGZhaWxlZCA+IDApIHtcbiAgICBpZiAoZG93bmxvYWRlZCA9PT0gMCkge1xuICAgICAgbWFpblRleHQgPSB0KCdlcnJvcicpIHx8ICdFcnJvcic7XG4gICAgICBzdWJUZXh0ID0gYCR7ZmFpbGVkfSBmYWlsZWRgO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtZXJyb3InKTtcbiAgICAgIHByb2dyZXNzUmF0aW8gPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgICBzdWJUZXh0ID0gYCR7ZG93bmxvYWRlZH0gb2ssICR7ZmFpbGVkfSBmYWlsZWRgO1xuICAgICAgYnRuLmNsYXNzTGlzdC5hZGQoJ2NxZC1hbGwtc3VjY2VzcycpO1xuICAgIH1cbiAgICBzY2hlZHVsZUdyb3VwUmVzZXQoZ3JvdXApO1xuICB9IGVsc2Uge1xuICAgIC8vIEluIHByb2dyZXNzXG4gICAgbWFpblRleHQgPSB0KCdkb3dubG9hZGluZycpIHx8ICdEb3dubG9hZGluZ+KApic7XG4gICAgaWYgKGZhaWxlZCA9PT0gMCkge1xuICAgICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IOKGkiAke3RvdGFsRmlsZXN9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3ViVGV4dCA9IGAke2Rvd25sb2FkZWR9IOKGkiAke3RvdGFsRmlsZXN9ICgke2ZhaWxlZH0gZmFpbGVkKWA7XG4gICAgfVxuICB9XG5cbiAgbWFpblNwYW4udGV4dENvbnRlbnQgPSBtYWluVGV4dDtcbiAgc3ViU3Bhbi50ZXh0Q29udGVudCA9IHN1YlRleHQ7XG4gIHNldFByb2dyZXNzVmlzdWFsKGJ0biwgcHJvZ3Jlc3NSYXRpbyk7XG59XG5cbmZ1bmN0aW9uIHNjaGVkdWxlR3JvdXBSZXNldChncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICBpZiAoZ3JvdXAucmVzZXRUaW1lb3V0SWQgIT0gbnVsbCkgcmV0dXJuOyAvLyBhbHJlYWR5IHNjaGVkdWxlZFxuXG4gIGdyb3VwLnJlc2V0VGltZW91dElkID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgIGdyb3VwLmFjdGl2YXRlZCA9IGZhbHNlO1xuICAgIGdyb3VwLmlzQnVzeSA9IGZhbHNlO1xuICAgIG1hcmtHcm91cERpcnR5KGdyb3VwKTtcbiAgICBzY2hlZHVsZVJlZnJlc2goKTtcbiAgfSwgR1JPVVBfRkVFREJBQ0tfU1VDQ0VTU19NUyk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBEb3dubG9hZCBhbGwgY2xpY2tcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGVuc3VyZURvd25sb2FkQWxsQnV0dG9uKGdyb3VwOiBHcm91cFN0YXRlKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBleGlzdGluZyA9IGdyb3VwLmRvd25sb2FkQWxsQnRuO1xuICBpZiAoZXhpc3RpbmcgJiYgZXhpc3RpbmcuaXNDb25uZWN0ZWQpIHJldHVybiBleGlzdGluZztcblxuICBjb25zdCByb290ID0gZ3JvdXAucm9vdDtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWFsbC1idG4nO1xuICBidXR0b24uc2V0QXR0cmlidXRlKElOSkVDVEVEX0FUVFIsICd0cnVlJyk7XG5cbiAgaWYgKGlzUGFnZURhcmsoKSkge1xuICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtdGhlbWUtZGFyaycpO1xuICB9XG5cbiAgYnV0dG9uLnNldEF0dHJpYnV0ZShcbiAgICAnYXJpYS1sYWJlbCcsXG4gICAgdCgnZG93bmxvYWRBbGwnKSB8fCAnRG93bmxvYWQgYWxsIGF0dGFjaG1lbnRzIGluIHRoaXMgcG9zdCcsXG4gICk7XG4gIGJ1dHRvbi50aXRsZSA9IHQoJ2Rvd25sb2FkQWxsJykgfHwgJ0Rvd25sb2FkIGFsbCc7XG5cbiAgY29uc3QgaWNvbldyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25XcmFwcGVyLmNsYXNzTmFtZSA9ICdjcWQtaWNvbi13cmFwcGVyIGNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyJztcbiAgY29uc3QgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWFsbC1pY29uJztcbiAgaWNvbldyYXBwZXIuYXBwZW5kQ2hpbGQoaWNvbik7XG5cbiAgY29uc3QgbWFpblNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIG1haW5TcGFuLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYWxsLW1haW4nO1xuXG4gIGNvbnN0IHN1YlNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIHN1YlNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1hbGwtc3ViJztcblxuICBidXR0b24uYXBwZW5kQ2hpbGQoaWNvbldyYXBwZXIpO1xuICBidXR0b24uYXBwZW5kQ2hpbGQobWFpblNwYW4pO1xuICBidXR0b24uYXBwZW5kQ2hpbGQoc3ViU3Bhbik7XG5cbiAgLy8gUm9vdCBjb250YWluZXIgbXVzdCBhbGxvdyB0aGUgYnV0dG9uIHRvIG92ZXJmbG93IHNsaWdodGx5XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocm9vdCk7XG4gIGlmIChjb21wdXRlZC5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICByb290LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgfVxuICByb290LnN0eWxlLnNldFByb3BlcnR5KCdvdmVyZmxvdycsICd2aXNpYmxlJywgJ2ltcG9ydGFudCcpO1xuICByb290LnN0eWxlLnNldFByb3BlcnR5KCdjb250YWluJywgJ25vbmUnLCAnaW1wb3J0YW50Jyk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBoYW5kbGVEb3dubG9hZEFsbENsaWNrKGdyb3VwKTtcbiAgfSk7XG5cbiAgcm9vdC5hcHBlbmRDaGlsZChidXR0b24pO1xuICBncm91cC5kb3dubG9hZEFsbEJ0biA9IGJ1dHRvbjtcblxuICByZXR1cm4gYnV0dG9uO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVEb3dubG9hZEFsbENsaWNrKGdyb3VwOiBHcm91cFN0YXRlKTogdm9pZCB7XG4gIC8vIElmIGFueXRoaW5nIGlzIGN1cnJlbnRseSBydW5uaW5nIG9yIHN0aWxsIGluIGZlZWRiYWNrLCBpZ25vcmUgY2xpY2tzXG4gIGlmIChncm91cC5pc0J1c3kgfHwgZ3JvdXAuYWN0aXZhdGVkKSByZXR1cm47XG5cbiAgZ3JvdXAuYWN0aXZhdGVkID0gdHJ1ZTtcblxuICAvLyBDYW5jZWwgYW55IHBlbmRpbmcgcmVzZXQgZnJvbSBhIHByZXZpb3VzIHJ1blxuICBpZiAoZ3JvdXAucmVzZXRUaW1lb3V0SWQgIT0gbnVsbCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoZ3JvdXAucmVzZXRUaW1lb3V0SWQpO1xuICAgIGdyb3VwLnJlc2V0VGltZW91dElkID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgY29uc3QgYnRuID0gZ3JvdXAuZG93bmxvYWRBbGxCdG47XG4gIGlmIChidG4pIHtcbiAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuICB9XG5cbiAgLy8gVHJpZ2dlciBhdCBtb3N0IE9ORSBwcmltYXJ5IGJ1dHRvbiBwZXIgZmlsZSwgYW5kIG9ubHkgaWYgaWRsZS9lcnJvclxuICBmb3IgKGNvbnN0IGZpbGUgb2YgZ3JvdXAuZmlsZXMudmFsdWVzKCkpIHtcbiAgICBjb25zdCBwcmltYXJ5ID0gZ2V0UHJpbWFyeUJ1dHRvbihmaWxlKTtcbiAgICBpZiAoIXByaW1hcnkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHMgPSBnZXRTaW5nbGVCdXR0b25TdGF0ZShwcmltYXJ5KTtcbiAgICBpZiAocyA9PT0gJ2lkbGUnIHx8IHMgPT09ICdlcnJvcicpIHtcbiAgICAgIHByaW1hcnkuY2xpY2soKTtcbiAgICB9XG4gIH1cblxuICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gIHNjaGVkdWxlUmVmcmVzaCgpO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVCdXR0b25TdGF0ZShidG46IEhUTUxCdXR0b25FbGVtZW50KTogQnV0dG9uU3RhdGUge1xuICBjb25zdCBjbHMgPSBidG4uY2xhc3NMaXN0O1xuICBpZiAoY2xzLmNvbnRhaW5zKCdjcWQtbG9hZGluZycpKSByZXR1cm4gJ2xvYWRpbmcnO1xuICBpZiAoY2xzLmNvbnRhaW5zKCdjcWQtdHJ5aW5nJykpIHJldHVybiAndHJ5aW5nJztcbiAgaWYgKGNscy5jb250YWlucygnY3FkLXN1Y2Nlc3MnKSkgcmV0dXJuICdzdWNjZXNzJztcbiAgaWYgKGNscy5jb250YWlucygnY3FkLWVycm9yJykpIHJldHVybiAnZXJyb3InO1xuICBpZiAoKGJ0bi5kYXRhc2V0IGFzIGFueSkuY3FkQWxsRG9uZSA9PT0gJ3RydWUnKSByZXR1cm4gJ3N1Y2Nlc3MnO1xuICByZXR1cm4gJ2lkbGUnO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogVmlzdWFsczogcHJvZ3Jlc3Mg4oaSIENTUyB2YXJzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBzZXRQcm9ncmVzc1Zpc3VhbChidG46IEhUTUxCdXR0b25FbGVtZW50LCByYXRpbzogbnVtYmVyKTogdm9pZCB7XG4gIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCByYXRpbykpO1xuICBjb25zdCBwZXJjZW50ID0gTWF0aC5yb3VuZChjbGFtcGVkICogMTAwKTtcbiAgYnRuLnN0eWxlLnNldFByb3BlcnR5KCctLWNxZC1wcm9ncmVzcycsIGAke3BlcmNlbnR9JWApO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRGlyZWN0aW9uIGhlbHBlclxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2FmZVNldERpcmVjdGlvbigpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXIgPSBnZXRQYWdlRGlyZWN0aW9uKCk7XG4gICAgZG9jdW1lbnQuYm9keS5zZXRBdHRyaWJ1dGUoJ2RhdGEtY3FkLWRpcicsIGRpcik7XG4gIH0gY2F0Y2gge1xuICAgIC8vIGlnbm9yZVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldFBhZ2VEaXJlY3Rpb24oKTogJ2x0cicgfCAncnRsJyB7XG4gIGNvbnN0IGRvY0RpciA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kaXIgfHwgZG9jdW1lbnQuYm9keS5kaXI7XG4gIGlmIChkb2NEaXIgPT09ICdydGwnKSByZXR1cm4gJ3J0bCc7XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSkuZGlyZWN0aW9uO1xuICByZXR1cm4gY29tcHV0ZWQgPT09ICdydGwnID8gJ3J0bCcgOiAnbHRyJztcbn0iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTJCOUIsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUM1QkQsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sa0JBQWtCO0FBRXhCLFFBQU0sZ0JBQWdCO0FBQ3RCLFFBQU0saUJBQWlCLEdBQUcsYUFBYTtBQUVoQyxXQUFTLGVBQXFCO0FBQ25DLFFBQUksT0FBTyxhQUFhLFlBQWE7QUFDckMsUUFBSSxTQUFTLGVBQWUsUUFBUSxFQUFHO0FBRXZDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLEtBQUs7QUFDWCxVQUFNLGNBQWM7QUFBQTtBQUFBLDBCQUVJLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLCtCQW1JVCxxQkFBcUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQWlKckMsZUFBZTtBQUFBLGdCQUNkLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsMkJBc1lKLHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFpQjVDLEtBQUE7QUFFRixLQUFDLFNBQVMsUUFBUSxTQUFTLGlCQUFpQixZQUFZLEtBQUs7QUFBQSxFQUMvRDtBQ2pzQkEsUUFBTSxlQUFvQztBQUFBLElBQ3hDLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxNQUNSLGFBQWE7QUFBQSxJQUFBO0FBQUEsSUFFZixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsTUFDUixhQUFhO0FBQUEsSUFBQTtBQUFBLElBRWYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLFNBQVM7QUFBQSxNQUNQLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixTQUFTO0FBQUEsTUFDUCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsU0FBUztBQUFBLE1BQ1AsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixLQUFLO0FBQUEsTUFDSCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxJQUVWLElBQUk7QUFBQSxNQUNGLFVBQVU7QUFBQSxNQUNWLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxNQUNaLE9BQU87QUFBQSxNQUNQLFFBQVE7QUFBQSxNQUNSLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxJQUFBO0FBQUEsSUFFVixJQUFJO0FBQUEsTUFDRixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixZQUFZO0FBQUEsTUFDWixPQUFPO0FBQUEsTUFDUCxRQUFRO0FBQUEsTUFDUixjQUFjO0FBQUEsTUFDZCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFBQTtBQUFBLElBRVYsSUFBSTtBQUFBLE1BQ0YsVUFBVTtBQUFBLE1BQ1YsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLE1BQ1IsWUFBWTtBQUFBLE1BQ1osT0FBTztBQUFBLE1BQ1AsUUFBUTtBQUFBLE1BQ1IsY0FBYztBQUFBLE1BQ2QsWUFBWTtBQUFBLE1BQ1osVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQUE7QUFBQSxFQUVaO0FBSU8sV0FBUyxFQUFFLEtBQXNCO0FBQ3RDLFFBQUk7QUFDRixVQUFJLENBQUMsT0FBTyxPQUFPLFFBQVEsVUFBVTtBQUNuQyxlQUFPO0FBQUEsTUFDVDtBQUVBLFVBQUksVUFBVTtBQUNkLFVBQ0UsT0FBTyxhQUFhLGVBQ3BCLFNBQVMsbUJBQ1QsU0FBUyxnQkFBZ0IsTUFDekI7QUFDQSxrQkFBVSxTQUFTLGdCQUFnQjtBQUFBLE1BQ3JDLFdBQVcsT0FBTyxjQUFjLGVBQWUsVUFBVSxVQUFVO0FBQ2pFLGtCQUFVLFVBQVU7QUFBQSxNQUN0QjtBQUVBLFlBQU0saUJBQWlCLFFBQ3BCLFlBQUEsRUFDQSxNQUFNLEdBQUcsRUFBRSxDQUFDLEVBQ1osS0FBQSxFQUNBLFFBQVEsS0FBSyxHQUFHO0FBQ25CLFlBQU0sV0FBVyxlQUFlLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFFNUMsVUFDRSxhQUFhLGNBQWMsS0FDM0IsT0FBTyxhQUFhLGNBQWMsRUFBRSxHQUFHLE1BQU0sVUFDN0M7QUFDQSxlQUFPLGFBQWEsY0FBYyxFQUFFLEdBQUc7QUFBQSxNQUN6QztBQUVBLFVBQ0UsYUFBYSxRQUFRLEtBQ3JCLE9BQU8sYUFBYSxRQUFRLEVBQUUsR0FBRyxNQUFNLFVBQ3ZDO0FBQ0EsZUFBTyxhQUFhLFFBQVEsRUFBRSxHQUFHO0FBQUEsTUFDbkM7QUFFQSxVQUNFLGFBQWEsSUFBSSxLQUNqQixPQUFPLGFBQWEsSUFBSSxFQUFFLEdBQUcsTUFBTSxVQUNuQztBQUNBLGVBQU8sYUFBYSxJQUFJLEVBQUUsR0FBRztBQUFBLE1BQy9CO0FBRUEsYUFBTztBQUFBLElBQ1QsUUFBUTtBQUNOLFVBQUk7QUFDRixlQUFPLGFBQWEsSUFBSSxFQUFFLEdBQUcsS0FBSztBQUFBLE1BQ3BDLFFBQVE7QUFDTixlQUFPLE9BQU8sT0FBTyxVQUFVO0FBQUEsTUFDakM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQ2g3Qk8sV0FBUyxhQUFzQjtBQUNwQyxRQUFJLE9BQU8sYUFBYSxZQUFhLFFBQU87QUFHNUMsVUFBTSxXQUFXLFNBQVMsZ0JBQWdCLGFBQWEsd0JBQXdCO0FBQy9FLFFBQUksYUFBYSxPQUFRLFFBQU87QUFDaEMsUUFBSSxhQUFhLFFBQVMsUUFBTztBQUlqQyxVQUFNLGFBQWEsQ0FBQyxRQUFRLGNBQWMsY0FBYyxTQUFTLGdCQUFnQjtBQUNqRixVQUFNLGFBQWEsU0FBUyxnQkFBZ0IsYUFBYSxJQUFJLFlBQUE7QUFDN0QsVUFBTSxhQUFhLFNBQVMsS0FBSyxhQUFhLElBQUksWUFBQTtBQUNsRCxRQUFJLFdBQVcsS0FBSyxDQUFBLFVBQVMsVUFBVSxTQUFTLEtBQUssS0FBSyxVQUFVLFNBQVMsS0FBSyxDQUFDLEdBQUc7QUFDcEYsYUFBTztBQUFBLElBQ1Q7QUFJQSxVQUFNLFVBQ0osU0FBUyxjQUEyQiwwQkFBMEIsS0FDOUQsU0FBUyxjQUEyQixlQUFlLEtBQ25ELFNBQVM7QUFFWCxVQUFNLFVBQVUsNEJBQTRCLE9BQU87QUFDbkQsVUFBTSxhQUFhLGdCQUFnQixPQUFPO0FBSzFDLFdBQU8sYUFBYTtBQUFBLEVBQ3RCO0FBTUEsV0FBUyw0QkFBNEIsT0FBNEI7QUFDL0QsUUFBSSxLQUF5QjtBQUU3QixVQUFNLGdCQUFnQixDQUFDLE1BQ3JCLENBQUMsS0FBSyxNQUFNLGlCQUFpQixNQUFNO0FBRXJDLFdBQU8sSUFBSTtBQUNULFlBQU0sUUFBUSxPQUFPLGlCQUFpQixFQUFFO0FBQ3hDLFlBQU0sS0FBSyxNQUFNO0FBQ2pCLFVBQUksQ0FBQyxjQUFjLEVBQUUsRUFBRyxRQUFPO0FBQy9CLFdBQUssR0FBRztBQUFBLElBQ1Y7QUFHQSxVQUFNLFlBQVksT0FBTyxpQkFBaUIsU0FBUyxlQUFlO0FBQ2xFLFVBQU0sU0FBUyxVQUFVO0FBQ3pCLFFBQUksQ0FBQyxjQUFjLE1BQU0sRUFBRyxRQUFPO0FBR25DLFdBQU87QUFBQSxFQUNUO0FBTUEsV0FBUyxnQkFBZ0IsV0FBMkI7QUFDbEQsVUFBTSxRQUFRLFVBQVUsTUFBTSx5QkFBeUI7QUFDdkQsUUFBSSxDQUFDLE9BQU87QUFFVixhQUFPO0FBQUEsSUFDVDtBQUVBLFVBQU0sSUFBSSxTQUFTLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDL0IsVUFBTSxJQUFJLFNBQVMsTUFBTSxDQUFDLEdBQUcsRUFBRTtBQUMvQixVQUFNLElBQUksU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBRy9CLFVBQU0sYUFBYSxLQUFLO0FBQUEsTUFDdEIsU0FBUyxJQUFJLEtBQ2IsU0FBUyxJQUFJLEtBQ2IsU0FBUyxJQUFJO0FBQUEsSUFBQTtBQUdmLFdBQU87QUFBQSxFQUNUO0FDNUZBLFFBQUEsd0JBQUE7QUFDQSxRQUFBLGlCQUFBO0FBQ0EsUUFBQSxnQkFBQTtBQUdBLFFBQUEsNEJBQUE7QUFxQkEsUUFBQSxjQUFBLG9CQUFBLFFBQUE7QUFDQSxRQUFBLGdCQUFBLG9CQUFBLFFBQUE7QUFDQSxRQUFBLGVBQUEsb0JBQUEsUUFBQTtBQUVBLFFBQUEsY0FBQSxvQkFBQSxJQUFBO0FBQ0EsTUFBQSxtQkFBQTtBQUVBLFFBQUEsYUFBQSxvQkFBQTtBQUFBLElBQW1DLFNBQUEsQ0FBQSxnQ0FBQTtBQUFBLElBQ1MsT0FBQTtBQUFBLElBQ25DLE9BQUE7QUFFTCxtQkFBQTtBQUNBLHVCQUFBO0FBR0EsK0JBQUEsUUFBQTtBQUVBLFlBQUEsV0FBQSxJQUFBLGlCQUFBLENBQUEsY0FBQTtBQUNFLG1CQUFBLEtBQUEsV0FBQTtBQUNFLGNBQUEsRUFBQSxTQUFBLGFBQUE7QUFDRSxjQUFBLFdBQUEsUUFBQSxDQUFBLFNBQUE7QUFDRSxrQkFBQSxFQUFBLGdCQUFBLGFBQUE7QUFDQSx1Q0FBQSxJQUFBO0FBQUEsWUFBNkIsQ0FBQTtBQUcvQixjQUFBLGFBQUEsUUFBQSxDQUFBLFNBQUE7QUFDRSxrQkFBQSxFQUFBLGdCQUFBLGFBQUE7QUFDQSxvQ0FBQSxJQUFBO0FBQUEsWUFBMEIsQ0FBQTtBQUFBLFVBQzNCLFdBQUEsRUFBQSxTQUFBLGNBQUE7QUFFRCxrQkFBQSxTQUFBLEVBQUE7QUFDQSxnQkFBQSxrQkFBQSxxQkFBQSxPQUFBLFVBQUEsU0FBQSxrQkFBQSxHQUFBO0FBSUUsb0JBQUEsUUFBQSx1QkFBQSxNQUFBO0FBQ0Esa0JBQUEsTUFBQSxnQkFBQSxLQUFBO0FBQUEsWUFBK0I7QUFBQSxVQUNqQztBQUFBLFFBQ0Y7QUFHRix3QkFBQTtBQUFBLE1BQWdCLENBQUE7QUFHbEIsZUFBQSxRQUFBLFNBQUEsTUFBQTtBQUFBLFFBQWdDLFdBQUE7QUFBQSxRQUNuQixTQUFBO0FBQUEsUUFDRixZQUFBO0FBQUEsUUFDRyxpQkFBQSxDQUFBLFNBQUEsbUJBQUE7QUFBQTtBQUFBLE1BQ2tDLENBQUE7QUFJaEQsYUFBQSxZQUFBLE1BQUE7QUFDRSxpQ0FBQSxRQUFBO0FBQ0Esd0JBQUE7QUFBQSxNQUFnQixHQUFBLEdBQUE7QUFBQSxJQUNYO0FBQUEsRUFFWCxDQUFBO0FBTUEsV0FBQSx5QkFBQSxNQUFBO0FBQ0UsUUFBQSxnQkFBQSxxQkFBQSxLQUFBLFVBQUEsU0FBQSxrQkFBQSxHQUFBO0FBSUUsMkJBQUEsSUFBQTtBQUFBLElBQXlCO0FBRzNCLFVBQUEsVUFBQSxLQUFBLGlCQUFBLHFCQUFBO0FBQ0EsWUFBQSxRQUFBLENBQUEsUUFBQSxxQkFBQSxHQUFBLENBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxxQkFBQSxLQUFBO0FBQ0UsUUFBQSxDQUFBLElBQUEsWUFBQTtBQUNBLFFBQUEsY0FBQSxJQUFBLEdBQUEsS0FBQSxhQUFBLElBQUEsR0FBQSxFQUFBO0FBRUEsVUFBQSxZQUFBLGNBQUEsR0FBQTtBQUNBLFFBQUEsQ0FBQSxVQUFBO0FBRUEsUUFBQSxRQUFBLFlBQUEsSUFBQSxTQUFBO0FBQ0EsUUFBQSxDQUFBLE9BQUE7QUFDRSxjQUFBO0FBQUEsUUFBUSxNQUFBO0FBQUEsUUFDQSxPQUFBLG9CQUFBLElBQUE7QUFBQSxRQUM0QixnQkFBQTtBQUFBLFFBQ2xCLFdBQUE7QUFBQSxRQUNMLFFBQUE7QUFBQSxNQUNIO0FBRVYsa0JBQUEsSUFBQSxXQUFBLEtBQUE7QUFBQSxJQUFnQztBQUdsQyxVQUFBLE1BQUEsb0JBQUEsR0FBQTtBQUNBLFFBQUEsT0FBQSxNQUFBLE1BQUEsSUFBQSxHQUFBO0FBRUEsUUFBQSxDQUFBLE1BQUE7QUFDRSxhQUFBO0FBQUEsUUFBTztBQUFBLFFBQ0wsU0FBQSxvQkFBQSxJQUFBO0FBQUEsUUFDb0MsWUFBQTtBQUFBLFFBQ3hCLFFBQUE7QUFBQSxRQUNKLFlBQUE7QUFBQSxNQUNJO0FBRWQsWUFBQSxNQUFBLElBQUEsS0FBQSxJQUFBO0FBQUEsSUFBeUI7QUFHM0IsU0FBQSxRQUFBLElBQUEsR0FBQTtBQUNBLGtCQUFBLElBQUEsS0FBQSxLQUFBO0FBQ0EsaUJBQUEsSUFBQSxLQUFBLElBQUE7QUFFQSxtQkFBQSxLQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsdUJBQUEsS0FBQTtBQUNFLFFBQUEsUUFBQSxjQUFBLElBQUEsR0FBQTtBQUNBLFFBQUEsQ0FBQSxPQUFBO0FBQ0UsMkJBQUEsR0FBQTtBQUNBLGNBQUEsY0FBQSxJQUFBLEdBQUEsS0FBQTtBQUFBLElBQWtDO0FBRXBDLFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxzQkFBQSxNQUFBO0FBQ0UsVUFBQSxpQkFBQSxLQUFBLFFBQUEscUJBQUEsSUFBQSxDQUFBLElBQUEsSUFBQSxNQUFBLEtBQUEsS0FBQSxpQkFBQSxxQkFBQSxDQUFBO0FBSUEsbUJBQUEsUUFBQSxDQUFBLFFBQUE7QUFDRSxZQUFBLFFBQUEsY0FBQSxJQUFBLEdBQUE7QUFDQSxZQUFBLE9BQUEsYUFBQSxJQUFBLEdBQUE7QUFDQSxVQUFBLENBQUEsU0FBQSxDQUFBLEtBQUE7QUFFQSxXQUFBLFFBQUEsT0FBQSxHQUFBO0FBQ0Esb0JBQUEsT0FBQSxHQUFBO0FBQ0EsbUJBQUEsT0FBQSxHQUFBO0FBRUEsVUFBQSxLQUFBLFFBQUEsU0FBQSxHQUFBO0FBQ0UsY0FBQSxNQUFBLE9BQUEsS0FBQSxHQUFBO0FBQUEsTUFBMkI7QUFHN0IscUJBQUEsS0FBQTtBQUFBLElBQW9CLENBQUE7QUFBQSxFQUV4QjtBQUVBLFdBQUEsY0FBQSxLQUFBO0FBQ0UsVUFBQSxPQUFBLElBQUEsUUFBQSxjQUFBO0FBQ0EsUUFBQSxLQUFBLFFBQUE7QUFFQSxVQUFBLE9BQUEsSUFBQSxRQUFBLE1BQUEsS0FBQSxJQUFBLFFBQUEsa0JBQUE7QUFHQSxRQUFBLEtBQUEsUUFBQTtBQUVBLFdBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxvQkFBQSxLQUFBO0FBQ0UsVUFBQSxLQUFBLElBQUE7QUFDQSxVQUFBLE1BQUEsR0FBQSxVQUFBO0FBRUEsUUFBQSxLQUFBO0FBQ0UsWUFBQSxVQUFBLElBQUEsTUFBQSx1QkFBQSxLQUFBLElBQUEsTUFBQSwrQ0FBQTtBQUlBLFVBQUEsV0FBQSxRQUFBLENBQUEsR0FBQTtBQUNFLGVBQUEsWUFBQSxRQUFBLENBQUEsQ0FBQTtBQUFBLE1BQTZCO0FBRy9CLFVBQUE7QUFDRSxjQUFBLElBQUEsSUFBQSxJQUFBLEdBQUE7QUFDQSxVQUFBLGFBQUEsT0FBQSxVQUFBO0FBQ0EsVUFBQSxhQUFBLE9BQUEsR0FBQTtBQUNBLFVBQUEsYUFBQSxPQUFBLElBQUE7QUFDQSxlQUFBLEVBQUEsU0FBQTtBQUFBLE1BQWtCLFFBQUE7QUFFbEIsZUFBQTtBQUFBLE1BQU87QUFBQSxJQUNUO0FBR0YsUUFBQSxHQUFBLFNBQUE7QUFDRSxhQUFBLEdBQUEsR0FBQSxPQUFBLEtBQUEsR0FBQSxVQUFBLEVBQUE7QUFBQSxJQUF3QztBQUcxQyxXQUFBLE9BQUEsS0FBQSxPQUFBLEVBQUEsU0FBQSxFQUFBLEVBQUEsTUFBQSxDQUFBLENBQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSxpQkFBQSxNQUFBO0FBQ0UsUUFBQSxLQUFBLFFBQUEsU0FBQSxFQUFBLFFBQUE7QUFFQSxRQUFBLGlCQUFBO0FBQ0EsUUFBQSxXQUFBO0FBRUEsZUFBQSxPQUFBLEtBQUEsU0FBQTtBQUNFLFVBQUEsQ0FBQSxJQUFBLFlBQUE7QUFDQSxVQUFBLENBQUEsU0FBQSxZQUFBO0FBR0EsVUFBQSxDQUFBLElBQUEsYUFBQTtBQUVBLFVBQUEsQ0FBQSxnQkFBQTtBQUNFLHlCQUFBO0FBQ0E7QUFBQSxNQUFBO0FBSUYsWUFBQSxNQUFBLGVBQUEsd0JBQUEsR0FBQTtBQUNBLFVBQUEsTUFBQSxLQUFBLDZCQUFBO0FBQ0UseUJBQUE7QUFBQSxNQUFpQjtBQUFBLElBQ25CO0FBR0YsV0FBQSxrQkFBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLHFCQUFBLE1BQUE7QUFDRSxRQUFBLEtBQUEsUUFBQSxRQUFBLEVBQUE7QUFFQSxVQUFBLFVBQUEsaUJBQUEsSUFBQTtBQUNBLFFBQUEsQ0FBQSxRQUFBO0FBRUEsZUFBQSxPQUFBLEtBQUEsU0FBQTtBQUNFLFVBQUEsQ0FBQSxJQUFBLFlBQUE7QUFFQSxVQUFBLFFBQUEsU0FBQTtBQUVFLFlBQUEsTUFBQSxlQUFBLFNBQUE7QUFDQSxZQUFBLE1BQUEsZUFBQSxZQUFBO0FBQ0EsWUFBQSxNQUFBLGVBQUEsZ0JBQUE7QUFBQSxNQUF5QyxPQUFBO0FBR3pDLFlBQUEsTUFBQSxZQUFBLFdBQUEsUUFBQSxXQUFBO0FBQ0EsWUFBQSxNQUFBLFlBQUEsa0JBQUEsUUFBQSxXQUFBO0FBQUEsTUFBMkQ7QUFBQSxJQUM3RDtBQUFBLEVBRUo7QUFNQSxXQUFBLGVBQUEsT0FBQTtBQUNFLGdCQUFBLElBQUEsS0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLGtCQUFBO0FBQ0UsUUFBQSxpQkFBQTtBQUNBLHVCQUFBO0FBQ0EsMEJBQUEsTUFBQTtBQUNFLHlCQUFBO0FBQ0Esa0JBQUEsUUFBQSxnQkFBQTtBQUNBLGtCQUFBLE1BQUE7QUFBQSxJQUFrQixDQUFBO0FBQUEsRUFFdEI7QUFNQSxXQUFBLGlCQUFBLE9BQUE7QUFFRSxlQUFBLENBQUEsS0FBQSxJQUFBLEtBQUEsTUFBQSxLQUFBLE1BQUEsTUFBQSxRQUFBLENBQUEsR0FBQTtBQUNFLGlCQUFBLFFBQUEsTUFBQSxLQUFBLEtBQUEsT0FBQSxHQUFBO0FBQ0UsWUFBQSxDQUFBLEtBQUEsYUFBQTtBQUNFLGVBQUEsUUFBQSxPQUFBLElBQUE7QUFDQSx3QkFBQSxPQUFBLElBQUE7QUFDQSx1QkFBQSxPQUFBLElBQUE7QUFBQSxRQUF1QjtBQUFBLE1BQ3pCO0FBR0YsVUFBQSxLQUFBLFFBQUEsU0FBQSxHQUFBO0FBQ0UsY0FBQSxNQUFBLE9BQUEsR0FBQTtBQUNBO0FBQUEsTUFBQTtBQUdGLDJCQUFBLElBQUE7QUFBQSxJQUF5QjtBQUczQixVQUFBLGFBQUEsTUFBQSxNQUFBO0FBR0EsUUFBQSxhQUFBLEdBQUE7QUFDRSxVQUFBLE1BQUEsa0JBQUEsTUFBQSxlQUFBLGFBQUE7QUFDRSxjQUFBLGVBQUEsT0FBQTtBQUFBLE1BQTRCO0FBRTlCLFlBQUEsaUJBQUE7QUFDQSxZQUFBLFlBQUE7QUFDQSxZQUFBLFNBQUE7QUFDQSxVQUFBLE1BQUEsa0JBQUEsTUFBQTtBQUNFLGVBQUEsYUFBQSxNQUFBLGNBQUE7QUFDQSxjQUFBLGlCQUFBO0FBQUEsTUFBdUI7QUFFekI7QUFBQSxJQUFBO0FBR0YsVUFBQSxNQUFBLHdCQUFBLEtBQUE7QUFHQSxRQUFBLGFBQUE7QUFDQSxRQUFBLFNBQUE7QUFDQSxRQUFBLGFBQUE7QUFFQSxlQUFBLFFBQUEsTUFBQSxNQUFBLE9BQUEsR0FBQTtBQUNFLFVBQUEsY0FBQTtBQUNBLFVBQUEsWUFBQTtBQUNBLFVBQUEsY0FBQTtBQUVBLGlCQUFBLEtBQUEsS0FBQSxTQUFBO0FBQ0UsWUFBQSxDQUFBLEVBQUEsWUFBQTtBQUNBLGNBQUEsTUFBQSxFQUFBO0FBRUEsY0FBQSxZQUFBLElBQUEsU0FBQSxhQUFBLEtBQUEsSUFBQSxTQUFBLFlBQUE7QUFFQSxjQUFBLFlBQUEsSUFBQSxTQUFBLGFBQUEsS0FBQSxFQUFBLFFBQUEsZUFBQTtBQUdBLGNBQUEsVUFBQSxJQUFBLFNBQUEsV0FBQTtBQUVBLFlBQUEsVUFBQSxlQUFBO0FBQ0EsWUFBQSxVQUFBLGVBQUE7QUFDQSxZQUFBLFFBQUEsYUFBQTtBQUFBLE1BQXlCO0FBRzNCLFdBQUEsYUFBQTtBQUNBLFdBQUEsYUFBQTtBQUNBLFdBQUEsU0FBQSxDQUFBLEtBQUEsY0FBQTtBQUVBLFVBQUEsS0FBQSxXQUFBO0FBQUEsZUFBcUIsS0FBQSxXQUFBO0FBQUEsZUFDSyxLQUFBLE9BQUE7QUFBQSxJQUNKO0FBR3hCLFVBQUEsU0FBQSxhQUFBO0FBR0EsUUFBQSxNQUFBLFVBQUEsTUFBQSxrQkFBQSxNQUFBO0FBQ0UsYUFBQSxhQUFBLE1BQUEsY0FBQTtBQUNBLFlBQUEsaUJBQUE7QUFBQSxJQUF1QjtBQUd6QixVQUFBLFdBQUEsSUFBQSxjQUFBLHdCQUFBO0FBQ0EsVUFBQSxVQUFBLElBQUEsY0FBQSx1QkFBQTtBQUNBLFFBQUEsQ0FBQSxZQUFBLENBQUEsUUFBQTtBQUVBLFVBQUEsY0FBQSxlQUFBLEtBQUEsV0FBQSxLQUFBLGVBQUE7QUFDQSxVQUFBLGVBQUEsZUFBQSxjQUFBLFdBQUEsS0FBQSxhQUFBO0FBRUEsVUFBQSxlQUFBLGFBQUEsV0FBQSxjQUFBLGVBQUEsS0FBQSxhQUFBO0FBSUEsUUFBQSxDQUFBLE1BQUEsYUFBQSxDQUFBLGFBQUE7QUFDRSxZQUFBLFlBQUE7QUFBQSxJQUFrQjtBQUlwQixRQUFBLFVBQUEsT0FBQSxtQkFBQSxlQUFBO0FBR0EsUUFBQSxDQUFBLE1BQUEsYUFBQSxhQUFBO0FBQ0UsWUFBQSxZQUFBLE1BQUEsYUFBQSxDQUFBO0FBQ0EsWUFBQSxTQUFBO0FBQ0EsVUFBQSxXQUFBO0FBQ0EsZUFBQSxjQUFBLEVBQUEsYUFBQSxLQUFBO0FBQ0EsY0FBQSxjQUFBLEdBQUEsVUFBQTtBQUNBLHdCQUFBLEtBQUEsQ0FBQTtBQUNBO0FBQUEsSUFBQTtBQUlGLFFBQUEsV0FBQTtBQUdBLFFBQUE7QUFDQSxRQUFBO0FBQ0EsUUFBQSxnQkFBQSxhQUFBLElBQUEsYUFBQSxhQUFBO0FBRUEsUUFBQSxjQUFBO0FBQ0UsaUJBQUEsRUFBQSxZQUFBLEtBQUE7QUFDQSxnQkFBQSxHQUFBLFVBQUEsTUFBQSxVQUFBO0FBQ0EsVUFBQSxVQUFBLElBQUEsaUJBQUE7QUFDQSxzQkFBQTtBQUNBLHlCQUFBLEtBQUE7QUFBQSxJQUF3QixXQUFBLGdCQUFBLFNBQUEsR0FBQTtBQUV4QixVQUFBLGVBQUEsR0FBQTtBQUNFLG1CQUFBLEVBQUEsT0FBQSxLQUFBO0FBQ0Esa0JBQUEsR0FBQSxNQUFBO0FBQ0EsWUFBQSxVQUFBLElBQUEsZUFBQTtBQUNBLHdCQUFBO0FBQUEsTUFBZ0IsT0FBQTtBQUVoQixtQkFBQSxFQUFBLFlBQUEsS0FBQTtBQUNBLGtCQUFBLEdBQUEsVUFBQSxRQUFBLE1BQUE7QUFDQSxZQUFBLFVBQUEsSUFBQSxpQkFBQTtBQUFBLE1BQW1DO0FBRXJDLHlCQUFBLEtBQUE7QUFBQSxJQUF3QixPQUFBO0FBR3hCLGlCQUFBLEVBQUEsYUFBQSxLQUFBO0FBQ0EsVUFBQSxXQUFBLEdBQUE7QUFDRSxrQkFBQSxHQUFBLFVBQUEsTUFBQSxVQUFBO0FBQUEsTUFBdUMsT0FBQTtBQUV2QyxrQkFBQSxHQUFBLFVBQUEsTUFBQSxVQUFBLEtBQUEsTUFBQTtBQUFBLE1BQWtEO0FBQUEsSUFDcEQ7QUFHRixhQUFBLGNBQUE7QUFDQSxZQUFBLGNBQUE7QUFDQSxzQkFBQSxLQUFBLGFBQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxtQkFBQSxPQUFBO0FBQ0UsUUFBQSxNQUFBLGtCQUFBLEtBQUE7QUFFQSxVQUFBLGlCQUFBLE9BQUEsV0FBQSxNQUFBO0FBQ0UsWUFBQSxpQkFBQTtBQUNBLFlBQUEsWUFBQTtBQUNBLFlBQUEsU0FBQTtBQUNBLHFCQUFBLEtBQUE7QUFDQSxzQkFBQTtBQUFBLElBQWdCLEdBQUEseUJBQUE7QUFBQSxFQUVwQjtBQU1BLFdBQUEsd0JBQUEsT0FBQTtBQUNFLFVBQUEsV0FBQSxNQUFBO0FBQ0EsUUFBQSxZQUFBLFNBQUEsWUFBQSxRQUFBO0FBRUEsVUFBQSxPQUFBLE1BQUE7QUFDQSxVQUFBLFNBQUEsU0FBQSxjQUFBLFFBQUE7QUFDQSxXQUFBLE9BQUE7QUFDQSxXQUFBLFlBQUE7QUFDQSxXQUFBLGFBQUEsZUFBQSxNQUFBO0FBRUEsUUFBQSxXQUFBLEdBQUE7QUFDRSxhQUFBLFVBQUEsSUFBQSxnQkFBQTtBQUFBLElBQXFDO0FBR3ZDLFdBQUE7QUFBQSxNQUFPO0FBQUEsTUFDTCxFQUFBLGFBQUEsS0FBQTtBQUFBLElBQ29CO0FBRXRCLFdBQUEsUUFBQSxFQUFBLGFBQUEsS0FBQTtBQUVBLFVBQUEsY0FBQSxTQUFBLGNBQUEsTUFBQTtBQUNBLGdCQUFBLFlBQUE7QUFDQSxVQUFBLE9BQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxTQUFBLFlBQUE7QUFDQSxnQkFBQSxZQUFBLElBQUE7QUFFQSxVQUFBLFdBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxhQUFBLFlBQUE7QUFFQSxVQUFBLFVBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxZQUFBLFlBQUE7QUFFQSxXQUFBLFlBQUEsV0FBQTtBQUNBLFdBQUEsWUFBQSxRQUFBO0FBQ0EsV0FBQSxZQUFBLE9BQUE7QUFHQSxVQUFBLFdBQUEsT0FBQSxpQkFBQSxJQUFBO0FBQ0EsUUFBQSxTQUFBLGFBQUEsVUFBQTtBQUNFLFdBQUEsTUFBQSxXQUFBO0FBQUEsSUFBc0I7QUFFeEIsU0FBQSxNQUFBLFlBQUEsWUFBQSxXQUFBLFdBQUE7QUFDQSxTQUFBLE1BQUEsWUFBQSxXQUFBLFFBQUEsV0FBQTtBQUVBLFdBQUEsaUJBQUEsU0FBQSxDQUFBLE1BQUE7QUFDRSxRQUFBLGVBQUE7QUFDQSxRQUFBLGdCQUFBO0FBQ0EsNkJBQUEsS0FBQTtBQUFBLElBQTRCLENBQUE7QUFHOUIsU0FBQSxZQUFBLE1BQUE7QUFDQSxVQUFBLGlCQUFBO0FBRUEsV0FBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLHVCQUFBLE9BQUE7QUFFRSxRQUFBLE1BQUEsVUFBQSxNQUFBLFVBQUE7QUFFQSxVQUFBLFlBQUE7QUFHQSxRQUFBLE1BQUEsa0JBQUEsTUFBQTtBQUNFLGFBQUEsYUFBQSxNQUFBLGNBQUE7QUFDQSxZQUFBLGlCQUFBO0FBQUEsSUFBdUI7QUFHekIsVUFBQSxNQUFBLE1BQUE7QUFDQSxRQUFBLEtBQUE7QUFDRSxVQUFBLFdBQUE7QUFBQSxJQUFlO0FBSWpCLGVBQUEsUUFBQSxNQUFBLE1BQUEsT0FBQSxHQUFBO0FBQ0UsWUFBQSxVQUFBLGlCQUFBLElBQUE7QUFDQSxVQUFBLENBQUEsUUFBQTtBQUNBLFlBQUEsSUFBQSxxQkFBQSxPQUFBO0FBQ0EsVUFBQSxNQUFBLFVBQUEsTUFBQSxTQUFBO0FBQ0UsZ0JBQUEsTUFBQTtBQUFBLE1BQWM7QUFBQSxJQUNoQjtBQUdGLG1CQUFBLEtBQUE7QUFDQSxvQkFBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLHFCQUFBLEtBQUE7QUFDRSxVQUFBLE1BQUEsSUFBQTtBQUNBLFFBQUEsSUFBQSxTQUFBLGFBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxJQUFBLFNBQUEsWUFBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLElBQUEsU0FBQSxhQUFBLEVBQUEsUUFBQTtBQUNBLFFBQUEsSUFBQSxTQUFBLFdBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxJQUFBLFFBQUEsZUFBQSxPQUFBLFFBQUE7QUFDQSxXQUFBO0FBQUEsRUFDRjtBQU1BLFdBQUEsa0JBQUEsS0FBQSxPQUFBO0FBQ0UsVUFBQSxVQUFBLEtBQUEsSUFBQSxHQUFBLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQTtBQUNBLFVBQUEsVUFBQSxLQUFBLE1BQUEsVUFBQSxHQUFBO0FBQ0EsUUFBQSxNQUFBLFlBQUEsa0JBQUEsR0FBQSxPQUFBLEdBQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSxtQkFBQTtBQUNFLFFBQUE7QUFDRSxZQUFBLE1BQUEsaUJBQUE7QUFDQSxlQUFBLEtBQUEsYUFBQSxnQkFBQSxHQUFBO0FBQUEsSUFBOEMsUUFBQTtBQUFBLElBQ3hDO0FBQUEsRUFHVjtBQUVBLFdBQUEsbUJBQUE7QUFDRSxVQUFBLFNBQUEsU0FBQSxnQkFBQSxPQUFBLFNBQUEsS0FBQTtBQUNBLFFBQUEsV0FBQSxNQUFBLFFBQUE7QUFDQSxVQUFBLFdBQUEsT0FBQSxpQkFBQSxTQUFBLElBQUEsRUFBQTtBQUNBLFdBQUEsYUFBQSxRQUFBLFFBQUE7QUFBQSxFQUNGO0FDNWtCTyxRQUFNQyxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQ0R2QixXQUFTQyxRQUFNLFdBQVcsTUFBTTtBQUU5QixRQUFJLE9BQU8sS0FBSyxDQUFDLE1BQU0sVUFBVTtBQUMvQixZQUFNLFVBQVUsS0FBSyxNQUFBO0FBQ3JCLGFBQU8sU0FBUyxPQUFPLElBQUksR0FBRyxJQUFJO0FBQUEsSUFDcEMsT0FBTztBQUNMLGFBQU8sU0FBUyxHQUFHLElBQUk7QUFBQSxJQUN6QjtBQUFBLEVBQ0Y7QUFDTyxRQUFNQyxXQUFTO0FBQUEsSUFDcEIsT0FBTyxJQUFJLFNBQVNELFFBQU0sUUFBUSxPQUFPLEdBQUcsSUFBSTtBQUFBLElBQ2hELEtBQUssSUFBSSxTQUFTQSxRQUFNLFFBQVEsS0FBSyxHQUFHLElBQUk7QUFBQSxJQUM1QyxNQUFNLElBQUksU0FBU0EsUUFBTSxRQUFRLE1BQU0sR0FBRyxJQUFJO0FBQUEsSUFDOUMsT0FBTyxJQUFJLFNBQVNBLFFBQU0sUUFBUSxPQUFPLEdBQUcsSUFBSTtBQUFBLEVBQ2xEO0FBQUEsRUNiTyxNQUFNLCtCQUErQixNQUFNO0FBQUEsSUFDaEQsWUFBWSxRQUFRLFFBQVE7QUFDMUIsWUFBTSx1QkFBdUIsWUFBWSxFQUFFO0FBQzNDLFdBQUssU0FBUztBQUNkLFdBQUssU0FBUztBQUFBLElBQ2hCO0FBQUEsSUFDQSxPQUFPLGFBQWEsbUJBQW1CLG9CQUFvQjtBQUFBLEVBQzdEO0FBQ08sV0FBUyxtQkFBbUIsV0FBVztBQUM1QyxXQUFPLEdBQUcsU0FBUyxTQUFTLEVBQUUsSUFBSSxjQUEwQixJQUFJLFNBQVM7QUFBQSxFQUMzRTtBQ1ZPLFdBQVMsc0JBQXNCLEtBQUs7QUFDekMsUUFBSTtBQUNKLFFBQUk7QUFDSixXQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUtMLE1BQU07QUFDSixZQUFJLFlBQVksS0FBTTtBQUN0QixpQkFBUyxJQUFJLElBQUksU0FBUyxJQUFJO0FBQzlCLG1CQUFXLElBQUksWUFBWSxNQUFNO0FBQy9CLGNBQUksU0FBUyxJQUFJLElBQUksU0FBUyxJQUFJO0FBQ2xDLGNBQUksT0FBTyxTQUFTLE9BQU8sTUFBTTtBQUMvQixtQkFBTyxjQUFjLElBQUksdUJBQXVCLFFBQVEsTUFBTSxDQUFDO0FBQy9ELHFCQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0YsR0FBRyxHQUFHO0FBQUEsTUFDUjtBQUFBLElBQ0o7QUFBQSxFQUNBO0FBQUEsRUNmTyxNQUFNLHFCQUFxQjtBQUFBLElBQ2hDLFlBQVksbUJBQW1CLFNBQVM7QUFDdEMsV0FBSyxvQkFBb0I7QUFDekIsV0FBSyxVQUFVO0FBQ2YsV0FBSyxrQkFBa0IsSUFBSSxnQkFBZTtBQUMxQyxVQUFJLEtBQUssWUFBWTtBQUNuQixhQUFLLHNCQUFzQixFQUFFLGtCQUFrQixLQUFJLENBQUU7QUFDckQsYUFBSyxlQUFjO0FBQUEsTUFDckIsT0FBTztBQUNMLGFBQUssc0JBQXFCO0FBQUEsTUFDNUI7QUFBQSxJQUNGO0FBQUEsSUFDQSxPQUFPLDhCQUE4QjtBQUFBLE1BQ25DO0FBQUEsSUFDSjtBQUFBLElBQ0UsYUFBYSxPQUFPLFNBQVMsT0FBTztBQUFBLElBQ3BDO0FBQUEsSUFDQSxrQkFBa0Isc0JBQXNCLElBQUk7QUFBQSxJQUM1QyxxQkFBcUMsb0JBQUksSUFBRztBQUFBLElBQzVDLElBQUksU0FBUztBQUNYLGFBQU8sS0FBSyxnQkFBZ0I7QUFBQSxJQUM5QjtBQUFBLElBQ0EsTUFBTSxRQUFRO0FBQ1osYUFBTyxLQUFLLGdCQUFnQixNQUFNLE1BQU07QUFBQSxJQUMxQztBQUFBLElBQ0EsSUFBSSxZQUFZO0FBQ2QsVUFBSSxRQUFRLFFBQVEsTUFBTSxNQUFNO0FBQzlCLGFBQUssa0JBQWlCO0FBQUEsTUFDeEI7QUFDQSxhQUFPLEtBQUssT0FBTztBQUFBLElBQ3JCO0FBQUEsSUFDQSxJQUFJLFVBQVU7QUFDWixhQUFPLENBQUMsS0FBSztBQUFBLElBQ2Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBY0EsY0FBYyxJQUFJO0FBQ2hCLFdBQUssT0FBTyxpQkFBaUIsU0FBUyxFQUFFO0FBQ3hDLGFBQU8sTUFBTSxLQUFLLE9BQU8sb0JBQW9CLFNBQVMsRUFBRTtBQUFBLElBQzFEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBWUEsUUFBUTtBQUNOLGFBQU8sSUFBSSxRQUFRLE1BQU07QUFBQSxNQUN6QixDQUFDO0FBQUEsSUFDSDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1BLFlBQVksU0FBUyxTQUFTO0FBQzVCLFlBQU0sS0FBSyxZQUFZLE1BQU07QUFDM0IsWUFBSSxLQUFLLFFBQVMsU0FBTztBQUFBLE1BQzNCLEdBQUcsT0FBTztBQUNWLFdBQUssY0FBYyxNQUFNLGNBQWMsRUFBRSxDQUFDO0FBQzFDLGFBQU87QUFBQSxJQUNUO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTUEsV0FBVyxTQUFTLFNBQVM7QUFDM0IsWUFBTSxLQUFLLFdBQVcsTUFBTTtBQUMxQixZQUFJLEtBQUssUUFBUyxTQUFPO0FBQUEsTUFDM0IsR0FBRyxPQUFPO0FBQ1YsV0FBSyxjQUFjLE1BQU0sYUFBYSxFQUFFLENBQUM7QUFDekMsYUFBTztBQUFBLElBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9BLHNCQUFzQixVQUFVO0FBQzlCLFlBQU0sS0FBSyxzQkFBc0IsSUFBSSxTQUFTO0FBQzVDLFlBQUksS0FBSyxRQUFTLFVBQVMsR0FBRyxJQUFJO0FBQUEsTUFDcEMsQ0FBQztBQUNELFdBQUssY0FBYyxNQUFNLHFCQUFxQixFQUFFLENBQUM7QUFDakQsYUFBTztBQUFBLElBQ1Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9BLG9CQUFvQixVQUFVLFNBQVM7QUFDckMsWUFBTSxLQUFLLG9CQUFvQixJQUFJLFNBQVM7QUFDMUMsWUFBSSxDQUFDLEtBQUssT0FBTyxRQUFTLFVBQVMsR0FBRyxJQUFJO0FBQUEsTUFDNUMsR0FBRyxPQUFPO0FBQ1YsV0FBSyxjQUFjLE1BQU0sbUJBQW1CLEVBQUUsQ0FBQztBQUMvQyxhQUFPO0FBQUEsSUFDVDtBQUFBLElBQ0EsaUJBQWlCLFFBQVEsTUFBTSxTQUFTLFNBQVM7QUFDL0MsVUFBSSxTQUFTLHNCQUFzQjtBQUNqQyxZQUFJLEtBQUssUUFBUyxNQUFLLGdCQUFnQixJQUFHO0FBQUEsTUFDNUM7QUFDQSxhQUFPO0FBQUEsUUFDTCxLQUFLLFdBQVcsTUFBTSxJQUFJLG1CQUFtQixJQUFJLElBQUk7QUFBQSxRQUNyRDtBQUFBLFFBQ0E7QUFBQSxVQUNFLEdBQUc7QUFBQSxVQUNILFFBQVEsS0FBSztBQUFBLFFBQ3JCO0FBQUEsTUFDQTtBQUFBLElBQ0U7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Esb0JBQW9CO0FBQ2xCLFdBQUssTUFBTSxvQ0FBb0M7QUFDL0NDLGVBQU87QUFBQSxRQUNMLG1CQUFtQixLQUFLLGlCQUFpQjtBQUFBLE1BQy9DO0FBQUEsSUFDRTtBQUFBLElBQ0EsaUJBQWlCO0FBQ2YsYUFBTztBQUFBLFFBQ0w7QUFBQSxVQUNFLE1BQU0scUJBQXFCO0FBQUEsVUFDM0IsbUJBQW1CLEtBQUs7QUFBQSxVQUN4QixXQUFXLEtBQUssT0FBTSxFQUFHLFNBQVMsRUFBRSxFQUFFLE1BQU0sQ0FBQztBQUFBLFFBQ3JEO0FBQUEsUUFDTTtBQUFBLE1BQ047QUFBQSxJQUNFO0FBQUEsSUFDQSx5QkFBeUIsT0FBTztBQUM5QixZQUFNLHVCQUF1QixNQUFNLE1BQU0sU0FBUyxxQkFBcUI7QUFDdkUsWUFBTSxzQkFBc0IsTUFBTSxNQUFNLHNCQUFzQixLQUFLO0FBQ25FLFlBQU0saUJBQWlCLENBQUMsS0FBSyxtQkFBbUIsSUFBSSxNQUFNLE1BQU0sU0FBUztBQUN6RSxhQUFPLHdCQUF3Qix1QkFBdUI7QUFBQSxJQUN4RDtBQUFBLElBQ0Esc0JBQXNCLFNBQVM7QUFDN0IsVUFBSSxVQUFVO0FBQ2QsWUFBTSxLQUFLLENBQUMsVUFBVTtBQUNwQixZQUFJLEtBQUsseUJBQXlCLEtBQUssR0FBRztBQUN4QyxlQUFLLG1CQUFtQixJQUFJLE1BQU0sS0FBSyxTQUFTO0FBQ2hELGdCQUFNLFdBQVc7QUFDakIsb0JBQVU7QUFDVixjQUFJLFlBQVksU0FBUyxpQkFBa0I7QUFDM0MsZUFBSyxrQkFBaUI7QUFBQSxRQUN4QjtBQUFBLE1BQ0Y7QUFDQSx1QkFBaUIsV0FBVyxFQUFFO0FBQzlCLFdBQUssY0FBYyxNQUFNLG9CQUFvQixXQUFXLEVBQUUsQ0FBQztBQUFBLElBQzdEO0FBQUEsRUFDRjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDYsNyw4LDksMTAsMTFdfQ==
downloadall;