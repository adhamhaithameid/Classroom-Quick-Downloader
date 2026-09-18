// filepath: extension/tests/v4-mode-gate.test.ts
/**
 * S10 Task 4 — the engine-mode gate. The V1 self-starting stacks stay
 * inert while the engine mode is 'v2' (V2 renders), start normally on
 * every other mode ('legacy', 'shadow', and 'v3' — which the registry
 * runs as the V1+V2 shadow pair), and hot start/stop on live cqdV2Mode
 * storage flips. Uses the v1-entrypoint-domport.test.ts load idiom.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPageDomPort } from '../src/adapters/dom/mutation-observer-dom-port';
import { DEFAULT_MODE } from '../src/v2/orchestrator/mode-controller';

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

type OnChangedListener = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
) => void;

let onChangedListeners: OnChangedListener[] = [];

/** Point chrome.storage.local at a stored engine mode ('undefined' = empty). */
function storedMode(mode: string | undefined): void {
  chrome.storage.local.get = vi.fn().mockImplementation(
    (keys: unknown, cb?: (result: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> =
        mode === undefined ? {} : { cqdV2Mode: mode };
      if (typeof cb === 'function') {
        cb(result);
        return undefined;
      }
      return Promise.resolve(result);
    },
  );
}

beforeEach(() => {
  FakeMutationObserver.instances = [];
  document.body.innerHTML = '';
  delete portHost().__cqdDomPort;
  onChangedListeners = [];
  storedMode(undefined);
  chrome.storage.onChanged.addListener = vi.fn((cb: OnChangedListener) => {
    onChangedListeners.push(cb);
  });
  chrome.storage.onChanged.removeListener = vi.fn((cb: OnChangedListener) => {
    const index = onChangedListeners.indexOf(cb);
    if (index >= 0) onChangedListeners.splice(index, 1);
  });
  vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  vi.stubGlobal('MutationObserver', FakeMutationObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete portHost().__cqdDomPort;
});

/* ------------------------------------------------------------------ */
/* isV1Suppressed                                                      */
/* ------------------------------------------------------------------ */

describe('isV1Suppressed', () => {
  it('is true when cqdV2Mode is v2 (V2 renders, V1 stays inert)', async () => {
    vi.resetModules();
    storedMode('v2');
    const { isV1Suppressed } = await import('../entrypoints/content/mode-gate');
    await expect(isV1Suppressed()).resolves.toBe(true);
  });

  it('is false for legacy and shadow (V1 renders in both)', async () => {
    vi.resetModules();
    storedMode('legacy');
    const { isV1Suppressed } = await import('../entrypoints/content/mode-gate');
    await expect(isV1Suppressed()).resolves.toBe(false);

    storedMode('shadow');
    const { isV1Suppressed: again } = await import('../entrypoints/content/mode-gate');
    await expect(again()).resolves.toBe(false);
  });

  it('is false for v3 — the registry falls back to the V1+V2 shadow pair', async () => {
    vi.resetModules();
    storedMode('v3');
    const { isV1Suppressed } = await import('../entrypoints/content/mode-gate');
    await expect(isV1Suppressed()).resolves.toBe(false);
  });

  it('empty storage follows DEFAULT_MODE — v2 after the z57 parity flip', async () => {
    vi.resetModules();
    storedMode(undefined);
    const { isV1Suppressed } = await import('../entrypoints/content/mode-gate');
    // z57 (2026-09-17): the flip to 'v2' is restored — v2 owns the full
    // interactive download path now, so a fresh install lands on V2 and the
    // V1 self-starting stacks stay inert. Legacy remains the explicit
    // rollback mode via cqdV2Mode='legacy'.
    expect(DEFAULT_MODE).toBe('v2');
    await expect(isV1Suppressed()).resolves.toBe(true);
  });

  it('invalid stored value falls back to the default (v2 — V2 renders)', async () => {
    vi.resetModules();
    storedMode('not-a-mode');
    const { isV1Suppressed } = await import('../entrypoints/content/mode-gate');
    await expect(isV1Suppressed()).resolves.toBe(true);
  });

  it('storage read failure falls back to the default (v2 — V2 renders)', async () => {
    vi.resetModules();
    storedMode(undefined);
    chrome.storage.local.get = vi.fn(() => Promise.reject(new Error('quota exceeded')));
    const { isV1Suppressed } = await import('../entrypoints/content/mode-gate');
    await expect(isV1Suppressed()).resolves.toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* onEngineModeChange                                                  */
/* ------------------------------------------------------------------ */

describe('onEngineModeChange', () => {
  it('fires immediately with the current suppression (v2 → true)', async () => {
    vi.resetModules();
    storedMode('v2');
    const { onEngineModeChange } = await import('../entrypoints/content/mode-gate');
    const cb = vi.fn();
    onEngineModeChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(true);
  });

  it('fires immediately unsuppressed for legacy', async () => {
    vi.resetModules();
    storedMode('legacy');
    const { onEngineModeChange } = await import('../entrypoints/content/mode-gate');
    const cb = vi.fn();
    onEngineModeChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(false);
  });

  it('refires on cqdV2Mode storage changes and ignores other keys/areas', async () => {
    vi.resetModules();
    storedMode('v2');
    const { onEngineModeChange } = await import('../entrypoints/content/mode-gate');
    const cb = vi.fn();
    onEngineModeChange(cb);
    expect(cb).toHaveBeenCalledWith(true);

    // Flip to legacy → unsuppressed.
    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'legacy' } }, 'local');
    expect(cb).toHaveBeenLastCalledWith(false);

    // Flip back to v2 → suppressed.
    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'v2' } }, 'local');
    expect(cb).toHaveBeenLastCalledWith(true);

    // An invalid value falls back to the default (v2 → suppressed).
    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'garbage' } }, 'local');
    expect(cb).toHaveBeenLastCalledWith(true);

    // Other keys and other storage areas never fire.
    cb.mockClear();
    onChangedListeners[0]!({ unrelatedKey: { newValue: 'legacy' } }, 'local');
    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'legacy' } }, 'sync');
    expect(cb).not.toHaveBeenCalled();
  });

  it('unsubscribes: no further callbacks, removeListener invoked', async () => {
    vi.resetModules();
    storedMode('v2');
    const { onEngineModeChange } = await import('../entrypoints/content/mode-gate');
    const cb = vi.fn();
    const unsubscribe = onEngineModeChange(cb);
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();

    // The listener is gone — nothing left to fire, so no further callbacks.
    expect(onChangedListeners).toHaveLength(0);
    for (const listener of [...onChangedListeners]) {
      listener({ cqdV2Mode: { newValue: 'legacy' } }, 'local');
    }
    expect(cb).toHaveBeenCalledTimes(1);
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/* Gate integration: observers.ts scan stack                           */
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
    get effectiveEnabled() { return state.effectiveEnabled; },
    setEffectiveEnabled: (enabled: boolean) => { state.effectiveEnabled = enabled; },
    get initialized() { return state.initialized; },
    setInitialized: (next: boolean) => { state.initialized = next; },
    RESCAN_DEBOUNCE_MS: 1,
    CLASSROOM_URL_PATTERN: /^https:\/\/classroom\.google\.com\//,
    DRIVE_ANCHOR_SELECTOR: 'a[href*="drive.google.com"]',
    ATTACHMENT_CONTAINER_SELECTOR: '[data-attachment-id], .luto0c, .KlRXdf, [data-drive-id]',
    INJECTED_ATTR: 'data-cqd-injected',
    PROCESSED_ATTR: 'data-cqd-processed',
  }));
  const state = {
    scanTimeoutId: null as number | null,
    observer: null as MutationObserver | null,
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

  // NOTE: mode-gate is deliberately NOT mocked here — these tests exercise
  // the real gate against the fake chrome.storage.
  const mod = await import('../entrypoints/content/observers');
  return { mod, injectButtonIntoAttachment, injectStyles };
}

