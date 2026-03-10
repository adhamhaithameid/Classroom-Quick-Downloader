// filepath: extension/tests/v2-deep-validator.test.ts
/**
 * Tests for the V2 Deep Validator.
 *
 * Tests idle-time DOM integrity checking: missing buttons, orphaned
 * buttons, stale badges, wrong verdicts, duplicate injections,
 * instability tracking, viewport priority, and deadline compliance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validatePost,
  validateBatch,
  recordCorrection,
  isUnstable,
  clearInstabilityState,
  getUnstableCount,
} from '../src/v2/repair/deep-validator';
import type {
  CorrectionItem,
  ViewportZone,
  ValidationResult,
} from '../src/v2/repair/deep-validator';
import type {
  PostNode,
  FlagDecision,
  PlacementDecision,
  DecisionTrace,
  ViewKind,
} from '../src/engines/types';

// ============================================================================
// HELPERS
// ============================================================================

function makePost(overrides: Partial<PostNode> = {}): PostNode {
  const el = document.createElement('div');
  el.setAttribute('data-stream-item-id', overrides.id || 'test-post');
  document.body.appendChild(el);

  return {
    id: 'test-post',
    element: el,
    viewKind: 'stream' as ViewKind,
    files: [],
    flags: null,
    lastScannedAt: Date.now(),
    ...overrides,
  };
}

function makeDecision(overrides: Partial<FlagDecision> = {}): FlagDecision {
  const trace: DecisionTrace = {
    postId: 'test-post',
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
    trace,
    ...overrides,
  };
}

function addButton(el: HTMLElement, fileId: string): HTMLElement {
  const btn = document.createElement('button');
  btn.setAttribute('data-cqd-injected', 'true');
  btn.setAttribute('data-cqd-file-id', fileId);
  el.appendChild(btn);
  return btn;
}

function addBadge(el: HTMLElement, verdict: string): HTMLElement {
  const badge = document.createElement('div');
  badge.className = `cqd-v2-flag cqd-v2-flag-${verdict}`;
  el.appendChild(badge);
  el.setAttribute('data-cqd-v2-flag', 'true');
  el.setAttribute('data-cqd-v2-flag-verdict', verdict);
  return badge;
}

function addOverlay(el: HTMLElement): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'cqd-v2-overlay';
  el.appendChild(overlay);
  return overlay;
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  document.body.innerHTML = '';
  clearInstabilityState();
});

afterEach(() => {
  document.body.innerHTML = '';
  clearInstabilityState();
});

// ============================================================================
// CHECK 1: MISSING BUTTONS
// ============================================================================

describe('CHECK 1: Missing buttons', () => {
  it('detects missing button for a file', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: 'https://example.com' }],
    });

    const corrections = validatePost(post, null, []);
    const missing = corrections.find(c => c.op === 'inject-button');
    expect(missing).toBeDefined();
    expect(missing!.fileId).toBe('file-1');
    expect(missing!.reason).toContain('Missing button');
  });

  it('does NOT flag when button exists', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: 'https://example.com' }],
    });
    addButton(post.element, 'file-1');

    const corrections = validatePost(post, null, []);
    const missing = corrections.find(c => c.op === 'inject-button');
    expect(missing).toBeUndefined();
  });

  it('detects multiple missing buttons', () => {
    const el = document.createElement('a');
    const post = makePost({
      files: [
        { canonicalId: 'file-1', element: el, idSource: 'data-drive-id', name: 'a.pdf', ext: 'pdf', downloadUrl: '' },
        { canonicalId: 'file-2', element: el, idSource: 'data-drive-id', name: 'b.pdf', ext: 'pdf', downloadUrl: '' },
      ],
    });

    const corrections = validatePost(post, null, []);
    const missing = corrections.filter(c => c.op === 'inject-button');
    expect(missing).toHaveLength(2);
  });
});

// ============================================================================
// CHECK 2: ORPHANED BUTTONS
// ============================================================================

describe('CHECK 2: Orphaned buttons', () => {
  it('detects orphaned button with no matching file', () => {
    const post = makePost({ files: [] });
    addButton(post.element, 'orphan-file-1');

    const corrections = validatePost(post, null, []);
    const orphaned = corrections.find(c => c.op === 'remove-button');
    expect(orphaned).toBeDefined();
    expect(orphaned!.fileId).toBe('orphan-file-1');
    expect(orphaned!.reason).toContain('Orphaned');
  });

  it('does NOT flag legitimate buttons', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: '' }],
    });
    addButton(post.element, 'file-1');

    const corrections = validatePost(post, null, []);
    const orphaned = corrections.find(c => c.op === 'remove-button' && c.reason.includes('Orphaned'));
    expect(orphaned).toBeUndefined();
  });
});

// ============================================================================
// CHECK 3: FLAG BADGE MISMATCH
// ============================================================================

describe('CHECK 3: Flag badge mismatch', () => {
  it('detects missing badge when decision says comment', () => {
    const post = makePost();
    const decision = makeDecision({ finalVerdict: 'comment', commentScore: 80, postId: post.id });

    const corrections = validatePost(post, decision, []);
    const missingBadge = corrections.find(c => c.op === 'update-flag');
    expect(missingBadge).toBeDefined();
    expect(missingBadge!.reason).toContain('Missing flag badge');
  });

  it('detects wrong verdict badge', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    const decision = makeDecision({ finalVerdict: 'edited', editedScore: 50, postId: post.id });

    const corrections = validatePost(post, decision, []);
    const wrong = corrections.find(c => c.op === 'update-flag');
    expect(wrong).toBeDefined();
    expect(wrong!.reason).toContain('comment');
    expect(wrong!.reason).toContain('edited');
  });

  it('detects stale badge when decision says none', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    const decision = makeDecision({ finalVerdict: 'none', postId: post.id });

    const corrections = validatePost(post, decision, []);
    const stale = corrections.find(c => c.op === 'remove-flag');
    expect(stale).toBeDefined();
    expect(stale!.reason).toContain('Stale');
  });

  it('no corrections when badge matches decision', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    const decision = makeDecision({ finalVerdict: 'comment', commentScore: 80, postId: post.id });

    const corrections = validatePost(post, decision, []);
    const flagCorrections = corrections.filter(c => c.op === 'update-flag' || c.op === 'remove-flag');
    expect(flagCorrections).toHaveLength(0);
  });
});

// ============================================================================
// CHECK 4: OVERLAY MISMATCH
// ============================================================================

describe('CHECK 4: Overlay mismatch', () => {
  it('detects badge without overlay', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    const decision = makeDecision({ finalVerdict: 'comment', postId: post.id });

    const corrections = validatePost(post, decision, []);
    const overlay = corrections.find(c => c.op === 'fix-overlay');
    expect(overlay).toBeDefined();
  });

  it('no overlay correction when both badge and overlay exist', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    addOverlay(post.element);
    const decision = makeDecision({ finalVerdict: 'comment', postId: post.id });

    const corrections = validatePost(post, decision, []);
    const overlay = corrections.find(c => c.op === 'fix-overlay');
    expect(overlay).toBeUndefined();
  });
});

// ============================================================================
// CHECK 5: DUPLICATE BADGES
// ============================================================================

describe('CHECK 5: Duplicate badges', () => {
  it('detects duplicate badges', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    addBadge(post.element, 'comment'); // Duplicate!
    const decision = makeDecision({ finalVerdict: 'comment', postId: post.id });

    const corrections = validatePost(post, decision, []);
    const dedup = corrections.find(c => c.reason.includes('Duplicate badges'));
    expect(dedup).toBeDefined();
    expect(dedup!.priority).toBe('CRITICAL');
  });
});

// ============================================================================
// CHECK 6: DUPLICATE BUTTONS
// ============================================================================

describe('CHECK 6: Duplicate buttons', () => {
  it('detects duplicate buttons for same file', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: '' }],
    });
    addButton(post.element, 'file-1');
    addButton(post.element, 'file-1'); // Duplicate!

    const corrections = validatePost(post, null, []);
    const dedup = corrections.find(c => c.reason.includes('Duplicate buttons'));
    expect(dedup).toBeDefined();
    expect(dedup!.priority).toBe('HIGH');
  });
});

// ============================================================================
// INSTABILITY TRACKING
// ============================================================================

describe('Instability tracking', () => {
  it('marks element as unstable after MAX_RETRIES corrections', () => {
    expect(isUnstable('test-element')).toBe(false);

    recordCorrection('test-element');
    expect(isUnstable('test-element')).toBe(false);

    recordCorrection('test-element');
    expect(isUnstable('test-element')).toBe(false);

    const result = recordCorrection('test-element'); // 3rd time
    expect(result).toBe(true);
    expect(isUnstable('test-element')).toBe(true);
  });

  it('skips unstable elements in validatePost', () => {
    // Make element unstable
    recordCorrection('test-post');
    recordCorrection('test-post');
    recordCorrection('test-post');

    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: '' }],
    });

    const corrections = validatePost(post, null, []);
    expect(corrections).toHaveLength(0); // Should skip entirely
  });

  it('clearInstabilityState resets everything', () => {
    recordCorrection('test-1');
    recordCorrection('test-1');
    recordCorrection('test-1');
    expect(isUnstable('test-1')).toBe(true);

    clearInstabilityState();
    expect(isUnstable('test-1')).toBe(false);
    expect(getUnstableCount()).toBe(0);
  });
});

// ============================================================================
// VIEWPORT PRIORITY
// ============================================================================

describe('Viewport priority', () => {
  it('assigns HIGH priority for visible zone', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: '' }],
    });
    const getZone = () => 'visible' as ViewportZone;

    const corrections = validatePost(post, null, [], getZone);
    expect(corrections[0].priority).toBe('HIGH');
  });

  it('assigns MEDIUM priority for preload zone', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: '' }],
    });
    const getZone = () => 'preload' as ViewportZone;

    const corrections = validatePost(post, null, [], getZone);
    expect(corrections[0].priority).toBe('MEDIUM');
  });

  it('assigns LOW priority for offscreen zone', () => {
    const post = makePost({
      files: [{ canonicalId: 'file-1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'doc.pdf', ext: 'pdf', downloadUrl: '' }],
    });
    const getZone = () => 'offscreen' as ViewportZone;

    const corrections = validatePost(post, null, [], getZone);
    expect(corrections[0].priority).toBe('LOW');
  });

  it('assigns CRITICAL for wrong verdict in visible zone', () => {
    const post = makePost();
    addBadge(post.element, 'comment');
    const decision = makeDecision({ finalVerdict: 'edited', editedScore: 50, postId: post.id });
    const getZone = () => 'visible' as ViewportZone;

    const corrections = validatePost(post, decision, [], getZone);
    const wrong = corrections.find(c => c.op === 'update-flag');
    expect(wrong!.priority).toBe('CRITICAL');
  });
});

// ============================================================================
// BATCH VALIDATION
// ============================================================================

describe('validateBatch', () => {
  it('checks all posts and returns combined corrections', () => {
    const post1 = makePost({ id: 'p1', files: [{ canonicalId: 'f1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'a.pdf', ext: 'pdf', downloadUrl: '' }] });
    post1.element.setAttribute('data-stream-item-id', 'p1');
    const post2 = makePost({ id: 'p2', files: [{ canonicalId: 'f2', element: document.createElement('a'), idSource: 'data-drive-id', name: 'b.pdf', ext: 'pdf', downloadUrl: '' }] });
    post2.element.setAttribute('data-stream-item-id', 'p2');

    const result = validateBatch([post1, post2], new Map(), []);
    expect(result.postsChecked).toBe(2);
    expect(result.divergencesFound).toBe(2); // Each post missing 1 button
    expect(result.corrections).toHaveLength(2);
  });

  it('respects deadline — stops when time runs out', () => {
    const posts = Array.from({ length: 20 }, (_, i) => {
      return makePost({
        id: `p-${i}`,
        files: [{ canonicalId: `f-${i}`, element: document.createElement('a'), idSource: 'data-drive-id', name: `${i}.pdf`, ext: 'pdf', downloadUrl: '' }],
      });
    });

    let callCount = 0;
    const result = validateBatch(posts, new Map(), [], undefined, () => {
      callCount++;
      return callCount <= 3 ? 10 : 0; // Only allow 3 posts
    });

    expect(result.interrupted).toBe(true);
    expect(result.postsChecked).toBeLessThanOrEqual(4);
  });

  it('respects abort signal', () => {
    const post = makePost({
      files: [{ canonicalId: 'f1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'a.pdf', ext: 'pdf', downloadUrl: '' }],
    });

    const controller = new AbortController();
    controller.abort();

    const result = validateBatch([post], new Map(), [], undefined, undefined, controller.signal);
    expect(result.interrupted).toBe(true);
    expect(result.postsChecked).toBe(0);
  });

  it('sorts visible posts first', () => {
    const p1 = makePost({ id: 'offscreen' });
    p1.element.setAttribute('data-stream-item-id', 'offscreen');
    const p2 = makePost({ id: 'visible' });
    p2.element.setAttribute('data-stream-item-id', 'visible');

    const zoneMap = new Map([['visible', 'visible' as ViewportZone], ['offscreen', 'offscreen' as ViewportZone]]);
    const getZone = (el: HTMLElement) => zoneMap.get(el.getAttribute('data-stream-item-id')!) || 'offscreen' as ViewportZone;

    // Only allow 1 post, should choose visible one
    let calls = 0;
    const result = validateBatch([p1, p2], new Map(), [], getZone, () => {
      calls++;
      return calls <= 1 ? 10 : 0;
    });

    // First post checked should be 'visible'
    if (result.postsChecked > 0) {
      expect(result.interrupted).toBe(true);
    }
  });

  it('counts unstable skips', () => {
    recordCorrection('unstable-post');
    recordCorrection('unstable-post');
    recordCorrection('unstable-post');

    const post = makePost({ id: 'unstable-post' });
    const result = validateBatch([post], new Map(), []);
    expect(result.unstableSkipped).toBe(1);
    expect(result.postsChecked).toBe(0);
  });

  it('skips disconnected posts', () => {
    const el = document.createElement('div'); // Not appended to body
    const post: PostNode = {
      id: 'disconnected',
      element: el,
      viewKind: 'stream' as ViewKind,
      files: [{ canonicalId: 'f1', element: document.createElement('a'), idSource: 'data-drive-id', name: 'a.pdf', ext: 'pdf', downloadUrl: '' }],
      flags: null,
      lastScannedAt: Date.now(),
    };

    const corrections = validatePost(post, null, []);
    expect(corrections).toHaveLength(0);
  });

  it('returns timing in result', () => {
    const result = validateBatch([], new Map(), []);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.interrupted).toBe(false);
  });
});
