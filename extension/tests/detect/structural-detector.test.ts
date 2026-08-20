// filepath: extension/tests/detect/structural-detector.test.ts
/**
 * StructuralDetector — detection with no language signal at all.
 *
 * The defining test in this file is "gives the same answer regardless of the
 * lang hint". If that ever fails, the detector has become language-aware and
 * the whole point of the second engine is gone.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StructuralDetector } from '../../src/detect/structural/structural-detector';
import { ViewKind } from '../../src/engines/types';

function createPost(html: string): HTMLElement {
  const div = document.createElement('div');
  div.setAttribute('data-stream-item-id', 'sd-test');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe('StructuralDetector', () => {
  let detector: StructuralDetector;

  beforeEach(() => {
    document.body.innerHTML = '';
    detector = new StructuralDetector();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('identifies itself as the structural detector', () => {
    expect(detector.name).toBe('structural');
  });

  it('finds a comment count via the DOM-truth container', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">3</div></div>');
    const obs = detector.observe(post, { postId: 'p1', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(3);
    expect(obs.comment.strength).toBe(100);
    expect(obs.comment.source).toBe('dom-truth');
  });

  it('finds an Arabic-numeral comment count with no language hint', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">٥</div></div>');
    const obs = detector.observe(post, { postId: 'p2', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(5);
  });

  it('gives the same answer regardless of the lang hint', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">7</div></div>');
    const asEn = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM, lang: 'en' });
    const asAr = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM, lang: 'ar' });
    const asNone = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM });

    expect(asEn.comment).toEqual(asAr.comment);
    expect(asEn.comment).toEqual(asNone.comment);
    expect(asEn.edited).toEqual(asAr.edited);
  });

  it('reports no comment when the container has no numeral', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">No class comments</div></div>');
    const obs = detector.observe(post, { postId: 'p4', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(false);
    expect(obs.comment.count).toBeNull();
    expect(obs.comment.strength).toBe(0);
  });

  it('is not fooled by the Arabic phrase for "no comments"', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">لا توجد تعليقات</div></div>');
    const obs = detector.observe(post, { postId: 'p5', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(false);
  });

  it('falls back to the seqYL container', () => {
    const post = createPost('<div class="qCWAqb seqYL"><span aria-hidden="true">4</span></div>');
    const obs = detector.observe(post, { postId: 'p6', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(4);
  });

  it('scores a bare seqYL match lower than DOM truth', () => {
    const post = createPost('<div class="seqYL">6</div>');
    const obs = detector.observe(post, { postId: 'p7', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(6);
    expect(obs.comment.strength).toBe(95);
    expect(obs.comment.source).toBe('seqYL');
  });

  it('reports edited as explicitly unavailable, never as merely absent', () => {
    const post = createPost('<div class="meta-row">Edited Mar 10</div>');
    const obs = detector.observe(post, { postId: 'p8', viewKind: ViewKind.STREAM });

    expect(obs.edited.present).toBe(false);
    expect(obs.edited.strength).toBe(0);
    expect(obs.edited.source).toBe('unavailable');
  });

  it('reports edited unavailable even on a post that clearly was edited', () => {
    // The Arabic fixture's meta row. Structurally identical to "Posted ..." —
    // that is exactly why the structural engine cannot answer this.
    const post = createPost('<div class="meta-row">تم التعديل في ١٠ مارس</div>');
    const obs = detector.observe(post, { postId: 'p9', viewKind: ViewKind.STREAM });

    expect(obs.edited.source).toBe('unavailable');
  });

  it('measures its own cost', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">2</div></div>');
    const obs = detector.observe(post, { postId: 'p10', viewKind: ViewKind.STREAM });

    expect(obs.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(obs.elapsedMs)).toBe(true);
  });

  it('emits a well-formed observation for an empty post', () => {
    const post = createPost('<p>plain</p>');
    const obs = detector.observe(post, { postId: 'p11', viewKind: ViewKind.STREAM });

    expect(obs.detector).toBe('structural');
    expect(obs.postId).toBe('p11');
    expect(obs.viewKind).toBe(ViewKind.STREAM);
    expect(obs.comment.present).toBe(false);
    expect(obs.penalties).toEqual([]);
    expect(Array.isArray(obs.debug)).toBe(true);
  });

  it('never emits raw page text outside the debug field', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">8 class comments</div></div>');
    const obs = detector.observe(post, { postId: 'p12', viewKind: ViewKind.STREAM });

    const withoutDebug = JSON.stringify({ ...obs, debug: undefined });
    expect(withoutDebug).not.toContain('class comments');
  });
});
