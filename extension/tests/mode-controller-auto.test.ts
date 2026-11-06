import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODE, resolveAutoMode } from '../src/v2/orchestrator/mode-controller';
import { ROUTER_STATS_STORAGE_KEY } from '../src/engines/router/router-stats';

/**
 * resolveAutoMode (hhpa.3): stored 'auto' resolves to a concrete mode from
 * the local outcome stats. chrome.storage is mocked per test.
 */
function mockStorage(store: Record<string, unknown>) {
  (chrome as any).storage = {
    local: {
      get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
    },
  };
}

const ring = (entries: Array<string>) => ({
  ring: {
    v2: entries.map((status) => ({ mode: 'v2', pageType: 'stream', status, at: 1 })),
  },
});

describe('resolveAutoMode (hhpa.3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps v2 while it is healthy', async () => {
    mockStorage({ [ROUTER_STATS_STORAGE_KEY]: ring(['saved', 'saved', 'saved']) });
    await expect(resolveAutoMode()).resolves.toBe('v2');
  });

  it('switches to legacy after a v2 failure streak', async () => {
    mockStorage({
      [ROUTER_STATS_STORAGE_KEY]: {
        ring: {
          v2: ['failed', 'failed', 'failed'].map((status) => ({ mode: 'v2', pageType: 'stream', status, at: 1 })),
          legacy: [{ mode: 'legacy', pageType: 'stream', status: 'saved', at: 1 }],
        },
      },
    });
    await expect(resolveAutoMode()).resolves.toBe('legacy');
  });

  it('excludes v3 when the API is not configured', async () => {
    mockStorage({ [ROUTER_STATS_STORAGE_KEY]: { ring: {} } });
    const resolved = await resolveAutoMode();
    expect(['legacy', 'v2']).toContain(resolved);
  });

  it('falls back to the default on junk state, empty storage, or no chrome', async () => {
    mockStorage({ [ROUTER_STATS_STORAGE_KEY]: { garbage: true } });
    await expect(resolveAutoMode()).resolves.toBe(DEFAULT_MODE);
    mockStorage({});
    await expect(resolveAutoMode()).resolves.toBe(DEFAULT_MODE);
    (globalThis as { chrome?: unknown }).chrome = undefined as never;
    await expect(resolveAutoMode()).resolves.toBe(DEFAULT_MODE);
  });
});

describe('cqd-set-mode auto persistence contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('applies the resolved engine in memory and never persists over stored auto', async () => {
    vi.resetModules();
    // The last resolveAutoMode test detaches the chrome global; rebuild it.
    (globalThis as { chrome?: unknown }).chrome = {} as never;
    mockStorage({
      cqdV2Mode: 'auto',
      [ROUTER_STATS_STORAGE_KEY]: ring(['saved', 'saved', 'saved']),
    });
    const setSpy = vi.fn(async () => undefined);
    (chrome as any).storage.local.set = setSpy;
    let listener:
      | ((message: unknown, sender: unknown, respond: (value: unknown) => void) => boolean)
      | null = null;
    (chrome as any).runtime = {
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
      },
    };
    (chrome as any).storage.onChanged = { addListener: vi.fn() };

    const { engineRegistry } = await import('../src/engines/engine-registry');
    // Dynamic imports AFTER resetModules: controller and registry must share
    // one module instance (the singleton registry), like production wiring.
    const { initModeController } = await import('../src/v2/orchestrator/mode-controller');
    await initModeController();

    const respond = vi.fn();
    expect(listener).toBeTruthy();
    const keepOpen = listener!({ type: 'cqd-set-mode', mode: 'auto' }, {}, respond);
    expect(keepOpen).toBe(true);
    // Flush the apply() microtask chain (no macrotasks involved).
    for (let i = 0; i < 5; i += 1) await Promise.resolve();

    // The resolved engine is reported…
    expect(respond).toHaveBeenCalledWith({ success: true, mode: 'v2' });
    // …applied in memory…
    expect(engineRegistry.getMode()).toBe('v2');
    // …and storage is untouched: the popup owns the persisted 'auto'.
    expect(setSpy).not.toHaveBeenCalled();
  });
});
