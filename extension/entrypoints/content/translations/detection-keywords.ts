/**
 * Detection Keywords for Comment and Edited Badge Detection
 * 
 * This file contains the keywords used to detect comments and edited posts
 * in Google Classroom for each supported language.
 * 
 * IMPORTANT: These keywords must match EXACTLY what Google Classroom displays
 * in each language for the detection to work properly.
 * 
 * Structure:
 * - comments: Array of possible comment keywords (e.g., ["class comments", "comments"])
 * - commentSingular: Array of possible singular forms (e.g., ["class comment", "comment"])  
 * - edited: Array of possible "edited" keywords (e.g., ["Edited", "last edit"])
 * 
 * The FIRST keyword in each array is the primary, but ALL are checked for detection.
 * 
 * DEFAULT: If a language is not found, English is used as fallback.
 */

export interface DetectionKeywords {
  /** Array of comment keywords to detect (checked in order) */
  comments: string[];
  /** Array of singular comment keywords */
  commentSingular: string[];
  /** Array of edited keywords to detect */
  edited: string[];
}

/**
 * Detection keywords for all supported languages.
 * English is the default fallback.
 * 
 * NOTE: For comments, we use "class comment/comments" pattern to avoid
 * matching the "Add comment" button which appears on every post.
 * Google Classroom shows "X class comments" for actual comment counts.
 */
