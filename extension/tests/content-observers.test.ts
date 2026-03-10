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
    ATTACHMENT_CONTAINER_SELECTOR: '[data-attachment-id], .luto0c, .KlRXdf, [data-drive-id]',
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

  it('injects buttons for Classroom material attachment cards', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="luto0c" data-attachment-id="a-1">
        <a
          class="VkhHKd e7EEH nQaZq"
          aria-label="Attachment: PDF: CNN q.pdf"
          href="https://drive.google.com/file/d/abc/view?usp=classroom_web&authuser=0"
        >
          <div class="rzTfPe xSP5ic"><img src="//ssl.gstatic.com/docs/doclist/images/mediatype/icon_3_pdf_x16.png" /></div>
          <div class="YVvGBb VjRxGc">CNN q.pdf</div>
        </a>
      </div>
    `;
    document.body.appendChild(root);

    mod.injectSingleFileButtons(root);
    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(1);
    expect(injectButtonIntoAttachment).toHaveBeenCalledWith(
      root.querySelector('.luto0c'),
      'https://drive.google.com/file/d/abc/view?usp=classroom_web&authuser=0',
    );
  });

  it('ignores bare post-body links that are not inside attachment containers', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();
    const root = document.createElement('div');
    root.innerHTML = `
      <p>
        <a href="https://docs.google.com/forms/d/1M3u5g0b2T4p_XIW28TODxnfknP4CAzHqmwjVkl5GljI/viewform">Form</a>
        <a href="https://docs.google.com/spreadsheets/d/163qjQTcw2skYB8oWJ4FgfwdOvGP9jGUhUSdEYlccrts/edit?gid=0#gid=0">Sheet</a>
        <a href="https://drive.google.com/file/d/abc/view">Loose Drive Link</a>
      </p>
    `;
    document.body.appendChild(root);

    mod.injectSingleFileButtons(root);
    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
  });

  it('does not inject buttons for Forms or Sheets even inside attachment-like wrappers', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="luto0c" data-attachment-id="form-1">
        <a aria-label="Attachment: Google Form" href="https://docs.google.com/forms/d/e/1FAIpQLSdZBCCxLrM0oZiJF2QEFBR4RdhBj_byOSGFBD5rs74U8XaAWw/viewform?usp=dialog">
          Form
        </a>
      </div>
      <div class="luto0c" data-attachment-id="sheet-1">
        <a aria-label="Attachment: Google Sheet" href="https://docs.google.com/spreadsheets/d/1BigjQBFGGYLQr3N1i6mlLX7SDFIx1FuwvVb-8NU62Fs/edit?usp=sharing">
          Sheet
        </a>
      </div>
    `;
    document.body.appendChild(root);

    mod.injectSingleFileButtons(root);
    expect(injectButtonIntoAttachment).not.toHaveBeenCalled();
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
    parent.innerHTML = '<div class="KlRXdf"><a href="https://drive.google.com/file/d/123">Link 1</a></div>';
    const child = document.createElement('div');
    child.innerHTML = '<div class="KlRXdf"><a href="https://drive.google.com/file/d/456">Link 2</a></div>';
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
