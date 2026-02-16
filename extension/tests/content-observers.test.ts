import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadObserversModule() {
  vi.resetModules();
  const injectButtonIntoAttachment = vi.fn();
  const extractDriveUrlFromAnchor = vi.fn((anchor: HTMLAnchorElement) => anchor.href || null);
  const findDriveUrl = vi.fn(() => 'https://drive.google.com/file/d/abc');
  const injectStyles = vi.fn();

  const state = {
    scanTimeoutId: null as number | null,
    observer: null as MutationObserver | null,
    rescanIntervalId: null as number | null,
    effectiveEnabled: true,
    initialized: false,
  };

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
    ATTACHMENT_CONTAINER_SELECTOR: '.KlRXdf, [data-drive-id]',
    INJECTED_ATTR: 'data-cqd-injected',
    PROCESSED_ATTR: 'data-cqd-processed',
  }));
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

  const mod = await import('../entrypoints/content/observers');
  return {
    mod,
    state,
    injectButtonIntoAttachment,
    extractDriveUrlFromAnchor,
    findDriveUrl,
    injectStyles,
  };
}

describe('content/observers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects classroom URLs', async () => {
    const { mod } = await loadObserversModule();
    expect(mod.isGoogleClassroom()).toBe(true);
    vi.stubGlobal('location', new URL('https://example.com'));
    expect(mod.isGoogleClassroom()).toBe(false);
  });

  it('injects buttons for drive anchors and metadata elements', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="KlRXdf"><a href="https://drive.google.com/file/d/abc/view">Open</a></div>
      <div data-drive-id="abc"></div>
    `;
    document.body.appendChild(root);

    mod.injectSingleFileButtons(root);
    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(2);
  });

  it('scanForAttachments respects effectiveEnabled state', async () => {
    const { mod, state, injectButtonIntoAttachment } = await loadObserversModule();
    const root = document.createElement('div');
    root.innerHTML = '<div class="KlRXdf"><a href="https://drive.google.com/file/d/abc/view">Open</a></div>';
    document.body.appendChild(root);

    state.effectiveEnabled = false;
    mod.scanForAttachments(root);
    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();

    state.effectiveEnabled = true;
    mod.scanForAttachments(root);
    expect(injectButtonIntoAttachment).toHaveBeenCalled();
  });

  it('startCQD and stopCQD toggle lifecycle + notify background', async () => {
    const { mod, state, injectStyles } = await loadObserversModule();
    const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');

    mod.startCQD();
    expect(state.initialized).toBe(true);
    expect(injectStyles).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CQD_EFFECTIVE_STATE_CHANGED',
      enabled: true,
    }));

    mod.stopCQD();
    expect(state.initialized).toBe(false);
    expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CQD_EFFECTIVE_STATE_CHANGED',
      enabled: false,
    }));
  });

  it('deduplicates roots in MutationObserver callback', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();

    // Mock MutationObserver
    let callback: (records: MutationRecord[], observer: MutationObserver) => void;
    const observeFn = vi.fn();
    const disconnectFn = vi.fn();

    vi.stubGlobal('MutationObserver', class {
      constructor(cb: any) {
        callback = cb;
      }
      observe = observeFn;
      disconnect = disconnectFn;
    });

    // Setup observers
    mod.setupObservers();
    expect(callback!).toBeDefined();

    // Create a parent with a drive link and a child with a drive link
    const parent = document.createElement('div');
    parent.innerHTML = '<a href="https://drive.google.com/file/d/123">Link 1</a>';
    const child = document.createElement('div');
    child.innerHTML = '<a href="https://drive.google.com/file/d/456">Link 2</a>';
    parent.appendChild(child);

    // Simulate mutation where parent is added (so child is implicitly added)
    // AND child is explicitly reported as added (which happens sometimes)
    const records: Partial<MutationRecord>[] = [
      {
        type: 'childList',
        addedNodes: [parent] as any,
        target: document.body,
      },
      {
        type: 'childList',
        addedNodes: [child] as any,
        target: parent,
      }
    ];

    // Trigger callback
    callback!(records as MutationRecord[], {} as MutationObserver);

    // Wait for scan debounce/timeout if any, but setupObservers calls scanForAttachments synchronously inside callback?
    // Wait, scanForAttachments calls injectSingleFileButtons synchronously.
    // However, setupObservers might scheduleScan if roots is empty.
    // But here we have roots. So it calls scanForAttachments immediately.

    // If deduplication works, scanForAttachments is called only for parent.
    // injectSingleFileButtons(parent) finds both links.
    // So injectButtonIntoAttachment called 2 times.

    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(2);
    expect(injectButtonIntoAttachment).toHaveBeenCalledWith(expect.anything(), 'https://drive.google.com/file/d/123');
    expect(injectButtonIntoAttachment).toHaveBeenCalledWith(expect.anything(), 'https://drive.google.com/file/d/456');
  });
});
