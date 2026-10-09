/**
 * Click-target capture for Annotate mode.
 *
 * Turns the element under a click into a deterministic descriptor a fixing
 * agent can re-locate: tag, significant classes, id, key data-* attributes,
 * trimmed visible text, a short CSS-ish path, and percent coordinates
 * within the rendered surface.
 */

import type { ElementTarget } from './types';

const MAX_OTHER_CLASSES = 3;
const MAX_DATA_ATTRS = 4;
const MAX_TEXT = 60;
const MAX_PATH_STEPS = 4;
const MAX_DATA_VALUE = 40;

const PRIORITY_DATA = [
  'data-stream-item-id',
  'data-drive-id',
  'data-role',
  'data-testid',
];

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function significantClasses(el: Element): string[] {
  const all = Array.from(el.classList);
  const cqd = all.filter((c) => c.startsWith('cqd-'));
  const others = all.filter((c) => !c.startsWith('cqd-')).slice(0, MAX_OTHER_CLASSES);
  return [...cqd, ...others];
}

function keyDataAttrs(el: Element): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const name of el.getAttributeNames()) {
    if (out.length >= MAX_DATA_ATTRS) break;
    if (!name.startsWith('data-cqd-')) continue;
    out.push({ key: name, value: collapse(el.getAttribute(name)).slice(0, MAX_DATA_VALUE) });
  }
  for (const name of PRIORITY_DATA) {
    if (out.length >= MAX_DATA_ATTRS) break;
    const value = el.getAttribute(name);
    if (value === null) continue;
    out.push({ key: name, value: collapse(value).slice(0, MAX_DATA_VALUE) });
  }
  return out;
}

function nthOfType(el: Element): number {
  const tag = el.tagName;
  let index = 1;
  let node = el.previousElementSibling;
  while (node) {
    if (node.tagName === tag) index += 1;
    node = node.previousElementSibling;
  }
  return index;
}

function hasTagSiblings(el: Element): boolean {
  const parent = el.parentElement;
  if (!parent) return false;
  const tag = el.tagName;
  return Array.from(parent.children).filter((c) => c.tagName === tag).length > 1;
}

function stepFor(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = significantClasses(el)[0];
  const nth = hasTagSiblings(el) ? `:nth-of-type(${nthOfType(el)})` : '';
  return `${tag}${cls ? `.${cls}` : ''}${nth}`;
}

/** Up to 4 steps from the element upward, stopping below the surface root. */
export function cssPath(el: Element, surface: Element | null): string {
  const steps: string[] = [];
  let node: Element | null = el;
  while (node && steps.length < MAX_PATH_STEPS) {
    if (surface && node === surface) break;
    steps.push(stepFor(node));
    node = node.parentElement;
    if (surface && node === surface) break;
  }
  return steps.join(' > ');
}

/**
 * Percent of a viewport-relative rect within the surface's box. In iframe
 * mode the coordinates are already relative to the iframe viewport, so the
 * iframe's own box is the denominator without an offset.
 */
export function percentOfRect(
  rect: { left: number; top: number; width: number; height: number },
  surfaceBox: { left: number; top: number; width: number; height: number },
  iframeMode: boolean,
): { xPct: number; yPct: number } {
  const width = surfaceBox.width;
  const height = surfaceBox.height;
  const x = width > 0 ? ((iframeMode ? rect.left : rect.left - surfaceBox.left) / width) * 100 : 0;
  const y = height > 0 ? ((iframeMode ? rect.top : rect.top - surfaceBox.top) / height) * 100 : 0;
  return {
    xPct: Math.round(Math.max(0, Math.min(100, x)) * 10) / 10,
    yPct: Math.round(Math.max(0, Math.min(100, y)) * 10) / 10,
  };
}

/**
 * Capture the descriptor. `iframeMode` must be true when `el` lives inside
 * the classroom iframe document (coordinate spaces differ); `surfaceBox`
 * is the surface's bounding rect in that document's viewport space.
 */
export function describeElement(
  el: Element,
  surface: Element | null,
  iframeMode: boolean,
  surfaceBox: { left: number; top: number; width: number; height: number },
): ElementTarget {
  const rect = el.getBoundingClientRect();
  const { xPct, yPct } = percentOfRect(
    {
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
    },
    surfaceBox,
    iframeMode,
  );
  return {
    kind: 'element',
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: significantClasses(el),
    data: keyDataAttrs(el),
    text: collapse(el.textContent).slice(0, MAX_TEXT),
    path: cssPath(el, surface),
    xPct,
    yPct,
  };
}

/** Deterministic one-line descriptor for the Markdown export Target line. */
export function formatElementTarget(target: ElementTarget): string {
  const text = target.text ? ` "${target.text}"` : '';
  return `${target.path}${text} @ ${target.xPct},${target.yPct}`;
}
