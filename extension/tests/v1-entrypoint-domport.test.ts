// filepath: extension/tests/v1-entrypoint-domport.test.ts
/**
 * S10 Task 3a — the three V1 entrypoints ride the shared page DomPort.
 * The button-injector rescan interval and the comment/edited heartbeats are
 * deleted: scans fire when mutation batches are delivered through the ONE
 * page observer and on ONE bounded settle scan after start — never on bare
 * timer advance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPageDomPort } from '../src/adapters/dom/mutation-observer-dom-port';

type MutationCallback = (mutations: MutationRecord[]) => void;

/** Fill a partial record into the full shape the port callbacks receive. */
function asRecord(partial: Partial<MutationRecord>): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: [],
    removedNodes: [],
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
    ...partial,
  } as MutationRecord;
}

/**
 * Platform MutationObserver stand-in: records constructions, observe/disconnect
 * calls, and lets tests push batches through the real multiplexer dispatch.
 */
class FakeMutationObserver {
  static instances: FakeMutationObserver[] = [];

  callback: MutationCallback;
  observedTarget: Node | null = null;
  observedInit: MutationObserverInit | null = null;
  disconnectCount = 0;

  constructor(callback: MutationCallback) {
    this.callback = callback;
    FakeMutationObserver.instances.push(this);
  }

  observe(target: Node, init: MutationObserverInit): void {
    this.observedTarget = target;
    this.observedInit = init;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }

  /** Deliver a batch of synthetic records through the multiplexer. */
  emit(parts: Array<Partial<MutationRecord>>): void {
    this.callback(parts.map(asRecord));
  }
}

const portHost = () => window as unknown as { __cqdDomPort?: unknown };

/* ------------------------------------------------------------------ */
/* observers.ts (button injector)                                      */
/* ------------------------------------------------------------------ */

async function loadObservers() {
  vi.resetModules();
  const injectButtonIntoAttachment = vi.fn();
  const extractDriveUrlFromAnchor = vi.fn((anchor: HTMLAnchorElement) => anchor.href || null);
  const findDriveUrl = vi.fn(() => 'https://drive.google.com/file/d/abc');
  const injectStyles = vi.fn();

  vi.doMock('../entrypoints/content/state', () => ({
    get scanTimeoutId() { return state.scanTimeoutId; },
    setScanTimeoutId: (id: number | null) => { state.scanTimeoutId = id; },
    get observer() { return state.observer; },
    setObserver: (obs: MutationObserver | null) => { state.observer = obs; },
    get rescanIntervalId() { return state.rescanIntervalId; },
    setRescanIntervalId: (id: number | null) => { state.rescanIntervalId = id; },
    get effectiveEnabled() { return state.effectiveEnabled; },
    setEffectiveEnabled: (enabled: boolean) => { state.effectiveEnabled = enabled; },
    get initialized() { return state.initialized; },
    setInitialized: (next: boolean) => { state.initialized = next; },
    RESCAN_DEBOUNCE_MS: 1,
    RESCAN_INTERVAL_MS: 1000,
    CLASSROOM_URL_PATTERN: /^https:\/\/classroom\.google\.com\//,
    DRIVE_ANCHOR_SELECTOR: 'a[href*="drive.google.com"]',
    ATTACHMENT_CONTAINER_SELECTOR: '[data-attachment-id], .luto0c, .KlRXdf, [data-drive-id]',
    INJECTED_ATTR: 'data-cqd-injected',
    PROCESSED_ATTR: 'data-cqd-processed',
  }));
  const state = {
    scanTimeoutId: null as number | null,
    observer: null as MutationObserver | null,
    rescanIntervalId: null as number | null,
    effectiveEnabled: true,
    initialized: false,
  };
  vi.doMock('../entrypoints/content/button-factory', () => ({
    injectButtonIntoAttachment,
  }));
  vi.doMock('../entrypoints/content/url-utils', () => ({
    extractDriveUrlFromAnchor,
    findDriveUrl,
  }));
  vi.doMock('../entrypoints/content/styles', () => ({
    injectStyles,
  }));
  // S10 T4: these suites drive the stack lifecycle directly; the engine
  // mode gate has its own suite (v4-mode-gate.test.ts) — pass through.
  vi.doMock('../entrypoints/content/mode-gate', () => ({
    gateV1Stack: ({ start, stop }: { start: () => void; stop: () => void }) => ({ start, stop }),
  }));

  const mod = await import('../entrypoints/content/observers');
  return { mod, injectButtonIntoAttachment, injectStyles };
}

