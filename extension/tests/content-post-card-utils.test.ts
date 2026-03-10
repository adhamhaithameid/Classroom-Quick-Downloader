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

    it('returns false for nested elements under a valid post card', () => {
      const parent = document.createElement('div');
      parent.setAttribute('data-stream-item-id', '123456');
      const child = document.createElement('div');
      child.setAttribute('data-stream-item-id', '123456');
      parent.appendChild(child);
      document.body.appendChild(parent);

      expect(isActualPostCard(child)).toBe(false);
      expect(isActualPostCard(parent)).toBe(true);
    });

    it('returns true for small elements (no height filtering)', () => {
      // We intentionally do NOT filter by height anymore.
      // The offsetHeight < 80 check caused regressions with lazy-rendered posts.
      const small = document.createElement('div');
      small.setAttribute('data-stream-item-id', '123456');
      Object.defineProperty(small, 'offsetHeight', { value: 30 });
      document.body.appendChild(small);

      expect(isActualPostCard(small)).toBe(true);
    });

    it('returns true for elements with zero offsetHeight (not rendered yet)', () => {
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

    it('allows nested element when parent is an ignored internal element', () => {
      // When the parent with data-stream-item-id is a data-role or menu controller,
      // the child should NOT be filtered by the nesting check.
      const parent = document.createElement('div');
      parent.setAttribute('data-stream-item-id', '123456');
      parent.setAttribute('data-role', 'student');
      const child = document.createElement('div');
      child.setAttribute('data-stream-item-id', '789');
      parent.appendChild(child);
      document.body.appendChild(parent);

      // Parent is ignored (data-role), so child nesting check should pass
      expect(isActualPostCard(child)).toBe(true);
    });
  });

  // ========================================================================
  // queryPostCards()
  // ========================================================================

  describe('queryPostCards', () => {
    it('returns only real post card elements', () => {
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
      const el1 = document.createElement('div');
      el1.setAttribute('data-stream-item-id', '999');
      Object.defineProperty(el1, 'offsetHeight', { value: 300 });

      const el2 = document.createElement('div');
      el2.setAttribute('data-stream-item-id', '999');
      Object.defineProperty(el2, 'offsetHeight', { value: 200 });

      document.body.appendChild(el1);
      document.body.appendChild(el2);

      const result = queryPostCards();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(el1);
    });

    it('returns empty array when no post cards exist', () => {
      document.body.innerHTML = '<div>No posts here</div>';
      expect(queryPostCards()).toHaveLength(0);
    });

    it('does not return wrapper when all descendants are ignored internal elements', () => {
      /*
       * <div class="n4xnA JUr7jb">
       *   <div data-role="student" data-stream-item-id="846995674251">
       *   <div jscontroller="h38nBf" data-stream-item-id="846995674251">
       *
       * Both are ignored → .n4xnA fallback should NOT promote this wrapper.
       */
      const wrapper = document.createElement('div');
      wrapper.className = 'n4xnA JUr7jb';
      Object.defineProperty(wrapper, 'offsetHeight', { value: 220 });

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

      const result = queryPostCards();
      expect(result).toHaveLength(0);
    });

    it('promotes a wrapper card when a compact material controller has the stream id', () => {
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

    it('promotes .n4xnA wrapper when bottom controller has stream id', () => {
      /*
       * Real post where only a bottom controller div has the stream id:
       * <div class="n4xnA JUr7jb">
       *   <div jscontroller="dk8rTb" data-stream-item-id="844739525372" data-type="2">
       */
      const wrapper = document.createElement('div');
      wrapper.className = 'n4xnA JUr7jb';
      Object.defineProperty(wrapper, 'offsetHeight', { value: 200 });

      const bottomController = document.createElement('div');
      bottomController.setAttribute('data-stream-item-id', '844739525372');
      bottomController.setAttribute('jscontroller', 'dk8rTb');
      bottomController.setAttribute('data-type', '2');
      Object.defineProperty(bottomController, 'offsetHeight', { value: 0 });

      wrapper.appendChild(bottomController);
      document.body.appendChild(wrapper);

      const result = queryPostCards();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(wrapper);
    });

    it('does not promote a nested .n4xnA wrapper inside an already-detected post card', () => {
      const outerCard = document.createElement('div');
      outerCard.setAttribute('data-stream-item-id', 'outer-1');
      outerCard.className = 'n4xnA JUr7jb';
      Object.defineProperty(outerCard, 'offsetHeight', { value: 260 });

      const nestedWrapper = document.createElement('div');
      nestedWrapper.className = 'n4xnA';
      Object.defineProperty(nestedWrapper, 'offsetHeight', { value: 180 });

      const nestedController = document.createElement('div');
      nestedController.setAttribute('data-stream-item-id', 'inner-1');
      nestedController.setAttribute('data-material-parent-id', 'parent-1');
      nestedController.setAttribute('jscontroller', 'yP6Lwf');
      Object.defineProperty(nestedController, 'offsetHeight', { value: 36 });

      nestedWrapper.appendChild(nestedController);
      outerCard.appendChild(nestedWrapper);
      document.body.appendChild(outerCard);

      const result = queryPostCards();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(outerCard);
    });
  });
});
