// filepath: extension/tests/v2-selector-scorer.test.ts
/**
 * ============================================================================
 * V2 SELECTOR SCORER — Full Test Suite
 * ============================================================================
 *
 * Exhaustive tests for the SelectorScorer — the 5-level priority system
 * that makes V2 resilient to Google Classroom class name changes.
 *
 * Categories tested:
 * 1. Constructor & sorting — proper level/reliability ordering
 * 2. queryOne — single element matching with priority logic
 * 3. queryAll — multi-element matching
 * 4. Short-circuit — stop early when high-confidence found
 * 5. Failure tracking — auto-deprioritization of broken selectors
 * 6. Effective score — failure penalty + recency bonus
 * 7. Edge cases — empty DOM, invalid selectors, no candidates
 * 8. Trace output — trace completeness and accuracy
 * 9. Heuristic candidates (L5) — custom validation functions
 * 10. Reset and suspect detection
 *
 * @author Adham — testing my confidence system with confidence
 * @since v4.0.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SelectorScorer,
  SelectorLevel,
  type SelectorCandidate,
} from '../src/v2/selectors/selector-scorer';

// ============================================================================
// HELPERS
// ============================================================================

function makeCandidate(overrides: Partial<SelectorCandidate> = {}): SelectorCandidate {
  return {
    id: 'test-candidate',
    cssSelector: '.test-class',
    level: SelectorLevel.L4_GOLDEN_CLASS,
    baseReliability: 60,
    target: 'test element',
    lastConfirmedAt: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

// ============================================================================
// CONSTRUCTOR & SORTING
// ============================================================================

describe('SelectorScorer: Constructor & Sorting', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sorts candidates by level (lower = higher priority)', () => {
    const scorer = new SelectorScorer('test', [
      makeCandidate({ id: 'l4', level: SelectorLevel.L4_GOLDEN_CLASS, cssSelector: '.l4' }),
      makeCandidate({ id: 'l1', level: SelectorLevel.L1_DATA_ATTR, cssSelector: '[data-test]' }),
      makeCandidate({ id: 'l2', level: SelectorLevel.L2_ARIA_SEMANTIC, cssSelector: '[role="test"]' }),
    ]);

    // Set up DOM for all to match
    document.body.innerHTML = '<div data-test class="l4" role="test">content</div>';

    const result = scorer.queryOne(document.body);
    // L1 should win because it's tried first and matches
    expect(result.winner?.id).toBe('l1');
    expect(result.winnerLevel).toBe(SelectorLevel.L1_DATA_ATTR);
  });

  it('sorts by reliability within the same level', () => {
    const scorer = new SelectorScorer('test', [
      makeCandidate({ id: 'low', level: SelectorLevel.L4_GOLDEN_CLASS, baseReliability: 40, cssSelector: '.low' }),
      makeCandidate({ id: 'high', level: SelectorLevel.L4_GOLDEN_CLASS, baseReliability: 80, cssSelector: '.high' }),
    ]);

    document.body.innerHTML = '<div class="low high">content</div>';

    const result = scorer.queryOne(document.body);
    // Higher reliability within same level should be tried first
    expect(result.winner?.id).toBe('high');
  });

  it('handles empty candidate list gracefully', () => {
    const scorer = new SelectorScorer('empty', []);
    const result = scorer.queryOne(document.body);

    expect(result.winner).toBeNull();
    expect(result.element).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.trace).toHaveLength(0);
  });
});

// ============================================================================
// queryOne — Single Element Matching
// ============================================================================

describe('SelectorScorer: queryOne', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the first high-confidence match', () => {
    const scorer = new SelectorScorer('post', [
      makeCandidate({
        id: 'data-stream',
        cssSelector: '[data-stream-item-id]',
        level: SelectorLevel.L1_DATA_ATTR,
        baseReliability: 95,
      }),
    ]);

    document.body.innerHTML = '<div data-stream-item-id="123">Post</div>';
    const result = scorer.queryOne(document.body);

    expect(result.winner?.id).toBe('data-stream');
    expect(result.element).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it('falls through levels when higher levels fail', () => {
    const scorer = new SelectorScorer('post', [
      makeCandidate({
        id: 'l1-miss',
        cssSelector: '[data-nonexistent]',
        level: SelectorLevel.L1_DATA_ATTR,
        baseReliability: 95,
      }),
      makeCandidate({
        id: 'l2-miss',
        cssSelector: '[role="nonexistent"]',
        level: SelectorLevel.L2_ARIA_SEMANTIC,
        baseReliability: 85,
      }),
      makeCandidate({
        id: 'l4-hit',
        cssSelector: '.existing-class',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = '<div class="existing-class">Content</div>';
    const result = scorer.queryOne(document.body);

    expect(result.winner?.id).toBe('l4-hit');
    expect(result.winnerLevel).toBe(SelectorLevel.L4_GOLDEN_CLASS);
  });

  it('returns null when nothing matches', () => {
    const scorer = new SelectorScorer('ghost', [
      makeCandidate({ id: 'miss', cssSelector: '.nonexistent' }),
    ]);

    document.body.innerHTML = '<div>Nothing here</div>';
    const result = scorer.queryOne(document.body);

    expect(result.winner).toBeNull();
    expect(result.element).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('penalizes ambiguous selectors (multiple matches)', () => {
    const scorer = new SelectorScorer('unique', [
      makeCandidate({
        id: 'ambiguous',
        cssSelector: '.common',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = `
      <div class="common">1</div>
      <div class="common">2</div>
      <div class="common">3</div>
      <div class="common">4</div>
      <div class="common">5</div>
    `;

    const result = scorer.queryOne(document.body);
    // Score should be reduced due to multiple matches
    expect(result.confidence).toBeLessThan(60);
  });

  it('gives full score for exactly 1 match', () => {
    const scorer = new SelectorScorer('exact', [
      makeCandidate({
        id: 'unique',
        cssSelector: '.unique-element',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = '<div class="unique-element">Only one</div>';
    const result = scorer.queryOne(document.body);
    expect(result.confidence).toBe(60);
  });

  it('accepts scoped search within a subtree', () => {
    const scorer = new SelectorScorer('child', [
      makeCandidate({
        id: 'target',
        cssSelector: '.child-element',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = `
      <div id="parent">
        <span class="child-element">Inside</span>
      </div>
      <div id="sibling">
        <span class="child-element">Outside</span>
      </div>
    `;

    const parent = document.getElementById('parent')!;
    const result = scorer.queryOne(parent);
    expect(result.element).toBeTruthy();
    expect(result.element?.closest('#parent')).toBeTruthy();
  });
});

// ============================================================================
// queryAll — Multi-Element Matching
// ============================================================================

describe('SelectorScorer: queryAll', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns all elements matching the best candidate', () => {
    const scorer = new SelectorScorer('posts', [
      makeCandidate({
        id: 'all-posts',
        cssSelector: '[data-stream-item-id]',
        level: SelectorLevel.L1_DATA_ATTR,
        baseReliability: 95,
      }),
    ]);

    document.body.innerHTML = `
      <div data-stream-item-id="1">Post 1</div>
      <div data-stream-item-id="2">Post 2</div>
      <div data-stream-item-id="3">Post 3</div>
    `;

    const result = scorer.queryAll(document.body);
    expect(result.allElements).toHaveLength(3);
    expect(result.confidence).toBeGreaterThanOrEqual(70);
  });

  it('skips heuristic-only candidates in queryAll', () => {
    const scorer = new SelectorScorer('posts', [
      makeCandidate({
        id: 'heuristic',
        cssSelector: null,
        level: SelectorLevel.L5_HEURISTIC,
        baseReliability: 40,
        validate: () => 80,
      }),
      makeCandidate({
        id: 'css',
        cssSelector: '.post',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = '<div class="post">Content</div>';
    const result = scorer.queryAll(document.body);

    expect(result.winner?.id).toBe('css');
    const heuristicTrace = result.trace.find(t => t.candidateId === 'heuristic');
    expect(heuristicTrace?.tried).toBe(false);
  });

  it('returns empty array when nothing matches', () => {
    const scorer = new SelectorScorer('ghost', [
      makeCandidate({ id: 'miss', cssSelector: '.nonexistent' }),
    ]);

    const result = scorer.queryAll(document.body);
    expect(result.allElements).toHaveLength(0);
    expect(result.element).toBeNull();
  });

  it('prefers higher-level candidates even with fewer results', () => {
    const scorer = new SelectorScorer('posts', [
      makeCandidate({
        id: 'l1-few',
        cssSelector: '[data-stream-item-id]',
        level: SelectorLevel.L1_DATA_ATTR,
        baseReliability: 95,
      }),
      makeCandidate({
        id: 'l4-many',
        cssSelector: '.generic-item',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = `
      <div data-stream-item-id="1" class="generic-item">Post 1</div>
      <div class="generic-item">Not a post</div>
      <div class="generic-item">Not a post either</div>
    `;

    const result = scorer.queryAll(document.body);
    // L1 should win because it short-circuits at 95 confidence
    expect(result.winner?.id).toBe('l1-few');
    expect(result.allElements).toHaveLength(1);
  });
});

// ============================================================================
// Short-Circuit Behavior
// ============================================================================

describe('SelectorScorer: Short-Circuit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('stops trying lower-level candidates when threshold is met', () => {
    const scorer = new SelectorScorer('fast', [
      makeCandidate({
        id: 'l1-hit',
        cssSelector: '[data-test]',
        level: SelectorLevel.L1_DATA_ATTR,
        baseReliability: 95,
      }),
      makeCandidate({
        id: 'l4-skip',
        cssSelector: '.should-not-try',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 60,
      }),
    ]);

    document.body.innerHTML = '<div data-test="1" class="should-not-try">Content</div>';
    const result = scorer.queryOne(document.body);

    expect(result.winner?.id).toBe('l1-hit');

    // L4 should not have been tried because L1 hit the threshold
    const l4Trace = result.trace.find(t => t.candidateId === 'l4-skip');
    expect(l4Trace).toBeUndefined(); // Not even in trace because loop broke
  });

  it('continues trying when score is below threshold', () => {
    const scorer = new SelectorScorer('slow', [
      makeCandidate({
        id: 'l3-weak',
        cssSelector: '.many-matches',
        level: SelectorLevel.L3_STRUCTURAL,
        baseReliability: 65, // Below threshold of 70
      }),
      makeCandidate({
        id: 'l4-better',
        cssSelector: '.better-match',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 75,
      }),
    ]);

    // L3 has many matches (gets penalized below 70), L4 has one match
    document.body.innerHTML = `
      <div class="many-matches">1</div>
      <div class="many-matches">2</div>
      <div class="many-matches">3</div>
      <div class="better-match">Only one</div>
    `;

    const result = scorer.queryOne(document.body);
    // L4 should be tried because L3 didn't hit threshold
    expect(result.winner?.id).toBe('l4-better');
  });

  it('respects custom short-circuit threshold', () => {
    const scorer = new SelectorScorer(
      'custom-threshold',
      [
        makeCandidate({
          id: 'l1',
          cssSelector: '[data-test]',
          level: SelectorLevel.L1_DATA_ATTR,
          baseReliability: 50, // Below custom threshold of 90
        }),
        makeCandidate({
          id: 'l4',
          cssSelector: '.fallback',
          level: SelectorLevel.L4_GOLDEN_CLASS,
          baseReliability: 60,
        }),
      ],
      90, // Very high threshold
    );

    document.body.innerHTML = '<div data-test class="fallback">Content</div>';
    const result = scorer.queryOne(document.body);

    // L1 scores 50 which is below threshold of 90
    // L4 scores 60 which is also below 90
    // Best score of 60 wins (L4)
    expect(result.winner?.id).toBe('l4');
  });
});

// ============================================================================
// Failure Tracking & Self-Healing
// ============================================================================

describe('SelectorScorer: Failure Tracking', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('increments consecutiveFailures on miss', () => {
    const candidate = makeCandidate({
      id: 'failing',
      cssSelector: '.nonexistent',
      consecutiveFailures: 0,
    });
    const scorer = new SelectorScorer('fail-test', [candidate]);

    scorer.queryOne(document.body);
    expect(candidate.consecutiveFailures).toBe(1);

    scorer.queryOne(document.body);
    expect(candidate.consecutiveFailures).toBe(2);
  });

  it('resets consecutiveFailures on hit', () => {
    const candidate = makeCandidate({
      id: 'recovering',
      cssSelector: '.found',
      consecutiveFailures: 5,
    });
    const scorer = new SelectorScorer('recover-test', [candidate]);

    document.body.innerHTML = '<div class="found">Here!</div>';
    scorer.queryOne(document.body);
    expect(candidate.consecutiveFailures).toBe(0);
  });

  it('updates lastConfirmedAt on successful match', () => {
    const candidate = makeCandidate({
      id: 'dated',
      cssSelector: '.dated',
      lastConfirmedAt: null,
    });
    const scorer = new SelectorScorer('date-test', [candidate]);

    document.body.innerHTML = '<div class="dated">Content</div>';
    scorer.queryOne(document.body);

    expect(candidate.lastConfirmedAt).not.toBeNull();
    // Should be a recent ISO timestamp
    const ts = new Date(candidate.lastConfirmedAt!).getTime();
    expect(Date.now() - ts).toBeLessThan(5000);
  });

  it('penalizes score for consecutive failures (5 per failure, max 30)', () => {
    // Two candidates: both L4, but one has 4 consecutive failures
    const good = makeCandidate({
      id: 'good',
      cssSelector: '.good',
      baseReliability: 60,
      consecutiveFailures: 0,
    });
    const bad = makeCandidate({
      id: 'bad',
      cssSelector: '.bad',
      baseReliability: 65,
      consecutiveFailures: 4, // -20 penalty → effective 45
    });
    const scorer = new SelectorScorer('penalty-test', [good, bad]);

    document.body.innerHTML = '<div class="good bad">Both match</div>';
    const result = scorer.queryOne(document.body);

    // Despite bad having higher base reliability (65), its 4 failures
    // reduce it to 45, making good (60) the winner
    expect(result.winner?.id).toBe('good');
  });

  it('caps failure penalty at 30 points', () => {
    const candidate = makeCandidate({
      id: 'very-broken',
      cssSelector: '.very-broken',
      baseReliability: 60,
      consecutiveFailures: 100, // Should cap at -30, giving 30
    });
    const scorer = new SelectorScorer('cap-test', [candidate]);

    document.body.innerHTML = '<div class="very-broken">Content</div>';
    const result = scorer.queryOne(document.body);

    // Base 60 - 30 (cap) = 30
    expect(result.confidence).toBe(30);
  });

  it('detects suspect candidates (5+ consecutive failures)', () => {
    const healthy = makeCandidate({
      id: 'healthy',
      cssSelector: '.ok',
      consecutiveFailures: 0,
    });
    const suspect = makeCandidate({
      id: 'suspect',
      cssSelector: '.broken',
      consecutiveFailures: 5,
    });
    const scorer = new SelectorScorer('suspect-test', [healthy, suspect]);

    const suspects = scorer.getSuspectCandidates();
    expect(suspects).toHaveLength(1);
    expect(suspects[0].id).toBe('suspect');
  });

  it('resetFailureCounts clears all counters', () => {
    const a = makeCandidate({
      id: 'a',
      cssSelector: '.a',
      consecutiveFailures: 10,
    });
    const b = makeCandidate({
      id: 'b',
      cssSelector: '.b',
      consecutiveFailures: 7,
    });
    const scorer = new SelectorScorer('reset-test', [a, b]);

    scorer.resetFailureCounts();
    expect(a.consecutiveFailures).toBe(0);
    expect(b.consecutiveFailures).toBe(0);
  });
});

// ============================================================================
// Recency Bonus
// ============================================================================

describe('SelectorScorer: Recency Bonus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('gives +5 bonus for recently confirmed candidates (<24h)', () => {
    // Two candidates with the same base reliability, but one was confirmed recently
    const recent = makeCandidate({
      id: 'recent',
      cssSelector: '.recent',
      baseReliability: 55,
      lastConfirmedAt: new Date().toISOString(), // Just now
    });
    const stale = makeCandidate({
      id: 'stale',
      cssSelector: '.stale',
      baseReliability: 55,
      lastConfirmedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2 days ago
    });
    const scorer = new SelectorScorer('recency-test', [recent, stale]);

    document.body.innerHTML = '<div class="recent stale">Both match</div>';
    const result = scorer.queryOne(document.body);

    // Recent gets +5 bonus → 60, stale stays at 55
    expect(result.winner?.id).toBe('recent');
    expect(result.confidence).toBe(60);
  });
});

// ============================================================================
// Heuristic Candidates (L5)
// ============================================================================

describe('SelectorScorer: L5 Heuristic Candidates', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('uses validate function for heuristic candidates', () => {
    const scorer = new SelectorScorer('heuristic', [
      makeCandidate({
        id: 'heuristic-check',
        cssSelector: null,
        level: SelectorLevel.L5_HEURISTIC,
        baseReliability: 40,
        validate: (el: HTMLElement) => {
          // Check if the element has a specific text pattern
          return el.textContent?.includes('Hello') ? 75 : 0;
        },
      }),
    ]);

    document.body.innerHTML = '<div>Hello World</div>';
    const result = scorer.queryOne(document.body);

    expect(result.winner?.id).toBe('heuristic-check');
    expect(result.confidence).toBe(75);
  });

  it('returns 0 confidence when heuristic validate returns 0', () => {
    const scorer = new SelectorScorer('heuristic-miss', [
      makeCandidate({
        id: 'heuristic-fail',
        cssSelector: null,
        level: SelectorLevel.L5_HEURISTIC,
        baseReliability: 40,
        validate: () => 0,
      }),
    ]);

    const result = scorer.queryOne(document.body);
    expect(result.winner).toBeNull();
    expect(result.confidence).toBe(0);
  });
});

// ============================================================================
// Trace Output
// ============================================================================

describe('SelectorScorer: Trace Output', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('includes all tried candidates in the trace', () => {
    const scorer = new SelectorScorer('trace', [
      makeCandidate({ id: 'l1', cssSelector: '[data-test]', level: SelectorLevel.L1_DATA_ATTR, baseReliability: 50 }),
      makeCandidate({ id: 'l2', cssSelector: '[role="test"]', level: SelectorLevel.L2_ARIA_SEMANTIC, baseReliability: 50 }),
      makeCandidate({ id: 'l4', cssSelector: '.test', level: SelectorLevel.L4_GOLDEN_CLASS, baseReliability: 50 }),
    ]);

    document.body.innerHTML = '<div class="test">Content</div>';
    const result = scorer.queryOne(document.body);

    // All candidates should appear in the trace
    expect(result.trace.length).toBeGreaterThanOrEqual(2);
    // Every trace entry should have required fields
    for (const t of result.trace) {
      expect(t.candidateId).toBeDefined();
      expect(typeof t.level).toBe('number');
      expect(typeof t.tried).toBe('boolean');
      expect(typeof t.matched).toBe('boolean');
      expect(typeof t.effectiveScore).toBe('number');
      expect(typeof t.reason).toBe('string');
      expect(typeof t.duration_ms).toBe('number');
    }
  });

  it('records correct match count in trace', () => {
    const scorer = new SelectorScorer('count', [
      makeCandidate({
        id: 'counter',
        cssSelector: '.item',
        level: SelectorLevel.L4_GOLDEN_CLASS,
        baseReliability: 55,
      }),
    ]);

    document.body.innerHTML = `
      <div class="item">1</div>
      <div class="item">2</div>
      <div class="item">3</div>
    `;

    const result = scorer.queryOne(document.body);
    const trace = result.trace.find(t => t.candidateId === 'counter');
    expect(trace?.matchCount).toBe(3);
  });

  it('includes duration_ms in the result', () => {
    const scorer = new SelectorScorer('timed', [
      makeCandidate({ id: 'timed', cssSelector: '.a' }),
    ]);

    const result = scorer.queryOne(document.body);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('SelectorScorer: Edge Cases', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('handles invalid CSS selector syntax gracefully', () => {
    const scorer = new SelectorScorer('invalid', [
      makeCandidate({
        id: 'broken-selector',
        cssSelector: 'div[[[invalid',
        baseReliability: 60,
      }),
      makeCandidate({
        id: 'valid-fallback',
        cssSelector: '.valid',
        baseReliability: 50,
      }),
    ]);

    document.body.innerHTML = '<div class="valid">Content</div>';
    const result = scorer.queryOne(document.body);

    // Should fall through to the valid selector
    expect(result.winner?.id).toBe('valid-fallback');
  });

  it('handles deeply nested DOM structures', () => {
    const scorer = new SelectorScorer('deep', [
      makeCandidate({
        id: 'deep',
        cssSelector: '[data-deep]',
        level: SelectorLevel.L1_DATA_ATTR,
        baseReliability: 95,
      }),
    ]);

    let html = '';
    for (let i = 0; i < 20; i++) {
      html = `<div>${html}</div>`;
    }
    document.body.innerHTML = html.replace('<div></div>', '<div data-deep="found">Target</div>');

    const result = scorer.queryOne(document.body);
    expect(result.element).toBeTruthy();
    expect(result.element?.getAttribute('data-deep')).toBe('found');
  });

  it('works on an empty body', () => {
    document.body.innerHTML = '';
    const scorer = new SelectorScorer('empty', [
      makeCandidate({ id: 'miss', cssSelector: '.anything' }),
    ]);

    const result = scorer.queryOne(document.body);
    expect(result.winner).toBeNull();
    expect(result.allElements).toHaveLength(0);
  });

  it('getSummary produces readable output', () => {
    const scorer = new SelectorScorer('summary-test', [
      makeCandidate({ id: 'a', level: SelectorLevel.L1_DATA_ATTR }),
      makeCandidate({ id: 'b', level: SelectorLevel.L1_DATA_ATTR }),
      makeCandidate({ id: 'c', level: SelectorLevel.L4_GOLDEN_CLASS }),
    ]);

    const summary = scorer.getSummary();
    expect(summary).toContain('summary-test');
    expect(summary).toContain('3');
  });
});
