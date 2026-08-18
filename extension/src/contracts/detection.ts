// filepath: extension/src/contracts/detection.ts
/**
 * ============================================================================
 * DETECTION CONTRACTS — the Detect -> Decide seam
 * ============================================================================
 *
 * Detect answers "what is physically on this page?" and emits a
 * PostObservation of SEMANTIC FACTS. Decide turns that into a PostDecision.
 *
 * The hard rule: a PostObservation carries no raw page text outside its
 * optional `debug` field. Rule identifiers are semantic and allowed; matched
 * strings are not. This is what makes Decide language-agnostic by
 * construction rather than by discipline.
 */
import type { ViewKind, LayerTrace } from '../engines/types';

/** Which detector produced an observation. */
export type DetectorName = 'keyword' | 'structural';

/** Everything a detector is told about the post it is looking at. */
export interface DetectContext {
  /** Stable id for this post, usually data-stream-item-id. */
  postId: string;
  /** Page classification. */
  viewKind: ViewKind;
  /**
   * Page language hint. Only KeywordDetector may read this.
   * StructuralDetector must ignore it entirely.
   */
  lang?: string;
}

/** What the detector saw regarding comments. */
export interface CommentObservation {
  /** Something comment-shaped is present. */
  present: boolean;
  /** Comment count if one could be read, else null. */
  count: number | null;
  /** 0-100 confidence in `present`, already net of any penalties. */
  strength: number;
  /** Which mechanism produced the finding, e.g. 'dom-truth', 'aria'. */
  source: string;
}

/** What the detector saw regarding the post being edited. */
export interface EditedObservation {
  present: boolean;
  /** An edit marker was found close to a date. */
  nearDate: boolean;
  /** 0-100 confidence in `present`, already net of any penalties. */
  strength: number;
  source: string;
}

/** A penalty a detector applied to itself, reported for auditability. */
export interface AppliedPenalty {
  ruleId: string;
  penalty: number;
}

/** The seam payload. Language-free. */
export interface PostObservation {
  postId: string;
  viewKind: ViewKind;
  detector: DetectorName;
  comment: CommentObservation;
  edited: EditedObservation;
  /** Penalties already folded into the strengths above. */
  penalties: AppliedPenalty[];
  /** Wall-clock cost of producing this observation. */
  elapsedMs: number;
  /**
   * DEBUG ONLY. May contain raw matched text. Decide MUST NOT read this;
   * it exists so the adapter can rebuild a DecisionTrace for DevTools.
   */
  debug?: LayerTrace[];
}

/** What Decide concluded. Fed to Render. */
export interface PostDecision {
  postId: string;
  verdict: 'comment' | 'edited' | 'both' | 'none';
  commentCount: number | null;
  confidence: 'high' | 'medium' | 'low';
  /** The higher of the two strengths — the headline score. */
  score: number;
  commentScore: number;
  editedScore: number;
}

/** Every detector implements exactly this. */
export interface Detector {
  readonly name: DetectorName;
  observe(post: HTMLElement, ctx: DetectContext): PostObservation;
  /**
   * Drop any state the detector accumulated for the current page.
   *
   * Optional because a detector need not hold state — StructuralDetector is
   * expected not to. It exists so orchestration code can free memory on
   * navigation without knowing WHAT is being freed. Callers must not assume
   * a keyword cache, or a cache at all.
   */
  reset?(): void;
}
