// filepath: extension/src/detect/keyword/keyword-detector.ts
/**
 * ============================================================================
 * KEYWORD DETECTOR — the only keyword-aware module in the extension
 * ============================================================================
 *
 * Everything that used to be scattered across scoreFlagsForPost lives here:
 * page-language detection, the keyword preload, the pageLang + en + ar union
 * (inside keyword-scoring), and the text-based exclusion pass.
 *
 * The output is a PostObservation carrying only semantic facts. Downstream
 * code cannot tell what language the page was in, which is the entire point.
 */
import type { LayerTrace } from '../../engines/types';
import type {
  Detector,
  DetectContext,
  PostObservation,
  AppliedPenalty,
} from '../../contracts/detection';
import { THRESHOLDS } from '../../decide/thresholds';

import {
  scoreComments,
  scoreEdited,
  detectPageLanguage,
  preloadKeywords,
  clearKeywordCache,
  applyExclusions,
  type ExclusionResult,
} from './keyword-scoring';

export class KeywordDetector implements Detector {
  readonly name = 'keyword' as const;

  /**
   * Drop the keyword tables this detector lazily loaded.
   *
   * Called on navigation teardown to free memory. Exposed as a generic
   * lifecycle hook so orchestration code does not need to know that a
   * keyword cache is what is being freed.
   */
  reset(): void {
    clearKeywordCache();
  }

  observe(post: HTMLElement, ctx: DetectContext): PostObservation {
    const startTime = performance.now();
    const pageLang = ctx.lang || detectPageLanguage();

    preloadKeywords(pageLang);

    const commentResult = scoreComments(post, pageLang);
    const editedResult = scoreEdited(post, pageLang);

    // Text-based exclusions run here, not downstream — they reason over the
    // matched page text, which never leaves this module.
    const exclusions: ExclusionResult[] = [];
    if (commentResult.matchedText) {
      exclusions.push(...applyExclusions(commentResult.matchedText, post, 'comment'));
    }
    if (editedResult.matchedText) {
      exclusions.push(...applyExclusions(editedResult.matchedText, post, 'edited'));
    }

    let commentScore = commentResult.score;
    let editedScore = editedResult.score;

    for (const exc of exclusions) {
      if (exc.ruleId.includes('COMMENT') || exc.ruleId.includes('ACTION_BTN')) {
        commentScore += exc.penalty;
      }
      if (exc.ruleId.includes('EDITED')) {
        editedScore += exc.penalty;
      }
    }

    commentScore = Math.max(0, commentScore);
    editedScore = Math.max(0, editedScore);

    // D12 — corroboration floor against silent verdict degradation.
    //
    // When Google's classes drift, the comment-count shell (`.comment-count`-
    // style chips) matches no layer above the L4 TreeWalker, whose low score
    // dies below the decide threshold while the parsed count survives — the
    // page reports a count with no verdict. The corpus (the authority here)
    // rules that such a verdict must not die when the evidence is real:
    //
    //   - a POSITIVE count was parsed (post-D5 sanity gates are the phantom
    //     filter — an id-like or implausible numeral never gets this far),
    //   - comment-keyword evidence scored above zero (post-D6 whole-token
    //     matching, so stray body-copy words do not qualify),
    //   - no exclusion penalty silenced the match (commentScore > 0 above),
    //   - and the INDEPENDENT edited channel cleared its own decide
    //     threshold, corroborating that this shell belongs to real post
    //     chrome rather than coincidental body copy.
    //
    // then the comment score floor is the decide threshold. This is a score
    // floor, not an unconditional present: without the corroborating edited
    // channel (or with the keyword match excluded) the sub-threshold score
    // still loses its verdict, exactly as before.
    if (
      commentResult.count !== null &&
      commentResult.count > 0 &&
      commentScore > 0 &&
      commentScore < THRESHOLDS.comment_show &&
      editedScore >= THRESHOLDS.edited_show
    ) {
      commentScore = THRESHOLDS.comment_show;
    }

    const penalties: AppliedPenalty[] = exclusions.map((e) => ({
      ruleId: e.ruleId,
      penalty: e.penalty,
    }));

    const debug: LayerTrace[] = [];
    for (let i = 0; i < commentResult.layers.length; i++) {
      const l = commentResult.layers[i]!;
      debug.push({
        layerName: `comment-L${i}`,
        layerIndex: debug.length,
        score: l.score,
        matched: l.score > 0,
        matchedText: l.matchedText,
        selectorUsed: null,
        details: l.details,
      });
    }
    for (let i = 0; i < editedResult.layers.length; i++) {
      const l = editedResult.layers[i]!;
      debug.push({
        layerName: `edited-L${i + 1}`,
        layerIndex: debug.length,
        score: l.score,
        matched: l.score !== 0,
        matchedText: l.matchedText,
        selectorUsed: null,
        details: l.details,
      });
    }

    return {
      postId: ctx.postId,
      viewKind: ctx.viewKind,
      detector: this.name,
      comment: {
        present: commentScore > 0,
        count: commentResult.count,
        strength: commentScore,
        source: 'keyword',
      },
      edited: {
        present: editedScore > 0,
        nearDate: editedResult.hasDateProximity,
        strength: editedScore,
        source: 'keyword',
      },
      penalties,
      elapsedMs: performance.now() - startTime,
      debug,
    };
  }
}

/** Shared instance — the detector is stateless. */
export const keywordDetector = new KeywordDetector();
