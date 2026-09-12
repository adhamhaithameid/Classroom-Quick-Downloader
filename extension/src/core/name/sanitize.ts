// filepath: extension/src/core/name/sanitize.ts
/**
 * ============================================================================
 * SANITIZE — the one filename-cleaning pipeline (S7)
 * ============================================================================
 *
 * Order matters: strip the trailing type label first (it can sit between the
 * extension and appended junk), then collapse duplicated text and repeated
 * extensions. Pure string work — no DOM, no imports beyond sibling modules,
 * safe for any caller including the extension bundle's strictest splits.
 */

import { stripTrailingTypeLabel } from './strip';

export { stripTrailingTypeLabel } from './strip';
export { fileNameExtension, hasFileExtension } from './verify';
export { deriveFileNameFromUrl } from './derive';

/**
 * Clean an attachment name: strip trailing type labels, collapse a doubled
 * filename ("file.txtfile.txt") and repeated extensions (".pdf.pdf").
 */
export function sanitizeFileName(rawName: string, lang?: string): string {
  if (!rawName) return '';
  let name = stripTrailingTypeLabel(rawName.trim(), lang);

  // Detect duplicated text (e.g., "file.txtfile.txt")
  if (name.length > 0 && name.length % 2 === 0) {
    const mid = name.length / 2;
    if (name.slice(0, mid) === name.slice(mid)) return name.slice(0, mid);
  }

  // Detect repeated extensions (e.g., ".pdf.pdf")
  const repeatRegex = /\.([a-zA-Z0-9]{2,10})\1$/i;
  const repeatMatch = name.match(repeatRegex);
  if (repeatMatch) return name.slice(0, -repeatMatch[1].length).trim();

  return name;
}
