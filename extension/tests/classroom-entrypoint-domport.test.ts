// filepath: extension/tests/classroom-entrypoint-domport.test.ts
/**
 * S10 Task 3b — the remaining THREE Classroom-page entrypoints ride the
 * shared page DomPort. The download-all 4000ms interval and both
 * student-work 2000ms rescans are deleted: scans fire when mutation batches
 * are delivered through the ONE page observer and (download-all) on ONE
 * bounded settle scan after start — never on bare timer advance.
 *
 * The download-all per-button syncObserver family and per-post accordion
 * observer family are replaced by ONE fixed attribute-dispatch subscription
 * whose callback routes class/aria-expanded records to the same per-element
 * handlers — subscription counts stay FIXED while content scales.
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

/** The current test's stop callback — invoked in afterEach so no module's
 * scroll listeners/debounce state leak into the next test. */
let currentStop: (() => void) | null = null;

function mountStreamPost(id: string, fileIds: string[]): HTMLElement {
  const post = document.createElement('div');
  post.dataset.streamItemId = id;
  const header = document.createElement('div');
  header.className = 'N5dSp';
  post.appendChild(header);
  for (const fileId of fileIds) {
    const btn = document.createElement('button');
    btn.className = 'cqd-download-btn';
    btn.dataset.cqdUrl = `https://drive.google.com/file/d/${fileId}`;
    btn.innerHTML = '<span class="cqd-label">Download</span><span class="cqd-download-icon"></span>';
    post.appendChild(btn);
  }
  document.body.appendChild(post);
  return post;
}

function mountClassworkLi(id: string, fileIds: string[], ariaExpanded: string): HTMLElement {
  const li = document.createElement('li');
  li.dataset.streamItemId = id;
  li.classList.add('lXuxY');
  li.innerHTML = `
    <div class="N5dSp"></div>
    <div role="button" aria-expanded="${ariaExpanded}"></div>
    ${fileIds
      .map(
        (fileId) =>
          `<button class="cqd-download-btn" data-cqd-url="https://drive.google.com/file/d/${fileId}"></button>`,
      )
      .join('')}
  `;
  document.body.appendChild(li);
  return li;
}

function attachmentContainer(id: string, anchorAttrs: string): HTMLElement {
  const container = document.createElement('div');
  container.id = id;
  container.innerHTML = `<a ${anchorAttrs}>Attachment</a>`;
  document.body.appendChild(container);
  return container;
}

const byStatusLocation = () =>
  vi.stubGlobal(
    'location',
    new URL('https://classroom.google.com/c/C/a/A/submissions/by-status/and-sort-name/all/all'),
  );
const studentWorkLocation = () =>
  vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/submissions/student-1'));

/* ------------------------------------------------------------------ */
/* download_all.content.ts                                             */
/* ------------------------------------------------------------------ */

