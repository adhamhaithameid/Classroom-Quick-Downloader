// filepath: entrypoints/content/i18n.ts

/**
 * SHARED DICTIONARY
 * * To add a new language:
 * 1. Add the language code (e.g. 'fr', 'es-mx') as a key.
 * 2. Copy the English block.
 * 3. Translate the values.
 */

const TRANSLATIONS: Record<string, any> = {
  // English (Default)
  en: {
    download: 'Download',
    downloading: 'Downloading…',
    trying: 'Trying…',
    downloaded: 'Downloaded',
    error: 'Error',
    failed: 'Download failed.',
    ariaDownload: 'Download',
    titleQuick: 'Quick download',
    comments: 'comments',
  },
  // Arabic
  ar: {
    download: 'تنزيل',
    downloading: 'جاري التنزيل…',
    trying: 'محاولة…',
    downloaded: 'تم التنزيل',
    error: 'خطأ',
    failed: 'فشل التنزيل.',
    ariaDownload: 'تنزيل',
    titleQuick: 'تنزيل سريع',
    comments: 'تعليقات',
  },
  // Japanese
  ja: {
    download: 'ダウンロード',
    downloading: 'DL中…',
    trying: '試行中…',
    downloaded: '完了',
    error: 'エラー',
    failed: '失敗しました。',
    ariaDownload: 'ダウンロード',
    titleQuick: 'クイックダウンロード',
    comments: '件のコメント',
  },
  // Spanish (General)
  es: {
    download: 'Descargar',
    downloading: 'Descargando…',
    trying: 'Intentando…',
    downloaded: 'Descargado',
    error: 'Error',
    failed: 'Falló la descarga.',
    ariaDownload: 'Descargar',
    titleQuick: 'Descarga rápida',
    comments: 'comentarios',
  },
  // Hindi
  hi: {
    download: 'डाउनलोड',
    downloading: 'डाउनलोड हो रहा है…',
    trying: 'कोशिश कर रहा हूँ…',
    downloaded: 'डाउनलोड हो गया',
    error: 'त्रुटि',
    failed: 'विफल रहा',
    ariaDownload: 'डाउनलोड',
    titleQuick: 'त्वरित डाउनलोड',
    comments: 'टिप्पणियाँ',
  },
  // Portuguese
  pt: {
    download: 'Baixar',
    downloading: 'Baixando…',
    trying: 'Tentando…',
    downloaded: 'Baixado',
    error: 'Erro',
    failed: 'Falha ao baixar.',
    ariaDownload: 'Baixar',
    titleQuick: 'Download rápido',
    comments: 'comentários',
  },
  // Chinese Simplified
  'zh-cn': {
    download: '下载',
    downloading: '下载中…',
    trying: '尝试中…',
    downloaded: '已下载',
    error: '错误',
    failed: '下载失败',
    ariaDownload: '下载',
    titleQuick: '快速下载',
    comments: '条评论',
  },
  // Chinese Traditional
  'zh-tw': {
    download: '下載',
    downloading: '下載中…',
    trying: '嘗試中…',
    downloaded: '已下載',
    error: '錯誤',
    failed: '下載失敗',
    ariaDownload: '下載',
    titleQuick: '快速下載',
    comments: '則留言',
  },
  // French
  fr: {
    download: 'Télécharger',
    downloading: 'Téléchargement…',
    trying: 'Essai…',
    downloaded: 'Téléchargé',
    error: 'Erreur',
    failed: 'Échec du téléchargement.',
    ariaDownload: 'Télécharger',
    titleQuick: 'Téléchargement rapide',
    comments: 'commentaires',
  },
  // German
  de: {
    download: 'Herunterladen',
    downloading: 'Laden…',
    trying: 'Versuchen…',
    downloaded: 'Heruntergeladen',
    error: 'Fehler',
    failed: 'Fehlgeschlagen.',
    ariaDownload: 'Herunterladen',
    titleQuick: 'Schneller Download',
    comments: 'Kommentare',
  },
  // Italian
  it: {
    download: 'Scarica',
    downloading: 'Scaricamento…',
    trying: 'Provando…',
    downloaded: 'Scaricato',
    error: 'Errore',
    failed: 'Scaricamento fallito.',
    ariaDownload: 'Scarica',
    titleQuick: 'Download rapido',
    comments: 'commenti',
  },
  // Russian
  ru: {
    download: 'Скачать',
    downloading: 'Скачивание…',
    trying: 'Попытка…',
    downloaded: 'Скачано',
    error: 'Ошибка',
    failed: 'Ошибка скачивания.',
    ariaDownload: 'Скачать',
    titleQuick: 'Быстрое скачивание',
    comments: 'комментариев',
  },
  // Korean
  ko: {
    download: '다운로드',
    downloading: '다운로드 중…',
    trying: '시도 중…',
    downloaded: '완료됨',
    error: '오류',
    failed: '다운로드 실패',
    ariaDownload: '다운로드',
    titleQuick: '빠른 다운로드',
    comments: '개 댓글',
  },
  // Turkish
  tr: {
    download: 'İndir',
    downloading: 'İndiriliyor…',
    trying: 'Deneniyor…',
    downloaded: 'İndirildi',
    error: 'Hata',
    failed: 'İndirme başarısız.',
    ariaDownload: 'İndir',
    titleQuick: 'Hızlı indir',
    comments: 'yorum',
  },
  // Vietnamese
  vi: {
    download: 'Tải xuống',
    downloading: 'Đang tải…',
    trying: 'Đang thử…',
    downloaded: 'Đã tải',
    error: 'Lỗi',
    failed: 'Tải xuống thất bại.',
    ariaDownload: 'Tải xuống',
    titleQuick: 'Tải xuống nhanh',
    comments: 'nhận xét',
  },
  // Indonesian
  id: {
    download: 'Download',
    downloading: 'Mengunduh…',
    trying: 'Mencoba…',
    downloaded: 'Selesai',
    error: 'Kesalahan',
    failed: 'Gagal mengunduh.',
    ariaDownload: 'Download',
    titleQuick: 'Download cepat',
    comments: 'komentar',
  },
  // Thai
  th: {
    download: 'ดาวน์โหลด',
    downloading: 'กำลังดาวน์โหลด…',
    trying: 'กำลังพยายาม…',
    downloaded: 'เสร็จสิ้น',
    error: 'ข้อผิดพลาด',
    failed: 'ดาวน์โหลดล้มเหลว',
    ariaDownload: 'ดาวน์โหลด',
    titleQuick: 'ดาวน์โหลดด่วน',
    comments: 'ความคิดเห็น',
  },
  // Polish
  pl: {
    download: 'Pobierz',
    downloading: 'Pobieranie…',
    trying: 'Próba…',
    downloaded: 'Pobrano',
    error: 'Błąd',
    failed: 'Nieudane.',
    ariaDownload: 'Pobierz',
    titleQuick: 'Szybkie pobieranie',
    comments: 'komentarze',
  },
  // Dutch
  nl: {
    download: 'Downloaden',
    downloading: 'Downloaden…',
    trying: 'Proberen…',
    downloaded: 'Gedownload',
    error: 'Fout',
    failed: 'Mislukt.',
    ariaDownload: 'Downloaden',
    titleQuick: 'Snel downloaden',
    comments: 'reacties',
  },
};

export type LangKey = keyof typeof TRANSLATIONS.en;

/**
 * Helper function to get translated string based on <html lang="...">
 */
export function t(key: LangKey): string {
  if (typeof document === 'undefined') return TRANSLATIONS['en'][key];

  const rawLang = (document.documentElement.lang || 'en').toLowerCase(); // e.g. "pt-br", "en-us"
  const baseLang = rawLang.split('-')[0]; // e.g. "pt", "en"

  // 1. Try exact match (e.g. "zh-cn")
  if (TRANSLATIONS[rawLang] && TRANSLATIONS[rawLang][key]) {
    return TRANSLATIONS[rawLang][key];
  }

  // 2. Try base match (e.g. "es" for "es-mx")
  if (TRANSLATIONS[baseLang] && TRANSLATIONS[baseLang][key]) {
    return TRANSLATIONS[baseLang][key];
  }

  // 3. Fallback to English
  return TRANSLATIONS['en'][key] || key;
}