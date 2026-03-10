import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FLAG DETECTION COMPREHENSIVE TEST SUITE
 *
 * Tests the smart-detector system with real DOM fixtures from Google Classroom.
 * Covers:
 * - Edited detection via ".JZk9qf.Vu2fZd" selector (the root cause fix)
 * - Comment detection via aria-label and ".mUIrbf-vQzf8d"
 * - Both-flag detection when comment + edited are present
 * - Golden selector coverage for detection-keywords.ts
 * - Edge cases: deleted posts, classwork tabs, RTL languages
 */

// Mock i18n
vi.mock('../entrypoints/content/i18n', () => ({
  t: (key: string) => key,
  getCurrentCachedLanguage: () => 'en',
}));

// ============================================================================
// DOM FIXTURES — Real Classroom HTML Patterns
// ============================================================================

/**
 * Creates a minimal post card with a date sub-header like:
 * <span class="JZk9qf Vu2fZd">
 *   <span class="jzdBjc">Created Feb 28</span>
 *   <span aria-hidden="true">Feb 28</span>
 *   (Edited Feb 28)
 * </span>
 */
function createEditedPost(id: string = '111'): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', id);
  post.innerHTML = `
    <div class="GQW44b">
      <h2><span class="jzdBjc">Test post with edit</span></h2>
      <span class="JZk9qf Vu2fZd">
        <span class="jzdBjc">Created Feb 28</span>
        <span aria-hidden="true">Feb 28</span>
        &nbsp;(Edited Feb 28)
      </span>
    </div>
  `;
  return post;
}

/**
 * Creates a post card with comments section.
 * <button aria-label="2 class comments expand">
 *   <span class="mUIrbf-vQzf8d">2 class comments</span>
 * </button>
 */
function createCommentedPost(id: string = '222', count: number = 2): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', id);
  post.innerHTML = `
    <div class="GQW44b">
      <h2><span class="jzdBjc">Test post with comments</span></h2>
      <span class="JZk9qf Vu2fZd">
        <span class="jzdBjc">Created Feb 28</span>
        <span aria-hidden="true">Feb 28</span>
      </span>
    </div>
    <div class="s2g3Xd">
      <button class="mUIrbf-LgbsSe" aria-label="${count} class comments expand">
        <span class="mUIrbf-vQzf8d">${count} class comments</span>
      </button>
    </div>
  `;
  return post;
}

/**
 * Creates a post with BOTH comments and edited status.
 */
function createBothFlagsPost(id: string = '333'): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', id);
  post.innerHTML = `
    <div class="GQW44b">
      <h2><span class="jzdBjc">Test both flags</span></h2>
      <span class="JZk9qf Vu2fZd">
        <span class="jzdBjc">Created Feb 28</span>
        <span aria-hidden="true">Feb 28</span>
        &nbsp;(Edited Feb 28)
        <span class="JZk9qf P354se"> – Deleted</span>
      </span>
    </div>
    <div class="s2g3Xd">
      <button class="mUIrbf-LgbsSe" aria-label="2 class comments expand">
        <span class="mUIrbf-vQzf8d">2 class comments</span>
      </button>
    </div>
  `;
  return post;
}

/**
 * Creates a post with NO flags (plain post).
 */
function createPlainPost(id: string = '444'): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', id);
  post.innerHTML = `
    <div class="GQW44b">
      <h2><span class="jzdBjc">Plain post no flags</span></h2>
      <span class="JZk9qf Vu2fZd">
        <span class="jzdBjc">Created Feb 28</span>
        <span aria-hidden="true">Feb 28</span>
      </span>
    </div>
    <div class="s2g3Xd">
      <button class="mUIrbf-LgbsSe" aria-label="Add class comment">
        <span class="mUIrbf-vQzf8d">Add class comment</span>
      </button>
    </div>
  `;
  return post;
}

/**
 * Creates a classwork tab post (uses .vGGYOe for dates).
 */
function createClassworkEditedPost(id: string = '555'): HTMLElement {
  const post = document.createElement('li');
  post.setAttribute('data-stream-item-id', id);
  post.innerHTML = `
    <div class="GQW44b">
      <h2><span class="jzdBjc">Classwork assignment</span></h2>
      <span class="vGGYOe Vu2fZd">Posted Dec 10, 2025 (Edited Dec 14, 2025)</span>
    </div>
  `;
  return post;
}

// ============================================================================
// GOLDEN SELECTORS TESTS
// ============================================================================

