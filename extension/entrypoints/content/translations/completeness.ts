// filepath: entrypoints/content/translations/completeness.ts
/**
 * i18n completeness & correction pass — merged into TRANSLATIONS by
 * entrypoints/content/i18n.ts immediately after the table literal.
 *
 * Why this module exists: the original TRANSLATIONS table grew key-by-key, so
 * two families of defects accumulated:
 *
 *   1. MISSING KEYS — `modified`, `after_posting` (hover frames), and a few
 *      per-locale stragglers were never added outside `en`, so those surfaces
 *      fell back to English mid-sentence for 125+ locales.
 *   2. SILENT ENGLISH LEAKAGE — ~74 locales carried byte-identical English
 *      values for `editedTooltip` / `cancelAll`, and a handful (`ca`, `si`,
 *      `pa`, `he`, `gl`) even shipped whole English sentences inside otherwise
 *      translated tables.
 *
 * Everything here is ADD or REPLACE with a test-enforced contract
 * (tests/i18n-translations.test.ts):
 *   - every ADD fills a key the base table lacks;
 *   - every REPLACE targets a value that was byte-identical to the English
 *     one (or one of the known wrong-language fixes) — never a reviewed
 *     translation;
 *   - locales listed in DECLARED_EN_FALLBACKS are languages the authoring
 *     pass deliberately left in English for these auxiliary strings (hover
 *     tooltips / cancel-all button). Declared means honest: the fallback is a
 *     recorded decision, not a forgotten translation.
 *
 * `tests/i18n-translations.test.ts` fails if a locale leaks English outside
 * this module's declared/allowlisted sets, so new locales cannot reintroduce
 * the defect silently.
 */

export type TranslationPatch = Record<string, Record<string, string>>;

/**
 * ADDs for keys missing from the base table, plus REPLACEs of values that
 * were byte-identical English (or wrong-language — see the per-entry notes).
 * Keys: modified, after_posting, editedTooltip, cancelAll, commentSingular
 * and the ca/si/pa/he sentence fixes.
 */