export const DETECTION_KEYWORDS: Record<string, DetectionKeywords> = {
  // === DEFAULT (English) ===
  en: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },

  // === MAJOR LANGUAGES ===
  ar: {
    // Arabic: Uses "تعليقات الفصل الدراسي" for class comments
    // For edited: uses "وقت آخر تعديل" (time of last edit) or "تم التعديل" 
    comments: ['تعليقات الفصل الدراسي', 'تعليقات صفية', 'تعليقات'],
    commentSingular: ['تعليق صفي', 'تعليق'],
    edited: ['آخر تعديل', 'تم التعديل', 'وقت آخر تعديل'],
  },
  ja: {
    comments: ['クラスのコメント', '件のコメント', 'コメント', 'クラスコメント', '個のコメント'],
    commentSingular: ['クラスコメント', 'コメント', '件のコメント'],
    edited: ['編集済み', '編集', '最終編集', '更新済み', '修正済み'],
  },
  // Japanese (Japan)
  'ja-jp': {
    comments: ['クラスのコメント', '件のコメント', 'コメント', 'クラスコメント', '個のコメント'],
    commentSingular: ['クラスコメント', 'コメント', '件のコメント'],
    edited: ['編集済み', '編集', '最終編集', '更新済み', '修正済み'],
  },
  es: {
    comments: ['comentarios de la clase', 'comentarios del curso', 'comentarios'],
    commentSingular: ['comentario de la clase', 'comentario'],
    edited: ['Editado', 'Modificado', 'editado'],
  },
  hi: {
    comments: ['क्लास टिप्पणियाँ', 'कक्षा टिप्पणियाँ', 'टिप्पणियाँ'],
    commentSingular: ['क्लास टिप्पणी', 'टिप्पणी'],
    edited: ['संपादित', 'बदला गया'],
  },
  pt: {
    comments: ['comentários da turma', 'comentários da classe', 'comentários'],
    commentSingular: ['comentário da turma', 'comentário'],
    edited: ['Editado', 'Modificado', 'editado'],
  },
  'pt-pt': {
    comments: ['comentários da turma', 'comentários'],
    commentSingular: ['comentário da turma', 'comentário'],
    edited: ['Editado', 'Modificado'],
  },
  'zh-cn': {
    comments: ['课堂评论', '条评论', '评论', '班级评论'],
    commentSingular: ['课堂评论', '条评论', '评论'],
    edited: ['已编辑', '编辑时间', '编辑', '修改时间', '已修改'],
  },
  'zh-tw': {
    comments: ['課程留言', '則留言', '留言', '班級留言', '評論'],
    commentSingular: ['課程留言', '則留言', '留言', '評論'],
    edited: ['已編輯', '編輯時間', '編輯', '修改時間', '已修改'],
  },
  // Chinese (base) - falls back to Simplified
  zh: {
    comments: ['课堂评论', '条评论', '评论', '班级评论', '課程留言', '則留言', '留言'],
    commentSingular: ['课堂评论', '条评论', '评论', '課程留言', '則留言'],
    edited: ['已编辑', '编辑时间', '编辑', '已編輯', '編輯時間', '編輯', '已修改'],
  },
  // Chinese (Hong Kong)
  'zh-hk': {
    comments: ['課程留言', '則留言', '留言', '班級留言', '評論'],
    commentSingular: ['課程留言', '則留言', '留言', '評論'],
    edited: ['已編輯', '編輯時間', '編輯', '修改時間', '已修改'],
  },
  // Chinese (Singapore)
  'zh-sg': {
    comments: ['课堂评论', '条评论', '评论', '班级评论'],
    commentSingular: ['课堂评论', '条评论', '评论'],
    edited: ['已编辑', '编辑时间', '编辑', '修改时间', '已修改'],
  },
  // Chinese (Macau)
  'zh-mo': {
    comments: ['課程留言', '則留言', '留言', '班級留言', '評論'],
    commentSingular: ['課程留言', '則留言', '留言', '評論'],
    edited: ['已編輯', '編輯時間', '編輯', '修改時間', '已修改'],
  },
  fr: {
    comments: ['commentaires du cours', 'commentaires de la classe', 'commentaires'],
    commentSingular: ['commentaire du cours', 'commentaire'],
    edited: ['Modification', 'Modifié', 'date de modification'],
  },
  de: {
    comments: ['Kurskommentare', 'Klassenkommentare', 'Kommentare'],
    commentSingular: ['Kurskommentar', 'Klassenkommentar', 'Kommentar'],
    edited: ['Bearbeitet', 'Geändert', 'bearbeitet'],
  },
  it: {
    comments: ['commenti del corso', 'commenti della classe', 'commenti'],
    commentSingular: ['commento del corso', 'commento'],
    edited: ['Modificato', 'modificato', 'modifica'],
  },
  ru: {
    comments: ['комментариев к курсу', 'комментариев', 'комментарии'],
    commentSingular: ['комментарий к курсу', 'комментарий'],
    edited: ['Изменено', 'Отредактировано', 'изменено'],
  },
  ko: {
    comments: ['수업 댓글', '개 댓글', '댓글', '학급 댓글', '코멘트'],
    commentSingular: ['수업 댓글', '댓글', '코멘트'],
    edited: ['수정됨', '수정 날짜', '수정', '편집됨', '마지막 수정'],
  },
  // Korean (South Korea)
  'ko-kr': {
    comments: ['수업 댓글', '개 댓글', '댓글', '학급 댓글', '코멘트'],
    commentSingular: ['수업 댓글', '댓글', '코멘트'],
    edited: ['수정됨', '수정 날짜', '수정', '편집됨', '마지막 수정'],
  },
  tr: {
    comments: ['ders yorumu', 'sınıf yorumu', 'yorum'],
    commentSingular: ['ders yorumu', 'yorum'],
    edited: ['Düzenlendi', 'düzenlendi', 'düzenleme'],
  },
  vi: {
    comments: ['nhận xét của lớp', 'nhận xét về lớp học', 'nhận xét'],
    commentSingular: ['nhận xét của lớp', 'bình luận'],
    edited: ['Đã chỉnh sửa', 'chỉnh sửa lần cuối', 'đã sửa'],
  },
  id: {
    comments: ['komentar kelas', 'komentar'],
    commentSingular: ['komentar kelas', 'komentar'],
    edited: ['Diedit', 'Diubah', 'diedit'],
  },
  th: {
    comments: ['ความคิดเห็นของชั้นเรียน', 'ความคิดเห็น'],
    commentSingular: ['ความคิดเห็นของชั้นเรียน', 'ความคิดเห็น'],
    edited: ['แก้ไขแล้ว', 'แก้ไขล่าสุด', 'แก้ไข'],
  },
  pl: {
    comments: ['komentarze do zajęć', 'komentarze do kursu', 'komentarze'],
    commentSingular: ['komentarz do zajęć', 'komentarz'],
    edited: ['Edytowano', 'Zmieniono', 'edytowano'],
  },
  nl: {
    comments: ['klasopmerkingen', 'reacties', 'opmerkingen'],
    commentSingular: ['klasopmerking', 'reactie', 'opmerking'],
    edited: ['Bewerkt', 'Gewijzigd', 'bewerkt'],
  },
  bn: {
    comments: ['ক্লাসের মন্তব্য', 'টি মন্তব্য', 'মন্তব্য'],
    commentSingular: ['ক্লাসের মন্তব্য', 'মন্তব্য'],
    edited: ['সম্পাদিত', 'পরিবর্তিত', 'সম্পাদনা'],
  },
  uk: {
    comments: ['коментарі до курсу', 'коментарів', 'коментарі'],
    commentSingular: ['коментар до курсу', 'коментар'],
    edited: ['Відредаговано', 'Змінено', 'відредаговано'],
  },
  sv: {
    comments: ['klasskommentarer', 'kommentarer'],
    commentSingular: ['klasskommentar', 'kommentar'],
    edited: ['Redigerad', 'Ändrad', 'redigerad'],
  },
  no: {
    comments: ['klassekommentarer', 'kommentarer'],
    commentSingular: ['klassekommentar', 'kommentar'],
    edited: ['Redigert', 'Endret', 'redigert'],
  },
  nn: {
    comments: ['klassekommentarar', 'kommentarar'],
    commentSingular: ['klassekommentar', 'kommentar'],
    edited: ['Redigert', 'Endra', 'redigert'],
  },
  da: {
    comments: ['klassekommentarer', 'kommentarer'],
    commentSingular: ['klassekommentar', 'kommentar'],
    edited: ['Redigeret', 'Ændret', 'redigeret'],
  },
  fi: {
    comments: ['luokan kommentit', 'kommenttia', 'kommentit'],
    commentSingular: ['luokan kommentti', 'kommentti'],
    edited: ['Muokattu', 'Muutettu', 'muokattu'],
  },
  el: {
    comments: ['σχόλια τάξης', 'σχόλια'],
    commentSingular: ['σχόλιο τάξης', 'σχόλιο'],
    edited: ['Επεξεργάστηκε', 'Τροποποιήθηκε', 'επεξεργασία'],
  },
  cs: {
    comments: ['komentáře kurzu', 'komentáře', 'komentářů'],
    commentSingular: ['komentář kurzu', 'komentář'],
    edited: ['Upraveno', 'Změněno', 'upraveno'],
  },
  sk: {
    comments: ['komentáre kurzu', 'komentáre', 'komentárov'],
    commentSingular: ['komentár kurzu', 'komentár'],
    edited: ['Upravené', 'Zmenené', 'upravené'],
  },
  hu: {
    comments: ['kurzusmegjegyzések', 'hozzászólás', 'hozzászólások'],
    commentSingular: ['kurzusmegjegyzés', 'hozzászólás'],
    edited: ['Szerkesztve', 'Módosítva', 'szerkesztve'],
  },
  ro: {
    comments: ['comentarii la curs', 'comentarii'],
    commentSingular: ['comentariu la curs', 'comentariu'],
    edited: ['Editat', 'Modificat', 'editat'],
  },
  bg: {
    comments: ['коментари за курса', 'коментара', 'коментари'],
    commentSingular: ['коментар за курса', 'коментар'],
    edited: ['Редактирано', 'Променено', 'редактирано'],
  },
  hr: {
    comments: ['komentari predmeta', 'komentara', 'komentari'],
    commentSingular: ['komentar predmeta', 'komentar'],
    edited: ['Uređeno', 'Promijenjeno', 'uređeno'],
  },
  sr: {
    comments: ['коментари курса', 'коментара', 'коментари'],
    commentSingular: ['коментар курса', 'коментар'],
    edited: ['Измењено', 'Промењено', 'измењено'],
  },
  'sr-latn': {
    comments: ['komentari kursa', 'komentara', 'komentari'],
    commentSingular: ['komentar kursa', 'komentar'],
    edited: ['Izmenjeno', 'Promenjeno', 'izmenjeno'],
  },
  sl: {
    comments: ['komentarji predmeta', 'komentarjev', 'komentarji'],
    commentSingular: ['komentar predmeta', 'komentar'],
    edited: ['Urejeno', 'Spremenjeno', 'urejeno'],
  },
  he: {
    comments: ['תגובות לקורס', 'תגובות', 'תגובה'],
    commentSingular: ['תגובה לקורס', 'תגובה'],
    edited: ['נערך', 'עריכה אחרונה', 'שונה'],
  },
  fa: {
    comments: ['نظرات کلاس', 'نظرات', 'نظر'],
    commentSingular: ['نظر کلاس', 'نظر'],
    edited: ['ویرایش شد', 'آخرین ویرایش', 'ویرایش'],
  },
  ur: {
    comments: ['کلاس تبصرے', 'تبصرے'],
    commentSingular: ['کلاس تبصرہ', 'تبصرہ'],
    edited: ['ترمیم شدہ', 'آخری ترمیم', 'ترمیم'],
  },
  ta: {
    comments: ['வகுப்பு கருத்துகள்', 'கருத்துகள்'],
    commentSingular: ['வகுப்பு கருத்து', 'கருத்து'],
    edited: ['திருத்தப்பட்டது', 'திருத்தம்'],
  },
  te: {
    comments: ['తరగతి వ్యాఖ్యలు', 'వ్యాఖ్యలు'],
    commentSingular: ['తరగతి వ్యాఖ్య', 'వ్యాఖ్య'],
    edited: ['సవరించబడింది', 'సవరణ'],
  },
  ml: {
    comments: ['ക്ലാസ് കമന്റുകൾ', 'കമന്റുകൾ'],
    commentSingular: ['ക്ലാസ് കമന്റ്', 'കമന്റ്'],
    edited: ['എഡിറ്റ് ചെയ്തു', 'അവസാന എഡിറ്റ്', 'എഡിറ്റ്'],
  },
  kn: {
    comments: ['ತರಗತಿ ಕಾಮೆಂಟ್‌ಗಳು', 'ಕಾಮೆಂಟ್‌ಗಳು'],
    commentSingular: ['ತರಗತಿ ಕಾಮೆಂಟ್', 'ಕಾಮೆಂಟ್'],
    edited: ['ಸಂಪಾದಿಸಲಾಗಿದೆ', 'ಬದಲಾಯಿಸಲಾಗಿದೆ'],
  },
  gu: {
    comments: ['વર્ગ ટિપ્પણીઓ', 'ટિપ્પણીઓ'],
    commentSingular: ['વર્ગ ટિપ્પણી', 'ટિપ્પણી'],
    edited: ['સંપાદિત', 'બદલાયેલ'],
  },
  mr: {
    comments: ['वर्ग टिप्पण्या', 'टिप्पण्या'],
    commentSingular: ['वर्ग टिप्पणी', 'टिप्पणी'],
    edited: ['संपादित', 'बदललेले'],
  },
  pa: {
    comments: ['ਕਲਾਸ ਟਿੱਪਣੀਆਂ', 'ਟਿੱਪਣੀਆਂ'],
    commentSingular: ['ਕਲਾਸ ਟਿੱਪਣੀ', 'ਟਿੱਪਣੀ'],
    edited: ['ਸੰਪਾਦਿਤ', 'ਬਦਲਿਆ'],
  },
  ms: {
    comments: ['ulasan kelas', 'ulasan'],
    commentSingular: ['ulasan kelas', 'ulasan'],
    edited: ['Diedit', 'Diubah', 'diedit'],
  },
  sw: {
    comments: ['maoni ya darasa', 'maoni'],
    commentSingular: ['maoni ya darasa', 'maoni'],
    edited: ['Imehaririwa', 'Imebadilishwa', 'imehaririwa'],
  },
  af: {
    comments: ['klasopmerkings', 'opmerkings'],
    commentSingular: ['klasopmerking', 'opmerking'],
    edited: ['Geredigeer', 'Gewysig', 'geredigeer'],
  },
  am: {
    comments: ['የክፍል አስተያየቶች', 'አስተያየቶች'],
    commentSingular: ['የክፍል አስተያየት', 'አስተያየት'],
    edited: ['ተስተካክሏል', 'ተቀይሯል'],
  },
  // === AFRICAN LANGUAGES ===
  ach: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  ak: {
    comments: ['adesua nkyerɛwee', 'nkyerɛwee'],
    commentSingular: ['adesua nkyerɛwee', 'nkyerɛwee'],
    edited: ['Wɔ asakra', 'asakra'],
  },
  bem: {
    comments: ['ifishinka fya kilasi', 'ifishinka'],
    commentSingular: ['icishinka ca kilasi', 'icishinka'],
    edited: ['Bakonkolola', 'konkolola'],
  },
  ee: {
    comments: ['klasi numeɖeɖewo', 'numeɖeɖewo'],
    commentSingular: ['klasi numeɖeɖe', 'numeɖeɖe'],
    edited: ['Wotrɔe', 'trɔe'],
  },
  gaa: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  ha: {
    comments: ['sharhin aji', 'sharhi'],
    commentSingular: ['sharhin aji', 'sharhi'],
    edited: ['An gyara', 'gyara'],
  },
  ig: {
    comments: ['okwu klas', 'okwu'],
    commentSingular: ['okwu klas', 'okwu'],
    edited: ['Edeziri', 'gbanwere'],
  },
  kg: {
    comments: ['mazonzila ma kilasi', 'mazonzila'],
    commentSingular: ['nzonzila na kilasi', 'nzonzila'],
    edited: ['Basonikini', 'sonikinina'],
  },
  kri: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  ln: {
    comments: ['makanisi ya kelasi', 'makanisi'],
    commentSingular: ['likanisi ya kelasi', 'likanisi'],
    edited: ['Ebongisami', 'bongisa'],
  },
  lg: {
    comments: ['ebirowoozo bya kilaasi', 'ebirowoozo'],
    commentSingular: ['ekirowoozo kya kilaasi', 'ekirowoozo'],
    edited: ['Kyakyusibwa', 'kyusibwa'],
  },
  loz: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  lua: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  mg: {
    comments: ['fanehoan-kevitra kilasy', 'fanehoan-kevitra'],
    commentSingular: ['fanehoan-kevitra kilasy', 'fanehoan-kevitra'],
    edited: ['Novaina', 'vaina'],
  },
  nso: {
    comments: ['ditshwaelo tša kilase', 'ditshwaelo'],
    commentSingular: ['tshwaelo ya kilase', 'tshwaelo'],
    edited: ['E fetotšwe', 'fetola'],
  },
  ny: {
    comments: ['ndemanga za kalasi', 'ndemanga'],
    commentSingular: ['ndemanga ya kalasi', 'ndemanga'],
    edited: ['Zasinthidwa', 'sintha'],
  },
  nyn: {
    comments: ['ebirowoozo bya kilaasi', 'ebirowoozo'],
    commentSingular: ['ekirowozo kya kilaasi', 'ekirowozo'],
    edited: ['Edited', 'edited'],
  },
  om: {
    comments: ['yaadota kutaa', 'yaadota'],
    commentSingular: ['yaada kutaa', 'yaada'],
    edited: ['Fooyya\'e', 'fooyya\'ameera'],
  },
  pcm: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  rw: {
    comments: ['ibitekerezo by\'ishuri', 'ibitekerezo'],
    commentSingular: ['igitekerezo cy\'ishuri', 'igitekerezo'],
    edited: ['Byahinduwe', 'hindura'],
  },
  rn: {
    comments: ['ivyiyumviro vy\'ishure', 'ivyiyumviro'],
    commentSingular: ['iciyumviro c\'ishure', 'iciyumviro'],
    edited: ['Vyahinduwe', 'hindura'],
  },
  sn: {
    comments: ['maonero ekirasi', 'maonero'],
    commentSingular: ['maonero ekirasi', 'maonero'],
    edited: ['Yakagadziridzwa', 'gadzirisa'],
  },
  so: {
    comments: ['faallooyinka fasalka', 'faallooyinka'],
    commentSingular: ['faallo fasalka', 'faallo'],
    edited: ['Wax laga bedelay', 'bedelay'],
  },
  st: {
    comments: ['ditlhaloso tsa sehlopha', 'ditlhaloso'],
    commentSingular: ['tlhaloso ea sehlopha', 'tlhaloso'],
    edited: ['E fetotšwe', 'fetola'],
  },
  crs: {
    comments: ['komanter klas', 'komanter'],
    commentSingular: ['komanter klas', 'komanter'],
    edited: ['Modifye', 'sanz'],
  },
  ti: {
    comments: ['ርእይቶታት ክፍሊ', 'ርእይቶታት'],
    commentSingular: ['ርእይቶ ክፍሊ', 'ርእይቶ'],
    edited: ['ተኣርሚ', 'ለውጢ'],
  },
  tn: {
    comments: ['dikakgelo tsa kelase', 'dikakgelo'],
    commentSingular: ['kakgelo ya kelase', 'kakgelo'],
    edited: ['E fetotse', 'fetola'],
  },
  tum: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  wo: {
    comments: ['kàddu yi bii klas', 'kàddu yi'],
    commentSingular: ['kàddu bii klas', 'kàddu'],
    edited: ['Soppi nañu', 'soppi'],
  },
  xh: {
    comments: ['izimvo zeklasi', 'izimvo'],
    commentSingular: ['izimvo zeklasi', 'izimvo'],
    edited: ['Kuhlelwe', 'hlela'],
  },
  yo: {
    comments: ['awọn asọye kilasi', 'awọn asọye'],
    commentSingular: ['asọye kilasi', 'asọye'],
    edited: ['Ti ṣatunkọ', 'ṣatunkọ'],
  },
  zu: {
    comments: ['amazwana eklasi', 'amazwana'],
    commentSingular: ['amazwana eklasi', 'amazwana'],
    edited: ['Kuhleliwe', 'hlela'],
  },
  // === EUROPEAN LANGUAGES ===
  az: {
    comments: ['sinif şərhləri', 'şərhlər'],
    commentSingular: ['sinif şərhi', 'şərh'],
    edited: ['Redaktə edildi', 'dəyişdirildi'],
  },
  be: {
    comments: ['каментары курса', 'каментароў', 'каментары'],
    commentSingular: ['каментар курса', 'каментар'],
    edited: ['Адрэдагавана', 'Зменена', 'адрэдагавана'],
  },
  bs: {
    comments: ['komentari predmeta', 'komentara', 'komentari'],
    commentSingular: ['komentar predmeta', 'komentar'],
    edited: ['Uređeno', 'Promijenjeno'],
  },
  br: {
    comments: ['evezhiadennoù klas', 'evezhiadennoù'],
    commentSingular: ['evezhiadenn klas', 'evezhiadenn'],
    edited: ['Kemmet', 'cheñchet'],
  },
  ca: {
    comments: ['comentaris de la classe', 'comentaris'],
    commentSingular: ['comentari de la classe', 'comentari'],
    edited: ['Editat', 'Modificat'],
  },
  co: {
    comments: ['cumenti di a classe', 'cumenti'],
    commentSingular: ['cumentu di a classe', 'cumentu'],
    edited: ['Mudificatu', 'cambiatu'],
  },
  cy: {
    comments: ['sylwadau dosbarth', 'sylwadau'],
    commentSingular: ['sylw dosbarth', 'sylw'],
    edited: ['Wedi\'i olygu', 'newidiwyd'],
  },
  et: {
    comments: ['klassi kommentaarid', 'kommentaari', 'kommentaarid'],
    commentSingular: ['klassi kommentaar', 'kommentaar'],
    edited: ['Muudetud', 'Redigeeritud'],
  },
  eu: {
    comments: ['ikasgela-iruzkinak', 'iruzkinak'],
    commentSingular: ['ikasgela-iruzkina', 'iruzkina'],
    edited: ['Editatua', 'Aldatua'],
  },
  fo: {
    comments: ['flokkur viðmerkingar', 'viðmerkingar'],
    commentSingular: ['flokkur viðmerking', 'viðmerking'],
    edited: ['Broytt', 'rætt'],
  },
  fy: {
    comments: ['klasreaksjes', 'reaksjes'],
    commentSingular: ['klasreaksje', 'reaksje'],
    edited: ['Bewurke', 'feroare'],
  },
  ga: {
    comments: ['tuairimí ranga', 'tuairimí'],
    commentSingular: ['tuairim ranga', 'tuairim'],
    edited: ['Curtha in eagar', 'athraithe'],
  },
  gd: {
    comments: ['beachdan clas', 'beachdan'],
    commentSingular: ['beachd clas', 'beachd'],
    edited: ['Air a dheasachadh', 'atharraichte'],
  },
  gl: {
    comments: ['comentarios da clase', 'comentarios'],
    commentSingular: ['comentario da clase', 'comentario'],
    edited: ['Editado', 'Modificado'],
  },
  hy: {
    comments: ['դdelays մեdelays', 'մdelays'],
    commentSingular: ['դdelay մdelay', 'մdelay'],
    edited: ['Խdelays', 'փoffs'],
  },
  is: {
    comments: ['athugasemdir bekkjar', 'athugasemdir'],
    commentSingular: ['athugasemd bekkjar', 'athugasemd'],
    edited: ['Breytt', 'breytt'],
  },
  ia: {
    comments: ['commentos del classe', 'commentos'],
    commentSingular: ['commento del classe', 'commento'],
    edited: ['Modificate', 'cambiate'],
  },
  ka: {
    comments: ['კლასის კომენტარები', 'კომენტარები'],
    commentSingular: ['კლასის კომენტარი', 'კომენტარი'],
    edited: ['რედაქტირებული', 'შეცვლილი'],
  },
  kk: {
    comments: ['сынып пікірлері', 'пікірлер'],
    commentSingular: ['сынып пікірі', 'пікір'],
    edited: ['Өңделді', 'өзгертілді'],
  },
  ky: {
    comments: ['класс комментарийлери', 'комментарийлер'],
    commentSingular: ['класс комментарийи', 'комментарий'],
    edited: ['Түзөтүлдү', 'өзгөртүлдү'],
  },
  lt: {
    comments: ['klasės komentarai', 'komentarai'],
    commentSingular: ['klasės komentaras', 'komentaras'],
    edited: ['Redaguota', 'Pakeista'],
  },
  lv: {
    comments: ['klases komentāri', 'komentāri'],
    commentSingular: ['klases komentārs', 'komentārs'],
    edited: ['Rediģēts', 'Mainīts'],
  },
  mk: {
    comments: ['коментари за часот', 'коментари'],
    commentSingular: ['коментар за часот', 'коментар'],
    edited: ['Изменето', 'Променето'],
  },
  mt: {
    comments: ['kummenti tal-klassi', 'kummenti'],
    commentSingular: ['kumment tal-klassi', 'kumment'],
    edited: ['Editjat', 'Mibdul'],
  },
  mn: {
    comments: ['ангийн сэтгэгдэл', 'сэтгэгдэл'],
    commentSingular: ['ангийн сэтгэгдэл', 'сэтгэгдэл'],
    edited: ['Засварласан', 'Өөрчлөгдсөн'],
  },
  oc: {
    comments: ['comentaris de la classa', 'comentaris'],
    commentSingular: ['comentari de la classa', 'comentari'],
    edited: ['Modificat', 'cambiat'],
  },
  rm: {
    comments: ['commentaris da classa', 'commentaris'],
    commentSingular: ['commentari da classa', 'commentari'],
    edited: ['Modifitgà', 'midà'],
  },
  sq: {
    comments: ['komente të klasës', 'komente'],
    commentSingular: ['koment i klasës', 'koment'],
    edited: ['E redaktuar', 'E ndryshuar'],
  },
  // === ASIAN LANGUAGES ===
  ay: {
    comments: ['aula aruskipawinaka', 'aruskipawinaka'],
    commentSingular: ['aula aruskipawi', 'aruskipawi'],
    edited: ['Mayjt\'ayata', 'mayjt\'ata'],
  },
  ban: {
    comments: ['komentar kelas', 'komentar'],
    commentSingular: ['komentar kelas', 'komentar'],
    edited: ['Sampun kaubah', 'kaubah'],
  },
  ceb: {
    comments: ['mga komento sa klase', 'mga komento'],
    commentSingular: ['komento sa klase', 'komento'],
    edited: ['Gi-edit', 'giusab'],
  },
  chr: {
    comments: ['ᏗᎧᏁᎲᏍᎩ', 'ᏗᎧᏁᎲᏍᎩ'],
    commentSingular: ['ᎪᎱᏍᏗ', 'ᎪᎱᏍᏗ'],
    edited: ['ᎠᏃᎯᏳᎲ', 'ᎠᏃᎯᏳᎲ'],
  },
  ckb: {
    comments: ['بۆچوونەکانی پۆل', 'بۆچوونەکان'],
    commentSingular: ['بۆچوونی پۆل', 'بۆچوون'],
    edited: ['دەستکاریکرا', 'گۆڕدرا'],
  },
  fil: {
    comments: ['mga komento sa klase', 'mga komento'],
    commentSingular: ['komento sa klase', 'komento'],
    edited: ['Na-edit', 'Binago'],
  },
  gn: {
    comments: ['mbo\'ehára marandu', 'marandu'],
    commentSingular: ['mbo\'ehára marandu', 'marandu'],
    edited: ['Oñemoambuéva', 'oñemoambue'],
  },
  haw: {
    comments: ['manaʻo papa', 'manaʻo'],
    commentSingular: ['manaʻo papa', 'manaʻo'],
    edited: ['Ua hoʻololi ʻia', 'hoʻololi'],
  },
  hmn: {
    comments: ['chav kawm lus tawm tswv yim', 'lus tawm tswv yim'],
    commentSingular: ['chav kawm lus tawm tswv yim', 'lus tawm tswv yim'],
    edited: ['Kho lawm', 'hloov lawm'],
  },
  ht: {
    comments: ['kòmantè klas', 'kòmantè'],
    commentSingular: ['kòmantè klas', 'kòmantè'],
    edited: ['Modifye', 'chanje'],
  },
  jw: {
    comments: ['komentar kelas', 'komentar'],
    commentSingular: ['komentar kelas', 'komentar'],
    edited: ['Diowahi', 'diganti'],
  },
  km: {
    comments: ['មតិយោបល់ថ្នាក់', 'មតិយោបល់'],
    commentSingular: ['មតិយោបល់ថ្នាក់', 'មតិយោបល់'],
    edited: ['បានកែសម្រួល', 'កែប្រែ'],
  },
  ku: {
    comments: ['şîroveyên polê', 'şîrove'],
    commentSingular: ['şîroveya polê', 'şîrove'],
    edited: ['Hate guhertin', 'guhertin'],
  },
  lo: {
    comments: ['ຄຳເຫັນຫ້ອງຮຽນ', 'ຄຳເຫັນ'],
    commentSingular: ['ຄຳເຫັນຫ້ອງຮຽນ', 'ຄຳເຫັນ'],
    edited: ['ແກ້ໄຂແລ້ວ', 'ປ່ຽນແປງ'],
  },
  mfe: {
    comments: ['komanter klas', 'komanter'],
    commentSingular: ['komanter klas', 'komanter'],
    edited: ['Modifye', 'sanze'],
  },
  mi: {
    comments: ['kōrero akomanga', 'kōrero'],
    commentSingular: ['kōrero akomanga', 'kōrero'],
    edited: ['Kua whakatikaina', 'whakatika'],
  },
  my: {
    comments: ['အတန်း မှတ်ချက်များ', 'မှတ်ချက်များ'],
    commentSingular: ['အတန်း မှတ်ချက်', 'မှတ်ချက်'],
    edited: ['တည်းဖြတ်ပြီး', 'ပြင်ဆင်ပြီး'],
  },
  ne: {
    comments: ['कक्षा टिप्पणीहरू', 'टिप्पणीहरू'],
    commentSingular: ['कक्षा टिप्पणी', 'टिप्पणी'],
    edited: ['सम्पादित', 'परिवर्तन'],
  },
  or: {
    comments: ['ଶ୍ରେଣୀ ମନ୍ତବ୍ୟଗୁଡ଼ିକ', 'ମନ୍ତବ୍ୟଗୁଡ଼ିକ'],
    commentSingular: ['ଶ୍ରେଣୀ ମନ୍ତବ୍ୟ', 'ମନ୍ତବ୍ୟ'],
    edited: ['ସଂଶୋଧିତ', 'ପରିବର୍ତ୍ତନ'],
  },
  ps: {
    comments: ['ټولګي تبصرې', 'تبصرې'],
    commentSingular: ['ټولګي تبصره', 'تبصره'],
    edited: ['سمون شوی', 'بدلون'],
  },
  qu: {
    comments: ['yachay wasi rimaykuna', 'rimaykuna'],
    commentSingular: ['yachay wasi rimay', 'rimay'],
    edited: ['Tikrasqa', 'llamk\'asqa'],
  },
  sa: {
    comments: ['कक्षा टिप्पण्यः', 'टिप्पण्यः'],
    commentSingular: ['कक्षा टिप्पणी', 'टिप्पणी'],
    edited: ['सम्पादितम्', 'परिवर्तितम्'],
  },
  sd: {
    comments: ['ڪلاس تبصرا', 'تبصرا'],
    commentSingular: ['ڪلاس تبصرو', 'تبصرو'],
    edited: ['تبديل ڪيو', 'سنواريو'],
  },
  si: {
    comments: ['පන්ති අදහස්', 'අදහස්'],
    commentSingular: ['පන්ති අදහස', 'අදහස'],
    edited: ['සංස්කරණය කළා', 'වෙනස් කළා'],
  },
  sm: {
    comments: ['faamatalaga vasega', 'faamatalaga'],
    commentSingular: ['faamatalaga vasega', 'faamatalaga'],
    edited: ['Faʻatonuina', 'suia'],
  },
  su: {
    comments: ['koméntar kelas', 'koméntar'],
    commentSingular: ['koméntar kelas', 'koméntar'],
    edited: ['Diédit', 'dirobah'],
  },
  tg: {
    comments: ['шарҳҳои синф', 'шарҳҳо'],
    commentSingular: ['шарҳи синф', 'шарҳ'],
    edited: ['Таҳрир шуд', 'иваз шуд'],
  },
  tk: {
    comments: ['synp teswirler', 'teswirler'],
    commentSingular: ['synp teswir', 'teswir'],
    edited: ['Redaktirlendi', 'üýtgedildi'],
  },
  tt: {
    comments: ['сыйныф фикерләре', 'фикерләр'],
    commentSingular: ['сыйныф фикере', 'фикер'],
    edited: ['Үзгәртелгән', 'төзәтелгән'],
  },
  to: {
    comments: ['ngaahi fakamatala kalasi', 'ngaahi fakamatala'],
    commentSingular: ['fakamatala kalasi', 'fakamatala'],
    edited: ['Kuo liliu', 'liliu'],
  },
  ug: {
    comments: ['سىنىپ ئىنكاسلىرى', 'ئىنكاسلار'],
    commentSingular: ['سىنىپ ئىنكاسى', 'ئىنكاس'],
    edited: ['تەھرىرلەندى', 'ئۆزگەرتىلدى'],
  },
  uz: {
    comments: ['sinf fikrlari', 'fikrlar'],
    commentSingular: ['sinf fikri', 'fikr'],
    edited: ['Tahrirlangan', 'o\'zgartirilgan'],
  },
  yi: {
    comments: ['קלאַס באַמערקונגען', 'באַמערקונגען'],
    commentSingular: ['קלאַס באַמערקונג', 'באַמערקונג'],
    edited: ['עדיטיד', 'געביטן'],
  },
  yue: {
    comments: ['課程留言', '則留言', '留言'],
    commentSingular: ['課程留言', '則留言'],
    edited: ['已編輯', '編輯時間', '編輯'],
  },
  bho: {
    comments: ['क्लास टिप्पणी सब', 'टिप्पणी सब'],
    commentSingular: ['क्लास टिप्पणी', 'टिप्पणी'],
    edited: ['संपादित भइल', 'बदलल गइल'],
  },
  as: {
    comments: ['শ্ৰেণীৰ মন্তব্যসমূহ', 'মন্তব্যসমূহ'],
    commentSingular: ['শ্ৰেণীৰ মন্তব্য', 'মন্তব্য'],
    edited: ['সম্পাদনা কৰা হৈছে', 'সলনি কৰা হৈছে'],
  },
  // === CONSTRUCTED / SPECIAL LANGUAGES ===
  eo: {
    comments: ['klasaj komentoj', 'komentoj'],
    commentSingular: ['klasa komento', 'komento'],
    edited: ['Redaktita', 'Ŝanĝita'],
  },
  la: {
    comments: ['classis commentaria', 'commentaria'],
    commentSingular: ['classis commentarius', 'commentarius'],
    edited: ['Editum', 'Mutatum'],
  },
  // === JOKE LANGUAGES (fallback to English) ===
  'xx-bork': {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  'xx-elmer': {
    comments: ['cwass comments', 'comments'],
    commentSingular: ['cwass comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  tlh: {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  'xx-pirate': {
    comments: ['class comments', 'comments'],
    commentSingular: ['class comment', 'comment'],
    edited: ['Edited', 'edited'],
  },
  'xx-hacker': {
    comments: ['c14ss c0mm3n7s', 'c0mm3n7s'],
    commentSingular: ['c14ss c0mm3n7', 'c0mm3n7'],
    edited: ['3d173d', 'ed173d'],
  },
};

/**
 * Get detection keywords for a specific language.
 * Falls back to English if language is not found.
 * 
 * @param lang - Language code (e.g., 'en', 'fr', 'de')
 * @returns Detection keywords for the language
 */
export function getDetectionKeywords(lang: string): DetectionKeywords {
  // Normalize language code
  const normalizedLang = lang.toLowerCase().split(';')[0].trim().replace('_', '-');
  
  // Try exact match first
  if (DETECTION_KEYWORDS[normalizedLang]) {
    return DETECTION_KEYWORDS[normalizedLang];
  }
  
  // Try base language (e.g., 'en' from 'en-US')
  const baseLang = normalizedLang.split('-')[0];
  if (DETECTION_KEYWORDS[baseLang]) {
    return DETECTION_KEYWORDS[baseLang];
  }
  
  // Default to English
  console.log(`[CQD Keywords] No keywords for "${lang}", using English fallback`);
  return DETECTION_KEYWORDS.en;
}

/**
 * Get all comment keywords (plural and singular) for a language.
 * Returns arrays of possible keywords to check.
 * 
 * @param lang - Language code
 * @returns Object with arrays of plural and singular keywords
 */
export function getCommentKeywords(lang: string): { plural: string[]; singular: string[] } {
  const keywords = getDetectionKeywords(lang);
  return {
    plural: keywords.comments,
    singular: keywords.commentSingular,
  };
}

/**
 * Get all "edited" keywords for a language.
 * Returns an array of possible keywords to check.
 * 
 * @param lang - Language code
 * @returns Array of "edited" keywords for the language
 */
export function getEditedKeywords(lang: string): string[] {
  return getDetectionKeywords(lang).edited;
}

/**
 * Get the primary (first) "edited" keyword for a language.
 * Use this for display purposes, use getEditedKeywords for detection.
 * 
 * @param lang - Language code
 * @returns The primary "edited" keyword for the language
 */
export function getEditedKeyword(lang: string): string {
  return getDetectionKeywords(lang).edited[0];
}
