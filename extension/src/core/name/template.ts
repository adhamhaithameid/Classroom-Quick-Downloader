// filepath: extension/src/core/name/template.ts
/**
 * ============================================================================
 * TEMPLATE — naming-template renderer for course folders (0h4d.3.1)
 * ============================================================================
 *
 * Renders user templates like "{course}/{filename}" into a download-relative
 * path. Safety model: the folder separator is introduced ONLY here, after
 * every dynamic segment has gone through stripPathCharacters (the S1
 * chokepoint in ./sanitize). A segment can therefore never carry traversal
 * capability, and the depth cap bounds the path shape. Templates compose
 * with hardening — they never bypass it.
 *
 * Token contract:
 *   {course}   course title (page-derived), "" when unknown
 *   {type}     file-kind token (reserved; the kind taxonomy lands later)
 *   {filename} the sanitized attachment filename (always present)
 *   {date}     local YYYY-MM-DD at render time
 *   {index}    in-memory render ordinal (per service-worker life; uniquify
 *              absorbs collisions after a mid-batch restart)
 *   unknown tokens render as "" — a typo never leaks braces to disk.
 *
 * Empty segments collapse ({course} unknown → no leading slash). Templates
 * resolving deeper than MAX_TEMPLATE_DEPTH fall back to the flat filename.
 * The renderer never throws on any input.
 */

import { stripPathCharacters } from './sanitize';

export const DEFAULT_NAMING_TEMPLATE = '{course}/{filename}';

/** Folder depth cap (bead design): keep the sink predictable. */
export const MAX_TEMPLATE_DEPTH = 2;

export interface TemplateParts {
  course?: string;
  type?: string;
  /** The already-sanitized attachment filename (base name only). */
  filename: string;
  /** Render time; defaults to the current date (local). */
  now?: Date;
  /** Render ordinal for {index}; omit to render {index} as "". */
  index?: number;
}

function formatDate(now: Date): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Render the literal text of one template segment with the tokens
 * substituted, then harden the whole segment. Returns "" when nothing
 * survives (empty token values must collapse, not leave "- " debris).
 */
function renderSegment(segment: string, parts: TemplateParts): string {
  const now = parts.now ?? new Date();
  const values: Record<string, string> = {
    course: stripPathCharacters(parts.course ?? ''),
    type: stripPathCharacters(parts.type ?? ''),
    filename: stripPathCharacters(parts.filename ?? ''),
    date: formatDate(now),
    index: typeof parts.index === 'number' && Number.isFinite(parts.index)
      ? `${Math.max(1, Math.floor(parts.index))}`
      : '',
  };
  const rendered = segment.replace(/\{([a-zA-Z]+)\}/g, (raw, key: string) =>
    key in values ? values[key] : '',
  );
  // Collapse token debris: empty substitutions can leave separators like
  // " - " or trailing punctuation. Trim the usual glue the default formats
  // produce; keep any other interior text.
  return stripPathCharacters(rendered).replace(/^[ -]+|[ -]+$/g, '').trim();
}

/**
 * Render a naming template to a download-relative path. Never throws.
 * Falls back to the flat (hardened) filename for empty templates, depth
 * overflow, or any render that produces nothing usable.
 */
export function renderNamingTemplate(
  template: string,
  parts: TemplateParts,
): string {
  const fallback = stripPathCharacters(parts.filename ?? '');
  if (!fallback) return '';
  if (typeof template !== 'string' || !template.includes('{')) return fallback;

  try {
    const segments = template.split('/').map((seg) => renderSegment(seg, parts));
    const usable = segments.filter((seg) => seg.length > 0);
    if (usable.length === 0) return fallback;
    if (usable.length > MAX_TEMPLATE_DEPTH) return fallback;
    const joined = usable.join('/');
    // The composed path must stay inside the depth cap even if the template
    // had empty middle segments collapsing to fewer parts — joined already
    // guarantees that; guard against pathological double slashes anyway.
    return joined.includes('//') ? fallback : joined;
  } catch {
    return fallback;
  }
}

/** True when the template would produce a folder (any path separator). */
export function templateProducesFolders(template: string): boolean {
  if (typeof template !== 'string') return false;
  const probe = renderNamingTemplate(template, {
    course: 'Sample Course',
    type: '',
    filename: 'file.pdf',
    now: new Date(2026, 0, 24),
    index: 1,
  });
  return probe.includes('/');
}
