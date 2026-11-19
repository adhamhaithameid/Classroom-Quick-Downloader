// filepath: extension/tests/v3-engine-base-files.test.ts
/**
 * ============================================================================
 * V3-BASE FILE WIRING — flag-gated API file reconciliation through EngineV3
 * ============================================================================
 *
 * Pins the EngineV3 wiring of the v3-base design (docs/audit/
 * 2026-11-18-v3-base-design.md, "Fallback matrix", flag ON = engineBase 'v3'):
 *
 *   (a)      API ok + single submission → the API attachment joins the
 *            tracked post's files; the Download All count/label path
 *            receives it (syncDownloadAllCount contract — data-cqd-group-
 *            count / .cqd-download-all-sub, v2-download-all-renderer
 *            count surfaces); NO single-file button for the anchor-less
 *            synthetic file.
 *   (a-cache) cache-first discovery: ONE client fetch across init + two
 *            fullScans (design perf pin — reconciliation adds no calls).
 *   flag OFF → zero behavior change (shipped default).
 *   (b-401)  ClassroomApiAuthError → init resolves, no error escapes, files
 *            stay DOM-only (silent fallback row).
 *   (b-list) snapshot with studentSubmissionId null → files unchanged
 *            (list view: no post-to-student mapping yet).
 *   2+ posts → files unchanged (ambiguous mapping skipped).
 *
 * Engine-side merge semantics (applyExternalFiles) and the pure merge rules
 * are pinned in v2-engine tests and v3-file-reconciler.test.ts respectively.
 *
 * Load idiom: v3-engine-api-corroboration.test.ts — vi.resetModules() +
 * dynamic imports so the engine-base flag, the registry mode and the mocked
 * api module hit the SAME module registry per test. The api mock keeps the
 * REAL ClassroomApiDiscoveryService (its cache is what (a-cache) pins) over
 * a counted mock client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { ViewKind } from '../src/engines/types';
import type { ClassroomApiRouteContext } from '../src/engines/v3/api/types';
import { ClassroomApiAuthError } from '../src/engines/v3/api/classroom-api-client';
import type { ClassroomApiClient } from '../src/engines/v3/api/types';

/** Single-submission route context (the mapping rule needs a mapped student). */
const CONTEXT: ClassroomApiRouteContext = {
  viewKind: ViewKind.STUDENT_WORK_TEACHER,
  courseId: 'COURSE_1',
  courseWorkId: 'WORK_1',
  authUser: null,
  studentSubmissionId: 'SUB_1',
};

/** List-view context — the sentinel teacher route resolves studentSubmissionId null. */
const LIST_CONTEXT: ClassroomApiRouteContext = { ...CONTEXT, studentSubmissionId: null };

const API_ATTACHMENT = {
  id: 'APIFILEccccPad20Chars0000',
  title: 'hidden.pdf',
  downloadUrl: 'https://drive.google.com/uc?export=download&id=APIFILEccccPad20Chars0000',
  source: 'driveFile' as const,
};

/** API_ATTACHMENT's url after the reconciler's DOM-parity conversion. */
const API_DIRECT_URL =
  'https://drive.usercontent.google.com/download?id=APIFILEccccPad20Chars0000&export=download&confirm=t';

/** Submission list the mock client answers with (the discovery service wraps
 *  it into a snapshot with fetchedAt = Date.now()). */
function makeSubmissions(): ClassroomApiSnapshot_Submissions {
  return [
    { id: 'SUB_1', state: 'TURNED_IN', attachments: [API_ATTACHMENT] },
  ];
}
type ClassroomApiSnapshot_Submissions = Array<{
  id: string;
  state?: string;
  attachments: Array<{ id: string; title: string; downloadUrl: string; source: 'driveFile' | 'link' | 'form' }>;
}>;

type Setup = {
  EngineV3: new () => import('../src/engines/v3/engine-v3').EngineV3;
  engineRegistry: import('../src/engines/engine-registry').EngineRegistry;
  fetchStudentSubmissions: Mock<ClassroomApiClient['fetchStudentSubmissions']>;
};

