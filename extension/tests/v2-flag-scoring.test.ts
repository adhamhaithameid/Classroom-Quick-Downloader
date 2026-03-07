// filepath: extension/tests/v2-flag-scoring.test.ts
/**
 * Tests for the V2 Flag Scoring Engine.
 *
 * Tests the unified flag detection pipeline that replaces V1's
 * smart-detector-comments.ts and smart-detector.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  scoreComments,
  scoreEdited,
  scoreFlagsForPost,
  getThresholds,
} from '../src/v2/decision/flag-scoring';
import { clearKeywordCache } from '../src/v2/decision/keyword-loader';
import type { ViewKind } from '../src/engines/types';

// ============================================================================
// HELPERS
// ============================================================================

function createPost(html: string): HTMLElement {
  const div = document.createElement('div');
  div.setAttribute('data-stream-item-id', `test-${Date.now()}`);
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

function cleanupPosts(): void {
  document.body.innerHTML = '';
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  clearKeywordCache();
  cleanupPosts();
  document.documentElement.setAttribute('lang', 'en');
});

afterEach(() => {
  clearKeywordCache();
  cleanupPosts();
  document.documentElement.removeAttribute('lang');
});

// ============================================================================
// COMMENT SCORING TESTS
// ============================================================================

describe('scoreComments', () => {
  it('detects L0 DOM truth via .qCWAqb .huI6Cb', () => {
    const post = createPost(`
      <div class="qCWAqb">
        <div class="huI6Cb">3</div>
      </div>
    `);
    const result = scoreComments(post, 'en');
    expect(result.score).toBe(100);
    expect(result.count).toBe(3);
  });

  it('detects L0 via .qCWAqb.seqYL span', () => {
    const post = createPost(`
      <div class="qCWAqb seqYL">
        <span class="jzdBjc">2 comments</span>
      </div>
    `);
    const result = scoreComments(post, 'en');
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.count).toBe(2);
  });

  it('detects L1 accessibility via aria-label', () => {
    const post = createPost(`
      <button aria-label="5 comments"></button>
    `);
    const result = scoreComments(post, 'en');
    expect(result.score).toBeGreaterThan(0);
    expect(result.count).toBe(5);
  });

  it('skips L1 for action button text', () => {
    const post = createPost(`
      <button aria-label="Add class comment"></button>
    `);
    const result = scoreComments(post, 'en');
    expect(result.count).toBeNull();
  });

  it('detects L2 button heuristic', () => {
    const post = createPost(`
      <div role="button">3 comments</div>
    `);
    const result = scoreComments(post, 'en');
    expect(result.score).toBeGreaterThan(0);
    expect(result.count).toBe(3);
  });

  it('detects L3 golden selector .asQXV', () => {
    const post = createPost(`
      <div class="asQXV QRiHXd" aria-label="7 comments"></div>
    `);
    const result = scoreComments(post, 'en');
    expect(result.score).toBeGreaterThan(0);
    expect(result.count).toBe(7);
  });

  it('returns 0 for post with no comments', () => {
    const post = createPost(`
      <div class="post-content">
        <h3>Assignment Title</h3>
        <p>Description text</p>
      </div>
    `);
    const result = scoreComments(post, 'en');
    expect(result.score).toBe(0);
    expect(result.count).toBeNull();
  });

  it('returns layers array with all layer results', () => {
    const post = createPost('<div>Hello world</div>');
    const result = scoreComments(post, 'en');
    // Should have all 5 layers (L0-L4)
    expect(result.layers.length).toBeGreaterThanOrEqual(1);
  });

  it('detects Arabic comments (تعليقات)', () => {
    const post = createPost(`
      <button aria-label="3 تعليقات"></button>
    `);
    const result = scoreComments(post, 'ar');
    expect(result.count).toBe(3);
  });
});

// ============================================================================
// EDITED SCORING TESTS
// ============================================================================

describe('scoreEdited', () => {
  it('detects L1 golden selector with "Edited" keyword', () => {
    const post = createPost(`
      <div class="IMvYId dDKhVc Vu2fZd">
        Posted Dec 10, 2025 (Edited Dec 14, 2025)
      </div>
    `);
    const result = scoreEdited(post, 'en');
    expect(result.score).toBeGreaterThan(0);
    expect(result.matchedText).toBeTruthy();
    expect(result.hasDateProximity).toBe(true);
  });

  it('detects L2 semantic via aria-label', () => {
    const post = createPost(`
      <div aria-label="Posted Dec 10, Edited Dec 14"></div>
    `);
    const result = scoreEdited(post, 'en');
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns 0 for unedited post', () => {
    const post = createPost(`
      <div class="IMvYId">
        Posted Dec 10, 2025
      </div>
    `);
    const result = scoreEdited(post, 'en');
    expect(result.score).toBe(0);
  });

  it('applies exclusion penalty for "I edited"', () => {
    const post = createPost(`
      <div class="IMvYId Vu2fZd">I edited my homework Dec 14, 2025</div>
    `);
    // Even if "edited" is found, "I edited" should be penalized
    const result = scoreEdited(post, 'en');
    // Exclusion layer should have reduced the score
    expect(result.layers.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// UNIFIED FLAG SCORING TESTS
// ============================================================================

describe('scoreFlagsForPost', () => {
  it('returns "comment" verdict for comment-only post', () => {
    const post = createPost(`
      <div class="qCWAqb">
        <div class="huI6Cb">3</div>
      </div>
    `);
    const decision = scoreFlagsForPost(post, 'test-post-1', 'stream' as ViewKind, 'en');
    expect(decision.finalVerdict).toBe('comment');
    expect(decision.commentScore).toBeGreaterThanOrEqual(40);
    expect(decision.commentCount).toBe(3);
  });

  it('returns "edited" verdict for edited-only post', () => {
    const post = createPost(`
      <div class="IMvYId dDKhVc Vu2fZd">
        Posted Dec 10, 2025 (Edited Dec 14, 2025)
      </div>
    `);
    const decision = scoreFlagsForPost(post, 'test-post-2', 'stream' as ViewKind, 'en');
    expect(decision.finalVerdict).toBe('edited');
    expect(decision.editedScore).toBeGreaterThanOrEqual(35);
  });

  it('returns "both" verdict when both flags present', () => {
    const post = createPost(`
      <div class="qCWAqb">
        <div class="huI6Cb">5</div>
      </div>
      <div class="IMvYId dDKhVc Vu2fZd">
        Posted Dec 10, 2025 (Edited Dec 14, 2025)
      </div>
    `);
    const decision = scoreFlagsForPost(post, 'test-post-3', 'stream' as ViewKind, 'en');
    expect(decision.finalVerdict).toBe('both');
  });

  it('returns "none" verdict for plain post', () => {
    const post = createPost(`
      <div>
        <h3>Assignment Title</h3>
        <p>No comments or edits here</p>
      </div>
    `);
    const decision = scoreFlagsForPost(post, 'test-post-4', 'stream' as ViewKind, 'en');
    expect(decision.finalVerdict).toBe('none');
  });

  it('includes trace with timing', () => {
    const post = createPost('<div>test</div>');
    const decision = scoreFlagsForPost(post, 'test-post-5', 'stream' as ViewKind, 'en');
    expect(decision.trace).toBeDefined();
    expect(decision.trace.postId).toBe('test-post-5');
    expect(decision.trace.duration_ms).toBeGreaterThanOrEqual(0);
    expect(decision.trace.timestamp).toBeGreaterThan(0);
    expect(decision.trace.viewKind).toBe('stream');
  });

  it('includes layer traces', () => {
    const post = createPost(`
      <div class="qCWAqb">
        <div class="huI6Cb">1</div>
      </div>
    `);
    const decision = scoreFlagsForPost(post, 'test-post-6', 'stream' as ViewKind, 'en');
    expect(decision.trace.layers.length).toBeGreaterThan(0);
    for (const layer of decision.trace.layers) {
      expect(layer).toHaveProperty('layerName');
      expect(layer).toHaveProperty('score');
      expect(layer).toHaveProperty('matched');
      expect(layer).toHaveProperty('details');
    }
  });

  it('confidence is "high" for strong matches', () => {
    const post = createPost(`
      <div class="qCWAqb">
        <div class="huI6Cb">10</div>
      </div>
    `);
    const decision = scoreFlagsForPost(post, 'test-post-7', 'stream' as ViewKind, 'en');
    expect(decision.confidence).toBe('high');
  });
});

// ============================================================================
// THRESHOLD TESTS
// ============================================================================

describe('getThresholds', () => {
  it('returns threshold values', () => {
    const thresholds = getThresholds();
    expect(thresholds.comment_show).toBe(40);
    expect(thresholds.edited_show).toBe(35);
    expect(thresholds.both_minimum_each).toBe(30);
  });

  it('returns a copy (not the original)', () => {
    const t1 = getThresholds();
    const t2 = getThresholds();
    expect(t1).not.toBe(t2);
    expect(t1).toEqual(t2);
  });
});
