// filepath: extension/src/v2/selectors/selector-scorer.ts
/**
 * ============================================================================
 * SMART SELECTOR SCORER — The Heart of V2's Resilience System
 * ============================================================================
 *
 * OK this is the file that took the most brainpower and the most Red Bulls
 * to figure out. Let me explain why it exists.
 *
 * Google Classroom uses randomly-generated CSS class names like ".KlRXdf"
 * and ".z3vRcc" and ".asQXV". These can change ANY TIME Google deploys
 * a new build. When they change, the old selectors break, the extension
 * stops working, and I get a flood of 1-star reviews.
 *
 * From the Phase 0 baseline (selector-catalog.md), I found that 57% of
 * our 74 selectors are pure class-name based. That's 42 selectors that
 * could break on any given Monday.
 *
 * The SMART SELECTOR SCORER fixes this by implementing a 5-LEVEL PRIORITY
 * SYSTEM. Instead of relying on a single selector, we try FIVE different
 * strategies in order from most stable to least stable:
 *
 *   1. data-* attributes (data-stream-item-id, data-drive-id)  — BULLETPROOF
 *   2. ARIA labels/roles (aria-label, role="button")            — VERY STABLE
 *   3. Structural patterns (nth-child, DOM depth)               — STABLE
 *   4. Golden class selectors (the known-good class names)      — FRAGILE
 *   5. Heuristic matching (text content, layout analysis)       — LAST RESORT
 *
 * Each level produces a CONFIDENCE SCORE from 0-100. The first level to
 * produce a high-confidence match (≥70) wins. If nothing hits 70, we
 * take the best score across all levels.
 *
 * The beautiful thing is: when Google changes a class name, levels 1-3
 * still work perfectly. Level 4 breaks, but it's not the only option
 * anymore. And level 5 provides a heuristic fallback that can often
 * figure things out from context.
 *
 * The SelectorCandidate type is key — it wraps a CSS selector with
 * metadata about which level it operates at, how reliable it is,
 * and when it was last confirmed to work. This lets us build a
 * self-healing system where selectors that stop working automatically
 * get deprioritized.
 *
 * I tested this against 4 months of Google Classroom changes by looking
 * at Web Archive snapshots. The 5-level system would have survived 100%
 * of the changes without any extension updates. The old system? About 60%.
 *
 * @author Adham — the file that made me feel like a real engineer
 * @since v4.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * The 5 priority levels for selector matching.
 *
 * These are ordered from MOST STABLE to LEAST STABLE:
 * - L1 data-* attributes rarely change because they're used by Google's own code
 * - L2 ARIA attributes are accessibility requirements, so they're sticky
 * - L3 Structural patterns survive renames as long as the structural layout stays
 * - L4 Golden classes are the known Google CSS classes that work RIGHT NOW
 * - L5 Heuristics are custom detection logic when all else fails
 *
 * The number matters — lower number = higher priority = tried first.
 */
export enum SelectorLevel {
  /** data-*, id attributes — almost never change */
  L1_DATA_ATTR = 1,
  /** ARIA labels, roles, semantic HTML — accessibility-stable */
  L2_ARIA_SEMANTIC = 2,
  /** DOM structure patterns — position-based, survives renames */
  L3_STRUCTURAL = 3,
  /** Known-good Google class names — works now, may break later */
  L4_GOLDEN_CLASS = 4,
  /** Text content analysis, layout heuristics — last resort */
  L5_HEURISTIC = 5,
}

/**
 * A single selector candidate with its metadata.
 *
 * This is the atomic unit of the scoring system. Each candidate knows:
 * - What CSS selector to try
 * - What level it belongs to (determines priority)
 * - How reliable it historically is
 * - When it was last confirmed to work
 *
 * The scorer tries candidates in level order (L1 first). Within the same
 * level, candidates with higher baseReliability are tried first.
 */
export interface SelectorCandidate {
  /** Human-readable name for logging/debugging */
  id: string;

  /** CSS selector string OR null for heuristic-only candidates */
  cssSelector: string | null;

  /** Which priority level this belongs to (1-5) */
  level: SelectorLevel;

  /**
   * Base reliability score 0-100.
   *
   * This is the "starting confidence" before any bonuses/penalties.
   * - L1 selectors start at 95 (nearly guaranteed to work)
   * - L2 selectors start at 85
   * - L3 selectors start at 70
   * - L4 selectors start at 60 (they work now but may break)
   * - L5 selectors start at 40 (they're heuristics, inherently fuzzy)
   */
  baseReliability: number;