async function loadEngineWithApiMocks(config: {
  context?: ClassroomApiRouteContext;
  client?: ClassroomApiClient;
  enableFlag?: boolean;
} = {}): Promise<Setup> {
  vi.resetModules();

  const context = config.context ?? CONTEXT;
  // The counted fetch — (a-cache) reads it through the REAL discovery cache.
  const fetchImpl: ClassroomApiClient['fetchStudentSubmissions'] =
    config.client?.fetchStudentSubmissions ?? (async () => makeSubmissions());
  const fetchStudentSubmissions: Setup['fetchStudentSubmissions'] = vi.fn(fetchImpl);
  const client: ClassroomApiClient = {
    fetchStudentSubmissions,
    fetchCourseDriveFiles: vi.fn(async () => []),
  };
  const publishStudentWorkApiSnapshot = vi.fn();
  const resolveClassroomApiRouteContext = vi.fn(() => context);
  const getAuthToken = vi.fn(
    (_details: unknown, callback: (token: string) => void) => {
      callback('test-token');
    },
  );

  vi.stubGlobal('chrome', {
    identity: { getAuthToken: getAuthToken },
    runtime: { lastError: null },
  });

  // Real discovery service (cache-first) over the mocked client — the service
  // module is NOT mocked, only the composition root ('../src/engines/v3/api').
  const { ClassroomApiDiscoveryService } = await import(
    '../src/engines/v3/api/discovery-service'
  );

  vi.doMock('../src/engines/v3/api', () => ({
    createDefaultApiDiscoveryService: () =>
      new ClassroomApiDiscoveryService(client),
    publishStudentWorkApiSnapshot,
    resolveClassroomApiRouteContext,
    // csaa.5 shared budget — inert under test, resettable via destroy().
    sharedClassroomRateLimiter: { acquire: vi.fn(() => true), reset: vi.fn() },
  }));

  if (config.enableFlag) {
    const { setEngineBase } = await import('../src/engines/engine-base');
    setEngineBase('v3');
  }

  // The engine renders through the V2 render layer only as a PRIMARY engine
  // (renderDetectedFlags / renderPlacedButtons mode gate) — the production
  // flag-ON scenario is mode 'v3'.
  const { engineRegistry } = await import('../src/engines/engine-registry');
  engineRegistry.setMode('v3');

  const { EngineV3 } = await import('../src/engines/v3/engine-v3');
  return { EngineV3, engineRegistry, fetchStudentSubmissions };
}

/** Let the fullScan refresh chain (discover → publish → detector → reconcile)
 *  settle. Same idiom as v3-engine-api-corroboration.test.ts. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/** Synthetic attribute MutationRecord — same idiom as
 *  v2-engine-targeted-mutations.test.ts (attributeMutation helper). */
function attributeMutation(target: Element, attr: string): MutationRecord {
  return {
    type: 'attributes',
    addedNodes: [] as unknown as NodeList,
    removedNodes: [] as unknown as NodeList,
    target,
    attributeName: attr,
    attributeNamespace: null,
    nextSibling: null,
    previousSibling: null,
    oldValue: null,
  } as unknown as MutationRecord;
}

/** Student-work page fixture: one post card with TWO Drive anchors, so the
 *  DOM-only scan already renders the Download All button (threshold 2 for
 *  the student_work_teacher recipe) before the API file arrives. */
function seedStudentWorkPage(postIds: string[]): void {
  for (const id of postIds) {
    const post = document.createElement('article');
    post.setAttribute('data-stream-item-id', id);
    for (const driveId of [`DOM${id}AaaaaPad20Chars00000`, `DOM${id}BbbbbPad20Chars00000`]) {
      const anchor = document.createElement('a');
      anchor.setAttribute('data-drive-id', driveId);
      anchor.href = `https://drive.google.com/file/d/${driveId}/view`;
      anchor.textContent = `${driveId}.pdf`;
      post.appendChild(anchor);
    }
    document.body.appendChild(post);
  }
}

