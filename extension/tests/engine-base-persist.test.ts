// filepath: extension/tests/engine-base-persist.test.ts
/**
 * 82gr — engineBase persisted in chrome.storage.local and read by every JS
 * context at init. Flag stays OFF ('v2') unless storage says 'v3'.
 * Each "context" is a fresh module registry (own module state, shared storage).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Store = Record<string, unknown>;

function stubChrome(store: Store, overrides: { get?: () => unknown; set?: () => unknown } = {}): void {
  vi.stubGlobal('chrome', {
    runtime: { lastError: null },
    storage: {
      local: {
        get: vi.fn(overrides.get ?? (async (key: string) => (key in store ? { [key]: store[key] } : {}))),
        set: vi.fn(
          overrides.set ??
            (async (items: Store) => {
              Object.assign(store, items);
            }),
        ),
      },
    },
  });
}

async function freshContext() {
  vi.resetModules();
  return import('../src/engines/engine-base');
}

describe('engineBase persistence (82gr)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults OFF: a fresh context is v2 and an empty store loads v2', async () => {
    stubChrome({});
    const ctx = await freshContext();
    expect(ctx.getEngineBase()).toBe('v2');
    await expect(ctx.loadEngineBase()).resolves.toBe('v2');
    expect(ctx.getEngineBase()).toBe('v2');
  });

  it('a stored v3 flips getEngineBase after loadEngineBase', async () => {
    stubChrome({ [(await freshContext()).ENGINE_BASE_STORAGE_KEY]: 'v3' });
    const ctx = await freshContext();
    expect(ctx.getEngineBase()).toBe('v2'); // before the load: still OFF
    await ctx.loadEngineBase();
    expect(ctx.getEngineBase()).toBe('v3');
  });

  it('the setter writes storage; a context that loads later agrees', async () => {
    const store: Store = {};
    stubChrome(store);
    const writer = await freshContext();
    await writer.setEngineBasePersisted('v3');
    expect(writer.getEngineBase()).toBe('v3');
    expect(store[writer.ENGINE_BASE_STORAGE_KEY]).toBe('v3');

    const later = await freshContext(); // background, popup, options, content: all alike
    expect(later.getEngineBase()).toBe('v2');
    await later.loadEngineBase();
    expect(later.getEngineBase()).toBe('v3');

    await writer.setEngineBasePersisted('v2');
    const latest = await freshContext();
    await latest.loadEngineBase();
    expect(latest.getEngineBase()).toBe('v2');
  });

  it('a storage read failure falls back to v2', async () => {
    stubChrome({}, { get: () => Promise.reject(new Error('quota')) });
    const ctx = await freshContext();
    ctx.setEngineBase('v3'); // an earlier in-memory value must not survive a failed load
    await expect(ctx.loadEngineBase()).resolves.toBe('v2');
    expect(ctx.getEngineBase()).toBe('v2');
  });

  it('no chrome.storage, or an invalid stored value, falls back to v2', async () => {
    vi.stubGlobal('chrome', undefined);
    const noChrome = await freshContext();
    await expect(noChrome.loadEngineBase()).resolves.toBe('v2');

    const ctx = await freshContext();
    stubChrome({ [ctx.ENGINE_BASE_STORAGE_KEY]: 'v9' });
    await expect(ctx.loadEngineBase()).resolves.toBe('v2');
  });

  it('a failed storage write rejects and leaves the flag unchanged', async () => {
    stubChrome({}, { set: () => Promise.reject(new Error('write failed')) });
    const ctx = await freshContext();
    await expect(ctx.setEngineBasePersisted('v3')).rejects.toThrow('write failed');
    expect(ctx.getEngineBase()).toBe('v2');
  });
});
