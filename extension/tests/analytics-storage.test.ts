import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { compactQueueForBudget, loadQueue, saveQueue } from '../entrypoints/utils/analytics/storage';
import type { AnalyticsEvent } from '../entrypoints/utils/analytics/types';

function makeEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    status: 'success',
    file_type: 'pdf',
    browser: 'chrome',
    os: 'mac',
    ext_version: '1.0.0',
    duration_ms: 120,
    bypass_used: false,
    language: 'en',
    timestamp: Date.UTC(2026, 1, 8, 1, 0, 0),
    id: `ext-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
}

async function resetIdb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('cqd_analytics_db_v1');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeAll(() => {
  vi.useRealTimers();
});

afterAll(() => {
  vi.useFakeTimers();
});

beforeEach(async () => {
  await resetIdb();
});

describe('analytics storage', () => {
  it('compacts queue when above budget', () => {
    const queue: AnalyticsEvent[] = [];
    for (let i = 0; i < 600; i++) {
      queue.push(makeEvent({
        id: `ev-${i}`,
        timestamp: Date.UTC(2026, 1, 8, 1, 0, 0) + i * 1000,
      }));
    }
    const result = compactQueueForBudget(queue);
    expect(result.queue.length).toBeLessThanOrEqual(500);
    expect(result.queue.some((ev) => (ev.count ?? 1) > 1)).toBe(true);
  });

  it('stores and loads queue from indexedDB', async () => {
    const queue = [makeEvent({ id: 'idb-1' })];
    await saveQueue(queue);
    const loaded = await loadQueue();
    expect(loaded.queue.length).toBe(1);
    expect(loaded.queue[0].id).toBe('idb-1');
  });
});
