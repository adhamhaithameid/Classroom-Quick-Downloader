// filepath: entrypoints/content/i18n.ts

/**
 * SHARED DICTIONARY - 75 LANGUAGES
 * * Covers ALL supported Google Classroom languages as of 2025.
 * * Structure:
 * - download: Button label (Idle)
 * - downloading: Button label (Loading)
 * - trying: Button label (Retrying/Auth loop)
 * - downloaded: Button label (Success)
 * - error: Button label (Error state)
 * - failed: Error tooltip detail
 * - ariaDownload: Accessible label
 * - titleQuick: Tooltip title
 * - comments: Word for "comments" (e.g., "5 comments")
 */

const TRANSLATIONS: Record<string, any> = {
  // 1. English (Default)
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
  // 2. Arabic
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
  // 3. Japanese
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
  // 4. Spanish
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
  // 5. Hindi
  hi: {
    download: 'डाउनलोड',
    downloading: 'डाउनलोडिंग…',
    trying: 'कोशिश जारी…',
    downloaded: 'पूर्ण',
    error: 'त्रुटि',
    failed: 'विफल रहा',
    ariaDownload: 'डाउनलोड',
    titleQuick: 'त्वरित डाउनलोड',
    comments: 'टिप्पणियाँ',
  },
  // 6. Portuguese (Brazil - Default)
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
  // 7. Portuguese (Portugal)
  'pt-pt': {
    download: 'Descarregar',
    downloading: 'A descarregar…',
    trying: 'A tentar…',
    downloaded: 'Descarregado',
    error: 'Erro',
    failed: 'Falha ao descarregar.',
    ariaDownload: 'Descarregar',
    titleQuick: 'Descarga rápida',
    comments: 'comentários',
  },
  // 8. Chinese Simplified
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
  // 9. Chinese Traditional
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
  // 10. French
  fr: {
    download: 'Télécharger',
    downloading: 'Téléchargement…',
    trying: 'Essai…',
    downloaded: 'Téléchargé',
    error: 'Erreur',
    failed: 'Échec.',
    ariaDownload: 'Télécharger',
    titleQuick: 'Téléchargement rapide',
    comments: 'commentaires',
  },
  // 11. German
  de: {
    download: 'Herunterladen',
    downloading: 'Laden…',
    trying: 'Versuchen…',
    downloaded: 'Fertig',
    error: 'Fehler',
    failed: 'Fehlgeschlagen.',
    ariaDownload: 'Herunterladen',
    titleQuick: 'Schneller Download',
    comments: 'Kommentare',
  },
  // 12. Italian
  it: {
    download: 'Scarica',
    downloading: 'Scaricamento…',
    trying: 'Provando…',
    downloaded: 'Scaricato',
    error: 'Errore',
    failed: 'Fallito.',
    ariaDownload: 'Scarica',
    titleQuick: 'Download rapido',
    comments: 'commenti',
  },
  // 13. Russian
  ru: {
    download: 'Скачать',
    downloading: 'Скачивание…',
    trying: 'Попытка…',
    downloaded: 'Скачано',
    error: 'Ошибка',
    failed: 'Сбой.',
    ariaDownload: 'Скачать',
    titleQuick: 'Быстрое скачивание',
    comments: 'комментариев',
  },
  // 14. Korean
  ko: {
    download: '다운로드',
    downloading: '다운로드 중…',
    trying: '시도 중…',
    downloaded: '완료',
    error: '오류',
    failed: '실패함',
    ariaDownload: '다운로드',
    titleQuick: '빠른 다운로드',
    comments: '개 댓글',
  },
  // 15. Turkish
  tr: {
    download: 'İndir',
    downloading: 'İndiriliyor…',
    trying: 'Deneniyor…',
    downloaded: 'İndirildi',
    error: 'Hata',
    failed: 'Başarısız.',
    ariaDownload: 'İndir',
    titleQuick: 'Hızlı indir',
    comments: 'yorum',
  },
  // 16. Vietnamese
  vi: {
    download: 'Tải xuống',
    downloading: 'Đang tải…',
    trying: 'Đang thử…',
    downloaded: 'Đã tải',
    error: 'Lỗi',
    failed: 'Thất bại.',
    ariaDownload: 'Tải xuống',
    titleQuick: 'Tải xuống nhanh',
    comments: 'nhận xét',
  },
  // 17. Indonesian
  id: {
    download: 'Download',
    downloading: 'Mengunduh…',
    trying: 'Mencoba…',
    downloaded: 'Selesai',
    error: 'Kesalahan',
    failed: 'Gagal.',
    ariaDownload: 'Download',
    titleQuick: 'Download cepat',
    comments: 'komentar',
  },
  // 18. Thai
  th: {
    download: 'ดาวน์โหลด',
    downloading: 'กำลังโหลด…',
    trying: 'พยายาม…',
    downloaded: 'เสร็จสิ้น',
    error: 'ข้อผิดพลาด',
    failed: 'ล้มเหลว',
    ariaDownload: 'ดาวน์โหลด',
    titleQuick: 'ดาวน์โหลดด่วน',
    comments: 'ความคิดเห็น',
  },
  // 19. Polish
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
  // 20. Dutch
  nl: {
    download: 'Downloaden',
    downloading: 'Downloaden…',
    trying: 'Proberen…',
    downloaded: 'Klaar',
    error: 'Fout',
    failed: 'Mislukt.',
    ariaDownload: 'Downloaden',
    titleQuick: 'Snel downloaden',
    comments: 'reacties',
  },
  // 21. Bengali
  bn: {
    download: 'ডাউনলোড',
    downloading: 'ডাউনলোড হচ্ছে…',
    trying: 'চেষ্টা করছে…',
    downloaded: 'সম্পন্ন',
    error: 'ত্রুটি',
    failed: 'ব্যর্থ হয়েছে',
    ariaDownload: 'ডাউনলোড',
    titleQuick: 'দ্রুত ডাউনলোড',
    comments: 'টি মন্তব্য',
  },
  // 22. Punjabi
  pa: {
    download: 'ਡਾਉਨਲੋਡ',
    downloading: 'ਡਾਉਨਲੋਡ ਹੋ ਰਿਹਾ…',
    trying: 'ਕੋਸ਼ਿਸ਼ ਜਾਰੀ…',
    downloaded: 'ਮੁਕੰਮਲ',
    error: 'ਗਲਤੀ',
    failed: 'ਅਸਫਲ',
    ariaDownload: 'ਡਾਉਨਲੋਡ',
    titleQuick: 'ਤੇਜ਼ ਡਾਉਨਲੋਡ',
    comments: 'ਟਿੱਪਣੀਆਂ',
  },
  // 23. Telugu
  te: {
    download: 'డౌన్‌లోడ్',
    downloading: 'డౌన్‌లోడ్ అవుతోంది…',
    trying: 'ప్రయత్నిస్తోంది…',
    downloaded: 'పూర్తయింది',
    error: 'లోపం',
    failed: 'విఫలమైంది',
    ariaDownload: 'డౌన్‌లోడ్',
    titleQuick: 'త్వరిత డౌన్‌లోడ్',
    comments: 'వ్యాఖ్యలు',
  },
  // 24. Marathi
  mr: {
    download: 'डाउनलोड',
    downloading: 'डाउनलोड होत आहे…',
    trying: 'प्रयत्न करत आहे…',
    downloaded: 'पूर्ण',
    error: 'त्रुटी',
    failed: 'अयशस्वी',
    ariaDownload: 'डाउनलोड',
    titleQuick: 'त्वरित डाउनलोड',
    comments: 'टिप्पण्या',
  },
  // 25. Tamil
  ta: {
    download: 'பதிவிறக்கு',
    downloading: 'பதிவிறக்குகிறது…',
    trying: 'முயற்சிக்கிறது…',
    downloaded: 'முடிந்தது',
    error: 'பிழை',
    failed: 'தோல்வி',
    ariaDownload: 'பதிவிறக்கு',
    titleQuick: 'விரைவு பதிவிறக்கம்',
    comments: 'கருத்துகள்',
  },
  // 26. Urdu
  ur: {
    download: 'ڈاؤن لوڈ',
    downloading: 'ڈاؤن لوڈ ہو رہا ہے…',
    trying: 'کوشش جاری…',
    downloaded: 'مکمل',
    error: 'غلطی',
    failed: 'ناکام',
    ariaDownload: 'ڈاؤن لوڈ',
    titleQuick: 'فوری ڈاؤن لوڈ',
    comments: 'تبصرے',
  },
  // 27. Gujarati
  gu: {
    download: 'ડાઉનલોડ',
    downloading: 'ડાઉનલોડ થઈ રહ્યું છે…',
    trying: 'પ્રયાસ ચાલુ…',
    downloaded: 'પૂર્ણ',
    error: 'ભૂલ',
    failed: 'નિષ્ફળ',
    ariaDownload: 'ડાઉનલોડ',
    titleQuick: 'ઝડપી ડાઉનલોડ',
    comments: 'ટિપ્પણીઓ',
  },
  // 28. Kannada
  kn: {
    download: 'ಡೌನ್‌ಲೋಡ್',
    downloading: 'ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
    trying: 'ಪ್ರಯತ್ನಿಸುತ್ತಿದೆ…',
    downloaded: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    error: 'ದೋಷ',
    failed: 'ವಿಫಲವಾಗಿದೆ',
    ariaDownload: 'ಡೌನ್‌ಲೋಡ್',
    titleQuick: 'ತ್ವರಿತ ಡೌನ್‌ಲೋಡ್',
    comments: 'ಕಾಮೆಂಟ್‌ಗಳು',
  },
  // 29. Malayalam
  ml: {
    download: 'ഡൗൺലോഡ്',
    downloading: 'ഡൗൺലോഡ് ചെയ്യുന്നു…',
    trying: 'ശ്രമിക്കുന്നു…',
    downloaded: 'പൂർത്തിയായി',
    error: 'പിശക്',
    failed: 'പരാജയപ്പെട്ടു',
    ariaDownload: 'ഡൗൺലോഡ്',
    titleQuick: 'വേഗത്തിൽ ഡൗൺലോഡ്',
    comments: 'അഭിപ്രായങ്ങൾ',
  },
  // 30. Ukrainian
  uk: {
    download: 'Завантажити',
    downloading: 'Завантаження…',
    trying: 'Спроба…',
    downloaded: 'Готово',
    error: 'Помилка',
    failed: 'Невдача.',
    ariaDownload: 'Завантажити',
    titleQuick: 'Швидке завантаження',
    comments: 'коментарів',
  },
  // 31. Greek
  el: {
    download: 'Λήψη',
    downloading: 'Λήψη…',
    trying: 'Προσπάθεια…',
    downloaded: 'Ολοκληρώθηκε',
    error: 'Σφάλμα',
    failed: 'Απέτυχε.',
    ariaDownload: 'Λήψη',
    titleQuick: 'Γρήγορη λήψη',
    comments: 'σχόλια',
  },
  // 32. Czech
  cs: {
    download: 'Stáhnout',
    downloading: 'Stahování…',
    trying: 'Zkouším…',
    downloaded: 'Staženo',
    error: 'Chyba',
    failed: 'Selhalo.',
    ariaDownload: 'Stáhnout',
    titleQuick: 'Rychlé stažení',
    comments: 'komentářů',
  },
  // 33. Romanian
  ro: {
    download: 'Descărcați',
    downloading: 'Se descarcă…',
    trying: 'Se încearcă…',
    downloaded: 'Finalizat',
    error: 'Eroare',
    failed: 'Eșuat.',
    ariaDownload: 'Descărcați',
    titleQuick: 'Descărcare rapidă',
    comments: 'comentarii',
  },
  // 34. Hungarian
  hu: {
    download: 'Letöltés',
    downloading: 'Letöltés…',
    trying: 'Próbálkozás…',
    downloaded: 'Kész',
    error: 'Hiba',
    failed: 'Sikertelen.',
    ariaDownload: 'Letöltés',
    titleQuick: 'Gyors letöltés',
    comments: 'megjegyzés',
  },
  // 35. Swedish
  sv: {
    download: 'Ladda ner',
    downloading: 'Laddar ner…',
    trying: 'Försöker…',
    downloaded: 'Klart',
    error: 'Fel',
    failed: 'Misslyckades.',
    ariaDownload: 'Ladda ner',
    titleQuick: 'Snabb nedladdning',
    comments: 'kommentarer',
  },
  // 36. Danish
  da: {
    download: 'Hent',
    downloading: 'Henter…',
    trying: 'Prøver…',
    downloaded: 'Hentet',
    error: 'Fejl',
    failed: 'Mislykkedes.',
    ariaDownload: 'Hent',
    titleQuick: 'Hurtig download',
    comments: 'kommentarer',
  },
  // 37. Finnish
  fi: {
    download: 'Lataa',
    downloading: 'Ladataan…',
    trying: 'Yritetään…',
    downloaded: 'Ladattu',
    error: 'Virhe',
    failed: 'Epäonnistui.',
    ariaDownload: 'Lataa',
    titleQuick: 'Pikalataus',
    comments: 'kommenttia',
  },
  // 38. Norwegian
  no: {
    download: 'Last ned',
    downloading: 'Laster ned…',
    trying: 'Prøver…',
    downloaded: 'Ferdig',
    error: 'Feil',
    failed: 'Mislyktes.',
    ariaDownload: 'Last ned',
    titleQuick: 'Rask nedlasting',
    comments: 'kommentarer',
  },
  // 39. Hebrew
  he: {
    download: 'הורדה',
    downloading: 'מוריד…',
    trying: 'מנסה…',
    downloaded: 'הושלם',
    error: 'שגיאה',
    failed: 'נכשל',
    ariaDownload: 'הורדה',
    titleQuick: 'הורדה מהירה',
    comments: 'תגובות',
  },
  // 40. Persian (Farsi)
  fa: {
    download: 'دانلود',
    downloading: 'درحال دانلود…',
    trying: 'تلاش مجدد…',
    downloaded: 'انجام شد',
    error: 'خطا',
    failed: 'ناموفق',
    ariaDownload: 'دانلود',
    titleQuick: 'دانلود سریع',
    comments: 'نظر',
  },
  // 41. Filipino (Tagalog)
  fil: {
    download: 'I-download',
    downloading: 'Nagda-download…',
    trying: 'Sinusubukan…',
    downloaded: 'Tapos na',
    error: 'Error',
    failed: 'Nabigo.',
    ariaDownload: 'I-download',
    titleQuick: 'Mabilis na download',
    comments: 'mga komento',
  },
  // 42. Malay
  ms: {
    download: 'Muat turun',
    downloading: 'Memuat turun…',
    trying: 'Mencuba…',
    downloaded: 'Selesai',
    error: 'Ralat',
    failed: 'Gagal.',
    ariaDownload: 'Muat turun',
    titleQuick: 'Muat turun pantas',
    comments: 'komen',
  },
  // 43. Serbian
  sr: {
    download: 'Преузми',
    downloading: 'Преузимање…',
    trying: 'Покушавам…',
    downloaded: 'Завршено',
    error: 'Грешка',
    failed: 'Неуспешно.',
    ariaDownload: 'Преузми',
    titleQuick: 'Брзо преузимање',
    comments: 'коментара',
  },
  // 44. Slovak
  sk: {
    download: 'Stiahnuť',
    downloading: 'Sťahovanie…',
    trying: 'Skúšam…',
    downloaded: 'Hotovo',
    error: 'Chyba',
    failed: 'Zlyhalo.',
    ariaDownload: 'Stiahnuť',
    titleQuick: 'Rýchle stiahnutie',
    comments: 'komentárov',
  },
  // 45. Bulgarian
  bg: {
    download: 'Изтегли',
    downloading: 'Изтегляне…',
    trying: 'Опит…',
    downloaded: 'Готово',
    error: 'Грешка',
    failed: 'Неуспешно.',
    ariaDownload: 'Изтегли',
    titleQuick: 'Бързо изтегляне',
    comments: 'коментара',
  },
  // 46. Croatian
  hr: {
    download: 'Preuzmi',
    downloading: 'Preuzimanje…',
    trying: 'Pokušavam…',
    downloaded: 'Gotovo',
    error: 'Greška',
    failed: 'Neuspjelo.',
    ariaDownload: 'Preuzmi',
    titleQuick: 'Brzo preuzimanje',
    comments: 'komentara',
  },
  // 47. Lithuanian
  lt: {
    download: 'Atsisiųsti',
    downloading: 'Siunčiama…',
    trying: 'Bandoma…',
    downloaded: 'Baigta',
    error: 'Klaida',
    failed: 'Nepavyko.',
    ariaDownload: 'Atsisiųsti',
    titleQuick: 'Greitas atsisiuntimas',
    comments: 'komentarai',
  },
  // 48. Latvian
  lv: {
    download: 'Lejupielādēt',
    downloading: 'Lejupielādē…',
    trying: 'Mēģina…',
    downloaded: 'Pabeigts',
    error: 'Kļūda',
    failed: 'Neizdevās.',
    ariaDownload: 'Lejupielādēt',
    titleQuick: 'Ātrā lejupielāde',
    comments: 'komentāri',
  },
  // 49. Estonian
  et: {
    download: 'Laadi alla',
    downloading: 'Laadimine…',
    trying: 'Proovin…',
    downloaded: 'Valmis',
    error: 'Viga',
    failed: 'Ebaõnnestus.',
    ariaDownload: 'Laadi alla',
    titleQuick: 'Kiire allalaadimine',
    comments: 'kommentaari',
  },
  // 50. Slovenian
  sl: {
    download: 'Prenos',
    downloading: 'Prenašanje…',
    trying: 'Poskušam…',
    downloaded: 'Končano',
    error: 'Napaka',
    failed: 'Ni uspelo.',
    ariaDownload: 'Prenos',
    titleQuick: 'Hiter prenos',
    comments: 'komentarjev',
  },
  // 51. Catalan
  ca: {
    download: 'Descarrega',
    downloading: 'Descarregant…',
    trying: 'Intentant…',
    downloaded: 'Descarregat',
    error: 'Error',
    failed: 'Ha fallat.',
    ariaDownload: 'Descarrega',
    titleQuick: 'Descàrrega ràpida',
    comments: 'comentaris',
  },
  // 52. Afrikaans
  af: {
    download: 'Aflaai',
    downloading: 'Laai af…',
    trying: 'Probeer…',
    downloaded: 'Klaar',
    error: 'Fout',
    failed: 'Misluk.',
    ariaDownload: 'Aflaai',
    titleQuick: 'Vinnige aflaai',
    comments: 'kommentare',
  },
  // 53. Amharic
  am: {
    download: 'አውርድ',
    downloading: 'በማውረድ ላይ…',
    trying: 'በመሞከር ላይ…',
    downloaded: 'ወርዷል',
    error: 'ስህተት',
    failed: 'አልተሳካም።',
    ariaDownload: 'አውርድ',
    titleQuick: 'ፈጣን ማውረድ',
    comments: 'አስተያየቶች',
  },
  // 54. Armenian
  hy: {
    download: 'Ներբեռնել',
    downloading: 'Ներբեռնում…',
    trying: 'Փորձում է…',
    downloaded: 'Ավարտված',
    error: 'Սխալ',
    failed: 'Ձախողվեց:',
    ariaDownload: 'Ներբեռնել',
    titleQuick: 'Արագ ներբեռնում',
    comments: 'մեկնաբանություն',
  },
  // 55. Assamese
  as: {
    download: 'ডাউন্লোড',
    downloading: 'ডাউন্লোড হৈ আছে…',
    trying: 'চেষ্টা কৰি আছে…',
    downloaded: 'সম্পূৰ্ণ',
    error: 'ত্ৰুটি',
    failed: 'বিফল হ’ল',
    ariaDownload: 'ডাউন্লোড',
    titleQuick: 'দ্ৰুত ডাউন্লোড',
    comments: 'মন্তব্য',
  },
  // 56. Azerbaijani
  az: {
    download: 'Yüklə',
    downloading: 'Yüklənir…',
    trying: 'Cəhd edilir…',
    downloaded: 'Bitdi',
    error: 'Xəta',
    failed: 'Alınmadı.',
    ariaDownload: 'Yüklə',
    titleQuick: 'Sürətli yükləmə',
    comments: 'şərh',
  },
  // 57. Basque
  eu: {
    download: 'Deskargatu',
    downloading: 'Deskargatzen…',
    trying: 'Saiatzen…',
    downloaded: 'Eginda',
    error: 'Errorea',
    failed: 'Huts egin du.',
    ariaDownload: 'Deskargatu',
    titleQuick: 'Deskarga azkarra',
    comments: 'iruzkin',
  },
  // 58. Burmese (Myanmar)
  my: {
    download: 'ဒေါင်းလုဒ်',
    downloading: 'ဒေါင်းလုဒ် လုပ်နေ…',
    trying: 'ကြိုးစားနေ…',
    downloaded: 'ပြီးပါပြီ',
    error: 'အမှား',
    failed: 'မအောင်မြင်ပါ။',
    ariaDownload: 'ဒေါင်းလုဒ်',
    titleQuick: 'အမြန် ဒေါင်းလုဒ်',
    comments: 'မှတ်ချက်များ',
  },
  // 59. Galician
  gl: {
    download: 'Descargar',
    downloading: 'Descargando…',
    trying: 'Tentando…',
    downloaded: 'Descargado',
    error: 'Erro',
    failed: 'Fallou.',
    ariaDownload: 'Descargar',
    titleQuick: 'Descarga rápida',
    comments: 'comentarios',
  },
  // 60. Georgian
  ka: {
    download: 'ჩამოტვირთვა',
    downloading: 'იწერება…',
    trying: 'მცდელობა…',
    downloaded: 'დასრულდა',
    error: 'შეცდომა',
    failed: 'ვერ მოხერხდა.',
    ariaDownload: 'ჩამოტვირთვა',
    titleQuick: 'სწრაფი ჩამოტვირთვა',
    comments: 'კომენტარი',
  },
  // 61. Icelandic
  is: {
    download: 'Sækja',
    downloading: 'Sækir…',
    trying: 'Reyni…',
    downloaded: 'Sótt',
    error: 'Villa',
    failed: 'Mistókst.',
    ariaDownload: 'Sækja',
    titleQuick: 'Flýtiniðurhal',
    comments: 'ummæli',
  },
  // 62. Irish (Gaeilge)
  ga: {
    download: 'Íoslódáil',
    downloading: 'Ag íoslódáil…',
    trying: 'Ag iarraidh…',
    downloaded: 'Íoslódáilte',
    error: 'Earráid',
    failed: 'Theip air.',
    ariaDownload: 'Íoslódáil',
    titleQuick: 'Íoslódáil tapa',
    comments: 'trácht',
  },
  // 63. Kazakh
  kk: {
    download: 'Жүктеп алу',
    downloading: 'Жүктелуде…',
    trying: 'Әрекет…',
    downloaded: 'Аяқталды',
    error: 'Қате',
    failed: 'Сәтсіз.',
    ariaDownload: 'Жүктеп алу',
    titleQuick: 'Жылдам жүктеу',
    comments: 'пікір',
  },
  // 64. Khmer
  km: {
    download: 'ទាញយក',
    downloading: 'កំពុងទាញយក…',
    trying: 'កំពុងព្យាយាម…',
    downloaded: 'បានបញ្ចប់',
    error: 'កំហុស',
    failed: 'បរាជ័យ',
    ariaDownload: 'ទាញយក',
    titleQuick: 'ទាញយកលឿន',
    comments: 'មតិ',
  },
  // 65. Lao
  lo: {
    download: 'ດາວໂຫລດ',
    downloading: 'ກຳລັງດາວໂຫລດ…',
    trying: 'ກຳລັງພະຍາຍາມ…',
    downloaded: 'ສຳເລັດ',
    error: 'ຜິດພາດ',
    failed: 'ລົ້ມເຫລວ',
    ariaDownload: 'ດາວໂຫລດ',
    titleQuick: 'ດາວໂຫລດດ່ວນ',
    comments: 'ຄຳເຫັນ',
  },
  // 66. Macedonian
  mk: {
    download: 'Преземи',
    downloading: 'Преземање…',
    trying: 'Се обидувам…',
    downloaded: 'Готово',
    error: 'Грешка',
    failed: 'Неуспешно.',
    ariaDownload: 'Преземи',
    titleQuick: 'Брзо преземање',
    comments: 'коментари',
  },
  // 67. Mongolian
  mn: {
    download: 'Татах',
    downloading: 'Татаж байна…',
    trying: 'Орлдож байна…',
    downloaded: 'Татсан',
    error: 'Алдаа',
    failed: 'Амжилтгүй.',
    ariaDownload: 'Татах',
    titleQuick: 'Хурдан татах',
    comments: 'сэтгэгдэл',
  },
  // 68. Nepali
  ne: {
    download: 'डाउनलोड',
    downloading: 'डाउनलोड हुँदै…',
    trying: 'प्रयास गर्दै…',
    downloaded: 'पूरा भयो',
    error: 'त्रुटि',
    failed: 'असफल भयो',
    ariaDownload: 'डाउनलोड',
    titleQuick: 'छिटो डाउनलोड',
    comments: 'टिप्पणीहरू',
  },
  // 69. Oriya (Odia)
  or: {
    download: 'ଡାଉନଲୋଡ୍',
    downloading: 'ଡାଉନଲୋଡ୍ ହେଉଛି…',
    trying: 'ଚେଷ୍ଟା କରୁଛି…',
    downloaded: 'ସମ୍ପୂର୍ଣ୍ଣ',
    error: 'ତ୍ରୁଟି',
    failed: 'ବିଫଳ ହେଲା',
    ariaDownload: 'ଡାଉନଲୋଡ୍',
    titleQuick: 'ଶୀଘ୍ର ଡାଉନଲୋଡ୍',
    comments: 'ମନ୍ତବ୍ୟ',
  },
  // 70. Sinhala
  si: {
    download: 'බාගන්න',
    downloading: 'බාගත වෙමින්…',
    trying: 'උත්සාහ කරමින්…',
    downloaded: 'අවසන්',
    error: 'දෝෂයකි',
    failed: 'අසාර්ථකයි',
    ariaDownload: 'බාගන්න',
    titleQuick: 'ඉක්මන් බාගත කිරීම',
    comments: 'අදහස්',
  },
  // 71. Swahili
  sw: {
    download: 'Pakua',
    downloading: 'Inapakua…',
    trying: 'Inajaribu…',
    downloaded: 'Imekamilika',
    error: 'Hitilafu',
    failed: 'Imeshindwa.',
    ariaDownload: 'Pakua',
    titleQuick: 'Pakua haraka',
    comments: 'maoni',
  },
  // 72. Uzbek
  uz: {
    download: 'Yuklash',
    downloading: 'Yuklanmoqda…',
    trying: 'Urinilmoqda…',
    downloaded: 'Tayyor',
    error: 'Xato',
    failed: 'Muvaffaqiyatsiz.',
    ariaDownload: 'Yuklash',
    titleQuick: 'Tez yuklash',
    comments: 'sharhlar',
  },
  // 73. Welsh
  cy: {
    download: 'Lawrlwytho',
    downloading: 'Yn lawrlwytho…',
    trying: 'Yn ceisio…',
    downloaded: 'Wedi gorffen',
    error: 'Gwall',
    failed: 'Methodd.',
    ariaDownload: 'Lawrlwytho',
    titleQuick: 'Lawrlwytho cyflym',
    comments: 'sylwadau',
  },
  // 74. Zulu
  zu: {
    download: 'Landa',
    downloading: 'Iyalandwa…',
    trying: 'Iyazama…',
    downloaded: 'Ilandīwe',
    error: 'Iphutha',
    failed: 'Ihlulekile.',
    ariaDownload: 'Landa',
    titleQuick: 'Ukulanda okusheshayo',
    comments: 'amazwana',
  },
  // 75. Albanian
  sq: {
    download: 'Shkarko',
    downloading: 'Duke shkarkuar…',
    trying: 'Duke provuar…',
    downloaded: 'Përfundoi',
    error: 'Gabim',
    failed: 'Dështoi.',
    ariaDownload: 'Shkarko',
    titleQuick: 'Shkarkim i shpejtë',
    comments: 'komente',
  },
};

