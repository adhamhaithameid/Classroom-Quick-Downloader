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
  const RESCAN_INTERVAL_MS = 2e3;
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
      scanForAttachments();
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
      const hasChildListChange = mutations.some(
        (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
      );
      if (hasChildListChange) scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(() => scheduleScan(), RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments() {
    if (!isGoogleClassroom()) return;
    injectSingleFileButtons();
  }
  function injectSingleFileButtons() {
    const anchors = Array.from(
      document.querySelectorAll(DRIVE_ANCHOR_SELECTOR)
    );
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container || hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      document.querySelectorAll(
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2kxOG4udHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9pbmRleC50cyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG4gIHJldHVybiBkZWZpbml0aW9uO1xufVxuIiwiLy8gZW50cnlwb2ludHMvY29udGVudC9pY29ucy50c1xuXG4vLyBSYXcgU1ZHc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIj5cbiAgPGcgc3Ryb2tlPVwiI0ZGRkZGRlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj5cbiAgICA8cGF0aCBkPVwiTTYgMjFIMThcIiAvPlxuICAgIDxwYXRoIGQ9XCJNMTIgM1YxN1wiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0wxNyAxMlwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAxN0w3IDEyXCIgLz5cbiAgPC9nPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfUkFXID0gYDxzdmcgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbjxyZWN0IHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgZmlsbD1cInVybCgjcGF0dGVybjBfMV8yNDg0KVwiLz5cbjxkZWZzPlxuPHBhdHRlcm4gaWQ9XCJwYXR0ZXJuMF8xXzI0ODRcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIiBoZWlnaHQ9XCIxXCI+XG48dXNlIHhsaW5rOmhyZWY9XCIjaW1hZ2UwXzFfMjQ4NFwiIHRyYW5zZm9ybT1cInNjYWxlKDAuMDA2MjUpXCIvPlxuPC9wYXR0ZXJuPlxuPGltYWdlIGlkPVwiaW1hZ2UwXzFfMjQ4NFwiIHdpZHRoPVwiMTYwXCIgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBZ0FFbEVRVlI0QWUyZENYaFY1YlgzMTBuSVNNaDRoaVNvVjJ0cmhjb0RhdWwzYXd2NlZhdlgxdFQyRnJWZSsvVzI5N2IzWHUwVmVqKzEwZXNVNWxFSVF4Sm1FSWhsa0Rsa25nZENFaVNNQWlLelJmQlc4R3VyRld2OWY4Ly8zZnROTmpGSWhuMU9Uc0xlejdOeWpKeWN2ZC8xLysyMTNyWDJ1L2NSQ2NTV0llSHlndThHeWZEZEl5OTVuZ3pKY0dlN010eWJYQm0rU2xlR2Q0Y3J3N3ZUTmRiWDVNcG9ZL3gvam5YZkIrMzVsVDVYdnFjRzdrM1VSRjcwakphWHZOODF0Skx3UUtEaHYzMDhHNWNnTDNudkMzblpNOTcxc3FmQWxlRTk2UnJyL1l0cm5BK3U4YVpOOE1JMXdRZlh4TXZZSkI5Y2puWGZCNWZ6TDMxUERiUWUxR2FzOTJPbDFjdWVBbXBIRFlWYTlwcnR4YVRoUXVneVBFMnVzZDZMcnZHRXpBdlhSQzljazcxd1RmSEJOZFcwYVQ2NHRFMzN3YVZ0aGcrdXRxYi96WGx0OWRNWCthS3QvL2k3OWYzYTczelZlbEFiYWtTdEZKaGVBbm1SV2xKVG9iWkJ1NzNrdTFzeXZLdGtyUGQ5R2UrRlRQUkNKbnNoVTd5UWFUN0lkQjlraGcveWlnOHkwd2VabFF6SlRJYk05a0ZtODlXME9ja1F4L3puQSsxbjllb3pOS0FXMUlUYVVDTnFSYzJvSFRXa2x0U1UybEpqYWgwMDI0dWVXeVhEczF6R2VqK1VDVHhnSHJnNWdCa2NtQVl0R1RJM0dUSXZCWktWQXNsT2dlU2tRT2Ezc1FVcGtMYTJNQlhpV09kOTBOYVAvTDJ0djZrRGpacFFHMnBFT0JrY3FCMDFWREQ2REcycE1iV201dFMreDdZTVQ0eTg3SGxXeG5yZU1jQmpwUE1hWnhEUEpnNkNrU3dydVJXMGhTbVFSU21RSlNtUXBiUlV5TEpVeUhLckRZUzg2cGhmZkxCODRLVytwdStwQWJXZ0p0U0dHaEZTQmdkcVJ3MnBKVFZsZEtUR2pJb0tSTTg3aW9IZnVnY0Vsa09TUDlaVEtPTTl4c0VvOEx5UVdUN0lISjhKWGJJUnlSYWJzQzFMZ2J5YUNsbVJDbG1aQWxucGc2ejBRRlltUVZZbVFGYkdHN1lxQWVLWS8zeWcvRXgvMCtoN2FrQXRVZ3h0cUJHMUlwVFVqbEV6eHd3azFKWWF6ekNERFVFa0EyUWhZTkV3dy8wVEdlYzVydVlGVXhueE5IakprR3dUT2hYbHpLaEc0SElIUW5LVElibHVTRzRDNUhkdTlGdDNEZUkyM1l4cjhtN0hWd3UvalNIRi94dkRTcjdqV0FCOE1LVDRMbnkxNEZ2Szk5U0FXbEFUcFkzU2lGb05OSUJrZGxxU2FrUkh3a2lOR1JVMWlHU0FjMFF5UVRiOHVvMzFQaVBqUFIrcUVNeW94N0NzMHl3UGptY013enFoV3pVUThqdWFGL0s3Uk1nNkh6eGJiOEh3OHZ2eFVPTy80Ny8ydll4eGh6SXg4KzJGbUhkOE9lYWZXSVdGSjNNZEM0QVA2R3Y2bkw2bkJ0VGk0Y2IvVU5wUUkycWxORlBhRFRTMHBLYlVWa2RGblo3SmdFN0xaSU9NK0dYTGNJK1ZDUjZqTW1MVXkvUkM1dm1NOE15SXg1RE44TDBxMVFCdmpRK3lKZ0dSbTY3SGJlWGZ4YjgwLzE5TU9qSVhDMCt1d3ZKMzFpcGJlbm8xRnAxK0RRdFByY0lDeHdMcWc0V25WeW5mVXdPbHgrbTFTaHRxUksyb0diV2poa0l0R1V5b0xUV20xdFNjcVprTWtBVXl3YXFaakpBVlc3ZTI4TEYxa3VXRExFZzJKcSt2cGxqQVMxRUhIYkhwT3R4Ui9RQ2VQakFXMlNkZnhkSjNWb09EempxNURITlBMc0VjMnFrbG1IdHFxV005NkFOcVFDMm9DYldoUnRTS21sRTdha2d0RFJCVExDQ2FoUXNaSUF0a3dpOFFqbk0vTFJNOUVPYjZWN3lRMlY1akhzQnFpWk5WVGw1ZlM0V3NIUWhaNjRXczkyQlEyUWlNM3YraUdzVEMweXZWQUdlZFhJaFdXNFJaSnhkaDFpbkhnc0lIMUVKWnEwYUVrdG9SUkdwSlRhbXQwcGhhVTNOcVR3YklBdWVHWklPTXFIa2hpeFAzVTkwTGhCbWVVVExSL1pGTTlSZ2ZQTWNMeWZGQkZpVkRsalBxcFVCV3AwTFdwVUplVDBUL3JkZmp3Y1oveG94ak9jZzU5U3BtbmxpQTZTZHlNUDFrRG1iUVRsM0dUdWRnaG1PQjk4SGw5RGhwYUVidHFDRzFwS2JVbGhwVGE2VTV0U2NEWklGTWtBMHlvaUQwUUxFejF2TlExeUFjNXgwcUU5eW5XdUNiYThLM09CbnlLcXNrcGxxQ2x3SlpuNGlVb2lGNGZGKzZDdVV6VCtSZ3l2RzVtSEppTHFhY3ROaXB1WmhpdGROek1hWEY1bUhLYWNjQzV3T0w3NjJhOEwrdG1sSEQ0M05CVFptbXFURzFsdlVKaHZaa2dDeVFDYkpCQ01sS0s0U25oU3gxYW1PVGVZS25XS2E2SVRPOUJ0WHpmY1lPdUtQWFVpQnJVeUViVWlBYkUzRmorZi9DYncrTng2eVRDekRwZUNZbUhKK0ZDU2N5TWVHa3hVNWxZa0piTzUySkNWWnIrKy9PNzUvM21SMCtzZnFjLzkzZVoxcTFvNWJIWnlsdHFmRnZENDNEbDhxL29iUlhESkFGTXFFaEpDdU1oR1NIREpFbE10WGhiWHhTdWt4eFg1cDJXeUlmNTNzbWZKc1M4WldLdjhlemh5ZGcyb2w1eURnMkhSbkhweVBqaEdrblp5QkQyNmtaeUhDczkvaEE2OFpYclNlMVBUWmRhVTNOcWIxc1NqUUNFWm5JWlpWc2lZUTZIWk9sQ1VuUGRveS9jYjRoTXNsOVRtWjR6SUtqVGVUamZHOWpLbVJURXE0cnZ4MVBIYzdBeE9PejhQelJ5WGpoMkdTOGNId3lYamd4cGRWT1RzRUxWanZWNW5mOWIvei9qZ1hPQjlydjF0ZjJ0TEZxU1cyUFRWWmFVM05xVHdiSWdtS0NiRmdqWVRhclk3Wm9QRkJNa2EwdjNESWtSTVo3WHBWcEhxTzN3L0phRlJ6bW5JK1VieHdJMmV4R1l2RWcvUHVCWjlRWmtmNzJlS1FmSFkvMFk2WWRuNEIwYlNjbUlGM2J5UWxJcCtuZm5kZmc4a1Y3K21nZCthcjFwZFp2ajFmYWt3R3lRQ1lVR3lvU3NqQkpOdGdoUSt3VGtpbXlSY1l1dTAzd2pKUXA3bzlrcGdjeXp3dFo0SU1zODBGV0pVUFdwRUEycEVJMmV4RmVjQTErM1B5dmVQSHR5WGpxeUV0NDZ1Mlg4TlRSbC9EVXNaY05PLzRTbm5LczcvbEE2MHV0cWZtUmx4UURaSUZNa0EzRkNGa2hNMlNIREpFbE1rVzJ5Rmk3RzhtYzVGNGxNOXlRMlI3SWZDOWtDUzlTSjBOV3M5Sk5nV3hKZ2VTNThZMGQ5K09aSXhrWTg5YnpHSDNrT1l4Kyt6bU1QdnJmaGgzN2I0eDJyTy82UU90TXpZODhweGdnQzJTQ2JDaEd5QXFaSVR0a2lDeVJLYkpGeHRxTmdoUGR0OGtVOXdXWjVZYk04MEFXK1NETGZaRFhraUhyVWlDYlVpQmIzZkNXMzRKZnZma2JqSDdyT1R4KytHazgvdFl6ZVB6SU0zajhiWXNkZlFhUE85YjNmR0RWbUpwVCs4TlBLeGJJQk5rZ0k0b1ZNa04yeUJCWklsTmtpNHlSdGM5dGs1SW15blEzWkk0SGt1T0JMR1hxNWZYY1pLUEsyZUpEU0g0eTd0azVDdjk1NkxmNDVjRXgrT1hoMytDWGI1bDI1RGY0cFdOWGp3KzA3bVRnNEJqRkJOa2dJN0xGWnpCRGRzZ1FXU0pUWkl1TWtiVkx0c2x4Q1RJMXNWbG11aUZaakg1ZXlLdGN4ZUtEdko0TTJXeWszbXNxaCtIbiszK05YN3o1bi9qWndTZndzOE1XZStzSi9NeXhxOGNIVnUwUFBxR1lJQnRrUktWaU1rTjJ5QkJaSWxOa2k0eVJOVExYc2sxT3ZGZW1KMzBpczkyUStZeCtYc2dxcjdFS1ltTXlaS3NQcmdJZlJqYWxxUjA5ZXVCWGVQVGd2K0hSUTZZZC9qYzg2dGpWNXdPdFAxazQ4Q3ZGQmhraEsyUkd5QTVYMHBBbE1rVzJ5TmowcEw4S21XdlpwaVNObDFlU2pEeTkwSE5wOUdQaHNjMk54UEtiOGFNOVA4TWpCLzRWb3c3OEhLTU8vc0t3UTcvQUtNZXVYaDlvRGc3OFhMRkJSc2dLbVZFRmlUVUtraTNPQmNrYW1WUGJBZ21UYVVuRmtwa0V5ZlpBbG5DSnRvNStQa2hlTWlUZmpVSGJ2NFdIOXYwY0QrNTdEQThlb1AwVUQ3NzVVeng0MExHcjJnZGtnQ3lRaVgyUEtVYklDcGxSN0d4a0hjRnVDcnNxSG9NeHNrYm15SjVNajd0QnBpZWVrcmx1eUFJM1pKa0g4cG9YOHJvUHNqa1pzczJMME9KVTNORjBQMzZ3OTU5dy83NkhjZi8rUjNEL0FjZDYwZ2ZmTy9BSS9HVmRHaGVaMlBld1lvU3NrQm15b3hnaVMyU0tiSkV4c2tibXlKNU1TN3hYWmlaK0lsbHV5Q0kzWklVYnNwb05SZVp4SS9yRmxkK0k3K3g2RVBmdCtUSHUyZnNqM0xQdkgzSFBmc2Q2MGdkM0gvZ2g3anlVWnB1TlBKU0diNy81ZmR5MS93ZjRibGUwSlJON2Y2UVlJU3RrUmtWQk1rU1d5QlRaSW1Oa2pjeVJQWm1XOUtSa0prSnlraUJMM0pCVkhzZ2FMMlNqRjVMbmd4UW1JYlg2Rm55bitRZTRhM2NhN3R5VGhqdjNwdUhPZlk3MWhBL3UycGVHa2ZzZndKMTdIOEFEOVk4Z3JlWW5lS0QyRWFSMXd4Nm9lUmpmcTNrSUR6WDhIRC9hOTM4d2N2LzNPNjh2bWRpVHBoZ2hLMlNHN0NpR3lCS1pJbHRrakt5Uk9iSW4wNU95WkhZaVpINGlaQm52alBKQVh2ZENObm1ORUZya3dRMTF0MlBrcnUvaGp1YjdjTWZ1KzNESG52dHd4MTdIZXNZSC80RGJEdHlGeDZwK2haekZPY2hhbElQc3BkbklYc3JYemx2V2ttemtMRnVBMXpldFI5M09ldnpIL3YvQ3JYdnY3THkrWklKc05OK0hPM2Q5VHpFalJSNkRJYkpFcHNnV0dTTnJaRzVHd2p5UlZ4STJ5cHhFeU1KRXlISzNjWHNlbDE1djhVTHlQWkJpSDI2cS93YSt1ZXU3R0w3cmJneHZ2aHZEZDkrTjRYc2M2d2tmRE4wN0VuZnN1aGNMOGhkaloza1REdXcrZ01QN0R1SFF2b05kdEVNNCtmWkpmUGJCMzFEd1hnbHUyM01YYnQxOVorZjFKUk5rWTlmZGloVXlRM1lVUTJTSlRQSFdUekpHMXNnYzJaT1pDUlV5THhHeUtBbXlJZ215MmdQWjRJRnM5VUlLUEFndFRjWlhkM3dEdDc5eEY0YnRHb2xoelNNeGJMZGpQZUdEb2J0SDRpdDdoK1BYVlUraHVYWVhMcngvSG5adDV6KzdnQjhlL2lsdWZPTTJETnQ5WjljMEpodTdSaXBXeUF6WklVT0tKVEpGdHNnWVdTTnpaRTlteHRWTEZnRk1OQUYwUXphNElWczlrQUkzK3BXbTRDdjFYOGVRcG0vaGF6dS9pYSs5OFUxOGJaZGpQZUdERzV0dnhSMDc3c1A2MGcwNGMvVDMrUFRUVCszaUR6TitQdzhER3dkajhLNi83N3ErWkdQbk54VXJaSWJza0NIRkVwbGF6U0tYQUNaQ01VZjJaR1ppazJRbFFKWWtHbzlxV01OMVhSNUluZ2RTYUFCNHcvWmJjWFBqTjNCVDAzRGN0SE00Ym5yRHNVRDc0TXR2M0k1cjN4aUM1OHBleHFIR04vR25QLzNKTnZoMi8za2ZoalIvRzljMjNkSTliY2xHMDNERkNwbFJBQmF5SCtneG1DSmJmQndJV1NOelpFOHk0NXNrbXdEeW1TeEprTFZKeGdwWExxMGhnR1hKdUc3N0VIeTU4VFo4cWZGV2ZLbnBWbnhwcDJPQjlvRjMxMWR4ViswREtDa3Z3Ym5UNS9DM3YvM05GZ0EvK2V3VC9NdVJKeEcvNDRidTYwbzJHbTlWckpBWnNrT0cxTFZocnBvbVcyU01ySkU1c3FkKzVDUkFsaVpDY2pXQWJ1TlNTaEVCOUNHMWJoQ3UyekVFMXpiY2dtc2JiMUZuQ3M4V3h3TGpnNVNtUVVocEhJU3BKYS9nMk82aitPaWpqMnlCangreTdnK2I0Vzc0TXBJYmIrNitubVNqNFJiRkNwa2hPMUprc3JUSmJRQkl4c2dhbVRNQWpHdVNuSGpJc2dSSUx1LzNURFFpSUsvbEZTVWh0TndMVCsxTlNLMGZoSlFkTnlPbDRXYWtORG9XT0I4TVF2K21hL0Q5eW9kUlgxV1A5OCs5ajgvd21TMEFudnZrUGR5eDl4OFF2VDBWcVkyRXZKdTZrbzBkTnl0V3lBelpJVVBxdWpBaklOa2lZMlNOekdYR01RTEdOY2w4RThEWEVvMmJqdmxtQWxoc0FKaFVleU84OVRmQlUvOFZlQm9jQzZRUFlodi9EcW4xZzdHZ2VERk9IenlGaXhjdjJnSWZQeVRqMUZUMHEvT29DR2pibU9xL29sZ2hNd3JBWWd1QXZLR2RqQkZBTW5kWkFEY25HWmRSaXBNUVV1WkJYTzNmSWJIK1MwaW92d0VKRFk0RnlnZnhEZGNqdE1HRHg4cCtpYjExZTNEaC9BWGI0R3Y2VTdOSzZ4SGJrKzNWdFA0R3hRcVpJVHNNWXVxU0hKbTZQSUJ4a0dYeGtOZDR0M3NpWkhNaUpEOUovYkdyekkzK05kY2d0dTVhRE5oK0xRYlVPeFlZSDF5SDBBWTNycThlaW5VbHIrUGRvMmZ3MTAvL2FndUFMRHgrZlBDZklUVXhpSzIvemw1TnQxK3JXQ0V6Wk1jQU1NbGdTZ0dZWUxBMlAwNUh3TmdteWRFQXhrUFdKVUEySlVDMkpVS0tFdUVxUzBKa1ZTcWlhd2NpcW00Z29yWTc1bThmUkc4ZmlJanRLWkR0Q1hpeStHbTgxWGpZMXJiTHF2ZldJYXcyRVdGMVhuQmZ0bzZuYnFCaWhjeVFIVEtrV0NKVFpPczFUdmZpb1pqTGpPVWNNTFpKU0NQL1oyNDdBSlltSXJ6U2g0aWFaRVRVSmlPaXpqRi8reUM4TGhsU0g0TmJLcjZKNHJJU3ZHZGoyK1hNeGJNWXN1c09TSFdVZ3R6MnNaQ1JtbVRGakt2VUNHS1hBRWpHeUpxS2dBckFBVTB5UHhheUxBNlNHd2RaRncvWkZBL1psZ0FwU29Dck5BR2hsVzcwcS9HZ1g2MUhUVm81Y1hYTWZ6NEkyWjZBZnJVSkdGYzBDU2YySExlMTdmTHNpYkdRcW40SXFYUDdSME15VXVOUnpKQWRNcVJZSWxOa2k0eVJOVEtYT1lBUmtBQU9nQ3lMTlFHTWcyeUtnMnlMaHhURlEwcmo0YXBNaEtzNkNhN2FKTGpxSFBPckQycVRJTnZETUxMc1B0Ulg3YkMxN2RMd3h5YkUxdzlVMFMvRVh6cVNFYkpTbWFqWVVReVJKVEsxemd4eVpJM01kUlJBcVVpQVZDVkFhaElndFk3NTFRZDEwWWlwOGlLbmFBSGVPZmdPUHJhcDdYTHhieGVSOXViRGtBcUIxQ2I2VDBjeVFsYklUS2taeEs0SVlNNFhSMEFId0VDZGRQR1F1bENNS240TWUrdjI0b1B6SDloUzlmSkRWcHg3RFNIVkVhcnk5ZXNKMUZFQXlWeExCRlFBRG9Ea3hrTFd4Wm9wT0E1U0ZBY3BqWU5VeEVPcTRpRTE4WkJheC96amd3UklYVGlTSzIvRW1wSjFPSHZzWGR2YUxtY3V2b3ZCYjl3T3FYU1prYytQR3BJUnNrSm15QTRaMm1aTzY4Z1dHVnMyQVBKNUFHTWd1UU1nNndhWUFNWkNpbUlocGJHUWlqaElWUnlrSmc1UzY1ajlQaUFRQXlDMVlYaWk2RGM0MHZTV3JXMlg5T012R3FtM0p0Yi8rcEVSc2tKbXlBNFoybVlHTmJKRnhwYkZXQUhzM3lRNU1aQ2xKb0JyQjBBMnhrTHlZaUdGc1pDU1dFaDVIS1F5RGxKdFFzaWRPR2F2RDJwRE1LanNOclB0OHA1dHExMVU0VkhuZzFTRkd4bk0zN3FSRWJKQ1pzZ09HU0pMWklwc0VVQ3lSdVl5KzdNS2RnRHM4Wk9wTmhxaDFmMHh0bWdDVHV3NVlWdmI1ZUpuRjVGMjRDRkl1ZGg3c253UnhGMERzTDhaQVdNZ2EyTWdHd2RBOGdaQUNnZVlFVEFXVWhrTHFZNkZNSXc3WnE4UGFnVWpTcitMSFRhM1hWYWN5MFVJSTE5MWxMM0grMFg2a3hHeVVtNW1UekpFbHNnVTJjbzFzMjFPZjJzRWRBRHNzWk9xTmh3eFZVbklMbHFBMzl2WWRsR0Z4ODViemJrZnAwd0JDaHlkQnpDNlNYS2lJVXY3UTNMN1E5YjJoMnlNZ2VURlFBcGpJQ1VESU9VRElKVURJTlVESURXTzJlZURHRWl0WUZUeG85aTczZDYyUy9yeEY4elUyeit3bXBFUnNrSm15QTRaSWt0a2lteVJNYkpHNWpLak9RZU1hcEtjS01qU2FFaHV0QWxnZjBoZWYwaGhmMGhKREtROEJsSVpBNm1PTWZwSU5jNHJWNUowejFqMWhpQzU0bnF6N1hMV3RyWkx3eDhiRVYvbmhWU0ZtdkIxOTFnNzhmZGtoS3lRR2JKRGhzalNSak80a1RHeVJ1YklubVJHbWdCR1FYS2pUQUNqSVhuUmtNSm9TRWwvU0hsL1NHVi9TRFhQSnNlNjd3TUt5bm1aQzA4VWpjYVJuZmExWFZUaHNmL0hsdWdYWUwzSUNGa2hNMlNIREpHbGpXWndJMk5MbzB3QUkwMEFzNk1nUzZJZ3E2SWdhOHczYjQyR0ZFUkRpdnREeXZwREt2cERxa3dJdVJQSHV1ZURHc0dnMHFFb0xpdkdlNmZ0YTd1c09KdUxrTW93byszU0V4cVJFYkpDWnNnT0dTSkxCSkJza1RHeVJ1WVkvTlFQQjhEdXdkUlpvV3ZDRVZvVmdiRkY0MjF0dTZqQ28ybW9FZjA2ZTB4MnZiOXJBRVpDbGtTYUVUQUtzakVLc2pVS1VoQUZLWTZHbEVWREtxSWhWZEdRYXNlNjdZTWF3WWlTNzJCSHRiMnJYZEtQUFE4cEUwaDFaTS9wUkViSUNwa2hPMlNJTEpHcE5XYVdKV3Zaa2RZSVNBQWpIQUFEY1hMVmhDS21NaDdaUmZOdGJidW93cVBXRGFsdzlSeDg5RitIQUl4b0MyQ0VDV0FrWkUwa1pHTWtaR3VrR1FHaklHVlJrSW9vU0ZXVTBkUmtZOU94THZpQWtZbHRsMGRzYmJ1b3dtUGZqOHpvMThQYWtCR3lRbWFLelN4S2xzZ1UyVnBsQnJ2c0NETUN6Z3B2a3F4d3lPSUl5TW9JeU9vSXlJWUl5SllJU0g0a3BDZ1NVaG9KS1krRVZFWkNxaHpybWc4SWhpQzU3RnFzS1ZtTHM4ZnNhN3VzT0xzU0lSWDlJSlg5ZWw0Zk1rSld5QXpaSVVOa2lVeVJMVEpHMXNnYzJWTS9IQUFESUZ3NHBFcndST0dUdHJaZHpsdzhnOEdOUTR6b0Z3ekJvZk1BaHBrUk1CeXlNaHl5T2h5eUlkeU1nQkdRb2doSWFRU2tQQUpTR1FHcGNxeExQcWhtMjJXSTdXMlg5S1BQbWZDeDlSSUUycEFSc2tKbXlFNittVTNKRk5raVk0dkR6UWdZeGdqWUhvQmhEb0IyaWxrZGd0REtNSXd0SEdkcjIwVVZIalZKeHZWZU80KzNPNTkxV1FERHZnakFNTWppTU1oS3Zpa01zb0VBaGtQeXd5RkY0WkRTY0VoNU9LU1NhY1N4enZrZ1RNMzlSaFRmWmV0cUY2UHcrQ0drVkNCVlp1TTVHTFFoSTJTRnpKQWRNa1NXeUJUWkltTmtMU3NNS3ZqSnJINU5rdFVQc3JnZlpHVS95T3ArSm9CaGtQd3dTRkVZcERRTVVoNEdVUjEyRHRheER2dWdXaEJURVd1MFhRN1pkNU9SVVhpRVFpcERna3NQTWtKV3lBelpJVU5iektCR3RzZ1lXU056Wk04QjBKOG5VeitqN1ZMMGtLMXRGNlB3dU1VeTkvUG5HRHI1MlowR2NHWm9rMlNGUUJhSFFGYUVRbGFIUXRhSFFqYUhRcmFGUWdwRElTV2hrTEpRU0FYUE9NYzY3SU1xUVhKcEt0WVUyOXQyU1QvNnJKRjZHZjJDVFE4eVFsYklETmtoUTJTSlRKRXRNa2JXeUJ6WlV6OCtCMkFJWkhNSVpGc0lwREFFVWhJQ0tRdUJWSERBamwzWkJ6eEpYWkJLd1JNRnY4YVJuVWRzdThtbzRmODFJTDQ2d2JqZXErQUxNajNJQ0ZraE0yU0hESkdsOVNFZEFaQnZNdC9zQU5pOWs2MUtNS2hrc05GMmVjZWUxUzdxNXZLOVA0Q1VTUGVPelo5QjVBc0JaSlkxczIxckJIUTFTWllMc3RnRldlR0NySFpCMXJzZ20xMlFiUzVJb1F0UzRvS1V1WXpyak9yTTV0bmRVYU96ZUlIY1pxdmk1M2IwR0FMOVBrRm9SYWp0YlpjVloxY2dwSnlaS0lqSHptdlJaSVhNa0IweVJKYklGTmtpWTJTTnpNMTBNUVZMazJRSlpMRkFWZ2hrdFVEV0MyU3pRTFlKcEZDTU00NnJMTlRBVGFBSVZRY3NxaW9hOFdYeENDOEtSMFJ4SkNKTG9oQlZFcVZlK2QrZE5mNXRWQWxYWExEOTBMRmo2TWh4MnZxZUtzR0lvcEcydGwxVTRkRXcySno3QmVtNHlRTjFJU3VNMG1TSERKRWxNa1cyeUJoWkkzTmt6NjhBVmdpdXJiMFdTNXFXWUVuZUVyeTgvR1U4di9oNTAxN0E4NHM3Ynk4c2VnSGpGb3pIZmEvZlowVFZZSU93U2hCVEZvUHN3aHo4M3NhMlMvclI5T0NITHhnQkRDMEx4Yk1IbndYT1F6MXNaOStPZldpdWJjYnVMaHIvdHFtb0NXdldyY1hOUllPTUtOaUZ5R3hyeE5PWndEeU9VWVdqYkcyN0dJVkh2QkZaOUw2QzliWFRFZkFWYVpKNUFsa2trRmNGOGp1QnZONG1CUmViWVpVM09ITUhuYkV5UVhSbE5QSXY1S3NIN2ZENTduLzk5Rk4xQXc0Zk9kdFo0N2NEL2ZHUGY4U1JOOTdHdEszVEVjV0ZqL3JNNjh4eCtlTzlsWUxra2hSYlY3dW9LeDU3MHlEVXdCL0hiUGRua2hHbVlCNnZOUVdUS2JKRnhzZ2FtU043Nm9jL0FlUUFTd1RER29maDdDZG5iWHZhMC9rL25FZHpWVE4rc3UzUjRBR3d3djYyeTRwM1Z5Q0ViWTJ1blB4Mnc5V1J6d3RLQUhsUXhZSXhiNDJ4RFVCR3pqUEh6aUN2TUErRG1JcDdPZ3BXQ2dZVkQwSnhlVEhlczZudG9ncVBIWU9OQ1gxSHhBK0c5d1FsZ0hSTW1TQ3lJaEo1ZjhpekRjSVBQL29ReDVxUFlWcGV6NmZpMEhMNzJ5NnE4T2d0cVZmREg3UUE4Z0IxS3I1b1h5cCsvdy92dDZaaTdZUWVlQjFSTk1MV3Rvc3FQUGljUGE1MjZZSHhkSG1mWFFKd3JrQVdDbVM1UUY0VHlEcUJiQkpJbmtBS0JGSWtoaU00dWVRT3VtTkZma3pGaFlNTXNicHpmRjM0MjVqU0dHUVgyZGQyVVlYSG5qVEQ3MTA0bm03cDA5MzlrUkdlTkdTRzdKQWhza1NteUJZWkkydGtycVVJQ1NTQXBZTEljaitsWWxiRnBXYVR1cnVPN01UZmp5cXd0KzJpQ285U1hsUHQ1c25laVRIWUJtM1FBMGluRkF1R05RekRXWCtrNHJ4SEF4Y0ZLd1RKeFNtMnJuWlJoVWY5WUtPTjBSTUFkWGVmdlFKQUhxUy9VbkZCSGdZRk1CWGJ2ZG9sL2UxMEkzMzF4dWhIZUhzRmdEelFFa0ZrV1NUeS9zY1BWYkZPeGRvaDNUMnJML1AzYlAvWTJYWnArS0FCOFpYeFJ0dmxNdnUwTFZYNjYvTTdEZUIwYVpJNUFsbGdUaEJ6QmJKV0lCc0ZzbFVnK1pZRkNaeGNjZ2QyV2FGZzZJNmgva25GV3g4MWlpVzdqclhONTRTV2htSnNnWDAzR2FuQ1kzZWFjZldnemI1czgzY2dQcGVNNklVSVpJY01rU1V5UmJaWWhKQTFNa2YyMUkrZUFwQUhXeWdZYzlnUERXcW00b0pCZm9Od1JLRzliUmRWZUhBUnA5MG5lU0Nncys2alZ3SElBeThXUkpiNk1SVno2UmJUamRWSjNmenZtQko3Vjd1b3dtUDc0TmE1WHplUHo4NnhkdnF6ZWgyQWRIWXZTOFYydDExVTRjRUw5NzA5K2xITFhna2dEN3FYcEdMVmRySHgyUzZxOE9DM0N1a1ZSNzA1K3ZWYUFIbmdySXA3UVNxMnMrMmk3dkhvQzRXSDlhVHBsUkZRRDRDcHVONlBWYkhlVHhkZjJWOVVqOVMxYWJYTGlqTXJFRkxNTzhqc25hTjJldDdXUlgrMHU1OHVBemhmSU1zRXNrb2dhd1N5UVNCYnpEWDl2S2JIRkVGSGNRZitNbjUrZ1orcllqcTdDOGNmV21LMlhmYmE4MDFHWno0K2c4RXNQT2piTGh4UDBQNE5OU1FySEJmdkJ5RkRaSWxNa1MweVJ0WSsxNFlKQmdBcFJKRWdzc1NQVmJGNjVIRG5SUjlSTU1MV1IrcW1IMGszUlBMM1NSMW91SHM5Z0hSWVFRQlNjU2VFaVNtMnQrMmlDbzl5ZnBsejUwK0VvSTE4MnA5OUFrQU9Jb2hTOGFoOCsxYTd0Rnp4Nkd1cHQwOEJ5TUg0T1JWSEYwVWJjNjhycE1Ea1FudFh1NmpDb3lqRW1DZHAwZnJTYTZjajREUnBrdG5teEhDcFFGYWFFMFo5Y3pvWEZQS2FIdE9GTGtTNGswQll2bURvZGo5VXhkWE5lSlRYaXE4MGhtTEJFL24yUGR0RlhmR29HMno0ODByNzdxMy9Ua2JJQ3BraE8vcW1kQlloWkl1TXNkNGdjMlJQL1FoV0FEbVlmTUdZUTM2NFZzeWJtYllOYW8yQzdRak9hOGwydGwxVTRVRmhBbjBpdHpPMks1NThYZjJiUGdVZ25WQW9pQ3oyVDFVOGZldDBYSktLTFU0UExRckYyUHh4T0dGVDI2V2w4TkNQT3JIc3kyOHc5TVErK2h5QWRHSVBwT0lSK2ZhdGRsR0ZSM05hMzA2OUd2WStDU0FIdFUwdzVxQi9VdkZnbllxNW54SkJUS0c5YlJkVmVQQlplWndiYWFINjZtdVhBTXdVU0k1QWxsaWVrTVZIS2ZCdUppNG8xRS9KMG9VSWR4Sm9LeEJFRmtVaTd6MzdWMUJQMzJLbVlrSlJMQmkxemI2Mmk3cmlVVHZZOEdHZ2ZkWVQreU1qK3BFY1pJY01rU1g5WkN3eVJ0YklYRXNSMGhzQXBETzNDWWJXRGNYWmorMjhyL2c4ZHZFUkg1dC9vcUtUSjkrTE5VVnJiUHNtby9TMzBnMzRldkxrRFNTSWZScEFEczRmcWZqNHU5aXdiUU8rdlBITCtPbm1uK0pRNDJGYkhxbXJDbyt5ZU9PU1d5QWg2TWw5OVdrQTZWaC9wT0lQUDhUaC9ZZVJXNXlMd3BvaW5EdlQvVWZxcXNKalY5clZrM28xOUgwZVFBNVVwMktiN2l2KzdMUFA4T2MvL3hubjN6MlBDLzl6QVI5Zi9MamJ6NjlSaFVlQldYaG9jYTZHMTA0RE9GV2FaSlpBc2kxRkNKL2p4a2NwOEc0bUxxZlJqK2pnNUpJN0NBYmJhbTlWVE9JK0E1OWUyUDJ0cGZDZzM0TEJWNEU4QmpMQzY5d2NPOWtoUTJTSlRQSHh2Q3hDeUJxWkkzdnFSMjhFTUY4UVdXaHZWZHg5OUl4UFNEK2NiZ2dRVENkc29DQzhhZ0NrUS9QTXF0aW1WR3dIZ0tyd0tJMDNtczZCRWoyWTluTlZBY2pCK2lFVmR4VkVWWGk4a1daRXYyQ0NJcERIY2xVQlNNY0dVU3BlOGZzVkNNbm5Od1JkaFNYMTZ1MEFBQWxFU1VSQlZITS9EWG1uQVp3aVRUTFQvTjRHZm44REh5S3RIOC9CdGZ4Y1RzTUpKVmR4Y0hMSkhRU2JiUlVNcmJXM1FkM1pLS2dLajVyQnhwV2pZUE5QSUkrSGpGaVhZcEVoL1ZnT3N0WDZIU0VRc3FkKzlIWUFPZWd0Z2pGdjJuZXR1TE1BcXNLRFZWK3ducVNCZ3ZDcUJKRE8zZFp6VmJFcVBFcmlqYVp6b0lRTzF2MTBDMEQ5WFNHOUxRVnJNYllJaHRiWXU0TDZTcEZRM1Z5K004M29lZW5qdUpwZnJ3UWdHVE8rcHN0TXdaUE1PU0MvSzBRL0oxcmZHOHhsK2RZVk1Yb2V5SjBFby9INE5nYzJGYTk0WndWQytKV2t3ZTZiUU9sRlAzRDFsRjRKUTRiMFBjSDYrZEJramRNK3NxZCs4SmUrQUNDZG5DZUl6QTlNZzFvVkh0V0RqZWdYS0lHRGZUOVhQWUFVS0VDcE9QMVF1dEVsY0tKZmEwWjBBRFRiQUg1T3hhcndLSTQzV2xUQkhwVUNlWHdPZ0swWHcvMlZpaThwUEFJcGJtL1lsd09ncFVEYUxCaGFiWCtEV2hVZVcwT015WFp2Z0NLUXg5Z2xBRjh4djdtR1ZiQitRaGJYOEhNdHYzVkpGcXNiN3FDM0dJOTNrMkRNQWZzYTFLcndxQnJjT3ZmckxiNEkxSEhTNTlhbFdQcCtFUDFrck5adlNiSlV3WDBWUURwOXF5QnlXeVR5enRsek01TXFQTmlhNm0wbm93TmdEMFpPbTFKeHc0VUd4QmZGR3oydVFBbmEyL2JqUk1CMlFMY2hGYXZDb3luTlNiMVhPaUVjQU5zQmtFNWpLbWFEdW91cCtKTEM0MG9pWE0zLzNpVUFaNWlQVExVK0paVkZpTDR2aEV1eTlBM3F2ZG01bXdSRHF6cGZGYXZDbzlJcFBEcFVmQkpBc2tKbTlQMGdaRWtYSWZyeHZHUk9YWXFiS1BVeTNRS2dma1FiYnlMaE9pNnU1K0trVzkrY3hCMzBWbU4xdGxFd1puL25xdUwwZyttR00vbjN2WFhzZ1RwdVhRR1RHYjBXa0N4Wkg4MW1QQjhhUXZaa2tsUmNBaUR2V3VLYit5S0FGR0dMSURLdjQ2bFlGUjZGOGNZSkdDZ1JlL04rdmdoQXNxVWpJSU1lMlpPSnN2RnpBUEwydWI0S0lNWFZxZmdLTnpPMUZCNU1KYjBaaWtBZSsrVUExTGRrV2dFa2V6SlI1c2swODRtVjFnY1U4ZXZWbVlMMWtpeW1ZRDBQRE9TQS9MRXZPcWtEcVZnVkhsdEMrczY0L2VITHRwOUpSc2dLVXpEWklVTmtTUU5JeG95bm96SUZaNG1NbHlkbHF2bTBJdDR3ekFXRFhMZkZSYWxjeDZXdmhuQlNxZWVCRkxDMzIyWkI1TlpJNUoxdHYwR3RDbytLd2ExenY5NCsza0FkUHhuUkJRalpJVVA2YTFySkZobmp3N0RJSE5tVDhYS3ZUSlZQMUozcVhLbXFBV1RWWXIwYzE5Y0FwQ0FiQlVNcjI2K0tWZUhCU1RUUDZFQ0oxeGYyMHhaQVhRRXpxT25WME1aVEVUNVI3TWw0dVVHbXlxbVdPK09zcTZKMUs4WmFDZmNsUVRpV0RZTFIrMGRmc3ZLKzRYd0Q0Z3ZpalRPNUwwQVJxREZZMHkrWllSdlBDaURaMHN2eHlSelprd1VTSnBPa1dIZzlXSytLdGk1STRJZTBuUWNHYWtDQjJJK1ppcmVlM2FvZ1ZJVkhZNXJSUWdqRS92dlNQcXdBa2hrcmdHU0tBSkl4c2tibU1pUmMxRFpKeGdzYmczUE5yMU52Mnd2c3l3QVNnSTJDWVpYRDhNRW5IMkQ5bWZVSTJXd1dIbjBKamtDTXBTMkFMRUNzUGNBRkptTkdFM3E4QVI5L1RwWjdaYnI4dGVYN1FuanpNS3NXYXlYTVZnVG5nZHhKSUFZVHlIMXdUSnNGaisxNkRGK3YvcnBSd1FWeS8zMWxYNllmZVVKL3JnSW1VMnpCc0FJbWEyU3VaWnNzQ1RKVm1pOWJpRENVdHAwSDlrVVErMktoRlFpNHlRSk50MS9hbS85ZFdvQTBDNW03Wkpza0UxVnVaaG9tcWV4YXQ0MkMvR0F0RW5lbWQ5eFhYdnZpbUFLaERmMUdJeHRrcEwzK0g1a2lXOGI4YitJbDdLbGZKc3B0TWswdXFCREpacUgxT1RHNkg4Z1AxNm5ZRWF2dm5ZQmRoVlhEUnpiSWlMWC9wNThIMDlxQXZpQms3WE5iaG9USVZGblZrb1pac2JCeXNWNFhKdGw5UFFwMlZZU3I5ZTh1Ri8xMDhhR3JYN1pmalA3ZktpRnI3VzVUWktUTWtJL1V0MW0zVGNPTWdub3U2RVJCSi9ycEU2NXQ5Q01qWk1WNitZMHNjUVVNMlNKamw5MUk1alI1dGQwb3FDdGlobGRHUVY3clk4N1hjMEo5UU03cjFRR25Cby82NjZWWFpFTmYrMlhtYkJ2OXlOWmxvNSttY29vTWtSbHlUaEdyNTRLOGpLSXZ6ZWtGQ295Q09oSmFRZFFoMlhrMUp1WjkwUTlhYjc1cURuVGhZYjN5d1RxQ0RCblI3NXlRclE1dFV5VmRSVUYycmRrODFJMXBSa0dkaXJsRDdyeHRKT3lMRG5mR2RPbkpwQUdrOW1TQUxGaFRyMTU4U25iSWtESDNTKzhRZStwTkdSSWowNlM0cFNKbUQ2ZHRRYUpUc1FQaHBlTDBkVmpid3Flclh1dFZEN0pDWmxvclgxNTJpK2s0Z0h6bkZCa3FNK1cwNnQxd0VzbHdxbE94WHF4cUxVcWNTTmozUVd3UFBqS2c0ZU0wall6b3F4N3MrNUVoc3RTbGJabzhKSm55RjdXQ1FhZGkvUXhwNW5ydXVDMkVEb2g5RDBRcmVEcnRNdkpwK01nQzEveVJEVTdYeUFyYkxtU0hESFZybXk3UHFGVE1oWVRzRFhJSHZFTENIV29JcmVuWVNjbDlDMEFyZk5TV1prMjdHajR5UVRiSUNGbmhOZDlYNU9sdXNkZnl4ek5rYkljZzFJMXFEYUVURFhzdmpGYndyRkdQR3V0Mnl4ZkJSMlpzM2RxRGtDR1hlWjl6UWxiSFRNazh1UFpBdE1MSXdYR3lyZ2ZwdlBhc0w5cHFRYTIwNllobkJZOWFVM05xcjlPdU5mTFpEcDhtZWFaS3h4KzJ6QW01WUlHVFRwYmRiTkh3b0hSYTV2eUFCNjFoWk5qV2tWRy82a0U2cjYyQzk1UXZ0Q1lhT09xbDliUE85YWd4dGFibTFKNE02RG5mYlBsUXlJaGZ0NW55RTVrdHgxc2daTVhEc3B0ekFKNFJHa1FkRVhud09pcGFZZFJBY3NDTzlhd1BxSVUyRFIwMTArRHBpRWR0cVRHMXB1YlV2aFcrNDBJMkFySzlJcmRLcGhTcUppTjdQZXo1Y0FMS002SXRpSXlJVmhnMWtGWW85YUNkMTlhb0UwaGZVQXNObkJVNmFxY2puZ2FQR2xOcjNlZGpvNWtza0ltQWJsTmxnR1RLc3pKWDNsRlZEODhFbmhGdFFXUzFyS09paHBGQWFpZzViOVR0SEE3ZXNjRDRRUHVkcjFvUHZscWhvM1p0d2ROUmo1VXV0U2NEWktISHRsbHltOHlXNVRKWFBsU2RiMDVHTllnTTA1eWtNaXB5enNBQldZSGsyYVdOQTNjc2NEN1FmdGV2REJKYUgycEZ6YWdkTldSUW9hYlVsaG1QV2xOemFoODAyMnk1VytiSUtwa243N2RFUklacFRsSTVBQTJqRlVnT2xHZFlXOU9PY0Y1Ym9iRERGMjM5ek4rcGdSVTRLM1RVamhveXV6SGlVVnRxVEsyRGRzdVU0VEpIeHNzY2FaUnMrVmlkTVJ5QWpvdzhrNnhRY2s3UjF1Z0V4K3ozUVZzLzgzY2Q0YWdKdGRHUmpwb3gybEZEYWtsTnFXMnYyV1pKdk15UmU5V0J6NU1DbVNjbkpVditvZ2JGYThzY29EYkNhVFdlZFk3Wjd3T3JqL25mMnY5OHBTWUVMa3MrVmxwUk15T1EzQ3ZVc2xkdnZBRjVydHdnYytRZW1TT2paWTVreXh6WkpIT2xVdWJKRHNtU25aSWxUWTRGMUFjN2xlK3BBYlV3TktFMjl5cXRXbTRhOXk5NS94K1lGVDl3ZDBlaDhRQUFBQUJKUlU1RXJrSmdnZz09XCIvPlxuPC9kZWZzPlxuPC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIGZpbGw9XCJub25lXCIgaGVpZ2h0PVwiMTYwXCIgdmlld0JveD1cIjAgMCAxNjAgMTYwXCIgd2lkdGg9XCIxNjBcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgeG1sbnM6eGxpbms9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCI+XG4gIDxwYXR0ZXJuIGlkPVwiYVwiIGhlaWdodD1cIjFcIiBwYXR0ZXJuQ29udGVudFVuaXRzPVwib2JqZWN0Qm91bmRpbmdCb3hcIiB3aWR0aD1cIjFcIj5cbiAgICA8aW1hZ2UgaGVpZ2h0PVwiMTYwXCIgcHJlc2VydmVBc3BlY3RSYXRpbz1cIm5vbmVcIiB0cmFuc2Zvcm09XCJzY2FsZSguMDA2MjUpXCIgd2lkdGg9XCIxNjBcIiB4bGluazpocmVmPVwiZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFLQUFBQUNnQ0FZQUFBQ0x6MmN0QUFBTTlVbEVRVlI0QWUzZFM0L2IxaFVIOEROQW9vWGJqV1VnZ0ZjQnNrbFdRV2JWSWtCaUxRSWo0OGtnQ0pCdlVmZmgxZ3VqWGRRcHh1TytQMEs3NkJjbzhpMjZTR3AzMFhlYkFFVnJKM1ljdjhiMnpEaSt4Wi9EUDAzUlE1R1U3aVhQa2M0QXhCMVJGSG52T1Q5ZVhsSVNKWkx3YjM5ajQ1dGZ2ZmZlaFRDWlBKZHdNNzdxQkJGQXpwQTc1RERCNnRPdk1wdysvY3BYR3h0WEg1ODVFdzdlZnZ0eStpMzZGbUpHQURsRDdwQkQ1RExtdXBPdmF3LzROamMvT25qMTFYQnc4bVI0L01ZYjRXQno4MUx5RGZzR29rUUF1Y3B5ZHZKa1FBNlJTK1EweXNwVHJ3UVZQUUMrOWZXd1B4cUZmWkd3ZitKRU9KaE1IR0hxNEVkWVAvQWhWOGhabHJ2UktDQ1h5S2w2aEdWOEI4UUhnQ0xoWUR4MmhCR0FwRndGOFNGWEdUN216Z0xDV2ZqWUdFZVlrczlpNjY3RFYrUk9NOEkyK0lxR2VFKzRtSlFFcjI3Q1YrUk9JMExpMnkrUCtmS3VteFYvcG5TRUNSak50MHJpMjY4Y2RwL0pHWE9Lb1pXV01XRVozOTVvRlBaRVdrOW9zSitZekljbTFxdksrTHJrRHJrZUhPRWkrSXJHT3NKWWxqcXZoL2oyeHVQV25VYVJOM1EwUXlLTWdvKzlwU1BzakdmUkZ5eU1qN2tiQW1GVWZHeUlJMXpVVk92WFI4UEgzUFdKTUFtK3ZDRStKbXh0YU80RmlRK3huanFjRXRPOFpSOElxL2dlelZ2Wm10ZGw2L09lY0c1Y1RTOGtQb3o1a3VRdUpVTGcyOGRiTWV2cjRkRm9sRFVBalVneElVRDdrMG5ZOC9lT20weTFmaDZ4ekdLYTQwdVJ0MnlkdUJLQ3kzRXgzN2JyRTE4UkdFZllHbGZUZ3NUM0tEVStka2d4RVE2Q2p3MXhoRTIyR3AvdkhSOXpGd01oOGVHQ1krckRidEh6c1FGNTZZZmpSbU8xQ3hBZngzeDFNVTQyUHg4VHpuVTRKcjQreG55TkFmQ2VzQlpaM1JQRTE5dGh0OUp4RkRtZHB5Y0V2cjM4aE9QaGFCUWVpZ3crSVpCN2ZtSlM1MjFxUHZBaFZvaVpodHpCRURxeXpGVFRoMXFKNzlINmV0Q0NqMEYwaEZQT2pueWdEaDg3TDF3NWFVS29HWjhqUE5MYjFFeTErTm9nM052YXlnNjdHbnMrNG1QcFBlR1V1K3lCZW54SElkemFPdnlPU1hqenpkZkRtVE5YbnJ6Mm1yckRMdEZWUzBmNEZLRVpmQ1dFc0FaenNDY2ZIai8rd3c5UG5BaWZQUDk4Q1BsQ0Q3aXc1aElYVmxmOHhBVDRFSU9IV2s0NFpuaWhLUmlETlppRFBia284dlh2aWx6K3RVajRWR1FLSVY2a2VVTGdzd1NzNE50MkQwdjROT2VJZGNOUkRQaGdETlpnRHZiWWw2K2RGOWx4aEF5SDd0STZQbGdUa2JWcWxCMWhOU0lLSHk4clBvYTZRUGlKSDQ0WkV6V2xWWHl3aEtOclhjOVhEZkFVd2lmNU9IQlgrWGd3RzJ0Z01JNUIrUktPQ2RFbXRPM0JlS3g2WEk0ODBBcnNkTVZIakJuQ1g0bUVmNHVFTWtLc1hQT0VCQzBid2pJK3piRm4zWUFRWm1BSGh0cjJmTVRIMGhFeUVnT1dxNHFQSVRlTjBQb2xHdUJERzlDcnMzZlJYTWJxK1lpUFplMllVSE13c3JvWlBoeXo1OXMxaG0vZU1SK3gxWlZUUGVGWCtUand2a2pRUGlHQjFzYUVaWHphNDR2NllXZUhpVVhIZkhYNE9IL3QreUk3UERHeGh2Q0JrYk5qNEVOZHNlTll4QWNqUjExa0pxSkZTMGU0YUFSbnZON3h6UWhPNlNuVENMVWVqcTBmZGxQM2ZDVi8yYjhGd24vbHgzK01BeXdjTXU3alFxNnl3ekY3UHRUTlFndzU1a1B1TVNUckd4OHhUaUY4bkFPOEp4SzBUMFM0cStBZEU5UUJPd1RxcEQxdXFCOTJFT1I2YUh4VENIOHBFdjZaVnd3Vk5CRklYTjdBWUg5QWhOZzI2bUFOSDNLTm5BL1Y4eEVmeStJU0RmWUthejNoVUFpdDRtUFBOKy9iYTBRVHV6U05NTHZzMFdOUGFQMndxdzBmTVdjSUxSNk83K1VuSm4wY2pva1AyelF4Vk1tUGFqenNhc1ZYSU1TNGdBZ1A4dkhnWFpHZ2Zlb0RZUm1mOW5pZ2Z0aEJrRVBpMHpMbUk3YTZNanM3L29WSStFZmVBRFRFUk1BVDlvUlc4U0dIeUtVVmZFU1pJZlNlOERBY1Z2Rlo2L21JajZVakZKSGR6YzF0bk9UZ0VHL2lLR0Qwc0V0MDFkSTB3a1V2MFFBZjFtRU5IdzY3bXE3elZWRjFmVndnUk1Qd0N6em9DZTRZbU80dWNMR2ErTEFPRTIzTmMyTjF6TmVFTWtQSUU1TmxSMmdWMzkrTm5uQTA0ZVB6SzRIUThUSGRPc3VsUm1nVjM3SWVkdXQyQWRNSTc5ZDhnQUg0OEp5UCtlclNybXQrZ1JEakR2eHFEd2JxdHcxTWQvQ1pQWnpabHQ0N3ZyZXhrZUhEY3liYWtNZDgyY2Q4VGVRemhEOFhDUllSM2p0MUt1eSsvLzZQTWVGL2kvZ1FlMnZ2Y0RTaDZ2cThhWVM3Nzd3VE1EbStybW5YdGJ4ZGhNZU9oVHZIanBrNzdIclA5K3dPVUNEOG03RXhvYVV4SDJMcitKN0Z4emxUQ1BGakowanVsejR0RkFQRUVMRjBmR1EydTNTRUVYYzR4emNiVzkyempqQUNRc2RYeDZ2ZGZFZTRBRUxIMXc1WjAxSUZ3ci9tNHhnRTFzZUVzMk5BZklpWm4zQTBFV3QrZnUxN0lqcy9Fd2tJS0c3MUQ0QzNmRG95Qm9nTllvUllJV2FJWGNvYkJUV25iem1XY0lRdGRqakhseGE3STV5QjBQR2x4Y2UxTzhJakVEbys4dWluZElRbGhJNnZIM1RWclJRSS81TC9kZ2xPU3I1WXNRbHR4azNCRVFNLzRhZ1NTZjk0cFJFNnZ2VEEybXhoSlJFNnZqWTArbHRtcFJBNnZ2NWdkZG5TU2lCMGZGMUk5TDlzZ2ZEUCtlOVc0S1RrNWhLY21MQU51Qzh6MnZaVGY0ZWpmMTB0dDVnaFJJS3FDSkZFcXhOMkpNZlhVb0NDeFpZS29lTlRJR3FPS2t3aHhFM1RlVGkyMUF1aXpxaTdIM2JuRUtEZ0pXdmZFdG41UUNUOE1mL09zU1Y4cUN1K0o0MjZvdzFvaTMrcVJZR3FybFc0T0JyOTVQY2lUNUJRUzcwZzY0cTZvdzFkMiszTEs0bkF0Vk9uUHJqKzRvdFBQaGNKTjR4TnFEUHFqallvQ2FkWG8wc0VkcmUydG5mZmVpdmNmdUVGYy9pNHM2RHVhTVB1dSs5ZTZ0SjJYM2JnQ056ZTNOeitjaklKTjhkanMvaUlFRzFBVzI2WDdrVXpjSGg5ODdNaXNFejRIT0dzVEN0OER2aHVMMG5QUjN3czBST2liZDRUS29TSEtwVjdQb3NuSFlSV1Y2Sk5mamhXanUvR2VCeVFxR1dlMEVZZkV5cUN5SjV2RmZCeHgzS0VTZ0N1SWo1SHFBZ2ZCdVdyMVBNUkgwdTAzVTlNQmdESm5nK0RjaVpqVlVzL01la1pJUERkbWt6QzUrTngrRXpFSjV4MGpjY0JNZkZMTklreE9yNzZIYzRST3I3QmUyTkhtQWloOTN6MVBWOTFHT0lJSXlOMGZPM3hFYU1qaklUUThYWEg1d2dqNGJ1MXVibjlSWDYyZXgwZnp2U3Bjd3pRRXlLR3QveWpYTjFVRXQ5bjQzSG5vRHZVNlowVk1YU0VIZnc1dm1sQU1YWW9SOWdTb09PTGo0K0FIV0VEUW92NCtGVlBKbGw3NlFockVGckRoek5OZkhYeTAzekMvNWluSFNEcTV3Z3JDQzNpdzI5eFhNM3ZUSXE3aytKL3pIT0VsZVJxZjFqR2QwMGthSi9RZ3dEYW4wVENqa2c0SzNJUkUvN0hQRHlIWmJTM0EvVmIrWjdRS2o3MGRwZEV3bmNPYjVlUjdlUDRIL1BZRXhwRXVLMjlzNHBhUDh2NDBOdmwrTlpLUVZuRFBEem5DRXRSMGZqdkV1SmptQjBoSTZHMVhHSjhETGtqWkNTMGxTdUFqeUYzaEl5RWxuS0Y4REhranBDUkdMcTBpQTgvZ1ZVNTJ5MmZjTFFOYVlhUVo4ZFlwNThkdHcxZHBPV0k3OXA0SFA0bm9uN0M5VEhpMno2OHpyZm9uVW5Yem9yc1lGMEFqWFZqR3laaThmUlRORFl2MFFEZnpja2tYRGVHNzRwSWlJU1B1M0dCRU91MmhCQzVRdzZSU3piR1JHa1pIdzZaNkxVaTM1TTVRNGgxTzhMRWhCMWZiWUFkWVcxb0lqM2grQm9ENlFnYlF6VG5BbzZ2ZGVBY1lldFF0VnpROGJVTTFOUEZIT0hUV0N6Mm4rT2JPMzZPY083UTVTKzBpQTgvZTRvejBVUm51MTFET29VUWRiTnluWER3U3pRMzgrdDh1TWo4WHhIMUV5NytLc05Ick04Z1JGMHR4QlM1eDNWQ1dHQmplaW14d1J1VFNiQ0VEOS9id0crdlJiN0lIQ3ZlR1VMVURYVkVYUzBoaElYZUVGckV4NTVQS1Q0aUxoQmlpSUE2TzBLR0ppOGRYeVVnOFI4NndycVlPcjY2eUVTZjd3aXJJWFY4MVlna2Yrd0lHV0xIeDBqMFhqcEN4OWM3dXVvR1Z4ZWg0NnRhR096eDZpRjBmSU5ocTl2dzZpQjBmSFVHQnArLy9BZ2QzK0RJbWlxd3ZBZ2RYMVB1MVR5L1hBakQ2ZE5mMjkzYXVvU2ZlckwwM3E2UnQ5ZFNxVFdORU5aZ0R2Yms0NWRldXZEeHl5K0gveHcvbnQzZlR2dW5NTXFmYWxIKzNtNHFmRnl2U1lTNGh5S3N3UnpzeVk5RVhqOG5jdVczZUVJazRDZmp0U0owZkxSWGxLWVF3aGFNd1JyTXdWN1drck1pcjN4YjVLUGZLRWJvK0FwMDFYOU1JQ1ErR0lNMW1KdHF5QThVSTNSOFU2azY2b0ZxaEZWOHNIWlVJMFFqUXNkM1pLcU9tcWtTWVd0OGJKRW1oSTZQV1dsZHFrTFlHUiticVFHaDQyTTJPcGNxRU02Tmo4MGRFcUhqWXhibUxnZEZ1REErTm5zSWhJNlAwVis0SEFSaE5IeHNmcDhJSFIrakhxM3NGV0YwZkF4REh3Z2RINk1kdmV3RllUSjhERWRLaEk2UFVVNVdKa1dZSEIvRGtnS2g0Mk4wazVkSkVQYUdqK0dKaWREeE1hcTlsVkVSOW82UFlZcUIwUEV4bXIyWFVSQU9oby9oV2dTaDQyTVVCeXNYUWpnNFBvWnRIb1NPajlFYnZKd0xvUnA4REY4WGhJNlBVVk5UZGtLb0RoL0QyQWFoNDJPMDFKV3RFS3JGeDNET1F1ajRHQ1cxNVV5RTZ2RXhySFVJVi93TFJBeVA5bklLSVc2U2lhOW1tTUhINkZZUjN0VjlaMUpXMjh2RENCUUljYWRXNUE3ZjRlREg2SkZiRTRFaXd0K0poRCtJaE10cGZ2N0tSQ3dNVmpKRGlKd2hkOGdodnNOaEJoOERqZ3FmRjdsNjRmQWJVSmNqLy9ZYU4rTmxtZ2lzblJPNWpOd2hoK2J3TVNiblJiNXhUdVRDUlpIbk9NOUxHeEZBenBBNzVEQmxqZjhQTmhXUUQ4TnhsdGdBQUFBQVNVVk9SSzVDWUlJPVwiLz5cbiAgPC9wYXR0ZXJuPlxuICA8cGF0aCBkPVwibTAgMGgxNjB2MTYwaC0xNjB6XCIgZmlsbD1cInVybCgjYSlcIi8+XG48L3N2Zz5gO1xuXG4vLyBEYXRhIFVSTHNcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIERPV05MT0FEX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IFNVQ0NFU1NfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBTVUNDRVNTX0lDT05fU1ZHX1JBVyxcbil9YDtcblxuZXhwb3J0IGNvbnN0IEVSUk9SX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRVJST1JfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1NWR19SQVcgPSBgPHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIm5vbmVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgc3Ryb2tlPVwiI2ZmZmZmZlwiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPjxwYXRoIGQ9XCJNMTAuOTY4IDE4Ljc2OUMxNS40OTUgMTguMTA3IDE5IDE0LjQzNCAxOSA5LjkzOGE4LjQ5IDguNDkgMCAwIDAtLjIxNi0xLjkxMkMyMC43MTggOS4xNzggMjIgMTEuMTg4IDIyIDEzLjQ3NWE2LjEgNi4xIDAgMCAxLTEuMTEzIDMuNTA2Yy4wNi45NDkuMzk2IDEuNzgxIDEuMDEgMi40OTdhLjQzLjQzIDAgMCAxLS4zNi43MWMtMS4zNjctLjExMS0yLjQ4NS0uNDI2LTMuMzU0LS45NDVBNy40MzQgNy40MzQgMCAwIDEgMTUgMTkuOTVhNy4zNiA3LjM2IDAgMCAxLTQuMDMyLTEuMTgxelwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjxwYXRoIGQ9XCJNNy42MjUgMTYuNjU3Yy42LjE0MiAxLjIyOC4yMTggMS44NzUuMjE4IDQuMTQyIDAgNy41LTMuMTA2IDcuNS02LjkzOEMxNyA2LjEwNyAxMy42NDIgMyA5LjUgMyA1LjM1OCAzIDIgNi4xMDYgMiA5LjkzOGMwIDEuOTQ2Ljg2NiAzLjcwNSAyLjI2MiA0Ljk2NWE0LjQwNiA0LjQwNiAwIDAgMS0xLjA0NSAyLjI5LjQ2LjQ2IDAgMCAwIC4zODYuNzZjMS43LS4xMzggMy4wNDEtLjU3IDQuMDIyLTEuMjk2elwiIGZpbGw9XCIjZmZmZmZmXCI+PC9wYXRoPjwvZz48L3N2Zz5gO1xuXG4vLyAyLiBFZGl0ZWQ6IEEgbWluaW1hbCBwZW5jaWxcbmV4cG9ydCBjb25zdCBFRElUX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIj48ZyBpZD1cIlNWR1JlcG9fYmdDYXJyaWVyXCIgc3Ryb2tlLXdpZHRoPVwiMFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9fdHJhY2VyQ2FycmllclwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPjwvZz48ZyBpZD1cIlNWR1JlcG9faWNvbkNhcnJpZXJcIj4gPHBhdGggZD1cIk0xMiAzLjk5OTk3SDZDNC44OTU0MyAzLjk5OTk3IDQgNC44OTU0IDQgNS45OTk5N1YxOEM0IDE5LjEwNDUgNC44OTU0MyAyMCA2IDIwSDE4QzE5LjEwNDYgMjAgMjAgMTkuMTA0NSAyMCAxOFYxMk0xOC40MTQyIDguNDE0MTdMMTkuNSA3LjMyODQyQzIwLjI4MSA2LjU0NzM3IDIwLjI4MSA1LjI4MTA0IDE5LjUgNC41QzE4LjcxODkgMy43MTg5NSAxNy40NTI2IDMuNzE4OTUgMTYuNjcxNSA0LjUwMDAxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTIuMzc3OSAxNC40NTA1QzEyLjA5ODcgMTQuNzI5NyAxMS43NDMxIDE0LjkyMDEgMTEuMzU2IDE0Ljk5NzVMOC40MTQyMiAxNS41ODU4TDkuMDAyNTcgMTIuNjQ0MUM5LjA4MDAxIDEyLjI1NjkgOS4yNzAzMiAxMS45MDEzIDkuNTQ5NTEgMTEuNjIyMUwxNS41ODU4IDUuNTg1NzVNMTguNDE0MiA4LjQxNDE3TDE1LjU4NTggNS41ODU3NVwiIHN0cm9rZT1cIiNmZmZmZmZcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9wYXRoPiA8L2c+PC9zdmc+YDtcblxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIEVESVRfSUNPTl9TVkdfUkFXXG4pfWA7XG5leHBvcnQgY29uc3QgQ09NTUVOVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgQ09NTUVOVF9JQ09OX1NWR19SQVdcbil9YDsiLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHNcbmltcG9ydCB7IERPV05MT0FEX0lDT05fU1ZHX1VSTCB9IGZyb20gJy4vaWNvbnMnO1xuXG5jb25zdCBTVFlMRV9JRCA9ICdjcWQtc3R5bGUnO1xuY29uc3QgU1BJTk5FUl9TSVpFX1BYID0gMTY7XG5cbi8vIFNtb290aCwgc2xpZ2h0bHkgYm91bmN5IHRyYW5zaXRpb24gZm9yIHRoZSBcIkRyb3BcIiBmZWVsXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG5cbiAgICAgIC8qIFNwaW5uZXIgKExpZ2h0IHRoZW1lIGRlZmF1bHRzKSAqL1xuICAgICAgLS1jcWQtc3Bpbm5lci1ib3JkZXI6IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7IC8qIGRhcmstaXNoIHJpbmcgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItdG9wOiAjMGYxNzJhOyAgICAgICAgICAgICAgICAgICAvKiBzb2xpZCBkYXJrIHRpcCAqL1xuXG4gICAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAgICogQ09MT1IgUEFMRVRURSAmIFNIQURPV1MgKExpZ2h0IE1vZGUgLyBEZWZhdWx0KVxuICAgICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAgIFxuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIExpZ2h0OiAjMDA1REQ3ICovXG4gICAgICAtLWNxZC1jb2xvci1ub3JtYWw6ICMwMDVERDc7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsOiAwIDhweCAyMnB4IHJnYmEoMCwgOTMsIDIxNSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCA5MywgMjE1LCAwLjcwKTtcblxuICAgICAgLyogMi4gU3VjY2VzcyAtIExpZ2h0OiAjMDBBODJEICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDBBODJEO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMCwgMTY4LCA0NSwgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gTGlnaHQ6ICNGRjQwMzYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWVycm9yOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yOiAwIDEycHggMjhweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvci1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNzApO1xuXG4gICAgICAvKiA0LiBUcnlpbmcgLSBMaWdodDogI0VDNjMwMCAqL1xuICAgICAgLS1jcWQtY29sb3ItdHJ5aW5nOiAjRUM2MzAwO1xuICAgICAgLS1jcWQtc2hhZG93LXRyeWluZzogMCAxMnB4IDI4cHggcmdiYSgyMzYsIDk5LCAwLCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIzNiwgOTksIDAsIDAuNzApO1xuXG4gICAgICAvKiA1LiBDb21tZW50IEZyYW1lIC0gTGlnaHQ6ICM5QjAwRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLWNvbW1lbnQ6ICM5QjAwRkY7XG4gICAgICBcbiAgICAgIC8qIDYuIEVkaXRlZCBGcmFtZSAtIExpZ2h0OiAjMDA3RjhEICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMDdGOEQ7XG5cbiAgICAgIC8qIEJhc2UgU2hhZG93cyAqL1xuICAgICAgLS1jcWQtc2hhZG93LWJhc2U6IDAgMHB4IDEwcHggcmdiYSgxNSwgMjMsIDQyLCAwLjIyKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1ob3ZlcjogMCAxMHB4IDI0cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcblxuICAgICAgLyogNy4gQk9USCAoRWRpdGVkICsgQ29tbWVudHMpIC0gTGlnaHQgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjRkY0MDM2O1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgICAtLWNxZC1ib3RoLW92ZXJsYXktc2hhZG93OlxuICAgICAgICBpbnNldCAwIDAgMCAycHggI0ZGNDAzNixcbiAgICAgICAgMCAwIDEycHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBEQVJLIE1PREUgT1ZFUlJJREVTIChBcHBsaWVkIHZpYSAuY3FkLXRoZW1lLWRhcmsgY2xhc3MpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICAuY3FkLXRoZW1lLWRhcmsge1xuICAgICAgLyogMS4gTm9ybWFsIChQcmltYXJ5KSAtIERhcms6ICMwMDZFRkYgKi9cbiAgICAgIC0tY3FkLWNvbG9yLW5vcm1hbDogIzAwNkVGRjtcbiAgICAgIC0tY3FkLXNoYWRvdy1ub3JtYWw6IDAgOHB4IDIycHggcmdiYSgwLCAxMTAsIDI1NSwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctbm9ybWFsLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgwLCAxMTAsIDI1NSwgMC43MCk7XG5cbiAgICAgIC8qIDIuIFN1Y2Nlc3MgLSBEYXJrOiAjMDdEQTNGICovXG4gICAgICAtLWNxZC1jb2xvci1zdWNjZXNzOiAjMDdEQTNGO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmc6IDAgMTJweCAyOHB4IHJnYmEoNywgMjE4LCA2MywgMC43MCk7XG5cbiAgICAgIC8qIDMuIEVycm9yIC0gRGFyazogI0ZGNDAzNiAqL1xuICAgICAgLS1jcWQtY29sb3ItZXJyb3I6ICNGRjQwMzY7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3I6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCA2NCwgNTQsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LWVycm9yLXN0cm9uZzogMCAxMnB4IDI4cHggcmdiYSgyNTUsIDY0LCA1NCwgMC43MCk7XG5cbiAgICAgIC8qIDQuIFRyeWluZyAtIERhcms6ICNGRjkxNDIgKi9cbiAgICAgIC0tY3FkLWNvbG9yLXRyeWluZzogI0ZGOTE0MjtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmc6IDAgMTJweCAyOHB4IHJnYmEoMjU1LCAxNDUsIDY2LCAwLjQwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI1NSwgMTQ1LCA2NiwgMC43MCk7XG5cbiAgICAgIC8qIDUuIENvbW1lbnQgRnJhbWUgLSBEYXJrOiAjOUIwMEZGICovXG4gICAgICAtLWNxZC1jb2xvci1jb21tZW50OiAjOUIwMEZGO1xuXG4gICAgICAvKiA2LiBFZGl0ZWQgRnJhbWUgLSBEYXJrOiAjMDBENkVFICovXG4gICAgICAtLWNxZC1jb2xvci1lZGl0ZWQ6ICMwMEQ2RUU7XG5cbiAgICAgIC8qIDcuIEJPVEggKEVkaXRlZCArIENvbW1lbnRzKSAtIERhcmsgKi9cbiAgICAgIC0tY3FkLWJvdGgtYmc6ICNmZmZmZmY7XG4gICAgICAtLWNxZC1ib3RoLWZnOiAjMDAwMDAwO1xuICAgICAgLS1jcWQtYm90aC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjg1KTtcbiAgICAgIC0tY3FkLWJvdGgtb3ZlcmxheS1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjZmZmZmZmLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuODUpO1xuXG4gICAgICAvKiBTcGlubmVyIChEYXJrIHRoZW1lIG92ZXJyaWRlcykgKi9cbiAgICAgIC0tY3FkLXNwaW5uZXItYm9yZGVyOiByZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMjIpO1xuICAgICAgLS1jcWQtc3Bpbm5lci10b3A6ICNmZmZmZmY7XG4gICAgfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogQ1JJVElDQUwgT1ZFUlJJREVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgIG92ZXJmbG93OiB2aXNpYmxlICFpbXBvcnRhbnQ7XG4gICAgICBjb250YWluOiBub25lICFpbXBvcnRhbnQ7XG4gICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBET1dOTE9BRCBCVVRUT04gU1RZTEVTXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogNTAlO1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIHdpZHRoOiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiBjYWxjKDEwMCUgLSAxNnB4KTtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itbm9ybWFsKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1iYXNlKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3dyYXA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgd2lsbC1jaGFuZ2U6IHRyYW5zZm9ybSwgYm94LXNoYWRvdywgd2lkdGgsIGJvcmRlci1yYWRpdXMsIHBhZGRpbmctaW5saW5lO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgd2lkdGggdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBwYWRkaW5nLWlubGluZSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJvcmRlci1yYWRpdXMgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgdHJhbnNmb3JtIHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLyogU3RhdGVzICovXG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIge1xuICAgICAgd2lkdGg6IDEyMHB4O1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWhvdmVyKTtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46Zm9jdXMtdmlzaWJsZSB7XG4gICAgICBvdXRsaW5lOiAycHggc29saWQgI2ZmZmZmZjtcbiAgICAgIG91dGxpbmUtb2Zmc2V0OiAycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAvKiBJY29ucyAmIExhYmVscyAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0RPV05MT0FEX0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4gLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWFyZ2luLWxlZnQ6IDA7XG4gICAgICBtYXgtd2lkdGg6IDA7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1heC13aWR0aCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIG1hcmdpbi1sZWZ0IHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtdHJ5aW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7XG4gICAgfVxuXG4gICAgLyogUGlsbCBTdGF0ZXMgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtdHJ5aW5nLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbCk7XG4gICAgICBjdXJzb3I6IGRlZmF1bHQ7XG4gICAgICB3aWR0aDogMTUwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXRyeWluZyB7XG4gICAgICB3aWR0aDogMTEwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItdHJ5aW5nKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctdHJ5aW5nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LW5vcm1hbC1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmc6aG92ZXIge1xuICAgICAgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy10cnlpbmctc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC10cnlpbmcgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LXdpZHRoOiAxMTBweDtcbiAgICAgIG1hcmdpbi1sZWZ0OiAxMnB4O1xuICAgIH1cblxuICAgIC8qIFN1Y2Nlc3MgKi9cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3Itc3VjY2Vzcyk7XG4gICAgICBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyIHtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctc3VjY2Vzcy1zdHJvbmcpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC8qIEVycm9yICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiA5MHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVycm9yKTtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3IpO1xuICAgICAgaGVpZ2h0OiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiAxNTBweDtcbiAgICAgIG1heC1oZWlnaHQ6IDQwcHg7XG4gICAgICBwYWRkaW5nLXRvcDogMDtcbiAgICAgIHBhZGRpbmctYm90dG9tOiAwO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1lcnJvci1kZXRhaWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LXNpemU6IDExcHg7XG4gICAgICBmb250LXdlaWdodDogNTAwO1xuICAgICAgbGluZS1oZWlnaHQ6IDEuMztcbiAgICAgIG1hcmdpbjogMDtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdoaXRlLXNwYWNlOiBub3JtYWw7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoNHB4KTtcbiAgICAgIHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yOmhvdmVyIHtcbiAgICAgIHdpZHRoOiAzNTBweDtcbiAgICAgIG1heC13aWR0aDogMzYwcHg7XG4gICAgICBoZWlnaHQ6IDYwcHg7XG4gICAgICBtYXgtaGVpZ2h0OiA2MXB4O1xuICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMThweDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBnYXA6IDdweDtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgLmNxZC1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAwO1xuICAgICAgbWF4LXdpZHRoOiAwO1xuICAgICAgbWFyZ2luOiAwO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogNjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDRweDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICB9XG5cbiAgICAvKiBTcGlubmVyICovXG4gICAgLmNxZC1zcGlubmVyIHtcbiAgICAgIGJhY2tncm91bmQtaW1hZ2U6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7XG4gICAgICBoZWlnaHQ6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgYm9yZGVyOiAzcHggc29saWQgdmFyKC0tY3FkLXNwaW5uZXItYm9yZGVyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6IHZhcigtLWNxZC1zcGlubmVyLXRvcCk7XG4gICAgICBhbmltYXRpb246IGNxZC1zcGluIDAuNjVzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7XG4gICAgICBmcm9tIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH1cbiAgICAgIHRvICAgeyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMi4gQ09NTUVOVCBGUkFNRSAmIEJBREdFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwO1xuICAgICAgbGVmdDogMDtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7XG4gICAgICB6LWluZGV4OiAxMDtcbiAgICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICBib3JkZXItcmFkaXVzOiBpbmhlcml0O1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1jb21tZW50KSxcbiAgICAgICAgMCAwIDEycHggcmdiYSg5OSwgMTAyLCAyNDEsIDAuNSk7XG4gICAgfVxuICAgIFxuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDdweDtcbiAgICAgIHotaW5kZXg6IDk5OTk7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7XG4gICAgICB3aWR0aDogMzBweDtcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIGJhY2tncm91bmQtY29sb3I6IHZhcigtLWNxZC1jb2xvci1jb21tZW50KTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC5jcWQtY29tbWVudC1iYWRnZTpob3ZlciB7XG4gICAgICBoZWlnaHQ6IDUwcHg7XG4gICAgICBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgICAgcGFkZGluZy1ib3R0b206IDhweDtcbiAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwibHRyXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBsZWZ0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgIH1cblxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICByaWdodDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCg1MCUpO1xuICAgIH1cblxuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBtYXJnaW4tdG9wOiA0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBkaXNwbGF5OiBibG9jaztcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNXB4KTtcbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgb3BhY2l0eSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICB0cmFuc2Zvcm0gMC4xNXMgZWFzZSAwLjA1cztcbiAgICB9XG5cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIgLmNxZC1iYWRnZS1sYWJlbCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgICogMy4gRURJVEVEIEZSQU1FICYgUElMTFxuICAgICAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbiAgICBcbiAgICAuY3FkLW92ZXJsYXktY29udGFpbmVyLmNxZC1lZGl0ZWQge1xuICAgICAgYm94LXNoYWRvdzpcbiAgICAgICAgaW5zZXQgMCAwIDAgMnB4IHZhcigtLWNxZC1jb2xvci1lZGl0ZWQpLFxuICAgICAgICAwIDAgMTJweCByZ2JhKDAsIDIxNCwgMjM4LCAwLjMpO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogN3B4O1xuICAgICAgei1pbmRleDogOTk5OTtcbiAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIHdpZHRoOiAzMHB4O1xuICAgICAgaGVpZ2h0OiAzMHB4O1xuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLWVkaXRlZCk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBoZWlnaHQgdmFyKC0tY3FkLXRyYW5zaXRpb24pLFxuICAgICAgICBib3gtc2hhZG93IDAuMnMgZWFzZTtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuICAgIFxuICAgIGJvZHlbZGF0YS1jcWQtZGlyPVwicnRsXCJdIC5jcWQtZWRpdGVkLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1lZGl0ZWQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHtcbiAgICAgIGZsZXgtc2hyaW5rOiAwO1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDMwcHg7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjsgXG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWVkaXRlZC1pY29uIHN2ZyB7XG4gICAgICB3aWR0aDogMThweDtcbiAgICAgIGhlaWdodDogMThweDtcbiAgICAgIHN0cm9rZTogY3VycmVudENvbG9yO1xuICAgIH1cblxuICAgIC5jcWQtZWRpdGVkLWJhZGdlOmhvdmVyIHtcbiAgICAgIGhlaWdodDogNTBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICBwYWRkaW5nLWJvdHRvbTogOHB4O1xuICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIHdpZHRoOiAxMDAlO1xuICAgICAgb3BhY2l0eTogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtMTBweCk7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzO1xuICAgICAgZm9udC1mYW1pbHk6IHN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBmb250LXNpemU6IDEzcHg7XG4gICAgfVxuXG4gICAgLmNxZC1lZGl0ZWQtYmFkZ2U6aG92ZXIgLmNxZC1lZGl0ZWQtY29udGVudCB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRpZmYtdmFsIHtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIHNhbnMtc2VyaWY7XG4gICAgICBmb250LXdlaWdodDogNzAwO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiA0LiBCT1RIIFNUQVRFIChFZGl0ZWQgKyBDb21tZW50cyDihpIgT05FIHBpbGwpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLyogV2hlbiBhIHBvc3QgaGFzIGJvdGggZGF0YS1jcWQtcHJvY2Vzc2VkIGFuZCBkYXRhLWNxZC1lZGl0ZWQtcHJvY2Vzc2VkLFxuICAgICAgIGdpdmUgdGhlIGZyYW1lIGEgZGFya2VyIG91dGxpbmUvZ2xvdyBzbyBpdCBmZWVscyBzcGVjaWFsICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdW2RhdGEtY3FkLXByb2Nlc3NlZF1bZGF0YS1jcWQtZWRpdGVkLXByb2Nlc3NlZF0gPiAuY3FkLW92ZXJsYXktY29udGFpbmVyIHtcbiAgICAgIGJveC1zaGFkb3c6XG4gICAgICAgIGluc2V0IDAgMCAwIDJweCAjRkY0MDM2LFxuICAgICAgICAwIDAgMTJweCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2Uge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiA3cHg7XG4gICAgICB6LWluZGV4OiA5OTk5O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgd2lkdGg6IDMwcHg7XG4gICAgICBoZWlnaHQ6IDcwcHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkY0MDM2O1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBib3JkZXI6IDFweCBzb2xpZCByZ2JhKDI1NSwgNjQsIDU0LCAwLjcwKTtcbiAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICBwYWRkaW5nLXRvcDogOHB4O1xuICAgICAgdHJhbnNpdGlvbjpcbiAgICAgICAgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSxcbiAgICAgICAgYm94LXNoYWRvdyAwLjJzIGVhc2U7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJsdHJcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIGxlZnQ6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgfVxuXG4gICAgYm9keVtkYXRhLWNxZC1kaXI9XCJydGxcIl0gLmNxZC1ib3RoLWJhZGdlIHtcbiAgICAgIHJpZ2h0OiAwO1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXNlY3Rpb24ge1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICBhbGlnbi1pdGVtczogY2VudGVyO1xuICAgICAganVzdGlmeS1jb250ZW50OiBjZW50ZXI7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWljb24ge1xuICAgICAgd2lkdGg6IDIwcHg7XG4gICAgICBoZWlnaHQ6IDIwcHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgLyogbm8gZmlsdGVyIHNvIHRoZSBhc3NldCBzdGF5cyBjcmlzcCBpbiBhbGwgdGhlbWVzICovXG4gICAgfVxuXG4gICAgLyogRWRpdGVkIGljb24gKFNWRykgdXNlcyBjdXJyZW50Q29sb3IgKHdoaXRlKSAqL1xuICAgIC5jcWQtYm90aC1pY29uLWVkaXRlZCBzdmcge1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBzdHJva2U6IGN1cnJlbnRDb2xvcjtcbiAgICB9XG5cbiAgICAvKiBUaGUgXCIrXCIgYmV0d2VlbiBpY29ucyAoYWx3YXlzIHZpc2libGUpICovXG4gICAgLmNxZC1ib3RoLXBsdXMge1xuICAgICAgZm9udC1zaXplOiAxNHB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIGxpbmUtaGVpZ2h0OiAxO1xuICAgICAgbWFyZ2luOiA1cHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLXZhbHVlLFxuICAgIC5jcWQtYm90aC1kaXZpZGVyIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXgtaGVpZ2h0OiAwO1xuICAgICAgbWFyZ2luLXRvcDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1heC1oZWlnaHQgMC4xNXMgZWFzZSAwLjA1cyxcbiAgICAgICAgbWFyZ2luLXRvcCAwLjE1cyBlYXNlIDAuMDVzO1xuICAgIH1cblxuICAgIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxMXB4O1xuICAgICAgZm9udC13ZWlnaHQ6IDcwMDtcbiAgICAgIHRleHQtYWxpZ246IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiAxMjBweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgfVxuXG4gICAgLmNxZC1ib3RoLWJhZGdlOmhvdmVyIC5jcWQtYm90aC12YWx1ZSB7XG4gICAgICBvcGFjaXR5OiAxO1xuICAgICAgbWF4LWhlaWdodDogMjBweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWJvdGgtYmFkZ2U6aG92ZXIgLmNxZC1ib3RoLWRpdmlkZXIge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC1oZWlnaHQ6IDRweDtcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcbiAgICB9XG5cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9pMThuLnRzXG5cbi8qKlxuICogU0hBUkVEIERJQ1RJT05BUlkgLSA3NSBMQU5HVUFHRVNcbiAqIE5vdyBpbmNsdWRlcyB0aGUgJ2VkaXRlZCcga2V5d29yZCBmb3IgZGV0ZWN0aW9uLlxuICovXG5cbmNvbnN0IFRSQU5TTEFUSU9OUzogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgZW46IHsgZG93bmxvYWQ6ICdEb3dubG9hZCcsIGRvd25sb2FkaW5nOiAnRG93bmxvYWRpbmfigKYnLCB0cnlpbmc6ICdUcnlpbmfigKYnLCBkb3dubG9hZGVkOiAnRG93bmxvYWRlZCcsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdEb3dubG9hZCBmYWlsZWQuJywgYXJpYURvd25sb2FkOiAnRG93bmxvYWQnLCB0aXRsZVF1aWNrOiAnUXVpY2sgZG93bmxvYWQnLCBjb21tZW50czogJ2NvbW1lbnRzJywgZWRpdGVkOiAnRWRpdGVkJyB9LFxuICBhcjogeyBkb3dubG9hZDogJ9iq2YbYstmK2YQnLCBkb3dubG9hZGluZzogJ9is2KfYsdmKINin2YTYqtmG2LLZitmE4oCmJywgdHJ5aW5nOiAn2YXYrdin2YjZhNip4oCmJywgZG93bmxvYWRlZDogJ9iq2YUg2KfZhNiq2YbYstmK2YQnLCBlcnJvcjogJ9iu2LfYoycsIGZhaWxlZDogJ9mB2LTZhCDYp9mE2KrZhtiy2YrZhC4nLCBhcmlhRG93bmxvYWQ6ICfYqtmG2LLZitmEJywgdGl0bGVRdWljazogJ9iq2YbYstmK2YQg2LPYsdmK2LknLCBjb21tZW50czogJ9iq2LnZhNmK2YLYp9iqJywgZWRpdGVkOiAn2KrZhSDYp9mE2KrYudiv2YrZhCcgfSxcbiAgamE6IHsgZG93bmxvYWQ6ICfjg4Djgqbjg7Pjg63jg7zjg4knLCBkb3dubG9hZGluZzogJ0RM5Lit4oCmJywgdHJ5aW5nOiAn6Kmm6KGM5Lit4oCmJywgZG93bmxvYWRlZDogJ+WujOS6hicsIGVycm9yOiAn44Ko44Op44O8JywgZmFpbGVkOiAn5aSx5pWX44GX44G+44GX44Gf44CCJywgYXJpYURvd25sb2FkOiAn44OA44Km44Oz44Ot44O844OJJywgdGl0bGVRdWljazogJ+OCr+OCpOODg+OCr+ODgOOCpuODs+ODreODvOODiScsIGNvbW1lbnRzOiAn5Lu244Gu44Kz44Oh44Oz44OIJywgZWRpdGVkOiAn57eo6ZuG5riI44G/JyB9LFxuICBlczogeyBkb3dubG9hZDogJ0Rlc2NhcmdhcicsIGRvd25sb2FkaW5nOiAnRGVzY2FyZ2FuZG/igKYnLCB0cnlpbmc6ICdJbnRlbnRhbmRv4oCmJywgZG93bmxvYWRlZDogJ0Rlc2NhcmdhZG8nLCBlcnJvcjogJ0Vycm9yJywgZmFpbGVkOiAnRmFsbMOzIGxhIGRlc2NhcmdhLicsIGFyaWFEb3dubG9hZDogJ0Rlc2NhcmdhcicsIHRpdGxlUXVpY2s6ICdEZXNjYXJnYSByw6FwaWRhJywgY29tbWVudHM6ICdjb21lbnRhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gIGhpOiB7IGRvd25sb2FkOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgZG93bmxvYWRpbmc6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKHgpL/gpILgpJfigKYnLCB0cnlpbmc6ICfgpJXgpYvgpLbgpL/gpLYg4KSc4KS+4KSw4KWA4oCmJywgZG93bmxvYWRlZDogJ+CkquClguCksOCljeCkoycsIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JywgZmFpbGVkOiAn4KS14KS/4KSr4KSyIOCksOCkueCkvicsIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIHRpdGxlUXVpY2s6ICfgpKTgpY3gpLXgpLDgpL/gpKQg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpL/gpK/gpL7gpIEnLCBlZGl0ZWQ6ICfgpLjgpILgpKrgpL7gpKbgpL/gpKQnIH0sXG4gIHB0OiB7IGRvd25sb2FkOiAnQmFpeGFyJywgZG93bmxvYWRpbmc6ICdCYWl4YW5kb+KApicsIHRyeWluZzogJ1RlbnRhbmRv4oCmJywgZG93bmxvYWRlZDogJ0JhaXhhZG8nLCBlcnJvcjogJ0Vycm8nLCBmYWlsZWQ6ICdGYWxoYSBhbyBiYWl4YXIuJywgYXJpYURvd25sb2FkOiAnQmFpeGFyJywgdGl0bGVRdWljazogJ0Rvd25sb2FkIHLDoXBpZG8nLCBjb21tZW50czogJ2NvbWVudMOhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gICdwdC1wdCc6IHsgZG93bmxvYWQ6ICdEZXNjYXJyZWdhcicsIGRvd25sb2FkaW5nOiAnQSBkZXNjYXJyZWdhcuKApicsIHRyeWluZzogJ0EgdGVudGFy4oCmJywgZG93bmxvYWRlZDogJ0Rlc2NhcnJlZ2FkbycsIGVycm9yOiAnRXJybycsIGZhaWxlZDogJ0ZhbGhhIGFvIGRlc2NhcnJlZ2FyLicsIGFyaWFEb3dubG9hZDogJ0Rlc2NhcnJlZ2FyJywgdGl0bGVRdWljazogJ0Rlc2NhcmdhIHLDoXBpZGEnLCBjb21tZW50czogJ2NvbWVudMOhcmlvcycsIGVkaXRlZDogJ0VkaXRhZG8nIH0sXG4gICd6aC1jbic6IHsgZG93bmxvYWQ6ICfkuIvovb0nLCBkb3dubG9hZGluZzogJ+S4i+i9veS4reKApicsIHRyeWluZzogJ+WwneivleS4reKApicsIGRvd25sb2FkZWQ6ICflt7LkuIvovb0nLCBlcnJvcjogJ+mUmeivrycsIGZhaWxlZDogJ+S4i+i9veWksei0pScsIGFyaWFEb3dubG9hZDogJ+S4i+i9vScsIHRpdGxlUXVpY2s6ICflv6vpgJ/kuIvovb0nLCBjb21tZW50czogJ+adoeivhOiuuicsIGVkaXRlZDogJ+W3sue8lui+kScgfSxcbiAgJ3poLXR3JzogeyBkb3dubG9hZDogJ+S4i+i8iScsIGRvd25sb2FkaW5nOiAn5LiL6LyJ5Lit4oCmJywgdHJ5aW5nOiAn5ZiX6Kmm5Lit4oCmJywgZG93bmxvYWRlZDogJ+W3suS4i+i8iScsIGVycm9yOiAn6Yyv6KqkJywgZmFpbGVkOiAn5LiL6LyJ5aSx5pWXJywgYXJpYURvd25sb2FkOiAn5LiL6LyJJywgdGl0bGVRdWljazogJ+W/q+mAn+S4i+i8iScsIGNvbW1lbnRzOiAn5YmH55WZ6KiAJywgZWRpdGVkOiAn5bey57eo6LyvJyB9LFxuICBmcjogeyBkb3dubG9hZDogJ1TDqWzDqWNoYXJnZXInLCBkb3dubG9hZGluZzogJ1TDqWzDqWNoYXJnZW1lbnTigKYnLCB0cnlpbmc6ICdFc3NhaeKApicsIGRvd25sb2FkZWQ6ICdUw6lsw6ljaGFyZ8OpJywgZXJyb3I6ICdFcnJldXInLCBmYWlsZWQ6ICfDiWNoZWMuJywgYXJpYURvd25sb2FkOiAnVMOpbMOpY2hhcmdlcicsIHRpdGxlUXVpY2s6ICdUw6lsw6ljaGFyZ2VtZW50IHJhcGlkZScsIGNvbW1lbnRzOiAnY29tbWVudGFpcmVzJywgZWRpdGVkOiAnTW9kaWZpw6knIH0sXG4gIGRlOiB7IGRvd25sb2FkOiAnSGVydW50ZXJsYWRlbicsIGRvd25sb2FkaW5nOiAnTGFkZW7igKYnLCB0cnlpbmc6ICdWZXJzdWNoZW7igKYnLCBkb3dubG9hZGVkOiAnRmVydGlnJywgZXJyb3I6ICdGZWhsZXInLCBmYWlsZWQ6ICdGZWhsZ2VzY2hsYWdlbi4nLCBhcmlhRG93bmxvYWQ6ICdIZXJ1bnRlcmxhZGVuJywgdGl0bGVRdWljazogJ1NjaG5lbGxlciBEb3dubG9hZCcsIGNvbW1lbnRzOiAnS29tbWVudGFyZScsIGVkaXRlZDogJ0JlYXJiZWl0ZXQnIH0sXG4gIGl0OiB7IGRvd25sb2FkOiAnU2NhcmljYScsIGRvd25sb2FkaW5nOiAnU2NhcmljYW1lbnRv4oCmJywgdHJ5aW5nOiAnUHJvdmFuZG/igKYnLCBkb3dubG9hZGVkOiAnU2NhcmljYXRvJywgZXJyb3I6ICdFcnJvcmUnLCBmYWlsZWQ6ICdGYWxsaXRvLicsIGFyaWFEb3dubG9hZDogJ1NjYXJpY2EnLCB0aXRsZVF1aWNrOiAnRG93bmxvYWQgcmFwaWRvJywgY29tbWVudHM6ICdjb21tZW50aScsIGVkaXRlZDogJ01vZGlmaWNhdG8nIH0sXG4gIHJ1OiB7IGRvd25sb2FkOiAn0KHQutCw0YfQsNGC0YwnLCBkb3dubG9hZGluZzogJ9Ch0LrQsNGH0LjQstCw0L3QuNC14oCmJywgdHJ5aW5nOiAn0J/QvtC/0YvRgtC60LDigKYnLCBkb3dubG9hZGVkOiAn0KHQutCw0YfQsNC90L4nLCBlcnJvcjogJ9Ce0YjQuNCx0LrQsCcsIGZhaWxlZDogJ9Ch0LHQvtC5LicsIGFyaWFEb3dubG9hZDogJ9Ch0LrQsNGH0LDRgtGMJywgdGl0bGVRdWljazogJ9CR0YvRgdGC0YDQvtC1INGB0LrQsNGH0LjQstCw0L3QuNC1JywgY29tbWVudHM6ICfQutC+0LzQvNC10L3RgtCw0YDQuNC10LInLCBlZGl0ZWQ6ICfQmNC30LzQtdC90LXQvdC+JyB9LFxuICBrbzogeyBkb3dubG9hZDogJ+uLpOyatOuhnOuTnCcsIGRvd25sb2FkaW5nOiAn64uk7Jq066Gc65OcIOykkeKApicsIHRyeWluZzogJ+yLnOuPhCDspJHigKYnLCBkb3dubG9hZGVkOiAn7JmE66OMJywgZXJyb3I6ICfsmKTrpZgnLCBmYWlsZWQ6ICfsi6TtjKjtlagnLCBhcmlhRG93bmxvYWQ6ICfri6TsmrTroZzrk5wnLCB0aXRsZVF1aWNrOiAn67mg66W4IOuLpOyatOuhnOuTnCcsIGNvbW1lbnRzOiAn6rCcIOuMk+q4gCcsIGVkaXRlZDogJ+yImOygleuQqCcgfSxcbiAgdHI6IHsgZG93bmxvYWQ6ICfEsG5kaXInLCBkb3dubG9hZGluZzogJ8SwbmRpcmlsaXlvcuKApicsIHRyeWluZzogJ0RlbmVuaXlvcuKApicsIGRvd25sb2FkZWQ6ICfEsG5kaXJpbGRpJywgZXJyb3I6ICdIYXRhJywgZmFpbGVkOiAnQmHFn2FyxLFzxLF6LicsIGFyaWFEb3dubG9hZDogJ8SwbmRpcicsIHRpdGxlUXVpY2s6ICdIxLF6bMSxIGluZGlyJywgY29tbWVudHM6ICd5b3J1bScsIGVkaXRlZDogJ0TDvHplbmxlbmRpJyB9LFxuICB2aTogeyBkb3dubG9hZDogJ1ThuqNpIHh14buRbmcnLCBkb3dubG9hZGluZzogJ8SQYW5nIHThuqNp4oCmJywgdHJ5aW5nOiAnxJBhbmcgdGjhu63igKYnLCBkb3dubG9hZGVkOiAnxJDDoyB04bqjaScsIGVycm9yOiAnTOG7l2knLCBmYWlsZWQ6ICdUaOG6pXQgYuG6oWkuJywgYXJpYURvd25sb2FkOiAnVOG6o2kgeHXhu5FuZycsIHRpdGxlUXVpY2s6ICdU4bqjaSB4deG7kW5nIG5oYW5oJywgY29tbWVudHM6ICduaOG6rW4geMOpdCcsIGVkaXRlZDogJ8SQw6MgY2jhu4luaCBz4butYScgfSxcbiAgaWQ6IHsgZG93bmxvYWQ6ICdEb3dubG9hZCcsIGRvd25sb2FkaW5nOiAnTWVuZ3VuZHVo4oCmJywgdHJ5aW5nOiAnTWVuY29iYeKApicsIGRvd25sb2FkZWQ6ICdTZWxlc2FpJywgZXJyb3I6ICdLZXNhbGFoYW4nLCBmYWlsZWQ6ICdHYWdhbC4nLCBhcmlhRG93bmxvYWQ6ICdEb3dubG9hZCcsIHRpdGxlUXVpY2s6ICdEb3dubG9hZCBjZXBhdCcsIGNvbW1lbnRzOiAna29tZW50YXInLCBlZGl0ZWQ6ICdEaWVkaXQnIH0sXG4gIHRoOiB7IGRvd25sb2FkOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiUJywgZG93bmxvYWRpbmc6ICfguIHguLPguKXguLHguIfguYLguKvguKXguJTigKYnLCB0cnlpbmc6ICfguJ7guKLguLLguKLguLLguKHigKYnLCBkb3dubG9hZGVkOiAn4LmA4Liq4Lij4LmH4LiI4Liq4Li04LmJ4LiZJywgZXJyb3I6ICfguILguYnguK3guJzguLTguJTguJ7guKXguLLguJQnLCBmYWlsZWQ6ICfguKXguYnguKHguYDguKvguKXguKcnLCBhcmlhRG93bmxvYWQ6ICfguJTguLLguKfguJnguYzguYLguKvguKXguJQnLCB0aXRsZVF1aWNrOiAn4LiU4Liy4Lin4LiZ4LmM4LmC4Lir4Lil4LiU4LiU4LmI4Lin4LiZJywgY29tbWVudHM6ICfguITguKfguLLguKHguITguLTguJTguYDguKvguYfguJknLCBlZGl0ZWQ6ICfguYHguIHguYnguYTguILguYHguKXguYnguKcnIH0sXG4gIHBsOiB7IGRvd25sb2FkOiAnUG9iaWVyeicsIGRvd25sb2FkaW5nOiAnUG9iaWVyYW5pZeKApicsIHRyeWluZzogJ1Byw7NiYeKApicsIGRvd25sb2FkZWQ6ICdQb2JyYW5vJywgZXJyb3I6ICdCxYLEhWQnLCBmYWlsZWQ6ICdOaWV1ZGFuZS4nLCBhcmlhRG93bmxvYWQ6ICdQb2JpZXJ6JywgdGl0bGVRdWljazogJ1N6eWJraWUgcG9iaWVyYW5pZScsIGNvbW1lbnRzOiAna29tZW50YXJ6ZScsIGVkaXRlZDogJ0VkeXRvd2FubycgfSxcbiAgbmw6IHsgZG93bmxvYWQ6ICdEb3dubG9hZGVuJywgZG93bmxvYWRpbmc6ICdEb3dubG9hZGVu4oCmJywgdHJ5aW5nOiAnUHJvYmVyZW7igKYnLCBkb3dubG9hZGVkOiAnS2xhYXInLCBlcnJvcjogJ0ZvdXQnLCBmYWlsZWQ6ICdNaXNsdWt0LicsIGFyaWFEb3dubG9hZDogJ0Rvd25sb2FkZW4nLCB0aXRsZVF1aWNrOiAnU25lbCBkb3dubG9hZGVuJywgY29tbWVudHM6ICdyZWFjdGllcycsIGVkaXRlZDogJ0Jld2Vya3QnIH0sXG4gIGJuOiB7IGRvd25sb2FkOiAn4Kah4Ka+4KaJ4Kao4Kay4KeL4KahJywgZG93bmxvYWRpbmc6ICfgpqHgpr7gpongpqjgprLgp4vgpqEg4Ka54Kaa4KeN4Kab4KeH4oCmJywgdHJ5aW5nOiAn4Kaa4KeH4Ka34KeN4Kaf4Ka+IOCmleCmsOCmm+Cnh+KApicsIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgpqjgp43gpqgnLCBlcnJvcjogJ+CmpOCnjeCmsOCngeCmn+CmvycsIGZhaWxlZDogJ+CmrOCnjeCmr+CmsOCnjeCmpSDgprngpq/gprzgp4fgppvgp4cnLCBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgprLgp4vgpqEnLCB0aXRsZVF1aWNrOiAn4Kam4KeN4Kaw4KeB4KakIOCmoeCmvuCmieCmqOCmsuCni+CmoScsIGNvbW1lbnRzOiAn4Kaf4Ka/IOCmruCmqOCnjeCmpOCmrOCnjeCmrycsIGVkaXRlZDogJ+CmuOCmruCnjeCmquCmvuCmpuCmv+CmpCcgfSxcbiAgcGE6IHsgZG93bmxvYWQ6ICfgqKHgqL7gqIngqKjgqLLgqYvgqKEnLCBkb3dubG9hZGluZzogJ+CooeCovuCoieCoqOCosuCpi+CooSDgqLngqYsg4Kiw4Ki/4Ki54Ki+4oCmJywgdHJ5aW5nOiAn4KiV4KmL4Ki44Ki84Ki/4Ki44Ki8IOConOCovuCosOCpgOKApicsIGRvd25sb2FkZWQ6ICfgqK7gqYHgqJXgqbDgqK7gqLInLCBlcnJvcjogJ+Col+CosuCopOCpgCcsIGZhaWxlZDogJ+CoheCouOCoq+CosicsIGFyaWFEb3dubG9hZDogJ+CooeCovuCoieCoqOCosuCpi+CooScsIHRpdGxlUXVpY2s6ICfgqKTgqYfgqJzgqLwg4Kih4Ki+4KiJ4Kio4Kiy4KmL4KihJywgY29tbWVudHM6ICfgqJ/gqL/gqbHgqKrgqKPgqYDgqIbgqIInLCBlZGl0ZWQ6ICfgqLjgqbDgqKrgqL7gqKbgqL/gqKQnIH0sXG4gIHRlOiB7IGRvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJywgZG93bmxvYWRpbmc6ICfgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0g4LCF4LC14LGB4LCk4LGL4LCC4LCm4LC/4oCmJywgdHJ5aW5nOiAn4LCq4LGN4LCw4LCv4LCk4LGN4LCo4LC/4LC44LGN4LCk4LGL4LCC4LCm4LC/4oCmJywgZG93bmxvYWRlZDogJ+CwquCxguCwsOCxjeCwpOCwr+Cwv+CwguCwpuCwvycsIGVycm9yOiAn4LCy4LGL4LCq4LCCJywgZmFpbGVkOiAn4LC14LC/4LCr4LCy4LCu4LGI4LCC4LCm4LC/JywgYXJpYURvd25sb2FkOiAn4LCh4LGM4LCo4LGN4oCM4LCy4LGL4LCh4LGNJywgdGl0bGVRdWljazogJ+CwpOCxjeCwteCwsOCwv+CwpCDgsKHgsYzgsKjgsY3igIzgsLLgsYvgsKHgsY0nLCBjb21tZW50czogJ+CwteCxjeCwr+CwvuCwluCxjeCwr+CwsuCxgScsIGVkaXRlZDogJ+CwuOCwteCwsOCwv+CwguCwmuCwrOCwoeCwv+CwguCwpuCwvycgfSxcbiAgbXI6IHsgZG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCBkb3dubG9hZGluZzogJ+CkoeCkvuCkieCkqOCksuCli+CkoSDgpLngpYvgpKQg4KSG4KS54KWH4oCmJywgdHJ5aW5nOiAn4KSq4KWN4KSw4KSv4KSk4KWN4KSoIOCkleCksOCkpCDgpIbgpLngpYfigKYnLCBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KWN4KSjJywgZXJyb3I6ICfgpKTgpY3gpLDgpYHgpJ/gpYAnLCBmYWlsZWQ6ICfgpIXgpK/gpLbgpLjgpY3gpLXgpYAnLCBhcmlhRG93bmxvYWQ6ICfgpKHgpL7gpIngpKjgpLLgpYvgpKEnLCB0aXRsZVF1aWNrOiAn4KSk4KWN4KS14KSw4KS/4KSkIOCkoeCkvuCkieCkqOCksuCli+CkoScsIGNvbW1lbnRzOiAn4KSf4KS/4KSq4KWN4KSq4KSj4KWN4KSv4KS+JywgZWRpdGVkOiAn4KS44KSC4KSq4KS+4KSm4KS/4KSkJyB9LFxuICB0YTogeyBkb3dubG9hZDogJ+CuquCupOCuv+CuteCuv+CuseCuleCvjeCuleCvgScsIGRvd25sb2FkaW5nOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+B4K6V4K6/4K6x4K6k4K+B4oCmJywgdHJ5aW5nOiAn4K6u4K+B4K6v4K6x4K+N4K6a4K6/4K6V4K+N4K6V4K6/4K6x4K6k4K+B4oCmJywgZG93bmxvYWRlZDogJ+CuruCvgeCun+Cuv+CuqOCvjeCupOCupOCvgScsIGVycm9yOiAn4K6q4K6/4K604K+IJywgZmFpbGVkOiAn4K6k4K+L4K6y4K+N4K614K6/JywgYXJpYURvd25sb2FkOiAn4K6q4K6k4K6/4K614K6/4K6x4K6V4K+N4K6V4K+BJywgdGl0bGVRdWljazogJ+CuteCuv+CusOCviOCuteCvgSDgrqrgrqTgrr/grrXgrr/grrHgrpXgr43grpXgrq7gr40nLCBjb21tZW50czogJ+CuleCusOCvgeCupOCvjeCupOCvgeCuleCus+CvjScsIGVkaXRlZDogJ+CupOCuv+CusOCvgeCupOCvjeCupOCuquCvjeCuquCun+CvjeCun+CupOCvgScgfSxcbiAgdXI6IHsgZG93bmxvYWQ6ICfaiNin2KTZhiDZhNmI2ognLCBkb3dubG9hZGluZzogJ9qI2KfYpNmGINmE2YjaiCDbgdmIINix24HYpyDbgduS4oCmJywgdHJ5aW5nOiAn2qnZiNi02LQg2KzYp9ix24zigKYnLCBkb3dubG9hZGVkOiAn2YXaqdmF2YQnLCBlcnJvcjogJ9i62YTYt9uMJywgZmFpbGVkOiAn2YbYp9qp2KfZhScsIGFyaWFEb3dubG9hZDogJ9qI2KfYpNmGINmE2YjaiCcsIHRpdGxlUXVpY2s6ICfZgdmI2LHbjCDaiNin2KTZhiDZhNmI2ognLCBjb21tZW50czogJ9iq2KjYtdix25InLCBlZGl0ZWQ6ICfYqtix2YXbjNmFINi02K/bgScgfSxcbiAgZ3U6IHsgZG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLCBkb3dubG9hZGluZzogJ+CqoeCqvuCqieCqqOCqsuCri+CqoSDgqqXgqogg4Kqw4Kq54KuN4Kqv4KuB4KqCIOCqm+Crh+KApicsIHRyeWluZzogJ+CqquCrjeCqsOCqr+CqvuCquCDgqprgqr7gqrLgq4HigKYnLCBkb3dubG9hZGVkOiAn4Kqq4KuC4Kqw4KuN4KqjJywgZXJyb3I6ICfgqq3gq4LgqrInLCBmYWlsZWQ6ICfgqqjgqr/gqrfgq43gqqvgqrMnLCBhcmlhRG93bmxvYWQ6ICfgqqHgqr7gqongqqjgqrLgq4vgqqEnLCB0aXRsZVF1aWNrOiAn4Kqd4Kqh4Kqq4KuAIOCqoeCqvuCqieCqqOCqsuCri+CqoScsIGNvbW1lbnRzOiAn4Kqf4Kq/4Kqq4KuN4Kqq4Kqj4KuA4KqTJywgZWRpdGVkOiAn4Kq44KqC4Kqq4Kq+4Kqm4Kq/4KqkJyB9LFxuICBrbjogeyBkb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsIGRvd25sb2FkaW5nOiAn4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONIOCyhuCyl+CzgeCypOCzjeCypOCyv+CypuCzhuKApicsIHRyeWluZzogJ+CyquCzjeCysOCyr+CypOCzjeCyqOCyv+CyuOCzgeCypOCzjeCypOCyv+CypuCzhuKApicsIGRvd25sb2FkZWQ6ICfgsqrgs4LgsrDgs43gsqPgspfgs4rgsoLgsqHgsr/gsqbgs4YnLCBlcnJvcjogJ+CypuCzi+CytycsIGZhaWxlZDogJ+CyteCyv+Cyq+CysuCyteCyvuCyl+Cyv+CypuCzhicsIGFyaWFEb3dubG9hZDogJ+CyoeCzjOCyqOCzjeKAjOCysuCzi+CyoeCzjScsIHRpdGxlUXVpY2s6ICfgsqTgs43gsrXgsrDgsr/gsqQg4LKh4LOM4LKo4LON4oCM4LKy4LOL4LKh4LONJywgY29tbWVudHM6ICfgspXgsr7gsq7gs4bgsoLgsp/gs43igIzgspfgsrPgs4EnLCBlZGl0ZWQ6ICfgsrjgsoLgsqrgsr7gsqbgsr/gsrjgsrLgsr7gspfgsr/gsqbgs4YnIH0sXG4gIG1sOiB7IGRvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJywgZG93bmxvYWRpbmc6ICfgtKHgtZfgtbrgtLLgtYvgtKHgtY0g4LSa4LWG4LSv4LWN4LSv4LWB4LSo4LWN4LSo4LWB4oCmJywgdHJ5aW5nOiAn4LS24LWN4LSw4LSu4LS/4LSV4LWN4LSV4LWB4LSo4LWN4LSo4LWB4oCmJywgZG93bmxvYWRlZDogJ+C0quC1guC1vOC0pOC1jeC0pOC0v+C0r+C0vuC0r+C0vycsIGVycm9yOiAn4LSq4LS/4LS24LSV4LWNJywgZmFpbGVkOiAn4LSq4LSw4LS+4LSc4LSv4LSq4LWN4LSq4LWG4LSf4LWN4LSf4LWBJywgYXJpYURvd25sb2FkOiAn4LSh4LWX4LW64LSy4LWL4LSh4LWNJywgdGl0bGVRdWljazogJ+C0teC1h+C0l+C0pOC1jeC0pOC0v+C1vSDgtKHgtZfgtbrgtLLgtYvgtKHgtY0nLCBjb21tZW50czogJ+C0heC0reC0v+C0quC1jeC0sOC0vuC0r+C0meC1jeC0meC1vicsIGVkaXRlZDogJ+C0juC0oeC0v+C0seC1jeC0seC1geC0muC1huC0r+C1jeC0pOC1gScgfSxcbiAgdWs6IHsgZG93bmxvYWQ6ICfQl9Cw0LLQsNC90YLQsNC20LjRgtC4JywgZG93bmxvYWRpbmc6ICfQl9Cw0LLQsNC90YLQsNC20LXQvdC90Y/igKYnLCB0cnlpbmc6ICfQodC/0YDQvtCx0LDigKYnLCBkb3dubG9hZGVkOiAn0JPQvtGC0L7QstC+JywgZXJyb3I6ICfQn9C+0LzQuNC70LrQsCcsIGZhaWxlZDogJ9Cd0LXQstC00LDRh9CwLicsIGFyaWFEb3dubG9hZDogJ9CX0LDQstCw0L3RgtCw0LbQuNGC0LgnLCB0aXRsZVF1aWNrOiAn0KjQstC40LTQutC1INC30LDQstCw0L3RgtCw0LbQtdC90L3RjycsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNGW0LInLCBlZGl0ZWQ6ICfQl9C80ZbQvdC10L3QvicgfSxcbiAgZWw6IHsgZG93bmxvYWQ6ICfOm86uz4jOtycsIGRvd25sb2FkaW5nOiAnzpvOrs+IzrfigKYnLCB0cnlpbmc6ICfOoM+Bzr/Pg8+AzqzOuM61zrnOseKApicsIGRvd25sb2FkZWQ6ICfOn867zr/Ous67zrfPgc+OzrjOt866zrUnLCBlcnJvcjogJ86jz4bOrM67zrzOsScsIGZhaWxlZDogJ86Rz4DOrc+Ez4XPh861LicsIGFyaWFEb3dubG9hZDogJ86bzq7PiM63JywgdGl0bGVRdWljazogJ86Tz4HOrs6zzr/Pgc63IM67zq7PiM63JywgY29tbWVudHM6ICfPg8+Hz4zOu865zrEnLCBlZGl0ZWQ6ICfOlc+AzrXOvs61z4HOs86xz4POvM6tzr3OvycgfSxcbiAgY3M6IHsgZG93bmxvYWQ6ICdTdMOhaG5vdXQnLCBkb3dubG9hZGluZzogJ1N0YWhvdsOhbsOt4oCmJywgdHJ5aW5nOiAnWmtvdcWhw61t4oCmJywgZG93bmxvYWRlZDogJ1N0YcW+ZW5vJywgZXJyb3I6ICdDaHliYScsIGZhaWxlZDogJ1NlbGhhbG8uJywgYXJpYURvd25sb2FkOiAnU3TDoWhub3V0JywgdGl0bGVRdWljazogJ1J5Y2hsw6kgc3Rhxb5lbsOtJywgY29tbWVudHM6ICdrb21lbnTDocWZxa8nLCBlZGl0ZWQ6ICdVcHJhdmVubycgfSxcbiAgcm86IHsgZG93bmxvYWQ6ICdEZXNjxINyY2HIm2knLCBkb3dubG9hZGluZzogJ1NlIGRlc2NhcmPEg+KApicsIHRyeWluZzogJ1NlIMOubmNlYXJjxIPigKYnLCBkb3dubG9hZGVkOiAnRmluYWxpemF0JywgZXJyb3I6ICdFcm9hcmUnLCBmYWlsZWQ6ICdFyJl1YXQuJywgYXJpYURvd25sb2FkOiAnRGVzY8SDcmNhyJtpJywgdGl0bGVRdWljazogJ0Rlc2PEg3JjYXJlIHJhcGlkxIMnLCBjb21tZW50czogJ2NvbWVudGFyaWknLCBlZGl0ZWQ6ICdNb2RpZmljYXQnIH0sXG4gIGh1OiB7IGRvd25sb2FkOiAnTGV0w7ZsdMOpcycsIGRvd25sb2FkaW5nOiAnTGV0w7ZsdMOpc+KApicsIHRyeWluZzogJ1Byw7Niw6Fsa296w6Fz4oCmJywgZG93bmxvYWRlZDogJ0vDqXN6JywgZXJyb3I6ICdIaWJhJywgZmFpbGVkOiAnU2lrZXJ0ZWxlbi4nLCBhcmlhRG93bmxvYWQ6ICdMZXTDtmx0w6lzJywgdGl0bGVRdWljazogJ0d5b3JzIGxldMO2bHTDqXMnLCBjb21tZW50czogJ21lZ2plZ3l6w6lzJywgZWRpdGVkOiAnU3plcmtlc3p0dmUnIH0sXG4gIHN2OiB7IGRvd25sb2FkOiAnTGFkZGEgbmVyJywgZG93bmxvYWRpbmc6ICdMYWRkYXIgbmVy4oCmJywgdHJ5aW5nOiAnRsO2cnPDtmtlcuKApicsIGRvd25sb2FkZWQ6ICdLbGFydCcsIGVycm9yOiAnRmVsJywgZmFpbGVkOiAnTWlzc2x5Y2thZGVzLicsIGFyaWFEb3dubG9hZDogJ0xhZGRhIG5lcicsIHRpdGxlUXVpY2s6ICdTbmFiYiBuZWRsYWRkbmluZycsIGNvbW1lbnRzOiAna29tbWVudGFyZXInLCBlZGl0ZWQ6ICdSZWRpZ2VyYWQnIH0sXG4gIGRhOiB7IGRvd25sb2FkOiAnSGVudCcsIGRvd25sb2FkaW5nOiAnSGVudGVy4oCmJywgdHJ5aW5nOiAnUHLDuHZlcuKApicsIGRvd25sb2FkZWQ6ICdIZW50ZXQnLCBlcnJvcjogJ0ZlamwnLCBmYWlsZWQ6ICdNaXNseWtrZWRlcy4nLCBhcmlhRG93bmxvYWQ6ICdIZW50JywgdGl0bGVRdWljazogJ0h1cnRpZyBkb3dubG9hZCcsIGNvbW1lbnRzOiAna29tbWVudGFyZXInLCBlZGl0ZWQ6ICdSZWRpZ2VyZXQnIH0sXG4gIGZpOiB7IGRvd25sb2FkOiAnTGF0YWEnLCBkb3dubG9hZGluZzogJ0xhZGF0YWFu4oCmJywgdHJ5aW5nOiAnWXJpdGV0w6TDpG7igKYnLCBkb3dubG9hZGVkOiAnTGFkYXR0dScsIGVycm9yOiAnVmlyaGUnLCBmYWlsZWQ6ICdFcMOkb25uaXN0dWkuJywgYXJpYURvd25sb2FkOiAnTGF0YWEnLCB0aXRsZVF1aWNrOiAnUGlrYWxhdGF1cycsIGNvbW1lbnRzOiAna29tbWVudHRpYScsIGVkaXRlZDogJ011b2thdHR1JyB9LFxuICBubzogeyBkb3dubG9hZDogJ0xhc3QgbmVkJywgZG93bmxvYWRpbmc6ICdMYXN0ZXIgbmVk4oCmJywgdHJ5aW5nOiAnUHLDuHZlcuKApicsIGRvd25sb2FkZWQ6ICdGZXJkaWcnLCBlcnJvcjogJ0ZlaWwnLCBmYWlsZWQ6ICdNaXNseWt0ZXMuJywgYXJpYURvd25sb2FkOiAnTGFzdCBuZWQnLCB0aXRsZVF1aWNrOiAnUmFzayBuZWRsYXN0aW5nJywgY29tbWVudHM6ICdrb21tZW50YXJlcicsIGVkaXRlZDogJ1JlZGlnZXJ0JyB9LFxuICBoZTogeyBkb3dubG9hZDogJ9eU15XXqNeT15QnLCBkb3dubG9hZGluZzogJ9ee15XXqNeZ15PigKYnLCB0cnlpbmc6ICfXnteg16HXlOKApicsIGRvd25sb2FkZWQ6ICfXlNeV16nXnNedJywgZXJyb3I6ICfXqdeS15nXkNeUJywgZmFpbGVkOiAn16DXm9ep15wnLCBhcmlhRG93bmxvYWQ6ICfXlNeV16jXk9eUJywgdGl0bGVRdWljazogJ9eU15XXqNeT15Qg157XlNeZ16jXlCcsIGNvbW1lbnRzOiAn16rXkteV15HXldeqJywgZWRpdGVkOiAn16DXoteo15onIH0sXG4gIGZhOiB7IGRvd25sb2FkOiAn2K/Yp9mG2YTZiNivJywgZG93bmxvYWRpbmc6ICfYr9ix2K3Yp9mEINiv2KfZhtmE2YjYr+KApicsIHRyeWluZzogJ9iq2YTYp9i0INmF2KzYr9iv4oCmJywgZG93bmxvYWRlZDogJ9in2YbYrNin2YUg2LTYrycsIGVycm9yOiAn2K7Yt9inJywgZmFpbGVkOiAn2YbYp9mF2YjZgdmCJywgYXJpYURvd25sb2FkOiAn2K/Yp9mG2YTZiNivJywgdGl0bGVRdWljazogJ9iv2KfZhtmE2YjYryDYs9ix24zYuScsIGNvbW1lbnRzOiAn2YbYuNixJywgZWRpdGVkOiAn2YjbjNix2KfbjNi0INi02K/ZhycgfSxcbiAgZmlsOiB7IGRvd25sb2FkOiAnSS1kb3dubG9hZCcsIGRvd25sb2FkaW5nOiAnTmFnZGEtZG93bmxvYWTigKYnLCB0cnlpbmc6ICdTaW51c3VidWthbuKApicsIGRvd25sb2FkZWQ6ICdUYXBvcyBuYScsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdOYWJpZ28uJywgYXJpYURvd25sb2FkOiAnSS1kb3dubG9hZCcsIHRpdGxlUXVpY2s6ICdNYWJpbGlzIG5hIGRvd25sb2FkJywgY29tbWVudHM6ICdtZ2Ega29tZW50bycsIGVkaXRlZDogJ05hLWVkaXQnIH0sXG4gIG1zOiB7IGRvd25sb2FkOiAnTXVhdCB0dXJ1bicsIGRvd25sb2FkaW5nOiAnTWVtdWF0IHR1cnVu4oCmJywgdHJ5aW5nOiAnTWVuY3ViYeKApicsIGRvd25sb2FkZWQ6ICdTZWxlc2FpJywgZXJyb3I6ICdSYWxhdCcsIGZhaWxlZDogJ0dhZ2FsLicsIGFyaWFEb3dubG9hZDogJ011YXQgdHVydW4nLCB0aXRsZVF1aWNrOiAnTXVhdCB0dXJ1biBwYW50YXMnLCBjb21tZW50czogJ2tvbWVuJywgZWRpdGVkOiAnRGllZGl0JyB9LFxuICBzcjogeyBkb3dubG9hZDogJ9Cf0YDQtdGD0LfQvNC4JywgZG93bmxvYWRpbmc6ICfQn9GA0LXRg9C30LjQvNCw0ZrQteKApicsIHRyeWluZzogJ9Cf0L7QutGD0YjQsNCy0LDQvOKApicsIGRvd25sb2FkZWQ6ICfQl9Cw0LLRgNGI0LXQvdC+JywgZXJyb3I6ICfQk9GA0LXRiNC60LAnLCBmYWlsZWQ6ICfQndC10YPRgdC/0LXRiNC90L4uJywgYXJpYURvd25sb2FkOiAn0J/RgNC10YPQt9C80LgnLCB0aXRsZVF1aWNrOiAn0JHRgNC30L4g0L/RgNC10YPQt9C40LzQsNGa0LUnLCBjb21tZW50czogJ9C60L7QvNC10L3RgtCw0YDQsCcsIGVkaXRlZDogJ9CY0LfQvNC10ZrQtdC90L4nIH0sXG4gIHNrOiB7IGRvd25sb2FkOiAnU3RpYWhudcWlJywgZG93bmxvYWRpbmc6ICdTxaVhaG92YW5pZeKApicsIHRyeWluZzogJ1Nrw7rFoWFt4oCmJywgZG93bmxvYWRlZDogJ0hvdG92bycsIGVycm9yOiAnQ2h5YmEnLCBmYWlsZWQ6ICdabHloYWxvLicsIGFyaWFEb3dubG9hZDogJ1N0aWFobnXFpScsIHRpdGxlUXVpY2s6ICdSw71jaGxlIHN0aWFobnV0aWUnLCBjb21tZW50czogJ2tvbWVudMOhcm92JywgZWRpdGVkOiAnVXByYXZlbsOpJyB9LFxuICBiZzogeyBkb3dubG9hZDogJ9CY0LfRgtC10LPQu9C4JywgZG93bmxvYWRpbmc6ICfQmNC30YLQtdCz0LvRj9C90LXigKYnLCB0cnlpbmc6ICfQntC/0LjRguKApicsIGRvd25sb2FkZWQ6ICfQk9C+0YLQvtCy0L4nLCBlcnJvcjogJ9CT0YDQtdGI0LrQsCcsIGZhaWxlZDogJ9Cd0LXRg9GB0L/QtdGI0L3Qvi4nLCBhcmlhRG93bmxvYWQ6ICfQmNC30YLQtdCz0LvQuCcsIHRpdGxlUXVpY2s6ICfQkdGK0YDQt9C+INC40LfRgtC10LPQu9GP0L3QtScsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNCwJywgZWRpdGVkOiAn0KDQtdC00LDQutGC0LjRgNCw0L3QvicgfSxcbiAgaHI6IHsgZG93bmxvYWQ6ICdQcmV1em1pJywgZG93bmxvYWRpbmc6ICdQcmV1emltYW5qZeKApicsIHRyeWluZzogJ1Bva3XFoWF2YW3igKYnLCBkb3dubG9hZGVkOiAnR290b3ZvJywgZXJyb3I6ICdHcmXFoWthJywgZmFpbGVkOiAnTmV1c3BqZWxvLicsIGFyaWFEb3dubG9hZDogJ1ByZXV6bWknLCB0aXRsZVF1aWNrOiAnQnJ6byBwcmV1emltYW5qZScsIGNvbW1lbnRzOiAna29tZW50YXJhJywgZWRpdGVkOiAnVXJlxJFlbm8nIH0sXG4gIGx0OiB7IGRvd25sb2FkOiAnQXRzaXNpxbNzdGknLCBkb3dubG9hZGluZzogJ1NpdW7EjWlhbWHigKYnLCB0cnlpbmc6ICdCYW5kb21h4oCmJywgZG93bmxvYWRlZDogJ0JhaWd0YScsIGVycm9yOiAnS2xhaWRhJywgZmFpbGVkOiAnTmVwYXZ5a28uJywgYXJpYURvd25sb2FkOiAnQXRzaXNpxbNzdGknLCB0aXRsZVF1aWNrOiAnR3JlaXRhcyBhdHNpc2l1bnRpbWFzJywgY29tbWVudHM6ICdrb21lbnRhcmFpJywgZWRpdGVkOiAnUmVkYWd1b3RhJyB9LFxuICBsdjogeyBkb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JywgZG93bmxvYWRpbmc6ICdMZWp1cGllbMSBZMST4oCmJywgdHJ5aW5nOiAnTcSTxKNpbmHigKYnLCBkb3dubG9hZGVkOiAnUGFiZWlndHMnLCBlcnJvcjogJ0vEvMWrZGEnLCBmYWlsZWQ6ICdOZWl6ZGV2xIFzLicsIGFyaWFEb3dubG9hZDogJ0xlanVwaWVsxIFkxJN0JywgdGl0bGVRdWljazogJ8SAdHLEgSBsZWp1cGllbMSBZGUnLCBjb21tZW50czogJ2tvbWVudMSBcmknLCBlZGl0ZWQ6ICdSZWRpxKPEk3RzJyB9LFxuICBldDogeyBkb3dubG9hZDogJ0xhYWRpIGFsbGEnLCBkb3dubG9hZGluZzogJ0xhYWRpbWluZeKApicsIHRyeWluZzogJ1Byb292aW7igKYnLCBkb3dubG9hZGVkOiAnVmFsbWlzJywgZXJyb3I6ICdWaWdhJywgZmFpbGVkOiAnRWJhw7VubmVzdHVzLicsIGFyaWFEb3dubG9hZDogJ0xhYWRpIGFsbGEnLCB0aXRsZVF1aWNrOiAnS2lpcmUgYWxsYWxhYWRpbWluZScsIGNvbW1lbnRzOiAna29tbWVudGFhcmknLCBlZGl0ZWQ6ICdNdXVkZXR1ZCcgfSxcbiAgc2w6IHsgZG93bmxvYWQ6ICdQcmVub3MnLCBkb3dubG9hZGluZzogJ1ByZW5hxaFhbmpl4oCmJywgdHJ5aW5nOiAnUG9za3XFoWFt4oCmJywgZG93bmxvYWRlZDogJ0tvbsSNYW5vJywgZXJyb3I6ICdOYXBha2EnLCBmYWlsZWQ6ICdOaSB1c3BlbG8uJywgYXJpYURvd25sb2FkOiAnUHJlbm9zJywgdGl0bGVRdWljazogJ0hpdGVyIHByZW5vcycsIGNvbW1lbnRzOiAna29tZW50YXJqZXYnLCBlZGl0ZWQ6ICdVcmVqZW5vJyB9LFxuICBjYTogeyBkb3dubG9hZDogJ0Rlc2NhcnJlZ2EnLCBkb3dubG9hZGluZzogJ0Rlc2NhcnJlZ2FudOKApicsIHRyeWluZzogJ0ludGVudGFudOKApicsIGRvd25sb2FkZWQ6ICdEZXNjYXJyZWdhdCcsIGVycm9yOiAnRXJyb3InLCBmYWlsZWQ6ICdIYSBmYWxsYXQuJywgYXJpYURvd25sb2FkOiAnRGVzY2FycmVnYScsIHRpdGxlUXVpY2s6ICdEZXNjw6BycmVnYSByw6BwaWRhJywgY29tbWVudHM6ICdjb21lbnRhcmlzJywgZWRpdGVkOiAnRWRpdGF0JyB9LFxuICBhZjogeyBkb3dubG9hZDogJ0FmbGFhaScsIGRvd25sb2FkaW5nOiAnTGFhaSBhZuKApicsIHRyeWluZzogJ1Byb2JlZXLigKYnLCBkb3dubG9hZGVkOiAnS2xhYXInLCBlcnJvcjogJ0ZvdXQnLCBmYWlsZWQ6ICdNaXNsdWsuJywgYXJpYURvd25sb2FkOiAnQWZsYWFpJywgdGl0bGVRdWljazogJ1Zpbm5pZ2UgYWZsYWFpJywgY29tbWVudHM6ICdrb21tZW50YXJlJywgZWRpdGVkOiAnR2VyZWRpZ2VlcicgfSxcbiAgYW06IHsgZG93bmxvYWQ6ICfhiqDhi43hiK3hi7UnLCBkb3dubG9hZGluZzogJ+GJoOGIm+GLjeGIqOGLtSDhiIvhi63igKYnLCB0cnlpbmc6ICfhiaDhiJjhiJ7hiqjhiK0g4YiL4Yut4oCmJywgZG93bmxvYWRlZDogJ+GLiOGIreGLt+GIjScsIGVycm9yOiAn4Yi14YiF4Ymw4Ym1JywgZmFpbGVkOiAn4Yqg4YiN4Ymw4Yiz4Yqr4Yid4Y2iJywgYXJpYURvd25sb2FkOiAn4Yqg4YuN4Yit4Yu1JywgdGl0bGVRdWljazogJ+GNiOGMo+GKlSDhiJvhi43hiKjhi7UnLCBjb21tZW50czogJ+GKoOGIteGJsOGLq+GLqOGJtuGJvScsIGVkaXRlZDogJ+GJsOGIteGJsOGKq+GKreGIj+GIjScgfSxcbiAgaHk6IHsgZG93bmxvYWQ6ICfVhtWl1oDVotWl1bzVttWl1awnLCBkb3dubG9hZGluZzogJ9WG1aXWgNWi1aXVvNW21bjWgtW04oCmJywgdHJ5aW5nOiAn1ZPVuNaA1bHVuNaC1bQg1afigKYnLCBkb3dubG9hZGVkOiAn1LHVvtWh1oDVv9W+1aHVricsIGVycm9yOiAn1Y3VrdWh1awnLCBmYWlsZWQ6ICfVgdWh1a3VuNWy1b7VpdaBOicsIGFyaWFEb3dubG9hZDogJ9WG1aXWgNWi1aXVvNW21aXVrCcsIHRpdGxlUXVpY2s6ICfUsdaA1aHVoyDVttWl1oDVotWl1bzVttW41oLVtCcsIGNvbW1lbnRzOiAn1bTVpdWv1bbVodWi1aHVttW41oLVqdW11bjWgtW2JywgZWRpdGVkOiAn1L3VtNWi1aHVo9aA1b7VpdWsINWnJyB9LFxuICBhczogeyBkb3dubG9hZDogJ+CmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsIGRvd25sb2FkaW5nOiAn4Kah4Ka+4KaJ4Kao4KeN4Kay4KeL4KahIOCmueCniCDgpobgppvgp4figKYnLCB0cnlpbmc6ICfgpprgp4fgprfgp43gpp/gpr4g4KaV4Kew4Ka/IOCmhuCmm+Cnh+KApicsIGRvd25sb2FkZWQ6ICfgprjgpq7gp43gpqrgp4Lgp7Dgp43gpqMnLCBlcnJvcjogJ+CmpOCnjeCnsOCngeCmn+CmvycsIGZhaWxlZDogJ+CmrOCmv+Cmq+CmsiDgprnigJngprInLCBhcmlhRG93bmxvYWQ6ICfgpqHgpr7gpongpqjgp43gprLgp4vgpqEnLCB0aXRsZVF1aWNrOiAn4Kam4KeN4Kew4KeB4KakIOCmoeCmvuCmieCmqOCnjeCmsuCni+CmoScsIGNvbW1lbnRzOiAn4Kau4Kao4KeN4Kak4Kas4KeN4KavJywgZWRpdGVkOiAn4Ka44Kau4KeN4Kaq4Ka+4Kam4Ka/4KakJyB9LFxuICBhejogeyBkb3dubG9hZDogJ1nDvGtsyZknLCBkb3dubG9hZGluZzogJ1nDvGtsyZluaXLigKYnLCB0cnlpbmc6ICdDyZloZCBlZGlsaXLigKYnLCBkb3dubG9hZGVkOiAnQml0ZGknLCBlcnJvcjogJ1jJmXRhJywgZmFpbGVkOiAnQWzEsW5tYWTEsS4nLCBhcmlhRG93bmxvYWQ6ICdZw7xrbMmZJywgdGl0bGVRdWljazogJ1PDvHLJmXRsaSB5w7xrbMmZbcmZJywgY29tbWVudHM6ICfFn8mZcmgnLCBlZGl0ZWQ6ICdEw7x6yZlsacWfIGVkaWxpYicgfSxcbiAgZXU6IHsgZG93bmxvYWQ6ICdEZXNrYXJnYXR1JywgZG93bmxvYWRpbmc6ICdEZXNrYXJnYXR6ZW7igKYnLCB0cnlpbmc6ICdTYWlhdHplbuKApicsIGRvd25sb2FkZWQ6ICdFZ2luZGEnLCBlcnJvcjogJ0Vycm9yZWEnLCBmYWlsZWQ6ICdIdXRzIGVnaW4gZHUuJywgYXJpYURvd25sb2FkOiAnRGVza2FyZ2F0dScsIHRpdGxlUXVpY2s6ICdEZXNrYXJnYSBhemthcnJhJywgY29tbWVudHM6ICdpcnV6a2luJywgZWRpdGVkOiAnRWRpdGF0dWEnIH0sXG4gIG15OiB7IGRvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JywgZG93bmxvYWRpbmc6ICfhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLog4YCc4YCv4YCV4YC64YCU4YCx4oCmJywgdHJ5aW5nOiAn4YCA4YC84YCt4YCv4YC44YCF4YCs4YC44YCU4YCx4oCmJywgZG93bmxvYWRlZDogJ+GAleGAvOGAruGAuOGAleGAq+GAleGAvOGAricsIGVycm9yOiAn4YCh4YCZ4YC+4YCs4YC4JywgZmFpbGVkOiAn4YCZ4YCh4YCx4YCs4YCE4YC64YCZ4YC84YCE4YC64YCV4YCr4YGLJywgYXJpYURvd25sb2FkOiAn4YCS4YCx4YCr4YCE4YC64YC44YCc4YCv4YCS4YC6JywgdGl0bGVRdWljazogJ+GAoeGAmeGAvOGAlOGAuiDhgJLhgLHhgKvhgIThgLrhgLjhgJzhgK/hgJLhgLonLCBjb21tZW50czogJ+GAmeGAvuGAkOGAuuGAgeGAu+GAgOGAuuGAmeGAu+GArOGAuCcsIGVkaXRlZDogJ+GAleGAvOGAhOGAuuGAhuGAhOGAuuGAleGAvOGAruGAuCcgfSxcbiAgZ2w6IHsgZG93bmxvYWQ6ICdEZXNjYXJnYXInLCBkb3dubG9hZGluZzogJ0Rlc2NhcmdhbmRv4oCmJywgdHJ5aW5nOiAnVGVudGFuZG/igKYnLCBkb3dubG9hZGVkOiAnRGVzY2FyZ2FkbycsIGVycm9yOiAnRXJybycsIGZhaWxlZDogJ0ZhbGxvdS4nLCBhcmlhRG93bmxvYWQ6ICdEZXNjYXJnYXInLCB0aXRsZVF1aWNrOiAnRGVzY2FyZ2EgcsOhcGlkYScsIGNvbW1lbnRzOiAnY29tZW50YXJpb3MnLCBlZGl0ZWQ6ICdFZGl0YWRvJyB9LFxuICBrYTogeyBkb3dubG9hZDogJ+GDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsIGRvd25sb2FkaW5nOiAn4YOY4YOs4YOU4YOg4YOU4YOR4YOQ4oCmJywgdHJ5aW5nOiAn4YOb4YOq4YOT4YOU4YOa4YOd4YOR4YOQ4oCmJywgZG93bmxvYWRlZDogJ+GDk+GDkOGDoeGDoOGDo+GDmuGDk+GDkCcsIGVycm9yOiAn4YOo4YOU4YOq4YOT4YOd4YOb4YOQJywgZmFpbGVkOiAn4YOV4YOU4YOgIOGDm+GDneGDruGDlOGDoOGDruGDk+GDkC4nLCBhcmlhRG93bmxvYWQ6ICfhg6nhg5Dhg5vhg53hg6Lhg5Xhg5jhg6Dhg5fhg5Xhg5AnLCB0aXRsZVF1aWNrOiAn4YOh4YOs4YOg4YOQ4YOk4YOYIOGDqeGDkOGDm+GDneGDouGDleGDmOGDoOGDl+GDleGDkCcsIGNvbW1lbnRzOiAn4YOZ4YOd4YOb4YOU4YOc4YOi4YOQ4YOg4YOYJywgZWRpdGVkOiAn4YOg4YOU4YOT4YOQ4YOl4YOi4YOY4YOg4YOU4YOR4YOj4YOa4YOY4YOQJyB9LFxuICBpczogeyBkb3dubG9hZDogJ1PDpmtqYScsIGRvd25sb2FkaW5nOiAnU8Oma2ly4oCmJywgdHJ5aW5nOiAnUmV5bmnigKYnLCBkb3dubG9hZGVkOiAnU8OzdHQnLCBlcnJvcjogJ1ZpbGxhJywgZmFpbGVkOiAnTWlzdMOza3N0LicsIGFyaWFEb3dubG9hZDogJ1PDpmtqYScsIHRpdGxlUXVpY2s6ICdGbMO9dGluacOwdXJoYWwnLCBjb21tZW50czogJ3VtbcOmbGknLCBlZGl0ZWQ6ICdCcmV5dHQnIH0sXG4gIGdhOiB7IGRvd25sb2FkOiAnw41vc2zDs2TDoWlsJywgZG93bmxvYWRpbmc6ICdBZyDDrW9zbMOzZMOhaWzigKYnLCB0cnlpbmc6ICdBZyBpYXJyYWlkaOKApicsIGRvd25sb2FkZWQ6ICfDjW9zbMOzZMOhaWx0ZScsIGVycm9yOiAnRWFycsOhaWQnLCBmYWlsZWQ6ICdUaGVpcCBhaXIuJywgYXJpYURvd25sb2FkOiAnw41vc2zDs2TDoWlsJywgdGl0bGVRdWljazogJ8ONb3Nsw7Nkw6FpbCB0YXBhJywgY29tbWVudHM6ICd0csOhY2h0JywgZWRpdGVkOiAnRWFncmFpdGhlJyB9LFxuICBrazogeyBkb3dubG9hZDogJ9CW0q/QutGC0LXQvyDQsNC70YMnLCBkb3dubG9hZGluZzogJ9CW0q/QutGC0LXQu9GD0LTQteKApicsIHRyeWluZzogJ9OY0YDQtdC60LXRguKApicsIGRvd25sb2FkZWQ6ICfQkNGP0pvRgtCw0LvQtNGLJywgZXJyb3I6ICfSmtCw0YLQtScsIGZhaWxlZDogJ9Ch05nRgtGB0ZbQty4nLCBhcmlhRG93bmxvYWQ6ICfQltKv0LrRgtC10L8g0LDQu9GDJywgdGl0bGVRdWljazogJ9CW0YvQu9C00LDQvCDQttKv0LrRgtC10YMnLCBjb21tZW50czogJ9C/0ZbQutGW0YAnLCBlZGl0ZWQ6ICfTqNC30LPQtdGA0YLRltC70LTRlicgfSxcbiAga206IHsgZG93bmxvYWQ6ICfhnpHhnrbhnonhnpnhnoAnLCBkb3dubG9hZGluZzogJ+GegOGfhuGeluGeu+GehOGekeGetuGeieGemeGegOKApicsIHRyeWluZzogJ+GegOGfhuGeluGeu+GehOGeluGfkuGemeGetuGemeGetuGemOKApicsIGRvd25sb2FkZWQ6ICfhnpThnrbhnpPhnpThnonhn5LhnoXhnpThn4snLCBlcnJvcjogJ+GegOGfhuGeoOGeu+GenycsIGZhaWxlZDogJ+GelOGemuGetuGeh+GfkOGemScsIGFyaWFEb3dubG9hZDogJ+GekeGetuGeieGemeGegCcsIHRpdGxlUXVpY2s6ICfhnpHhnrbhnonhnpnhnoDhnpvhnr/hnpMnLCBjb21tZW50czogJ+GemOGej+GetycsIGVkaXRlZDogJ+GelOGetuGek+GegOGfguGen+GemOGfkuGemuGeveGemycgfSxcbiAgbG86IHsgZG93bmxvYWQ6ICfgupTgurLguqfgu4LguqvguqXgupQnLCBkb3dubG9hZGluZzogJ+C6geC6s+C6peC6seC6h+C6lOC6suC6p+C7guC6q+C6peC6lOKApicsIHRyeWluZzogJ+C6geC6s+C6peC6seC6h+C6nuC6sOC6jeC6suC6jeC6suC6oeKApicsIGRvd25sb2FkZWQ6ICfguqrgurPgu4DguqXgurHgupQnLCBlcnJvcjogJ+C6nOC6tOC6lOC6nuC6suC6lCcsIGZhaWxlZDogJ+C6peC6u+C7ieC6oeC7gOC6q+C6peC6pycsIGFyaWFEb3dubG9hZDogJ+C6lOC6suC6p+C7guC6q+C6peC6lCcsIHRpdGxlUXVpY2s6ICfgupTgurLguqfgu4LguqvguqXgupTgupTgu4jguqfgupknLCBjb21tZW50czogJ+C6hOC6s+C7gOC6q+C6seC6mScsIGVkaXRlZDogJ+C7geC6geC7ieC7hOC6guC7geC6peC7ieC6pycgfSxcbiAgbWs6IHsgZG93bmxvYWQ6ICfQn9GA0LXQt9C10LzQuCcsIGRvd25sb2FkaW5nOiAn0J/RgNC10LfQtdC80LDRmtC14oCmJywgdHJ5aW5nOiAn0KHQtSDQvtCx0LjQtNGD0LLQsNC84oCmJywgZG93bmxvYWRlZDogJ9CT0L7RgtC+0LLQvicsIGVycm9yOiAn0JPRgNC10YjQutCwJywgZmFpbGVkOiAn0J3QtdGD0YHQv9C10YjQvdC+LicsIGFyaWFEb3dubG9hZDogJ9Cf0YDQtdC30LXQvNC4JywgdGl0bGVRdWljazogJ9CR0YDQt9C+INC/0YDQtdC30LXQvNCw0ZrQtScsIGNvbW1lbnRzOiAn0LrQvtC80LXQvdGC0LDRgNC4JywgZWRpdGVkOiAn0JjQt9C80LXQvdC10YLQvicgfSxcbiAgbW46IHsgZG93bmxvYWQ6ICfQotCw0YLQsNGFJywgZG93bmxvYWRpbmc6ICfQotCw0YLQsNC2INCx0LDQudC90LDigKYnLCB0cnlpbmc6ICfQntGA0LvQtNC+0LYg0LHQsNC50L3QsOKApicsIGRvd25sb2FkZWQ6ICfQotCw0YLRgdCw0L0nLCBlcnJvcjogJ9CQ0LvQtNCw0LAnLCBmYWlsZWQ6ICfQkNC80LbQuNC70YLQs9Kv0LkuJywgYXJpYURvd25sb2FkOiAn0KLQsNGC0LDRhScsIHRpdGxlUXVpY2s6ICfQpdGD0YDQtNCw0L0g0YLQsNGC0LDRhScsIGNvbW1lbnRzOiAn0YHRjdGC0LPRjdCz0LTRjdC7JywgZWRpdGVkOiAn0JfQsNGB0YHQsNC9JyB9LFxuICBuZTogeyBkb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIGRvd25sb2FkaW5nOiAn4KSh4KS+4KSJ4KSo4KSy4KWL4KShIOCkueClgeCkgeCkpuCliOKApicsIHRyeWluZzogJ+CkquCljeCksOCkr+CkvuCkuCDgpJfgpLDgpY3gpKbgpYjigKYnLCBkb3dubG9hZGVkOiAn4KSq4KWC4KSw4KS+IOCkreCkr+CliycsIGVycm9yOiAn4KSk4KWN4KSw4KWB4KSf4KS/JywgZmFpbGVkOiAn4KSF4KS44KSr4KSyIOCkreCkr+CliycsIGFyaWFEb3dubG9hZDogJ+CkoeCkvuCkieCkqOCksuCli+CkoScsIHRpdGxlUXVpY2s6ICfgpJvgpL/gpJ/gpYsg4KSh4KS+4KSJ4KSo4KSy4KWL4KShJywgY29tbWVudHM6ICfgpJ/gpL/gpKrgpY3gpKrgpKPgpYDgpLngpLDgpYInLCBlZGl0ZWQ6ICfgpLjgpK7gpY3gpKrgpL7gpKbgpL/gpKQnIH0sXG4gIG9yOiB7IGRvd25sb2FkOiAn4Kyh4Ky+4KyJ4Kyo4Kyy4K2L4Kyh4K2NJywgZG93bmxvYWRpbmc6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0g4Ky54K2H4KyJ4Kyb4Ky/4oCmJywgdHJ5aW5nOiAn4Kya4K2H4Ky34K2N4Kyf4Ky+IOCsleCssOCtgeCsm+Csv+KApicsIGRvd25sb2FkZWQ6ICfgrLjgrK7grY3grKrgrYLgrLDgrY3grKPgrY3grKMnLCBlcnJvcjogJ+CspOCtjeCssOCtgeCsn+CsvycsIGZhaWxlZDogJ+CsrOCsv+Csq+CssyDgrLngrYfgrLLgrL4nLCBhcmlhRG93bmxvYWQ6ICfgrKHgrL7grIngrKjgrLLgrYvgrKHgrY0nLCB0aXRsZVF1aWNrOiAn4Ky24K2A4KyY4K2N4KywIOCsoeCsvuCsieCsqOCssuCti+CsoeCtjScsIGNvbW1lbnRzOiAn4Kyu4Kyo4K2N4Kyk4Kys4K2N4K2fJywgZWRpdGVkOiAn4Ky44Kyu4K2N4Kyq4Ky+4Kym4Ky/4KykJyB9LFxuICBzaTogeyBkb3dubG9hZDogJ+C2tuC3j+C2nOC2seC3iuC2sScsIGRvd25sb2FkaW5nOiAn4La24LeP4Lac4LatIOC3gOC3meC2uOC3kuC2seC3iuKApicsIHRyeWluZzogJ+C2i+C2reC3iuC3g+C3j+C3hCDgtprgtrvgtrjgt5LgtrHgt4rigKYnLCBkb3dubG9hZGVkOiAn4LaF4LeA4LeD4Lax4LeKJywgZXJyb3I6ICfgtq/gt53gt4Lgtrrgtprgt5InLCBmYWlsZWQ6ICfgtoXgt4Pgt4/gtrvgt4rgtq7gtprgtrrgt5InLCBhcmlhRG93bmxvYWQ6ICfgtrbgt4/gtpzgtrHgt4rgtrEnLCB0aXRsZVF1aWNrOiAn4LaJ4Laa4LeK4La44Lax4LeKIOC2tuC3j+C2nOC2rSDgtprgt5Lgtrvgt5PgtrgnLCBjb21tZW50czogJ+C2heC2r+C3hOC3g+C3iicsIGVkaXRlZDogJ+C3g+C2guC3g+C3iuC2muC2u+C2q+C2uicgfSxcbiAgc3c6IHsgZG93bmxvYWQ6ICdQYWt1YScsIGRvd25sb2FkaW5nOiAnSW5hcGFrdWHigKYnLCB0cnlpbmc6ICdJbmFqYXJpYnXigKYnLCBkb3dubG9hZGVkOiAnSW1la2FtaWxpa2EnLCBlcnJvcjogJ0hpdGlsYWZ1JywgZmFpbGVkOiAnSW1lc2hpbmR3YS4nLCBhcmlhRG93bmxvYWQ6ICdQYWt1YScsIHRpdGxlUXVpY2s6ICdQYWt1YSBoYXJha2EnLCBjb21tZW50czogJ21hb25pJywgZWRpdGVkOiAnSW1laGFyaXJpd2EnIH0sXG4gIHV6OiB7IGRvd25sb2FkOiAnWXVrbGFzaCcsIGRvd25sb2FkaW5nOiAnWXVrbGFubW9xZGHigKYnLCB0cnlpbmc6ICdVcmluaWxtb3FkYeKApicsIGRvd25sb2FkZWQ6ICdUYXl5b3InLCBlcnJvcjogJ1hhdG8nLCBmYWlsZWQ6ICdNdXZhZmZhcWl5YXRzaXouJywgYXJpYURvd25sb2FkOiAnWXVrbGFzaCcsIHRpdGxlUXVpY2s6ICdUZXogeXVrbGFzaCcsIGNvbW1lbnRzOiAnc2hhcmhsYXInLCBlZGl0ZWQ6ICdUYWhyaXJsYW5nYW4nIH0sXG4gIGN5OiB7IGRvd25sb2FkOiAnTGF3cmx3eXRobycsIGRvd25sb2FkaW5nOiAnWW4gbGF3cmx3eXRob+KApicsIHRyeWluZzogJ1luIGNlaXNpb+KApicsIGRvd25sb2FkZWQ6ICdXZWRpIGdvcmZmZW4nLCBlcnJvcjogJ0d3YWxsJywgZmFpbGVkOiAnTWV0aG9kZC4nLCBhcmlhRG93bmxvYWQ6ICdMYXdybHd5dGhvJywgdGl0bGVRdWljazogJ0xhd3Jsd3l0aG8gY3lmbHltJywgY29tbWVudHM6ICdzeWx3YWRhdScsIGVkaXRlZDogJ0dvbHlnd3lkJyB9LFxuICB6dTogeyBkb3dubG9hZDogJ0xhbmRhJywgZG93bmxvYWRpbmc6ICdJeWFsYW5kd2HigKYnLCB0cnlpbmc6ICdJeWF6YW1h4oCmJywgZG93bmxvYWRlZDogJ0lsYW5kxKt3ZScsIGVycm9yOiAnSXBodXRoYScsIGZhaWxlZDogJ0lobHVsZWtpbGUuJywgYXJpYURvd25sb2FkOiAnTGFuZGEnLCB0aXRsZVF1aWNrOiAnVWt1bGFuZGEgb2t1c2hlc2hheW8nLCBjb21tZW50czogJ2FtYXp3YW5hJywgZWRpdGVkOiAnS3VobGVsaXdlJyB9LFxuICBzcTogeyBkb3dubG9hZDogJ1Noa2Fya28nLCBkb3dubG9hZGluZzogJ0R1a2Ugc2hrYXJrdWFy4oCmJywgdHJ5aW5nOiAnRHVrZSBwcm92dWFy4oCmJywgZG93bmxvYWRlZDogJ1DDq3JmdW5kb2knLCBlcnJvcjogJ0dhYmltJywgZmFpbGVkOiAnRMOrc2h0b2kuJywgYXJpYURvd25sb2FkOiAnU2hrYXJrbycsIHRpdGxlUXVpY2s6ICdTaGthcmtpbSBpIHNocGVqdMOrJywgY29tbWVudHM6ICdrb21lbnRlJywgZWRpdGVkOiAnRSByZWRha3R1YXInIH0sXG59O1xuXG5leHBvcnQgdHlwZSBMYW5nS2V5ID0ga2V5b2YgdHlwZW9mIFRSQU5TTEFUSU9OUy5lbjtcblxuZXhwb3J0IGZ1bmN0aW9uIHQoa2V5OiBMYW5nS2V5KTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICBpZiAoIWtleSB8fCB0eXBlb2Yga2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuICcuLi4nO1xuICAgIH1cblxuICAgIGxldCByYXdMYW5nID0gJ2VuJztcbiAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmxhbmcpIHtcbiAgICAgIHJhd0xhbmcgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQubGFuZztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIG5hdmlnYXRvci5sYW5ndWFnZSkge1xuICAgICAgcmF3TGFuZyA9IG5hdmlnYXRvci5sYW5ndWFnZTtcbiAgICB9XG5cbiAgICBjb25zdCBub3JtYWxpemVkTGFuZyA9IHJhd0xhbmcudG9Mb3dlckNhc2UoKS5zcGxpdCgnOycpWzBdLnRyaW0oKS5yZXBsYWNlKCdfJywgJy0nKTtcbiAgICBjb25zdCBiYXNlTGFuZyA9IG5vcm1hbGl6ZWRMYW5nLnNwbGl0KCctJylbMF07XG5cbiAgICBpZiAoVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXSAmJiB0eXBlb2YgVFJBTlNMQVRJT05TW25vcm1hbGl6ZWRMYW5nXVtrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1tub3JtYWxpemVkTGFuZ11ba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoVFJBTlNMQVRJT05TW2Jhc2VMYW5nXSAmJiB0eXBlb2YgVFJBTlNMQVRJT05TW2Jhc2VMYW5nXVtrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1tiYXNlTGFuZ11ba2V5XTtcbiAgICB9XG5cbiAgICBpZiAoVFJBTlNMQVRJT05TWydlbiddICYmIHR5cGVvZiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBUUkFOU0xBVElPTlNbJ2VuJ11ba2V5XTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5O1xuXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIFRSQU5TTEFUSU9OU1snZW4nXVtrZXldIHx8IGtleTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBTdHJpbmcoa2V5IHx8ICdEb3dubG9hZCcpO1xuICAgIH1cbiAgfVxufSIsIi8vIGZpbGVwYXRoOiBlbnRyeXBvaW50cy9jb250ZW50L3RoZW1lLnRzXG5cbi8qKlxuICogVEhFTUUgREVURUNUT1JcbiAqXG4gKiBHb2FsOiBcIklzIHRoZSBjb250ZW50IEknbSBkcmF3aW5nIG9uIHZpc3VhbGx5IGRhcmsgb3IgbGlnaHQ/XCJcbiAqIEluc3RlYWQgb2YgZ3Vlc3NpbmcgZnJvbSA8Ym9keT4sIHdlOlxuICogIC0gUmVzcGVjdCBEYXJrIFJlYWRlciBpZiBwcmVzZW50XG4gKiAgLSBMb29rIGZvciBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3Nlc1xuICogIC0gTWVhc3VyZSB0aGUgZWZmZWN0aXZlIGJhY2tncm91bmQgY29sb3Igb2YgYSAqY29udGVudCogZWxlbWVudFxuICogICAgKGUuZy4gR29vZ2xlIENsYXNzcm9vbSBzdHJlYW0gY2FyZHMpXG4gKi9cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhZ2UgKmNvbnRlbnQgYXJlYSogaXMgdmlzdWFsbHkgZGFyay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFnZURhcmsoKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMS4gRmFzdCBwYXRoOiBEYXJrIFJlYWRlciBhdHRyaWJ1dGVcbiAgY29uc3QgZHJTY2hlbWUgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRhcmtyZWFkZXItc2NoZW1lJyk7XG4gIGlmIChkclNjaGVtZSA9PT0gJ2RhcmsnKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKGRyU2NoZW1lID09PSAnbGlnaHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gMi4gSGV1cmlzdGljOiBvYnZpb3VzIFwiZGFyayBtb2RlXCIgY2xhc3NlcyBvbiA8aHRtbD4gLyA8Ym9keT5cbiAgLy8gKGNvdmVycyBzb21lIGZyYW1ld29ya3MgYW5kIGV4dGVuc2lvbnMpXG4gIGNvbnN0IGRhcmtUb2tlbnMgPSBbJ2RhcmsnLCAnZGFyay10aGVtZScsICd0aGVtZS1kYXJrJywgJ25pZ2h0JywgJ2dtMy1kYXJrLXRoZW1lJ107XG4gIGNvbnN0IGh0bWxDbGFzcyA9IChkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xhc3NOYW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBib2R5Q2xhc3MgPSAoZG9jdW1lbnQuYm9keS5jbGFzc05hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChkYXJrVG9rZW5zLnNvbWUodG9rZW4gPT4gaHRtbENsYXNzLmluY2x1ZGVzKHRva2VuKSB8fCBib2R5Q2xhc3MuaW5jbHVkZXModG9rZW4pKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gMy4gUHJvYmUgYSAqY29udGVudCogZWxlbWVudCwgbm90IHRoZSB3aG9sZSBwYWdlIGJhY2tncm91bmQuXG4gIC8vICAgIEZvciBDbGFzc3Jvb20sIHBvc3RzIGFyZSB0aGUgbWFpbiBzdXJmYWNlIHdlIGRyYXcgb24uXG4gIGNvbnN0IHByb2JlRWwgPVxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdbcm9sZT1cIm1haW5cIl0nKSB8fFxuICAgIGRvY3VtZW50LmJvZHk7XG5cbiAgY29uc3QgYmdDb2xvciA9IGdldEVmZmVjdGl2ZUJhY2tncm91bmRDb2xvcihwcm9iZUVsKTtcbiAgY29uc3QgYnJpZ2h0bmVzcyA9IHBhcnNlQnJpZ2h0bmVzcyhiZ0NvbG9yKTtcblxuICAvLyA0LiBEZWNpZGUgdGhyZXNob2xkLlxuICAvLyAgICAxMjggaXMgXCI1MCUgZ3JheVwiLCBidXQgdGhhdCBmbGlwcyB0b28gZWFybHkgb24gc2xpZ2h0bHkgZ3JheSBVSXMuXG4gIC8vICAgIFVzZSBhIHN0cmljdGVyIHRocmVzaG9sZCBzbyB3ZSBvbmx5IHRyZWF0IGNsZWFybHkgZGFyayBVSXMgYXMgZGFyay5cbiAgcmV0dXJuIGJyaWdodG5lc3MgPCAxMDU7XG59XG5cbi8qKlxuICogV2Fsa3MgdXAgdGhlIERPTSBmcm9tIGEgZ2l2ZW4gZWxlbWVudCB1bnRpbCBpdCBmaW5kcyBhIG5vbi10cmFuc3BhcmVudCBiYWNrZ3JvdW5kIGNvbG9yLlxuICogRmFsbHMgYmFjayB0byA8aHRtbD4gYW5kIGZpbmFsbHkgdG8gcHVyZSB3aGl0ZS5cbiAqL1xuZnVuY3Rpb24gZ2V0RWZmZWN0aXZlQmFja2dyb3VuZENvbG9yKHN0YXJ0OiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIGxldCBlbDogSFRNTEVsZW1lbnQgfCBudWxsID0gc3RhcnQ7XG5cbiAgY29uc3QgaXNUcmFuc3BhcmVudCA9IChjOiBzdHJpbmcgfCBudWxsKSA9PlxuICAgICFjIHx8IGMgPT09ICd0cmFuc3BhcmVudCcgfHwgYyA9PT0gJ3JnYmEoMCwgMCwgMCwgMCknO1xuXG4gIHdoaWxlIChlbCkge1xuICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWwpO1xuICAgIGNvbnN0IGJnID0gc3R5bGUuYmFja2dyb3VuZENvbG9yO1xuICAgIGlmICghaXNUcmFuc3BhcmVudChiZykpIHJldHVybiBiZztcbiAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gIH1cblxuICAvLyBUcnkgPGh0bWw+IGFzIGEgbGFzdCByZWFsIGVsZW1lbnRcbiAgY29uc3QgaHRtbFN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgY29uc3QgaHRtbEJnID0gaHRtbFN0eWxlLmJhY2tncm91bmRDb2xvcjtcbiAgaWYgKCFpc1RyYW5zcGFyZW50KGh0bWxCZykpIHJldHVybiBodG1sQmc7XG5cbiAgLy8gQWJzb2x1dGUgZmFsbGJhY2s6IGFzc3VtZSB3aGl0ZVxuICByZXR1cm4gJ3JnYigyNTUsIDI1NSwgMjU1KSc7XG59XG5cbi8qKlxuICogSGVscGVyOiBDYWxjdWxhdGVzIGJyaWdodG5lc3MgKDAtMjU1KSBmcm9tIGFuIFJHQihBKSBzdHJpbmcuXG4gKiBVc2VzIHRoZSBIU1AgY29sb3IgZm9ybXVsYTogc3FydCgwLjI5OSpSXjIgKyAwLjU4NypHXjIgKyAwLjExNCpCXjIpXG4gKi9cbmZ1bmN0aW9uIHBhcnNlQnJpZ2h0bmVzcyhyZ2JTdHJpbmc6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IG1hdGNoID0gcmdiU3RyaW5nLm1hdGNoKC8oXFxkKyksXFxzKihcXGQrKSxcXHMqKFxcZCspLyk7XG4gIGlmICghbWF0Y2gpIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBwYXJzZSBpdCwgYXNzdW1lIGJyaWdodCBzbyB3ZSBkb24ndCBhY2NpZGVudGFsbHkgZmxpcCB0byBkYXJrIG1vZGUuXG4gICAgcmV0dXJuIDI1NTtcbiAgfVxuXG4gIGNvbnN0IHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuICBjb25zdCBnID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcbiAgY29uc3QgYiA9IHBhcnNlSW50KG1hdGNoWzNdLCAxMCk7XG5cbiAgLy8gSFNQIGVxdWF0aW9uIGlzIHBlcmNlaXZlZCBicmlnaHRuZXNzXG4gIGNvbnN0IGJyaWdodG5lc3MgPSBNYXRoLnNxcnQoXG4gICAgMC4yOTkgKiAociAqIHIpICtcbiAgICAwLjU4NyAqIChnICogZykgK1xuICAgIDAuMTE0ICogKGIgKiBiKVxuICApO1xuXG4gIHJldHVybiBicmlnaHRuZXNzO1xufVxuXG4vKipcbiAqIFdhdGNoZXI6IE5vdGlmaWVzIHlvdSB3aGVuIHRoZSB0aGVtZSBsaWtlbHkgY2hhbmdlZC5cbiAqXG4gKiBZb3UgY2FuIHVzZSB0aGlzIGlmIHlvdSBldmVyIHdhbnQgdG8gZHluYW1pY2FsbHkgcmUtc3R5bGUgdGhpbmdzXG4gKiB3aGVuIHRoZSB1c2VyIC8gZXh0ZW5zaW9uIHRvZ2dsZXMgdGhlbWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3YXRjaFRoZW1lQ2hhbmdlcyhjYWxsYmFjazogKGlzRGFyazogYm9vbGVhbikgPT4gdm9pZCk6IE11dGF0aW9uT2JzZXJ2ZXIge1xuICBjb25zdCBoYW5kbGVyID0gKCkgPT4ge1xuICAgIGNhbGxiYWNrKGlzUGFnZURhcmsoKSk7XG4gIH07XG5cbiAgY29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihoYW5kbGVyKTtcblxuICAvLyBXYXRjaCBmb3IgYXR0cmlidXRlL2NsYXNzIGNoYW5nZXMgb24gPGh0bWw+IGFuZCA8Ym9keT5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIHtcbiAgICBhdHRyaWJ1dGVzOiB0cnVlLFxuICAgIGF0dHJpYnV0ZUZpbHRlcjogWydkYXRhLWRhcmtyZWFkZXItc2NoZW1lJywgJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgIGF0dHJpYnV0ZXM6IHRydWUsXG4gICAgYXR0cmlidXRlRmlsdGVyOiBbJ3N0eWxlJywgJ2NsYXNzJ10sXG4gIH0pO1xuXG4gIC8vIEFsc28gbGlzdGVuIHRvIHN5c3RlbSB0aGVtZSBjaGFuZ2VzIGFzIGEgYmFja3VwIHNpZ25hbFxuICBpZiAodHlwZW9mIHdpbmRvdy5tYXRjaE1lZGlhID09PSAnZnVuY3Rpb24nKSB7XG4gICAgY29uc3QgbXEgPSB3aW5kb3cubWF0Y2hNZWRpYSgnKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKScpO1xuICAgIGlmIChtcSkge1xuICAgICAgY29uc3QgbXFMaXN0ZW5lciA9ICgpID0+IGhhbmRsZXIoKTtcbiAgICAgIC8vIE1vZGVybiBicm93c2Vyc1xuICAgICAgaWYgKChtcSBhcyBhbnkpLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgbXEuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgbXFMaXN0ZW5lcik7XG4gICAgICB9IGVsc2UgaWYgKChtcSBhcyBhbnkpLmFkZExpc3RlbmVyKSB7XG4gICAgICAgIC8vIExlZ2FjeSBBUElcbiAgICAgICAgKG1xIGFzIGFueSkuYWRkTGlzdGVuZXIobXFMaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSW5pdGlhbCBjYWxsIHNvIHRoZSBjb25zdW1lciBjYW4gc3luYyBpbW1lZGlhdGVseVxuICBoYW5kbGVyKCk7XG5cbiAgcmV0dXJuIG9ic2VydmVyO1xufVxuIiwiLy8gZmlsZXBhdGg6IGVudHJ5cG9pbnRzL2NvbnRlbnQvaW5kZXgudHNcblxuY29uc3QgQ0xBU1NST09NX1VSTF9QQVRURVJOID0gL15odHRwczpcXC9cXC9jbGFzc3Jvb21cXC5nb29nbGVcXC5jb21cXC8vO1xuXG5pbXBvcnQge1xuICBET1dOTE9BRF9JQ09OX1NWR19VUkwsXG4gIFNVQ0NFU1NfSUNPTl9TVkdfVVJMLFxuICBFUlJPUl9JQ09OX1NWR19VUkwsXG59IGZyb20gJy4vaWNvbnMnO1xuXG5pbXBvcnQgeyBpbmplY3RTdHlsZXMgfSBmcm9tICcuL3N0eWxlcyc7XG5pbXBvcnQgeyB0IH0gZnJvbSAnLi9pMThuJztcbmltcG9ydCB7IGlzUGFnZURhcmsgfSBmcm9tICcuL3RoZW1lJztcblxuY29uc3QgSU5KRUNURURfQVRUUiA9ICdkYXRhLWNxZC1pbmplY3RlZCc7XG5jb25zdCBSRVNDQU5fSU5URVJWQUxfTVMgPSAyMDAwO1xuY29uc3QgUkVTQ0FOX0RFQk9VTkNFX01TID0gMjUwO1xuY29uc3QgTE9BRElOR19NSU5fTVMgPSA2MDA7XG5jb25zdCBGRUVEQkFDS19TVUNDRVNTX01TID0gMjAwMDtcbmNvbnN0IEZFRURCQUNLX0VSUk9SX01TID0gNDAwMDtcblxuY29uc3QgRFJJVkVfQU5DSE9SX1NFTEVDVE9SID1cbiAgJ2FbaHJlZio9XCJodHRwczovL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCIvL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCJjbGFzc3Jvb20uZ29vZ2xlLmNvbS9kcml2ZVwiXSc7XG5cbmNvbnN0IEFUVEFDSE1FTlRfQ09OVEFJTkVSX1NFTEVDVE9SID0gW1xuICAnLktsUlhkZicsXG4gICcuejN2UmNjJyxcbiAgJy5WZlBwa2QtYVBQNzhlJyxcbiAgJ1tkYXRhLWRyaXZlLWlkXScsXG4gICdbZGF0YS1pZF1bZGF0YS1pdGVtLWlkXScsXG5dLmpvaW4oJywgJyk7XG5cbmNvbnN0IERSSVZFX1VSTF9QQVRURVJOUzogUmVnRXhwW10gPSBbXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL2ZpbGVcXC9kXFwvLyxcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvb3BlblxcPy8sXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/LyxcbiAgL2h0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcL2RyaXZlXFwvLyxcbl07XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBHbG9iYWwgU3RhdGVcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmxldCBzY2FuVGltZW91dElkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbmxldCBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGwgPSBudWxsO1xuXG50eXBlIEJ1dHRvblN0YXRlID0gJ2lkbGUnIHwgJ2xvYWRpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJyB8ICd0cnlpbmcnO1xuXG50eXBlIEZpbGVNZXRhID0ge1xuICBuYW1lPzogc3RyaW5nO1xuICBleHQ/OiBzdHJpbmc7XG4gIGtpbmQ/OiBzdHJpbmc7XG59O1xuXG50eXBlIFBlbmRpbmdCdXR0b24gPSB7XG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQ7XG4gIHJlcXVlc3RJZDogc3RyaW5nO1xuICBmaWxlTWV0YT86IEZpbGVNZXRhO1xuICBzdGFydGVkQXQ6IG51bWJlcjtcbn07XG5cbmxldCBuZXh0UmVxdWVzdFNlcSA9IDE7XG5jb25zdCBwZW5kaW5nQnV0dG9ucyA9IG5ldyBNYXA8c3RyaW5nLCBQZW5kaW5nQnV0dG9uPigpO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRW52aXJvbm1lbnQgLyBQYWdlIENoZWNrc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaXNHb29nbGVDbGFzc3Jvb20oKTogYm9vbGVhbiB7XG4gIGlmICh0eXBlb2YgbG9jYXRpb24gPT09ICd1bmRlZmluZWQnKSByZXR1cm4gZmFsc2U7XG4gIGlmIChsb2NhdGlvbi5ob3N0bmFtZSAhPT0gJ2NsYXNzcm9vbS5nb29nbGUuY29tJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gQ0xBU1NST09NX1VSTF9QQVRURVJOLnRlc3QobG9jYXRpb24uaHJlZik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTY2FubmluZyAvIE9ic2VydmVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2NoZWR1bGVTY2FuKCk6IHZvaWQge1xuICBpZiAoc2NhblRpbWVvdXRJZCAhPT0gbnVsbCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoc2NhblRpbWVvdXRJZCk7XG4gIH1cbiAgc2NhblRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICBzY2FuVGltZW91dElkID0gbnVsbDtcbiAgICBzY2FuRm9yQXR0YWNobWVudHMoKTtcbiAgfSwgUkVTQ0FOX0RFQk9VTkNFX01TKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBPYnNlcnZlcnMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmICghZG9jdW1lbnQuYm9keSkge1xuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFxuICAgICAgJ0RPTUNvbnRlbnRMb2FkZWQnLFxuICAgICAgKCkgPT4gc2V0dXBPYnNlcnZlcnMoKSxcbiAgICAgIHsgb25jZTogdHJ1ZSB9LFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChvYnNlcnZlcikgcmV0dXJuO1xuXG4gIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgIGNvbnN0IGhhc0NoaWxkTGlzdENoYW5nZSA9IG11dGF0aW9ucy5zb21lKFxuICAgICAgKG0pID0+XG4gICAgICAgIG0udHlwZSA9PT0gJ2NoaWxkTGlzdCcgJiZcbiAgICAgICAgKG0uYWRkZWROb2Rlcy5sZW5ndGggPiAwIHx8IG0ucmVtb3ZlZE5vZGVzLmxlbmd0aCA+IDApLFxuICAgICk7XG4gICAgaWYgKGhhc0NoaWxkTGlzdENoYW5nZSkgc2NoZWR1bGVTY2FuKCk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XG4gIHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiBzY2hlZHVsZVNjYW4oKSwgUkVTQ0FOX0lOVEVSVkFMX01TKTtcbiAgc2NoZWR1bGVTY2FuKCk7XG59XG5cbmZ1bmN0aW9uIHNjYW5Gb3JBdHRhY2htZW50cygpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFNpbmdsZUZpbGVCdXR0b25zKCk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTaW5nbGUtZmlsZSBidXR0b25zXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RTaW5nbGVGaWxlQnV0dG9ucygpOiB2b2lkIHtcbiAgY29uc3QgYW5jaG9ycyA9IEFycmF5LmZyb20oXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQW5jaG9yRWxlbWVudD4oRFJJVkVfQU5DSE9SX1NFTEVDVE9SKSxcbiAgKTtcbiAgZm9yIChjb25zdCBhbmNob3Igb2YgYW5jaG9ycykge1xuICAgIGNvbnN0IHVybCA9IGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IoYW5jaG9yKTtcbiAgICBpZiAoIXVybCkgY29udGludWU7XG4gICAgY29uc3QgY29udGFpbmVyID1cbiAgICAgIChhbmNob3IuY2xvc2VzdChBVFRBQ0hNRU5UX0NPTlRBSU5FUl9TRUxFQ1RPUikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSB8fFxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQgfHxcbiAgICAgIGFuY2hvcjtcbiAgICBpZiAoIWNvbnRhaW5lciB8fCBoYXNJbmplY3RlZEJ1dHRvbihjb250YWluZXIpKSBjb250aW51ZTtcbiAgICBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChjb250YWluZXIsIHVybCk7XG4gIH1cblxuICBjb25zdCBtZXRhRWxlbWVudHMgPSBBcnJheS5mcm9tKFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgICAgJ1tkYXRhLWRyaXZlLWlkXSwgW2RhdGEtaWRdW2RhdGEtaXRlbS1pZF0sIFtkYXRhLWlkXVtkYXRhLXRvb2x0aXBdJyxcbiAgICApLFxuICApO1xuICBmb3IgKGNvbnN0IGVsIG9mIG1ldGFFbGVtZW50cykge1xuICAgIGlmIChoYXNJbmplY3RlZEJ1dHRvbihlbCkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHVybCA9IGZpbmREcml2ZVVybChlbCk7XG4gICAgaWYgKCF1cmwpIGNvbnRpbnVlO1xuICAgIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGVsLCB1cmwpO1xuICB9XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBVUkwgLyBET00gSGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gISFjb250YWluZXIucXVlcnlTZWxlY3RvcihgWyR7SU5KRUNURURfQVRUUn09XCJ0cnVlXCJdYCk7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IoYW5jaG9yOiBIVE1MQW5jaG9yRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBocmVmID0gYW5jaG9yLmhyZWY7XG4gIGlmICghaHJlZikgcmV0dXJuIG51bGw7XG4gIHJldHVybiBEUklWRV9VUkxfUEFUVEVSTlMuc29tZSgocmUpID0+IHJlLnRlc3QoaHJlZikpID8gaHJlZiA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpbmREcml2ZVVybChlbGVtZW50OiBIVE1MRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBuZWFyQW5jaG9yID1cbiAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEFuY2hvckVsZW1lbnQ+KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUikgfHxcbiAgICAoZWxlbWVudC5jbG9zZXN0KERSSVZFX0FOQ0hPUl9TRUxFQ1RPUikgYXMgSFRNTEFuY2hvckVsZW1lbnQgfCBudWxsKTtcblxuICBpZiAobmVhckFuY2hvcikge1xuICAgIGNvbnN0IGhyZWYgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKG5lYXJBbmNob3IpO1xuICAgIGlmIChocmVmKSByZXR1cm4gaHJlZjtcbiAgfVxuXG4gIGNvbnN0IGRyaXZlSWQgPVxuICAgIGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWRyaXZlLWlkJykgfHwgZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKTtcbiAgaWYgKGRyaXZlSWQpIHtcbiAgICByZXR1cm4gdG9Eb3dubG9hZFVybChcbiAgICAgIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICAgICAgICBkcml2ZUlkLFxuICAgICAgKX1gLFxuICAgICk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogRGV0ZWN0cyBjdXJyZW50IHVzZXIgaW5kZXggKDAsIDEsIDIsIC4uLikgdG8gZml4IDQwMy9QZXJtaXNzaW9uIGVycm9yc1xuICovXG5mdW5jdGlvbiBnZXRBdXRoVXNlcigpOiBzdHJpbmcgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gbnVsbDtcblxuICAvLyAxLiBDaGVjayBVUkwgUXVlcnkgUGFyYW0gKD9hdXRodXNlcj0xKVxuICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xuICBpZiAocGFyYW1zLmhhcygnYXV0aHVzZXInKSkgcmV0dXJuIHBhcmFtcy5nZXQoJ2F1dGh1c2VyJyk7XG4gIGlmIChwYXJhbXMuaGFzKCd1JykpIHJldHVybiBwYXJhbXMuZ2V0KCd1Jyk7XG5cbiAgLy8gMi4gQ2hlY2sgVVJMIFBhdGggKC91LzEvLi4uKVxuICBjb25zdCBwYXRoTWF0Y2ggPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUubWF0Y2goL1xcL3VcXC8oXFxkKylcXC8vKTtcbiAgaWYgKHBhdGhNYXRjaCkgcmV0dXJuIHBhdGhNYXRjaFsxXTtcblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gdG9Eb3dubG9hZFVybChvcmlnaW5hbFVybDogc3RyaW5nLCBkZXB0aCA9IDApOiBzdHJpbmcge1xuICBpZiAoZGVwdGggPiAzKSByZXR1cm4gb3JpZ2luYWxVcmw7XG5cbiAgY29uc3QgYXV0aFVzZXIgPSBnZXRBdXRoVXNlcigpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gbmV3IFVSTChvcmlnaW5hbFVybCwgbG9jYXRpb24uaHJlZik7XG5cbiAgICBjb25zdCBhcHBlbmRBdXRoID0gKHU6IHN0cmluZykgPT4ge1xuICAgICAgaWYgKCFhdXRoVXNlcikgcmV0dXJuIHU7XG4gICAgICBjb25zdCBuZXdVID0gbmV3IFVSTCh1KTtcbiAgICAgIGlmICghbmV3VS5zZWFyY2hQYXJhbXMuaGFzKCdhdXRodXNlcicpKSB7XG4gICAgICAgIG5ld1Uuc2VhcmNoUGFyYW1zLnNldCgnYXV0aHVzZXInLCBhdXRoVXNlcik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3VS50b1N0cmluZygpO1xuICAgIH07XG5cbiAgICBpZiAocGFyc2VkLmhvc3RuYW1lID09PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIGlmIChwYXJzZWQucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2F1dGhfd2FybXVwJykpIHtcbiAgICAgICAgY29uc3QgY29udCA9IHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdjb250aW51ZScpO1xuICAgICAgICBpZiAoY29udCkgcmV0dXJuIHRvRG93bmxvYWRVcmwoY29udCwgZGVwdGggKyAxKTtcbiAgICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKTtcbiAgICAgICAgaWYgKGlkKVxuICAgICAgICAgIHJldHVybiBhcHBlbmRBdXRoKFxuICAgICAgICAgICAgYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtpZH1gLFxuICAgICAgICAgICk7XG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKG9yaWdpbmFsVXJsKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZU1hdGNoID0gcGFyc2VkLnBhdGhuYW1lLm1hdGNoKC9eXFwvZmlsZVxcL2RcXC8oW14vXSspLyk7XG4gICAgICBpZiAoZmlsZU1hdGNoKSB7XG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKFxuICAgICAgICAgIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZmlsZU1hdGNoWzFdfWAsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChwYXJzZWQucGF0aG5hbWUgPT09ICcvb3BlbicgfHwgcGFyc2VkLnBhdGhuYW1lID09PSAnL3VjJykge1xuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLnNldCgnZXhwb3J0JywgJ2Rvd25sb2FkJyk7XG4gICAgICAgIGlmIChhdXRoVXNlcikgcGFyc2VkLnNlYXJjaFBhcmFtcy5zZXQoJ2F1dGh1c2VyJywgYXV0aFVzZXIpO1xuICAgICAgICByZXR1cm4gcGFyc2VkLnRvU3RyaW5nKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgcGFyc2VkLmhvc3RuYW1lID09PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nICYmXG4gICAgICBwYXJzZWQucGF0aG5hbWUuc3RhcnRzV2l0aCgnL2RyaXZlJylcbiAgICApIHtcbiAgICAgIGNvbnN0IGlkID1cbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2lkJykgfHxcbiAgICAgICAgcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ3Jlc291cmNlSWQnKSB8fFxuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnZmlsZUlkJyk7XG4gICAgICBpZiAoaWQpXG4gICAgICAgIHJldHVybiBhcHBlbmRBdXRoKFxuICAgICAgICAgIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7aWR9YCxcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXBwZW5kQXV0aChvcmlnaW5hbFVybCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBvcmlnaW5hbFVybDtcbiAgfVxufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogRmlsZSBtZXRhZGF0YSBleHRyYWN0aW9uXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBjbGVhbkF0dGFjaG1lbnROYW1lKHJhd05hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghcmF3TmFtZSkgcmV0dXJuICcnO1xuICBsZXQgbmFtZSA9IHJhd05hbWUudHJpbSgpO1xuXG4gIGNvbnN0IGdhcmJhZ2VMYWJlbHMgPSBbXG4gICAgJ01pY3Jvc29mdCBFeGNlbCcsXG4gICAgJ01pY3Jvc29mdCBXb3JkJyxcbiAgICAnTWljcm9zb2Z0IFBvd2VyUG9pbnQnLFxuICAgICdDb21wcmVzc2VkIGFyY2hpdmUnLFxuICAgICdCaW5hcnknLFxuICAgICdVbmtub3duJyxcbiAgICAnR29vZ2xlIFNoZWV0cycsXG4gICAgJ0dvb2dsZSBEb2NzJyxcbiAgICAnR29vZ2xlIFNsaWRlcycsXG4gICAgJ1RleHQgRmlsZScsXG4gICAgJ1BERicsXG4gICAgJ1ZpZGVvJyxcbiAgICAnSW1hZ2UnLFxuICAgICdBdWRpbycsXG4gICAgJ1RleHQnLFxuICAgICdXb3JkJyxcbiAgICAnRXhjZWwnLFxuICAgICdQb3dlclBvaW50JyxcbiAgICAnQXJjaGl2ZScsXG4gICAgJ1ppcCcsXG4gICAgJ0ZpbGUnLFxuICAgICdEb2N1bWVudCcsXG4gICAgJ1Nob3J0Y3V0JyxcbiAgICAnQ29kZScsXG4gIF07XG5cbiAgZm9yIChjb25zdCBsYWJlbCBvZiBnYXJiYWdlTGFiZWxzKSB7XG4gICAgaWYgKG5hbWUuZW5kc1dpdGgobGFiZWwpKSB7XG4gICAgICBjb25zdCBwb3RlbnRpYWwgPSBuYW1lLnNsaWNlKDAsIC1sYWJlbC5sZW5ndGgpLnRyaW0oKTtcbiAgICAgIGlmIChwb3RlbnRpYWwubGVuZ3RoID4gMCkge1xuICAgICAgICBuYW1lID0gcG90ZW50aWFsO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBEZWR1cGxpY2F0ZSBlLmcuIFwiZmlsZWZpbGVcIlxuICBpZiAobmFtZS5sZW5ndGggPiAwICYmIG5hbWUubGVuZ3RoICUgMiA9PT0gMCkge1xuICAgIGNvbnN0IG1pZCA9IG5hbWUubGVuZ3RoIC8gMjtcbiAgICBjb25zdCBmaXJzdEhhbGYgPSBuYW1lLnNsaWNlKDAsIG1pZCk7XG4gICAgY29uc3Qgc2Vjb25kSGFsZiA9IG5hbWUuc2xpY2UobWlkKTtcbiAgICBpZiAoZmlyc3RIYWxmID09PSBzZWNvbmRIYWxmKSB7XG4gICAgICByZXR1cm4gZmlyc3RIYWxmO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHJlcGVhdFJlZ2V4ID0gL1xcLihbYS16QS1aMC05XXsyLDEwfSlcXDEkL2k7XG4gIGNvbnN0IHJlcGVhdE1hdGNoID0gbmFtZS5tYXRjaChyZXBlYXRSZWdleCk7XG4gIGlmIChyZXBlYXRNYXRjaCkge1xuICAgIHJldHVybiBuYW1lLnNsaWNlKDAsIC1yZXBlYXRNYXRjaFsxXS5sZW5ndGgpLnRyaW0oKTtcbiAgfVxuXG4gIHJldHVybiBuYW1lO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0RmlsZU1ldGEoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdXJsOiBzdHJpbmcpOiBGaWxlTWV0YSB7XG4gIGxldCBuYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgY29uc3QgdG9vbHRpcCA9XG4gICAgY29udGFpbmVyLmdldEF0dHJpYnV0ZSgnZGF0YS10b29sdGlwJykgfHxcbiAgICBjb250YWluZXIuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHxcbiAgICBjb250YWluZXIuZ2V0QXR0cmlidXRlKCd0aXRsZScpO1xuXG4gIGlmICh0b29sdGlwICYmIHRvb2x0aXAudHJpbSgpKSBuYW1lID0gdG9vbHRpcC50cmltKCk7XG5cbiAgaWYgKCFuYW1lKSB7XG4gICAgY29uc3QgdGV4dCA9IChjb250YWluZXIudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKTtcbiAgICBpZiAodGV4dCkge1xuICAgICAgY29uc3QgbGluZXMgPSB0ZXh0XG4gICAgICAgIC5zcGxpdCgnXFxuJylcbiAgICAgICAgLm1hcCgobCkgPT4gbC50cmltKCkpXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBpZiAobGluZXMubGVuZ3RoID4gMCkgbmFtZSA9IGxpbmVzWzBdO1xuICAgIH1cbiAgfVxuXG4gIGlmICghbmFtZSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1ID0gbmV3IFVSTCh1cmwpO1xuICAgICAgY29uc3QgcGF0aE5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQodS5wYXRobmFtZS5zcGxpdCgnLycpLnBvcCgpIHx8ICcnKTtcbiAgICAgIGlmIChwYXRoTmFtZSAmJiBwYXRoTmFtZS5pbmNsdWRlcygnLicpKSBuYW1lID0gcGF0aE5hbWU7XG4gICAgfSBjYXRjaCB7fVxuICB9XG5cbiAgaWYgKG5hbWUpIG5hbWUgPSBjbGVhbkF0dGFjaG1lbnROYW1lKG5hbWUpO1xuXG4gIGxldCBleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgaWYgKG5hbWUpIHtcbiAgICBjb25zdCBtID0gbmFtZS5tYXRjaCgvXFwuKFthLXpBLVowLTldezIsMTB9KSQvKTtcbiAgICBpZiAobSkgZXh0ID0gbVsxXS50b0xvd2VyQ2FzZSgpO1xuICB9XG5cbiAgbGV0IGtpbmQ6IHN0cmluZyA9ICdvdGhlcic7XG4gIGlmIChleHQpIHtcbiAgICBzd2l0Y2ggKGV4dCkge1xuICAgICAgY2FzZSAncGRmJzpcbiAgICAgICAga2luZCA9ICdwZGYnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RvYyc6XG4gICAgICBjYXNlICdkb2N4JzpcbiAgICAgIGNhc2UgJ3R4dCc6XG4gICAgICBjYXNlICdydGYnOlxuICAgICAgY2FzZSAnb2R0JzpcbiAgICAgIGNhc2UgJ21kJzpcbiAgICAgIGNhc2UgJ3RleCc6XG4gICAgICBjYXNlICdjbHMnOlxuICAgICAgY2FzZSAnZW1seCc6XG4gICAgICAgIGtpbmQgPSAnZG9jJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd4bHMnOlxuICAgICAgY2FzZSAneGxzeCc6XG4gICAgICBjYXNlICdjc3YnOlxuICAgICAgY2FzZSAnb2RzJzpcbiAgICAgIGNhc2UgJ251bWJlcnMnOlxuICAgICAgICBraW5kID0gJ3NoZWV0JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdwcHQnOlxuICAgICAgY2FzZSAncHB0eCc6XG4gICAgICBjYXNlICdvZHAnOlxuICAgICAgY2FzZSAna2V5JzpcbiAgICAgICAga2luZCA9ICdzbGlkZSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnanBnJzpcbiAgICAgIGNhc2UgJ2pwZWcnOlxuICAgICAgY2FzZSAncG5nJzpcbiAgICAgIGNhc2UgJ2dpZic6XG4gICAgICBjYXNlICd3ZWJwJzpcbiAgICAgIGNhc2UgJ3N2Zyc6XG4gICAgICBjYXNlICdibXAnOlxuICAgICAgY2FzZSAnaWNvJzpcbiAgICAgIGNhc2UgJ2F2aWYnOlxuICAgICAgY2FzZSAnZmlnJzpcbiAgICAgIGNhc2UgJ3BzZCc6XG4gICAgICBjYXNlICdhaSc6XG4gICAgICAgIGtpbmQgPSAnaW1hZ2UnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ21wNCc6XG4gICAgICBjYXNlICdtb3YnOlxuICAgICAgY2FzZSAnYXZpJzpcbiAgICAgIGNhc2UgJ21rdic6XG4gICAgICBjYXNlICd3ZWJtJzpcbiAgICAgIGNhc2UgJ2Zsdic6XG4gICAgICBjYXNlICd3bXYnOlxuICAgICAgY2FzZSAnbTR2JzpcbiAgICAgICAga2luZCA9ICd2aWRlbyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbXAzJzpcbiAgICAgIGNhc2UgJ3dhdic6XG4gICAgICBjYXNlICdvZ2cnOlxuICAgICAgY2FzZSAnbTRhJzpcbiAgICAgIGNhc2UgJ2ZsYWMnOlxuICAgICAgY2FzZSAnYWFjJzpcbiAgICAgICAga2luZCA9ICdhdWRpbyc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnemlwJzpcbiAgICAgIGNhc2UgJ3Jhcic6XG4gICAgICBjYXNlICc3eic6XG4gICAgICBjYXNlICd0YXInOlxuICAgICAgY2FzZSAnZ3onOlxuICAgICAgY2FzZSAnaXNvJzpcbiAgICAgIGNhc2UgJ2RtZyc6XG4gICAgICBjYXNlICdwa2cnOlxuICAgICAgY2FzZSAnbWh0JzpcbiAgICAgICAga2luZCA9ICdhcmNoaXZlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdodG1sJzpcbiAgICAgIGNhc2UgJ2h0bSc6XG4gICAgICBjYXNlICd4bWwnOlxuICAgICAgY2FzZSAnY3NzJzpcbiAgICAgIGNhc2UgJ2pzJzpcbiAgICAgIGNhc2UgJ3RzJzpcbiAgICAgIGNhc2UgJ2pzeCc6XG4gICAgICBjYXNlICd0c3gnOlxuICAgICAgY2FzZSAnanNvbic6XG4gICAgICBjYXNlICdwaHAnOlxuICAgICAgY2FzZSAnc3FsJzpcbiAgICAgIGNhc2UgJ3B5JzpcbiAgICAgIGNhc2UgJ2MnOlxuICAgICAgY2FzZSAnY3BwJzpcbiAgICAgIGNhc2UgJ2NzJzpcbiAgICAgIGNhc2UgJ2phdmEnOlxuICAgICAgY2FzZSAncmInOlxuICAgICAgY2FzZSAnZ28nOlxuICAgICAgY2FzZSAnc2gnOlxuICAgICAgY2FzZSAnYmF0JzpcbiAgICAgIGNhc2UgJ2lweW5iJzpcbiAgICAgIGNhc2UgJ3BrdCc6XG4gICAgICBjYXNlICdsb2NrJzpcbiAgICAgIGNhc2UgJ3ltbCc6XG4gICAgICBjYXNlICd5YW1sJzpcbiAgICAgICAga2luZCA9ICdjb2RlJztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd0dGYnOlxuICAgICAgY2FzZSAnb3RmJzpcbiAgICAgIGNhc2UgJ3dvZmYnOlxuICAgICAgY2FzZSAnd29mZjInOlxuICAgICAgY2FzZSAnZW90JzpcbiAgICAgICAga2luZCA9ICdmb250JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdleGUnOlxuICAgICAgY2FzZSAnbXNpJzpcbiAgICAgIGNhc2UgJ2Fwayc6XG4gICAgICBjYXNlICdhcHAnOlxuICAgICAgY2FzZSAnamFyJzpcbiAgICAgIGNhc2UgJ2RsbCc6XG4gICAgICBjYXNlICdwZGInOlxuICAgICAgY2FzZSAnbG5rJzpcbiAgICAgIGNhc2UgJ2RhdCc6XG4gICAgICBjYXNlICdzcWxpdGUnOlxuICAgICAgY2FzZSAnZGInOlxuICAgICAgY2FzZSAnZHJhd2lvJzpcbiAgICAgIGNhc2UgJ2RtcCc6XG4gICAgICAgIGtpbmQgPSAnYmluYXJ5JztcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBraW5kID0gJ290aGVyJztcbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBuYW1lLCBleHQsIGtpbmQgfTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEJ1dHRvbiBpbmplY3Rpb25cbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHVybDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghdXJsKSByZXR1cm47XG4gIGNvbnN0IGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoY29udGFpbmVyKTtcbiAgaWYgKGNvbXB1dGVkLnBvc2l0aW9uID09PSAnc3RhdGljJykgY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcblxuICBjb25zdCBkaXJlY3RVcmwgPSB0b0Rvd25sb2FkVXJsKHVybCk7XG4gIGNvbnN0IGZpbGVNZXRhID0gZXh0cmFjdEZpbGVNZXRhKGNvbnRhaW5lciwgZGlyZWN0VXJsKTtcbiAgY29uc3QgYnV0dG9uID0gY3JlYXRlRG93bmxvYWRCdXR0b24oY29udGFpbmVyLCBkaXJlY3RVcmwsIGZpbGVNZXRhKTtcblxuICBjb25zdCBpY29uRWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBpZiAoaWNvbkVsKSBpY29uRWwuY2xhc3NMaXN0LmFkZCgnY3FkLWljb24tbWVkaXVtJyk7XG5cbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1dHRvbik7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gc3RhdGUgaGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZ2V0QnV0dG9uU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCk6IEJ1dHRvblN0YXRlIHtcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1sb2FkaW5nJykpIHJldHVybiAnbG9hZGluZyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtdHJ5aW5nJykpIHJldHVybiAndHJ5aW5nJztcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1zdWNjZXNzJykpIHJldHVybiAnc3VjY2Vzcyc7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtZXJyb3InKSkgcmV0dXJuICdlcnJvcic7XG4gIHJldHVybiAnaWRsZSc7XG59XG5cblxuZnVuY3Rpb24gc2V0QnV0dG9uU3RhdGUoXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIHN0YXRlOiBCdXR0b25TdGF0ZSxcbiAgb3B0aW9ucz86IHsgdXNlck1lc3NhZ2U/OiBzdHJpbmcgfSxcbik6IHZvaWQge1xuICBjb25zdCBpY29uID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWRvd25sb2FkLWljb24nKTtcbiAgY29uc3QgbGFiZWwgPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MU3BhbkVsZW1lbnQ+KCcuY3FkLWxhYmVsJyk7XG4gIGNvbnN0IGVycm9yRGV0YWlsID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTFNwYW5FbGVtZW50PignLmNxZC1lcnJvci1kZXRhaWwnKTtcbiAgaWYgKCFpY29uIHx8ICFsYWJlbCB8fCAhZXJyb3JEZXRhaWwpIHJldHVybjtcblxuICAvLyBSZXNldCB0byBpZGxlIGJhc2VsaW5lXG4gIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdjcWQtbG9hZGluZycsICdjcWQtdHJ5aW5nJywgJ2NxZC1zdWNjZXNzJywgJ2NxZC1lcnJvcicpO1xuICBpY29uLmNsYXNzTGlzdC5yZW1vdmUoJ2NxZC1zcGlubmVyJyk7XG4gIGljb24udGV4dENvbnRlbnQgPSAnJztcbiAgYnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XG4gIGJ1dHRvbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJzsgLy8gQ2xlYXIgbWFudWFsIEJHIHRvIGxldCBDU1MgdmFyaWFibGVzIHdvcmtcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZCcpO1xuICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9ICcnO1xuXG4gIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKWA7XG4gIGljb24uc3R5bGUuYmFja2dyb3VuZFNpemUgPSAnJztcblxuICBzd2l0Y2ggKHN0YXRlKSB7XG4gICAgY2FzZSAnaWRsZSc6XG4gICAgICAvLyBBbHJlYWR5IHJlc2V0IGFib3ZlXG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2xvYWRpbmcnOlxuICAgIGNhc2UgJ3RyeWluZyc6IHtcbiAgICAgIGNvbnN0IGlzVHJ5aW5nID0gc3RhdGUgPT09ICd0cnlpbmcnO1xuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoaXNUcnlpbmcgPyAnY3FkLXRyeWluZycgOiAnY3FkLWxvYWRpbmcnKTtcbiAgICAgIGJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9IGlzVHJ5aW5nID8gdCgndHJ5aW5nJykgOiB0KCdkb3dubG9hZGluZycpO1xuICAgICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3Bpbm5lcicpO1xuICAgICAgaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnbm9uZSc7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBjYXNlICdzdWNjZXNzJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3VjY2VzcycpO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZGVkJyk7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9IGB1cmwoXCIke1NVQ0NFU1NfSUNPTl9TVkdfVVJMfVwiKWA7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRTaXplID0gJzIwcHggMjBweCc7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtZXJyb3InKTtcbiAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gdCgnZXJyb3InKTtcbiAgICAgIGljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gYHVybChcIiR7RVJST1JfSUNPTl9TVkdfVVJMfVwiKWA7XG4gICAgICBpY29uLnN0eWxlLmJhY2tncm91bmRTaXplID0gJzIwcHggMjBweCc7XG4gICAgICBlcnJvckRldGFpbC50ZXh0Q29udGVudCA9IG9wdGlvbnM/LnVzZXJNZXNzYWdlIHx8IHQoJ2ZhaWxlZCcpO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuXG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCdXR0b24gZmFjdG9yeVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gY3JlYXRlRG93bmxvYWRCdXR0b24oXG4gIF9jb250YWluZXI6IEhUTUxFbGVtZW50LFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuICBjb25zdCBidXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgYnV0dG9uLmNsYXNzTmFtZSA9ICdjcWQtZG93bmxvYWQtYnRuJztcbiAgXG4gIC8vIFRIRU1FIENIRUNLOiBBcHBseSBkYXJrIG1vZGUgY2xhc3MgaWYgbmVlZGVkXG4gIGlmIChpc1BhZ2VEYXJrKCkpIHtcbiAgICBidXR0b24uY2xhc3NMaXN0LmFkZCgnY3FkLXRoZW1lLWRhcmsnKTtcbiAgfVxuXG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoSU5KRUNURURfQVRUUiwgJ3RydWUnKTtcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGAke3QoJ2FyaWFEb3dubG9hZCcpfSAke2ZpbGVNZXRhLm5hbWUgfHwgJyd9YCk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgdCgndGl0bGVRdWljaycpKTtcblxuICBjb25zdCBpY29uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvbldyYXBwZXIuY2xhc3NOYW1lID0gJ2NxZC1pY29uLXdyYXBwZXInO1xuICBjb25zdCBpY29uU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvblNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1pY29uJztcbiAgaWNvbldyYXBwZXIuYXBwZW5kQ2hpbGQoaWNvblNwYW4pO1xuXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBsYWJlbC5jbGFzc05hbWUgPSAnY3FkLWxhYmVsJztcbiAgbGFiZWwudGV4dENvbnRlbnQgPSB0KCdkb3dubG9hZCcpO1xuXG4gIGNvbnN0IGVycm9yRGV0YWlsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBlcnJvckRldGFpbC5jbGFzc05hbWUgPSAnY3FkLWVycm9yLWRldGFpbCc7XG5cbiAgYnV0dG9uLmFwcGVuZENoaWxkKGljb25XcmFwcGVyKTtcbiAgYnV0dG9uLmFwcGVuZENoaWxkKGxhYmVsKTtcbiAgYnV0dG9uLmFwcGVuZENoaWxkKGVycm9yRGV0YWlsKTtcblxuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoZSkgPT4ge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGF3YWl0IGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soYnV0dG9uLCB1cmwsIGZpbGVNZXRhKTtcbiAgfSk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2F1eGNsaWNrJywgYXN5bmMgKGUpID0+IHtcbiAgICBpZiAoZS5idXR0b24gIT09IDEpIHJldHVybjtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBhd2FpdCBoYW5kbGVTaW5nbGVEb3dubG9hZENsaWNrKGJ1dHRvbiwgdXJsLCBmaWxlTWV0YSk7XG4gIH0pO1xuXG4gIHJldHVybiBidXR0b247XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBEb3dubG9hZCBjbGljayBoYW5kbGVyICh1cGRhdGVkIHRvIHJlbHkgb24gYmFja2dyb3VuZClcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNpbmdsZURvd25sb2FkQ2xpY2soXG4gIGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQsXG4gIHVybDogc3RyaW5nLFxuICBmaWxlTWV0YTogRmlsZU1ldGEsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF1cmwpIHJldHVybjtcbiAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdpZGxlJykgcmV0dXJuO1xuXG4gIGNvbnN0IHJlcXVlc3RJZCA9IGBjcWQtJHtEYXRlLm5vdygpfS0ke25leHRSZXF1ZXN0U2VxKyt9YDtcbiAgY29uc3Qgc3RhcnRlZEF0ID0gRGF0ZS5ub3coKTtcblxuICAvLyBSZWdpc3RlciB0aGlzIGJ1dHRvbiBzbyBiYWNrZ3JvdW5kIGNhbiB1cGRhdGUgaXQgdmlhIG1lc3NhZ2VzXG4gIHBlbmRpbmdCdXR0b25zLnNldChyZXF1ZXN0SWQsIHtcbiAgICBidXR0b24sXG4gICAgcmVxdWVzdElkLFxuICAgIGZpbGVNZXRhLFxuICAgIHN0YXJ0ZWRBdCxcbiAgfSk7XG5cbiAgLy8gSW1tZWRpYXRlbHkgc2hvdyBsb2FkaW5nXG4gIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2xvYWRpbmcnKTtcblxuICBjb25zdCBzdGFydFJlc3VsdCA9IGF3YWl0IHN0YXJ0QmFja2dyb3VuZERvd25sb2FkKHJlcXVlc3RJZCwgdXJsLCBmaWxlTWV0YSk7XG5cbiAgaWYgKCFzdGFydFJlc3VsdC5vaykge1xuICAgIC8vIENvdWxkIG5vdCBldmVuIHN0YXJ0IHRoZSBkb3dubG9hZFxuICAgIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgIGF3YWl0IGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0KTtcbiAgICBhd2FpdCBzaG93RXJyb3JTdGF0ZShidXR0b24sIHN0YXJ0UmVzdWx0LnVzZXJNZXNzYWdlKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBJZiB0aGUgZG93bmxvYWQgc3RhcnRlZCwga2VlcCB0aGUgYnV0dG9uIGluIFwibG9hZGluZ1wiLlxuICAvLyBUaGUgYmFja2dyb3VuZCBzY3JpcHQgd2lsbCBzZW5kIENRRF9ET1dOTE9BRF9TVEFUVVMgd2l0aCBlaXRoZXJcbiAgLy8gXCJzdWNjZXNzXCIgb3IgXCJlcnJvclwiIHdoZW4gaXQga25vd3MgdGhlIGZpbmFsIHJlc3VsdC5cbn1cblxuZnVuY3Rpb24gc3RhcnRCYWNrZ3JvdW5kRG93bmxvYWQoXG4gIHJlcXVlc3RJZDogc3RyaW5nLFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE6IEZpbGVNZXRhLFxuKTogUHJvbWlzZTx7IG9rOiBib29sZWFuOyB1c2VyTWVzc2FnZT86IHN0cmluZyB9PiB7XG4gIGNvbnN0IGZpbmFsVXJsID0gdG9Eb3dubG9hZFVybCh1cmwpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBpZiAodHlwZW9mIGNocm9tZSA9PT0gJ3VuZGVmaW5lZCcgfHwgIWNocm9tZS5ydW50aW1lPy5zZW5kTWVzc2FnZSkge1xuICAgICAgcmVzb2x2ZSh7IG9rOiBmYWxzZSwgdXNlck1lc3NhZ2U6ICdFeHRlbnNpb24gcnVudGltZSBub3QgYXZhaWxhYmxlLicgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShcbiAgICAgICAgeyB0eXBlOiAnQ1FEX0RPV05MT0FEJywgdXJsOiBmaW5hbFVybCwgcmVxdWVzdElkLCBmaWxlTWV0YSB9LFxuICAgICAgICAocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yIHx8ICFyZXNwb25zZSB8fCByZXNwb25zZS5zdGFydGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgdXNlck1lc3NhZ2U6IHJlc3BvbnNlPy51c2VyTWVzc2FnZSB8fCAnQ291bGQgbm90IHN0YXJ0IGRvd25sb2FkLicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzb2x2ZSh7IG9rOiB0cnVlIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXNvbHZlKHsgb2s6IGZhbHNlLCB1c2VyTWVzc2FnZTogJ0V4dGVuc2lvbiBjb21tdW5pY2F0aW9uIGVycm9yLicgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFVJIFV0aWxzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5hc3luYyBmdW5jdGlvbiBzaG93RXJyb3JTdGF0ZShcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgdXNlck1lc3NhZ2U/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnZXJyb3InLCB7IHVzZXJNZXNzYWdlIH0pO1xuICBjb25zdCBlYXJsaWVzdFJlc2V0ID0gRGF0ZS5ub3coKSArIEZFRURCQUNLX0VSUk9SX01TO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGF3YWl0IGRlbGF5KDIwMCk7XG4gICAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgIT09ICdlcnJvcicpIHJldHVybjtcbiAgICBpZiAoRGF0ZS5ub3coKSA8IGVhcmxpZXN0UmVzZXQpIGNvbnRpbnVlO1xuICAgIGlmICghYnV0dG9uLm1hdGNoZXMoJzpob3ZlcicpKSB7XG4gICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdpZGxlJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZU1pbkxvYWRpbmcoc3RhcnRlZEF0OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydGVkQXQ7XG4gIGlmIChlbGFwc2VkIDwgTE9BRElOR19NSU5fTVMpIGF3YWl0IGRlbGF5KExPQURJTkdfTUlOX01TIC0gZWxhcHNlZCk7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogTGlzdGVuIGZvciBiYWNrZ3JvdW5kIHN0YXR1cyB1cGRhdGVzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pZiAodHlwZW9mIGNocm9tZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hyb21lLnJ1bnRpbWU/Lm9uTWVzc2FnZSkge1xuICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS50eXBlICE9PSAnQ1FEX0RPV05MT0FEX1NUQVRVUycpIHJldHVybjtcblxuICAgIGNvbnN0IHJlcXVlc3RJZCA9IG1lc3NhZ2UucmVxdWVzdElkIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIXJlcXVlc3RJZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgcGVuZGluZyA9IHBlbmRpbmdCdXR0b25zLmdldChyZXF1ZXN0SWQpO1xuICAgIGlmICghcGVuZGluZykgcmV0dXJuO1xuXG4gICAgY29uc3QgeyBidXR0b24sIHN0YXJ0ZWRBdCB9ID0gcGVuZGluZztcblxuICAgICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgZW5zdXJlTWluTG9hZGluZyhzdGFydGVkQXQpO1xuXG4gICAgICAgICAgICBjb25zdCBzdGF0dXMgPSBtZXNzYWdlLnN0YXR1cyBhc1xuICAgICAgICB8IEJ1dHRvblN0YXRlXG4gICAgICAgIHwgJ2Jsb2NrZWRfaHRtbCdcbiAgICAgICAgfCAnaW50ZXJydXB0ZWQnXG4gICAgICAgIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgZXJyb3JDb2RlID0gbWVzc2FnZS5lcnJvckNvZGUgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgICAgY29uc3QgdXNlck1lc3NhZ2UgPSBtZXNzYWdlLnVzZXJNZXNzYWdlIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcblxuICAgICAgLy8gVFJZSU5HIFBBVEggKG5vbi1kaXJlY3QgZmxvd3M6IGF1dGh1c2VyIGxvb3AgLyB2aXJ1cyBieXBhc3MpXG4gICAgICBpZiAoc3RhdHVzID09PSAndHJ5aW5nJykge1xuICAgICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICd0cnlpbmcnLCB7IHVzZXJNZXNzYWdlIH0pO1xuICAgICAgICAvLyBLZWVwIGl0IHBlbmRpbmcgc28gbGF0ZXIgXCJzdWNjZXNzXCIgY2FuIG92ZXJyaWRlXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gU1VDQ0VTUyBQQVRIXG4gICAgICBpZiAoc3RhdHVzID09PSAnc3VjY2VzcycgfHwgc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgIHBlbmRpbmdCdXR0b25zLmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgICAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdzdWNjZXNzJyk7XG4gICAgICAgIGF3YWl0IGRlbGF5KEZFRURCQUNLX1NVQ0NFU1NfTVMpO1xuICAgICAgICBpZiAoZ2V0QnV0dG9uU3RhdGUoYnV0dG9uKSA9PT0gJ3N1Y2Nlc3MnKSB7XG4gICAgICAgICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnaWRsZScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gRVJST1IgUEFUSFNcbiAgICAgIGlmIChcbiAgICAgICAgc3RhdHVzID09PSAnZXJyb3InIHx8XG4gICAgICAgIHN0YXR1cyA9PT0gJ2ludGVycnVwdGVkJyB8fFxuICAgICAgICBzdGF0dXMgPT09ICdibG9ja2VkX2h0bWwnXG4gICAgICApIHtcbiAgICAgICAgLy8gQVVUSF9DSEVDSyBlcnJvcnMgYXJlIFwic29mdFwiOiB3ZSBtaWdodCBzdGlsbCBmbGlwIHRvIHN1Y2Nlc3MgbGF0ZXJcbiAgICAgICAgaWYgKGVycm9yQ29kZSA9PT0gJ0FVVEhfQ0hFQ0snKSB7XG4gICAgICAgICAgYXdhaXQgc2hvd0Vycm9yU3RhdGUoYnV0dG9uLCB1c2VyTWVzc2FnZSk7XG4gICAgICAgICAgLy8gS2VlcCBwZW5kaW5nQnV0dG9ucyBzbyBsYXRlciBcInN1Y2Nlc3NcIiBjYW4gb3ZlcnJpZGVcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBbnkgb3RoZXIgZXJyb3IgaXMgZmluYWxcbiAgICAgICAgcGVuZGluZ0J1dHRvbnMuZGVsZXRlKHJlcXVlc3RJZCk7XG4gICAgICAgIGF3YWl0IHNob3dFcnJvclN0YXRlKGJ1dHRvbiwgdXNlck1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgfSkoKTtcbiAgfSk7XG59XG5cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEVudHJ5XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbml0Q29udGVudFNjcmlwdCgpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGluamVjdFN0eWxlcygpO1xuICBzZXR1cE9ic2VydmVycygpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL2NsYXNzcm9vbS5nb29nbGUuY29tLyonXSxcbiAgcnVuQXQ6ICdkb2N1bWVudF9pZGxlJyxcbiAgbWFpbigpIHtcbiAgICBpbml0Q29udGVudFNjcmlwdCgpO1xuICB9LFxufSk7IiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ0NPLFFBQU0sd0JBQXdCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFTOUIsUUFBTSx1QkFBdUI7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBVTdCLFFBQU0scUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVEzQixRQUFNLHdCQUF3QiwyQkFBMkI7QUFBQSxJQUM5RDtBQUFBLEVBQ0YsQ0FBQztBQUVNLFFBQU0sdUJBQXVCLDJCQUEyQjtBQUFBLElBQzdEO0FBQUEsRUFDRixDQUFDO0FBRU0sUUFBTSxxQkFBcUIsMkJBQTJCO0FBQUEsSUFDM0Q7QUFBQSxFQUNGLENBQUM7QUNyQ0QsUUFBTSxXQUFXO0FBQ2pCLFFBQU0sa0JBQWtCO0FBR3hCLFFBQU0sZ0JBQWdCO0FBQ3RCLFFBQU0saUJBQWlCLEdBQUcsYUFBYTtBQUVoQyxXQUFTLGVBQXFCO0FBQ25DLFFBQUksT0FBTyxhQUFhLFlBQWE7QUFDckMsUUFBSSxTQUFTLGVBQWUsUUFBUSxFQUFHO0FBRXZDLFVBQU0sUUFBUSxTQUFTLGNBQWMsT0FBTztBQUM1QyxVQUFNLEtBQUs7QUFDWCxVQUFNLGNBQWM7QUFBQTtBQUFBLDBCQUVJLGNBQWM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSwrQkF5S1QscUJBQXFCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQXdKckMsZUFBZTtBQUFBLGdCQUNkLGVBQWU7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7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QTtBQUNBLFFBQUEsTUFBQTtBQUNFLFlBQUEsSUFBQSxLQUFBLE1BQUEsd0JBQUE7QUFDQSxVQUFBLEVBQUEsT0FBQSxFQUFBLENBQUEsRUFBQSxZQUFBO0FBQUEsSUFBOEI7QUFHaEMsUUFBQSxPQUFBO0FBQ0EsUUFBQSxLQUFBO0FBQ0UsY0FBQSxLQUFBO0FBQUEsUUFBYSxLQUFBO0FBRVQsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDRyxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBRUgsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDRyxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBRUgsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBLEtBQUE7QUFBQSxRQUNHLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFBQSxRQUNBLEtBQUE7QUFFSCxpQkFBQTtBQUNBO0FBQUEsUUFBQSxLQUFBO0FBQUEsUUFDRyxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBQUEsUUFDQSxLQUFBO0FBRUgsaUJBQUE7QUFDQTtBQUFBLFFBQUEsS0FBQTtBQUFBLFFBQ0csS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUFBLFFBQ0EsS0FBQTtBQUVILGlCQUFBO0FBQ0E7QUFBQSxRQUFBO0FBRUEsaUJBQUE7QUFBQSxNQUFPO0FBQUEsSUFDWDtBQUdGLFdBQUEsRUFBQSxNQUFBLEtBQUEsS0FBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLDJCQUFBLFdBQUEsS0FBQTtBQUNFLFFBQUEsQ0FBQSxJQUFBO0FBQ0EsVUFBQSxXQUFBLE9BQUEsaUJBQUEsU0FBQTtBQUNBLFFBQUEsU0FBQSxhQUFBLFNBQUEsV0FBQSxNQUFBLFdBQUE7QUFFQSxVQUFBLFlBQUEsY0FBQSxHQUFBO0FBQ0EsVUFBQSxXQUFBLGdCQUFBLFdBQUEsU0FBQTtBQUNBLFVBQUEsU0FBQSxxQkFBQSxXQUFBLFdBQUEsUUFBQTtBQUVBLFVBQUEsU0FBQSxPQUFBLGNBQUEsb0JBQUE7QUFDQSxRQUFBLE9BQUEsUUFBQSxVQUFBLElBQUEsaUJBQUE7QUFFQSxjQUFBLFlBQUEsTUFBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLGVBQUEsUUFBQTtBQUNFLFFBQUEsT0FBQSxVQUFBLFNBQUEsYUFBQSxFQUFBLFFBQUE7QUFDQSxRQUFBLE9BQUEsVUFBQSxTQUFBLFlBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxPQUFBLFVBQUEsU0FBQSxhQUFBLEVBQUEsUUFBQTtBQUNBLFFBQUEsT0FBQSxVQUFBLFNBQUEsV0FBQSxFQUFBLFFBQUE7QUFDQSxXQUFBO0FBQUEsRUFDRjtBQUdBLFdBQUEsZUFBQSxRQUFBLE9BQUEsU0FBQTtBQUtFLFVBQUEsT0FBQSxPQUFBLGNBQUEsb0JBQUE7QUFDQSxVQUFBLFFBQUEsT0FBQSxjQUFBLFlBQUE7QUFDQSxVQUFBLGNBQUEsT0FBQSxjQUFBLG1CQUFBO0FBQ0EsUUFBQSxDQUFBLFFBQUEsQ0FBQSxTQUFBLENBQUEsWUFBQTtBQUdBLFdBQUEsVUFBQSxPQUFBLGVBQUEsY0FBQSxlQUFBLFdBQUE7QUFDQSxTQUFBLFVBQUEsT0FBQSxhQUFBO0FBQ0EsU0FBQSxjQUFBO0FBQ0EsV0FBQSxXQUFBO0FBQ0EsV0FBQSxNQUFBLGtCQUFBO0FBQ0EsVUFBQSxjQUFBLEVBQUEsVUFBQTtBQUNBLGdCQUFBLGNBQUE7QUFFQSxTQUFBLE1BQUEsa0JB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VUFBQSxVQUFBLEtBQUEsSUFBQSxJQUFBO0FBQ0EsUUFBQSxVQUFBLGVBQUEsT0FBQSxNQUFBLGlCQUFBLE9BQUE7QUFBQSxFQUNGO0FBRUEsV0FBQSxNQUFBLElBQUE7QUFDRSxXQUFBLElBQUEsUUFBQSxDQUFBLFlBQUEsT0FBQSxXQUFBLFNBQUEsRUFBQSxDQUFBO0FBQUEsRUFDRjtBQU1BLE1BQUEsT0FBQSxXQUFBLGVBQUEsT0FBQSxTQUFBLFdBQUE7QUFDRSxXQUFBLFFBQUEsVUFBQSxZQUFBLENBQUEsWUFBQTtBQUNFLFVBQUEsQ0FBQSxXQUFBLFFBQUEsU0FBQSxzQkFBQTtBQUVBLFlBQUEsWUFBQSxRQUFBO0FBQ0EsVUFBQSxDQUFBLFVBQUE7QUFFQSxZQUFBLFVBQUEsZUFBQSxJQUFBLFNBQUE7QUFDQSxVQUFBLENBQUEsUUFBQTtBQUVBLFlBQUEsRUFBQSxRQUFBLFVBQUEsSUFBQTtBQUVJLE9BQUEsWUFBQTtBQUNGLGNBQUEsaUJBQUEsU0FBQTtBQUVNLGNBQUEsU0FBQSxRQUFBO0FBS04sY0FBQSxZQUFBLFFBQUE7QUFDQSxjQUFBLGNBQUEsUUFBQTtBQUdBLFlBQUEsV0FBQSxVQUFBO0FBQ0UseUJBQUEsUUFBQSxVQUFBLEVBQUEsWUFBQSxDQUFBO0FBRUE7QUFBQSxRQUFBO0FBSUYsWUFBQSxXQUFBLGFBQUEsV0FBQSxZQUFBO0FBQ0UseUJBQUEsT0FBQSxTQUFBO0FBQ0EseUJBQUEsUUFBQSxTQUFBO0FBQ0EsZ0JBQUEsTUFBQSxtQkFBQTtBQUNBLGNBQUEsZUFBQSxNQUFBLE1BQUEsV0FBQTtBQUNFLDJCQUFBLFFBQUEsTUFBQTtBQUFBLFVBQTZCO0FBRS9CO0FBQUEsUUFBQTtBQUlGLFlBQUEsV0FBQSxXQUFBLFdBQUEsaUJBQUEsV0FBQSxnQkFBQTtBQU1FLGNBQUEsY0FBQSxjQUFBO0FBQ0Usa0JBQUEsZUFBQSxRQUFBLFdBQUE7QUFFQTtBQUFBLFVBQUE7QUFJRix5QkFBQSxPQUFBLFNBQUE7QUFDQSxnQkFBQSxlQUFBLFFBQUEsV0FBQTtBQUFBLFFBQXdDO0FBQUEsTUFD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
content;