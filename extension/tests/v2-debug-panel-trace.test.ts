// filepath: extension/tests/v2-debug-panel-trace.test.ts
/**
 * Tests for the debug panel's Decision Trace section + corpus-case export
 * (S12 #399 — ADR-0008: a field report must convert into a labelled corpus
 * case without guessing).
 *
 * The panel reads engines through the engineRegistry + orchestrator
 * singletons, so both modules are mocked (established repo idiom — see
 * tests/v4-orchestrator.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const FIXED_NOW = 1_726_500_000_000;

const mocks = vi.hoisted(() => ({
  state: {
    /** Engine treated as the active engine (orchestrator + registry active). */
    engine: null as any,
    /** Engine returned by engineRegistry.getEngine(name). */
    byName: null as any,
  },
}));

vi.mock('../src/engines/engine-registry', () => ({
  engineRegistry: {
    getMode: vi.fn(() => 'v2'),
    getEngine: vi.fn((_name: string) => mocks.state.byName),
    getActiveEngines: vi.fn(() => (mocks.state.engine ? [mocks.state.engine] : [])),
  },
}));

vi.mock('../src/v2/orchestrator/orchestrator', () => ({
  orchestrator: {
    getActiveEngines: vi.fn(() => (mocks.state.engine ? [mocks.state.engine] : [])),
    getCurrentView: vi.fn(() => 'stream'),
    getShadowReport: vi.fn(() => null),
  },
}));

import { debugPanel } from '../src/v2/debug/debug-panel';
import {
  buildCorpusCase,
  slugify,
  CORPUS_CASE_NOTE,
  TRACE_NOT_RECORDED,
  TRACE_UNAVAILABLE_V1,
} from '../src/v2/debug/decision-trace-view';
import { ViewKind } from '../src/engines/types';
import type {
  CQDEngine,
  DecisionTrace,
  FlagDecision,
  PostNode,
} from '../src/engines/types';

// ============================================================================
// FIXTURES
// ============================================================================

function makeTrace(overrides: Partial<DecisionTrace> = {}): DecisionTrace {
  return {
    postId: 'post-1',
    timestamp: FIXED_NOW - 1_000,
    viewKind: ViewKind.STREAM,
    layers: [
      {
        layerName: 'comment-L0',
        layerIndex: 0,
        score: 55,
        matched: true,
        matchedText: '1 comment',
        selectorUsed: '[aria-label*="comment"]',
        details: 'kw comment hit',
      },
      {
        layerName: 'edited-L1',
        layerIndex: 1,
        score: 10,
        matched: false,
        matchedText: null,
        selectorUsed: '.edited-marker',
        details: 'no edit marker',
      },
    ],
    exclusions: [
      { ruleId: 'numeric-date', penalty: 15, reason: 'date-like token', matchedText: '' },
    ],
    finalScore: 55,
    duration_ms: 3,
    ...overrides,
  };
}

function makeDecision(overrides: Partial<FlagDecision> = {}): FlagDecision {
  return {
    postId: 'post-1',
    commentScore: 55,
    editedScore: 0,
    commentCount: 1,
    editedDiff: null,
    exclusionPenalties: [{ ruleId: 'numeric-date', penalty: 15 }],
    finalVerdict: 'comment',
    confidence: 'high',
    trace: makeTrace(),
    ...overrides,
  };
}

function makePost(id: string): PostNode {
  return {
    id,
    element: document.createElement('div'),
    viewKind: ViewKind.STREAM,
    files: [],
    flags: null,
    lastScannedAt: 0,
  };
}

/**
 * Stub engine — shape-compatible with CQDEngine for the surface the panel
 * reads (name, version, tracked posts, flag decisions, decision traces).
 */
function makeEngine(overrides: Record<string, unknown> = {}): CQDEngine {
  const base = {
    name: 'engine-v2',
    version: '4.0.0',
    init: async () => {},
    destroy: () => {},
    handleMutations: () => {},
    fullScan: () => {},
    getTrackedPosts: () => [makePost('post-1')],
    getPlacementDecisions: () => [],
    getFlagDecisions: () => [makeDecision()],
    getDecisionTrace: (_postId: string): DecisionTrace | null => makeTrace(),
  };
  return { ...base, ...overrides } as unknown as CQDEngine;
}

function installEngine(engine: CQDEngine): void {
  mocks.state.engine = engine;
  mocks.state.byName = engine;
}

/** Installs a V1-style engine: registry lookup misses, it is only "active". */
function installV1OnlyEngine(engine: CQDEngine): void {
  mocks.state.engine = engine;
  mocks.state.byName = null;
}

