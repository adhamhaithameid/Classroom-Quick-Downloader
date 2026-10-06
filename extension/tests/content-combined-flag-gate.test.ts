// filepath: extension/tests/content-combined-flag-gate.test.ts
/**
 * The popup's "Both" pill (combinedFlagEnabled) must gate the merged
 * combined badge end-to-end in the V1 frames:
 *   - the init render path — both frames load the key from storage at
 *     startup (same read pattern as commentsFlagEnabled/editedFlagEnabled);
 *   - the upgrade/merge path — upgradeCombinedBadge keeps the standalone
 *     singles intact while the merge is suppressed;
 *   - the live 'cqd-flag-toggle' path — toggle off strips the merged pill
 *     and re-renders the singles; toggle on re-merges. Same remove vs
 *     re-render semantics as the other two flags' live toggles.
 *
 * Defaults (all flags ON) render exactly as before — only the OFF state
 * changes. The REAL both-badge module runs here (only icons/i18n/pulse/
 * detector/flag-factory are mocked), so the whole merge pipeline is exercised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ToggleMessage = { type?: string; flag?: string; enabled?: boolean };
type MessageListener = (message: ToggleMessage) => void;
type OnChangedListener = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
) => void;

const COMMENT_COUNT_ATTR = 'data-cqd-comment-count';
const EDIT_TOOLTIP_ATTR = 'data-cqd-edit-tooltip';

/** Point chrome.storage.local at a fixed payload (default: empty = all ON). */
function storedSettings(payload: Record<string, unknown>): void {
  chrome.storage.local.get = vi.fn().mockImplementation(
    (keys: unknown, cb?: (result: Record<string, unknown>) => void) => {
      const result = { ...payload };
      if (typeof cb === 'function') {
        cb(result);
        return undefined;
      }
      return Promise.resolve(result);
    },
  );
}

function makePost(): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', 'post-1');
  // The edited frame's contribution to the merge decision.
  post.setAttribute(EDIT_TOOLTIP_ATTR, 'Edited');
  document.body.appendChild(post);
  return post;
}

interface FrameHandle {
  detector: { commentCount: number; isEdited: boolean };
  start: () => void;
  stop: () => void;
  messageListeners: MessageListener[];
  onChangedListeners: OnChangedListener[];
}

function mockSharedModules(
  detector: { commentCount: number; isEdited: boolean },
  subscribeToGlobalState: ReturnType<typeof vi.fn>,
): void {
  vi.doMock('../entrypoints/content/icons', () => ({
    COMMENT_ICON_URL: 'icon',
    EDIT_ICON_SVG_RAW: '<svg></svg>',
    appendSvgFromString: vi.fn(),
    CANCEL_ICON_SVG_URL: 'cancel',
    DOWNLOAD_ICON_SVG_URL: 'download',
  }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
    getCurrentCachedLanguage: () => 'en',
  }));
  vi.doMock('../entrypoints/content/theme', () => ({ isPageDark: () => false }));
  vi.doMock('../entrypoints/content/smart-detector', () => ({
    detectComments: () => ({ count: detector.commentCount }),
    detectEdited: () => ({ isEdited: detector.isEdited }),
  }));
  vi.doMock('../entrypoints/content/flags', () => ({
    subscribeToGlobalState,
    createCommentBadge: () => {
      const badge = document.createElement('div');
      badge.className = 'cqd-comment-badge cqd-flag';
      badge.setAttribute('data-cqd-injected', 'true');
      return badge;
    },
    createEditedBadge: () => {
      const badge = document.createElement('div');
      badge.className = 'cqd-edited-badge cqd-flag';
      badge.setAttribute('data-cqd-injected', 'true');
      return badge;
    },
  }));
  // NOTE: both-badge is deliberately NOT mocked — the real merge pipeline
  // under test. Its own imports (icons/i18n/pulse-effect) are mocked above.
  vi.doMock('../entrypoints/content/pulse-effect', () => ({
    triggerPulseEffect: vi.fn(),
    markTargetElements: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/post-card-utils', () => ({
    queryPostCards: () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-stream-item-id]')),
  }));
  vi.doMock('../entrypoints/content/mode-gate', () => ({
    gateV1Stack: ({ start, stop }: { start: () => void; stop: () => void }) => ({ start, stop }),
  }));
}

function captureListeners(): { messageListeners: MessageListener[]; onChangedListeners: OnChangedListener[] } {
  const messageListeners: MessageListener[] = [];
  const onChangedListeners: OnChangedListener[] = [];
  chrome.runtime.onMessage.addListener = vi.fn((cb: MessageListener) => {
    messageListeners.push(cb);
  }) as unknown as typeof chrome.runtime.onMessage.addListener;
  chrome.storage.onChanged.addListener = vi.fn((cb: OnChangedListener) => {
    onChangedListeners.push(cb);
  }) as unknown as typeof chrome.storage.onChanged.addListener;
  return { messageListeners, onChangedListeners };
}

function lastToggleListener(listeners: MessageListener[]): MessageListener {
  expect(listeners.length).toBeGreaterThan(0);
  return listeners[listeners.length - 1]!;
}