describe('EngineV3 v3-base file wiring (flag engineBase)', () => {
  let engine: import('../src/engines/v3/engine-v3').EngineV3 | null = null;

  beforeEach(() => {
    // GLOBAL fake timers are on (tests/setup.ts); the engine chain and the
    // staleness math read Date.now() — run real, like the corroboration test.
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
    engine = null;
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/SUB_1'),
    );
  });

  afterEach(() => {
    engine?.destroy();
    engine = null;
  });

  it('(a) flag ON: the API attachment joins the post, the Download All count receives it, no floating single button', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);

    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post).toBeDefined();

    // Union (design "Ruled decision"): 2 DOM files + 1 API attachment.
    expect(post!.files).toHaveLength(3);
    const apiFile = post!.files.find((f) => f.idSource === 'api-snapshot');
    expect(apiFile).toBeDefined();
    expect(apiFile!.canonicalId).toBe('drive-APIFILEccccPad20Chars0000');
    expect(apiFile!.name).toBe('hidden.pdf');
    // Converted to the DOM path's byte-serving endpoint (union-3 #3).
    expect(apiFile!.downloadUrl).toBe(API_DIRECT_URL);
    expect(apiFile!.element).toBe(post!.element);

    // Count contract: the download-all button's group count + label surfaces
    // include the API file (cleanupAndWirePosts → syncDownloadAllCount).
    const postEl = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"]');
    expect(postEl).not.toBeNull();
    const groupBtn = postEl!.querySelector<HTMLElement>(
      '[data-cqd-injected][data-cqd-file-id="download-all:post-1"]',
    );
    expect(groupBtn).not.toBeNull();
    expect(groupBtn!.getAttribute('data-cqd-group-count')).toBe('3');
    expect(groupBtn!.querySelector('.cqd-download-all-sub')?.textContent).toBe('3 files');
    expect(groupBtn!.getAttribute('aria-label')).toBe('Download all 3 files');

    // CRITICAL pin: no single-file button floats on the post for the
    // anchor-less synthetic file — placement decisions come only from files
    // with their own DOM anchor.
    expect(
      postEl!.querySelector('[data-cqd-injected][data-cqd-file-id="APIFILEccccPad20Chars0000"]'),
    ).toBeNull();
    const singleButtons = postEl!.querySelectorAll('[data-cqd-injected].cqd-download-btn');
    expect(singleButtons).toHaveLength(2);
  });

  it('(a-cache) cache-first: exactly ONE discovery fetch across init + two fullScans', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    engine.fullScan();
    await flushAsync();
    engine.fullScan();
    await flushAsync();

    // Reconciliation adds NO calls (design perf pin): the discovery cache
    // absorbs both fullScan refreshes.
    expect(setup.fetchStudentSubmissions).toHaveBeenCalledTimes(1);

    // And the union survives the re-scan chains (each fullScan re-applies).
    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(true);
  });

  it('(a-mutation) flag ON: a mutation re-ingest of the touched post keeps the API union (no count flap)', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(true);

    // A relevant attribute change inside the post resolves to THAT post
    // (targeted scan) — ingestPost re-discovers its files from the DOM and
    // wholesale-replaces post.files. The union must survive it.
    const anchor = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"] a');
    expect(anchor).not.toBeNull();
    engine.handleMutations([attributeMutation(anchor!, 'aria-label')]);

    const reingested = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(reingested!.files).toHaveLength(3);
    expect(
      reingested!.files.some(
        (f) => f.idSource === 'api-snapshot' && f.canonicalId === 'drive-APIFILEccccPad20Chars0000',
      ),
    ).toBe(true);

    // The Download All count/label still include the API file.
    const postEl = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"]');
    const groupBtn = postEl!.querySelector<HTMLElement>(
      '[data-cqd-injected][data-cqd-file-id="download-all:post-1"]',
    );
    expect(groupBtn).not.toBeNull();
    expect(groupBtn!.getAttribute('data-cqd-group-count')).toBe('3');
    expect(groupBtn!.querySelector('.cqd-download-all-sub')?.textContent).toBe('3 files');
  });

  it('flag OFF: post files stay DOM-only (zero behavior change pin)', async () => {
    const setup = await loadEngineWithApiMocks(); // default 'v2' — no setEngineBase call
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post).toBeDefined();
    expect(post!.files).toHaveLength(2);
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(false);
  });

  it('(b-401) discovery rejects ClassroomApiAuthError: init resolves, files stay DOM-only', async () => {
    const failingClient: ClassroomApiClient = {
      fetchStudentSubmissions: vi.fn(async () => {
        throw new ClassroomApiAuthError();
      }),
      fetchCourseDriveFiles: vi.fn(async () => []),
    };
    const setup = await loadEngineWithApiMocks({
      enableFlag: true,
      client: failingClient,
    });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    // No error escapes init — the refresh chain classifies the 401 as a
    // silent fallback (matrix row: "401 → DOM verbatim, none (silent)").
    await expect(
      engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal),
    ).resolves.not.toThrow();
    await flushAsync();

    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post).toBeDefined();
    expect(post!.files).toHaveLength(2);
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(false);
    expect(engine.getLatestApiSnapshot()).toBeNull();
  });

  it('(b-list) snapshot with studentSubmissionId null: files unchanged', async () => {
    const setup = await loadEngineWithApiMocks({
      enableFlag: true,
      context: LIST_CONTEXT,
    });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post).toBeDefined();
    expect(post!.files).toHaveLength(2);
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(false);
  });

  it('two tracked posts: files unchanged (ambiguous mapping skipped)', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1', 'post-2']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    expect(engine.getTrackedPosts()).toHaveLength(2);
    for (const post of engine.getTrackedPosts()) {
      expect(post.files.some((f) => f.idSource === 'api-snapshot')).toBe(false);
      expect(post.files).toHaveLength(2);
    }
  });
});

