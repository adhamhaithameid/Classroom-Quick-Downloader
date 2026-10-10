/**
 * Classroom fixture page serving — Node-safe module.
 *
 * vite.config.ts imports this file to serve (dev/preview middleware) and to
 * emit (build) each captured fixture page at a REAL same-origin URL:
 * `/sim/classroom/<page-id>.html`. Same-origin URLs keep
 * `iframe.contentDocument` readable, which the Annotate mode needs to
 * capture click targets inside Route B.
 *
 * Contract: this module must stay importable from Node (vite.config runs in
 * Node). No `?raw` imports, no DOM, no extension-source imports here. The
 * HTML content joins in `pages.ts` via `?raw`; the byte-identical wrapper
 * below is what both the server middleware and the client registry use.
 */

export interface ClassroomPageMeta {
  id: string;
  label: string;
  note: string;
  rtl?: boolean;
}

/** Registry metadata without the HTML bodies (Node-safe). */
export const CLASSROOM_PAGE_META: ClassroomPageMeta[] = [
  {
    id: 'stream-flagged-post-en',
    label: 'Stream — flagged post (en)',
    note: 'Stream card with edited text and 5 class comments — the flag-pill target.',
  },
  {
    id: 'classwork-material-post-en',
    label: 'Classwork — material post (en)',
    note: 'Classwork card shape with a material body.',
  },
  {
    id: 'mixed-links-post-en',
    label: 'Mixed links post (en)',
    note: 'Two downloadable attachments plus unsupported links — the button-state target.',
  },
  {
    id: 'rtl-flagged-post-ar',
    label: 'RTL flagged post (ar)',
    note: 'Arabic RTL card — edge-ribbon anchoring via body[data-cqd-dir="rtl"].',
    rtl: true,
  },
  {
    id: 'announcement-detail-en',
    label: 'Announcement detail (en)',
    note: 'Single announcement detail route.',
  },
  {
    id: 'assignment-details-en',
    label: 'Assignment details (en)',
    note: 'Assignment detail route.',
  },
  {
    id: 'material-details-en',
    label: 'Material details (en)',
    note: 'Material detail route with a data-drive-id attachment.',
  },
  {
    id: 'student-submissions-en',
    label: 'Student submissions (en)',
    note: 'Student view of their own work.',
  },
  {
    id: 'student-work-teacher-en',
    label: 'Student work — teacher (en)',
    note: 'Teacher submissions shell; its admin buttons must stay untouched.',
  },
];

export const WRAPPER_CSS = `
    body { margin: 0; padding: 16px; background: #fff; color: #202124;
           font-family: Roboto, Arial, sans-serif; }
    .n4xnA { border: 1px solid #dadce0; border-radius: 8px; padding: 12px 16px;
             margin: 0 0 12px; background: #fff; }
    header.IMvYId { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .author-row { font-weight: 600; font-size: 13px; }
    .meta-row { font-size: 12px; color: #5f6368; }
    .attachments-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                        gap: 8px; margin-top: 8px; }
    .luto0c { border: 1px solid #dadce0; border-radius: 8px; }
    a.VkhHKd { display: flex; align-items: center; gap: 10px; padding: 10px 12px;
               text-decoration: none; color: #202124; }
    .YVvGBb { font-size: 13px; }
    .comment-shell { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f3f4; }
    .comment-count { font-size: 12px; color: #5f6368; }
    .asQXV { font-size: 14px; line-height: 1.5; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
    .toolbar button { border: 1px solid #dadce0; border-radius: 4px; background: #fff;
                      padding: 6px 12px; font-size: 13px; }
    .metric { display: inline-block; margin-right: 12px; font-size: 13px; color: #5f6368; }
`;

/** Wrap raw captured fixture HTML in the simulator's page chrome. */
export function wrapPageHtml(html: string, opts: { rtl?: boolean }): string {
  const rtl = opts.rtl === true;
  return `<!doctype html>
<html lang="${rtl ? 'ar' : 'en'}"${rtl ? ' dir="rtl"' : ''}>
<head><meta charset="utf-8"><style>${WRAPPER_CSS}</style></head>
<body>${html}</body>
</html>`;
}

/** Same-origin URL the classroom iframe loads a fixture page from. */
export function classroomFixtureUrl(page: Pick<ClassroomPageMeta, 'id' | 'rtl'>): string {
  return `/sim/classroom/${encodeURIComponent(page.id)}.html${page.rtl ? '?dir=rtl' : ''}`;
}
