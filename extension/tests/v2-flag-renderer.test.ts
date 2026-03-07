// filepath: extension/tests/v2-flag-renderer.test.ts
/**
 * Tests for the V2 Flag Renderer.
 *
 * Tests badge injection, idempotency, verdict-based rendering,
 * stale cleanup, and dark mode detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderFlagBadge,
  removeStaleBadges,
  removeAllV2Badges,
} from '../src/v2/render/flag-renderer';
import {
  injectFlagStyles,
  removeFlagStyles,
  areFlagStylesInjected,
} from '../src/v2/render/flag-styles';
import type { FlagDecision, DecisionTrace, ViewKind } from '../src/engines/types';

// ============================================================================
// HELPERS
// ============================================================================

function makeDecision(overrides: Partial<FlagDecision> = {}): FlagDecision {
  const defaultTrace: DecisionTrace = {
    postId: overrides.postId || 'test-post',
    timestamp: Date.now(),
    viewKind: 'stream' as ViewKind,
    layers: [],
    exclusions: [],
    finalScore: 0,
    duration_ms: 1,
  };

  return {
    postId: 'test-post',
    commentScore: 0,
    editedScore: 0,
    commentCount: null,
    editedDiff: null,
    exclusionPenalties: [],
    finalVerdict: 'none',
    confidence: 'low',
    trace: defaultTrace,
    ...overrides,
  };
}

function createPost(): HTMLElement {
  const div = document.createElement('div');
  div.setAttribute('data-stream-item-id', `post-${Date.now()}`);
  div.style.position = 'relative';
  document.body.appendChild(div);
  return div;
}

function cleanupDOM(): void {
  document.body.innerHTML = '';
  removeFlagStyles();
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  cleanupDOM();
});

afterEach(() => {
  cleanupDOM();
});

// ============================================================================
// TEST SUITE: renderFlagBadge
// ============================================================================

describe('renderFlagBadge', () => {
  it('creates a comment badge for "comment" verdict', () => {
    const post = createPost();
    const decision = makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 5,
    });

    renderFlagBadge(decision, post);

    const badge = post.querySelector('.cqd-v2-flag');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('cqd-v2-flag-comment')).toBe(true);
  });

  it('creates an edited badge for "edited" verdict', () => {
    const post = createPost();
    const decision = makeDecision({
      finalVerdict: 'edited',
      editedScore: 50,
    });

    renderFlagBadge(decision, post);

    const badge = post.querySelector('.cqd-v2-flag-edited');
    expect(badge).not.toBeNull();
  });

  it('creates a both badge for "both" verdict', () => {
    const post = createPost();
    const decision = makeDecision({
      finalVerdict: 'both',
      commentScore: 80,
      editedScore: 50,
      commentCount: 3,
    });

    renderFlagBadge(decision, post);

    const badge = post.querySelector('.cqd-v2-flag-both');
    expect(badge).not.toBeNull();
    // Both badge should have separator
    const separator = badge!.querySelector('.cqd-v2-flag-separator');
    expect(separator).not.toBeNull();
  });

  it('does not create badge for "none" verdict', () => {
    const post = createPost();
    const decision = makeDecision({ finalVerdict: 'none' });

    renderFlagBadge(decision, post);

    const badge = post.querySelector('.cqd-v2-flag');
    expect(badge).toBeNull();
  });

  it('is idempotent — same verdict does not duplicate badges', () => {
    const post = createPost();
    const decision = makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    });

    renderFlagBadge(decision, post);
    renderFlagBadge(decision, post);

    const badges = post.querySelectorAll('.cqd-v2-flag');
    expect(badges.length).toBe(1);
  });

  it('updates badge when verdict changes', () => {
    const post = createPost();

    // First: comment badge
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.querySelector('.cqd-v2-flag-comment')).not.toBeNull();

    // Then: edited badge (replaces comment)
    renderFlagBadge(makeDecision({
      finalVerdict: 'edited',
      editedScore: 50,
    }), post);
    expect(post.querySelector('.cqd-v2-flag-comment')).toBeNull();
    expect(post.querySelector('.cqd-v2-flag-edited')).not.toBeNull();
  });

  it('removes badge when verdict becomes "none"', () => {
    const post = createPost();

    // Create badge
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.querySelector('.cqd-v2-flag')).not.toBeNull();

    // Remove via "none" verdict
    renderFlagBadge(makeDecision({ finalVerdict: 'none' }), post);
    expect(post.querySelector('.cqd-v2-flag')).toBeNull();
  });

  it('sets data attributes on post', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 2,
    }), post);

    expect(post.hasAttribute('data-cqd-v2-flag')).toBe(true);
    expect(post.getAttribute('data-cqd-v2-flag-verdict')).toBe('comment');
  });

  it('adds overlay border', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 2,
    }), post);

    const overlay = post.querySelector('.cqd-v2-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay!.classList.contains('cqd-v2-flag-border-comment')).toBe(true);
  });

  it('badge has tooltip and aria-label', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 5,
    }), post);

    const badge = post.querySelector('.cqd-v2-flag') as HTMLElement;
    expect(badge.title).toContain('comment');
    expect(badge.getAttribute('aria-label')).toBeTruthy();
  });
});

// ============================================================================
// TEST SUITE: removeStaleBadges
// ============================================================================

describe('removeStaleBadges', () => {
  it('removes badge from a post', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);

    removeStaleBadges(post);

    expect(post.querySelector('.cqd-v2-flag')).toBeNull();
    expect(post.querySelector('.cqd-v2-overlay')).toBeNull();
    expect(post.hasAttribute('data-cqd-v2-flag')).toBe(false);
  });

  it('is safe to call on post without badge', () => {
    const post = createPost();
    expect(() => removeStaleBadges(post)).not.toThrow();
  });
});

// ============================================================================
// TEST SUITE: removeAllV2Badges
// ============================================================================

describe('removeAllV2Badges', () => {
  it('removes all badges from document', () => {
    const post1 = createPost();
    const post2 = createPost();

    renderFlagBadge(makeDecision({ finalVerdict: 'comment', commentScore: 80, commentCount: 1 }), post1);
    renderFlagBadge(makeDecision({ finalVerdict: 'edited', editedScore: 50 }), post2);

    removeAllV2Badges();

    expect(document.querySelectorAll('.cqd-v2-flag').length).toBe(0);
    expect(document.querySelectorAll('.cqd-v2-overlay').length).toBe(0);
  });
});

// ============================================================================
// TEST SUITE: Flag Styles
// ============================================================================

describe('Flag Styles', () => {
  it('injectFlagStyles injects style element', () => {
    injectFlagStyles();
    const style = document.getElementById('cqd-v2-flag-styles');
    expect(style).not.toBeNull();
    expect(areFlagStylesInjected()).toBe(true);
  });

  it('injectFlagStyles is idempotent', () => {
    injectFlagStyles();
    injectFlagStyles();
    const styles = document.querySelectorAll('#cqd-v2-flag-styles');
    expect(styles.length).toBe(1);
  });

  it('removeFlagStyles removes style element', () => {
    injectFlagStyles();
    removeFlagStyles();
    expect(document.getElementById('cqd-v2-flag-styles')).toBeNull();
    expect(areFlagStylesInjected()).toBe(false);
  });
});
