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
    expect(apiFile!.canonicalId).toBe('APIFILEccccPad20Chars0000');
    expect(apiFile!.name).toBe('hidden.pdf');
    expect(apiFile!.downloadUrl).toBe(API_ATTACHMENT.downloadUrl);
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
        (f) => f.idSource === 'api-snapshot' && f.canonicalId === 'APIFILEccccPad20Chars0000',
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
