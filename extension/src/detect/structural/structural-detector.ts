// filepath: extension/src/detect/structural/structural-detector.ts
/**
 * ============================================================================
 * STRUCTURAL DETECTOR — detection with no language signal
 * ============================================================================
 *
 * Answers "what is physically on this page?" using DOM shape and numerals
 * only. It never reads a keyword table, never looks at `ctx.lang`, and never
 * matches a word. Feed it an English page or an Arabic one and it returns the
 * same observation for the same structure.
 *
 * ---------------------------------------------------------------------------
 * WHY COMMENT DETECTION WORKS
 * ---------------------------------------------------------------------------
 * Classroom puts the comment count in its own container. The keyword engine's
 * layer 0 ("DOM truth") already found it by class selector plus numeral
 * extraction, with no lexical matching at all — it was simply living inside the
 * keyword module. That proven selector chain is what this detector uses.
 *
 * The count node is present whether or not there are comments; what differs is
 * whether it holds a NUMERAL. "5 class comments" and "٥ تعليقات صفية" both do;
 * "No class comments" and "لا توجد تعليقات" both do not. Numerals are
 * script-independent, so this discrimination needs no language knowledge.
 *
 * ---------------------------------------------------------------------------
 * WHY EDITED DETECTION DOES NOT
 * ---------------------------------------------------------------------------
 * There is no structural signal for "edited" in any DOM we currently hold.
 * Compare the meta rows of three fixtures:
 *
 *   stream-flagged-post-en.html   <div class="meta-row">Edited Mar 10</div>
 *   rtl-flagged-post-ar.html      <div class="meta-row">تم التعديل في ١٠ مارس</div>
 *   announcement-detail-en.html   <div class="meta-row">Posted Nov 6, 2025</div>
 *
 * Same element, same class, same position, same shape. The only thing that
 * separates "edited" from "posted" is the words. No DOM shape, ARIA role or
 * element relationship distinguishes them.
 *
 * So this detector reports edited as `source: 'unavailable'` rather than
 * guessing. Returning a confident "not edited" would be a silent false
 * negative that compare-mode instrumentation would misread as agreement with
 * the keyword engine. Declaring the gap makes it measurable instead.
 *
 * Resolving it needs real captures (#396/#673) that show whether live
 * Classroom marks edited posts with a distinguishing node or attribute.
 */
import type { LayerTrace } from '../../engines/types';
import type {
  Detector,
  DetectContext,
  PostObservation,
  CommentObservation,
} from '../../contracts/detection';

import { extractDigitCount } from '../shared/numerals';

/** Result of one structural layer. */
interface StructuralLayerResult {
  strength: number;
  count: number | null;
  source: string;
  details: string;
}

const NO_MATCH: StructuralLayerResult = {
  strength: 0,
  count: null,
  source: 'none',
  details: 'no structural comment signal',
};

/**
 * Layer S0 — Google's own comment-count container.
 *
 * Selector chain ported from the keyword engine's `commentLayer0_DOMTruth`,
 * which was already language-free. Scores match that layer so the two engines
 * are directly comparable: 100 for a positive container match, 95 for the
 * weaker bare-`.seqYL` fallback.
 */
function layerDomTruth(post: HTMLElement): StructuralLayerResult {
  // Primary: .qCWAqb .huI6Cb
  const huI6Cb = post.querySelector<HTMLElement>('.qCWAqb .huI6Cb');
  if (huI6Cb) {
    const count = extractDigitCount(huI6Cb.textContent ?? '');
    if (count !== null) {
      return {
        strength: 100,
        count,
        source: 'dom-truth',
        details: `S0: numeral in .qCWAqb .huI6Cb (count: ${count})`,
      };
    }
  }

  // Fallback 1: the .qCWAqb.seqYL container and its known count children
  const container = post.querySelector<HTMLElement>('.qCWAqb.seqYL');
  if (container) {
    const textSpan = container.querySelector<HTMLElement>(
      '.mUIrbf-vQzf8d, .jzdBjc, span[aria-hidden="true"]',
    );
    if (textSpan) {
      const count = extractDigitCount(textSpan.textContent ?? '');
      if (count !== null) {
        return {
          strength: 100,
          count,
          source: 'dom-truth',
          details: `S0: numeral in .qCWAqb.seqYL span (count: ${count})`,
        };
      }
    }

    const icon = container.querySelector<HTMLElement>('.huI6Cb');
    if (icon) {
      const count = extractDigitCount(icon.textContent ?? '');
      if (count !== null) {
        return {
          strength: 100,
          count,
          source: 'dom-truth',
          details: `S0: numeral in .huI6Cb (count: ${count})`,
        };
      }
    }

    const direct = extractDigitCount(container.textContent ?? '');
    if (direct !== null && direct < 1000) {
      return {
        strength: 100,
        count: direct,
        source: 'dom-truth',
        details: `S0: numeral in .qCWAqb.seqYL text (count: ${direct})`,
      };
    }
  }

  // Fallback 2: a bare .seqYL elsewhere in the post. Weaker signal.
  const seqYL = post.querySelector<HTMLElement>('.seqYL');
  if (seqYL && seqYL !== container) {
    const count = extractDigitCount(seqYL.textContent ?? '');
    if (count !== null && count < 1000) {
      return {
        strength: 95,
        count,
        source: 'seqYL',
        details: `S0: numeral in .seqYL (count: ${count})`,
      };
    }
  }

  return NO_MATCH;
}

export class StructuralDetector implements Detector {
  readonly name = 'structural' as const;

  observe(post: HTMLElement, _ctx: DetectContext): PostObservation {
    const startTime = performance.now();

    const s0 = layerDomTruth(post);

    const comment: CommentObservation = {
      present: s0.strength > 0,
      count: s0.count,
      strength: s0.strength,
      source: s0.source,
    };

    const debug: LayerTrace[] = [
      {
        layerName: 'structural-S0',
        layerIndex: 0,
        score: s0.strength,
        matched: s0.strength > 0,
        matchedText: null, // structural detection never carries page text
        selectorUsed: s0.source,
        details: s0.details,
      },
      {
        layerName: 'structural-edited',
        layerIndex: 1,
        score: 0,
        matched: false,
        matchedText: null,
        selectorUsed: null,
        details: 'edited: no structural signal exists — see module header',
      },
    ];

    return {
      postId: _ctx.postId,
      viewKind: _ctx.viewKind,
      detector: this.name,
      comment,
      edited: {
        present: false,
        nearDate: false,
        strength: 0,
        // Not 'none'. This detector cannot evaluate edited at all, and the
        // comparison layer must be able to tell that apart from "looked and
        // found nothing".
        source: 'unavailable',
      },
      penalties: [],
      elapsedMs: performance.now() - startTime,
      debug,
    };
  }
}

/** Shared instance — the detector is stateless. */
export const structuralDetector = new StructuralDetector();
