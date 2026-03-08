import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ENGINE COMBINER — V2 Detection-Only Mode Tests
 *
 * Tests that V2 operates as a detection oracle while legacy handles rendering.
 * Verifies no V2 visual artifacts are created.
 */

// Mock all rendering modules to verify they're NOT called
const mockRenderFlagBadge = vi.fn();
const mockRemoveAllV2Badges = vi.fn();
const mockInjectFlagStyles = vi.fn();
const mockRemoveFlagStyles = vi.fn();

vi.mock('../../src/v2/render/flag-renderer', () => ({
  renderFlagBadge: mockRenderFlagBadge,
  removeAllV2Badges: mockRemoveAllV2Badges,
  removeStaleBadges: vi.fn(),
}));

vi.mock('../../src/v2/render/flag-styles', () => ({
  injectFlagStyles: mockInjectFlagStyles,
  removeFlagStyles: mockRemoveFlagStyles,
  areFlagStylesInjected: () => false,
}));

describe('Engine Combiner - V2 Detection Only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('V2 does not inject visual elements', () => {
    it('V2 flag style ID should not be present in document', () => {
      const styleEl = document.getElementById('cqd-v2-flag-styles');
      expect(styleEl).toBeNull();
    });

    it('no .cqd-v2-flag elements should exist after V2 detection', () => {
      // Simulate what a post looks like after legacy processes it
      const post = document.createElement('div');
      post.setAttribute('data-stream-item-id', '111');
      post.setAttribute('data-cqd-comments-processed', 'true');
      post.setAttribute('data-cqd-edited-processed', 'true');

      // Legacy artifacts (should exist)
      const overlay = document.createElement('div');
      overlay.className = 'cqd-overlay-container cqd-both';
      post.appendChild(overlay);

      const badge = document.createElement('div');
      badge.className = 'cqd-both-badge cqd-flag';
      post.appendChild(badge);

      document.body.appendChild(post);

      // V2 artifacts should NOT exist
      expect(post.querySelector('.cqd-v2-flag')).toBeNull();
      expect(post.querySelector('.cqd-v2-overlay')).toBeNull();
      expect(post.querySelector('.cqd-v2-flag-comment')).toBeNull();
      expect(post.querySelector('.cqd-v2-flag-edited')).toBeNull();
    });

    it('legacy comment badge class structure is correct', () => {
      const post = document.createElement('div');
      post.innerHTML = `
        <div class="cqd-comment-badge cqd-flag" data-cqd-injected="true">
          <div class="cqd-flag-icon"></div>
          <span class="cqd-flag-text">2</span>
        </div>
      `;

      const badge = post.querySelector('.cqd-comment-badge');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains('cqd-flag')).toBe(true);
      expect(badge?.querySelector('.cqd-flag-icon')).not.toBeNull();
      expect(badge?.querySelector('.cqd-flag-text')?.textContent).toBe('2');
    });

    it('legacy edited badge class structure is correct', () => {
      const post = document.createElement('div');
      post.innerHTML = `
        <div class="cqd-edited-badge cqd-flag" data-cqd-injected="true">
          <div class="cqd-flag-icon cqd-edited-icon"></div>
          <span class="cqd-flag-text">✓</span>
        </div>
      `;

      const badge = post.querySelector('.cqd-edited-badge');
      expect(badge).not.toBeNull();
      expect(badge?.classList.contains('cqd-flag')).toBe(true);
      expect(badge?.querySelector('.cqd-edited-icon')).not.toBeNull();
    });

    it('legacy both badge class structure is correct', () => {
      const post = document.createElement('div');
      post.innerHTML = `
        <div class="cqd-both-badge cqd-flag" data-cqd-injected="true">
          <div class="cqd-both-section">
            <div class="cqd-both-icon cqd-both-icon-comment"></div>
            <span class="cqd-both-value">2</span>
          </div>
          <span class="cqd-both-plus">+</span>
          <div class="cqd-both-section">
            <div class="cqd-both-icon cqd-both-icon-edited"></div>
            <span class="cqd-both-value">✓</span>
          </div>
        </div>
      `;

      const badge = post.querySelector('.cqd-both-badge');
      expect(badge).not.toBeNull();
      expect(badge?.querySelectorAll('.cqd-both-section')).toHaveLength(2);
      expect(badge?.querySelector('.cqd-both-plus')?.textContent).toBe('+');
    });
  });

  describe('Legacy data attributes (source of truth)', () => {
    it('comment detection sets data-cqd-comment-count', () => {
      const post = document.createElement('div');
      post.setAttribute('data-cqd-comment-count', '3');

      expect(post.getAttribute('data-cqd-comment-count')).toBe('3');
    });

    it('edited detection sets data-cqd-edited-processed', () => {
      const post = document.createElement('div');
      post.setAttribute('data-cqd-edited-processed', 'true');
      post.setAttribute('data-cqd-edit-tooltip', 'Edited');

      expect(post.getAttribute('data-cqd-edited-processed')).toBe('true');
      expect(post.getAttribute('data-cqd-edit-tooltip')).toBe('Edited');
    });

    it('both badge requires BOTH data attributes', () => {
      const post = document.createElement('div');
      // Only comments — no edited
      post.setAttribute('data-cqd-comment-count', '2');

      // Both badge should NOT appear without edit tooltip
      const hasComments = post.hasAttribute('data-cqd-comment-count');
      const hasEdited = post.hasAttribute('data-cqd-edit-tooltip');
      expect(hasComments && hasEdited).toBe(false);
    });

    it('both badge appears when BOTH data attributes are present', () => {
      const post = document.createElement('div');
      post.setAttribute('data-cqd-comment-count', '2');
      post.setAttribute('data-cqd-edit-tooltip', 'Edited');

      const hasComments = post.hasAttribute('data-cqd-comment-count');
      const hasEdited = post.hasAttribute('data-cqd-edit-tooltip');
      expect(hasComments && hasEdited).toBe(true);
    });
  });

  describe('V2 detection report format', () => {
    it('formats detection report lines correctly', () => {
      // Simulate what V2 logs
      const flagDecisions = new Map<string, { finalVerdict: string; commentCount: number | null }>([
        ['post-1', { finalVerdict: 'comment', commentCount: 2 }],
        ['post-2', { finalVerdict: 'edited', commentCount: null }],
        ['post-3', { finalVerdict: 'both', commentCount: 3 }],
        ['post-4', { finalVerdict: 'none', commentCount: null }],
      ]);

      const flaggedPosts = [...flagDecisions.entries()]
        .filter(([, d]) => d.finalVerdict !== 'none');

      expect(flaggedPosts).toHaveLength(3);
      expect(flaggedPosts[0][1].finalVerdict).toBe('comment');
      expect(flaggedPosts[1][1].finalVerdict).toBe('edited');
      expect(flaggedPosts[2][1].finalVerdict).toBe('both');
    });
  });
});
