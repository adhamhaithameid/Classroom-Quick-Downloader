import { describe, expect, it, vi } from 'vitest';

describe('entrypoint smoke imports', () => {
  it('loads content script entrypoints with expected metadata', async () => {
    vi.resetModules();

    const subscribeToGlobalState = vi.fn();
    const createCommentBadge = vi.fn(() => document.createElement('div'));
    const createEditedBadge = vi.fn(() => document.createElement('div'));

    vi.doMock('../entrypoints/content/icons', () => ({
      COMMENT_ICON_URL: 'icon',
      EDIT_ICON_SVG_RAW: '<svg></svg>',
      appendSvgFromString: vi.fn(),
      CANCEL_ICON_SVG_URL: 'cancel',
      DOWNLOAD_ICON_SVG_URL: 'download',
    }));
    vi.doMock('../entrypoints/content/styles', () => ({
      injectStyles: vi.fn(),
    }));
    vi.doMock('../entrypoints/content/i18n', () => ({
      t: (key: string) => key,
      getCurrentCachedLanguage: () => 'en',
    }));
    vi.doMock('../entrypoints/content/smart-detector', () => ({
      detectComments: () => ({ count: 0 }),
      detectEdited: () => ({ isEdited: false }),
    }));
    vi.doMock('../entrypoints/content/theme', () => ({
      isPageDark: () => false,
    }));
    vi.doMock('../entrypoints/content/flags', () => ({
      subscribeToGlobalState,
      createCommentBadge,
      createEditedBadge,
    }));
    vi.doMock('../entrypoints/content/both-badge', () => ({
      triggerPostClick: vi.fn(),
      upgradeCombinedBadge: vi.fn(),
      ATTR_COMMENT_COUNT: 'data-cqd-comment-count',
      ATTR_EDIT_DIFF: 'data-cqd-edit-diff',
    }));
    vi.doMock('../entrypoints/content/pulse-effect', () => ({
      triggerPulseEffect: vi.fn(),
      markTargetElements: vi.fn(),
    }));
    vi.doMock('../entrypoints/content/tab-detector', () => ({
      isClassworkPost: () => false,
      isTopicView: () => false,
    }));
    const initContentScript = vi.fn();
    vi.doMock('../entrypoints/content/message-handler', () => ({
      initContentScript,
    }));
    vi.doMock('../entrypoints/utils/analytics', () => ({
      getCancelHoldDelayMs: vi.fn(async () => 1000),
    }));

    const contentScript = await import('../entrypoints/content/index');
    const commentScript = await import('../entrypoints/comment_frame.content');
    const editedScript = await import('../entrypoints/edited_frame.content');
    const downloadAllScript = await import('../entrypoints/download_all.content');
    const driveBypassScript = await import('../entrypoints/drive_bypass.content');

    expect(contentScript.default.matches).toContain('https://classroom.google.com/*');
    expect(commentScript.default.matches).toContain('https://classroom.google.com/*');
    expect(editedScript.default.matches).toContain('https://classroom.google.com/*');
    expect(downloadAllScript.default.matches).toContain('https://classroom.google.com/*');
    expect(driveBypassScript.default.matches).toContain('https://drive.google.com/*');

    const fakeCtx = {} as any;
    contentScript.default.main(fakeCtx);
    commentScript.default.main(fakeCtx);
    editedScript.default.main(fakeCtx);
    downloadAllScript.default.main(fakeCtx);
    driveBypassScript.default.main(fakeCtx);

    expect(subscribeToGlobalState).toHaveBeenCalled();
    expect(initContentScript).toHaveBeenCalledTimes(1);
  });
});