async function loadDownloadAll() {
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
  // S10 T4: lifecycle suite — engine mode gate passes through (its own
  // suite is v4-mode-gate.test.ts).
  vi.doMock('../entrypoints/content/mode-gate', () => ({
    gateV1Stack: ({ start, stop }: { start: () => void; stop: () => void }) => ({ start, stop }),
  }));

  const mod = await import('../entrypoints/download_all.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  currentStop = calls[1];
  return { start: calls[0], stop: calls[1] };
}

describe('download_all.content rides the shared page DomPort (S10 3b)', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.clearAllTimers();
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/123'));
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    currentStop?.();
    currentStop = null;
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('subscribes exactly TWO fixed subscriptions over ONE platform observer; stop unsubscribes both', async () => {
    mountStreamPost('p1', ['AAA', 'BBB']);
    mountStreamPost('p2', ['CCC', 'DDD']);
    const { start, stop } = await loadDownloadAll();
    const port = getPageDomPort();

    start();
    expect(port.subscriptionCount).toBe(2); // dom watcher + attribute dispatch
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(FakeMutationObserver.instances[0]!.observedTarget).toBe(document);

    // The settle scan renders both groups. The old code would have grown one
    // syncObserver + one accordion observer PER Download-All button; the
    // subscription count must stay FIXED as content scales.
    vi.advanceTimersByTime(1600);
    expect(document.querySelectorAll('.cqd-download-all-btn')).toHaveLength(2);
    expect(port.subscriptionCount).toBe(2);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    stop();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);
    expect(vi.getTimerCount()).toBe(0); // settle scan cancelled
  });

  it('renders via ONE bounded settle scan and NEVER on bare timer advance (4000ms interval deleted)', async () => {
    mountStreamPost('p1', ['AAA', 'BBB']);
    const { start, stop } = await loadDownloadAll();

    start();
    expect(document.querySelector('.cqd-download-all-btn')).toBeNull();
    expect(vi.getTimerCount()).toBe(1); // the settle scan — no recurring interval

    vi.advanceTimersByTime(1600);
    expect(document.querySelectorAll('.cqd-download-all-btn')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0); // settle flushed; nothing recurring installed

    vi.advanceTimersByTime(60_000); // the old 4000ms interval would have rescanned 15x
    expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelectorAll('.cqd-download-all-btn')).toHaveLength(1);

    stop();
  });

  it('registers buttons from childList mutations delivered through the port', async () => {
    const { start } = await loadDownloadAll();
    start();
    vi.advanceTimersByTime(1600); // flush the settle scan (empty page)

    const post = mountStreamPost('p9', ['EEE', 'FFF']);
    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', addedNodes: [post] as unknown as NodeList, target: document.body },
    ]);
    expect(document.querySelector('.cqd-download-all-btn')).toBeNull(); // refresh is rAF-debounced

    vi.advanceTimersByTime(16);
    expect(document.querySelectorAll('.cqd-download-all-btn')).toHaveLength(1);
  });

  it('dispatches class transitions per Download-All button and resets only that group', async () => {
    mountStreamPost('p1', ['AAA', 'BBB']);
    mountStreamPost('p2', ['CCC', 'DDD']);
    const { start } = await loadDownloadAll();
    start();
    vi.advanceTimersByTime(1600);

    const [btn1, btn2] = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.cqd-download-all-btn'),
    );
    const single1 = document.querySelector<HTMLButtonElement>(
      'div[data-stream-item-id="p1"] .cqd-download-btn',
    )!;
    const single2 = document.querySelector<HTMLButtonElement>(
      'div[data-stream-item-id="p2"] .cqd-download-btn',
    )!;

    // Entering a terminal state must NOT reset visuals (the deleted per-button
    // syncObserver only reset on terminal → idle).
    btn1.classList.add('cqd-all-success');
    FakeMutationObserver.instances[0]!.emit([
      { type: 'attributes', attributeName: 'class', target: btn1 },
    ]);
    expect(single1.querySelector('.cqd-label')!.textContent).toBe('Download');

    single1.classList.add('cqd-success');
    single1.querySelector('.cqd-label')!.textContent = 'Downloaded';

    btn1.classList.remove('cqd-all-success');
    FakeMutationObserver.instances[0]!.emit([
      { type: 'attributes', attributeName: 'class', target: btn1 },
    ]);

    // resetGroupVisuals(group1) fired: label back to idle, state classes gone.
    expect(single1.classList.contains('cqd-success')).toBe(false);
    expect(single1.querySelector('.cqd-label')!.textContent).toBe('download');
    // btn2's group untouched.
    expect(single2.querySelector('.cqd-label')!.textContent).toBe('Download');
    expect(single2.classList.contains('cqd-success')).toBe(false);
  });

  it('dispatches aria-expanded changes to the post button (accordion observers replaced)', async () => {
    mountClassworkLi('p3', ['GGG', 'HHH'], 'false');
    const { start } = await loadDownloadAll();
    start();
    vi.advanceTimersByTime(1600);

    const allBtn = document.querySelector<HTMLButtonElement>('.cqd-download-all-btn')!;
    expect(allBtn).not.toBeNull();
    // Initial visibility from the deleted accordion observer: collapsed → hidden.
    expect(allBtn.classList.contains('cqd-hidden')).toBe(true);

    const li = document.querySelector<HTMLElement>('li[data-stream-item-id="p3"]')!;
    const toggle = li.querySelector<HTMLElement>('[role="button"][aria-expanded]')!;

    toggle.setAttribute('aria-expanded', 'true');
    FakeMutationObserver.instances[0]!.emit([
      { type: 'attributes', attributeName: 'aria-expanded', target: toggle },
    ]);
    expect(allBtn.classList.contains('cqd-hidden')).toBe(false);

    toggle.setAttribute('aria-expanded', 'false');
    FakeMutationObserver.instances[0]!.emit([
      { type: 'attributes', attributeName: 'aria-expanded', target: toggle },
    ]);
    expect(allBtn.classList.contains('cqd-hidden')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* student_work_by_status.content.ts                                   */
/* ------------------------------------------------------------------ */

async function loadByStatus() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();
  const createStudentWorkButton = vi.fn((sourceUrl: string) => {
    const button = document.createElement('button');
    button.className = 'cqd-download-btn';
    button.dataset.cqdSwBs = 'true';
    button.dataset.cqdSwSourceUrl = sourceUrl;
    return button;
  });

  vi.doMock('../entrypoints/content/flags', () => ({ subscribeToGlobalState }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStudentWorkStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/file-meta', () => ({
    extractFileMeta: vi.fn(() => ({ name: 'F', ext: 'pdf', kind: 'other' })),
  }));
  vi.doMock('../src/student_work/button', () => ({ createStudentWorkButton }));
  vi.doMock('../src/download-all/group-manager', () => ({ registerButtonsInSubtree: vi.fn() }));
  vi.doMock('../src/download-all/refresh', () => ({ scheduleRefresh: vi.fn() }));
  // z57 tail: the student-work stacks are download-feature stacks and run in
  // every engine mode — they do not import the mode gate at all (its real
  // behavior is pinned in v4-mode-gate.test.ts).

  const mod = await import('../entrypoints/student_work_by_status.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  currentStop = calls[1];
  return { mod, createStudentWorkButton, start: calls[0], stop: calls[1] };
}

describe('student_work_by_status rides the shared page DomPort (S10 3b)', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.clearAllTimers();
    byStatusLocation();
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    currentStop?.();
    currentStop = null;
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('subscribes through the page port over ONE platform observer; stop unsubscribes', async () => {
    const { createStudentWorkButton, start, stop } = await loadByStatus();
    const port = getPageDomPort();

    start();
    expect(port.subscriptionCount).toBe(1);
    expect(FakeMutationObserver.instances).toHaveLength(1);
    expect(FakeMutationObserver.instances[0]!.observedTarget).toBe(document);

    stop();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);

    // Unsubscribed: mutations no longer inject.
    const container = attachmentContainer(
      'c1',
      'class="vwNuXe" aria-label="Attachment: Image: f.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123"',
    );
    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', addedNodes: [container] as unknown as NodeList, target: document.body },
    ]);
    vi.advanceTimersByTime(200);
    expect(createStudentWorkButton).not.toHaveBeenCalled();
  });

  it('scans mutations (debounced) and NEVER on bare timer advance (2000ms rescan deleted)', async () => {
    const { createStudentWorkButton, start } = await loadByStatus();
    const container = attachmentContainer(
      'c1',
      'class="vwNuXe" aria-label="Attachment: Image: f.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123"',
    );

    start();
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1); // initial scan

    // Classroom wipes the button with NO mutation — the deleted 2000ms rescan
    // would have re-injected; bare timer advance must not.
    document.querySelector<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw-bs="true"]')!.remove();
    vi.advanceTimersByTime(30_000);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0); // no interval installed

    // Mutations still scan: direct subtree pass, then the debounced full pass.
    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', addedNodes: [container] as unknown as NodeList, target: document.body },
    ]);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(130); // debounce fires; button already present
    expect(createStudentWorkButton).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('scroll still schedules the debounced scan', async () => {
    const { createStudentWorkButton, start } = await loadByStatus();
    start();

    attachmentContainer(
      'c1',
      'class="vwNuXe" aria-label="Attachment: Image: f.png" href="https://classroom.google.com/g/tg/c/a/s?id=FILE123"',
    );

    window.dispatchEvent(new Event('scroll'));
    expect(createStudentWorkButton).not.toHaveBeenCalled(); // debounce pending
    vi.advanceTimersByTime(130);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* student_work_sidecar.content.ts                                     */
/* ------------------------------------------------------------------ */

async function loadSidecar() {
  vi.resetModules();
  const subscribeToGlobalState = vi.fn();
  const createStudentWorkButton = vi.fn((sourceUrl: string) => {
    const button = document.createElement('button');
    button.className = 'cqd-download-btn';
    button.dataset.cqdSw = 'true';
    button.dataset.cqdSwSourceUrl = sourceUrl;
    return button;
  });

  vi.doMock('../entrypoints/content/flags', () => ({ subscribeToGlobalState }));
  vi.doMock('../entrypoints/content/styles', () => ({ injectStudentWorkStyles: vi.fn() }));
  vi.doMock('../entrypoints/content/file-meta', () => ({
    extractFileMeta: vi.fn(() => ({ name: 'F', ext: 'pdf', kind: 'other' })),
  }));
  vi.doMock('../src/student_work/button', () => ({ createStudentWorkButton }));

  // z57 tail: the student-work stacks are download-feature stacks and run in
  // every engine mode — they do not import the mode gate at all (its real
  // behavior is pinned in v4-mode-gate.test.ts).

  const mod = await import('../entrypoints/student_work_sidecar.content');
  (mod.default as unknown as { main: (ctx: unknown) => void }).main({});
  const calls = subscribeToGlobalState.mock.calls[0] as [() => void, () => void];
  currentStop = calls[1];
  return { mod, createStudentWorkButton, start: calls[0], stop: calls[1] };
}

describe('student_work_sidecar rides the shared page DomPort (S10 3b)', () => {
  beforeEach(() => {
    FakeMutationObserver.instances = [];
    document.body.innerHTML = '';
    delete portHost().__cqdDomPort;
    vi.clearAllTimers();
    studentWorkLocation();
    vi.stubGlobal('MutationObserver', FakeMutationObserver);
  });

  afterEach(() => {
    currentStop?.();
    currentStop = null;
    vi.unstubAllGlobals();
    delete portHost().__cqdDomPort;
  });

  it('subscribes through the page port over ONE platform observer; stop unsubscribes', async () => {
    const { createStudentWorkButton, start, stop } = await loadSidecar();
    const port = getPageDomPort();

    start();
    expect(port.subscriptionCount).toBe(1);
    expect(FakeMutationObserver.instances).toHaveLength(1);

    stop();
    expect(port.subscriptionCount).toBe(0);
    expect(FakeMutationObserver.instances[0]!.disconnectCount).toBe(1);

    const container = attachmentContainer(
      'c1',
      'href="https://classroom.google.com/g/tg/c/a/s?id=FILE123"',
    );
    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', addedNodes: [container] as unknown as NodeList, target: document.body },
    ]);
    vi.advanceTimersByTime(200);
    expect(createStudentWorkButton).not.toHaveBeenCalled();
  });

  it('scans mutations (debounced) and NEVER on bare timer advance (2000ms rescan deleted)', async () => {
    const { createStudentWorkButton, start } = await loadSidecar();
    const container = attachmentContainer(
      'c1',
      'href="https://classroom.google.com/g/tg/c/a/s?id=FILE123"',
    );

    start();
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1); // initial scan

    document.querySelector<HTMLButtonElement>('.cqd-download-btn[data-cqd-sw="true"]')!.remove();
    vi.advanceTimersByTime(30_000); // the deleted 2000ms rescan would re-inject
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    FakeMutationObserver.instances[0]!.emit([
      { type: 'childList', addedNodes: [container] as unknown as NodeList, target: document.body },
    ]);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(130);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('scroll still schedules the debounced scan', async () => {
    const { createStudentWorkButton, start } = await loadSidecar();
    start();

    attachmentContainer('c1', 'href="https://classroom.google.com/g/tg/c/a/s?id=FILE123"');

    window.dispatchEvent(new Event('scroll'));
    expect(createStudentWorkButton).not.toHaveBeenCalled(); // debounce pending
    vi.advanceTimersByTime(130);
    expect(createStudentWorkButton).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
