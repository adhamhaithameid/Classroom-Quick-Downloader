var commentframe=(function(){"use strict";function N(o){return o}const q=`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`)}`,D=`data:image/svg+xml;utf8,${encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M10.968 18.769C15.495 18.107 19 14.434 19 9.938a8.49 8.49 0 0 0-.216-1.912C20.718 9.178 22 11.188 22 13.475a6.1 6.1 0 0 1-1.113 3.506c.06.949.396 1.781 1.01 2.497a.43.43 0 0 1-.36.71c-1.367-.111-2.485-.426-3.354-.945A7.434 7.434 0 0 1 15 19.95a7.36 7.36 0 0 1-4.032-1.181z" fill="#ffffff"></path><path d="M7.625 16.657c.6.142 1.228.218 1.875.218 4.142 0 7.5-3.106 7.5-6.938C17 6.107 13.642 3 9.5 3 5.358 3 2 6.106 2 9.938c0 1.946.866 3.705 2.262 4.965a4.406 4.406 0 0 1-1.045 2.29.46.46 0 0 0 .386.76c1.7-.138 3.041-.57 4.022-1.296z" fill="#ffffff"></path></g></svg>')}`,f="cqd-style",b=16,v="150ms cubic-bezier(0.2, 0, 0, 1)";function S(){if(typeof document>"u"||document.getElementById(f))return;const o=document.createElement("style");o.id=f,o.textContent=`
    :root {
      --cqd-transition: ${v};

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

      /* 5. Comment Frame - Dark: #C874FF */
      --cqd-color-comment: #C874FF;

      /* 6. Edited Frame - Dark: #00D6EE */
      --cqd-color-edited: #00D6EE;
    }

    /* ============================================================
     * CRITICAL OVERRIDES: Force Google Card to show the Badge
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

    /* Idle hover (no active state) */
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
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
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
      background-image: url("${q}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width var(--cqd-transition),
        height var(--cqd-transition),
        border-width var(--cqd-transition);
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

    /* Idle hover label reveal */
    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 4px;
    }

    /* ------------------------------------------------------------------
     * PILL STATES: loading, trying, success, error share pill layout
     * ------------------------------------------------------------------*/
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
    
    .cqd-download-btn.cqd-loading {
      box-shadow: var(--cqd-shadow-normal);
    }

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-trying:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
    }

    /* Labels for loading / trying */
    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-trying .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-loading:hover {
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-normal-strong);
    }

    .cqd-download-btn.cqd-trying:hover {
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-trying-strong);
    }

    /* SUCCESS STATE */
    .cqd-download-btn.cqd-success {
      width: 140px;
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-success:hover {
      width: 140px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-success-strong);
    }

    /* ERROR STATE */
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

    .cqd-download-btn.cqd-error .cqd-label {
      opacity: 1;
      margin-left: 8px;
      max-width: 110px;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .cqd-error-detail {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
      margin-left: 0;
      margin-top: 0;
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
      padding-top: 8px;
      padding-bottom: 8px;
      border-radius: 18px;
      align-items: center;
      white-space: normal;
      gap: 7px;
      box-shadow: var(--cqd-shadow-error-strong);
    }

    .cqd-download-btn.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin-left: 0;
    }

    .cqd-download-btn.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    /* Spinner (used for loading & trying) */
    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${b}px;
      height: ${b}px;
      border: 3px solid rgba(255, 255, 255, 0.22);
      border-top-color: #ffffff;
      box-shadow: none;
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ===============================
     * 2. COMMENT FRAME & VERTICAL PILL BADGE
     * =============================== */

    /* The Border Frame */
    .cqd-overlay-container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit;
      transition: all 0.2s ease;      
      box-shadow:
        inset 0 0 0 2px var(--cqd-color-comment),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    /* THE BADGE (Vertical Drop) */
    .cqd-comment-badge {
      position: absolute;
      top: 21px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
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

    /* HOVER STATE: Expands Vertically to show number */
    .cqd-comment-badge:hover {
      height: 58px;
    }

    /* LTR (Left Border) */
    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    /* RTL (Right Border) */
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
      margin-top: 2px;
      transition: transform 0.2s ease;
    }

    .cqd-badge-label {
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 700;

      opacity: 0;
      transform: translateY(-5px);

      max-height: 0;
      margin-top: 2px;
      overflow: hidden;

      transition:
        opacity 0.15s ease 0.05s,
        transform 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
    }

    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }
  `.trim(),(document.head||document.documentElement).appendChild(o)}const t={en:{download:"Download",downloading:"Downloading…",trying:"Trying…",downloaded:"Downloaded",error:"Error",failed:"Download failed.",ariaDownload:"Download",titleQuick:"Quick download",comments:"comments"},ar:{download:"تنزيل",downloading:"جاري التنزيل…",trying:"محاولة…",downloaded:"تم التنزيل",error:"خطأ",failed:"فشل التنزيل.",ariaDownload:"تنزيل",titleQuick:"تنزيل سريع",comments:"تعليقات"},ja:{download:"ダウンロード",downloading:"DL中…",trying:"試行中…",downloaded:"完了",error:"エラー",failed:"失敗しました。",ariaDownload:"ダウンロード",titleQuick:"クイックダウンロード",comments:"件のコメント"},es:{download:"Descargar",downloading:"Descargando…",trying:"Intentando…",downloaded:"Descargado",error:"Error",failed:"Falló la descarga.",ariaDownload:"Descargar",titleQuick:"Descarga rápida",comments:"comentarios"},hi:{download:"डाउनलोड",downloading:"डाउनलोडिंग…",trying:"कोशिश जारी…",downloaded:"पूर्ण",error:"त्रुटि",failed:"विफल रहा",ariaDownload:"डाउनलोड",titleQuick:"त्वरित डाउनलोड",comments:"टिप्पणियाँ"},pt:{download:"Baixar",downloading:"Baixando…",trying:"Tentando…",downloaded:"Baixado",error:"Erro",failed:"Falha ao baixar.",ariaDownload:"Baixar",titleQuick:"Download rápido",comments:"comentários"},"pt-pt":{download:"Descarregar",downloading:"A descarregar…",trying:"A tentar…",downloaded:"Descarregado",error:"Erro",failed:"Falha ao descarregar.",ariaDownload:"Descarregar",titleQuick:"Descarga rápida",comments:"comentários"},"zh-cn":{download:"下载",downloading:"下载中…",trying:"尝试中…",downloaded:"已下载",error:"错误",failed:"下载失败",ariaDownload:"下载",titleQuick:"快速下载",comments:"条评论"},"zh-tw":{download:"下載",downloading:"下載中…",trying:"嘗試中…",downloaded:"已下載",error:"錯誤",failed:"下載失敗",ariaDownload:"下載",titleQuick:"快速下載",comments:"則留言"},fr:{download:"Télécharger",downloading:"Téléchargement…",trying:"Essai…",downloaded:"Téléchargé",error:"Erreur",failed:"Échec.",ariaDownload:"Télécharger",titleQuick:"Téléchargement rapide",comments:"commentaires"},de:{download:"Herunterladen",downloading:"Laden…",trying:"Versuchen…",downloaded:"Fertig",error:"Fehler",failed:"Fehlgeschlagen.",ariaDownload:"Herunterladen",titleQuick:"Schneller Download",comments:"Kommentare"},it:{download:"Scarica",downloading:"Scaricamento…",trying:"Provando…",downloaded:"Scaricato",error:"Errore",failed:"Fallito.",ariaDownload:"Scarica",titleQuick:"Download rapido",comments:"commenti"},ru:{download:"Скачать",downloading:"Скачивание…",trying:"Попытка…",downloaded:"Скачано",error:"Ошибка",failed:"Сбой.",ariaDownload:"Скачать",titleQuick:"Быстрое скачивание",comments:"комментариев"},ko:{download:"다운로드",downloading:"다운로드 중…",trying:"시도 중…",downloaded:"완료",error:"오류",failed:"실패함",ariaDownload:"다운로드",titleQuick:"빠른 다운로드",comments:"개 댓글"},tr:{download:"İndir",downloading:"İndiriliyor…",trying:"Deneniyor…",downloaded:"İndirildi",error:"Hata",failed:"Başarısız.",ariaDownload:"İndir",titleQuick:"Hızlı indir",comments:"yorum"},vi:{download:"Tải xuống",downloading:"Đang tải…",trying:"Đang thử…",downloaded:"Đã tải",error:"Lỗi",failed:"Thất bại.",ariaDownload:"Tải xuống",titleQuick:"Tải xuống nhanh",comments:"nhận xét"},id:{download:"Download",downloading:"Mengunduh…",trying:"Mencoba…",downloaded:"Selesai",error:"Kesalahan",failed:"Gagal.",ariaDownload:"Download",titleQuick:"Download cepat",comments:"komentar"},th:{download:"ดาวน์โหลด",downloading:"กำลังโหลด…",trying:"พยายาม…",downloaded:"เสร็จสิ้น",error:"ข้อผิดพลาด",failed:"ล้มเหลว",ariaDownload:"ดาวน์โหลด",titleQuick:"ดาวน์โหลดด่วน",comments:"ความคิดเห็น"},pl:{download:"Pobierz",downloading:"Pobieranie…",trying:"Próba…",downloaded:"Pobrano",error:"Błąd",failed:"Nieudane.",ariaDownload:"Pobierz",titleQuick:"Szybkie pobieranie",comments:"komentarze"},nl:{download:"Downloaden",downloading:"Downloaden…",trying:"Proberen…",downloaded:"Klaar",error:"Fout",failed:"Mislukt.",ariaDownload:"Downloaden",titleQuick:"Snel downloaden",comments:"reacties"},bn:{download:"ডাউনলোড",downloading:"ডাউনলোড হচ্ছে…",trying:"চেষ্টা করছে…",downloaded:"সম্পন্ন",error:"ত্রুটি",failed:"ব্যর্থ হয়েছে",ariaDownload:"ডাউনলোড",titleQuick:"দ্রুত ডাউনলোড",comments:"টি মন্তব্য"},pa:{download:"ਡਾਉਨਲੋਡ",downloading:"ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…",trying:"ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…",downloaded:"ਮੁਕੰਮਲ",error:"ਗਲਤੀ",failed:"ਅਸਫਲ",ariaDownload:"ਡਾਉਨਲੋਡ",titleQuick:"ਤੇਜ਼ ਡਾਉਨਲੋਡ",comments:"ਟਿੱਪਣੀਆਂ"},te:{download:"డౌన్‌లోడ్",downloading:"డౌన్‌లోడ్ అవుతోంది…",trying:"ప్రయత్నిస్తోంది…",downloaded:"పూర్తయింది",error:"లోపం",failed:"విఫలమైంది",ariaDownload:"డౌన్‌లోడ్",titleQuick:"త్వరిత డౌన్‌లోడ్",comments:"వ్యాఖ్యలు"},mr:{download:"डाउनलोड",downloading:"डाउनलोड होत आहे…",trying:"प्रयत्न करत आहे…",downloaded:"पूर्ण",error:"त्रुटी",failed:"अयशस्वी",ariaDownload:"डाउनलोड",titleQuick:"त्वरित डाउनलोड",comments:"टिप्पण्या"},ta:{download:"பதிவிறக்கு",downloading:"பதிவிறக்குகிறது…",trying:"முயற்சிக்கிறது…",downloaded:"முடிந்தது",error:"பிழை",failed:"தோல்வி",ariaDownload:"பதிவிறக்கு",titleQuick:"விரைவு பதிவிறக்கம்",comments:"கருத்துகள்"},ur:{download:"ڈاؤن لوڈ",downloading:"ڈاؤن لوڈ ہو رہا ہے…",trying:"کوشش جاری…",downloaded:"مکمل",error:"غلطی",failed:"ناکام",ariaDownload:"ڈاؤن لوڈ",titleQuick:"فوری ڈاؤن لوڈ",comments:"تبصرے"},gu:{download:"ડાઉનલોડ",downloading:"ડાઉનલોડ થઈ રહ્યું છે…",trying:"પ્રયાસ ચાલુ…",downloaded:"પૂર્ણ",error:"ભૂલ",failed:"નિષ્ફળ",ariaDownload:"ડાઉનલોડ",titleQuick:"ઝડપી ડાઉનલોડ",comments:"ટિપ્પણીઓ"},kn:{download:"ಡೌನ್‌ಲೋಡ್",downloading:"ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…",trying:"ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…",downloaded:"ಪೂರ್ಣಗೊಂಡಿದೆ",error:"ದೋಷ",failed:"ವಿಫಲವಾಗಿದೆ",ariaDownload:"ಡೌನ್‌ಲೋಡ್",titleQuick:"ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್",comments:"ಕಾಮೆಂಟ್‌ಗಳು"},ml:{download:"ഡൗൺലോഡ്",downloading:"ഡൗൺലോഡ് ചെയ്യുന്നു…",trying:"ശ്രമിക്കുന്നു…",downloaded:"പൂർത്തിയായി",error:"പിശക്",failed:"പരാജയപ്പെട്ടു",ariaDownload:"ഡൗൺലോഡ്",titleQuick:"വേഗത്തിൽ ഡൗൺലോഡ്",comments:"അഭിപ്രായങ്ങൾ"},uk:{download:"Завантажити",downloading:"Завантаження…",trying:"Спроба…",downloaded:"Готово",error:"Помилка",failed:"Невдача.",ariaDownload:"Завантажити",titleQuick:"Швидке завантаження",comments:"коментарів"},el:{download:"Λήψη",downloading:"Λήψη…",trying:"Προσπάθεια…",downloaded:"Ολοκληρώθηκε",error:"Σφάλμα",failed:"Απέτυχε.",ariaDownload:"Λήψη",titleQuick:"Γρήγορη λήψη",comments:"σχόλια"},cs:{download:"Stáhnout",downloading:"Stahování…",trying:"Zkouším…",downloaded:"Staženo",error:"Chyba",failed:"Selhalo.",ariaDownload:"Stáhnout",titleQuick:"Rychlé stažení",comments:"komentářů"},ro:{download:"Descărcați",downloading:"Se descarcă…",trying:"Se încearcă…",downloaded:"Finalizat",error:"Eroare",failed:"Eșuat.",ariaDownload:"Descărcați",titleQuick:"Descărcare rapidă",comments:"comentarii"},hu:{download:"Letöltés",downloading:"Letöltés…",trying:"Próbálkozás…",downloaded:"Kész",error:"Hiba",failed:"Sikertelen.",ariaDownload:"Letöltés",titleQuick:"Gyors letöltés",comments:"megjegyzés"},sv:{download:"Ladda ner",downloading:"Laddar ner…",trying:"Försöker…",downloaded:"Klart",error:"Fel",failed:"Misslyckades.",ariaDownload:"Ladda ner",titleQuick:"Snabb nedladdning",comments:"kommentarer"},da:{download:"Hent",downloading:"Henter…",trying:"Prøver…",downloaded:"Hentet",error:"Fejl",failed:"Mislykkedes.",ariaDownload:"Hent",titleQuick:"Hurtig download",comments:"kommentarer"},fi:{download:"Lataa",downloading:"Ladataan…",trying:"Yritetään…",downloaded:"Ladattu",error:"Virhe",failed:"Epäonnistui.",ariaDownload:"Lataa",titleQuick:"Pikalataus",comments:"kommenttia"},no:{download:"Last ned",downloading:"Laster ned…",trying:"Prøver…",downloaded:"Ferdig",error:"Feil",failed:"Mislyktes.",ariaDownload:"Last ned",titleQuick:"Rask nedlasting",comments:"kommentarer"},he:{download:"הורדה",downloading:"מוריד…",trying:"מנסה…",downloaded:"הושלם",error:"שגיאה",failed:"נכשל",ariaDownload:"הורדה",titleQuick:"הורדה מהירה",comments:"תגובות"},fa:{download:"دانلود",downloading:"درحال دانلود…",trying:"تلاش مجدد…",downloaded:"انجام شد",error:"خطا",failed:"ناموفق",ariaDownload:"دانلود",titleQuick:"دانلود سریع",comments:"نظر"},fil:{download:"I-download",downloading:"Nagda-download…",trying:"Sinusubukan…",downloaded:"Tapos na",error:"Error",failed:"Nabigo.",ariaDownload:"I-download",titleQuick:"Mabilis na download",comments:"mga komento"},ms:{download:"Muat turun",downloading:"Memuat turun…",trying:"Mencuba…",downloaded:"Selesai",error:"Ralat",failed:"Gagal.",ariaDownload:"Muat turun",titleQuick:"Muat turun pantas",comments:"komen"},sr:{download:"Преузми",downloading:"Преузимање…",trying:"Покушавам…",downloaded:"Завршено",error:"Грешка",failed:"Неуспешно.",ariaDownload:"Преузми",titleQuick:"Брзо преузимање",comments:"коментара"},sk:{download:"Stiahnuť",downloading:"Sťahovanie…",trying:"Skúšam…",downloaded:"Hotovo",error:"Chyba",failed:"Zlyhalo.",ariaDownload:"Stiahnuť",titleQuick:"Rýchle stiahnutie",comments:"komentárov"},bg:{download:"Изтегли",downloading:"Изтегляне…",trying:"Опит…",downloaded:"Готово",error:"Грешка",failed:"Неуспешно.",ariaDownload:"Изтегли",titleQuick:"Бързо изтегляне",comments:"коментара"},hr:{download:"Preuzmi",downloading:"Preuzimanje…",trying:"Pokušavam…",downloaded:"Gotovo",error:"Greška",failed:"Neuspjelo.",ariaDownload:"Preuzmi",titleQuick:"Brzo preuzimanje",comments:"komentara"},lt:{download:"Atsisiųsti",downloading:"Siunčiama…",trying:"Bandoma…",downloaded:"Baigta",error:"Klaida",failed:"Nepavyko.",ariaDownload:"Atsisiųsti",titleQuick:"Greitas atsisiuntimas",comments:"komentarai"},lv:{download:"Lejupielādēt",downloading:"Lejupielādē…",trying:"Mēģina…",downloaded:"Pabeigts",error:"Kļūda",failed:"Neizdevās.",ariaDownload:"Lejupielādēt",titleQuick:"Ātrā lejupielāde",comments:"komentāri"},et:{download:"Laadi alla",downloading:"Laadimine…",trying:"Proovin…",downloaded:"Valmis",error:"Viga",failed:"Ebaõnnestus.",ariaDownload:"Laadi alla",titleQuick:"Kiire allalaadimine",comments:"kommentaari"},sl:{download:"Prenos",downloading:"Prenašanje…",trying:"Poskušam…",downloaded:"Končano",error:"Napaka",failed:"Ni uspelo.",ariaDownload:"Prenos",titleQuick:"Hiter prenos",comments:"komentarjev"},ca:{download:"Descarrega",downloading:"Descarregant…",trying:"Intentant…",downloaded:"Descarregat",error:"Error",failed:"Ha fallat.",ariaDownload:"Descarrega",titleQuick:"Descàrrega ràpida",comments:"comentaris"},af:{download:"Aflaai",downloading:"Laai af…",trying:"Probeer…",downloaded:"Klaar",error:"Fout",failed:"Misluk.",ariaDownload:"Aflaai",titleQuick:"Vinnige aflaai",comments:"kommentare"},am:{download:"አውርድ",downloading:"በማውረድ ላይ…",trying:"በመሞከር ላይ…",downloaded:"ወርዷል",error:"ስህተት",failed:"አልተሳካም።",ariaDownload:"አውርድ",titleQuick:"ፈጣን ማውረድ",comments:"አስተያየቶች"},hy:{download:"Ներբեռնել",downloading:"Ներբեռնում…",trying:"Փորձում է…",downloaded:"Ավարտված",error:"Սխալ",failed:"Ձախողվեց:",ariaDownload:"Ներբեռնել",titleQuick:"Արագ ներբեռնում",comments:"մեկնաբանություն"},as:{download:"ডাউন্লোড",downloading:"ডাউন্লোড হৈ আছে…",trying:"চেষ্টা কৰি আছে…",downloaded:"সম্পূৰ্ণ",error:"ত্ৰুটি",failed:"বিফল হ’ল",ariaDownload:"ডাউন্লোড",titleQuick:"দ্ৰুত ডাউন্লোড",comments:"মন্তব্য"},az:{download:"Yüklə",downloading:"Yüklənir…",trying:"Cəhd edilir…",downloaded:"Bitdi",error:"Xəta",failed:"Alınmadı.",ariaDownload:"Yüklə",titleQuick:"Sürətli yükləmə",comments:"şərh"},eu:{download:"Deskargatu",downloading:"Deskargatzen…",trying:"Saiatzen…",downloaded:"Eginda",error:"Errorea",failed:"Huts egin du.",ariaDownload:"Deskargatu",titleQuick:"Deskarga azkarra",comments:"iruzkin"},my:{download:"ဒေါင်းလုဒ်",downloading:"ဒေါင်းလုဒ် လုပ်နေ…",trying:"ကြိုးစားနေ…",downloaded:"ပြီးပါပြီ",error:"အမှား",failed:"မအောင်မြင်ပါ။",ariaDownload:"ဒေါင်းလုဒ်",titleQuick:"အမြန် ဒေါင်းလုဒ်",comments:"မှတ်ချက်များ"},gl:{download:"Descargar",downloading:"Descargando…",trying:"Tentando…",downloaded:"Descargado",error:"Erro",failed:"Fallou.",ariaDownload:"Descargar",titleQuick:"Descarga rápida",comments:"comentarios"},ka:{download:"ჩამოტვირთვა",downloading:"იწერება…",trying:"მცდელობა…",downloaded:"დასრულდა",error:"შეცდომა",failed:"ვერ მოხერხდა.",ariaDownload:"ჩამოტვირთვა",titleQuick:"სწრაფი ჩამოტვირთვა",comments:"კომენტარი"},is:{download:"Sækja",downloading:"Sækir…",trying:"Reyni…",downloaded:"Sótt",error:"Villa",failed:"Mistókst.",ariaDownload:"Sækja",titleQuick:"Flýtiniðurhal",comments:"ummæli"},ga:{download:"Íoslódáil",downloading:"Ag íoslódáil…",trying:"Ag iarraidh…",downloaded:"Íoslódáilte",error:"Earráid",failed:"Theip air.",ariaDownload:"Íoslódáil",titleQuick:"Íoslódáil tapa",comments:"trácht"},kk:{download:"Жүктеп алу",downloading:"Жүктелуде…",trying:"Әрекет…",downloaded:"Аяқталды",error:"Қате",failed:"Сәтсіз.",ariaDownload:"Жүктеп алу",titleQuick:"Жылдам жүктеу",comments:"пікір"},km:{download:"ទាញយក",downloading:"កំពុងទាញយក…",trying:"កំពុងព្យាយាម…",downloaded:"បានបញ្ចប់",error:"កំហុស",failed:"បរាជ័យ",ariaDownload:"ទាញយក",titleQuick:"ទាញយកលឿន",comments:"មតិ"},lo:{download:"ດາວໂຫລດ",downloading:"ກຳລັງດາວໂຫລດ…",trying:"ກຳລັງພະຍາຍາມ…",downloaded:"ສຳເລັດ",error:"ຜິດພາດ",failed:"ລົ້ມເຫລວ",ariaDownload:"ດາວໂຫລດ",titleQuick:"ດາວໂຫລດດ່ວນ",comments:"ຄຳເຫັນ"},mk:{download:"Преземи",downloading:"Преземање…",trying:"Се обидувам…",downloaded:"Готово",error:"Грешка",failed:"Неуспешно.",ariaDownload:"Преземи",titleQuick:"Брзо преземање",comments:"коментари"},mn:{download:"Татах",downloading:"Татаж байна…",trying:"Орлдож байна…",downloaded:"Татсан",error:"Алдаа",failed:"Амжилтгүй.",ariaDownload:"Татах",titleQuick:"Хурдан татах",comments:"сэтгэгдэл"},ne:{download:"डाउनलोड",downloading:"डाउनलोड हुँदै…",trying:"प्रयास गर्दै…",downloaded:"पूरा भयो",error:"त्रुटि",failed:"असफल भयो",ariaDownload:"डाउनलोड",titleQuick:"छिटो डाउनलोड",comments:"टिप्पणीहरू"},or:{download:"ଡାଉନଲୋଡ୍",downloading:"ଡାଉନଲୋଡ୍ ହେଉଛି…",trying:"ଚେଷ୍ଟା କରୁଛି…",downloaded:"ସମ୍ପୂର୍ଣ୍ଣ",error:"ତ୍ରୁଟି",failed:"ବିଫଳ ହେଲା",ariaDownload:"ଡାଉନଲୋଡ୍",titleQuick:"ଶୀଘ୍ର ଡାଉନଲୋଡ୍",comments:"ମନ୍ତବ୍ୟ"},si:{download:"බාගන්න",downloading:"බාගත වෙමින්…",trying:"උත්සාහ කරමින්…",downloaded:"අවසන්",error:"දෝෂයකි",failed:"අසාර්ථකයි",ariaDownload:"බාගන්න",titleQuick:"ඉක්මන් බාගත කිරීම",comments:"අදහස්"},sw:{download:"Pakua",downloading:"Inapakua…",trying:"Inajaribu…",downloaded:"Imekamilika",error:"Hitilafu",failed:"Imeshindwa.",ariaDownload:"Pakua",titleQuick:"Pakua haraka",comments:"maoni"},uz:{download:"Yuklash",downloading:"Yuklanmoqda…",trying:"Urinilmoqda…",downloaded:"Tayyor",error:"Xato",failed:"Muvaffaqiyatsiz.",ariaDownload:"Yuklash",titleQuick:"Tez yuklash",comments:"sharhlar"},cy:{download:"Lawrlwytho",downloading:"Yn lawrlwytho…",trying:"Yn ceisio…",downloaded:"Wedi gorffen",error:"Gwall",failed:"Methodd.",ariaDownload:"Lawrlwytho",titleQuick:"Lawrlwytho cyflym",comments:"sylwadau"},zu:{download:"Landa",downloading:"Iyalandwa…",trying:"Iyazama…",downloaded:"Ilandīwe",error:"Iphutha",failed:"Ihlulekile.",ariaDownload:"Landa",titleQuick:"Ukulanda okusheshayo",comments:"amazwana"},sq:{download:"Shkarko",downloading:"Duke shkarkuar…",trying:"Duke provuar…",downloaded:"Përfundoi",error:"Gabim",failed:"Dështoi.",ariaDownload:"Shkarko",titleQuick:"Shkarkim i shpejtë",comments:"komente"}};function E(o){try{let e="en";typeof document<"u"&&document.documentElement&&document.documentElement.lang?e=document.documentElement.lang:typeof navigator<"u"&&navigator.language&&(e=navigator.language);const a=e.toLowerCase().split(";")[0].trim().replace("_","-"),n=a.split("-")[0];return t[a]&&typeof t[a][o]=="string"?t[a][o]:t[n]&&typeof t[n][o]=="string"?t[n][o]:t.en&&typeof t.en[o]=="string"?t.en[o]:o}catch{try{return t.en[o]||o}catch{return String(o)}}}const y="div[data-stream-item-id]",m="data-cqd-processed",T={matches:["https://classroom.google.com/*"],runAt:"document_idle",main(){S(),i(),new MutationObserver(a=>{requestAnimationFrame(()=>{i()})}).observe(document.body,{childList:!0,subtree:!0}),setInterval(()=>{i()},1e3);let e=location.href;new MutationObserver(()=>{const a=location.href;a!==e&&(e=a,setTimeout(i,500))}).observe(document,{subtree:!0,childList:!0})}};function i(){try{const o=Q();document.body.setAttribute("data-cqd-dir",o),document.querySelectorAll(y).forEach(a=>{if(a.hasAttribute(m)){if(a.querySelector(".cqd-overlay-container"))return;a.removeAttribute(m)}if(a.parentElement?.closest(y))return;const r=((a.innerText||"")+" "+F(a)).match(/(\d+)\s+class comment/i),d=r?parseInt(r[1],10):0;d>0&&(a.setAttribute(m,"true"),L(a,d))})}catch(o){console.warn("CQD Scan Error:",o)}}function L(o,e){const a=window.getComputedStyle(o),n=a.borderRadius||"8px";a.position==="static"&&(o.style.position="relative"),o.style.setProperty("overflow","visible","important"),o.style.setProperty("contain","none","important"),o.style.zIndex="1";const r=document.createElement("div");r.className="cqd-overlay-container",r.style.borderRadius=n,r.addEventListener("click",p=>{p.target===r&&k(o)}),o.appendChild(r);const d=document.createElement("div");d.className="cqd-comment-badge",d.title=`${e} ${E("comments")}`;const w=document.createElement("div");w.className="cqd-badge-icon",w.style.backgroundImage=`url("${D}")`;const h=document.createElement("span");h.className="cqd-badge-label",h.textContent=`${e}`,d.appendChild(w),d.appendChild(h),d.addEventListener("click",p=>{p.stopPropagation(),k(o)}),o.appendChild(d)}function k(o){const e=o.querySelector('a[href*="/details/"], h2 a');e?e.click():o.click()}function Q(){return(document.documentElement.dir||document.body.dir)==="rtl"||window.getComputedStyle(document.body).direction==="rtl"?"rtl":"ltr"}function F(o){return Array.from(o.querySelectorAll("[aria-label]")).map(e=>e.getAttribute("aria-label")||"").join(" ")}const x=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;function l(o,...e){}const I={debug:(...o)=>l(console.debug,...o),log:(...o)=>l(console.log,...o),warn:(...o)=>l(console.warn,...o),error:(...o)=>l(console.error,...o)};class g extends Event{constructor(e,a){super(g.EVENT_NAME,{}),this.newUrl=e,this.oldUrl=a}static EVENT_NAME=u("wxt:locationchange")}function u(o){return`${x?.runtime?.id}:comment_frame:${o}`}function A(o){let e,a;return{run(){e==null&&(a=new URL(location.href),e=o.setInterval(()=>{let n=new URL(location.href);n.href!==a.href&&(window.dispatchEvent(new g(n,a)),a=n)},1e3))}}}class s{constructor(e,a){this.contentScriptName=e,this.options=a,this.abortController=new AbortController,this.isTopFrame?(this.listenForNewerScripts({ignoreFirstEvent:!0}),this.stopOldScripts()):this.listenForNewerScripts()}static SCRIPT_STARTED_MESSAGE_TYPE=u("wxt:content-script-started");isTopFrame=window.self===window.top;abortController;locationWatcher=A(this);receivedMessageIds=new Set;get signal(){return this.abortController.signal}abort(e){return this.abortController.abort(e)}get isInvalid(){return x.runtime.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(e){return this.signal.addEventListener("abort",e),()=>this.signal.removeEventListener("abort",e)}block(){return new Promise(()=>{})}setInterval(e,a){const n=setInterval(()=>{this.isValid&&e()},a);return this.onInvalidated(()=>clearInterval(n)),n}setTimeout(e,a){const n=setTimeout(()=>{this.isValid&&e()},a);return this.onInvalidated(()=>clearTimeout(n)),n}requestAnimationFrame(e){const a=requestAnimationFrame((...n)=>{this.isValid&&e(...n)});return this.onInvalidated(()=>cancelAnimationFrame(a)),a}requestIdleCallback(e,a){const n=requestIdleCallback((...r)=>{this.signal.aborted||e(...r)},a);return this.onInvalidated(()=>cancelIdleCallback(n)),n}addEventListener(e,a,n,r){a==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),e.addEventListener?.(a.startsWith("wxt:")?u(a):a,n,{...r,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),I.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){window.postMessage({type:s.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:Math.random().toString(36).slice(2)},"*")}verifyScriptStartedEvent(e){const a=e.data?.type===s.SCRIPT_STARTED_MESSAGE_TYPE,n=e.data?.contentScriptName===this.contentScriptName,r=!this.receivedMessageIds.has(e.data?.messageId);return a&&n&&r}listenForNewerScripts(e){let a=!0;const n=r=>{if(this.verifyScriptStartedEvent(r)){this.receivedMessageIds.add(r.data.messageId);const d=a;if(a=!1,d&&e?.ignoreFirstEvent)return;this.notifyInvalidated()}};addEventListener("message",n),this.onInvalidated(()=>removeEventListener("message",n))}}function O(){}function c(o,...e){}const C={debug:(...o)=>c(console.debug,...o),log:(...o)=>c(console.log,...o),warn:(...o)=>c(console.warn,...o),error:(...o)=>c(console.error,...o)};return(async()=>{try{const{main:o,...e}=T,a=new s("comment_frame",e);return await o(a)}catch(o){throw C.error('The content script "comment_frame" crashed on startup!',o),o}})()})();
commentframe;