// ============================================================================
// URL / DOWNLOAD STUBS
// ============================================================================

let createObjectURLMock: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.spyOn>;

function stubDownloads(): void {
  createObjectURLMock = vi.fn(() => 'blob:mock-url');
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURLMock;
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}

// ============================================================================
// LIFECYCLE
// ============================================================================

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW });
});

afterEach(() => {
  debugPanel.destroy();
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.state.engine = null;
  mocks.state.byName = null;
  document.body.innerHTML = '';
});

// ============================================================================
// SECTION RENDERING
// ============================================================================

describe('Decision Trace section', () => {
  it('lists tracked post ids as clickable entries', () => {
    installEngine(
      makeEngine({ getTrackedPosts: () => [makePost('post-1'), makePost('post-2')] }),
    );
    debugPanel.show();

    const entries = document.querySelectorAll('[data-post-id]');
    expect(entries).toHaveLength(2);
    expect(entries[0].textContent).toBe('post-1');
    expect(entries[1].textContent).toBe('post-2');
  });

  it('renders the full DecisionTrace after clicking a post id', () => {
    installEngine(makeEngine());
    debugPanel.show();

    const entry = document.querySelector<HTMLElement>('[data-post-id="post-1"]');
    expect(entry).not.toBeNull();
    entry!.click();

    const detail = document.querySelector('.cqd-dbg-trace-detail');
    expect(detail).not.toBeNull();
    const text = detail!.textContent ?? '';

    // Scalars: postId, viewKind, finalScore, duration.
    expect(text).toContain('post-1');
    expect(text).toContain('stream');
    expect(text).toContain('55'); // finalScore
    expect(text).toContain('3ms'); // duration

    // Layers: name, score, matched, matchedText, selectorUsed.
    const layers = detail!.querySelectorAll('.cqd-dbg-trace-layer');
    expect(layers).toHaveLength(2);
    expect(layers[0].textContent).toContain('comment-L0');
    expect(layers[0].textContent).toContain('1 comment'); // matchedText
    expect(layers[0].textContent).toContain('[aria-label*="comment"]'); // selectorUsed
    expect(layers[0].classList.contains('matched')).toBe(true);
    expect(layers[1].textContent).toContain('edited-L1');
    expect(layers[1].classList.contains('matched')).toBe(false);

    // Exclusions: rule, reason (penalty shown alongside).
    const exclusions = detail!.querySelectorAll('.cqd-dbg-trace-exclusion');
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0].textContent).toContain('numeric-date');
    expect(exclusions[0].textContent).toContain('date-like token');
    expect(exclusions[0].textContent).toContain('15');
  });

  it('shows "no trace recorded for this post" when the engine returns null', () => {
    installEngine(makeEngine({ getDecisionTrace: () => null }));
    debugPanel.show();

    document.querySelector<HTMLElement>('[data-post-id="post-1"]')!.click();

    const detail = document.querySelector('.cqd-dbg-trace-detail');
    expect(detail?.textContent).toContain(TRACE_NOT_RECORDED);
  });

  it('shows "trace unavailable for this engine" for the V1 sentinel trace', () => {
    // V1 sentinel exactly as engines/v1/engine-v1.ts builds it.
    const sentinel: DecisionTrace = {
      postId: 'post-1',
      timestamp: FIXED_NOW,
      viewKind: ViewKind.STREAM,
      layers: [
        {
          layerName: 'v1-legacy',
          layerIndex: 0,
          score: -1,
          matched: false,
          matchedText: null,
          selectorUsed: null,
          details:
            'V1 legacy engine does not produce detailed traces. Use V2 for full decision tracing.',
        },
      ],
      exclusions: [],
      finalScore: -1,
      duration_ms: -1,
    };
    installV1OnlyEngine(makeEngine({ name: 'engine-v1', getDecisionTrace: () => sentinel }));
    debugPanel.show();

    document.querySelector<HTMLElement>('[data-post-id="post-1"]')!.click();

    const detail = document.querySelector('.cqd-dbg-trace-detail');
    expect(detail?.textContent).toContain(TRACE_UNAVAILABLE_V1);
  });

  it('leaves the pre-existing sections intact (additive only)', () => {
    installEngine(makeEngine());
    debugPanel.show();

    const body = document.getElementById('cqd-debug-panel-body');
    expect(body?.textContent).toContain('Engine State');
    expect(body?.textContent).toContain('V2 Flags');
    expect(body?.textContent).toContain('V2 Model');
  });
});

// ============================================================================
// CORPUS-CASE EXPORT
// ============================================================================

