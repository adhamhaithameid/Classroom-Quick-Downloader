// filepath: extension/entrypoints/content/file-meta.ts
/**
 * File metadata extraction from attachment containers.
 */

import type { FileMeta } from './types';
import { getTypeLabels } from '../../src/core/naming/type-labels';

/**
 * Strip a trailing type label from a filename (D10).
 *
 * Anchored and corroborated: a label is only removed when the remaining stem
 * still ends in a real file extension — either glued straight onto it
 * ("example.zipTömörített archívum", Classroom renders filename + localized
 * label with no separator) or after it across a space
 * ("report.pdf Microsoft Word"). A genuine file named "Design Document" has
 * no extension before the label and is left alone, in every locale.
 */
function stripTrailingTypeLabel(name: string, lang?: string): string {
  const labels = getTypeLabels(lang);
  const lowerName = name.toLowerCase();

  let best: { stem: string } | null = null;
  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    if (!lowerName.endsWith(lowerLabel)) continue;
    if (lowerName.length === lowerLabel.length) continue; // stem would be empty
    const stem = name.slice(0, name.length - label.length).trim();
    if (stem.length === 0) continue;
    // Corroboration: the stem must end in a real extension.
    if (!/\.[a-zA-Z0-9]{1,10}$/.test(stem)) continue;
    if (!best || stem.length < best.stem.length) best = { stem };
  }

  return best ? best.stem : name;
}

/**
 * Clean attachment name by removing garbage labels and duplicated text.
 */
export function cleanAttachmentName(rawName: string, lang?: string): string {
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

/**
 * Extract file metadata from container element.
 */
export function extractFileMeta(container: HTMLElement, url: string, lang?: string): FileMeta {
  const pageLang = lang ?? (typeof document !== 'undefined' ? document.documentElement?.lang || '' : '');

  let name: string | undefined;

  // Try tooltip/ARIA first because accessibility = free metadata hack
  const tooltip =
    container.getAttribute('data-tooltip') ||
    container.getAttribute('aria-label') ||
    container.getAttribute('title');
  if (tooltip && tooltip.trim()) name = tooltip.trim();

  // Fall back to text content
  if (!name) {
    const text = (container.textContent || '').trim();
    if (text) {
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) name = lines[0];
    }
  }

  // Fall back to URL path
  if (!name) {
    try {
      const u = new URL(url);
      const pathName = decodeURIComponent(u.pathname.split('/').pop() || '');
      if (pathName && pathName.includes('.')) name = pathName;
    } catch { /* ignore */ }
  }

  if (name) name = cleanAttachmentName(name, pageLang);

  // Extract extension
  let ext: string | undefined;
  if (name) {
    const m = name.match(/\.([a-zA-Z0-9]{2,10})$/);
    if (m) ext = m[1].toLowerCase();
  }

  return { name, ext, kind: 'other' };
}
