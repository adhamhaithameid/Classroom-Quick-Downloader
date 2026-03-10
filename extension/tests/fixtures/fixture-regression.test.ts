import { beforeEach, describe, expect, it } from 'vitest';
import type { PageFixture } from '../../tools/capture-fixtures';
import { loadFixtureIntoDom } from '../../tools/capture-fixtures';
import { queryPostCards, isActualPostCard } from '../../entrypoints/content/post-card-utils';
import exampleFixture from '../fixtures/example-stream-fixture.json';

/**
 * FIXTURE-BASED REGRESSION TESTS
 *
 * These tests use captured DOM fixtures from real Google Classroom pages
 * to validate that post detection and flag identification continues to
 * work correctly across code changes.
 *
 * To add more fixtures:
 * 1. Navigate to a Google Classroom page
 * 2. Open DevTools → Console
 * 3. Run captureAndCopy() from capture-fixtures.ts
 * 4. Save the JSON to tests/fixtures/
 * 5. Import and add tests below
 *
 * @since v4.0.0
 */

describe('fixture-based regression tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('example stream fixture', () => {
    it('detects all posts from the stream fixture', () => {
      const fixture = exampleFixture as PageFixture;
      const elements = loadFixtureIntoDom(fixture);

      expect(elements).toHaveLength(fixture.meta.totalPosts);

      // Every loaded element should be recognized as a valid post card
      for (const el of elements) {
        expect(isActualPostCard(el)).toBe(true);
      }
    });

    it('queryPostCards finds all fixture posts', () => {
      const fixture = exampleFixture as PageFixture;
      loadFixtureIntoDom(fixture);

      const found = queryPostCards();
      // Should find at least the posts with data-stream-item-id
      expect(found.length).toBeGreaterThanOrEqual(fixture.posts.length);
    });

    it('preserves stream-item-ids from fixture', () => {
      const fixture = exampleFixture as PageFixture;
      const elements = loadFixtureIntoDom(fixture);

      for (let i = 0; i < elements.length; i++) {
        const expectedId = fixture.posts[i].streamItemId;
        const actualId = elements[i].getAttribute('data-stream-item-id') ||
          elements[i].querySelector('[data-stream-item-id]')?.getAttribute('data-stream-item-id');
        expect(actualId).toBe(expectedId);
      }
    });

    it('identifies edited post from fixture', () => {
      const fixture = exampleFixture as PageFixture;
      const elements = loadFixtureIntoDom(fixture);

      // The first post in the fixture has "(Edited Feb 14)" in its text
      const editedPost = fixture.posts.find((p) => p.flags.hasEditedBadge);
      expect(editedPost).toBeDefined();

      if (editedPost) {
        const el = elements.find((e) =>
          e.getAttribute('data-stream-item-id') === editedPost.streamItemId ||
          e.querySelector(`[data-stream-item-id="${editedPost.streamItemId}"]`),
        );
        expect(el).toBeDefined();

        // The text should contain "Edited"
        const text = el!.textContent || '';
        expect(text).toContain('Edited');
      }
    });

    it('identifies post with comments from fixture', () => {
      const fixture = exampleFixture as PageFixture;
      const elements = loadFixtureIntoDom(fixture);

      // The second post has 3 class comments
      const commentPost = fixture.posts.find((p) => p.flags.hasCommentBadge);
      expect(commentPost).toBeDefined();
      expect(commentPost!.flags.commentCount).toBe(3);

      if (commentPost) {
        const el = elements.find((e) =>
          e.getAttribute('data-stream-item-id') === commentPost.streamItemId ||
          e.querySelector(`[data-stream-item-id="${commentPost.streamItemId}"]`),
        );
        expect(el).toBeDefined();

        // The text should contain "comment"
        const text = (el!.textContent || '').toLowerCase();
        expect(text).toContain('comment');
      }
    });
  });
});
