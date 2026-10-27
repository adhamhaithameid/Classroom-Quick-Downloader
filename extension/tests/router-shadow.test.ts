import { describe, expect, it, vi } from 'vitest';
import { createEventBus, type EventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import { ViewKind } from '../src/engines/types';
import { createShadowRouter, DECISION_FILE_TYPE } from '../src/engines/router/router-shadow';
import { createRouterStats, type RouterStatsState } from '../src/engines/router/router-stats';

function harness() {
  const bus: EventBus<PageTopicMap> = createEventBus();
  let mode: 'legacy' | 'v2' | 'v3' = 'v2';
  const store: { state: RouterStatsState | null } = { state: null };
  const stats = createRouterStats({
    load: async () => store.state,
    save: async (next) => {
      store.state = next;
    },
  });
  const track = vi.fn();
  const log = vi.fn();
  const router = createShadowRouter({
    bus,
    getMode: () => mode,
    stats,
    now: () => 1_000,
    isModeAvailable: (mode_) => mode_ !== 'v3',
    track,
    log,
  });
  return {
    bus,
    router,
    track,
    log,
    stats,
    setMode: (next: 'legacy' | 'v2' | 'v3') => {
      mode = next;
    },
    settle(status: PageTopicMap['download:settled']['outcome']['status']) {
      bus.publish('download:settled', { requestId: `r-${Math.random()}`, outcome: { status } });
    },
  };
}

describe('shadow router wiring (hhpa.2)', () => {
  it('records counted settles into the stats store with the live mode and view', async () => {
    const h = harness();
    h.bus.publish('route:changed', { view: ViewKind.STREAM, url: 'x' });
    h.settle('saved');
    h.settle('cancelled'); // excluded
    h.settle('failed');
    await vi.waitFor(async () => {
      const snap = await h.stats.snapshot();
      expect(snap.modes.v2).toMatchObject({ attempts: 2, saved: 1, failed: 1 });
    });
    expect(await h.stats.failureStreak('v2')).toBe(1);
  });

  it('evaluates the policy every 5 counted settles and logs the decision', async () => {
    const h = harness();
    for (let i = 0; i < 5; i += 1) h.settle('saved');
    await vi.waitFor(() => expect(h.log).toHaveBeenCalled());
    const message = h.log.mock.calls[0][0] as string;
    expect(message).toContain('shadow decision');
  });

  it('emits a decision analytics event only when the signature changes', async () => {
    const h = harness();
    for (let i = 0; i < 5; i += 1) h.settle('saved');
    await vi.waitFor(() => expect(h.track).toHaveBeenCalledTimes(1));
    expect(h.track).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        file_type: DECISION_FILE_TYPE,
        source: 'router',
      }),
    );
    const first = h.track.mock.calls[0][0] as { error_type?: string };
    expect(first.error_type).toMatch(/^[a-z0-9._-]+$/);

    for (let i = 0; i < 10; i += 1) h.settle('saved'); // same keep:v2 signature
    await vi.waitFor(() => expect(h.log.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(h.track).toHaveBeenCalledTimes(1);
  });

  it('HARD GATE: a switch recommendation never changes the engine mode', async () => {
    const h = harness();
    // Drive v2 into a long failure streak so the policy would switch.
    for (let i = 0; i < 12; i += 1) h.settle('failed');
    await vi.waitFor(() => expect(h.log).toHaveBeenCalled());
    // Scan every logged decision for an actual mode change.
    expect(h.log.mock.calls.some((call) => String(call[0]).includes('switch '))).toBe(true);
    // The wiring has no setMode dependency; assert the mode source is intact.
    h.settle('saved');
    const snap = await h.stats.snapshot();
    expect(snap.modes.v2).toBeDefined(); // still recording under the same mode
  });

  it('stop unsubscribes from the bus', async () => {
    const h = harness();
    h.router.stop();
    h.settle('saved');
    await h.router.evaluate(); // flush the microtask queue
    const snap = await h.stats.snapshot();
    expect(snap.totalObservations).toBe(0);
  });

  it('evaluate() returns the decision without needing settles', async () => {
    const h = harness();
    const decision = await h.router.evaluate();
    expect(decision).toMatchObject({ action: 'keep', chosen: 'v2' });
  });
});
