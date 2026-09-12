// filepath: extension/src/core/name/type-labels.ts
/**
 * ============================================================================
 * TYPE LABELS — the locale-driven TypeLabelRegistry (D10 / S7)
 * ============================================================================
 *
 * The attachment type label Classroom renders next to a filename ("PDF",
 * "Compressed archive", Hungarian "Tömörített archívum", …) used to live in a
 * single hardcoded English GARBAGE_LABELS array, so localized UIs leaked the
 * label into the download name ("example.zipTömörített archívum").
 *
 * The registry is pure data: per-locale label tables plus an English table
 * that is ALWAYS merged in — Drive keeps some labels untranslated in every
 * locale (PDF, ZIP). Lookups are anchored and corroborated by the caller
 * (a label is only stripped when a real file extension precedes it), so a
 * wrong or over-eager label can never mutilate a genuine filename.
 *
 * Pure data. No imports, no DOM.
 */

const ENGLISH_TYPE_LABELS: ReadonlySet<string> = new Set([
  'Microsoft Excel',
  'Microsoft Word',
  'Microsoft PowerPoint',
  'Compressed archive',
  'Binary',
  'Unknown',
  'Google Sheets',
  'Google Docs',
  'Google Slides',
  'Text File',
  'PDF',
  'Video',
  'Image',
  'Audio',
  'Text',
  'Word',
  'Excel',
  'PowerPoint',
  'Archive',
  'Zip',
  'File',
  'Document',
  'Shortcut',
  'Code',
]);

/** Classroom/Drive attachment type labels by UI locale, lowercase keys. */
const TYPE_LABELS_BY_LOCALE: Readonly<Record<string, ReadonlySet<string>>> = {
  hu: new Set([
    'Tömörített archívum',
    'Google-dokumentumok',
    'Google-táblázatok',
    'Google-prezentáció',
    'Google-űrlapok',
    'Google-rajz',
    'Saját Drive',
    'Szöveges dokumentum',
    'Szövegfájl',
    'Bináris fájl',
    'Bináris',
    'Ismeretlen',
    'Dokumentum',
    'Fájl',
    'Táblázat',
    'Prezentáció',
    'Űrlap',
    'Rajz',
    'Mappa',
    'Videó',
    'Kép',
    'Hang',
    'Szöveg',
    'Parancsikon',
    'Kód',
  ]),
};

/**
 * Type labels for a UI locale. English is always merged in — Drive keeps
 * some labels untranslated in every locale (PDF, ZIP). When the locale is
 * unknown or absent, EVERY locale's table merges in: the anchored,
 * extension-corroborated strip in the caller is what protects real
 * filenames, so an unknown locale must not leave the label glued on.
 */
export function getTypeLabels(lang?: string): string[] {
  const labels = new Set<string>(ENGLISH_TYPE_LABELS);
  const locale = (lang || '').trim().toLowerCase().split('-')[0];
  const table = locale ? TYPE_LABELS_BY_LOCALE[locale] : undefined;
  if (table) {
    for (const label of table) labels.add(label);
  } else if (!locale) {
    for (const localized of Object.values(TYPE_LABELS_BY_LOCALE)) {
      for (const label of localized) labels.add(label);
    }
  }
  return [...labels];
}
