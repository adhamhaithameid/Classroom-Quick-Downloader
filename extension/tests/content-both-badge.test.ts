import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadBothBadgeModule() {
  vi.resetModules();
  const triggerPulseEffect = vi.fn();
  const markTargetElements = vi.fn();
  const appendSvgFromString = vi.fn((el: HTMLElement) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.appendChild(svg);
  });

  vi.doMock('../entrypoints/content/icons', () => ({
    COMMENT_ICON_URL: 'data:image/svg+xml;base64,AAA',
    EDIT_ICON_SVG_RAW: '<svg viewBox="0 0 1 1"></svg>',
    appendSvgFromString,
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
  }));
  vi.doMock('../entrypoints/content/pulse-effect', () => ({
    triggerPulseEffect,
    markTargetElements,
  }));

  const mod = await import('../entrypoints/content/both-badge');
  return { mod, triggerPulseEffect, markTargetElements, appendSvgFromString };
}

describe('content/both-badge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('triggerPostClick prefers details anchor and falls back to post click', async () => {
    const { mod } = await loadBothBadgeModule();
    const post = document.createElement('div');
    const link = document.createElement('a');
    link.href = '/details/1';
    const linkClick = vi.spyOn(link, 'click');
    post.appendChild(link);

    mod.triggerPostClick(post);
    expect(linkClick).toHaveBeenCalledTimes(1);

    const plainPost = document.createElement('div');
    const postClick = vi.spyOn(plainPost, 'click');
    mod.triggerPostClick(plainPost);
    expect(postClick).toHaveBeenCalledTimes(1);
  });

  it('creates and updates combined badge when both attributes are present', async () => {
    const { mod, triggerPulseEffect, markTargetElements } = await loadBothBadgeModule();
    const post = document.createElement('div');
    post.setAttribute(mod.ATTR_COMMENT_COUNT, '5');
    post.setAttribute(mod.ATTR_EDIT_DIFF, '2d');
    document.body.appendChild(post);

    mod.upgradeCombinedBadge(post);
    const badge = post.querySelector('.cqd-both-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(markTargetElements).toHaveBeenCalledWith(post, 'both');

    badge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(triggerPulseEffect).toHaveBeenCalledWith(post, 'both');
  });

  it('removes combined badge when one side of data is missing', async () => {
    const { mod } = await loadBothBadgeModule();
    const post = document.createElement('div');
    post.setAttribute(mod.ATTR_COMMENT_COUNT, '5');
    post.setAttribute(mod.ATTR_EDIT_DIFF, '2d');
    document.body.appendChild(post);

    mod.upgradeCombinedBadge(post);
    expect(post.querySelector('.cqd-both-badge')).toBeTruthy();

    post.removeAttribute(mod.ATTR_EDIT_DIFF);
    mod.upgradeCombinedBadge(post);
    expect(post.querySelector('.cqd-both-badge')).toBeNull();
  });
});
