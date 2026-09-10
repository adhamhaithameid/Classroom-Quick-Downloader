// filepath: extension/tests/bus/event-bus.test.ts
/**
 * Event bus behavior spec — ENGINE_V4_SYSTEM_DESIGN.md §4.
 *
 * The bus is synchronous, in-context, and typed by a topic map. Its fault
 * model comes from design §9: a role may fail without taking the page down,
 * so one throwing subscriber must never block the others.
 */
import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/bus/event-bus';

type TestTopicMap = {
  'ping': { n: number };
  'letter': { char: string };
};

describe('createEventBus', () => {
  it('delivers a payload synchronously to a subscriber', () => {
    const bus = createEventBus<TestTopicMap>();
    const seen: number[] = [];

    bus.subscribe('ping', (p) => seen.push(p.n));
    bus.publish('ping', { n: 7 });

    expect(seen).toEqual([7]);
  });

  it('delivers to multiple subscribers in subscription order', () => {
    const bus = createEventBus<TestTopicMap>();
    const calls: string[] = [];

    bus.subscribe('letter', () => calls.push('first'));
    bus.subscribe('letter', () => calls.push('second'));
    bus.publish('letter', { char: 'a' });

    expect(calls).toEqual(['first', 'second']);
  });

  it('stops delivery after unsubscribe', () => {
    const bus = createEventBus<TestTopicMap>();
    const seen: number[] = [];

    const unsubscribe = bus.subscribe('ping', (p) => seen.push(p.n));
    unsubscribe();
    bus.publish('ping', { n: 1 });

    expect(seen).toEqual([]);
  });

  it('tolerates an unsubscribe called twice', () => {
    const bus = createEventBus<TestTopicMap>();
    const unsubscribe = bus.subscribe('ping', () => {});

    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });

  it('publishing to a topic with no subscribers is a no-op', () => {
    const bus = createEventBus<TestTopicMap>();

    expect(() => bus.publish('ping', { n: 0 })).not.toThrow();
  });

  it('a throwing subscriber does not prevent the next subscriber', () => {
    const bus = createEventBus<TestTopicMap>();
    const seen: number[] = [];

    bus.subscribe('ping', () => {
      throw new Error('role failed');
    });
    bus.subscribe('ping', (p) => seen.push(p.n));
    bus.publish('ping', { n: 3 });

    expect(seen).toEqual([3]);
  });

  it('reports a throwing subscriber through onError with topic and error', () => {
    const onError = vi.fn();
    const bus = createEventBus<TestTopicMap>({ onError });
    const boom = new Error('role failed');

    bus.subscribe('ping', () => {
      throw boom;
    });
    bus.publish('ping', { n: 9 });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('ping', boom, { n: 9 });
  });

  it('survives a subscriber throwing when no onError is configured', () => {
    const bus = createEventBus<TestTopicMap>();
    const seen: number[] = [];

    bus.subscribe('ping', () => {
      throw new Error('unreported failure');
    });
    bus.subscribe('ping', (p) => seen.push(p.n));

    expect(() => bus.publish('ping', { n: 2 })).not.toThrow();
    expect(seen).toEqual([2]);
  });

  it('reports subscriber counts so Harden can observe load', () => {
    const bus = createEventBus<TestTopicMap>();
    expect(bus.subscriberCount('ping')).toBe(0);

    const off = bus.subscribe('ping', () => {});
    expect(bus.subscriberCount('ping')).toBe(1);

    off();
    expect(bus.subscriberCount('ping')).toBe(0);
  });

  it('isolates subscriber mutations of the subscriber list during publish', () => {
    // A handler that unsubscribes itself (or another handler) mid-dispatch
    // must not skip or double-deliver to the remaining subscribers.
    const bus = createEventBus<TestTopicMap>();
    const calls: string[] = [];

    const offSelf = bus.subscribe('letter', () => {
      calls.push('self');
      offSelf();
    });
    bus.subscribe('letter', () => calls.push('other'));
    bus.publish('letter', { char: 'x' });
    bus.publish('letter', { char: 'x' });

    expect(calls).toEqual(['self', 'other', 'other']);
  });
});
