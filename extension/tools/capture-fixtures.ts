// filepath: extension/tools/capture-fixtures.ts
/**
 * ============================================================================
 * DOM FIXTURE CAPTURE — Capture Real Classroom Pages for Regression Testing
 * ============================================================================
 *
 * This script captures a snapshot of the current Google Classroom page's
 * post cards and their flag states. The output is a JSON fixture that can
 * be used in Vitest tests to validate flag detection accuracy.
 *
 * HOW TO USE:
 * 1. Navigate to a Google Classroom page in the browser
 * 2. Open DevTools Console
 * 3. Paste and run this script
 * 4. Copy the JSON output and save it as a .json file in extension/tests/fixtures/
 * 5. Use loadFixture() in tests to load and replay the captured DOM
 *
 * The fixture captures:
 * - Page URL and ViewKind
 * - Each post card's outer HTML (cleaned of dynamic attributes)
 * - Each post's actual flag state (comment badges, edited badges)
 * - Each post's stream-item-id
 * - Timestamp and extension version
 *
 * @author Adham — Phase 0 baseline capture implementation
 * @since v4.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PostFixture {
  /** The data-stream-item-id */
  streamItemId: string;
  /** Cleaned outer HTML of the post card */
  outerHTML: string;
  /** Flag state observed at capture time */
  flags: {
    hasCommentBadge: boolean;
    commentCount: number | null;
    hasEditedBadge: boolean;
    hasBothBadge: boolean;
  };
  /** Text content summary (first 200 chars) */
  textPreview: string;
  /** CSS classes on the card element */
  classList: string[];
  /** Whether the post has CQD styling applied */
  hasCqdStyling: boolean;
}

export interface PageFixture {
  /** Capture metadata */
  meta: {
    url: string;
    timestamp: string;
    extensionVersion: string;
    totalPosts: number;
    capturedBy: 'manual' | 'automated';
  };
  /** All captured post fixtures */
  posts: PostFixture[];
}

// ============================================================================
// CAPTURE FUNCTIONS
// ============================================================================

/**
 * Clean dynamic attributes from HTML to make fixtures stable.
 * Removes jscontroller, jsaction, jsname, data-ved, etc.
 */
function cleanHTML(html: string): string {
  return html
    // Remove jscontroller/jsaction/jsname/jsmodel (obfuscated, change each deploy)
    .replace(/\s+js(?:controller|action|name|model)="[^"]*"/g, '')
    // Remove data-ved (tracking parameter)
    .replace(/\s+data-ved="[^"]*"/g, '')
    // Remove data-sessionlink (tracking)
    .replace(/\s+data-sessionlink="[^"]*"/g, '')
    // Remove tabindex (accessibility helper, not structural)
    .replace(/\s+tabindex="[^"]*"/g, '')
    // Remove CQD's own injected elements
    .replace(/<div class="cqd-[^"]*"[\s\S]*?<\/div>/g, '')
    // Remove CQD data attributes
    .replace(/\s+data-cqd-[^=]*="[^"]*"/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract flag state from a post element by checking for CQD badges.
 */
function extractFlags(post: HTMLElement): PostFixture['flags'] {
  const commentBadge = post.querySelector('.cqd-comment-badge, .cqd-overlay-container.cqd-comment');
  const editedBadge = post.querySelector('.cqd-edited-badge');
  const bothBadge = post.querySelector('.cqd-both-badge');

  let commentCount: number | null = null;
  if (commentBadge) {
    const text = commentBadge.textContent || '';
    const match = text.match(/(\d+)/);
    if (match) commentCount = parseInt(match[1], 10);
  }

  return {
    hasCommentBadge: !!commentBadge || !!bothBadge,
    commentCount,
    hasEditedBadge: !!editedBadge || !!bothBadge,
    hasBothBadge: !!bothBadge,
  };
}

/**
 * Capture all post cards on the current page as a fixture.
 */
export function capturePageFixture(): PageFixture {
  const posts = document.querySelectorAll<HTMLElement>(
    '[data-stream-item-id], .n4xnA',
  );

  const capturedPosts: PostFixture[] = [];
  const seenIds = new Set<string>();

  for (const post of posts) {
    const streamItemId = post.getAttribute('data-stream-item-id');
    // For .n4xnA cards without a direct stream-item-id, find the child's
    const childId = streamItemId ||
      post.querySelector('[data-stream-item-id]')?.getAttribute('data-stream-item-id');

    const id = childId || `anon-${capturedPosts.length}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Skip internal elements
    if (post.hasAttribute('data-role')) continue;
    if (post.getAttribute('jscontroller') === 'h38nBf') continue;

    capturedPosts.push({
      streamItemId: id,
      outerHTML: cleanHTML(post.outerHTML),
      flags: extractFlags(post),
      textPreview: (post.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      classList: Array.from(post.classList),
      hasCqdStyling: post.hasAttribute('data-cqd-processed') || post.hasAttribute('data-cqd-styled'),
    });
  }

  return {
    meta: {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      extensionVersion: '4.0.0-alpha',
      totalPosts: capturedPosts.length,
      capturedBy: 'manual',
    },
    posts: capturedPosts,
  };
}

/**
 * Capture and copy to clipboard (for use in DevTools Console).
 */
export function captureAndCopy(): void {
  const fixture = capturePageFixture();
  const json = JSON.stringify(fixture, null, 2);

  // Try to copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(json).then(() => {
      console.log(
        `%c[CQD Fixture] Captured ${fixture.meta.totalPosts} posts — JSON copied to clipboard!`,
        'color: #4CAF50; font-weight: bold;',
      );
    }).catch(() => {
      console.log(json);
      console.log(
        `%c[CQD Fixture] Captured ${fixture.meta.totalPosts} posts — copy the JSON above`,
        'color: #FF9800; font-weight: bold;',
      );
    });
  } else {
    console.log(json);
  }
}

// ============================================================================
// TEST HELPER — Load fixture into JSDOM for testing
// ============================================================================

/**
 * Load a fixture's posts into the document for testing.
 * Used in Vitest tests to replay captured DOM.
 *
 * @param fixture - The PageFixture to load
 * @returns Array of post elements created in the document
 */
export function loadFixtureIntoDom(fixture: PageFixture): HTMLElement[] {
  const container = document.createElement('div');
  container.id = 'cqd-fixture-container';
  const elements: HTMLElement[] = [];

  for (const post of fixture.posts) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = post.outerHTML;
    const el = wrapper.firstElementChild as HTMLElement;
    if (el) {
      container.appendChild(el);
      elements.push(el);
    }
  }

  document.body.appendChild(container);
  return elements;
}
