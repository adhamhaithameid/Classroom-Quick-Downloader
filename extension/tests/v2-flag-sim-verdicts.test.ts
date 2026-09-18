// filepath: extension/tests/v2-flag-sim-verdicts.test.ts
/**
 * z57 STAGE 4 — v2 flag verdicts on the simulator's DOM (qa-03 fixtures).
 *
 * qa-03 pins four verdict outcomes on the simulator's structural fixtures:
 * comments=5 → a comment badge carrying the count, edited → an edited badge,
 * both → ONE overlay container, clean → nothing. This suite runs the REAL
 * v2 scoring pipeline (keywordDetector → decideFlags) against the simulator's
 * exact markup (tests/simulator/pages/builder.ts) so v2-mode verdict parity
 * is pinned without a browser.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { scoreFlagsForPost } from '../src/v2/decision/flag-scoring';
import { ViewKind } from '../src/engines/types';

const STREAM = 'stream' as ViewKind;

function simPost(opts: { comments?: number; edited?: boolean; id?: string }): HTMLElement {
  const id = opts.id ?? 'flag-post';
  const commentsChip = opts.comments
    ? `\n    <div class="qCWAqb"><div class="huI6Cb">${opts.comments}</div></div>`
    : '';
  const commentShell = opts.comments
    ? `\n    <section class="n4xnA comment-shell">\n      <div data-stream-item-id="${id}" jscontroller="h38nBf"></div>\n      <div class="comment-count">${opts.comments} class comments</div>\n    </section>`
    : '';
  const editedRow = opts.edited ? `\n      <div class="meta-row">Edited Mar 10</div>` : '';
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <article class="n4xnA JUr7jb" data-stream-item-id="${id}">
      <header class="IMvYId">
        <div class="author-row">Test Teacher</div>${editedRow}
      </header>
      <div class="asQXV QRiHXd">
        <p>Post body.</p>
      </div>
      <div class="attachments">
        <div class="luto0c" data-attachment-id="a1">
          <a aria-label="Attachment: reading.pdf" href="https://drive.google.com/file/d/FID123/view?usp=classroom_web">reading.pdf</a>
        </div>
      </div>${commentsChip}${commentShell}
    </article>`;
  const post = wrap.querySelector('article')!;
  document.body.appendChild(wrap);
  return post as HTMLElement;
}

describe('v2 flag verdicts on the simulator DOM (qa-03 fixtures)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('comments=5 produces a comment verdict carrying the count 5', () => {
    const post = simPost({ comments: 5, id: 'flag-comments' });
    const decision = scoreFlagsForPost(post, 'flag-comments', STREAM);
    expect(['comment', 'both']).toContain(decision.finalVerdict);
    expect(decision.commentCount).toBe(5);
  });

  it('edited produces an edited verdict', () => {
    const post = simPost({ edited: true, id: 'flag-edited' });
    const decision = scoreFlagsForPost(post, 'flag-edited', STREAM);
    expect(['edited', 'both']).toContain(decision.finalVerdict);
  });

  it('comments+edited produces the both verdict', () => {
    const post = simPost({ comments: 2, edited: true, id: 'flag-both' });
    const decision = scoreFlagsForPost(post, 'flag-both', STREAM);
    expect(decision.finalVerdict).toBe('both');
  });

  it('a clean post produces the none verdict', () => {
    const post = simPost({ id: 'flag-clean' });
    const decision = scoreFlagsForPost(post, 'flag-clean', STREAM);
    expect(decision.finalVerdict).toBe('none');
  });
});
