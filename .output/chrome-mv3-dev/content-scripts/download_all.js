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
  const DOWNLOAD_BTN_SELECTOR = ".cqd-download-btn";
  const GROUP_SELECTOR = "div[data-stream-item-id]";
  const INJECTED_ATTR = "data-cqd-injected";
  const groupStates = /* @__PURE__ */ new WeakMap();
  const buttonToGroup = /* @__PURE__ */ new WeakMap();
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
              if (group) {
                markGroupDirty(group);
              }
            }
          }
        }
        scheduleRefresh();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
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
    if (buttonToGroup.has(btn)) {
      return;
    }
    const groupRoot = findGroupRoot(btn);
    if (!groupRoot) return;
    let group = groupStates.get(groupRoot);
    if (!group) {
      group = {
        root: groupRoot,
        buttons: /* @__PURE__ */ new Set(),
        downloadAllBtn: null,
        activated: false
      };
      groupStates.set(groupRoot, group);
    }
    group.buttons.add(btn);
    buttonToGroup.set(btn, group);
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
      if (!group) return;
      group.buttons.delete(btn);
      buttonToGroup.delete(btn);
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
    for (const btn2 of Array.from(group.buttons)) {
      if (!btn2.isConnected) {
        group.buttons.delete(btn2);
        buttonToGroup.delete(btn2);
      }
    }
    const total = group.buttons.size;
    if (total <= 2) {
      if (group.downloadAllBtn && group.downloadAllBtn.isConnected) {
        group.downloadAllBtn.remove();
      }
      group.downloadAllBtn = null;
      group.activated = false;
      return;
    }
    const btn = ensureDownloadAllButton(group);
    let downloaded = 0;
    let failed = 0;
    let inProgress = 0;
    for (const fileBtn of group.buttons) {
      if (!fileBtn.isConnected) continue;
      const cls = fileBtn.classList;
      const isLoading = cls.contains("cqd-loading") || cls.contains("cqd-trying");
      const isSuccess = cls.contains("cqd-success");
      const isError = cls.contains("cqd-error");
      const prevDone = fileBtn.dataset.cqdAllDone === "true";
      if (isLoading) {
        if (prevDone) fileBtn.dataset.cqdAllDone = "false";
      } else if (isSuccess) {
        fileBtn.dataset.cqdAllDone = "true";
      }
      const done = fileBtn.dataset.cqdAllDone === "true";
      if (done) downloaded++;
      if (isError) failed++;
      if (isLoading) inProgress++;
    }
    const noneStarted = downloaded === 0 && failed === 0 && inProgress === 0;
    const allSucceeded = downloaded === total && failed === 0 && total > 0;
    const allCompleted = downloaded + failed === total && inProgress === 0 && total > 0;
    if (!group.activated) {
      if (!noneStarted) {
        group.activated = true;
      }
    }
    const mainSpan = btn.querySelector(".cqd-download-all-main");
    const subSpan = btn.querySelector(".cqd-download-all-sub");
    if (!mainSpan || !subSpan) return;
    if (!group.activated || noneStarted) {
      group.activated = group.activated && !noneStarted;
      btn.disabled = false;
      btn.style.backgroundImage = "";
      mainSpan.textContent = t("downloadAll") || "Download all";
      subSpan.textContent = `${total} files`;
      return;
    }
    let mainText;
    let subText;
    if (allSucceeded) {
      mainText = t("downloaded") || "Downloaded";
      subText = `${downloaded} / ${total}`;
    } else if (allCompleted && failed > 0) {
      mainText = t("downloaded") || "Downloaded";
      if (downloaded === 0) {
        mainText = t("error") || "Error";
        subText = `${failed} failed`;
      } else {
        subText = `${downloaded} ok, ${failed} failed`;
      }
    } else {
      mainText = t("downloading") || "Downloading…";
      if (failed === 0) {
        subText = `${downloaded} -> ${total}`;
      } else {
        subText = `${downloaded} -> ${total} (${failed} failed)`;
      }
    }
    mainSpan.textContent = mainText;
    subSpan.textContent = subText;
    const successRatio = total > 0 ? downloaded / total : 0;
    const percent = Math.max(0, Math.min(100, Math.round(successRatio * 100)));
    applyGradient(btn, group, percent);
  }
  function ensureDownloadAllButton(group) {
    const existing = group.downloadAllBtn;
    if (existing && existing.isConnected) {
      return existing;
    }
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
    group.activated = true;
    for (const fileBtn of group.buttons) {
      if (!fileBtn.isConnected) continue;
      const s = getSingleButtonState(fileBtn);
      if (s === "idle" || s === "error") {
        fileBtn.click();
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
    return "idle";
  }
  function applyGradient(button, group, percent) {
    if (!group.colors) {
      const cs = window.getComputedStyle(button);
      const normal2 = cs.getPropertyValue("--cqd-color-normal").trim() || "#005DD7";
      const success2 = cs.getPropertyValue("--cqd-color-success").trim() || "#00A82D";
      group.colors = { normal: normal2, success: success2 };
    }
    const { normal, success } = group.colors;
    const p = Math.max(0, Math.min(100, percent));
    if (p <= 0) {
      button.style.backgroundImage = "";
      return;
    }
    button.style.backgroundImage = `
    linear-gradient(
      to right,
      ${success} 0%,
      ${success} ${p}%,
      ${normal} ${p}%,
      ${normal} 100%
    )
  `;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZG93bmxvYWRfYWxsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaWNvbnMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvaTE4bi50cyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9kb3dubG9hZF9hbGwuY29udGVudC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcbmltcG9ydCB7IERPV05MT0FEX0lDT05fU1ZHX1VSTCB9IGZyb20gJy4vaWNvbnMnO1xuXG5jb25zdCBTVFlMRV9JRCA9ICdjcWQtc3R5bGUnO1xuY29uc3QgU1BJTk5FUl9TSVpFX1BYID0gMTY7XG5cbi8vIFNtb290aCwgc2xpZ2h0bHkgYm91bmN5IHRyYW5zaXRpb24gZm9yIHRoZSBcIkRyb3BcIiBmZWVsXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG5cbiAgICAgIC8qIFNwaW5uZXIgKExpZ2h0IHRoZW1lIGRlZmF1bHRzKSAqL1xuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yMik7IC8qIGRhcmstaXNoIHJpbmcgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjZmZmZmZmOyAgICAgICAgICAgICAgICAgICAvKiBzb2xpZCBkYXJrIHRpcCAqL1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAmIFNIQURPV1MgKExpZ2h0IE1vZGUgLyBEZWZhdWx0KVxuICAgICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAgIFxuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIExpZ2h0OiAjMDA1REQ3ICovXG4gICAgICAtLWNxZC1jb2xvci1ub3JtYWw6ICMwMDVERDc7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsOiAwIDhweCAyMnB4IHJnYmEoMCwgOTMsIDIxNSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCA5MywgMjE1LCAwLjcwKTtcblxuICAgICAgLyogMi4gU3VjY2VzcyAtIExpZ2h0OiAjMDBBODJEICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDBBODJEO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gTGlnaHQ6ICNGRjQwMzYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWVycm9yOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuXG4gICAgICAvKiA0LiBUcnlpbmcgLSBMaWdodDogI0VDNjMwMCAqL1xuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRUM2MzAwO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNzApO1xuXG4gICAgICAvKiA1LiBDb21tZW50IEZyYW1lIC0gTGlnaHQ6ICM5QjAwRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICBcbiAgICAgIC8qIDYuIEVkaXRlZCBGcmFtZSAtIExpZ2h0OiAjMDA3RjhEICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMDdGOEQ7XG5cbiAgICAgIC8qIEJhc2UgU2hhZG93cyAqL1xuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcblxuICAgICAgLyogNy4gQk9USCAoRWRpdGVkICsgQ29tbWVudHMpIC0gTGlnaHQgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICAtLWNxZC1ib3RoLW92ZXJsYXktc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBEQVJLIE1PREUgT1ZFUlJJREVTIChBcHBsaWVkIHZpYSAuY3FkLXRoZW1lLWRhcmsgY2xhc3MpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLXRoZW1lLWRhcmsge1xuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIERhcms6ICMwMDZFRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC8qIDIuIFN1Y2Nlc3MgLSBEYXJrOiAjMDdEQTNGICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDdEQTNGO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gRGFyazogI0ZGNDAzNiAqL1xuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC8qIDQuIFRyeWluZyAtIERhcms6ICNGRjkxNDIgKi9cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC8qIDUuIENvbW1lbnQgRnJhbWUgLSBEYXJrOiAjOUIwMEZGICovXG4gICAgICAtLWNxZC1jb2xvci1jb21tZW50OiAjOUIwMEZGO1xuXG4gICAgICAvKiA2LiBFZGl0ZWQgRnJhbWUgLSBEYXJrOiAjMDBENkVFICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC8qIDcuIEJPVEggKEVkaXRlZCArIENvbW1lbnRzKSAtIERhcmsgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNmZmZmZmY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjMDAwMDAwO1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjg1KTtcbiAgICAgIC0tY3FkLWJvdGgtb3ZlcmxheS1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjZmZmZmZmLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuXG4gICAgICAvKiBTcGlubmVyIChEYXJrIHRoZW1lIG92ZXJyaWRlcykgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogQ1JJVElDQUwgT1ZFUlJJREVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gU1RZTEVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogNTAlO1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIHdpZHRoOiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiBjYWxjKDEwMCUgLSAxNnB4KTtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1iYXNlKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgd2lsbC1jaGFuZ2U6IHRyYW5zZm9ybSwgYm94LXNoYWRvdywgd2lkdGgsIGJvcmRlci1yYWRpdXMsIHBhZGRpbmctaW5saW5lO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBwYWRkaW5nLWlubGluZSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJvcmRlci1yYWRpdXMgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgdHJhbnNmb3JtIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLyogU3RhdGVzICovXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIge1xuICAgICAgd2lkdGg6IDEyMHB4O1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWhvdmVyKTtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46Zm9jdXMtdmlzaWJsZSB7XG4gICAgICBvdXRsaW5lOiAycHggc29saWQgI2ZmZmZmZjtcbiAgICAgIG91dGxpbmUtb2Zmc2V0OiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAvKiBJY29ucyAmIExhYmVscyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLyogUGlsbCBTdGF0ZXMgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC8qIFN1Y2Nlc3MgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC8qIEVycm9yICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAvKiBTcGlubmVyICovXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7XG4gICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgIHRvICAgeyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVCBGUkFNRSAmIEJBREdFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuICAgIFxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMy4gRURJVEVEIEZSQU1FICYgUElMTFxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICBcbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuICAgIFxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjsgXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiA0LiBCT1RIIFNUQVRFIChFZGl0ZWQgKyBDb21tZW50cyDihpIgT05FIHBpbGwpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLyogV2hlbiBhIHBvc3QgaGFzIGJvdGggZGF0YS1jcWQtcHJvY2Vzc2VkIGFuZCBkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkLFxuICAgICAgIGdpdmUgdGhlIGZyYW1lIGEgZGFya2VyIG91dGxpbmUvZ2xvdyBzbyBpdCBmZWVscyBzcGVjaWFsICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdW2RhdGEtY3FkLXByb2Nlc3NlZF1bZGF0YS1jcWQtZWRpdGVkLXByb2Nlc3NlZF0gPiAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjRkY0MDM2LFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDcwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkY0MDM2O1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBwYWRkaW5nLXRvcDogOHB4O1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXNlY3Rpb24ge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24ge1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgLyogbm8gZmlsdGVyIHNvIHRoZSBhc3NldCBzdGF5cyBjcmlzcCBpbiBhbGwgdGhlbWVzICovXG4gICAgfVxuXG4gICAgLyogRWRpdGVkIGljb24gKFNWRykgdXNlcyBjdXJyZW50Q29sb3IgKHdoaXRlKSAqL1xuICAgIC5jcWQtYm90aC1pY29uLWVkaXRlZCBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAvKiBUaGUgXCIrXCIgYmV0d2VlbiBpY29ucyAoYWx3YXlzIHZpc2libGUpICovXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAgICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDFiLiBET1dOTE9BRCBBTEwgQlVUVE9OXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogOHB4O1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDY7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHBhZGRpbmc6IDRweCAxMnB4O1xuICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLW5vcm1hbCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMnB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIGdhcDogNnB4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1iYXNlKTtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBib3gtc2hhZG93IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgdHJhbnNmb3JtIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJhY2tncm91bmQtaW1hZ2UgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZG93bmxvYWQtYWxsLWJ0biB7XG4gICAgICByaWdodDogYXV0bztcbiAgICAgIGxlZnQ6IDhweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1idG46aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTFweCk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtYnRuOmFjdGl2ZSB7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1hbGwtaWNvbiB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE4cHggMThweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYWxsLW1haW4ge1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWFsbC1zdWIge1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgb3BhY2l0eTogMC45O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9pMThuLnRzXG5cbi8qKlxuICogU0hBUkVEIERJQ1RJT05BUlkgLSA3NSBMQU5HVUFHRVNcbiAqIE5vdyBpbmNsdWRlcyB0aGUgJ2VkaXRlZCcga2V5d29yZCBmb3IgZGV0ZWN0aW9uLlxuICovXG5cbmNvbnN0IFRSQU5TTEFUSU9OUzogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgZW46IHsgZG93bmxvYWQ6ICdEb3dubG9hZCcsIGRvd25sb2FkaW5nOiAnRG93bmxvYWRpbmfigKYnLCB0cnlpbmc6ICdUcnlpbmfigKYnLCBkb3dubG9hZGVkOiAnRG93bmxvYWRlZCcsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdEb3dubG9hZCBmYWlsZWQuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLCB0aXRsZVF1aWNrOiAnUXVpY2sgZG93bmxvYWQnLCBjb21tZW50czogJ2NvbW1lbnRzJywgZWRpdGVkOiAnRWRpdGVkJywgZG93bmxvYWRBbGw6ICdEb3dubG9hZCBhbGwnIH0sXG4gIGFyOiB7IGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsIGRvd25sb2FkaW5nOiAn2KzYp9ix2Yog2KfZhNiq2YbYstmK2YTigKYnLCB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLCBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsIGVycm9yOiAn2K7Yt9ijJywgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLCB0aXRsZVF1aWNrOiAn2KrZhtiy2YrZhCDYs9ix2YrYuScsIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLCBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyB9LFxuICBqYTogeyBkb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLCB0cnlpbmc6ICfoqabooYzkuK3igKYnLCBkb3dubG9hZGVkOiAn5a6M5LqGJywgZXJyb3I6ICfjgqjjg6njg7wnLCBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLCBhcmlhRG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLCB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJywgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLCBlZGl0ZWQ6ICfnt6jpm4bmuIjjgb8nIH0sXG4gIGVzOiB7IGRvd25sb2FkOiAnRGVzY2FyZ2FyJywgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsIHRyeWluZzogJ0ludGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJywgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJywgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgaGk6IHsgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLCBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcgfSxcbiAgcHQ6IHsgZG93bmxvYWQ6ICdCYWl4YXInLCBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJywgdHJ5aW5nOiAnVGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnQmFpeGFkbycsIGVycm9yOiAnRXJybycsIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLCBhcmlhRG93bmxvYWQ6ICdCYWl4YXInLCB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3B0LXB0JzogeyBkb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJywgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJywgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLCBkb3dubG9hZGVkOiAnRGVzY2FycmVnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJywgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYXInLCB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3poLWNuJzogeyBkb3dubG9hZDogJ+S4i+i9vScsIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJywgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJywgZG93bmxvYWRlZDogJ+W3suS4i+i9vScsIGVycm9yOiAn6ZSZ6K+vJywgZmFpbGVkOiAn5LiL6L295aSx6LSlJywgYXJpYURvd25sb2FkOiAn5LiL6L29JywgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsIGNvbW1lbnRzOiAn5p2h6K+E6K66JywgZWRpdGVkOiAn5bey57yW6L6RJyB9LFxuICAnemgtdHcnOiB7IGRvd25sb2FkOiAn5LiL6LyJJywgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLCB0cnlpbmc6ICflmJfoqabkuK3igKYnLCBkb3dubG9hZGVkOiAn5bey5LiL6LyJJywgZXJyb3I6ICfpjK/oqqQnLCBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLCBhcmlhRG93bmxvYWQ6ICfkuIvovIknLCB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJywgY29tbWVudHM6ICfliYfnlZnoqIAnLCBlZGl0ZWQ6ICflt7Lnt6jovK8nIH0sXG4gIGZyOiB7IGRvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsIHRyeWluZzogJ0Vzc2Fp4oCmJywgZG93bmxvYWRlZDogJ1TDqWzDqWNoYXJnw6knLCBlcnJvcjogJ0VycmV1cicsIGZhaWxlZDogJ8OJY2hlYy4nLCBhcmlhRG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJywgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJywgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLCBlZGl0ZWQ6ICdNb2RpZmnDqScgfSxcbiAgZGU6IHsgZG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJywgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsIGRvd25sb2FkZWQ6ICdGZXJ0aWcnLCBlcnJvcjogJ0ZlaGxlcicsIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsIGFyaWFEb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLCB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJywgY29tbWVudHM6ICdLb21tZW50YXJlJywgZWRpdGVkOiAnQmVhcmJlaXRldCcgfSxcbiAgaXQ6IHsgZG93bmxvYWQ6ICdTY2FyaWNhJywgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLCB0cnlpbmc6ICdQcm92YW5kb+KApicsIGRvd25sb2FkZWQ6ICdTY2FyaWNhdG8nLCBlcnJvcjogJ0Vycm9yZScsIGZhaWxlZDogJ0ZhbGxpdG8uJywgYXJpYURvd25sb2FkOiAnU2NhcmljYScsIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLCBjb21tZW50czogJ2NvbW1lbnRpJywgZWRpdGVkOiAnTW9kaWZpY2F0bycgfSxcbiAgcnU6IHsgZG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLCB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsIGRvd25sb2FkZWQ6ICfQodC60LDRh9Cw0L3QvicsIGVycm9yOiAn0J7RiNC40LHQutCwJywgZmFpbGVkOiAn0KHQsdC+0LkuJywgYXJpYURvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLCB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLCBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsIGVkaXRlZDogJ9CY0LfQvNC10L3QtdC90L4nIH0sXG4gIGtvOiB7IGRvd25sb2FkOiAn64uk7Jq066Gc65OcJywgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJywgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsIGRvd25sb2FkZWQ6ICfsmYTro4wnLCBlcnJvcjogJ+yYpOulmCcsIGZhaWxlZDogJ+yLpO2MqO2VqCcsIGFyaWFEb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJywgY29tbWVudHM6ICfqsJwg64yT6riAJywgZWRpdGVkOiAn7IiY7KCV65CoJyB9LFxuICB0cjogeyBkb3dubG9hZDogJ8SwbmRpcicsIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJywgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJywgZG93bmxvYWRlZDogJ8SwbmRpcmlsZGknLCBlcnJvcjogJ0hhdGEnLCBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJywgYXJpYURvd25sb2FkOiAnxLBuZGlyJywgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLCBjb21tZW50czogJ3lvcnVtJywgZWRpdGVkOiAnRMO8emVubGVuZGknIH0sXG4gIHZpOiB7IGRvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLCB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsIGRvd25sb2FkZWQ6ICfEkMOjIHThuqNpJywgZXJyb3I6ICdM4buXaScsIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLCBhcmlhRG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJywgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLCBjb21tZW50czogJ25o4bqtbiB4w6l0JywgZWRpdGVkOiAnxJDDoyBjaOG7iW5oIHPhu61hJyB9LFxuICBpZDogeyBkb3dubG9hZDogJ0Rvd25sb2FkJywgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLCB0cnlpbmc6ICdNZW5jb2Jh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ0tlc2FsYWhhbicsIGZhaWxlZDogJ0dhZ2FsLicsIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJywgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JywgY29tbWVudHM6ICdrb21lbnRhcicsIGVkaXRlZDogJ0RpZWRpdCcgfSxcbiAgdGg6IHsgZG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLCBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsIGRvd25sb2FkZWQ6ICfguYDguKrguKPguYfguIjguKrguLTguYnguJknLCBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsIGFyaWFEb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLCBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsIGVkaXRlZDogJ+C5geC4geC5ieC5hOC4guC5geC4peC5ieC4pycgfSxcbiAgcGw6IHsgZG93bmxvYWQ6ICdQb2JpZXJ6JywgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJywgdHJ5aW5nOiAnUHLDs2Jh4oCmJywgZG93bmxvYWRlZDogJ1BvYnJhbm8nLCBlcnJvcjogJ0LFgsSFZCcsIGZhaWxlZDogJ05pZXVkYW5lLicsIGFyaWFEb3dubG9hZDogJ1BvYmllcnonLCB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJywgY29tbWVudHM6ICdrb21lbnRhcnplJywgZWRpdGVkOiAnRWR5dG93YW5vJyB9LFxuICBubDogeyBkb3dubG9hZDogJ0Rvd25sb2FkZW4nLCBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLCB0cnlpbmc6ICdQcm9iZXJlbuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1a3QuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWRlbicsIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLCBjb21tZW50czogJ3JlYWN0aWVzJywgZWRpdGVkOiAnQmV3ZXJrdCcgfSxcbiAgYm46IHsgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLCBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLCB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCmqOCnjeCmqCcsIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJywgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJywgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyB9LFxuICBwYTogeyBkb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLCB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJywgZG93bmxvYWRlZDogJ+CoruCpgeColeCpsOCoruCosicsIGVycm9yOiAn4KiX4Kiy4Kik4KmAJywgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJywgYXJpYURvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJywgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLCBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsIGVkaXRlZDogJ+CouOCpsOCoquCovuCopuCov+CopCcgfSxcbiAgdGU6IHsgZG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLCB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLCBkb3dubG9hZGVkOiAn4LCq4LGC4LCw4LGN4LCk4LCv4LC/4LCC4LCm4LC/JywgZXJyb3I6ICfgsLLgsYvgsKrgsIInLCBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLCBhcmlhRG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJywgZWRpdGVkOiAn4LC44LC14LCw4LC/4LCC4LCa4LCs4LCh4LC/4LCC4LCm4LC/JyB9LFxuICBtcjogeyBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLCB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLCBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLCBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnIH0sXG4gIHRhOiB7IGRvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJywgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4HgrpXgrr/grrHgrqTgr4HigKYnLCB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLCBkb3dubG9hZGVkOiAn4K6u4K+B4K6f4K6/4K6o4K+N4K6k4K6k4K+BJywgZXJyb3I6ICfgrqrgrr/grrTgr4gnLCBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLCBhcmlhRG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLCB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJywgZWRpdGVkOiAn4K6k4K6/4K6w4K+B4K6k4K+N4K6k4K6q4K+N4K6q4K6f4K+N4K6f4K6k4K+BJyB9LFxuICB1cjogeyBkb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLCB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsIGRvd25sb2FkZWQ6ICfZhdqp2YXZhCcsIGVycm9yOiAn2LrZhNi324wnLCBmYWlsZWQ6ICfZhtin2qnYp9mFJywgYXJpYURvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJywgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsIGVkaXRlZDogJ9iq2LHZhduM2YUg2LTYr9uBJyB9LFxuICBndTogeyBkb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJywgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsIGRvd25sb2FkZWQ6ICfgqqrgq4LgqrDgq43gqqMnLCBlcnJvcjogJ+CqreCrguCqsicsIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsIGFyaWFEb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJywgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLCBlZGl0ZWQ6ICfgqrjgqoLgqqrgqr7gqqbgqr/gqqQnIH0sXG4gIGtuOiB7IGRvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgZG93bmxvYWRlZDogJ+CyquCzguCysOCzjeCyo+Cyl+CziuCyguCyoeCyv+CypuCzhicsIGVycm9yOiAn4LKm4LOL4LK3JywgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJywgYXJpYURvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLCBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsIGVkaXRlZDogJ+CyuOCyguCyquCyvuCypuCyv+CyuOCysuCyvuCyl+Cyv+CypuCzhicgfSxcbiAgbWw6IHsgZG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLCB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLCBkb3dubG9hZGVkOiAn4LSq4LWC4LW84LSk4LWN4LSk4LS/4LSv4LS+4LSv4LS/JywgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLCBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLCBhcmlhRG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JywgZWRpdGVkOiAn4LSO4LSh4LS/4LSx4LWN4LSx4LWB4LSa4LWG4LSv4LWN4LSk4LWBJyB9LFxuICB1azogeyBkb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLCBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLCBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJywgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJywgYXJpYURvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsIGVkaXRlZDogJ9CX0LzRltC90LXQvdC+JyB9LFxuICBlbDogeyBkb3dubG9hZDogJ86bzq7PiM63JywgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJywgZG93bmxvYWRlZDogJ86fzrvOv866zrvOt8+Bz47OuM63zrrOtScsIGVycm9yOiAnzqPPhs6szrvOvM6xJywgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJywgYXJpYURvd25sb2FkOiAnzpvOrs+IzrcnLCB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLCBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsIGVkaXRlZDogJ86Vz4DOtc6+zrXPgc6zzrHPg868zq3Ovc6/JyB9LFxuICBjczogeyBkb3dubG9hZDogJ1N0w6Fobm91dCcsIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLCB0cnlpbmc6ICdaa291xaHDrW3igKYnLCBkb3dubG9hZGVkOiAnU3Rhxb5lbm8nLCBlcnJvcjogJ0NoeWJhJywgZmFpbGVkOiAnU2VsaGFsby4nLCBhcmlhRG93bmxvYWQ6ICdTdMOhaG5vdXQnLCB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLCBjb21tZW50czogJ2tvbWVudMOhxZnFrycsIGVkaXRlZDogJ1VwcmF2ZW5vJyB9LFxuICBybzogeyBkb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJywgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsIGRvd25sb2FkZWQ6ICdGaW5hbGl6YXQnLCBlcnJvcjogJ0Vyb2FyZScsIGZhaWxlZDogJ0XImXVhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLCB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsIGNvbW1lbnRzOiAnY29tZW50YXJpaScsIGVkaXRlZDogJ01vZGlmaWNhdCcgfSxcbiAgaHU6IHsgZG93bmxvYWQ6ICdMZXTDtmx0w6lzJywgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJywgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLCBkb3dubG9hZGVkOiAnS8Opc3onLCBlcnJvcjogJ0hpYmEnLCBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsIGFyaWFEb3dubG9hZDogJ0xldMO2bHTDqXMnLCB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLCBlZGl0ZWQ6ICdTemVya2VzenR2ZScgfSxcbiAgc3Y6IHsgZG93bmxvYWQ6ICdMYWRkYSBuZXInLCBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLCB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJywgZG93bmxvYWRlZDogJ0tsYXJ0JywgZXJyb3I6ICdGZWwnLCBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJywgYXJpYURvd25sb2FkOiAnTGFkZGEgbmVyJywgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJhZCcgfSxcbiAgZGE6IHsgZG93bmxvYWQ6ICdIZW50JywgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0hlbnRldCcsIGVycm9yOiAnRmVqbCcsIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsIGFyaWFEb3dubG9hZDogJ0hlbnQnLCB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJldCcgfSxcbiAgZmk6IHsgZG93bmxvYWQ6ICdMYXRhYScsIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLCB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsIGRvd25sb2FkZWQ6ICdMYWRhdHR1JywgZXJyb3I6ICdWaXJoZScsIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLCBhcmlhRG93bmxvYWQ6ICdMYXRhYScsIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJywgY29tbWVudHM6ICdrb21tZW50dGlhJywgZWRpdGVkOiAnTXVva2F0dHUnIH0sXG4gIG5vOiB7IGRvd25sb2FkOiAnTGFzdCBuZWQnLCBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0ZlcmRpZycsIGVycm9yOiAnRmVpbCcsIGZhaWxlZDogJ01pc2x5a3Rlcy4nLCBhcmlhRG93bmxvYWQ6ICdMYXN0IG5lZCcsIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLCBjb21tZW50czogJ2tvbW1lbnRhcmVyJywgZWRpdGVkOiAnUmVkaWdlcnQnIH0sXG4gIGhlOiB7IGRvd25sb2FkOiAn15TXldeo15PXlCcsIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsIHRyeWluZzogJ9ee16DXodeU4oCmJywgZG93bmxvYWRlZDogJ9eU15XXqdec150nLCBlcnJvcjogJ9ep15LXmdeQ15QnLCBmYWlsZWQ6ICfXoNeb16nXnCcsIGFyaWFEb3dubG9hZDogJ9eU15XXqNeT15QnLCB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJywgY29tbWVudHM6ICfXqteS15XXkdeV16onLCBlZGl0ZWQ6ICfXoNei16jXmicgfSxcbiAgZmE6IHsgZG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJywgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLCBkb3dubG9hZGVkOiAn2KfZhtis2KfZhSDYtNivJywgZXJyb3I6ICfYrti32KcnLCBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLCBhcmlhRG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JywgY29tbWVudHM6ICfZhti42LEnLCBlZGl0ZWQ6ICfZiNuM2LHYp9uM2LQg2LTYr9mHJyB9LFxuICBmaWw6IHsgZG93bmxvYWQ6ICdJLWRvd25sb2FkJywgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJywgZG93bmxvYWRlZDogJ1RhcG9zIG5hJywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ05hYmlnby4nLCBhcmlhRG93bmxvYWQ6ICdJLWRvd25sb2FkJywgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLCBjb21tZW50czogJ21nYSBrb21lbnRvJywgZWRpdGVkOiAnTmEtZWRpdCcgfSxcbiAgbXM6IHsgZG93bmxvYWQ6ICdNdWF0IHR1cnVuJywgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLCB0cnlpbmc6ICdNZW5jdWJh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ1JhbGF0JywgZmFpbGVkOiAnR2FnYWwuJywgYXJpYURvd25sb2FkOiAnTXVhdCB0dXJ1bicsIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsIGNvbW1lbnRzOiAna29tZW4nLCBlZGl0ZWQ6ICdEaWVkaXQnIH0sXG4gIHNyOiB7IGRvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLCBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJywgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJywgZG93bmxvYWRlZDogJ9CX0LDQstGA0YjQtdC90L4nLCBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLCBhcmlhRG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJywgZWRpdGVkOiAn0JjQt9C80LXRmtC10L3QvicgfSxcbiAgc2s6IHsgZG93bmxvYWQ6ICdTdGlhaG51xaUnLCBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJywgdHJ5aW5nOiAnU2vDusWhYW3igKYnLCBkb3dubG9hZGVkOiAnSG90b3ZvJywgZXJyb3I6ICdDaHliYScsIGZhaWxlZDogJ1pseWhhbG8uJywgYXJpYURvd25sb2FkOiAnU3RpYWhudcWlJywgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLCBlZGl0ZWQ6ICdVcHJhdmVuw6knIH0sXG4gIGJnOiB7IGRvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLCBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsIHRyeWluZzogJ9Ce0L/QuNGC4oCmJywgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsIGVycm9yOiAn0JPRgNC10YjQutCwJywgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsIGFyaWFEb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JywgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLCBlZGl0ZWQ6ICfQoNC10LTQsNC60YLQuNGA0LDQvdC+JyB9LFxuICBocjogeyBkb3dubG9hZDogJ1ByZXV6bWknLCBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJywgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsIGRvd25sb2FkZWQ6ICdHb3Rvdm8nLCBlcnJvcjogJ0dyZcWha2EnLCBmYWlsZWQ6ICdOZXVzcGplbG8uJywgYXJpYURvd25sb2FkOiAnUHJldXptaScsIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJywgY29tbWVudHM6ICdrb21lbnRhcmEnLCBlZGl0ZWQ6ICdVcmXEkWVubycgfSxcbiAgbHQ6IHsgZG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsIHRyeWluZzogJ0JhbmRvbWHigKYnLCBkb3dubG9hZGVkOiAnQmFpZ3RhJywgZXJyb3I6ICdLbGFpZGEnLCBmYWlsZWQ6ICdOZXBhdnlrby4nLCBhcmlhRG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLCBjb21tZW50czogJ2tvbWVudGFyYWknLCBlZGl0ZWQ6ICdSZWRhZ3VvdGEnIH0sXG4gIGx2OiB7IGRvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLCB0cnlpbmc6ICdNxJPEo2luYeKApicsIGRvd25sb2FkZWQ6ICdQYWJlaWd0cycsIGVycm9yOiAnS8S8xatkYScsIGZhaWxlZDogJ05laXpkZXbEgXMuJywgYXJpYURvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsIGNvbW1lbnRzOiAna29tZW50xIFyaScsIGVkaXRlZDogJ1JlZGnEo8STdHMnIH0sXG4gIGV0OiB7IGRvd25sb2FkOiAnTGFhZGkgYWxsYScsIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJywgdHJ5aW5nOiAnUHJvb3ZpbuKApicsIGRvd25sb2FkZWQ6ICdWYWxtaXMnLCBlcnJvcjogJ1ZpZ2EnLCBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJywgYXJpYURvd25sb2FkOiAnTGFhZGkgYWxsYScsIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJywgY29tbWVudHM6ICdrb21tZW50YWFyaScsIGVkaXRlZDogJ011dWRldHVkJyB9LFxuICBzbDogeyBkb3dubG9hZDogJ1ByZW5vcycsIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLCB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLCBkb3dubG9hZGVkOiAnS29uxI1hbm8nLCBlcnJvcjogJ05hcGFrYScsIGZhaWxlZDogJ05pIHVzcGVsby4nLCBhcmlhRG93bmxvYWQ6ICdQcmVub3MnLCB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJywgY29tbWVudHM6ICdrb21lbnRhcmpldicsIGVkaXRlZDogJ1VyZWplbm8nIH0sXG4gIGNhOiB7IGRvd25sb2FkOiAnRGVzY2FycmVnYScsIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJywgdHJ5aW5nOiAnSW50ZW50YW504oCmJywgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2F0JywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ0hhIGZhbGxhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhJywgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaXMnLCBlZGl0ZWQ6ICdFZGl0YXQnIH0sXG4gIGFmOiB7IGRvd25sb2FkOiAnQWZsYWFpJywgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJywgdHJ5aW5nOiAnUHJvYmVlcuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1ay4nLCBhcmlhRG93bmxvYWQ6ICdBZmxhYWknLCB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLCBjb21tZW50czogJ2tvbW1lbnRhcmUnLCBlZGl0ZWQ6ICdHZXJlZGlnZWVyJyB9LFxuICBhbTogeyBkb3dubG9hZDogJ+GKoOGLjeGIreGLtScsIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLCBkb3dubG9hZGVkOiAn4YuI4Yit4Yu34YiNJywgZXJyb3I6ICfhiLXhiIXhibDhibUnLCBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLCBhcmlhRG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLCB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JywgZWRpdGVkOiAn4Ymw4Yi14Ymw4Yqr4Yqt4YiP4YiNJyB9LFxuICBoeTogeyBkb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLCB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsIGRvd25sb2FkZWQ6ICfUsdW+1aHWgNW/1b7VodWuJywgZXJyb3I6ICfVjdWt1aHVrCcsIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JywgYXJpYURvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJywgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JywgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLCBlZGl0ZWQ6ICfUvdW01aLVodWj1oDVvtWl1awg1acnIH0sXG4gIGFzOiB7IGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCnguCnsOCnjeCmoycsIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLCBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnIH0sXG4gIGF6OiB7IGRvd25sb2FkOiAnWcO8a2zJmScsIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsIGRvd25sb2FkZWQ6ICdCaXRkaScsIGVycm9yOiAnWMmZdGEnLCBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsIGFyaWFEb3dubG9hZDogJ1nDvGtsyZknLCB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLCBjb21tZW50czogJ8WfyZlyaCcsIGVkaXRlZDogJ0TDvHrJmWxpxZ8gZWRpbGliJyB9LFxuICBldTogeyBkb3dubG9hZDogJ0Rlc2thcmdhdHUnLCBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsIHRyeWluZzogJ1NhaWF0emVu4oCmJywgZG93bmxvYWRlZDogJ0VnaW5kYScsIGVycm9yOiAnRXJyb3JlYScsIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLCBhcmlhRG93bmxvYWQ6ICdEZXNrYXJnYXR1JywgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLCBjb21tZW50czogJ2lydXpraW4nLCBlZGl0ZWQ6ICdFZGl0YXR1YScgfSxcbiAgbXk6IHsgZG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLCB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLCBkb3dubG9hZGVkOiAn4YCV4YC84YCu4YC44YCV4YCr4YCV4YC84YCuJywgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLCBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLCBhcmlhRG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JywgZWRpdGVkOiAn4YCV4YC84YCE4YC64YCG4YCE4YC64YCV4YC84YCu4YC4JyB9LFxuICBnbDogeyBkb3dubG9hZDogJ0Rlc2NhcmdhcicsIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLCB0cnlpbmc6ICdUZW50YW5kb+KApicsIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsbG91LicsIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJywgY29tbWVudHM6ICdjb21lbnRhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gIGthOiB7IGRvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLCB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLCBkb3dubG9hZGVkOiAn4YOT4YOQ4YOh4YOg4YOj4YOa4YOT4YOQJywgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLCBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsIGFyaWFEb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLCBlZGl0ZWQ6ICfhg6Dhg5Thg5Phg5Dhg6Xhg6Lhg5jhg6Dhg5Thg5Hhg6Phg5rhg5jhg5AnIH0sXG4gIGlzOiB7IGRvd25sb2FkOiAnU8Oma2phJywgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLCB0cnlpbmc6ICdSZXluaeKApicsIGRvd25sb2FkZWQ6ICdTw7N0dCcsIGVycm9yOiAnVmlsbGEnLCBmYWlsZWQ6ICdNaXN0w7Nrc3QuJywgYXJpYURvd25sb2FkOiAnU8Oma2phJywgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsIGNvbW1lbnRzOiAndW1tw6ZsaScsIGVkaXRlZDogJ0JyZXl0dCcgfSxcbiAgZ2E6IHsgZG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJywgZG93bmxvYWRlZDogJ8ONb3Nsw7Nkw6FpbHRlJywgZXJyb3I6ICdFYXJyw6FpZCcsIGZhaWxlZDogJ1RoZWlwIGFpci4nLCBhcmlhRG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLCBjb21tZW50czogJ3Ryw6FjaHQnLCBlZGl0ZWQ6ICdFYWdyYWl0aGUnIH0sXG4gIGtrOiB7IGRvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJywgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJywgZG93bmxvYWRlZDogJ9CQ0Y/Sm9GC0LDQu9C00YsnLCBlcnJvcjogJ9Ka0LDRgtC1JywgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsIGFyaWFEb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLCB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsIGVkaXRlZDogJ9Oo0LfQs9C10YDRgtGW0LvQtNGWJyB9LFxuICBrbTogeyBkb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJywgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJywgZG93bmxvYWRlZDogJ+GelOGetuGek+GelOGeieGfkuGeheGelOGfiycsIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJywgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJywgYXJpYURvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJywgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JywgZWRpdGVkOiAn4Z6U4Z624Z6T4Z6A4Z+C4Z6f4Z6Y4Z+S4Z6a4Z694Z6bJyB9LFxuICBsbzogeyBkb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJywgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJywgZG93bmxvYWRlZDogJ+C6quC6s+C7gOC6peC6seC6lCcsIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJywgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJywgYXJpYURvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJywgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJywgZWRpdGVkOiAn4LuB4LqB4LuJ4LuE4LqC4LuB4Lql4LuJ4LqnJyB9LFxuICBtazogeyBkb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JywgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLCB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLCBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JywgZXJyb3I6ICfQk9GA0LXRiNC60LAnLCBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJywgYXJpYURvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLCB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLCBlZGl0ZWQ6ICfQmNC30LzQtdC90LXRgtC+JyB9LFxuICBtbjogeyBkb3dubG9hZDogJ9Ci0LDRgtCw0YUnLCBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJywgZG93bmxvYWRlZDogJ9Ci0LDRgtGB0LDQvScsIGVycm9yOiAn0JDQu9C00LDQsCcsIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLCBhcmlhRG93bmxvYWQ6ICfQotCw0YLQsNGFJywgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJywgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLCBlZGl0ZWQ6ICfQl9Cw0YHRgdCw0L0nIH0sXG4gIG5lOiB7IGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJywgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpL4g4KSt4KSv4KWLJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsIGVkaXRlZDogJ+CkuOCkruCljeCkquCkvuCkpuCkv+CkpCcgfSxcbiAgb3I6IHsgZG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLCBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLCB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJywgZG93bmxvYWRlZDogJ+CsuOCsruCtjeCsquCtguCssOCtjeCso+CtjeCsoycsIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JywgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsIGFyaWFEb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJywgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLCBlZGl0ZWQ6ICfgrLjgrK7grY3grKrgrL7grKbgrL/grKQnIH0sXG4gIHNpOiB7IGRvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJywgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJywgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsIGRvd25sb2FkZWQ6ICfgtoXgt4Dgt4PgtrHgt4onLCBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsIGFyaWFEb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJywgZWRpdGVkOiAn4LeD4LaC4LeD4LeK4Laa4La74Lar4La6JyB9LFxuICBzdzogeyBkb3dubG9hZDogJ1Bha3VhJywgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsIHRyeWluZzogJ0luYWphcmlideKApicsIGRvd25sb2FkZWQ6ICdJbWVrYW1pbGlrYScsIGVycm9yOiAnSGl0aWxhZnUnLCBmYWlsZWQ6ICdJbWVzaGluZHdhLicsIGFyaWFEb3dubG9hZDogJ1Bha3VhJywgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsIGNvbW1lbnRzOiAnbWFvbmknLCBlZGl0ZWQ6ICdJbWVoYXJpcml3YScgfSxcbiAgdXo6IHsgZG93bmxvYWQ6ICdZdWtsYXNoJywgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJywgZG93bmxvYWRlZDogJ1RheXlvcicsIGVycm9yOiAnWGF0bycsIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLCBhcmlhRG93bmxvYWQ6ICdZdWtsYXNoJywgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJywgY29tbWVudHM6ICdzaGFyaGxhcicsIGVkaXRlZDogJ1RhaHJpcmxhbmdhbicgfSxcbiAgY3k6IHsgZG93bmxvYWQ6ICdMYXdybHd5dGhvJywgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJywgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJywgZG93bmxvYWRlZDogJ1dlZGkgZ29yZmZlbicsIGVycm9yOiAnR3dhbGwnLCBmYWlsZWQ6ICdNZXRob2RkLicsIGFyaWFEb3dubG9hZDogJ0xhd3Jsd3l0aG8nLCB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLCBjb21tZW50czogJ3N5bHdhZGF1JywgZWRpdGVkOiAnR29seWd3eWQnIH0sXG4gIHp1OiB7IGRvd25sb2FkOiAnTGFuZGEnLCBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsIHRyeWluZzogJ0l5YXphbWHigKYnLCBkb3dubG9hZGVkOiAnSWxhbmTEq3dlJywgZXJyb3I6ICdJcGh1dGhhJywgZmFpbGVkOiAnSWhsdWxla2lsZS4nLCBhcmlhRG93bmxvYWQ6ICdMYW5kYScsIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsIGNvbW1lbnRzOiAnYW1hendhbmEnLCBlZGl0ZWQ6ICdLdWhsZWxpd2UnIH0sXG4gIHNxOiB7IGRvd25sb2FkOiAnU2hrYXJrbycsIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLCB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLCBkb3dubG9hZGVkOiAnUMOrcmZ1bmRvaScsIGVycm9yOiAnR2FiaW0nLCBmYWlsZWQ6ICdEw6tzaHRvaS4nLCBhcmlhRG93bmxvYWQ6ICdTaGthcmtvJywgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLCBjb21tZW50czogJ2tvbWVudGUnLCBlZGl0ZWQ6ICdFIHJlZGFrdHVhcicgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZykge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCc7JylbMF0udHJpbSgpLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbYmFzZUxhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbJ2VuJ10gJiYgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG5cbiAgfSBjYXRjaCAoZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59IiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHNcblxuLyoqXG4gKiBUSEVNRSBERVRFQ1RPUlxuICpcbiAqIEdvYWw6IFwiSXMgdGhlIGNvbnRlbnQgSSdtIGRyYXdpbmcgb24gdmlzdWFsbHkgZGFyayBvciBsaWdodD9cIlxuICogSW5zdGVhZCBvZiBndWVzc2luZyBmcm9tIDxib2R5Piwgd2U6XG4gKiAgLSBSZXNwZWN0IERhcmsgUmVhZGVyIGlmIHByZXNlbnRcbiAqICAtIExvb2sgZm9yIG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzXG4gKiAgLSBNZWFzdXJlIHRoZSBlZmZlY3RpdmUgYmFja2dyb3VuZCBjb2xvciBvZiBhICpjb250ZW50KiBlbGVtZW50XG4gKiAgICAoZS5nLiBHb29nbGUgQ2xhc3Nyb29tIHN0cmVhbSBjYXJkcylcbiAqL1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFnZSAqY29udGVudCBhcmVhKiBpcyB2aXN1YWxseSBkYXJrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQYWdlRGFyaygpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAxLiBGYXN0IHBhdGg6IERhcmsgUmVhZGVyIGF0dHJpYnV0ZVxuICBjb25zdCBkclNjaGVtZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnKTtcbiAgaWYgKGRyU2NoZW1lID09PSAnZGFyaycpIHJldHVybiB0cnVlO1xuICBpZiAoZHJTY2hlbWUgPT09ICdsaWdodCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAyLiBIZXVyaXN0aWM6IG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzIG9uIDxodG1sPiAvIDxib2R5PlxuICAvLyAoY292ZXJzIHNvbWUgZnJhbWV3b3JrcyBhbmQgZXh0ZW5zaW9ucylcbiAgY29uc3QgZGFya1Rva2VucyA9IFsnZGFyaycsICdkYXJrLXRoZW1lJywgJ3RoZW1lLWRhcmsnLCAnbmlnaHQnLCAnZ20zLWRhcmstdGhlbWUnXTtcbiAgY29uc3QgaHRtbENsYXNzID0gKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGJvZHlDbGFzcyA9IChkb2N1bWVudC5ib2R5LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGRhcmtUb2tlbnMuc29tZSh0b2tlbiA9PiBodG1sQ2xhc3MuaW5jbHVkZXModG9rZW4pIHx8IGJvZHlDbGFzcy5pbmNsdWRlcyh0b2tlbikpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyAzLiBQcm9iZSBhICpjb250ZW50KiBlbGVtZW50LCBub3QgdGhlIHdob2xlIHBhZ2UgYmFja2dyb3VuZC5cbiAgLy8gICAgRm9yIENsYXNzcm9vbSwgcG9zdHMgYXJlIHRoZSBtYWluIHN1cmZhY2Ugd2UgZHJhdyBvbi5cbiAgY29uc3QgcHJvYmVFbCA9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXScpIHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tyb2xlPVwibWFpblwiXScpIHx8XG4gICAgZG9jdW1lbnQuYm9keTtcblxuICBjb25zdCBiZ0NvbG9yID0gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHByb2JlRWwpO1xuICBjb25zdCBicmlnaHRuZXNzID0gcGFyc2VCcmlnaHRuZXNzKGJnQ29sb3IpO1xuXG4gIC8vIDQuIERlY2lkZSB0aHJlc2hvbGQuXG4gIC8vICAgIDEyOCBpcyBcIjUwJSBncmF5XCIsIGJ1dCB0aGF0IGZsaXBzIHRvbyBlYXJseSBvbiBzbGlnaHRseSBncmF5IFVJcy5cbiAgLy8gICAgVXNlIGEgc3RyaWN0ZXIgdGhyZXNob2xkIHNvIHdlIG9ubHkgdHJlYXQgY2xlYXJseSBkYXJrIFVJcyBhcyBkYXJrLlxuICByZXR1cm4gYnJpZ2h0bmVzcyA8IDEwNTtcbn1cblxuLyoqXG4gKiBXYWxrcyB1cCB0aGUgRE9NIGZyb20gYSBnaXZlbiBlbGVtZW50IHVudGlsIGl0IGZpbmRzIGEgbm9uLXRyYW5zcGFyZW50IGJhY2tncm91bmQgY29sb3IuXG4gKiBGYWxscyBiYWNrIHRvIDxodG1sPiBhbmQgZmluYWxseSB0byBwdXJlIHdoaXRlLlxuICovXG5mdW5jdGlvbiBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3Ioc3RhcnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBzdGFydDtcblxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gKGM6IHN0cmluZyB8IG51bGwpID0+XG4gICAgIWMgfHwgYyA9PT0gJ3RyYW5zcGFyZW50JyB8fCBjID09PSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgY29uc3QgYmcgPSBzdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgaWYgKCFpc1RyYW5zcGFyZW50KGJnKSkgcmV0dXJuIGJnO1xuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIC8vIFRyeSA8aHRtbD4gYXMgYSBsYXN0IHJlYWwgZWxlbWVudFxuICBjb25zdCBodG1sU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuICBjb25zdCBodG1sQmcgPSBodG1sU3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICBpZiAoIWlzVHJhbnNwYXJlbnQoaHRtbEJnKSkgcmV0dXJuIGh0bWxCZztcblxuICAvLyBBYnNvbHV0ZSBmYWxsYmFjazogYXNzdW1lIHdoaXRlXG4gIHJldHVybiAncmdiKDI1NSwgMjU1LCAyNTUpJztcbn1cblxuLyoqXG4gKiBIZWxwZXI6IENhbGN1bGF0ZXMgYnJpZ2h0bmVzcyAoMC0yNTUpIGZyb20gYW4gUkdCKEEpIHN0cmluZy5cbiAqIFVzZXMgdGhlIEhTUCBjb2xvciBmb3JtdWxhOiBzcXJ0KDAuMjk5KlJeMiArIDAuNTg3KkdeMiArIDAuMTE0KkJeMilcbiAqL1xuZnVuY3Rpb24gcGFyc2VCcmlnaHRuZXNzKHJnYlN0cmluZzogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgbWF0Y2ggPSByZ2JTdHJpbmcubWF0Y2goLyhcXGQrKSxcXHMqKFxcZCspLFxccyooXFxkKykvKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIC8vIElmIHdlIGNhbid0IHBhcnNlIGl0LCBhc3N1bWUgYnJpZ2h0IHNvIHdlIGRvbid0IGFjY2lkZW50YWxseSBmbGlwIHRvIGRhcmsgbW9kZS5cbiAgICByZXR1cm4gMjU1O1xuICB9XG5cbiAgY29uc3QgciA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIGNvbnN0IGcgPSBwYXJzZUludChtYXRjaFsyXSwgMTApO1xuICBjb25zdCBiID0gcGFyc2VJbnQobWF0Y2hbM10sIDEwKTtcblxuICAvLyBIU1AgZXF1YXRpb24gaXMgcGVyY2VpdmVkIGJyaWdodG5lc3NcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IE1hdGguc3FydChcbiAgICAwLjI5OSAqIChyICogcikgK1xuICAgIDAuNTg3ICogKGcgKiBnKSArXG4gICAgMC4xMTQgKiAoYiAqIGIpXG4gICk7XG5cbiAgcmV0dXJuIGJyaWdodG5lc3M7XG59XG5cbi8qKlxuICogV2F0Y2hlcjogTm90aWZpZXMgeW91IHdoZW4gdGhlIHRoZW1lIGxpa2VseSBjaGFuZ2VkLlxuICpcbiAqIFlvdSBjYW4gdXNlIHRoaXMgaWYgeW91IGV2ZXIgd2FudCB0byBkeW5hbWljYWxseSByZS1zdHlsZSB0aGluZ3NcbiAqIHdoZW4gdGhlIHVzZXIgLyBleHRlbnNpb24gdG9nZ2xlcyB0aGVtZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoVGhlbWVDaGFuZ2VzKGNhbGxiYWNrOiAoaXNEYXJrOiBib29sZWFuKSA9PiB2b2lkKTogTXV0YXRpb25PYnNlcnZlciB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoKSA9PiB7XG4gICAgY2FsbGJhY2soaXNQYWdlRGFyaygpKTtcbiAgfTtcblxuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZXIpO1xuXG4gIC8vIFdhdGNoIGZvciBhdHRyaWJ1dGUvY2xhc3MgY2hhbmdlcyBvbiA8aHRtbD4gYW5kIDxib2R5PlxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnLCAnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgLy8gQWxzbyBsaXN0ZW4gdG8gc3lzdGVtIHRoZW1lIGNoYW5nZXMgYXMgYSBiYWNrdXAgc2lnbmFsXG4gIGlmICh0eXBlb2Ygd2luZG93Lm1hdGNoTWVkaWEgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjb25zdCBtcSA9IHdpbmRvdy5tYXRjaE1lZGlhKCcocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspJyk7XG4gICAgaWYgKG1xKSB7XG4gICAgICBjb25zdCBtcUxpc3RlbmVyID0gKCkgPT4gaGFuZGxlcigpO1xuICAgICAgLy8gTW9kZXJuIGJyb3dzZXJzXG4gICAgICBpZiAoKG1xIGFzIGFueSkuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBtcS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBtcUxpc3RlbmVyKTtcbiAgICAgIH0gZWxzZSBpZiAoKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIpIHtcbiAgICAgICAgLy8gTGVnYWN5IEFQSVxuICAgICAgICAobXEgYXMgYW55KS5hZGRMaXN0ZW5lcihtcUxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsIGNhbGwgc28gdGhlIGNvbnN1bWVyIGNhbiBzeW5jIGltbWVkaWF0ZWx5XG4gIGhhbmRsZXIoKTtcblxuICByZXR1cm4gb2JzZXJ2ZXI7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvZG93bmxvYWRfYWxsLmNvbnRlbnQudHNcblxuaW1wb3J0IHsgaW5qZWN0U3R5bGVzIH0gZnJvbSAnLi9jb250ZW50L3N0eWxlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9jb250ZW50L2kxOG4nO1xuaW1wb3J0IHsgaXNQYWdlRGFyayB9IGZyb20gJy4vY29udGVudC90aGVtZSc7XG5cbmNvbnN0IERPV05MT0FEX0JUTl9TRUxFQ1RPUiA9ICcuY3FkLWRvd25sb2FkLWJ0bic7XG5jb25zdCBHUk9VUF9TRUxFQ1RPUiA9ICdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nO1xuY29uc3QgSU5KRUNURURfQVRUUiA9ICdkYXRhLWNxZC1pbmplY3RlZCc7XG5cbnR5cGUgQnV0dG9uU3RhdGUgPSAnaWRsZScgfCAnbG9hZGluZycgfCAndHJ5aW5nJyB8ICdzdWNjZXNzJyB8ICdlcnJvcic7XG5cbmludGVyZmFjZSBHcm91cFN0YXRlIHtcbiAgcm9vdDogSFRNTEVsZW1lbnQ7XG4gIGJ1dHRvbnM6IFNldDxIVE1MQnV0dG9uRWxlbWVudD47XG4gIGRvd25sb2FkQWxsQnRuOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG4gIGFjdGl2YXRlZDogYm9vbGVhbjtcbiAgY29sb3JzPzoge1xuICAgIG5vcm1hbDogc3RyaW5nO1xuICAgIHN1Y2Nlc3M6IHN0cmluZztcbiAgfTtcbn1cblxuY29uc3QgZ3JvdXBTdGF0ZXMgPSBuZXcgV2Vha01hcDxIVE1MRWxlbWVudCwgR3JvdXBTdGF0ZT4oKTtcbmNvbnN0IGJ1dHRvblRvR3JvdXAgPSBuZXcgV2Vha01hcDxIVE1MQnV0dG9uRWxlbWVudCwgR3JvdXBTdGF0ZT4oKTtcblxuY29uc3QgZGlydHlHcm91cHMgPSBuZXcgU2V0PEdyb3VwU3RhdGU+KCk7XG5sZXQgcmVmcmVzaFNjaGVkdWxlZCA9IGZhbHNlO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL2NsYXNzcm9vbS5nb29nbGUuY29tLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgbWFpbigpIHtcbiAgICBpbmplY3RTdHlsZXMoKTtcbiAgICBzYWZlU2V0RGlyZWN0aW9uKCk7XG5cbiAgICAvLyBJbml0aWFsIHNjYW5cbiAgICByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUoZG9jdW1lbnQpO1xuXG4gICAgLy8gT2JzZXJ2ZSBmb3IgbmV3IGRvd25sb2FkIGJ1dHRvbnMgJiBzdGF0ZSBjaGFuZ2VzXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigobXV0YXRpb25zKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IG0gb2YgbXV0YXRpb25zKSB7XG4gICAgICAgIGlmIChtLnR5cGUgPT09ICdjaGlsZExpc3QnKSB7XG4gICAgICAgICAgbS5hZGRlZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHJldHVybjtcbiAgICAgICAgICAgIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShub2RlKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG0ucmVtb3ZlZE5vZGVzLmZvckVhY2goKG5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHJldHVybjtcbiAgICAgICAgICAgIGNsZWFudXBSZW1vdmVkQnV0dG9ucyhub2RlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtLnR5cGUgPT09ICdhdHRyaWJ1dGVzJykge1xuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IG0udGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHRhcmdldCBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50ICYmXG4gICAgICAgICAgICB0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtZG93bmxvYWQtYnRuJylcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZW5zdXJlQnV0dG9uUmVnaXN0ZXJlZCh0YXJnZXQpO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgIG1hcmtHcm91cERpcnR5KGdyb3VwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgc2NoZWR1bGVSZWZyZXNoKCk7XG4gICAgfSk7XG5cbiAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHtcbiAgICAgIGNoaWxkTGlzdDogdHJ1ZSxcbiAgICAgIHN1YnRyZWU6IHRydWUsXG4gICAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgICAgYXR0cmlidXRlRmlsdGVyOiBbJ2NsYXNzJ10sXG4gICAgfSk7XG5cbiAgICAvLyBTbG93IGJhY2t1cCBpbiBjYXNlIHNvbWV0aGluZyBzbGlwcyB0aHJvdWdoXG4gICAgd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHJlZ2lzdGVyQnV0dG9uc0luU3VidHJlZShkb2N1bWVudCk7XG4gICAgICBzY2hlZHVsZVJlZnJlc2goKTtcbiAgICB9LCA0MDAwKTtcbiAgfSxcbn0pO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogR3JvdXAgKyBidXR0b24gZGlzY292ZXJ5XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiByZWdpc3RlckJ1dHRvbnNJblN1YnRyZWUocm9vdDogSFRNTEVsZW1lbnQgfCBEb2N1bWVudCk6IHZvaWQge1xuICAvLyBJZiByb290IGl0c2VsZiBpcyBhIGRvd25sb2FkIGJ1dHRvblxuICBpZiAoXG4gICAgcm9vdCBpbnN0YW5jZW9mIEhUTUxCdXR0b25FbGVtZW50ICYmXG4gICAgcm9vdC5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1kb3dubG9hZC1idG4nKVxuICApIHtcbiAgICByZWdpc3RlclNpbmdsZUJ1dHRvbihyb290KTtcbiAgfVxuXG4gIGNvbnN0IGJ1dHRvbnMgPSByb290LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEJ1dHRvbkVsZW1lbnQ+KERPV05MT0FEX0JUTl9TRUxFQ1RPUik7XG4gIGJ1dHRvbnMuZm9yRWFjaCgoYnRuKSA9PiByZWdpc3RlclNpbmdsZUJ1dHRvbihidG4pKTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJTaW5nbGVCdXR0b24oYnRuOiBIVE1MQnV0dG9uRWxlbWVudCk6IHZvaWQge1xuICBpZiAoIWJ0bi5pc0Nvbm5lY3RlZCkgcmV0dXJuO1xuXG4gIC8vIElmIHdlIGFscmVhZHkga25vdyB0aGlzIGJ1dHRvbiwgd2XigJlyZSBkb25lXG4gIGlmIChidXR0b25Ub0dyb3VwLmhhcyhidG4pKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZ3JvdXBSb290ID0gZmluZEdyb3VwUm9vdChidG4pO1xuICBpZiAoIWdyb3VwUm9vdCkgcmV0dXJuO1xuXG4gIGxldCBncm91cCA9IGdyb3VwU3RhdGVzLmdldChncm91cFJvb3QpO1xuICBpZiAoIWdyb3VwKSB7XG4gICAgZ3JvdXAgPSB7XG4gICAgICByb290OiBncm91cFJvb3QsXG4gICAgICBidXR0b25zOiBuZXcgU2V0PEhUTUxCdXR0b25FbGVtZW50PigpLFxuICAgICAgZG93bmxvYWRBbGxCdG46IG51bGwsXG4gICAgICBhY3RpdmF0ZWQ6IGZhbHNlLFxuICAgIH07XG4gICAgZ3JvdXBTdGF0ZXMuc2V0KGdyb3VwUm9vdCwgZ3JvdXApO1xuICB9XG5cbiAgZ3JvdXAuYnV0dG9ucy5hZGQoYnRuKTtcbiAgYnV0dG9uVG9Hcm91cC5zZXQoYnRuLCBncm91cCk7XG4gIG1hcmtHcm91cERpcnR5KGdyb3VwKTtcbn1cblxuZnVuY3Rpb24gZW5zdXJlQnV0dG9uUmVnaXN0ZXJlZChidG46IEhUTUxCdXR0b25FbGVtZW50KTogR3JvdXBTdGF0ZSB8IG51bGwge1xuICBsZXQgZ3JvdXAgPSBidXR0b25Ub0dyb3VwLmdldChidG4pO1xuICBpZiAoIWdyb3VwKSB7XG4gICAgcmVnaXN0ZXJTaW5nbGVCdXR0b24oYnRuKTtcbiAgICBncm91cCA9IGJ1dHRvblRvR3JvdXAuZ2V0KGJ0bikgfHwgbnVsbDtcbiAgfVxuICByZXR1cm4gZ3JvdXA7XG59XG5cbmZ1bmN0aW9uIGNsZWFudXBSZW1vdmVkQnV0dG9ucyhyb290OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICBjb25zdCByZW1vdmVkQnV0dG9ucyA9IHJvb3QubWF0Y2hlcyhET1dOTE9BRF9CVE5fU0VMRUNUT1IpXG4gICAgPyBbcm9vdCBhcyBIVE1MQnV0dG9uRWxlbWVudF1cbiAgICA6IEFycmF5LmZyb20ocm9vdC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxCdXR0b25FbGVtZW50PihET1dOTE9BRF9CVE5fU0VMRUNUT1IpKTtcblxuICByZW1vdmVkQnV0dG9ucy5mb3JFYWNoKChidG4pID0+IHtcbiAgICBjb25zdCBncm91cCA9IGJ1dHRvblRvR3JvdXAuZ2V0KGJ0bik7XG4gICAgaWYgKCFncm91cCkgcmV0dXJuO1xuICAgIGdyb3VwLmJ1dHRvbnMuZGVsZXRlKGJ0bik7XG4gICAgYnV0dG9uVG9Hcm91cC5kZWxldGUoYnRuKTtcbiAgICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmaW5kR3JvdXBSb290KGJ0bjogSFRNTEVsZW1lbnQpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuICAvLyBQcmVmZXIgYSBzdHJlYW0gcG9zdCBjYXJkXG4gIGNvbnN0IHBvc3QgPSBidG4uY2xvc2VzdDxIVE1MRWxlbWVudD4oR1JPVVBfU0VMRUNUT1IpO1xuICBpZiAocG9zdCkgcmV0dXJuIHBvc3Q7XG5cbiAgLy8gRmFsbGJhY2s6IGRldGFpbHMgcGFnZSBtYWluIGNvbnRlbnRcbiAgY29uc3QgbWFpbiA9XG4gICAgYnRuLmNsb3Nlc3Q8SFRNTEVsZW1lbnQ+KCdtYWluJykgfHxcbiAgICBidG4uY2xvc2VzdDxIVE1MRWxlbWVudD4oJ2Rpdltyb2xlPVwibWFpblwiXScpO1xuICBpZiAobWFpbikgcmV0dXJuIG1haW47XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBSZWZyZXNoIHBpcGVsaW5lXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBtYXJrR3JvdXBEaXJ0eShncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICBkaXJ0eUdyb3Vwcy5hZGQoZ3JvdXApO1xufVxuXG5mdW5jdGlvbiBzY2hlZHVsZVJlZnJlc2goKTogdm9pZCB7XG4gIGlmIChyZWZyZXNoU2NoZWR1bGVkKSByZXR1cm47XG4gIHJlZnJlc2hTY2hlZHVsZWQgPSB0cnVlO1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgIHJlZnJlc2hTY2hlZHVsZWQgPSBmYWxzZTtcbiAgICBkaXJ0eUdyb3Vwcy5mb3JFYWNoKHVwZGF0ZUdyb3VwU3RhdGUpO1xuICAgIGRpcnR5R3JvdXBzLmNsZWFyKCk7XG4gIH0pO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogR3JvdXAgc3RhdGUgY29tcHV0YXRpb24gJiBVSVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gdXBkYXRlR3JvdXBTdGF0ZShncm91cDogR3JvdXBTdGF0ZSk6IHZvaWQge1xuICAvLyBQcnVuZSBkaXNjb25uZWN0ZWQgYnV0dG9uc1xuICBmb3IgKGNvbnN0IGJ0biBvZiBBcnJheS5mcm9tKGdyb3VwLmJ1dHRvbnMpKSB7XG4gICAgaWYgKCFidG4uaXNDb25uZWN0ZWQpIHtcbiAgICAgIGdyb3VwLmJ1dHRvbnMuZGVsZXRlKGJ0bik7XG4gICAgICBidXR0b25Ub0dyb3VwLmRlbGV0ZShidG4pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHRvdGFsID0gZ3JvdXAuYnV0dG9ucy5zaXplO1xuXG4gIGlmICh0b3RhbCA8PSAyKSB7XG4gICAgLy8gTm90IGVub3VnaCBmaWxlcyDihpIgcmVtb3ZlIFwiRG93bmxvYWQgYWxsXCJcbiAgICBpZiAoZ3JvdXAuZG93bmxvYWRBbGxCdG4gJiYgZ3JvdXAuZG93bmxvYWRBbGxCdG4uaXNDb25uZWN0ZWQpIHtcbiAgICAgIGdyb3VwLmRvd25sb2FkQWxsQnRuLnJlbW92ZSgpO1xuICAgIH1cbiAgICBncm91cC5kb3dubG9hZEFsbEJ0biA9IG51bGw7XG4gICAgZ3JvdXAuYWN0aXZhdGVkID0gZmFsc2U7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgYnRuID0gZW5zdXJlRG93bmxvYWRBbGxCdXR0b24oZ3JvdXApO1xuXG4gIC8vIENvbXB1dGUgY291bnRzIGZyb20gcGVyLWZpbGUgYnV0dG9uc1xuICBsZXQgZG93bmxvYWRlZCA9IDA7XG4gIGxldCBmYWlsZWQgPSAwO1xuICBsZXQgaW5Qcm9ncmVzcyA9IDA7XG5cbiAgZm9yIChjb25zdCBmaWxlQnRuIG9mIGdyb3VwLmJ1dHRvbnMpIHtcbiAgICBpZiAoIWZpbGVCdG4uaXNDb25uZWN0ZWQpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgY2xzID0gZmlsZUJ0bi5jbGFzc0xpc3Q7XG4gICAgY29uc3QgaXNMb2FkaW5nID1cbiAgICAgIGNscy5jb250YWlucygnY3FkLWxvYWRpbmcnKSB8fCBjbHMuY29udGFpbnMoJ2NxZC10cnlpbmcnKTtcbiAgICBjb25zdCBpc1N1Y2Nlc3MgPSBjbHMuY29udGFpbnMoJ2NxZC1zdWNjZXNzJyk7XG4gICAgY29uc3QgaXNFcnJvciA9IGNscy5jb250YWlucygnY3FkLWVycm9yJyk7XG4gICAgY29uc3QgcHJldkRvbmUgPSBmaWxlQnRuLmRhdGFzZXQuY3FkQWxsRG9uZSA9PT0gJ3RydWUnO1xuXG4gICAgLy8gUGVyc2lzdGVudCBcImRvbmVcIiBmbGFnXG4gICAgaWYgKGlzTG9hZGluZykge1xuICAgICAgLy8gTmV3IGRvd25sb2FkIGF0dGVtcHQg4oaSIHJlc2V0IGFueSBwcmV2aW91cyBkb25lIGZsYWdcbiAgICAgIGlmIChwcmV2RG9uZSkgZmlsZUJ0bi5kYXRhc2V0LmNxZEFsbERvbmUgPSAnZmFsc2UnO1xuICAgIH0gZWxzZSBpZiAoaXNTdWNjZXNzKSB7XG4gICAgICBmaWxlQnRuLmRhdGFzZXQuY3FkQWxsRG9uZSA9ICd0cnVlJztcbiAgICB9XG5cbiAgICBjb25zdCBkb25lID0gZmlsZUJ0bi5kYXRhc2V0LmNxZEFsbERvbmUgPT09ICd0cnVlJztcbiAgICBpZiAoZG9uZSkgZG93bmxvYWRlZCsrO1xuICAgIGlmIChpc0Vycm9yKSBmYWlsZWQrKztcbiAgICBpZiAoaXNMb2FkaW5nKSBpblByb2dyZXNzKys7XG4gIH1cblxuICBjb25zdCBub25lU3RhcnRlZCA9XG4gICAgZG93bmxvYWRlZCA9PT0gMCAmJiBmYWlsZWQgPT09IDAgJiYgaW5Qcm9ncmVzcyA9PT0gMDtcbiAgY29uc3QgYWxsU3VjY2VlZGVkID0gZG93bmxvYWRlZCA9PT0gdG90YWwgJiYgZmFpbGVkID09PSAwICYmIHRvdGFsID4gMDtcbiAgY29uc3QgYWxsQ29tcGxldGVkID1cbiAgICBkb3dubG9hZGVkICsgZmFpbGVkID09PSB0b3RhbCAmJiBpblByb2dyZXNzID09PSAwICYmIHRvdGFsID4gMDtcblxuICBpZiAoIWdyb3VwLmFjdGl2YXRlZCkge1xuICAgIGlmICghbm9uZVN0YXJ0ZWQpIHtcbiAgICAgIGdyb3VwLmFjdGl2YXRlZCA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbWFpblNwYW4gPSBidG4ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtYWxsLW1haW4nKTtcbiAgY29uc3Qgc3ViU3BhbiA9IGJ0bi5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PignLmNxZC1kb3dubG9hZC1hbGwtc3ViJyk7XG4gIGlmICghbWFpblNwYW4gfHwgIXN1YlNwYW4pIHJldHVybjtcblxuICAvLyAtLS0gSWRsZSAocHJlLWNsaWNrKSB2aWV3IC0tLVxuICBpZiAoIWdyb3VwLmFjdGl2YXRlZCB8fCBub25lU3RhcnRlZCkge1xuICAgIGdyb3VwLmFjdGl2YXRlZCA9IGdyb3VwLmFjdGl2YXRlZCAmJiAhbm9uZVN0YXJ0ZWQ7XG4gICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgYnRuLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnO1xuICAgIG1haW5TcGFuLnRleHRDb250ZW50ID0gdCgnZG93bmxvYWRBbGwnKSB8fCAnRG93bmxvYWQgYWxsJztcbiAgICBzdWJTcGFuLnRleHRDb250ZW50ID0gYCR7dG90YWx9IGZpbGVzYDtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyAtLS0gQWN0aXZlL3Byb2dyZXNzIHZpZXcgLS0tXG4gIGxldCBtYWluVGV4dDogc3RyaW5nO1xuICBsZXQgc3ViVGV4dDogc3RyaW5nO1xuXG4gIGlmIChhbGxTdWNjZWVkZWQpIHtcbiAgICAvLyBBbGwgZ29vZCDwn46JXG4gICAgbWFpblRleHQgPSB0KCdkb3dubG9hZGVkJykgfHwgJ0Rvd25sb2FkZWQnO1xuICAgIHN1YlRleHQgPSBgJHtkb3dubG9hZGVkfSAvICR7dG90YWx9YDtcbiAgfSBlbHNlIGlmIChhbGxDb21wbGV0ZWQgJiYgZmFpbGVkID4gMCkge1xuICAgIC8vIEZpbmlzaGVkLCBidXQgc29tZSBlcnJvcnNcbiAgICBtYWluVGV4dCA9IHQoJ2Rvd25sb2FkZWQnKSB8fCAnRG93bmxvYWRlZCc7XG4gICAgaWYgKGRvd25sb2FkZWQgPT09IDApIHtcbiAgICAgIC8vIEV2ZXJ5dGhpbmcgZmFpbGVkXG4gICAgICBtYWluVGV4dCA9IHQoJ2Vycm9yJykgfHwgJ0Vycm9yJztcbiAgICAgIHN1YlRleHQgPSBgJHtmYWlsZWR9IGZhaWxlZGA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1YlRleHQgPSBgJHtkb3dubG9hZGVkfSBvaywgJHtmYWlsZWR9IGZhaWxlZGA7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIE1peGVkIGluLXByb2dyZXNzIHN0YXRlXG4gICAgbWFpblRleHQgPSB0KCdkb3dubG9hZGluZycpIHx8ICdEb3dubG9hZGluZ+KApic7XG5cbiAgICBpZiAoZmFpbGVkID09PSAwKSB7XG4gICAgICAvLyBTaW1wbGUgcHJvZ3Jlc3M6IDMgLT4gMTBcbiAgICAgIHN1YlRleHQgPSBgJHtkb3dubG9hZGVkfSAtPiAke3RvdGFsfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByb2dyZXNzICsgZmFpbHVyZXNcbiAgICAgIHN1YlRleHQgPSBgJHtkb3dubG9hZGVkfSAtPiAke3RvdGFsfSAoJHtmYWlsZWR9IGZhaWxlZClgO1xuICAgIH1cbiAgfVxuXG4gIG1haW5TcGFuLnRleHRDb250ZW50ID0gbWFpblRleHQ7XG4gIHN1YlNwYW4udGV4dENvbnRlbnQgPSBzdWJUZXh0O1xuXG4gIC8vIEdyYWRpZW50IGJhc2VkIG9uIHN1Y2Nlc3MgcmF0aW9cbiAgY29uc3Qgc3VjY2Vzc1JhdGlvID0gdG90YWwgPiAwID8gZG93bmxvYWRlZCAvIHRvdGFsIDogMDtcbiAgY29uc3QgcGVyY2VudCA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEwMCwgTWF0aC5yb3VuZChzdWNjZXNzUmF0aW8gKiAxMDApKSk7XG4gIGFwcGx5R3JhZGllbnQoYnRuLCBncm91cCwgcGVyY2VudCk7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZURvd25sb2FkQWxsQnV0dG9uKGdyb3VwOiBHcm91cFN0YXRlKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBleGlzdGluZyA9IGdyb3VwLmRvd25sb2FkQWxsQnRuO1xuICBpZiAoZXhpc3RpbmcgJiYgZXhpc3RpbmcuaXNDb25uZWN0ZWQpIHtcbiAgICByZXR1cm4gZXhpc3Rpbmc7XG4gIH1cblxuICBjb25zdCByb290ID0gZ3JvdXAucm9vdDtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWFsbC1idG4nO1xuICBidXR0b24uc2V0QXR0cmlidXRlKElOSkVDVEVEX0FUVFIsICd0cnVlJyk7XG5cbiAgaWYgKGlzUGFnZURhcmsoKSkge1xuICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtdGhlbWUtZGFyaycpO1xuICB9XG5cbiAgYnV0dG9uLnNldEF0dHJpYnV0ZShcbiAgICAnYXJpYS1sYWJlbCcsXG4gICAgdCgnZG93bmxvYWRBbGwnKSB8fCAnRG93bmxvYWQgYWxsIGF0dGFjaG1lbnRzIGluIHRoaXMgcG9zdCcsXG4gICk7XG4gIGJ1dHRvbi50aXRsZSA9IHQoJ2Rvd25sb2FkQWxsJykgfHwgJ0Rvd25sb2FkIGFsbCc7XG5cbiAgLy8gSWNvblxuICBjb25zdCBpY29uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvbldyYXBwZXIuY2xhc3NOYW1lID0gJ2NxZC1pY29uLXdyYXBwZXIgY3FkLWRvd25sb2FkLWFsbC1pY29uLXdyYXBwZXInO1xuICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBpY29uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYWxsLWljb24nO1xuICBpY29uV3JhcHBlci5hcHBlbmRDaGlsZChpY29uKTtcblxuICAvLyBMYWJlbHNcbiAgY29uc3QgbWFpblNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIG1haW5TcGFuLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYWxsLW1haW4nO1xuXG4gIGNvbnN0IHN1YlNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIHN1YlNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1hbGwtc3ViJztcblxuICBidXR0b24uYXBwZW5kQ2hpbGQoaWNvbldyYXBwZXIpO1xuICBidXR0b24uYXBwZW5kQ2hpbGQobWFpblNwYW4pO1xuICBidXR0b24uYXBwZW5kQ2hpbGQoc3ViU3Bhbik7XG5cbiAgLy8gUG9zaXRpb25pbmc6IGVuc3VyZSByb290IGNhbiBob3N0IGFuIGFic29sdXRlbHkgcG9zaXRpb25lZCBwaWxsXG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocm9vdCk7XG4gIGlmIChjb21wdXRlZC5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICByb290LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgfVxuICByb290LnN0eWxlLnNldFByb3BlcnR5KCdvdmVyZmxvdycsICd2aXNpYmxlJywgJ2ltcG9ydGFudCcpO1xuICByb290LnN0eWxlLnNldFByb3BlcnR5KCdjb250YWluJywgJ25vbmUnLCAnaW1wb3J0YW50Jyk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBoYW5kbGVEb3dubG9hZEFsbENsaWNrKGdyb3VwKTtcbiAgfSk7XG5cbiAgcm9vdC5hcHBlbmRDaGlsZChidXR0b24pO1xuICBncm91cC5kb3dubG9hZEFsbEJ0biA9IGJ1dHRvbjtcblxuICByZXR1cm4gYnV0dG9uO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVEb3dubG9hZEFsbENsaWNrKGdyb3VwOiBHcm91cFN0YXRlKTogdm9pZCB7XG4gIGdyb3VwLmFjdGl2YXRlZCA9IHRydWU7XG5cbiAgZm9yIChjb25zdCBmaWxlQnRuIG9mIGdyb3VwLmJ1dHRvbnMpIHtcbiAgICBpZiAoIWZpbGVCdG4uaXNDb25uZWN0ZWQpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHMgPSBnZXRTaW5nbGVCdXR0b25TdGF0ZShmaWxlQnRuKTtcbiAgICAvLyBPbmx5IGNsaWNrIGlkbGUvZXJyb3IgYnV0dG9ucyB0byBlaXRoZXIgc3RhcnQgb3IgcmV0cnlcbiAgICBpZiAocyA9PT0gJ2lkbGUnIHx8IHMgPT09ICdlcnJvcicpIHtcbiAgICAgIGZpbGVCdG4uY2xpY2soKTtcbiAgICB9XG4gIH1cblxuICBtYXJrR3JvdXBEaXJ0eShncm91cCk7XG4gIHNjaGVkdWxlUmVmcmVzaCgpO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVCdXR0b25TdGF0ZShidG46IEhUTUxCdXR0b25FbGVtZW50KTogQnV0dG9uU3RhdGUge1xuICBjb25zdCBjbHMgPSBidG4uY2xhc3NMaXN0O1xuICBpZiAoY2xzLmNvbnRhaW5zKCdjcWQtbG9hZGluZycpKSByZXR1cm4gJ2xvYWRpbmcnO1xuICBpZiAoY2xzLmNvbnRhaW5zKCdjcWQtdHJ5aW5nJykpIHJldHVybiAndHJ5aW5nJztcbiAgaWYgKGNscy5jb250YWlucygnY3FkLXN1Y2Nlc3MnKSkgcmV0dXJuICdzdWNjZXNzJztcbiAgaWYgKGNscy5jb250YWlucygnY3FkLWVycm9yJykpIHJldHVybiAnZXJyb3InO1xuICByZXR1cm4gJ2lkbGUnO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogVmlzdWFsIGhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGFwcGx5R3JhZGllbnQoXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIGdyb3VwOiBHcm91cFN0YXRlLFxuICBwZXJjZW50OiBudW1iZXIsXG4pOiB2b2lkIHtcbiAgaWYgKCFncm91cC5jb2xvcnMpIHtcbiAgICBjb25zdCBjcyA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGJ1dHRvbik7XG4gICAgY29uc3Qgbm9ybWFsID1cbiAgICAgIGNzLmdldFByb3BlcnR5VmFsdWUoJy0tY3FkLWNvbG9yLW5vcm1hbCcpLnRyaW0oKSB8fCAnIzAwNURENyc7XG4gICAgY29uc3Qgc3VjY2VzcyA9XG4gICAgICBjcy5nZXRQcm9wZXJ0eVZhbHVlKCctLWNxZC1jb2xvci1zdWNjZXNzJykudHJpbSgpIHx8ICcjMDBBODJEJztcbiAgICBncm91cC5jb2xvcnMgPSB7IG5vcm1hbCwgc3VjY2VzcyB9O1xuICB9XG5cbiAgY29uc3QgeyBub3JtYWwsIHN1Y2Nlc3MgfSA9IGdyb3VwLmNvbG9ycyE7XG4gIGNvbnN0IHAgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxMDAsIHBlcmNlbnQpKTtcblxuICBpZiAocCA8PSAwKSB7XG4gICAgYnV0dG9uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgXG4gICAgbGluZWFyLWdyYWRpZW50KFxuICAgICAgdG8gcmlnaHQsXG4gICAgICAke3N1Y2Nlc3N9IDAlLFxuICAgICAgJHtzdWNjZXNzfSAke3B9JSxcbiAgICAgICR7bm9ybWFsfSAke3B9JSxcbiAgICAgICR7bm9ybWFsfSAxMDAlXG4gICAgKVxuICBgO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRGlyZWN0aW9uIGhlbHBlclxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2FmZVNldERpcmVjdGlvbigpOiB2b2lkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXIgPSBnZXRQYWdlRGlyZWN0aW9uKCk7XG4gICAgZG9jdW1lbnQuYm9keS5zZXRBdHRyaWJ1dGUoJ2RhdGEtY3FkLWRpcicsIGRpcik7XG4gIH0gY2F0Y2gge1xuICAgIC8vIGlnbm9yZVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldFBhZ2VEaXJlY3Rpb24oKTogJ2x0cicgfCAncnRsJyB7XG4gIGNvbnN0IGRvY0RpciA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5kaXIgfHwgZG9jdW1lbnQuYm9keS5kaXI7XG4gIGlmIChkb2NEaXIgPT09ICdydGwnKSByZXR1cm4gJ3J0bCc7XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuYm9keSkuZGlyZWN0aW9uO1xuICByZXR1cm4gY29tcHV0ZWQgPT09ICdydGwnID8gJ3J0bCcgOiAnbHRyJztcbn0iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFBTSx3QkFBd0I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQTJCOUIsUUFBTSx3QkFBd0IsMkJBQTJCO0FBQUEsSUFDOUQ7QUFBQSxFQUNGLENBQUM7QUM3QkQsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sa0JBQWtCO0FBR3hCLFFBQU0sZ0JBQWdCO0FBQ3RCLFFBQU0saUJBQWlCLEdBQUcsYUFBYTtBQUVoQyxXQUFTLGVBQXFCO0FBQ25DLFFBQUksT0FBTyxhQUFhLFlBQWE7QUFDckMsUUFBSSxTQUFTLGVBQWUsUUFBUSxFQUFHO0FBRXZDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLEtBQUs7QUFDWCxVQUFNLGNBQWM7QUFBQTtBQUFBLDBCQUVJLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkF5S1QscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQXdKckMsZUFBZTtBQUFBLGdCQUNkLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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
downloadall;