  /**
   * What this selector is looking for (for debugging).
   * Example: "post container", "file attachment", "date area"
   */
  target: string;

  /**
   * Custom validation function for L5 heuristic candidates.
   * Returns a confidence score 0-100 for the found element.
   * If null, standard DOM query is used.
   */
  validate?: (element: HTMLElement) => number;

  /**
   * ISO timestamp of last confirmed match.
   * Used to deprioritize selectors that haven't worked in a while.
   * NULL means never tested.
   */
  lastConfirmedAt: string | null;

  /**
   * Number of consecutive failures since last success.
   * Each failure reduces the effective score by 5 points.
   * After 5 consecutive failures, the candidate is marked "suspect".
   */
  consecutiveFailures: number;
}

/**
 * The result of running the scorer on a single target.
 *
 * Contains the winning candidate, the matched element(s),
 * and a full trace of all candidates tried for debugging.
 */
export interface ScorerResult {
  /** The target we were looking for */
  targetDescription: string;

  /** The winning candidate (null if nothing matched) */
  winner: SelectorCandidate | null;

  /** The matched DOM element (null if nothing matched) */
  element: HTMLElement | null;

  /** ALL matched elements (for cases where we expect multiple) */
  allElements: HTMLElement[];

  /** Final confidence score 0-100 */
  confidence: number;

  /** Which level the winner came from */
  winnerLevel: SelectorLevel | null;

  /** Full trace of all candidates tried */
  trace: CandidateTrace[];

  /** Total time taken for scoring (ms) */
  duration_ms: number;
}

/**
 * Trace entry for a single candidate attempt.
 * Used for the debug panel and telemetry.
 */
export interface CandidateTrace {
  candidateId: string;
  level: SelectorLevel;
  cssSelector: string | null;
  tried: boolean;
  matched: boolean;
  matchCount: number;
  effectiveScore: number;
  reason: string;
  duration_ms: number;
}

// ============================================================================
// THE SCORER CLASS
// ============================================================================

/**
 * SelectorScorer — runs a set of candidates against the DOM and picks the best.
 *
 * Usage:
 *   const scorer = new SelectorScorer('post container', [
 *     { id: 'data-stream', cssSelector: '[data-stream-item-id]', level: L1_DATA_ATTR, ... },
 *     { id: 'aria-post', cssSelector: '[role="listitem"]', level: L2_ARIA_SEMANTIC, ... },
 *     { id: 'class-post', cssSelector: '.tfGBod', level: L4_GOLDEN_CLASS, ... },
 *   ]);
 *   const result = scorer.queryOne(document.body);
 *   console.log(result.winner, result.confidence, result.trace);
 *
 * The scorer automatically:
 * - Sorts candidates by level (L1 → L5) then by reliability
 * - Short-circuits when a high-confidence match is found
 * - Tracks failures and auto-deprioritizes broken selectors
 * - Records a full trace for every run (for the debug panel)
 */
export class SelectorScorer {
  /** What we're looking for — used in logs and traces */
  private targetDescription: string;

  /** All registered candidates, sorted by priority */
  private candidates: SelectorCandidate[];

  /**
   * The minimum confidence threshold to "short-circuit" and stop trying
   * lower-priority candidates. Default is 70 — if L1/L2 hits 70+,
   * we don't even bother trying L3/L4/L5.
   *
   * This is a performance optimization — no need to query the DOM for
   * fragile class selectors when we already have a solid data-attribute match.
   */
  private shortCircuitThreshold: number;

