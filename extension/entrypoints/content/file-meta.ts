// filepath: extension/entrypoints/content/file-meta.ts
/**
 * File metadata extraction from attachment containers.
 *
 * The naming logic lives in src/core/name/ (S7): strip/sanitize/verify/derive.
 * This module is the DOM adapter — tooltip/text extraction — over the shared
 * core, so the content script and any other consumer use the exact same
 * sanitize pipeline.
 */

import type { FileMeta } from './types';
import {
  sanitizeFileName,
  fileNameExtension,
  deriveFileNameFromUrl,
} from '../../src/core/name/sanitize';

/** Back-compat alias — the canonical pipeline is core/name/sanitize. */
export const cleanAttachmentName = sanitizeFileName;

/**
 * Extract file metadata from container element.
 */
/**
 * 0h3.1 course-folder support: the Classroom page title carries the course
 * name ("<Course> - Home" shape). Split on the LAST " - " separator and keep
 * the first part; anything unexpected (no separator, service pages) degrades
 * to "" so the {course} template token collapses and the flat name survives.
 * Selector-free on purpose — Classroom DOM classes churn; the title shape
 * has been stable for years.
 */
export function extractCourseTitle(doc: Document = document): string {
  try {
    const raw = (doc.title || '').trim();
    if (!raw) return '';
    const cut = raw.lastIndexOf(' - ');
    if (cut <= 0) return '';
    return raw.slice(0, cut).trim();
  } catch {
    return '';
  }
}

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
    name = deriveFileNameFromUrl(url) ?? undefined;
  }

  if (name) name = sanitizeFileName(name, pageLang);

  // Extract extension
  let ext: string | undefined;
  if (name) {
    ext = fileNameExtension(name) ?? undefined;
  }

  return { name, ext, kind: 'other', courseTitle: extractCourseTitle() };
}
