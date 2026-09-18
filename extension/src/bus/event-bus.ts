// filepath: extension/src/bus/event-bus.ts
/**
 * ============================================================================
 * EVENT BUS — typed, synchronous, per-context pub/sub
 * ============================================================================
 *
 * Spec: extension/docs/ENGINE_V4_SYSTEM_DESIGN.md §4, §9.
 *
 * One bus instance lives per JS context (page, worker). Roles talk to each
 * other through topics, never by importing one another — the zero
 * role-to-role import rule is what keeps adding a role from changing any
 * other role. Dispatch is synchronous so a scan pass is one deterministic
 * call stack; the only async hop in the system is the explicit BridgePort
 * between contexts.
 *
 * Fault model (design §9): the bus boundary is the fault boundary. A
 * subscriber that throws is isolated — the remaining subscribers still run,
 * and the failure is reported through the optional `onError` hook so Harden
 * (or the console, before Harden exists) sees it. An unreported failure is a
 * silent one, and silent failures are the bug class this program exists to
 * kill.
 */

/** Unsubscribe handle. Idempotent: calling it more than once is a no-op. */
export type { Unsubscribe } from '../contracts/ports';
import type { Unsubscribe } from '../contracts/ports';

/** Handler signature for a topic. */
export type TopicHandler<T> = (payload: T) => void;

/** Called when a subscriber throws, with everything needed to debug it. */
export type ErrorListener<TMap> = (
  topic: keyof TMap,
  error: unknown,
  payload: TMap[keyof TMap],
) => void;

export interface EventBus<TMap> {
  /**
   * Subscribe to a topic. Returns an idempotent unsubscribe handle.
   * A handler subscribed during dispatch of the same topic is not invoked
   * until the next publish — dispatch iterates a stable snapshot.
   */
  subscribe<K extends keyof TMap>(topic: K, handler: TopicHandler<TMap[K]>): Unsubscribe;

  /** Publish synchronously to the current subscriber list of a topic. */
  publish<K extends keyof TMap>(topic: K, payload: TMap[K]): void;

  /** Current subscriber count for a topic. Observability for the Harden role. */
  subscriberCount<K extends keyof TMap>(topic: K): number;
}

export interface EventBusOptions<TMap> {
  /** Receives every subscriber exception. Omitting it does not change isolation. */
  onError?: ErrorListener<TMap>;
}

export function createEventBus<TMap>(options: EventBusOptions<TMap> = {}): EventBus<TMap> {
  const subscribers = new Map<keyof TMap, Set<TopicHandler<never>>>();
  const { onError } = options;

  function subscribersOf<K extends keyof TMap>(topic: K): Set<TopicHandler<never>> {
    let set = subscribers.get(topic);
    if (!set) {
      set = new Set();
      subscribers.set(topic, set);
    }
    return set;
  }

  return {
    subscribe(topic, handler) {
      const set = subscribersOf(topic);
      set.add(handler as TopicHandler<never>);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        set.delete(handler as TopicHandler<never>);
      };
    },

    publish(topic, payload) {
      // Snapshot so subscribe/unsubscribe during dispatch affects only the
      // next publish; `active` flags make removals mid-dispatch still count.
      const snapshot = [...subscribersOf(topic)];
      for (const handler of snapshot) {
        try {
          (handler as TopicHandler<TMap[keyof TMap]>)(payload);
        } catch (error) {
          onError?.(topic, error, payload);
        }
      }
    },

    subscriberCount(topic) {
      return subscribersOf(topic).size;
    },
  };
}