describe('content/observers rides the shared page DomPort (S10)', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('subscribes the button injector through the page port over ONE platform observer', async () => {
    const { mod } = await loadObservers();

    mod.setupObservers();

    const port = getPageDomPort();
    expect(port.subscriptionCount).toBe(1);
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(FakeMutationObserver.instances[0]!.observedTarget).toBe(document);
    // The port always watches the documented superset init.
    expect(FakeMutationObserver.instances[0]!.observedInit).toEqual({
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  });

  it('scans the settle pass, then NEVER on timer advance alone (rescan interval deleted)', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObservers();
    const card = document.createElement('div');
    card.className = 'KlRXdf';
    card.innerHTML = '<a href="https://drive.google.com/file/d/123">Open</a>';
    document.body.appendChild(card);

    mod.setupObservers();
    vi.advanceTimersByTime(5); // flush the single bounded settle scan (debounced)
    expect(injectButtonIntoAttachment).toHaveBeenCalled();

    injectButtonIntoAttachment.mockClear();
    vi.advanceTimersByTime(10_000); // the old 2000ms interval would have scanned ~5x
    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
  });

  it('scans childList roots immediately when a batch is delivered through the port', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObservers();
    mod.setupObservers();
    vi.advanceTimersByTime(5);
    injectButtonIntoAttachment.mockClear();

    const parent = document.createElement('div');
    parent.innerHTML = '<div class="KlRXdf"><a href="https://drive.google.com/file/d/456">Link</a></div>';
    document.body.appendChild(parent);

    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', addedNodes: [parent] as unknown as NodeList, target: document.body },
    ]);

    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(1);
    expect(injectButtonIntoAttachment).toHaveBeenCalledWith(
      expect.anything(),
      'https://drive.google.com/file/d/456',
    );
  });

  it('narrows attribute batches to the subscription filter before scanning', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObservers();
    const el = document.createElement('div');
    el.setAttribute('data-attachment-id', 'a1');
    el.setAttribute('data-cqd-processed', 'true');
    el.innerHTML = '<a href="https://drive.google.com/file/d/x">File</a>';

    mod.setupObservers();
    vi.advanceTimersByTime(5); // flush the settle scan before mounting the fixture
    document.body.appendChild(el);
    injectButtonIntoAttachment.mockClear();

    // 'href' is not in the subscription's attributeFilter — no dispatch, no scan.
    FakeMutationObserver.instances[0]!.emit([
      { type: 'attributes', attributeName: 'href', target: el },
    ]);
    vi.advanceTimersByTime(10);
    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();

    // 'data-cqd-processed' IS in the filter → dispatch → direct root re-scan.
    FakeMutationObserver.instances[0]!.emit([
      { type: 'attributes', attributeName: 'data-cqd-processed', target: el },
    ]);
    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(1);
  });

  it('startCQD subscribes and stopCQD unsubscribes from the page port', async () => {
    const { mod } = await loadObservers();
    const port = getPageDomPort();

    mod.startCQD();
    expect(port.subscriptionCount).toBe(1);

    mod.stopCQD();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* comment_frame.content.ts                                            */
/* ------------------------------------------------------------------ */

async function loadCommentFrame() {
  vi.resetModules();
  const queryPostCards = vi.fn(
    () => Array.from(document.querySelectorAll<HTMLElement>('[data-stream-item-id]')),
  );
  const subscribeToGlobalState = vi.fn();

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
    createCommentBadge: vi.fn(() => document.createElement('div')),
    createEditedBadge: vi.fn(() => document.createElement('div')),
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
  vi.doMock('../entrypoints/content/post-card-utils', () => ({
    queryPostCards,
  }));
  // S10 T4: lifecycle suite — engine mode gate passes through (its own
  // suite is v4-mode-gate.test.ts).
  vi.doMock('../entrypoints/content/mode-gate', () => ({
    gateV1Stack: ({ start, stop }: { start: () => void; stop: () => void }) => ({ start, stop }),
  }));

  const mod = await import('../entrypoints/comment_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { mod, queryPostCards, start: calls[0], stop: calls[1] };
}

describe('comment_frame.content rides the shared page DomPort (S10)', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('subscribes dom + url through the page port over ONE platform observer; stop unsubscribes', async () => {
    const { start, stop } = await loadCommentFrame();
    const port = getPageDomPort();

    start();
    expect(port.subscriptionCount).toBe(2); // dom scan + url watcher
    expect(FakeMutationObserver.instances).toHaveLength(1);

    stop();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);
  });

  it('scans on mutations and ONE settle scan, never on timer advance alone (heartbeat deleted)', async () => {
    const { start, queryPostCards } = await loadCommentFrame();
    start();

    expect(queryPostCards).toHaveBeenCalledTimes(1); // initial scan at start
    queryPostCards.mockClear();

    vi.advanceTimersByTime(1400);
    expect(queryPostCards).not.toHaveBeenCalled(); // settle not due yet
    vi.advanceTimersByTime(200); // cross the ~1500ms settle mark
    expect(queryPostCards).toHaveBeenCalledTimes(1); // THE bounded settle scan

    queryPostCards.mockClear();
    vi.advanceTimersByTime(10_000); // the old 2500ms heartbeat would have fired ~4x
    expect(queryPostCards).not.toHaveBeenCalled();

    // Mutations still scan (rAF debounce flushed by advancing timers).
    FakeMutationObserver.instances[0]!.emit([{ type: 'childList', target: document.body }]);
    expect(queryPostCards).not.toHaveBeenCalled(); // rAF debounce pending
    vi.advanceTimersByTime(32);
    expect(queryPostCards).toHaveBeenCalledTimes(1);
  });

  it('stop cancels the pending settle scan and silences the observer', async () => {
    const { start, stop, queryPostCards } = await loadCommentFrame();

    start();
    stop();
    queryPostCards.mockClear();

    vi.advanceTimersByTime(5000); // settle (if leaked) + heartbeat would fire here
    expect(queryPostCards).not.toHaveBeenCalled();

    FakeMutationObserver.instances[0]!.emit([{ type: 'childList', target: document.body }]);
    vi.advanceTimersByTime(32);
    expect(queryPostCards).not.toHaveBeenCalled(); // unsubscribed
  });

  it('url changes still schedule the delayed rescan through the port', async () => {
    const { start, queryPostCards } = await loadCommentFrame();

    start();
    vi.advanceTimersByTime(1600); // flush the settle scan
    queryPostCards.mockClear();

    vi.stubGlobal('location', new URL('https://classroom.google.com/c/other'));
    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', target: document.documentElement },
    ]);
    vi.advanceTimersByTime(500);

    // 1 from the dom subscription's rAF scan + 1 from the url rescan at 500ms.
    expect(queryPostCards).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------------ */
/* edited_frame.content.ts                                             */
/* ------------------------------------------------------------------ */

async function loadEditedFrame() {
  vi.resetModules();
  const queryPostCards = vi.fn(
    () => Array.from(document.querySelectorAll<HTMLElement>('[data-stream-item-id]')),
  );
  const subscribeToGlobalState = vi.fn();

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
    createCommentBadge: vi.fn(() => document.createElement('div')),
    createEditedBadge: vi.fn(() => document.createElement('div')),
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
  vi.doMock('../entrypoints/content/post-card-utils', () => ({
    queryPostCards,
  }));
  // S10 T4: lifecycle suite — engine mode gate passes through (its own
  // suite is v4-mode-gate.test.ts).
  vi.doMock('../entrypoints/content/mode-gate', () => ({
    gateV1Stack: ({ start, stop }: { start: () => void; stop: () => void }) => ({ start, stop }),
  }));

  const mod = await import('../entrypoints/edited_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { mod, queryPostCards, start: calls[0], stop: calls[1] };
}

describe('edited_frame.content rides the shared page DomPort (S10)', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('subscribes dom + url through the page port over ONE platform observer; stop unsubscribes', async () => {
    const { start, stop } = await loadEditedFrame();
    const port = getPageDomPort();

    start();
    expect(port.subscriptionCount).toBe(2); // dom scan + url watcher
    expect(FakeMutationObserver.instances).toHaveLength(1);

    stop();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);
  });

  it('scans on mutations and ONE settle scan, never on timer advance alone (heartbeat deleted)', async () => {
    const { start, queryPostCards } = await loadEditedFrame();
    start();

    expect(queryPostCards).toHaveBeenCalledTimes(1); // initial scan at start
    queryPostCards.mockClear();

    vi.advanceTimersByTime(1400);
    expect(queryPostCards).not.toHaveBeenCalled(); // settle not due yet
    vi.advanceTimersByTime(200); // cross the ~1500ms settle mark
    expect(queryPostCards).toHaveBeenCalledTimes(1); // THE bounded settle scan

    queryPostCards.mockClear();
    vi.advanceTimersByTime(10_000); // the old 2500ms heartbeat would have fired ~4x
    expect(queryPostCards).not.toHaveBeenCalled();

    // Mutations still scan (rAF debounce flushed by advancing timers).
    FakeMutationObserver.instances[0]!.emit([{ type: 'childList', target: document.body }]);
    expect(queryPostCards).not.toHaveBeenCalled(); // rAF debounce pending
    vi.advanceTimersByTime(32);
    expect(queryPostCards).toHaveBeenCalledTimes(1);
  });

  it('stop cancels the pending settle scan and silences the observer', async () => {
    const { start, stop, queryPostCards } = await loadEditedFrame();

    start();
    stop();
    queryPostCards.mockClear();

    vi.advanceTimersByTime(5000); // settle (if leaked) + heartbeat would fire here
    expect(queryPostCards).not.toHaveBeenCalled();

    FakeMutationObserver.instances[0]!.emit([{ type: 'childList', target: document.body }]);
    vi.advanceTimersByTime(32);
    expect(queryPostCards).not.toHaveBeenCalled(); // unsubscribed
  });

  it('url changes still schedule both delayed rescans through the port', async () => {
    const { start, queryPostCards } = await loadEditedFrame();

    start();
    vi.advanceTimersByTime(1600); // flush the settle scan
    queryPostCards.mockClear();

    vi.stubGlobal('location', new URL('https://classroom.google.com/c/other'));
    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', target: document.documentElement },
    ]);
    vi.advanceTimersByTime(500);
    // 1 from the dom subscription's rAF scan + 1 from the 500ms url rescan.
    expect(queryPostCards).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000); // the second url rescan at 1500ms
    expect(queryPostCards).toHaveBeenCalledTimes(3);
  });
});

/* ------------------------------------------------------------------ */
/* One page, one observer across separate entrypoint module copies     */
/* ------------------------------------------------------------------ */

describe('S10: separate V1 entrypoint module copies share the window-anchored port', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('button injector + comment feature converge on ONE platform observer', async () => {
    const observers = await loadObservers();
    // A second resetModules world must still resolve the SAME page port.
    const comments = await loadCommentFrame();

    observers.mod.startCQD();
    comments.start();

    const port = getPageDomPort();
    expect(port.subscriptionCount).toBe(3); // button injector + comment dom + comment url
    expect(FakeMutationObserver.instances).toHaveLength(1);
  });
});
