/**
 * Types for the accuracy corpus. See docs/adr/0008-accuracy-definition-and-gates.md.
 *
 * A label describes what a human decided is TRUE about a page. It never
 * describes what the engine currently does — that distinction is the whole
 * point of the corpus.
 */
import type { ViewKind } from '../../src/engines/types';

/** Ground truth for one post inside a case. */
export interface ExpectedPost {
  /** Must equal the post's data-stream-item-id in page.html. */
  postId: string;
  /** True if a human can see class comments on this card. */
  commentPresent: boolean;
  /** Visible comment count, or null when no number is shown. */
  commentCount: number | null;
  /** True if a human can see an edited marker on this card. */
  editedPresent: boolean;
}

/** One labelled corpus case. */
export interface ExpectedCase {
  /** Directory name. Stable forever — it is the regression's name. */
  caseId: string;
  viewKind: ViewKind;
  /** BCP-47 tag of the page content, e.g. 'en', 'ar', 'hu'. */
  lang: string;
  /** Why this case exists. Written for the person who breaks it in 2027. */
  note: string;
  posts: ExpectedPost[];
}

/** A case plus its raw HTML, as loaded from disk. */
export interface LoadedCase {
  expected: ExpectedCase;
  html: string;
}

/** What the engine predicted for one post. */
export interface PredictedPost {
  postId: string;
  commentPresent: boolean;
  commentCount: number | null;
  editedPresent: boolean;
}

/** Counts for one binary signal. */
export interface ConfusionCounts {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

/** Scored result for the whole run. */
export interface AccuracyReport {
  comment: ConfusionCounts;
  edited: ConfusionCounts;
  /** Posts where the predicted comment count equals the label exactly. */
  countExact: number;
  /** Posts where a count was labelled at all (the denominator for countExact). */
  countLabelled: number;
  /** Posts the engine produced any prediction for. */
  observed: number;
  /** Posts the labels say exist. */
  expected: number;
  /** caseIds where every post matched its label exactly. */
  exactCases: string[];
  /** caseIds where at least one post did not match. */
  failedCases: string[];
}
