import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { observeHtml, segmentPosts } from './tier-b';
import { decideObservations } from './tier-a';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import { ViewKind } from '../../src/engines/types';

const HTML = `
<article data-stream-item-id="post-a">
  <div class="IMvYId Vu2fZd">Edited Mar 10</div>
  <div class="qCWAqb"><div class="huI6Cb">5</div></div>
  <section data-stream-item-id="post-a"><span>nested duplicate</span></section>
</article>
<article data-stream-item-id="post-b"><p>plain post</p></article>`;

describe('tier B runner', () => {
  beforeEach(() => {
    clearKeywordCache();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('segments outermost posts only, deduped by id', () => {
    document.body.innerHTML = HTML;
    expect(segmentPosts(document.body).map((el) => el.getAttribute('data-stream-item-id')))
      .toEqual(['post-a', 'post-b']);
  });

  it('produces one observation per post', () => {
    const observations = observeHtml(HTML, ViewKind.STREAM, 'en');
    expect(observations.map((o) => o.postId)).toEqual(['post-a', 'post-b']);
    expect(observations[0]!.comment.count).toBe(5);
  });
});

describe('tier A runner', () => {
  it('turns observations into predictions via the real decide layer', () => {
    const observations = observeHtml(HTML, ViewKind.STREAM, 'en');
    const predicted = decideObservations(observations);

    const a = predicted.find((p) => p.postId === 'post-a')!;
    expect(a.commentPresent).toBe(true);
    expect(a.commentCount).toBe(5);
    expect(a.editedPresent).toBe(true);

    const b = predicted.find((p) => p.postId === 'post-b')!;
    expect(b.commentPresent).toBe(false);
    expect(b.editedPresent).toBe(false);
  });
});