export type LangKey = keyof typeof TRANSLATIONS.en;

export function t(key: LangKey): string {
  try {
    // 1. FAIL-SAFE: If key is missing or not a string, return a safe placeholder.
    if (!key || typeof key !== 'string') {
      return '...';
    }

    // 2. DETECT LANGUAGE: Hierarchy of sources
    // Priority A: HTML tag (Google's explicit setting)
    // Priority B: Browser setting (Navigator)
    // Priority C: Default to 'en'
    let rawLang = 'en';

    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
      rawLang = document.documentElement.lang;
    } else if (typeof navigator !== 'undefined' && navigator.language) {
      rawLang = navigator.language;
    }

    // 3. SANITIZE: Normalize to standard format (e.g., "  en_US;q=0.9 " -> "en-us")
    // - Lowercase
    // - Remove anything after a semicolon (headers often have priorities)
    // - Trim whitespace
    // - Replace underscores with dashes
    const normalizedLang = rawLang.toLowerCase().split(';')[0].trim().replace('_', '-');

    // 4. EXTRACT BASE: "pt-br" -> "pt"
    const baseLang = normalizedLang.split('-')[0];

    // 5. LOOKUP ATTEMPT 1: Exact Match (e.g. "pt-br" or "zh-cn")
    if (
      TRANSLATIONS[normalizedLang] &&
      typeof TRANSLATIONS[normalizedLang][key] === 'string'
    ) {
      return TRANSLATIONS[normalizedLang][key];
    }

    // 6. LOOKUP ATTEMPT 2: Base Match (e.g. "pt", "es")
    if (
      TRANSLATIONS[baseLang] &&
      typeof TRANSLATIONS[baseLang][key] === 'string'
    ) {
      return TRANSLATIONS[baseLang][key];
    }

    // 7. LOOKUP ATTEMPT 3: English Fallback
    if (
      TRANSLATIONS['en'] &&
      typeof TRANSLATIONS['en'][key] === 'string'
    ) {
      return TRANSLATIONS['en'][key];
    }

    // 8. ULTIMATE FALLBACK: Return the key itself formatted nicely
    // This handles the case where the dictionary is missing the key entirely.
    return key;

  } catch (e) {
    // 9. CATASTROPHIC FAILURE HANDLER
    // If the JS engine throws a memory error or object access error,
    // we strictly return the key or English fallback if possible.
    try {
      return TRANSLATIONS['en'][key] || key;
    } catch {
      return String(key || 'Download');
    }
  }
}