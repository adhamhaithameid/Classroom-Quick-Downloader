// filepath: extension/tests/compare/compare-render.test.ts
/**
 * The compare renderer must be able to coexist with the production flag
 * renderer without either deleting the other's badge. That is the whole
 * reason it exists as a separate module.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  injectCompareStyles,
  markCompareRoot,
  removeCompareArtefacts,
  renderStructuralBadge,
} from '../../src/compare/compare-render';
import { STRUCTURAL_THEME } from '../../src/contracts/theme';
import type { PostDecision } from '../../src/contracts/detection';

function decision(overrides: Partial<PostDecision> = {}): PostDecision {
  return {
    postId: 'p1',
    verdict: 'comment',
    commentCount: 3,
    confidence: 'high',
    score: 100,
    commentScore: 100,
    editedScore: 0,
    ...overrides,
  };
}

function makePost(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('compare render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById('cqd-compare-styles')?.remove();
  });

  afterEach(() => {
    removeCompareArtefacts();
    document.body.innerHTML = '';
  });

  it('injects its stylesheet once', () => {
    injectCompareStyles();
    injectCompareStyles();
    expect(document.querySelectorAll('#cqd-compare-styles')).toHaveLength(1);
  });

  it('uses the structural theme colours, not the keyword ones', () => {
    injectCompareStyles();
    const css = document.getElementById('cqd-compare-styles')!.textContent!;
    expect(css).toContain(STRUCTURAL_THEME.primary);
    expect(css).toContain(STRUCTURAL_THEME.secondary);
  });

  it('applies the dev transform as one class on the root', () => {
    const root = makePost();
    markCompareRoot(root);
    expect(root.classList.contains('cqd-compare')).toBe(true);

    injectCompareStyles();
    const css = document.getElementById('cqd-compare-styles')!.textContent!;
    expect(css).toContain('opacity: 0.5');
    expect(css).toContain('.cqd-compare [class*="cqd-"]');
  });

  it('renders a badge for a comment verdict', () => {
    const post = makePost();
    renderStructuralBadge(decision(), post);

    const badge = post.querySelector('.cqd-compare-flag')!;
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('data-verdict')).toBe('comment');
    expect(badge.getAttribute('data-engine')).toBe('structural');
    expect(badge.textContent).toBe('S:3');
  });

  it('renders nothing for a none verdict', () => {
    const post = makePost();
    renderStructuralBadge(decision({ verdict: 'none' }), post);
    expect(post.querySelector('.cqd-compare-flag')).toBeNull();
  });

  it('replaces its own badge rather than stacking them', () => {
    const post = makePost();
    renderStructuralBadge(decision(), post);
    renderStructuralBadge(decision({ commentCount: 9 }), post);

    expect(post.querySelectorAll('.cqd-compare-flag')).toHaveLength(1);
    expect(post.querySelector('.cqd-compare-flag')!.textContent).toBe('S:9');
  });

  it('does not touch a production flag badge sitting on the same post', () => {
    const post = makePost();

    const productionBadge = document.createElement('span');
    productionBadge.className = 'cqd-v2-flag';
    post.appendChild(productionBadge);
    post.setAttribute('data-cqd-v2-flag', 'true');

    renderStructuralBadge(decision(), post);

    expect(post.querySelector('.cqd-v2-flag')).toBe(productionBadge);
    expect(post.getAttribute('data-cqd-v2-flag')).toBe('true');
    expect(post.querySelector('.cqd-compare-flag')).toBeTruthy();
  });

  it('stamps no attribute on the post element itself', () => {
    const post = makePost();
    renderStructuralBadge(decision(), post);

    const attrs = [...post.attributes].map((a) => a.name).filter((n) => n !== 'style');
    expect(attrs).toEqual([]);
  });

  it('removes every artefact on teardown', () => {
    const post = makePost();
    markCompareRoot(post);
    renderStructuralBadge(decision(), post);

    removeCompareArtefacts();

    expect(document.getElementById('cqd-compare-styles')).toBeNull();
    expect(document.querySelector('.cqd-compare-flag')).toBeNull();
    expect(post.classList.contains('cqd-compare')).toBe(false);
  });
});