export const COMPLETENESS_PATCH: TranslationPatch = {
  ar: { modified: 'تم التعديل', after_posting: 'بعد النشر' },
  ja: { modified: '変更済み', after_posting: '投稿後' },
  es: { modified: 'Modificado', after_posting: 'después de publicar' },
  hi: { modified: 'संशोधित', after_posting: 'पोस्ट करने के बाद' },
  pt: { modified: 'Modificado', after_posting: 'após a publicação' },
  'pt-pt': {
    modified: 'Modificado',
    after_posting: 'após a publicação',
    commentSingular: 'comentário',
    editedTooltip: 'Dias entre a publicação e a última edição',
  },
  'zh-cn': {
    modified: '已修改',
    after_posting: '发布后',
    commentSingular: '条评论',
    editedTooltip: '发布到最后一次编辑的天数',
  },
  'zh-tw': {
    modified: '已修改',
    after_posting: '發布後',
    commentSingular: '則留言',
    editedTooltip: '張貼到最後一次編輯的天數',
  },
  fr: { modified: 'Modifié', after_posting: 'après la publication' },
  de: { modified: 'Geändert', after_posting: 'nach dem Veröffentlichen' },
  it: { modified: 'Modificato', after_posting: 'dopo la pubblicazione' },
  ru: { modified: 'Изменено', after_posting: 'после публикации' },
  ko: { modified: '수정됨', after_posting: '게시 후' },
  tr: { modified: 'Değiştirildi', after_posting: 'gönderiden sonra' },
  vi: { modified: 'Đã sửa đổi', after_posting: 'sau khi đăng' },
  id: { modified: 'Diubah', after_posting: 'setelah diposting' },
  th: { modified: 'ถูกแก้ไข', after_posting: 'หลังจากโพสต์' },
  pl: { modified: 'Zmodyfikowano', after_posting: 'po opublikowaniu' },
  nl: { modified: 'Gewijzigd', after_posting: 'na het plaatsen' },
  bn: { modified: 'পরিবর্তিত', after_posting: 'পোস্ট করার পরে' },
  pa: {
    modified: 'ਸੋਧਿਆ ਗਿਆ',
    after_posting: 'ਪੋਸਟ ਕਰਨ ਤੋਂ ਬਾਅਦ',
    editedTooltip: 'ਪੋਸਟ ਕਰਨ ਅਤੇ ਆਖਰੀ ਸੋਧ ਵਿਚਕਾਰਲੇ ਦਿਨ',
  },
  te: { modified: 'మార్చబడింది', after_posting: 'పోస్ట్ చేసిన తర్వాత' },
  mr: { modified: 'बदलले', after_posting: 'पोस्ट केल्यानंतर' },
  ta: { modified: 'மாற்றப்பட்டது', after_posting: 'இடுகையிட்ட பிறகு' },
  ur: { modified: 'تبدیل شدہ', after_posting: 'پوسٹنگ کے بعد' },
  gu: { modified: 'બદલાયેલ', after_posting: 'પોસ્ટ કર્યા પછી' },
  kn: { modified: 'ಬದಲಾಯಿಸಲಾಗಿದೆ', after_posting: 'ಪೋಸ್ಟ್ ಮಾಡಿದ ನಂತರ' },
  ml: { modified: 'പരിഷ്കരിച്ചു', after_posting: 'പോസ്റ്റ് ചെയ്ത ശേഷം' },
  uk: { modified: 'Змінено', after_posting: 'після публікації' },
  el: { modified: 'Τροποποιήθηκε', after_posting: 'μετά τη δημοσίευση' },
  cs: { modified: 'Změněno', after_posting: 'po zveřejnění' },
  ro: { modified: 'Modificat', after_posting: 'după publicare' },
  hu: { modified: 'Módosítva', after_posting: 'közzététel után' },
  sv: { modified: 'Ändrad', after_posting: 'efter publicering' },
  da: { modified: 'Ændret', after_posting: 'efter opslag' },
  fi: { modified: 'Muutettu', after_posting: 'julkaisun jälkeen' },
  no: { modified: 'Endret', after_posting: 'etter publisering' },
  nn: { modified: 'Endra', after_posting: 'etter publisering' },
  he: {
    modified: 'שונה',
    after_posting: 'לאחר הפרסום',
    editedTooltip: 'הימים בין הפרסום לעריכה האחרונה',
  },
  fa: { modified: 'تغییر یافته', after_posting: 'پس از ارسال' },
  fil: {
    modified: 'Binago',
    after_posting: 'pagkatapos ng pag-post',
    commentSingular: 'komento',
    editedTooltip: 'Araw pagitan ng pag-post at huling pag-edit',
  },
  ms: { modified: 'Diubah suai', after_posting: 'selepas disiarkan' },
  sr: { modified: 'Измењено', after_posting: 'након објављивања' },
  'sr-latn': {
    cancel: 'Otkaži',
    cancelled: 'Otkazano',
    cancelAll: 'Otkaži sve',
    modified: 'Izmenjeno',
    after_posting: 'nakon objavljivanja',
  },
  sk: { modified: 'Zmenené', after_posting: 'po zverejnení' },
  bg: { modified: 'Променено', after_posting: 'след публикуване' },
  hr: { modified: 'Izmijenjeno', after_posting: 'nakon objave' },
  lt: { modified: 'Pakeista', after_posting: 'po paskelbimo' },
  lv: { modified: 'Mainīts', after_posting: 'pēc publicēšanas' },
  et: { modified: 'Muudetud', after_posting: 'pärast postitamist' },
  sl: { modified: 'Spremenjeno', after_posting: 'po objavi' },
  ca: {
    modified: 'Modificat',
    after_posting: 'després de la publicació',
    cancelAll: 'Cancel·la-ho tot',
    editedTooltip: 'Dies entre la publicació i l’última edició',
    commentsTooltip: 'Nombre de comentaris en aquesta publicació',
    downloadInterrupted: 'Baixada interrompuda.',
    runtimeError: 'Temps d’execució no disponible',
    startError: 'No s’ha pogut iniciar.',
    commError: 'Error de comunicació.',
  },
  si: {
    modified: 'වෙනස් කරන ලදී',
    after_posting: 'පළ කිරීමෙන් පසු',
    cancelAll: 'සියල්ල අවලංගු කරන්න',
    editedTooltip: 'පළ කිරීම සහ අවසන් සංස්කරණය අතර දින',
    commentsTooltip: 'මෙම සටහනේ අදහස් ගණන',
    downloadInterrupted: 'බාගැනීම බාධා විය.',
    runtimeError: 'ධාවන කාලය ලබාගත නොහැක',
    startError: 'ආරම්භ කළ නොහැක.',
    commError: 'සන්නිවේදන දෝෂයකි.',
  },
  af: {
    modified: 'Gewysig',
    after_posting: 'na plaasing',
    cancelAll: 'Kanselleer alles',
    editedTooltip: 'Dae tussen plasings en die laaste wysiging',
  },
  am: {
    modified: 'ተቀይሯል',
    after_posting: 'ከልጥፍ በኋላ',
    cancelAll: 'ሁሉንም ሰርዝ',
    editedTooltip: 'በመለጠም እና በመጨረሻ ማስተካከል መካከል ያሉ ቀናት',
  },
  hy: {
    modified: 'Փոփոխված',
    after_posting: 'հրապարակումից հետո',
    cancelAll: 'Չեղարկել բոլորը',
    editedTooltip: 'Օրեր հրապարակման և վերջին խմբագրման միջև',
  },
  as: {
    modified: 'পৰিবৰ্তিত',
    after_posting: 'পোষ্ট কৰাৰ পিছত',
    cancelAll: 'সকলো বাতিল কৰক',
    editedTooltip: 'পোষ্ট কৰা আৰু শেষ সম্পাদনাৰ মাজৰ দিন',
  },
  az: {
    modified: 'Dəyişdirilib',
    after_posting: 'yerləşdirildikdən sonra',
    cancelAll: 'Hamısını ləğv et',
    editedTooltip: 'Yerləşdirmə ilə son düzəliş arasındakı günlər',
  },
  eu: {
    modified: 'Aldatua',
    after_posting: 'argitaratu ondoren',
    cancelAll: 'Utzi dena',
    editedTooltip: 'Argitalpenaren eta azken edizioaren arteko egunak',
  },
  my: {
    modified: 'ပြောင်းလဲပြီး',
    after_posting: 'ပို့စ်တင်ပြီးနောက်',
    cancelAll: 'အားလုံး ပယ်ဖျက်',
    editedTooltip: 'ပို့စ်တင်ခြင်းနှင့် နောက်ဆုံး တည်းဖြတ်ခြင်းကြား ရက်များ',
  },
  gl: {
    modified: 'Modificado',
    after_posting: 'despois da publicación',
    cancelAll: 'Cancelar todo',
    editedTooltip: 'Días entre a publicación e a última edición',
  },
  ka: {
    modified: 'შეცვლილია',
    after_posting: 'გამოქვეყნების შემდეგ',
    cancelAll: 'ყველას გაუქმება',
    editedTooltip: 'დღეები გამოქვეყნებასა და ბოლო რედაქტირებას შორის',
  },
  is: {
    modified: 'Breytt',
    after_posting: 'eftir birtingu',
    cancelAll: 'Hætta við allt',
    editedTooltip: 'Dagar milli birtingar og síðustu breytingar',
  },
  ga: {
    modified: 'Athraithe',
    after_posting: 'tar éis foilsiú',
    cancelAll: 'Cealaigh gach rud',
    editedTooltip: 'Lae idir an fhoilsiú agus an t-eagrú deiridh',
  },
  kk: {
    modified: 'Өзгертілді',
    after_posting: 'жариялағаннан кейін',
    cancelAll: 'Барлығын болдырмау',
    editedTooltip: 'Жариялау мен соңғы өңдеу арасындағы күндер',
  },
  km: {
    modified: 'ត្រូវបានកែប្រែ',
    after_posting: 'បន្ទាប់ពីបោះពុម្ពផ្សាយ',
    cancelAll: 'បោះបង់ទាំងអស់',
    editedTooltip: 'ចំនួនថ្ងៃរវាងការបោះពុម្ពផ្សាយ និងការកែសម្រួលចុងក្រោយ',
  },
  lo: {
    modified: 'ປ່ຽນແປງແລ້ວ',
    after_posting: 'ຫຼັງຈາກໂພສຕ໌',
    cancelAll: 'ຍົກເລີກທັງໝົດ',
    editedTooltip: 'ຈຳນວນວັນ ລະຫວ່າງການໂພສຕ໌ ແລະ ການແກ້ໄຂຄັ້ງສຸດທ້າຍ',
  },
  mk: {
    modified: 'Променето',
    after_posting: 'по објавување',
    cancelAll: 'Откажи сите',
    editedTooltip: 'Денови меѓу објавувањето и последната измена',
  },
  mn: {
    modified: 'Өөрчлөгдсөн',
    after_posting: 'нийтэлсний дараа',
    cancelAll: 'Бүгдийг цуцлах',
    editedTooltip: 'Нийтэлсэн ба сүүлчийн засвар хоёрын хоорондох өдрүүд',
  },
  ne: {
    modified: 'परिवर्तित',
    after_posting: 'पोस्ट गरेपछि',
    cancelAll: 'सबै रद्द गर्नुहोस्',
    editedTooltip: 'पोस्ट गरेको र अन्तिम सम्पादन बीचका दिनहरू',
  },
  or: {
    modified: 'ପରିବର୍ତ୍ତିତ',
    after_posting: 'ପୋଷ୍ଟ କରିବା ପରେ',
    cancelAll: 'ସବୁ ବାତିଲ କରନ୍ତୁ',
    editedTooltip: 'ପୋଷ୍ଟ କରିବା ଏବଂ ଶେଷ ସମ୍ପାଦନା ମଧ୍ୟରେ ଦିନ',
  },
  sw: {
    modified: 'Imebadilishwa',
    after_posting: 'baada ya kuchapisha',
    cancelAll: 'Ghairi zote',
    editedTooltip: 'Siku kati ya kuchapisha na kuhariri kwa mwisho',
  },
  uz: {
    modified: 'O‘zgartirildi',
    after_posting: 'e’lon qilingandan keyin',
    cancelAll: 'Hammasini bekor qilish',
    editedTooltip: 'E’lon qilish va oxirgi tahrirlash oralig‘idagi kunlar',
  },
  cy: {
    modified: "Wedi'i newid",
    after_posting: 'ar ôl postio',
    cancelAll: 'Diddymu popeth',
    editedTooltip: "Diwrnodau rhwng postio a'r golygiad olaf",
  },
  zu: {
    modified: 'Kushintshiwe',
    after_posting: 'emuva kokuthunyelwe',
    cancelAll: 'Khansela konke',
    editedTooltip: 'Izinsuku phakathi kokuthunyelwe nokuhlelelwa kokugcina',
  },
  sq: {
    modified: 'Ndryshuar',
    after_posting: 'pas publikimit',
    cancelAll: 'Anulo të gjitha',
    editedTooltip: 'Ditë ndërmjet publikimit dhe redaktimit të fundit',
  },
  so: {
    modified: 'Waa la beddelay',
    after_posting: 'ka dib markii la dhajiyay',
    cancelAll: 'Jooji dhammaan',
    editedTooltip: 'Maalmaha u dhexeeya gelinta iyo wax-ka-beddelka ugu dambeeya',
  },
  yo: {
    modified: 'Ti yí padà',
    after_posting: 'lẹ́yìn ìfiwéré',
    cancelAll: 'Fagilé gbogbo rẹ̀',
    editedTooltip: 'Àwọn ọjọ́ láàrín ìfiwéré àti àtúnṣe ìgbẹ̀yìn',
  },
  ceb: {
    modified: 'Giusab',
    after_posting: 'human sa pag-post',
    commentSingular: 'komento',
    editedTooltip: 'Mga adlaw tali sa pag-post ug katapusang pag-edit',
    cancelAll: 'Kanselahon tanan',
  },
  ny: {
    modified: 'Zasinthidwa',
    after_posting: 'pambuyo pa kutsitsa',
    cancelAll: 'Letsani zonse',
    editedTooltip: 'Masiku pakati potsitsa ndikusintha komaliza',
  },
  ha: {
    modified: 'An canza',
    after_posting: 'bayan an buga',
    cancelAll: 'Soke duka',
    editedTooltip: 'Kwanakin da suka wuce tsakanin bugawa da gyara na ƙarshe',
  },
  ig: {
    modified: 'Agbanwere',
    after_posting: 'mgbe e bipụtara ya',
    cancelAll: 'Kagbuo ihe niile',
    editedTooltip: 'Ọnọdụ ụbọchị dị n\'etiti mbipụta na ndozi ikpeazụ',
  },
  mg: {
    modified: 'Novaina',
    after_posting: "taorian'ny famoahana",
    cancelAll: 'Foano ny rehetra',
    editedTooltip: "Andro eo anelanelan'ny famoahana sy ny fanavaozana farany",
  },
  mt: {
    modified: 'Modifikat',
    after_posting: 'wara l-ippubblikar',
    cancelAll: 'Ikkanċella kollox',
    editedTooltip: 'Jiem bejn l-ippubblikar u l-aħħar editja',
  },
  mi: {
    modified: 'Kua whakarerekētia',
    after_posting: 'i muri i te whakapāhā',
    cancelAll: 'Whakakore katoa',
    editedTooltip: 'Ngā rā i waenga i te whakapāhā me te whakatika whakamutunga',
  },
  sm: {
    modified: 'Na suia',
    after_posting: "pea fa'apipi'i",
    cancelAll: "Fa'aleaogaina uma",
    editedTooltip: "Aso i le va o le fa'apipi'i ma le toe fa'afouga mulimuli",
  },
  gd: {
    modified: 'Air atharrachadh',
    after_posting: 'an dèidh foillseachadh',
    cancelAll: 'Sguir à h-uile',
    editedTooltip: 'Làithean eadar foillseachadh agus an deasachadh mu dheireadh',
  },
  st: {
    modified: 'E fetotsoe',
    after_posting: 'kamora ho phatlalatsoa',
    cancelAll: 'Hlakola tsohle',
    editedTooltip: 'Matsatsi pakeng tsa ho phatlalatsa le hlophiso ea ho qetela',
  },
  sn: {
    modified: 'Yakachinjwa',
    after_posting: 'mushure mekuburitswa',
    cancelAll: 'Kanzura zvose',
    editedTooltip: 'Mazuva pakati pekuburitsa nekugadzirisa kwekupedzisira',
  },
  sd: {
    modified: 'تبديل ڪيل',
    after_posting: 'پوسٽ ڪرڻ کان پوءِ',
    cancelAll: 'سڀ رد ڪريو',
    editedTooltip: 'پوسٽ ۽ آخري ترميم جي وچ ۾ ڏينهن',
  },
  su: {
    modified: 'Diubah',
    after_posting: 'sanggeus diunggah',
    cancelAll: 'Batalkeun sadayana',
    editedTooltip: 'Poé antara ngunggahkeun jeung éditan pamungkas',
  },
  tg: {
    modified: 'Тағйирёфта',
    after_posting: 'баъди нашр',
    cancelAll: 'Ҳамаро бекор кунед',
    editedTooltip: 'Рӯзҳо байни нашр ва таҳрири охирин',
  },
  yi: {
    modified: 'גענדערט',
    after_posting: 'נאָך פּאָסטן',
    cancelAll: 'באָטל מאַכן אַלע',
    editedTooltip: 'טעג צווישן פּאָסטן און דער לעצטער רעדאַקטירונג',
  },
  la: {
    modified: 'Mutatum',
    after_posting: 'post nuntiationem',
    cancelAll: 'Omnia irritare',
    editedTooltip: 'Dies inter nuntiationem et ultimam mutationem',
    downloading: 'Descargans…',
    cancel: 'Irritare',
  },
  br: {
    modified: 'Kemmet',
    after_posting: 'goude embann',
    cancelAll: 'Nullañ pep tra',
    editedTooltip: "Deizioù etre an embann hag ar c'hemm diwezhañ",
  },
  co: {
    modified: 'Mudificatu',
    after_posting: 'dopu a publicazione',
    cancelAll: 'Annullà tuttu',
    editedTooltip: "Ghjorni trà a publicazione è l'ultima mudificazione",
  },
  fo: {
    modified: 'Broytt',
    after_posting: 'eftir atgongd',
    cancelAll: 'Angra alt',
    editedTooltip: 'Dagar millum atgongd og seinasta rætting',
  },
  fy: {
    modified: 'Wizige',
    after_posting: 'nei it pleatsen',
    cancelAll: 'Alles annulearje',
    editedTooltip: 'Dei tusken it pleatsen en de lêste bewurking',
  },
  ia: {
    modified: 'Modificate',
    after_posting: 'post le publication',
    cancelAll: 'Cancellar toto',
    editedTooltip: 'Dies inter le publication e le ultime modification',
  },
  oc: {
    modified: 'Modificat',
    after_posting: 'après la publicacion',
    cancelAll: 'Anullar tot',
    editedTooltip: 'Jorns entre la publicacion e la darrièra modificacion',
  },
  rm: {
    modified: 'Modifitgà',
    after_posting: 'suenter la publicaziun',
    cancelAll: 'Annullar tut',
    editedTooltip: 'Dis tranter la publicaziun e l’ultima midada',
  },
  ay: {
    modified: 'Mayjt\'ayata',
    after_posting: 'qalltaña ukat pusi',
    cancelAll: 'Taqpach jan sa',
    editedTooltip: 'Qillqt\'añataki ukat askichañataki jak\'äwi',
  },
  ban: {
    modified: 'Kaubah',
    after_posting: 'sasampun kakaostokin',
    cancelAll: 'Weweh batal makasami',
    editedTooltip: 'Rahina riantara kakaostokin miwah uahan pungkuran',
  },
  ckb: {
    modified: 'دەستکاریکراوە',
    after_posting: 'دوای بڵاوکردنەوە',
    cancelAll: 'هەڵوەشاندنەوەی هەموو',
    editedTooltip: 'ژمارەی ڕۆژ لە نێوان بڵاوکردنەوە و دوا دەستکاری',
  },
  gn: {
    modified: 'Oñemoambue',
    after_posting: 'ojehai rire',
    cancelAll: 'Mboguevo opavave',
    editedTooltip: 'Arape oĩva jehai ha ipahapegua oñemoambuevo',
  },
  haw: {
    modified: 'Ua ho\'ololi ʻia',
    after_posting: 'ma hope o ka paʻi ʻana',
    cancelAll: 'Hoʻōki i nā mea a pau',
    editedTooltip: 'Ka lā ma waena o ka paʻi ʻana a me ka hoʻoponopono hope',
  },
  ht: {
    modified: 'Modifye',
    after_posting: 'apre piblikasyon',
    cancelAll: 'Anile tout',
    editedTooltip: 'Jou ki ant piblikasyon an ak dènye modifikasyon an',
  },
  ku: {
    modified: 'Guherî',
    after_posting: 'piştî weşandinê',
    cancelAll: 'Hemûyan betal bike',
    editedTooltip: 'Rojên di navbera weşandinê û guhertina dawî de',
  },
  qu: {
    modified: 'Tikrasqa',
    after_posting: 'wiñachiy qhipa',
    cancelAll: 'Llapanmanta saqichiy',
    editedTooltip: 'Wiñachiy wan qhipa tikray chawpim dma',
  },
  sa: {
    modified: 'परिवर्तितम्',
    after_posting: 'प्रकाशनानन्तरम्',
    cancelAll: 'सर्वाणि निरस्तुम्',
    editedTooltip: 'प्रकाशनस्य अन्तिमसम्पादनस्य च मध्ये दिनानि',
  },
  to: {
    modified: 'Kuo liliu',
    after_posting: 'hili \'o e tukutu',
    cancelAll: 'Kaniseli kotoa',
    editedTooltip: "'Aho 'i he vaha'a tukutu mo e faka'osi fakatonutonu",
  },
  bho: {
    modified: 'बदलल गइल',
    after_posting: 'पोस्ट करे के बाद',
    cancelAll: 'सब रद्द करीं',
    editedTooltip: 'पोस्ट आ अंतिम संपादन के बीच के दिन',
  },
  hmn: {
    modified: 'Hloov lawm',
    after_posting: 'tom qab tshaj tawm',
    commentSingular: 'comment',
    editedTooltip: 'Tus hnub nyob nruab nrab qhov tshaj tawm thiab kho zaum kawg',
    cancelAll: 'Tso tseg txhua yam',
  },
};

