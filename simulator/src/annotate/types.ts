/**
 * Annotate mode — data model.
 *
 * A dev-tool only feature (never ships in the extension): the owner pins
 * numbered notes on a rendered simulator surface; notes export as
 * deterministic Markdown that a fixing agent can act on.
 */

export type SimRouteKind = 'popup' | 'classroom' | 'options' | 'map';

/** Element capture: everything a fixing agent needs to re-locate the spot. */
export interface ElementTarget {
  kind: 'element';
  tag: string;
  id: string | null;
  /** cqd-* classes first, then up to 3 others. */
  classes: string[];
  /** Key data-* attributes (data-cqd-* first, max 4, values trimmed). */
  data: { key: string; value: string }[];
  /** Visible text, whitespace-collapsed, max 60 chars. */
  text: string;
  /** CSS-ish path, max 4 steps, anchored at the surface. */
  path: string;
  /** Percent coordinates of the element center within the surface. */
  xPct: number;
  yPct: number;
}

/** Fallback when no element can be captured (rare) — percent within surface. */
export interface PercentTarget {
  kind: 'percent';
  xPct: number;
  yPct: number;
}

export type AnnotationTarget = ElementTarget | PercentTarget;

export interface Annotation {
  id: string;
  route: SimRouteKind;
  /** Deep-link state id, e.g. `first-download`, `mixed-links-post-en`, `map`. */
  stateId: string;
  /** Full hash form of the deep link, e.g. `#page=mixed-links-post-en&demo=buttons`. */
  deepLink: string;
  label: string;
  note: string;
  createdAt: string;
  target: AnnotationTarget;
}

/** One state's annotations, resolved with display metadata for export/jump. */
export interface AnnotationGroup {
  stateId: string;
  route: SimRouteKind;
  title: string;
  deepLink: string;
  notes: Annotation[];
}
