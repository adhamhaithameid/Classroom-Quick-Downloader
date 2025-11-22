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
      }, 1e3);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudF9mcmFtZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29tbWVudF9mcmFtZS5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBlbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzXG5cbi8vIFJhdyBTVkdzXG5leHBvcnQgY29uc3QgRE9XTkxPQURfSUNPTl9TVkdfUkFXID0gYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiPlxuICA8ZyBzdHJva2U9XCIjRkZGRkZGXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPlxuICAgIDxwYXRoIGQ9XCJNNiAyMUgxOFwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAzVjE3XCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDE3IDEyXCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDcgMTJcIiAvPlxuICA8L2c+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19SQVcgPSBgPHN2ZyB3aWR0aD1cIjE2MFwiIGhlaWdodD1cIjE2MFwiIHZpZXdCb3g9XCIwIDAgMTYwIDE2MFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPlxuPHJlY3Qgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBmaWxsPVwidXJsKCNwYXR0ZXJuMF8xXzI0ODQpXCIvPlxuPGRlZnM+XG48cGF0dGVybiBpZD1cInBhdHRlcm4wXzFfMjQ4NFwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiIGhlaWdodD1cIjFcIj5cbjx1c2UgeGxpbms6aHJlZj1cIiNpbWFnZTBfMV8yNDg0XCIgdHJhbnNmb3JtPVwic2NhbGUoMC4wMDYyNSlcIi8+XG48L3BhdHRlcm4+XG48aW1hZ2UgaWQ9XCJpbWFnZTBfMV8yNDg0XCIgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFnQUVsRVFWUjRBZTJkQ1hoVjViWDMxMG5JU01oNGhpU29WMnRyaGNvRGF1bDNhd3Y2VmF2WDF0VDJGclZlKy9XMjk3YjNYdTBWZWorMTBlc1U1bEVJUXhKbUVJaGxrRGxrbmdkQ0VpU01BaUt6UmZCVzhHdXJGV3Y5ZjgvLzNmdE5OakZJaG4xT1RzTGV6N055akp5Y3ZkLzEvKzIxM3JYMnUvY1JDY1NXSWVIeWd1OEd5ZkRkSXk5NW5nekpjR2U3TXR5YlhCbStTbGVHZDRjcnc3dlROZGJYNU1wb1kveC9qblhmQiszNWxUNVh2cWNHN2szVVJGNzBqSmFYdk44MXRKTHdRS0RodjMwOEc1Y2dMM252QzNuWk05NzFzcWZBbGVFOTZScnIvWXRybkErdThhWk44TUkxd1FmWHhNdllKQjljam5YZkI1ZnpMMzFQRGJRZTFHYXM5Mk9sMWN1ZUFtcEhEWVZhOXBydHhhVGhRdWd5UEUydXNkNkxydkdFekF2WFJDOWNrNzF3VGZIQk5kVzBhVDY0dEUzM3dhVnRoZyt1dHFiL3pYbHQ5ZE1YK2FLdC8vaTc5ZjNhNzN6VmVsQWJha1N0RkpoZUFubVJXbEpUb2JaQnU3M2t1MXN5dkt0a3JQZDlHZStGVFBSQ0puc2hVN3lRYVQ3SWRCOWtoZy95aWc4eTB3ZVpsUXpKVEliTTlrRm04OVcwT2NrUXgvem5BKzFuOWVvek5LQVcxSVRhVUNOcVJjMm9IVFdrbHRTVTJsSmphaDAwMjR1ZVd5WERzMXpHZWorVUNUeGdIcmc1Z0JrY21BWXRHVEkzR1RJdkJaS1ZBc2xPZ2VTa1FPYTNzUVVwa0xhMk1CWGlXT2Q5ME5hUC9MMnR2NmtEalpwUUcycEVPQmtjcUIwMVZERDZERzJwTWJXbTV0Uyt4N1lNVDR5ODdIbFd4bnJlTWNCanBQTWFaeERQSmc2Q2tTd3J1UlcwaFNtUVJTbVFKU21RcGJSVXlMSlV5SEtyRFlTODZwaGZmTEI4NEtXK3B1K3BBYldnSnRTR0doRlNCZ2RxUncycEpUVmxkS1RHaklvS1JNODdpb0hmdWdjRWxrT1NQOVpUS09NOXhzRW84THlRV1Q3SUhKOEpYYklSeVJhYnNDMUxnYnlhQ2xtUkNsbVpBbG5wZzZ6MFFGWW1RVlltUUZiR0c3WXFBZUtZLzN5Zy9FeC8wK2g3YWtBdFVneHRxQkcxSXBUVWpsRXp4d3drMUpZYXp6Q0REVUVrQTJRaFlORXd3LzBUR2VjNXJ1WUZVeG54TkhqSmtHd1RPaFhsektoRzRISUhRbktUSWJsdVNHNEM1SGR1OUZ0M0RlSTIzWXhyOG03SFZ3dS9qU0hGL3h2RFNyN2pXQUI4TUtUNExueTE0RnZLOTlTQVdsQVRwWTNTaUZvTk5JQmtkbHFTYWtSSHdraU5HUlUxaUdTQWMwUXlRVGI4dW8zMVBpUGpQUitxRU15b3g3Q3MweXdQam1jTXd6cWhXelVROGp1YUYvSzdSTWc2SHp4YmI4SHc4dnZ4VU9PLzQ3LzJ2WXh4aHpJeDgrMkZtSGQ4T2VhZldJV0ZKM01kQzRBUDZHdjZuTDZuQnRUaTRjYi9VTnBRSTJxbE5GUGFEVFMwcEtiVVZrZEZuWjdKZ0U3TFpJT00rR1hMY0krVkNSNmpNbUxVeS9SQzV2bU04TXlJeDVETjhMMHExUUJ2alEreUpnR1JtNjdIYmVYZnhiODAvMTlNT2pJWEMwK3V3dkozMWlwYmVubzFGcDErRFF0UHJjSUN4d0xxZzRXblZ5bmZVd09seCttMVNodHFSSzJvR2JXamhrSXRHVXlvTFRXbTF0U2NxWmtNa0FVeXdhcVpqSkFWVzdlMjhMRjFrdVdETEVnMkpxK3ZwbGpBUzFFSEhiSHBPdHhSL1FDZVBqQVcyU2RmeGRKM1ZvT0R6anE1REhOUExzRWMycWtsbUh0cXFXTTk2QU5xUUMyb0NiV2hSdFNLbWxFN2FrZ3REUkJUTENDYWhRc1pJQXRrd2k4UWpuTS9MUk05RU9iNlY3eVEyVjVqSHNCcWlaTlZUbDVmUzRXc0hRaFo2NFdzOTJCUTJRaU0zditpR3NUQzB5dlZBR2VkWEloV1c0UlpKeGRoMWluSGdzSUgxRUpacTBhRWt0b1JSR3BKVGFtdDBwaGFVM05xVHdiSUF1ZUdaSU9NcUhraGl4UDNVOTBMaEJtZVVUTFIvWkZNOVJnZlBNY0x5ZkZCRmlWRGxqUHFwVUJXcDBMV3BVSmVUMFQvcmRmandjWi94b3hqT2NnNTlTcG1ubGlBNlNkeU1QMWtEbWJRVGwzR1R1ZGdobU9COThIbDlEaHBhRWJ0cUNHMXBLYlVsaHBUYTZVNXRTY0RaSUZNa0EweW9pRDBRTEV6MXZOUTF5QWM1eDBxRTl5bld1Q2JhOEszT0JueUtxc2twbHFDbHdKWm40aVVvaUY0ZkYrNkN1VXpUK1JneXZHNW1ISmlMcWFjdE5pcHVaaGl0ZE56TWFYRjVtSEthY2NDNXdPTDc2MmE4TCt0bWxIRDQzTkJUWm1tcVRHMWx2VUpodlprZ0N5UUNiSkJDTWxLSzRTbmhTeDFhbU9UZVlLbldLYTZJVE85QnRYemZjWU91S1BYVWlCclV5RWJVaUFiRTNGaitmL0NidytOeDZ5VEN6RHBlQ1ltSEorRkNTY3lNZUdreFU1bFlrSmJPNTJKQ1ZacisrL083NS8zbVIwK3NmcWMvOTNlWjFxMW81YkhaeWx0cWZGdkQ0M0RsOHEvb2JSWERKQUZNcUVoSkN1TWhHU0hESkVsTXRYaGJYeFN1a3h4WDVwMld5SWY1M3NtZkpzUzhaV0t2OGV6aHlkZzJvbDV5RGcySFJuSHB5UGpoR2tuWnlCRDI2a1p5SENzOS9oQTY4WlhyU2UxUFRaZGFVM05xYjFzU2pRQ0VabklaWlZzaVlRNkhaT2xDVW5QZG95L2NiNGhNc2w5VG1aNHpJS2pUZVRqZkc5akttUlRFcTRydngxUEhjN0F4T096OFB6UnlYamgyR1M4Y0h3eVhqZ3hwZFZPVHNFTFZqdlY1bmY5Yi96L2pnWE9COXJ2MXRmMnRMRnFTVzJQVFZaYVUzTnFUd2JJZ21LQ2JGZ2pZVGFyWTdab1BGQk1rYTB2M0RJa1JNWjdYcFZwSHFPM3cvSmFGUnptbkkrVWJ4d0kyZXhHWXZFZy9QdUJaOVFaa2Y3MmVLUWZIWS8wWTZZZG40QjBiU2NtSUYzYnlRbElwK25mbmRmZzhrVjcrbWdkK2FyMXBkWnZqMWZha3dHeVFDWVVHeW9Tc2pCSk50Z2hRK3dUa2lteVJjWXV1MDN3akpRcDdvOWtwZ2N5end0WjRJTXM4MEZXSlVQV3BFQTJwRUkyZXhGZWNBMSszUHl2ZVBIdHlYanF5RXQ0NnUyWDhOVFJsL0RVc1pjTk8vNFNubktzNy9sQTYwdXRxZm1SbHhRRFpJRk1rQTNGQ0ZraE0yU0hESkVsTWtXMnlGaTdHOG1jNUY0bE05eVEyUjdJZkM5a0NTOVNKME5XczlKTmdXeEpnZVM1OFkwZDkrT1pJeGtZODliekdIM2tPWXgrK3ptTVB2cmZoaDM3YjR4MnJPLzZRT3RNelk4OHB4Z2dDMlNDYkNoR3lBcVpJVHRraUN5UktiSkZ4dHFOZ2hQZHQ4a1U5d1daNVliTTgwQVcrU0RMZlpEWGtpSHJVaUNiVWlCYjNmQ1czNEpmdmZrYmpIN3JPVHgrK0drOC90WXplUHpJTTNqOGJZc2RmUWFQTzliM2ZHRFZtSnBUKzhOUEt4YklCTmtnSTRvVk1rTjJ5QkJaSWxOa2k0eVJ0Yzl0azVJbXluUTNaSTRIa3VPQkxHWHE1ZlhjWktQSzJlSkRTSDR5N3RrNUN2OTU2TGY0NWNFeCtPWGgzK0NYYjVsMjVEZjRwV05YancrMDdtVGc0QmpGQk5rZ0k3TEZaekJEZHNnUVdTSlRaSXVNa2JWTHRzbHhDVEkxc1ZsbXVpRlpqSDVleUt0Y3hlS0R2SjRNMld5azNtc3FoK0huKzMrTlg3ejVuL2pad1Nmd3M4TVdlK3NKL015eHE4Y0hWdTBQUHFHWUlCdGtSS1ZpTWtOMnlCQlpJbE5raTR5Uk5UTFhzazFPdkZlbUozMGlzOTJRK1l4K1hzZ3FyN0VLWW1NeVpLc1ByZ0lmUmphbHFSMDlldUJYZVBUZ3YrSFJRNllkL2pjODZ0alY1d090UDFrNDhDdkZCaGtoSzJSR3lBNVgwcEFsTWtXMnlOajBwTDhLbVd2WnBpU05sMWVTakR5OTBITnA5R1Boc2MyTnhQS2I4YU05UDhNakIvNFZvdzc4SEtNTy9zS3dRNy9BS01ldVhoOW9EZzc4WExGQlJzZ0ttVkVGaVRVS2tpM09CY2thbVZQYkFnbVRhVW5Ga3BrRXlmWkFsbkNKdG81K1BraGVNaVRmalVIYnY0V0g5djBjRCs1N0RBOGVvUDBVRDc3NVV6eDQwTEdyMmdka2dDeVFpWDJQS1ViSUNwbFI3R3hrSGNGdUNyc3FIb014c2tibXlKNU1qN3RCcGllZWtybHV5QUkzWkprSDhwb1g4cm9Qc2prWnNzMkwwT0pVM05GMFAzNnc5NTl3Lzc2SGNmLytSM0QvQWNkNjBnZmZPL0FJL0dWZEdoZVoyUGV3WW9Tc2tCbXlveGdpUzJTS2JKRXhza2JteUo1TVM3eFhaaVorSWxsdXlDSTNaSVVic3BvTlJlWnhJL3JGbGQrSTcreDZFUGZ0K1RIdTJmc2ozTFB2SDNIUGZzZDYwZ2QzSC9naDdqeVVacHVOUEpTR2I3LzVmZHkxL3dmNGJsZTBKUk43ZjZRWUlTdGtSa1ZCTWtTV3lCVFpJbU5ramN5UlBabVc5S1JrSmtKeWtpQkwzSkJWSHNnYUwyU2pGNUxuZ3hRbUliWDZGbnluK1FlNGEzY2E3dHlUaGp2M3B1SE9mWTcxaEEvdTJwZUdrZnNmd0oxN0g4QUQ5WThncmVZbmVLRDJFYVIxd3g2b2VSamZxM2tJRHpYOEhEL2E5Mzh3Y3YvM082OHZtZGlUcGhnaEsyU0c3Q2lHeUJLWklsdGtqS3lST2JJbjA1T3laSFlpWkg0aVpCbnZqUEpBWHZkQ05ubU5FRnJrd1ExMXQyUGtydS9oanViN2NNZnUrM0RIbnZ0d3gxN0hlc1lILzREYkR0eUZ4NnAraFp6Rk9jaGFsSVBzcGRuSVhzclh6bHZXa216a0xGdUExemV0UjkzT2V2ekgvdi9Dclh2djdMeStaSUpzTk4rSE8zZDlUekVqUlI2REliSkVwc2dXR1NOclpHNUd3anlSVnhJMnlweEV5TUpFeUhLM2NYc2VsMTV2OFVMeVBaQmlIMjZxL3dhK3VldTdHTDdyYmd4dnZodkRkOStONFhzYzZ3a2ZETjA3RW5mc3VoY0w4aGRqWjNrVER1dytnTVA3RHVIUXZvTmR0RU00K2ZaSmZQYkIzMUR3WGdsdTIzTVhidDE5WitmMUpSTmtZOWZkaWhVeVEzWVVRMlNKVFBIV1R6Skcxc2djMlpPWkNSVXlMeEd5S0FteUlnbXkyZ1BaNElGczlVSUtQQWd0VGNaWGQzd0R0Nzl4RjRidEdvbGh6U014YkxkalBlR0RvYnRINGl0N2grUFhWVStodVhZWExyeC9Iblp0NXorN2dCOGUvaWx1Zk9NMkROdDlaOWMwSmh1N1JpcFd5QXpaSVVPS0pUSkZ0c2dZV1NOelpFOW14dFZMRmdGTU5BRjBRemE0SVZzOWtBSTMrcFdtNEN2MVg4ZVFwbS9oYXp1L2lhKzk4VTE4YlpkalBlR0RHNXR2eFIwNzdzUDYwZzA0Yy9UMytQVFRUKzNpRHpOK1B3OERHd2RqOEs2Lzc3cStaR1BuTnhVclpJYnNrQ0hGRXBsYXpTS1hBQ1pDTVVmMlpHWmlrMlFsUUpZa0dvOXFXTU4xWFI1SW5nZFNhQUI0dy9aYmNYUGpOM0JUMDNEY3RITTRibnJEc1VENzRNdHYzSTVyM3hpQzU4cGV4cUhHTi9HblAvM0pOdmgyLzNrZmhqUi9HOWMyM2RJOWJjbEcwM0RGQ3BsUkFCYXlIK2d4bUNKYmZCd0lXU056WkU4eTQ1c2ttd0R5bVN4SmtMVkp4Z3BYTHEwaGdHWEp1Rzc3RUh5NThUWjhxZkZXZktucFZueHBwMk9COW9GMzExZHhWKzBES0NrdndiblQ1L0Mzdi8zTkZnQS8rZXdUL011Ukp4Ry80NGJ1NjBvMkdtOVZySkFac2tPRzFMVmhycG9tVzJTTXJKRTVzcWQrNUNSQWxpWkNjaldBYnVOU1NoRUI5Q0cxYmhDdTJ6RUUxemJjZ21zYmIxRm5DczhXeHdMamc1U21RVWhwSElTcEphL2cyTzZqK09pamoyeUJqeCt5N2crYjRXNzRNcEliYis2K25tU2o0UmJGQ3BraE8xSmtzclRKYlFCSXhzZ2FtVE1Bakd1U25IaklzZ1JJTHUvM1REUWlJSy9sRlNVaHROd0xUKzFOU0swZmhKUWROeU9sNFdha05Eb1dPQjhNUXYrbWEvRDl5b2RSWDFXUDk4KzlqOC93bVMwQW52dmtQZHl4OXg4UXZUMFZxWTJFdkp1NmtvMGROeXRXeUF6WklVUHF1akFqSU5raVkyU056R1hHTVFMR05jbDhFOERYRW8yYmp2bG1BbGhzQUpoVWV5Tzg5VGZCVS84VmVCb2NDNlFQWWh2L0RxbjFnN0dnZURGT0h6eUZpeGN2MmdJZlB5VGoxRlQwcS9Pb0NHamJtT3Evb2xnaE13ckFZZ3VBdktHZGpCRkFNbmRaQURjbkdaZFJpcE1RVXVaQlhPM2ZJYkgrUzBpb3Z3RUpEWTRGeWdmeERkY2p0TUdEeDhwK2liMTFlM0RoL0FYYjRHdjZVN05LNnhIYmsrM1Z0UDRHeFFxWklUc01ZdXFTSEptNlBJQnhrR1h4a05kNHQzc2laSE1pSkQ5Si9iR3J6STMrTmRjZ3R1NWFETmgrTFFiVU94WVlIMXlIMEFZM3JxOGVpblVscitQZG8yZncxMC8vYWd1QUxEeCtmUENmSVRVeGlLMi96bDVOdDErcldDRXpaTWNBTU1sZ1NnR1lZTEEyUDA1SHdOZ215ZEVBeGtQV0pVQTJKVUMySlVLS0V1RXFTMEprVlNxaWF3Y2lxbTRnb3JZNzVtOGZSRzhmaUlqdEtaRHRDWGl5K0dtODFYalkxcmJMcXZmV0lhdzJFV0YxWG5CZnRvNm5icUJpaGN5UUhUS2tXQ0pUWk9zMVR2ZmlvWmpMak9VY01MWkpTQ1AvWjI0N0FKWW1JcnpTaDRpYVpFVFVKaU9pempGLyt5QzhMaGxTSDROYktyNko0cklTdkdkajIrWE14Yk1Zc3VzT1NIV1VndHoyc1pDUm1tVEZqS3ZVQ0dLWEFFakd5SnFLZ0FyQUFVMHlQeGF5TEE2U0d3ZFpGdy9aRkEvWmxnQXBTb0NyTkFHaGxXNzBxL0dnWDYxSFRWbzVjWFhNZno0STJaNkFmclVKR0ZjMENTZjJITGUxN2ZMc2liR1FxbjRJcVhQN1IwTXlVdU5SekpBZE1xUllJbE5raTR5Uk5US1hPWUFSa0FBT2dDeUxOUUdNZzJ5S2cyeUxoeFRGUTByajRhcE1oS3M2Q2E3YUpManFIUE9yRDJxVElOdkRNTExzUHRSWDdiQzE3ZEx3eHliRTF3OVUwUy9FWHpxU0ViSlNtYWpZVVF5UkpUSzF6Z3h5WkkzTWRSUkFxVWlBVkNWQWFoSWd0WTc1MVFkMTBZaXA4aUtuYUFIZU9mZ09QcmFwN1hMeGJ4ZVI5dWJEa0FxQjFDYjZUMGN5UWxiSVRLa1p4SzRJWU00WFIwQUh3RUNkZFBHUXVsQ01LbjRNZSt2MjRvUHpIOWhTOWZKRFZweDdEU0hWRWFyeTllc0oxRkVBeVZ4TEJGUUFEb0RreGtMV3hab3BPQTVTRkFjcGpZTlV4RU9xNGlFMThaQmF4L3pqZ3dSSVhUaVNLMi9FbXBKMU9IdnNYZHZhTG1jdXZvdkJiOXdPcVhTWmtjK1BHcElSc2tKbXlBNFoybVpPNjhnV0dWczJBUEo1QUdNZ3VRTWc2d2FZQU1aQ2ltSWhwYkdRaWpoSVZSeWtKZzVTNjVqOVBpQVFBeUMxWVhpaTZEYzQwdlNXclcyWDlPTXZHcW0zSnRiLytwRVJza0pteUE0WjJtWUdOYkpGeHBiRldBSHMzeVE1TVpDbEpvQnJCMEEyeGtMeVlpR0ZzWkNTV0VoNUhLUXlEbEp0UXNpZE9HYXZEMnBETUtqc05yUHQ4cDV0cTExVTRWSG5nMVNGR3huTTM3cVJFYkpDWnNnT0dTSkxaSXBzRVVDeVJ1WXkrN01LZGdEczhaT3BOaHFoMWYweHRtZ0NUdXc1WVZ2YjVlSm5GNUYyNENGSXVkaDdzbndSeEYwRHNMOFpBV01nYTJNZ0d3ZEE4Z1pBQ2dlWUVUQVdVaGtMcVk2Rk1JdzdacThQYWdValNyK0xIVGEzWFZhY3kwVUlJMTkxbEwzSCswWDZreEd5VW01bVR6SkVsc2dVMmNvMXMyMU9mMnNFZEFEc3NaT3FOaHd4VlVuSUxscUEzOXZZZGxHRng4NWJ6YmtmcDB3QkNoeWRCekM2U1hLaUlVdjdRM0w3UTliMmgyeU1nZVRGUUFwaklDVURJT1VESUpVRElOVURJRFdPMmVlREdFaXRZRlR4bzlpNzNkNjJTL3J4Rjh6VTJ6K3dtcEVSc2tKbXlBNFpJa3RraW15Uk1iSkc1aktqT1FlTWFwS2NLTWpTYUVodXRBbGdmMGhlZjBoaGYwaEpES1E4QmxJWkE2bU9NZnBJTmM0clY1SjB6MWoxaGlDNTRucXo3WExXdHJaTHd4OGJFVi9uaFZTRm12QjE5MWc3OGZka2hLeVFHYkpEaHNqU1JqTzRrVEd5UnViSW5tUkdtZ0JHUVhLalRBQ2pJWG5Sa01Kb1NFbC9TSGwvU0dWL1NEWFBKc2U2N3dNS3lubVpDMDhVamNhUm5mYTFYVlRoc2YvSGx1Z1hZTDNJQ0ZraE0yU0hESkdsaldad0kyTkxvMHdBSTAwQXM2TWdTNklncTZJZ2E4dzNiNDJHRkVSRGl2dER5dnBES3ZwRHFrd0l1UlBIdXVlREdzR2cwcUVvTGl2R2U2ZnRhN3VzT0p1TGtNb3dvKzNTRXhxUkViSkNac2dPR1NKTEJKQnNrVEd5UnVZWS9OUVBCOER1d2RSWm9XdkNFVm9WZ2JGRjQyMXR1NmpDbzJtb0VmMDZlMHgydmI5ckFFWkNsa1NhRVRBS3NqRUtzalVLVWhBRktZNkdsRVZES3FJaFZkR1Fhc2U2N1lNYXdZaVM3MkJIdGIyclhkS1BQUThwRTBoMVpNL3BSRWJJQ3BraE8yU0lMSkdwTldhV0pXdlprZFlJU0FBakhBQURjWExWaENLbU1oN1pSZk50YmJ1b3dxUFdEYWx3OVJ4ODlGK0hBSXhvQzJDRUNXQWtaRTBrWkdNa1pHdWtHUUdqSUdWUmtJb29TRldVMGRSa1k5T3hMdmlBa1lsdGwwZHNiYnVvd21QZmo4em8xOFBha0JHeVFtYUt6U3hLbHNnVTJWcGxCcnZzQ0RNQ3pncHZrcXh3eU9JSXlNb0l5T29JeUlZSXlKWUlTSDRrcENnU1Vob0pLWStFVkVaQ3FoenJtZzhJaGlDNTdGcXNLVm1Mczhmc2E3dXNPTHNTSVJYOUlKWDllbDRmTWtKV3lBelpJVU5raVV5UkxUSkcxc2djMlZNL0hBQURJRnc0cEVyd1JPR1R0clpkemx3OGc4R05RNHpvRnd6Qm9mTUFocGtSTUJ5eU1oeXlPaHl5SWR5TWdCR1FvZ2hJYVFTa1BBSlNHUUdwY3F4TFBxaG0yMldJN1cyWDlLUFBtZkN4OVJJRTJwQVJza0pteUU2K21VM0pGTmtpWTR2RHpRZ1l4Z2pZSG9CaERvQjJpbGtkZ3RES01Jd3RIR2RyMjBVVkhqVkp4dlZlTzQrM081OTFXUUREdmdqQU1NamlNTWhLdmlrTXNvRUFoa1B5d3lGRjRaRFNjRWg1T0tTU2FjU3h6dmtnVE0zOVJoVGZaZXRxRjZQdytDR2tWQ0JWWnVNNUdMUWhJMlNGekpBZE1rU1d5QlRaSW1Oa0xTc01LdmpKckg1Tmt0VVBzcmdmWkdVL3lPcCtKb0Joa1B3d1NGRVlwRFFNVWg0R1VSMTJEdGF4RHZ1Z1doQlRFV3UwWFE3WmQ1T1JVWGlFUWlwRGdrc1BNa0pXeUF6WklVTmJ6S0JHdHNnWVdTTnpaTThCMEo4blV6K2o3Vkwwa0sxdEY2UHd1TVV5OS9QbkdEcjUyWjBHY0dab2syU0ZRQmFIUUZhRVFsYUhRdGFIUWphSFFyYUZRZ3BESVNXaGtMSlFTQVhQT01jNjdJTXFRWEpwS3RZVTI5dDJTVC82ckpGNkdmMkNUUTh5UWxiSUROa2hRMlNKVEpFdE1rYld5QnpaVXo4K0IyQUlaSE1JWkZzSXBEQUVVaElDS1F1QlZIREFqbDNaQnp4SlhaQkt3Uk1GdjhhUm5VZHN1OG1vNGY4MUlMNDZ3YmplcStBTE1qM0lDRmtoTTJTSERKR2w5U0VkQVpCdk10L3NBTmk5azYxS01LaGtzTkYyZWNlZTFTN3E1dks5UDRDVVNQZU96WjlCNUFzQlpKWTFzMjFyQkhRMVNaWUxzdGdGV2VHQ3JIWkIxcnNnbTEyUWJTNUlvUXRTNG9LVXVZenJqT3JNNXRuZFVhT3plSUhjWnF2aTUzYjBHQUw5UGtGb1JhanRiWmNWWjFjZ3BKeVpLSWpIem12UlpJWE1rQjB5UkpiSUZOa2lZMlNOek0xME1RVkxrMlFKWkxGQVZnaGt0VURXQzJTelFMWUpwRkNNTTQ2ckxOVEFUYUFJVlFjc3Fpb2E4V1h4Q0M4S1IwUnhKQ0pMb2hCVkVxVmUrZCtkTmY1dFZBbFhYTEQ5MExGajZNaHgydnFlS3NHSW9wRzJ0bDFVNGRFdzJKejdCZW00eVFOMUlTdU0wbVNIREpFbE1rVzJ5QmhaSTNOa3o2OEFWZ2l1cmIwV1M1cVdZRW5lRXJ5OC9HVTh2L2g1MDE3QTg0czdieThzZWdIakZvekhmYS9mWjBUVllJT3dTaEJURm9Qc3doejgzc2EyUy9yUjlPQ0hMeGdCREMwTHhiTUhud1hPUXoxc1o5K09mV2l1YmNidUxoci90cW1vQ1d2V3JjWE5SWU9NS05pRnlHeHJ4Tk9ad0R5T1VZV2piRzI3R0lWSHZCRlo5TDZDOWJYVEVmQVZhWko1QWxra2tGY0Y4anVCdk40bUJSZWJZWlUzT0hNSG5iRXlRWFJsTlBJdjVLc0g3ZkQ1N24vOTlGTjFBdzRmT2R0WjQ3Y0QvZkdQZjhTUk45N0d0SzNURWNXRmovck02OHh4K2VPOWxZTGtraFJiVjd1b0t4NTcweURVd0IvSGJQZG5raEdtWUI2dk5RV1RLYkpGeHNnYW1TTjc2b2MvQWVRQVN3VERHb2ZoN0NkbmJYdmEwL2svbkVkelZUTitzdTNSNEFHd3d2NjJ5NHAzVnlDRWJZMnVuUHgydzlXUnp3dEtBSGxReFlJeGI0MnhEVUJHempQSHppQ3ZNQStEbUlwN09ncFdDZ1lWRDBKeGVUSGVzNm50b2dxUEhZT05DWDFIeEErRzl3UWxnSFJNbVNDeUloSjVmOGl6RGNJUFAvb1F4NXFQWVZwZXo2ZmkwSEw3Mnk2cThPZ3RxVmZESDdRQThnQjFLcjVvWHlwKy93L3Z0NlppN1lRZWVCMVJOTUxXdG9zcVBQaWNQYTUyNllIeGRIbWZYUUp3cmtBV0NtUzVRRjRUeURxQmJCSklua0FLQkZJa2hpTTR1ZVFPdW1ORmZrekZoWU1Nc2JwemZGMzQyNWpTR0dRWDJkZDJVWVhIbmpURDcxMDRubTdwMDkzOWtSR2VOR1NHN0pBaHNrU215QllaSTJ0a3JxVUlDU1NBcFlMSWNqK2xZbGJGcFdhVHVydU83TVRmanlxd3QrMmlDbzlTWGxQdDVzbmVpVEhZQm0zUUEwaW5GQXVHTlF6RFdYK2s0cnhIQXhjRkt3VEp4U20ycm5aUmhVZjlZS09OMFJNQWRYZWZ2UUpBSHFTL1VuRkJIZ1lGTUJYYnZkb2wvZTEwSTMzMXh1aEhlSHNGZ0R6UUVrRmtXU1R5L3NjUFZiRk94ZG9oM1QyckwvUDNiUC9ZMlhacCtLQUI4Wlh4UnR2bE12dTBMVlg2Ni9NN0RlQjBhWkk1QWxsZ1RoQnpCYkpXSUJzRnNsVWcrWllGQ1p4Y2NnZDJXYUZnNkk2aC9rbkZXeDgxaWlXN2pyWE41NFNXaG1Kc2dYMDNHYW5DWTNlYWNmV2d6YjVzODNjZ1BwZU02SVVJWkljTWtTVXlSYlpZaEpBMU1rZjIxSStlQXBBSFd5Z1ljOWdQRFdxbTRvSkJmb053UktHOWJSZFZlSEFScDkwbmVTQ2dzKzZqVndISUF5OFdSSmI2TVJWejZSYlRqZFZKM2Z6dm1CSjdWN3Vvd21QNzROYTVYemVQejg2eGR2cXplaDJBZEhZdlM4VjJ0MTFVNGNFTDk3MDkrbEhMWGdrZ0Q3cVhwR0xWZHJIeDJTNnE4T0MzQ3VrVlI3MDUrdlZhQUhuZ3JJcDdRU3EycysyaTd2SG9DNFdIOWFUcGxSRlFENENwdU42UFZiSGVUeGRmMlY5VWo5UzFhYlhMaWpNckVGTE1POGpzbmFOMmV0N1dSWCswdTU4dUF6aGZJTXNFc2tvZ2F3U3lRU0JiekRYOXZLYkhGRUZIY1FmK01uNStnWityWWpxN0M4Y2ZXbUsyWGZiYTgwMUdaejQrZzhFc1BPamJMaHhQMFA0Tk5TUXJIQmZ2QnlGRFpJbE1rUzB5UnRZKzE0WUpCZ0FwUkpFZ3NzU1BWYkY2NUhEblJSOVJNTUxXUitxbUgwazNSUEwzU1Ixb3VIczlnSFJZUVFCU2NTZUVpU20ydCsyaUNvOXlmcGx6NTArRW9JMTgycDk5QWtBT0lvaFM4YWg4KzFhN3RGeng2R3VwdDA4QnlNSDRPUlZIRjBVYmM2OHJwTURrUW50WHU2akNveWpFbUNkcDBmclNhNmNqNERScGt0bm14SENwUUZhYUUwWjljem9YRlBLYUh0T0ZMa1M0azBCWXZtRG9kajlVeGRYTmVKVFhpcTgwaG1MQkUvbjJQZHRGWGZHb0cyejQ4MHI3N3EzL1RrYklDcGtoTy9xbWRCWWhaSXVNc2Q0Z2MyUlAvUWhXQURtWWZNR1lRMzY0VnN5Ym1iWU5hbzJDN1FqT2E4bDJ0bDFVNFVGaEFuMGl0ek8ySzU1OFhmMmJQZ1VnblZBb2lDejJUMVU4ZmV0MFhKS0tMVTRQTFFyRjJQeHhPR0ZUMjZXbDhOQ1BPckhzeTI4dzlNUSsraHlBZEdJUHBPSVIrZmF0ZGxHRlIzTmEzMDY5R3ZZK0NTQUh0VTB3NXFCL1V2RmduWXE1bnhKQlRLRzliUmRWZVBCWmVad2JhYUg2Nm11WEFNd1VTSTVBbGxpZWtNVkhLZkJ1Smk0bzFFL0owb1VJZHhKb0t4QkVGa1VpN3ozN1YxQlAzMkttWWtKUkxCaTF6YjYyaTdyaVVUdlk4R0dnZmRZVCt5TWorcEVjWkljTWtTWDlaQ3d5UnRiSVhFc1IwaHNBcERPM0NZYldEY1haaisyOHIvZzhkdkVSSDV0L29xS1RKOStMTlVWcmJQc21vL1MzMGczNGV2TGtEU1NJZlJwQURzNGZxZmo0dTlpd2JRTyt2UEhMK09ubW4rSlE0MkZiSHFtckNvK3llT09TV3lBaDZNbDk5V2tBNlZoL3BPSVBQOFRoL1llUlc1eUx3cG9pbkR2VC9VZnFxc0pqVjlyVmszbzE5SDBlUUE1VXAyS2I3aXYrN0xQUDhPYy8veG5uM3oyUEMvOXpBUjlmL0xqYno2OVJoVWVCV1hob2NhNkcxMDRET0ZXYVpKWkFzaTFGQ0ovanhrY3A4RzRtTHFmUmoramc1Skk3Q0FiYmFtOVZUT0krQTU5ZTJQMnRwZkNnMzRMQlY0RThCakxDNjl3Y085a2hRMlNKVFBIeHZDeEN5QnFaSTN2cVIyOEVNRjhRV1dodlZkeDk5SXhQU0QrY2JnZ1FUQ2Rzb0NDOGFnQ2tRL1BNcXRpbVZHd0hnS3J3S0kwM21zNkJFajJZOW5OVkFjakIraUVWZHhWRVZYaThrV1pFdjJDQ0lwREhjbFVCU01jR1VTcGU4ZnNWQ01ubk53UmRoU1gxNnUwQUFBbEVTVVJCVkhNL0RYbW5BWndpVFRMVC9ONEdmbjhESHlLdEg4L0J0ZnhjVHNNSkpWZHhjSExKSFFTYmJSVU1yYlczUWQzWktLZ0tqNXJCeHBXallQTlBJSStIakZpWFlwRWgvVmdPc3RYNkhTRVFzcWQrOUhZQU9lZ3RnakZ2Mm5ldHVMTUFxc0tEVlYrd25xU0JndkNxQkpETzNkWnpWYkVxUEVyaWphWnpvSVFPMXYxMEMwRDlYU0c5TFFWck1iWUlodGJZdTRMNlNwRlEzVnkrTTgzb2Vlbmp1SnBmcndRZ0dUTytwc3RNd1pQTU9TQy9LMFEvSjFyZkc4eGwrZFlWTVhvZXlKMEVvL0g0TmdjMkZhOTRad1ZDK0pXa3dlNmJRT2xGUDNEMWxGNEpRNGIwUGNINitkQmtqZE0rc3FkKzhKZStBQ0NkbkNlSXpBOU1nMW9WSHRXRGplZ1hLSUdEZlQ5WFBZQVVLRUNwT1AxUXV0RWxjS0pmYTBaMEFEVGJBSDVPeGFyd0tJNDNXbFRCSHBVQ2VYd09nSzBYdy8yVmlpOHBQQUlwYm0vWWx3T2dwVURhTEJoYWJYK0RXaFVlVzBPTXlYWnZnQ0tReDlnbEFGOHh2N21HVmJCK1FoYlg4SE10djNWSkZxc2I3cUMzR0k5M2syRE1BZnNhMUtyd3FCcmNPdmZyTGI0STFISFM1OWFsV1BwK0VQMWtyTlp2U2JKVXdYMFZRRHA5cXlCeVd5VHl6dGx6TTVNcVBOaWE2bTBub3dOZ0QwWk9tMUp4dzRVR3hCZkZHejJ1UUFuYTIvYmpSTUIyUUxjaEZhdkNveW5OU2IxWE9pRWNBTnNCa0U1akttYUR1b3VwK0pMQzQwb2lYTTMvM2lVQVo1aVBUTFUrSlpWRmlMNHZoRXV5OUEzcXZkbTVtd1JEcXpwZkZhdkNvOUlwUERwVWZCSkFza0ptOVAwZ1pFa1hJZnJ4dkdST1hZcWJLUFV5M1FLZ2ZrUWJieUxoT2k2dTUrS2tXOStjeEIzMFZtTjF0bEV3Wm4vbnF1TDBnK21HTS9uM3ZYWHNnVHB1WFFHVEdiMFdrQ3haSDgxbVBCOGFRdlpra2xSY0FpRHZXdUtiK3lLQUZHR0xJREt2NDZsWUZSNkY4Y1lKR0NnUmUvTit2Z2hBc3FVaklJTWUyWk9Kc3ZGekFQTDJ1YjRLSU1YVnFmZ0tOek8xRkI1TUpiMFppa0FlKytVQTFMZGtXZ0VrZXpKUjVzazA4NG1WMWdjVThldlZtWUwxa2l5bVlEMFBET1NBL0xFdk9xa0RxVmdWSGx0QytzNjQvZUhMdHA5SlJzZ0tVekRaSVVOa1NRTkl4b3lub3pJRlo0bU1seWRscXZtMEl0NHd6QVdEWExmRlJhbGN4Nld2aG5CU3FlZUJGTEMzMjJaQjVOWkk1SjF0djBHdENvK0t3YTF6djk0KzNrQWRQeG5SQlFqWklVUDZhMXJKRmhuanc3RElITm1UOFhLdlRKVlAxSjNxWEttcUFXVFZZcjBjMTljQXBDQWJCVU1yMjYrS1ZlSEJTVFRQNkVDSjF4ZjIweFpBWFFFenFPblYwTVpURVQ1UjdNbDR1VUdteXFtV08rT3NxNkoxSzhaYUNmY2xRVGlXRFlMUiswZGZzdksrNFh3RDRndmlqVE81TDBBUnFERlkweStaWVJ2UENpRFowc3Z4eVJ6Wmt3VVNKcE9rV0hnOVdLK0t0aTVJNEllMG5RY0dha0NCMkkrWmlyZWUzYW9nVklWSFk1clJRZ2pFL3Z2U1Bxd0FraGtyZ0dTS0FKSXhza2JtTWlSYzFEWkp4Z3NiZzNQTnIxTnYyd3ZzeXdBU2dJMkNZWlhEOE1FbkgyRDltZlVJMld3V0huMEpqa0NNcFMyQUxFQ3NQY0FGSm1OR0UzcThBUjkvVHBaN1picjh0ZVg3UW5qek1Lc1dheVhNVmdUbmdkeEpJQVlUeUgxd1RKc0ZqKzE2REYrdi9ycFJ3UVZ5LzMxbFg2WWZlVUovcmdJbVUyekJzQUltYTJTdVpac3NDVEpWbWk5YmlEQ1V0cDBIOWtVUSsyS2hGUWk0eVFKTnQxL2FtLzlkV29BMEM1bTdaSnNrRTFWdVpob21xZXhhdDQyQy9HQXRFbmVtZDl4WFh2dmltQUtoRGYxR0l4dGtwTDMrSDVraVc4YjhiK0lsN0tsZkpzcHRNazB1cUJESlpxSDFPVEc2SDhnUDE2bllFYXZ2bllCZGhWWERSemJJaUxYL3A1OEgwOXFBdmlCazdYTmJob1RJVkZuVmtvWlpzYkJ5c1Y0WEp0bDlQUXAyVllTcjllOHVGLzEwOGFHclg3WmZqUDdmS2lGcjdXNVRaS1RNa0kvVXQxbTNUY09NZ25vdTZFUkJKL3JwRTY1dDlDTWpaTVY2K1kwc2NRVU0yU0pqbDkxSTVqUjV0ZDBvcUN0aWhsZEdRVjdyWTg3WGMwSjlRTTdyMVFHbkJvLzY2NlZYWkVOZisyWG1iQnY5eU5abG81K21jb29Na1JseVRoR3I1NEs4aktJdnpla0ZDb3lDT2hKYVFkUWgyWGsxSnVaOTBROWFiNzVxRG5UaFliM3l3VHFDREJuUjc1eVFyUTV0VXlWZFJVRjJyZGs4MUkxcFJrR2RpcmxEN3J4dEpPeUxEbmZHZE9uSnBBR2s5bVNBTEZoVHIxNThTbmJJa0RIM1MrOFFlK3BOR1JJajA2UzRwU0ptRDZkdFFhSlRzUVBocGVMMGRWamJ3cWVyWHV0VkQ3SkNabG9yWDE1MmkrazRnSHpuRkJrcU0rVzA2dDF3RXNsd3FsT3hYcXhxTFVxY1NOajNRV3dQUGpLZzRlTTBqWXpvcXg3cys1RWhzdFNsYlpvOEpKbnlGN1dDUWFkaS9ReHA1bnJ1dUMyRURvaDlEMFFyZURydE12SnArTWdDMS95UkRVN1h5QXJiTG1TSERIVnJteTdQcUZUTWhZVHNEWElIdkVMQ0hXb0lyZW5ZU2NsOUMwQXJmTlNXWmsyN0dqNHlRVGJJQ0ZuaE5kOVg1T2x1c2RmeXh6TmtiSWNnMUkxcURhRVREWHN2akZid3JGR1BHdXQyeXhmQlIyWnMzZHFEa0NHWGVaOXpRbGJIVE1rOHVQWkF0TUxJd1hHeXJnZnB2UGFzTDlwcVFhMjA2WWhuQlk5YVUzTnFyOU91TmZMWkRwOG1lYVpLeHgrMnpBbTVZSUdUVHBiZGJOSHdvSFJhNXZ5QUI2MWhaTmpXa1ZHLzZrRTZyNjJDOTVRdnRDWWFPT3FsOWJQTzlhZ3h0YWJtMUo0TTZEbmZiUGxReUloZnQ1bnlFNWt0eDFzZ1pNWERzcHR6QUo0UkdrUWRFWG53T2lwYVlkUkFjc0NPOWF3UHFJVTJEUjAxMCtEcGlFZHRxVEcxcHViVXZoVys0MEkyQXJLOUlyZEtwaFNxSmlON1BlejVjQUxLTTZJdGlJeUlWaGcxa0ZZbzlhQ2QxOWFvRTBoZlVBc05uQlU2YXFjam5nYVBHbE5yM2Vkam81a3NrSW1BYmxObGdHVEtzekpYM2xGVkQ4OEVuaEZ0UVdTMXJLT2locEZBYWlnNWI5VHRIQTdlc2NENFFQdWRyMW9QdmxxaG8zWnR3ZE5SajVVdXRTY0RaS0hIdGxseW04eVc1VEpYUGxTZGIwNUdOWWdNMDV5a01pcHl6c0FCV1lIazJhV05BM2NzY0Q3UWZ0ZXZEQkphSDJwRnphZ2ROV1JRb2FiVWxobVBXbE56YWg4MDIyeTVXK2JJS3Brbjc3ZEVSSVpwVGxJNUFBMmpGVWdPbEdkWVc5T09jRjVib2JEREYyMzl6TitwZ1JVNEszVFVqaG95dXpIaVVWdHFUSzJEZHN1VTRUSkh4c3NjYVpScytWaWRNUnlBam93OGs2eFFjazdSMXVnRXgrejNRVnMvODNjZDRhZ0p0ZEdSanBveDJsRkRha2xOcVcydjJXWkp2TXlSZTlXQno1TUNtU2NuSlV2K29nYkZhOHNjb0RiQ2FUV2VkWTdaN3dPcmovbmYydjk4cFNZRUxrcytWbHBSTXlPUTNDdlVzbGR2dkFGNXJ0d2djK1FlbVNPalpZNWt5eHpaSkhPbFV1YkpEc21TblpJbFRZNEYxQWM3bGUrcEFiVXdOS0UyOXlxdFdtNGE5eTk1L3grWUZUOXdkMGVoOFFBQUFBQkpSVTVFcmtKZ2dnPT1cIi8+XG48L2RlZnM+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfUkFXID0gYDxzdmcgZmlsbD1cIm5vbmVcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiB3aWR0aD1cIjE2MFwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbiAgPHBhdHRlcm4gaWQ9XCJhXCIgaGVpZ2h0PVwiMVwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiPlxuICAgIDxpbWFnZSBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHRyYW5zZm9ybT1cInNjYWxlKC4wMDYyNSlcIiB3aWR0aD1cIjE2MFwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFNOVVsRVFWUjRBZTNkUzQvYjFoVUg4RE5Bb29YYmpXVWdnRmNCc2tsV1FXYlZJa0JpTFFJajQ4a2dDSkJ2VWZmaDFndWpYZFFweHVPK1AwSzc2QmNvOGkyNlNHcDMwWGViQUVWckozWWN2OGIyekRpK3haL0RQMDNSUTVHVTdpWFBrYzRBeEIxUkZIbnZPVDllWGxJU0paTHdiMzlqNDV0ZnZmZmVoVENaUEpkd003N3FCQkZBenBBNzVEREI2dE92TXB3Ky9jcFhHeHRYSDU4NUV3N2VmdnR5K2kzNkZtSkdBRGxEN3BCRDVETG11cE92YXcvNE5qYy9PbmoxMVhCdzhtUjQvTVliNFdCejgxTHlEZnNHb2tRQXVjcHlkdkprUUE2UlMrUTB5c3BUcndRVlBRQys5Zld3UHhxRmZaR3dmK0pFT0poTUhHSHE0RWRZUC9BaFY4aFpscnZSS0NDWHlLbDZoR1Y4QjhRSGdDTGhZRHgyaEJHQXBGd0Y4U0ZYR1Q3bXpnTENXZmpZR0VlWWtzOWk2NjdEVitST004STIrSXFHZUUrNG1KUUVyMjdDVitST0kwTGkyeStQK2ZLdW14Vi9wblNFQ1JqTnQwcmkyNjhjZHAvSkdYT0tvWldXTVdFWjM5NW9GUFpFV2s5b3NKK1l6SWNtMXF2SytMcmtEcmtlSE9FaStJckdPc0pZbGpxdmgvajJ4dVBXblVhUk4zUTBReUtNZ28rOXBTUHNqR2ZSRnl5TWo3a2JBbUZVZkd5SUkxelVWT3ZYUjhQSDNQV0pNQW0rdkNFK0pteHRhTzRGaVEreG5qcWNFdE84WlI4SXEvZ2V6VnZabXRkbDYvT2VjRzVjVFM4a1BvejVrdVF1SlVMZzI4ZGJNZXZyNGRGb2xEVUFqVWd4SVVEN2swblk4L2VPbTB5MWZoNnh6R0thNDB1UnQyeWR1QktDeTNFeDM3YnJFMThSR0VmWUdsZlRnc1QzS0RVK2RrZ3hFUTZDancxeGhFMjJHcC92SFI5ekZ3TWg4ZUdDWStyRGJ0SHpzUUY1NllmalJtTzFDeEFmeDN4MU1VNDJQeDhUem5VNEpyNCt4bnlOQWZDZXNCWlozUlBFMTl0aHQ5SnhGRG1kcHljRXZyMzhoT1BoYUJRZWlndytJWkI3Zm1KUzUyMXFQdkFoVm9pWmh0ekJFRHF5ekZUVGgxcUo3OUg2ZXRDQ2owRjBoRlBPam55Z0RoODdMMXc1YVVLb0daOGpQTkxiMUV5MStOb2czTnZheWc2N0ducys0bVBwUGVHVXUreUJlbnhISWR6YU92eU9TWGp6emRmRG1UTlhucnoybXJyREx0RlZTMGY0RktFWmZDV0VzQVp6c0NjZkhqLyt3dzlQbkFpZlBQOThDUGxDRDdpdzVoSVhWbGY4eEFUNEVJT0hXazQ0Wm5paEtSaUROWmlEUGJrbzh2WHZpbHordFVqNFZHUUtJVjZrZVVMZ3N3U3M0TnQyRDB2NE5PZUlkY05SRFBoZ0ROWmdEdmJZbDYrZEY5bHhoQXlIN3RJNlBsZ1RrYlZxbEIxaE5TSUtIeThyUG9hNlFQaUpINDRaRXpXbFZYeXdoS05yWGM5WERmQVV3aWY1T0hCWCtYZ3dHMnRnTUk1QitSS09DZEVtdE8zQmVLeDZYSTQ4MEFyc2RNVkhqQm5DWDRtRWY0dUVNa0tzWFBPRUJDMGJ3akkremJGbjNZQVFabUFIaHRyMmZNVEgwaEV5RWdPV3E0cVBJVGVOMFBvbEd1QkRHOUNyczNmUlhNYnErWWlQWmUyWVVITXdzcm9aUGh5ejU5czFobS9lTVIreDFaVlRQZUZYK1Rqd3ZralFQaUdCMXNhRVpYemE0NHY2WVdlSGlVWEhmSFg0T0gvdCt5STdQREd4aHZDQmtiTmo0RU5kc2VOWXhBY2pSMTFrSnFKRlMwZTRhQVJudk43eHpRaE82U25UQ0xVZWpxMGZkbFAzZkNWLzJiOEZ3bi9seDMrTUF5d2NNdTdqUXE2eXd6RjdQdFROUWd3NTVrUHVNU1RyR3g4eFRpRjhuQU84SnhLMFQwUzRxK0FkRTlRQk93VHFwRDF1cUI5MkVPUjZhSHhUQ0g4cEV2NlpWd3dWTkJGSVhON0FZSDlBaE5nMjZtQU5IM0tObkEvVjh4RWZ5K0lTRGZZS2F6M2hVQWl0NG1QUE4rL2JhMFFUdXpTTk1MdnMwV05QYVAyd3F3MGZNV2NJTFI2TzcrVW5KbjBjam9rUDJ6UXhWTW1QYWp6c2FzVlhJTVM0Z0FnUDh2SGdYWkdnZmVvRFlSbWY5bmlnZnRoQmtFUGkwekxtSTdhNk1qczcvb1ZJK0VmZUFEVEVSTUFUOW9SVzhTR0h5S1VWZkVTWklmU2U4REFjVnZGWjYvbUlqNlVqRkpIZHpjMXRuT1RnRUcvaUtHRDBzRXQwMWRJMHdrVXYwUUFmMW1FTkh3NjdtcTd6VlZGMWZWd2dSTVB3Q3p6b0NlNFltTzR1Y0xHYStMQU9FMjNOYzJOMXpOZUVNa1BJRTVObFIyZ1YzOStObm5BMDRlUHpLNEhROFRIZE9zdWxSbWdWMzdJZWR1dDJBZE1JNzlkOGdBSDQ4SnlQK2VyU3JtdCtnUkRqRHZ4cUR3YnF0dzFNZC9DWlBaelpsdDQ3dnJleGtlSERjeWJha01kODJjZDhUZVF6aEQ4WENSWVIzanQxS3V5Ky8vNlBNZUYvaS9nUWUydnZjRFNoNnZxOGFZUzc3N3dUTURtK3Jtblh0YnhkaE1lT2hUdkhqcGs3N0hyUDkrd09VQ0Q4bTdFeG9hVXhIMkxyK0o3Rnh6bFRDUEZqSjBqdWx6NHRGQVBFRUxGMGZHUTJ1M1NFRVhjNHh6Y2JXOTJ6ampBQ1FzZFh4NnZkZkVlNEFFTEgxdzVaMDFJRndyL200eGdFMXNlRXMyTkFmSWlabjNBMEVXdCtmdTE3SWpzL0V3a0lLRzcxRDRDM2ZEb3lCb2dOWW9SWUlXYUlYY29iQlRXbmJ6bVdjSVF0ZGpqSGx4YTdJNXlCMFBHbHhjZTFPOElqRURvKzh1aW5kSVFsaEk2dkgzVFZyUlFJLzVML2RnbE9TcjVZc1FsdHhrM0JFUU0vNGFnU1NmOTRwUkU2dnZUQTJteGhKUkU2dmpZMCtsdG1wUkE2dnY1Z2RkblNTaUIwZkYxSTlMOXNnZkRQK2U5VzRLVGs1aEtjbUxBTnVDOHoydlpUZjRlamYxMHR0NWdoUklLcUNKRkVxeE4ySk1mWFVvQ0N4WllLb2VOVElHcU9La3doeEUzVGVUaTIxQXVpenFpN0gzYm5FS0RnSld2ZkV0bjVRQ1Q4TWYvT3NTVjhxQ3UrSjQyNm93MW9pMytxUllHcXJsVzRPQnI5NVBjaVQ1QlFTNzBnNjRxNm93MWQyKzNMSzRuQXRWT25QcmorNG90UFBoY0pONHhOcURQcWpqWW9DYWRYbzBzRWRyZTJ0bmZmZWl2Y2Z1RUZjL2k0czZEdWFNUHV1KzllNnRKMlgzYmdDTnplM056K2NqSUpOOGRqcy9pSUVHMUFXMjZYN2tVemNIaDk4N01pc0V6NEhPR3NUQ3Q4RHZodUwwblBSM3dzMFJPaWJkNFRLb1NIS3BWN1Bvc25IWVJXVjZKTmZqaFdqdS9HZUJ5UXFHV2UwRVlmRXlxQ3lKNXZGZkJ4eDNLRVNnQ3VJajVIcUFnZkJ1V3IxUE1SSDB1MDNVOU1CZ0RKbmcrRGNpWmpWVXMvTWVrWklQRGRta3pDNStOeCtFekVKNXgwamNjQk1mRkxOSWt4T3I3NkhjNFJPcjdCZTJOSG1BaWg5M3oxUFY5MUdPSUlJeU4wZk8zeEVhTWpqSVRROFhYSDV3Z2o0YnUxdWJuOVJYNjJleDBmenZTcGN3elFFeUtHdC95alhOMVVFdDluNDNIbm9EdlU2WjBWTVhTRUhmdzV2bWxBTVhZb1I5Z1NvT09MajQrQUhXRURRb3Y0K0ZWUEpsbDc2UWhyRUZyRGh6Tk5mSFh5MDN6Qy81aW5IU0RxNXdnckNDM2l3Mjl4WE0zdlRJcTdrK0ovekhPRWxlUnFmMWpHZDAwa2FKL1Fnd0RhbjBUQ2prZzRLM0lSRS83SFBEeUhaYlMzQS9WYitaN1FLajcwZHBkRXduY09iNWVSN2VQNEgvUFlFeHBFdUsyOXM0cGFQOHY0ME52bCtOWktRVm5EUER6bkNFdFIwZmp2RXVKam1CMGhJNkcxWEdKOERMa2paQ1MwbFN1QWp5RjNoSXlFbG5LRjhESGtqcENSR0xxMGlBOC9nVlU1MnkyZmNMUU5hWWFRWjhkWXA1OGR0dzFkcE9XSTc5cDRIUDRub243QzlUSGkyejY4enJmb25Vblh6b3JzWUYwQWpYVmpHeVppOGZSVE5EWXYwUURmemNra1hEZUc3NHBJaUlTUHUzR0JFT3UyaEJDNVF3NlJTemJHUkdrWkh3Nlo2TFVpMzVNNVE0aDFPOExFaEIxZmJZQWRZVzFvSWozaCtCb0Q2UWdiUXpUbkFvNnZkZUFjWWV0UXRWelE4YlVNMU5QRkhPSFRXQ3oybitPYk8zNk9jTzdRNVMrMGlBOC9lNG96MFVSbnUxMURPb1VRZGJOeW5YRHdTelEzOCt0OHVNajhYeEgxRXk3K0tzTkhyTThnUkYwdHhCUzV4M1ZDV0dCamVpbXh3UnVUU2JDRUQ5L2J3Ryt2UmI3SUhDdmVHVUxVRFhWRVhTMGhoSVhlRUZyRXg1NVBLVDRpTGhCaWlJQTZPMEtHSmk4ZFh5VWc4Ujg2d3JxWU9yNjZ5RVNmN3dpcklYVjgxWWdrZit3SUdXTEh4MGowWGpwQ3g5Yzd1dW9HVnhlaDQ2dGFHT3p4NmlGMGZJTmhxOXZ3NmlCMGZIVUdCcCsvL0FnZDMrREltaXF3dkFnZFgxUHUxVHkvWEFqRDZkTmYyOTNhdW9TZmVyTDAzcTZSdDlkU3FUV05FTlpnRHZiazQ1ZGV1dkR4eXkrSC94dy9udDNmVHZ1bk1NcWZhbEgrM200cWZGeXZTWVM0aHlLc3dSenN5WTlFWGo4bmN1VzNlRUlrNENmanRTSjBmTFJYbEtZUXdoYU13UnJNd1Y3V2tyTWlyM3hiNUtQZktFYm8rQXAwMVg5TUlDUStHSU0xbUp0cXlBOFVJM1I4VTZrNjZvRnFoRlY4c0haVUkwUWpRc2QzWktxT21xa1NZV3Q4YkpFbWhJNlBXV2xkcWtMWUdSK2JxUUdoNDJNMk9wY3FFTTZOajgwZEVxSGpZeGJtTGdkRnVEQStObnNJaEk2UDBWKzRIQVJoTkh4c2ZwOElIUitqSHEzc0ZXRjBmQXhESHdnZEg2TWR2ZXdGWVRKOERFZEtoSTZQVVU1V0prV1lIQi9Ea2dLaDQyTjBrNWRKRVBhR2orR0ppZER4TWFxOWxWRVI5bzZQWVlxQjBQRXhtcjJYVVJBT2hvL2hXZ1NoNDJNVUJ5c1hRamc0UG9adEhvU09qOUVidkp3TG9ScDhERjhYaEk2UFVWTlRka0tvRGgvRDJBYWg0Mk8wMUpXdEVLckZ4M0RPUXVqNEdDVzE1VXlFNnZFeHJIVUlWL3dMUkF5UDluSUtJVzZTaWE5bW1NSEg2RllSM3RWOVoxSlcyOHZEQ0JRSWNhZFc1QTdmNGVESDZKRmJFNEVpd3QrSmhEK0loTXRwZnY3S1JDd01WakpEaUp3aGQ4Z2h2c05oQmg4RGpncWZGN2w2NGZBYlVKY2ovL1lhTitObG1naXNuUk81ak53aGgrYndNU2JuUmI1eFR1VENSWkhuT005TEd4RkF6cEE3NURCbGpmOFBOaFdRRDhOeGx0Z0FBQUFBU1VWT1JLNUNZSUk9XCIvPlxuICA8L3BhdHRlcm4+XG4gIDxwYXRoIGQ9XCJtMCAwaDE2MHYxNjBoLTE2MHpcIiBmaWxsPVwidXJsKCNhKVwiLz5cbjwvc3ZnPmA7XG5cbi8vIERhdGEgVVJMc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRE9XTkxPQURfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIFNVQ0NFU1NfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBFUlJPUl9JQ09OX1NWR19SQVcsXG4pfWA7XG5cbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBzdHJva2U9XCIjZmZmZmZmXCI+PGcgaWQ9XCJTVkdSZXBvX2JnQ2FycmllclwiIHN0cm9rZS13aWR0aD1cIjBcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX3RyYWNlckNhcnJpZXJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX2ljb25DYXJyaWVyXCI+PHBhdGggZD1cIk0xMC45NjggMTguNzY5QzE1LjQ5NSAxOC4xMDcgMTkgMTQuNDM0IDE5IDkuOTM4YTguNDkgOC40OSAwIDAgMC0uMjE2LTEuOTEyQzIwLjcxOCA5LjE3OCAyMiAxMS4xODggMjIgMTMuNDc1YTYuMSA2LjEgMCAwIDEtMS4xMTMgMy41MDZjLjA2Ljk0OS4zOTYgMS43ODEgMS4wMSAyLjQ5N2EuNDMuNDMgMCAwIDEtLjM2LjcxYy0xLjM2Ny0uMTExLTIuNDg1LS40MjYtMy4zNTQtLjk0NUE3LjQzNCA3LjQzNCAwIDAgMSAxNSAxOS45NWE3LjM2IDcuMzYgMCAwIDEtNC4wMzItMS4xODF6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PHBhdGggZD1cIk03LjYyNSAxNi42NTdjLjYuMTQyIDEuMjI4LjIxOCAxLjg3NS4yMTggNC4xNDIgMCA3LjUtMy4xMDYgNy41LTYuOTM4QzE3IDYuMTA3IDEzLjY0MiAzIDkuNSAzIDUuMzU4IDMgMiA2LjEwNiAyIDkuOTM4YzAgMS45NDYuODY2IDMuNzA1IDIuMjYyIDQuOTY1YTQuNDA2IDQuNDA2IDAgMCAxLTEuMDQ1IDIuMjkuNDYuNDYgMCAwIDAgLjM4Ni43NmMxLjctLjEzOCAzLjA0MS0uNTcgNC4wMjItMS4yOTZ6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PC9nPjwvc3ZnPmA7XG5cbi8vIDIuIEVkaXRlZDogQSBtaW5pbWFsIHBlbmNpbFxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9TVkdfUkFXID0gYDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPiA8cGF0aCBkPVwiTTEyIDMuOTk5OTdINkM0Ljg5NTQzIDMuOTk5OTcgNCA0Ljg5NTQgNCA1Ljk5OTk3VjE4QzQgMTkuMTA0NSA0Ljg5NTQzIDIwIDYgMjBIMThDMTkuMTA0NiAyMCAyMCAxOS4xMDQ1IDIwIDE4VjEyTTE4LjQxNDIgOC40MTQxN0wxOS41IDcuMzI4NDJDMjAuMjgxIDYuNTQ3MzcgMjAuMjgxIDUuMjgxMDQgMTkuNSA0LjVDMTguNzE4OSAzLjcxODk1IDE3LjQ1MjYgMy43MTg5NSAxNi42NzE1IDQuNTAwMDFMMTUuNTg1OCA1LjU4NTc1TTE4LjQxNDIgOC40MTQxN0wxMi4zNzc5IDE0LjQ1MDVDMTIuMDk4NyAxNC43Mjk3IDExLjc0MzEgMTQuOTIwMSAxMS4zNTYgMTQuOTk3NUw4LjQxNDIyIDE1LjU4NThMOS4wMDI1NyAxMi42NDQxQzkuMDgwMDEgMTIuMjU2OSA5LjI3MDMyIDExLjkwMTMgOS41NDk1MSAxMS42MjIxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTUuNTg1OCA1LjU4NTc1XCIgc3Ryb2tlPVwiI2ZmZmZmZlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L3BhdGg+IDwvZz48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRURJVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRURJVF9JQ09OX1NWR19SQVdcbil9YDtcbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBDT01NRU5UX0lDT05fU1ZHX1JBV1xuKX1gOyIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3N0eWxlcy50c1xuaW1wb3J0IHsgRE9XTkxPQURfSUNPTl9TVkdfVVJMIH0gZnJvbSAnLi9pY29ucyc7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBTUElOTkVSX1NJWkVfUFggPSAxNjtcblxuLy8gU21vb3RoLCBzbGlnaHRseSBib3VuY3kgdHJhbnNpdGlvbiBmb3IgdGhlIFwiRHJvcFwiIGZlZWxcbmNvbnN0IFRSQU5TSVRJT05fTVMgPSAxNTA7XG5jb25zdCBUUkFOU0lUSU9OX1NUUiA9IGAke1RSQU5TSVRJT05fTVN9bXMgY3ViaWMtYmV6aWVyKDAuMiwgMCwgMCwgMSlgO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5qZWN0U3R5bGVzKCk6IHZvaWQge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykgcmV0dXJuO1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoU1RZTEVfSUQpKSByZXR1cm47XG5cbiAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICBzdHlsZS5pZCA9IFNUWUxFX0lEO1xuICBzdHlsZS50ZXh0Q29udGVudCA9IGBcbiAgICA6cm9vdCB7XG4gICAgICAtLWNxZC10cmFuc2l0aW9uOiAke1RSQU5TSVRJT05fU1RSfTtcblxuICAgICAgLyogU3Bpbm5lciAoTGlnaHQgdGhlbWUgZGVmYXVsdHMpICovXG4gICAgICAtLWNxZC1zcGlubmVyLWJvcmRlcjogcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTsgLyogZGFyay1pc2ggcmluZyAqL1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICMwZjE3MmE7ICAgICAgICAgICAgICAgICAgIC8qIHNvbGlkIGRhcmsgdGlwICovXG5cbiAgICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICAgKiBDT0xPUiBQQUxFVFRFICYgU0hBRE9XUyAoTGlnaHQgTW9kZSAvIERlZmF1bHQpXG4gICAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgICAgXG4gICAgICAvKiAxLiBOb3JtYWwgKFByaW1hcnkpIC0gTGlnaHQ6ICMwMDVERDcgKi9cbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNURENztcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCA5MywgMjE1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDAsIDkzLCAyMTUsIDAuNzApO1xuXG4gICAgICAvKiAyLiBTdWNjZXNzIC0gTGlnaHQ6ICMwMEE4MkQgKi9cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwMEE4MkQ7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxNjgsIDQ1LCAwLjcwKTtcblxuICAgICAgLyogMy4gRXJyb3IgLSBMaWdodDogI0ZGNDAzNiAqL1xuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC8qIDQuIFRyeWluZyAtIExpZ2h0OiAjRUM2MzAwICovXG4gICAgICAtLWNxZC1jb2xvci10cnlpbmc6ICNFQzYzMDA7XG4gICAgICAtLWNxZC1zaGFkb3ctdHJ5aW5nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjM2LCA5OSwgMCwgMC43MCk7XG5cbiAgICAgIC8qIDUuIENvbW1lbnQgRnJhbWUgLSBMaWdodDogIzlCMDBGRiAqL1xuICAgICAgLS1jcWQtY29sb3ItY29tbWVudDogIzlCMDBGRjtcbiAgICAgIFxuICAgICAgLyogNi4gRWRpdGVkIEZyYW1lIC0gTGlnaHQ6ICMwMDdGOEQgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwN0Y4RDtcblxuICAgICAgLyogQmFzZSBTaGFkb3dzICovXG4gICAgICAtLWNxZC1zaGFkb3ctYmFzZTogMCAwcHggMTBweCByZ2JhKDE1LCAyMywgNDIsIDAuMjIpO1xuICAgICAgLS1jcWQtc2hhZG93LWhvdmVyOiAwIDEwcHggMjRweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuXG4gICAgICAvKiA3LiBCT1RIIChFZGl0ZWQgKyBDb21tZW50cykgLSBMaWdodCAqL1xuICAgICAgLS1jcWQtYm90aC1iZzogI0ZGNDAzNjtcbiAgICAgIC0tY3FkLWJvdGgtZmc6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1ib3RoLXNoYWRvdzogMCA4cHggMjJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICAgIC0tY3FkLWJvdGgtb3ZlcmxheS1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjRkY0MDM2LFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIERBUksgTU9ERSBPVkVSUklERVMgKEFwcGxpZWQgdmlhIC5jcWQtdGhlbWUtZGFyayBjbGFzcylcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtdGhlbWUtZGFyayB7XG4gICAgICAvKiAxLiBOb3JtYWwgKFByaW1hcnkpIC0gRGFyazogIzAwNkVGRiAqL1xuICAgICAgLS1jcWQtY29sb3Itbm9ybWFsOiAjMDA2RUZGO1xuICAgICAgLS1jcWQtc2hhZG93LW5vcm1hbDogMCA4cHggMjJweCByZ2JhKDAsIDExMCwgMjU1LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWwtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDAsIDExMCwgMjU1LCAwLjcwKTtcblxuICAgICAgLyogMi4gU3VjY2VzcyAtIERhcms6ICMwN0RBM0YgKi9cbiAgICAgIC0tY3FkLWNvbG9yLXN1Y2Nlc3M6ICMwN0RBM0Y7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2VzczogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSg3LCAyMTgsIDYzLCAwLjcwKTtcblxuICAgICAgLyogMy4gRXJyb3IgLSBEYXJrOiAjRkY0MDM2ICovXG4gICAgICAtLWNxZC1jb2xvci1lcnJvcjogI0ZGNDAzNjtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcblxuICAgICAgLyogNC4gVHJ5aW5nIC0gRGFyazogI0ZGOTE0MiAqL1xuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRkY5MTQyO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDE0NSwgNjYsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjcwKTtcblxuICAgICAgLyogNS4gQ29tbWVudCBGcmFtZSAtIERhcms6ICM5QjAwRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG5cbiAgICAgIC8qIDYuIEVkaXRlZCBGcmFtZSAtIERhcms6ICMwMEQ2RUUgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWVkaXRlZDogIzAwRDZFRTtcblxuICAgICAgLyogNy4gQk9USCAoRWRpdGVkICsgQ29tbWVudHMpIC0gRGFyayAqL1xuICAgICAgLS1jcWQtYm90aC1iZzogI2ZmZmZmZjtcbiAgICAgIC0tY3FkLWJvdGgtZmc6ICMwMDAwMDA7XG4gICAgICAtLWNxZC1ib3RoLXNoYWRvdzogMCA4cHggMjJweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuICAgICAgLS1jcWQtYm90aC1vdmVybGF5LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4ICNmZmZmZmYsXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC44NSk7XG5cbiAgICAgIC8qIFNwaW5uZXIgKERhcmsgdGhlbWUgb3ZlcnJpZGVzKSAqL1xuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yMik7XG4gICAgICAtLWNxZC1zcGlubmVyLXRvcDogI2ZmZmZmZjtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBDUklUSUNBTCBPVkVSUklERVNcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0ge1xuICAgICAgb3ZlcmZsb3c6IHZpc2libGUgIWltcG9ydGFudDtcbiAgICAgIGNvbnRhaW46IG5vbmUgIWltcG9ydGFudDtcbiAgICAgIHotaW5kZXg6IDE7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDEuIERPV05MT0FEIEJVVFRPTiBTVFlMRVNcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4ge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA1MCU7XG4gICAgICByaWdodDogOHB4O1xuICAgICAgei1pbmRleDogNTtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgd2lkdGg6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IGNhbGMoMTAwJSAtIDE2cHgpO1xuICAgICAgcGFkZGluZzogMDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1ub3JtYWwpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWJhc2UpO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCBcIlNlZ29lIFVJXCIsIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNjAwO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIHBhZGRpbmctaW5saW5lIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm9yZGVyLXJhZGl1cyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICB0cmFuc2Zvcm0gdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAvKiBTdGF0ZXMgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciB7XG4gICAgICB3aWR0aDogMTIwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctaG92ZXIpO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUge1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDAuOTcpO1xuICAgIH1cblxuICAgIC8qIEljb25zICYgTGFiZWxzICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1pY29uLXdyYXBwZXIge1xuICAgICAgZGlzcGxheTogaW5saW5lLWZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWljb24ge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICB3aWR0aDogMjRweDtcbiAgICAgIGhlaWdodDogMjRweDtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDI0cHggMjRweDtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgdHJhbnNmb3JtLW9yaWdpbjogY2VudGVyO1xuICAgICAgdHJhbnNpdGlvbjogd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1zbWFsbCB7XG4gICAgICB3aWR0aDogMTZweDtcbiAgICAgIGhlaWdodDogMTZweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogMTZweCAxNnB4O1xuICAgIH1cblxuICAgIC5jcWQtaWNvbi1tZWRpdW0ge1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDI0cHggMjRweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbGFyZ2Uge1xuICAgICAgd2lkdGg6IDMycHg7XG4gICAgICBoZWlnaHQ6IDMycHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDMycHggMzJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXJnaW4tbGVmdDogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgbWF4LXdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgbWFyZ2luLWxlZnQgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC10cnlpbmcpOm5vdCguY3FkLXN1Y2Nlc3MpOm5vdCguY3FkLWVycm9yKTpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDRweDtcbiAgICB9XG5cbiAgICAvKiBQaWxsIFN0YXRlcyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHBhZGRpbmctaW5saW5lOiAxMnB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctbm9ybWFsKTtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIHdpZHRoOiAxNTBweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nIHtcbiAgICAgIHdpZHRoOiAxMTBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci10cnlpbmcpO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXRyeWluZy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nIC5jcWQtbGFiZWwsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtd2lkdGg6IDExMHB4O1xuICAgICAgbWFyZ2luLWxlZnQ6IDEycHg7XG4gICAgfVxuXG4gICAgLyogU3VjY2VzcyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIHtcbiAgICAgIHdpZHRoOiAxNDBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1zdWNjZXNzKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3M6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1zdWNjZXNzLXN0cm9uZyk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA4cHg7XG4gICAgfVxuXG4gICAgLyogRXJyb3IgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3Ige1xuICAgICAgd2lkdGg6IDkwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZXJyb3IpO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvcik7XG4gICAgICBoZWlnaHQ6IDQwcHg7XG4gICAgICBtYXgtd2lkdGg6IDE1MHB4O1xuICAgICAgbWF4LWhlaWdodDogNDBweDtcbiAgICAgIHBhZGRpbmctdG9wOiAwO1xuICAgICAgcGFkZGluZy1ib3R0b206IDA7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAgdHJhbnNpdGlvbjogYWxsIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtc2l6ZTogMTFweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA1MDA7XG4gICAgICBsaW5lLWhlaWdodDogMS4zO1xuICAgICAgbWFyZ2luOiAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgd2hpdGUtc3BhY2U6IG5vcm1hbDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSg0cHgpO1xuICAgICAgdHJhbnNpdGlvbjogYWxsIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIge1xuICAgICAgd2lkdGg6IDM1MHB4O1xuICAgICAgbWF4LXdpZHRoOiAzNjBweDtcbiAgICAgIGhlaWdodDogNjBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDYxcHg7XG4gICAgICBwYWRkaW5nOiA4cHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAxOHB4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGdhcDogN3B4O1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBtYXJnaW46IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIC5jcWQtZXJyb3ItZGV0YWlsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiA2MHB4O1xuICAgICAgbWFyZ2luLXRvcDogNHB4O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgIH1cblxuICAgIC8qIFNwaW5uZXIgKi9cbiAgICAuY3FkLXNwaW5uZXIge1xuICAgICAgYmFja2dyb3VuZC1pbWFnZTogbm9uZTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIHdpZHRoOiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGhlaWdodDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBib3JkZXI6IDNweCBzb2xpZCB2YXIoLS1jcWQtc3Bpbm5lci1ib3JkZXIpO1xuICAgICAgYm9yZGVyLXRvcC1jb2xvcjogdmFyKC0tY3FkLXNwaW5uZXItdG9wKTtcbiAgICAgIGFuaW1hdGlvbjogY3FkLXNwaW4gMC42NXMgbGluZWFyIGluZmluaXRlO1xuICAgIH1cbiAgICBAa2V5ZnJhbWVzIGNxZC1zcGluIHtcbiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgdG8gICB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH1cbiAgICB9XG5cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAyLiBDT01NRU5UIEZSQU1FICYgQkFER0VcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgLmNxZC1vdmVybGF5LWNvbnRhaW5lciB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDA7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICBib3R0b206IDA7XG4gICAgICBwb2ludGVyLWV2ZW50czogbm9uZTtcbiAgICAgIHotaW5kZXg6IDEwO1xuICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IGluaGVyaXQ7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWNvbG9yLWNvbW1lbnQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDk5LCAxMDIsIDI0MSwgMC41KTtcbiAgICB9XG4gICAgXG4gICAgLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWNvbW1lbnQpO1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1jb21tZW50LWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgZmlsdGVyOiBicmlnaHRuZXNzKDApIGludmVydCgxKTtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICB9XG5cbiAgICAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01cHgpO1xuICAgICAgbWF4LWhlaWdodDogMDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciAuY3FkLWJhZGdlLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAzLiBFRElURUQgRlJBTUUgJiBQSUxMXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIFxuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIuY3FkLWVkaXRlZCB7XG4gICAgICBib3gtc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCksXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMCwgMjE0LCAyMzgsIDAuMyk7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZWRpdGVkKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBkZWZhdWx0O1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG4gICAgXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWVkaXRlZC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24ge1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyOyBcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWljb24gc3ZnIHtcbiAgICAgIHdpZHRoOiAxOHB4O1xuICAgICAgaGVpZ2h0OiAxOHB4O1xuICAgICAgc3Ryb2tlOiBjdXJyZW50Q29sb3I7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiA1MHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiA4cHg7XG4gICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1jb250ZW50IHtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC0xMHB4KTtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIG9wYWNpdHkgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgdHJhbnNmb3JtIDAuMTVzIGVhc2UgMC4wNXM7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1iYWRnZTpob3ZlciAuY3FkLWVkaXRlZC1jb250ZW50IHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoMCk7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgIH1cblxuICAgIC5jcWQtZGlmZi12YWwge1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDQuIEJPVEggU1RBVEUgKEVkaXRlZCArIENvbW1lbnRzIOKGkiBPTkUgcGlsbClcbiAgICAgKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbiAgICAvKiBXaGVuIGEgcG9zdCBoYXMgYm90aCBkYXRhLWNxZC1wcm9jZXNzZWQgYW5kIGRhdGEtY3FkLWVkaXRlZC1wcm9jZXNzZWQsXG4gICAgICAgZ2l2ZSB0aGUgZnJhbWUgYSBkYXJrZXIgb3V0bGluZS9nbG93IHNvIGl0IGZlZWxzIHNwZWNpYWwgKi9cbiAgICBkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF1bZGF0YS1jcWQtcHJvY2Vzc2VkXVtkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkXSA+IC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4ICNGRjQwMzYsXG4gICAgICAgIDAgMCAxMnB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogNzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6ICNGRjQwMzY7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJvcmRlcjogMXB4IHNvbGlkIHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHBhZGRpbmctdG9wOiA4cHg7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtc2VjdGlvbiB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtaWNvbiB7XG4gICAgICB3aWR0aDogMjBweDtcbiAgICAgIGhlaWdodDogMjBweDtcbiAgICAgIGJhY2tncm91bmQtc2l6ZTogY29udGFpbjtcbiAgICAgIGJhY2tncm91bmQtcmVwZWF0OiBuby1yZXBlYXQ7XG4gICAgICBiYWNrZ3JvdW5kLXBvc2l0aW9uOiBjZW50ZXI7XG4gICAgICAvKiBubyBmaWx0ZXIgc28gdGhlIGFzc2V0IHN0YXlzIGNyaXNwIGluIGFsbCB0aGVtZXMgKi9cbiAgICB9XG5cbiAgICAvKiBFZGl0ZWQgaWNvbiAoU1ZHKSB1c2VzIGN1cnJlbnRDb2xvciAod2hpdGUpICovXG4gICAgLmNxZC1ib3RoLWljb24tZWRpdGVkIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC8qIFRoZSBcIitcIiBiZXR3ZWVuIGljb25zIChhbHdheXMgdmlzaWJsZSkgKi9cbiAgICAuY3FkLWJvdGgtcGx1cyB7XG4gICAgICBmb250LXNpemU6IDE0cHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDE7XG4gICAgICBtYXJnaW46IDVweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtdmFsdWUsXG4gICAgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIG9wYWNpdHkgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWF4LWhlaWdodCAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXJnaW4tdG9wIDAuMTVzIGVhc2UgMC4wNXM7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDEyMHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLXZhbHVlIHtcbiAgICAgIG9wYWNpdHk6IDE7XG4gICAgICBtYXgtaGVpZ2h0OiAyMHB4O1xuICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgIH1cblxuICAgIC5jcWQtYm90aC1iYWRnZTpob3ZlciAuY3FkLWJvdGgtZGl2aWRlciB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNHB4O1xuICAgICAgbWFyZ2luLXRvcDogMnB4O1xuICAgIH1cblxuICBgLnRyaW0oKTtcblxuICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpLmFwcGVuZENoaWxkKHN0eWxlKTtcbn1cbiIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHNcblxuLyoqXG4gKiBTSEFSRUQgRElDVElPTkFSWSAtIDc1IExBTkdVQUdFU1xuICogTm93IGluY2x1ZGVzIHRoZSAnZWRpdGVkJyBrZXl3b3JkIGZvciBkZXRlY3Rpb24uXG4gKi9cblxuY29uc3QgVFJBTlNMQVRJT05TOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge1xuICBlbjogeyBkb3dubG9hZDogJ0Rvd25sb2FkJywgZG93bmxvYWRpbmc6ICdEb3dubG9hZGluZ+KApicsIHRyeWluZzogJ1RyeWluZ+KApicsIGRvd25sb2FkZWQ6ICdEb3dubG9hZGVkJywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ0Rvd25sb2FkIGZhaWxlZC4nLCBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsIHRpdGxlUXVpY2s6ICdRdWljayBkb3dubG9hZCcsIGNvbW1lbnRzOiAnY29tbWVudHMnLCBlZGl0ZWQ6ICdFZGl0ZWQnIH0sXG4gIGFyOiB7IGRvd25sb2FkOiAn2KrZhtiy2YrZhCcsIGRvd25sb2FkaW5nOiAn2KzYp9ix2Yog2KfZhNiq2YbYstmK2YTigKYnLCB0cnlpbmc6ICfZhdit2KfZiNmE2KnigKYnLCBkb3dubG9hZGVkOiAn2KrZhSDYp9mE2KrZhtiy2YrZhCcsIGVycm9yOiAn2K7Yt9ijJywgZmFpbGVkOiAn2YHYtNmEINin2YTYqtmG2LLZitmELicsIGFyaWFEb3dubG9hZDogJ9iq2YbYstmK2YQnLCB0aXRsZVF1aWNrOiAn2KrZhtiy2YrZhCDYs9ix2YrYuScsIGNvbW1lbnRzOiAn2KrYudmE2YrZgtin2KonLCBlZGl0ZWQ6ICfYqtmFINin2YTYqti52K/ZitmEJyB9LFxuICBqYTogeyBkb3dubG9hZDogJ+ODgOOCpuODs+ODreODvOODiScsIGRvd25sb2FkaW5nOiAnREzkuK3igKYnLCB0cnlpbmc6ICfoqabooYzkuK3igKYnLCBkb3dubG9hZGVkOiAn5a6M5LqGJywgZXJyb3I6ICfjgqjjg6njg7wnLCBmYWlsZWQ6ICflpLHmlZfjgZfjgb7jgZfjgZ/jgIInLCBhcmlhRG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLCB0aXRsZVF1aWNrOiAn44Kv44Kk44OD44Kv44OA44Km44Oz44Ot44O844OJJywgY29tbWVudHM6ICfku7bjga7jgrPjg6Hjg7Pjg4gnLCBlZGl0ZWQ6ICfnt6jpm4bmuIjjgb8nIH0sXG4gIGVzOiB7IGRvd25sb2FkOiAnRGVzY2FyZ2FyJywgZG93bmxvYWRpbmc6ICdEZXNjYXJnYW5kb+KApicsIHRyeWluZzogJ0ludGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdGYWxsw7MgbGEgZGVzY2FyZ2EuJywgYXJpYURvd25sb2FkOiAnRGVzY2FyZ2FyJywgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgaGk6IHsgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoeCkv+CkguCkl+KApicsIHRyeWluZzogJ+CkleCli+CktuCkv+CktiDgpJzgpL7gpLDgpYDigKYnLCBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpLXgpL/gpKvgpLIg4KSw4KS54KS+JywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+CkpOCljeCkteCksOCkv+CkpCDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+Ckv+Ckr+CkvuCkgScsIGVkaXRlZDogJ+CkuOCkguCkquCkvuCkpuCkv+CkpCcgfSxcbiAgcHQ6IHsgZG93bmxvYWQ6ICdCYWl4YXInLCBkb3dubG9hZGluZzogJ0JhaXhhbmRv4oCmJywgdHJ5aW5nOiAnVGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnQmFpeGFkbycsIGVycm9yOiAnRXJybycsIGZhaWxlZDogJ0ZhbGhhIGFvIGJhaXhhci4nLCBhcmlhRG93bmxvYWQ6ICdCYWl4YXInLCB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcsOhcGlkbycsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3B0LXB0JzogeyBkb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJywgZG93bmxvYWRpbmc6ICdBIGRlc2NhcnJlZ2Fy4oCmJywgdHJ5aW5nOiAnQSB0ZW50YXLigKYnLCBkb3dubG9hZGVkOiAnRGVzY2FycmVnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsaGEgYW8gZGVzY2FycmVnYXIuJywgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYXInLCB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsIGNvbW1lbnRzOiAnY29tZW50w6FyaW9zJywgZWRpdGVkOiAnRWRpdGFkbycgfSxcbiAgJ3poLWNuJzogeyBkb3dubG9hZDogJ+S4i+i9vScsIGRvd25sb2FkaW5nOiAn5LiL6L295Lit4oCmJywgdHJ5aW5nOiAn5bCd6K+V5Lit4oCmJywgZG93bmxvYWRlZDogJ+W3suS4i+i9vScsIGVycm9yOiAn6ZSZ6K+vJywgZmFpbGVkOiAn5LiL6L295aSx6LSlJywgYXJpYURvd25sb2FkOiAn5LiL6L29JywgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i9vScsIGNvbW1lbnRzOiAn5p2h6K+E6K66JywgZWRpdGVkOiAn5bey57yW6L6RJyB9LFxuICAnemgtdHcnOiB7IGRvd25sb2FkOiAn5LiL6LyJJywgZG93bmxvYWRpbmc6ICfkuIvovInkuK3igKYnLCB0cnlpbmc6ICflmJfoqabkuK3igKYnLCBkb3dubG9hZGVkOiAn5bey5LiL6LyJJywgZXJyb3I6ICfpjK/oqqQnLCBmYWlsZWQ6ICfkuIvovInlpLHmlZcnLCBhcmlhRG93bmxvYWQ6ICfkuIvovIknLCB0aXRsZVF1aWNrOiAn5b+r6YCf5LiL6LyJJywgY29tbWVudHM6ICfliYfnlZnoqIAnLCBlZGl0ZWQ6ICflt7Lnt6jovK8nIH0sXG4gIGZyOiB7IGRvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsIGRvd25sb2FkaW5nOiAnVMOpbMOpY2hhcmdlbWVudOKApicsIHRyeWluZzogJ0Vzc2Fp4oCmJywgZG93bmxvYWRlZDogJ1TDqWzDqWNoYXJnw6knLCBlcnJvcjogJ0VycmV1cicsIGZhaWxlZDogJ8OJY2hlYy4nLCBhcmlhRG93bmxvYWQ6ICdUw6lsw6ljaGFyZ2VyJywgdGl0bGVRdWljazogJ1TDqWzDqWNoYXJnZW1lbnQgcmFwaWRlJywgY29tbWVudHM6ICdjb21tZW50YWlyZXMnLCBlZGl0ZWQ6ICdNb2RpZmnDqScgfSxcbiAgZGU6IHsgZG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJywgZG93bmxvYWRpbmc6ICdMYWRlbuKApicsIHRyeWluZzogJ1ZlcnN1Y2hlbuKApicsIGRvd25sb2FkZWQ6ICdGZXJ0aWcnLCBlcnJvcjogJ0ZlaGxlcicsIGZhaWxlZDogJ0ZlaGxnZXNjaGxhZ2VuLicsIGFyaWFEb3dubG9hZDogJ0hlcnVudGVybGFkZW4nLCB0aXRsZVF1aWNrOiAnU2NobmVsbGVyIERvd25sb2FkJywgY29tbWVudHM6ICdLb21tZW50YXJlJywgZWRpdGVkOiAnQmVhcmJlaXRldCcgfSxcbiAgaXQ6IHsgZG93bmxvYWQ6ICdTY2FyaWNhJywgZG93bmxvYWRpbmc6ICdTY2FyaWNhbWVudG/igKYnLCB0cnlpbmc6ICdQcm92YW5kb+KApicsIGRvd25sb2FkZWQ6ICdTY2FyaWNhdG8nLCBlcnJvcjogJ0Vycm9yZScsIGZhaWxlZDogJ0ZhbGxpdG8uJywgYXJpYURvd25sb2FkOiAnU2NhcmljYScsIHRpdGxlUXVpY2s6ICdEb3dubG9hZCByYXBpZG8nLCBjb21tZW50czogJ2NvbW1lbnRpJywgZWRpdGVkOiAnTW9kaWZpY2F0bycgfSxcbiAgcnU6IHsgZG93bmxvYWQ6ICfQodC60LDRh9Cw0YLRjCcsIGRvd25sb2FkaW5nOiAn0KHQutCw0YfQuNCy0LDQvdC40LXigKYnLCB0cnlpbmc6ICfQn9C+0L/Ri9GC0LrQsOKApicsIGRvd25sb2FkZWQ6ICfQodC60LDRh9Cw0L3QvicsIGVycm9yOiAn0J7RiNC40LHQutCwJywgZmFpbGVkOiAn0KHQsdC+0LkuJywgYXJpYURvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLCB0aXRsZVF1aWNrOiAn0JHRi9GB0YLRgNC+0LUg0YHQutCw0YfQuNCy0LDQvdC40LUnLCBjb21tZW50czogJ9C60L7QvNC80LXQvdGC0LDRgNC40LXQsicsIGVkaXRlZDogJ9CY0LfQvNC10L3QtdC90L4nIH0sXG4gIGtvOiB7IGRvd25sb2FkOiAn64uk7Jq066Gc65OcJywgZG93bmxvYWRpbmc6ICfri6TsmrTroZzrk5wg7KSR4oCmJywgdHJ5aW5nOiAn7Iuc64+EIOykkeKApicsIGRvd25sb2FkZWQ6ICfsmYTro4wnLCBlcnJvcjogJ+yYpOulmCcsIGZhaWxlZDogJ+yLpO2MqO2VqCcsIGFyaWFEb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsIHRpdGxlUXVpY2s6ICfruaDrpbgg64uk7Jq066Gc65OcJywgY29tbWVudHM6ICfqsJwg64yT6riAJywgZWRpdGVkOiAn7IiY7KCV65CoJyB9LFxuICB0cjogeyBkb3dubG9hZDogJ8SwbmRpcicsIGRvd25sb2FkaW5nOiAnxLBuZGlyaWxpeW9y4oCmJywgdHJ5aW5nOiAnRGVuZW5peW9y4oCmJywgZG93bmxvYWRlZDogJ8SwbmRpcmlsZGknLCBlcnJvcjogJ0hhdGEnLCBmYWlsZWQ6ICdCYcWfYXLEsXPEsXouJywgYXJpYURvd25sb2FkOiAnxLBuZGlyJywgdGl0bGVRdWljazogJ0jEsXpsxLEgaW5kaXInLCBjb21tZW50czogJ3lvcnVtJywgZWRpdGVkOiAnRMO8emVubGVuZGknIH0sXG4gIHZpOiB7IGRvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsIGRvd25sb2FkaW5nOiAnxJBhbmcgdOG6o2nigKYnLCB0cnlpbmc6ICfEkGFuZyB0aOG7reKApicsIGRvd25sb2FkZWQ6ICfEkMOjIHThuqNpJywgZXJyb3I6ICdM4buXaScsIGZhaWxlZDogJ1Ro4bqldCBi4bqhaS4nLCBhcmlhRG93bmxvYWQ6ICdU4bqjaSB4deG7kW5nJywgdGl0bGVRdWljazogJ1ThuqNpIHh14buRbmcgbmhhbmgnLCBjb21tZW50czogJ25o4bqtbiB4w6l0JywgZWRpdGVkOiAnxJDDoyBjaOG7iW5oIHPhu61hJyB9LFxuICBpZDogeyBkb3dubG9hZDogJ0Rvd25sb2FkJywgZG93bmxvYWRpbmc6ICdNZW5ndW5kdWjigKYnLCB0cnlpbmc6ICdNZW5jb2Jh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ0tlc2FsYWhhbicsIGZhaWxlZDogJ0dhZ2FsLicsIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkJywgdGl0bGVRdWljazogJ0Rvd25sb2FkIGNlcGF0JywgY29tbWVudHM6ICdrb21lbnRhcicsIGVkaXRlZDogJ0RpZWRpdCcgfSxcbiAgdGg6IHsgZG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLCBkb3dubG9hZGluZzogJ+C4geC4s+C4peC4seC4h+C5guC4q+C4peC4lOKApicsIHRyeWluZzogJ+C4nuC4ouC4suC4ouC4suC4oeKApicsIGRvd25sb2FkZWQ6ICfguYDguKrguKPguYfguIjguKrguLTguYnguJknLCBlcnJvcjogJ+C4guC5ieC4reC4nOC4tOC4lOC4nuC4peC4suC4lCcsIGZhaWxlZDogJ+C4peC5ieC4oeC5gOC4q+C4peC4pycsIGFyaWFEb3dubG9hZDogJ+C4lOC4suC4p+C4meC5jOC5guC4q+C4peC4lCcsIHRpdGxlUXVpY2s6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJTguJTguYjguKfguJknLCBjb21tZW50czogJ+C4hOC4p+C4suC4oeC4hOC4tOC4lOC5gOC4q+C5h+C4mScsIGVkaXRlZDogJ+C5geC4geC5ieC5hOC4guC5geC4peC5ieC4pycgfSxcbiAgcGw6IHsgZG93bmxvYWQ6ICdQb2JpZXJ6JywgZG93bmxvYWRpbmc6ICdQb2JpZXJhbmll4oCmJywgdHJ5aW5nOiAnUHLDs2Jh4oCmJywgZG93bmxvYWRlZDogJ1BvYnJhbm8nLCBlcnJvcjogJ0LFgsSFZCcsIGZhaWxlZDogJ05pZXVkYW5lLicsIGFyaWFEb3dubG9hZDogJ1BvYmllcnonLCB0aXRsZVF1aWNrOiAnU3p5YmtpZSBwb2JpZXJhbmllJywgY29tbWVudHM6ICdrb21lbnRhcnplJywgZWRpdGVkOiAnRWR5dG93YW5vJyB9LFxuICBubDogeyBkb3dubG9hZDogJ0Rvd25sb2FkZW4nLCBkb3dubG9hZGluZzogJ0Rvd25sb2FkZW7igKYnLCB0cnlpbmc6ICdQcm9iZXJlbuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1a3QuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWRlbicsIHRpdGxlUXVpY2s6ICdTbmVsIGRvd25sb2FkZW4nLCBjb21tZW50czogJ3JlYWN0aWVzJywgZWRpdGVkOiAnQmV3ZXJrdCcgfSxcbiAgYm46IHsgZG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLCBkb3dubG9hZGluZzogJ+CmoeCmvuCmieCmqOCmsuCni+CmoSDgprngpprgp43gppvgp4figKYnLCB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kaw4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCmqOCnjeCmqCcsIGVycm9yOiAn4Kak4KeN4Kaw4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4KeN4Kav4Kaw4KeN4KalIOCmueCmr+CmvOCnh+Cmm+CnhycsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gprDgp4HgpqQg4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJywgY29tbWVudHM6ICfgpp/gpr8g4Kau4Kao4KeN4Kak4Kas4KeN4KavJywgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyB9LFxuICBwYTogeyBkb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsIGRvd25sb2FkaW5nOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihIOCoueCpiyDgqLDgqL/gqLngqL7igKYnLCB0cnlpbmc6ICfgqJXgqYvgqLjgqLzgqL/gqLjgqLwg4Kic4Ki+4Kiw4KmA4oCmJywgZG93bmxvYWRlZDogJ+CoruCpgeColeCpsOCoruCosicsIGVycm9yOiAn4KiX4Kiy4Kik4KmAJywgZmFpbGVkOiAn4KiF4Ki44Kir4KiyJywgYXJpYURvd25sb2FkOiAn4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJywgdGl0bGVRdWljazogJ+CopOCph+ConOCovCDgqKHgqL7gqIngqKjgqLLgqYvgqKEnLCBjb21tZW50czogJ+Con+Cov+CpseCoquCoo+CpgOCohuCogicsIGVkaXRlZDogJ+CouOCpsOCoquCovuCopuCov+CopCcgfSxcbiAgdGU6IHsgZG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCBkb3dubG9hZGluZzogJ+CwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjSDgsIXgsLXgsYHgsKTgsYvgsILgsKbgsL/igKYnLCB0cnlpbmc6ICfgsKrgsY3gsLDgsK/gsKTgsY3gsKjgsL/gsLjgsY3gsKTgsYvgsILgsKbgsL/igKYnLCBkb3dubG9hZGVkOiAn4LCq4LGC4LCw4LGN4LCk4LCv4LC/4LCC4LCm4LC/JywgZXJyb3I6ICfgsLLgsYvgsKrgsIInLCBmYWlsZWQ6ICfgsLXgsL/gsKvgsLLgsK7gsYjgsILgsKbgsL8nLCBhcmlhRG93bmxvYWQ6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCB0aXRsZVF1aWNrOiAn4LCk4LGN4LC14LCw4LC/4LCkIOCwoeCxjOCwqOCxjeKAjOCwsuCxi+CwoeCxjScsIGNvbW1lbnRzOiAn4LC14LGN4LCv4LC+4LCW4LGN4LCv4LCy4LGBJywgZWRpdGVkOiAn4LC44LC14LCw4LC/4LCC4LCa4LCs4LCh4LC/4LCC4LCm4LC/JyB9LFxuICBtcjogeyBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueCli+CkpCDgpIbgpLngpYfigKYnLCB0cnlpbmc6ICfgpKrgpY3gpLDgpK/gpKTgpY3gpKgg4KSV4KSw4KSkIOCkhuCkueClh+KApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpY3gpKMnLCBlcnJvcjogJ+CkpOCljeCksOClgeCkn+ClgCcsIGZhaWxlZDogJ+CkheCkr+CktuCkuOCljeCkteClgCcsIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpY3gpK/gpL4nLCBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnIH0sXG4gIHRhOiB7IGRvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJywgZG93bmxvYWRpbmc6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4HgrpXgrr/grrHgrqTgr4HigKYnLCB0cnlpbmc6ICfgrq7gr4Hgrq/grrHgr43grprgrr/grpXgr43grpXgrr/grrHgrqTgr4HigKYnLCBkb3dubG9hZGVkOiAn4K6u4K+B4K6f4K6/4K6o4K+N4K6k4K6k4K+BJywgZXJyb3I6ICfgrqrgrr/grrTgr4gnLCBmYWlsZWQ6ICfgrqTgr4vgrrLgr43grrXgrr8nLCBhcmlhRG93bmxvYWQ6ICfgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgr4EnLCB0aXRsZVF1aWNrOiAn4K614K6/4K6w4K+I4K614K+BIOCuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCuruCvjScsIGNvbW1lbnRzOiAn4K6V4K6w4K+B4K6k4K+N4K6k4K+B4K6V4K6z4K+NJywgZWRpdGVkOiAn4K6k4K6/4K6w4K+B4K6k4K+N4K6k4K6q4K+N4K6q4K6f4K+N4K6f4K6k4K+BJyB9LFxuICB1cjogeyBkb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsIGRvd25sb2FkaW5nOiAn2ojYp9ik2YYg2YTZiNqIINuB2Ygg2LHbgdinINuB25LigKYnLCB0cnlpbmc6ICfaqdmI2LTYtCDYrNin2LHbjOKApicsIGRvd25sb2FkZWQ6ICfZhdqp2YXZhCcsIGVycm9yOiAn2LrZhNi324wnLCBmYWlsZWQ6ICfZhtin2qnYp9mFJywgYXJpYURvd25sb2FkOiAn2ojYp9ik2YYg2YTZiNqIJywgdGl0bGVRdWljazogJ9mB2YjYsduMINqI2KfYpNmGINmE2YjaiCcsIGNvbW1lbnRzOiAn2KrYqNi12LHbkicsIGVkaXRlZDogJ9iq2LHZhduM2YUg2LTYr9uBJyB9LFxuICBndTogeyBkb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIGRvd25sb2FkaW5nOiAn4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhIOCqpeCqiCDgqrDgqrngq43gqq/gq4HgqoIg4Kqb4KuH4oCmJywgdHJ5aW5nOiAn4Kqq4KuN4Kqw4Kqv4Kq+4Kq4IOCqmuCqvuCqsuCrgeKApicsIGRvd25sb2FkZWQ6ICfgqqrgq4LgqrDgq43gqqMnLCBlcnJvcjogJ+CqreCrguCqsicsIGZhaWxlZDogJ+CqqOCqv+Cqt+CrjeCqq+CqsycsIGFyaWFEb3dubG9hZDogJ+CqoeCqvuCqieCqqOCqsuCri+CqoScsIHRpdGxlUXVpY2s6ICfgqp3gqqHgqqrgq4Ag4Kqh4Kq+4KqJ4Kqo4Kqy4KuL4KqhJywgY29tbWVudHM6ICfgqp/gqr/gqqrgq43gqqrgqqPgq4DgqpMnLCBlZGl0ZWQ6ICfgqrjgqoLgqqrgqr7gqqbgqr/gqqQnIH0sXG4gIGtuOiB7IGRvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgZG93bmxvYWRpbmc6ICfgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40g4LKG4LKX4LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgdHJ5aW5nOiAn4LKq4LON4LKw4LKv4LKk4LON4LKo4LK/4LK44LOB4LKk4LON4LKk4LK/4LKm4LOG4oCmJywgZG93bmxvYWRlZDogJ+CyquCzguCysOCzjeCyo+Cyl+CziuCyguCyoeCyv+CypuCzhicsIGVycm9yOiAn4LKm4LOL4LK3JywgZmFpbGVkOiAn4LK14LK/4LKr4LKy4LK14LK+4LKX4LK/4LKm4LOGJywgYXJpYURvd25sb2FkOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgdGl0bGVRdWljazogJ+CypOCzjeCyteCysOCyv+CypCDgsqHgs4zgsqjgs43igIzgsrLgs4vgsqHgs40nLCBjb21tZW50czogJ+CyleCyvuCyruCzhuCyguCyn+CzjeKAjOCyl+Cys+CzgScsIGVkaXRlZDogJ+CyuOCyguCyquCyvuCypuCyv+CyuOCysuCyvuCyl+Cyv+CypuCzhicgfSxcbiAgbWw6IHsgZG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCBkb3dubG9hZGluZzogJ+C0oeC1l+C1uuC0suC1i+C0oeC1jSDgtJrgtYbgtK/gtY3gtK/gtYHgtKjgtY3gtKjgtYHigKYnLCB0cnlpbmc6ICfgtLbgtY3gtLDgtK7gtL/gtJXgtY3gtJXgtYHgtKjgtY3gtKjgtYHigKYnLCBkb3dubG9hZGVkOiAn4LSq4LWC4LW84LSk4LWN4LSk4LS/4LSv4LS+4LSv4LS/JywgZXJyb3I6ICfgtKrgtL/gtLbgtJXgtY0nLCBmYWlsZWQ6ICfgtKrgtLDgtL7gtJzgtK/gtKrgtY3gtKrgtYbgtJ/gtY3gtJ/gtYEnLCBhcmlhRG93bmxvYWQ6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCB0aXRsZVF1aWNrOiAn4LS14LWH4LSX4LSk4LWN4LSk4LS/4LW9IOC0oeC1l+C1uuC0suC1i+C0oeC1jScsIGNvbW1lbnRzOiAn4LSF4LSt4LS/4LSq4LWN4LSw4LS+4LSv4LSZ4LWN4LSZ4LW+JywgZWRpdGVkOiAn4LSO4LSh4LS/4LSx4LWN4LSx4LWB4LSa4LWG4LSv4LWN4LSk4LWBJyB9LFxuICB1azogeyBkb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLCBkb3dubG9hZGluZzogJ9CX0LDQstCw0L3RgtCw0LbQtdC90L3Rj+KApicsIHRyeWluZzogJ9Ch0L/RgNC+0LHQsOKApicsIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLCBlcnJvcjogJ9Cf0L7QvNC40LvQutCwJywgZmFpbGVkOiAn0J3QtdCy0LTQsNGH0LAuJywgYXJpYURvd25sb2FkOiAn0JfQsNCy0LDQvdGC0LDQttC40YLQuCcsIHRpdGxlUXVpY2s6ICfQqNCy0LjQtNC60LUg0LfQsNCy0LDQvdGC0LDQttC10L3QvdGPJywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0ZbQsicsIGVkaXRlZDogJ9CX0LzRltC90LXQvdC+JyB9LFxuICBlbDogeyBkb3dubG9hZDogJ86bzq7PiM63JywgZG93bmxvYWRpbmc6ICfOm86uz4jOt+KApicsIHRyeWluZzogJ86gz4HOv8+Dz4DOrM64zrXOuc6x4oCmJywgZG93bmxvYWRlZDogJ86fzrvOv866zrvOt8+Bz47OuM63zrrOtScsIGVycm9yOiAnzqPPhs6szrvOvM6xJywgZmFpbGVkOiAnzpHPgM6tz4TPhc+HzrUuJywgYXJpYURvd25sb2FkOiAnzpvOrs+IzrcnLCB0aXRsZVF1aWNrOiAnzpPPgc6uzrPOv8+BzrcgzrvOrs+IzrcnLCBjb21tZW50czogJ8+Dz4fPjM67zrnOsScsIGVkaXRlZDogJ86Vz4DOtc6+zrXPgc6zzrHPg868zq3Ovc6/JyB9LFxuICBjczogeyBkb3dubG9hZDogJ1N0w6Fobm91dCcsIGRvd25sb2FkaW5nOiAnU3RhaG92w6Fuw63igKYnLCB0cnlpbmc6ICdaa291xaHDrW3igKYnLCBkb3dubG9hZGVkOiAnU3Rhxb5lbm8nLCBlcnJvcjogJ0NoeWJhJywgZmFpbGVkOiAnU2VsaGFsby4nLCBhcmlhRG93bmxvYWQ6ICdTdMOhaG5vdXQnLCB0aXRsZVF1aWNrOiAnUnljaGzDqSBzdGHFvmVuw60nLCBjb21tZW50czogJ2tvbWVudMOhxZnFrycsIGVkaXRlZDogJ1VwcmF2ZW5vJyB9LFxuICBybzogeyBkb3dubG9hZDogJ0Rlc2PEg3JjYcibaScsIGRvd25sb2FkaW5nOiAnU2UgZGVzY2FyY8SD4oCmJywgdHJ5aW5nOiAnU2Ugw65uY2VhcmPEg+KApicsIGRvd25sb2FkZWQ6ICdGaW5hbGl6YXQnLCBlcnJvcjogJ0Vyb2FyZScsIGZhaWxlZDogJ0XImXVhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLCB0aXRsZVF1aWNrOiAnRGVzY8SDcmNhcmUgcmFwaWTEgycsIGNvbW1lbnRzOiAnY29tZW50YXJpaScsIGVkaXRlZDogJ01vZGlmaWNhdCcgfSxcbiAgaHU6IHsgZG93bmxvYWQ6ICdMZXTDtmx0w6lzJywgZG93bmxvYWRpbmc6ICdMZXTDtmx0w6lz4oCmJywgdHJ5aW5nOiAnUHLDs2LDoWxrb3rDoXPigKYnLCBkb3dubG9hZGVkOiAnS8Opc3onLCBlcnJvcjogJ0hpYmEnLCBmYWlsZWQ6ICdTaWtlcnRlbGVuLicsIGFyaWFEb3dubG9hZDogJ0xldMO2bHTDqXMnLCB0aXRsZVF1aWNrOiAnR3lvcnMgbGV0w7ZsdMOpcycsIGNvbW1lbnRzOiAnbWVnamVneXrDqXMnLCBlZGl0ZWQ6ICdTemVya2VzenR2ZScgfSxcbiAgc3Y6IHsgZG93bmxvYWQ6ICdMYWRkYSBuZXInLCBkb3dubG9hZGluZzogJ0xhZGRhciBuZXLigKYnLCB0cnlpbmc6ICdGw7Zyc8O2a2Vy4oCmJywgZG93bmxvYWRlZDogJ0tsYXJ0JywgZXJyb3I6ICdGZWwnLCBmYWlsZWQ6ICdNaXNzbHlja2FkZXMuJywgYXJpYURvd25sb2FkOiAnTGFkZGEgbmVyJywgdGl0bGVRdWljazogJ1NuYWJiIG5lZGxhZGRuaW5nJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJhZCcgfSxcbiAgZGE6IHsgZG93bmxvYWQ6ICdIZW50JywgZG93bmxvYWRpbmc6ICdIZW50ZXLigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0hlbnRldCcsIGVycm9yOiAnRmVqbCcsIGZhaWxlZDogJ01pc2x5a2tlZGVzLicsIGFyaWFEb3dubG9hZDogJ0hlbnQnLCB0aXRsZVF1aWNrOiAnSHVydGlnIGRvd25sb2FkJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJldCcgfSxcbiAgZmk6IHsgZG93bmxvYWQ6ICdMYXRhYScsIGRvd25sb2FkaW5nOiAnTGFkYXRhYW7igKYnLCB0cnlpbmc6ICdZcml0ZXTDpMOkbuKApicsIGRvd25sb2FkZWQ6ICdMYWRhdHR1JywgZXJyb3I6ICdWaXJoZScsIGZhaWxlZDogJ0Vww6Rvbm5pc3R1aS4nLCBhcmlhRG93bmxvYWQ6ICdMYXRhYScsIHRpdGxlUXVpY2s6ICdQaWthbGF0YXVzJywgY29tbWVudHM6ICdrb21tZW50dGlhJywgZWRpdGVkOiAnTXVva2F0dHUnIH0sXG4gIG5vOiB7IGRvd25sb2FkOiAnTGFzdCBuZWQnLCBkb3dubG9hZGluZzogJ0xhc3RlciBuZWTigKYnLCB0cnlpbmc6ICdQcsO4dmVy4oCmJywgZG93bmxvYWRlZDogJ0ZlcmRpZycsIGVycm9yOiAnRmVpbCcsIGZhaWxlZDogJ01pc2x5a3Rlcy4nLCBhcmlhRG93bmxvYWQ6ICdMYXN0IG5lZCcsIHRpdGxlUXVpY2s6ICdSYXNrIG5lZGxhc3RpbmcnLCBjb21tZW50czogJ2tvbW1lbnRhcmVyJywgZWRpdGVkOiAnUmVkaWdlcnQnIH0sXG4gIGhlOiB7IGRvd25sb2FkOiAn15TXldeo15PXlCcsIGRvd25sb2FkaW5nOiAn157Xldeo15nXk+KApicsIHRyeWluZzogJ9ee16DXodeU4oCmJywgZG93bmxvYWRlZDogJ9eU15XXqdec150nLCBlcnJvcjogJ9ep15LXmdeQ15QnLCBmYWlsZWQ6ICfXoNeb16nXnCcsIGFyaWFEb3dubG9hZDogJ9eU15XXqNeT15QnLCB0aXRsZVF1aWNrOiAn15TXldeo15PXlCDXnteU15nXqNeUJywgY29tbWVudHM6ICfXqteS15XXkdeV16onLCBlZGl0ZWQ6ICfXoNei16jXmicgfSxcbiAgZmE6IHsgZG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCBkb3dubG9hZGluZzogJ9iv2LHYrdin2YQg2K/Yp9mG2YTZiNiv4oCmJywgdHJ5aW5nOiAn2KrZhNin2LQg2YXYrNiv2K/igKYnLCBkb3dubG9hZGVkOiAn2KfZhtis2KfZhSDYtNivJywgZXJyb3I6ICfYrti32KcnLCBmYWlsZWQ6ICfZhtin2YXZiNmB2YInLCBhcmlhRG93bmxvYWQ6ICfYr9in2YbZhNmI2K8nLCB0aXRsZVF1aWNrOiAn2K/Yp9mG2YTZiNivINiz2LHbjNi5JywgY29tbWVudHM6ICfZhti42LEnLCBlZGl0ZWQ6ICfZiNuM2LHYp9uM2LQg2LTYr9mHJyB9LFxuICBmaWw6IHsgZG93bmxvYWQ6ICdJLWRvd25sb2FkJywgZG93bmxvYWRpbmc6ICdOYWdkYS1kb3dubG9hZOKApicsIHRyeWluZzogJ1NpbnVzdWJ1a2Fu4oCmJywgZG93bmxvYWRlZDogJ1RhcG9zIG5hJywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ05hYmlnby4nLCBhcmlhRG93bmxvYWQ6ICdJLWRvd25sb2FkJywgdGl0bGVRdWljazogJ01hYmlsaXMgbmEgZG93bmxvYWQnLCBjb21tZW50czogJ21nYSBrb21lbnRvJywgZWRpdGVkOiAnTmEtZWRpdCcgfSxcbiAgbXM6IHsgZG93bmxvYWQ6ICdNdWF0IHR1cnVuJywgZG93bmxvYWRpbmc6ICdNZW11YXQgdHVydW7igKYnLCB0cnlpbmc6ICdNZW5jdWJh4oCmJywgZG93bmxvYWRlZDogJ1NlbGVzYWknLCBlcnJvcjogJ1JhbGF0JywgZmFpbGVkOiAnR2FnYWwuJywgYXJpYURvd25sb2FkOiAnTXVhdCB0dXJ1bicsIHRpdGxlUXVpY2s6ICdNdWF0IHR1cnVuIHBhbnRhcycsIGNvbW1lbnRzOiAna29tZW4nLCBlZGl0ZWQ6ICdEaWVkaXQnIH0sXG4gIHNyOiB7IGRvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLCBkb3dubG9hZGluZzogJ9Cf0YDQtdGD0LfQuNC80LDRmtC14oCmJywgdHJ5aW5nOiAn0J/QvtC60YPRiNCw0LLQsNC84oCmJywgZG93bmxvYWRlZDogJ9CX0LDQstGA0YjQtdC90L4nLCBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLCBhcmlhRG93bmxvYWQ6ICfQn9GA0LXRg9C30LzQuCcsIHRpdGxlUXVpY2s6ICfQkdGA0LfQviDQv9GA0LXRg9C30LjQvNCw0ZrQtScsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJywgZWRpdGVkOiAn0JjQt9C80LXRmtC10L3QvicgfSxcbiAgc2s6IHsgZG93bmxvYWQ6ICdTdGlhaG51xaUnLCBkb3dubG9hZGluZzogJ1PFpWFob3Zhbmll4oCmJywgdHJ5aW5nOiAnU2vDusWhYW3igKYnLCBkb3dubG9hZGVkOiAnSG90b3ZvJywgZXJyb3I6ICdDaHliYScsIGZhaWxlZDogJ1pseWhhbG8uJywgYXJpYURvd25sb2FkOiAnU3RpYWhudcWlJywgdGl0bGVRdWljazogJ1LDvWNobGUgc3RpYWhudXRpZScsIGNvbW1lbnRzOiAna29tZW50w6Fyb3YnLCBlZGl0ZWQ6ICdVcHJhdmVuw6knIH0sXG4gIGJnOiB7IGRvd25sb2FkOiAn0JjQt9GC0LXQs9C70LgnLCBkb3dubG9hZGluZzogJ9CY0LfRgtC10LPQu9GP0L3QteKApicsIHRyeWluZzogJ9Ce0L/QuNGC4oCmJywgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsIGVycm9yOiAn0JPRgNC10YjQutCwJywgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsIGFyaWFEb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JywgdGl0bGVRdWljazogJ9CR0YrRgNC30L4g0LjQt9GC0LXQs9C70Y/QvdC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LAnLCBlZGl0ZWQ6ICfQoNC10LTQsNC60YLQuNGA0LDQvdC+JyB9LFxuICBocjogeyBkb3dubG9hZDogJ1ByZXV6bWknLCBkb3dubG9hZGluZzogJ1ByZXV6aW1hbmpl4oCmJywgdHJ5aW5nOiAnUG9rdcWhYXZhbeKApicsIGRvd25sb2FkZWQ6ICdHb3Rvdm8nLCBlcnJvcjogJ0dyZcWha2EnLCBmYWlsZWQ6ICdOZXVzcGplbG8uJywgYXJpYURvd25sb2FkOiAnUHJldXptaScsIHRpdGxlUXVpY2s6ICdCcnpvIHByZXV6aW1hbmplJywgY29tbWVudHM6ICdrb21lbnRhcmEnLCBlZGl0ZWQ6ICdVcmXEkWVubycgfSxcbiAgbHQ6IHsgZG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIGRvd25sb2FkaW5nOiAnU2l1bsSNaWFtYeKApicsIHRyeWluZzogJ0JhbmRvbWHigKYnLCBkb3dubG9hZGVkOiAnQmFpZ3RhJywgZXJyb3I6ICdLbGFpZGEnLCBmYWlsZWQ6ICdOZXBhdnlrby4nLCBhcmlhRG93bmxvYWQ6ICdBdHNpc2nFs3N0aScsIHRpdGxlUXVpY2s6ICdHcmVpdGFzIGF0c2lzaXVudGltYXMnLCBjb21tZW50czogJ2tvbWVudGFyYWknLCBlZGl0ZWQ6ICdSZWRhZ3VvdGEnIH0sXG4gIGx2OiB7IGRvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCBkb3dubG9hZGluZzogJ0xlanVwaWVsxIFkxJPigKYnLCB0cnlpbmc6ICdNxJPEo2luYeKApicsIGRvd25sb2FkZWQ6ICdQYWJlaWd0cycsIGVycm9yOiAnS8S8xatkYScsIGZhaWxlZDogJ05laXpkZXbEgXMuJywgYXJpYURvd25sb2FkOiAnTGVqdXBpZWzEgWTEk3QnLCB0aXRsZVF1aWNrOiAnxIB0csSBIGxlanVwaWVsxIFkZScsIGNvbW1lbnRzOiAna29tZW50xIFyaScsIGVkaXRlZDogJ1JlZGnEo8STdHMnIH0sXG4gIGV0OiB7IGRvd25sb2FkOiAnTGFhZGkgYWxsYScsIGRvd25sb2FkaW5nOiAnTGFhZGltaW5l4oCmJywgdHJ5aW5nOiAnUHJvb3ZpbuKApicsIGRvd25sb2FkZWQ6ICdWYWxtaXMnLCBlcnJvcjogJ1ZpZ2EnLCBmYWlsZWQ6ICdFYmHDtW5uZXN0dXMuJywgYXJpYURvd25sb2FkOiAnTGFhZGkgYWxsYScsIHRpdGxlUXVpY2s6ICdLaWlyZSBhbGxhbGFhZGltaW5lJywgY29tbWVudHM6ICdrb21tZW50YWFyaScsIGVkaXRlZDogJ011dWRldHVkJyB9LFxuICBzbDogeyBkb3dubG9hZDogJ1ByZW5vcycsIGRvd25sb2FkaW5nOiAnUHJlbmHFoWFuamXigKYnLCB0cnlpbmc6ICdQb3NrdcWhYW3igKYnLCBkb3dubG9hZGVkOiAnS29uxI1hbm8nLCBlcnJvcjogJ05hcGFrYScsIGZhaWxlZDogJ05pIHVzcGVsby4nLCBhcmlhRG93bmxvYWQ6ICdQcmVub3MnLCB0aXRsZVF1aWNrOiAnSGl0ZXIgcHJlbm9zJywgY29tbWVudHM6ICdrb21lbnRhcmpldicsIGVkaXRlZDogJ1VyZWplbm8nIH0sXG4gIGNhOiB7IGRvd25sb2FkOiAnRGVzY2FycmVnYScsIGRvd25sb2FkaW5nOiAnRGVzY2FycmVnYW504oCmJywgdHJ5aW5nOiAnSW50ZW50YW504oCmJywgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2F0JywgZXJyb3I6ICdFcnJvcicsIGZhaWxlZDogJ0hhIGZhbGxhdC4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjYXJyZWdhJywgdGl0bGVRdWljazogJ0Rlc2PDoHJyZWdhIHLDoHBpZGEnLCBjb21tZW50czogJ2NvbWVudGFyaXMnLCBlZGl0ZWQ6ICdFZGl0YXQnIH0sXG4gIGFmOiB7IGRvd25sb2FkOiAnQWZsYWFpJywgZG93bmxvYWRpbmc6ICdMYWFpIGFm4oCmJywgdHJ5aW5nOiAnUHJvYmVlcuKApicsIGRvd25sb2FkZWQ6ICdLbGFhcicsIGVycm9yOiAnRm91dCcsIGZhaWxlZDogJ01pc2x1ay4nLCBhcmlhRG93bmxvYWQ6ICdBZmxhYWknLCB0aXRsZVF1aWNrOiAnVmlubmlnZSBhZmxhYWknLCBjb21tZW50czogJ2tvbW1lbnRhcmUnLCBlZGl0ZWQ6ICdHZXJlZGlnZWVyJyB9LFxuICBhbTogeyBkb3dubG9hZDogJ+GKoOGLjeGIreGLtScsIGRvd25sb2FkaW5nOiAn4Ymg4Yib4YuN4Yio4Yu1IOGIi+GLreKApicsIHRyeWluZzogJ+GJoOGImOGInuGKqOGIrSDhiIvhi63igKYnLCBkb3dubG9hZGVkOiAn4YuI4Yit4Yu34YiNJywgZXJyb3I6ICfhiLXhiIXhibDhibUnLCBmYWlsZWQ6ICfhiqDhiI3hibDhiLPhiqvhiJ3hjaInLCBhcmlhRG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLCB0aXRsZVF1aWNrOiAn4Y2I4Yyj4YqVIOGIm+GLjeGIqOGLtScsIGNvbW1lbnRzOiAn4Yqg4Yi14Ymw4Yur4Yuo4Ym24Ym9JywgZWRpdGVkOiAn4Ymw4Yi14Ymw4Yqr4Yqt4YiP4YiNJyB9LFxuICBoeTogeyBkb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsIGRvd25sb2FkaW5nOiAn1YbVpdaA1aLVpdW81bbVuNaC1bTigKYnLCB0cnlpbmc6ICfVk9W41oDVsdW41oLVtCDVp+KApicsIGRvd25sb2FkZWQ6ICfUsdW+1aHWgNW/1b7VodWuJywgZXJyb3I6ICfVjdWt1aHVrCcsIGZhaWxlZDogJ9WB1aHVrdW41bLVvtWl1oE6JywgYXJpYURvd25sb2FkOiAn1YbVpdaA1aLVpdW81bbVpdWsJywgdGl0bGVRdWljazogJ9Sx1oDVodWjINW21aXWgNWi1aXVvNW21bjWgtW0JywgY29tbWVudHM6ICfVtNWl1a/VttWh1aLVodW21bjWgtWp1bXVuNaC1bYnLCBlZGl0ZWQ6ICfUvdW01aLVodWj1oDVvtWl1awg1acnIH0sXG4gIGFzOiB7IGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEg4Ka54KeIIOCmhuCmm+Cnh+KApicsIHRyeWluZzogJ+CmmuCnh+Cmt+CnjeCmn+CmviDgppXgp7Dgpr8g4KaG4Kab4KeH4oCmJywgZG93bmxvYWRlZDogJ+CmuOCmruCnjeCmquCnguCnsOCnjeCmoycsIGVycm9yOiAn4Kak4KeN4Kew4KeB4Kaf4Ka/JywgZmFpbGVkOiAn4Kas4Ka/4Kar4KayIOCmueKAmeCmsicsIGFyaWFEb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsIHRpdGxlUXVpY2s6ICfgpqbgp43gp7Dgp4HgpqQg4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahJywgY29tbWVudHM6ICfgpq7gpqjgp43gpqTgpqzgp43gpq8nLCBlZGl0ZWQ6ICfgprjgpq7gp43gpqrgpr7gpqbgpr/gpqQnIH0sXG4gIGF6OiB7IGRvd25sb2FkOiAnWcO8a2zJmScsIGRvd25sb2FkaW5nOiAnWcO8a2zJmW5pcuKApicsIHRyeWluZzogJ0PJmWhkIGVkaWxpcuKApicsIGRvd25sb2FkZWQ6ICdCaXRkaScsIGVycm9yOiAnWMmZdGEnLCBmYWlsZWQ6ICdBbMSxbm1hZMSxLicsIGFyaWFEb3dubG9hZDogJ1nDvGtsyZknLCB0aXRsZVF1aWNrOiAnU8O8csmZdGxpIHnDvGtsyZltyZknLCBjb21tZW50czogJ8WfyZlyaCcsIGVkaXRlZDogJ0TDvHrJmWxpxZ8gZWRpbGliJyB9LFxuICBldTogeyBkb3dubG9hZDogJ0Rlc2thcmdhdHUnLCBkb3dubG9hZGluZzogJ0Rlc2thcmdhdHplbuKApicsIHRyeWluZzogJ1NhaWF0emVu4oCmJywgZG93bmxvYWRlZDogJ0VnaW5kYScsIGVycm9yOiAnRXJyb3JlYScsIGZhaWxlZDogJ0h1dHMgZWdpbiBkdS4nLCBhcmlhRG93bmxvYWQ6ICdEZXNrYXJnYXR1JywgdGl0bGVRdWljazogJ0Rlc2thcmdhIGF6a2FycmEnLCBjb21tZW50czogJ2lydXpraW4nLCBlZGl0ZWQ6ICdFZGl0YXR1YScgfSxcbiAgbXk6IHsgZG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCBkb3dubG9hZGluZzogJ+GAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuiDhgJzhgK/hgJXhgLrhgJThgLHigKYnLCB0cnlpbmc6ICfhgIDhgLzhgK3hgK/hgLjhgIXhgKzhgLjhgJThgLHigKYnLCBkb3dubG9hZGVkOiAn4YCV4YC84YCu4YC44YCV4YCr4YCV4YC84YCuJywgZXJyb3I6ICfhgKHhgJnhgL7hgKzhgLgnLCBmYWlsZWQ6ICfhgJnhgKHhgLHhgKzhgIThgLrhgJnhgLzhgIThgLrhgJXhgKvhgYsnLCBhcmlhRG93bmxvYWQ6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCB0aXRsZVF1aWNrOiAn4YCh4YCZ4YC84YCU4YC6IOGAkuGAseGAq+GAhOGAuuGAuOGAnOGAr+GAkuGAuicsIGNvbW1lbnRzOiAn4YCZ4YC+4YCQ4YC64YCB4YC74YCA4YC64YCZ4YC74YCs4YC4JywgZWRpdGVkOiAn4YCV4YC84YCE4YC64YCG4YCE4YC64YCV4YC84YCu4YC4JyB9LFxuICBnbDogeyBkb3dubG9hZDogJ0Rlc2NhcmdhcicsIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLCB0cnlpbmc6ICdUZW50YW5kb+KApicsIGRvd25sb2FkZWQ6ICdEZXNjYXJnYWRvJywgZXJyb3I6ICdFcnJvJywgZmFpbGVkOiAnRmFsbG91LicsIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJywgY29tbWVudHM6ICdjb21lbnRhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gIGthOiB7IGRvd25sb2FkOiAn4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgZG93bmxvYWRpbmc6ICfhg5jhg6zhg5Thg6Dhg5Thg5Hhg5DigKYnLCB0cnlpbmc6ICfhg5vhg6rhg5Phg5Thg5rhg53hg5Hhg5DigKYnLCBkb3dubG9hZGVkOiAn4YOT4YOQ4YOh4YOg4YOj4YOa4YOT4YOQJywgZXJyb3I6ICfhg6jhg5Thg6rhg5Phg53hg5vhg5AnLCBmYWlsZWQ6ICfhg5Xhg5Thg6Ag4YOb4YOd4YOu4YOU4YOg4YOu4YOT4YOQLicsIGFyaWFEb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsIHRpdGxlUXVpY2s6ICfhg6Hhg6zhg6Dhg5Dhg6Thg5gg4YOp4YOQ4YOb4YOd4YOi4YOV4YOY4YOg4YOX4YOV4YOQJywgY29tbWVudHM6ICfhg5nhg53hg5vhg5Thg5zhg6Lhg5Dhg6Dhg5gnLCBlZGl0ZWQ6ICfhg6Dhg5Thg5Phg5Dhg6Xhg6Lhg5jhg6Dhg5Thg5Hhg6Phg5rhg5jhg5AnIH0sXG4gIGlzOiB7IGRvd25sb2FkOiAnU8Oma2phJywgZG93bmxvYWRpbmc6ICdTw6ZraXLigKYnLCB0cnlpbmc6ICdSZXluaeKApicsIGRvd25sb2FkZWQ6ICdTw7N0dCcsIGVycm9yOiAnVmlsbGEnLCBmYWlsZWQ6ICdNaXN0w7Nrc3QuJywgYXJpYURvd25sb2FkOiAnU8Oma2phJywgdGl0bGVRdWljazogJ0Zsw710aW5pw7B1cmhhbCcsIGNvbW1lbnRzOiAndW1tw6ZsaScsIGVkaXRlZDogJ0JyZXl0dCcgfSxcbiAgZ2E6IHsgZG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCBkb3dubG9hZGluZzogJ0FnIMOtb3Nsw7Nkw6FpbOKApicsIHRyeWluZzogJ0FnIGlhcnJhaWRo4oCmJywgZG93bmxvYWRlZDogJ8ONb3Nsw7Nkw6FpbHRlJywgZXJyb3I6ICdFYXJyw6FpZCcsIGZhaWxlZDogJ1RoZWlwIGFpci4nLCBhcmlhRG93bmxvYWQ6ICfDjW9zbMOzZMOhaWwnLCB0aXRsZVF1aWNrOiAnw41vc2zDs2TDoWlsIHRhcGEnLCBjb21tZW50czogJ3Ryw6FjaHQnLCBlZGl0ZWQ6ICdFYWdyYWl0aGUnIH0sXG4gIGtrOiB7IGRvd25sb2FkOiAn0JbSr9C60YLQtdC/INCw0LvRgycsIGRvd25sb2FkaW5nOiAn0JbSr9C60YLQtdC70YPQtNC14oCmJywgdHJ5aW5nOiAn05jRgNC10LrQtdGC4oCmJywgZG93bmxvYWRlZDogJ9CQ0Y/Sm9GC0LDQu9C00YsnLCBlcnJvcjogJ9Ka0LDRgtC1JywgZmFpbGVkOiAn0KHTmdGC0YHRltC3LicsIGFyaWFEb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLCB0aXRsZVF1aWNrOiAn0JbRi9C70LTQsNC8INC20q/QutGC0LXRgycsIGNvbW1lbnRzOiAn0L/RltC60ZbRgCcsIGVkaXRlZDogJ9Oo0LfQs9C10YDRgtGW0LvQtNGWJyB9LFxuICBrbTogeyBkb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsIGRvd25sb2FkaW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6R4Z624Z6J4Z6Z4Z6A4oCmJywgdHJ5aW5nOiAn4Z6A4Z+G4Z6W4Z674Z6E4Z6W4Z+S4Z6Z4Z624Z6Z4Z624Z6Y4oCmJywgZG93bmxvYWRlZDogJ+GelOGetuGek+GelOGeieGfkuGeheGelOGfiycsIGVycm9yOiAn4Z6A4Z+G4Z6g4Z674Z6fJywgZmFpbGVkOiAn4Z6U4Z6a4Z624Z6H4Z+Q4Z6ZJywgYXJpYURvd25sb2FkOiAn4Z6R4Z624Z6J4Z6Z4Z6AJywgdGl0bGVRdWljazogJ+GekeGetuGeieGemeGegOGem+Gev+GekycsIGNvbW1lbnRzOiAn4Z6Y4Z6P4Z63JywgZWRpdGVkOiAn4Z6U4Z624Z6T4Z6A4Z+C4Z6f4Z6Y4Z+S4Z6a4Z694Z6bJyB9LFxuICBsbzogeyBkb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsIGRvd25sb2FkaW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqU4oCmJywgdHJ5aW5nOiAn4LqB4Lqz4Lql4Lqx4LqH4Lqe4Lqw4LqN4Lqy4LqN4Lqy4Lqh4oCmJywgZG93bmxvYWRlZDogJ+C6quC6s+C7gOC6peC6seC6lCcsIGVycm9yOiAn4Lqc4Lq04LqU4Lqe4Lqy4LqUJywgZmFpbGVkOiAn4Lql4Lq74LuJ4Lqh4LuA4Lqr4Lql4LqnJywgYXJpYURvd25sb2FkOiAn4LqU4Lqy4Lqn4LuC4Lqr4Lql4LqUJywgdGl0bGVRdWljazogJ+C6lOC6suC6p+C7guC6q+C6peC6lOC6lOC7iOC6p+C6mScsIGNvbW1lbnRzOiAn4LqE4Lqz4LuA4Lqr4Lqx4LqZJywgZWRpdGVkOiAn4LuB4LqB4LuJ4LuE4LqC4LuB4Lql4LuJ4LqnJyB9LFxuICBtazogeyBkb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JywgZG93bmxvYWRpbmc6ICfQn9GA0LXQt9C10LzQsNGa0LXigKYnLCB0cnlpbmc6ICfQodC1INC+0LHQuNC00YPQstCw0LzigKYnLCBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JywgZXJyb3I6ICfQk9GA0LXRiNC60LAnLCBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJywgYXJpYURvd25sb2FkOiAn0J/RgNC10LfQtdC80LgnLCB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10LfQtdC80LDRmtC1JywgY29tbWVudHM6ICfQutC+0LzQtdC90YLQsNGA0LgnLCBlZGl0ZWQ6ICfQmNC30LzQtdC90LXRgtC+JyB9LFxuICBtbjogeyBkb3dubG9hZDogJ9Ci0LDRgtCw0YUnLCBkb3dubG9hZGluZzogJ9Ci0LDRgtCw0LYg0LHQsNC50L3QsOKApicsIHRyeWluZzogJ9Ce0YDQu9C00L7QtiDQsdCw0LnQvdCw4oCmJywgZG93bmxvYWRlZDogJ9Ci0LDRgtGB0LDQvScsIGVycm9yOiAn0JDQu9C00LDQsCcsIGZhaWxlZDogJ9CQ0LzQttC40LvRgtCz0q/QuS4nLCBhcmlhRG93bmxvYWQ6ICfQotCw0YLQsNGFJywgdGl0bGVRdWljazogJ9Cl0YPRgNC00LDQvSDRgtCw0YLQsNGFJywgY29tbWVudHM6ICfRgdGN0YLQs9GN0LPQtNGN0LsnLCBlZGl0ZWQ6ICfQl9Cw0YHRgdCw0L0nIH0sXG4gIG5lOiB7IGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEg4KS54KWB4KSB4KSm4KWI4oCmJywgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KS+4KS4IOCkl+CksOCljeCkpuCliOKApicsIGRvd25sb2FkZWQ6ICfgpKrgpYLgpLDgpL4g4KSt4KSv4KWLJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpL8nLCBmYWlsZWQ6ICfgpIXgpLjgpKvgpLIg4KSt4KSv4KWLJywgYXJpYURvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgdGl0bGVRdWljazogJ+Ckm+Ckv+Ckn+CliyDgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBjb21tZW50czogJ+Ckn+Ckv+CkquCljeCkquCko+ClgOCkueCksOClgicsIGVkaXRlZDogJ+CkuOCkruCljeCkquCkvuCkpuCkv+CkpCcgfSxcbiAgb3I6IHsgZG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLCBkb3dubG9hZGluZzogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjSDgrLngrYfgrIngrJvgrL/igKYnLCB0cnlpbmc6ICfgrJrgrYfgrLfgrY3grJ/grL4g4KyV4Kyw4K2B4Kyb4Ky/4oCmJywgZG93bmxvYWRlZDogJ+CsuOCsruCtjeCsquCtguCssOCtjeCso+CtjeCsoycsIGVycm9yOiAn4Kyk4K2N4Kyw4K2B4Kyf4Ky/JywgZmFpbGVkOiAn4Kys4Ky/4Kyr4KyzIOCsueCth+CssuCsvicsIGFyaWFEb3dubG9hZDogJ+CsoeCsvuCsieCsqOCssuCti+CsoeCtjScsIHRpdGxlUXVpY2s6ICfgrLbgrYDgrJjgrY3grLAg4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJywgY29tbWVudHM6ICfgrK7grKjgrY3grKTgrKzgrY3grZ8nLCBlZGl0ZWQ6ICfgrLjgrK7grY3grKrgrL7grKbgrL/grKQnIH0sXG4gIHNpOiB7IGRvd25sb2FkOiAn4La24LeP4Lac4Lax4LeK4LaxJywgZG93bmxvYWRpbmc6ICfgtrbgt4/gtpzgtq0g4LeA4LeZ4La44LeS4Lax4LeK4oCmJywgdHJ5aW5nOiAn4LaL4Lat4LeK4LeD4LeP4LeEIOC2muC2u+C2uOC3kuC2seC3iuKApicsIGRvd25sb2FkZWQ6ICfgtoXgt4Dgt4PgtrHgt4onLCBlcnJvcjogJ+C2r+C3neC3guC2uuC2muC3kicsIGZhaWxlZDogJ+C2heC3g+C3j+C2u+C3iuC2ruC2muC2uuC3kicsIGFyaWFEb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsIHRpdGxlUXVpY2s6ICfgtongtprgt4rgtrjgtrHgt4og4La24LeP4Lac4LatIOC2muC3kuC2u+C3k+C2uCcsIGNvbW1lbnRzOiAn4LaF4Lav4LeE4LeD4LeKJywgZWRpdGVkOiAn4LeD4LaC4LeD4LeK4Laa4La74Lar4La6JyB9LFxuICBzdzogeyBkb3dubG9hZDogJ1Bha3VhJywgZG93bmxvYWRpbmc6ICdJbmFwYWt1YeKApicsIHRyeWluZzogJ0luYWphcmlideKApicsIGRvd25sb2FkZWQ6ICdJbWVrYW1pbGlrYScsIGVycm9yOiAnSGl0aWxhZnUnLCBmYWlsZWQ6ICdJbWVzaGluZHdhLicsIGFyaWFEb3dubG9hZDogJ1Bha3VhJywgdGl0bGVRdWljazogJ1Bha3VhIGhhcmFrYScsIGNvbW1lbnRzOiAnbWFvbmknLCBlZGl0ZWQ6ICdJbWVoYXJpcml3YScgfSxcbiAgdXo6IHsgZG93bmxvYWQ6ICdZdWtsYXNoJywgZG93bmxvYWRpbmc6ICdZdWtsYW5tb3FkYeKApicsIHRyeWluZzogJ1VyaW5pbG1vcWRh4oCmJywgZG93bmxvYWRlZDogJ1RheXlvcicsIGVycm9yOiAnWGF0bycsIGZhaWxlZDogJ011dmFmZmFxaXlhdHNpei4nLCBhcmlhRG93bmxvYWQ6ICdZdWtsYXNoJywgdGl0bGVRdWljazogJ1RleiB5dWtsYXNoJywgY29tbWVudHM6ICdzaGFyaGxhcicsIGVkaXRlZDogJ1RhaHJpcmxhbmdhbicgfSxcbiAgY3k6IHsgZG93bmxvYWQ6ICdMYXdybHd5dGhvJywgZG93bmxvYWRpbmc6ICdZbiBsYXdybHd5dGhv4oCmJywgdHJ5aW5nOiAnWW4gY2Vpc2lv4oCmJywgZG93bmxvYWRlZDogJ1dlZGkgZ29yZmZlbicsIGVycm9yOiAnR3dhbGwnLCBmYWlsZWQ6ICdNZXRob2RkLicsIGFyaWFEb3dubG9hZDogJ0xhd3Jsd3l0aG8nLCB0aXRsZVF1aWNrOiAnTGF3cmx3eXRobyBjeWZseW0nLCBjb21tZW50czogJ3N5bHdhZGF1JywgZWRpdGVkOiAnR29seWd3eWQnIH0sXG4gIHp1OiB7IGRvd25sb2FkOiAnTGFuZGEnLCBkb3dubG9hZGluZzogJ0l5YWxhbmR3YeKApicsIHRyeWluZzogJ0l5YXphbWHigKYnLCBkb3dubG9hZGVkOiAnSWxhbmTEq3dlJywgZXJyb3I6ICdJcGh1dGhhJywgZmFpbGVkOiAnSWhsdWxla2lsZS4nLCBhcmlhRG93bmxvYWQ6ICdMYW5kYScsIHRpdGxlUXVpY2s6ICdVa3VsYW5kYSBva3VzaGVzaGF5bycsIGNvbW1lbnRzOiAnYW1hendhbmEnLCBlZGl0ZWQ6ICdLdWhsZWxpd2UnIH0sXG4gIHNxOiB7IGRvd25sb2FkOiAnU2hrYXJrbycsIGRvd25sb2FkaW5nOiAnRHVrZSBzaGthcmt1YXLigKYnLCB0cnlpbmc6ICdEdWtlIHByb3Z1YXLigKYnLCBkb3dubG9hZGVkOiAnUMOrcmZ1bmRvaScsIGVycm9yOiAnR2FiaW0nLCBmYWlsZWQ6ICdEw6tzaHRvaS4nLCBhcmlhRG93bmxvYWQ6ICdTaGthcmtvJywgdGl0bGVRdWljazogJ1Noa2Fya2ltIGkgc2hwZWp0w6snLCBjb21tZW50czogJ2tvbWVudGUnLCBlZGl0ZWQ6ICdFIHJlZGFrdHVhcicgfSxcbn07XG5cbmV4cG9ydCB0eXBlIExhbmdLZXkgPSBrZXlvZiB0eXBlb2YgVFJBTlNMQVRJT05TLmVuO1xuXG5leHBvcnQgZnVuY3Rpb24gdChrZXk6IExhbmdLZXkpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGlmICgha2V5IHx8IHR5cGVvZiBrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gJy4uLic7XG4gICAgfVxuXG4gICAgbGV0IHJhd0xhbmcgPSAnZW4nO1xuICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZykge1xuICAgICAgcmF3TGFuZyA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5sYW5nO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLmxhbmd1YWdlKSB7XG4gICAgICByYXdMYW5nID0gbmF2aWdhdG9yLmxhbmd1YWdlO1xuICAgIH1cblxuICAgIGNvbnN0IG5vcm1hbGl6ZWRMYW5nID0gcmF3TGFuZy50b0xvd2VyQ2FzZSgpLnNwbGl0KCc7JylbMF0udHJpbSgpLnJlcGxhY2UoJ18nLCAnLScpO1xuICAgIGNvbnN0IGJhc2VMYW5nID0gbm9ybWFsaXplZExhbmcuc3BsaXQoJy0nKVswXTtcblxuICAgIGlmIChUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbbm9ybWFsaXplZExhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbYmFzZUxhbmddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbYmFzZUxhbmddW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldO1xuICAgIH1cblxuICAgIGlmIChUUkFOU0xBVElPTlNbJ2VuJ10gJiYgdHlwZW9mIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldO1xuICAgIH1cblxuICAgIHJldHVybiBrZXk7XG5cbiAgfSBjYXRjaCAoZSkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gVFJBTlNMQVRJT05TWydlbiddW2tleV0gfHwga2V5O1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFN0cmluZyhrZXkgfHwgJ0Rvd25sb2FkJyk7XG4gICAgfVxuICB9XG59IiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvdGhlbWUudHNcblxuLyoqXG4gKiBUSEVNRSBERVRFQ1RPUlxuICpcbiAqIEdvYWw6IFwiSXMgdGhlIGNvbnRlbnQgSSdtIGRyYXdpbmcgb24gdmlzdWFsbHkgZGFyayBvciBsaWdodD9cIlxuICogSW5zdGVhZCBvZiBndWVzc2luZyBmcm9tIDxib2R5Piwgd2U6XG4gKiAgLSBSZXNwZWN0IERhcmsgUmVhZGVyIGlmIHByZXNlbnRcbiAqICAtIExvb2sgZm9yIG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzXG4gKiAgLSBNZWFzdXJlIHRoZSBlZmZlY3RpdmUgYmFja2dyb3VuZCBjb2xvciBvZiBhICpjb250ZW50KiBlbGVtZW50XG4gKiAgICAoZS5nLiBHb29nbGUgQ2xhc3Nyb29tIHN0cmVhbSBjYXJkcylcbiAqL1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGFnZSAqY29udGVudCBhcmVhKiBpcyB2aXN1YWxseSBkYXJrLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNQYWdlRGFyaygpOiBib29sZWFuIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAxLiBGYXN0IHBhdGg6IERhcmsgUmVhZGVyIGF0dHJpYnV0ZVxuICBjb25zdCBkclNjaGVtZSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnKTtcbiAgaWYgKGRyU2NoZW1lID09PSAnZGFyaycpIHJldHVybiB0cnVlO1xuICBpZiAoZHJTY2hlbWUgPT09ICdsaWdodCcpIHJldHVybiBmYWxzZTtcblxuICAvLyAyLiBIZXVyaXN0aWM6IG9idmlvdXMgXCJkYXJrIG1vZGVcIiBjbGFzc2VzIG9uIDxodG1sPiAvIDxib2R5PlxuICAvLyAoY292ZXJzIHNvbWUgZnJhbWV3b3JrcyBhbmQgZXh0ZW5zaW9ucylcbiAgY29uc3QgZGFya1Rva2VucyA9IFsnZGFyaycsICdkYXJrLXRoZW1lJywgJ3RoZW1lLWRhcmsnLCAnbmlnaHQnLCAnZ20zLWRhcmstdGhlbWUnXTtcbiAgY29uc3QgaHRtbENsYXNzID0gKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGNvbnN0IGJvZHlDbGFzcyA9IChkb2N1bWVudC5ib2R5LmNsYXNzTmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGRhcmtUb2tlbnMuc29tZSh0b2tlbiA9PiBodG1sQ2xhc3MuaW5jbHVkZXModG9rZW4pIHx8IGJvZHlDbGFzcy5pbmNsdWRlcyh0b2tlbikpKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvLyAzLiBQcm9iZSBhICpjb250ZW50KiBlbGVtZW50LCBub3QgdGhlIHdob2xlIHBhZ2UgYmFja2dyb3VuZC5cbiAgLy8gICAgRm9yIENsYXNzcm9vbSwgcG9zdHMgYXJlIHRoZSBtYWluIHN1cmZhY2Ugd2UgZHJhdyBvbi5cbiAgY29uc3QgcHJvYmVFbCA9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2RpdltkYXRhLXN0cmVhbS1pdGVtLWlkXScpIHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ1tyb2xlPVwibWFpblwiXScpIHx8XG4gICAgZG9jdW1lbnQuYm9keTtcblxuICBjb25zdCBiZ0NvbG9yID0gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHByb2JlRWwpO1xuICBjb25zdCBicmlnaHRuZXNzID0gcGFyc2VCcmlnaHRuZXNzKGJnQ29sb3IpO1xuXG4gIC8vIDQuIERlY2lkZSB0aHJlc2hvbGQuXG4gIC8vICAgIDEyOCBpcyBcIjUwJSBncmF5XCIsIGJ1dCB0aGF0IGZsaXBzIHRvbyBlYXJseSBvbiBzbGlnaHRseSBncmF5IFVJcy5cbiAgLy8gICAgVXNlIGEgc3RyaWN0ZXIgdGhyZXNob2xkIHNvIHdlIG9ubHkgdHJlYXQgY2xlYXJseSBkYXJrIFVJcyBhcyBkYXJrLlxuICByZXR1cm4gYnJpZ2h0bmVzcyA8IDEwNTtcbn1cblxuLyoqXG4gKiBXYWxrcyB1cCB0aGUgRE9NIGZyb20gYSBnaXZlbiBlbGVtZW50IHVudGlsIGl0IGZpbmRzIGEgbm9uLXRyYW5zcGFyZW50IGJhY2tncm91bmQgY29sb3IuXG4gKiBGYWxscyBiYWNrIHRvIDxodG1sPiBhbmQgZmluYWxseSB0byBwdXJlIHdoaXRlLlxuICovXG5mdW5jdGlvbiBnZXRFZmZlY3RpdmVCYWNrZ3JvdW5kQ29sb3Ioc3RhcnQ6IEhUTUxFbGVtZW50KTogc3RyaW5nIHtcbiAgbGV0IGVsOiBIVE1MRWxlbWVudCB8IG51bGwgPSBzdGFydDtcblxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gKGM6IHN0cmluZyB8IG51bGwpID0+XG4gICAgIWMgfHwgYyA9PT0gJ3RyYW5zcGFyZW50JyB8fCBjID09PSAncmdiYSgwLCAwLCAwLCAwKSc7XG5cbiAgd2hpbGUgKGVsKSB7XG4gICAgY29uc3Qgc3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XG4gICAgY29uc3QgYmcgPSBzdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgaWYgKCFpc1RyYW5zcGFyZW50KGJnKSkgcmV0dXJuIGJnO1xuICAgIGVsID0gZWwucGFyZW50RWxlbWVudDtcbiAgfVxuXG4gIC8vIFRyeSA8aHRtbD4gYXMgYSBsYXN0IHJlYWwgZWxlbWVudFxuICBjb25zdCBodG1sU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuICBjb25zdCBodG1sQmcgPSBodG1sU3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICBpZiAoIWlzVHJhbnNwYXJlbnQoaHRtbEJnKSkgcmV0dXJuIGh0bWxCZztcblxuICAvLyBBYnNvbHV0ZSBmYWxsYmFjazogYXNzdW1lIHdoaXRlXG4gIHJldHVybiAncmdiKDI1NSwgMjU1LCAyNTUpJztcbn1cblxuLyoqXG4gKiBIZWxwZXI6IENhbGN1bGF0ZXMgYnJpZ2h0bmVzcyAoMC0yNTUpIGZyb20gYW4gUkdCKEEpIHN0cmluZy5cbiAqIFVzZXMgdGhlIEhTUCBjb2xvciBmb3JtdWxhOiBzcXJ0KDAuMjk5KlJeMiArIDAuNTg3KkdeMiArIDAuMTE0KkJeMilcbiAqL1xuZnVuY3Rpb24gcGFyc2VCcmlnaHRuZXNzKHJnYlN0cmluZzogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgbWF0Y2ggPSByZ2JTdHJpbmcubWF0Y2goLyhcXGQrKSxcXHMqKFxcZCspLFxccyooXFxkKykvKTtcbiAgaWYgKCFtYXRjaCkge1xuICAgIC8vIElmIHdlIGNhbid0IHBhcnNlIGl0LCBhc3N1bWUgYnJpZ2h0IHNvIHdlIGRvbid0IGFjY2lkZW50YWxseSBmbGlwIHRvIGRhcmsgbW9kZS5cbiAgICByZXR1cm4gMjU1O1xuICB9XG5cbiAgY29uc3QgciA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XG4gIGNvbnN0IGcgPSBwYXJzZUludChtYXRjaFsyXSwgMTApO1xuICBjb25zdCBiID0gcGFyc2VJbnQobWF0Y2hbM10sIDEwKTtcblxuICAvLyBIU1AgZXF1YXRpb24gaXMgcGVyY2VpdmVkIGJyaWdodG5lc3NcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IE1hdGguc3FydChcbiAgICAwLjI5OSAqIChyICogcikgK1xuICAgIDAuNTg3ICogKGcgKiBnKSArXG4gICAgMC4xMTQgKiAoYiAqIGIpXG4gICk7XG5cbiAgcmV0dXJuIGJyaWdodG5lc3M7XG59XG5cbi8qKlxuICogV2F0Y2hlcjogTm90aWZpZXMgeW91IHdoZW4gdGhlIHRoZW1lIGxpa2VseSBjaGFuZ2VkLlxuICpcbiAqIFlvdSBjYW4gdXNlIHRoaXMgaWYgeW91IGV2ZXIgd2FudCB0byBkeW5hbWljYWxseSByZS1zdHlsZSB0aGluZ3NcbiAqIHdoZW4gdGhlIHVzZXIgLyBleHRlbnNpb24gdG9nZ2xlcyB0aGVtZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdhdGNoVGhlbWVDaGFuZ2VzKGNhbGxiYWNrOiAoaXNEYXJrOiBib29sZWFuKSA9PiB2b2lkKTogTXV0YXRpb25PYnNlcnZlciB7XG4gIGNvbnN0IGhhbmRsZXIgPSAoKSA9PiB7XG4gICAgY2FsbGJhY2soaXNQYWdlRGFyaygpKTtcbiAgfTtcblxuICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGhhbmRsZXIpO1xuXG4gIC8vIFdhdGNoIGZvciBhdHRyaWJ1dGUvY2xhc3MgY2hhbmdlcyBvbiA8aHRtbD4gYW5kIDxib2R5PlxuICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ2RhdGEtZGFya3JlYWRlci1zY2hlbWUnLCAnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7XG4gICAgYXR0cmlidXRlczogdHJ1ZSxcbiAgICBhdHRyaWJ1dGVGaWx0ZXI6IFsnc3R5bGUnLCAnY2xhc3MnXSxcbiAgfSk7XG5cbiAgLy8gQWxzbyBsaXN0ZW4gdG8gc3lzdGVtIHRoZW1lIGNoYW5nZXMgYXMgYSBiYWNrdXAgc2lnbmFsXG4gIGlmICh0eXBlb2Ygd2luZG93Lm1hdGNoTWVkaWEgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjb25zdCBtcSA9IHdpbmRvdy5tYXRjaE1lZGlhKCcocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspJyk7XG4gICAgaWYgKG1xKSB7XG4gICAgICBjb25zdCBtcUxpc3RlbmVyID0gKCkgPT4gaGFuZGxlcigpO1xuICAgICAgLy8gTW9kZXJuIGJyb3dzZXJzXG4gICAgICBpZiAoKG1xIGFzIGFueSkuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICBtcS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBtcUxpc3RlbmVyKTtcbiAgICAgIH0gZWxzZSBpZiAoKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIpIHtcbiAgICAgICAgLy8gTGVnYWN5IEFQSVxuICAgICAgICAobXEgYXMgYW55KS5hZGRMaXN0ZW5lcihtcUxpc3RlbmVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsIGNhbGwgc28gdGhlIGNvbnN1bWVyIGNhbiBzeW5jIGltbWVkaWF0ZWx5XG4gIGhhbmRsZXIoKTtcblxuICByZXR1cm4gb2JzZXJ2ZXI7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29tbWVudF9mcmFtZS5jb250ZW50LnRzXG5pbXBvcnQgeyBDT01NRU5UX0lDT05fVVJMIH0gZnJvbSAnLi9jb250ZW50L2ljb25zJztcbmltcG9ydCB7IGluamVjdFN0eWxlcyB9IGZyb20gJy4vY29udGVudC9zdHlsZXMnO1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vY29udGVudC9pMThuJztcbmltcG9ydCB7IGlzUGFnZURhcmsgfSBmcm9tICcuL2NvbnRlbnQvdGhlbWUnO1xuXG4vLyBTZWxlY3RvciBmb3IgdGhlIG1haW4gc3RyZWFtIGNhcmRcbmNvbnN0IFBPU1RfU0VMRUNUT1IgPSAnZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdJztcbmNvbnN0IFBST0NFU1NFRF9BVFRSID0gJ2RhdGEtY3FkLXByb2Nlc3NlZCc7XG5cbi8vIPCflLQgTkVXOiBkZWJvdW5jZSBmbGFnIHNvIHdlIGRvbid0IHJlc2NhbiBvbiBldmVyeSB0aW55IG11dGF0aW9uXG5sZXQgY29tbWVudFNjYW5TY2hlZHVsZWQgPSBmYWxzZTtcbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBNYWluIFNjcmlwdFxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnaHR0cHM6Ly9jbGFzc3Jvb20uZ29vZ2xlLmNvbS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW4oKSB7XG4gICAgaW5qZWN0U3R5bGVzKCk7XG4gICAgc2NhbkZvckNvbW1lbnRzKCk7XG5cbiAgICAvLyAtLS0gU1RSQVRFR1kgMTogTVVUQVRJT04gT0JTRVJWRVIgLS0tXG4gICAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICAvLyDinIUgRGVib3VuY2U6IG9ubHkgb25lIHNjYW4gcGVyIGZyYW1lXG4gICAgICBpZiAoY29tbWVudFNjYW5TY2hlZHVsZWQpIHJldHVybjtcbiAgICAgIGNvbW1lbnRTY2FuU2NoZWR1bGVkID0gdHJ1ZTtcblxuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgY29tbWVudFNjYW5TY2hlZHVsZWQgPSBmYWxzZTtcbiAgICAgICAgc2NhbkZvckNvbW1lbnRzKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHNjYW5Gb3JDb21tZW50cygpO1xuICAgIH0sIDEwMDApO1xuXG4gICAgbGV0IGxhc3RVcmwgPSBsb2NhdGlvbi5ocmVmOyBcbiAgICBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICBjb25zdCB1cmwgPSBsb2NhdGlvbi5ocmVmO1xuICAgICAgaWYgKHVybCAhPT0gbGFzdFVybCkge1xuICAgICAgICBsYXN0VXJsID0gdXJsO1xuICAgICAgICBzZXRUaW1lb3V0KHNjYW5Gb3JDb21tZW50cywgNTAwKTsgXG4gICAgICB9XG4gICAgfSkub2JzZXJ2ZShkb2N1bWVudCwgeyBzdWJ0cmVlOiB0cnVlLCBjaGlsZExpc3Q6IHRydWUgfSk7XG4gIH0sXG59KTtcblxuZnVuY3Rpb24gc2NhbkZvckNvbW1lbnRzKCkge1xuICB0cnkge1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IGdldFBhZ2VEaXJlY3Rpb24oKTtcbiAgICBkb2N1bWVudC5ib2R5LnNldEF0dHJpYnV0ZSgnZGF0YS1jcWQtZGlyJywgZGlyZWN0aW9uKTtcblxuICAgIGNvbnN0IHBvc3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oUE9TVF9TRUxFQ1RPUik7XG5cbiAgICBwb3N0cy5mb3JFYWNoKChwb3N0KSA9PiB7XG4gICAgICBpZiAocG9zdC5oYXNBdHRyaWJ1dGUoUFJPQ0VTU0VEX0FUVFIpKSB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nT3ZlcmxheSA9IHBvc3QucXVlcnlTZWxlY3RvcignLmNxZC1vdmVybGF5LWNvbnRhaW5lcicpO1xuICAgICAgICBpZiAoZXhpc3RpbmdPdmVybGF5KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHBvc3QucmVtb3ZlQXR0cmlidXRlKFBST0NFU1NFRF9BVFRSKTtcbiAgICAgIH1cblxuICAgICAgLy8gUHJldmVudCBkb3VibGUgYm9yZGVycyBvbiBuZXN0ZWQgcG9zdHNcbiAgICAgIGlmIChwb3N0LnBhcmVudEVsZW1lbnQ/LmNsb3Nlc3QoUE9TVF9TRUxFQ1RPUikpIHJldHVybjtcblxuICAgICAgY29uc3QgcmF3VGV4dCA9IChwb3N0LmlubmVyVGV4dCB8fCAnJykgKyAnICcgKyBnZXRBcmlhTGFiZWxzKHBvc3QpO1xuICAgICAgY29uc3QgbWF0Y2ggPSByYXdUZXh0Lm1hdGNoKC8oXFxkKylcXHMrY2xhc3MgY29tbWVudC9pKTtcbiAgICAgIGNvbnN0IGNvdW50ID0gbWF0Y2ggPyBwYXJzZUludChtYXRjaFsxXSwgMTApIDogMDtcblxuICAgICAgaWYgKGNvdW50ID4gMCkge1xuICAgICAgICBwb3N0LnNldEF0dHJpYnV0ZShQUk9DRVNTRURfQVRUUiwgJ3RydWUnKTtcbiAgICAgICAgY3JlYXRlT3ZlcmxheShwb3N0LCBjb3VudCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUud2FybignQ1FEIFNjYW4gRXJyb3I6JywgZXJyKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVPdmVybGF5KHBvc3Q6IEhUTUxFbGVtZW50LCBjb3VudDogbnVtYmVyKSB7XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUocG9zdCk7XG4gIGNvbnN0IGJvcmRlclJhZGl1cyA9IGNvbXB1dGVkLmJvcmRlclJhZGl1cyB8fCAnOHB4JztcblxuICBpZiAoY29tcHV0ZWQucG9zaXRpb24gPT09ICdzdGF0aWMnKSB7XG4gICAgcG9zdC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gIH1cblxuICBwb3N0LnN0eWxlLnNldFByb3BlcnR5KCdvdmVyZmxvdycsICd2aXNpYmxlJywgJ2ltcG9ydGFudCcpO1xuICBwb3N0LnN0eWxlLnNldFByb3BlcnR5KCdjb250YWluJywgJ25vbmUnLCAnaW1wb3J0YW50Jyk7XG4gIHBvc3Quc3R5bGUuekluZGV4ID0gJzEnO1xuXG4gIC8vIFJldXNlIG92ZXJsYXkgaWYgZWRpdGVkIHNjcmlwdCBhbHJlYWR5IGNyZWF0ZWQgaXRcbiAgbGV0IG92ZXJsYXkgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTERpdkVsZW1lbnQ+KCcuY3FkLW92ZXJsYXktY29udGFpbmVyJyk7XG4gIGlmICghb3ZlcmxheSkge1xuICAgIG92ZXJsYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBvdmVybGF5LmNsYXNzTmFtZSA9ICdjcWQtb3ZlcmxheS1jb250YWluZXInO1xuICAgIG92ZXJsYXkuc3R5bGUuYm9yZGVyUmFkaXVzID0gYm9yZGVyUmFkaXVzO1xuXG4gICAgaWYgKGlzUGFnZURhcmsoKSkgb3ZlcmxheS5jbGFzc0xpc3QuYWRkKCdjcWQtdGhlbWUtZGFyaycpO1xuXG4gICAgb3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBpZiAoZS50YXJnZXQgPT09IG92ZXJsYXkpIHRyaWdnZXJQb3N0Q2xpY2socG9zdCk7XG4gICAgfSk7XG5cbiAgICBwb3N0LmFwcGVuZENoaWxkKG92ZXJsYXkpO1xuICB9XG5cbiAgLy8gRG8gbm90IGNyZWF0ZSBhIGNvbW1lbnQgYmFkZ2UgaWYgYSBCT1RIIHBpbGwgYWxyZWFkeSBleGlzdHNcbiAgaWYgKHBvc3QucXVlcnlTZWxlY3RvcignLmNxZC1ib3RoLWJhZGdlJykpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBiYWRnZS5jbGFzc05hbWUgPSAnY3FkLWNvbW1lbnQtYmFkZ2UnO1xuICBiYWRnZS50aXRsZSA9IGAke2NvdW50fSAke3QoJ2NvbW1lbnRzJyl9YDtcbiAgaWYgKGlzUGFnZURhcmsoKSkgYmFkZ2UuY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcblxuICBjb25zdCBpY29uRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGljb25EaXYuY2xhc3NOYW1lID0gJ2NxZC1iYWRnZS1pY29uJztcbiAgaWNvbkRpdi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtDT01NRU5UX0lDT05fVVJMfVwiKWA7XG5cbiAgY29uc3QgbGFiZWxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGxhYmVsRGl2LmNsYXNzTmFtZSA9ICdjcWQtYmFkZ2UtbGFiZWwnO1xuICBsYWJlbERpdi50ZXh0Q29udGVudCA9IGAke2NvdW50fWA7XG5cbiAgYmFkZ2UuYXBwZW5kQ2hpbGQoaWNvbkRpdik7XG4gIGJhZGdlLmFwcGVuZENoaWxkKGxhYmVsRGl2KTtcblxuICBiYWRnZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0cmlnZ2VyUG9zdENsaWNrKHBvc3QpO1xuICB9KTtcblxuICBwb3N0LmFwcGVuZENoaWxkKGJhZGdlKTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlclBvc3RDbGljayhwb3N0OiBIVE1MRWxlbWVudCkge1xuICBjb25zdCB0aXRsZUxpbmsgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdhW2hyZWYqPVwiL2RldGFpbHMvXCJdLCBoMiBhJyk7XG4gIGlmICh0aXRsZUxpbmspIHtcbiAgICB0aXRsZUxpbmsuY2xpY2soKTtcbiAgfSBlbHNlIHtcbiAgICBwb3N0LmNsaWNrKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0UGFnZURpcmVjdGlvbigpOiAnbHRyJyB8ICdydGwnIHtcbiAgY29uc3QgZG9jRGlyID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRpciB8fCBkb2N1bWVudC5ib2R5LmRpcjtcbiAgaWYgKGRvY0RpciA9PT0gJ3J0bCcpIHJldHVybiAncnRsJztcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5kaXJlY3Rpb247XG4gIHJldHVybiBjb21wdXRlZCA9PT0gJ3J0bCcgPyAncnRsJyA6ICdsdHInO1xufVxuXG5mdW5jdGlvbiBnZXRBcmlhTGFiZWxzKGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIHJldHVybiBBcnJheS5mcm9tKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsXScpKVxuICAgIC5tYXAoKG5vZGUpID0+IG5vZGUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHwgJycpXG4gICAgLmpvaW4oJyAnKTtcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuICBpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG4gIGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBhcmdzLnNoaWZ0KCk7XG4gICAgbWV0aG9kKGBbd3h0XSAke21lc3NhZ2V9YCwgLi4uYXJncyk7XG4gIH0gZWxzZSB7XG4gICAgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG4gIH1cbn1cbmV4cG9ydCBjb25zdCBsb2dnZXIgPSB7XG4gIGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG4gIGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcbiAgd2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG4gIGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5leHBvcnQgY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcbiAgY29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcbiAgICBzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcbiAgICB0aGlzLm5ld1VybCA9IG5ld1VybDtcbiAgICB0aGlzLm9sZFVybCA9IG9sZFVybDtcbiAgfVxuICBzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG4gIHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcbiAgbGV0IGludGVydmFsO1xuICBsZXQgb2xkVXJsO1xuICByZXR1cm4ge1xuICAgIC8qKlxuICAgICAqIEVuc3VyZSB0aGUgbG9jYXRpb24gd2F0Y2hlciBpcyBhY3RpdmVseSBsb29raW5nIGZvciBVUkwgY2hhbmdlcy4gSWYgaXQncyBhbHJlYWR5IHdhdGNoaW5nLFxuICAgICAqIHRoaXMgaXMgYSBub29wLlxuICAgICAqL1xuICAgIHJ1bigpIHtcbiAgICAgIGlmIChpbnRlcnZhbCAhPSBudWxsKSByZXR1cm47XG4gICAgICBvbGRVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgaW50ZXJ2YWwgPSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICBsZXQgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgICAgaWYgKG5ld1VybC5ocmVmICE9PSBvbGRVcmwuaHJlZikge1xuICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgb2xkVXJsKSk7XG4gICAgICAgICAgb2xkVXJsID0gbmV3VXJsO1xuICAgICAgICB9XG4gICAgICB9LCAxZTMpO1xuICAgIH1cbiAgfTtcbn1cbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuLi91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQge1xuICBnZXRVbmlxdWVFdmVudE5hbWVcbn0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5leHBvcnQgY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuICBjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuICAgIHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGlmICh0aGlzLmlzVG9wRnJhbWUpIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKHsgaWdub3JlRmlyc3RFdmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcbiAgICBcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCJcbiAgKTtcbiAgaXNUb3BGcmFtZSA9IHdpbmRvdy5zZWxmID09PSB3aW5kb3cudG9wO1xuICBhYm9ydENvbnRyb2xsZXI7XG4gIGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcbiAgcmVjZWl2ZWRNZXNzYWdlSWRzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgZ2V0IHNpZ25hbCgpIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuICB9XG4gIGFib3J0KHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuICB9XG4gIGdldCBpc0ludmFsaWQoKSB7XG4gICAgaWYgKGJyb3dzZXIucnVudGltZS5pZCA9PSBudWxsKSB7XG4gICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuICB9XG4gIGdldCBpc1ZhbGlkKCkge1xuICAgIHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG4gIH1cbiAgLyoqXG4gICAqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpcyBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcbiAgICogY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcbiAgICogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcbiAgICogfSlcbiAgICogLy8gLi4uXG4gICAqIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcbiAgICovXG4gIG9uSW52YWxpZGF0ZWQoY2IpIHtcbiAgICB0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICAgIHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuICB9XG4gIC8qKlxuICAgKiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvbiB0aGF0IHNob3VsZG4ndCBydW5cbiAgICogYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcbiAgICogICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuICAgKlxuICAgKiAgIC8vIC4uLlxuICAgKiB9XG4gICAqL1xuICBibG9jaygpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cbiAgICovXG4gIHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbCB3aGVuIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcbiAgICB9LCB0aW1lb3V0KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9KTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlIHJlcXVlc3Qgd2hlblxuICAgKiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2AgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG4gICAgICBpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0sIG9wdGlvbnMpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG4gICAgfVxuICAgIHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4oXG4gICAgICB0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSxcbiAgICAgIGhhbmRsZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNpZ25hbDogdGhpcy5zaWduYWxcbiAgICAgIH1cbiAgICApO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWxcbiAgICogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG4gICAqL1xuICBub3RpZnlJbnZhbGlkYXRlZCgpIHtcbiAgICB0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcbiAgICBsb2dnZXIuZGVidWcoXG4gICAgICBgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGBcbiAgICApO1xuICB9XG4gIHN0b3BPbGRTY3JpcHRzKCkge1xuICAgIHdpbmRvdy5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuICAgICAgICBjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcbiAgICAgICAgbWVzc2FnZUlkOiBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKVxuICAgICAgfSxcbiAgICAgIFwiKlwiXG4gICAgKTtcbiAgfVxuICB2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcbiAgICBjb25zdCBpc1NjcmlwdFN0YXJ0ZWRFdmVudCA9IGV2ZW50LmRhdGE/LnR5cGUgPT09IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRTtcbiAgICBjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGF0YT8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG4gICAgY29uc3QgaXNOb3REdXBsaWNhdGUgPSAhdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuaGFzKGV2ZW50LmRhdGE/Lm1lc3NhZ2VJZCk7XG4gICAgcmV0dXJuIGlzU2NyaXB0U3RhcnRlZEV2ZW50ICYmIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgaXNOb3REdXBsaWNhdGU7XG4gIH1cbiAgbGlzdGVuRm9yTmV3ZXJTY3JpcHRzKG9wdGlvbnMpIHtcbiAgICBsZXQgaXNGaXJzdCA9IHRydWU7XG4gICAgY29uc3QgY2IgPSAoZXZlbnQpID0+IHtcbiAgICAgIGlmICh0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlZE1lc3NhZ2VJZHMuYWRkKGV2ZW50LmRhdGEubWVzc2FnZUlkKTtcbiAgICAgICAgY29uc3Qgd2FzRmlyc3QgPSBpc0ZpcnN0O1xuICAgICAgICBpc0ZpcnN0ID0gZmFsc2U7XG4gICAgICAgIGlmICh3YXNGaXJzdCAmJiBvcHRpb25zPy5pZ25vcmVGaXJzdEV2ZW50KSByZXR1cm47XG4gICAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJicm93c2VyIiwiX2Jyb3dzZXIiLCJwcmludCIsImxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLG9CQUFvQkEsYUFBWTtBQUM5QyxXQUFPQTtBQUFBLEVBQ1Q7QUNDTyxRQUFNLHdCQUF3QjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBMkI5QixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQVVNLFFBQU0sdUJBQXVCO0FBUTdCLFFBQU0sbUJBQW1CLDJCQUEyQjtBQUFBLElBQ3pEO0FBQUEsRUFDRixDQUFDO0FDakRELFFBQU0sV0FBVztBQUNqQixRQUFNLGtCQUFrQjtBQUd4QixRQUFNLGdCQUFnQjtBQUN0QixRQUFNLGlCQUFpQixHQUFHLGFBQWE7QUFFaEMsV0FBUyxlQUFxQjtBQUNuQyxRQUFJLE9BQU8sYUFBYSxZQUFhO0FBQ3JDLFFBQUksU0FBUyxlQUFlLFFBQVEsRUFBRztBQUV2QyxVQUFNLFFBQVEsU0FBUyxjQUFjLE9BQU87QUFDNUMsVUFBTSxLQUFLO0FBQ1gsVUFBTSxjQUFjO0FBQUE7QUFBQSwwQkFFSSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBeUtULHFCQUFxQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUF3SnJDLGVBQWU7QUFBQSxnQkFDZCxlQUFlO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFB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U0FBUztBQUMxQyxZQUFJLENBQUMsS0FBSyxPQUFPLFFBQVMsVUFBUyxHQUFHLElBQUk7QUFBQSxNQUM1QyxHQUFHLE9BQU87QUFDVixXQUFLLGNBQWMsTUFBTSxtQkFBbUIsRUFBRSxDQUFDO0FBQy9DLGFBQU87QUFBQSxJQUNUO0FBQUEsSUFDQSxpQkFBaUIsUUFBUSxNQUFNLFNBQVMsU0FBUztBQUMvQyxVQUFJLFNBQVMsc0JBQXNCO0FBQ2pDLFlBQUksS0FBSyxRQUFTLE1BQUssZ0JBQWdCLElBQUc7QUFBQSxNQUM1QztBQUNBLGFBQU87QUFBQSxRQUNMLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSTtBQUFBLFFBQ3JEO0FBQUEsUUFDQTtBQUFBLFVBQ0UsR0FBRztBQUFBLFVBQ0gsUUFBUSxLQUFLO0FBQUEsUUFDckI7QUFBQSxNQUNBO0FBQUEsSUFDRTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFLQSxvQkFBb0I7QUFDbEIsV0FBSyxNQUFNLG9DQUFvQztBQUMvQ0MsZUFBTztBQUFBLFFBQ0wsbUJBQW1CLEtBQUssaUJBQWlCO0FBQUEsTUFDL0M7QUFBQSxJQUNFO0FBQUEsSUFDQSxpQkFBaUI7QUFDZixhQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsTUFBTSxxQkFBcUI7QUFBQSxVQUMzQixtQkFBbUIsS0FBSztBQUFBLFVBQ3hCLFdBQVcsS0FBSyxPQUFNLEVBQUcsU0FBUyxFQUFFLEVBQUUsTUFBTSxDQUFDO0FBQUEsUUFDckQ7QUFBQSxRQUNNO0FBQUEsTUFDTjtBQUFBLElBQ0U7QUFBQSxJQUNBLHlCQUF5QixPQUFPO0FBQzlCLFlBQU0sdUJBQXVCLE1BQU0sTUFBTSxTQUFTLHFCQUFxQjtBQUN2RSxZQUFNLHNCQUFzQixNQUFNLE1BQU0sc0JBQXNCLEtBQUs7QUFDbkUsWUFBTSxpQkFBaUIsQ0FBQyxLQUFLLG1CQUFtQixJQUFJLE1BQU0sTUFBTSxTQUFTO0FBQ3pFLGFBQU8sd0JBQXdCLHVCQUF1QjtBQUFBLElBQ3hEO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixVQUFJLFVBQVU7QUFDZCxZQUFNLEtBQUssQ0FBQyxVQUFVO0FBQ3BCLFlBQUksS0FBSyx5QkFBeUIsS0FBSyxHQUFHO0FBQ3hDLGVBQUssbUJBQW1CLElBQUksTUFBTSxLQUFLLFNBQVM7QUFDaEQsZ0JBQU0sV0FBVztBQUNqQixvQkFBVTtBQUNWLGNBQUksWUFBWSxTQUFTLGlCQUFrQjtBQUMzQyxlQUFLLGtCQUFpQjtBQUFBLFFBQ3hCO0FBQUEsTUFDRjtBQUNBLHVCQUFpQixXQUFXLEVBQUU7QUFDOUIsV0FBSyxjQUFjLE1BQU0sb0JBQW9CLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDN0Q7QUFBQSxFQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNiw3LDgsOSwxMCwxMV19
commentframe;