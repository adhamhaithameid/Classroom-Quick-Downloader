var editedframe=(function(){"use strict";function oe(e){return e}const z=`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`)}`,R='<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M10.968 18.769C15.495 18.107 19 14.434 19 9.938a8.49 8.49 0 0 0-.216-1.912C20.718 9.178 22 11.188 22 13.475a6.1 6.1 0 0 1-1.113 3.506c.06.949.396 1.781 1.01 2.497a.43.43 0 0 1-.36.71c-1.367-.111-2.485-.426-3.354-.945A7.434 7.434 0 0 1 15 19.95a7.36 7.36 0 0 1-4.032-1.181z" fill="#ffffff"></path><path d="M7.625 16.657c.6.142 1.228.218 1.875.218 4.142 0 7.5-3.106 7.5-6.938C17 6.107 13.642 3 9.5 3 5.358 3 2 6.106 2 9.938c0 1.946.866 3.705 2.262 4.965a4.406 4.406 0 0 1-1.045 2.29.46.46 0 0 0 .386.76c1.7-.138 3.041-.57 4.022-1.296z" fill="#ffffff"></path></g></svg>',I='<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 3.99997H6C4.89543 3.99997 4 4.8954 4 5.99997V18C4 19.1045 4.89543 20 6 20H18C19.1046 20 20 19.1045 20 18V12M18.4142 8.41417L19.5 7.32842C20.281 6.54737 20.281 5.28104 19.5 4.5C18.7189 3.71895 17.4526 3.71895 16.6715 4.50001L15.5858 5.58575M18.4142 8.41417L12.3779 14.4505C12.0987 14.7297 11.7431 14.9201 11.356 14.9975L8.41422 15.5858L9.00257 12.6441C9.08001 12.2569 9.27032 11.9013 9.54951 11.6221L15.5858 5.58575M18.4142 8.41417L15.5858 5.58575" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>',P=`data:image/svg+xml;utf8,${encodeURIComponent(R)}`,Q="cqd-style",A=16,O="150ms cubic-bezier(0.2, 0, 0, 1)";function _(){if(typeof document>"u"||document.getElementById(Q))return;const e=document.createElement("style");e.id=Q,e.textContent=`
    :root {
      --cqd-transition: ${O};

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
      background-image: url("${z}");
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
      width: ${A}px;
      height: ${A}px;
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

  `.trim(),(document.head||document.documentElement).appendChild(e)}function S(){if(typeof document>"u")return!1;const e=document.documentElement.getAttribute("data-darkreader-scheme");if(e==="dark")return!0;if(e==="light")return!1;const t=["dark","dark-theme","theme-dark","night","gm3-dark-theme"],d=(document.documentElement.className||"").toLowerCase(),o=(document.body.className||"").toLowerCase();if(t.some(r=>d.includes(r)||o.includes(r)))return!0;const a=document.querySelector("div[data-stream-item-id]")||document.querySelector('[role="main"]')||document.body,n=B(a);return j(n)<105}function B(e){let t=e;const d=n=>!n||n==="transparent"||n==="rgba(0, 0, 0, 0)";for(;t;){const i=window.getComputedStyle(t).backgroundColor;if(!d(i))return i;t=t.parentElement}const a=window.getComputedStyle(document.documentElement).backgroundColor;return d(a)?"rgb(255, 255, 255)":a}function j(e){const t=e.match(/(\d+),\s*(\d+),\s*(\d+)/);if(!t)return 255;const d=parseInt(t[1],10),o=parseInt(t[2],10),a=parseInt(t[3],10);return Math.sqrt(.299*(d*d)+.587*(o*o)+.114*(a*a))}const u={en:{download:"Download",downloading:"Downloading…",trying:"Trying…",downloaded:"Downloaded",error:"Error",failed:"Download failed.",ariaDownload:"Download",titleQuick:"Quick download",comments:"comments",edited:"Edited"},ar:{download:"تنزيل",downloading:"جاري التنزيل…",trying:"محاولة…",downloaded:"تم التنزيل",error:"خطأ",failed:"فشل التنزيل.",ariaDownload:"تنزيل",titleQuick:"تنزيل سريع",comments:"تعليقات",edited:"تم التعديل"},ja:{download:"ダウンロード",downloading:"DL中…",trying:"試行中…",downloaded:"完了",error:"エラー",failed:"失敗しました。",ariaDownload:"ダウンロード",titleQuick:"クイックダウンロード",comments:"件のコメント",edited:"編集済み"},es:{download:"Descargar",downloading:"Descargando…",trying:"Intentando…",downloaded:"Descargado",error:"Error",failed:"Falló la descarga.",ariaDownload:"Descargar",titleQuick:"Descarga rápida",comments:"comentarios",edited:"Editado"},hi:{download:"डाउनलोड",downloading:"डाउनलोडिंग…",trying:"कोशिश जारी…",downloaded:"पूर्ण",error:"त्रुटि",failed:"विफल रहा",ariaDownload:"डाउनलोड",titleQuick:"त्वरित डाउनलोड",comments:"टिप्पणियाँ",edited:"संपादित"},pt:{download:"Baixar",downloading:"Baixando…",trying:"Tentando…",downloaded:"Baixado",error:"Erro",failed:"Falha ao baixar.",ariaDownload:"Baixar",titleQuick:"Download rápido",comments:"comentários",edited:"Editado"},"pt-pt":{download:"Descarregar",downloading:"A descarregar…",trying:"A tentar…",downloaded:"Descarregado",error:"Erro",failed:"Falha ao descarregar.",ariaDownload:"Descarregar",titleQuick:"Descarga rápida",comments:"comentários",edited:"Editado"},"zh-cn":{download:"下载",downloading:"下载中…",trying:"尝试中…",downloaded:"已下载",error:"错误",failed:"下载失败",ariaDownload:"下载",titleQuick:"快速下载",comments:"条评论",edited:"已编辑"},"zh-tw":{download:"下載",downloading:"下載中…",trying:"嘗試中…",downloaded:"已下載",error:"錯誤",failed:"下載失敗",ariaDownload:"下載",titleQuick:"快速下載",comments:"則留言",edited:"已編輯"},fr:{download:"Télécharger",downloading:"Téléchargement…",trying:"Essai…",downloaded:"Téléchargé",error:"Erreur",failed:"Échec.",ariaDownload:"Télécharger",titleQuick:"Téléchargement rapide",comments:"commentaires",edited:"Modifié"},de:{download:"Herunterladen",downloading:"Laden…",trying:"Versuchen…",downloaded:"Fertig",error:"Fehler",failed:"Fehlgeschlagen.",ariaDownload:"Herunterladen",titleQuick:"Schneller Download",comments:"Kommentare",edited:"Bearbeitet"},it:{download:"Scarica",downloading:"Scaricamento…",trying:"Provando…",downloaded:"Scaricato",error:"Errore",failed:"Fallito.",ariaDownload:"Scarica",titleQuick:"Download rapido",comments:"commenti",edited:"Modificato"},ru:{download:"Скачать",downloading:"Скачивание…",trying:"Попытка…",downloaded:"Скачано",error:"Ошибка",failed:"Сбой.",ariaDownload:"Скачать",titleQuick:"Быстрое скачивание",comments:"комментариев",edited:"Изменено"},ko:{download:"다운로드",downloading:"다운로드 중…",trying:"시도 중…",downloaded:"완료",error:"오류",failed:"실패함",ariaDownload:"다운로드",titleQuick:"빠른 다운로드",comments:"개 댓글",edited:"수정됨"},tr:{download:"İndir",downloading:"İndiriliyor…",trying:"Deneniyor…",downloaded:"İndirildi",error:"Hata",failed:"Başarısız.",ariaDownload:"İndir",titleQuick:"Hızlı indir",comments:"yorum",edited:"Düzenlendi"},vi:{download:"Tải xuống",downloading:"Đang tải…",trying:"Đang thử…",downloaded:"Đã tải",error:"Lỗi",failed:"Thất bại.",ariaDownload:"Tải xuống",titleQuick:"Tải xuống nhanh",comments:"nhận xét",edited:"Đã chỉnh sửa"},id:{download:"Download",downloading:"Mengunduh…",trying:"Mencoba…",downloaded:"Selesai",error:"Kesalahan",failed:"Gagal.",ariaDownload:"Download",titleQuick:"Download cepat",comments:"komentar",edited:"Diedit"},th:{download:"ดาวน์โหลด",downloading:"กำลังโหลด…",trying:"พยายาม…",downloaded:"เสร็จสิ้น",error:"ข้อผิดพลาด",failed:"ล้มเหลว",ariaDownload:"ดาวน์โหลด",titleQuick:"ดาวน์โหลดด่วน",comments:"ความคิดเห็น",edited:"แก้ไขแล้ว"},pl:{download:"Pobierz",downloading:"Pobieranie…",trying:"Próba…",downloaded:"Pobrano",error:"Błąd",failed:"Nieudane.",ariaDownload:"Pobierz",titleQuick:"Szybkie pobieranie",comments:"komentarze",edited:"Edytowano"},nl:{download:"Downloaden",downloading:"Downloaden…",trying:"Proberen…",downloaded:"Klaar",error:"Fout",failed:"Mislukt.",ariaDownload:"Downloaden",titleQuick:"Snel downloaden",comments:"reacties",edited:"Bewerkt"},bn:{download:"ডাউনলোড",downloading:"ডাউনলোড হচ্ছে…",trying:"চেষ্টা করছে…",downloaded:"সম্পন্ন",error:"ত্রুটি",failed:"ব্যর্থ হয়েছে",ariaDownload:"ডাউনলোড",titleQuick:"দ্রুত ডাউনলোড",comments:"টি মন্তব্য",edited:"সম্পাদিত"},pa:{download:"ਡਾਉਨਲੋਡ",downloading:"ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…",trying:"ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…",downloaded:"ਮੁਕੰਮਲ",error:"ਗਲਤੀ",failed:"ਅਸਫਲ",ariaDownload:"ਡਾਉਨਲੋਡ",titleQuick:"ਤੇਜ਼ ਡਾਉਨਲੋਡ",comments:"ਟਿੱਪਣੀਆਂ",edited:"ਸੰਪਾਦਿਤ"},te:{download:"డౌన్‌లోడ్",downloading:"డౌన్‌లోడ్ అవుతోంది…",trying:"ప్రయత్నిస్తోంది…",downloaded:"పూర్తయింది",error:"లోపం",failed:"విఫలమైంది",ariaDownload:"డౌన్‌లోడ్",titleQuick:"త్వరిత డౌన్‌లోడ్",comments:"వ్యాఖ్యలు",edited:"సవరించబడింది"},mr:{download:"डाउनलोड",downloading:"डाउनलोड होत आहे…",trying:"प्रयत्न करत आहे…",downloaded:"पूर्ण",error:"त्रुटी",failed:"अयशस्वी",ariaDownload:"डाउनलोड",titleQuick:"त्वरित डाउनलोड",comments:"टिप्पण्या",edited:"संपादित"},ta:{download:"பதிவிறக்கு",downloading:"பதிவிறக்குகிறது…",trying:"முயற்சிக்கிறது…",downloaded:"முடிந்தது",error:"பிழை",failed:"தோல்வி",ariaDownload:"பதிவிறக்கு",titleQuick:"விரைவு பதிவிறக்கம்",comments:"கருத்துகள்",edited:"திருத்தப்பட்டது"},ur:{download:"ڈاؤن لوڈ",downloading:"ڈاؤن لوڈ ہو رہا ہے…",trying:"کوشش جاری…",downloaded:"مکمل",error:"غلطی",failed:"ناکام",ariaDownload:"ڈاؤن لوڈ",titleQuick:"فوری ڈاؤن لوڈ",comments:"تبصرے",edited:"ترمیم شدہ"},gu:{download:"ડાઉનલોડ",downloading:"ડાઉનલોડ થઈ રહ્યું છે…",trying:"પ્રયાસ ચાલુ…",downloaded:"પૂર્ણ",error:"ભૂલ",failed:"નિષ્ફળ",ariaDownload:"ડાઉનલોડ",titleQuick:"ઝડપી ડાઉનલોડ",comments:"ટિપ્પણીઓ",edited:"સંપાદિત"},kn:{download:"ಡೌನ್‌ಲೋಡ್",downloading:"ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…",trying:"ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…",downloaded:"ಪೂರ್ಣಗೊಂಡಿದೆ",error:"ದೋಷ",failed:"ವಿಫಲವಾಗಿದೆ",ariaDownload:"ಡೌನ್‌ಲೋಡ್",titleQuick:"ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್",comments:"ಕಾಮೆಂಟ್‌ಗಳು",edited:"ಸಂಪಾದಿಸಲಾಗಿದೆ"},ml:{download:"ഡൗൺലോഡ്",downloading:"ഡൗൺലോഡ് ചെയ്യുന്നു…",trying:"ശ്രമിക്കുന്നു…",downloaded:"പൂർത്തിയായി",error:"പിശക്",failed:"പരാജയപ്പെട്ടു",ariaDownload:"ഡൗൺലോഡ്",titleQuick:"വേഗത്തിൽ ഡൗൺലോഡ്",comments:"അഭിപ്രായങ്ങൾ",edited:"എഡിറ്റുചെയ്തു"},uk:{download:"Завантажити",downloading:"Завантаження…",trying:"Спроба…",downloaded:"Готово",error:"Помилка",failed:"Невдача.",ariaDownload:"Завантажити",titleQuick:"Швидке завантаження",comments:"коментарів",edited:"Змінено"},el:{download:"Λήψη",downloading:"Λήψη…",trying:"Προσπάθεια…",downloaded:"Ολοκληρώθηκε",error:"Σφάλμα",failed:"Απέτυχε.",ariaDownload:"Λήψη",titleQuick:"Γρήγορη λήψη",comments:"σχόλια",edited:"Επεξεργασμένο"},cs:{download:"Stáhnout",downloading:"Stahování…",trying:"Zkouším…",downloaded:"Staženo",error:"Chyba",failed:"Selhalo.",ariaDownload:"Stáhnout",titleQuick:"Rychlé stažení",comments:"komentářů",edited:"Upraveno"},ro:{download:"Descărcați",downloading:"Se descarcă…",trying:"Se încearcă…",downloaded:"Finalizat",error:"Eroare",failed:"Eșuat.",ariaDownload:"Descărcați",titleQuick:"Descărcare rapidă",comments:"comentarii",edited:"Modificat"},hu:{download:"Letöltés",downloading:"Letöltés…",trying:"Próbálkozás…",downloaded:"Kész",error:"Hiba",failed:"Sikertelen.",ariaDownload:"Letöltés",titleQuick:"Gyors letöltés",comments:"megjegyzés",edited:"Szerkesztve"},sv:{download:"Ladda ner",downloading:"Laddar ner…",trying:"Försöker…",downloaded:"Klart",error:"Fel",failed:"Misslyckades.",ariaDownload:"Ladda ner",titleQuick:"Snabb nedladdning",comments:"kommentarer",edited:"Redigerad"},da:{download:"Hent",downloading:"Henter…",trying:"Prøver…",downloaded:"Hentet",error:"Fejl",failed:"Mislykkedes.",ariaDownload:"Hent",titleQuick:"Hurtig download",comments:"kommentarer",edited:"Redigeret"},fi:{download:"Lataa",downloading:"Ladataan…",trying:"Yritetään…",downloaded:"Ladattu",error:"Virhe",failed:"Epäonnistui.",ariaDownload:"Lataa",titleQuick:"Pikalataus",comments:"kommenttia",edited:"Muokattu"},no:{download:"Last ned",downloading:"Laster ned…",trying:"Prøver…",downloaded:"Ferdig",error:"Feil",failed:"Mislyktes.",ariaDownload:"Last ned",titleQuick:"Rask nedlasting",comments:"kommentarer",edited:"Redigert"},he:{download:"הורדה",downloading:"מוריד…",trying:"מנסה…",downloaded:"הושלם",error:"שגיאה",failed:"נכשל",ariaDownload:"הורדה",titleQuick:"הורדה מהירה",comments:"תגובות",edited:"נערך"},fa:{download:"دانلود",downloading:"درحال دانلود…",trying:"تلاش مجدد…",downloaded:"انجام شد",error:"خطا",failed:"ناموفق",ariaDownload:"دانلود",titleQuick:"دانلود سریع",comments:"نظر",edited:"ویرایش شده"},fil:{download:"I-download",downloading:"Nagda-download…",trying:"Sinusubukan…",downloaded:"Tapos na",error:"Error",failed:"Nabigo.",ariaDownload:"I-download",titleQuick:"Mabilis na download",comments:"mga komento",edited:"Na-edit"},ms:{download:"Muat turun",downloading:"Memuat turun…",trying:"Mencuba…",downloaded:"Selesai",error:"Ralat",failed:"Gagal.",ariaDownload:"Muat turun",titleQuick:"Muat turun pantas",comments:"komen",edited:"Diedit"},sr:{download:"Преузми",downloading:"Преузимање…",trying:"Покушавам…",downloaded:"Завршено",error:"Грешка",failed:"Неуспешно.",ariaDownload:"Преузми",titleQuick:"Брзо преузимање",comments:"коментара",edited:"Измењено"},sk:{download:"Stiahnuť",downloading:"Sťahovanie…",trying:"Skúšam…",downloaded:"Hotovo",error:"Chyba",failed:"Zlyhalo.",ariaDownload:"Stiahnuť",titleQuick:"Rýchle stiahnutie",comments:"komentárov",edited:"Upravené"},bg:{download:"Изтегли",downloading:"Изтегляне…",trying:"Опит…",downloaded:"Готово",error:"Грешка",failed:"Неуспешно.",ariaDownload:"Изтегли",titleQuick:"Бързо изтегляне",comments:"коментара",edited:"Редактирано"},hr:{download:"Preuzmi",downloading:"Preuzimanje…",trying:"Pokušavam…",downloaded:"Gotovo",error:"Greška",failed:"Neuspjelo.",ariaDownload:"Preuzmi",titleQuick:"Brzo preuzimanje",comments:"komentara",edited:"Uređeno"},lt:{download:"Atsisiųsti",downloading:"Siunčiama…",trying:"Bandoma…",downloaded:"Baigta",error:"Klaida",failed:"Nepavyko.",ariaDownload:"Atsisiųsti",titleQuick:"Greitas atsisiuntimas",comments:"komentarai",edited:"Redaguota"},lv:{download:"Lejupielādēt",downloading:"Lejupielādē…",trying:"Mēģina…",downloaded:"Pabeigts",error:"Kļūda",failed:"Neizdevās.",ariaDownload:"Lejupielādēt",titleQuick:"Ātrā lejupielāde",comments:"komentāri",edited:"Rediģēts"},et:{download:"Laadi alla",downloading:"Laadimine…",trying:"Proovin…",downloaded:"Valmis",error:"Viga",failed:"Ebaõnnestus.",ariaDownload:"Laadi alla",titleQuick:"Kiire allalaadimine",comments:"kommentaari",edited:"Muudetud"},sl:{download:"Prenos",downloading:"Prenašanje…",trying:"Poskušam…",downloaded:"Končano",error:"Napaka",failed:"Ni uspelo.",ariaDownload:"Prenos",titleQuick:"Hiter prenos",comments:"komentarjev",edited:"Urejeno"},ca:{download:"Descarrega",downloading:"Descarregant…",trying:"Intentant…",downloaded:"Descarregat",error:"Error",failed:"Ha fallat.",ariaDownload:"Descarrega",titleQuick:"Descàrrega ràpida",comments:"comentaris",edited:"Editat"},af:{download:"Aflaai",downloading:"Laai af…",trying:"Probeer…",downloaded:"Klaar",error:"Fout",failed:"Misluk.",ariaDownload:"Aflaai",titleQuick:"Vinnige aflaai",comments:"kommentare",edited:"Geredigeer"},am:{download:"አውርድ",downloading:"በማውረድ ላይ…",trying:"በመሞከር ላይ…",downloaded:"ወርዷል",error:"ስህተት",failed:"አልተሳካም።",ariaDownload:"አውርድ",titleQuick:"ፈጣን ማውረድ",comments:"አስተያየቶች",edited:"ተስተካክሏል"},hy:{download:"Ներբեռնել",downloading:"Ներբեռնում…",trying:"Փորձում է…",downloaded:"Ավարտված",error:"Սխալ",failed:"Ձախողվեց:",ariaDownload:"Ներբեռնել",titleQuick:"Արագ ներբեռնում",comments:"մեկնաբանություն",edited:"Խմբագրվել է"},as:{download:"ডাউন্লোড",downloading:"ডাউন্লোড হৈ আছে…",trying:"চেষ্টা কৰি আছে…",downloaded:"সম্পূৰ্ণ",error:"ত্ৰুটি",failed:"বিফল হ’ল",ariaDownload:"ডাউন্লোড",titleQuick:"দ্ৰুত ডাউন্লোড",comments:"মন্তব্য",edited:"সম্পাদিত"},az:{download:"Yüklə",downloading:"Yüklənir…",trying:"Cəhd edilir…",downloaded:"Bitdi",error:"Xəta",failed:"Alınmadı.",ariaDownload:"Yüklə",titleQuick:"Sürətli yükləmə",comments:"şərh",edited:"Düzəliş edilib"},eu:{download:"Deskargatu",downloading:"Deskargatzen…",trying:"Saiatzen…",downloaded:"Eginda",error:"Errorea",failed:"Huts egin du.",ariaDownload:"Deskargatu",titleQuick:"Deskarga azkarra",comments:"iruzkin",edited:"Editatua"},my:{download:"ဒေါင်းလုဒ်",downloading:"ဒေါင်းလုဒ် လုပ်နေ…",trying:"ကြိုးစားနေ…",downloaded:"ပြီးပါပြီ",error:"အမှား",failed:"မအောင်မြင်ပါ။",ariaDownload:"ဒေါင်းလုဒ်",titleQuick:"အမြန် ဒေါင်းလုဒ်",comments:"မှတ်ချက်များ",edited:"ပြင်ဆင်ပြီး"},gl:{download:"Descargar",downloading:"Descargando…",trying:"Tentando…",downloaded:"Descargado",error:"Erro",failed:"Fallou.",ariaDownload:"Descargar",titleQuick:"Descarga rápida",comments:"comentarios",edited:"Editado"},ka:{download:"ჩამოტვირთვა",downloading:"იწერება…",trying:"მცდელობა…",downloaded:"დასრულდა",error:"შეცდომა",failed:"ვერ მოხერხდა.",ariaDownload:"ჩამოტვირთვა",titleQuick:"სწრაფი ჩამოტვირთვა",comments:"კომენტარი",edited:"რედაქტირებულია"},is:{download:"Sækja",downloading:"Sækir…",trying:"Reyni…",downloaded:"Sótt",error:"Villa",failed:"Mistókst.",ariaDownload:"Sækja",titleQuick:"Flýtiniðurhal",comments:"ummæli",edited:"Breytt"},ga:{download:"Íoslódáil",downloading:"Ag íoslódáil…",trying:"Ag iarraidh…",downloaded:"Íoslódáilte",error:"Earráid",failed:"Theip air.",ariaDownload:"Íoslódáil",titleQuick:"Íoslódáil tapa",comments:"trácht",edited:"Eagraithe"},kk:{download:"Жүктеп алу",downloading:"Жүктелуде…",trying:"Әрекет…",downloaded:"Аяқталды",error:"Қате",failed:"Сәтсіз.",ariaDownload:"Жүктеп алу",titleQuick:"Жылдам жүктеу",comments:"пікір",edited:"Өзгертілді"},km:{download:"ទាញយក",downloading:"កំពុងទាញយក…",trying:"កំពុងព្យាយាម…",downloaded:"បានបញ្ចប់",error:"កំហុស",failed:"បរាជ័យ",ariaDownload:"ទាញយក",titleQuick:"ទាញយកលឿន",comments:"មតិ",edited:"បានកែសម្រួល"},lo:{download:"ດາວໂຫລດ",downloading:"ກຳລັງດາວໂຫລດ…",trying:"ກຳລັງພະຍາຍາມ…",downloaded:"ສຳເລັດ",error:"ຜິດພາດ",failed:"ລົ້ມເຫລວ",ariaDownload:"ດາວໂຫລດ",titleQuick:"ດາວໂຫລດດ່ວນ",comments:"ຄຳເຫັນ",edited:"ແກ້ໄຂແລ້ວ"},mk:{download:"Преземи",downloading:"Преземање…",trying:"Се обидувам…",downloaded:"Готово",error:"Грешка",failed:"Неуспешно.",ariaDownload:"Преземи",titleQuick:"Брзо преземање",comments:"коментари",edited:"Изменето"},mn:{download:"Татах",downloading:"Татаж байна…",trying:"Орлдож байна…",downloaded:"Татсан",error:"Алдаа",failed:"Амжилтгүй.",ariaDownload:"Татах",titleQuick:"Хурдан татах",comments:"сэтгэгдэл",edited:"Зассан"},ne:{download:"डाउनलोड",downloading:"डाउनलोड हुँदै…",trying:"प्रयास गर्दै…",downloaded:"पूरा भयो",error:"त्रुटि",failed:"असफल भयो",ariaDownload:"डाउनलोड",titleQuick:"छिटो डाउनलोड",comments:"टिप्पणीहरू",edited:"सम्पादित"},or:{download:"ଡାଉନଲୋଡ୍",downloading:"ଡାଉନଲୋଡ୍ ହେଉଛି…",trying:"ଚେଷ୍ଟା କରୁଛି…",downloaded:"ସମ୍ପୂର୍ଣ୍ଣ",error:"ତ୍ରୁଟି",failed:"ବିଫଳ ହେଲା",ariaDownload:"ଡାଉନଲୋଡ୍",titleQuick:"ଶୀଘ୍ର ଡାଉନଲୋଡ୍",comments:"ମନ୍ତବ୍ୟ",edited:"ସମ୍ପାଦିତ"},si:{download:"බාගන්න",downloading:"බාගත වෙමින්…",trying:"උත්සාහ කරමින්…",downloaded:"අවසන්",error:"දෝෂයකි",failed:"අසාර්ථකයි",ariaDownload:"බාගන්න",titleQuick:"ඉක්මන් බාගත කිරීම",comments:"අදහස්",edited:"සංස්කරණය"},sw:{download:"Pakua",downloading:"Inapakua…",trying:"Inajaribu…",downloaded:"Imekamilika",error:"Hitilafu",failed:"Imeshindwa.",ariaDownload:"Pakua",titleQuick:"Pakua haraka",comments:"maoni",edited:"Imehaririwa"},uz:{download:"Yuklash",downloading:"Yuklanmoqda…",trying:"Urinilmoqda…",downloaded:"Tayyor",error:"Xato",failed:"Muvaffaqiyatsiz.",ariaDownload:"Yuklash",titleQuick:"Tez yuklash",comments:"sharhlar",edited:"Tahrirlangan"},cy:{download:"Lawrlwytho",downloading:"Yn lawrlwytho…",trying:"Yn ceisio…",downloaded:"Wedi gorffen",error:"Gwall",failed:"Methodd.",ariaDownload:"Lawrlwytho",titleQuick:"Lawrlwytho cyflym",comments:"sylwadau",edited:"Golygwyd"},zu:{download:"Landa",downloading:"Iyalandwa…",trying:"Iyazama…",downloaded:"Ilandīwe",error:"Iphutha",failed:"Ihlulekile.",ariaDownload:"Landa",titleQuick:"Ukulanda okusheshayo",comments:"amazwana",edited:"Kuhleliwe"},sq:{download:"Shkarko",downloading:"Duke shkarkuar…",trying:"Duke provuar…",downloaded:"Përfundoi",error:"Gabim",failed:"Dështoi.",ariaDownload:"Shkarko",titleQuick:"Shkarkim i shpejtë",comments:"komente",edited:"E redaktuar"}};function V(e){try{let t="en";typeof document<"u"&&document.documentElement&&document.documentElement.lang?t=document.documentElement.lang:typeof navigator<"u"&&navigator.language&&(t=navigator.language);const d=t.toLowerCase().split(";")[0].trim().replace("_","-"),o=d.split("-")[0];return u[d]&&typeof u[d][e]=="string"?u[d][e]:u[o]&&typeof u[o][e]=="string"?u[o][e]:u.en&&typeof u.en[e]=="string"?u.en[e]:e}catch{try{return u.en[e]||e}catch{return String(e)}}}const G="div[data-stream-item-id]",E="data-cqd-edited-processed";let C=!1;const Y={matches:["https://classroom.google.com/*"],runAt:"document_idle",main(){_(),q(),new MutationObserver(()=>{C||(C=!0,requestAnimationFrame(()=>{C=!1,q()}))}).observe(document.body,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["aria-label","title"]}),setInterval(()=>{q()},2500);let t=location.href;new MutationObserver(()=>{const d=location.href;d!==t&&(t=d,setTimeout(q,500),setTimeout(q,1500))}).observe(document,{subtree:!0,childList:!0})}};function q(){try{const e=U();document.body.setAttribute("data-cqd-dir",e);const t=V("edited").toLowerCase();document.querySelectorAll(G).forEach(o=>{let a=!1;if(o.hasAttribute(E)&&(!!o.querySelector(".cqd-overlay-container.cqd-edited")||!!o.querySelector(".cqd-edited-badge")||!!o.querySelector(".cqd-both-badge")?a=!0:o.removeAttribute(E)),!a){const n=Array.from(o.querySelectorAll("a, span, div[aria-label]"));let i=!1,r=null;for(const c of n){const s=(c.textContent||"").trim(),m=(c.getAttribute("aria-label")||"").trim(),f=(c.getAttribute("title")||"").trim();if(!`${s} ${m} ${f}`.toLowerCase().includes(t))continue;const g=(o.innerText||"")+" "+X(o);r=H(g,t)??"+0",i=!0;break}i&&r!==null&&(o.setAttribute(E,"true"),$(o,r))}W(o)})}catch{}}function H(e,t){try{const d=(e||"").replace(/\s+/g," ").trim();if(!d)return null;const o=d.toLowerCase(),a=t.toLowerCase(),n=o.indexOf(a),i="\\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}\\b",r=new Date().getFullYear(),c=g=>{const l=new Date(`${g.trim()} ${r}`);return isNaN(l.getTime())?null:l};let s=null,m=null;if(n!==-1){const g=d.slice(0,n),l=d.slice(n),h=g.match(new RegExp(i,"gi"))||[],x=l.match(new RegExp(i,"gi"))||[];if(h.length>0){const y=h[h.length-1];s=c(y)}if(x.length>0){const y=x[0];m=c(y)}}if(!s||!m){const g=d.match(new RegExp(i,"gi"));if(!g||g.length===0)return null;const l=g.map(h=>c(h)).filter(h=>!!h);if(!l.length)return null;s=l[0],m=l.length>1?l[l.length-1]:l[0]}if(!s||!m)return null;const f=1e3*60*60*24;let p=Math.floor((m.getTime()-s.getTime())/f);return p<0&&(p=0),`+${p}`}catch{return null}}function $(e,t){const d=window.getComputedStyle(e);d.position==="static"&&(e.style.position="relative"),e.style.setProperty("overflow","visible","important"),e.style.setProperty("contain","none","important"),e.style.zIndex="1";let o=e.querySelector(".cqd-overlay-container");if(o?(o.classList.add("cqd-edited"),S()&&o.classList.add("cqd-theme-dark")):(o=document.createElement("div"),o.className="cqd-overlay-container cqd-edited",o.style.borderRadius=d.borderRadius||"8px",S()&&o.classList.add("cqd-theme-dark"),o.addEventListener("click",s=>{if(s.target===o){const m=e.querySelector('a[href*="/details/"], h2 a');m?m.click():e.click()}}),e.appendChild(o)),e.querySelector(".cqd-both-badge"))return;e.querySelector(".cqd-edited-badge")?.remove();const n=document.createElement("div");n.className="cqd-edited-badge",S()&&n.classList.add("cqd-theme-dark"),n.title="Days between posting and the last edit",n.setAttribute("aria-label",n.title);const i=document.createElement("div");i.className="cqd-edited-icon",i.innerHTML=I,n.appendChild(i);const r=document.createElement("div");r.className="cqd-edited-content";const c=document.createElement("span");c.className="cqd-diff-val",c.textContent=t,r.appendChild(c),n.appendChild(r),e.appendChild(n)}function U(){return(document.documentElement.dir||document.body.dir)==="rtl"?"rtl":"ltr"}function W(e){const t=e.querySelector(".cqd-overlay-container"),d=e.querySelector(".cqd-comment-badge"),o=e.querySelector(".cqd-edited-badge");let a=e.querySelector(".cqd-both-badge");const n=!!d||e.hasAttribute("data-cqd-processed"),i=!!o||e.hasAttribute("data-cqd-edited-processed");if(!n||!i){a?.remove();return}let r="0";const c=d?.querySelector(".cqd-badge-label");if(c?.textContent?.trim())r=c.textContent.trim();else if(a){const w=a.querySelector(".cqd-both-value-comment");w?.textContent?.trim()&&(r=w.textContent.trim())}let s="+0";const m=o?.querySelector(".cqd-diff-val");if(m?.textContent?.trim())s=m.textContent.trim();else if(a){const w=a.querySelector(".cqd-both-value-edited");w?.textContent?.trim()&&(s=w.textContent.trim())}if(a){const w=a.querySelector(".cqd-both-value-comment"),b=a.querySelector(".cqd-both-value-edited");w&&(w.textContent=r),b&&(b.textContent=s);return}if(d?.remove(),o?.remove(),!t){const w=window.getComputedStyle(e),b=document.createElement("div");b.className="cqd-overlay-container",b.style.borderRadius=w.borderRadius||"8px",b.addEventListener("click",te=>{if(te.target===b){const M=e.querySelector('a[href*="/details/"], h2 a');M?M.click():e.click()}}),e.appendChild(b)}a=document.createElement("div"),a.className="cqd-both-badge",a.title="Top: number of comments. Bottom: days between posting and last edit.",a.setAttribute("aria-label",a.title);const f=document.createElement("div");f.className="cqd-both-section cqd-both-comments";const p=document.createElement("div");p.className="cqd-both-icon cqd-both-icon-comment",p.style.backgroundImage=`url("${P}")`,f.appendChild(p);const g=document.createElement("span");g.className="cqd-both-value cqd-both-value-comment",g.textContent=r,f.appendChild(g);const l=document.createElement("div");l.className="cqd-both-plus",l.textContent="+";const h=document.createElement("div");h.className="cqd-both-divider";const x=document.createElement("div");x.className="cqd-both-section cqd-both-edited";const y=document.createElement("div");y.className="cqd-both-icon cqd-both-icon-edited",y.innerHTML=I,x.appendChild(y);const F=document.createElement("span");F.className="cqd-both-value cqd-both-value-edited",F.textContent=s,x.appendChild(F),a.appendChild(f),a.appendChild(l),a.appendChild(h),a.appendChild(x),a.addEventListener("click",w=>{w.stopPropagation(),K(e)}),e.appendChild(a)}function K(e){const t=e.querySelector('a[href*="/details/"], h2 a');t?t.click():e.click()}function X(e){return Array.from(e.querySelectorAll("[aria-label]")).map(t=>t.getAttribute("aria-label")||"").join(" ")}const N=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;function k(e,...t){}const J={debug:(...e)=>k(console.debug,...e),log:(...e)=>k(console.log,...e),warn:(...e)=>k(console.warn,...e),error:(...e)=>k(console.error,...e)};class L extends Event{constructor(t,d){super(L.EVENT_NAME,{}),this.newUrl=t,this.oldUrl=d}static EVENT_NAME=T("wxt:locationchange")}function T(e){return`${N?.runtime?.id}:edited_frame:${e}`}function Z(e){let t,d;return{run(){t==null&&(d=new URL(location.href),t=e.setInterval(()=>{let o=new URL(location.href);o.href!==d.href&&(window.dispatchEvent(new L(o,d)),d=o)},1e3))}}}class v{constructor(t,d){this.contentScriptName=t,this.options=d,this.abortController=new AbortController,this.isTopFrame?(this.listenForNewerScripts({ignoreFirstEvent:!0}),this.stopOldScripts()):this.listenForNewerScripts()}static SCRIPT_STARTED_MESSAGE_TYPE=T("wxt:content-script-started");isTopFrame=window.self===window.top;abortController;locationWatcher=Z(this);receivedMessageIds=new Set;get signal(){return this.abortController.signal}abort(t){return this.abortController.abort(t)}get isInvalid(){return N.runtime.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(t){return this.signal.addEventListener("abort",t),()=>this.signal.removeEventListener("abort",t)}block(){return new Promise(()=>{})}setInterval(t,d){const o=setInterval(()=>{this.isValid&&t()},d);return this.onInvalidated(()=>clearInterval(o)),o}setTimeout(t,d){const o=setTimeout(()=>{this.isValid&&t()},d);return this.onInvalidated(()=>clearTimeout(o)),o}requestAnimationFrame(t){const d=requestAnimationFrame((...o)=>{this.isValid&&t(...o)});return this.onInvalidated(()=>cancelAnimationFrame(d)),d}requestIdleCallback(t,d){const o=requestIdleCallback((...a)=>{this.signal.aborted||t(...a)},d);return this.onInvalidated(()=>cancelIdleCallback(o)),o}addEventListener(t,d,o,a){d==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),t.addEventListener?.(d.startsWith("wxt:")?T(d):d,o,{...a,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),J.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){window.postMessage({type:v.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:Math.random().toString(36).slice(2)},"*")}verifyScriptStartedEvent(t){const d=t.data?.type===v.SCRIPT_STARTED_MESSAGE_TYPE,o=t.data?.contentScriptName===this.contentScriptName,a=!this.receivedMessageIds.has(t.data?.messageId);return d&&o&&a}listenForNewerScripts(t){let d=!0;const o=a=>{if(this.verifyScriptStartedEvent(a)){this.receivedMessageIds.add(a.data.messageId);const n=d;if(d=!1,n&&t?.ignoreFirstEvent)return;this.notifyInvalidated()}};addEventListener("message",o),this.onInvalidated(()=>removeEventListener("message",o))}}function re(){}function D(e,...t){}const ee={debug:(...e)=>D(console.debug,...e),log:(...e)=>D(console.log,...e),warn:(...e)=>D(console.warn,...e),error:(...e)=>D(console.error,...e)};return(async()=>{try{const{main:e,...t}=Y,d=new v("edited_frame",t);return await e(d)}catch(e){throw ee.error('The content script "edited_frame" crashed on startup!',e),e}})()})();
editedframe;