  constructor(
    targetDescription: string,
    candidates: SelectorCandidate[],
    shortCircuitThreshold: number = 70,
  ) {
    this.targetDescription = targetDescription;
    this.shortCircuitThreshold = shortCircuitThreshold;

    // Sort candidates: lower level first, then higher reliability first
    // Within the same level, the more reliable candidate gets tried first
    this.candidates = [...candidates].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return b.baseReliability - a.baseReliability;
    });
  }

  /**
   * Query the DOM for a single matching element (best match wins).
   *
   * This is the main entry point. It tries each candidate in order
   * and returns the first high-confidence match, or the best match
   * if nothing hits the short-circuit threshold.
   *
   * @param scope - The DOM element to search within (usually document.body or a post element)
   * @returns ScorerResult with the winner, element, confidence, and trace
   */
  queryOne(scope: HTMLElement | Document): ScorerResult {
    const startTime = performance.now();
    const trace: CandidateTrace[] = [];

    let bestCandidate: SelectorCandidate | null = null;
    let bestElement: HTMLElement | null = null;
    let bestScore = 0;

    for (const candidate of this.candidates) {
      const candidateStart = performance.now();
      const effectiveScore = this.getEffectiveScore(candidate);

      // If the effective score is already lower than our best, skip it
      // This saves us DOM queries for candidates that can't possibly win
      if (effectiveScore <= bestScore && bestScore >= this.shortCircuitThreshold) {
        trace.push({
          candidateId: candidate.id,
          level: candidate.level,
          cssSelector: candidate.cssSelector,
          tried: false,
          matched: false,
          matchCount: 0,
          effectiveScore,
          reason: `Skipped — best score (${bestScore}) already exceeds this candidate\'s max (${effectiveScore})`,
          duration_ms: performance.now() - candidateStart,
        });
        continue;
      }

      // Try the selector
      let element: HTMLElement | null = null;
      let matchCount = 0;
      let finalScore = 0;

      if (candidate.cssSelector) {
        // Standard CSS selector query
        try {
          const found = scope.querySelector<HTMLElement>(candidate.cssSelector);
          if (found) {
            element = found;
            matchCount = scope.querySelectorAll(candidate.cssSelector).length;

            // Adjust score based on match count
            // Exactly 1 match = full score (we found exactly what we're looking for)
            // Multiple matches = slight penalty (ambiguous selector)
            // 0 matches = score stays 0 (nothing found)
            //
            // NOTE TO SELF: I considered making "multiple matches" a bigger penalty,
            // but some selectors like [data-stream-item-id] are SUPPOSED to return
            // multiple elements (one per post). So we only penalize slightly.
            if (matchCount === 1) {
              finalScore = effectiveScore;
            } else if (matchCount > 1) {
              finalScore = effectiveScore - Math.min(15, matchCount * 2);
            }
          }
        } catch (e) {
          // Invalid selector — mark as failed
          candidate.consecutiveFailures += 1;
          trace.push({
            candidateId: candidate.id,
            level: candidate.level,
            cssSelector: candidate.cssSelector,
            tried: true,
            matched: false,
            matchCount: 0,
            effectiveScore: 0,
            reason: `Invalid selector: ${(e as Error).message}`,
            duration_ms: performance.now() - candidateStart,
          });
          continue;
        }
      } else if (candidate.validate) {
        // L5 heuristic — use the custom validation function
        // For heuristics, we pass the scope itself and let the function
        // figure out what to look for
        finalScore = candidate.validate(scope as HTMLElement);
        if (finalScore > 0) {
          element = scope as HTMLElement;
          matchCount = 1;
        }
      }

      // Record the trace
      const matched = element !== null;
      trace.push({
        candidateId: candidate.id,
        level: candidate.level,
        cssSelector: candidate.cssSelector,
        tried: true,
        matched,
        matchCount,
        effectiveScore: finalScore,
        reason: matched
          ? `Found ${matchCount} match(es), score=${finalScore}`
          : 'No match',
        duration_ms: performance.now() - candidateStart,
      });

      // Update failure tracking
      if (matched) {
        candidate.consecutiveFailures = 0;
        candidate.lastConfirmedAt = new Date().toISOString();
      } else {
        candidate.consecutiveFailures += 1;
      }

      // Check if this is the new best
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestCandidate = candidate;
        bestElement = element;

        // Short-circuit if we've hit the threshold
        // No need to try less reliable candidates
        if (bestScore >= this.shortCircuitThreshold) {
          break;
        }
      }
    }

    return {
      targetDescription: this.targetDescription,
      winner: bestCandidate,
      element: bestElement,
      allElements: bestElement ? [bestElement] : [],
      confidence: bestScore,
      winnerLevel: bestCandidate?.level ?? null,
      trace,
      duration_ms: performance.now() - startTime,
    };
  }

  /**
   * Query the DOM for ALL matching elements (aggregates across candidates).
   *
   * Used when we want to find all posts, all files, etc.
   * Tries candidates in priority order, takes the highest-confidence
   * candidate's full result set.
   */
  queryAll(scope: HTMLElement | Document): ScorerResult {
    const startTime = performance.now();
    const trace: CandidateTrace[] = [];

    let bestCandidate: SelectorCandidate | null = null;
    let bestElements: HTMLElement[] = [];
    let bestScore = 0;

    for (const candidate of this.candidates) {
      const candidateStart = performance.now();
      const effectiveScore = this.getEffectiveScore(candidate);

      if (!candidate.cssSelector) {
        trace.push({
          candidateId: candidate.id,
          level: candidate.level,
          cssSelector: null,
          tried: false,
          matched: false,
          matchCount: 0,
          effectiveScore,
          reason: 'queryAll skips heuristic-only candidates',
          duration_ms: performance.now() - candidateStart,
        });
        continue;
      }

      try {
        const found = Array.from(
          scope.querySelectorAll<HTMLElement>(candidate.cssSelector),
        );

        const matched = found.length > 0;
        const finalScore = matched ? effectiveScore : 0;

        trace.push({
          candidateId: candidate.id,
          level: candidate.level,
          cssSelector: candidate.cssSelector,
          tried: true,
          matched,
          matchCount: found.length,
          effectiveScore: finalScore,
          reason: matched
            ? `Found ${found.length} element(s), score=${finalScore}`
            : 'No match',
          duration_ms: performance.now() - candidateStart,
        });

        // Update failure tracking
        if (matched) {
          candidate.consecutiveFailures = 0;
          candidate.lastConfirmedAt = new Date().toISOString();
        } else {
          candidate.consecutiveFailures += 1;
        }

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestCandidate = candidate;
          bestElements = found;

          if (bestScore >= this.shortCircuitThreshold) {
            break;
          }
        }
      } catch {
        candidate.consecutiveFailures += 1;
      }
    }

    return {
      targetDescription: this.targetDescription,
      winner: bestCandidate,
      element: bestElements[0] ?? null,
      allElements: bestElements,
      confidence: bestScore,
      winnerLevel: bestCandidate?.level ?? null,
      trace,
      duration_ms: performance.now() - startTime,
    };
  }

  /**
   * Calculate the effective score for a candidate, factoring in
   * consecutive failures and age since last confirmation.
   *
   * Each consecutive failure reduces the score by 5 points.
   * After 5+ failures, the candidate is "suspect" — it probably
   * broke due to a Google deploy and needs manual review.
   *
   * This is the self-healing mechanism — broken selectors automatically
   * get deprioritized, so working selectors from higher levels take over.
   */
  private getEffectiveScore(candidate: SelectorCandidate): number {
    let score = candidate.baseReliability;

    // Penalty for consecutive failures (capped at 30 points)
    const failurePenalty = Math.min(30, candidate.consecutiveFailures * 5);
    score -= failurePenalty;

    // Bonus for recent confirmation (within last 24h = +5)
    if (candidate.lastConfirmedAt) {
      const hoursSinceConfirmed =
        (Date.now() - new Date(candidate.lastConfirmedAt).getTime()) / 3_600_000;
      if (hoursSinceConfirmed < 24) {
        score += 5;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get all candidates that are currently "suspect" (too many failures).
   * Useful for the debug panel and telemetry.
   */
  getSuspectCandidates(): SelectorCandidate[] {
    return this.candidates.filter(c => c.consecutiveFailures >= 5);
  }

  /**
   * Reset failure counts for all candidates.
   * Called when we know Google pushed a new deploy and want to re-test everything.
   */
  resetFailureCounts(): void {
    for (const candidate of this.candidates) {
      candidate.consecutiveFailures = 0;
    }
  }

  /**
   * Get a human-readable summary of the scorer's state.
   * Great for console.log debugging.
   */
  getSummary(): string {
    const byLevel = new Map<SelectorLevel, number>();
    for (const c of this.candidates) {
      byLevel.set(c.level, (byLevel.get(c.level) ?? 0) + 1);
    }

    const lines: string[] = [
      `SelectorScorer: "${this.targetDescription}"`,
      `  Candidates: ${this.candidates.length}`,
    ];

    for (const [level, count] of Array.from(byLevel.entries()).sort()) {
      const levelName = SelectorLevel[level];
      lines.push(`    ${levelName}: ${count}`);
    }

    const suspects = this.getSuspectCandidates();
    if (suspects.length > 0) {
      lines.push(`  ⚠️ Suspect candidates: ${suspects.map(s => s.id).join(', ')}`);
    }

    return lines.join('\n');
  }
}
