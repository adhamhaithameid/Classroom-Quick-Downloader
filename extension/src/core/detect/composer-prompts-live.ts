// filepath: extension/src/core/detect/composer-prompts-live.ts
/**
 * GENERATED from tests/fixtures/classroom/post-strings-captured.json — do not
 * hand-edit. Source: live classroom.google.com composer placeholders, one
 * per served language (sweep 2026-09-19 via tools/capture-classroom-post-strings.mjs).
 *
 * These strings are composer PROMPTS, never comment indicators. They back
 * COMMENT_EXCLUSION_PATTERNS (detection-keywords.ts) and
 * ACTION_BUTTON_PATTERNS (src/core/detect/action-buttons.ts); the reconcile
 * test re-derives them from the fixture, so drift fails the suite.
 */

export interface LiveComposerPrompt {
  /** TRANSLATIONS-style key for the language. */
  lang: string;
  /** The docLang Google served for this language. */
  served: string;
  /** Verbatim placeholder text, ellipsis included. */
  placeholder: string;
  /** Placeholder minus trailing ellipsis (exclusion match target). */
  base: string;
  /** Regex-safe source: specials escaped, whitespace collapsed to \s+. */
  patternSource: string;
}

export const LIVE_COMPOSER_PROMPTS: readonly LiveComposerPrompt[] = [
  { lang: 'af', served: 'af', placeholder: 'Voeg klasopmerking by …', base: 'Voeg klasopmerking by', patternSource: 'Voeg\\s+klasopmerking\\s+by' },
  { lang: 'ar', served: 'ar', placeholder: 'إضافة تعليق على مستوى الصف...', base: 'إضافة تعليق على مستوى الصف', patternSource: 'إضافة\\s+تعليق\\s+على\\s+مستوى\\s+الصف' },
  { lang: 'as', served: 'as', placeholder: 'শ্ৰেণীৰ মন্তব্য যোগ দিয়ক…', base: 'শ্ৰেণীৰ মন্তব্য যোগ দিয়ক', patternSource: 'শ্ৰেণীৰ\\s+মন্তব্য\\s+যোগ\\s+দিয়ক' },
  { lang: 'az', served: 'az', placeholder: 'Sinif şərhi əlavə edin…', base: 'Sinif şərhi əlavə edin', patternSource: 'Sinif\\s+şərhi\\s+əlavə\\s+edin' },
  { lang: 'bg', served: 'bg', placeholder: 'Добавете коментар за курса…', base: 'Добавете коментар за курса', patternSource: 'Добавете\\s+коментар\\s+за\\s+курса' },
  { lang: 'bn', served: 'bn', placeholder: 'ক্লাসে কমেন্ট যোগ করুন…', base: 'ক্লাসে কমেন্ট যোগ করুন', patternSource: 'ক্লাসে\\s+কমেন্ট\\s+যোগ\\s+করুন' },
  { lang: 'ca', served: 'ca', placeholder: 'Afegiu un comentari de la classe…', base: 'Afegiu un comentari de la classe', patternSource: 'Afegiu\\s+un\\s+comentari\\s+de\\s+la\\s+classe' },
  { lang: 'cs', served: 'cs', placeholder: 'Přidat komentář ke kurzu…', base: 'Přidat komentář ke kurzu', patternSource: 'Přidat\\s+komentář\\s+ke\\s+kurzu' },
  { lang: 'cy', served: 'cy', placeholder: 'Ychwanegwch sylw dosbarth…', base: 'Ychwanegwch sylw dosbarth', patternSource: 'Ychwanegwch\\s+sylw\\s+dosbarth' },
  { lang: 'da', served: 'da', placeholder: 'Tilføj en kommentar til holdet...', base: 'Tilføj en kommentar til holdet', patternSource: 'Tilføj\\s+en\\s+kommentar\\s+til\\s+holdet' },
  { lang: 'de', served: 'de', placeholder: 'Kurskommentar hinzufügen…', base: 'Kurskommentar hinzufügen', patternSource: 'Kurskommentar\\s+hinzufügen' },
  { lang: 'el', served: 'el', placeholder: 'Προσθήκη σχολίου τάξης…', base: 'Προσθήκη σχολίου τάξης', patternSource: 'Προσθήκη\\s+σχολίου\\s+τάξης' },
  { lang: 'en', served: 'en', placeholder: 'Add class comment…', base: 'Add class comment', patternSource: 'Add\\s+class\\s+comment' },
  { lang: 'es-419', served: 'es-419', placeholder: 'Agrega un comentario de clase…', base: 'Agrega un comentario de clase', patternSource: 'Agrega\\s+un\\s+comentario\\s+de\\s+clase' },
  { lang: 'es', served: 'es', placeholder: 'Añade un comentario de clase…', base: 'Añade un comentario de clase', patternSource: 'Añade\\s+un\\s+comentario\\s+de\\s+clase' },
  { lang: 'et', served: 'et', placeholder: 'Lisage kursuse kommentaar…', base: 'Lisage kursuse kommentaar', patternSource: 'Lisage\\s+kursuse\\s+kommentaar' },
  { lang: 'eu', served: 'eu', placeholder: 'Gehitu iruzkina ikasgelan…', base: 'Gehitu iruzkina ikasgelan', patternSource: 'Gehitu\\s+iruzkina\\s+ikasgelan' },
  { lang: 'fa', served: 'fa', placeholder: 'افزودن نظر کلاس...', base: 'افزودن نظر کلاس', patternSource: 'افزودن\\s+نظر\\s+کلاس' },
  { lang: 'fi', served: 'fi', placeholder: 'Lisää ryhmälle näkyvä kommentti…', base: 'Lisää ryhmälle näkyvä kommentti', patternSource: 'Lisää\\s+ryhmälle\\s+näkyvä\\s+kommentti' },
  { lang: 'fil', served: 'fil', placeholder: 'Magdagdag ng komento sa klase…', base: 'Magdagdag ng komento sa klase', patternSource: 'Magdagdag\\s+ng\\s+komento\\s+sa\\s+klase' },
  { lang: 'fr', served: 'fr', placeholder: 'Ajouter un commentaire au cours…', base: 'Ajouter un commentaire au cours', patternSource: 'Ajouter\\s+un\\s+commentaire\\s+au\\s+cours' },
  { lang: 'ga', served: 'ga', placeholder: 'Cuir nóta tráchta ranga leis…', base: 'Cuir nóta tráchta ranga leis', patternSource: 'Cuir\\s+nóta\\s+tráchta\\s+ranga\\s+leis' },
  { lang: 'gu', served: 'gu', placeholder: 'વર્ગની કૉમેન્ટ ઉમેરો…', base: 'વર્ગની કૉમેન્ટ ઉમેરો', patternSource: 'વર્ગની\\s+કૉમેન્ટ\\s+ઉમેરો' },
  { lang: 'hi', served: 'hi', placeholder: 'कक्षा टिप्पणी जोड़ें…', base: 'कक्षा टिप्पणी जोड़ें', patternSource: 'कक्षा\\s+टिप्पणी\\s+जोड़ें' },
  { lang: 'hu', served: 'hu', placeholder: 'Kurzusmegjegyzés hozzáadása…', base: 'Kurzusmegjegyzés hozzáadása', patternSource: 'Kurzusmegjegyzés\\s+hozzáadása' },
  { lang: 'hy', served: 'hy', placeholder: 'Ավելացրեք հրապարակային մեկնաբանություն…', base: 'Ավելացրեք հրապարակային մեկնաբանություն', patternSource: 'Ավելացրեք\\s+հրապարակային\\s+մեկնաբանություն' },
  { lang: 'is', served: 'is', placeholder: 'Bæta við athugasemd til bekkjar…', base: 'Bæta við athugasemd til bekkjar', patternSource: 'Bæta\\s+við\\s+athugasemd\\s+til\\s+bekkjar' },
  { lang: 'it', served: 'it', placeholder: 'Aggiungi commento sul corso…', base: 'Aggiungi commento sul corso', patternSource: 'Aggiungi\\s+commento\\s+sul\\s+corso' },
  { lang: 'iw', served: 'iw', placeholder: 'הוספת תגובה בכיתה...', base: 'הוספת תגובה בכיתה', patternSource: 'הוספת\\s+תגובה\\s+בכיתה' },
  { lang: 'ja', served: 'ja', placeholder: 'クラスのコメントを追加…', base: 'クラスのコメントを追加', patternSource: 'クラスのコメントを追加' },
  { lang: 'ka', served: 'ka', placeholder: 'კლასზე კომენტარის დამატება…', base: 'კლასზე კომენტარის დამატება', patternSource: 'კლასზე\\s+კომენტარის\\s+დამატება' },
  { lang: 'kk', served: 'kk', placeholder: 'Ашық пікір қосу…', base: 'Ашық пікір қосу', patternSource: 'Ашық\\s+пікір\\s+қосу' },
  { lang: 'kn', served: 'kn', placeholder: 'ತರಗತಿ ಕಾಮೆಂಟ್ ಸೇರಿಸಿ…', base: 'ತರಗತಿ ಕಾಮೆಂಟ್ ಸೇರಿಸಿ', patternSource: 'ತರಗತಿ\\s+ಕಾಮೆಂಟ್\\s+ಸೇರಿಸಿ' },
  { lang: 'ko', served: 'ko', placeholder: '수업 댓글 추가...', base: '수업 댓글 추가', patternSource: '수업\\s+댓글\\s+추가' },
  { lang: 'lt', served: 'lt', placeholder: 'Pridėkite kurso komentarą…', base: 'Pridėkite kurso komentarą', patternSource: 'Pridėkite\\s+kurso\\s+komentarą' },
  { lang: 'lv', served: 'lv', placeholder: 'Pievienojiet mācību priekšmeta komentāru...', base: 'Pievienojiet mācību priekšmeta komentāru', patternSource: 'Pievienojiet\\s+mācību\\s+priekšmeta\\s+komentāru' },
  { lang: 'mk', served: 'mk', placeholder: 'Додајте коментар во класот…', base: 'Додајте коментар во класот', patternSource: 'Додајте\\s+коментар\\s+во\\s+класот' },
  { lang: 'ml', served: 'ml', placeholder: 'ക്ലാസ് കമന്റ് ചേർക്കുക…', base: 'ക്ലാസ് കമന്റ് ചേർക്കുക', patternSource: 'ക്ലാസ്\\s+കമന്റ്\\s+ചേർക്കുക' },
  { lang: 'mn', served: 'mn', placeholder: 'Ангийн сэтгэгдэл нэмэх…', base: 'Ангийн сэтгэгдэл нэмэх', patternSource: 'Ангийн\\s+сэтгэгдэл\\s+нэмэх' },
  { lang: 'mr', served: 'mr', placeholder: 'वर्गासंबंधी टिप्पणी जोडा…', base: 'वर्गासंबंधी टिप्पणी जोडा', patternSource: 'वर्गासंबंधी\\s+टिप्पणी\\s+जोडा' },
  { lang: 'my', served: 'my', placeholder: 'အတန်း မှတ်ချက် ထည့်ပါ…', base: 'အတန်း မှတ်ချက် ထည့်ပါ', patternSource: 'အတန်း\\s+မှတ်ချက်\\s+ထည့်ပါ' },
  { lang: 'ne', served: 'ne', placeholder: 'कक्षामा देखिने गरी कमेन्ट गर्नुहोस्…', base: 'कक्षामा देखिने गरी कमेन्ट गर्नुहोस्', patternSource: 'कक्षामा\\s+देखिने\\s+गरी\\s+कमेन्ट\\s+गर्नुहोस्' },
  { lang: 'nl', served: 'nl', placeholder: 'Lesgroepreactie toevoegen…', base: 'Lesgroepreactie toevoegen', patternSource: 'Lesgroepreactie\\s+toevoegen' },
  { lang: 'or', served: 'or', placeholder: 'କ୍ଲାସ୍ ମନ୍ତବ୍ୟ ଯୋଗ କରନ୍ତୁ…', base: 'କ୍ଲାସ୍ ମନ୍ତବ୍ୟ ଯୋଗ କରନ୍ତୁ', patternSource: 'କ୍ଲାସ୍\\s+ମନ୍ତବ୍ୟ\\s+ଯୋଗ\\s+କରନ୍ତୁ' },
  { lang: 'pa', served: 'pa', placeholder: 'ਕਲਾਸ ਟਿੱਪਣੀ ਸ਼ਾਮਲ ਕਰੋ…', base: 'ਕਲਾਸ ਟਿੱਪਣੀ ਸ਼ਾਮਲ ਕਰੋ', patternSource: 'ਕਲਾਸ\\s+ਟਿੱਪਣੀ\\s+ਸ਼ਾਮਲ\\s+ਕਰੋ' },
  { lang: 'pt-BR', served: 'pt-BR', placeholder: 'Adicionar comentário para a turma...', base: 'Adicionar comentário para a turma', patternSource: 'Adicionar\\s+comentário\\s+para\\s+a\\s+turma' },
  { lang: 'pt-PT', served: 'pt-PT', placeholder: 'Adicionar comentário de turma...', base: 'Adicionar comentário de turma', patternSource: 'Adicionar\\s+comentário\\s+de\\s+turma' },
  { lang: 'ro', served: 'ro', placeholder: 'Adaugă un comentariu la curs…', base: 'Adaugă un comentariu la curs', patternSource: 'Adaugă\\s+un\\s+comentariu\\s+la\\s+curs' },
  { lang: 'ru', served: 'ru', placeholder: 'Добавьте комментарий…', base: 'Добавьте комментарий', patternSource: 'Добавьте\\s+комментарий' },
  { lang: 'si', served: 'si', placeholder: 'පන්ති අදහස එක් කරන්න…', base: 'පන්ති අදහස එක් කරන්න', patternSource: 'පන්ති\\s+අදහස\\s+එක්\\s+කරන්න' },
  { lang: 'sk', served: 'sk', placeholder: 'Pridajte komentár triedy…', base: 'Pridajte komentár triedy', patternSource: 'Pridajte\\s+komentár\\s+triedy' },
  { lang: 'sl', served: 'sl', placeholder: 'Dodajte komentar predavanja …', base: 'Dodajte komentar predavanja', patternSource: 'Dodajte\\s+komentar\\s+predavanja' },
  { lang: 'sq', served: 'sq', placeholder: 'Shto një koment për orën e mësimit…', base: 'Shto një koment për orën e mësimit', patternSource: 'Shto\\s+një\\s+koment\\s+për\\s+orën\\s+e\\s+mësimit' },
  { lang: 'sr', served: 'sr', placeholder: 'Додај коментар предмета...', base: 'Додај коментар предмета', patternSource: 'Додај\\s+коментар\\s+предмета' },
  { lang: 'sv', served: 'sv', placeholder: 'Lägg till klasskommentar ...', base: 'Lägg till klasskommentar', patternSource: 'Lägg\\s+till\\s+klasskommentar' },
  { lang: 'sw', served: 'sw', placeholder: 'Weka maoni kwa darasa lote…', base: 'Weka maoni kwa darasa lote', patternSource: 'Weka\\s+maoni\\s+kwa\\s+darasa\\s+lote' },
  { lang: 'ta', served: 'ta', placeholder: 'வகுப்புக் கருத்துரையைச் சேருங்கள்…', base: 'வகுப்புக் கருத்துரையைச் சேருங்கள்', patternSource: 'வகுப்புக்\\s+கருத்துரையைச்\\s+சேருங்கள்' },
  { lang: 'te', served: 'te', placeholder: 'తరగతి కామెంట్‌ను జోడించండి…', base: 'తరగతి కామెంట్‌ను జోడించండి', patternSource: 'తరగతి\\s+కామెంట్‌ను\\s+జోడించండి' },
  { lang: 'th', served: 'th', placeholder: 'เพิ่มความคิดเห็นในชั้นเรียน…', base: 'เพิ่มความคิดเห็นในชั้นเรียน', patternSource: 'เพิ่มความคิดเห็นในชั้นเรียน' },
  { lang: 'tr', served: 'tr', placeholder: 'Sınıf yorumu ekle…', base: 'Sınıf yorumu ekle', patternSource: 'Sınıf\\s+yorumu\\s+ekle' },
  { lang: 'uk', served: 'uk', placeholder: 'Додайте коментар до курсу…', base: 'Додайте коментар до курсу', patternSource: 'Додайте\\s+коментар\\s+до\\s+курсу' },
  { lang: 'ur', served: 'ur', placeholder: 'کلاس کا تبصرہ شامل کریں…', base: 'کلاس کا تبصرہ شامل کریں', patternSource: 'کلاس\\s+کا\\s+تبصرہ\\s+شامل\\s+کریں' },
  { lang: 'uz', served: 'uz', placeholder: 'Fikr kiriting…', base: 'Fikr kiriting', patternSource: 'Fikr\\s+kiriting' },
  { lang: 'vi', served: 'vi', placeholder: 'Thêm nhận xét trong lớp học...', base: 'Thêm nhận xét trong lớp học', patternSource: 'Thêm\\s+nhận\\s+xét\\s+trong\\s+lớp\\s+học' },
  { lang: 'zh-CN', served: 'zh-CN', placeholder: '添加课程评论…', base: '添加课程评论', patternSource: '添加课程评论' },
  { lang: 'zh-TW', served: 'zh-TW', placeholder: '新增課程留言…', base: '新增課程留言', patternSource: '新增課程留言' },
];

/** Pre-built case-insensitive regexes, one per captured prompt. */
export const LIVE_COMPOSER_PROMPT_REGEXPS: readonly RegExp[] = LIVE_COMPOSER_PROMPTS.map(
  (p) => new RegExp(p.patternSource, 'i'),
);

