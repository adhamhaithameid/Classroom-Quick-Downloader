import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markTargetElements, triggerPulseEffect, unmarkTargetElements } from '../entrypoints/content/pulse-effect';

function createPostFixture(): HTMLElement {
  const post = document.createElement('div');
  post.innerHTML = `
    <span class="asQXV QRiHXd">5 comments</span>
    <div class="IMvYId dDKhVc Vu2fZd">Jan 1, 2026</div>
    <div class="cqd-overlay-container"></div>
  `;
  return post;
}

describe('content/pulse-effect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  it('marks comment and edited targets for both type', () => {
    const post = createPostFixture();
    document.body.appendChild(post);

    markTargetElements(post, 'both');
    expect(post.querySelector('[data-cqd-styled="comment"]')).toBeTruthy();
    expect(post.querySelector('[data-cqd-styled="edited"]')).toBeTruthy();
  });

  it('removes marker classes with unmarkTargetElements', () => {
    const post = createPostFixture();
    document.body.appendChild(post);
    markTargetElements(post, 'both');

    unmarkTargetElements(post);
    expect(post.querySelector('[data-cqd-styled]')).toBeNull();
  });

  it('triggers pulse animation and clears debounce flag', async () => {
    const post = createPostFixture();
    document.body.appendChild(post);
    markTargetElements(post, 'both');

    triggerPulseEffect(post, 'both');
    expect(post.getAttribute('data-cqd-animating')).toBe('true');
    expect(post.querySelector('.cqd-overlay-container')?.classList.contains('cqd-pulse-both')).toBe(true);

    // second click ignored while debounced
    triggerPulseEffect(post, 'both');
    await vi.advanceTimersByTimeAsync(1600);
    expect(post.hasAttribute('data-cqd-animating')).toBe(false);
  });
});
