// filepath: extension/tests/bridge-relay.test.ts
/**
 * S6/G2 T2 — the page-side bridge relay: the page bus's `download:requested`
 * topic crosses the BridgePort, and bridge responses come back as
 * `download:settled` on the same bus. One module, one responsibility.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createEventBus } from '../src/bus/event-bus';
import type { PageTopicMap } from '../src/contracts/topics';
import { createInMemoryBridge } from './fakes/fake-bridge-port';
import { wireBridgeRelay } from '../src/v2/orchestrator/bridge-relay';

const FILE = {
  fileId: 'FILE123',
  url: 'https://drive.usercontent.google.com/download?id=FILE123&export=download&confirm=t',
  ext: 'pdf',
  name: 'lecture.pdf',
};
const NAME_HINT = { preferredStem: 'lecture', ext: 'pdf', source: 'aria' as const };

function setup() {
  const bus = createEventBus<PageTopicMap>();
  const { page, worker } = createInMemoryBridge();
  const relay = wireBridgeRelay(bus, page);
  return { bus, worker, relay };
}

describe('bridge relay (page side)', () => {
  let bus: ReturnType<typeof createEventBus<PageTopicMap>>;
  let worker: ReturnType<typeof createInMemoryBridge>['worker'];
  let relay: ReturnType<typeof wireBridgeRelay>;

  beforeEach(() => {
    ({ bus, worker, relay } = setup());
  });

  it('forwards download:requested across the bridge with the request id and file', () => {
    const received: Array<{ requestId: string; payload: unknown }> = [];
    worker.onRequest((r) => received.push({ requestId: r.requestId, payload: r.payload }));

    bus.publish('download:requested', { requestId: 'req-1', file: FILE, nameHint: NAME_HINT });

    expect(received).toEqual([
      { requestId: 'req-1', payload: { file: FILE, nameHint: NAME_HINT } },
    ]);
  });

  it('publishes a bridge response as download:settled on the page bus', () => {
    const settled: Array<{ requestId: string; outcome: unknown }> = [];
    bus.subscribe('download:settled', (p) => settled.push(p));
    worker.onRequest((r) => worker.respond(r.requestId, { status: 'saved', downloadId: 42 }));

    bus.publish('download:requested', { requestId: 'req-2', file: FILE, nameHint: NAME_HINT });

    expect(settled).toEqual([{ requestId: 'req-2', outcome: { status: 'saved', downloadId: 42 } }]);
  });

  it('the relay returns an off fn that detaches both directions', () => {
    const received: unknown[] = [];
    const settled: unknown[] = [];
    worker.onRequest((r) => received.push(r));
    bus.subscribe('download:settled', (p) => settled.push(p));

    relay();
    bus.publish('download:requested', { requestId: 'req-3', file: FILE, nameHint: NAME_HINT });
    worker.respond('req-3', { status: 'failed' });

    expect(received).toEqual([]);
    expect(settled).toEqual([]);
  });
});
