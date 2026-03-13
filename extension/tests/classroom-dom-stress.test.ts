import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryPostCards } from '../entrypoints/content/post-card-utils';

async function loadObserversModule() {
  vi.resetModules();
  const injectButtonIntoAttachment = vi.fn();
  const extractDriveUrlFromAnchor = vi.fn((anchor: HTMLAnchorElement) => anchor.href || null);
  const findDriveUrl = vi.fn(() => 'https://drive.google.com/file/d/STRESS');
  const injectStyles = vi.fn();

  const state = {
    scanTimeoutId: null as number | null,
    observer: null as MutationObserver | null,
    rescanIntervalId: null as number | null,
    effectiveEnabled: true,
    initialized: false
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
    DRIVE_ANCHOR_SELECTOR: 'a[href*="drive.google.com"], a[href*="docs.google.com"]',
    ATTACHMENT_CONTAINER_SELECTOR: '[data-attachment-id], .luto0c, .KlRXdf, [data-drive-id]',
    INJECTED_ATTR: 'data-cqd-injected',
    PROCESSED_ATTR: 'data-cqd-processed'
  }));
  vi.doMock('../entrypoints/content/button-factory', () => ({
    injectButtonIntoAttachment
  }));
  vi.doMock('../entrypoints/content/url-utils', () => ({
    extractDriveUrlFromAnchor,
    findDriveUrl
  }));
  vi.doMock('../entrypoints/content/styles', () => ({
    injectStyles
  }));

  const mod = await import('../entrypoints/content/observers');
  return { mod, injectButtonIntoAttachment };
}

describe('classroom DOM stress protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/stress'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects only on real attachment cards across a large mixed feed', async () => {
    const { mod, injectButtonIntoAttachment } = await loadObserversModule();
    const root = document.createElement('section');

    root.innerHTML = Array.from({ length: 120 }, (_, index) => `
      <article class="n4xnA JUr7jb" data-stream-item-id="stress-${index}">
        <div class="asQXV QRiHXd">
          <a href="https://docs.google.com/forms/d/e/FORM-${index}/viewform">Form ${index}</a>
          <a href="https://docs.google.com/spreadsheets/d/SHEET-${index}/edit?usp=sharing">Sheet ${index}</a>
          <a href="https://example.com/resource-${index}">External ${index}</a>
        </div>
        <div class="luto0c" data-attachment-id="att-${index}">
          <a
            class="VkhHKd e7EEH nQaZq"
            aria-label="Attachment: PDF: handout-${index}.pdf"
            href="https://drive.google.com/file/d/FILE-${index}/view?usp=classroom_web"
          >
            <div class="rzTfPe xSP5ic">
              <img src="//ssl.gstatic.com/docs/doclist/images/mediatype/icon_3_pdf_x16.png" alt="" />
            </div>
            <div class="YVvGBb VjRxGc">handout-${index}.pdf</div>
          </a>
        </div>
      </article>
    `).join('');

    document.body.appendChild(root);
    mod.injectSingleFileButtons(root);

    expect(injectButtonIntoAttachment).toHaveBeenCalledTimes(120);
    for (const [container] of injectButtonIntoAttachment.mock.calls) {
      expect((container as HTMLElement).getAttribute('data-attachment-id')).toMatch(/^att-/);
    }
  });

  it('keeps one visual card per stream item across a large nested feed', () => {
    document.body.innerHTML = Array.from({ length: 180 }, (_, index) => `
      <article class="n4xnA JUr7jb" data-stream-item-id="outer-${index}">
        <header class="IMvYId">
          <div class="meta-row">Edited Mar ${index + 1}</div>
        </header>
        <section class="n4xnA comment-shell">
          <div data-stream-item-id="outer-${index}" data-role="student"></div>
          <div data-stream-item-id="outer-${index}" jscontroller="h38nBf"></div>
          <div class="comment-count">${index + 1} class comments</div>
        </section>
      </article>
    `).join('');

    const cards = queryPostCards();

    expect(cards).toHaveLength(180);
    expect(cards.every((card) => card.matches('article[data-stream-item-id^="outer-"]'))).toBe(true);
  });

  it('collapses large nested root sets to the top-level container only', async () => {
    const { mod } = await loadObserversModule();
    const outer = document.createElement('section');
    const middle = document.createElement('div');
    const inner = document.createElement('div');
    outer.appendChild(middle);
    middle.appendChild(inner);

    const sibling = document.createElement('section');
    document.body.append(outer, sibling);

    const roots = new Set([outer, middle, inner, sibling]);
    const distinct = mod.getDistinctRoots(roots);

    expect(distinct).toHaveLength(2);
    expect(distinct).toContain(outer);
    expect(distinct).toContain(sibling);
  });
});
