import { beforeEach, describe, expect, it, vi } from 'vitest';

type FlagsModule = typeof import('../entrypoints/content/flags');

async function loadFlagsModule() {
  vi.resetModules();
  const triggerPulseEffect = vi.fn();
  const markTargetElements = vi.fn();
  const triggerPostClick = vi.fn();

  vi.doMock('../entrypoints/content/icons', () => ({
    COMMENT_ICON_URL: 'data:image/svg+xml;base64,AAA',
    EDIT_ICON_SVG_RAW: '<svg viewBox="0 0 1 1"></svg>',
    appendSvgFromString: (el: HTMLElement, svg: string) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = svg;
      const node = wrapper.firstElementChild;
      if (node) el.appendChild(node);
    },
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
  }));
  vi.doMock('../entrypoints/content/pulse-effect', () => ({
    triggerPulseEffect,
    markTargetElements,
  }));
  vi.doMock('../entrypoints/content/both-badge', () => ({
    triggerPostClick,
  }));

  const mod = await import('../entrypoints/content/flags');
  return { mod, triggerPulseEffect, markTargetElements, triggerPostClick };
}

describe('content/flags', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('subscribes to storage state changes and toggles callbacks', async () => {
    const addListenerSpy = vi.spyOn(chrome.storage.onChanged, 'addListener');
    const removeListenerSpy = vi.spyOn(chrome.storage.onChanged, 'removeListener');
    vi.spyOn(chrome.storage.local, 'get').mockImplementation((_key: any, cb: (result: Record<string, unknown>) => void) => {
      cb({ extensionEnabled: false });
    });

    const { mod } = await loadFlagsModule();
    const onEnabled = vi.fn();
    const onDisabled = vi.fn();
    const unsubscribe = mod.subscribeToGlobalState(onEnabled, onDisabled);

    expect(onDisabled).toHaveBeenCalledTimes(1);
    const listener = addListenerSpy.mock.calls[0]?.[0] as (changes: any, area: string) => void;
    listener({ extensionEnabled: { newValue: true } }, 'local');
    listener({ extensionEnabled: { newValue: false } }, 'local');
    expect(onEnabled).toHaveBeenCalledTimes(1);
    expect(onDisabled).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(removeListenerSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to onEnabled when chrome storage is unavailable', async () => {
    const originalChrome = (globalThis as any).chrome;
    delete (globalThis as any).chrome;
    const { mod } = await loadFlagsModule();
    const onEnabled = vi.fn();
    const onDisabled = vi.fn();
    mod.subscribeToGlobalState(onEnabled, onDisabled);
    expect(onEnabled).toHaveBeenCalledTimes(1);
    expect(onDisabled).not.toHaveBeenCalled();
    (globalThis as any).chrome = originalChrome;
  });

  it('creates comment and edited badges with click behavior', async () => {
    const { mod, triggerPulseEffect, markTargetElements, triggerPostClick } = await loadFlagsModule();
    const post = document.createElement('div');
    document.body.appendChild(post);

    const commentBadge = mod.createCommentBadge(post, 7);
    expect(commentBadge.classList.contains('cqd-comment-badge')).toBe(true);
    expect(commentBadge.getAttribute('aria-label')).toContain('comments');

    commentBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(triggerPulseEffect).toHaveBeenCalledWith(post, 'comment');
    expect(triggerPostClick).toHaveBeenCalledWith(post);

    const editedBadge = mod.createEditedBadge(post, '2d');
    expect(editedBadge.classList.contains('cqd-edited-badge')).toBe(true);
    expect(post.querySelector('.cqd-overlay-container')).toBeTruthy();
    expect(markTargetElements).toHaveBeenCalledWith(post, 'edited');

    editedBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(triggerPulseEffect).toHaveBeenCalledWith(post, 'edited');
  });
});