/**
 * Locales deliberately left on English for the auxiliary strings authored in
 * this pass (hover tooltips, modified/after_posting labels, cancel-all).
 * These are languages where an authoritative wording could not be verified
 * and a guess would be worse than Classroom's own English. Everything else
 * was authored above.
 */
export const DECLARED_EN_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  chr: ['modified', 'after_posting', 'editedTooltip', 'cancelAll', 'commentsTooltip'],
  // Live survey (2026-09-19): Classroom serves FRENCH to Kongo speakers
  // (kg -> fr), so the kg table's English keys are declared fallbacks — its
  // partially translated keys (comments/cancel) stay as bonus.
  kg: [
    'download', 'downloading', 'trying', 'downloaded', 'failed', 'ariaDownload',
    'titleQuick', 'downloadAll', 'file', 'files', 'commentsTooltip',
    'editedTooltip', 'downloadInterrupted', 'runtimeError', 'startError',
    'commError', 'cancelAll', 'modified', 'after_posting', 'error',
  ],
  ln: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  lg: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  nso: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  om: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  rw: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  rn: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  ti: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  tn: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
  wo: ['modified', 'after_posting', 'editedTooltip', 'cancelAll'],
};

/**
 * Locales whose primary rendering is deliberately English-based because
 * Google serves its UI in English for their speakers (Akan, Bemba and Ewe
 * are not Google UI languages, and the live survey shows Classroom serving
 * en-US for them). Their partially translated keys (comment counts, cancel)
 * are bonus; en-equal values here are by design. Kongo is NOT here: the
 * survey showed Classroom serves French to Kongo speakers, so its table's
 * English keys are declared fallbacks instead.
 */
