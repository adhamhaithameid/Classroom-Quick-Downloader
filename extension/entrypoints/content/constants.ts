// filepath: entrypoints/content/constants.ts
export const ARABIC_NUMBER_WORDS: Record<string, number> = {
  'واحد': 1, 'واحدة': 1,
  'اثنان': 2, 'اثنين': 2,
  'ثلاثة': 3, 'ثلاث': 3,
  'أربعة': 4, 'اربع': 4,
  'خمسة': 5, 'خمس': 5,
  'ستة': 6, 'ست': 6,
  'سبعة': 7, 'سبع': 7,
  'ثمانية': 8, 'ثمان': 8,
  'تسعة': 9, 'تسع': 9,
  'عشرة': 10, 'عشر': 10,
};

export const MONTH_NAMES = {
  ar: [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  es: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
};

export const ARABIC_MONTHS = MONTH_NAMES.ar;