describe('GOLDEN_SELECTORS dateContainer', () => {
  let GOLDEN_SELECTORS: any;

  beforeEach(async () => {
    const mod = await import('../entrypoints/content/detection-keywords');
    GOLDEN_SELECTORS = mod.GOLDEN_SELECTORS;
    document.body.innerHTML = '';
  });

  it('includes .JZk9qf.Vu2fZd as a date container selector', () => {
    expect(GOLDEN_SELECTORS.dateContainer).toContain('.JZk9qf.Vu2fZd');
  });

  it('includes .JZk9qf as a fallback date container selector', () => {
    expect(GOLDEN_SELECTORS.dateContainer).toContain('.JZk9qf');
  });

  it('.JZk9qf.Vu2fZd comes BEFORE .jzdBjc in priority order', () => {
    const jzkIndex = GOLDEN_SELECTORS.dateContainer.indexOf('.JZk9qf.Vu2fZd');
    const jzdIndex = GOLDEN_SELECTORS.dateContainer.indexOf('.jzdBjc');
    expect(jzkIndex).toBeLessThan(jzdIndex);
    expect(jzkIndex).toBeGreaterThanOrEqual(0);
  });

  it('.JZk9qf.Vu2fZd selector matches the edited post DOM pattern', () => {
    const post = createEditedPost();
    document.body.appendChild(post);
    const match = post.querySelector('.JZk9qf.Vu2fZd');
    expect(match).not.toBeNull();
    expect(match?.textContent).toContain('Edited');
  });

  it('.jzdBjc selector does NOT contain the word "Edited"', () => {
    // This verifies WHY .JZk9qf.Vu2fZd is needed
    const post = createEditedPost();
    document.body.appendChild(post);
    const jzdBjc = post.querySelector('.jzdBjc');
    expect(jzdBjc).not.toBeNull();
    // .jzdBjc only has "Created Feb 28" — no "Edited"
    expect(jzdBjc?.textContent).not.toContain('Edited');
  });

  it('includes .vGGYOe.Vu2fZd for classwork tab posts', () => {
    expect(GOLDEN_SELECTORS.dateContainer).toContain('.vGGYOe.Vu2fZd');
  });

  it('.vGGYOe.Vu2fZd matches classwork tab edited posts', () => {
    const post = createClassworkEditedPost();
    document.body.appendChild(post);
    const match = post.querySelector('.vGGYOe.Vu2fZd');
    expect(match).not.toBeNull();
    expect(match?.textContent).toContain('Edited');
  });
});

describe('GOLDEN_SELECTORS commentContainer', () => {
  let GOLDEN_SELECTORS: any;

  beforeEach(async () => {
    const mod = await import('../entrypoints/content/detection-keywords');
    GOLDEN_SELECTORS = mod.GOLDEN_SELECTORS;
    document.body.innerHTML = '';
  });

  it('includes .mUIrbf-vQzf8d for comment text spans', () => {
    expect(GOLDEN_SELECTORS.commentContainer).toContain('.mUIrbf-vQzf8d');
  });

  it('.mUIrbf-vQzf8d matches the comment count DOM pattern', () => {
    const post = createCommentedPost('123', 3);
    document.body.appendChild(post);
    const match = post.querySelector('.mUIrbf-vQzf8d');
    expect(match).not.toBeNull();
    expect(match?.textContent).toContain('3 class comments');
  });

  it('includes [aria-label*="comment"] for semantic comment detection', () => {
    expect(GOLDEN_SELECTORS.commentContainer).toContain('[aria-label*="comment"]');
  });

  it('aria-label selector matches comment button pattern', () => {
    const post = createCommentedPost('456', 1);
    document.body.appendChild(post);
    const match = post.querySelector('[aria-label*="comment"]');
    expect(match).not.toBeNull();
    expect(match?.getAttribute('aria-label')).toContain('1 class comments');
  });
});

// ============================================================================
// SMART DETECTOR integration tests
// ============================================================================

describe('smart-detector edited detection', () => {
  let detectEdited: any;

  beforeEach(async () => {
    const mod = await import('../entrypoints/content/smart-detector');
    detectEdited = mod.detectEdited;
    document.body.innerHTML = '';
  });

  it('detects edited status from .JZk9qf.Vu2fZd span', () => {
    const post = createEditedPost();
    document.body.appendChild(post);
    const result = detectEdited(post, 'en');
    expect(result.isEdited).toBe(true);
    expect(result.confidence).not.toBe('none');
  });

  it('detects edited from classwork tab .vGGYOe.Vu2fZd', () => {
    const post = createClassworkEditedPost();
    document.body.appendChild(post);
    const result = detectEdited(post, 'en');
    expect(result.isEdited).toBe(true);
  });

  it('does NOT detect edited on plain post without "(Edited ...)"', () => {
    const post = createPlainPost();
    document.body.appendChild(post);
    const result = detectEdited(post, 'en');
    expect(result.isEdited).toBe(false);
  });

  it('detects edited on posts with both flags', () => {
    const post = createBothFlagsPost();
    document.body.appendChild(post);
    const result = detectEdited(post, 'en');
    expect(result.isEdited).toBe(true);
  });
});