async function loadCommentFrame(options: { storage?: Record<string, unknown> } = {}): Promise<FrameHandle> {
  vi.resetModules();
  storedSettings(options.storage ?? {});
  const { messageListeners, onChangedListeners } = captureListeners();
  const detector = { commentCount: 1, isEdited: false };
  const subscribeToGlobalState = vi.fn();
  mockSharedModules(detector, subscribeToGlobalState);

  const mod = await import('../entrypoints/comment_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return {
    detector,
    start: calls[0],
    stop: calls[1],
    messageListeners,
    onChangedListeners,
  };
}

async function loadEditedFrame(options: { storage?: Record<string, unknown> } = {}): Promise<FrameHandle> {
  vi.resetModules();
  storedSettings(options.storage ?? {});
  const { messageListeners, onChangedListeners } = captureListeners();
  const detector = { commentCount: 0, isEdited: true };
  const subscribeToGlobalState = vi.fn();
  mockSharedModules(detector, subscribeToGlobalState);

  const mod = await import('../entrypoints/edited_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return {
    detector,
    start: calls[0],
    stop: calls[1],
    messageListeners,
    onChangedListeners,
  };
}

describe('comment_frame honors combinedFlagEnabled', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('default (no stored key): post with both signals still merges into the combined pill', async () => {
    const { start } = await loadCommentFrame();
    const post = makePost();

    start();

    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();
    expect(post.querySelector('.cqd-comment-badge')).toBeNull();
  });

  it('combined OFF in storage: init renders the single comment badge, no merged pill', async () => {
    const { start } = await loadCommentFrame({ storage: { combinedFlagEnabled: false } });
    const post = makePost();

    start();

    expect(post.querySelector('.cqd-both-badge')).toBeNull();
    expect(post.querySelector('.cqd-comment-badge')).not.toBeNull();
  });

  it('live toggle OFF strips the merged pill and re-renders the standalone single', async () => {
    const { start, messageListeners } = await loadCommentFrame();
    const post = makePost();
    start();
    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();

    lastToggleListener(messageListeners)({
      type: 'cqd-flag-toggle',
      flag: 'combinedFlagEnabled',
      enabled: false,
    });

    expect(post.querySelector('.cqd-both-badge')).toBeNull();
    expect(post.querySelector('.cqd-comment-badge')).not.toBeNull();
  });

  it('live toggle ON after OFF re-merges into the combined pill (single consumed again)', async () => {
    const { start, messageListeners } = await loadCommentFrame({
      storage: { combinedFlagEnabled: false },
    });
    const post = makePost();
    start();
    expect(post.querySelector('.cqd-comment-badge')).not.toBeNull();
    expect(post.querySelector('.cqd-both-badge')).toBeNull();

    lastToggleListener(messageListeners)({
      type: 'cqd-flag-toggle',
      flag: 'combinedFlagEnabled',
      enabled: true,
    });

    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();
    expect(post.querySelectorAll('.cqd-comment-badge')).toHaveLength(0);
  });

  it('storage.onChanged OFF strips the merged pill too (cross-tab sync path)', async () => {
    const { start, onChangedListeners } = await loadCommentFrame();
    const post = makePost();
    start();
    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();

    onChangedListeners[onChangedListeners.length - 1]!(
      { combinedFlagEnabled: { newValue: false } },
      'local',
    );

    expect(post.querySelector('.cqd-both-badge')).toBeNull();
    expect(post.querySelector('.cqd-comment-badge')).not.toBeNull();
  });
});

describe('edited_frame honors combinedFlagEnabled', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('default (no stored key): post with both signals still merges into the combined pill', async () => {
    const { start } = await loadEditedFrame();
    const post = makePost();
    // The comment frame's contribution to the merge decision.
    post.setAttribute(COMMENT_COUNT_ATTR, '3');

    start();

    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();
    expect(post.querySelector('.cqd-edited-badge')).toBeNull();
  });

  it('combined OFF in storage: init renders the single edited badge, no merged pill', async () => {
    const { start } = await loadEditedFrame({ storage: { combinedFlagEnabled: false } });
    const post = makePost();
    post.setAttribute(COMMENT_COUNT_ATTR, '3');

    start();

    expect(post.querySelector('.cqd-both-badge')).toBeNull();
    expect(post.querySelector('.cqd-edited-badge')).not.toBeNull();
  });

  it('live toggle OFF strips the merged pill and re-renders the standalone single', async () => {
    const { start, messageListeners } = await loadEditedFrame();
    const post = makePost();
    post.setAttribute(COMMENT_COUNT_ATTR, '3');
    start();
    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();

    lastToggleListener(messageListeners)({
      type: 'cqd-flag-toggle',
      flag: 'combinedFlagEnabled',
      enabled: false,
    });

    expect(post.querySelector('.cqd-both-badge')).toBeNull();
    expect(post.querySelector('.cqd-edited-badge')).not.toBeNull();
  });

  it('live toggle ON after OFF re-merges into the combined pill (single consumed again)', async () => {
    const { start, messageListeners } = await loadEditedFrame({
      storage: { combinedFlagEnabled: false },
    });
    const post = makePost();
    post.setAttribute(COMMENT_COUNT_ATTR, '3');
    start();
    expect(post.querySelector('.cqd-edited-badge')).not.toBeNull();
    expect(post.querySelector('.cqd-both-badge')).toBeNull();

    lastToggleListener(messageListeners)({
      type: 'cqd-flag-toggle',
      flag: 'combinedFlagEnabled',
      enabled: true,
    });

    expect(post.querySelector('.cqd-both-badge')).not.toBeNull();
    expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(0);
  });
});
