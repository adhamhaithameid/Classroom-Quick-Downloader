// filepath: extension/tests/v2-orchestrator-classroom-button.test.ts
/**
 * ============================================================================
 * ORCHESTRATOR-DRIVEN CLASSROOM BUTTON — bug 2.2
 * ============================================================================
 *
 * The classroom-wide download button used to render ONLY through
 * EngineV3.init/fullScan, so v2 mode (whose DOM engine is EngineV2) never
 * saw it, and EngineV3 was a second driver next to the orchestrator.
 *
 * The fix drives visibility from the ORCHESTRATOR's view-change path for
 * every mode whose DOM engine is EngineV2 (v2 mode, and v3 mode whose
 * EngineV3 delegates DOM to V2), gated on isApiConfigured() and the
 * existing classroom route context. These tests pin:
 *
 *   1. v2 mode on a classwork route renders the button exactly once (no
 *      duplicates across repeated view changes);
 *   2. v2 mode without the API configured renders no button (and removes
 *      a stale one);
 *   3. v3 mode (EngineV3 primary, DOM delegated to V2) still renders;
 *   4. a mode whose primary is EngineV1 (legacy/shadow) removes the button;
 *   5. leaving the classwork route removes the button.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Isolate the registry singleton per test file (established repo idiom —
// see v4-orchestrator.test.ts). The orchestrator's driver reads the PRIMARY
// engine, so tests swap `primary` to simulate the active mode's DOM engine.
const registryState = vi.hoisted(() => ({
  primary: null as Record<string, unknown> | null,
}));
vi.mock('../src/engines/engine-registry', () => ({
  engineRegistry: {
    getActiveEngines: vi.fn(() => (registryState.primary ? [registryState.primary] : [])),
    getEngine: vi.fn(() => null),
    getMode: vi.fn(() => 'v2'),
    setModeChangeCallback: vi.fn(),
    getSummary: vi.fn(() => ''),
    getPrimaryEngine: vi.fn(() => registryState.primary),
  },
}));

// Keep classifyRoute + isClassroomUrl REAL: resolveClassroomApiRouteContext
// (reached through the classroom download controller the orchestrator now
// drives) classifies routes through them. Only the watcher is stubbed — its
// start() monkey-patches history, which direct handleViewChange calls never
// need.
vi.mock('../src/v2/context/route-classifier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/v2/context/route-classifier')>();
  return {
    ...actual,
    RouteWatcher: class {
      start(): void {}
      stop(): void {}
    },
  };
});

vi.mock('../src/v2/compat/shadow-compare', () => ({ ShadowComparator: class {} }));

import { Orchestrator } from '../src/v2/orchestrator/orchestrator';
import { ViewKind } from '../src/engines/types';
import {
  installClassroomDownloadController,
  resetClassroomDownloadController,
  uninstallClassroomDownloadController,
} from '../src/v2/render/classroom-download-controller';

const CLASSWORK_URL = 'https://classroom.google.com/w/COURSE_1/t/all';
const TOPIC_URL = 'https://classroom.google.com/w/COURSE_1/t/TOPIC_1';
const STREAM_URL = 'https://classroom.google.com/c/COURSE_1';
const BUTTON_ID = 'cqd-classroom-dl-btn';

function stubEngine(name: string): Record<string, unknown> {
  return {
    name,
    version: '0.0.0-test',
    init: vi.fn(async () => {}),
    destroy: vi.fn(),
    handleMutations: vi.fn(),
    fullScan: vi.fn(),
    getTrackedPosts: vi.fn(() => []),
    getPlacementDecisions: vi.fn(() => []),
    getFlagDecisions: vi.fn(() => []),
    getDecisionTrace: vi.fn(() => null),
  };
}

/** Configured install: identity permission + oauth2 client_id (config.ts). */
function stubConfiguredChrome(): void {
  vi.stubGlobal('chrome', {
    identity: { getAuthToken: () => {} },
    runtime: {
      getManifest: () => ({
        oauth2: { client_id: 'cqd-test.apps.googleusercontent.com' },
      }),
    },
  });
}

