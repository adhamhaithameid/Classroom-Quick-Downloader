/**
 * Markdown export for Annotate mode — deterministic output shaped for a
 * fixing agent: one block per note, grouped per state, each block carrying
 * the deep link, the captured target, and the note text.
 *
 * Groups arrive from the store (sorted by state id); `now` and `baseUrl`
 * are injected so the output is testable and reproducible.
 */

import { formatElementTarget } from './describe';
import type { Annotation, AnnotationGroup, PercentTarget } from './types';

export interface ExportOptions {
  now: Date;
  /** Origin + path, e.g. `http://localhost:5173/`. Deep links append `#...`. */
  baseUrl: string;
}

function formatPercentTarget(target: PercentTarget): string {
  return `percent ${target.xPct},${target.yPct}`;
}

export function formatAnnotationTarget(note: Annotation): string {
  return note.target.kind === 'element'
    ? formatElementTarget(note.target)
    : formatPercentTarget(note.target);
}

/**
 * The strongest re-location anchors on their own line: captured data-*
 * attributes plus the element id, e.g. `data-drive-id="AF…" id="x"`.
 * Returns null when the note has no element target or no anchors.
 */
export function formatAnnotationData(note: Annotation): string | null {
  if (note.target.kind !== 'element') return null;
  const parts = note.target.data.map((attr) => `${attr.key}="${attr.value}"`);
  if (note.target.id) parts.push(`id="${note.target.id}"`);
  return parts.length > 0 ? parts.join(' ') : null;
}

export function formatNoteText(note: Annotation): string {
  const body = note.note.replace(/\s+/g, ' ').trim();
  const text = body.length > 0 ? body : '(no text)';
  const label = note.label.replace(/\s+/g, ' ').trim();
  return label.length > 0 ? `[${label}] ${text}` : text;
}

export function formatAnnotationsMarkdown(
  groups: AnnotationGroup[],
  options: ExportOptions,
): string {
  const lines: string[] = [];
  const total = groups.reduce((sum, group) => sum + group.notes.length, 0);
  lines.push(`## SIMULATOR ANNOTATIONS — ${options.now.toISOString()}`);
  lines.push(`Total: ${total} notes`);
  for (const group of groups) {
    group.notes.forEach((note, index) => {
      lines.push('');
      lines.push(`### [${index + 1}] ${group.stateId} — ${group.title}`);
      lines.push(`- Route: ${note.route}`);
      lines.push(`- Reproduce: ${options.baseUrl}${note.deepLink}`);
      lines.push(`- Target: ${formatAnnotationTarget(note)}`);
      const data = formatAnnotationData(note);
      if (data) lines.push(`- Data: ${data}`);
      lines.push(`- Note: ${formatNoteText(note)}`);
    });
  }
  return `${lines.join('\n')}\n`;
}

/** Clipboard write with the textarea + execCommand fallback pattern. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
