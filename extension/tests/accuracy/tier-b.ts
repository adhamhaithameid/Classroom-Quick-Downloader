/**
 * TIER B — HTML in, PostObservation[] out, through the real detector.
 * This is the only file in the harness that touches jsdom.
 */
import { KeywordDetector } from '../../src/detect/keyword/keyword-detector';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import type { PostObservation } from '../../src/contracts/detection';
import type { ViewKind } from '../../src/engines/types';

const POST_SELECTOR = '[data-stream-item-id]';

/**
 * Outermost post elements, one per id.
 *
 * Classroom nests elements that repeat the parent's stream-item-id (see
 * tests/fixtures/classroom/stream-flagged-post-en.html). Scoring the nested
 * copies would inflate every number, so only the outermost wins.
 */
export function segmentPosts(root: HTMLElement): HTMLElement[] {
  const seen = new Set<string>();
  const out: HTMLElement[] = [];

  for (const el of Array.from(root.querySelectorAll<HTMLElement>(POST_SELECTOR))) {
    if (el.parentElement?.closest(POST_SELECTOR)) continue;
    const id = el.getAttribute('data-stream-item-id');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(el);
  }
  return out;
}

export function observeHtml(
  html: string,
  viewKind: ViewKind,
  lang: string,
): PostObservation[] {
  clearKeywordCache();
  document.body.innerHTML = html;
  document.documentElement.lang = lang;

  const detector = new KeywordDetector();
  const observations = segmentPosts(document.body).map((post) =>
    detector.observe(post, {
      postId: post.getAttribute('data-stream-item-id')!,
      viewKind,
      lang,
    }),
  );

  document.body.innerHTML = '';
  return observations;
}
