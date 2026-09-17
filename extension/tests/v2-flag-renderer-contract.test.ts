// filepath: extension/tests/v2-flag-renderer-contract.test.ts
/**
 * z57 STAGE 4 — the v2 flag badge markup contract (qa-03 assertions).
 *
 * Pins: comment badge with count + "comment" tooltip, edited badge, ONE
 * overlay container for the both post, badges inside their own card, dark
 * class, body data-cqd-dir, and the live cqd-flag-toggle re-render.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import type { FlagDecision } from '../src/engines/types';
import {
  renderFlagBadge,
  removeStaleBadges,
  removeAllV2Badges,
  applyFlagToggle,
} from '../src/v2/render/flag-renderer';

function decision(verdict: FlagDecision['finalVerdict'], count: number | null = null): FlagDecision {
  return {
    postId: 'p',
    commentScore: verdict === 'comment' || verdict === 'both' ? 5 : 0,
    editedScore: verdict === 'edited' || verdict === 'both' ? 3 : 0,
    commentCount: count,
    editedDiff: null,
    exclusionPenalties: [],
    finalVerdict: verdict,
    confidence: 'high' as FlagDecision['confidence'],
    trace: {
      postId: 'p',
      timestamp: Date.now(),
      viewKind: 'stream' as never,
      layers: [],
      exclusions: [],
      finalScore: 5,
      duration_ms: 1,
    },
  };
}

function post(id: string): HTMLElement {
  const el = document.createElement('article');
  el.setAttribute('data-stream-item-id', id);
  document.body.appendChild(el);
  return el;
}

describe('v2 flag badge markup contract (qa-03)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.lang = 'en';
    document.body.removeAttribute('data-cqd-dir');
    // Reset toggle state to enabled.
    applyFlagToggle('commentsFlagEnabled', true);
    applyFlagToggle('editedFlagEnabled', true);
  });

  it('comment verdict renders ONE .cqd-comment-badge.cqd-flag with the count and a comment tooltip', () => {
    const el = post('flag-comments');
    renderFlagBadge(decision('comment', 5), el);

    const badge = el.querySelector<HTMLElement>('.cqd-comment-badge');
    expect(badge).not.toBeNull();
    expect(el.querySelectorAll('.cqd-comment-badge')).toHaveLength(1);
    expect(badge!.classList.contains('cqd-flag')).toBe(true);
    expect(badge!.querySelector('.cqd-flag-text')?.textContent).toBe('5');
    const tooltip = badge!.getAttribute('aria-label') ?? badge!.title ?? '';
    expect(tooltip.toLowerCase()).toContain('comment');
  });

  it('edited verdict renders ONE .cqd-edited-badge.cqd-flag', () => {
    const el = post('flag-edited');
    renderFlagBadge(decision('edited'), el);

    expect(el.querySelectorAll('.cqd-edited-badge')).toHaveLength(1);
    expect(el.querySelector('.cqd-edited-badge')?.classList.contains('cqd-flag')).toBe(true);
  });

  it('both verdict resolves to ONE overlay container with ONE combined badge (golden rule 5)', () => {
    const el = post('flag-both');
    renderFlagBadge(decision('both', 2), el);
    // Re-render with the same decision — idempotent, no duplicates.
    renderFlagBadge(decision('both', 2), el);

    expect(el.querySelectorAll('.cqd-overlay-container')).toHaveLength(1);
    expect(el.querySelectorAll('.cqd-both-badge')).toHaveLength(1);
    expect(el.querySelectorAll('.cqd-comment-badge')).toHaveLength(0);
    expect(el.querySelectorAll('.cqd-edited-badge')).toHaveLength(0);
    expect(el.querySelector('.cqd-both-badge')!.closest('[data-stream-item-id]')).toBe(el);
  });

  it('none verdict strips existing artifacts', () => {
    const el = post('flag-clean');
    renderFlagBadge(decision('comment', 1), el);
    expect(el.querySelector('.cqd-comment-badge')).not.toBeNull();
    renderFlagBadge(decision('none'), el);
    expect(el.querySelector('.cqd-comment-badge')).toBeNull();
    expect(removeStaleBadges(el)).toBeUndefined();
  });

  it('dark mode stamps cqd-theme-dark on badges and overlays', () => {
    document.body.classList.add('cqd-theme-dark');
    try {
      const el = post('flag-dark');
      renderFlagBadge(decision('both', 3), el);
      expect(el.querySelector('.cqd-both-badge')?.classList.contains('cqd-theme-dark')).toBe(true);
      expect(el.querySelector('.cqd-overlay-container')?.classList.contains('cqd-theme-dark')).toBe(true);
    } finally {
      document.body.classList.remove('cqd-theme-dark');
    }
  });

  it('RTL pages publish body[data-cqd-dir="rtl"] (golden rule 7)', () => {
    document.documentElement.dir = 'rtl';
    try {
      const el = post('flag-rtl');
      renderFlagBadge(decision('comment', 2), el);
      expect(document.body.getAttribute('data-cqd-dir')).toBe('rtl');
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('live toggle removes disabled badges and re-renders enabled ones without a scan', () => {
    const el = post('flag-toggle');
    renderFlagBadge(decision('comment', 4), el);
    expect(el.querySelector('.cqd-comment-badge')).not.toBeNull();

    applyFlagToggle('commentsFlagEnabled', false);
    expect(el.querySelector('.cqd-comment-badge')).toBeNull();

    applyFlagToggle('commentsFlagEnabled', true);
    expect(el.querySelector('.cqd-comment-badge')).not.toBeNull();
  });

  it('toggle off the comment half of a both post leaves the edited pill (not an empty overlay)', () => {
    const el = post('flag-both-toggle');
    renderFlagBadge(decision('both', 2), el);
    expect(el.querySelector('.cqd-both-badge')).not.toBeNull();

    applyFlagToggle('commentsFlagEnabled', false);
    // Comments disabled → only the edited half remains.
    expect(el.querySelector('.cqd-both-badge')).toBeNull();
    expect(el.querySelector('.cqd-edited-badge')).not.toBeNull();
  });

  it('removeAllV2Badges strips v2 artifacts but leaves foreign .cqd-flag elements (V1 safety)', () => {
    const el = post('flag-mixed');
    renderFlagBadge(decision('comment', 1), el);
    const foreign = document.createElement('div');
    foreign.className = 'cqd-flag';
    el.appendChild(foreign);

    removeAllV2Badges();

    expect(el.querySelector('.cqd-comment-badge')).toBeNull();
    expect(el.querySelector('.cqd-flag')).toBe(foreign);
  });
});
