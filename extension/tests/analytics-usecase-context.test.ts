// filepath: extension/tests/analytics-usecase-context.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Analytics, recordDownloadEvent } from '../entrypoints/utils/analytics';
import { eventContextFor } from '../entrypoints/background/download-handler';
import { loadQueue, __resetStorageForTests } from '../entrypoints/utils/analytics/storage';

/**
 * Use-case enrichment (bead 1ef6.1): failure + runtime_error events carry
 * pageType, engineMode, and strategy; hostile values are sanitized at
 * track time, never stored raw.
 */

// Minimal chrome mock: storage.local only, like the analytics runtime.
type Store = Record<string, unknown>;
let store: Store;

beforeEach(async () => {
  vi.useRealTimers(); // analytics storage paths stall under the global fake timers
  vi.restoreAllMocks();
  store = {};
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn(
          (
            keys: string | string[],
            cb: (result: Record<string, unknown>) => void,
          ) => {
            const result: Record<string, unknown> = {};
            for (const key of [].concat(keys as never)) {
              if (key in store) result[key] = store[key];
            }
            cb(result);
          },
        ),
        set: vi.fn((patch: Store, cb?: () => void) => {
          Object.assign(store, patch);
          cb?.();
        }),
      },
    },
    runtime: { id: 'test' },
  };
  __resetStorageForTests();
});

/** The track op chain is async; poll the persisted queue for the sentinel event. */
async function waitForQueued(errorType: string): Promise<Record<string, unknown>> {
  let found: Record<string, unknown> | undefined;
  await vi.waitFor(async () => {
    const { queue } = await loadQueue();
    const match = queue.find((ev) => ev.error_type === errorType);
    if (match) found = match as unknown as Record<string, unknown>;
    expect(found).toBeDefined();
  });
  return found as Record<string, unknown>;
}

describe('analytics use-case context (1ef6.1)', () => {
  it('recordDownloadEvent carries pageType, engineMode, and strategy into the queue', async () => {
    recordDownloadEvent({
      type: 'pdf',
      status: 'fail',
      error_type: 'sentinel-a',
      pageType: 'assignment_details',
      engineMode: 'v2',
      strategy: 'drive-auth',
      retries: 2,
    });
    const last = await waitForQueued('sentinel-a');
    expect(last).toMatchObject({
      status: 'fail',
      file_type: 'pdf',
      error_type: 'sentinel-a',
      pageType: 'assignment_details',
      engineMode: 'v2',
      strategy: 'drive-auth',
    });
  });

  it('sanitizes hostile context values at track time', async () => {
    Analytics.track({
      status: 'fail',
      file_type: 'runtime_error',
      duration_ms: 0,
      bypass_used: false,
      error_type: 'sentinel-b',
      pageType: '<script>alert(1)</script>',
      engineMode: 'DROP TABLE',
      strategy: 'x'.repeat(80),
      source: 'background',
    });
    const last = await waitForQueued('sentinel-b');
    // sanitizeField REJECTS values outside [a-z0-9_-] / the length cap —
    // hostile context becomes the 'unknown' fallback, never stored raw.
    expect(last?.pageType).toBe('unknown');
    expect(last?.engineMode).toBe('unknown');
    expect(last?.strategy).toBe('unknown');
  });

  it('eventContextFor derives the strategy from the Drive flag', () => {
    expect(
      eventContextFor({ pageType: 'stream', engineMode: 'auto', isDrive: true }),
    ).toEqual({ pageType: 'stream', engineMode: 'auto', strategy: 'drive-auth' });
    expect(eventContextFor({ isDrive: false })).toEqual({
      pageType: undefined,
      engineMode: undefined,
      strategy: 'direct',
    });
  });
});