/** One-anchor student-work post: DOM alone is BELOW the group threshold (2). */
function seedSingleFilePost(id: string): void {
  const post = document.createElement('article');
  post.setAttribute('data-stream-item-id', id);
  const driveId = `DOM${id}AaaaaPad20Chars00000`;
  const anchor = document.createElement('a');
  anchor.setAttribute('data-drive-id', driveId);
  anchor.href = `https://drive.google.com/file/d/${driveId}/view`;
  anchor.textContent = `${driveId}.pdf`;
  post.appendChild(anchor);
  document.body.appendChild(post);
}

function groupButtonOf(id: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `[data-stream-item-id="${id}"] [data-cqd-injected][data-cqd-file-id="download-all:${id}"]`,
  );
}

describe('EngineV3 phase 2: download-all over the API union', () => {
  let engine: import('../src/engines/v3/engine-v3').EngineV3 | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
    engine = null;
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/SUB_1'),
    );
  });

  afterEach(() => {
    engine?.destroy();
    engine = null;
    vi.useRealTimers();
  });

  it('(threshold) flag ON: 1 DOM file + 1 API file clears the group threshold, label says 2 files', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedSingleFilePost('post-1');

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const groupBtn = groupButtonOf('post-1');
    expect(groupBtn).not.toBeNull();
    expect(groupBtn!.getAttribute('data-cqd-group-count')).toBe('2');
    expect(groupBtn!.querySelector('.cqd-download-all-sub')?.textContent).toBe('2 files');
    // Still no floating single button for the anchor-less API file.
    expect(
      document.querySelectorAll('[data-stream-item-id="post-1"] [data-cqd-injected].cqd-download-btn'),
    ).toHaveLength(1);
  });

  it('(threshold, flag OFF) 1 DOM file shows no group button (byte-identical pin)', async () => {
    const setup = await loadEngineWithApiMocks();
    seedSingleFilePost('post-1');

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    expect(groupButtonOf('post-1')).toBeNull();
  });

  it('(real browser) flag ON: the label still counts the union after the student-work sidecar stripped data-cqd-injected', async () => {
    // Real-Chromium E2E gap (v3-base-flag-on (a2)): the student-work sidecar
    // (cleanupStudentWorkFlags) removes data-cqd-injected from every element on
    // each scan, so the V2 button is rendered with the marker, loses it, and the
    // union (which lands after the API round trip) found no button to rewrite.
    let release: (v: ReturnType<typeof makeSubmissions>) => void = () => {};
    const gate = new Promise<ReturnType<typeof makeSubmissions>>((r) => {
      release = r;
    });
    const setup = await loadEngineWithApiMocks({
      enableFlag: true,
      client: {
        fetchStudentSubmissions: async () => gate,
        fetchCourseDriveFiles: async () => [],
      },
    });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    const initDone = engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    // DOM-only render happened: label says 2. Now the sidecar scan strips the marker.
    const before = document.querySelector<HTMLElement>('[data-cqd-file-id="download-all:post-1"]');
    expect(before?.getAttribute('data-cqd-group-count')).toBe('2');
    for (const el of document.querySelectorAll('[data-cqd-injected]')) {
      el.removeAttribute('data-cqd-injected');
    }

    release(makeSubmissions());
    await initDone;
    await flushAsync();

    const groupBtn = document.querySelector<HTMLElement>('[data-cqd-file-id="download-all:post-1"]');
    expect(groupBtn?.getAttribute('data-cqd-group-count')).toBe('3');
    expect(groupBtn?.getAttribute('aria-label')).toBe('Download all 3 files');
    expect(groupBtn?.querySelector('.cqd-download-all-sub')?.textContent).toBe('3 files');
  });

  it('(run) flag ON: the run downloads DOM files AND the API-only file with its Drive id', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const { createEventBus } = await import('../src/bus/event-bus');
    const { wireDownloadPath } = await import('../src/v2/render/download-controller');
    const { installDownloadAllController, handleDownloadAllClickV2, PER_FILE_STAGGER_MS } = await import(
      '../src/v2/render/download-all-controller'
    );
    const bus = createEventBus<import('../src/contracts/topics').PageTopicMap>();
    const requests: Array<{ fileId: string; url: string }> = [];
    bus.subscribe('download:requested', (p) => requests.push({ fileId: p.file.fileId, url: p.file.url }));
    wireDownloadPath(bus, { sendMessage: vi.fn() });
    installDownloadAllController({ sendMessage: vi.fn() });

    const groupBtn = groupButtonOf('post-1');
    expect(groupBtn!.getAttribute('data-cqd-group-count')).toBe('3');

    vi.useFakeTimers();
    // Direct call (the hotkey path): a script-made .click() is untrusted and
    // is not allowed to pull in API-only files (review 6 #4).
    handleDownloadAllClickV2('post-1', groupBtn!);
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS * 3);

    // Label said 3, the run does 3: nothing overstated.
    expect(requests).toHaveLength(3);
    const api = requests.find((r) => r.fileId === 'drive-APIFILEccccPad20Chars0000');
    expect(api).toBeDefined();
    expect(api!.url).toBe(API_DIRECT_URL);
  });

  it('(correction) flag ON: the inject-button correction keeps the union and the count', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const postEl = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"]')!;
    const v2 = (engine as unknown as {
      v2: { handleCorrection(item: unknown): boolean };
    }).v2;
    expect(
      v2.handleCorrection({
        id: 'c1',
        op: 'inject-button',
        priority: 'HIGH',
        postId: 'post-1',
        element: postEl,
        reason: 'test',
      }),
    ).toBe(true);

    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post!.files).toHaveLength(3);
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(true);
  });
});

