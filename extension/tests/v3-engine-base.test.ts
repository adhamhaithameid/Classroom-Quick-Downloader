// filepath: extension/tests/v3-engine-base.test.ts
/**
 * ============================================================================
 * V3 BASE ENGINE FLAG — engineBase default + registry 'v3' fallback
 * ============================================================================
 *
 * Pins the engineBase flag contract (docs/audit/2026-11-18-v3-base-design.md):
 * 1. Default — a fresh module import reads 'v2' (flag OFF ships zero change).
 * 2. Flag OFF — mode 'v3' registry mapping is exactly today's behavior:
 *    configured → [V3], unconfigured → the V1+V2 shadow pair.
 * 3. Flag ON — mode 'v3' without API config falls back to [V2] only
 *    (target-design item 2: no V1 in the fallback).
 *
 * All imports under test are dynamic after vi.resetModules() so the test's
 * setEngineBase() call and the registry's getEngineBase() read hit the SAME
 * fresh engine-base module instance (static imports would pin the original
 * evaluation and miss the reset).
 *
 * isApiConfigured is controlled the way v2-engine-registry.test.ts does it:
 * by stubbing the chrome global (identity + oauth2 client_id = configured);
 * the probe reads chrome at call time, so the stub is the whole arrangement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CQDEngine } from '../src/engines/types';

// ============================================================================
// MOCK ENGINE FACTORY (copied from v2-engine-registry.test.ts)
// ============================================================================

function createMockEngine(name: string, version = '1.0.0'): CQDEngine {
  return {
    name,
    version,
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

// ============================================================================
// isApiConfigured CONTROL (chrome stub idiom from v2-engine-registry.test.ts)
// ============================================================================

/** Chrome stub WITHOUT identity/oauth2 → isApiConfigured() reads false. */
function stubUnconfiguredChrome(): void {
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({}) },
  });
}

/** Chrome stub WITH identity + oauth2 client_id → isApiConfigured() true. */
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

/** Fresh registry + fresh engine-base, sharing one post-reset module graph. */
async function loadFlagAndRegistry() {
  const { EngineRegistry } = await import('../src/engines/engine-registry');
  const { getEngineBase, setEngineBase } = await import('../src/engines/engine-base');
  const registry = new EngineRegistry();
  registry.register(createMockEngine('engine-v1'));
  registry.register(createMockEngine('engine-v2'));
  registry.register(createMockEngine('engine-v3'));
  registry.setMode('v3');
  return { registry, getEngineBase, setEngineBase };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// FLAG DEFAULT
// ============================================================================

describe('engineBase flag: default', () => {
  it("a fresh module import reads 'v2' (flag OFF by default)", async () => {
    const { getEngineBase } = await import('../src/engines/engine-base');
    expect(getEngineBase()).toBe('v2');
  });
});

// ============================================================================
// REGISTRY MODE 'v3', FLAG OFF — today's behavior, pinned
// ============================================================================

describe("registry mode 'v3', flag OFF", () => {
  it('unconfigured → the V1+V2 shadow pair (today, pinned)', async () => {
    stubUnconfiguredChrome();
    const { registry, getEngineBase } = await loadFlagAndRegistry();
    expect(getEngineBase()).toBe('v2');

    const active = registry.getActiveEngines();
    expect(active.map((e) => e.name)).toEqual(['engine-v1', 'engine-v2']);
  });

  it('configured → [engine-v3] (today, pinned)', async () => {
    stubConfiguredChrome();
    const { registry, getEngineBase } = await loadFlagAndRegistry();
    expect(getEngineBase()).toBe('v2');

    const active = registry.getActiveEngines();
    expect(active.map((e) => e.name)).toEqual(['engine-v3']);
  });
});

// ============================================================================
// REGISTRY MODE 'v3', FLAG ON — the new V2-only fallback
// ============================================================================

describe("registry mode 'v3', flag ON", () => {
  it('unconfigured → [engine-v2] (V2 DOM fallback, no V1)', async () => {
    stubUnconfiguredChrome();
    const { registry, setEngineBase } = await loadFlagAndRegistry();
    setEngineBase('v3');

    const active = registry.getActiveEngines();
    expect(active.map((e) => e.name)).toEqual(['engine-v2']);
  });

  it('configured → [engine-v3] (unchanged by the flag)', async () => {
    stubConfiguredChrome();
    const { registry, setEngineBase } = await loadFlagAndRegistry();
    setEngineBase('v3');

    const active = registry.getActiveEngines();
    expect(active.map((e) => e.name)).toEqual(['engine-v3']);
  });
});
