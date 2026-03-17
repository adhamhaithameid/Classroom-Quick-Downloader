// filepath: extension/entrypoints/content/file-meta.ts
/**
 * File metadata extraction from attachment containers.
 */

import type { FileMeta } from './types';

/** Labels to strip from filenames */
// who names their file "Compressed archive" anyway
const GARBAGE_LABELS = [
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
];

/**
 * Clean attachment name by removing garbage labels and duplicated text.
 */
export function cleanAttachmentName(rawName: string): string {
  if (!rawName) return '';
  let name = rawName.trim();

  for (const label of GARBAGE_LABELS) {
    if (name.endsWith(label)) {
      const potential = name.slice(0, -label.length).trim();
      if (potential.length > 0) {
        name = potential;
        break;
      }
    }
  }

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
export function extractFileMeta(container: HTMLElement, url: string): FileMeta {
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

  if (name) name = cleanAttachmentName(name);

  // Extract extension
  let ext: string | undefined;
  if (name) {
    const m = name.match(/\.([a-zA-Z0-9]{2,10})$/);
    if (m) ext = m[1].toLowerCase();
  }

  return { name, ext, kind: 'other' };
}
