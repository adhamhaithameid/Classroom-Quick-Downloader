// filepath: extension/tests/content-flag-initial-read-race.test.ts
/**
 * Survey #819 regression — the INITIAL storage read must route through the
 * same apply path as live toggles.
 *
 * The bug: both V1 frame scripts read commentsFlagEnabled/editedFlagEnabled
 * at module eval with an ASYNC chrome.storage.local.get, while the
 * global-enabled start path (subscribeToGlobalState → start → first scan)
 * races it with its own async read. When the start path wins, the first
 * scan renders badges using the module default (true). The flag-read
 * callback then did a bare variable assignment — it never called
 * applyCommentsFlagState/applyEditedFlagState — so nothing removed the
 * already-rendered badges. User-visible shape: disable the flags in
 * options, close and reopen Classroom, the flags render again while the
 * options still say disabled. Live toggles kept working because the
 * storage.onChanged path fires the real apply functions.
 *
 * These tests resolve chrome.storage.local.get DEFERRED (manually flushed),
 * which forces the start-wins-race interleaving deterministically.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type OnChangedListener = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
) => void;
type DeferredGet = (payload?: Record<string, unknown>) => void;
type StateCallback = () => void;

function deferredSettings(payload: Record<string, unknown>): DeferredGet[] {
  const deferred: DeferredGet[] = [];
  chrome.storage.local.get = vi.fn().mockImplementation(
    (_keys: unknown, cb?: (result: Record<string, unknown>) => void) => {
      deferred.push(() => cb?.({ ...payload }));
      return undefined;
    },
  ) as unknown as typeof chrome.storage.local.get;
  return deferred;
}

function flush(deferred: DeferredGet[]): void {
  deferred.splice(0).forEach((resolve) => resolve());
}

function makePost(opts: { edited?: boolean } = {}): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', 'post-1');
  if (opts.edited) post.setAttribute('data-cqd-edit-tooltip', 'Edited');
  document.body.appendChild(post);
  return post;
}

interface FrameHandle {
  start: () => void;
  stop: () => void;
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
  vi.doMock('../entrypoints/content/both-badge', () => ({
    upgradeCombinedBadge: vi.fn(),
    ATTR_COMMENT_COUNT: 'data-cqd-comment-count',
    ATTR_EDIT_DIFF: 'data-cqd-edit-diff',
    triggerPostClick: vi.fn(),
  }));
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

async function loadFrame(
  which: 'comment' | 'edited',
  onChangedListeners: OnChangedListener[],
): Promise<FrameHandle> {
  vi.resetModules();
  chrome.storage.onChanged.addListener = vi.fn((cb: OnChangedListener) => {
    onChangedListeners.push(cb);
  }) as unknown as typeof chrome.storage.onChanged.addListener;
  const subscribeToGlobalState = vi.fn();
  const detector =
    which === 'comment' ? { commentCount: 1, isEdited: false } : { commentCount: 0, isEdited: true };
  mockSharedModules(detector, subscribeToGlobalState);
  const mod = await import(
    which === 'comment'
      ? '../entrypoints/comment_frame.content'
      : '../entrypoints/edited_frame.content'
  );
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [StateCallback, StateCallback];
  return { start: calls[0], stop: calls[1] };
}

describe('flag initial read loses the race to the first scan (#819)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('comment frame: badges rendered by the racy first scan are removed when the read lands false', async () => {
    const deferred = deferredSettings({ commentsFlagEnabled: false });
    const { start } = await loadFrame('comment', []);
    const post = makePost();

    start();
    // Race window: the first scan ran with the module default (true).
    expect(post.querySelector('.cqd-comment-badge')).not.toBeNull();

    flush(deferred);

    expect(post.querySelector('.cqd-comment-badge')).toBeNull();
    expect(post.querySelector('.cqd-overlay-container')).toBeNull();
  });

  it('edited frame: badges rendered by the racy first scan are removed when the read lands false', async () => {
    const deferred = deferredSettings({ editedFlagEnabled: false });
    const { start } = await loadFrame('edited', []);
    const post = makePost({ edited: true });

    start();
    expect(post.querySelector('.cqd-edited-badge')).not.toBeNull();

    flush(deferred);

    expect(post.querySelector('.cqd-edited-badge')).toBeNull();
    expect(post.querySelector('.cqd-overlay-container')).toBeNull();
  });

  it('comment frame: read landing before start never renders', async () => {
    const deferred = deferredSettings({ commentsFlagEnabled: false });
    const { start } = await loadFrame('comment', []);
    const post = makePost();

    flush(deferred);
    start();

    expect(post.querySelector('.cqd-comment-badge')).toBeNull();
  });

  it('edited frame: read landing before start never renders', async () => {
    const deferred = deferredSettings({ editedFlagEnabled: false });
    const { start } = await loadFrame('edited', []);
    const post = makePost({ edited: true });

    flush(deferred);
    start();

    expect(post.querySelector('.cqd-edited-badge')).toBeNull();
  });
});