describe('corpus-case export', () => {
  it('downloads the documented JSON shape via Blob + anchor click', async () => {
    stubDownloads();
    installEngine(makeEngine());
    debugPanel.show();

    document.querySelector<HTMLElement>('[data-post-id="post-1"]')!.click();
    document.querySelector<HTMLButtonElement>('.cqd-dbg-export-btn')!.click();

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    const parsed = JSON.parse(await blob.text());
    expect(parsed).toEqual({
      caseId: `post-1-${FIXED_NOW}`, // slug from postId + timestamp
      note: CORPUS_CASE_NOTE,
      viewKind: 'stream',
      posts: [
        {
          postId: 'post-1',
          commentPresent: true,
          commentCount: 1,
          editedPresent: false,
        },
      ],
    });

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe(`post-1-${FIXED_NOW}.json`);
    expect(anchor.href).toBe('blob:mock-url');
  });

  it('derives flags from a "both" verdict and carries the decision count', async () => {
    stubDownloads();
    installEngine(
      makeEngine({
        getFlagDecisions: () => [
          makeDecision({ finalVerdict: 'both', commentCount: 3, editedScore: 40 }),
        ],
      }),
    );
    debugPanel.show();

    document.querySelector<HTMLElement>('[data-post-id="post-1"]')!.click();
    document.querySelector<HTMLButtonElement>('.cqd-dbg-export-btn')!.click();

    const parsed = JSON.parse(await (createObjectURLMock.mock.calls[0][0] as Blob).text());
    expect(parsed.posts[0]).toEqual({
      postId: 'post-1',
      commentPresent: true,
      commentCount: 3,
      editedPresent: true,
    });
  });

  it('falls back to matched trace layers when no FlagDecision exists', async () => {
    stubDownloads();
    installEngine(makeEngine({ getFlagDecisions: () => [] }));
    debugPanel.show();

    document.querySelector<HTMLElement>('[data-post-id="post-1"]')!.click();
    document.querySelector<HTMLButtonElement>('.cqd-dbg-export-btn')!.click();

    const parsed = JSON.parse(await (createObjectURLMock.mock.calls[0][0] as Blob).text());
    expect(parsed.posts[0]).toEqual({
      postId: 'post-1',
      commentPresent: true, // comment-L0 matched
      commentCount: null, // no decision → no count source
      editedPresent: false, // edited-L1 did not match
    });
  });

  it('PII GUARD: export carries no raw page text or HTML from the trace', async () => {
    stubDownloads();
    const leakyTrace = makeTrace({
      layers: [
        {
          layerName: 'comment-L0',
          layerIndex: 0,
          score: 55,
          matched: true,
          matchedText: 'PII-CANARY page text should not leak',
          selectorUsed: '[data-leak="SELECTOR-CANARY"]',
          details: 'LEAK-CANARY <div onclick="x">raw html</div>',
        },
      ],
      exclusions: [
        {
          ruleId: 'numeric-date',
          penalty: 15,
          reason: 'EXCLUSION-REASON-CANARY',
          matchedText: 'EXCLUSION-TEXT-CANARY Sep 17, 2026',
        },
      ],
    });
    installEngine(makeEngine({ getDecisionTrace: () => leakyTrace }));
    debugPanel.show();

    document.querySelector<HTMLElement>('[data-post-id="post-1"]')!.click();
    document.querySelector<HTMLButtonElement>('.cqd-dbg-export-btn')!.click();

    const json = await (createObjectURLMock.mock.calls[0][0] as Blob).text();
    expect(json).not.toContain('PII-CANARY');
    expect(json).not.toContain('LEAK-CANARY');
    expect(json).not.toContain('SELECTOR-CANARY');
    expect(json).not.toContain('EXCLUSION-REASON-CANARY');
    expect(json).not.toContain('EXCLUSION-TEXT-CANARY');
    expect(json).not.toContain('<div');
    expect(json).not.toContain('onclick');
  });
});

// ============================================================================
// PURE HELPERS
// ============================================================================

describe('buildCorpusCase helpers', () => {
  it('slugifies post ids for the caseId', () => {
    expect(slugify('post-1')).toBe('post-1');
    expect(slugify('Stream Item — post_1!')).toBe('stream-item-post-1');
    expect(slugify('///')).toBe('post');
  });

  it('builds the case skeleton purely from a trace when no decision exists', () => {
    const trace = makeTrace();
    const c = buildCorpusCase(trace, null, FIXED_NOW);
    expect(c.caseId).toBe(`post-1-${FIXED_NOW}`);
    expect(c.note).toBe(CORPUS_CASE_NOTE);
    expect(c.viewKind).toBe('stream');
    expect(c.posts).toHaveLength(1);
  });
});
