// filepath: extension/tests/detect/keyword-detector.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KeywordDetector } from '../../src/detect/keyword/keyword-detector';
import { clearKeywordCache } from '../../src/v2/decision/keyword-loader';
import { ViewKind } from '../../src/engines/types';

function createPost(html: string): HTMLElement {
  const div = document.createElement('div');
  div.setAttribute('data-stream-item-id', 'kd-test');
  div.innerHTML = html;
  document.body.appendChild(div);
  return div;
}

describe('KeywordDetector', () => {
  let detector: KeywordDetector;

  beforeEach(() => {
    clearKeywordCache();
    document.body.innerHTML = '';
    detector = new KeywordDetector();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('identifies itself as the keyword detector', () => {
    expect(detector.name).toBe('keyword');
  });

  it('observes a commented post', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">5</div></div>');
    const obs = detector.observe(post, { postId: 'p1', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.detector).toBe('keyword');
    expect(obs.postId).toBe('p1');
    expect(obs.comment.present).toBe(true);
    expect(obs.comment.count).toBe(5);
    expect(obs.comment.strength).toBeGreaterThan(0);
  });

  it('observes an edited post', () => {
    const post = createPost('<div class="IMvYId Vu2fZd">Edited Mar 10</div>');
    const obs = detector.observe(post, { postId: 'p2', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.edited.present).toBe(true);
    expect(obs.edited.strength).toBeGreaterThan(0);
  });

  it('observes a plain post as neither', () => {
    const post = createPost('<p>Nothing interesting here.</p>');
    const obs = detector.observe(post, { postId: 'p3', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.comment.present).toBe(false);
    expect(obs.edited.present).toBe(false);
    expect(obs.comment.strength).toBe(0);
    expect(obs.edited.strength).toBe(0);
  });

  it('finds Arabic comment text when the page language says English', () => {
    const post = createPost('<div class="comment-count">٣ تعليقات في الصف</div>');
    const obs = detector.observe(post, { postId: 'p4', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.comment.present).toBe(true);
  });

  it('never lets a strength go negative after penalties', () => {
    const post = createPost('<button role="button">Add class comment</button>');
    const obs = detector.observe(post, { postId: 'p5', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.comment.strength).toBeGreaterThanOrEqual(0);
    expect(obs.edited.strength).toBeGreaterThanOrEqual(0);
  });

  it('reports penalties as rule ids, never as page text', () => {
    const post = createPost('<button role="button">Add class comment</button>');
    const obs = detector.observe(post, { postId: 'p6', viewKind: ViewKind.STREAM, lang: 'en' });

    for (const p of obs.penalties) {
      expect(typeof p.ruleId).toBe('string');
      expect(p.ruleId).toMatch(/^[A-Z0-9_]+$/);
      expect(typeof p.penalty).toBe('number');
    }
  });

  it('measures its own cost', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">2</div></div>');
    const obs = detector.observe(post, { postId: 'p7', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(obs.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(obs.elapsedMs)).toBe(true);
  });

  it('works without a lang hint by detecting the page language itself', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">4</div></div>');
    const obs = detector.observe(post, { postId: 'p8', viewKind: ViewKind.STREAM });

    expect(obs.comment.present).toBe(true);
  });

  it('carries debug layer traces for the adapter', () => {
    const post = createPost('<div class="qCWAqb"><div class="huI6Cb">5</div></div>');
    const obs = detector.observe(post, { postId: 'p9', viewKind: ViewKind.STREAM, lang: 'en' });

    expect(Array.isArray(obs.debug)).toBe(true);
    expect(obs.debug!.length).toBeGreaterThan(0);
    expect(obs.debug![0]).toHaveProperty('layerName');
  });

  it('carries the viewKind through untouched', () => {
    const post = createPost('<p>plain</p>');
    const obs = detector.observe(post, {
      postId: 'p10',
      viewKind: ViewKind.ASSIGNMENT_DETAILS,
      lang: 'en',
    });

    expect(obs.viewKind).toBe(ViewKind.ASSIGNMENT_DETAILS);
  });
});
