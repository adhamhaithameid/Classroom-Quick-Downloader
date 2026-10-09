/**
 * Classroom driver — runs the REAL v2 renderers against a real captured
 * fixture page inside an iframe.
 *
 * Honesty rules kept here:
 * - Styles come from the REAL injectors (injectStyles / injectV2Styles /
 *   injectFlagStyles), called on this document and then copied verbatim
 *   into the iframe head. The copied bytes are exactly what production
 *   injects (renderSharedButtonSheet substitution included).
 * - Buttons and badges come from the REAL renderButton /
 *   renderDownloadAllButton / renderFlagBadge with fixture decisions.
 * - State forcing uses the REAL setButtonStateV2 machine.
 * - The one glue addition: body[data-cqd-dir] on the IFRAME mirrors the
 *   production applyDirection output (that helper writes the parent body).
 */

import type { FlagDecision, PlacementDecision, ViewKind } from '../../../extension/src/engines/types';
import { injectStyles } from '../../../extension/entrypoints/content/styles';
import { injectV2Styles, removeV2Styles } from '../../../extension/src/v2/render/button-styles';
import {
  renderButton,
  renderDownloadAllButton,
} from '../../../extension/src/v2/render/button-renderer';
import { setButtonStateV2, type V2ButtonState } from '../../../extension/src/v2/render/button-state';
import { renderFlagBadge } from '../../../extension/src/v2/render/flag-renderer';
import { injectFlagStyles, removeFlagStyles } from '../../../extension/src/v2/render/flag-styles';
import type { ScannedFile } from '../../../extension/src/v2/model/dom-scanner';
import { ensureCopyrightReminderAcknowledged } from '../../../extension/src/v2/render/copyright-reminder';
import type { ClassroomPage } from './pages';

export type FlagVerdict = 'none' | 'comment' | 'edited' | 'both';

export interface DriverOptions {
  flagVerdict: FlagVerdict;
  flagCommentCount: number;
  renderButtons: boolean;
  renderDownloadAll: boolean;
  legacyV1Sheet: boolean;
}

export const DEFAULT_DRIVER_OPTIONS: DriverOptions = {
  flagVerdict: 'none',
  flagCommentCount: 5,
  renderButtons: false,
  renderDownloadAll: false,
  legacyV1Sheet: false,
};

const WRAPPER_CSS = `
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

export function wrapPageHtml(page: ClassroomPage): string {
  return `<!doctype html>
