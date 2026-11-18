// AUDIT REPRO (2026-11-16) — temporary, never committed.
// Each test passes when the DEFECT is present. Real modules under test:
// background/index.ts, download-handler.ts, state.ts, queue.ts, cleanup.ts,
// message-sender.ts, job-persistence.ts, history-store.ts. Only the browser
// host and unrelated side modules (icons, analytics, i18n) are faked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DRIVE_URL = 'https://drive.google.com/file/d/FILE123/view';
const EXT_ID = 'ext-id';

type Listener = (...args: any[]) => any;

async function boot(opts: { storage?: Record<string, unknown>; search?: (q: any) => any[] } = {}) {
  vi.resetModules();
  vi.doMock('../entrypoints/background/icon-manager', () => ({
    createIconUpdaters: () => ({ updateTabIcon: vi.fn(), updateGlobalIcon: vi.fn() }),
    isClassroomUrl: (url?: string | null) => !!url && /classroom\.google\.com/.test(url),
    setActionIcon: vi.fn(),
    setIconOverridePaths: vi.fn(),
    setIconOverrideImageData: vi.fn(),
    GRAY_ICON_PATHS: {},
  }));
  vi.doMock('../entrypoints/background/analytics-alarm', () => ({
    ensureAnalyticsAlarm: vi.fn(),
    checkAndCloseFileTab: vi.fn(),
  }));
  const recordSpy = vi.fn();
  vi.doMock('../entrypoints/utils/analytics', () => ({
    Analytics: { flush: vi.fn(async () => {}) },
    refreshRemoteAnalyticsConfig: vi.fn(async () => {}),
    recordDownloadEvent: recordSpy,
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({ t: (k: string) => k }));

  const c = chrome as any;
  const store: Record<string, unknown> = { extensionEnabled: true, ...(opts.storage ?? {}) };
  const pick = (keys: any) => {
    if (keys == null) return { ...store };
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const out: Record<string, unknown> = {};
    for (const k of list) if (k in store) out[k] = store[k];
    return out;
  };
  c.storage.local.get = vi.fn((keys: any, cb?: Listener) => {
    if (typeof cb === 'function') return void cb(pick(keys));
    return Promise.resolve(pick(keys));
  });
  c.storage.local.set = vi.fn((items: any, cb?: Listener) => {
    Object.assign(store, items);
    cb?.();
    return Promise.resolve();
  });

  const downloadCalls: Array<{ url: string; cb?: (id?: number) => void }> = [];
  let nextId = 1000;
  let deferStart = false;
  c.downloads.download = vi.fn((o: any, cb?: (id?: number) => void) => {
    downloadCalls.push({ url: o?.url, cb });
    if (!deferStart) cb?.(nextId++);
  });
  c.downloads.cancel = vi.fn((_id: number, cb?: Listener) => cb?.());
  c.downloads.erase = vi.fn((_f: object, cb?: Listener) => cb?.());
  c.downloads.removeFile = vi.fn((_id: number, cb?: Listener) => cb?.());
  c.downloads.search = vi.fn((q: any, cb: Listener) => cb(opts.search ? opts.search(q) : []));

  const msg: Listener[] = [];
  const changed: Listener[] = [];
  const naming: Listener[] = [];
  c.runtime.id = EXT_ID;
  c.runtime.lastError = undefined;
  c.runtime.onMessage.addListener = vi.fn((l: Listener) => msg.push(l));
  c.runtime.onInstalled = { addListener: vi.fn() };
  c.runtime.onUpdateAvailable = { addListener: vi.fn() };
  c.downloads.onChanged.addListener = vi.fn((l: Listener) => changed.push(l));
  c.downloads.onDeterminingFilename = { addListener: (l: Listener) => naming.push(l) };
  c.downloads.onCreated = { addListener: vi.fn() };
  const tabMessages: any[] = [];
  c.tabs.sendMessage = vi.fn((tabId: number, m: any, cb?: Listener) => {
    tabMessages.push({ tabId, ...m });
    cb?.();
  });

  const mod = await import('../entrypoints/background/index');
  (mod.default as unknown as () => void)();

  const send = (message: any, sender: any = { id: EXT_ID, tab: { id: 5 } }) => {
    const responses: any[] = [];
    for (const l of msg) l(message, sender, (r: any) => responses.push(r));
    return responses;
  };
  return {
    store,
    downloadCalls,
    tabMessages,
    recordSpy,
    send,
    setDeferStart: (v: boolean) => { deferStart = v; },
    nextId: () => nextId++,
    request: (requestId: string, url = DRIVE_URL, fileMeta: any = { name: 'lecture.pdf', ext: 'pdf' }) =>
      send({ type: 'CQD_DOWNLOAD', url, requestId, fileMeta }),
    change: (delta: any) => changed.forEach((l) => l(delta)),
    name: (item: any, suggest: Listener = vi.fn()) => { naming.forEach((l) => l(item, suggest)); return suggest; },
    statuses: (requestId: string) =>
      tabMessages.filter((m) => m.type === 'CQD_DOWNLOAD_STATUS' && m.requestId === requestId),
  };
}

describe('AUDIT REPRO — download lifecycle defects (pass = defect present)', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  it('D1-fixed: a mid-transfer failure after the filename handshake retries and settles honestly', async () => {
    const h = await boot();
    h.request('r1');
    expect(h.downloadCalls).toHaveLength(1);
    // Response headers arrive: Chrome asks for the filename. Bytes are NOT on
    // disk yet, so no success may be reported here.
    h.name({ id: 1000, url: h.downloadCalls[0].url, filename: 'lecture.pdf', mime: 'application/pdf' });
    expect(h.statuses('r1').map((s) => s.status)).not.toContain('success');

    // The network drops mid-transfer; each retried attempt fails the same way.
    let id = 1000;
    for (let i = 0; i < 4; i++) {
      h.change({ id, state: { current: 'interrupted' }, error: { current: 'NETWORK_FAILED' } });
      await vi.advanceTimersByTimeAsync(60_000);
      if (i < 3) id += 1; // the retry attempt's new download id
    }

    const last = h.statuses('r1').at(-1);
    expect(last).toMatchObject({ status: 'error', errorCode: 'NETWORK_FAILED' });
    expect(h.downloadCalls.length).toBeGreaterThan(1); // transient retries ran
    expect(h.recordSpy.mock.calls.filter(([e]) => e.status === 'fail').length).toBeGreaterThan(0);
    expect(((h.store.cqd_history_v1 as unknown[] | undefined) ?? []).length).toBeGreaterThan(0);
  });

  it('D2-fixed: a healthy long download with progress deltas is never cancelled at 150 s', async () => {
    let received = 0;
    const h = await boot({
      search: () => [{ id: 1000, state: 'in_progress', totalBytes: 10_000_000, bytesReceived: received, mime: 'video/mp4', filename: 'big-lecture.mp4' }],
    });
    h.request('r2');
    h.name({ id: 1000, url: h.downloadCalls[0].url, filename: 'big-lecture.mp4', mime: 'video/mp4' });
    // The transfer streams bytes for five minutes, well past the 150 s mark.
    for (let t = 15_000; t <= 300_000; t += 15_000) {
      await vi.advanceTimersByTimeAsync(15_000);
      received = t;
      h.change({ id: 1000, bytesReceived: { current: t } });
    }

    expect((chrome.downloads.cancel as any).mock.calls.map((c: any[]) => c[0])).not.toContain(1000);
    received = 10_000_000;
    h.change({ id: 1000, state: { current: 'complete' } });
    const last = h.statuses('r2').at(-1);
    expect(last).toMatchObject({ status: 'success' });
  });

  it('D2-guard: a stalled transfer with no deltas still times out honestly', async () => {
    const h = await boot();
    h.request('r2g');
    h.name({ id: 1000, url: h.downloadCalls[0].url, filename: 'big-lecture.mp4', mime: 'video/mp4' });
    // No progress deltas ever arrive: a genuinely stalled transfer.
    await vi.advanceTimersByTimeAsync(150_000);

    expect((chrome.downloads.cancel as any).mock.calls.map((c: any[]) => c[0])).toContain(1000);
    const last = h.statuses('r2g').at(-1);
    expect(last).toMatchObject({ status: 'error', errorCode: 'TIMEOUT' });
  });

  it('D3-fixed: queue wait never counts against the deadline; a 12-file batch loses nothing', async () => {
    const h = await boot();
    // Twelve DIFFERENT files — a batch, not duplicate requests.
    for (let i = 1; i <= 12; i++) h.request(`q${i}`, `https://drive.google.com/file/d/QFILE${i}/view`);
    expect(h.downloadCalls).toHaveLength(3); // concurrency cap

    // Every admitted download takes 60 s, then completes.
    const completed = new Set<number>();
    for (let t = 0; t < 300; t += 60) {
      await vi.advanceTimersByTimeAsync(60_000);
      const startedBeforeTick = h.downloadCalls.length; // downloads admitted now run the next 60 s
      for (let id = 1000; id < 1000 + startedBeforeTick; id++) {
        if (completed.has(id)) continue;
        completed.add(id);
        h.change({ id, state: { current: 'complete' } });
      }
    }
    const terminal = (n: number) => h.statuses(`q${n}`).at(-1);
    const ok = [...Array(12)].map((_, i) => terminal(i + 1)?.status === 'success').filter(Boolean).length;
    const timedOut = [...Array(12)].map((_, i) => terminal(i + 1)?.errorCode === 'TIMEOUT').filter(Boolean).length;
    expect(ok).toBe(12);
    expect(timedOut).toBe(0);
    expect(h.downloadCalls).toHaveLength(12); // every queued file started
  });

  it('D4-fixed: a cancel during the sweep start window kills the late-starting download', async () => {
    const h = await boot();
    h.request('r4');
    // First account is forbidden: the sweep starts the next account.
    h.setDeferStart(true);
    h.change({ id: 1000, state: { current: 'interrupted' }, error: { current: 'SERVER_FORBIDDEN' } });
    expect(h.downloadCalls).toHaveLength(2); // attempt 2 requested, callback not fired yet

    h.send({ type: 'CQD_CANCEL_DOWNLOAD', requestId: 'r4' }); // user cancels now
    (chrome.downloads.cancel as any).mockClear();
    h.downloadCalls[1].cb?.(1001); // browser start callback arrives after the cancel

    expect((chrome.downloads.cancel as any).mock.calls.map((c: any[]) => c[0])).toContain(1001);
  });

  it('D5-fixed: a popup-originated cancel tells the page the download was cancelled', async () => {
    const h = await boot();
    h.request('r5');
    h.send({ type: 'CQD_CANCEL_DOWNLOAD', requestId: 'r5' }, { id: EXT_ID }); // popup: no tab
    const statuses = h.statuses('r5');
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.at(-1)).toMatchObject({ status: 'cancelled' });
  });

  it('D6-fixed: reconcile reports downloads that finished while asleep and re-queues never-started ones', async () => {
    const job = {
      requestId: 'r6', startTime: Date.now(), originalUrl: DRIVE_URL, baseUrl: DRIVE_URL,
      isDrive: true, tabId: 5, attemptedAuthUsers: [0], currentDownloadId: 1000,
      fileMeta: { name: 'lecture.pdf', ext: 'pdf' },
    };
    const queuedJob = { ...job, requestId: 'r6-queued', currentDownloadId: undefined };
    const h = await boot({
      storage: { cqd_pending_jobs_v1: { r6: job, 'r6-queued': queuedJob } },
      search: () => [{ id: 1000, state: 'complete', mime: 'application/pdf' }],
    });
    // The completion event is what woke the worker (no pending is bound yet).
    h.change({ id: 1000, state: { current: 'complete' } });
    await vi.advanceTimersByTimeAsync(1_000); // reconcile settles + re-queues
    // The re-queued download now runs; let it finish.
    h.change({ id: 1000, state: { current: 'complete' } });
    await vi.advanceTimersByTimeAsync(1_000); // flush history writes

    // The finished file is reported and recorded.
    expect(h.statuses('r6').map((s) => s.status)).toContain('success');
    expect(((h.store.cqd_history_v1 as unknown[] | undefined) ?? []).length).toBeGreaterThan(0);
    // The queued request was re-queued: it started and settled successfully.
    expect(h.statuses('r6-queued').map((s) => s.status)).toContain('success');
    expect(h.downloadCalls.length).toBeGreaterThan(0);
    // The settled job left the persisted mirror.
    expect(Object.keys((h.store.cqd_pending_jobs_v1 as Record<string, unknown>) ?? {})).not.toContain('r6');
  });

  it('D7-fixed: a second request for a file already in flight is refused, not duplicated', async () => {
    const h = await boot();
    h.send({ type: 'CQD_DOWNLOAD', url: DRIVE_URL, requestId: 'r7a', fileMeta: { name: 'lecture.pdf', ext: 'pdf' } });
    expect(h.downloadCalls).toHaveLength(1);
    // Filename handshake happens for the first transfer; bytes still stream.
    h.name({ id: 1000, url: h.downloadCalls[0].url, filename: 'lecture.pdf', mime: 'application/pdf' });
    // The user clicks the same file again while the first copy is in flight.
    const second = h.send({ type: 'CQD_DOWNLOAD', url: DRIVE_URL, requestId: 'r7b', fileMeta: { name: 'lecture.pdf', ext: 'pdf' } });

    expect(h.downloadCalls).toHaveLength(1); // no second browser download
    expect(second[0]).toMatchObject({ started: false });
  });

  it('D8-fixed: re-download from history keeps the browser-suggested name', async () => {
    const h = await boot();
    h.send({ type: 'CQD_HISTORY_REDOWNLOAD', url: DRIVE_URL }, { id: EXT_ID });
    expect(h.downloadCalls).toHaveLength(1);
    // The browser already knows the name (server header / URL stem).
    const suggest = h.name({ id: 1000, url: h.downloadCalls[0].url, filename: 'Lecture 5.pdf', mime: 'application/pdf' });
    expect(suggest).toHaveBeenCalledWith(expect.objectContaining({ filename: 'Lecture 5.pdf' }));
  });
});