describe('EngineV3 v3-base review fixes: union retention and canonical ids', () => {
  let engine: import('../src/engines/v3/engine-v3').EngineV3 | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
    engine = null;
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/SUB_1'),
    );
  });

  afterEach(() => {
    engine?.destroy();
    engine = null;
  });

  it('(1 stale-retention) a targeted re-scan AFTER the snapshot went stale keeps the API union', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    expect(engine.getTrackedPosts()[0].files).toHaveLength(3);

    // 200 s later the snapshot is past the 120 s bound: reconcileApiFiles
    // returns [] (no NEW adds), but already-merged files must be RETAINED.
    const later = Date.now() + 200_000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    const anchor = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"] a');
    engine.handleMutations([attributeMutation(anchor!, 'aria-label')]);

    const post = engine.getTrackedPosts().find((p) => p.id === 'post-1');
    expect(post!.files).toHaveLength(3);
    expect(post!.files.some((f) => f.idSource === 'api-snapshot')).toBe(true);
    expect(
      groupButtonOf('post-1')!.getAttribute('data-cqd-group-count'),
    ).toBe('3');
  });

  const SHARED_ID = 'SHAREDidPad20Chars000000';
  const sharedClient = (): ClassroomApiClient => ({
    fetchStudentSubmissions: vi.fn(async () => [
      {
        id: 'SUB_1',
        state: 'TURNED_IN',
        attachments: [
          {
            id: SHARED_ID,
            title: 'shared.pdf',
            downloadUrl: `https://drive.google.com/uc?export=download&id=${SHARED_ID}`,
            source: 'driveFile' as const,
          },
        ],
      },
    ]),
    fetchCourseDriveFiles: vi.fn(async () => []),
  });

  function addSharedAnchor(): void {
    const anchor = document.createElement('a');
    anchor.setAttribute('data-drive-id', SHARED_ID);
    anchor.href = `https://drive.google.com/file/d/${SHARED_ID}/view`;
    anchor.textContent = 'shared.pdf';
    document.querySelector('[data-stream-item-id="post-1"]')!.appendChild(anchor);
  }

  it('(2 DOM-then-API) a Drive id the DOM already tracked is not double counted', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true, client: sharedClient() });
    seedStudentWorkPage(['post-1']);
    addSharedAnchor();

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const files = engine.getTrackedPosts()[0].files;
    expect(files.filter((f) => f.canonicalId === `drive-${SHARED_ID}`)).toHaveLength(1);
    expect(files).toHaveLength(3);
    expect(groupButtonOf('post-1')!.getAttribute('data-cqd-group-count')).toBe('3');
  });

  it('(2 API-then-DOM) a DOM anchor that appears AFTER the API file is not double counted', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true, client: sharedClient() });
    seedStudentWorkPage(['post-1']);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    expect(engine.getTrackedPosts()[0].files).toHaveLength(3);

    addSharedAnchor();
    const anchor = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"] a');
    engine.handleMutations([attributeMutation(anchor!, 'aria-label')]);
    // The inject-button correction re-discovers the DOM (now holding the
    // shared id) and merges the carried API files: one id, one file.
    const postEl = document.querySelector<HTMLElement>('[data-stream-item-id="post-1"]')!;
    (engine as unknown as { v2: { handleCorrection(item: unknown): boolean } }).v2
      .handleCorrection({
        id: 'c2', op: 'inject-button', priority: 'HIGH', postId: 'post-1',
        element: postEl, reason: 'test',
      });

    const files = engine.getTrackedPosts()[0].files;
    expect(files.filter((f) => f.canonicalId === `drive-${SHARED_ID}`)).toHaveLength(1);
    expect(files).toHaveLength(3);
    expect(groupButtonOf('post-1')!.getAttribute('data-cqd-group-count')).toBe('3');
  });

  it('(2 open?id=) a DOM anchor with no /d/<id> and no data-drive-id is still deduped against the API file (union-3 #2)', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true, client: sharedClient() });
    seedStudentWorkPage(['post-1']);
    const anchor = document.createElement('a');
    anchor.href = `https://drive.google.com/open?id=${SHARED_ID}`;
    anchor.textContent = 'shared.pdf';
    document.querySelector('[data-stream-item-id="post-1"]')!.appendChild(anchor);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    await flushAsync();

    const files = engine.getTrackedPosts()[0].files;
    // The DOM file keeps its url- canonical (flag-OFF output unchanged) and the
    // API twin is NOT added: one Drive file, one entry.
    expect(files.some((f) => f.canonicalId.startsWith('url-'))).toBe(true);
    expect(files.some((f) => f.canonicalId === `drive-${SHARED_ID}`)).toBe(false);
    expect(files).toHaveLength(3);
    expect(groupButtonOf('post-1')!.getAttribute('data-cqd-group-count')).toBe('3');
  });

  it('(3 details) a details-view re-scan keeps API-only files and does not duplicate covered ids', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/details'));
    const addAnchor = (id: string): void => {
      const a = document.createElement('a');
      a.setAttribute('data-drive-id', id);
      a.href = `https://drive.google.com/file/d/${id}/view`;
      a.textContent = `${id}.pdf`;
      document.body.appendChild(a);
    };
    addAnchor('DETAILSaaaaPad20Chars0000');

    engine = new setup.EngineV3();
    await engine.init(ViewKind.ASSIGNMENT_DETAILS, new AbortController().signal);
    const v2 = (engine as unknown as {
      v2: {
        applyExternalFiles(id: string, files: unknown[]): number;
        fullScan(): void;
      };
    }).v2;
    const detailsId = 'details:/c/C/a/A/details';
    expect(engine.getTrackedPosts().some((p) => p.id === detailsId)).toBe(true);

    const apiFile = {
      canonicalId: `drive-APIONLYPad20Chars000000`,
      name: 'api.pdf',
      ext: 'pdf',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=APIONLYPad20Chars000000',
      element: document.body,
      idSource: 'api-snapshot' as const,
    };
    expect(v2.applyExternalFiles(detailsId, [apiFile])).toBe(1);

    addAnchor('DETAILSbbbbPad20Chars0000');
    v2.fullScan();

    const details = engine.getTrackedPosts().find((p) => p.id === detailsId);
    expect(details!.files.map((f) => f.canonicalId)).toContain('drive-APIONLYPad20Chars000000');
    const ids = details!.files.map((f) => f.canonicalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('(3 details, union-4 #2) a DOM open?id= anchor and the API twin of the same Drive file count once', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    vi.stubGlobal('location', new URL('https://classroom.google.com/c/C/a/A/details'));
    const seed = document.createElement('a');
    seed.setAttribute('data-drive-id', 'DETAILSseedPad20Chars000');
    seed.href = 'https://drive.google.com/file/d/DETAILSseedPad20Chars000/view';
    seed.textContent = 'seed.pdf';
    document.body.appendChild(seed);

    engine = new setup.EngineV3();
    await engine.init(ViewKind.ASSIGNMENT_DETAILS, new AbortController().signal);
    const v2 = (engine as unknown as {
      v2: { applyExternalFiles(id: string, files: unknown[]): number; fullScan(): void };
    }).v2;
    const detailsId = 'details:/c/C/a/A/details';
    const TWIN = 'TWINPad20Chars0000000000';
    expect(
      v2.applyExternalFiles(detailsId, [
        {
          canonicalId: `drive-${TWIN}`,
          name: 'twin.pdf',
          ext: 'pdf',
          downloadUrl: `https://drive.usercontent.google.com/download?id=${TWIN}&export=download&confirm=t`,
          element: document.body,
          idSource: 'api-snapshot' as const,
        },
      ]),
    ).toBe(1);

    // The same Drive file now shows up as a DOM anchor WITHOUT /d/<id> or
    // data-drive-id, so its canonical id is url-… while its download URL
    // names the Drive id.
    const open = document.createElement('a');
    open.href = `https://drive.google.com/open?id=${TWIN}`;
    open.textContent = 'twin.pdf';
    document.body.appendChild(open);
    v2.fullScan();

    const details = engine.getTrackedPosts().find((p) => p.id === detailsId)!;
    const twins = details.files.filter((f) => f.downloadUrl.includes(TWIN) || f.canonicalId.includes(TWIN));
    expect(twins).toHaveLength(1);
  });
});


