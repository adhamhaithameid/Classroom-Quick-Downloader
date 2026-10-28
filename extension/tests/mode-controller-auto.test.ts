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
