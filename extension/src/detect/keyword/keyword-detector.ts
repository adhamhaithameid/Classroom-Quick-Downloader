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

import {
  scoreComments,
  scoreEdited,
  detectPageLanguage,
  preloadKeywords,
  applyExclusions,
  type ExclusionResult,
} from './keyword-scoring';

export class KeywordDetector implements Detector {
  readonly name = 'keyword' as const;

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