export const EN_CLONE_LOCALES: readonly string[] = [
  'ach', 'gaa', 'loz', 'tum', 'hmn', 'ak', 'bem', 'ee',
  'xx-bork', 'xx-elmer', 'xx-hacker', 'xx-pirate', 'tlh',
];

/**
 * (locale, key) pairs where sharing the English word is the correct rendering
 * — the language genuinely uses the same word (Google's own UI does).
 */
export const SHARED_VOCAB_ALLOWLIST: ReadonlyArray<readonly [string, string]> = [
  ['es', 'error'],
  ['ca', 'error'],
  ['fil', 'error'],
  ['fil', 'file'],
  ['ia', 'error'],
  ['ia', 'file'],
  ['ia', 'files'],
  ['oc', 'error'],
  ['it', 'file'],
  ['id', 'file'],
  ['id', 'download'],
  ['id', 'ariaDownload'],
  ['ceb', 'file'],
  ['su', 'file'],
  ['pcm', 'file'],
  ['pcm', 'files'],
  ['pcm', 'download'],
  ['pcm', 'ariaDownload'],
  ['pcm', 'error'],
  ['pcm', 'after_posting'],
  ['mfe', 'file'],
  ['mfe', 'files'],
  ['mfe', 'download'],
  ['mfe', 'ariaDownload'],
  ['crs', 'download'],
  ['crs', 'ariaDownload'],
  ['to', 'download'],
  ['to', 'ariaDownload'],
  ['la', 'download'],
  ['la', 'ariaDownload'],
  ['la', 'file'],
  ['la', 'files'],
  ['la', 'error'],
];

/**
 * Merge the patch into the table in place. Locale objects are created when a
 * patch entry targets a locale the base table lacks (none today — the patch
 * is additive within existing locales only, and the test pins that).
 *
 * After the authored entries land, locales whose intent is English
 * (EN_CLONE_LOCALES) and locales with DECLARED_EN_FALLBACKS get their
 * remaining missing keys copied from `en` explicitly — so the table becomes
 * complete and a declared fallback is data, not a silent runtime fallback.
 */
export function applyCompletenessPatch(table: Record<string, Record<string, string>>): void {
  for (const [locale, entries] of Object.entries(COMPLETENESS_PATCH)) {
    table[locale] = { ...table[locale], ...entries };
  }

  const enTable = table.en;
  const enFillLocales = new Set<string>(EN_CLONE_LOCALES);
  for (const locale of Object.keys(DECLARED_EN_FALLBACKS)) enFillLocales.add(locale);

  for (const locale of enFillLocales) {
    if (!table[locale]) continue;
    for (const key of Object.keys(enTable)) {
      if (table[locale][key] === undefined) {
        table[locale][key] = enTable[key];
      }
    }
  }
}
