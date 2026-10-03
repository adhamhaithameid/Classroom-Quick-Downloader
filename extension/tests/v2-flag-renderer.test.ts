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
  applyFlagToggle,
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

    const badge = post.querySelector('[data-cqd-v2-flag="badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains('cqd-comment-badge')).toBe(true);
    expect(badge!.classList.contains('cqd-flag')).toBe(true);
  });

  it('creates an edited badge for "edited" verdict', () => {
    const post = createPost();
    const decision = makeDecision({
      finalVerdict: 'edited',
      editedScore: 50,
    });

    renderFlagBadge(decision, post);

    const badge = post.querySelector('.cqd-edited-badge');
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

    const badge = post.querySelector('.cqd-both-badge');
    expect(badge).not.toBeNull();
    // Combined pill: comment + plus + edit sections (V1 both-badge structure)
    expect(badge!.querySelectorAll('.cqd-both-section')).toHaveLength(2);
    expect(badge!.querySelector('.cqd-both-plus')).not.toBeNull();
    expect(post.querySelectorAll('.cqd-overlay-container')).toHaveLength(1);
  });

  it('does not create badge for "none" verdict', () => {
    const post = createPost();
    const decision = makeDecision({ finalVerdict: 'none' });

    renderFlagBadge(decision, post);

    const badge = post.querySelector('[data-cqd-v2-flag="badge"]');
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

    const badges = post.querySelectorAll('[data-cqd-v2-flag="badge"]');
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
    expect(post.querySelector('.cqd-comment-badge')).not.toBeNull();

    // Then: edited badge (replaces comment)
    renderFlagBadge(makeDecision({
      finalVerdict: 'edited',
      editedScore: 50,
    }), post);
    expect(post.querySelector('.cqd-comment-badge')).toBeNull();
    expect(post.querySelector('.cqd-edited-badge')).not.toBeNull();
  });

  it('removes badge when verdict becomes "none"', () => {
    const post = createPost();

    // Create badge
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.querySelector('[data-cqd-v2-flag="badge"]')).not.toBeNull();

    // Remove via "none" verdict
    renderFlagBadge(makeDecision({ finalVerdict: 'none' }), post);
    expect(post.querySelector('[data-cqd-v2-flag="badge"]')).toBeNull();
  });

  it('sets data attributes on post', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 2,
    }), post);

    // z57 S4: the marker + rendered kind live on the badge element itself,
    // not the post (the classes are now the shared V1 contract).
    const badge = post.querySelector('[data-cqd-v2-flag="badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute('data-cqd-flag-kind')).toBe('comment');
    expect(badge!.getAttribute('data-cqd-comment-count')).toBe('2');
  });

  it('adds the overlay frame for edited and both verdicts', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'edited',
      editedScore: 50,
    }), post);
    expect(post.querySelector('.cqd-overlay-container.cqd-edited')).not.toBeNull();

    const post2 = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'both',
      commentScore: 80,
      editedScore: 50,
      commentCount: 2,
    }), post2);
    expect(post2.querySelector('.cqd-overlay-container.cqd-both')).not.toBeNull();
  });

  it('badge has tooltip and aria-label', () => {
    const post = createPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 5,
    }), post);

    const badge = post.querySelector('[data-cqd-v2-flag="badge"]') as HTMLElement;
    expect(badge.title).toContain('comment');
    expect(badge.getAttribute('aria-label')).toBeTruthy();
  });
});

// ============================================================================
// TEST SUITE: post anchoring (bug 2.4 — highlight must track the changed post)
// ============================================================================

