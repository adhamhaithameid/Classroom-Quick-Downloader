/**
 * Mutation killers, round 3 (2026-11-19, after the second review round).
 * Each test names the Stryker mutant ids (BEFORE-run before3.json) it kills.
 * Targets: capability.ts, config.ts, token-source.ts, file-reconciler.ts and
 * download-all-controller.ts (bail rule + API file list).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPlainChromeUserAgent } from '../src/engines/v3/api/capability';
import { isApiConfigured, setNonChromeTokenSourceWired } from '../src/engines/v3/api/config';
import { setEngineBase } from '../src/engines/engine-base';
import { WebAuthFlowTokenSource } from '../src/engines/v3/api/token-source';
import { reconcileApiFiles } from '../src/engines/v3/file-reconciler';
import { ViewKind } from '../src/engines/types';
import type { PostNode } from '../src/engines/types';
import type { ClassroomApiSnapshot } from '../src/engines/v3/api/types';
import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import {
  wireDownloadPath,
  resetDownloadController,
  type DownloadRuntime,
} from '../src/v2/render/download-controller';
import {
  installDownloadAllController,
  uninstallDownloadAllController,
  resetDownloadAllController,
  handleDownloadAllClickV2,
  setGroupApiFiles,
  PER_FILE_STAGGER_MS,
} from '../src/v2/render/download-all-controller';

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('capability.ts killers (round 3)', () => {
  it('baseline: a plain Chrome UA is plain Chrome', () => {
    expect(isPlainChromeUserAgent(CHROME_UA)).toBe(true);
  });

  // mutant 32: /Edg[^A-Za-z]*\// no longer matches EdgA/ and EdgiOS/
  it.each([
    ['Edg/', `${CHROME_UA} Edg/131.0.0.0`],
    ['EdgA/ (mutant 32)', `${CHROME_UA} EdgA/131.0.0.0`],
    ['EdgiOS/ (mutant 32)', `${CHROME_UA} EdgiOS/131.0.0.0`],
  ])('%s is not plain Chrome', (_n, ua) => {
    expect(isPlainChromeUserAgent(ua)).toBe(false);
  });

  // mutants 33, 34: the Opera separator class [\s/] mutated to [^\s/] / [\S/]
  it.each([
    ['Opera/ slash (mutant 33)', `${CHROME_UA} Opera/9.80`],
    ['Opera space (mutants 33, 34)', `${CHROME_UA} Opera 12.16`],
    ['OPR/', `${CHROME_UA} OPR/110.0.0.0`],
  ])('%s is not plain Chrome', (_n, ua) => {
    expect(isPlainChromeUserAgent(ua)).toBe(false);
  });

  // mutant 26: typeof ua === 'string' && ... mutated to true && ...
  it('a non-string userAgent whose String() looks like Chrome is not plain Chrome (mutant 26)', () => {
    const hostile = { toString: () => 'Chrome/131.0.0.0' } as unknown as string;
    expect(isPlainChromeUserAgent(hostile)).toBe(false);
  });
});

describe('config.ts killers (round 3)', () => {
  afterEach(() => {
    setEngineBase('v2');
    setNonChromeTokenSourceWired(false);
  });

  // mutant 185: manifest.oauth2?.web_client_id -> manifest.oauth2.web_client_id
  it('a manifest without any oauth2 section on the web path is false, never a TypeError (mutant 185)', () => {
    setNonChromeTokenSourceWired(true);
    setEngineBase('v3');
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ permissions: ['identity'] }), sendMessage: () => {} },
    });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Firefox/133.0' });
    expect(() => isApiConfigured()).not.toThrow();
    expect(isApiConfigured()).toBe(false);
  });
});

describe('file-reconciler.ts killers (round 3)', () => {
  const NOW = 1_000_000_000;
  const URL_OK = 'https://drive.google.com/uc?id=F&export=download';

  function post(): PostNode {
    return {
      id: 'p',
      element: document.createElement('article'),
      viewKind: ViewKind.STUDENT_SUBMISSIONS,
      files: [],
      flags: null,
      lastScannedAt: 0,
    };
  }

  // mutant 434: attachment.source !== 'driveFile' -> false (no source filter)
  it("a 'link' / 'form' attachment with a valid Google URL is NOT reconciled (mutant 434)", () => {
    const snapshot = {
      fetchedAt: NOW,
      context: {
        viewKind: ViewKind.STUDENT_SUBMISSIONS,
        courseId: 'C',
        courseWorkId: 'W',
        authUser: null,
        studentSubmissionId: 'S',
      },
      submissions: [
        {
          id: 'S',
          attachments: [
            { id: 'L', title: 'l.pdf', downloadUrl: URL_OK, source: 'link' },
            { id: 'M', title: 'm.pdf', downloadUrl: URL_OK, source: 'form' },
            { id: 'D', title: 'd.pdf', downloadUrl: URL_OK, source: 'driveFile' },
          ],
        },
      ],
    } as ClassroomApiSnapshot;
    const out = reconcileApiFiles(snapshot, post(), NOW);
    expect(out.map((f) => f.canonicalId)).toEqual(['drive-D']);
  });
});

describe('token-source.ts killers (round 3, interactivity and in-flight)', () => {
  const REDIRECT = 'https://x.chromiumapp.org/';

  // The real PKCE digest resolves off the microtask queue; a synchronous-ish
  // stub keeps every flow step on microtasks so flush() is deterministic.
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      subtle: { digest: async () => new ArrayBuffer(32) },
      getRandomValues: (a: Uint8Array) => a,
    });
  });

  async function flush(): Promise<void> {
    for (let i = 0; i < 60; i++) await Promise.resolve();
  }

  function ctl() {
    const calls: Array<{ interactive: boolean; settle: (ok: boolean) => void }> = [];
    const clock = { t: 0 };
    let n = 0;
    const source = new WebAuthFlowTokenSource({
      getClientId: () => 'cid',
      getRedirectUrl: () => REDIRECT,
      launchWebAuthFlow: (d) =>
        new Promise((resolve) => {
          calls.push({
            interactive: d.interactive,
            settle: (ok) => {
              const state = new URL(d.url).searchParams.get('state') ?? '';
              resolve(ok ? `${REDIRECT}?state=${encodeURIComponent(state)}&code=c` : undefined);
            },
          });
        }),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ access_token: `at-${++n}`, expires_in: 61 }),
      }),
      randomBytes: (len) => new Uint8Array(len).fill(0xa5),
      now: () => clock.t,
      silentRetryCooldownMs: 60_000,
      log: () => {},
    });
    return { source, calls, clock };
  }

  // mutants 243, 284 (hadSession, removed in review round 3 finding 3): the
  // cooldown now covers the FIRST silent failure too, so the next silent call
  // answers null with no launch until the cooldown passes.
  it('a failed FIRST silent flow IS cooldown-gated: no relaunch until the cooldown passes (finding 3)', async () => {
    const { source, calls, clock } = ctl();
    const p1 = source.getToken(false);
    await flush();
    expect(calls).toHaveLength(1);
    calls[0].settle(false);
    expect(await p1).toBeNull();

    expect(await source.getToken(false)).toBeNull();
    await flush();
    expect(calls).toHaveLength(1); // cooldown answered null with no launch

    clock.t = 60_000; // exactly the cooldown: allowed again
    const p3 = source.getToken(false);
    await flush();
    expect(calls).toHaveLength(2);
    calls[1].settle(false);
    expect(await p3).toBeNull();
  });

  // mutants 270, 271 (silent + silent)
  it('a silent caller joining a pending SILENT flow never opens a window of its own (mutants 270, 271)', async () => {
    const { source, calls } = ctl();
    const p1 = source.getToken(false);
    await flush();
    const p2 = source.getToken(false);
    calls[0].settle(false);
    expect(await p1).toBeNull();
    await flush();
    expect(calls).toHaveLength(1);
    expect(await p2).toBeNull();
  });

  // mutant 271 (silent caller + interactive pending flow)
  it('a silent caller joining a pending INTERACTIVE flow shares it (mutant 271)', async () => {
    const { source, calls } = ctl();
    const p1 = source.getToken(true);
    await flush();
    const p2 = source.getToken(false);
    calls[0].settle(false);
    expect(await p1).toBeNull();
    await flush();
    expect(calls).toHaveLength(1);
    expect(await p2).toBeNull();
  });

  // mutants 271 (both interactive), 281 (interactive flow tracked as silent)
  it('two concurrent clicks share ONE window: the second does not reopen after a cancel (mutants 271, 281)', async () => {
    const { source, calls } = ctl();
    const p1 = source.getToken(true);
    await flush();
    const p2 = source.getToken(true);
    calls[0].settle(false);
    expect(await p1).toBeNull();
    await flush();
    expect(calls).toHaveLength(1);
    expect(await p2).toBeNull();
  });

  // mutant 277: the wrapped click flow tracked with interactive=false
  it('a click that queued behind a silent flow is itself shareable by a second click (mutant 277)', async () => {
    const { source, calls } = ctl();
    const silent = source.getToken(false);
    await flush();
    const a = source.getToken(true); // queues behind the silent flow
    const b = source.getToken(true); // must share a's wrapper
    calls[0].settle(false); // silent flow fails -> a's interactive window opens
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1].interactive).toBe(true);
    calls[1].settle(false);
    expect(await silent).toBeNull();
    expect(await a).toBeNull();
    expect(await b).toBeNull();
    await flush();
    expect(calls).toHaveLength(2); // a third window would be the bug
  });

  // mutant 304: the cooldown-path silent flow tracked with interactive=true
  it('a click arriving during a silent RE-AUTH still gets its own window afterwards (mutant 304)', async () => {
    const { source, calls, clock } = ctl();
    const first = source.getToken(true);
    await flush();
    calls[0].settle(true);
    expect(await first).toBe('at-1'); // expiresAt = 1000
    clock.t = 2000; // expired

    const silent = source.getToken(false);
    await flush();
    expect(calls).toHaveLength(2);
    expect(calls[1].interactive).toBe(false);

    const click = source.getToken(true);
    calls[1].settle(false); // silent re-auth fails
    await flush();
    expect(calls).toHaveLength(3); // the click's window; a shared flow would stop at 2
    expect(calls[2].interactive).toBe(true);
    calls[2].settle(true);
    expect(await silent).toBeNull();
    expect(await click).toBe('at-2');
  });

  // mutant 307: `if (this.inflight === pending)` -> true
  it('a settling old flow never clears a NEWER in-flight slot (mutant 307)', async () => {
    const { source, calls } = ctl();
    const silent = source.getToken(false);
    await flush();
    const a = source.getToken(true); // wrapper becomes the in-flight slot
    calls[0].settle(false); // silent settles; its finally must not clear the wrapper
    await flush();
    expect(calls).toHaveLength(2);
    const b = source.getToken(true); // must share the pending wrapper
    await flush();
    expect(calls).toHaveLength(2);
    calls[1].settle(false);
    expect(await silent).toBeNull();
    expect(await a).toBeNull();
    expect(await b).toBeNull();
  });
});

describe('download-all-controller.ts killers (round 3, API file list)', () => {
  const sendMessage = vi.fn();
  const runtime: DownloadRuntime & { sendMessage: ReturnType<typeof vi.fn> } = { sendMessage };
  let bus: ReturnType<typeof createEventBus<PageTopicMap>>;
  const requested: Array<PageTopicMap['download:requested']> = [];
  const URL_OF = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;

  function makePost(fileCount: number, postId = 'post-1') {
    const post = document.createElement('article');
    post.setAttribute('data-stream-item-id', postId);
    document.body.appendChild(post);
    for (let i = 0; i < fileCount; i++) {
      const btn = document.createElement('button');
      btn.className = 'cqd-download-btn';
      btn.setAttribute('data-cqd-file-id', `drive-file-${i}`);
      btn.setAttribute('data-cqd-injected', 'true');
      btn.innerHTML =
        '<span class="cqd-download-icon"></span><span class="cqd-label">Download</span><span class="cqd-error-detail"></span>';
      btn.dataset.cqdUrl = URL_OF(`file-${i}`);
      btn.dataset.cqdName = `f${i}.pdf`;
      btn.dataset.cqdExt = 'pdf';
      post.appendChild(btn);
    }
    const group = document.createElement('button');
    group.className = 'cqd-download-all-btn';
    group.setAttribute('data-cqd-file-id', `download-all:${postId}`);
    group.setAttribute('data-cqd-injected', 'true');
    group.innerHTML =
      '<span class="cqd-icon-wrapper cqd-download-all-icon-wrapper"><span class="cqd-download-all-icon"></span></span>' +
      '<span class="cqd-download-all-main">Download all</span><span class="cqd-download-all-sub"></span>';
    group.dataset.cqdGroupCount = String(fileCount);
    post.appendChild(group);
    return group;
  }

  const sub = (g: HTMLElement) => g.querySelector('.cqd-download-all-sub')?.textContent;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    requested.length = 0;
    sendMessage.mockClear();
    resetDownloadController();
    resetDownloadAllController();
    uninstallDownloadAllController();
    bus = createEventBus<PageTopicMap>();
    wireDownloadPath(bus, runtime);
    installDownloadAllController(runtime);
    bus.subscribe('download:requested', (p) => requested.push(p));
  });

  afterEach(() => {
    uninstallDownloadAllController();
    resetDownloadController();
    vi.useRealTimers();
  });

  // mutant 452: apiFilesByPost.delete(postId) removed from the empty-list branch
  it('setGroupApiFiles(post, []) forgets the earlier API files (mutant 452)', () => {
    const group = makePost(1);
    setGroupApiFiles('post-1', [{ fileId: 'API_1', url: URL_OF('API_1'), name: 'a.pdf', ext: 'pdf' }]);
    setGroupApiFiles('post-1', []);
    handleDownloadAllClickV2('post-1', group);
    expect(sub(group)).toBe('0 → 1');
  });

  // mutants 476, 477: the empty-id / empty-url guard
  it('an API file with an empty id is not part of the run (mutants 476, 477)', () => {
    const group = makePost(1);
    setGroupApiFiles('post-1', [{ fileId: '', url: URL_OF('x'), name: 'a.pdf', ext: 'pdf' }]);
    handleDownloadAllClickV2('post-1', group);
    expect(sub(group)).toBe('0 → 1');
  });

  it('an API file with an empty url is not part of the run (mutants 476, 477)', () => {
    const group = makePost(1);
    setGroupApiFiles('post-1', [{ fileId: 'API_2', url: '', name: 'a.pdf', ext: 'pdf' }]);
    handleDownloadAllClickV2('post-1', group);
    expect(sub(group)).toBe('0 → 1');
  });

  // mutant 480: seen.add(api.fileId) removed
  it('two API files with the same id are one download (mutant 480)', () => {
    const group = makePost(0);
    group.dataset.cqdGroupCount = '2';
    const f = { fileId: 'API_3', url: URL_OF('API_3'), name: 'a.pdf', ext: 'pdf' };
    setGroupApiFiles('post-1', [f, { ...f }]);
    handleDownloadAllClickV2('post-1', group);
    expect(sub(group)).toBe('0 → 1');
  });

  // mutant 484: state: 'pending' -> ''
  it('an API file that has not started yet keeps the group busy (mutant 484)', () => {
    const group = makePost(1);
    setGroupApiFiles('post-1', [{ fileId: 'API_4', url: URL_OF('API_4'), name: 'a.pdf', ext: 'pdf' }]);
    handleDownloadAllClickV2('post-1', group);
    expect(requested).toHaveLength(1); // the DOM file starts on the click
    bus.publish('download:settled', {
      requestId: requested[0].requestId,
      outcome: { status: 'saved' },
    });
    // The API file is still waiting for its stagger slot: pending counts as busy.
    expect(group.classList.contains('cqd-all-busy')).toBe(true);
    expect(group.classList.contains('cqd-all-success')).toBe(false);
    expect(sub(group)).toBe('1 → 2');
    vi.advanceTimersByTime(PER_FILE_STAGGER_MS);
    expect(requested).toHaveLength(2);
  });
});
