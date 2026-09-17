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