describe('EngineV3 v3-base review fixes union-2: canonical compare, stale label, pruning', () => {
  let engine: import('../src/engines/v3/engine-v3').EngineV3 | null = null;

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    document.body.innerHTML = '';
    engine = null;
    vi.stubGlobal(
      'location',
      new URL('https://classroom.google.com/c/C/a/A/submissions/SUB_1'),
    );
  });

  afterEach(() => {
    engine?.destroy();
    engine = null;
    vi.doUnmock('../src/v2/render/download-all-controller');
  });

  type V2Internals = {
    postMap: Map<string, { files: Array<{ canonicalId: string; idSource: string }> }>;
    discoverFiles(el: HTMLElement): unknown[];
    applyExternalFiles(id: string, files: unknown[]): number;
    fullScan(): void;
    handleCorrection(item: unknown): boolean;
  };
  const v2Of = (e: unknown): V2Internals => (e as { v2: V2Internals }).v2;

  const RAW = 'RAWDOMID0000000000PAD20';
  const apiNode = (post: HTMLElement) => ({
    canonicalId: `drive-${RAW}`,
    name: 'raw.pdf',
    ext: 'pdf',
    downloadUrl: `https://drive.google.com/uc?export=download&id=${RAW}`,
    element: post,
    idSource: 'api-snapshot' as const,
  });
  const rawDomNode = (post: HTMLElement) => ({
    canonicalId: RAW, // unprefixed: the form the review feared a DOM path could emit
    name: 'raw.pdf',
    ext: 'pdf',
    downloadUrl: `https://drive.google.com/uc?export=download&id=${RAW}`,
    element: post,
    idSource: 'url-parse' as const,
  });

  it('(2 applyExternalFiles) an unprefixed DOM canonicalId blocks the drive-<id> API copy', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true, context: LIST_CONTEXT });
    seedStudentWorkPage(['post-1']);
    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    const post = engine.getTrackedPosts()[0];
    post.files.push(rawDomNode(post.element) as never);

    expect(v2Of(engine).applyExternalFiles('post-1', [apiNode(post.element)])).toBe(0);
    expect(post.files).toHaveLength(3);
  });

  it('(2 ingestPost re-scan) a DOM file with the unprefixed id replaces the kept API copy', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true, context: LIST_CONTEXT });
    seedStudentWorkPage(['post-1']);
    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    const v2 = v2Of(engine);
    const post = engine.getTrackedPosts()[0];
    expect(v2.applyExternalFiles('post-1', [apiNode(post.element)])).toBe(1);

    vi.spyOn(v2, 'discoverFiles').mockReturnValue([rawDomNode(post.element)]);
    v2.fullScan();

    const ids = engine.getTrackedPosts()[0].files.map((f) => f.canonicalId);
    expect(ids).toEqual([RAW]);
  });

  it('(2 correction) the inject-button correction drops the API copy of an unprefixed DOM id', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true, context: LIST_CONTEXT });
    seedStudentWorkPage(['post-1']);
    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    const v2 = v2Of(engine);
    const post = engine.getTrackedPosts()[0];
    v2.applyExternalFiles('post-1', [apiNode(post.element)]);

    vi.spyOn(v2, 'discoverFiles').mockReturnValue([rawDomNode(post.element)]);
    v2.handleCorrection({
      id: 'c3', op: 'inject-button', priority: 'HIGH', postId: 'post-1',
      element: post.element, reason: 'test',
    });

    expect(engine.getTrackedPosts()[0].files.map((f) => f.canonicalId)).toEqual([RAW]);
  });

  it('(3 stale label) after the post loses its API files the sidecar-stripped label follows the DOM count, then the button goes below threshold', async () => {
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);
    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    const v2 = v2Of(engine);
    const btn = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('[data-cqd-file-id="download-all:post-1"]');
    expect(btn()?.getAttribute('data-cqd-group-count')).toBe('3');

    // Sidecar strips the marker; the post then loses its API file (e.g. the
    // DOM found it, or a later snapshot no longer carries it).
    for (const el of document.querySelectorAll('[data-cqd-injected]')) {
      el.removeAttribute('data-cqd-injected');
    }
    const tracked = v2.postMap.get('post-1')!;
    tracked.files = tracked.files.filter((f) => f.idSource !== 'api-snapshot');
    v2.fullScan();
    expect(btn()?.getAttribute('data-cqd-group-count')).toBe('2');

    // One DOM anchor leaves: 1 file is below the threshold of 2 → removed.
    document.querySelector('[data-stream-item-id="post-1"] a')!.remove();
    for (const el of document.querySelectorAll('[data-cqd-injected]')) {
      el.removeAttribute('data-cqd-injected');
    }
    v2.fullScan();
    expect(btn()).toBeNull();
  });

  it('(7 prune) a post that leaves the page clears its API files from the group controller', async () => {
    const setSpy = vi.fn();
    vi.doMock('../src/v2/render/download-all-controller', async (orig) => {
      const mod = await orig<typeof import('../src/v2/render/download-all-controller')>();
      return { ...mod, setGroupApiFiles: setSpy };
    });
    const setup = await loadEngineWithApiMocks({ enableFlag: true });
    seedStudentWorkPage(['post-1']);
    engine = new setup.EngineV3();
    await engine.init(ViewKind.STUDENT_WORK_TEACHER, new AbortController().signal);
    expect(setSpy.mock.calls.some((c) => c[0] === 'post-1' && c[1].length === 1)).toBe(true);
    setSpy.mockClear();

    document.querySelector('[data-stream-item-id="post-1"]')!.remove();
    v2Of(engine).fullScan();

    expect(engine.getTrackedPosts()).toHaveLength(0);
    expect(setSpy).toHaveBeenCalledWith('post-1', []);
  });
});