function mountCard(): void {
  const card = document.createElement('div');
  card.className = 'KlRXdf';
  card.innerHTML = '<a href="https://drive.google.com/file/d/123">Open</a>';
  document.body.appendChild(card);
}

describe('gate integration: observers.ts scan stack', () => {
  it('with mode v2, loading + startCQD starts NO scan stack', async () => {
    storedMode('v2');
    const { mod, injectButtonIntoAttachment } = await loadObservers();
    mountCard();

    mod.startCQD();
    vi.advanceTimersByTime(2000); // settle scan + debounce would have fired

    expect(getPageDomPort().subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances).toHaveLength(0);
    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
  });

  it('with mode legacy, startCQD starts the stack and scans', async () => {
    storedMode('legacy');
    const { mod, injectButtonIntoAttachment } = await loadObservers();
    mountCard();

    mod.startCQD();
    expect(getPageDomPort().subscriptionCount).toBe(1);

    vi.advanceTimersByTime(10); // flush the bounded settle scan (debounce 1ms)
    expect(injectButtonIntoAttachment).toHaveBeenCalled();
  });

  it('a live storage flip v2 → legacy hot-starts the stack', async () => {
    storedMode('v2');
    const { mod, injectButtonIntoAttachment } = await loadObservers();
    mountCard();

    mod.startCQD();
    vi.advanceTimersByTime(100);
    expect(getPageDomPort().subscriptionCount).toBe(0);

    storedMode('legacy'); // subsequent reads see legacy
    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'legacy' } }, 'local');

    expect(getPageDomPort().subscriptionCount).toBe(1);
    vi.advanceTimersByTime(10);
    expect(injectButtonIntoAttachment).toHaveBeenCalled();
  });

  it('a live storage flip legacy → v2 hot-stops the stack', async () => {
    storedMode('legacy');
    const { mod } = await loadObservers();

    mod.startCQD();
    expect(getPageDomPort().subscriptionCount).toBe(1);

    onChangedListeners[0]!({ cqdV2Mode: { newValue: 'v2' } }, 'local');

    expect(getPageDomPort().subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* z57 tail: student-work row stacks run in ALL modes                  */
/* ------------------------------------------------------------------ */

/**
 * The two student-work entrypoints are DOWNLOAD-FEATURE stacks (they
 * inject the row download buttons into Student Work submissions), not
 * V1 detection — qa-05 found zero row buttons in v2 because the S10 gate
 * suppressed them and v2 renders no row buttons of its own there. They
 * must start in EVERY engine mode, and a live mode flip must not stop
 * them. The detection stacks (observers, comment/edited frames) and the
 * V1 download-all stack stay gated. Load idiom: the domport suites'
 * doMock lists, but mode-gate is deliberately NOT mocked — these tests
 * exercise the real gate against the fake chrome.storage.
 */

const byStatusLocation = () =>
  vi.stubGlobal(
    'location',
    new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
  );
const studentWorkLocation = () =>
  vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/submissions/student-1'));

function makeSwButtonMarker(swBs: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'cqd-download-btn';
  if (swBs) button.dataset.cqdSwBs = 'true';
  else button.dataset.cqdSw = 'true';
  return button;
}

/** A submissions row card matching the student-work container contract. */
function mountSubmissionRow(): void {
  const card = document.createElement('div');
  card.className = 'WkZsyc';
  card.setAttribute('data-submission-attachment-id', 'att-1');
  card.innerHTML =
    '<a class="vwNuXe" aria-label="Attachment: Image: f.png" ' +
    'href="https://classroom.google.com/g/tg/c/a/s?id=FILE123">f.png</a>';
  document.body.appendChild(card);
}

async function loadByStatusStack() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();
  const createStudentWorkButton = vi.fn(() => makeSwButtonMarker(true));

  vi.doMock('../entrypoints/content/flags', () => ({ subscribeToGlobalState }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStudentWorkStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/file-meta', () => ({
    extractFileMeta: vi.fn(() => ({ name: 'F', ext: 'pdf', kind: 'other' })),
  }));
  vi.doMock('../src/student_work/button', () => ({ createStudentWorkButton }));
  vi.doMock('../src/download-all/group-manager', () => ({ registerButtonsInSubtree: vi.fn() }));
  vi.doMock('../src/download-all/refresh', () => ({ scheduleRefresh: vi.fn() }));

  const mod = await import('../entrypoints/student_work_by_status.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { createStudentWorkButton, start: calls[0], stop: calls[1] };
}

async function loadSidecarStack() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();
  const createStudentWorkButton = vi.fn(() => makeSwButtonMarker(false));

  vi.doMock('../entrypoints/content/flags', () => ({ subscribeToGlobalState }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStudentWorkStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/file-meta', () => ({
    extractFileMeta: vi.fn(() => ({ name: 'F', ext: 'pdf', kind: 'other' })),
  }));
  vi.doMock('../src/student_work/button', () => ({ createStudentWorkButton }));

  const mod = await import('../entrypoints/student_work_sidecar.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { createStudentWorkButton, start: calls[0], stop: calls[1] };
}

async function loadDownloadAllStack() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();

  vi.doMock('../entrypoints/content/styles', () => ({ injectStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/i18n', () => ({ t: (key: string) => key }));
  vi.doMock('../entrypoints/content/theme', () => ({ isPageDark: () => false }));
  vi.doMock('../entrypoints/content/icons', () => ({
    CANCEL_ICON_SVG_URL: 'cancel',
    DOWNLOAD_ICON_SVG_URL: 'download',
  }));
  vi.doMock('../entrypoints/content/tab-detector', () => ({
    isClassworkPost: () => false,
    isTopicView: () => false,
  }));
  vi.doMock('../entrypoints/content/flags', () => ({ subscribeToGlobalState }));
  vi.doMock('../entrypoints/utils/analytics', () => ({
    getCancelHoldDelayMs: vi.fn(async () => 1000),
  }));

  const mod = await import('../entrypoints/download_all.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { start: calls[0], stop: calls[1] };
}

async function loadCommentFrameStack() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();

  vi.doMock('../entrypoints/content/icons', () => ({ COMMENT_ICON_URL: 'comment' }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
    getCurrentCachedLanguage: () => 'en',
  }));
  vi.doMock('../entrypoints/content/smart-detector', () => ({
    detectComments: vi.fn(() => ({ count: 0 })),
  }));
  vi.doMock('../entrypoints/content/theme', () => ({ isPageDark: () => false }));
  vi.doMock('../entrypoints/content/flags', () => ({
    subscribeToGlobalState,
    createCommentBadge: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/both-badge', () => ({
    triggerPostClick: vi.fn(),
    upgradeCombinedBadge: vi.fn(),
    ATTR_COMMENT_COUNT: 'data-cqd-comment-count',
  }));
  vi.doMock('../entrypoints/content/pulse-effect', () => ({
    triggerPulseEffect: vi.fn(),
    markTargetElements: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/post-card-utils', () => ({
    queryPostCards: vi.fn(() => []),
  }));

  const mod = await import('../entrypoints/comment_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { start: calls[0], stop: calls[1] };
}

async function loadEditedFrameStack() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();

  vi.doMock('../entrypoints/content/icons', () => ({
    EDIT_ICON_SVG_RAW: 'edit',
    appendSvgFromString: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/theme', () => ({ isPageDark: () => false }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
    getCurrentCachedLanguage: () => 'en',
  }));
  vi.doMock('../entrypoints/content/smart-detector', () => ({
    detectEdited: vi.fn(() => ({ edited: false })),
  }));
  vi.doMock('../entrypoints/content/flags', () => ({
    subscribeToGlobalState,
    createEditedBadge: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/both-badge', () => ({
    triggerPostClick: vi.fn(),
    upgradeCombinedBadge: vi.fn(),
    ATTR_EDIT_DIFF: 'data-cqd-edit-diff',
  }));
  vi.doMock('../entrypoints/content/pulse-effect', () => ({
    triggerPulseEffect: vi.fn(),
    markTargetElements: vi.fn(),
  }));
  vi.doMock('../entrypoints/content/post-card-utils', () => ({
    queryPostCards: vi.fn(() => []),
  }));

  const mod = await import('../entrypoints/edited_frame.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  return { start: calls[0], stop: calls[1] };
}

describe('z57 tail: student-work row stacks run in ALL modes', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.clearAllTimers();
  });

  it('student_work_by_status STARTS in v2 — row buttons inject (gate bypassed)', async () => {
    byStatusLocation();
    storedMode('v2');
    const { createStudentWorkButton, start, stop } = await loadByStatusStack();
    mountSubmissionRow();

    start();

    expect(getPageDomPort().subscriptionCount).toBe(1);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.cqd-download-btn[data-cqd-sw-bs="true"]')).not.toBeNull();

    stop();
    expect(getPageDomPort().subscriptionCount).toBe(0);
  });

  it('student_work_by_status still starts in legacy (rollback sanity)', async () => {
    byStatusLocation();
    storedMode('legacy');
    const { createStudentWorkButton, start, stop } = await loadByStatusStack();
    mountSubmissionRow();

    start();

    expect(getPageDomPort().subscriptionCount).toBe(1);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);

    stop();
  });

  it('a live storage flip legacy → v2 does NOT touch student_work_by_status', async () => {
    byStatusLocation();
    storedMode('legacy');
    const { createStudentWorkButton, start, stop } = await loadByStatusStack();
    mountSubmissionRow();

    start();
    expect(getPageDomPort().subscriptionCount).toBe(1);

    // Download-feature stack: un-gated, it never subscribed to engine-mode
    // changes, so no flip listener exists to stop it. Fire any stray storage
    // listeners (there should be none from this stack) and assert survival.
    for (const listener of [...onChangedListeners]) {
      listener({ cqdV2Mode: { newValue: 'v2' } }, 'local');
    }

    expect(getPageDomPort().subscriptionCount).toBe(1);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.cqd-download-btn[data-cqd-sw-bs="true"]')).not.toBeNull();

    stop();
  });

  it('student_work_sidecar STARTS in v2 — row buttons inject (gate bypassed)', async () => {
    studentWorkLocation();
    storedMode('v2');
    const { createStudentWorkButton, start, stop } = await loadSidecarStack();
    mountSubmissionRow();

    start();

    expect(getPageDomPort().subscriptionCount).toBe(1);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.cqd-download-btn[data-cqd-sw="true"]')).not.toBeNull();

    stop();
    expect(getPageDomPort().subscriptionCount).toBe(0);
  });

  it('student_work_sidecar still starts in legacy (rollback sanity)', async () => {
    studentWorkLocation();
    storedMode('legacy');
    const { createStudentWorkButton, start, stop } = await loadSidecarStack();
    mountSubmissionRow();

    start();

    expect(getPageDomPort().subscriptionCount).toBe(1);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);

    stop();
  });

  it('download_all STAYS gated in v2 — no port subscriptions, no group controls', async () => {
    storedMode('v2');
    const { start, stop } = await loadDownloadAllStack();

    start();
    vi.advanceTimersByTime(1600); // the settle scan would have rendered groups

    expect(getPageDomPort().subscriptionCount).toBe(0);
    expect(document.querySelectorAll('.cqd-download-all-btn')).toHaveLength(0);

    stop();
  });

  it('download_all still serves legacy — V1 group machine is the rollback path', async () => {
    storedMode('legacy');
    const { start, stop } = await loadDownloadAllStack();

    start();
    expect(getPageDomPort().subscriptionCount).toBe(2); // dom watcher + attribute dispatch

    stop();
    expect(getPageDomPort().subscriptionCount).toBe(0);
  });

  it('comment_frame STAYS gated in v2 (detection stack)', async () => {
    storedMode('v2');
    const { start, stop } = await loadCommentFrameStack();

    start();

    expect(getPageDomPort().subscriptionCount).toBe(0);

    stop();
  });

  it('comment_frame still starts in legacy', async () => {
    storedMode('legacy');
    const { start, stop } = await loadCommentFrameStack();

    start();
    expect(getPageDomPort().subscriptionCount).toBe(2); // dom watcher + url watcher

    stop();
    expect(getPageDomPort().subscriptionCount).toBe(0);
  });

  it('edited_frame STAYS gated in v2 (detection stack)', async () => {
    storedMode('v2');
    const { start, stop } = await loadEditedFrameStack();

    start();

    expect(getPageDomPort().subscriptionCount).toBe(0);

    stop();
  });

  it('edited_frame still starts in legacy', async () => {
    storedMode('legacy');
    const { start, stop } = await loadEditedFrameStack();

    start();
    expect(getPageDomPort().subscriptionCount).toBe(2); // dom watcher + url watcher

    stop();
    expect(getPageDomPort().subscriptionCount).toBe(0);
  });
});