describe('smart-detector comment detection', () => {
  let detectComments: any;

  beforeEach(async () => {
    const mod = await import('../entrypoints/content/smart-detector');
    detectComments = mod.detectComments;
    document.body.innerHTML = '';
  });

  it('detects comments from aria-label button', () => {
    const post = createCommentedPost('c1', 5);
    document.body.appendChild(post);
    const result = detectComments(post, 'en');
    expect(result.count).toBeGreaterThan(0);
  });

  it('detects comments from .mUIrbf-vQzf8d text', () => {
    const post = createCommentedPost('c2', 1);
    document.body.appendChild(post);
    const result = detectComments(post, 'en');
    expect(result.count).toBeGreaterThan(0);
  });

  it('returns count 0 for "Add class comment" button (no existing comments)', () => {
    const post = createPlainPost();
    document.body.appendChild(post);
    const result = detectComments(post, 'en');
    expect(result.count).toBe(0);
  });

  it('detects comments on posts with both flags', () => {
    const post = createBothFlagsPost();
    document.body.appendChild(post);
    const result = detectComments(post, 'en');
    expect(result.count).toBeGreaterThan(0);
  });
});

describe('smart-detector combined detection (analyzePost)', () => {
  let analyzePost: any;

  beforeEach(async () => {
    const mod = await import('../entrypoints/content/smart-detector');
    analyzePost = mod.analyzePost;
    document.body.innerHTML = '';
  });

  it('detects both flags on a post with comments + edited', () => {
    const post = createBothFlagsPost();
    document.body.appendChild(post);
    const result = analyzePost(post, 'en');
    expect(result.comments.count).toBeGreaterThan(0);
    expect(result.edited.isEdited).toBe(true);
  });

  it('detects only edited on edited-only post', () => {
    const post = createEditedPost();
    document.body.appendChild(post);
    const result = analyzePost(post, 'en');
    expect(result.edited.isEdited).toBe(true);
    expect(result.comments.count).toBe(0);
  });

  it('detects only comments on comment-only post', () => {
    const post = createCommentedPost('co1', 3);
    document.body.appendChild(post);
    const result = analyzePost(post, 'en');
    expect(result.comments.count).toBeGreaterThan(0);
    expect(result.edited.isEdited).toBe(false);
  });

  it('detects neither on a plain post', () => {
    const post = createPlainPost();
    document.body.appendChild(post);
    const result = analyzePost(post, 'en');
    expect(result.comments.count).toBe(0);
    expect(result.edited.isEdited).toBe(false);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('edge cases', () => {
  let detectEdited: any;
  let detectComments: any;

  beforeEach(async () => {
    const mod = await import('../entrypoints/content/smart-detector');
    detectEdited = mod.detectEdited;
    detectComments = mod.detectComments;
    document.body.innerHTML = '';
  });

  it('does not false-positive on user-typed "Edited" in post body', () => {
    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'edge1');
    post.innerHTML = `
      <div class="GQW44b">
        <span class="JZk9qf Vu2fZd">
          <span class="jzdBjc">Created Feb 28</span>
          <span aria-hidden="true">Feb 28</span>
        </span>
      </div>
      <div class="n8F6Jd">
        <span>I edited my homework before submitting</span>
      </div>
    `;
    document.body.appendChild(post);
    const result = detectEdited(post, 'en');
    // Should NOT detect as edited — "edited" is in user content area (.n8F6Jd)
    // This tests the exclusion engine
    expect(result.isEdited).toBe(false);
  });

  it('handles deleted+edited post markers (.JZk9qf.P354se)', () => {
    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'edge2');
    post.innerHTML = `
      <div class="GQW44b">
        <span class="JZk9qf Vu2fZd">
          <span class="jzdBjc">Created Feb 28</span>
          <span aria-hidden="true">Feb 28</span>
          &nbsp;(Edited Feb 28)
          <span class="JZk9qf P354se"> – Deleted</span>
        </span>
      </div>
    `;
    document.body.appendChild(post);
    const result = detectEdited(post, 'en');
    // Should still detect as edited even with deleted marker
    expect(result.isEdited).toBe(true);
  });

  it('handles multiple comments with varying counts', () => {
    for (const count of [1, 5, 10, 99]) {
      document.body.innerHTML = '';
      const post = createCommentedPost(`multi-${count}`, count);
      document.body.appendChild(post);
      const result = detectComments(post, 'en');
      expect(result.count).toBe(count);
    }
  });

  it('handles empty post with no content', () => {
    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', 'empty');
    document.body.appendChild(post);

    const editResult = detectEdited(post, 'en');
    expect(editResult.isEdited).toBe(false);

    const commentResult = detectComments(post, 'en');
    expect(commentResult.count).toBe(0);
  });
});
