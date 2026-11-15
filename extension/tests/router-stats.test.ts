import { describe, expect, it } from 'vitest';
import {
  createRouterStats,
  isCountedOutcome,
  isHealthyOutcome,
  type RouterObservation,
  type RouterStatsState,
} from '../src/engines/router/router-stats';

function obs(overrides: Partial<RouterObservation>): RouterObservation {
  return {
    mode: 'v2',
    pageType: 'stream',
    status: 'saved',
    at: 1_000,
    ...overrides,
  };
}

function memoryStore() {
  let state: RouterStatsState | null = null;
  return {
    load: async () => state,
    save: async (next: RouterStatsState) => {
      state = JSON.parse(JSON.stringify(next)) as RouterStatsState;
    },
  };
}

describe('router stats store (hhpa.1)', () => {
  it('classifies outcomes: saved healthy, cancelled excluded, rest counted failures', () => {
    expect(isHealthyOutcome('saved')).toBe(true);
    expect(isCountedOutcome('cancelled')).toBe(false);
    expect(isCountedOutcome('failed')).toBe(true);
    expect(isCountedOutcome('timeout')).toBe(true);
  });

  it('aggregates success rate and failure streak per mode', async () => {
    const store = memoryStore();
    const stats = createRouterStats({ ...store });
    await stats.record(obs({ mode: 'v2', status: 'saved' }));
    await stats.record(obs({ mode: 'v2', status: 'cancelled' }));
    await stats.record(obs({ mode: 'v2', status: 'failed', at: 2_000 }));
    await stats.record(obs({ mode: 'v2', status: 'timeout', at: 3_000 }));
    await stats.record(obs({ mode: 'legacy', status: 'saved' }));

    const snap = await stats.snapshot();
    expect(snap.modes.v2).toMatchObject({ attempts: 3, saved: 1, failed: 2, failureStreak: 2 });
    expect(snap.modes.v2.successRate).toBeCloseTo(1 / 3);
    expect(snap.modes.legacy).toMatchObject({ attempts: 1, saved: 1, failureStreak: 0 });
    expect(await stats.failureStreak('v2')).toBe(2);
  });

  it('a saved settle closes the failure streak', async () => {
    const stats = createRouterStats({ ...memoryStore() });
    await stats.record(obs({ status: 'failed' }));
    await stats.record(obs({ status: 'failed' }));
    await stats.record(obs({ status: 'saved' }));
    expect(await stats.failureStreak('v2')).toBe(0);
  });

  it('keeps at most the per-mode ring cap, dropping oldest', async () => {
    const stats = createRouterStats({ ...memoryStore(), ringCapPerMode: 3 });
    for (let i = 0; i < 5; i += 1) {
      await stats.record(obs({ status: 'failed', at: i }));
    }
    const snap = await stats.snapshot();
    expect(snap.modes.v2.attempts).toBe(3);
    expect(snap.modes.v2.failureStreak).toBe(3);
  });

  it('enforces the total cap across modes by dropping oldest rings', async () => {
    const stats = createRouterStats({ ...memoryStore(), totalCap: 4 });
    for (let i = 0; i < 3; i += 1) await stats.record(obs({ mode: 'legacy', at: i }));
    for (let i = 0; i < 3; i += 1) await stats.record(obs({ mode: 'v2', at: i }));
    const snap = await stats.snapshot();
    const total = Object.values(snap.modes).reduce((sum, m) => sum + m.attempts, 0);
    expect(total).toBeLessThanOrEqual(4);
  });

  it('sanitizes junk persisted state instead of throwing', async () => {
    const store = memoryStore();
    await store.save({ ring: { v2: [{ garbage: true }, null], legacy: 'nope' } } as unknown as RouterStatsState);
    const stats = createRouterStats({ ...store });
    const snap = await stats.snapshot();
    expect(snap.modes.v2).toBeUndefined(); // all entries were junk
    expect(snap.modes.legacy).toBeUndefined();
    await stats.record(obs({}));
    expect((await stats.snapshot()).totalObservations).toBe(1);
  });

  it('reset empties the store', async () => {
    const stats = createRouterStats({ ...memoryStore() });
    await stats.record(obs({}));
    await stats.reset();
    expect((await stats.snapshot()).totalObservations).toBe(0);
  });
});