describe('AUDIT REPRO — bridge and API engine (pass = defect present)', () => {
  it('D9-fixed: the bridge settles a cancel as cancelled and never settles on progress ticks', async () => {
    vi.resetModules();
    const { mapStatusToOutcome, startBridgeDownloadService } = await import('../entrypoints/background/bridge-download-service');
    const { sendStatusToTab } = await import('../entrypoints/background/message-sender');
    expect(mapStatusToOutcome('cancelled' as any).status).toBe('cancelled');

    let handler: ((req: { requestId: string; payload?: unknown }) => void) | undefined;
    const worker = {
      respond: vi.fn(),
      onRequest: (h: (req: { requestId: string; payload?: unknown }) => void) => {
        handler = h;
        return () => {};
      },
    };
    startBridgeDownloadService(worker as any);

    // 'b9p' registers via a refusal — its blocked settle counts once, and
    // the exactly-once guard must keep later ticks from re-settling.
    handler!({ requestId: 'b9p', payload: {} });
    expect(worker.respond).toHaveBeenCalledTimes(1);
    sendStatusToTab({ requestId: 'b9p' } as any, 'progress');
    sendStatusToTab({ requestId: 'b9p' } as any, 'trying');
    expect(worker.respond).toHaveBeenCalledTimes(1);

    // 'b9c' starts for real (the chrome stub answers synchronously). A
    // mid-transfer progress tick must not settle it; the user cancel must.
    handler!({ requestId: 'b9c', payload: { file: { url: DRIVE_URL } } });
    sendStatusToTab({ requestId: 'b9c' } as any, 'progress');
    expect(worker.respond).toHaveBeenCalledTimes(1);
    sendStatusToTab({ requestId: 'b9c' } as any, 'cancelled');
    expect(worker.respond).toHaveBeenLastCalledWith('b9c', { status: 'cancelled' });
  });

  it('D10: API client turns HTTP 401 into an empty course, and caps a course at 3 pages', async () => {
    vi.resetModules();
    const { GoogleClassroomApiClient } = await import('../src/engines/v3/api/classroom-api-client');
    const { CourseInventoryService } = await import('../src/engines/v3/api/course-inventory');
    const tokens = { getAccessToken: async () => 'expired-token' };

    const fetch401 = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetch401);
    const inv = new CourseInventoryService(new GoogleClassroomApiClient(tokens as any));
    const snap = await inv.getInventory('course1', null);
    expect(snap).not.toBeNull(); // not the "Couldn't list files" path
    expect(snap!.files).toEqual([]); // user sees "No downloadable files found"
    await inv.getInventory('course1', null);
    expect(fetch401).toHaveBeenCalledTimes(2); // second call served from the 5-minute cache

    let n = 0;
    const fetchPaged = vi.fn(async (url: string) => {
      n += 1;
      const key = url.includes('courseWorkMaterials') ? 'courseWorkMaterial' : 'courseWork';
      return {
        ok: true,
        json: async () => ({
          [key]: [{ materials: [{ driveFile: { driveFile: { id: `f${n}`, title: `f${n}.pdf` } } }] }],
          nextPageToken: 'more', // the course always has another page
        }),
      };
    });
    vi.stubGlobal('fetch', fetchPaged);
    const files = await new GoogleClassroomApiClient(tokens as any).fetchCourseDriveFiles('course2', null);
    expect(fetchPaged).toHaveBeenCalledTimes(6); // 3 pages x 2 collections, then stop
    expect(files).toHaveLength(6); // remainder silently missing
    vi.unstubAllGlobals();
  });
});