describe('post anchoring (bug 2.4)', () => {
  // Classroom post cards are position:static. Flag artifacts are
  // position:absolute, so on a static card they resolve against the nearest
  // POSITIONED ancestor — the page/stream container — making the highlight
  // ring span the whole classroom. V1 parity: the card must get inline
  // position:relative before any flag artifact is appended.

  function createStaticPost(): HTMLElement {
    // Real Classroom cards carry no inline position (unlike createPost()).
    const div = document.createElement('div');
    div.setAttribute('data-stream-item-id', `post-${Date.now()}`);
    document.body.appendChild(div);
    return div;
  }

  it('sets inline position:relative on a static card when a flag artifact renders', () => {
    const post = createStaticPost();
    expect(post.style.position).toBe('');

    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);

    expect(post.style.position).toBe('relative');
    expect(getComputedStyle(post).position).toBe('relative');
  });

  it('anchors the overlay to the card (card is positioned while the overlay exists)', () => {
    // jsdom has no layout engine (offsetParent is always null), so the
    // browser-side proof "overlay.offsetParent === card" reduces here to its
    // DOM precondition: the card must be non-static while the overlay exists.
    const post = createStaticPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'both',
      commentScore: 80,
      editedScore: 50,
      commentCount: 2,
    }), post);

    expect(post.querySelector('.cqd-overlay-container')).not.toBeNull();
    expect(getComputedStyle(post).position).not.toBe('static');
  });

  it('does not overwrite an already-positioned card (inline absolute stays)', () => {
    const post = createStaticPost();
    post.style.position = 'absolute';

    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);

    expect(post.style.position).toBe('absolute');
  });

  it('does not overwrite a card positioned by stylesheet rules', () => {
    const style = document.createElement('style');
    style.textContent = '#cqd-styled-card { position: absolute; }';
    document.head.appendChild(style);

    const post = createStaticPost();
    post.id = 'cqd-styled-card';

    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);

    // No inline override was added; the stylesheet rule still wins.
    expect(post.style.position).toBe('');
    expect(getComputedStyle(post).position).toBe('absolute');

    style.remove();
  });

  it('clears the added inline position when the verdict becomes "none"', () => {
    const post = createStaticPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.style.position).toBe('relative');

    renderFlagBadge(makeDecision({ finalVerdict: 'none' }), post);

    expect(post.style.position).toBe('');
  });

  it('clears the added inline position via removeStaleBadges', () => {
    const post = createStaticPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'edited',
      editedScore: 50,
    }), post);
    expect(post.style.position).toBe('relative');

    removeStaleBadges(post);

    expect(post.style.position).toBe('');
  });

  it('clears the added inline position when a live toggle disables all flags', () => {
    const post = createStaticPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'both',
      commentScore: 80,
      editedScore: 50,
      commentCount: 2,
    }), post);
    expect(post.style.position).toBe('relative');

    applyFlagToggle('commentsFlagEnabled', false);
    expect(post.style.position).toBe('relative'); // edited half still renders
    applyFlagToggle('editedFlagEnabled', false);
    expect(post.style.position).toBe('');

    // Leave toggles enabled for other tests.
    applyFlagToggle('commentsFlagEnabled', true);
    applyFlagToggle('editedFlagEnabled', true);
  });

  it('keeps author-supplied positioning untouched on removal (restores only what we added)', () => {
    const post = createStaticPost();
    post.style.position = 'absolute';

    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.style.position).toBe('absolute');

    removeStaleBadges(post);

    expect(post.style.position).toBe('absolute');
  });

  it('restores the added inline position on engine destroy (removeAllV2Badges)', () => {
    // destroy() runs on every SPA navigation — the walk up to anchored hosts
    // must resolve BEFORE the artifacts are detached from the DOM.
    const post = createStaticPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.style.position).toBe('relative');

    removeAllV2Badges();

    expect(document.querySelectorAll('[data-cqd-v2-flag]')).toHaveLength(0);
    expect(post.style.position).toBe('');
  });

  it('clears anchoring bookkeeping on destroy so a fresh render re-anchors from scratch', () => {
    // 'both' renders two artifacts per card (overlay + pill) — both must
    // resolve to the same host pre-detach, and the card must be deletable
    // from anchoredPosts so the next render anchors it again.
    const post = createStaticPost();
    renderFlagBadge(makeDecision({
      finalVerdict: 'both',
      commentScore: 80,
      editedScore: 50,
      commentCount: 2,
    }), post);
    expect(post.querySelectorAll('[data-cqd-v2-flag]')).toHaveLength(2);
    expect(post.style.position).toBe('relative');

    removeAllV2Badges();
    expect(post.style.position).toBe('');

    // Stale bookkeeping would make ensurePostAnchored early-return here and
    // leave the card static under the new artifacts.
    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 1,
    }), post);
    expect(post.style.position).toBe('relative');

    removeAllV2Badges();
    expect(post.style.position).toBe('');
  });

  it('engine destroy leaves author-supplied positioning untouched', () => {
    const post = createStaticPost();
    post.style.position = 'absolute';

    renderFlagBadge(makeDecision({
      finalVerdict: 'comment',
      commentScore: 80,
      commentCount: 3,
    }), post);
    expect(post.style.position).toBe('absolute');

    removeAllV2Badges();

    expect(post.style.position).toBe('absolute');
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

    expect(post.querySelector('[data-cqd-v2-flag]')).toBeNull();
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