/** Unconfigured install: no identity permission, no oauth2 client_id. */
function stubUnconfiguredChrome(): void {
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: 'test' }) },
  });
}

function makeBus() {
  return { publish: vi.fn(), subscribe: vi.fn(() => () => {}) };
}

type ViewChangeFn = (
  v: ViewKind,
  p: ViewKind | null,
  u: string,
) => Promise<void>;

async function driveTo(o: Orchestrator, view: ViewKind, url: string): Promise<void> {
  await (o as unknown as { handleViewChange: ViewChangeFn }).handleViewChange(
    view,
    null,
    url,
  );
}

function classroomButtons(): number {
  return document.querySelectorAll(`#${BUTTON_ID}`).length;
}

function seedHeader(): void {
  document.body.innerHTML = '<div class="N5dSp"></div>';
}

describe('orchestrator-driven classroom button (bug 2.2)', () => {
  beforeEach(() => {
    seedHeader();
    installClassroomDownloadController({ bus: makeBus() as never });
  });

  afterEach(() => {
    uninstallClassroomDownloadController();
    resetClassroomDownloadController();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('v2 mode on a classwork route renders the button exactly once (no duplicates on repeated view changes)', async () => {
    stubConfiguredChrome();
    registryState.primary = stubEngine('engine-v2');
    const o = new Orchestrator();
    o.start();

    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(1);

    // Repeated view changes (SPA navigation between topics/classes, and the
    // mode-change callback re-running handleViewChange) must never stack a
    // second button.
    await driveTo(o, ViewKind.CLASSWORK_TOPIC, TOPIC_URL);
    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(1);

    o.stop();
  });

  it('v3 mode (EngineV3 primary, DOM delegated to V2) still renders via the orchestrator driver', async () => {
    stubConfiguredChrome();
    registryState.primary = stubEngine('engine-v3');
    const o = new Orchestrator();
    o.start();

    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(1);

    o.stop();
  });

  it('v2 mode without the API configured renders no classroom button and removes a stale one', async () => {
    stubUnconfiguredChrome();
    registryState.primary = stubEngine('engine-v2');
    const stale = document.createElement('button');
    stale.id = BUTTON_ID;
    document.body.appendChild(stale);

    const o = new Orchestrator();
    o.start();
    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(0);

    o.stop();
  });

  it('a mode whose primary engine is EngineV1 (legacy/shadow DOM) removes the button', async () => {
    stubConfiguredChrome();
    registryState.primary = stubEngine('engine-v2');
    const o = new Orchestrator();
    o.start();
    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(1);

    // Mode switch: v1-primary modes render nothing classroom-wide, even on
    // a classwork route with the API fully configured.
    registryState.primary = stubEngine('engine-v1');
    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(0);

    o.stop();
  });

  it('leaving the classwork route removes the button', async () => {
    stubConfiguredChrome();
    registryState.primary = stubEngine('engine-v2');
    const o = new Orchestrator();
    o.start();
    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(1);

    await driveTo(o, ViewKind.STREAM, STREAM_URL);
    expect(classroomButtons()).toBe(0);

    o.stop();
  });

  it('zero active engines on an accepted classroom view removes a stale button (engines-empty early return)', async () => {
    // Zero engines: the orchestrator's engines-empty early return fires
    // BEFORE syncClassroomButton, so the removal must live on that early
    // return itself — nothing else on this path touches the button.
    registryState.primary = null;
    const stale = document.createElement('button');
    stale.id = BUTTON_ID;
    document.body.appendChild(stale);

    const o = new Orchestrator();
    o.start();
    await driveTo(o, ViewKind.CLASSWORK_LIST, CLASSWORK_URL);
    expect(classroomButtons()).toBe(0);

    o.stop();
  });
});
