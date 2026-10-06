// filepath: extension/tests/content-flag-badge-dedupe.test.ts
/**
 * Invariant: at most ONE flag pill per post element, no matter how many
 * combined-flag ("Both" pill) toggle cycles or refresh rescans run.
 *
 * Regression guard (round-2 review finding): requestEditedRefresh clears
 * EDITED_ATTR while an older single .cqd-edited-badge stays attached. The
 * rescan saw no attribute and appended a SECOND badge, and
 * upgradeCombinedBadge returned early for edited-only posts (no comment
 * count) without deduping. Every toggle cycle stacked one more overlapping
 * pill — duplicate DOM, duplicate click handlers, duplicate accessible
 * labels. Posts WITH comments were safe: the merge cleanup sweeps with
 * querySelectorAll.
 *
 * The comment frame reuses the existing badge inside createOverlay, so its
 * cycle tests below pin idempotency (they must stay green) rather than fix
 * a hole. The real both-badge module runs here; only icons/i18n/theme/
 * detector/flag-factory/pulse/post-card-utils/mode-gate are mocked. Same
 * harness contract as content-combined-flag-gate.test.ts.
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
const TOGGLE_CYCLES = 3;

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

interface ClickCounters {
  editedBadgeClicks: number;
  commentBadgeClicks: number;
}

function makePost(): HTMLElement {
  const post = document.createElement('div');
  post.setAttribute('data-stream-item-id', 'post-1');
  document.body.appendChild(post);
  return post;
}

interface FrameHandle {
  start: () => void;
  stop: () => void;
  messageListeners: MessageListener[];
  onChangedListeners: OnChangedListener[];
}

function mockSharedModules(
  detector: { commentCount: number; isEdited: boolean },
  subscribeToGlobalState: ReturnType<typeof vi.fn>,
  counters: ClickCounters,
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
    // Realistic pills: one accessible label + one click handler each, so the
    // tests can count handlers and labels, not just DOM nodes.
    createCommentBadge: () => {
      const badge = document.createElement('div');
      badge.className = 'cqd-comment-badge cqd-flag';
      badge.setAttribute('data-cqd-injected', 'true');
      badge.setAttribute('aria-label', `${detector.commentCount} comments`);
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        counters.commentBadgeClicks += 1;
      });
      return badge;
    },
    createEditedBadge: () => {
      const badge = document.createElement('div');
      badge.className = 'cqd-edited-badge cqd-flag';
      badge.setAttribute('data-cqd-injected', 'true');
      badge.setAttribute('aria-label', 'edited');
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        counters.editedBadgeClicks += 1;
      });
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

function captureListeners(): {
  messageListeners: MessageListener[];
  onChangedListeners: OnChangedListener[];
} {
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

async function loadEditedFrame(
  detector: { commentCount: number; isEdited: boolean },
  counters: ClickCounters,
): Promise<FrameHandle> {
  vi.resetModules();
  storedSettings({});
  const { messageListeners, onChangedListeners } = captureListeners();
  const subscribeToGlobalState = vi.fn();
  mockSharedModules(detector, subscribeToGlobalState, counters);

  const mod = await import('../entrypoints/edited_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { start: calls[0], stop: calls[1], messageListeners, onChangedListeners };
}

async function loadCommentFrame(
  detector: { commentCount: number; isEdited: boolean },
  counters: ClickCounters,
): Promise<FrameHandle> {
  vi.resetModules();
  storedSettings({});
  const { messageListeners, onChangedListeners } = captureListeners();
  const subscribeToGlobalState = vi.fn();
  mockSharedModules(detector, subscribeToGlobalState, counters);

  const mod = await import('../entrypoints/comment_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { start: calls[0], stop: calls[1], messageListeners, onChangedListeners };
}

function toggleCombined(listeners: MessageListener[], enabled: boolean): void {
  expect(listeners.length).toBeGreaterThan(0);
  listeners[listeners.length - 1]!({
    type: 'cqd-flag-toggle',
    flag: 'combinedFlagEnabled',
    enabled,
  });
}

describe('edited_frame: one edited badge per post across combined toggle cycles', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('edited-only post: N OFF/ON cycles keep exactly one badge, handler, and label', async () => {
    const counters: ClickCounters = { editedBadgeClicks: 0, commentBadgeClicks: 0 };
    const { start, stop, messageListeners } = await loadEditedFrame(
      { commentCount: 0, isEdited: true },
      counters,
    );
    const post = makePost();

    start();
    expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(1);

    for (let cycle = 0; cycle < TOGGLE_CYCLES; cycle++) {
      toggleCombined(messageListeners, false);
      expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(0);
      expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(1);

      toggleCombined(messageListeners, true);
      expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(0);
      expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(1);
    }

    // One click handler total and one accessible label total, even though
    // every cycle re-created the badge after an attribute-clearing refresh.
    post.querySelectorAll('.cqd-edited-badge').forEach((badge) => badge.click());
    expect(counters.editedBadgeClicks).toBe(1);
    expect(post.querySelectorAll('[aria-label="edited"]')).toHaveLength(1);

    stop();
  });

  it('post with comments: N OFF/ON cycles keep exactly one pill per state', async () => {
    const counters: ClickCounters = { editedBadgeClicks: 0, commentBadgeClicks: 0 };
    const { start, stop, messageListeners } = await loadEditedFrame(
      { commentCount: 0, isEdited: true },
      counters,
    );
    const post = makePost();
    post.setAttribute(COMMENT_COUNT_ATTR, '3');

    start();
    expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(1);
    expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(0);

    for (let cycle = 0; cycle < TOGGLE_CYCLES; cycle++) {
      toggleCombined(messageListeners, false);
      expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(0);
      expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(1);

      toggleCombined(messageListeners, true);
      expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(1);
      expect(post.querySelectorAll('.cqd-edited-badge')).toHaveLength(0);
    }

    stop();
  });
});

describe('comment_frame: one comment pill per post across combined toggle cycles', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('comment post: N OFF/ON cycles keep exactly one pill per state (no dupes)', async () => {
    const counters: ClickCounters = { editedBadgeClicks: 0, commentBadgeClicks: 0 };
    const { start, stop, messageListeners } = await loadCommentFrame(
      { commentCount: 3, isEdited: false },
      counters,
    );
    const post = makePost();
    // The edited frame's contribution to the merge decision (same contract
    // as the gate test's makePost).
    post.setAttribute(EDIT_TOOLTIP_ATTR, 'edited');

    start();
    expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(1);
    expect(post.querySelectorAll('.cqd-comment-badge')).toHaveLength(0);

    for (let cycle = 0; cycle < TOGGLE_CYCLES; cycle++) {
      toggleCombined(messageListeners, false);
      expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(0);
      expect(post.querySelectorAll('.cqd-comment-badge')).toHaveLength(1);

      toggleCombined(messageListeners, true);
      expect(post.querySelectorAll('.cqd-both-badge')).toHaveLength(1);
      expect(post.querySelectorAll('.cqd-comment-badge')).toHaveLength(0);
    }

    // Pinning check: the surviving merged pill carries exactly one handler
    // and one accessible label across all cycles.
    toggleCombined(messageListeners, false);
    post.querySelectorAll('.cqd-comment-badge').forEach((badge) => badge.click());
    expect(counters.commentBadgeClicks).toBe(1);
    expect(post.querySelectorAll('[aria-label="3 comments"]')).toHaveLength(1);

    stop();
  });
});
