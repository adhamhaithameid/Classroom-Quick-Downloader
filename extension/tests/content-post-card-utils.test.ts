import { beforeEach, describe, expect, it } from 'vitest';
import { isActualPostCard, queryPostCards } from '../entrypoints/content/post-card-utils';

/**
 * POST CARD UTILS — Test Suite
 *
 * Tests the filtering logic that prevents overlays from being attached
 * to internal Google Classroom elements (three-dots menu, role indicators).
 *
 * Fixtures use real Classroom DOM patterns extracted from production pages.
 */

describe('post-card-utils', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ========================================================================
  // isActualPostCard()
  // ========================================================================

  describe('isActualPostCard', () => {
    it('returns true for a top-level post card element', () => {
      const card = document.createElement('div');
      card.setAttribute('data-stream-item-id', '123456');
      Object.defineProperty(card, 'offsetHeight', { value: 300 });
      document.body.appendChild(card);

      expect(isActualPostCard(card)).toBe(true);
    });

    it('returns false for elements with data-role attribute', () => {
      const roleEl = document.createElement('div');
      roleEl.setAttribute('data-stream-item-id', '123456');
      roleEl.setAttribute('data-role', 'student');
      Object.defineProperty(roleEl, 'offsetHeight', { value: 40 });
      document.body.appendChild(roleEl);

      expect(isActualPostCard(roleEl)).toBe(false);
    });

    it('returns false for known internal menu controller elements', () => {
      const menuEl = document.createElement('div');
      menuEl.setAttribute('data-stream-item-id', '123456');
      menuEl.setAttribute('jscontroller', 'h38nBf');
      Object.defineProperty(menuEl, 'offsetHeight', { value: 120 });
      document.body.appendChild(menuEl);

      expect(isActualPostCard(menuEl)).toBe(false);
    });

    it('returns false for nested [data-stream-item-id] elements', () => {
      const parent = document.createElement('div');
      parent.setAttribute('data-stream-item-id', '123456');
      const child = document.createElement('div');
      child.setAttribute('data-stream-item-id', '123456');
      parent.appendChild(child);
      document.body.appendChild(parent);

      expect(isActualPostCard(child)).toBe(false);
      expect(isActualPostCard(parent)).toBe(true);
    });

    it('returns false for very small elements (< 80px height)', () => {
      const small = document.createElement('div');
      small.setAttribute('data-stream-item-id', '123456');
      Object.defineProperty(small, 'offsetHeight', { value: 30 });
      document.body.appendChild(small);

      expect(isActualPostCard(small)).toBe(false);
    });

    it('returns true for elements with zero offsetHeight (not rendered yet)', () => {
      // Before the element is rendered, offsetHeight is 0
      // We should NOT filter these out — they may become valid after render
      const unrendered = document.createElement('div');
      unrendered.setAttribute('data-stream-item-id', '123456');
      Object.defineProperty(unrendered, 'offsetHeight', { value: 0 });
      document.body.appendChild(unrendered);

      expect(isActualPostCard(unrendered)).toBe(true);
    });

    it('returns true for classwork tab li elements', () => {
      const li = document.createElement('li');
      li.setAttribute('data-stream-item-id', '999');
      Object.defineProperty(li, 'offsetHeight', { value: 150 });
      document.body.appendChild(li);

      expect(isActualPostCard(li)).toBe(true);
    });
  });

  // ========================================================================
  // queryPostCards()
  // ========================================================================

  describe('queryPostCards', () => {
    it('returns only real post card elements', () => {
      // Create a realistic Classroom DOM structure
      const stream = document.createElement('div');

      // Post 1 — the real card
      const card1 = document.createElement('div');
      card1.setAttribute('data-stream-item-id', '111');
      card1.className = 'n4xnA JUr7jb';
      Object.defineProperty(card1, 'offsetHeight', { value: 300 });

      // Internal: data-role element (should be filtered)
      const roleDiv = document.createElement('div');
      roleDiv.setAttribute('data-stream-item-id', '111');
      roleDiv.setAttribute('data-role', 'student');
      Object.defineProperty(roleDiv, 'offsetHeight', { value: 24 });
      card1.appendChild(roleDiv);

      // Post 2 — another real card
      const card2 = document.createElement('div');
      card2.setAttribute('data-stream-item-id', '222');
      Object.defineProperty(card2, 'offsetHeight', { value: 250 });

      stream.appendChild(card1);
      stream.appendChild(card2);
      document.body.appendChild(stream);

      const result = queryPostCards();

      expect(result).toHaveLength(2);
      expect(result[0]).toBe(card1);
      expect(result[1]).toBe(card2);
    });

    it('deduplicates elements by data-stream-item-id', () => {
      // Multiple top-level elements with the same ID (shouldn't happen but defensive)
      const el1 = document.createElement('div');
      el1.setAttribute('data-stream-item-id', '999');
      Object.defineProperty(el1, 'offsetHeight', { value: 300 });

      const el2 = document.createElement('div');
      el2.setAttribute('data-stream-item-id', '999');
      Object.defineProperty(el2, 'offsetHeight', { value: 200 });

      document.body.appendChild(el1);
      document.body.appendChild(el2);

      const result = queryPostCards();
      // Should only return the first one
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(el1);
    });

    it('returns empty array when no post cards exist', () => {
      document.body.innerHTML = '<div>No posts here</div>';
      expect(queryPostCards()).toHaveLength(0);
    });

    it('handles the three-dots menu container correctly (real DOM pattern)', () => {
      /*
       * Real Classroom DOM pattern (material posts):
       * <div class="n4xnA JUr7jb">               (NO data-stream-item-id)
       *   <div data-role="student" data-stream-item-id="846995674251">  (filtered: has data-role)
       *   <div jscontroller="h38nBf" data-stream-item-id="846995674251"> (filtered: too small)
       *
       * Neither internal element should be returned.
       * The .n4xnA wrapper has no data-stream-item-id so it's invisible to queryPostCards().
       */
      const wrapper = document.createElement('div');
      wrapper.className = 'n4xnA JUr7jb';

      const headerRole = document.createElement('div');
      headerRole.setAttribute('data-stream-item-id', '846995674251');
      headerRole.setAttribute('data-role', 'student');
      Object.defineProperty(headerRole, 'offsetHeight', { value: 24 });

      const threeDots = document.createElement('div');
      threeDots.setAttribute('data-stream-item-id', '846995674251');
      threeDots.setAttribute('jscontroller', 'h38nBf');
      Object.defineProperty(threeDots, 'offsetHeight', { value: 36 });

      wrapper.appendChild(headerRole);
      wrapper.appendChild(threeDots);
      document.body.appendChild(wrapper);

      // Neither internal element should be returned — no ancestor walk
      const result = queryPostCards();
      expect(result).toHaveLength(0);
    });

    it('promotes a wrapper card when only a compact material controller has the stream id', () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'n4xnA JUr7jb';
      Object.defineProperty(wrapper, 'offsetHeight', { value: 220 });

      const materialController = document.createElement('div');
      materialController.setAttribute('data-stream-item-id', 'mat-1');
      materialController.setAttribute('data-material-parent-id', 'parent-1');
      materialController.setAttribute('jscontroller', 'yP6Lwf');
      Object.defineProperty(materialController, 'offsetHeight', { value: 36 });

      wrapper.appendChild(materialController);
      document.body.appendChild(wrapper);

      const result = queryPostCards();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(wrapper);
    });
  });
});