<html lang="${page.rtl ? 'ar' : 'en'}"${page.rtl ? ' dir="rtl"' : ''}>
<head><meta charset="utf-8"><style>${WRAPPER_CSS}</style></head>
<body>${page.html}</body>
</html>`;
}

function styleId(id: string): string {
  return `sim-${id}`;
}

/** Call the REAL injectors here, then copy the injected sheets into the iframe. */
export function injectRealStylesInto(iframeDoc: Document, legacyV1Sheet: boolean): void {
  const head = iframeDoc.head ?? iframeDoc.documentElement;
  if (legacyV1Sheet) {
    injectStyles(); // V1 full sheet, id cqd-style (renderSharedButtonSheet inside)
    copySheet(iframeDoc, head, 'cqd-style');
  } else {
    iframeDoc.getElementById(styleId('cqd-style'))?.remove();
  }
  injectV2Styles(); // V2_BUTTON_CSS, id cqd-v2-button-styles
  copySheet(iframeDoc, head, 'cqd-v2-button-styles');
  injectFlagStyles(); // V2_FLAG_CSS, id cqd-v2-flag-styles
  copySheet(iframeDoc, head, 'cqd-v2-flag-styles');
}

/** Restore the pre-simulator document (style nodes back out of this doc). */
export function removeSimulatorStyles(): void {
  removeV2Styles();
  removeFlagStyles();
  document.getElementById('cqd-style')?.remove();
}

function copySheet(iframeDoc: Document, head: HTMLElement, sourceId: string): void {
  const targetId = styleId(sourceId);
  iframeDoc.getElementById(targetId)?.remove();
  const source = document.getElementById(sourceId);
  if (!source) return;
  const style = iframeDoc.createElement('style');
  style.id = targetId;
  style.textContent = source.textContent;
  head.appendChild(style);
}

/** Outermost post roots — the same skip rules capture-fixtures.ts applies. */
export function findPosts(iframeDoc: Document): HTMLElement[] {
  const all = Array.from(iframeDoc.querySelectorAll<HTMLElement>('[data-stream-item-id]'));
  return all.filter((el) => {
    if (el.hasAttribute('data-role')) return false;
    if (el.getAttribute('jscontroller') === 'h38nBf') return false;
    const parent = el.parentElement?.closest('[data-stream-item-id]');
    return !parent;
  });
}

export function findAttachmentAnchors(iframeDoc: Document): HTMLAnchorElement[] {
  // Mirror production discovery: attachment cards (aria-labelled) and
  // data-drive-id hosts are downloadable; in-body links are not.
  const anchors = Array.from(
    iframeDoc.querySelectorAll<HTMLAnchorElement>(
      'a[aria-label^="Attachment"], [data-drive-id] a',
    ),
  );
  const seen = new Set<HTMLAnchorElement>();
  return anchors.filter((anchor) => {
    if (seen.has(anchor)) return false;
    seen.add(anchor);
    return true;
  });
}

function fileFromAnchor(anchor: HTMLAnchorElement, index: number): ScannedFile {
  const label = anchor.getAttribute('aria-label') ?? '';
  const fallbackName = (anchor.textContent ?? '').trim() || 'attachment';
  const name = label.replace(/^Attachment:\s*[A-Za-z]+:\s*/, '') || fallbackName;
  const extMatch = /\.([a-z0-9]{1,6})\s*$/i.exec(name);
  return {
    canonicalId: `fixture-file-${index}`,
    element: anchor,
    idSource: 'url-parse',
    name,
    ext: extMatch?.[1]?.toLowerCase() ?? 'pdf',
    downloadUrl: anchor.href,
  };
}

export function renderButtonsIn(
  iframeDoc: Document,
  options: Pick<DriverOptions, 'renderButtons' | 'renderDownloadAll'>,
): HTMLButtonElement[] {
  const anchors = findAttachmentAnchors(iframeDoc);
  const files: ScannedFile[] = [];
  const rendered: HTMLButtonElement[] = [];

  anchors.forEach((anchor, index) => {
    const file = fileFromAnchor(anchor, index);
    files.push(file);
    if (!options.renderButtons) return;
    const decision: PlacementDecision = {
      fileId: file.canonicalId,
      targetElement: anchor,
      insertionPoint: 'append',
      anchorSelector: 'a',
      confidence: 1,
      reasonCodes: ['SIMULATOR_FIXTURE'],
      fallbackUsed: false,
    };
    const button = renderButton(decision, file, false);
    if (button) rendered.push(button);
  });

  if (options.renderDownloadAll) {
    for (const post of findPosts(iframeDoc)) {
      const postId = post.getAttribute('data-stream-item-id') ?? 'fixture-post';
      const header = post.querySelector('header') ?? post.firstElementChild;
      if (!header) continue;
      const decision: PlacementDecision = {
        fileId: `download-all:${postId}`,
        targetElement: header as HTMLElement,
        insertionPoint: 'before',
        anchorSelector: 'header',
        confidence: 1,
        reasonCodes: ['DOWNLOAD_ALL_BUTTON', 'SIMULATOR_FIXTURE'],
        fallbackUsed: false,
        attachmentCount: files.length,
      };
      const button = renderDownloadAllButton(decision, files, false);
      if (button) rendered.push(button);
    }
  }

  return rendered;
}

export function renderFlagVerdictIn(iframeDoc: Document, options: DriverOptions): void {
  for (const post of findPosts(iframeDoc)) {
    const postId = post.getAttribute('data-stream-item-id') ?? 'fixture-post';
    const decision: FlagDecision = {
      postId,
      commentScore:
        options.flagVerdict === 'comment' || options.flagVerdict === 'both' ? 0.9 : 0,
      editedScore:
        options.flagVerdict === 'edited' || options.flagVerdict === 'both' ? 0.9 : 0,
      commentCount:
        options.flagVerdict === 'comment' || options.flagVerdict === 'both'
          ? options.flagCommentCount
          : null,
      editedDiff:
        options.flagVerdict === 'edited' || options.flagVerdict === 'both'
          ? 'Edited Mar 10'
          : null,
      exclusionPenalties: [],
      finalVerdict: options.flagVerdict,
      confidence: 'high',
      trace: {
        postId,
        timestamp: Date.now(),
        viewKind: 'stream' as ViewKind,
        layers: [],
        exclusions: [],
        finalScore: 0.9,
        duration_ms: 0,
      },
    };
    renderFlagBadge(decision, post);
    // Mirror production's applyDirection output on the iframe body: the real
    // helper writes the PARENT document, so the simulator applies the same
    // attribute the badge CSS reads.
    const docDir = iframeDoc.documentElement?.dir || iframeDoc.body?.dir;
    iframeDoc.body?.setAttribute('data-cqd-dir', docDir === 'rtl' ? 'rtl' : 'ltr');
  }
}

export function forceButtonState(
  iframeDoc: Document,
  state: V2ButtonState,
  message?: string,
): void {
  const buttons = iframeDoc.querySelectorAll<HTMLButtonElement>(
    '.cqd-download-btn[data-cqd-injected]',
  );
  for (const button of buttons) {
    setButtonStateV2(button, state, { message });
  }
}

export function forceGroupProgress(iframeDoc: Document, progressPercent: number): void {
  const buttons = iframeDoc.querySelectorAll<HTMLButtonElement>('.cqd-download-all-btn');
  for (const button of buttons) {
    button.classList.add('cqd-all-busy');
    button.style.setProperty('--cqd-progress', `${Math.max(0, Math.min(100, progressPercent))}%`);
    const sub = button.querySelector<HTMLElement>('.cqd-download-all-sub');
    if (sub) sub.textContent = 'Downloading…';
  }
}

export function clearGroupProgress(iframeDoc: Document): void {
  const buttons = iframeDoc.querySelectorAll<HTMLButtonElement>('.cqd-download-all-btn');
  for (const button of buttons) {
    button.classList.remove('cqd-all-busy');
    button.style.removeProperty('--cqd-progress');
  }
}

/** The REAL copyright gate (legal round 2 surface 04): dialog + persistence. */
export async function runCopyrightGate(iframeDoc: Document): Promise<boolean> {
  const anchor = findPosts(iframeDoc)[0] ?? iframeDoc.body;
  return ensureCopyrightReminderAcknowledged(anchor);
}
